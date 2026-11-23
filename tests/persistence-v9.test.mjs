import { authoritativeState } from './helpers/presentation-state.mjs';
import { stripPostV9 } from './helpers/schema-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step } from '../dist/sim.js';
import { saveCampaign, loadCampaign, SAVE_KEY, RULES_VERSION } from '../dist/persistence.js';
import { LEGACY_SAVE_KEY, V9_SOLDIER_DEFAULTS, addV9Defaults } from '../dist/migration.js';
const storage = () => { const slots = new Map(); return { getItem:k => slots.get(k) ?? null, setItem:(k,v) => slots.set(k,v), removeItem:k => slots.delete(k) }; };
const removeNewFields = game => { stripPostV9(game); for (const s of game.soldiers) for (const key of Object.keys(V9_SOLDIER_DEFAULTS)) delete s[key]; return game; };

for (const name of ['v03-save', 'v04-active-save', 'v04-ended-save', 'v05-active-save', 'v05-ended-save', 'v06-active-save', 'v06-ended-save', 'v06-top-active-save', 'v06-top-ended-save']) {
  test(`${name} upgrades with explicit combat defaults and exact original career merit`, () => {
    const envelope = JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
    const mem = storage(), key = name.startsWith('v03') ? LEGACY_SAVE_KEY : SAVE_KEY, encoded = JSON.stringify(envelope);
    mem.setItem(key, encoded);
    const loaded = loadCampaign(mem);
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.game.careers, envelope.game.careers);
    assert.deepEqual(loaded.game.score, envelope.game.score);
    if (!name.startsWith('v03')) {
      assert.deepEqual(loaded.game.soldiers.map(s => s.attack), envelope.game.soldiers.map(s => s.attack));
      assert.deepEqual(loaded.game.soldiers.map(s => s.career), envelope.game.soldiers.map(s => s.career));
    }
    for (const s of loaded.game.soldiers) for (const [key,value] of Object.entries(V9_SOLDIER_DEFAULTS)) assert.deepEqual(s[key], value);
    assert.equal(mem.getItem(key), encoded);
    assert.equal(saveCampaign(loaded.game, mem).ok, true);
    assert.equal(JSON.parse(mem.getItem(SAVE_KEY)).rulesVersion, RULES_VERSION);
  });
}

for (const version of [7, 8]) test(`v${version} keeps exact state and pending attacks when adding v9 defaults`, () => {
  const game = removeNewFields(createGame('checkpoint', { startingRanks: ['SSS+V', 'SSS+IV'], matchMode: version === 8 ? 'relic' : 'control' }));
  if (version === 7) delete game.config.modifier;
  const s = game.soldiers[0];
  s.attack = { kind: 'force', target: game.soldiers.find(other => other.team !== s.team).id, startedTick: 0, resolveTick: 30, form: s.form, weapon: s.weapon, counter: false };
  const before = structuredClone(game), mem = storage();
  mem.setItem(SAVE_KEY, JSON.stringify({version:2,rulesVersion:version,game}));
  const loaded = loadCampaign(mem);
  assert.equal(loaded.error, null); assert.equal(loaded.upgraded, true);
  const originalFields = removeNewFields(structuredClone(loaded.game));
  if (version === 7) delete originalFields.config.modifier;
  assert.deepEqual(originalFields, before);
});

test('v9 round trip retains finite active combat metadata and validates malformed state before replacement', () => {
  assert.equal(RULES_VERSION, 11); // Current schema; v9 fixtures below still exercise the historical boundary.
  const game = addV9Defaults(createGame(7)), mem = storage(), s = game.soldiers[0], enemy = game.soldiers.find(other => other.team !== s.team);
  s.observation = { targetId:enemy.id, x:enemy.x, y:enemy.y, tick:0, vx:0, vy:0 };
  s.forceControl = { targetId:enemy.id, untilTick:26, releaseTick:26, kind:'force_grip' };
  s.barrierUntil = 54; s.barrierEnergy = 22; s.lastForceAbility = 'force_grip'; s.forceAbilitySequence = 5;
  assert.equal(saveCampaign(game, mem).ok, true);
  assert.deepEqual(loadCampaign(mem).game, game);
  const good = mem.getItem(SAVE_KEY);
  for (const mutate of [
    s => { s.forceAbilitySequence = -1; }, s => { s.lastForceAbility = 'invulnerability'; },
    s => { s.forceControl.targetId = s.id; }, s => { s.forceControl.releaseTick = 90000; },
    s => { s.barrierEnergy = 101; }, s => { s.observation.vx = 'fast'; },
    s => { s.airborne = { startTick:0,endTick:0 }; }, s => { delete s.comboIndex; },
    s => { s.comboIndex = 999; }, s => { s.comboUntil = 9000; }, s => { s.guardStartedTick = 1; },
  ]) {
    const bad = JSON.parse(good); mutate(bad.game.soldiers[0]); const encoded = JSON.stringify(bad); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
  const disabled = JSON.parse(good); disabled.game.config.modifier = 'saber_only'; mem.setItem(SAVE_KEY, JSON.stringify(disabled));
  assert.equal(loadCampaign(mem).game, null);
});

test('ordinary v9 simulation can be saved and resumed deterministically', () => {
  const a = createGame(771), mem = storage(); step(a, 3);
  assert.equal(saveCampaign(a, mem).ok, true);
  const b = loadCampaign(mem).game; assert.ok(b);
  addV9Defaults(a); step(a, 3); step(b, 3); assert.deepEqual(a, b);
});

for (const phase of ['active', 'ended']) test(`genuine v08 ${phase} Relic checkpoint retains its complete original state`, () => {
  const envelope = JSON.parse(fs.readFileSync(new URL(`../docs/evidence/v0.9-v08-fixtures/${phase}.json`, import.meta.url), 'utf8'));
  const mem = storage(), encoded = JSON.stringify(envelope); mem.setItem(SAVE_KEY, encoded);
  const loaded = loadCampaign(mem);
  assert.equal(loaded.error, null); assert.equal(loaded.upgraded, true);
  assert.deepEqual(removeNewFields(authoritativeState(loaded.game)), envelope.game);
  assert.equal(mem.getItem(SAVE_KEY), encoded);
  assert.equal(saveCampaign(loaded.game, mem).ok, true);
});

test('airborne metadata uses the actual arc bounds and rejects impossible durations or movement', () => {
  const game = addV9Defaults(createGame(99, { modifier: 'saber_only' })), mem = storage(), s = game.soldiers[0];
  s.airborne = { startTick:0,endTick:36,originX:s.x,originY:s.y,directionX:1,directionY:0,distance:90,height:48,recoveryTicks:10,rotations:1,appliedProgress:0 };
  assert.equal(saveCampaign(game,mem).ok,true); const good=mem.getItem(SAVE_KEY);
  for(const mutate of [a=>{a.endTick=901;},a=>{a.distance=181;},a=>{a.directionX=2;},a=>{a.height=-1;},a=>{a.appliedProgress=1.1;},a=>{a.recoveryTicks=46;}]) {
    const bad=JSON.parse(good);mutate(bad.game.soldiers[0].airborne);mem.setItem(SAVE_KEY,JSON.stringify(bad));assert.equal(loadCampaign(mem).game,null);
  }
});

test('a resolved grip saves its actual owned lift and resumes through release deterministically', () => {
  const game = createGame(1, { startingRanks: ['SSS+V', 'SSS+V'], terrain: 'crossroads' });
  const caster = game.soldiers[0], target = game.soldiers[5], mem = storage();
  game._nextAiDecision = 100;
  for (const s of game.soldiers) { s.saberReadyTick = 120; s.forceReadyTick = 120; }
  Object.assign(caster, { x: 400, y: 270 }); Object.assign(target, { x: 500, y: 270, staggerUntil: 10 });
  caster.attack = { kind:'force', target:target.id, startedTick:0, resolveTick:1, form:caster.form, weapon:caster.weapon, counter:false, abilityId:'force_grip' };
  step(game, 1 / 60);
  assert.equal(target.airborne?.controlSourceId, caster.id, 'the actual Force hit must create the owned lift');
  assert.equal(caster.forceControl?.kind, 'force_grip');
  assert.equal(saveCampaign(game, mem).ok, true);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null); assert.deepEqual(authoritativeState(loaded.game), authoritativeState(game));
  const good = mem.getItem(SAVE_KEY);
  for (const corrupt of [
    g => { g.soldiers[5].airborne.controlSourceId = 'missing-caster'; },
    g => { g.soldiers[5].airborne.controlSourceId = g.soldiers[6].id; },
    g => { g.soldiers[5].airborne.distance = 1; },
    g => { g.soldiers[5].airborne.rotations = 1; },
    g => { g.soldiers[5].airborne.endTick++; },
    g => { g.soldiers[5].airborne.height = 43; },
    g => { g.soldiers[0].forceControl = null; },
    g => { g.config.modifier = 'saber_only'; g.soldiers[0].forceControl = null; },
  ]) {
    const bad = JSON.parse(good); corrupt(bad.game); const encoded = JSON.stringify(bad); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
  step(game, 26 / 60); step(loaded.game, 26 / 60);
  assert.deepEqual(loaded.game, game); assert.equal(target.airborne, null); assert.equal(caster.forceControl, null);
});

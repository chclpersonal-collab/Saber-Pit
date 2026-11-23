import { authoritativeState } from './helpers/presentation-state.mjs';
import { stripPostV9 } from './helpers/schema-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step } from '../dist/sim.js';
import { saveCampaign, loadCampaign, SAVE_KEY, RULES_VERSION } from '../dist/persistence.js';
import { V9_SOLDIER_DEFAULTS } from '../dist/migration.js';
const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/v04-${name}-save.json`, import.meta.url), 'utf8'));
const storage = () => { const slots = new Map(); return { getItem:k => slots.get(k) ?? null, setItem:(k,v) => slots.set(k,v), removeItem:k => slots.delete(k) }; };

for (const name of ['active', 'ended']) test(`authentic v0.4 ${name} checkpoint preserves complete combat and campaign state on upgrade`, () => {
  const old = fixture(name), mem = storage(), encoded = JSON.stringify(old);
  mem.setItem(SAVE_KEY, encoded);
  const result = loadCampaign(mem);
  assert.equal(result.error, null); assert.equal(result.migrated, false); assert.equal(result.upgraded, true);
  assert.match(result.notice, /The battle, attacks in progress, careers, equipment and records were kept/);
  const expected = structuredClone(old.game);
  expected.soldiers.forEach(s => { s.tacticalReason = 'resumed'; s.lastOutcome = null; });
  const originalState = stripPostV9(authoritativeState(result.game));
  delete originalState.config; delete originalState.control; delete originalState.mastery;
  originalState.soldiers.forEach(s => { delete s.formPractice; for (const key of Object.keys(V9_SOLDIER_DEFAULTS)) delete s[key]; });
  if (originalState.roundReport) { delete originalState.roundReport.mastery; delete originalState.roundReport.commendations; }
  assert.deepEqual(originalState, expected, 'all original battlefield state is preserved; only named v0.5 observation and v0.7 tracking fields are additive');
  assert.deepEqual(result.game.config.teamSizes, [5, 5]);
  assert.equal(result.game.config.mapSize, 'legacy');
  assert.equal(result.game.config.mode, 'spectate');
  assert.equal(result.game.control.soldierId, null);
  assert.deepEqual(result.game.control.input, { moveX: 0, moveY: 0, attack: false, force: false, guard: false, dash: false, targetId: null });
  assert.equal(mem.getItem(SAVE_KEY), encoded, 'load never rewrites the old checkpoint');
  const twin = loadCampaign(mem).game;
  step(result.game, 90); step(twin, 90); assert.deepEqual(result.game, twin);
  assert.equal(saveCampaign(result.game, mem).ok, true);
  const saved = JSON.parse(mem.getItem(SAVE_KEY));
  assert.equal(saved.version, 2); assert.equal(saved.rulesVersion, RULES_VERSION);
  const modern = loadCampaign(mem);
  assert.equal(modern.upgraded, false); assert.equal(modern.notice, null);
  assert.deepEqual(modern.game, result.game);
});

test('v0.5 marker requires valid observation state instead of silently downgrading damaged data', () => {
  for (const mutate of [
    e => { e.rulesVersion = 99; }, e => { e.rulesVersion = null; },
    e => { delete e.game.soldiers[0].tacticalReason; }, e => { delete e.game.soldiers[0].lastOutcome; },
    e => { e.game.soldiers[0].tacticalReason = 'x'.repeat(81); },
    e => { e.game.soldiers[0].lastOutcome = { outcome:'hit',damage:10,kind:'force',targetId:'blue-1',tick:0,isCounter:false }; },
    e => { e.game.soldiers[0].lastOutcome = { outcome:'miss',damage:10,kind:'saber',targetId:'red-0',tick:0,isCounter:false }; },
    e => { e.game.soldiers[0].lastOutcome = { outcome:'hit',damage:200,kind:'force',targetId:'red-0',tick:0,isCounter:false }; },
    e => { e.game.soldiers[0].lastOutcome = { outcome:'hit',damage:1,kind:'force',targetId:'red-0',tick:1,isCounter:false }; },
  ]) {
    const mem = storage(); assert.equal(saveCampaign(createGame(4), mem).ok, true);
    const e = JSON.parse(mem.getItem(SAVE_KEY)); mutate(e); const encoded = JSON.stringify(e); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

test('legacy v0.4 normalization rejects malformed present observation fields and never invents missing core state', () => {
  for (const mutate of [
    e => { e.game.soldiers[0].lastOutcome = { outcome:'invented' }; },
    e => { e.game.soldiers[0].tacticalReason = 17; },
    e => { delete e.game.soldiers[0].energy; },
    e => { e.game.records.teams[0].kills++; },
    e => { e.game.soldiers[0].attack = { kind:'saber',weapon:'unknown',form:'shii_cho',target:'red-0',startedTick:0,resolveTick:130,counter:false }; },
  ]) {
    const e = fixture('active'), mem = storage(); mutate(e); const encoded = JSON.stringify(e); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

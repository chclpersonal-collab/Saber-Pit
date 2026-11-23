import { authoritativeState } from './helpers/presentation-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as engine from '../dist/sim.js';
import { FORMS, FORCE_FAMILIES, QUALITY_LEVELS } from '../dist/content.js';
import { SOLDIER_GRADES, MAX_MERIT, MAX_HEALTH_MULTIPLIER, progressionSummary } from '../dist/progression.js';
import { saveCampaign, loadCampaign, SAVE_KEY, RULES_VERSION } from '../dist/persistence.js';
import { canOccupy } from '../dist/terrain.js';

const { createGame, step, nextRound, setFormation, setTargetPriority, duelIntent } = engine;
const forms = Object.keys(FORMS), formations = ['line', 'wedge', 'spread'], priorities = ['balanced', 'nearest', 'weakest', 'objective'];
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const fixture = (version, state) => JSON.parse(fs.readFileSync(new URL(`./fixtures/v${version}-${state}-save.json`, import.meta.url), 'utf8'));
const fighter = (g, team, lane = 0) => g.soldiers.find(s => s.team === team && s.lane === lane);
function roundTrip(g) {
  const mem = storage(), result = saveCampaign(g, mem); assert.equal(result.ok, true, result.error);
  const encoded = mem.getItem(SAVE_KEY); assert.equal(JSON.parse(encoded).rulesVersion, RULES_VERSION);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null); assert.equal(loaded.upgraded, false);
  assert.deepEqual(authoritativeState(loaded.game), authoritativeState(g)); assert.equal(mem.getItem(SAVE_KEY), encoded); return loaded.game;
}
function originalFields(actual, original, label = 'game') {
  if (Array.isArray(original)) { assert.equal(actual.length, original.length, label); original.forEach((v, i) => originalFields(actual[i], v, `${label}[${i}]`)); }
  else if (original !== null && typeof original === 'object') for (const [k, v] of Object.entries(original)) originalFields(actual[k], v, `${label}.${k}`);
  else assert.deepEqual(actual, original, label);
}
function assertEmptyMastery(g) {
  for (const team of g.mastery) for (const slot of team) {
    assert.equal(slot.lastSettledRound, 0);
    assert.deepEqual(Object.keys(slot.forms), forms);
    for (const record of Object.values(slot.forms)) assert.ok(Object.values(record).every(n => n === 0));
    assert.ok(Object.values(slot.commendations).every(n => n === 0));
  }
  for (const s of g.soldiers) for (const record of Object.values(s.formPractice)) assert.ok(Object.values(record).every(n => n === 0));
}

for (const state of ['active', 'ended']) test(`v7 authentic v0.6 ${state} migration preserves every original field and has verified provenance`, () => {
  const provenance = JSON.parse(fs.readFileSync(new URL('./fixtures/v06-provenance.json', import.meta.url)));
  const record = provenance.fixtures.find(f => f.file.endsWith(`-${state}-save.json`));
  const bytes = fs.readFileSync(new URL(`./fixtures/v06-${state}-save.json`, import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.fileSha256);
  assert.equal(provenance.sourceTree, 'f1bb7b04a3abc314470630a50d5fb485c6ae9801');
  const old = JSON.parse(bytes), mem = storage(), encoded = JSON.stringify(old);
  assert.equal(crypto.createHash('sha256').update(encoded).digest('hex'), record.canonicalEnvelopeSha256); mem.setItem(SAVE_KEY, encoded);
  const result = loadCampaign(mem); assert.equal(result.error, null); assert.equal(result.upgraded, true); assert.equal(result.migrated, false);
  originalFields(result.game, old.game); assert.equal(mem.getItem(SAVE_KEY), encoded);
  assert.deepEqual(result.game.config.formations, ['line', 'line']); assert.deepEqual(result.game.config.targetPriorities, ['balanced', 'balanced']);
  assert.equal(result.game.config.matchMode, 'control'); assert.equal(result.game.config.roundDuration, 90); assert.equal(result.game.config.targetScore, 30);
  assert.ok(result.game.soldiers.some(s => s.attack)); assertEmptyMastery(result.game);
  const twin = loadCampaign(mem).game; step(result.game, 90); step(twin, 90); assert.deepEqual(twin, result.game); roundTrip(result.game);
  if (state === 'ended') { assertEmptyMastery(result.game); nextRound(result.game); assertEmptyMastery(result.game); }
});

for (const version of ['04', '05', '06']) for (const state of ['active', 'ended']) test(`v7 v${version} ${state} upgrade never invents historical form records`, () => {
  const mem = storage(), old = fixture(version, state), encoded = JSON.stringify(old); mem.setItem(SAVE_KEY, encoded);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null); assertEmptyMastery(loaded.game);
  assert.equal(mem.getItem(SAVE_KEY), encoded); roundTrip(loaded.game);
});

test('v7 authentic old saves reject missing or damaged required state without rewriting it', () => {
  const common = [
    e => { delete e.game.soldiers[0].energy; }, e => { e.game.records.teams[0].kills++; },
    e => { e.game.soldiers[0].alive = !e.game.soldiers[0].alive; }, e => { e.game.roundDuration = 45; },
    e => { e.game.terrain.width++; }, e => { e.game.careers[0][0].merit = -1; },
    e => { e.game.soldiers.find(s => s.attack).attack.resolveTick = -1; },
  ];
  for (const version of ['04', '05', '06']) for (const mutate of common) {
    const old = fixture(version, 'active'), mem = storage(); mutate(old); const encoded = JSON.stringify(old); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null, `v${version} corruption accepted: ${mutate}`); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
  for (const mutate of [
    e => { delete e.game.config; }, e => { delete e.game.control; }, e => { delete e.game.config.teamSizes; },
    e => { e.game.config.teamSizes = [7, 10]; }, e => { e.game.config.mode = 'unknown'; },
    e => { e.game.control.soldierId = 'red-0'; }, e => { e.game.config.mapSize = 'constructor'; },
    e => { e.rulesVersion = 7; },
  ]) {
    const old = fixture('06', 'active'), mem = storage(); mutate(old); const encoded = JSON.stringify(old); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null, `v06 corruption accepted: ${mutate}`); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

test('v7 every formation and target priority on both teams survives active save continuation', () => {
  for (const formation of formations) for (const priority of priorities) for (const matchMode of ['control', 'elimination']) {
    const g = createGame(710, { teamSizes: [3, 5], mapSize: 'small', formations: [formation, formation], targetPriorities: [priority, priority], matchMode, roundDuration: 45, mode: 'spectate' });
    step(g, .5); const twin = roundTrip(g); step(g, .5); step(twin, .5); assert.deepEqual(twin, g);
    assert.ok(g.soldiers.every(s => canOccupy(g.terrain, s)));
  }
});

test('v7 formation and target changes preserve position, slot identity, stats and RNG immediately', () => {
  const g = createGame(710, { teamSizes: [15, 1], mapSize: 'small' });
  for (const team of [0, 1]) for (const formation of formations) for (const priority of priorities) {
    const before = structuredClone(g); assert.equal(setFormation(g, formation, team), true); assert.equal(setTargetPriority(g, priority, team), true);
    assert.deepEqual(g.soldiers, before.soldiers); assert.equal(g.rngState, before.rngState); assert.deepEqual(g.records, before.records); assert.deepEqual(g.mastery, before.mastery);
    assert.equal(g.config.formations[team], formation); assert.equal(g.config.targetPriorities[team], priority);
  }
  const before = structuredClone(g);
  for (const team of [-1, 2, 1.5, '0', null]) { assert.equal(setFormation(g, 'wedge', team), false); assert.equal(setTargetPriority(g, 'nearest', team), false); }
  for (const id of ['constructor', '__proto__', '', null, 1]) { assert.equal(setFormation(g, id), false); assert.equal(setTargetPriority(g, id), false); }
  assert.deepEqual(g, before);
});

function targetScenario(team, priority = 'balanced') {
  const g = createGame(19, { teamSizes: [3, 3], mapSize: 'small', terrain: 'crossroads', targetPriorities: [priority, priority], opponentForm: 'shii_cho' });
  g.terrain.solids = []; g.terrain.zones = []; g._nextAiDecision = 1e8;
  const a = fighter(g, team), direction = team === 0 ? 1 : -1; a.x = team === 0 ? 100 : 860; a.y = 270;
  const opponents = g.soldiers.filter(s => s.team !== team);
  opponents.forEach((s, i) => { s.x = a.x + direction * [60, 90, 130][i]; s.y = 270; s.hp = i === 1 ? 1 : s.maxHp; });
  g.objective.x = opponents[2].x; g.objective.y = 270; g.objective.radius = 30;
  return { g, a, opponents };
}

test('v7 the actual engine applies all target priorities symmetrically to visible opponents', () => {
  for (const team of [0, 1]) for (const [priority, index] of [['balanced', 0], ['nearest', 0], ['weakest', 1], ['objective', 2]]) {
    const { g, a, opponents } = targetScenario(team, priority), before = structuredClone(g);
    assert.equal(duelIntent(g, a).targetId, opponents[index].id, `${team}/${priority}`); assert.deepEqual(g, before, 'intent must be read only');
  }
});

test('v7 priorities cannot expose fog-hidden or wall-hidden enemies, including manual target requests', () => {
  for (const priority of priorities) {
    const { g, a, opponents } = targetScenario(0, priority); g.config.environment = 'fog';
    opponents[0].x = 150; opponents[1].x = 410; opponents[2].x = 450;
    assert.deepEqual(engine.visibleEnemyTargets(g, a.id).map(s => s.id), [opponents[0].id]);
    assert.equal(duelIntent(g, a).targetId, opponents[0].id);
    assert.equal(engine.setControlledFighter(g, a.id), true); engine.setPlayerInput(g, { targetId: opponents[1].id, force: true });
    assert.equal(duelIntent(g, a).targetId, opponents[0].id);
    g.terrain.solids = [{ id: 'occluder', kind: 'wall', x: 120, y: 200, width: 10, height: 140 }];
    assert.deepEqual(engine.visibleEnemyTargets(g, a.id), []); assert.equal(duelIntent(g, a).targetId, null); assert.equal(duelIntent(g, a).action, 'wait');
  }
});

test('v7 visible manual target choice overrides squad priority without auto-moving the fighter', () => {
  const { g, a, opponents } = targetScenario(0, 'nearest'); engine.setControlledFighter(g, a.id);
  engine.setPlayerInput(g, { targetId: opponents[2].id }); assert.equal(duelIntent(g, a).targetId, opponents[2].id);
  const position = [a.x, a.y]; step(g, 1 / 60); assert.deepEqual([a.x, a.y], position);
  engine.clearPlayerInput(g); assert.equal(duelIntent(g, a).targetId, opponents[0].id);
});

for (const matchMode of ['control', 'elimination']) for (const roundDuration of [45, 90, 150]) test(`v7 ${matchMode} ${roundDuration}s settles on the exact configured deadline and only once`, () => {
  const g = createGame(44, { teamSizes: [1, 1], mapSize: 'large', terrain: 'crossroads', environment: 'fog', matchMode, roundDuration, autoCommand: false });
  g._nextAiDecision = 1e8; for (const s of g.soldiers) s.staggerUntil = 1e8;
  step(g, roundDuration - 1 / 60); assert.equal(g.status, 'playing'); assert.equal(g.tick, roundDuration * 60 - 1);
  step(g, 1 / 60); assert.equal(g.status, 'ended'); assert.equal(g.tick, roundDuration * 60); assert.equal(g.timeLeft, 0); assert.equal(g.winner, null);
  assert.deepEqual(g.objective.points, [0, 0]); assert.equal(g.draws, 1); assert.equal(g.history.length, 1);
  const before = structuredClone(g); step(g, roundDuration); assert.deepEqual(g, before);
});

test('v7 control can win through capture while elimination never advances objective counters', () => {
  for (const matchMode of ['control', 'elimination']) {
    const g = createGame(44, { teamSizes: [1, 1], mapSize: 'large', terrain: 'crossroads', environment: 'fog', matchMode, roundDuration: 45, autoCommand: false });
    g._nextAiDecision = 1e8; const a = fighter(g, 0), b = fighter(g, 1);
    a.x = g.objective.x; a.y = g.objective.y; a.holdBank = a.bank = 2; b.staggerUntil = 1e8;
    engine.setControlledFighter(g, a.id); step(g, 40);
    if (matchMode === 'control') { assert.equal(g.status, 'ended'); assert.equal(g.winner, 0); assert.ok(Math.abs(g.objective.points[0] - 30) < 1e-8); }
    else { assert.equal(g.status, 'playing'); assert.deepEqual(g.objective.points, [0, 0]); assert.equal(g.objective.capture, 0); assert.deepEqual(g.stats.objectiveTime, [0, 0]); assert.equal(a.objectiveSeconds, 0); }
  }
});

test('v7 mastery settles once per real round and never on reading, saving, loading or next-round preparation', () => {
  const g = createGame(711, { teamSizes: [1, 1], mapSize: 'small', mode: 'spectate', roundDuration: 45 });
  const empty = structuredClone(g.mastery); step(g, 2); assert.deepEqual(g.mastery, empty);
  const active = roundTrip(g); assert.deepEqual(active.mastery, empty); step(g, 45); assert.equal(g.status, 'ended');
  for (const s of g.soldiers) {
    const m = g.mastery[s.team][s.lane]; assert.equal(m.lastSettledRound, 1);
    assert.equal(Object.values(m.forms).reduce((n, form) => n + form.rounds, 0), 1);
    const practiced = Object.values(s.formPractice); assert.equal(Object.values(m.forms).reduce((n, f) => n + f.kills, 0), practiced.reduce((n, f) => n + f.kills, 0));
  }
  const before = structuredClone(g.mastery), loaded = roundTrip(g); assert.deepEqual(loaded.mastery, before);
  step(loaded, 45); assert.deepEqual(loaded.mastery, before); nextRound(loaded); assert.deepEqual(loaded.mastery, before); roundTrip(loaded);
  for (const s of loaded.soldiers) for (const row of Object.values(s.formPractice)) assert.ok(Object.values(row).every(n => n === 0));
});

test('v7 accumulated form records give no hidden combat stat or RNG advantage', () => {
  const trained = createGame(712, { teamSizes: [3, 3], mapSize: 'small', mode: 'spectate', roundDuration: 45 });
  step(trained, 45); assert.equal(trained.status, 'ended'); nextRound(trained);
  const blank = structuredClone(trained), neutral = createGame(712, { teamSizes: [3, 3], mapSize: 'small' }).mastery;
  blank.mastery = neutral;
  assert.notDeepEqual(trained.mastery, blank.mastery); assert.deepEqual(trained.soldiers, blank.soldiers);
  step(trained, 3); step(blank, 3);
  assert.deepEqual(trained.soldiers, blank.soldiers); assert.deepEqual(trained.stats, blank.stats); assert.equal(trained.rngState, blank.rngState);
});

test('v7 rejects malformed new config and mastery fields without overwriting a checkpoint', () => {
  const base = createGame(43, { teamSizes: [1, 1], mapSize: 'small' }), mem = storage(); assert.equal(saveCampaign(base, mem).ok, true);
  const good = JSON.parse(mem.getItem(SAVE_KEY));
  for (const mutate of [
    e => { delete e.game.config.formations; }, e => { e.game.config.formations = ['wedge']; }, e => { e.game.config.formations[0] = '__proto__'; },
    e => { e.game.config.targetPriorities[1] = 'constructor'; }, e => { e.game.config.matchMode = 'unknown'; },
    e => { e.game.config.roundDuration = 46; }, e => { e.game.config.targetScore = 31; },
    e => { delete e.game.mastery; }, e => { e.game.mastery[0][0].forms.shii_cho.rounds = -1; },
    e => { e.game.mastery[0][0].lastSettledRound = 2; }, e => { e.game.mastery[0][0].commendations.mvp = -1; },
    e => { delete e.game.soldiers[0].formPractice; }, e => { e.game.soldiers[0].formPractice.shii_cho.ticks = -1; },
    e => { e.game.soldiers[0].formPractice.shii_cho.damage = 1e12; },
  ]) {
    const e = structuredClone(good); mutate(e); const encoded = JSON.stringify(e); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null, `accepted ${mutate}`); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

test('v7 static DOM exposes all setup, next-round and accessible target-feedback controls', () => {
  const html = fs.readFileSync(new URL('../dist/classic.html', import.meta.url), 'utf8'), app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  for (const id of ['setupStartingOptions', 'setupStartingRank0', 'setupStartingRank1', 'setupStartingSaber0', 'setupStartingSaber1', 'setupStartingForce0', 'setupStartingForce1', 'setupStartingForceQuality0', 'setupStartingForceQuality1', 'startingHint0', 'startingHint1', 'setupMatchMode', 'setupRoundDuration', 'setupDoctrine', 'setupEnemyDoctrine', 'setupFormation0', 'setupFormation1', 'setupPriority0', 'setupPriority1', 'nextEnemyDoctrine', 'nextFormation0', 'nextFormation1', 'nextPriority0', 'nextPriority1', 'cycleTargetBtn', 'targetStatus', 'combatStatus', 'unitMastery', 'unitCommendations', 'resultMastery', 'resultCommendations', 'resultRules', 'matchRulesHint', 'footerRules']) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length, 1, `${id} must exist once`); const dynamicId = id.replace(/[01]$/, '${team}');
    assert.ok(app.includes(id) || app.includes(dynamicId) || (id === 'cycleTargetBtn' && app.includes('[data-player-action]')) || id === 'setupStartingOptions', `${id} must be wired`);
  }
  for (const field of ['matchMode', 'roundDuration', 'formations', 'targetPriorities']) assert.ok(app.includes(field));
  assert.match(html, /data-player-action="cycle"/); assert.match(app, /visibleEnemyTargets/); assert.match(app, /document\.activeElement\s*===\s*canvas/);
  assert.match(html, /id="combatStatus"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="combatStatus"/);
});

test('v7 coordinated tampering with lifetime and report form totals is rejected against round evidence', () => {
  const g = createGame(713, { teamSizes: [1, 1], mapSize: 'small', mode: 'spectate', roundDuration: 45 }); step(g, 45);
  assert.equal(g.status, 'ended'); const mem = storage(); assert.equal(saveCampaign(g, mem).ok, true);
  const envelope = JSON.parse(mem.getItem(SAVE_KEY)), row = envelope.game.roundReport.mastery[0];
  const used = Object.keys(row.after.forms).find(form => row.after.forms[form].rounds > 0); assert.ok(used);
  envelope.game.mastery[row.team][row.lane].forms[used].damage += 1; row.after.forms[used].damage += 1;
  const encoded = JSON.stringify(envelope); mem.setItem(SAVE_KEY, encoded);
  assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
});


test('v7 manual attack windup keeps facing and credits its original form after a form switch', () => {
  const g = createGame(42, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'play', opponentForm: 'shii_cho' });
  g.terrain.solids = []; g.terrain.zones = []; g._nextAiDecision = 1e8;
  const a = fighter(g, 0), b = fighter(g, 1); a.x = 465; a.y = 270; b.x = 500; b.y = 270;
  a.saberReadyTick = 0; b.saberReadyTick = b.forceReadyTick = 1000;
  engine.setPlayerInput(g, { attack: true }); step(g, 1 / 60); assert.equal(a.attack.form, 'shii_cho'); assert.equal(a.facing, 1);
  assert.equal(engine.setForm(g, 0, 'niman'), true); engine.setPlayerInput(g, { moveX: -1 }); step(g, 1 / 60); assert.equal(a.facing, 1);
  engine.setPlayerInput(g, { moveX: 0 }); step(g, .5);
  assert.ok(a.formPractice.shii_cho.damage > 0); assert.equal(a.formPractice.niman.damage, 0); assert.equal(a.lastOutcome.targetId, b.id);
});

test('v7 browser entrypoint imports only existing named runtime exports', async () => {
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  const imports = [...app.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)];
  assert.ok(imports.length >= 10);
  for (const [, names, path] of imports) {
    const namespace = await import(new URL(path, new URL('../dist/app.js', import.meta.url)));
    for (const name of names.split(',').map(value => value.trim().split(/\s+as\s+/)[0])) assert.ok(Object.hasOwn(namespace, name), `${path} is missing ${name}`);
  }
});

test('v7 friendly formation separation cannot move or steer the manually controlled fighter', () => {
  for (const moveX of [0, 1]) {
    const positions = [];
    for (const formation of formations) {
      const g = createGame(755, { teamSizes: [15, 15], mapSize: 'large', terrain: 'craterfield', environment: 'clear', mode: 'play', autoCommand: false, playerSlot: 7 });
      g._nextAiDecision = 1e8; engine.command(g, 'hold'); const s = g.soldiers.find(s => s.id === g.control.soldierId), initial = [s.x, s.y];
      setFormation(g, formation, 0); engine.setPlayerInput(g, { moveX }); step(g, .5);
      if (!moveX) assert.deepEqual([s.x, s.y], initial, `${formation} allies displaced an idle manual fighter`);
      positions.push([s.x, s.y]);
    }
    assert.deepEqual(positions[1], positions[0]); assert.deepEqual(positions[2], positions[0]);
  }
});


test('v7 every starting rank initializes both teams with real bounded career stats and no invented achievements', () => {
  for (const grade of SOLDIER_GRADES) {
    const g = createGame(714, { teamSizes: [2, 3], mapSize: 'small', startingRanks: [grade.label, grade.label] });
    assert.deepEqual(g.config.startingRanks, [grade.label, grade.label]); assertEmptyMastery(g);
    for (const s of g.soldiers) {
      assert.equal(g.careers[s.team][s.lane].merit, grade.threshold); assert.equal(s.career.grade, grade.label);
      assert.equal(s.hp, Math.round(120 * progressionSummary(grade.threshold).modifiers.healthMultiplier * 1000) / 1000);
      assert.equal(s.maxHp, s.hp); assert.equal(s.xp, 0); assert.equal(s.rank, 0);
      assert.deepEqual([s.kills, s.deaths, s.assists, s.damageDealt, s.objectiveSeconds], [0, 0, 0, 0, 0]);
    }
    for (const team of g.records.teams) assert.ok(Object.values(team).every(n => n === 0));
    roundTrip(g);
  }
  const defaultGame = createGame(714); assert.deepEqual(defaultGame.config.startingRanks, ['F', 'F']);
});

test('v7 all starting saber and Force choices initialize actual equipment independently of rank and form', () => {
  for (const family of FORCE_FAMILIES) for (const saber of QUALITY_LEVELS) for (const force of QUALITY_LEVELS) {
    const g = createGame(715, { teamSizes: [1, 2], mapSize: 'small', startingRanks: ['SSS+V', 'SSS+I'],
      startingSaberQuality: [saber.id, saber.id], startingForceFamily: [family.id, family.id], startingForceQuality: [force.id, force.id] });
    for (const s of g.soldiers) {
      assert.equal(engine.KNIVES[s.meleeWeapon].quality, saber.quality); assert.equal(engine.WEAPONS[s.weapon].quality, force.quality); assert.equal(engine.WEAPONS[s.weapon].family, family.id);
      assert.deepEqual(g.loadouts[s.team].roster[s.lane], { weapon: s.weapon, meleeWeapon: s.meleeWeapon });
    }
    assertEmptyMastery(g); roundTrip(g); step(g, 1 / 60); roundTrip(g);
  }
});

for (const matchMode of ['control', 'elimination']) test(`v7 highest starting rank stays bounded and saveable across ${matchMode} rounds`, () => {
  const g = createGame(716, { teamSizes: [15, 15], mapSize: 'small', mode: 'spectate', matchMode, roundDuration: 45,
    startingRanks: ['SSS+V', 'SSS+V'], startingSaberQuality: ['improved', 'improved'], startingForceFamily: ['force_burst', 'force_pulse'], startingForceQuality: ['improved', 'improved'] });
  assertEmptyMastery(g); const initial = roundTrip(g); step(g, 45); step(initial, 45); assert.deepEqual(initial, g); assert.equal(g.status, 'ended'); roundTrip(g);
  const careers = structuredClone(g.careers), mastery = structuredClone(g.mastery); nextRound(g);
  assert.deepEqual(g.careers, careers); assert.deepEqual(g.mastery, mastery); assert.ok(g.careers.flat().every(c => c.merit === MAX_MERIT));
  assert.ok(g.soldiers.every(s => s.maxHp <= 132 * MAX_HEALTH_MULTIPLIER + 1e-6)); roundTrip(g);
  step(g, 45); assert.equal(g.status, 'ended'); roundTrip(g);
});

test('v7 starting settings apply only to new careers and equipment, never resetting later rounds or loaded state', () => {
  const g = createGame(717, { teamSizes: [1, 1], mapSize: 'small', mode: 'spectate', roundDuration: 45, startingRanks: ['E', 'D'], startingSaberQuality: ['worn', 'improved'], startingForceFamily: ['force_pulse', 'force_burst'], startingForceQuality: ['improved', 'worn'] });
  const original = g.careers.map(team => team[0].merit); step(g, 45); assert.equal(g.status, 'ended');
  assert.ok(g.careers.every((team, i) => team[0].merit > original[i])); const after = structuredClone(g.careers), loaded = roundTrip(g);
  nextRound(g); nextRound(loaded); assert.deepEqual(g, loaded); assert.deepEqual(g.careers, after); roundTrip(g);
});

test('v7 invalid starting rank and equipment settings reject rather than silently choosing defaults', () => {
  for (const bad of [
    { startingRanks: ['SSS+VI', 'F'] }, { startingRanks: ['SSS+ I', 'F'] }, { startingRanks: ['F'] }, { startingRanks: 'SSS+V' },
    { startingRanks: ['constructor', 'F'] }, { startingRanks: [6000, 'F'] },
    { startingSaberQuality: ['legendary', 'standard'] }, { startingSaberQuality: ['improved'] },
    { startingForceQuality: ['improved', '__proto__'] }, { startingForceQuality: [2, 1] },
    { startingForceFamily: ['force_lightning', 'force_push'] }, { startingForceFamily: ['force_push'] },
  ]) assert.throws(() => createGame(718, bad), RangeError, JSON.stringify(bad));
  const g = createGame(718), mem = storage(); assert.equal(saveCampaign(g, mem).ok, true); const good = JSON.parse(mem.getItem(SAVE_KEY));
  for (const field of ['startingRanks', 'startingSaberQuality', 'startingForceQuality', 'startingForceFamily']) {
    const e = structuredClone(good); delete e.game.config[field]; const encoded = JSON.stringify(e); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

for (const state of ['active', 'ended']) test(`v7 naturally earned v0.6 terminal-rank ${state} save preserves old summaries until normal progression`, () => {
  const provenance = JSON.parse(fs.readFileSync(new URL('./fixtures/v06-top-provenance.json', import.meta.url)));
  const record = provenance.fixtures.find(row => row.file.endsWith(`-${state}-save.json`));
  const bytes = fs.readFileSync(new URL(`./fixtures/v06-top-${state}-save.json`, import.meta.url)), old = JSON.parse(bytes), encoded = JSON.stringify(old);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.fileSha256);
  assert.equal(crypto.createHash('sha256').update(encoded).digest('hex'), record.canonicalEnvelopeSha256);
  assert.ok(old.game.round >= 78); assert.ok(old.game.careers.flat().every(c => c.merit === 2400));
  assert.ok(old.game.soldiers.every(s => s.career.grade === 'SSS+' && s.career.nextGrade === null && s.career.progress === 1));
  const mem = storage(); mem.setItem(SAVE_KEY, encoded); const result = loadCampaign(mem); assert.equal(result.error, null);
  originalFields(result.game, old.game); assertEmptyMastery(result.game); assert.equal(mem.getItem(SAVE_KEY), encoded); roundTrip(result.game);
  const twin = loadCampaign(mem).game; step(result.game, 90); step(twin, 90); assert.deepEqual(twin, result.game); assert.equal(result.game.status, 'ended');
  nextRound(result.game); nextRound(twin); assert.deepEqual(twin, result.game);
  assert.ok(result.game.soldiers.every(s => s.career.grade === 'SSS+' && s.career.nextGrade === 'SSS+I' && s.career.nextThreshold === 3000)); roundTrip(result.game);
});

test('v7 old top-rank saves cannot smuggle expanded merit or fabricated modern summaries', () => {
  const pristine = JSON.parse(fs.readFileSync(new URL('./fixtures/v06-top-active-save.json', import.meta.url)));
  for (const mutate of [
    e => { e.game.careers[0][0].merit = 2401; },
    e => { e.game.soldiers[0].career.modifiers.healthMultiplier = 1.3; },
    e => { e.game.soldiers[0].career = progressionSummary(2400); },
  ]) {
    const old = structuredClone(pristine), mem = storage(); mutate(old); const encoded = JSON.stringify(old); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

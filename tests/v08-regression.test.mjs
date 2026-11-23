import { authoritativeState } from './helpers/presentation-state.mjs';
import { stripPostV9 } from './helpers/schema-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step, nextRound, resolveDamage, setPlayerInput, setControlledFighter } from '../dist/sim.js';
import { advanceRelic, relicAssignment } from '../dist/relic.js';
import { normalizeMatchRules, resolveRoundOutcome } from '../dist/match-rules.js';
import { saveCampaign, loadCampaign, SAVE_KEY, RULES_VERSION } from '../dist/persistence.js';
import { LEGACY_SAVE_KEY, addV9Defaults } from '../dist/migration.js';
import { SOLDIER_GRADES } from '../dist/progression.js';
import { canOccupy, moveToward } from '../dist/terrain.js';

// Independent acceptance expectations use literal rules, not implementation constants.
const make = (options = {}) => createGame('independent-v08', { matchMode: 'relic', mapSize: 'small',
  terrain: 'crossroads', teamSizes: [2, 2], mode: 'spectate', roundDuration: 45, ...options });
const memory = () => { const values = new Map(); return {
  getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
}; };
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const fighter = (g, id = 'blue-0') => g.soldiers.find(s => s.id === id);
const relocate = (s, p) => Object.assign(s, { x: p.x, y: p.y, destinationX: p.x, destinationY: p.y });
function clearCenter(g) {
  for (const s of g.soldiers) relocate(s, { x: s.team ? g.terrain.width - 90 : 90, y: 90 + s.lane * 30 });
  return g;
}
function pickup(g, id = 'blue-0') {
  clearCenter(g); const s = fighter(g, id); relocate(s, g.objective);
  advanceRelic(g); assert.equal(g.objective.carrierId, id); return s;
}
function roundTrip(g) {
  const mem = memory(), saved = saveCampaign(g, mem); assert.equal(saved.ok, true, saved.error);
  const bytes = mem.getItem(SAVE_KEY); assert.equal(JSON.parse(bytes).rulesVersion, RULES_VERSION);
  const resumed = loadCampaign(mem); assert.equal(resumed.error, null); assert.equal(resumed.upgraded, false);
  assert.equal(mem.getItem(SAVE_KEY), bytes); return resumed.game;
}

test('v8 independent mode defaults retain old Control and expose exactly three Relic deliveries', () => {
  assert.deepEqual(normalizeMatchRules(), { matchMode: 'control', roundDuration: 90, targetScore: 30 });
  const rules = normalizeMatchRules({ matchMode: 'relic' });
  assert.equal(rules.targetScore, 3); assert.equal(rules.roundDuration, 90);
  for (const targetScore of [0, 1, 2, 4, 30, '3']) assert.throws(() => normalizeMatchRules({ matchMode: 'relic', targetScore }));
  const g = make(); assert.equal(g.config.modifier, 'standard'); assert.equal(g.objective.state, 'available');
  assert.deepEqual(g.objective.points, [0, 0]); assert.equal(g.objective.carrierId, null);
  assert.equal(g.objective.x, 480); assert.equal(g.objective.y, 270); assert.equal(g.objective.radius, 22);
});

test('v8 neutral pickup boundary is inclusive, opponent presence blocks it, and dead opponents do not', () => {
  const g = clearCenter(make()), blue = fighter(g), red = fighter(g, 'red-0');
  relocate(blue, { x: 502.001, y: 270 }); advanceRelic(g); assert.equal(g.objective.carrierId, null);
  relocate(blue, { x: 502, y: 270 }); relocate(red, { x: 458, y: 270 });
  advanceRelic(g); assert.equal(g.objective.carrierId, null); assert.equal(g.objective.contested, true);
  assert.deepEqual(g.objective.presence, [1, 1]);
  // Suppression does not make a living defender disappear from a contested pickup.
  red.pinned = true; advanceRelic(g); assert.equal(g.objective.carrierId, null);
  resolveDamage(g, [{ target: red.id, amount: red.hp }]); advanceRelic(g);
  assert.equal(g.objective.carrierId, blue.id); assert.equal(g.objective.owner, 0);
});

test('v8 nearest ready friendly gets pickup; exact ties ignore roster iteration order and consume no RNG', () => {
  for (const reverse of [false, true]) {
    const g = clearCenter(make()), a = fighter(g), b = fighter(g, 'blue-1');
    relocate(a, { x: 470, y: 270 }); relocate(b, { x: 490, y: 270 });
    if (reverse) g.soldiers.reverse();
    const rng = g.rngState; advanceRelic(g); assert.equal(g.objective.carrierId, 'blue-0'); assert.equal(g.rngState, rng);
  }
  const g = clearCenter(make()); relocate(fighter(g), { x: 460, y: 270 }); relocate(fighter(g, 'blue-1'), { x: 485, y: 270 });
  advanceRelic(g); assert.equal(g.objective.carrierId, 'blue-1');
});

test('v8 unready fighters cannot pick up and readiness recovers at the precise stagger boundary', () => {
  for (const status of ['pinned', 'rallying', 'attack', 'staggerUntil']) {
    const g = clearCenter(make()), s = fighter(g); relocate(s, g.objective);
    s[status] = status === 'attack' ? { kind: 'saber' } : status === 'staggerUntil' ? 1 : true;
    advanceRelic(g); assert.equal(g.objective.carrierId, null, status);
    s[status] = status === 'attack' ? null : status === 'staggerUntil' ? 0 : false;
    advanceRelic(g); assert.equal(g.objective.carrierId, s.id, status);
  }
});

test('v8 delivery requires own extraction and readiness; reset locks for 120 ticks and repeated updates cannot score twice', () => {
  for (const team of [0, 1]) {
    const g = make(), s = pickup(g, team ? 'red-0' : 'blue-0'), own = g.objective.extractionZones[team];
    relocate(s, g.objective.extractionZones[1 - team]); advanceRelic(g); assert.deepEqual(g.objective.points, [0, 0]);
    relocate(s, { x: own.x, y: own.y + 48.001 }); advanceRelic(g); assert.deepEqual(g.objective.points, [0, 0]);
    relocate(s, { x: own.x, y: own.y + 48 }); s.staggerUntil = 1; advanceRelic(g); assert.deepEqual(g.objective.points, [0, 0]);
    s.staggerUntil = 0; advanceRelic(g); assert.equal(g.objective.points[team], 1);
    assert.equal(g.objective.state, 'resetting'); assert.equal(g.objective.carrierId, null); assert.equal(g.objective.owner, null);
    assert.equal(g.objective.unlockTick, 120); assert.deepEqual({ x: g.objective.x, y: g.objective.y }, g.objective.home);
    relocate(s, g.objective.home); for (let i = 0; i < 10; i++) advanceRelic(g);
    assert.equal(g.objective.points[team], 1); assert.equal(g.objective.carrierId, null);
    g.tick = 119; advanceRelic(g); assert.equal(g.objective.carrierId, null);
    g.tick = 120; advanceRelic(g); assert.equal(g.objective.carrierId, s.id); assert.equal(g.objective.points[team], 1);
  }
});

test('v8 lethal damage drops at the post-knockback death site and locks pickup for exactly 30 ticks', () => {
  const g = make(), s = pickup(g), enemy = fighter(g, 'red-0');
  relocate(enemy, { x: s.x + 20, y: s.y }); const before = { x: s.x, y: s.y };
  resolveDamage(g, [{ target: s.id, source: enemy.id, amount: s.hp, push: 12 }]);
  assert.equal(s.alive, false); assert.notEqual(s.x, before.x); assert.equal(g.objective.state, 'available');
  assert.equal(g.objective.carrierId, null); assert.equal(g.objective.owner, null);
  assert.equal(g.objective.x, s.x); assert.equal(g.objective.y, s.y); assert.equal(g.objective.unlockTick, 30);
  relocate(enemy, g.objective); advanceRelic(g); assert.equal(g.objective.carrierId, null);
  g.tick = 29; advanceRelic(g); assert.equal(g.objective.carrierId, null);
  g.tick = 30; advanceRelic(g); assert.equal(g.objective.carrierId, enemy.id); assert.deepEqual(g.objective.points, [0, 0]);
});

test('v8 simultaneous carrier death at extraction never awards a delivery', () => {
  const g = make(), carrier = pickup(g); relocate(carrier, g.objective.extractionZones[0]);
  resolveDamage(g, [{ target: carrier.id, amount: carrier.hp }]); advanceRelic(g);
  assert.deepEqual(g.objective.points, [0, 0]); assert.equal(g.objective.state, 'available');
});

test('v8 three deliveries settle once, elimination wins precedence, timeout compares deliveries then bodies then health', () => {
  const g = make();
  for (let delivery = 1; delivery <= 3; delivery++) {
    g.tick = g.objective.unlockTick; const s = pickup(g); relocate(s, g.objective.extractionZones[0]); advanceRelic(g);
    assert.equal(g.objective.points[0], delivery);
    assert.equal(resolveRoundOutcome(g)?.winner ?? null, delivery < 3 ? null : 0);
  }
  const timeout = make(); timeout.tick = 45 * 60; timeout.objective.points = [1, 2];
  assert.equal(resolveRoundOutcome(timeout).winner, 1);
  timeout.objective.points = [1, 1]; fighter(timeout, 'red-1').alive = false;
  assert.equal(resolveRoundOutcome(timeout).winner, 0);
  fighter(timeout, 'red-1').alive = true; fighter(timeout).hp--;
  assert.equal(resolveRoundOutcome(timeout).winner, 1);
  fighter(timeout).hp++; assert.equal(resolveRoundOutcome(timeout).winner, null);
  g.soldiers.filter(s => s.team === 0).forEach(s => { s.alive = false; s.hp = 0; });
  assert.equal(resolveRoundOutcome(g).winner, 1, 'elimination takes precedence over a completed delivery target');
  g.soldiers.forEach(s => { s.alive = false; s.hp = 0; }); assert.equal(resolveRoundOutcome(g).winner, null);
});

test('v8 actual player movement is 28% slower while carrying and carrier cannot start or retain a dash', () => {
  const carried = make({ mode: 'play' }), free = make({ mode: 'play' });
  const a = pickup(carried), b = fighter(free); clearCenter(free);
  a.dashUntil = 100; // Reacquire test below checks cancellation at the pickup boundary.
  carried.objective.state = 'available'; carried.objective.carrierId = null; carried.objective.owner = null;
  advanceRelic(carried); assert.equal(a.dashUntil, carried.tick);
  for (const [g, s] of [[carried, a], [free, b]]) {
    relocate(s, { x: 110, y: 270 }); g._nextAiDecision = 10000;
    setPlayerInput(g, { moveY: 1, dash: false });
  }
  const before = a.energy; setPlayerInput(carried, { dash: true });
  step(carried, 1 / 60); step(free, 1 / 60);
  assert.ok(Math.abs((a.y - 270) / (b.y - 270) - .72) < 1e-8);
  assert.equal(a.dashUntil, 0); assert.equal(a.energy, before); assert.equal(carried.objective.carrierId, a.id);
});

test('v8 extraction routes remain collision free for both teams on every supported map and size', () => {
  for (const terrain of ['crossroads', 'zigzag', 'craterfield']) for (const mapSize of ['small', 'medium', 'large']) {
    const g = make({ terrain, mapSize }); assert.equal(canOccupy(g.terrain, g.objective), true);
    for (const goal of g.objective.extractionZones) {
      assert.equal(canOccupy(g.terrain, goal), true, `${terrain}/${mapSize}/team${goal.team}`);
      let p = { ...g.objective.home };
      for (let i = 0; i < 200 && Math.hypot(p.x - goal.x, p.y - goal.y) > 2; i++) {
        p = moveToward(g.terrain, p, goal, 12); assert.equal(canOccupy(g.terrain, p), true);
      }
      assert.ok(Math.hypot(p.x - goal.x, p.y - goal.y) < 2, `${terrain}/${mapSize}/team${goal.team} route stuck`);
    }
  }
});

test('v8 direct player stays idle with or without relic and follows input instead of autonomous retrieval or delivery', () => {
  for (const carrying of [false, true]) {
    const g = make({ mode: 'play', mapSize: 'large', teamSizes: [1, 1] });
    const s = carrying ? pickup(g) : fighter(g);
    relocate(s, { x: 200, y: 450 }); relocate(fighter(g, 'red-0'), { x: 1500, y: 800 });
    const position = { x: s.x, y: s.y }; step(g, 2);
    assert.equal(s.x, position.x); assert.equal(s.y, position.y);
    if (carrying) assert.equal(g.objective.carrierId, s.id);
    setPlayerInput(g, { moveY: -1 }); step(g, .25);
    assert.equal(s.x, position.x); assert.ok(s.y < position.y, 'player input moves north even though relic/extraction lies east or west');
    setPlayerInput(g, { moveY: 0 }); const stopped = { x: s.x, y: s.y }; step(g, .25);
    assert.equal(s.x, stopped.x); assert.equal(s.y, stopped.y);
  }
});

test('v8 changing the directly controlled slot transfers movement authority without moving either fighter immediately', () => {
  const g = make({ mode: 'play', mapSize: 'large', teamSizes: [2, 1] });
  const former = fighter(g), selected = fighter(g, 'blue-1');
  relocate(former, { x: 200, y: 400 }); relocate(selected, { x: 200, y: 500 });
  relocate(fighter(g, 'red-0'), { x: 1500, y: 800 });
  const before = g.soldiers.map(s => [s.id, s.x, s.y]);
  assert.equal(setControlledFighter(g, selected.id), true);
  assert.deepEqual(g.soldiers.map(s => [s.id, s.x, s.y]), before);
  step(g, .5); assert.equal(selected.x, 200); assert.equal(selected.y, 500);
  assert.ok(former.x > 200, 'the former controlled slot now uses its ordinary AI retrieval goal');
});

test('v8 relic assignments are read only and independent of array order', () => {
  const g = make({ teamSizes: [15, 15], mapSize: 'large' }); pickup(g);
  const before = structuredClone(g), assignments = Object.fromEntries(g.soldiers.map(s => [s.id, relicAssignment(g, s)]));
  assert.deepEqual(g, before); const reverse = structuredClone(g); reverse.soldiers.reverse();
  for (const s of reverse.soldiers) assert.deepEqual(relicAssignment(reverse, s), assignments[s.id]);
  assert.equal(assignments['blue-0'].role, 'deliver'); assert.equal(assignments['red-0'].role, 'intercept');
  assert.equal(assignments['blue-1'].role, 'escort');
});

test('v8 current saves preserve available, carried, dropped and resetting objective checkpoints deterministically', () => {
  for (const state of ['available', 'carried', 'dropped', 'resetting']) {
    const g = make({ mode: 'play' });
    if (state !== 'available') {
      const s = pickup(g);
      if (state === 'dropped') resolveDamage(g, [{ target: s.id, amount: s.hp }]);
      if (state === 'resetting') { relocate(s, g.objective.extractionZones[0]); advanceRelic(g); }
    }
    const resumed = roundTrip(g); assert.deepEqual(authoritativeState(resumed), authoritativeState(g), state);
    step(g, .5); step(resumed, .5); assert.deepEqual(resumed, g, state);
    roundTrip(g);
  }
});

test('v8 malformed current objective/config saves reject without any slot rewrite or fallback', () => {
  const cases = [
    ['missing modifier', e => { delete e.game.config.modifier; }],
    ['unknown modifier', e => { e.game.config.modifier = 'unlimited_force'; }],
    ['wrong target', e => { e.game.objective.targetScore = 30; }],
    ['fractional delivery', e => { e.game.objective.points[0] = .5; }],
    ['excess deliveries', e => { e.game.objective.points[0] = 4; }],
    ['unknown carrier', e => { e.game.objective.carrierId = 'blue-99'; e.game.objective.state = 'carried'; e.game.objective.owner = 0; }],
    ['owner without carrier', e => { e.game.objective.owner = 0; }],
    ['carried without carrier', e => { e.game.objective.state = 'carried'; }],
    ['forged home', e => { e.game.objective.home.x++; }],
    ['forged extraction', e => { e.game.objective.extractionZones[0].x++; }],
    ['forged pickup radius', e => { e.game.objective.radius++; }],
    ['drop outside playable boundary', e => { e.game.objective.x = 0; e.game.objective.y = 0; }],
    ['drop inside a wall', e => { const wall = e.game.terrain.solids.find(s => s.kind === 'wall'); e.game.objective.x = wall.x + wall.width / 2; e.game.objective.y = wall.y + wall.height / 2; }],
    ['impossible active carrier dash', e => { const s = e.game.soldiers[0]; Object.assign(e.game.objective, { state: 'carried', carrierId: s.id, owner: s.team, x: s.x, y: s.y }); s.dashUntil = e.game.tick + 18; }],
    ['negative reset', e => { e.game.objective.unlockTick = -1; }],
    ['fractional reset', e => { e.game.objective.unlockTick = .1; }],
    ['future reset', e => { e.game.objective.unlockTick = e.game.tick + 121; }],
    ['impossible state', e => { e.game.objective.state = 'scored'; }],
    ['classic capture', e => { e.game.objective.capture = 1; }],
    ['wrong kind', e => { e.game.objective.kind = 'control'; }],
    ['missing kind', e => { delete e.game.objective.kind; }],
    ['unexpected relic on control', e => { e.game.config.matchMode = 'control'; e.game.config.targetScore = 30; }],
  ];
  const original = make(), baseStore = memory(); assert.equal(saveCampaign(original, baseStore).ok, true);
  const baseline = JSON.parse(baseStore.getItem(SAVE_KEY));
  for (const [label, mutate] of cases) {
    const envelope = structuredClone(baseline), mem = memory(); mutate(envelope);
    const encoded = JSON.stringify(envelope); mem.setItem(SAVE_KEY, encoded);
    mem.setItem(LEGACY_SAVE_KEY, JSON.stringify(read('./fixtures/v03-save.json')));
    const loaded = loadCampaign(mem); assert.equal(loaded.game, null, label); assert.ok(loaded.error, label);
    assert.equal(mem.getItem(SAVE_KEY), encoded, label);
  }
});

for (const state of ['active', 'ended']) test(`v8 authentic v7 ${state} fixture gains only its default modifier and additive v9 metadata`, () => {
  const fixture = read('../docs/evidence/v0.8-core-v7-fixtures.json');
  assert.equal(fixture.sourceCommit, '11876a8544cf296a998b2124d74dc300f1850b09');
  const old = fixture[state], mem = memory(), encoded = JSON.stringify(old); assert.equal(old.rulesVersion, 7);
  mem.setItem(SAVE_KEY, encoded); const loaded = loadCampaign(mem);
  assert.equal(loaded.error, null); assert.equal(loaded.upgraded, true); assert.equal(loaded.migrated, false);
  const expected = structuredClone(old.game); expected.config.modifier = 'standard'; addV9Defaults(expected);
  assert.deepEqual(stripPostV9(authoritativeState(loaded.game)), expected); assert.equal(mem.getItem(SAVE_KEY), encoded);
  assert.equal(loaded.game.config.startingRanks[0], 'SSS+V');
  assert.deepEqual(loaded.game.mastery, old.game.mastery); assert.deepEqual(loaded.game.records, old.game.records);
  if (state === 'active') assert.ok(loaded.game.soldiers.some(s => s.attack !== null));
  const twin = roundTrip(loaded.game); step(twin, 150); step(loaded.game, 150); assert.deepEqual(twin, loaded.game);
  roundTrip(twin);
});

test('v8 authentic v3-v6 saves migrate into standard rules without touching the original slot', () => {
  const cases = [['03', null], ...['04', '05', '06'].flatMap(version => ['active', 'ended'].map(state => [version, state]))];
  for (const [version, state] of cases) {
    const old = read(`./fixtures/v${version}${state ? `-${state}` : ''}-save.json`), mem = memory();
    const key = version === '03' ? LEGACY_SAVE_KEY : SAVE_KEY, encoded = JSON.stringify(old); mem.setItem(key, encoded);
    const loaded = loadCampaign(mem); assert.equal(loaded.error, null, `${version}/${state}`);
    assert.equal(loaded.game.config.modifier, 'standard'); assert.equal(loaded.game.config.matchMode, 'control');
    assert.deepEqual(loaded.game.score, old.game.score); assert.deepEqual(loaded.game.careers, old.game.careers);
    assert.deepEqual(loaded.game.history, old.game.history); assert.equal(mem.getItem(key), encoded);
    if (version !== '03') assert.equal(loaded.game.tick, old.game.tick);
    roundTrip(loaded.game);
  }
});

test('v8 serialized rank identifiers and thresholds remain the exact F through SSS+V ladder', () => {
  assert.deepEqual(SOLDIER_GRADES.map(g => [g.label, g.threshold]), [
    ['F', 0], ['E', 35], ['D', 90], ['C', 180], ['B', 320], ['A', 520], ['S', 800], ['SS', 1150], ['SSS', 1650],
    ['SSS+', 2400], ['SSS+I', 3000], ['SSS+II', 3600], ['SSS+III', 4400], ['SSS+IV', 5200], ['SSS+V', 6000],
  ]);
});

test('v8 natural multi-round settlement is idempotent and fresh rounds reset only the round objective', () => {
  const g = make({ teamSizes: [1, 1], modifier: 'saber_only', mode: 'spectate' });
  for (let round = 1; round <= 4; round++) {
    step(g, 45); assert.equal(g.status, 'ended'); assert.equal(g.history.length, round);
    assert.equal(g.score[0] + g.score[1] + g.draws, round);
    const ended = structuredClone(g); for (let i = 0; i < 3; i++) step(g, 150);
    assert.deepEqual(g, ended); assert.deepEqual(roundTrip(g), g);
    const mastery = structuredClone(g.mastery), records = structuredClone(g.records), careers = structuredClone(g.careers);
    nextRound(g); assert.equal(g.round, round + 1); assert.equal(g.status, 'playing');
    assert.equal(g.objective.state, 'available'); assert.equal(g.objective.carrierId, null); assert.deepEqual(g.objective.points, [0, 0]);
    assert.deepEqual(g.mastery, mastery); assert.deepEqual(g.records, records); assert.deepEqual(g.careers, careers);
    const fresh = structuredClone(g); nextRound(g); assert.deepEqual(g, fresh); roundTrip(g);
  }
});

test('v8 fixed tick stepping and save continuation are deterministic with 15 fighters per side', () => {
  const options = { mapSize: 'large', terrain: 'craterfield', teamSizes: [15, 15], environment: 'sandstorm', modifier: 'saber_only' };
  const whole = make(options), fragmented = make(options); step(whole, 2);
  for (let i = 0; i < 240; i++) step(fragmented, 1 / 120);
  assert.deepEqual(fragmented, whole); const resumed = roundTrip(whole);
  step(whole, 2); step(resumed, 2); assert.deepEqual(resumed, whole);
  assert.deepEqual(whole.stats.forceCasts, [0, 0]); assert.ok(whole.soldiers.every(s => canOccupy(whole.terrain, s)));
});

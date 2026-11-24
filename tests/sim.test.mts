import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command, nextRound, setAutoCommand, COVER_NODES, ROUND_DURATION } from '../dist/sim.js';

function replay(seed, order = 'advance') {
  const g = createGame(seed); command(g, order);
  for (let i = 0; i < ROUND_DURATION * 60 && g.status === 'playing'; i++) {
    if (i % 480 === 0) { command(g, 'wave'); command(g, 'barrier'); }
    step(g, 1 / 60);
  }
  return g;
}

test('clean initial state has exactly two living squads of five', () => {
  const g = createGame(52);
  assert.equal(g.soldiers.length, 10);
  assert.deepEqual([0, 1].map(team => g.soldiers.filter(s => s.team === team).length), [5, 5]);
  assert.equal(COVER_NODES.length, 30);
  assert.ok(g.soldiers.every(s => s.alive && s.hp === 120));
});

test('seeded saber replay and clean reset are identical', () => {
  assert.deepEqual(replay(123), replay(123)); assert.notDeepEqual(replay(123), replay(124));
  assert.deepEqual(createGame('trench'), createGame('trench'));
});

test('frame grouping does not change fixed-tick results', () => {
  const a = createGame(67, { autoCommand: true }), b = createGame(67, { autoCommand: true });
  for (let i = 0; i < 1800; i++) step(a, 1 / 60);
  for (let i = 0; i < 300; i++) step(b, .1);
  assert.equal(a.tick, b.tick); assert.deepEqual(a.soldiers, b.soldiers);
  assert.deepEqual(a.stats, b.stats); assert.equal(a.rngState, b.rngState);
});

test('invalid commands, invalid time and premature nextRound leave state intact', () => {
  const g = createGame(42), initial = structuredClone(g);
  for (const value of ['teleport', null, {}, '__proto__']) assert.equal(command(g, value), false);
  for (const dt of [NaN, Infinity, -1, 0, undefined]) step(g, dt);
  nextRound(g); assert.deepEqual(g, initial);
});

test('manual orders complete within the round bound with finite combat state', () => {
  for (const order of ['advance', 'hold', 'retreat']) for (let seed = 1; seed <= 12; seed++) {
    const g = replay(seed, order); assert.equal(g.status, 'ended', `${seed}/${order}`); assert.ok(g.time <= ROUND_DURATION);
    for (const s of g.soldiers) {
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.hp));
      assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.x >= 0 && s.x <= 960 && s.y >= 0 && s.y <= 540);
      assert.equal(s.alive, s.hp > 0);
    }
    const frozen = structuredClone(g); step(g, 1000); command(g, 'wave'); assert.deepEqual(g, frozen);
  }
});

test('round transitions preserve score and restore all ten soldiers with bounded mutations', () => {
  const g = createGame(134, { autoCommand: true }); const seen = new Set();
  for (let round = 0; round < 20; round++) {
    step(g, ROUND_DURATION); assert.equal(g.status, 'ended'); const score = [...g.score];
    nextRound(g); assert.deepEqual(g.score, score); assert.equal(g.round, round + 2);
    assert.equal(g.time, 0); assert.equal(g.status, 'playing'); assert.equal(g.effects.length, 0);
    assert.ok(g.mutations.length <= 20); assert.ok(g.soldiers.every(s => s.alive && s.hp === s.maxHp));
    g.mutations.forEach(m => seen.add(m.kind));
  }
  assert.deepEqual([...seen].sort(), ['downgrade', 'mixed', 'upgrade']);
});

test('autocommand is opt-in and manual movement overrides it; Force support preserves it', () => {
  const g = createGame(7); assert.equal(g.autoCommand, false); assert.equal(setAutoCommand(g, true), true);
  command(g, 'wave'); command(g, 'barrier'); assert.equal(g.autoCommand, true);
  command(g, 'advance'); assert.equal(g.autoCommand, false); assert.equal(g.playerOrder, 'advance');
});

test('morale rally recovers without silently healing combat health', () => {
  const g = createGame(2); g._nextAiDecision = 1e9;
  for (const s of g.soldiers) { s.saberReadyTick = 1e9; s.forceReadyTick = 1e9; }
  const s = g.soldiers[0]; s.morale = 20; s.hp = 75;
  step(g, 1 / 60); assert.equal(s.rallying, true);
  step(g, 8); assert.equal(s.rallying, false); assert.ok(s.morale >= 59); assert.equal(s.hp, 75);
});

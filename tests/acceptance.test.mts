import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command, nextRound, ROUND_DURATION } from '../dist/sim.js';

function ceaseFire(g) {
  g.playerOrder = g.enemyOrder = 'hold';
  g._nextAiDecision = 1e9;
  for (const s of g.soldiers) { s.saberReadyTick = 1e9; s.forceReadyTick = 1e9; }
}

test('a genuinely tied timeout is a draw, with one history entry and no false winner', () => {
  const g = createGame(24); ceaseFire(g); step(g, ROUND_DURATION);
  assert.equal(g.status, 'ended'); assert.equal(g.time, ROUND_DURATION);
  assert.equal(g.winner, null); assert.deepEqual(g.score, [0, 0]); assert.equal(g.draws, 1);
  assert.equal(g.history.length, 1); assert.deepEqual(g.history[0].survivors, [5, 5]);
  const frozen = structuredClone(g); step(g, 999); assert.deepEqual(g, frozen);
});

test('timeout ranks control first, then survivors, then health', () => {
  const control = createGame(24); ceaseFire(control); control.objective.points = [0, 1];
  control.soldiers.filter(s => s.team === 1).forEach(s => { s.hp = 1; });
  step(control, ROUND_DURATION); assert.equal(control.winner, 1);
  const survivors = createGame(24); ceaseFire(survivors);
  survivors.soldiers.filter(s => s.team === 0).forEach(s => { s.hp = 1; });
  Object.assign(survivors.soldiers[5], { alive: false, hp: 0 });
  step(survivors, ROUND_DURATION); assert.equal(survivors.winner, 0);
  const health = createGame(24); ceaseFire(health); health.soldiers[0].hp = 79;
  step(health, ROUND_DURATION); assert.equal(health.winner, 1);
});

test('sub-tick frame partitions preserve saber combat, Force and seeded state', () => {
  const whole = createGame(628, { autoCommand: true }), split = createGame(628, { autoCommand: true });
  for (let i = 0; i < 1800; i++) {
    if (i % 240 === 0) for (const g of [whole, split]) { command(g, 'wave'); command(g, 'barrier'); }
    step(whole, 1 / 60); step(split, 1 / 120); step(split, 1 / 120);
  }
  assert.deepEqual(whole, split);
});

test('round transition clears transient combat while preserving score, history and cumulative records', () => {
  const g = createGame(551, { autoCommand: true }); command(g, 'wave'); command(g, 'barrier'); step(g, ROUND_DURATION);
  assert.equal(g.status, 'ended');
  const score = [...g.score], history = structuredClone(g.history), records = structuredClone(g.records);
  nextRound(g);
  assert.equal(g.time, 0); assert.equal(g.timeLeft, ROUND_DURATION); assert.equal(g._accumulator, 0);
  assert.deepEqual(g.effects, []); assert.deepEqual(g.objective.points, [0, 0]);
  assert.equal(g.objective.capture, 0); assert.equal(g.objective.owner, null);
  assert.deepEqual(g.score, score); assert.deepEqual(g.history, history); assert.deepEqual(g.records, records);
  for (const values of Object.values(g.stats)) assert.deepEqual(values, [0, 0]);
  for (const s of g.soldiers) {
    assert.equal(s.hp, s.maxHp); assert.equal(s.alive, true); assert.equal(s.kills, 0);
    assert.equal(s.target, null); assert.equal(s.suppression, 0); assert.equal(s.pinned, false); assert.equal(s.rallying, false);
  }
  assert.deepEqual(createGame(551), createGame(551));
  assert.deepEqual(createGame(551).history, []); assert.deepEqual(createGame(551).score, [0, 0]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyFormsForRound } from '../dist/opponents.js';
import { FORMS } from '../dist/content.js';

const ids = Object.keys(FORMS);
const sorted = values => [...values].sort();

test('every 15-fighter mixed opponent roster includes all nine configurations and Forms I–VII', () => {
  for (const seed of [0, 1, 42, 731, 0xffffffff, 'field-campaign']) {
    for (const round of [1, 2, 9, 10, 999999999]) {
      const roster = enemyFormsForRound(seed, round, 15);
      assert.equal(roster.length, 15);
      assert.deepEqual(sorted(new Set(roster)), sorted(ids));
      assert.deepEqual(sorted(new Set(roster.map(id => FORMS[id].primaryForm))), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
      const counts = ids.map(id => roster.filter(value => value === id).length);
      assert.equal(Math.max(...counts) - Math.min(...counts), 1);
      assert.notDeepEqual(roster, enemyFormsForRound(seed, round + 1, 15));
    }
  }
});

test('small teams are varied from round one and cover every configuration over two rounds', () => {
  for (const seed of [1, 42, 731, 'test']) {
    const first = enemyFormsForRound(seed, 1, 5);
    assert.equal(new Set(first).size, 5);
    assert.deepEqual(sorted(new Set([...first, ...enemyFormsForRound(seed, 2, 5)])), sorted(ids));
  }
});

test('each opponent slot rotates through all nine forms over the nine-round cycle', () => {
  for (const seed of [7, 71, 'rotating']) {
    const rounds = Array.from({ length: 9 }, (_, index) => enemyFormsForRound(seed, index + 1, 15));
    for (let lane = 0; lane < 15; lane++) assert.deepEqual(sorted(rounds.map(roster => roster[lane])), sorted(ids));
    assert.deepEqual(enemyFormsForRound(seed, 10, 15), rounds[0]);
  }
});

test('all nine explicit fixed-form scenarios remain uniform across rounds and team sizes', () => {
  for (const id of ids) for (const size of [5, 10, 15]) for (const round of [1, 2, 1000]) {
    assert.deepEqual(enemyFormsForRound(42, round, size, id), Array(size).fill(id));
  }
});

test('rosters are deterministic, detached and do not consume global randomness', () => {
  const previous = Math.random;
  Math.random = () => { throw new Error('Opponent generation must not consume global randomness'); };
  try {
    const a = enemyFormsForRound('repeatable', 6, 15);
    const b = enemyFormsForRound('repeatable', 6, 15);
    assert.deepEqual(a, b); assert.notEqual(a, b);
    a[0] = 'invalid';
    assert.deepEqual(enemyFormsForRound('repeatable', 6, 15), b);
    const fixed = enemyFormsForRound(42, 1, 15, 'makashi');
    fixed[0] = 'invalid';
    assert.equal(enemyFormsForRound(42, 1, 15, 'makashi')[0], 'makashi');
    assert.ok(new Set([1, 2, 3, 4, 5].map(seed => enemyFormsForRound(seed, 1, 15).join(','))).size > 1);
  } finally { Math.random = previous; }
});

test('invalid rounds, counts and fixed forms fail explicitly instead of silently making a baseline squad', () => {
  for (const round of [0, -1, 1.5, NaN, Infinity, '2']) assert.throws(() => enemyFormsForRound(1, round, 15), RangeError);
  for (const size of [0, -1, 1.5, NaN, Infinity, '15']) assert.throws(() => enemyFormsForRound(1, 1, size), RangeError);
  for (const form of ['unknown', '__proto__', 'constructor', '', 7, {}]) assert.throws(() => enemyFormsForRound(1, 1, 15, form), RangeError);
});

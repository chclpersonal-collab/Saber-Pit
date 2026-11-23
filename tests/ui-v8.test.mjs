import test from 'node:test';
import assert from 'node:assert/strict';
import { objectiveFeedback, nextInspectionId } from '../dist/ui-state.js';

const soldiers = [
  { id: 'your-0', team: 0, lane: 0, alive: true },
  { id: 'your-1', team: 0, lane: 1, alive: false },
  { id: 'enemy-0', team: 1, lane: 0, alive: true },
];
const relicGame = (objective = {}, extra = {}) => ({ round: 1, tick: 120, config: { matchMode: 'relic', mode: 'spectate' }, soldiers,
  objective: { kind: 'relic', state: 'available', carrierId: null, x: 480, y: 270, home: { x: 480, y: 270 }, points: [0, 0], targetScore: 3, unlockTick: 0, ...objective }, ...extra });

test('Relic feedback distinguishes center, drop, contest and reset', () => {
  assert.equal(objectiveFeedback(relicGame()).status, 'Relic ready at center');
  assert.equal(objectiveFeedback(relicGame({ x: 510 })).status, 'Relic dropped on the field');
  assert.equal(objectiveFeedback(relicGame({ contested: true })).status, 'Relic contested');
  const resetting = objectiveFeedback(relicGame({ state: 'resetting', unlockTick: 210, points: [1, 0] }));
  assert.equal(resetting.status, 'Relic returns to center');
  assert.match(resetting.detail, /1\.5s/);
  assert.equal(resetting.score, '1 : 0');
  const scored = objectiveFeedback(relicGame({ state: 'resetting', unlockTick: 240, points: [1, 0] }, { events: [{ type: 'relic-delivery', team: 0 }] }));
  assert.equal(scored.status, 'Your team delivered the relic');
});

test('Relic carrier feedback gives local controls and symmetric enemy warning', () => {
  const manual = relicGame({ carrierId: 'your-0', state: 'carried' }, { config: { matchMode: 'relic', mode: 'play' }, control: { soldierId: 'your-0' } });
  const own = objectiveFeedback(manual);
  assert.equal(own.status, 'You have the relic. Return home.');
  assert.match(own.detail, /28% slower and cannot dash/);
  const enemy = objectiveFeedback(relicGame({ carrierId: 'enemy-0', state: 'carried' }));
  assert.equal(enemy.status, 'Enemy fighter 01 has the relic');
  assert.match(enemy.detail, /Intercept/);
});

test('Relic status changes on delivery or carrier but reset countdown does not repeat notifications', () => {
  const first = relicGame({ state: 'resetting', unlockTick: 240 });
  assert.equal(objectiveFeedback(first).signature, objectiveFeedback({ ...first, tick: 180 }).signature);
  assert.notEqual(objectiveFeedback(first).signature, objectiveFeedback(relicGame({ points: [1, 0] })).signature);
  assert.notEqual(objectiveFeedback(first).signature, objectiveFeedback(relicGame({ carrierId: 'your-0', state: 'carried' })).signature);
});

test('Non-Relic modes keep their own readable objective rules', () => {
  assert.match(objectiveFeedback({ ...relicGame(), config: { matchMode: 'elimination' } }).detail, /survivors, then remaining health/);
  assert.equal(objectiveFeedback({ ...relicGame({ owner: 1, targetScore: 30 }), config: { matchMode: 'control' } }).status, 'Enemy team holds the signal');
});

test('Inspection skips casualties, wraps both directions and filters teams', () => {
  assert.equal(nextInspectionId(soldiers, null), 'your-0');
  assert.equal(nextInspectionId(soldiers, 'your-0'), 'enemy-0');
  assert.equal(nextInspectionId(soldiers, 'enemy-0'), 'your-0');
  assert.equal(nextInspectionId(soldiers, null, -1), 'enemy-0');
  assert.equal(nextInspectionId(soldiers, 'your-0', 1, '0'), 'your-0');
  assert.equal(nextInspectionId(soldiers, 'your-0', 1, '1'), 'enemy-0');
});

test('Final-position inspection includes dead fighters without changing simulation state', () => {
  const before = structuredClone(soldiers);
  assert.equal(nextInspectionId(soldiers, 'your-0', 1, 'all', true), 'your-1');
  assert.equal(nextInspectionId([], null), null);
  assert.deepEqual(soldiers, before);
  const game = relicGame({ carrierId: 'your-0', state: 'carried' });
  const snapshot = structuredClone(game);
  objectiveFeedback(game);
  assert.deepEqual(game, snapshot);
});

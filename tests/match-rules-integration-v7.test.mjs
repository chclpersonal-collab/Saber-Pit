import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, nextRound } from '../dist/sim.js';
import { saveCampaign, loadCampaign } from '../dist/persistence.js';

function memoryStorage() {
  const slots = new Map();
  return { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) };
}
// A quiet, valid timeout fixture. Pending clocks stay inside the persistence
// bounds; unlike a 1e9 cease-fire sentinel, this can itself be saved near expiry.
function quietRound(game) {
  game._nextAiDecision = game.roundDuration * 60 + 1;
  for (const soldier of game.soldiers) {
    soldier.saberReadyTick = game.roundDuration * 60 + 1;
    soldier.forceReadyTick = game.roundDuration * 60 + 1;
  }
  return game;
}

for (const matchMode of ['control', 'elimination']) for (const roundDuration of [45, 90, 150]) {
  test(`${matchMode} ${roundDuration}s saves the final active tick, exact timeout and next round`, () => {
    const game = quietRound(createGame(24, { matchMode, roundDuration })), storage = memoryStorage();
    step(game, roundDuration - 1 / 60);
    assert.equal(game.status, 'playing');
    assert.equal(game.tick, roundDuration * 60 - 1);
    assert.equal(saveCampaign(game, storage).ok, true, 'final active tick is valid, including tick 8999');
    const resumed = loadCampaign(storage);
    assert.equal(resumed.error, null);
    assert.deepEqual(resumed.game, game);
    step(game, 1 / 60); step(resumed.game, 1 / 60);
    assert.deepEqual(resumed.game, game, 'resume settles deterministically');
    assert.equal(game.status, 'ended'); assert.equal(game.time, roundDuration); assert.equal(game.timeLeft, 0);
    assert.equal(game.winner, null); assert.equal(game.draws, 1); assert.deepEqual(game.score, [0, 0]);
    assert.equal(game.history.length, 1); assert.equal(game.history[0].time, roundDuration);
    assert.equal(saveCampaign(game, storage).ok, true, 'ended round and mastery are serializable');
    assert.deepEqual(loadCampaign(storage).game, game);
    const history = structuredClone(game.history), mastery = structuredClone(game.mastery);
    nextRound(game);
    assert.equal(game.round, 2); assert.equal(game.roundDuration, roundDuration); assert.equal(game.timeLeft, roundDuration);
    assert.equal(game.config.matchMode, matchMode); assert.equal(game.draws, 1);
    assert.deepEqual(game.history, history); assert.deepEqual(game.mastery, mastery);
    assert.deepEqual(game.objective.points, [0, 0]);
    assert.equal(saveCampaign(game, storage).ok, true, 'prior duration history remains valid next round');
    assert.deepEqual(loadCampaign(storage).game, game);
  });
}

test('holding the center wins Control but yields no capture, points, time or objective award in Elimination', () => {
  const games = ['control', 'elimination'].map(matchMode => quietRound(createGame(24, { matchMode, roundDuration: 45, mode: 'play' })));
  for (const game of games) {
    // Keep the controlled fighter on the center without artificial objective
    // scores. The other fighters hold their original spawn positions.
    game.soldiers[0].x = game.objective.x; game.soldiers[0].y = game.objective.y;
    step(game, 40);
    assert.equal(saveCampaign(game, memoryStorage()).ok, true);
  }
  const [control, elimination] = games;
  assert.equal(control.status, 'ended'); assert.equal(control.winner, 0);
  assert.equal(control.reason, 'Signal post secured');
  assert.ok(control.time < 40 && control.objective.points[0] > 29.999);
  assert.ok(control.events.some(event => event.type === 'capture'));
  assert.equal(elimination.status, 'playing'); assert.equal(elimination.time, 40);
  assert.equal(elimination.objective.capture, 0); assert.equal(elimination.objective.owner, null);
  assert.deepEqual(elimination.objective.points, [0, 0]); assert.deepEqual(elimination.stats.objectiveTime, [0, 0]);
  assert.ok(elimination.soldiers.every(soldier => soldier.objectiveSeconds === 0));
  assert.equal(elimination.events.some(event => event.type === 'capture'), false);
  step(elimination, 5);
  assert.equal(elimination.status, 'ended'); assert.equal(elimination.time, 45);
  assert.equal(elimination.winner, null);
  assert.equal(elimination.roundReport.commendations.some(award => award.id === 'objective'), false);
  assert.equal(saveCampaign(elimination, memoryStorage()).ok, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, command, duelIntent, step } from '../dist/sim.js';

function scenario(environment = 'clear') {
  const game = createGame(42, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', environment, enemyForm: 'shii_cho' });
  game._nextAiDecision = 1e8;
  game.terrain.solids = []; game.terrain.zones = [];
  const [a, b] = game.soldiers;
  a.x = 450; b.x = 490; a.y = b.y = 270;
  for (const soldier of [a, b]) { soldier.saberReadyTick = 0; soldier.forceReadyTick = 1e8; soldier.bank = soldier.holdBank = 2; }
  command(game, 'advance');
  return { game, a, b };
}

test('actual enemy perception and duel intent avoid saber attempts through low barricades', () => {
  const { game, a } = scenario();
  game.terrain.solids = [{ id: 'test-cover', kind: 'barricade', x: 466, y: 250, width: 8, height: 40 }];
  const intent = duelIntent(game, a);
  assert.equal(intent.action, 'wait'); assert.equal(intent.move, 'close');
  assert.equal(intent.reason, 'Find clear attack angle');
  step(game, 1 / 60);
  assert.equal(game.stats.saberSwings[0], 0);
  assert.equal(game.stats.saberSwings[1], 0);
  assert.equal(a.target, 'red-0', 'low cover leaves the opponent visible');
  assert.ok(a.moving, 'the fighter begins routing around the barricade');
  step(game, 5);
  assert.ok(game.stats.saberSwings.some(count => count > 0), 'routing eventually opens a legal saber attack instead of sticking at a blocked stand-off point');
  assert.ok(game.stats.damage.some(amount => amount > 0), 'fighters make real contact after navigating the cover');
});

test('walls hide targets while allowing movement toward known strategic destinations', () => {
  const { game, a } = scenario();
  game.terrain.solids = [{ id: 'test-wall', kind: 'wall', x: 466, y: 200, width: 8, height: 140 }];
  a.forceReadyTick = 0;
  assert.equal(duelIntent(game, a).reason, 'No visible target');
  const before = { x: a.x, y: a.y };
  step(game, 1 / 60);
  assert.equal(a.target, null); assert.equal(a.attack, null);
  assert.ok(Math.hypot(a.x - before.x, a.y - before.y) > 0);
});

test('fog prevents a nominally in-range Force cast without freezing strategic advance', () => {
  const { game, a, b } = scenario('fog');
  a.x = 250; b.x = 650; a.forceReadyTick = b.forceReadyTick = 0;
  assert.equal(duelIntent(game, a).reason, 'No visible target');
  const before = { x: a.x, y: a.y };
  step(game, 1 / 60);
  assert.equal(a.target, null); assert.equal(a.attack, null);
  assert.deepEqual(game.stats.forceCasts, [0, 0]);
  assert.ok(Math.hypot(a.x - before.x, a.y - before.y) > 0);
});

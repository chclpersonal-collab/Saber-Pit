import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, createTerrain, getTerrain, WEAPONS, KNIVES, startingLoadout, evolveLoadout } from '../dist/content.js';
import { createGame, setAutoCommand } from '../dist/sim.js';

const sequence = values => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };

test('Force discipline sidegrades preserve quality and leave input loadouts untouched', () => {
  for (const power of Object.values(WEAPONS)) {
    const input = { weapon: power.id, meleeWeapon: 'saber' }, before = structuredClone(input);
    const next = evolveLoadout(input, { rng: sequence([0, 0, 0, .99]), probability: .5 });
    assert.deepEqual(input, before); assert.notEqual(WEAPONS[next.weapon].family, power.family);
    assert.equal(WEAPONS[next.weapon].quality, power.quality); assert.equal(next.meleeWeapon, 'saber');
    assert.equal(next.changes.length, 1); assert.equal(next.changes[0].kind, 'mixed');
    assert.match(next.changes[0].label, /tradeoffs/);
  }
});

test('quality boundaries do not reverse impossible rolls or exceed the saber/Force catalogs', () => {
  for (const quality of [0, 2]) {
    const power = Object.values(WEAPONS).find(w => w.family === 'force_push' && w.quality === quality);
    const saber = Object.values(KNIVES).find(w => w.quality === quality);
    const direction = quality === 0 ? 0 : .99;
    const input = { weapon: power.id, meleeWeapon: saber.id };
    assert.deepEqual(evolveLoadout(input, { rng: sequence([0, .99, direction, 0, direction]), probability: 1 }), { ...input, changes: [] });
  }
  assert.deepEqual(evolveLoadout(startingLoadout(), { rng: () => 0, probability: 0 }), { ...startingLoadout(), changes: [] });
});

test('terrain/telemetry QA: three seeded maps are deterministic, mirrored, valid and detached', () => {
  assert.deepEqual(MAPS.map(m => m.id), ['crossroads', 'zigzag', 'craterfield']);
  for (let seed = 0; seed < 12; seed++) {
    const map = createTerrain(seed);
    assert.equal(map.id, MAPS[seed % 3].id);
    assert.deepEqual(map, createTerrain(seed));
    assert.equal(map.coverNodes.length, 30);
    assert.equal(new Set(map.coverNodes.map(n => n.id)).size, 30);
    for (const node of map.coverNodes) {
      assert(node.x >= 0 && node.x <= map.width && node.y >= 0 && node.y <= map.height);
      const mirror = map.coverNodes.find(n => n.team !== node.team && n.bank === node.bank && n.lane === node.lane);
      assert.equal(mirror.x, map.width - node.x);
      assert.equal(mirror.y, node.y);
    }
    assert.equal(map.controlPoints.length, 1);
    const point = map.controlPoints[0];
    assert.equal(point.x, map.width / 2);
    assert.equal(point.y, map.height / 2);
    assert(point.radius > 0);
    const unchanged = createTerrain(seed);
    map.coverNodes[0].x = -1;
    map.controlPoints[0].radius = -1;
    assert.deepEqual(createTerrain(seed), unchanged, 'terrain mutation leaked between matches');
  }
  assert.equal(createTerrain(3, 'craterfield').id, 'craterfield');
  assert.equal(getTerrain('invalid').id, 'crossroads');
  assert.deepEqual(createTerrain('named-seed'), createTerrain('named-seed'));
});

test('terrain/telemetry QA: command telemetry remains bounded under repeated mode changes', () => {
  const game = createGame(14);
  for (let i = 0; i < 200; i++) setAutoCommand(game, i % 2 === 0);
  assert(game.events.length <= 32);
  assert.equal(new Set(game.events.map(event => event.id)).size, game.events.length);
  assert(game.events.every(event => Number.isFinite(event.time) && typeof event.text === 'string'));
});

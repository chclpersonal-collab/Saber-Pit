import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, createTerrain } from '../dist/content.js';
import { MAP_SIZES, createBattlefield } from '../dist/maps.js';
import { ENVIRONMENTS, environmentAt, withinVisibility, canPerceive } from '../dist/environment.js';
import { UNIT_RADIUS, canOccupy, findPath, moveSwept, moveToward, terrainAt } from '../dist/terrain.js';
const almost = (a, b) => Math.abs(a - b) < .00001;

for (const size of Object.values(MAP_SIZES)) for (const template of MAPS) {
  test(`${size.id}/${template.id}: thirty valid spawns, full cover destinations and safe connected approaches`, () => {
    const map = createBattlefield(41, { mapSize: size.id, terrain: template.id, teamSizes: [15, 15] });
    assert.equal(map.width, size.width); assert.equal(map.height, size.height);
    assert.equal(map.coverNodes.length, 90); assert.equal(map.cosmeticTerrainOnly, false);
    assert.ok(map.solids.some(s => s.kind === 'wall'));
    assert.ok(map.solids.some(s => s.kind === 'barricade'));
    assert.ok(map.zones.some(s => s.moveCost > 1));
    for (const n of map.coverNodes) {
      assert.ok(canOccupy(map, n), n.id);
      assert.ok(findPath(map, n, map.objective).length, `unreachable bank: ${n.id}`);
    }
    const spawns = map.coverNodes.filter(n => n.bank === 0);
    assert.equal(new Set(spawns.map(n => n.id)).size, 30);
    for (let i = 0; i < spawns.length; i++) {
      const n = spawns[i];
      assert.equal(terrainAt(map, n).damagePerSecond, 0);
      for (const other of spawns.slice(i + 1)) assert.ok(Math.hypot(n.x - other.x, n.y - other.y) >= UNIT_RADIUS * 2 + 8 - .001);
      const path = findPath(map, n, map.objective);
      assert.ok(path.length, n.id);
      let last = n;
      for (const p of path) {
        const swept = moveSwept(map, last, p);
        assert.ok(almost(swept.x, p.x) && almost(swept.y, p.y), `unsafe edge from ${n.id}`);
        last = p;
      }
    }
    // Three distinct cross-field gateways remain open between the two central walls.
    for (const y of [.18, .5, .82]) {
      const gateway = { x: map.width / 2, y: map.height * y };
      assert.ok(canOccupy(map, gateway));
      assert.ok(findPath(map, spawns[0], gateway).length);
      assert.ok(findPath(map, gateway, map.objective).length);
    }
  });
}

test('all requested 1..15 team sizes retain slot identity without changing map dimensions or inventing fighters', () => {
  for (let blue = 1; blue <= 15; blue++) for (let red = 1; red <= 15; red++) {
    const map = createBattlefield(7, { terrain: 'zigzag', mapSize: 'small', teamSizes: [blue, red] });
    assert.equal(map.coverNodes.length, (blue + red) * 3);
    for (const [team, count] of [blue, red].entries()) for (let bank = 0; bank < 3; bank++) {
      assert.deepEqual(map.coverNodes.filter(n => n.team === team && n.bank === bank).map(n => n.lane), Array.from({ length: count }, (_, i) => i));
    }
    assert.equal(map.width, 960); assert.equal(map.height, 540);
  }
});

test('equal teams have mirrored slots, solids and zones', () => {
  for (const size of Object.keys(MAP_SIZES)) for (const template of MAPS) {
    const map = createBattlefield(2, { terrain: template.id, mapSize: size, teamSizes: [15, 15] });
    for (const n of map.coverNodes.filter(n => n.team === 0)) {
      const other = map.coverNodes.find(o => o.team === 1 && o.bank === n.bank && o.lane === n.lane);
      assert.ok(almost(n.x + other.x, map.width)); assert.equal(n.y, other.y);
    }
    for (const rect of [...map.solids, ...map.zones]) {
      const mirrored = [...map.solids, ...map.zones].find(other => other.kind === rect.kind && almost(other.x, map.width - rect.x - rect.width) && other.y === rect.y && other.width === rect.width && other.height === rect.height);
      assert.ok(mirrored, rect.id);
    }
  }
});

test('battlefield generation is detached, deterministic, bounded and preserves legacy geometry byte-for-byte', () => {
  const config = { mapSize: 'large', terrain: 'craterfield', environment: 'rain', teamSizes: [15, 3] };
  const original = createBattlefield('repeatable', config), copy = createBattlefield('repeatable', config);
  assert.deepEqual(original, copy);
  original.coverNodes[0].x = -100; original.solids[0].width = 999; original.zones[0].moveCost = 999; original.palette[0] = 'changed';
  assert.deepEqual(copy, createBattlefield('repeatable', config));
  for (const template of MAPS) assert.deepEqual(createBattlefield(4, { terrain: template.id, mapSize: 'legacy' }), createTerrain(4, template.id));
  for (const bad of ['__proto__', 'constructor', 'bogus', null, undefined]) {
    const map = createBattlefield(4, { mapSize: bad, environment: bad, teamSizes: [Infinity, -1] });
    assert.equal(map.mapSize, 'medium'); assert.equal(map.environment, 'clear'); assert.deepEqual(map.teamSizes, [15, 15]);
    assert.ok(Number.isFinite(map.width));
  }
});

test('fog limits real perception while walls block perception in every environment', () => {
  const open = { width: 960, height: 540, solids: [] }, a = { x: 100, y: 270 }, b = { x: 400, y: 270 };
  assert.equal(canPerceive(open, environmentAt('clear'), a, b), true);
  assert.equal(canPerceive(open, environmentAt('fog'), a, b), false);
  assert.equal(withinVisibility(environmentAt('fog'), a, { x: 360, y: 270 }), true);
  assert.equal(withinVisibility(environmentAt('fog'), a, { x: 360.001, y: 270 }), false);
  assert.equal(withinVisibility(environmentAt('clear'), a, { x: Infinity, y: 270 }), false);
  const blocked = { ...open, solids: [{ id: 'wall', kind: 'wall', x: 240, y: 200, width: 20, height: 140 }] };
  for (const id of Object.keys(ENVIRONMENTS)) assert.equal(canPerceive(blocked, environmentAt(id), a, b), false);
  const barricade = { ...blocked, solids: [{ ...blocked.solids[0], kind: 'barricade' }] };
  assert.equal(canPerceive(barricade, environmentAt('clear'), a, b), true);
});

test('rain and sandstorm expose bounded movement effects and tick-exact announced gusts', () => {
  assert.equal(environmentAt('rain').walkMultiplier, .9); assert.equal(environmentAt('rain').dashMultiplier, .85);
  assert.ok(Object.isFrozen(ENVIRONMENTS.rain));
  for (const seed of [1, 9, 732, 'dust']) {
    let previous = environmentAt('sandstorm', seed, 0), gustTicks = 0;
    assert.equal(previous.phase, 'calm');
    for (let tick = 0; tick < 2400; tick++) {
      const env = environmentAt('sandstorm', seed, tick);
      assert.deepEqual(env, environmentAt('sandstorm', seed, tick));
      assert.ok(env.sightRange === 220 || env.sightRange === 350);
      if (env.phase === 'gust') gustTicks++;
      if (previous.phase === 'calm' && env.phase === 'gust') { assert.equal(previous.warning, true); assert.equal(previous.nextTransitionTick, tick); }
      assert.ok(env.nextTransitionTick > tick);
      previous = env;
    }
    assert.equal(gustTicks, 360);
  }
});


test('small Zigzag wall-side regression has a navigable escape instead of an actor-width pocket', () => {
  const map = createBattlefield(211, { mapSize: 'small', terrain: 'zigzag', environment: 'fog', teamSizes: [15, 15] });
  // Actual blue-9 position from the natural seed-211 audit before this fix.
  const trappedBefore = { x: 507.00010000000003, y: 342.90686212938255 };
  for (const mirrored of [false, true]) for (const originalGoal of [{ x: 428, y: 314 }, { x: 394.4, y: 442.8 }]) {
    let point = { x: mirrored ? map.width - trappedBefore.x : trappedBefore.x, y: trappedBefore.y };
    const goal = { x: mirrored ? map.width - originalGoal.x : originalGoal.x, y: originalGoal.y };
    assert.ok(canOccupy(map, point));
    assert.ok(findPath(map, point, goal).length);
    for (let tick = 0; tick < 600 && Math.hypot(point.x - goal.x, point.y - goal.y) > 1; tick++) {
      point = moveToward(map, point, goal, 86 / 60);
      assert.ok(canOccupy(map, point));
    }
    assert.ok(Math.hypot(point.x - goal.x, point.y - goal.y) <= 1, 'fighter must escape the wall-side pocket');
  }
});

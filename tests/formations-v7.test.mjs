import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../dist/content.js';
import { createBattlefield, MAP_SIZES } from '../dist/maps.js';
import { canOccupy, moveToward } from '../dist/terrain.js';
import { FORMATIONS, TARGET_PRIORITIES, formationDestination, formationObjectiveDestination, targetScore } from '../dist/formations.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const field = (options = {}) => createBattlefield(42, { mapSize: 'small', terrain: 'crossroads', teamSizes: [15, 15], ...options });

test('formation catalogs are bounded and immutable', () => {
  assert.deepEqual(Object.keys(FORMATIONS), ['line', 'wedge', 'spread']);
  assert.deepEqual(Object.keys(TARGET_PRIORITIES), ['balanced', 'nearest', 'weakest', 'objective']);
  for (const catalog of [FORMATIONS, TARGET_PRIORITIES]) {
    assert.ok(Object.isFrozen(catalog));
    for (const entry of Object.values(catalog)) {
      assert.ok(Object.isFrozen(entry)); assert.ok(entry.name); assert.ok(entry.description);
    }
  }
});

test('line and omitted formation preserve every original destination without sharing mutable nodes', () => {
  for (const mapSize of ['legacy', ...Object.keys(MAP_SIZES)]) for (const terrain of MAPS.map(m => m.id)) {
    const map = freeze(field({ mapSize, terrain }));
    for (const node of map.coverNodes) {
      for (const choice of [undefined, 'line', 'unknown']) {
        const goal = formationDestination(map, node.team, node.bank, node.lane, choice);
        assert.deepEqual(goal, node); assert.notEqual(goal, node);
      }
    }
  }
});

test('all 1–15 asymmetric team slots have distinct, legal and bounded formation goals on every modern map', () => {
  for (const mapSize of Object.keys(MAP_SIZES)) for (const terrain of MAPS.map(m => m.id)) for (let size = 1; size <= 15; size++) {
    const map = field({ mapSize, terrain, teamSizes: [size, 16 - size] });
    const before = JSON.stringify(map);
    for (const formation of Object.keys(FORMATIONS)) for (const team of [0, 1]) for (const bank of [0, 1, 2]) {
      const keys = new Set(), goals = [];
      for (let lane = 0; lane < map.teamSizes[team]; lane++) {
        const goal = formationDestination(map, team, bank, lane, formation);
        const original = map.coverNodes.find(n => n.team === team && n.bank === bank && n.lane === lane);
        const context = `${mapSize}/${terrain}/${size}/${formation}/${team}/${bank}/${lane}`;
        assert.ok(canOccupy(map, goal), context);
        assert.ok(distance(goal, original) <= 100, context);
        assert.equal(goal.id, original.id, context); assert.equal(goal.lane, lane, context);
        assert.deepEqual(goal, formationDestination(map, team, bank, lane, formation), context);
        for (const earlier of goals) assert.ok(distance(goal, earlier) >= 18 - 1e-7, `${context}: body footprints overlap between slots ${earlier.lane} and ${lane}`);
        goals.push(goal);
        keys.add(`${goal.x}:${goal.y}`);
      }
      assert.equal(keys.size, map.teamSizes[team], 'no stacked destinations within a rank');
    }
    assert.equal(JSON.stringify(map), before, 'geometry helper never mutates input');
  }
});

test('both teams receive mirrored geometry including all fifteen slots and old cosmetic maps', () => {
  for (const mapSize of ['legacy', ...Object.keys(MAP_SIZES)]) for (const terrain of MAPS.map(m => m.id)) {
    const map = field({ mapSize, terrain }), count = mapSize === 'legacy' ? 5 : 15;
    for (const formation of Object.keys(FORMATIONS)) for (const bank of [0, 1, 2]) for (let lane = 0; lane < count; lane++) {
      const left = formationDestination(map, 0, bank, lane, formation), right = formationDestination(map, 1, bank, lane, formation);
      assert.ok(Math.abs(left.x + right.x - map.width) < .001);
      assert.equal(left.y, right.y);
      if (mapSize === 'legacy') {
        assert.ok(left.x >= 60 && left.x <= 900); assert.ok(left.y >= 68 && left.y <= 472);
      }
    }
  }
});

test('wedge creates a leading center and spread widens the rank; slot destinations ignore casualties', () => {
  const map = freeze(field());
  const line = [0, 2, 4].map(lane => formationDestination(map, 0, 0, lane));
  const wedge = [0, 2, 4].map(lane => formationDestination(map, 0, 0, lane, 'wedge'));
  const spread = [0, 2, 4].map(lane => formationDestination(map, 0, 0, lane, 'spread'));
  assert.ok(wedge[1].x > wedge[0].x && wedge[1].x > wedge[2].x);
  assert.ok(wedge[2].y - wedge[0].y < line[2].y - line[0].y);
  assert.ok(spread[2].y - spread[0].y > line[2].y - line[0].y);
  // No alive roster is an input. A persistent lane keeps its exact goal even
  // when earlier campaign slots are eliminated or queried in another order.
  const last = formationDestination(map, 1, 2, 14, 'wedge');
  for (const lane of [13, 9, 0, 4]) formationDestination(map, 1, 2, lane, 'wedge');
  assert.deepEqual(formationDestination(map, 1, 2, 14, 'wedge'), last);
});

test('objective formations preserve the line formula and give collision-free new shapes', () => {
  for (const mapSize of Object.keys(MAP_SIZES)) for (const terrain of MAPS.map(m => m.id)) {
    const map = field({ mapSize, terrain }), objective = map.controlPoints[0];
    for (const team of [0, 1]) for (const formation of Object.keys(FORMATIONS)) {
      const keys = new Set(), goals = [];
      for (let lane = 0; lane < 15; lane++) {
        const goal = formationObjectiveDestination(map, objective, team, lane, formation);
        if (formation === 'line') assert.deepEqual(goal, { x: objective.x + (team === 0 ? -1 : 1) * (32 + Math.floor(lane / 5) * 20), y: objective.y + (lane % 5 - 2) * 22 });
        else assert.ok(canOccupy(map, goal));
        assert.ok(distance(goal, objective) < 160);
        for (const earlier of goals) assert.ok(distance(goal, earlier) >= 18 - 1e-7, 'projected objective goals preserve body-sized spacing');
        goals.push(goal);
        keys.add(`${goal.x}:${goal.y}`);
      }
      assert.equal(keys.size, 15);
    }
  }
});

test('formation goals use collision projection and routed movement without teleporting', () => {
  const map = field({ teamSizes: [5, 5] });
  const base = formationDestination(map, 0, 0, 2), expected = formationDestination(map, 0, 0, 2, 'wedge');
  map.solids.push({ id: 'fractional-wall', kind: 'wall', x: expected.x - 2.1234, y: expected.y - 20, width: 8.4321, height: 40 });
  const goal = formationDestination(map, 0, 0, 2, 'wedge');
  assert.ok(canOccupy(map, goal), 'projection retains subpixel clearance');
  let current = { x: base.x, y: base.y };
  for (let tick = 0; tick < 240 && distance(current, goal) > 1; tick++) {
    const next = moveToward(map, current, goal, 1.5);
    assert.ok(canOccupy(map, next)); assert.ok(distance(current, next) <= 1.50001);
    current = next;
  }
  assert.ok(distance(current, goal) <= 1, 'regular movement reaches the projected goal around solids');
});

test('invalid slot requests never alias a real fighter', () => {
  const map = field({ teamSizes: [1, 3] }), objective = map.controlPoints[0];
  for (const args of [[2, 0, 0], [0, -1, 0], [0, 3, 0], [0, 0, -1], [0, 0, 15], [0, 0, .5], [0, 0, 1]]) {
    assert.equal(formationDestination(map, ...args, 'wedge'), null);
  }
  assert.equal(formationObjectiveDestination(map, objective, 3, 0, 'wedge'), null);
  assert.equal(formationObjectiveDestination(map, objective, 0, 15, 'wedge'), null);
  assert.equal(formationObjectiveDestination(map, null, 0, 0), null);
});

test('balanced priority exactly retains the old score and nearest uses distance alone', () => {
  for (const distance of [0, 40, 99.9, 100, 600]) for (const hp of [1, 60, 120]) for (const energy of [5, 20, 100]) for (const staggerTicks of [0, 20]) for (const currentTarget of [false, true]) {
    const snapshot = freeze({ distance, hp, maxHp: 120, energy, staggerTicks, currentTarget });
    const legacy = distance - (staggerTicks > 0 ? 30 : 0) - (energy < 20 ? 15 : 0) - (1 - hp / 120) * 15 - (currentTarget && distance < 100 ? 12 : 0);
    assert.equal(targetScore(snapshot), legacy);
    assert.equal(targetScore(snapshot, 'balanced'), legacy);
    assert.equal(targetScore(snapshot, 'nearest'), distance);
  }
});

test('weakest and objective pressure visibly change ranking with bounded tradeoffs', () => {
  const near = { distance: 80, hp: 120, maxHp: 120, energy: 100, objectiveDistance: 300, objectiveRadius: 108 };
  const weak = { ...near, distance: 160, hp: 12 };
  const capture = { ...near, distance: 170, objectiveDistance: 5 };
  assert.ok(targetScore(near, 'balanced') < targetScore(weak, 'balanced'));
  assert.ok(targetScore(weak, 'weakest') < targetScore(near, 'weakest'));
  assert.ok(targetScore(capture, 'objective') < targetScore(near, 'objective'));
  assert.ok(targetScore(near, 'nearest') < targetScore(weak, 'nearest'));
  assert.ok(targetScore({ ...weak, distance: 600 }, 'weakest') > targetScore(near, 'weakest'));
  assert.ok(targetScore({ ...capture, distance: 600 }, 'objective') > targetScore(near, 'objective'));
  assert.equal(targetScore(near, 'objective'), targetScore(near, 'balanced'), 'outside pressure radius has no objective bonus');
});

test('target scoring rejects hidden/dead or invalid-distance observations and never mutates input', () => {
  for (const priority of Object.keys(TARGET_PRIORITIES)) {
    for (const snapshot of [{ distance: 1, visible: false }, { distance: 1, alive: false }, {}, { distance: NaN }, { distance: -1 }, { distance: Infinity }]) {
      assert.equal(targetScore(freeze(snapshot), priority), Infinity);
    }
    const snapshot = freeze({ distance: 72, hp: 60, maxHp: 120, energy: 10, staggerTicks: 2, currentTarget: true, objectiveDistance: 30, objectiveRadius: 108 });
    assert.equal(targetScore(snapshot, priority), targetScore(snapshot, priority));
    assert.ok(Number.isFinite(targetScore(snapshot, priority)));
  }
  assert.equal(targetScore(null), Infinity);
  assert.equal(targetScore({ distance: 40 }, 'bad'), 40);
  assert.ok(Number.isFinite(targetScore({ distance: 40, hp: NaN, maxHp: 0, energy: NaN, objectiveDistance: NaN, objectiveRadius: NaN }, 'objective')));
});

import { authoritativeState } from './helpers/presentation-state.mjs';
import { stripPostV9 } from './helpers/schema-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, resolveDamage, MAPS } from '../dist/sim.js';
import { advanceRelic } from '../dist/relic.js';
import { canOccupy, findPath } from '../dist/terrain.js';
import { saveCampaign, loadCampaign, validateCampaign, RULES_VERSION, SAVE_KEY } from '../dist/persistence.js';

const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null,
  setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
const encode = game => JSON.stringify({ version: 2, rulesVersion: RULES_VERSION, game });
function roundTrip(game) {
  const store = memory(), before = structuredClone(game);
  const saved = saveCampaign(game, store); assert.equal(saved.ok, true, saved.error);
  assert.deepEqual(game, before, 'saving does not mutate the running battle');
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)).rulesVersion, RULES_VERSION);
  const loaded = loadCampaign(store); assert.equal(loaded.error, null); assert.equal(loaded.upgraded, false);
  assert.deepEqual(authoritativeState(loaded.game), authoritativeState(game));
  return loaded.game;
}
const relicGame = modifier => createGame(82, { teamSizes: [2, 2], mapSize: 'small', terrain: 'crossroads',
  mode: 'play', matchMode: 'relic', modifier });
function pickup(g) {
  const s = g.soldiers[0]; s.x = g.objective.x; s.y = g.objective.y;
  advanceRelic(g);
  assert.equal(g.objective.carrierId, s.id);
  return s;
}

test('v8 Relic checkpoints preserve available, carried, dropped and reset states', () => {
  for (const modifier of ['standard', 'saber_only']) {
    const g = relicGame(modifier); roundTrip(g);
    const carrier = pickup(g); roundTrip(g);
    const resumed = roundTrip(g); step(g, .5); step(resumed, .5);
    assert.deepEqual(resumed, g, 'carried checkpoint continues with identical RNG and objective state');
    resolveDamage(g, [{ target: carrier.id, source: null, amount: 999 }]);
    assert.equal(g.objective.state, 'available'); assert.equal(g.objective.carrierId, null);
    assert.equal(g.objective.unlockTick, g.tick + 30); roundTrip(g);
    const delivered = relicGame(modifier), courier = pickup(delivered);
    Object.assign(courier, { x: delivered.objective.extractionZones[0].x, y: delivered.objective.extractionZones[0].y });
    advanceRelic(delivered);
    assert.equal(delivered.objective.state, 'resetting'); assert.deepEqual(delivered.objective.points, [1, 0]);
    roundTrip(delivered);
  }
});

test('v8 validates objective identity, immutable geometry, counters, carrier and timers before loading', () => {
  const base = relicGame('standard'); pickup(base);
  const corruptions = [
    g => { g.objective.kind = 'control'; }, g => { g.objective.id = 'signal'; },
    g => { g.objective.radius++; }, g => { g.objective.home.x++; },
    g => { g.objective.extractionZones[1].radius = 999; },
    g => { g.objective.points[0] = .5; }, g => { g.objective.points[1] = 4; },
    g => { g.objective.targetScore = 30; }, g => { g.objective.capture = 1; },
    g => { g.objective.state = 'missing'; }, g => { g.objective.carrierId = 'red-99'; },
    g => { g.objective.carrierId = null; }, g => { g.objective.owner = 1; },
    g => { g.objective.x++; }, g => { g.objective.unlockTick = -1; },
    g => { g.soldiers[0].dashUntil = g.tick + 18; },
    g => { g.objective.unlockTick = g.tick + 121; },
    g => { g.objective.state = 'resetting'; g.objective.carrierId = null; g.objective.owner = null; },
    g => { delete g.objective.home; }, g => { delete g.objective.carrierId; },
    g => {
      const wall = g.terrain.solids.find(s => s.kind === 'wall');
      Object.assign(g.objective, { state: 'available', carrierId: null, owner: null,
        x: wall.x + wall.width / 2, y: wall.y + wall.height / 2 });
    },
  ];
  for (const corrupt of corruptions) {
    const game = structuredClone(base); corrupt(game);
    const store = memory(), encoded = encode(game); store.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(store).game, null, String(corrupt));
    assert.equal(store.getItem(SAVE_KEY), encoded, 'rejected checkpoints are not overwritten');
  }
});

test('v8 canonical Relic center and both extraction zones are walkable and connected on every map size', () => {
  for (const mapSize of ['legacy', 'small', 'medium', 'large']) for (const map of MAPS) {
    const g = createGame(83, { teamSizes: [5, 5], mapSize, terrain: map.id, matchMode: 'relic' });
    assert.equal(canOccupy(g.terrain, g.objective.home), true, `${mapSize}/${map.id} center`);
    for (const zone of g.objective.extractionZones) {
      assert.equal(canOccupy(g.terrain, zone), true, `${mapSize}/${map.id}/${zone.team} extraction`);
      assert.ok(findPath(g.terrain, g.objective.home, zone).length, `${mapSize}/${map.id}/${zone.team} path`);
    }
    roundTrip(g);
  }
});

test('v8 rejects current missing fields and impossible Saber-only attacks instead of migrating them', () => {
  const base = createGame(87, { modifier: 'saber_only' });
  for (const corrupt of [
    g => { delete g.config.modifier; }, g => { g.config.modifier = 'rapid_fire'; },
    g => { delete g.mastery; }, g => { delete g.soldiers[0].formPractice; },
    g => { g.objective.carrierId = 'blue-0'; },
    g => { const s = g.soldiers[0]; s.attack = { kind: 'force', target: 'red-0', startedTick: 0,
      resolveTick: 20, counter: false, form: s.form, weapon: s.weapon }; },
  ]) {
    const game = structuredClone(base); corrupt(game);
    const store = memory(), encoded = encode(game); store.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(store).game, null, String(corrupt));
    assert.equal(store.getItem(SAVE_KEY), encoded);
    assert.equal(saveCampaign(game, store).ok, false);
    assert.equal(store.getItem(SAVE_KEY), encoded);
  }
});

test('v8 distinguishes the v7 field boundary from older mastery migrations', () => {
  const game = createGame(810, { roundDuration: 45, matchMode: 'elimination' });
  step(game, 45); assert.equal(game.status, 'ended');
  stripPostV9(game);
  delete game.config.modifier;
  const envelope = { version: 2, rulesVersion: 7, game }, store = memory();
  const encoded = JSON.stringify(envelope); store.setItem(SAVE_KEY, encoded);
  const loaded = loadCampaign(store); assert.equal(loaded.error, null);
  assert.equal(loaded.game.config.modifier, 'standard'); assert.equal(loaded.upgraded, true);
  const original = stripPostV9(structuredClone(loaded.game)); delete original.config.modifier;
  assert.deepEqual(original, game, 'v7 mastery, settlement, settings and all original state remain exact');
  assert.equal(store.getItem(SAVE_KEY), encoded);
  validateCampaign(loaded.game);
  delete envelope.game.mastery; store.setItem(SAVE_KEY, JSON.stringify(envelope));
  assert.equal(loadCampaign(store).game, null, 'a damaged v7 save cannot receive fabricated empty mastery');
});

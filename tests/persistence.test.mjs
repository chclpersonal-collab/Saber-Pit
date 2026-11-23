import { authoritativeState } from './helpers/presentation-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command, nextRound, setAutoCommand, setDoctrine, MAPS, DOCTRINES } from '../dist/sim.js';
import { saveCampaign, loadCampaign, hasSavedCampaign, SAVE_KEY } from '../dist/persistence.js';

function memoryStorage() {
  const slots = new Map();
  return { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value), removeItem: key => slots.delete(key) };
}

test('campaign resumes full RNG state, active support and commands deterministically', () => {
  const game = createGame(42, { autoCommand: true, doctrine: 'assault' });
  step(game, .67); command(game, 'force'); command(game, 'guard'); step(game, .13);
  const storage = memoryStorage();
  assert.deepEqual(saveCampaign(game, storage), { ok: true, error: null });
  assert.equal(hasSavedCampaign(storage), true);
  const loaded = loadCampaign(storage);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.game, game);
  step(game, 90); step(loaded.game, 90);
  assert.deepEqual(loaded.game, game);
});

test('campaign saves promotion reports, next rounds, changing maps and maximum grade', () => {
  const game = createGame(12, { autoCommand: true });
  const storage = memoryStorage();
  for (let round = 0; round < 6; round++) {
    step(game, 90);
    assert.equal(saveCampaign(game, storage).ok, true, `ended round ${game.round}`);
    assert.deepEqual(loadCampaign(storage).game, game);
    if (round === 3) game.careers.forEach(team => team.forEach(career => { career.merit = 2400; }));
    setDoctrine(game, ['guard', 'assault', 'balanced'][round % 3]);
    nextRound(game);
    assert.equal(saveCampaign(game, storage).ok, true, `start round ${game.round}`);
    const loaded = loadCampaign(storage);
    assert.deepEqual(loaded.game, game);
  }
});

test('corrupt or oversized saves never replace the current battle or stored data', () => {
  const storage = memoryStorage(), game = createGame(3);
  for (const mutate of [
    data => { data.version = 999; },
    data => { data.game.soldiers.pop(); },
    data => { data.game.soldiers[0].weapon = '__proto__'; },
    data => { data.game.soldiers[0].hp = -1; },
    data => { data.game.terrain.coverNodes = []; },
    data => { data.game.doctrines[0] = 'bad'; },
    data => { data.game.careers[0][0].merit = 999999; },
    data => { delete data.game.stats; },
    data => { data.game.soldiers[0].career.nextThreshold = null; },
    data => { data.game.soldiers[0].attack = { kind: 'unknown' }; },
    data => { data.game.roundReport = { round: 1, careers: [] }; },
  ]) {
    assert.equal(saveCampaign(game, storage).ok, true);
    const data = JSON.parse(storage.getItem(SAVE_KEY)); mutate(data);
    const bad = JSON.stringify(data); storage.setItem(SAVE_KEY, bad);
    assert.equal(loadCampaign(storage).game, null);
    assert.equal(storage.getItem(SAVE_KEY), bad);
    assert.equal(game.tick, 0);
  }
  storage.setItem(SAVE_KEY, 'x'.repeat(500001));
  assert.equal(loadCampaign(storage).game, null);
});

test('blocked/quota storage and missing saves return readable failures', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(saveCampaign(createGame(4), storage).ok, false);
  assert.equal(loadCampaign(storage).game, null);
  assert.equal(hasSavedCampaign(storage), false);
  assert.match(loadCampaign(memoryStorage()).error, /No saved campaign/);
});

test('separate campaign slot preserves the archived sandbox save', () => {
  const storage = memoryStorage(); storage.setItem('little-worlds-save-v1', 'keep');
  const game = createGame(71); setAutoCommand(game, true); step(game, 10);
  assert.equal(saveCampaign(game, storage).ok, true);
  assert.equal(storage.getItem('little-worlds-save-v1'), 'keep');
});

test('renderer geometry, combat payloads and record identifiers reject corrupt saves without overwriting them', () => {
  const game = createGame(42, { autoCommand: true });
  step(game, 3);
  command(game, 'guard'); command(game, 'force');
  assert.ok(game.effects.length);
  const storage = memoryStorage();
  for (const mutate of [
    g => { g.objective.radius = -108; },
    g => { g.objective.x = 999999; },
    g => { g.soldiers[0].energy = 101; },
    g => { g.soldiers[0].form = 'constructor'; },
    g => { g.soldiers[0].attack = { kind: 'force', target: 'red-0', startedTick: 0, resolveTick: 200, form: 'shii_cho', weapon: 'knife', counter: false }; },
    g => { g.soldiers[0].contributors.push({ source: 'blue-1', damage: 2, tick: g.tick }); },
    g => { g.soldiers[0].contributors.push({ source: 'missing', damage: 2, tick: g.tick }); },
    g => { g.soldiers[0].contributors.push({ source: 'red-1', damage: -2, tick: g.tick }); },
    g => { g.soldiers[0].contributors.push({ source: 'red-1', damage: 2, tick: g.tick + 1 }); },
    g => { g.records.soldiers[0].kills++; },
    g => { g.records.teams[0].kills++; },
    g => { g.records.soldiers[0].id = 'red-0'; },
    g => { g.records.soldiers[0].assists = 1.5; },
    g => { g.effects[0].ttl = -1; },
    g => { g.effects[0].maxTtl = 0; },
    g => { g.effects[0].type = 'constructor'; },
    g => { g.effects[0].x2 = 1e10; },
    g => { g.effects[0].radius = -1; },
    g => { g.events[0].team = {}; },
    g => { g.effects.push(structuredClone(g.effects[0])); },
    g => { g.nextEffectId = 1; },
  ]) {
    assert.equal(saveCampaign(game, storage).ok, true);
    const data = JSON.parse(storage.getItem(SAVE_KEY)); mutate(data.game);
    const encoded = JSON.stringify(data); storage.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(storage).game, null);
    assert.equal(storage.getItem(SAVE_KEY), encoded);
  }
});

test('report slot identities and equipment records must refer to the campaign roster and catalog', () => {
  const game = createGame(51, { autoCommand: true });
  step(game, 90); nextRound(game);
  assert.ok(game.mutations.length);
  const storage = memoryStorage();
  for (const mutate of [
    g => { g.roundReport.careers[0].soldierId = 'missing'; },
    g => { g.roundReport.careers[0] = structuredClone(g.roundReport.careers[1]); },
    g => { g.roundReport.doctrines[0] = 'invalid'; },
    g => { g.mutations[0].to = 'missing'; },
    g => { g.mutations[0].soldierId = 'missing'; },
  ]) {
    assert.equal(saveCampaign(game, storage).ok, true);
    const data = JSON.parse(storage.getItem(SAVE_KEY)); mutate(data.game);
    const encoded = JSON.stringify(data); storage.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(storage).game, null);
    assert.equal(storage.getItem(SAVE_KEY), encoded);
  }
});

test('100 campaign rounds resume deterministically across rotating terrain, doctrines, support and capped careers', () => {
  const configurations = [{ terrain: null, doctrine: 'balanced', rounds: 64 },
    ...MAPS.flatMap(map => Object.keys(DOCTRINES).map(doctrine => ({ terrain: map.id, doctrine, rounds: 4 })))];
  const terrainsSeen = new Set();
  let completed = 0;
  for (const config of configurations) {
    let game = createGame(731, { terrain: config.terrain, doctrine: config.doctrine, autoCommand: true });
    const storage = memoryStorage();
    for (let index = 0; index < config.rounds; index++) {
      setDoctrine(game, Object.keys(DOCTRINES)[index % 3], 1);
      // Commands now require a real threat/target. Reach an actual windup before
      // saving rather than demanding that a quiet opening waste a support charge.
      for (let slice = 0; slice < 80 && !game.soldiers.some(s => s.attack); slice++) step(game, .1);
      command(game, 'guard'); command(game, 'force'); step(game, .07);
      assert.equal(game.status, 'playing');
      assert.ok(game.soldiers.some(s => s.attack || s.lastOutcome));
      assert.equal(saveCampaign(game, storage).ok, true, `active round ${game.round}/${config.terrain}`);
      const loaded = loadCampaign(storage);
      assert.equal(loaded.error, null);
      assert.deepEqual(authoritativeState(loaded.game), authoritativeState(game));
      step(game, 90); step(loaded.game, 90);
      assert.deepEqual(loaded.game, game, 'resume preserves full deterministic continuation');
      game = loaded.game;
      terrainsSeen.add(game.terrain.id); completed++;
      assert.equal(saveCampaign(game, storage).ok, true, `ended round ${game.round}`);
      assert.deepEqual(loadCampaign(storage).game, game);
      assert.equal(game.history.length, Math.min(50, game.round));
      // Fixed-terrain campaigns also exercise terminal-grade support and report saves.
      if (config.terrain && index === 1) game.careers.flat().forEach(career => { career.merit = 2400; });
      nextRound(game);
      assert.equal(saveCampaign(game, storage).ok, true, `spawn round ${game.round}`);
      assert.deepEqual(loadCampaign(storage).game, game);
    }
  }
  assert.equal(completed, 100);
  assert.equal(terrainsSeen.size, 3);
});

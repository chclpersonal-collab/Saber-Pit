import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createGame, step, nextRound } from '../dist/sim.js';
import { saveCampaign, loadCampaign, validateCampaign, SAVE_KEY, RULES_VERSION } from '../dist/persistence.js';
import { LEGACY_SAVE_KEY } from '../dist/migration.js';

const DT = 1 / 60;
const memory = () => {
  const slots = new Map();
  return { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) };
};
function authoritative(game) {
  const copy = structuredClone(game);
  delete copy.alpha;
  delete copy.prevFrontLine;
  for (const entity of [...copy.soldiers, copy.objective]) { delete entity.prevX; delete entity.prevY; }
  return copy;
}
function assertCollapsed(game) {
  for (const entity of [...game.soldiers, ...(game.objective.kind === 'relic' ? [game.objective] : [])]) {
    assert.equal(entity.prevX, entity.x);
    assert.equal(entity.prevY, entity.y);
  }
  assert.equal(game.alpha, game._accumulator / DT);
  assert.equal(game.prevFrontLine, game.frontLine);
}

test('Phase 1 saves omit presentation data without mutating live snapshots or changing rules', () => {
  const game = createGame(42, { matchMode: 'relic' });
  step(game, .123);
  const before = structuredClone(game), storage = memory();
  assert.equal(saveCampaign(game, storage).ok, true);
  assert.deepEqual(game, before);
  const envelope = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(envelope.rulesVersion, 11);
  assert.equal(RULES_VERSION, 11);
  assert.equal(Object.hasOwn(envelope.game, 'alpha'), false);
  assert.equal(Object.hasOwn(envelope.game, 'prevFrontLine'), false);
  for (const entity of [...envelope.game.soldiers, envelope.game.objective]) {
    assert.equal(Object.hasOwn(entity, 'prevX'), false);
    assert.equal(Object.hasOwn(entity, 'prevY'), false);
  }
  assert.deepEqual(envelope.game, authoritative(game));
});

test('Phase 1 fractional-residual loads preserve attacks, RNG, history and deterministic continuation', () => {
  const game = createGame(42, { autoCommand: true });
  step(game, game.roundDuration);
  nextRound(game);
  for (let i = 0; i < 3600 && !game.soldiers.some(s => s.attack); i++) step(game, DT);
  assert.ok(game.soldiers.some(s => s.attack), 'checkpoint includes an attack in progress');
  assert.ok(game.history.length > 0);
  step(game, DT * .37);
  const storage = memory(), original = structuredClone(game);
  assert.equal(saveCampaign(game, storage).ok, true);
  const { game: loaded, error } = loadCampaign(storage);
  assert.equal(error, null);
  assert.equal(loaded._accumulator, original._accumulator);
  assert.ok(loaded._accumulator > 0);
  assert.deepEqual(loaded.soldiers.map(s => s.attack), original.soldiers.map(s => s.attack));
  assert.equal(loaded.rngState, original.rngState);
  assert.deepEqual(loaded.history, original.history);
  assert.deepEqual(authoritative(loaded), authoritative(original));
  assertCollapsed(loaded);
  // First post-load frame consumes no tick: the saved residue must survive.
  step(game, DT * .12); step(loaded, DT * .12);
  assert.equal(loaded.tick, original.tick);
  assert.deepEqual(authoritative(loaded), authoritative(game));
  for (const dt of [DT * .7, DT * 2.4, DT * .1, .25, 1.2]) {
    step(game, dt); step(loaded, dt);
    assert.deepEqual(authoritative(loaded), authoritative(game));
  }
});

test('Phase 1 presentation data cannot reject a valid game or corrupt loaded positions', () => {
  const game = createGame(82, { matchMode: 'relic' });
  step(game, .123);
  const cycle = {}; cycle.self = cycle;
  game.alpha = cycle;
  game.prevFrontLine = cycle;
  game.soldiers[0].prevX = Infinity;
  game.soldiers[0].prevY = cycle;
  game.objective.prevX = NaN;
  game.objective.prevY = cycle;
  assert.equal(validateCampaign(game), game);
  const storage = memory();
  assert.equal(saveCampaign(game, storage).ok, true);
  assert.equal(game.alpha, cycle, 'saving must not repair or mutate the live game');
  assert.equal(game.prevFrontLine, cycle);
  const envelope = JSON.parse(storage.getItem(SAVE_KEY));
  envelope.game.alpha = { constructor: 'untrusted' };
  envelope.game.prevFrontLine = { constructor: 'untrusted' };
  envelope.game.soldiers[0].prevX = { nested: { constructor: 'untrusted' } };
  envelope.game.soldiers[0].prevY = 'not a coordinate';
  envelope.game.objective.prevX = -1e100;
  envelope.game.objective.prevY = [false];
  storage.setItem(SAVE_KEY, JSON.stringify(envelope));
  const { game: loaded, error } = loadCampaign(storage);
  assert.equal(error, null);
  assertCollapsed(loaded);
  assert.equal(loaded.soldiers[0].x, game.soldiers[0].x);
  assert.equal(loaded.objective.x, game.objective.x);
  assert.equal(loaded.frontLine, game.frontLine);
  envelope.game.soldiers[0].x = 'not a coordinate';
  storage.setItem(SAVE_KEY, JSON.stringify(envelope));
  assert.equal(loadCampaign(storage).game, null, 'authoritative geometry still rejects corruption');
});

test('Phase 1 current-schema saves without interpolation fields load unchanged', () => {
  for (const matchMode of ['control', 'relic', 'elimination']) {
    const game = createGame(81, { matchMode });
    step(game, .147);
    const old = authoritative(game), storage = memory();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, rulesVersion: 11, game: old }));
    const result = loadCampaign(storage);
    assert.equal(result.error, null);
    assert.equal(result.upgraded, false);
    assertCollapsed(result.game);
    assert.deepEqual(authoritative(result.game), old);
  }
});

test('Phase 1 archived v03-v06 fixtures still migrate and initialize safe render snapshots', () => {
  const folder = new URL('../tests/fixtures/', import.meta.url);
  for (const filename of readdirSync(folder).filter(name => name.endsWith('save.json'))) {
    const storage = memory();
    storage.setItem(filename === 'v03-save.json' ? LEGACY_SAVE_KEY : SAVE_KEY,
      readFileSync(new URL(filename, folder), 'utf8'));
    const result = loadCampaign(storage);
    assert.equal(result.error, null, filename);
    assertCollapsed(result.game);
    const resaved = memory();
    assert.equal(saveCampaign(result.game, resaved).ok, true, filename);
    assert.deepEqual(authoritative(loadCampaign(resaved).game), authoritative(result.game), filename);
  }
});

test('Phase 1 genuine v08 Relic fixtures retain every original gameplay field', () => {
  function originalFields(actual, expected, path = 'game') {
    if (expected !== null && typeof expected === 'object') {
      if (Array.isArray(expected)) assert.equal(actual.length, expected.length, path);
      for (const key of Object.keys(expected)) originalFields(actual[key], expected[key], `${path}.${key}`);
    } else assert.equal(actual, expected, path);
  }
  for (const phase of ['active', 'ended']) {
    const envelope = JSON.parse(readFileSync(new URL(`../docs/evidence/v0.9-v08-fixtures/${phase}.json`, import.meta.url), 'utf8'));
    const storage = memory();
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    const result = loadCampaign(storage);
    assert.equal(result.error, null, phase);
    assertCollapsed(result.game);
    originalFields(result.game, envelope.game);
  }
});

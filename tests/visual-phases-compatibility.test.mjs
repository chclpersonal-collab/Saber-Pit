/** Independent integration oracle: never regenerate expectations from candidate code.
 * Load the verified Phase 1 source directly from its immutable Git object. */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as candidate from '../dist/sim.js';
import * as persistence from '../dist/persistence.js';
import { authoritativeState } from './helpers/presentation-state.mjs';
import { createPresentationClock } from '../dist/presentation-clock.js';

const BASELINE = 'e3a7f3d73fdd4aa28e7b41e1a8faeed9b38327d8';
const repo = fileURLToPath(new URL('../', import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), 'saber-phase1-oracle-'));
after(() => rmSync(fixture, { recursive: true, force: true }));
writeFileSync(join(fixture, 'package.json'), '{"type":"module"}');
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', BASELINE, 'dist'], { cwd: repo, encoding: 'utf8' }).trim().split(/\r?\n/).filter(p => p.endsWith('.js'));
for (const file of files) {
  const target = join(fixture, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, execFileSync('git', ['show', `${BASELINE}:${file}`], { cwd: repo }));
}
const baseline = await import(pathToFileURL(join(fixture, 'dist/sim.js')));
const baselinePersistence = await import(pathToFileURL(join(fixture, 'dist/persistence.js')));
const memory = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
};

for (const hz of [60, 120, 144]) {
  test(`presentation wall-clock holds preserve the actual tick sequence at ${hz} Hz`, () => {
    const options = { autoCommand: true, teamSizes: [2, 2], forms: [['ataru', 'makashi'], ['juyo', 'soresu']] };
    const a = baseline.createGame(120120, options), b = candidate.createGame(120120, options);
    const clock = createPresentationClock(); clock.reset(b);
    let holds = 0, frozenFrames = 0, allowedSeconds = 0;
    for (let frame = 0; frame < hz * 30 && b.status === 'playing'; frame++) {
      const beforeTick = b.tick;
      let remaining = 1 / hz;
      // The app integration spends real seconds, then applies speed to each
      // permitted simulation slice. Baseline receives only those exact slices.
      while (remaining > 1e-12 && b.status === 'playing') {
        remaining = clock.consume(remaining);
        if (remaining <= 1e-12) break;
        const dt = Math.min(1 / 60, remaining);
        candidate.step(b, dt); baseline.step(a, dt); allowedSeconds += dt;
        if (clock.observe(b)) holds++;
        remaining -= dt;
      }
      if (beforeTick === b.tick && clock.stopped) frozenFrames++;
      if (frame % hz === 0) assert.deepEqual(authoritativeState(b), authoritativeState(a));
    }
    assert.ok(holds > 0, 'real resolved saber contacts trigger stop');
    assert.ok(frozenFrames > 0, 'at least one display frame freezes simulation');
    assert.ok(allowedSeconds < 30, 'stopped seconds are not replayed into simulation');
    assert.deepEqual(authoritativeState(b), authoritativeState(a));
  });
}

for (const scenario of [
  { seed: 120120, options: { autoCommand: true, teamSizes: [2, 2], forms: [['ataru', 'ataru'], ['soresu', 'juyo']] } },
  { seed: 815, options: { autoCommand: true, teamSizes: [8, 8], matchMode: 'relic', startingRanks: ['SSS+V', 'SSS+V'] } },
  { seed: 416, options: { autoCommand: true, teamSizes: [3, 3], modifier: 'saber_only', forms: [['makashi', 'djem_so', 'vaapad'], ['shien', 'niman', 'ataru']] } },
]) {
  test(`visual phases preserve baseline state/RNG/outcomes at equal ticks: ${scenario.seed}`, () => {
    const a = baseline.createGame(scenario.seed, scenario.options);
    const b = candidate.createGame(scenario.seed, scenario.options);
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 5400 && a.status === 'playing'; i++) {
        baseline.step(a, 1 / 60); candidate.step(b, 1 / 60);
        if (i % 180 === 0) assert.deepEqual(authoritativeState(b), authoritativeState(a), `round ${round}, tick ${a.tick}`);
      }
      assert.deepEqual(authoritativeState(b), authoritativeState(a));
      baseline.nextRound(a); candidate.nextRound(b);
    }
  });
}

test('visual phases retain exact campaign envelope and cross-version deterministic continuation', () => {
  const a = baseline.createGame(120120, { autoCommand: true, teamSizes: [2, 2], matchMode: 'relic' });
  const b = candidate.createGame(120120, { autoCommand: true, teamSizes: [2, 2], matchMode: 'relic' });
  baseline.step(a, 3.137); candidate.step(b, 3.137);
  const oldStore = memory(), newStore = memory();
  assert.equal(baselinePersistence.saveCampaign(a, oldStore).ok, true);
  assert.equal(persistence.saveCampaign(b, newStore).ok, true);
  assert.equal(persistence.SAVE_KEY, baselinePersistence.SAVE_KEY);
  assert.equal(persistence.RULES_VERSION, baselinePersistence.RULES_VERSION);
  assert.equal(newStore.getItem(persistence.SAVE_KEY), oldStore.getItem(persistence.SAVE_KEY));
  const oldLoaded = baselinePersistence.loadCampaign(newStore);
  const newLoaded = persistence.loadCampaign(oldStore);
  assert.equal(oldLoaded.error, null); assert.equal(newLoaded.error, null);
  for (let i = 0; i < 900; i++) { baseline.step(oldLoaded.game, 1 / 60); candidate.step(newLoaded.game, 1 / 60); }
  assert.deepEqual(authoritativeState(newLoaded.game), authoritativeState(oldLoaded.game));
});

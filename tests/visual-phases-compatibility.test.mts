/** Independent integration oracle: never regenerate expectations from candidate code.
 * Use a byte-exact portable copy of the verified Phase 1 oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as candidate from '../dist/sim.js';
import * as persistence from '../dist/persistence.js';
import { authoritativeState } from './helpers/presentation-state.mjs';

const fixture = new URL('./fixtures/phase1-reference/', import.meta.url);
const digests = JSON.parse(readFileSync(new URL('SHA256.json', fixture), 'utf8'));
for (const [file, expected] of Object.entries(digests)) {
  const actual = createHash('sha256').update(readFileSync(new URL(file, fixture))).digest('hex');
  assert.equal(actual, expected, 'Frozen Phase 1 oracle mismatch: ' + file);
}
const baseline = await import(new URL('sim.js', fixture));
const baselinePersistence = await import(new URL('persistence.js', fixture));
const memory = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
};

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

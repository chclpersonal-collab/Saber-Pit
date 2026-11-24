import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCampaign, saveCampaign, hasSavedCampaign, SAVE_KEY } from '../dist/persistence.js';
import { LEGACY_SAVE_KEY } from '../dist/migration.js';
import { step, createGame } from '../dist/sim.js';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/v03-save.json', import.meta.url), 'utf8'));
const storage = () => { const slots = new Map(); return { getItem:k => slots.get(k) ?? null, setItem:(k,v) => slots.set(k,v), removeItem:k => slots.delete(k) }; };

test('authentic v0.3 campaign migrates deterministically with history and original slot intact', () => {
  const mem = storage(), encoded = JSON.stringify(fixture);
  mem.setItem(LEGACY_SAVE_KEY, encoded);
  assert.equal(hasSavedCampaign(mem), true);
  const a = loadCampaign(mem), b = loadCampaign(mem);
  assert.equal(a.error, null); assert.equal(a.migrated, true); assert.match(a.notice, /Total stats start at zero/i);
  assert.deepEqual(a.game, b.game);
  assert.equal(a.game.round, fixture.game.round); assert.equal(a.game.tick, 0);
  assert.deepEqual(a.game.careers, fixture.game.careers); assert.deepEqual(a.game.history, fixture.game.history);
  assert.deepEqual(a.game.score, fixture.game.score); assert.deepEqual(a.game.doctrines, fixture.game.doctrines);
  assert.equal(a.game.autoCommand, fixture.game.autoCommand);
  assert.equal(a.game.records.origin, 'migration-v0.3');
  assert.ok(a.game.records.teams.every(t => !t.kills && !t.deaths && !t.assists && !t.environmentDeaths));
  assert.equal(a.game.soldiers[0].weapon, 'worn_force_push');
  assert.equal(a.game.soldiers[3].weapon, 'force_pulse');
  assert.equal(a.game.soldiers[0].meleeWeapon, 'worn_saber');
  assert.equal(a.game.soldiers[0].xp, fixture.game.soldiers[0].xp);
  assert.equal(mem.getItem(SAVE_KEY), null); assert.equal(mem.getItem(LEGACY_SAVE_KEY), encoded);
  step(a.game, 90); step(b.game, 90); assert.deepEqual(a.game, b.game);
  assert.equal(saveCampaign(a.game, mem).ok, true); assert.equal(mem.getItem(LEGACY_SAVE_KEY), encoded);
  assert.equal(loadCampaign(mem).migrated, false); assert.deepEqual(loadCampaign(mem).game, a.game);
});

test('completed legacy round advances once and dead veterans become recruits without losing slot careers', () => {
  const old = structuredClone(fixture), mem = storage();
  old.game.status = 'ended'; old.game.soldiers[0].alive = false;
  mem.setItem(LEGACY_SAVE_KEY, JSON.stringify(old));
  const loaded = loadCampaign(mem);
  assert.equal(loaded.error, null); assert.equal(loaded.game.round, old.game.round + 1);
  assert.equal(loaded.game.soldiers[0].xp, 0); assert.equal(loaded.game.careers[0][0].merit, old.game.careers[0][0].merit);
  assert.deepEqual(loaded.game.history, old.game.history);
});

test('v2 takes precedence and a corrupt v2 never silently falls back to legacy', () => {
  const mem = storage(); mem.setItem(LEGACY_SAVE_KEY, JSON.stringify(fixture));
  const fresh = createGame('modern'); assert.equal(saveCampaign(fresh, mem).ok, true);
  assert.equal(loadCampaign(mem).game.seed, 'modern');
  mem.setItem(SAVE_KEY, '{broken');
  assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), '{broken');
});

test('legacy malformed durable values and hostile keys reject without writes', () => {
  for (const mutate of [
    e => { e.version = 0; }, e => { e.game.careers[0][0].merit = 2401; },
    e => { e.game.loadouts[0].roster[0].weapon = 'unrecognized'; },
    e => { e.game.soldiers[0].id = 'red-0'; }, e => { e.game.soldiers[0].xp = -2; },
    e => { e.game.history[0].survivors = [100, 2]; }, e => { e.game.rngState = 0; },
    e => { e.game.careers = []; }, e => { e.game.doctrines[0] = 'constructor'; },
    e => { e.game.history[0].health[0] = 'NaN'; },
    e => { Object.defineProperty(e.game, '__proto__', { value: { polluted: true }, enumerable: true }); },
  ]) {
    const e = structuredClone(fixture), mem = storage(); mutate(e); const encoded = JSON.stringify(e);
    mem.setItem(LEGACY_SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(LEGACY_SAVE_KEY), encoded); assert.equal(mem.getItem(SAVE_KEY), null);
  }
});

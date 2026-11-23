import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, resolveDamage, step, nextRound } from '../dist/sim.js';
import { saveCampaign, loadCampaign } from '../dist/persistence.js';

const damage = (target, source, amount) => ({ target, source, amount, suppression: 0, kind: 'saber' });
const row = (g, id) => g.records.soldiers.find(s => s.id === id);
const soldier = (g, id) => g.soldiers.find(s => s.id === id);
function totalsAgree(g) {
  for (const team of [0, 1]) for (const key of ['kills', 'deaths', 'assists', 'environmentDeaths']) {
    const total = g.records.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0);
    assert.equal(g.records.teams[team][key], total, `team ${team} ${key}`);
    assert.ok(Number.isInteger(total) && total >= 0);
    const roundTotal = g.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0);
    assert.equal(g.stats[key][team], roundTotal, `round team ${team} ${key}`);
  }
  const kills = g.records.teams.reduce((sum, s) => sum + s.kills, 0);
  const deaths = g.records.teams.reduce((sum, s) => sum + s.deaths, 0);
  const environmental = g.records.teams.reduce((sum, s) => sum + s.environmentDeaths, 0);
  assert.equal(deaths, kills + environmental, 'every death has exactly one kill or environmental classification');
}

test('v4 records: one fatal hit credits one individual/team kill and death exactly once', () => {
  const g = createGame(20), rng = g.rngState;
  const hit = damage('red-0', 'blue-0', 9999);
  resolveDamage(g, [hit]);
  assert.equal(soldier(g, 'red-0').hp, 0);
  assert.equal(row(g, 'blue-0').kills, 1);
  assert.equal(row(g, 'red-0').deaths, 1);
  assert.equal(g.records.teams[0].assists, 0);
  const records = structuredClone(g.records);
  resolveDamage(g, [hit, hit]);
  assert.deepEqual(g.records, records, 'dead targets cannot be credited again');
  assert.equal(g.rngState, rng, 'damage settlement is RNG independent');
  totalsAgree(g);
});

test('v4 records: simultaneous mutual lethal damage preserves both killers', () => {
  const g = createGame(21);
  resolveDamage(g, [damage('red-0', 'blue-0', 999), damage('blue-0', 'red-0', 999)]);
  assert.equal(row(g, 'blue-0').kills, 1);
  assert.equal(row(g, 'blue-0').deaths, 1);
  assert.equal(row(g, 'red-0').kills, 1);
  assert.equal(row(g, 'red-0').deaths, 1);
  totalsAgree(g);
});

test('v4 records: proportional overkill caps damage and uses lexical ID for equal contributors', () => {
  const g = createGame(22);
  soldier(g, 'red-0').hp = 5;
  resolveDamage(g, [damage('red-0', 'blue-1', 100), damage('red-0', 'blue-0', 100)]);
  assert.equal(soldier(g, 'blue-0').damageDealt, 2.5);
  assert.equal(soldier(g, 'blue-1').damageDealt, 2.5);
  assert.equal(row(g, 'blue-0').kills, 1);
  assert.equal(row(g, 'blue-1').assists, 1);
  assert.equal(row(g, 'blue-1').kills, 0);
  totalsAgree(g);
});

test('v4 records: largest recent damage wins kill credit instead of the last hit', () => {
  const g = createGame(23);
  resolveDamage(g, [damage('red-0', 'blue-0', 100)]);
  resolveDamage(g, [damage('red-0', 'blue-1', 999)]);
  assert.equal(row(g, 'blue-0').kills, 1);
  assert.equal(row(g, 'blue-1').assists, 1);
  assert.equal(soldier(g, 'blue-1').damageDealt, 20);
  totalsAgree(g);
});

test('v4 records: several attacks from one source create one assist, no duplicate kill', () => {
  const g = createGame(24);
  resolveDamage(g, [damage('red-0', 'blue-1', 3), damage('red-0', 'blue-1', 4), damage('red-0', 'blue-2', 5)]);
  resolveDamage(g, [damage('red-0', 'blue-0', 999)]);
  assert.equal(row(g, 'blue-0').kills, 1);
  assert.equal(row(g, 'blue-1').assists, 1);
  assert.equal(row(g, 'blue-2').assists, 1);
  assert.equal(g.records.teams[0].assists, 2);
  totalsAgree(g);
});

test('v4 records: expired damage does not steal kills or create stale assists', () => {
  const g = createGame(25);
  resolveDamage(g, [damage('red-0', 'blue-0', 100)]);
  g.time = 7; g.tick = 420; g.timeLeft = 83;
  resolveDamage(g, [damage('red-0', 'blue-1', 99)]);
  assert.equal(row(g, 'blue-0').kills, 0);
  assert.equal(row(g, 'blue-0').assists, 0);
  assert.equal(row(g, 'blue-1').kills, 1);
  totalsAgree(g);
});

test('v4 records: recent damage contributes an assist before the window expires', () => {
  const g = createGame(26);
  resolveDamage(g, [damage('red-0', 'blue-0', 10)]);
  g.time = 5.9; g.tick = 354; g.timeLeft = 84.1;
  resolveDamage(g, [damage('red-0', 'blue-1', 999)]);
  assert.equal(row(g, 'blue-1').kills, 1);
  assert.equal(row(g, 'blue-0').assists, 1);
  totalsAgree(g);
});

test('v4 records: six-second assist boundary includes tick 360 and excludes tick 361', () => {
  for (const tick of [360, 361]) {
    const g = createGame(260);
    resolveDamage(g, [damage('red-0', 'blue-0', 10)]);
    g.tick = tick; g.time = tick / 60; g.timeLeft = 90 - g.time;
    resolveDamage(g, [damage('red-0', 'blue-1', 999)]);
    assert.equal(row(g, 'blue-0').assists, tick === 360 ? 1 : 0);
    totalsAgree(g);
  }
});

test('v4 records: environmental fatal damage records death without inventing a kill or assist', () => {
  for (const source of [null, 'missing-soldier']) {
    const g = createGame(27);
    resolveDamage(g, [damage('red-0', 'blue-0', 100)]);
    resolveDamage(g, [damage('red-0', source, 999)]);
    assert.equal(row(g, 'red-0').deaths, 1);
    assert.equal(row(g, 'red-0').environmentDeaths, 1);
    assert.equal(g.records.teams[0].kills, 0);
    assert.equal(g.records.teams[0].assists, 0);
    totalsAgree(g);
  }
});

test('v4 records: malformed and nonpositive damage cannot create deaths or NaN', () => {
  const g = createGame(28), before = structuredClone(g.records);
  resolveDamage(g, [damage('red-0', 'blue-0', -10), damage('red-0', 'blue-0', NaN), damage('red-0', 'blue-0', Infinity), damage('red-0', 'blue-0', 0), damage('missing', 'blue-0', 999)]);
  assert.deepEqual(g.records, before);
  assert.ok(g.soldiers.every(s => s.hp === 120 && Number.isFinite(s.damageDealt)));
  totalsAgree(g);
});

test('v4 records: batch input ordering does not alter damage, killer or assists', () => {
  const a = createGame(29), b = createGame(29);
  const hits = [damage('red-0', 'blue-0', 40), damage('red-0', 'blue-1', 90), damage('blue-0', 'red-0', 999)];
  resolveDamage(a, hits); resolveDamage(b, [...hits].reverse());
  assert.deepEqual(a.records, b.records);
  assert.deepEqual(a.soldiers.map(s => [s.hp, s.damageDealt, s.kills]), b.soldiers.map(s => [s.hp, s.damageDealt, s.kills]));
  totalsAgree(a); totalsAgree(b);
});

test('v4 records: round replacement preserves cumulative records and a new campaign resets them', () => {
  const g = createGame(30);
  resolveDamage(g, g.soldiers.filter(s => s.team === 1).map(s => damage(s.id, 'blue-0', 999)));
  step(g, 1 / 60);
  assert.equal(g.status, 'ended');
  const records = structuredClone(g.records);
  assert.equal(g.records.teams[0].kills, 5);
  nextRound(g);
  assert.deepEqual(g.records, records);
  assert.ok(g.soldiers.every(s => s.alive && s.kills === 0));
  totalsAgree(g);
  const fresh = createGame(30);
  assert.ok(fresh.records.soldiers.every(s => s.kills === 0 && s.deaths === 0 && s.assists === 0 && s.environmentDeaths === 0));
  totalsAgree(fresh);
});

test('v4 records: save and resume retain recent assist evidence and settled cumulative totals', () => {
  const g = createGame(31);
  resolveDamage(g, [damage('red-0', 'blue-0', 10)]);
  let value = null;
  const storage = { getItem: () => value, setItem: (_, encoded) => { value = encoded; } };
  assert.equal(saveCampaign(g, storage).ok, true);
  const loaded = loadCampaign(storage);
  assert.equal(loaded.error, null); assert.deepEqual(loaded.game, g);
  for (const game of [g, loaded.game]) resolveDamage(game, [damage('red-0', 'blue-1', 999)]);
  assert.deepEqual(loaded.game.records, g.records);
  assert.equal(row(loaded.game, 'blue-0').assists, 1);
  assert.equal(row(loaded.game, 'blue-1').kills, 1);
  totalsAgree(loaded.game);
  assert.equal(saveCampaign(loaded.game, storage).ok, true);
  assert.deepEqual(loadCampaign(storage).game.records, g.records);
});

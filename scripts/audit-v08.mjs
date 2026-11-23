/** Independent natural-play audit. No deaths, locations, clocks or scores are injected. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createGame, step, nextRound, MAX_FIGHTER_HP } from '../dist/sim.js';
import { saveCampaign, loadCampaign, SAVE_KEY } from '../dist/persistence.js';
import { canOccupy } from '../dist/terrain.js';
import { MAX_MERIT } from '../dist/progression.js';

const output = new URL('../docs/evidence/v0.8-core-natural-audit.json', import.meta.url);
const started = performance.now();
const coreFiles = ['sim.js', 'relic.js', 'modifiers.js', 'match-rules.js', 'persistence.js', 'migration.js', 'content.js',
  'terrain.js', 'maps.js', 'formations.js', 'tactics.js', 'progression.js', 'mastery.js', 'environment.js', 'opponents.js'];
const sourceHashes = () => Object.fromEntries(coreFiles.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(new URL(`../dist/${file}`, import.meta.url))).digest('hex')]));
const report = { version: '0.8.0', generatedAt: new Date().toISOString(), node: process.version,
  coreSourceHashesStart: sourceHashes(),
  methodology: 'Natural fixed-tick simulation. Starting configuration only; no injected health, positions, score, kills, clock or settlement. State checked every 15 ticks and each Relic transition. Current checkpoint saved/loaded at every new phase in each round.',
  scope: { maps: ['crossroads', 'zigzag', 'craterfield'], sizes: ['small', 'medium', 'large'],
    teamCounts: [1, 5, 15], asymmetricTeams: [[1, 15], [15, 1], [3, 7], [7, 3]],
    modifiers: ['standard', 'saber_only'], environments: ['clear', 'fog', 'rain', 'sandstorm'] },
  scenarios: [], deterministicPairs: [], failures: [], totals: { rounds: 0, pickups: 0, drops: 0, deliveries: 0,
    resets: 0, contestedSamples: 0, carrierSamples: 0, roundTrips: 0, forceCasts: 0, saberSwings: 0 },
};
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const hash = g => crypto.createHash('sha256').update(JSON.stringify(g)).digest('hex');
const write = () => { report.elapsedSeconds = Math.round((performance.now() - started) / 1000); fs.mkdirSync(new URL('../docs/evidence/', import.meta.url), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); };
function checkpoint(g) {
  const mem = memory(), result = saveCampaign(g, mem); assert.equal(result.ok, true, result.error);
  const encoded = mem.getItem(SAVE_KEY); assert.equal(JSON.parse(encoded).rulesVersion, 8);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null); assert.deepEqual(loaded.game, g);
  assert.equal(mem.getItem(SAVE_KEY), encoded); report.totals.roundTrips++; return loaded.game;
}
function invariants(g) {
  assert.ok(g.tick <= g.config.roundDuration * 60); assert.equal(g.time, g.tick / 60);
  assert.ok(g.effects.length <= 160); assert.ok(g.events.length <= 32); assert.ok(g.history.length <= 50);
  for (const s of g.soldiers) {
    assert.ok(Number.isFinite(s.hp) && s.hp >= 0 && s.hp <= s.maxHp && s.maxHp <= MAX_FIGHTER_HP);
    assert.equal(s.alive, s.hp > 0); assert.ok(canOccupy(g.terrain, s), `collision ${g.seed}/${s.id}/${g.tick}`);
    assert.ok(s.energy >= 0 && s.energy <= 100); assert.ok(g.careers[s.team][s.lane].merit <= MAX_MERIT);
    if (g.config.modifier === 'saber_only') assert.notEqual(s.attack?.kind, 'force');
  }
  for (const team of [0, 1]) {
    const deaths = g.soldiers.filter(s => s.team === team && !s.alive).length;
    assert.equal(g.stats.deaths[team], deaths);
    assert.equal(g.stats.kills[1 - team], deaths - g.stats.environmentDeaths[team]);
  }
  if (g.config.modifier === 'saber_only') assert.deepEqual(g.stats.forceCasts, [0, 0]);
  if (g.config.matchMode !== 'relic') return;
  const o = g.objective; assert.equal(o.targetScore, 3); assert.equal(o.capture, 0);
  assert.ok(o.points.every(n => Number.isInteger(n) && n >= 0 && n <= 3));
  assert.ok(canOccupy(g.terrain, o), `inaccessible Relic ${g.seed}/${g.tick}`);
  if (o.state === 'carried') {
    const carrier = g.soldiers.find(s => s.id === o.carrierId);
    assert.ok(carrier?.alive); assert.equal(carrier.team, o.owner);
    assert.equal(o.x, carrier.x); assert.equal(o.y, carrier.y);
    assert.ok(carrier.dashUntil <= g.tick); report.totals.carrierSamples++;
  } else { assert.equal(o.owner, null); assert.equal(o.carrierId, null); }
  if (o.state === 'resetting') { assert.equal(o.x, o.home.x); assert.equal(o.y, o.home.y); }
  if (o.contested) report.totals.contestedSamples++;
}
function runRound(g) {
  let lastEvent = 0, phase = '', snapshots = new Set();
  const row = { round: g.round, events: [], pickups: 0, drops: 0, deliveries: 0, resets: 0, checkpointPhases: [] };
  invariants(g); checkpoint(g);
  while (g.status === 'playing') {
    step(g, 1 / 60);
    for (const event of g.events) if (event.id > lastEvent) {
      if (event.type.startsWith('relic-')) {
        row.events.push({ tick: g.tick, type: event.type, team: event.team, text: event.text });
        const metric = { 'relic-pickup': 'pickups', 'relic-drop': 'drops', 'relic-delivery': 'deliveries', 'relic-ready': 'resets' }[event.type];
        if (metric) { row[metric]++; report.totals[metric]++; }
      }
      lastEvent = Math.max(lastEvent, event.id);
    }
    const current = `${g.objective.state}/${g.objective.carrierId}`;
    if (g.tick % 15 === 0 || current !== phase || g.status === 'ended') invariants(g);
    if (current !== phase && !snapshots.has(current)) {
      checkpoint(g); snapshots.add(current); row.checkpointPhases.push({ tick: g.tick, phase: current });
    }
    phase = current;
  }
  const frozen = structuredClone(g); step(g, 150); assert.deepEqual(g, frozen); checkpoint(g);
  assert.equal(g.score[0] + g.score[1] + g.draws, g.round);
  Object.assign(row, { winner: g.winner, reason: g.reason, tick: g.tick, seconds: g.time, points: [...g.objective.points],
    survivors: [0, 1].map(team => g.soldiers.filter(s => s.team === team && s.alive).length),
    forceCasts: [...g.stats.forceCasts], saberSwings: [...g.stats.saberSwings], stateSha256: hash(g) });
  report.totals.rounds++; report.totals.forceCasts += g.stats.forceCasts.reduce((a, b) => a + b, 0);
  report.totals.saberSwings += g.stats.saberSwings.reduce((a, b) => a + b, 0); return row;
}

try {
  let index = 0;
  for (const terrain of report.scope.maps) for (const mapSize of report.scope.sizes)
    for (const count of report.scope.teamCounts) for (const modifier of report.scope.modifiers) {
      const environment = report.scope.environments[index % 4], seed = `v08-natural-${index++}`;
      const config = { terrain, mapSize, teamSizes: [count, count], modifier, environment, mode: 'spectate', matchMode: 'relic',
        roundDuration: 45, formations: ['wedge', 'spread'], targetPriorities: ['objective', 'balanced'] };
      const g = createGame(seed, config), scenario = { seed, config, rounds: [] }; report.scenarios.push(scenario);
      scenario.rounds.push(runRound(g)); write();
      console.log(`${index}/54 ${terrain}/${mapSize}/${count}/${modifier}: pickups=${scenario.rounds[0].pickups} deliveries=${scenario.rounds[0].deliveries} ${g.reason}`);
    }
  for (const teamSizes of report.scope.asymmetricTeams) for (const modifier of report.scope.modifiers) {
    const config = { terrain: 'craterfield', mapSize: 'large', teamSizes, modifier, environment: 'fog', mode: 'spectate', matchMode: 'relic', roundDuration: 45 };
    const seed = `v08-asymmetric-${teamSizes.join('-')}-${modifier}`, g = createGame(seed, config);
    const scenario = { seed, config, category: 'asymmetric', rounds: [runRound(g)] }; report.scenarios.push(scenario); write();
    console.log(`asymmetric ${teamSizes.join('v')}/${modifier}: pickups=${scenario.rounds[0].pickups} deliveries=${scenario.rounds[0].deliveries} ${g.reason}`);
  }
  // Longer natural campaigns cover repeated settlement, evolution and rule persistence.
  for (const [terrain, count, roundDuration, modifier] of [
    ['crossroads', 5, 90, 'standard'], ['zigzag', 15, 150, 'saber_only'], ['craterfield', 1, 90, 'saber_only'],
  ]) {
    const config = { terrain, mapSize: 'medium', teamSizes: [count, count], modifier, mode: 'spectate', matchMode: 'relic', roundDuration };
    const seed = `v08-endless-${terrain}`, g = createGame(seed, config), scenario = { seed, config, rounds: [] }; report.scenarios.push(scenario);
    for (let round = 0; round < 4; round++) {
      scenario.rounds.push(runRound(g)); const score = [...g.score], careers = structuredClone(g.careers), records = structuredClone(g.records), mastery = structuredClone(g.mastery);
      nextRound(g); assert.equal(g.round, round + 2); assert.deepEqual(g.score, score); assert.deepEqual(g.careers, careers);
      assert.deepEqual(g.records, records); assert.deepEqual(g.mastery, mastery); assert.deepEqual(g.objective.points, [0, 0]);
      assert.equal(g.objective.carrierId, null); assert.equal(g.objective.state, 'available'); checkpoint(g); write();
    }
    console.log(`campaign ${terrain}/${count}: ${scenario.rounds.reduce((n, r) => n + r.deliveries, 0)} deliveries across 4 natural rounds`);
  }
  // Independent seeds exercise full-round repeatability and mid-fight resume.
  for (const matchMode of ['control', 'elimination', 'relic']) {
    const config = { terrain: 'craterfield', mapSize: 'large', teamSizes: [15, 15], modifier: 'saber_only', environment: 'sandstorm', mode: 'spectate', matchMode, roundDuration: 45 };
    const seed = `v08-determinism-${matchMode}`, a = createGame(seed, config), b = createGame(seed, config);
    step(a, 4); for (let tick = 0; tick < 240; tick++) step(b, 1 / 60); assert.deepEqual(a, b);
    const resumed = checkpoint(a); step(a, 45); step(b, 45); step(resumed, 45);
    assert.deepEqual(a, b); assert.deepEqual(a, resumed); invariants(a); checkpoint(a);
    report.deterministicPairs.push({ seed, config, status: a.status, reason: a.reason, tick: a.tick, stateSha256: hash(a) }); write();
  }
  report.success = true;
} catch (error) {
  report.success = false; report.failures.push({ message: error.message, stack: error.stack });
  console.error(error); process.exitCode = 1;
} finally {
  report.coreSourceHashesEnd = sourceHashes();
  report.coreSourceUnchanged = JSON.stringify(report.coreSourceHashesStart) === JSON.stringify(report.coreSourceHashesEnd);
  if (!report.coreSourceUnchanged) { report.success = false; report.failures.push({ message: 'Core runtime changed during audit; rerun against stable source.' }); process.exitCode = 1; }
  write(); console.log(JSON.stringify({ success: report.success, coreSourceUnchanged: report.coreSourceUnchanged, ...report.totals, elapsedSeconds: report.elapsedSeconds, evidence: output.pathname }));
}

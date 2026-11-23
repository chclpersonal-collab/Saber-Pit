/** Actual-engine v0.7 release audit. Bounded natural rounds, not browser/performance certification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');
const hashes = directory => Object.fromEntries(readdirSync(directory).filter(n => n.endsWith('.js')).sort().map(n => [n, digest(readFileSync(resolve(directory, n)))]));
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const sum = values => values.reduce((n, x) => n + x, 0);
const round = n => Math.round(n * 1000) / 1000;

export async function auditV07({ source = 'dist', seed = 701, progress = false } = {}) {
  const directory = resolve(source), sourceHashes = hashes(directory);
  const engine = await import(pathToFileURL(resolve(directory, 'sim.js')));
  const persistence = await import(pathToFileURL(resolve(directory, 'persistence.js')));
  const terrain = await import(pathToFileURL(resolve(directory, 'terrain.js')));
  assert.deepEqual(hashes(directory), sourceHashes, 'source changed during module loading');
  const rows = [], failures = [], configs = [];
  for (const matchMode of ['control', 'elimination']) for (const roundDuration of [45, 90, 150]) for (const formation of ['line', 'wedge', 'spread']) for (const priority of ['balanced', 'nearest', 'weakest', 'objective']) {
    const index = configs.length;
    configs.push({ teamSizes: index % 12 === 0 ? [15, 15] : index % 3 === 0 ? [1, 15] : index % 3 === 1 ? [15, 1] : [3, 5], mapSize: ['small', 'medium', 'large'][index % 3], terrain: ['crossroads', 'zigzag', 'craterfield'][index % 3], environment: ['clear', 'fog', 'rain', 'sandstorm'][index % 4], mode: 'spectate', autoCommand: true, matchMode, roundDuration, formations: [formation, formation], targetPriorities: [priority, priority] });
  }
  for (const matchMode of ['control', 'elimination']) for (const roundDuration of [45, 90, 150]) {
    configs.push({ teamSizes: [15, 15], mapSize: 'small', terrain: 'crossroads', environment: 'rain', mode: 'spectate', autoCommand: true,
      matchMode, roundDuration, formations: ['wedge', 'spread'], targetPriorities: ['weakest', 'objective'], startingRanks: ['SSS+V', 'SSS+V'],
      startingSaberQuality: ['improved', 'improved'], startingForceFamily: ['force_burst', 'force_pulse'], startingForceQuality: ['improved', 'improved'] });
  }
  for (const [index, config] of configs.entries()) {
    const begin = performance.now(), g = engine.createGame(seed, config), mem = storage(); let collisions = 0;
    const check = () => {
      assert.equal(g.soldiers.length, sum(config.teamSizes));
      assert.equal(new Set(g.soldiers.map(s => s.id)).size, g.soldiers.length);
      for (const s of g.soldiers) {
        assert.ok([s.x, s.y, s.hp, s.energy, s.damageDealt].every(Number.isFinite));
        assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.energy >= 0 && s.energy <= s.maxEnergy && s.maxHp <= 171.600001); assert.equal(s.alive, s.hp > 0);
        if (!terrain.canOccupy(g.terrain, s)) collisions++;
      }
      for (const team of [0, 1]) for (const key of ['kills', 'deaths', 'assists', 'environmentDeaths']) assert.equal(g.records.teams[team][key], sum(g.records.soldiers.filter(s => s.team === team).map(s => s[key])));
      assert.equal(sum(g.records.teams.map(t => t.deaths)), sum(g.records.teams.map(t => t.kills + t.environmentDeaths)));
      assert.ok(g.events.length <= 32 && g.effects.length <= 160 && g.history.length <= 50);
      if (config.matchMode === 'elimination') { assert.deepEqual(g.objective.points, [0, 0]); assert.deepEqual(g.stats.objectiveTime, [0, 0]); }
    };
    try {
      engine.step(g, 1); check(); assert.equal(persistence.saveCampaign(g, mem).ok, true);
      const loaded = persistence.loadCampaign(mem); assert.equal(loaded.error, null); assert.deepEqual(loaded.game, g); const twin = loaded.game;
      while (g.status === 'playing') { engine.step(g, .5); check(); }
      engine.step(twin, config.roundDuration); assert.deepEqual(twin, g, 'active save continuation must be exact');
      assert.ok(g.tick <= config.roundDuration * 60); assert.equal(g.roundReport.mastery.length, sum(config.teamSizes));
      assert.equal(persistence.saveCampaign(g, mem).ok, true); assert.deepEqual(persistence.loadCampaign(mem).game, g, 'ended save round trip must be exact');
      const settled = structuredClone(g.mastery); engine.step(g, config.roundDuration); assert.deepEqual(g.mastery, settled);
      const outcome = { winner: g.winner, reason: g.reason, seconds: round(g.time), ticks: g.tick, damage: g.stats.damage.map(round), objective: g.objective.points.map(round), survivors: [0, 1].map(team => g.soldiers.filter(s => s.alive && s.team === team).length), commendations: g.roundReport.commendations, masteryRounds: sum(g.mastery.flat().map(m => sum(Object.values(m.forms).map(f => f.rounds)))) };
      const fingerprint = digest(JSON.stringify(g)); engine.nextRound(g); engine.nextRound(twin); assert.deepEqual(twin, g, 'resumed next-round transition must be exact'); assert.deepEqual(g.mastery, settled);
      assert.equal(persistence.saveCampaign(g, mem).ok, true); assert.deepEqual(persistence.loadCampaign(mem).game, g); check();
      rows.push({ index: index + 1, seed, config, ...outcome, collisions, outcomeFingerprint: fingerprint, wallMs: round(performance.now() - begin), status: 'passed' });
      if (collisions) failures.push({ index: index + 1, config, reason: `${collisions} illegal occupancy samples` });
    } catch (error) {
      const failure = { index: index + 1, config, reason: String(error.stack || error) }; failures.push(failure); rows.push({ ...failure, status: 'failed', wallMs: round(performance.now() - begin) });
    }
    if (progress) console.error(`${index + 1}/${configs.length} ${config.matchMode}/${config.roundDuration}s ${config.formations[0]}/${config.targetPriorities[0]} ${config.teamSizes.join('v')} ${rows.at(-1).status}`);
  }
  const sourceChangedDuringAudit = JSON.stringify(hashes(directory)) !== JSON.stringify(sourceHashes);
  return { generatedAt: new Date().toISOString(), sourceHashes, sourceChangedDuringAudit, protocol: { seed, rounds: configs.length, teamSizes: ['15v15', '1v15', '15v1', '3v5'], configurations: '72 core cases: both modes × three durations × three formations × four priorities; same tactics on both teams; map/size/weather rotate deterministically. Plus 6 maximum-rank/improved-gear 15v15 cases covering both modes and every duration.', checkpoints: 'Active after 1s, terminal round, and next-round state; exact deterministic continuation against unsaved twin', limitations: 'Bounded fixed-seed natural simulation coverage. Collision checks sample every 0.5s; exhaustive helper tests cover legal goals. Does not certify human balance, real browser rendering, accessibility or frame rate.' }, overall: { rounds: rows.length, passed: rows.filter(r => r.status === 'passed').length, failed: failures.length, timeoutRounds: rows.filter(r => r.seconds >= r.config.roundDuration).length, collisionSamples: sum(rows.map(r => r.collisions || 0)), wallMs: round(sum(rows.map(r => r.wallMs))) }, failures, rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...v] = arg.replace(/^--/, '').split('='); return [key, v.join('=')]; }));
  const report = await auditV07({ source: args.source || 'dist', seed: Number(args.seed || 701), progress: true });
  const output = resolve(args.output || 'docs/evidence/v0.7-natural-campaign-audit.json'); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ overall: report.overall, sourceChangedDuringAudit: report.sourceChangedDuringAudit, failures: report.failures, output }, null, 2));
  if (report.failures.length || report.sourceChangedDuringAudit) process.exitCode = 1;
}

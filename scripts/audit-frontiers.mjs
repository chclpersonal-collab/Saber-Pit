/** Actual-engine 15v15 terrain/weather audit. Deterministic evidence, not a balance guarantee. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const runtime = ['sim.js', 'content.js', 'progression.js', 'tactics.js', 'opponents.js', 'maps.js', 'environment.js', 'terrain.js'];
const digest = value => createHash('sha256').update(value).digest('hex');
const hashes = directory => Object.fromEntries(runtime.map(name => [name, digest(readFileSync(resolve(directory, name)))]));
const total = list => list.reduce((sum, value) => sum + value, 0);
const rounded = value => Math.round(value * 1000) / 1000;

export async function auditFrontiers({ samples = 1, startSeed = 211, maps = ['crossroads', 'zigzag', 'craterfield'], sizes = ['small', 'medium', 'large'], environments = ['clear', 'fog', 'rain', 'sandstorm'], source = 'dist', progress = false } = {}) {
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 20);
  const directory = resolve(source), sourceHashes = hashes(directory);
  const engine = await import(pathToFileURL(resolve(directory, 'sim.js')));
  const geometry = await import(pathToFileURL(resolve(directory, 'terrain.js')));
  assert.deepEqual(hashes(directory), sourceHashes, 'source changed during module loading');
  const forms = Object.keys(engine.FORMS), roster = Array.from({ length: 15 }, (_, i) => forms[i % forms.length]);
  const rows = [], failures = [];
  for (const terrain of maps) for (const mapSize of sizes) for (let sample = 0; sample < samples; sample++) for (const environment of environments) {
    const seed = startSeed + sample;
    const config = { terrain, mapSize, environment, teamSizes: [15, 15], mode: 'spectate', autoCommand: true, forms: [roster, roster], opponentMode: 'fixed' };
    const g = engine.createGame(seed, config), begin = performance.now();
    assert.equal(g.soldiers.length, 30);
    const travel = g.soldiers.map(() => 0), stuckRuns = g.soldiers.map(() => 0);
    let firstAttack = null, firstDamage = null, firstObjectivePresence = null, firstSaberHit = null;
    let priorDamage = 0, priorObjective = 0, inactiveTicks = 0, maxInactiveTicks = 0, longestStuckTicks = 0, stuckExample = null;
    let weatherTransitions = 0, phase = engine.getEnvironment(g).phase, collisions = 0, priorEffectId = 0;
    const outcomeCounts = {};
    for (let tick = 0; tick < 5400 && g.status === 'playing'; tick++) {
      const positions = g.soldiers.map(s => ({ x: s.x, y: s.y }));
      engine.step(g, 1 / 60);
      let movement = 0;
      for (let i = 0; i < g.soldiers.length; i++) {
        const s = g.soldiers[i], distance = Math.hypot(s.x - positions[i].x, s.y - positions[i].y);
        travel[i] += distance; if (s.alive) movement += distance;
        assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.hp), `${terrain}/${mapSize}/${environment}: nonfinite fighter`);
        assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.energy >= 0 && s.energy <= 100);
        assert.equal(s.alive, s.hp > 0);
        if (!geometry.canOccupy(g.terrain, s)) collisions++;
        const wantsMovement = s.alive && s.moving && !s.attack && !s.pinned && s.staggerUntil <= g.tick && Math.hypot(s.destinationX - s.x, s.destinationY - s.y) > 12;
        stuckRuns[i] = wantsMovement && distance < .02 ? stuckRuns[i] + 1 : 0;
        if (stuckRuns[i] > longestStuckTicks) {
          longestStuckTicks = stuckRuns[i];
          stuckExample = { id: s.id, tick: g.tick, x: rounded(s.x), y: rounded(s.y), goal: [rounded(s.destinationX), rounded(s.destinationY)], target: s.target, reason: s.tacticalReason };
        }
      }
      if (firstAttack === null && total(g.stats.forceCasts) + total(g.stats.saberSwings) > 0) firstAttack = g.time;
      const damage = total(g.stats.damage), objective = total(g.objective.points);
      if (firstDamage === null && damage > 0) firstDamage = g.time;
      if (firstObjectivePresence === null && total(g.objective.presence) > 0) firstObjectivePresence = g.time;
      if (firstSaberHit === null && total(g.stats.saberHits) > 0) firstSaberHit = g.time;
      const attemptingAdvance = g.playerOrder === 'advance' || g.enemyOrder === 'advance';
      inactiveTicks = attemptingAdvance && damage === priorDamage && objective === priorObjective && movement < .05 && !g.soldiers.some(s => s.alive && s.attack) ? inactiveTicks + 1 : 0;
      maxInactiveTicks = Math.max(maxInactiveTicks, inactiveTicks); priorDamage = damage; priorObjective = objective;
      const nextPhase = engine.getEnvironment(g).phase;
      if (nextPhase !== phase) { weatherTransitions++; phase = nextPhase; }
      for (const e of g.effects) {
        if (e.id <= priorEffectId) continue;
        if (e.type === 'feedback') outcomeCounts[e.outcome] = (outcomeCounts[e.outcome] || 0) + 1;
        priorEffectId = Math.max(priorEffectId, e.id);
      }
      assert.ok(g.effects.length <= 160 && g.events.length <= 32);
    }
    const wallMs = rounded(performance.now() - begin);
    assert.equal(g.status, 'ended'); assert.ok(g.time <= 90);
    const row = { seed, terrain, mapSize, environment, winner: g.winner, reason: g.reason, seconds: rounded(g.time),
      firstAttack: firstAttack === null ? null : rounded(firstAttack), firstDamage: firstDamage === null ? null : rounded(firstDamage), firstSaberHit: firstSaberHit === null ? null : rounded(firstSaberHit), firstObjectivePresence: firstObjectivePresence === null ? null : rounded(firstObjectivePresence),
      survivors: [0, 1].map(team => g.soldiers.filter(s => s.alive && s.team === team).length), damage: g.stats.damage.map(rounded), forceCasts: [...g.stats.forceCasts], forceHits: [...g.stats.forceHits], saberHits: [...g.stats.saberHits], objective: g.objective.points.map(rounded), environmentDeaths: [...g.stats.environmentDeaths],
      distanceTravelled: rounded(total(travel)), collisionSamples: collisions, longestStuckSeconds: rounded(longestStuckTicks / 60), stuckExample: longestStuckTicks >= 180 ? stuckExample : null, longestInactiveAdvanceSeconds: rounded(maxInactiveTicks / 60), weatherTransitions, outcomes: outcomeCounts,
      wallMs, msPerSimulationSecond: rounded(wallMs / g.time),
      outcomeFingerprint: digest(JSON.stringify({ winner: g.winner, tick: g.tick, stats: g.stats, objective: g.objective, soldiers: g.soldiers.map(s => [s.id, s.x, s.y, s.hp, s.energy]) })) };
    rows.push(row);
    if (collisions || maxInactiveTicks >= 600 || longestStuckTicks >= 600 || firstDamage === null) failures.push({ seed, terrain, mapSize, environment, collisionSamples: collisions, longestStuckSeconds: row.longestStuckSeconds, longestInactiveAdvanceSeconds: row.longestInactiveAdvanceSeconds, firstDamage });
    if (progress) console.error(`${rows.length}: ${terrain}/${mapSize}/${environment} seed=${seed} ${row.seconds}s winner=${row.winner} firstDamage=${row.firstDamage}s stuck=${row.longestStuckSeconds}s wall=${wallMs}ms`);
  }
  const comparisons = rows.filter(row => row.environment !== 'clear').map(row => {
    const clear = rows.find(other => other.seed === row.seed && other.terrain === row.terrain && other.mapSize === row.mapSize && other.environment === 'clear');
    return clear ? { seed: row.seed, terrain: row.terrain, mapSize: row.mapSize, environment: row.environment,
      changedOutcomeTrajectory: row.outcomeFingerprint !== clear.outcomeFingerprint, changedWinner: row.winner !== clear.winner,
      firstDamageDelta: row.firstDamage === null || clear.firstDamage === null ? null : rounded(row.firstDamage - clear.firstDamage),
      forceCastsDelta: total(row.forceCasts) - total(clear.forceCasts), damageDelta: rounded(total(row.damage) - total(clear.damage)), secondsDelta: rounded(row.seconds - clear.seconds) } : null;
  }).filter(Boolean);
  const summarize = list => ({ rounds: list.length, timeouts: list.filter(r => r.seconds >= 90).length, noDamageRounds: list.filter(r => r.firstDamage === null).length, collisions: total(list.map(r => r.collisionSamples)), longestStuckSeconds: Math.max(...list.map(r => r.longestStuckSeconds)), longestInactiveAdvanceSeconds: Math.max(...list.map(r => r.longestInactiveAdvanceSeconds)), meanFirstDamage: rounded(total(list.map(r => r.firstDamage ?? 90)) / list.length), meanSeconds: rounded(total(list.map(r => r.seconds)) / list.length), totalWallMs: rounded(total(list.map(r => r.wallMs))), meanMsPerSimulationSecond: rounded(total(list.map(r => r.wallMs)) / total(list.map(r => r.seconds))) });
  return { sourceHashes, sourceChangedDuringAudit: JSON.stringify(hashes(directory)) !== JSON.stringify(sourceHashes),
    protocol: { samples, startSeed, maps, sizes, environments, teamSizes: [15, 15], forms: roster, equipment: 'standard saber and Force push', commands: 'Both Auto, no manual support or artificial damage', pairing: 'Same seed and mirrored mixed-form roster across environments', limitations: 'A bounded deterministic natural-round suite, not human-play balance or exhaustive form/seed coverage. Headless audit timing includes invariant checks and does not certify browser frame rate. Stuck requires movement intent, a distant goal and almost no displacement; legitimate holding is excluded.' },
    overall: summarize(rows), byEnvironment: environments.map(environment => ({ environment, ...summarize(rows.filter(row => row.environment === environment)) })), comparisons, failures, rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...rest] = arg.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
  const options = { samples: Number(args.samples ?? 1), startSeed: Number(args.seed ?? 211), source: args.source || 'dist', progress: true };
  for (const [flag, key] of [['maps', 'maps'], ['sizes', 'sizes'], ['environments', 'environments']]) if (args[flag]) options[key] = args[flag].split(',');
  const report = await auditFrontiers(options);
  if (args.output) { const output = resolve(args.output); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
  console.log(JSON.stringify({ sourceHashes: report.sourceHashes, sourceChangedDuringAudit: report.sourceChangedDuringAudit, overall: report.overall, byEnvironment: report.byEnvironment, pairedTrajectoryChanges: report.comparisons.filter(c => c.changedOutcomeTrajectory).length, pairedWinnerChanges: report.comparisons.filter(c => c.changedWinner).length, failures: report.failures }, null, 2));
  if (report.failures.length || report.sourceChangedDuringAudit) process.exitCode = 1;
}

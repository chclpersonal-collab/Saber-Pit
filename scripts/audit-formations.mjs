/** Paired actual-engine squad formation audit. No synthetic damage or combat buffs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const modules = ['sim', 'content', 'progression', 'tactics', 'opponents', 'maps', 'environment', 'terrain', 'formations', 'mastery', 'match-rules'];
const digest = value => createHash('sha256').update(value).digest('hex');
const hashes = directory => Object.fromEntries(modules.map(name => [`${name}.js`, digest(readFileSync(resolve(directory, `${name}.js`)))]));
const sum = list => list.reduce((n, value) => n + value, 0);
const round = n => Math.round(n * 1000) / 1000;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const snapshot = g => g.soldiers.map(s => [s.id, s.x, s.y, s.destinationX, s.destinationY]);

export async function auditFormations({ source = 'dist', seed = 733, progress = false } = {}) {
  const directory = resolve(source), sourceHashes = hashes(directory);
  const engine = await import(pathToFileURL(resolve(directory, 'sim.js')));
  const geometry = await import(pathToFileURL(resolve(directory, 'terrain.js')));
  const perception = await import(pathToFileURL(resolve(directory, 'environment.js')));
  assert.deepEqual(hashes(directory), sourceHashes, 'source changed while importing runtime');
  const formations = ['line', 'wedge', 'spread'], maps = ['crossroads', 'zigzag', 'craterfield'], sizes = ['small', 'medium', 'large'];
  const environments = ['clear', 'fog', 'rain', 'sandstorm'];
  const formIds = Object.keys(engine.FORMS), roster = Array.from({ length: 15 }, (_, lane) => formIds[lane % formIds.length]);
  const configs = maps.flatMap((terrain, mapIndex) => sizes.map((mapSize, sizeIndex) => ({
    terrain, mapSize, environment: environments[(mapIndex * sizes.length + sizeIndex) % environments.length],
    teamSizes: [15, 15], mode: 'spectate', autoCommand: true, matchMode: 'control', roundDuration: 90,
    forms: [roster, roster], opponentMode: 'fixed', targetPriorities: ['balanced', 'balanced'],
  })));
  // Isolated direct-control probes run first, so an override fails quickly.
  // Formation changes, all strategic orders and nearby allies must not steer
  // an idle or moving player in any depth rank.
  const manualProbes = [];
  for (const config of configs) for (const moving of [false, true]) for (const order of ['hold', 'advance', 'retreat']) for (const playerSlot of [0, 7, 14]) {
    const baseline = engine.createGame(seed, { ...config, mode: 'play', playerSlot, autoCommand: false });
    baseline._nextAiDecision = 1e8; engine.command(baseline, order);
    const results = formations.map(formation => {
      const game = structuredClone(baseline); engine.setFormation(game, formation, 0);
      if (moving) engine.setPlayerInput(game, { moveY: .75 });
      engine.step(game, .5); const player = game.soldiers.find(s => s.id === game.control.soldierId);
      return [player.x, player.y, player.energy, player.destinationX, player.destinationY];
    });
    assert.deepEqual(results[1], results[0], `${config.terrain}/${config.mapSize}/${order}/slot${playerSlot}: wedge must not steer a manual fighter`);
    assert.deepEqual(results[2], results[0], `${config.terrain}/${config.mapSize}/${order}/slot${playerSlot}: spread must not steer a manual fighter`);
    manualProbes.push({ terrain: config.terrain, mapSize: config.mapSize, moving, order, playerSlot, matched: true });
  }
  if (progress) console.error(`${manualProbes.length} paired manual-control probes passed`);
  const rows = [], failures = [], routeProbes = [];
  for (const [index, config] of configs.entries()) {
    const pairedSeed = seed + index;
    // Start from exactly equal positions and change only formations at runtime.
    // Holding removes commander timing as a confounder in this one-second probe.
    const initial = engine.createGame(pairedSeed, { ...config, autoCommand: false });
    initial._nextAiDecision = 1e8;
    for (const formation of formations) {
      const game = structuredClone(initial), before = snapshot(game), rng = game.rngState;
      for (const team of [0, 1]) engine.setFormation(game, formation, team);
      assert.deepEqual(snapshot(game), before, 'setFormation must never teleport a live fighter');
      assert.equal(game.rngState, rng);
      engine.step(game, 1);
      const row = { terrain: config.terrain, mapSize: config.mapSize, environment: config.environment, formation,
        changedGoals: game.soldiers.filter((s, i) => distance({ x: s.destinationX, y: s.destinationY }, { x: before[i][3], y: before[i][4] }) > 1).length,
        movedFighters: game.soldiers.filter((s, i) => distance(s, { x: before[i][1], y: before[i][2] }) > 1).length,
        traveledFromIdenticalStart: round(sum(game.soldiers.map((s, i) => distance(s, { x: before[i][1], y: before[i][2] })))),
        routeFingerprint: digest(JSON.stringify(snapshot(game))), illegalOccupancy: game.soldiers.filter(s => !geometry.canOccupy(game.terrain, s)).length };
      routeProbes.push(row);
      assert.equal(row.illegalOccupancy, 0);
      if (formation !== 'line') { assert.ok(row.changedGoals > 0); assert.ok(row.movedFighters > 0); }
    }
    for (const formation of formations) {
      const game = engine.createGame(pairedSeed, { ...config, formations: [formation, formation] });
      const started = performance.now(), trajectory = createHash('sha256');
      let initialMinimumSeparation = Infinity, overlappingSpawnPairs = 0;
      for (let a = 0; a < game.soldiers.length; a++) for (let b = a + 1; b < game.soldiers.length; b++) {
        const separation = distance(game.soldiers[a], game.soldiers[b]); initialMinimumSeparation = Math.min(initialMinimumSeparation, separation);
        if (separation < geometry.UNIT_RADIUS * 2 - 1e-7) overlappingSpawnPairs++;
      }
      let collisions = game.soldiers.filter(s => !geometry.canOccupy(game.terrain, s)).length;
      let firstDamage = null, firstSaberHit = null, totalTravel = 0, longestStuckTicks = 0, stuckExample = null;
      let inactiveTicks = 0, maxInactiveTicks = 0, priorDamage = 0, priorObjective = 0, priorCapture = game.objective.capture, weatherTransitions = 0;
      let weatherPhase = engine.getEnvironment(game).phase, hiddenIntentTargets = 0, intentChecks = 0;
      const stuck = game.soldiers.map(() => 0), samples = [], overlapRuns = new Map();
      let severeOverlapSamples = 0, longestOverlapTicks = 0, overlapExample = null;
      for (let tick = 0; tick < 5400 && game.status === 'playing'; tick++) {
        const positions = game.soldiers.map(s => ({ x: s.x, y: s.y }));
        engine.step(game, 1 / 60);
        let movement = 0;
        for (const [i, soldier] of game.soldiers.entries()) {
          const traveled = distance(soldier, positions[i]); totalTravel += traveled; if (soldier.alive) movement += traveled;
          if (!geometry.canOccupy(game.terrain, soldier)) collisions++;
          assert.ok([soldier.x, soldier.y, soldier.hp, soldier.energy].every(Number.isFinite));
          const wantsMovement = soldier.alive && soldier.moving && !soldier.attack && !soldier.pinned && soldier.staggerUntil <= game.tick && distance(soldier, { x: soldier.destinationX, y: soldier.destinationY }) > 12;
          stuck[i] = wantsMovement && traveled < .02 ? stuck[i] + 1 : 0;
          if (stuck[i] > longestStuckTicks) {
            longestStuckTicks = stuck[i];
            stuckExample = { id: soldier.id, tick: game.tick, position: [round(soldier.x), round(soldier.y)], goal: [round(soldier.destinationX), round(soldier.destinationY)], target: soldier.target, reason: soldier.tacticalReason };
          }
        }
        for (let a = 0; a < game.soldiers.length; a++) for (let b = a + 1; b < game.soldiers.length; b++) {
          const first = game.soldiers[a], second = game.soldiers[b], key = `${a}:${b}`;
          const severe = first.alive && second.alive && distance(first, second) < geometry.UNIT_RADIUS * 1.5;
          const duration = severe ? (overlapRuns.get(key) || 0) + 1 : 0; overlapRuns.set(key, duration);
          if (severe) severeOverlapSamples++;
          if (duration > longestOverlapTicks) { longestOverlapTicks = duration; overlapExample = { first: first.id, second: second.id, tick: game.tick, distance: round(distance(first, second)) }; }
        }
        const damage = sum(game.stats.damage), objective = sum(game.objective.points);
        if (firstDamage === null && damage > 0) firstDamage = game.time;
        if (firstSaberHit === null && sum(game.stats.saberHits) > 0) firstSaberHit = game.time;
        // Taking an enemy-owned post changes capture before it earns points.
        // A stationary capturing squad is making progress, not stuck.
        inactiveTicks = (game.playerOrder === 'advance' || game.enemyOrder === 'advance') && damage === priorDamage && objective === priorObjective && game.objective.capture === priorCapture && movement < .05 && !game.soldiers.some(s => s.alive && s.attack) ? inactiveTicks + 1 : 0;
        maxInactiveTicks = Math.max(maxInactiveTicks, inactiveTicks); priorDamage = damage; priorObjective = objective; priorCapture = game.objective.capture;
        const nextPhase = engine.getEnvironment(game).phase; if (nextPhase !== weatherPhase) { weatherTransitions++; weatherPhase = nextPhase; }
        if (tick % 30 === 0) {
          trajectory.update(JSON.stringify(snapshot(game)));
          if (samples.length < 8) samples.push({ tick: game.tick, positions: game.soldiers.filter(s => s.lane === 0 || s.lane === 2).map(s => [s.id, round(s.x), round(s.y), round(s.destinationX), round(s.destinationY)]) });
          for (const soldier of game.soldiers.filter(s => s.alive)) {
            const targetId = engine.duelIntent(game, soldier).targetId, target = game.soldiers.find(s => s.id === targetId);
            intentChecks++;
            if (target && !perception.canPerceive(game.terrain, engine.getEnvironment(game), soldier, target)) hiddenIntentTargets++;
          }
        }
      }
      assert.equal(game.status, 'ended');
      const row = { seed: pairedSeed, terrain: config.terrain, mapSize: config.mapSize, environment: config.environment, formation,
        winner: game.winner, reason: game.reason, seconds: round(game.time), initialMinimumSeparation: round(initialMinimumSeparation), overlappingSpawnPairs,
        collisions, firstDamage: firstDamage === null ? null : round(firstDamage), firstSaberHit: firstSaberHit === null ? null : round(firstSaberHit),
        damage: game.stats.damage.map(round), saberHits: [...game.stats.saberHits], forceHits: [...game.stats.forceHits], objective: game.objective.points.map(round),
        survivors: [0, 1].map(team => game.soldiers.filter(s => s.alive && s.team === team).length),
        totalTravel: round(totalTravel), longestStuckSeconds: round(longestStuckTicks / 60), stuckExample: longestStuckTicks >= 60 ? stuckExample : null,
        longestInactiveAdvanceSeconds: round(maxInactiveTicks / 60), hiddenIntentTargets, intentChecks, weatherTransitions,
        severeOverlapSamples, longestSevereOverlapSeconds: round(longestOverlapTicks / 60), overlapExample: longestOverlapTicks >= 30 ? overlapExample : null,
        trajectoryFingerprint: trajectory.digest('hex'), samples, wallMs: round(performance.now() - started) };
      rows.push(row);
      if (collisions || overlappingSpawnPairs || hiddenIntentTargets || firstDamage === null || longestStuckTicks >= 600 || maxInactiveTicks >= 600 || longestOverlapTicks >= 600) failures.push(row);
      if (progress) console.error(`${rows.length}/27 ${row.terrain}/${row.mapSize}/${row.environment} ${formation}: ${row.seconds}s firstDamage=${row.firstDamage}s stuck=${row.longestStuckSeconds}s collisions=${collisions} wall=${row.wallMs}ms`);
    }
  }

  const comparisons = rows.filter(r => r.formation !== 'line').map(row => {
    const baseline = rows.find(b => b.seed === row.seed && b.formation === 'line');
    const route = routeProbes.find(r => r.terrain === row.terrain && r.mapSize === row.mapSize && r.formation === row.formation);
    const defaultRoute = routeProbes.find(r => r.terrain === row.terrain && r.mapSize === row.mapSize && r.formation === 'line');
    return { terrain: row.terrain, mapSize: row.mapSize, environment: row.environment, formation: row.formation,
      differentRoutesFromIdenticalPositions: route.routeFingerprint !== defaultRoute.routeFingerprint,
      differentNaturalTrajectory: row.trajectoryFingerprint !== baseline.trajectoryFingerprint,
      travelDelta: round(row.totalTravel - baseline.totalTravel), firstDamageDelta: round(row.firstDamage - baseline.firstDamage),
      damageDelta: round(sum(row.damage) - sum(baseline.damage)), durationDelta: round(row.seconds - baseline.seconds), changedWinner: row.winner !== baseline.winner };
  });
  assert.ok(comparisons.every(c => c.differentRoutesFromIdenticalPositions && c.differentNaturalTrajectory));
  return { generatedAt: new Date().toISOString(), sourceHashes, sourceChangedDuringAudit: JSON.stringify(hashes(directory)) !== JSON.stringify(sourceHashes),
    protocol: { seed, rounds: rows.length, teamSizes: [15, 15], configurations: 'Every map × every size × line/wedge/spread; weather rotates across all four environments; seed and mirrored mixed-form rosters held equal within each formation triple.',
      routeProbes: 'One-second hold probes start from identical line positions, change formation without teleporting, and measure resulting goals and real displacement.',
      limitations: 'Nine seed/map/size pairs and sampled weather coverage are not exhaustive balance evidence. Natural rounds check wall occupancy and movement every tick, visible-target intents every half second. A stall requires movement intent, a distant goal and displacement below 0.02 units per tick; deliberate holds are excluded. Global inactivity also requires no damage, points or capture-meter progress. Spawn overlap means centers closer than 18 units; severe live overlap means closer than 13.5 units, allowing brief compression from the bounded crowd-separation solver. This is a headless engine audit, not browser-frame-rate certification.' },
    overall: { rounds: rows.length, failed: failures.length, collisions: sum(rows.map(r => r.collisions)), overlappingSpawnPairs: sum(rows.map(r => r.overlappingSpawnPairs)),
      minimumSpawnSeparation: Math.min(...rows.map(r => r.initialMinimumSeparation)), hiddenIntentTargets: sum(rows.map(r => r.hiddenIntentTargets)), intentChecks: sum(rows.map(r => r.intentChecks)),
      longestStuckSeconds: Math.max(...rows.map(r => r.longestStuckSeconds)), longestInactiveAdvanceSeconds: Math.max(...rows.map(r => r.longestInactiveAdvanceSeconds)),
      severeOverlapSamples: sum(rows.map(r => r.severeOverlapSamples)), longestSevereOverlapSeconds: Math.max(...rows.map(r => r.longestSevereOverlapSeconds)),
      changedRoutes: comparisons.filter(c => c.differentRoutesFromIdenticalPositions).length, pairedComparisons: comparisons.length, manualProbes: manualProbes.length,
      wallMs: round(sum(rows.map(r => r.wallMs))) }, comparisons, failures, routeProbes, manualProbes, rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...rest] = arg.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
  const report = await auditFormations({ source: args.source || 'dist', seed: Number(args.seed || 733), progress: true });
  const output = resolve(args.output || 'docs/evidence/v0.7-formation-audit.json'); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ overall: report.overall, sourceChangedDuringAudit: report.sourceChangedDuringAudit, failures: report.failures.map(r => ({ terrain: r.terrain, mapSize: r.mapSize, formation: r.formation, longestStuckSeconds: r.longestStuckSeconds, stuckExample: r.stuckExample, collisions: r.collisions })), output }, null, 2));
  if (report.sourceChangedDuringAudit || report.failures.length) process.exitCode = 1;
}

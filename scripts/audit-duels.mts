import {runtimeDir} from './tool-runtime.mjs';
/** Side-swapped, same-seed form matchups. No per-form tuning or manual support. */
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

export async function loadEngine(directory: string = runtimeDir): Promise<ClassicAuditEngine> {
  const root = resolve(directory);
  const sourceHashes = Object.fromEntries(['sim.js', 'content.js', 'progression.js', 'tactics.js'].filter(name => existsSync(resolve(root, name))).map(name => [name, createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex')]));
  return { ...(await import(pathToFileURL(resolve(root, 'sim.js')))), content: await import(pathToFileURL(resolve(root, 'content.js'))), sourceHashes };
}
const tally = () => ({ starts: 0, resolved: 0, hits: 0, deathInterrupted: 0, staggerInterrupted: 0, targetInvalidated: 0, otherCancelled: 0, pendingAtEnd: 0 });
type DuelSetup = {seed:number;terrain:string;candidate:string;candidateTeam:0|1};
type ClassicAuditEngine = typeof import('../src/sim.js') & {content: typeof import('../src/content.js');sourceHashes: Record<string,string>};
export function forceResolutionBucket(effect: {type?:string;outcome?:string}) {
  if (effect.type !== 'force' || effect.outcome === 'interrupted') return null;
  return effect.outcome === 'target-lost' ? 'targetInvalidated' : 'resolved';
}

export function duel(engine: ClassicAuditEngine, { seed, terrain, candidate, candidateTeam }: DuelSetup) {
  const forms = ['shii_cho', 'shii_cho']; forms[candidateTeam] = candidate;
  const g = engine.createGame(seed, { terrain, form: forms[0], enemyForm: forms[1], doctrine: 'balanced', enemyDoctrine: 'balanced', autoCommand: true });
  const force = [tally(), tally()], active = new Map();
  let lastEffect = 0, minEnergy = 100, maxLock = 0;
  const locks = new Map();
  for (let frame = 0; frame < 5401 && g.status === 'playing'; frame++) {
    engine.step(g, 1 / 60);
    const effects = g.effects.filter(e => e.id > lastEffect);
    for (const e of effects) {
      if (e.type === 'telegraph' && e.kind === 'force') {
        force[e.team].starts++;
        assert.ok(!active.has(e.soldierId), 'one active Force windup per actor');
        active.set(e.soldierId, { team: e.team, target: e.targetId, startedTick: g.tick });
      }
      const resolution = forceResolutionBucket(e);
      if (resolution && active.has(e.soldierId)) {
        // v0.5 draws target-lost feedback; v0.4 removed that windup without a Force effect.
        // Keep the same semantic bucket for both versions.
        force[e.team][resolution]++;
        active.delete(e.soldierId);
      }
      lastEffect = Math.max(lastEffect, e.id);
    }
    for (const [id, cast] of active) {
      const actor = g.soldiers.find(s => s.id === id);
      if (actor.attack?.kind === 'force' && actor.attack.startedTick === cast.startedTick) continue;
      const target = g.soldiers.find(s => s.id === cast.target);
      const key = !actor.alive ? 'deathInterrupted' : actor.staggerUntil > g.tick ? 'staggerInterrupted' : !target?.alive ? 'targetInvalidated' : 'otherCancelled';
      force[cast.team][key]++; active.delete(id);
    }
    for (const s of g.soldiers) {
      assert.ok(Number.isFinite(s.hp) && s.hp >= 0 && s.hp <= s.maxHp && s.maxHp <= 158.401);
      assert.ok(Number.isFinite(s.energy) && s.energy >= 0 && s.energy <= 100);
      assert.ok(Number.isFinite(s.x) && s.x >= 0 && s.x <= 960 && Number.isFinite(s.y) && s.y >= 0 && s.y <= 540);
      assert.equal(s.alive, s.hp > 0);
      const lock = s.alive && s.staggerUntil > g.tick ? (locks.get(s.id) ?? 0) + 1 : 0;
      locks.set(s.id, lock); maxLock = Math.max(maxLock, lock); minEnergy = Math.min(minEnergy, s.energy);
    }
    assert.ok(g.effects.length <= 160 && g.events.length <= 32);
  }
  assert.equal(g.status, 'ended'); assert.ok(g.time <= 90);
  for (const cast of active.values()) force[cast.team].pendingAtEnd++;
  for (const team of [0, 1]) {
    force[team].hits = g.stats.forceHits[team];
    assert.equal(force[team].starts, g.stats.forceCasts[team], 'per-tick telegraphs account for every cast start');
    const { starts, hits, ...outcomes } = force[team];
    assert.equal(starts, Object.values(outcomes).reduce((a, b) => a + b, 0), 'every cast ends in exactly one outcome');
    for (const key of ['kills', 'deaths', 'assists', 'environmentDeaths']) {
      assert.equal(g.records.teams[team][key], g.records.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0));
    }
  }
  assert.ok(maxLock <= 39, `stagger exceeded .65 seconds: ${maxLock} ticks`);
  return { seed, terrain, candidate, candidateTeam, forms, winner: g.winner, candidateResult: g.winner === null ? 'draw' : g.winner === candidateTeam ? 'win' : 'loss', seconds: g.time, reason: g.reason, survivors: [0, 1].map(team => g.soldiers.filter(s => s.team === team && s.alive).length), kills: g.records.teams.map(r => r.kills), saberHits: g.stats.saberHits, force, minEnergy, maxStaggerTicks: maxLock };
}

export function summarize(rows: ReturnType<typeof duel>[]) {
  const force = tally();
  for (const row of rows) for (const team of row.force) for (const key of Object.keys(force)) force[key] += team[key];
  const wins = rows.filter(r => r.candidateResult === 'win').length, draws = rows.filter(r => r.candidateResult === 'draw').length;
  return { rounds: rows.length, wins, losses: rows.length - wins - draws, draws, candidateScoreRate: (wins + draws / 2) / rows.length, blueWins: rows.filter(r => r.winner === 0).length, redWins: rows.filter(r => r.winner === 1).length, meanSeconds: rows.reduce((sum, r) => sum + r.seconds, 0) / rows.length, maxSeconds: Math.max(...rows.map(r => r.seconds)), timeouts: rows.filter(r => r.seconds >= 90).length, force: { ...force, interruptionRate: (force.deathInterrupted + force.staggerInterrupted) / (force.starts || 1), noHitPerStartRate: (force.starts - force.hits) / (force.starts || 1) } };
}

export function auditDuels(engine: ClassicAuditEngine, samples = 20, onlyForm: string|null = null) {
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 100);
  assert.ok(onlyForm === null || Object.hasOwn(engine.content.FORMS, onlyForm));
  const rows = [], forms = onlyForm ? [onlyForm] : Object.keys(engine.content.FORMS), maps = engine.MAPS.map(m => m.id);
  for (const candidate of forms) for (const terrain of maps) for (let seed = 1; seed <= samples; seed++) {
    for (const candidateTeam of candidate === 'shii_cho' ? [0] : [0, 1]) rows.push(duel(engine, { seed, terrain, candidate, candidateTeam }));
  }
  const byForm = forms.map(form => ({ form, ...summarize(rows.filter(r => r.candidate === form)) }));
  const byMap = maps.map(terrain => ({ terrain, ...summarize(rows.filter(r => r.terrain === terrain)) }));
  const controls = rows.filter(r => r.candidate === 'shii_cho');
  return { sourceHashes: engine.sourceHashes, protocol: { samples, seeds: `1..${samples}`, baselineForm: 'shii_cho', equipment: 'standard Force push / standard saber', careers: 'F, zero XP', doctrines: ['balanced', 'balanced'], commands: 'both Auto; no manual support', forms, maps, swapped: 'Each nonbaseline form plays both colors with the same seed; identical-form controls run once.', limits: 'Deterministic seed suite, not independent random players. Aggregate opponent is Shii-Cho, not all-pairs or human play. No-hit starts include misses, range/target failures, interruptions and unfinished casts; they are not all avoidable waste.' }, overall: summarize(rows), defaultAutoControl: controls.length ? summarize(controls) : null, byForm, byMap, rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const samples = Number(process.argv[2] ?? 20), source = process.argv[3] ?? runtimeDir, output = process.argv[4], rawOutput = process.argv[5], onlyForm = process.argv[6] ?? null;
  const report = auditDuels(await loadEngine(source), samples, onlyForm);
  report.source = source;
  if (rawOutput) {
    const raw = JSON.stringify(report, null, 2) + '\n';
    mkdirSync(resolve(rawOutput, '..'), { recursive: true }); writeFileSync(rawOutput, raw);
    report.rawEvidence = { filename: basename(rawOutput), sha256: createHash('sha256').update(raw).digest('hex'), bytes: Buffer.byteLength(raw), storage: 'External QA artifact, outside the repository; reproduce with the fifth CLI argument.' };
  }
  if (output) { mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify({ ...report, rows: undefined }, null, 2) + '\n'); }
  console.log(JSON.stringify({ source, protocol: report.protocol, overall: report.overall, defaultAutoControl: report.defaultAutoControl, byForm: report.byForm }, null, 2));
}

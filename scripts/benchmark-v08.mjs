/** Reproducible Node-only engine timing. Not a browser FPS or speed claim.
 * Run once for each source, under similar host load:
 * node scripts/benchmark-v08.mjs --source=../baseline-v07/dist --output=docs/evidence/v0.8-browser/benchmark-baseline.json
 * node scripts/benchmark-v08.mjs --source=dist --output=docs/evidence/v0.8-browser/benchmark-final.json
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...rest] = arg.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
const source = path.resolve(args.source || 'dist');
const output = path.resolve(args.output || 'docs/evidence/v0.8-browser/benchmark-final.json');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries(fs.readdirSync(source).filter(n => n.endsWith('.js')).sort().map(n => [n, digest(fs.readFileSync(path.join(source, n)))]));
const sourceHashes = hashes(), { createGame, step } = await import(pathToFileURL(path.join(source, 'sim.js')));
const cases = [
  { seed: 42, teamSizes: [3, 3], mapSize: 'medium', terrain: 'crossroads', matchMode: 'control', environment: 'clear' },
  { seed: 701, teamSizes: [15, 15], mapSize: 'small', terrain: 'zigzag', matchMode: 'elimination', environment: 'rain' },
  { seed: 808, teamSizes: [15, 15], mapSize: 'large', terrain: 'craterfield', matchMode: 'control', environment: 'fog' },
];
const repetitions = 9, warmups = 2, samples = [];
function run() {
  const begin = performance.now(), outcomes = [];
  for (const config of cases) {
    const game = createGame(config.seed, { ...config, mode: 'spectate', autoCommand: true, roundDuration: 45 });
    for (let i = 0; i < 600; i++) step(game, 1 / 60);
    assert.equal(game.tick, 600, 'benchmark requires 600 actual ticks per case');
    outcomes.push({ seed: config.seed, tick: game.tick, rngState: game.rngState, status: game.status, health: game.soldiers.map(s => s.hp), positions: game.soldiers.map(s => [s.x, s.y]) });
  }
  return { milliseconds: performance.now() - begin, ticks: 1800, outcomeFingerprint: digest(JSON.stringify(outcomes)) };
}
for (let i = 0; i < warmups; i++) run();
for (let i = 0; i < repetitions; i++) samples.push(run());
assert.equal(new Set(samples.map(s => s.outcomeFingerprint)).size, 1, 'benchmark deterministic across repetitions');
assert.deepEqual(hashes(), sourceHashes, 'source changed during benchmark');
const sorted = samples.map(s => s.milliseconds).sort((a, b) => a - b), medianMs = sorted[Math.floor(sorted.length / 2)];
const report = {
  generatedAt: new Date().toISOString(), source, sourceHashes, status: 'completed',
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length },
  protocol: { cases, warmups, repetitions, ticksPerCase: 600, metric: 'Node wall time for creation plus 1800 fixed simulation ticks across three seeded cases' },
  medianMs, minMs: sorted[0], maxMs: sorted.at(-1), medianTicksPerSecond: 1800 / (medianMs / 1000), samples,
  limitations: 'Single shared Windows host, sequential runs, variable background load. Different source versions may implement different work. No browser rendering, input latency, memory-growth, balance or cross-device performance certification. A numeric difference alone is not an optimization claim.',
};
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, medianMs, minMs: report.minMs, maxMs: report.maxMs, fingerprint: samples[0].outcomeFingerprint }, null, 2));

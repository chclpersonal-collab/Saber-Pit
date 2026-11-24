/** Strategy/Force comparison audit. Numbers describe these seeds, not global balance. */
import assert from 'node:assert/strict';
import { createGame, MAPS } from '../dist/sim.js';
import { FORCE_POWERS } from '../dist/content.js';
import { configure, finishChecked } from './audit-saber.mjs';
const samples = Number(process.argv[2] ?? 10), mode = process.argv[3] ?? 'strategies';
assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 100);
assert.ok(['strategies', 'weapons', 'weapons-all'].includes(mode));
const strategies = [
  { name: 'Hold', order: 'hold', support: false },
  { name: 'Hold + Force', order: 'hold', support: true },
  { name: 'Advance', order: 'advance', support: false },
  { name: 'Advance + Force', order: 'advance', support: true },
  { name: 'Retreat + Force', order: 'retreat', support: true },
  { name: 'Auto', auto: true, support: false },
  { name: 'Auto + Force', auto: true, support: true },
];
const cases = mode === 'strategies' ? strategies : Object.values(FORCE_POWERS).filter(p => mode === 'weapons-all' || p.quality === 1).map(power => ({ name: power.name, power: power.id, auto: true, support: true }));
const summaries = [];
for (const terrain of MAPS) for (const strategy of cases) {
  const times = [], winners = [0, 0, 0];
  for (let seed = 1; seed <= samples; seed++) {
    const g = createGame(seed, { terrain: terrain.id, autoCommand: !!strategy.auto });
    configure(g, 'shii_cho', strategy.power ?? 'force_push'); finishChecked(g, strategy);
    times.push(g.time); winners[g.winner ?? 2]++;
  }
  summaries.push({ terrain: terrain.id, strategy: strategy.name, rounds: samples, wins: winners[0], losses: winners[1], draws: winners[2], maxSeconds: Math.max(...times), meanSeconds: times.reduce((a, b) => a + b, 0) / samples, capped: times.filter(t => t >= 90).length });
}
console.log(JSON.stringify({ mode, sampleCount: samples, summaries }, null, 2));

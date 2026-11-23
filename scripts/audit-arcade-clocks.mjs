/** Matched ranks, selected clocks and actual contact audit. No DOM or wall clock.
 * Usage: node scripts/audit-arcade-clocks.mjs [engine file] [seeds per form] [--json] [--single] [--progress]
 * To compare HEAD with local changes, extract baseline dist/ and package.json into
 * a temporary directory and pass its dist/arcade-engine.js to the same script.
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
const [enginePath, requestedSeeds] = args.filter(arg => !arg.startsWith('--'));
const engine = enginePath ? pathToFileURL(resolve(enginePath)) : new URL('../dist/arcade-engine.js', import.meta.url);
const {createArcade, stepArcade, ARCADE_FORM_IDS} = await import(engine);
const seedCount = Math.max(1, Math.min(64, Math.trunc(Number(requestedSeeds)) || 12));
const dual = !args.includes('--single');
const clocks = [45, 75, 90, 150], top = 'SSS+V', step = 1 / 30, epsilon = 1e-7;
const trials = [
  ['Elite duel', 1, top, top],
  ['Elite squads', 3, top, top],
  ['F duel', 1, 'F', 'F'],
  ['F squads', 3, 'F', 'F'],
  ['Elite vs F duel', 1, top, 'F'],
  ['Elite vs F squads', 3, top, 'F'],
];
const contactEvents = new Set(['hit', 'launch', 'block', 'parry', 'break']);
const stat = (state, key) => (state.stats[key] ?? [0, 0]).reduce((a, b) => a + b, 0);
const num = n => Number(n.toFixed(1));
function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return num(sorted[Math.floor((sorted.length - 1) * p)]);
}
function run({clock, size, rankA, rankB, form, seed}) {
  const s = createArcade({
    mode: 'watch', teamSizes: [size, size], seed, limit: clock, round: 1, form,
    teamForms: [Array(size).fill(form), Array(size).fill(form)],
    startingRanks: [rankA, rankB], startingDualSabers: [dual, dual],
    rule: 'elimination', terrain: 'underpit',
  });
  if (s.limit !== clock || s.fighters.length !== 2 * size || s.fighters.some(f => (
    f.form !== form || f.career.grade !== (f.team === 0 ? rankA : rankB) ||
    Boolean(f.gear?.dualSabers) !== dual
  ))) throw Error('Engine did not honor clock, rank, form, size or blade configuration');

  let seenId = 0, firstKo = null, firstContact = null, lastContact = 0, longestQuiet = 0;
  let offhandSwings = 0, offhandHits = 0;
  for (let i = 0; i < Math.ceil((clock + .1) / step) && s.phase === 'playing'; i++) {
    stepArcade(s, step);
    if (s.eventId === seenId) continue;
    if (s.events[0]?.id > seenId + 1) throw Error('Event buffer overflow: decrease audit step');
    for (const event of s.events) {
      if (event.id <= seenId) continue;
      seenId = event.id;
      if (event.kind === 'ko') firstKo ??= event.time;
      if (event.kind === 'slash' && event.offhand) offhandSwings++;
      if (contactEvents.has(event.kind)) {
        firstContact ??= event.time;
        longestQuiet = Math.max(longestQuiet, event.time - lastContact);
        lastContact = event.time;
        if ((event.kind === 'hit' || event.kind === 'launch') && event.offhand) offhandHits++;
      }
    }
  }
  if (s.phase === 'playing') throw Error('Round failed to end at configured clock');
  return {
    time: s.time,
    nearClock: s.time + epsilon >= .85 * clock,
    // Explicit reason avoids calling a last-tick KO a timeout.
    timeout: s.endReason === 'timeout',
    eliminated: s.endReason === 'elimination',
    draw: s.phase === 'draw', win: s.phase === 'won', firstKo, firstContact,
    quiet: Math.max(longestQuiet, s.time - lastContact),
    swings: stat(s, 'saberSwings'), hits: stat(s, 'saberHits'), offhandSwings, offhandHits,
    parries: stat(s, 'parries'), punishes: stat(s, 'punishes'),
    forceCasts: stat(s, 'forceCasts'), forceHits: stat(s, 'forceHits'),
  };
}
function summarize(runs) {
  const select = key => runs.map(run => run[key]);
  const count = key => runs.filter(run => run[key]).length;
  const mean = key => num(select(key).reduce((a, b) => a + b, 0) / runs.length);
  return {
    n: runs.length, s10: quantile(select('time'), .1), s50: quantile(select('time'), .5), s90: quantile(select('time'), .9),
    near85pc: num(100 * count('nearClock') / runs.length),
    timeouts: count('timeout'), eliminations: count('eliminated'), draws: count('draw'),
    blueWinPc: num(100 * count('win') / runs.length),
    noContact: runs.filter(run => run.firstContact === null).length,
    firstContactP50: quantile(select('firstContact').filter(x => x !== null), .5),
    firstKoP50: quantile(select('firstKo').filter(x => x !== null), .5),
    quietSecondsP90: quantile(select('quiet'), .9),
    swingsAvg: mean('swings'), hitsAvg: mean('hits'), offhandSwingsAvg: mean('offhandSwings'), offhandHitsAvg: mean('offhandHits'),
    parriesAvg: mean('parries'), punishesAvg: mean('punishes'),
    forceCastsAvg: mean('forceCasts'), forceHitsAvg: mean('forceHits'),
  };
}
const report = [];
for (const [trial, size, rankA, rankB] of trials) for (const clock of clocks) {
  const samples = ARCADE_FORM_IDS.map(form => ({
    form,
    runs: Array.from({length: seedCount}, (_, i) => run({clock, size, rankA, rankB, form, seed: i + 1})),
  }));
  const summary = summarize(samples.flatMap(x => x.runs));
  if (args.includes('--progress')) console.error(
    `${trial}, ${clock}s: ${summary.near85pc}% near clock, ${summary.timeouts}/${summary.n} timeouts, ${summary.quietSecondsP90}s p90 gap`);
  report.push({
    trial, clock, ...summary,
    byForm: Object.fromEntries(samples.map(({form, runs}) => [form, summarize(runs)])),
  });
}
if (args.includes('--json')) {
  console.log(JSON.stringify({seedsPerForm: seedCount, dual, clockTargetPct: 85, report}, null, 2));
} else {
  console.log(`AI vs AI · Underpit elimination · ${seedCount} seeds/form · ${dual ? 'dual' : 'single'} sabers`);
  console.table(report.map(({
    trial, clock, n, s50, near85pc, timeouts, blueWinPc, noContact, quietSecondsP90,
    swingsAvg, hitsAvg, offhandSwingsAvg, offhandHitsAvg, punishesAvg,
  }) => ({trial, clock, n, s50, near85pc, timeouts, blueWinPc, noContact, quietSecondsP90,
    swingsAvg, hitsAvg, offhandSwingsAvg, offhandHitsAvg, punishesAvg})));
}

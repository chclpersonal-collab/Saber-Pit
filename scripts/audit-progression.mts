/** Bounded deterministic stress; output is evidence, not a statistical balance claim. */
import assert from 'node:assert/strict';
import { createGame, step, nextRound, setDoctrine, DOCTRINES, MAPS, WEAPONS, KNIVES } from '../dist/sim.js';
import { createCareer, progressionSummary, MAX_MERIT, MAX_ROUND_MERIT } from '../dist/progression.js';

const rounds = Number(process.argv[2] ?? 60);
assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 200, 'round count must be an integer from 1 to 200');
const summaries = [];
let simulatedRounds = 0, maxHp = 0, maxMerit = 0, maxDuration = 0;
const doctrines = Object.keys(DOCTRINES);

function check(g) {
  assert.equal(g.soldiers.length, 10);
  assert.ok(g.history.length <= 50 && g.events.length <= 32 && g.effects.length <= 160);
  assert.ok(g.objective.capture >= -100 && g.objective.capture <= 100);
  for (const s of g.soldiers) {
    for (const key of ['x', 'y', 'hp', 'maxHp', 'morale', 'suppression', 'energy', 'attackCooldown', 'forceCooldown', 'objectiveSeconds', 'suppressionDealt']) assert.ok(Number.isFinite(s[key]), `${s.id}.${key}`);
    assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.maxHp <= 158.4);
    assert.equal(s.alive, s.hp > 0);
    assert.ok(s.x >= 0 && s.x <= 960 && s.y >= 0 && s.y <= 540);
    assert.ok(s.morale >= 0 && s.morale <= 100 && s.suppression >= 0 && s.suppression <= 100);
    assert.ok(s.energy >= 0 && s.energy <= 100 && s.attackCooldown >= 0 && s.forceCooldown >= 0);
    assert.ok(s.objectiveSeconds >= 0 && s.objectiveSeconds <= g.time + 1e-6 && s.suppressionDealt >= 0);
    assert.ok(WEAPONS[s.weapon] && KNIVES[s.meleeWeapon]);
    const merit = g.careers[s.team][s.lane].merit;
    assert.ok(Number.isInteger(merit) && merit >= 0 && merit <= MAX_MERIT);
    maxHp = Math.max(maxHp, s.maxHp); maxMerit = Math.max(maxMerit, merit);
  }
}

for (const terrain of MAPS) for (const initialDoctrine of doctrines) {
  const g = createGame(71, { terrain: terrain.id, doctrine: initialDoctrine, autoCommand: true });
  const trajectory = [], winners = [0, 0, 0];
  for (let round = 1; round <= rounds; round++) {
    const previous = structuredClone(g.careers);
    for (let second = 0; second <= g.roundDuration && g.status === 'playing'; second++) { step(g, 1); check(g); }
    assert.equal(g.status, 'ended');
    assert.ok(g.time <= g.roundDuration + 1 / 60);
    assert.equal(g.roundReport.careers.length, 10);
    for (const row of g.roundReport.careers) {
      assert.ok(row.earned >= 0 && row.earned <= MAX_ROUND_MERIT);
      assert.equal(row.after.merit, Math.min(MAX_MERIT, previous[row.team][row.lane].merit + row.earned));
    }
    winners[g.winner ?? 2]++;
    simulatedRounds++; maxDuration = Math.max(maxDuration, g.time);
    if (round === 1 || round % 10 === 0 || round === rounds) trajectory.push({ round, blue: g.careers[0].map(c => progressionSummary(c).grade), red: g.careers[1].map(c => progressionSummary(c).grade), merit: g.careers.flat().map(c => c.merit) });
    if (round < rounds) { nextRound(g); setDoctrine(g, doctrines[round % doctrines.length], 1); }
  }
  summaries.push({ terrain: terrain.id, initialDoctrine, rounds, blueWins: winners[0], redWins: winners[1], draws: winners[2], historySize: g.history.length, trajectory });
}

// Every standard family fights at the terminal grade on every map and doctrine.
for (const terrain of MAPS) for (const doctrine of doctrines) for (const weapon of Object.values(WEAPONS).filter(w => w.quality === 1)) {
  const g = createGame(2026, { terrain: terrain.id, doctrine, autoCommand: true });
  step(g, g.roundDuration);
  g.careers = g.careers.map(team => team.map(() => createCareer(MAX_MERIT)));
  nextRound(g);
  for (const s of g.soldiers) { s.weapon = weapon.id; s.meleeWeapon = 'saber'; }
  for (let second = 0; second <= g.roundDuration && g.status === 'playing'; second++) { step(g, 1); check(g); }
  assert.equal(g.status, 'ended');
  assert.ok(g.time <= g.roundDuration + 1 / 60);
  assert.ok(g.careers.flat().every(c => c.merit === MAX_MERIT));
  simulatedRounds++; maxDuration = Math.max(maxDuration, g.time);
}

console.log(JSON.stringify({ roundsPerCampaign: rounds, campaignCount: summaries.length, terminalGradeCases: MAPS.length * doctrines.length * 3, simulatedRounds, maxHp, maxMerit, maxDuration, summaries }, null, 2));

/** Reproducible bounded-combat audit, not a statistical claim that every form is equally strong. */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createGame, nextRound, step, command, setForm, MAPS, DOCTRINES, MAX_FIGHTER_HP } from '../dist/sim.js';
import { FORMS, FORCE_POWERS, SABERS } from '../dist/content.js';
import { MAX_MERIT } from '../dist/progression.js';

type ClassicGame = ReturnType<typeof import('../src/sim.js').createGame>;
type RecordKey = 'kills'|'deaths'|'assists'|'environmentDeaths';
export function assertHealthy(g: ClassicGame) {
  assert.equal(g.soldiers.length, 10);
  assert.ok(g.time >= 0 && g.time <= g.roundDuration + 1 / 60);
  assert.ok(g.history.length <= 50 && g.events.length <= 32 && g.effects.length <= 160);
  for (const s of g.soldiers) {
    for (const [field, value] of Object.entries(s)) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${s.id}.${field} finite`);
    assert.ok(s.x >= 0 && s.x <= 960 && s.y >= 0 && s.y <= 540);
    assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.maxHp <= MAX_FIGHTER_HP + .001);
    assert.equal(s.alive, s.hp > 0);
    assert.ok(s.energy >= 0 && s.energy <= 100);
    assert.equal(typeof s.guard, 'boolean');
    assert.ok(s.attackCooldown >= 0 && s.attackCooldown <= 10 && s.forceCooldown >= 0 && s.forceCooldown <= 10);
    assert.ok(s.guardUntil <= g.tick + 120 && s.staggerUntil <= g.tick + 39 && s.staggerImmuneUntil <= g.tick + 84);
    if (s.attack) {
      assert.ok(['saber', 'force'].includes(s.attack.kind) && FORMS[s.attack.form]);
      assert.ok(s.attack.startedTick <= g.tick && s.attack.resolveTick <= g.tick + 60);
      assert.ok(s.attack.kind === 'saber' ? SABERS[s.attack.weapon] : FORCE_POWERS[s.attack.weapon]);
    }
    assert.ok(s.morale >= 0 && s.morale <= 100 && s.suppression >= 0 && s.suppression <= 100);
    assert.ok(FORMS[s.form] && FORCE_POWERS[s.weapon] && SABERS[s.meleeWeapon]);
    assert.ok(Array.isArray(s.contributors) && s.contributors.length <= 160);
    const merit = g.careers[s.team][s.lane].merit;
    assert.ok(Number.isInteger(merit) && merit >= 0 && merit <= MAX_MERIT);
  }
  for (const team of [0, 1]) for (const key of ['kills', 'deaths', 'assists', 'environmentDeaths'] as const) {
    const total = g.records.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0);
    assert.ok(Number.isInteger(total) && total >= 0);
    assert.equal(g.records.teams[team][key], total);
  }
  const total = (key: RecordKey) => g.records.teams.reduce((sum, team) => sum + team[key], 0);
  assert.equal(total('deaths'), total('kills') + total('environmentDeaths'));
}

export function configure(g: ClassicGame, form: string, power = 'force_push') {
  for (const s of g.soldiers) {
    assert.equal(setForm(g, s.lane, form, s.team), true);
    s.weapon = power;
    s.meleeWeapon = Object.values(SABERS).find(saber => saber.quality === FORCE_POWERS[power].quality).id;
    g.loadouts[s.team].roster[s.lane] = { weapon: s.weapon, meleeWeapon: s.meleeWeapon };
  }
}

export function finishChecked(g: ClassicGame, { support = true, order }: {support?: boolean;order?: string} = {}) {
  if (order) command(g, order);
  for (let slice = 0; slice <= g.roundDuration * 4 && g.status === 'playing'; slice++) {
    if (support && slice % 8 === 0) { command(g, 'wave'); command(g, 'barrier'); }
    step(g, .25);
    assertHealthy(g);
  }
  assert.equal(g.status, 'ended');
  assert.ok(g.roundReport);
  const report = structuredClone(g.records);
  step(g, 90); command(g, 'wave');
  assert.deepEqual(g.records, report, 'ended rounds cannot award records again');
  return g;
}

export function auditSaber(samples = 2) {
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 20);
  const forms = Object.keys(FORMS), powers = Object.keys(FORCE_POWERS), doctrines = Object.keys(DOCTRINES);
  let checkedRounds = 0, maxSeconds = 0, maxHp = 0, maxMerit = 0;
  const outcomes = [];
  for (const terrain of MAPS) for (const form of forms) {
    const wins = [0, 0, 0]; let rounds = 0;
    for (const power of powers) for (let seed = 1; seed <= samples; seed++) {
      const g = createGame(seed, { terrain: terrain.id, autoCommand: true, doctrine: doctrines[seed % 3], enemyDoctrine: doctrines[(seed + 1) % 3] });
      configure(g, form, power); finishChecked(g);
      wins[g.winner ?? 2]++; rounds++; checkedRounds++;
      maxSeconds = Math.max(maxSeconds, g.time);
      maxHp = Math.max(maxHp, ...g.soldiers.map(s => s.maxHp));
    }
    const campaign = createGame(71, { terrain: terrain.id, autoCommand: true });
    configure(campaign, form);
    for (let round = 1; round <= 6; round++) {
      finishChecked(campaign); checkedRounds++;
      maxSeconds = Math.max(maxSeconds, campaign.time);
      maxHp = Math.max(maxHp, ...campaign.soldiers.map(s => s.maxHp));
      maxMerit = Math.max(maxMerit, ...campaign.careers.flat().map(c => c.merit));
      if (round < 6) {
        if (round === 3) campaign.careers.flat().forEach(career => { career.merit = MAX_MERIT; });
        nextRound(campaign);
        assert.ok(campaign.soldiers.every(s => s.form === form));
      }
    }
    outcomes.push({ terrain: terrain.id, form, rounds, blueWins: wins[0], redWins: wins[1], draws: wins[2] });
  }
  return { samples, forms: forms.length, forceVariants: powers.length, checkedRounds, campaignRounds: forms.length * MAPS.length * 6, maxSeconds, maxHp, maxMerit, outcomes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(auditSaber(Number(process.argv[2] ?? 2)), null, 2));
}

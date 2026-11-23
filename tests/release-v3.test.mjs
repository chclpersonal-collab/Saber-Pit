import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, nextRound, command, setAutoCommand, setDoctrine, DOCTRINES, MAPS, WEAPONS, KNIVES } from '../dist/sim.js';
import { createCareer, awardMerit, progressionSummary, meritForRound, MAX_MERIT, MAX_ROUND_MERIT, MAX_HEALTH_MULTIPLIER } from '../dist/progression.js';

function healthy(g) {
  assert.equal(g.soldiers.length, 10);
  for (const s of g.soldiers) {
    for (const key of ['x', 'y', 'hp', 'maxHp', 'suppression', 'morale', 'energy', 'attackCooldown', 'forceCooldown', 'objectiveSeconds', 'suppressionDealt']) {
      assert.ok(Number.isFinite(s[key]), `${s.id}.${key} is finite`);
    }
    assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.maxHp <= 132 * MAX_HEALTH_MULTIPLIER + 1e-6);
    assert.equal(s.alive, s.hp > 0);
    assert.ok(s.suppression >= 0 && s.suppression <= 100);
    assert.ok(s.morale >= 0 && s.morale <= 100);
    assert.ok(s.energy >= 0 && s.energy <= 100 && s.attackCooldown >= 0 && s.forceCooldown >= 0);
    assert.ok(s.objectiveSeconds >= 0 && s.objectiveSeconds <= g.time + 1e-6);
    assert.ok(s.suppressionDealt >= 0);
    assert.ok(WEAPONS[s.weapon] && KNIVES[s.meleeWeapon]);
    const merit = g.careers[s.team][s.lane].merit;
    assert.ok(Number.isInteger(merit) && merit >= 0 && merit <= MAX_MERIT);
  }
}

function finish(g) {
  for (let second = 0; second <= g.roundDuration && g.status === 'playing'; second++) {
    if (second % 8 === 0) command(g, 'wave');
    if (second % 12 === 0) command(g, 'barrier');
    step(g, 1);
    healthy(g);
  }
  assert.equal(g.status, 'ended');
  assert.ok(g.time <= g.roundDuration + 1 / 60);
  return g;
}

test('v3 release: doctrine input validation leaves invalid requests untouched', () => {
  const g = createGame(51, { doctrine: '__proto__', enemyDoctrine: 'constructor' });
  assert.deepEqual(g.doctrines, ['balanced', 'balanced']);
  const before = structuredClone(g);
  for (const id of [null, undefined, '', 'constructor', '__proto__', {}, [], 0]) assert.equal(setDoctrine(g, id), false);
  for (const team of [-1, 2, .5, '0', null, NaN, Infinity]) assert.equal(setDoctrine(g, 'guard', team), false);
  for (const value of [null, undefined, {}, 0]) assert.equal(setDoctrine(value, 'guard'), false);
  assert.deepEqual(g, before);
});

test('v3 release: doctrine switching preserves RNG, orders, Auto and career/equipment state', () => {
  const g = createGame(61);
  setAutoCommand(g, true);
  const before = structuredClone(g);
  for (const id of Object.keys(DOCTRINES)) assert.equal(setDoctrine(g, id), true);
  assert.equal(g.rngState, before.rngState);
  assert.equal(g.autoCommand, true);
  assert.equal(g.playerOrder, before.playerOrder);
  assert.equal(g.enemyOrder, before.enemyOrder);
  assert.deepEqual(g.careers, before.careers);
  assert.deepEqual(g.loadouts, before.loadouts);
  assert.deepEqual(g.soldiers, before.soldiers);
  assert.equal(g.squads[0].doctrine, 'guard');
  assert.ok(DOCTRINES.assault.moveMultiplier > 1 && DOCTRINES.assault.accuracyBonus < 0);
  assert.ok(DOCTRINES.guard.moveMultiplier < 1 && DOCTRINES.guard.suppressionMultiplier < 1);
});

test('v3 release: seeded three-round campaigns reproduce careers, equipment and reports on every map/doctrine', () => {
  function campaign(terrain, doctrine) {
    const g = createGame(2026, { terrain, doctrine, enemyDoctrine: 'guard', autoCommand: true });
    for (let round = 1; round <= 3; round++) {
      const before = structuredClone(g.careers);
      finish(g);
      assert.equal(g.roundReport.round, round);
      assert.equal(g.roundReport.careers.length, 10);
      for (const row of g.roundReport.careers) {
        assert.equal(row.before.merit, before[row.team][row.lane].merit);
        assert.equal(row.after.merit, g.careers[row.team][row.lane].merit);
        assert.ok(row.earned >= 0 && row.earned <= MAX_ROUND_MERIT);
      }
      const ended = structuredClone(g);
      step(g, 90); command(g, 'wave');
      assert.deepEqual(g, ended, 'settlement cannot repeat');
      if (round < 3) {
        const careers = structuredClone(g.careers);
        nextRound(g);
        assert.deepEqual(g.careers, careers, 'round transition preserves slot merit');
        assert.deepEqual(g.doctrines, [doctrine, 'guard']);
        for (const s of g.soldiers) assert.equal(s.career.merit, careers[s.team][s.lane].merit);
      }
    }
    return g;
  }
  for (const map of MAPS) for (const doctrine of Object.keys(DOCTRINES)) {
    assert.deepEqual(campaign(map.id, doctrine), campaign(map.id, doctrine));
  }
});

test('v3 release: replacement soldiers inherit slot careers while life XP resets', () => {
  const g = createGame(121);
  const casualty = g.soldiers[0];
  casualty.alive = false; casualty.hp = 0; casualty.xp = 200;
  g.careers[0][0] = createCareer(520);
  finish(g);
  const merit = g.careers[0][0].merit;
  nextRound(g);
  assert.equal(g.soldiers[0].xp, 0);
  assert.equal(g.soldiers[0].rank, 0);
  assert.equal(g.soldiers[0].career.merit, merit);
  assert.ok(merit >= 520);
  assert.deepEqual(createGame(121).careers, [Array.from({ length: 5 }, () => ({ merit: 0 })), Array.from({ length: 5 }, () => ({ merit: 0 }))]);
});

test('v3 release: capped SSS+V careers preserve bounded combat over repeated rounds', () => {
  const g = createGame(931, { doctrine: 'assault', enemyDoctrine: 'guard', autoCommand: true });
  finish(g);
  g.careers = g.careers.map(team => team.map(() => createCareer(MAX_MERIT)));
  for (let round = 0; round < 4; round++) {
    nextRound(g);
    for (const s of g.soldiers) {
      assert.equal(s.career.grade, 'SSS+V');
      assert.equal(s.career.progress, 1);
      assert.equal(s.maxHp, Math.round((120 + 4 * s.rank) * MAX_HEALTH_MULTIPLIER * 1000) / 1000);
    }
    finish(g);
    assert.ok(g.careers.flat().every(c => c.merit === MAX_MERIT));
  }
});

test('v3 release: malformed merit and inflated evidence cannot overflow career bounds', () => {
  for (const value of [NaN, Infinity, -Infinity, -42, '2400', null, undefined, {}, [], { merit: Infinity }]) {
    assert.deepEqual(createCareer(value), { merit: 0 });
    const summary = progressionSummary(value);
    assert.equal(summary.grade, 'F');
    assert.equal(summary.progress, 0);
  }
  const career = Object.freeze({ merit: 35 });
  assert.deepEqual(awardMerit(career, -900), career);
  assert.equal(awardMerit(career, Number.MAX_VALUE).merit, MAX_MERIT);
  assert.equal(career.merit, 35);
  const evidence = { damageDealt: Number.MAX_VALUE, kills: Number.MAX_VALUE, objectiveSeconds: Number.MAX_VALUE, suppressionDealt: Number.MAX_VALUE, survived: true, won: true };
  const earned = meritForRound(evidence);
  assert.ok(Number.isInteger(earned) && earned > 0 && earned <= MAX_ROUND_MERIT);
  assert.ok(meritForRound({ damageDealt: NaN, kills: -9, objectiveSeconds: Infinity, suppressionDealt: '999' }) <= 8);
});

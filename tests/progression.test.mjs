import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MERIT, MAX_ROUND_MERIT, SOLDIER_GRADES, createCareer, awardMerit,
  gradeForMerit, progressionModifiers, progressionSummary, meritForRound,
} from '../dist/progression.js';

test('new slot starts at F with neutral combat modifiers', () => {
  const career = createCareer();
  assert.deepEqual(career, { merit: 0 });
  assert.deepEqual(progressionSummary(career), {
    grade: 'F', gradeIndex: 0, merit: 0, nextGrade: 'E', nextThreshold: 35, progress: 0,
    modifiers: { healthMultiplier: 1, accuracyBonus: 0, reloadMultiplier: 1 },
  });
});

test('every named grade requires its threshold and has useful bounded bonuses', () => {
  assert.deepEqual(SOLDIER_GRADES.map(g => g.label), ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+', 'SSS+I', 'SSS+II', 'SSS+III', 'SSS+IV', 'SSS+V']);
  let previous = progressionModifiers(0);
  for (const grade of SOLDIER_GRADES) {
    assert.equal(gradeForMerit(grade.threshold), grade);
    if (grade.index) {
      assert.equal(gradeForMerit(grade.threshold - 1), SOLDIER_GRADES[grade.index - 1]);
      const bonus = progressionModifiers(grade.threshold);
      assert.ok(bonus.healthMultiplier > previous.healthMultiplier && bonus.healthMultiplier <= 1.3);
      assert.ok(bonus.accuracyBonus > previous.accuracyBonus && bonus.accuracyBonus <= .12);
      assert.ok(bonus.reloadMultiplier < previous.reloadMultiplier && bonus.reloadMultiplier >= .82);
      previous = bonus;
    }
  }
  assert.deepEqual(previous, { healthMultiplier: 1.3, accuracyBonus: .12, reloadMultiplier: .82 });
  assert.equal(Object.isFrozen(SOLDIER_GRADES), true);
  assert.equal(Object.isFrozen(SOLDIER_GRADES[0]), true);
});

test('career awards are immutable, deterministic, capped and never demote', () => {
  const prior = Object.freeze(createCareer(30));
  assert.deepEqual(awardMerit(prior, 10), { merit: 40 });
  assert.deepEqual(prior, { merit: 30 });
  assert.deepEqual(awardMerit(prior, -20), prior);
  assert.deepEqual(awardMerit(prior, 10.9), awardMerit(prior, 10));
  assert.deepEqual(awardMerit(createCareer(MAX_MERIT - 2), 180), { merit: MAX_MERIT });
  assert.deepEqual(awardMerit(createCareer(MAX_MERIT), 180), { merit: MAX_MERIT });
  assert.deepEqual(createCareer(1e100), { merit: MAX_MERIT });
});

test('malformed and nonfinite input never leaks NaN or invalid modifiers', () => {
  for (const bad of [undefined, null, NaN, Infinity, -Infinity, -1, '2400', {}, { merit: NaN }, []]) {
    assert.deepEqual(createCareer(bad), { merit: 0 });
    const summary = progressionSummary(bad);
    assert.equal(summary.grade, 'F');
    assert.equal(summary.progress, 0);
    assert.equal(summary.modifiers.healthMultiplier, 1);
  }
  for (const bad of [NaN, Infinity, -Infinity, null, '20', {}, -3]) {
    assert.deepEqual(awardMerit({ merit: 90 }, bad), { merit: 90 });
  }
  assert.equal(meritForRound(null), 0);
  assert.equal(meritForRound({ damageDealt: NaN, kills: Infinity, objectiveSeconds: -30, suppressionDealt: '50' }), 8);
});

test('combat, support, survival and victory all earn merit with anti-farming caps', () => {
  assert.equal(meritForRound({}), 8);
  assert.equal(meritForRound({ damageDealt: 100 }), 14);
  assert.equal(meritForRound({ kills: 1 }), 18);
  assert.equal(meritForRound({ objectiveSeconds: 10 }), 16);
  assert.equal(meritForRound({ suppressionDealt: 200 }), 13);
  assert.equal(meritForRound({ survived: true, won: true }), 38);
  const extreme = { damageDealt: 1e10, kills: 1e10, objectiveSeconds: 1e10, suppressionDealt: 1e10, survived: true, won: true };
  assert.equal(meritForRound(extreme), 175);
  assert.ok(meritForRound(extreme) <= MAX_ROUND_MERIT);
  assert.deepEqual(extreme, { damageDealt: 1e10, kills: 1e10, objectiveSeconds: 1e10, suppressionDealt: 1e10, survived: true, won: true });
});

test('progress resets at promotion and terminal grade has a full finite meter', () => {
  assert.equal(progressionSummary(35).progress, 0);
  assert.equal(progressionSummary(62).progress, 27 / 55);
  assert.deepEqual(progressionSummary(MAX_MERIT), {
    grade: 'SSS+V', gradeIndex: 14, merit: MAX_MERIT, nextGrade: null, nextThreshold: null, progress: 1,
    modifiers: { healthMultiplier: 1.3, accuracyBonus: .12, reloadMultiplier: .82 },
  });
});

test('a repeated campaign reaches all grades and stops at the career cap', () => {
  let career = createCareer();
  const seen = new Set(['F']);
  for (let round = 0; round < 200; round++) {
    career = awardMerit(career, meritForRound({ damageDealt: 120, survived: true, won: round % 2 === 0 }));
    seen.add(progressionSummary(career).grade);
  }
  assert.deepEqual([...seen], SOLDIER_GRADES.map(g => g.label));
  assert.equal(career.merit, MAX_MERIT);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_MAX_MERIT, MAX_MERIT, MAX_ROUND_MERIT, MAX_HEALTH_MULTIPLIER,
  SOLDIER_GRADES, createCareer, awardMerit, gradeForMerit, gradeDisplayLabel,
  progressionModifiers, progressionSummary, legacyProgressionSummary,
} from '../dist/progression.js';

const oldLabels = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+'];
const oldThresholds = [0, 35, 90, 180, 320, 520, 800, 1150, 1650, 2400];
const precise = value => Math.round(value * 1e6) / 1e6;

// An independent copy of the original numerical contract, rather than checking
// the new ladder against its own helper, protects existing campaign stats.
function originalSummary(merit) {
  merit = Math.floor(Math.max(0, Math.min(2400, merit)));
  let index = 0;
  for (let i = 0; i < oldThresholds.length; i++) if (merit >= oldThresholds[i]) index = i;
  const next = oldThresholds[index + 1], mastery = index / 9;
  return {
    grade: oldLabels[index], gradeIndex: index, merit,
    nextGrade: oldLabels[index + 1] ?? null, nextThreshold: next ?? null,
    progress: next ? (merit - oldThresholds[index]) / (next - oldThresholds[index]) : 1,
    modifiers: {
      healthMultiplier: precise(1 + mastery * .2), accuracyBonus: precise(mastery * .08),
      reloadMultiplier: precise(1 - mastery * .12),
    },
  };
}

test('v0.7 preserves every old threshold, grade index and combat modifier exactly', () => {
  assert.equal(LEGACY_MAX_MERIT, 2400);
  assert.deepEqual(SOLDIER_GRADES.slice(0, 10).map(g => g.label), oldLabels);
  assert.deepEqual(SOLDIER_GRADES.slice(0, 10).map(g => g.threshold), oldThresholds);
  for (let merit = 0; merit <= 2400; merit++) {
    const original = originalSummary(merit), modern = progressionSummary(merit);
    assert.deepEqual(legacyProgressionSummary(merit), original, `legacy snapshot at ${merit}`);
    assert.equal(modern.grade, original.grade);
    assert.equal(modern.gradeIndex, original.gradeIndex);
    assert.deepEqual(modern.modifiers, original.modifiers, `old combat modifiers at ${merit}`);
    if (merit < 2400) assert.deepEqual(modern, original);
  }
});

test('v0.7 exposes all six distinct SSS+ display ranks and finite thresholds', () => {
  const top = SOLDIER_GRADES.slice(9);
  assert.deepEqual(top.map(g => g.label), ['SSS+', 'SSS+I', 'SSS+II', 'SSS+III', 'SSS+IV', 'SSS+V']);
  assert.deepEqual(top.map(g => g.displayLabel), ['SSS+ (entry)', 'SSS+ I', 'SSS+ II', 'SSS+ III', 'SSS+ IV', 'SSS+ V']);
  assert.deepEqual(top.map(g => gradeDisplayLabel(g.label)), top.map(g => g.displayLabel));
  assert.deepEqual(top.map(g => g.threshold), [2400, 3000, 3600, 4400, 5200, 6000]);
  assert.equal(new Set(top.map(g => g.displayLabel)).size, 6);
  assert.equal(gradeDisplayLabel('F'), 'F');
  assert.equal(MAX_MERIT, 6000);
  assert.equal(MAX_ROUND_MERIT, 180);
  assert.equal(SOLDIER_GRADES.length, 15);
  assert.ok(SOLDIER_GRADES.every(Object.isFrozen));
});

test('v0.7 entry SSS+ progresses into I–V without changing its original stats', () => {
  assert.deepEqual(progressionSummary(2400), {
    grade: 'SSS+', gradeIndex: 9, merit: 2400, nextGrade: 'SSS+I', nextThreshold: 3000, progress: 0,
    modifiers: { healthMultiplier: 1.2, accuracyBonus: .08, reloadMultiplier: .88 },
  });
  for (const [index, grade] of SOLDIER_GRADES.entries()) {
    const startingCareer = createCareer(grade.threshold);
    // Choosing a grade only sets the merit floor. It cannot fabricate counters,
    // past battles, mastery, achievements, kills, or a promotion history.
    assert.deepEqual(startingCareer, { merit: grade.threshold });
    assert.equal(gradeForMerit(startingCareer), grade);
    if (index === SOLDIER_GRADES.length - 1) continue;
    const next = SOLDIER_GRADES[index + 1], before = progressionSummary(next.threshold - 1);
    assert.equal(before.grade, grade.label);
    assert.equal(before.nextGrade, next.label);
    assert.ok(before.progress >= 0 && before.progress < 1);
    const promoted = progressionSummary(awardMerit(createCareer(next.threshold - 1), 1));
    assert.equal(promoted.grade, next.label);
    assert.equal(promoted.progress, index === SOLDIER_GRADES.length - 2 ? 1 : 0);
  }
});

test('v0.7 each elite step has a unique bounded bonus and V is permanently capped', () => {
  const top = SOLDIER_GRADES.slice(9);
  const expected = [
    [1.2, .08, .88], [1.22, .088, .868], [1.24, .096, .856],
    [1.26, .104, .844], [1.28, .112, .832], [1.3, .12, .82],
  ];
  for (let i = 0; i < top.length; i++) {
    const [healthMultiplier, accuracyBonus, reloadMultiplier] = expected[i];
    assert.deepEqual(progressionModifiers(top[i].threshold), { healthMultiplier, accuracyBonus, reloadMultiplier });
  }
  assert.equal(MAX_HEALTH_MULTIPLIER, 1.3);
  for (const merit of [6000, 6001, 1e100, Number.MAX_VALUE]) {
    const summary = progressionSummary(merit);
    assert.equal(summary.grade, 'SSS+V');
    assert.equal(summary.merit, 6000);
    assert.equal(summary.nextGrade, null);
    assert.equal(summary.nextThreshold, null);
    assert.equal(summary.progress, 1);
    assert.deepEqual(summary.modifiers, { healthMultiplier: 1.3, accuracyBonus: .12, reloadMultiplier: .82 });
    assert.deepEqual(awardMerit(createCareer(merit), 180), { merit: 6000 });
  }
});

test('v0.7 legacy summaries retain old cap and are detached from modern snapshots', () => {
  for (const merit of [2400, 3000, 6000, Number.MAX_VALUE]) {
    assert.deepEqual(legacyProgressionSummary(merit), originalSummary(2400));
    assert.deepEqual(legacyProgressionSummary({ merit }), originalSummary(2400));
  }
  for (const bad of [null, undefined, NaN, Infinity, -Infinity, '6000', -1, {}, { merit: NaN }]) {
    assert.deepEqual(legacyProgressionSummary(bad), originalSummary(0));
  }
  const original = legacyProgressionSummary(2400);
  original.modifiers.healthMultiplier = 99;
  original.nextGrade = 'fake';
  assert.deepEqual(legacyProgressionSummary(2400), originalSummary(2400));
  assert.equal(progressionSummary(2400).nextGrade, 'SSS+I');
});

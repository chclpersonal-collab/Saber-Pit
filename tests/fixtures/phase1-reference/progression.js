/** Persistent slot careers. Independent of life XP, veteran rank and equipment. */
export const LEGACY_MAX_MERIT = 2400;
export const MAX_MERIT = 6000;
export const MAX_ROUND_MERIT = 180;
export const MAX_HEALTH_MULTIPLIER = 1.3;
const LEGACY_TOP_INDEX = 9;
const labels = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+', 'SSS+I', 'SSS+II', 'SSS+III', 'SSS+IV', 'SSS+V'];
const thresholds = [0, 35, 90, 180, 320, 520, 800, 1150, 1650, LEGACY_MAX_MERIT, 3000, 3600, 4400, 5200, MAX_MERIT];

/** Keep the existing SSS+ save identifier while making all six top ranks distinct. */
export function gradeDisplayLabel(label) {
  if (label === 'SSS+') return 'SSS+ (entry)';
  return typeof label === 'string' ? label.replace(/^SSS\+([IV]+)$/, 'SSS+ $1') : label;
}

export const SOLDIER_GRADES = Object.freeze(labels.map((label, index) =>
  Object.freeze({ label, displayLabel: gradeDisplayLabel(label), index, threshold: thresholds[index] })));
const legacyGrades = SOLDIER_GRADES.slice(0, LEGACY_TOP_INDEX + 1);

const bounded = (value, maximum) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(maximum, value)) : 0;
const meritValue = (value, maximum = MAX_MERIT) => Math.floor(bounded(
  value && typeof value === 'object' ? value.merit : value, maximum));
const precise = value => Math.round(value * 1e6) / 1e6;

/** Returns a fresh, serializable career; invalid or negative merit starts at F. */
export function createCareer(merit = 0) {
  return { merit: meritValue(merit) };
}

/** Awards are nonnegative integer merit. Never mutates the previous career. */
export function awardMerit(career, amount) {
  return createCareer(meritValue(career) + Math.floor(bounded(amount, MAX_MERIT)));
}

function gradeAtValue(value, grades = SOLDIER_GRADES) {
  for (let i = grades.length - 1; i >= 0; i--) {
    if (value >= grades[i].threshold) return grades[i];
  }
  return grades[0];
}

export function gradeForMerit(merit) {
  return gradeAtValue(meritValue(merit));
}

/** Snapshot at round spawn: original F–SSS+ bonuses never change. The five extra
 * grades add bounded bonuses, ending at +30% HP, +12pp aim and -18% reload.
 * Apply healthMultiplier to base HP plus the existing veteran HP bonus. */
export function progressionModifiers(careerOrMerit) {
  return modifiersForIndex(gradeForMerit(careerOrMerit).index);
}

/** Combat training is derived, never added to historical career/save snapshots.
 * Training changes execution and decisions, not health, raw damage or immunity.
 * Defense values are resources for a reacted, visible threat, not passive armor:
 * every block still needs eligibility, energy and a fallible contested roll. */
export function combatSkillProfile(careerOrMerit) {
  const index = Number.isInteger(careerOrMerit?.gradeIndex)
    ? Math.max(0, Math.min(14, careerOrMerit.gradeIndex)) : gradeForMerit(careerOrMerit).index;
  return COMBAT_SKILL_PROFILES[index];
}

function skillProfileForIndex(index) {
  const skill = index / 14;
  return Object.freeze({ rankIndex: index, skill,
    reactionTicks: Math.round(15 - 13 * skill), predictionSeconds: .02 + .20 * skill,
    parryWindowTicks: Math.round(3 + 6 * skill), parryBonus: .30 * skill,
    // Efficient motion sustains offense plus paid defense under real pressure.
    // Faster recovery still cannot skip a move's windup or spend absent energy.
    recoveryMultiplier: precise(1 - .36 * skill), energyEfficiency: precise(1 - .45 * skill),
    reserve: Math.round(4 + 14 * skill), comboLength: 1 + Math.floor(skill * 2),
    footwork: skill, discipline: skill,
    // A controlled saber action exposes less of a trained fighter's guard. Force
    // casting, airborne commitment and stagger keep their own defense limits.
    attackWindupMultiplier: precise(1 - .32 * skill),
    attackGuardRetention: precise(.94 * skill),
    defenseReadBonus: precise(.24 * skill),
    precisionBonus: precise(.22 * skill),
    threatCapacity: 1 + Math.floor(4 * skill),
    guardEnergyEfficiency: precise(1 - .52 * skill),
    // Composure prevents a crowd from pinning an expert through blocked chip
    // alone; neither incoming pressure nor chip damage ever becomes zero.
    pressureMultiplier: precise(1 - .45 * skill),
    pressureRecoveryMultiplier: precise(1 + .45 * skill),
    parryChipMultiplier: precise(1 - .70 * skill),
  });
}

// Rank is discrete and every field is derived. Share fifteen immutable values
// across the hot combat loop instead of allocating one for each threat/read.
const COMBAT_SKILL_PROFILES = Object.freeze(SOLDIER_GRADES.map(grade => skillProfileForIndex(grade.index)));

function modifiersForIndex(index) {
  const mastery = Math.min(index, LEGACY_TOP_INDEX) / LEGACY_TOP_INDEX;
  const eliteSteps = Math.max(0, index - LEGACY_TOP_INDEX);
  return {
    healthMultiplier: precise(1 + mastery * .20 + eliteSteps * .02),
    accuracyBonus: precise(mastery * .08 + eliteSteps * .008),
    reloadMultiplier: precise(1 - mastery * .12 - eliteSteps * .012),
  };
}

/** Settle once per completed round. Credit actual damage and effective pressure,
 * and only eligible objective presence. Category caps prevent farming/overkill. */
export function meritForRound(stats = {}) {
  if (!stats || typeof stats !== 'object') return 0;
  const combat = bounded(stats.damageDealt, 600) * .06 + bounded(stats.kills, 5) * 10;
  const support = bounded(stats.objectiveSeconds, 45) * .8 + bounded(stats.suppressionDealt, 600) * .025;
  const service = 8 + (stats.survived === true ? 12 : 0) + (stats.won === true ? 18 : 0);
  return Math.min(MAX_ROUND_MERIT, Math.round(combat + support + service));
}

export function progressionSummary(careerOrMerit) {
  return summaryAtValue(meritValue(careerOrMerit), SOLDIER_GRADES);
}

/** Exact original ladder for validating pre-extension save snapshots. It does
 * not award progress or invent historical records when an old campaign loads. */
export function legacyProgressionSummary(careerOrMerit) {
  return summaryAtValue(meritValue(careerOrMerit, LEGACY_MAX_MERIT), legacyGrades);
}

function summaryAtValue(merit, grades) {
  const grade = gradeAtValue(merit, grades), next = grades[grade.index + 1];
  return {
    grade: grade.label, gradeIndex: grade.index, merit,
    nextGrade: next?.label ?? null, nextThreshold: next?.threshold ?? null,
    progress: next ? (merit - grade.threshold) / (next.threshold - grade.threshold) : 1,
    modifiers: modifiersForIndex(grade.index),
  };
}


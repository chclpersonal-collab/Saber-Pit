// @ts-nocheck
/** Derived repertoire: saved Force equipment IDs and quality remain unchanged.
 * These bounded arena adaptations are not claims about canonical power levels. */
import { gradeForMerit } from './progression.js?v=1.4.0';
import { WEAPONS } from './content.js?v=1.4.0';

const lore = {
  force_push: ['Canon-inspired', 'A telekinetic push. Legacy burst and pulse equipment retain their original basic-cast tuning.', 'https://www.starwars.com/databank/force-push'],
  force_pull: ['Telekinesis adaptation', 'An arena pull that opens blade range; its distance, cost and rank unlock are game rules.', 'https://www.starwars.com/databank/the-force'],
  force_barrier: ['Defense adaptation', 'A short, exhaustible defensive field. This exact named barrier and absorption model are game rules.', 'https://www.starwars.com/databank/the-force'],
  force_throw: ['Film-inspired action', 'A thrown lightsaber with invented return timing and blade availability rules.', 'https://www.starwars.com/databank/lightsaber'],
  force_grip: ['Telekinesis adaptation', 'Brief suspension followed by a throw; no choking is portrayed. Control and release timing are game rules.', 'https://www.starwars.com/databank/the-force'],
  force_lightning: ['Canon dark-side ability', 'Force lightning is a dark-side ability. Rank-based access and energy-drain mechanics here are sandbox rules.', 'https://www.starwars.com/databank/force-lightning'],
  force_repulse: ['Radial-push adaptation', 'An arena expansion of telekinetic pushing into a short radial wave; no modern-canon status is claimed for these rules.', 'https://www.starwars.com/databank/force-push'],
  force_sweep: ['Telekinesis adaptation', 'A forward arc of telekinetic pressure. This move name, arc and rank unlock are original game rules.', 'https://www.starwars.com/databank/the-force'],
};

const ability = (id, name, minGrade, mechanic, tuning) => Object.freeze({
  id, name, minGrade, mechanic, energyDrain: 0, saberDelayTicks: 0,
  barrierTicks: 0, barrierReduction: 0, radius: 0, cone: 0,
  controlTicks: 0, releaseKnockback: 0,
  classification: lore[id][0], description: lore[id][1], source: lore[id][2], ...tuning,
});
export const FORCE_ABILITIES = Object.freeze(Object.fromEntries([
  ability('force_push', 'Force push', 0, 'push', { damage: 13, energyCost: 22, windup: .45, interval: 3.1, range: 420, stagger: .28, knockback: 28, counterplay: 'Guard or break line of sight during the visible windup.' }),
  ability('force_pull', 'Force pull', 4, 'pull', { damage: 7, energyCost: 24, windup: .50, interval: 3.4, range: 360, stagger: .16, knockback: -38, counterplay: 'Guard the pull or move behind cover; pulling creates a close-range opening for either fighter.' }),
  ability('force_barrier', 'Force barrier', 6, 'barrier', { damage: 0, energyCost: 30, windup: .30, interval: 5.2, range: 420, stagger: 0, knockback: 0, barrierTicks: 54, barrierReduction: .45, barrierEnergy: 22, counterplay: 'Pressure exhausts its finite absorption budget; wait out the short barrier.' }),
  ability('force_throw', 'Saber throw', 8, 'throw', { damage: 17, energyCost: 28, windup: .56, interval: 4.1, range: 340, stagger: .12, knockback: 4, saberDelayTicks: 40, counterplay: 'Dodge or guard the telegraphed throw; the caster briefly loses blade availability.' }),
  ability('force_grip', 'Force grip and release', 9, 'grip', { damage: 6, energyCost: 34, windup: .68, interval: 5.1, range: 270, stagger: .18, knockback: 0, controlTicks: 26, releaseKnockback: 42, counterplay: 'Interrupt the caster or break line of sight before release; guard prevents control.' }),
  ability('force_lightning', 'Force lightning', 10, 'lightning', { damage: 18, energyCost: 35, windup: .64, interval: 4.6, range: 310, stagger: .14, knockback: 0, energyDrain: 14, counterplay: 'Guard, move behind cover, or punish its long commitment and energy cost.' }),
  ability('force_repulse', 'Force repulse', 12, 'repulse', { damage: 9, energyCost: 40, windup: .42, interval: 5.8, range: 132, stagger: .24, knockback: 44, radius: 132, counterplay: 'Leave the short visible radius; guarding reduces impact and prevents displacement.' }),
  ability('force_sweep', 'Telekinetic sweep', 14, 'sweep', { damage: 10, energyCost: 36, windup: .46, interval: 4.9, range: 245, stagger: .22, knockback: 25, radius: 245, cone: Math.PI * .60, counterplay: 'Move outside the forward arc, close behind the caster, or guard.' }),
].map(entry => [entry.id, entry])));

export function forceAbilityById(id) { return Object.hasOwn(FORCE_ABILITIES, id) ? FORCE_ABILITIES[id] : null; }
function rankIndex(subject) {
  if (typeof subject === 'number') return Math.max(0, Math.min(14, Math.floor(subject)));
  return subject?.rankIndex ?? subject?.career?.gradeIndex ?? gradeForMerit(subject?.career ?? subject?.merit ?? 0).index;
}
export function forceRepertoire(subject = 0) {
  const rank = rankIndex(subject);
  return Object.values(FORCE_ABILITIES).filter(entry => rank >= entry.minGrade).map(entry => entry.id);
}

/** Deterministic tactical selection. Rotation only breaks equal tactical scores;
 * it never bypasses energy, range, rank, or the simulator's Force-rule gate.
 * The engine supplies the same combined form/training cost multiplier and
 * equipment used at commitment. Optional area counts describe visible enemies
 * inside each actual clear radius/arc, rather than assuming a crowd is in front. */
export function selectForceAbility(subject = {}, suppliedContext) {
  const context = suppliedContext ? { ...suppliedContext, rankIndex: rankIndex(subject), energy: subject.energy,
    formId: subject.form, sequence: subject.forceAbilitySequence ?? 0, lastAbility: subject.lastForceAbility } : subject;
  const distance = Number.isFinite(context.distance) ? context.distance : 0;
  const energy = Number.isFinite(context.energy) ? context.energy : 100;
  const count = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  const nearby = count(context.nearbyEnemies, 1);
  const repulseTargets = count(context.repulseTargets, nearby), sweepTargets = count(context.sweepTargets, nearby);
  const costMultiplier = Number.isFinite(context.forceCostMultiplier) && context.forceCostMultiplier > 0 ? context.forceCostMultiplier : 1;
  const candidates = forceRepertoire(context).map(forceAbilityById).filter(a => {
    const weapon = context.baseWeapon ? forceAbilityWeapon(context.baseWeapon, a.id) : a;
    return energy >= weapon.energyCost * costMultiplier && distance <= weapon.range &&
      !(a.mechanic === 'barrier' && context.barrierActive === true);
  });
  if (!candidates.length) return null;
  const score = a => {
    let result = 1;
    if (a.mechanic === 'push') result += distance < 85 ? 5 : 1;
    if (a.mechanic === 'pull') result += (distance > 110 && distance < 310 ? 5 : 0) - (nearby >= 2 && !context.enemyCarrier ? 5 : 0);
    if (a.mechanic === 'barrier') result += context.incomingAttack || context.incomingThreats > 0 ? 10 : -4;
    if (a.mechanic === 'throw') result += distance > 150 ? 5 : 0;
    if (a.mechanic === 'grip') result += context.targetRecovering || context.targetAirborne ? 8 : distance > 75 && distance < 250 ? 3 : 0;
    if (a.mechanic === 'lightning') result += context.targetGuarding ? 7 : distance > 150 ? 4 : 0;
    if (a.mechanic === 'repulse') result += repulseTargets >= 2 ? 12 + Math.min(3, repulseTargets - 2) * 2 : -3;
    if (a.mechanic === 'sweep') result += sweepTargets >= 2 ? 8 + Math.min(3, sweepTargets - 2) * 2 : 2;
    if (context.enemyCarrier) {
      if (['pull', 'grip'].includes(a.mechanic)) result += 14;
      if (a.mechanic === 'push') result -= 8;
    }
    if (context.formId === 'niman' && ['pull', 'grip'].includes(a.mechanic)) result += 1;
    if (a.id === context.lastAbility) result -= 3;
    return result;
  };
  const sequence = Math.max(0, Math.floor(context.sequence ?? 0));
  candidates.sort((a, b) => score(b) - score(a) ||
    ((Object.keys(FORCE_ABILITIES).indexOf(a.id) - sequence + 80) % 8) - ((Object.keys(FORCE_ABILITIES).indexOf(b.id) - sequence + 80) % 8));
  return candidates[0];
}

// Only the nine frozen catalog identities are shared: at most eight derived
// abilities each. Custom equipment, even frozen copies/accessors, stays fresh.
const derivedWeaponProfiles = new WeakMap(Object.values(WEAPONS).filter(base => Object.isFrozen(base)).map(base => [base, new Map()]));

/** Preserve legacy family tuning for basic casts and all pending pre-v9 casts. */
export function forceAbilityWeapon(baseWeapon, abilityId) {
  const a = forceAbilityById(abilityId);
  if (!a) return baseWeapon;
  const profiles = baseWeapon !== null && typeof baseWeapon === 'object' ? derivedWeaponProfiles.get(baseWeapon) : null;
  const cached = profiles?.get(a.id);
  if (cached) return cached;
  let profile;
  if (a.id === 'force_push') profile = { ...baseWeapon, abilityId: a.id, mechanic: a.mechanic };
  else {
    const quality = baseWeapon.quality ?? 1;
    const damageQuality = [0.86, 1, 1.14][quality] ?? 1;
    const timeQuality = [1.10, 1, .93][quality] ?? 1;
    profile = { ...baseWeapon, ...a, id: baseWeapon.id, family: baseWeapon.family, quality,
      abilityId: a.id, damage: a.damage * damageQuality, interval: a.interval * timeQuality,
      optimalRange: a.range * .65, suppression: Math.min(20, Math.max(4, a.damage)),
      accuracy: Math.min(.91, Math.max(.70, baseWeapon.accuracy ?? .82)) };
  }
  if (profiles) profiles.set(a.id, Object.freeze(profile));
  return profile;
}

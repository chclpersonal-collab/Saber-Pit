/** Original deterministic game tactics; form names do not imply canonical choreography. */
import { FORMS } from './content.js';

const DEFENSIVE = new Set(['soresu', 'shien', 'djem_so', 'vaapad']);
const CROWD_CONTROL = new Set(['force_repulse', 'force_sweep']);
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const nonnegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
const remaining = value => typeof value === 'number' && value >= 0 ? value : Infinity;

/**
 * Decide from an immutable, primitive snapshot. The engine owns target selection,
 * actual costs, geometry, cooldowns and mutation. threatKind/threatTicks describe
 * an attack aimed at this actor, not merely an enemy attacking someone else.
 * All timing fields use the engine's 60 Hz clock. enemyRecoveryTicks is the
 * earliest possible new enemy attack; enemyStaggerTicks is remaining stagger.
 * Missing recovery evidence never establishes a safe close Force opening.
 * targetVisible, saberLineOfSight and forceLineOfSight are engine observations;
 * omitted fields retain the unobstructed behavior of earlier scenario fixtures.
 * nearbyAllies excludes this actor. threatCount/secondaryThreatTicks count only
 * visible, reacted, legal attacks aimed at this actor; secondary excludes the
 * selected target. crowdRecoveryTicks is the earliest new attack by any OTHER
 * nearby visible enemy, not the selected target's recovery. Missing crowd
 * recovery is unsafe for a cast. saberWindupTicks includes the current move and
 * counter timing; forceControlTargets counts actual legal area recipients.
 * Movement applies only to local duels
 * and must never replace a retreat order or a strategic cover destination.
 */
export function chooseAction(context = {}) {
  const c = context && typeof context === 'object' ? context : {};
  const formId = typeof c.formId === 'string' && Object.hasOwn(FORMS, c.formId) ? c.formId : 'shii_cho';
  const form = FORMS[formId], defensive = DEFENSIVE.has(formId), mobile = formId === 'ataru';
  const energy = nonnegative(c.energy), distance = nonnegative(c.distance, Infinity);
  const saberRange = nonnegative(c.saberRange), forceRange = nonnegative(c.forceRange);
  const saberCost = Math.max(1, nonnegative(c.saberCost, 8));
  const guardCost = Math.max(.1, nonnegative(c.guardCost, form.blockCost));
  const forceCost = Math.max(1, nonnegative(c.forceCost, Infinity));
  const skill = Math.max(0, Math.min(1, finite(c.combatSkill, 0)));
  const reserve = Math.max(formId === 'juyo' ? 4 : formId === 'niman' ? 12 : Math.min(12, form.blockCost), nonnegative(c.energyReserve));
  const result = (action, reason, move = 'hold', dash = false) => ({ action, move, dash, reason, reserve, abilityId: c.forceAbilityId ?? null, ...(Number.isInteger(c.saberMoveIndex) ? { moveIndex: c.saberMoveIndex } : {}) });
  // Hidden actors must not supply a pursuit destination or an attack. With no
  // selected target, the engine still follows its public strategic objective.
  if (c.targetVisible === false) return result('wait', 'No visible target');
  if (!Number.isFinite(distance)) return result('wait', 'No reachable target');

  const inSaber = saberRange > 0 && distance <= saberRange;
  const inForce = forceRange > 0 && distance <= forceRange;
  const saberClear = c.saberLineOfSight !== false, forceClear = c.forceLineOfSight !== false;
  const canSaber = c.saberReady === true && inSaber && saberClear && energy >= saberCost;
  const forceAvailable = c.forceReady === true && inForce && forceClear && energy >= forceCost;
  const canGuard = energy >= guardCost;
  const threatTicks = finite(c.threatTicks, Infinity);
  const reacted = finite(c.threatAgeTicks, Infinity) >= nonnegative(c.reactionTicks);
  const incoming = reacted && ['saber', 'force'].includes(c.threatKind) && threatTicks >= 0 && threatTicks <= 24;
  const forceWindupTicks = Math.max(1, nonnegative(c.forceWindupTicks, Infinity));
  const enemySaberRange = nonnegative(c.enemySaberRange, saberRange);
  const closeEnemySaber = saberClear && distance <= enemySaberRange + 12;
  const recoveryTicks = Math.max(nonnegative(c.enemyRecoveryTicks), nonnegative(c.enemyStaggerTicks));
  const attackArrivesDuringCast = ['saber', 'force'].includes(c.threatKind) && threatTicks >= 0 && threatTicks <= forceWindupTicks;
  const recoveryOpening = closeEnemySaber && recoveryTicks > forceWindupTicks && !attackArrivesDuringCast;
  const canForce = forceAvailable && (formId !== 'niman' && skill < .28 || (!attackArrivesDuringCast && (!closeEnemySaber || recoveryOpening)));
  const unsafeRequestedCast = c.forceRequested === true && inSaber && incoming;
  const opening = c.enemyStaggered === true || nonnegative(c.enemyEnergy, 100) < 16;
  const canDash = c.dashReady === true && energy >= form.dashCost + saberCost + reserve && c.order !== 'retreat';

  // Being outnumbered changes positioning and timing, never the combat rules.
  // The counts are local perception, not the opposing roster or its ranks.
  const nearbyEnemies = nonnegative(c.nearbyEnemies), nearbyAllies = nonnegative(c.nearbyAllies);
  const crowded = skill >= .5 && nearbyEnemies >= 2 && nearbyEnemies > nearbyAllies + 1 && distance < 190 && c.order !== 'retreat';
  const saberWindupTicks = Math.max(1, remaining(c.saberWindupTicks));
  const secondaryThreatTicks = remaining(c.secondaryThreatTicks);
  const readThreatTicks = Math.min(reacted && ['saber', 'force'].includes(c.threatKind) ? remaining(c.threatTicks) : Infinity, secondaryThreatTicks);
  const crowdIncoming = crowded && readThreatTicks <= 24;
  const threatenedCommitment = crowded && readThreatTicks <= saberWindupTicks + 2;
  const crowdCastSafe = !crowded || (typeof c.crowdRecoveryTicks === 'number' &&
    c.crowdRecoveryTicks > forceWindupTicks && secondaryThreatTicks > forceWindupTicks);
  const safeForce = canForce && crowdCastSafe;
  const controlOpening = crowded && c.guardOrdered !== true && safeForce && CROWD_CONTROL.has(c.forceAbilityId) &&
    nonnegative(c.forceControlTargets) >= 2 && energy >= forceCost + reserve;

  // An earned, brief counter window is more valuable than a fresh slow cast.
  // A safe multi-target clearing cast is the exception; a second attacker can
  // also make a counter unsafe even when the selected enemy is recovering.
  // In a crowd, retain the cost of one real guard after a counter; spending
  // the last block on offense otherwise leaves the next opponent unanswered.
  if (c.counterReady === true && canSaber && !threatenedCommitment && !controlOpening && (!crowded || energy >= saberCost + guardCost)) return result('saber', 'Use counter opening');
  if (c.guardOrdered === true) return canGuard
    ? result('guard', 'Honor guard order')
    : result('recover', 'Recover energy for ordered guard', inSaber ? 'evade' : 'hold');
  if (controlOpening) return result('force', 'Clear multiple opponents during a safe opening');

  // Do not wait through a whole windup when a measured strike fits before it.
  // The two-tick margin prevents simultaneous-contact trades being called safe.
  if (crowdIncoming && canSaber && !threatenedCommitment && energy >= saberCost + reserve) {
    return result('saber', 'Strike before the next incoming attack');
  }
  if (crowdIncoming) {
    const lowReserve = energy < saberCost + reserve + guardCost;
    const multiple = nonnegative(c.threatCount) >= 2;
    if ((multiple || lowReserve) && canDash && readThreatTicks > 3) {
      return result(canGuard ? 'guard' : 'recover', 'Create room against overlapping attacks', 'evade', true);
    }
    if (!canGuard || lowReserve) return result(canGuard ? 'guard' : 'recover', 'Protect the remaining guard reserve', 'evade');
    return result('guard', readThreatTicks <= nonnegative(c.parryWindowTicks, 3) ? 'Parry while circling the crowd' : 'Circle outside overlapping attacks', 'circle');
  }
  // Read the visible windup before committing. The timing window scales with
  // training, but a late response, feint or second attacker can still beat it.
  if (incoming && skill >= .28 && canGuard) return result('guard',
    threatTicks <= nonnegative(c.parryWindowTicks, 3) ? 'Time parry at contact' : 'Read incoming windup', 'hold');
  if (incoming && mobile && canDash) return result('wait', 'Evade incoming attack', 'evade', true);
  if (incoming && (defensive || mobile)) return canGuard
    ? result('guard', 'Wait for incoming attack')
    : result('recover', 'Too exhausted to block', inSaber ? 'evade' : 'hold');

  // An explicit cast may spend the reserve, but an unavailable cast never locks
  // out a legal saber action. Defensive responses above still take precedence.
  if (c.forceRequested === true && safeForce && !unsafeRequestedCast) return result('force', 'Use requested Force cast');
  if (energy < saberCost + reserve) return result('recover', 'Rebuild attack and guard reserve', inSaber ? 'evade' : 'hold');

  if (formId === 'niman' && safeForce && !unsafeRequestedCast && energy >= forceCost + reserve && (opening || recoveryOpening || distance > saberRange * .9)) {
    return result('force', recoveryOpening ? 'Cast during enemy recovery' : opening ? 'Exploit opening with Force' : 'Maintain Force spacing');
  }
  if (canSaber) return result('saber', opening ? 'Punish exposed opponent' : c.comboReady ? 'Continue trained combination' : 'Commit saber attack');
  if (safeForce && energy >= forceCost + reserve && distance > saberRange + 18) return result('force', 'Cast across the gap');

  // A visible opponent can be across a low barricade: within saber distance
  // does not establish a legal strike. Do not idle in recovery/spacing loops
  // against blocked attack lines; let the engine route toward a clear angle.
  if (!saberClear || !forceClear) return result('wait', 'Find clear attack angle', c.order === 'retreat' ? 'hold' : 'close');

  if (crowded && c.saberReady !== true && distance <= saberRange + 18) return result(canGuard ? 'guard' : 'recover', 'Circle while the blade recovers', 'circle');

  // Ranged spacing must not cancel an advance toward the objective. Niman can
  // keep its casting distance when holding, and still strikes enemies who close.
  if (formId === 'niman' && inForce && distance > saberRange + 18) return c.order === 'advance'
    ? result('wait', 'Advance while Force recovers', 'close')
    : result('wait', 'Hold Force spacing');
  if (inSaber) return result(canGuard ? 'guard' : 'wait', 'Wait for saber recovery', skill >= .5 && !incoming && c.enemyRecoveryTicks < 8 && c.saberRecoveryTicks > 12 ? 'space' : 'hold');
  const dash = mobile && canDash && distance > saberRange * 1.4 && distance < 210 && c.order !== 'hold';
  return result('wait', dash ? 'Dash into saber range' : 'Close toward saber range', 'close', dash);
}


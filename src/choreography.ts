import type { FormMove, FormMotion } from './combat-forms.js';
import { formMoveById } from './combat-forms.js?v=1.4.0';
/** Original pose-to-pose choreography. This is presentation only: a blade pose
 * never creates a hit, extra range, a block, or an unrecorded combination. */
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const easeOutQuad = (p: number) => 1 - (1 - clamp(p)) ** 2;
const easeOutCubic = (p: number) => 1 - (1 - clamp(p)) ** 3;

/** Presentation phase only. The linear strike reaches contact (value 1) before
 * its 15% overshoot. No attack duration, hit tick, resource or RNG is changed. */
export function attackPresentationCurve(progress: number) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  return p < .35 ? easeOutQuad(p / .35) * -.25
    : p < .43 ? -.25 + 1.4 * ((p - .35) / .08)
      : 1.15 - .15 * easeOutCubic((p - .43) / .57);
}
export const PRESENTATION_CONTACT_PHASE = .35 + .08 * (1.25 / 1.4);
const ANTICIPATION_END = .35 / PRESENTATION_CONTACT_PHASE;
// Map the immutable windup to exact contact, then the existing retained swing
// to the rest of the curve. This is deliberately not a new gameplay clock:
// varying authoritative windups keep their original duration. The 35/8/57
// proportions describe curve phase; contact cannot be delayed to fit a movie.
export function attackPresentationPhase(progress: number, recovering = false) {
  const p = clamp(progress);
  return recovering ? mix(PRESENTATION_CONTACT_PHASE, 1, p) : p * PRESENTATION_CONTACT_PHASE;
}
const READY = Object.freeze({ sweep: -.7, thrust: -.12, orbit: -1.35, leap: -1.9,
  redirect: -1.1, cleave: -1.65, weave: .45, flurry: -.45, riposte: .9 });

// Separate depth-plane yaw from screen-plane pitch. A horizontal cut must not
// feed its azimuth through sin(angle) as vertical blade movement.
function bladeOrientation(plane: string, arc: number, aim: number) {
  if (plane === 'horizontal') return { yaw: arc, pitch: aim };
  if (plane === 'vertical') return { yaw: 0, pitch: aim + arc };
  if (plane === 'thrust') return { yaw: arc * .6, pitch: aim + arc * .15 };
  const across = Math.cos(arc), lift = Math.sin(arc) * Math.SQRT1_2;
  const x = across * Math.cos(aim) - lift * Math.sin(aim);
  const y = across * Math.sin(aim) + lift * Math.cos(aim);
  return { yaw: Math.atan2(lift, x), pitch: Math.asin(Math.max(-1, Math.min(1, y))) };
}
type Orientation = { yaw: number; pitch: number };
const blendOrientation = (a: Orientation, b: Orientation, t: number) => ({ yaw: mix(a.yaw, b.yaw, t), pitch: mix(a.pitch, b.pitch, t) });
const putOrientation = (pose: Pose, main: Orientation, off: Orientation) => {
  pose.bladeYaw = main.yaw; pose.bladePitch = main.pitch;
  pose.offBladeYaw = off.yaw; pose.offBladePitch = off.pitch;
};

interface Pose {
  phase: string; angle: number; offAngle: number; extension: number; lean: number; crouch: number;
  trail: number; offhandActive: boolean; depth: number; footwork: number; bodyRoll: number; twist: number;
  handHeight: number; plane: string; direction: number; path: string; bladeYaw: number; bladePitch: number;
  offBladeYaw: number; offBladePitch: number; swingProgress: number; motionWeight: number;
}
interface PoseEvent {form?: string; moveId?: string | null; tick: number; offhand?: boolean; outcome?: string}
interface PoseAttack {
  kind: string; startedTick: number; resolveTick: number; offhandResolveTick?: number;
  form?: string; moveId?: string | null; offhand?: boolean;
}
interface CombatPoseInput {
  fighter?: {guard?: boolean; attack?: PoseAttack | null; form?: string; staggerUntil?: number; comboUntil?: number};
  tick?: number; swing?: PoseEvent | null; block?: {tick: number} | null;
  motion?: FormMotion; move?: FormMove | null; dual?: boolean; reducedMotion?: boolean; aimAngle?: number;
}
export function sampleCombatPose({ fighter = {}, tick = 0, swing = null, block = null,
  motion = 'sweep', move = null, dual = false, reducedMotion = false, aimAngle = 0 }: CombatPoseInput = {}): Pose {
  const record = fighter.attack?.kind === 'saber' ? fighter.attack : swing;
  const authored = move || formMoveById(record?.form || fighter.form, record?.moveId!);
  const animation = authored?.animation;
  motion = authored?.motion || motion;
  const direction = animation?.direction ?? 1;
  const ready = fighter.guard ? -1.4 : READY[motion] ?? READY.sweep;
  const pose = { phase: fighter.guard ? 'guard' : 'ready', angle: ready, offAngle: -1.85,
    extension: 0, lean: 0, crouch: 0, trail: 0, offhandActive: false, depth: 0, footwork: 0, bodyRoll: 0, twist: 0, handHeight: 0, plane: animation?.plane || 'horizontal', direction, path: animation?.path || motion } as Pose;
  putOrientation(pose, { yaw: 0, pitch: ready }, { yaw: 0, pitch: -1.85 });
  pose.swingProgress = 0; pose.motionWeight = 0;
  if (fighter.staggerUntil! > tick) return { ...pose, phase: 'stagger', lean: reducedMotion ? 0 : -3, angle: -.15, bladePitch: -.15, crouch: reducedMotion ? 0 : 2 };
  if (block && tick - (block.tick ?? tick - 30) >= 0 && tick - (block.tick ?? tick - 30) < 10 && !fighter.attack) {
    const recoil = reducedMotion ? 0 : 1 - ease((tick - block.tick) / 10);
    return { ...pose, phase: 'parry', angle: -1.4, offAngle: -.9, bladePitch: -1.4, offBladePitch: -.9, lean: -2 * recoil, crouch: 2 * recoil };
  }
  const attack = fighter.attack;
  if (attack?.kind === 'force') {
    const p = reducedMotion ? 0 : ease((tick - attack.startedTick) / Math.max(1, attack.resolveTick - attack.startedTick));
    return { ...pose, phase: 'force', extension: 3 + p * 4, angle: -1.9, offAngle: -2.2, bladePitch: -1.9, offBladePitch: -2.2, lean: p * 2 };
  }
  if (attack?.kind === 'saber') {
    const startTick = attack.offhand === true ? (attack.offhandResolveTick ?? attack.resolveTick) - 7 : attack.startedTick;
    const contactTick = attack.offhand === true ? (attack.offhandResolveTick ?? attack.resolveTick) : attack.resolveTick;
    const p = clamp((tick - startTick) / Math.max(1, contactTick - startTick));
    const offhand = dual && attack.offhand === true;
    const chamber = offhand ? aimAngle - direction * 1.3 : animation ? aimAngle + animation.chamber : ready - (motion === 'thrust' ? .2 : .65), contact = aimAngle;
    // A returning cut starts from the previous real follow-through, linking the
    // silhouette across combo steps without inventing additional contacts.
    const linked = swing && startTick >= swing.tick && startTick - swing.tick < 22 && fighter.comboUntil! > startTick;
    const previousPose = linked ? sampleCombatPose({ fighter: { ...fighter, attack: null }, tick: startTick, swing, motion, dual, aimAngle }) : null;
    const start = offhand ? aimAngle - direction * .95 : linked ? previousPose!.angle : ready;
    const anticipation = easeOutQuad(p / ANTICIPATION_END);
    const strike = p >= 1 ? 1 : clamp((attackPresentationCurve(attackPresentationPhase(p)) + .25) / 1.25);
    pose.phase = p < ANTICIPATION_END ? 'anticipation' : 'strike';
    pose.angle = p < ANTICIPATION_END ? mix(start, chamber, anticipation) : mix(chamber, contact, strike);
    const pointAttack = animation?.plane === 'thrust' || motion === 'thrust';
    const chamberExtension = pointAttack ? -3 : -2;
    pose.extension = p < ANTICIPATION_END ? mix(0, chamberExtension, anticipation) : mix(chamberExtension, pointAttack ? 10 : 6, strike);
    const pulse = Math.sin(p * Math.PI);
    pose.lean = p < ANTICIPATION_END ? mix(previousPose?.lean ?? 0, -3, anticipation) : mix(-3, animation?.lean ?? 4, strike);
    pose.crouch = pulse * (animation?.crouch ?? 1.8);
    pose.depth = pulse * (animation?.depth ?? 0);
    pose.footwork = pulse * (animation?.footwork ?? 0);
    pose.bodyRoll = pulse * (animation?.roll ?? 0);
    pose.twist = (animation?.twist ?? 0) * Math.sin(p * Math.PI * 2);
    pose.handHeight = pose.plane === 'horizontal' ? 0 : (animation?.handHeight ?? 0) * pulse * (1 - strike);
    pose.trail = p > ANTICIPATION_END ? .3 : 0;
    pose.offAngle = dual ? mix(-1.85, contact - direction * .95, ease((p - .25) / .75)) : pose.angle;
    pose.offhandActive = offhand;
    if (pose.offhandActive) { pose.offAngle = pose.angle; pose.angle = aimAngle + .7 * ease(p); }
    pose.swingProgress = p; pose.motionWeight = Math.sin(p * Math.PI);
    const chamberOrientation = bladeOrientation(pose.plane, chamber - aimAngle, aimAngle);
    const startOrientation = previousPose ? { yaw: offhand ? previousPose.offBladeYaw : previousPose.bladeYaw, pitch: offhand ? previousPose.offBladePitch : previousPose.bladePitch } : { yaw: 0, pitch: offhand ? -1.85 : ready };
    // Enter the authored plane early, then keep winding slowly within that
    // plane. A horizontal anticipation must not spend its whole windup dipping.
    const windingOrientation = bladeOrientation(pose.plane, mix(start, chamber, anticipation) - aimAngle, aimAngle);
    const mainOrientation = p < ANTICIPATION_END ? blendOrientation(startOrientation, windingOrientation, ease(p / .56)) : bladeOrientation(pose.plane, mix(chamber - aimAngle, 0, strike), aimAngle);
    const guardOrientation = { yaw: 0, pitch: offhand ? pose.angle : pose.offAngle };
    putOrientation(pose, offhand ? guardOrientation : mainOrientation, offhand ? mainOrientation : dual ? guardOrientation : mainOrientation);
    // Carry the actual previous recovery pose into the next chamber, not the
    // previous move's hypothetical maximum follow-through.
    if (previousPose && p < ANTICIPATION_END) {
      const weight = anticipation;
      for (const key of ['extension', 'crouch', 'depth', 'footwork', 'bodyRoll', 'twist', 'handHeight'] as const) pose[key] = mix(previousPose[key], pose[key], weight);
    }

  } else if (swing && tick >= swing.tick && tick - swing.tick < 22) {
    const p = clamp((tick - swing.tick) / 22);
    const curve = attackPresentationCurve(attackPresentationPhase(p, true));
    const finish = swing.outcome === 'blocked' ? -direction * .55 : animation?.finish ?? .85;
    // Contact is a real spatial waypoint, not the end of the blade's path.
    // Continue through it into the authored finish, overshoot that finish by
    // 15%, then settle. This retains the full up/down and cross-body cut span.
    const curvePhase = attackPresentationPhase(p, true);
    const arc = finish * (curvePhase < .43 ? Math.max(0, (curve - 1) / .15) * 1.15 : curve);
    const settleToReady = ease((p - .45) / .55);
    pose.phase = p < .45 ? 'follow-through' : 'recovery';
    pose.angle = mix(aimAngle + arc, ready, settleToReady);
    const settle = 1 - ease(p);
    pose.extension = (animation?.plane === 'thrust' ? 10 : 6) * settle;
    pose.lean = (animation?.lean ?? 4) * settle;
    pose.crouch = (animation?.crouch ?? 0) * Math.sin(p * Math.PI) * .5;
    pose.depth = -(animation?.depth ?? 0) * Math.sin(p * Math.PI);
    pose.footwork = (animation?.footwork ?? 0) * Math.sin(p * Math.PI);
    pose.bodyRoll = -(animation?.roll ?? 0) * Math.sin(p * Math.PI);
    pose.twist = -(animation?.twist ?? 0) * Math.sin(p * Math.PI);
    pose.handHeight = pose.plane === 'horizontal' ? 0 : -(animation?.handHeight ?? 0) * Math.sin(p * Math.PI) * .5;
    pose.trail = p < .35 ? .24 * (1 - p / .35) : 0;
    pose.offAngle = dual ? mix(aimAngle - direction * .95, -1.85, ease(p)) : pose.angle;
    pose.offhandActive = dual && swing.offhand === true;
    if (pose.offhandActive) { pose.offAngle = pose.angle; pose.angle = mix(aimAngle + .7, ready, ease(p)); }
    pose.swingProgress = 1 + p; pose.motionWeight = Math.sin(p * Math.PI);
    const recoveryOrientation = blendOrientation(bladeOrientation(pose.plane, arc, aimAngle), { yaw: 0, pitch: ready }, settleToReady);
    const guardOrientation = { yaw: 0, pitch: pose.offhandActive ? pose.angle : pose.offAngle };
    putOrientation(pose, pose.offhandActive ? guardOrientation : recoveryOrientation, pose.offhandActive ? recoveryOrientation : dual ? guardOrientation : recoveryOrientation);

  }
  if (reducedMotion) {
    pose.trail = 0; pose.lean = 0; pose.crouch = 0;
    pose.depth = 0; pose.footwork = 0; pose.bodyRoll = 0; pose.twist = 0; pose.handHeight = 0;
    // Keep a discrete readable silhouette without sweeping/oscillating motion.
    pose.angle = ['strike', 'follow-through'].includes(pose.phase) ? aimAngle : ready;
    pose.extension = pose.phase === 'strike' ? 4 : 0;
    pose.offAngle = pose.offhandActive ? aimAngle : -1.85;
    pose.motionWeight = 0;
    putOrientation(pose, { yaw: 0, pitch: pose.angle }, { yaw: 0, pitch: pose.offAngle });
  }
  return pose;
}

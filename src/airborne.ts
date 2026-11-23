/** Deterministic 60 Hz ballistic arcs shared by rendering and combat hit tests.
 * Height never grants invulnerability: melee compares height; Force can track it.
 * Horizontal movement uses the simulation's swept collision callback. */
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback;
const smooth = (value: number) => { const p = clamp(value, 0, 1); return p * p * (3 - 2 * p); };
// Presentation only: fractional authored turns settle onto planted feet rather
// than snapping a quarter/half-turned silhouette upright when the arc expires.
const settledRotation = (rotations: number, progress: number) => {
  const turns = finite(rotations, 0);
  const whole = Math.sign(turns) * Math.round(Math.abs(turns));
  return (progress * turns + (whole - turns) * smooth((progress - .6) / .4)) * Math.PI * 2;
};
const TRAJECTORIES = Object.freeze({
  somersault: { travelScale: 1, lateralScale: 0, axis: 'pitch', bank: 0, tuck: 1 },
  'side-vault': { travelScale: .7, lateralScale: .65, axis: 'roll', bank: 1, tuck: .35 },
  'low-vault': { travelScale: 1, lateralScale: .18, axis: 'pitch', bank: .25, tuck: .55 },
  retreat: { travelScale: -1, lateralScale: .12, axis: 'pitch', bank: -.2, tuck: .45 },
});
type Trajectory = keyof typeof TRAJECTORIES;
const trajectoryFor = (name: Trajectory) => TRAJECTORIES[name] || TRAJECTORIES.somersault;
const axes = { pitch: 'pitch', roll: 'roll', yaw: 'yaw', somersault: 'pitch', cartwheel: 'roll', twist: 'yaw' } as const;
const rotationAxisFor = (axis: string | undefined, fallback: string) => axes[axis as keyof typeof axes] || fallback;
export interface JumpSpec {
  directionX?: number; directionY?: number; durationTicks?: number; recoveryTicks?: number;
  trajectory?: string; distance?: number; side?: number; lateralDistance?: number;
  rotationAxis?: string; rollAxis?: string; travelScale?: number; height?: number; rotations?: number;
}
export interface AirborneArc {
  trajectory: string; rotationAxis: string; travelScale: number; lateralDistance: number;
  bankScale: number; tuckScale: number; startTick: number; endTick: number; originX: number; originY: number;
  directionX: number; directionY: number; distance: number; height: number; recoveryTicks: number;
  rotations: number; appliedProgress: number;
}
export interface AirborneActor {
  x: number; y: number; facing?: number; airborne?: AirborneArc | null;
  landingRecoveryUntil?: number; airborneHeight?: number;
}
type OptionalActor = AirborneActor | null | undefined;
// Curved displacement is sampled in world space and its incremental delta is
// sent through the exact same swept collider as a straight ballistic leap.
const displacement = (a: AirborneArc, progress: number) => {
  const forward = a.distance * (a.travelScale ?? 1) * progress;
  const lateral = (a.lateralDistance || 0) * Math.sin(Math.PI * progress);
  return { x: a.directionX * forward - a.directionY * lateral,
    y: a.directionY * forward + a.directionX * lateral, lateral };
};
/** Voluntary acrobatics gain efficient timing, never extra height or distance.
 * Call this for an authored saber/dash jump, not an enemy-imposed Force lift.
 * The simulator must use the same spec for windup and the actual trajectory. */
export function trainedJumpSpec<T extends JumpSpec>(spec: T | null | undefined, skill: number | {skill?: number} = 0) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null;
  const training = clamp(finite(typeof skill === 'number' ? skill : skill?.skill, 0), 0, 1);
  const duration = clamp(finite(spec.durationTicks, 36), 12, 90);
  const recovery = clamp(finite(spec.recoveryTicks, 10), 0, 45);
  return Object.freeze({ ...spec,
    durationTicks: Math.max(12, Math.round(duration * (1 - .20 * training))),
    recoveryTicks: Math.round(recovery * (1 - (2 / 3) * training)),
  });
}
export function startAirborne(soldier: OptionalActor, tick: number, spec: JumpSpec = {}, direction: {x?: number; y?: number} | null = null) {
  if (!soldier || soldier.airborne || soldier.landingRecoveryUntil! > tick) return false;
  const dx = finite(direction?.x ?? spec.directionX, soldier.facing || 1), dy = finite(direction?.y ?? spec.directionY, 0);
  const length = Math.hypot(dx, dy) || 1;
  const duration = Math.round(clamp(finite(spec.durationTicks, 36), 12, 90));
  const trajectory = Object.hasOwn(TRAJECTORIES, spec.trajectory!) ? spec.trajectory as Trajectory : 'somersault';
  const profile = trajectoryFor(trajectory);
  const distance = clamp(finite(spec.distance, 0), 0, 180);
  const side = finite(spec.side, 1) < 0 ? -1 : 1;
  const lateralDistance = clamp(finite(spec.lateralDistance, distance * profile.lateralScale), -48, 48) * side;
  const turn = lateralDistance < 0 ? -1 : 1;
  soldier.airborne = { trajectory, rotationAxis: rotationAxisFor(spec.rotationAxis ?? spec.rollAxis, profile.axis),
    travelScale: clamp(finite(spec.travelScale, profile.travelScale), -1, 1),
    lateralDistance,
    bankScale: profile.bank * turn, tuckScale: profile.tuck,
    startTick: tick, endTick: tick + duration, originX: soldier.x, originY: soldier.y,
    directionX: dx / length, directionY: dy / length, distance,
    height: clamp(finite(spec.height, 48), 0, 100), recoveryTicks: Math.round(clamp(finite(spec.recoveryTicks, 10), 0, 45)),
    rotations: clamp(finite(spec.rotations, 1), -3, 3) * (trajectory === 'side-vault' ? turn : 1), appliedProgress: 0 };
  soldier.airborneHeight = 0;
  return true;
}
export function sampleAirborne(soldier: OptionalActor, tick: number) {
  const a = soldier?.airborne;
  if (!a) return { height: 0, progress: 0, rotation: 0, visualRotation: 0, twist: 0, visualTwist: 0,
    landingCompression: smooth((finite(soldier?.landingRecoveryUntil, 0) - tick) / 10),
    airborne: false, landing: false, x: soldier?.x || 0, y: soldier?.y || 0, dx: 0, dy: 0 };
  const progress = clamp((tick - a.startTick) / Math.max(1, a.endTick - a.startTick), 0, 1);
  const offset = displacement(a, progress);
  const previous = displacement(a, Math.min(progress, a.appliedProgress));
  const lift = Math.sin(Math.PI * progress);
  return { height: 4 * a.height * progress * (1 - progress), progress, rotation: progress * a.rotations * Math.PI * 2,
    visualRotation: settledRotation(a.rotations, progress), landingCompression: 0,
    visualTwist: rotationAxisFor(a.rotationAxis, 'pitch') === 'yaw' ? settledRotation(a.rotations, progress) : 0,
    trajectory: a.trajectory || 'somersault', rotationAxis: rotationAxisFor(a.rotationAxis, 'pitch'),
    twist: rotationAxisFor(a.rotationAxis, 'pitch') === 'yaw' ? progress * a.rotations * Math.PI * 2 : 0,
    bank: lift * (a.bankScale || 0), tuck: lift * (a.tuckScale ?? 1), lateralOffset: offset.lateral,
    airborne: tick >= a.startTick && tick < a.endTick, landing: tick >= a.endTick,
    x: a.originX + offset.x, y: a.originY + offset.y,
    dx: offset.x - previous.x, dy: offset.y - previous.y };
}
export function advanceAirborne<T extends AirborneActor>(soldier: T | null | undefined, tick: number, move: ((soldier: T, dx: number, dy: number) => void) | null = null) {
  const sample = sampleAirborne(soldier, tick);
  if (!soldier?.airborne) return sample;
  if (move) move(soldier, sample.dx, sample.dy);
  else { soldier.x += sample.dx; soldier.y += sample.dy; }
  soldier.airborne.appliedProgress = sample.progress;
  soldier.airborneHeight = sample.height;
  if (sample.landing) {
    soldier.landingRecoveryUntil = Math.max(soldier.landingRecoveryUntil || 0, soldier.airborne.endTick + soldier.airborne.recoveryTicks);
    soldier.airborne = null; soldier.airborneHeight = 0;
  }
  return sample;
}
export function airborneHeight(soldier: OptionalActor, tick: number) { return sampleAirborne(soldier, tick).height; }
export function verticalSeparation(a: OptionalActor, b: OptionalActor, tick: number) { return Math.abs(airborneHeight(a, tick) - airborneHeight(b, tick)); }
export function canMeleeHit(a: OptionalActor, b: OptionalActor, tick: number, maxVertical = 32) { return verticalSeparation(a, b, tick) <= maxVertical; }

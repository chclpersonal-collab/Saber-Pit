// @ts-nocheck
/** Deterministic, team-neutral environmental rules. Visual effects never drive these values. */
import { lineOfSight } from './terrain.js?v=1.4.0';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const ENVIRONMENTS = freeze({
  clear: { id: 'clear', name: 'Clear', description: 'Sight: 600 units. Normal movement.', sightRange: 600, walkMultiplier: 1, dashMultiplier: 1 },
  fog: { id: 'fog', name: 'Fog', description: 'Sight: 260 units. Normal movement.', sightRange: 260, walkMultiplier: 1, dashMultiplier: 1 },
  rain: { id: 'rain', name: 'Rain', description: 'Sight: 420 units. Walk 10% slower; dash 15% slower.', sightRange: 420, walkMultiplier: .9, dashMultiplier: .85 },
  sandstorm: { id: 'sandstorm', name: 'Sandstorm', description: 'Sight: 350 units, dropping to 220 in 3-second gusts. Walk 5% slower; dash 10% slower.', sightRange: 350, walkMultiplier: .95, dashMultiplier: .9 },
});
function hash(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
/** Query only: no RNG state, wall-clock time or mutable weather timers. Tick rate is 60 Hz. */
export function environmentAt(id = 'clear', roundSeed = 1, tick = 0) {
  const selected = Object.hasOwn(ENVIRONMENTS, id) ? ENVIRONMENTS[id] : ENVIRONMENTS.clear;
  const now = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  if (selected.id !== 'sandstorm') return { ...selected, phase: 'steady', nextTransitionTick: null, warning: false };
  const period = 1200, gustStart = 1020, offset = hash(roundSeed) % 240;
  const phaseTick = (now + offset) % period, gust = phaseTick >= gustStart;
  return { ...selected, phase: gust ? 'gust' : 'calm', sightRange: gust ? 220 : selected.sightRange,
    nextTransitionTick: now + (gust ? period : gustStart) - phaseTick,
    warning: !gust && gustStart - phaseTick <= 120 };
}
/** Pure weather distance test. Geometry is checked by the terrain module at the call site. */
export function withinVisibility(environment, from, to) {
  if (!from || !to || ![from.x, from.y, to.x, to.y].every(Number.isFinite)) return false;
  const range = typeof environment === 'string' ? environmentAt(environment).sightRange : environment?.sightRange;
  return Number.isFinite(range) && range >= 0 && Math.hypot(from.x - to.x, from.y - to.y) <= range;
}

/** Shared perception gate: finite weather range plus solid-wall sight blocking. */
export function canPerceive(terrain, environment, from, to) {
  return withinVisibility(environment, from, to) && lineOfSight(terrain, from, to, 'sight');
}

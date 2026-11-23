/** Bounded, deterministic squad geometry and visible-target preferences.
 * These helpers propose destinations/scores only. The engine remains responsible
 * for perception, manual control, attack legality and ordinary routed movement.
 */
import { getBounds, nearestWalkablePoint } from './terrain.js';

export const FORMATIONS = Object.freeze(Object.fromEntries([
  ['line', 'Line', 'Use the usual cover lanes.'],
  ['wedge', 'Wedge', 'Center forward, sides tucked in.'],
  ['spread', 'Spread', 'Spread out with more space between fighters.'],
].map(([id, name, description]) => [id, Object.freeze({ id, name, description })])));

export const TARGET_PRIORITIES = Object.freeze(Object.fromEntries([
  ['balanced', 'Balanced', 'Favor nearby enemies who are tired or off balance.'],
  ['nearest', 'Nearest', 'Attack the closest enemy in sight.'],
  ['weakest', 'Weakest', 'Favor injured enemies in sight, unless another is much closer.'],
  ['objective', 'Near the post', 'Favor enemies in sight near the signal post.'],
].map(([id, name, description]) => [id, Object.freeze({ id, name, description })])));

const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = n => Math.round(n * 1000) / 1000;
const validSlot = (team, lane) => (team === 0 || team === 1) && Number.isInteger(lane) && lane >= 0 && lane < 15;
const formationId = value => typeof value === 'string' && Object.hasOwn(FORMATIONS, value) ? value : 'line';
const priorityId = value => typeof value === 'string' && Object.hasOwn(TARGET_PRIORITIES, value) ? value : 'balanced';
const forward = team => team === 0 ? 1 : -1;

function safePoint(terrain, desired, fallback) {
  // Original cosmetic maps use the same center bounds as the legacy engine.
  const bounds = terrain?.cosmeticTerrainOnly
    ? { minX: 60, maxX: finite(terrain.width, 960) - 60, minY: 68, maxY: finite(terrain.height, 540) - 68 }
    : getBounds(terrain);
  const point = { x: clamp(round(desired.x), bounds.minX, bounds.maxX), y: clamp(round(desired.y), bounds.minY, bounds.maxY) };
  const clear = nearestWalkablePoint(terrain, point) || nearestWalkablePoint(terrain, fallback);
  // Geometry projection is solely for a goal: callers must never assign it to a
  // living actor's current position when changing formation.
  // Keep the projection's sub-pixel clearance; rounding it afterward can move
  // a goal back inside a fractional-coordinate wall.
  return clear ? { x: clear.x, y: clear.y } : { x: fallback.x, y: fallback.y };
}

/**
 * Stable lane IDs never depend on surviving allies. Depth ranks share the lead
 * rank's center: independently centering an incomplete rear rank would bring
 * it forward into the rank ahead. Casualties never renumber surviving slots.
 * Line is an exact detached copy of the original cover node for old campaigns.
 * Invalid team/bank/slot combinations return null rather than another slot.
 */
export function formationDestination(terrain, team, bank, lane, formation = 'line') {
  if (!validSlot(team, lane) || !Number.isInteger(bank) || bank < 0 || bank > 2) return null;
  const base = terrain?.coverNodes?.find(n => n.team === team && n.bank === bank && n.lane === lane);
  if (!base) return null;
  const id = formationId(formation);
  if (id === 'line') return { ...base };
  const row = lane % 5;
  const rank = terrain.coverNodes.filter(n => n.team === team && n.bank === bank && n.lane < 5);
  const middleRow = (rank.length - 1) / 2, offset = row - middleRow;
  const centerY = (Math.min(...rank.map(n => n.y)) + Math.max(...rank.map(n => n.y))) / 2;
  const scale = clamp(finite(terrain.height, 540) / 540, 1, 1.5);
  const dx = id === 'wedge' ? (44 - Math.abs(offset) * 29) * scale : -(18 + (row % 2) * 14) * scale;
  const dy = clamp((base.y - centerY) * (id === 'wedge' ? -.28 : .2), -64, 64);
  return { ...base, ...safePoint(terrain, { x: base.x + forward(team) * dx, y: base.y + dy }, base) };
}

/** Public-objective approach used only when no visible enemy supplies a goal.
 * The line formula is deliberately identical to v0.6. New shapes keep all
 * fifteen destinations bounded near the objective, with fixed slot identities.
 */
export function formationObjectiveDestination(terrain, objective, team, lane, formation = 'line') {
  if (!validSlot(team, lane) || !Number.isFinite(objective?.x) || !Number.isFinite(objective?.y)) return null;
  const column = Math.floor(lane / 5), row = lane % 5, direction = forward(team);
  const base = { x: objective.x - direction * (32 + column * 20), y: objective.y + (row - 2) * 22 };
  const id = formationId(formation);
  if (id === 'line') return base;
  const desired = id === 'wedge'
    ? { x: objective.x - direction * (20 + Math.abs(row - 2) * 25 + column * 32), y: objective.y + (row - 2) * 25 }
    : { x: objective.x - direction * (42 + column * 32 + (row % 2) * 12), y: objective.y + (row - 2) * 40 };
  return safePoint(terrain, desired, base);
}

/**
 * Lower scores win; iteration order breaks ties in the engine. Snapshot fields
 * must come from a visible target only: distance, hp/maxHp, energy,
 * staggerTicks, currentTarget (boolean), objectiveDistance and objectiveRadius.
 * Missing/invalid distance or an explicitly hidden/dead target cannot compete.
 * Preferences are capped in world-distance units, so they cannot attract an
 * actor across an entire map while a substantially closer threat is present.
 */
export function targetScore(snapshot = {}, priority = 'balanced') {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const distance = finite(s.distance, Infinity);
  if (s.visible === false || s.alive === false || distance < 0 || !Number.isFinite(distance)) return Infinity;
  const health = finite(s.maxHp) > 0 ? clamp(finite(s.hp, s.maxHp) / s.maxHp, 0, 1) : 1;
  const injury = 1 - health, staggered = finite(s.staggerTicks) > 0;
  const tired = finite(s.energy, 100) < 20, retained = s.currentTarget === true && distance < 100;
  const id = priorityId(priority);
  if (id === 'nearest') return distance;
  if (id === 'weakest') return distance - injury * 160 - (staggered ? 15 : 0) - (tired ? 8 : 0) - (retained ? 6 : 0);
  const balanced = distance - (staggered ? 30 : 0) - (tired ? 15 : 0) - injury * 15 - (retained ? 12 : 0);
  if (id !== 'objective') return balanced;
  const radius = Math.max(1, finite(s.objectiveRadius, 108)), objectiveDistance = finite(s.objectiveDistance, Infinity);
  const pressure = clamp(1 - Math.max(0, objectiveDistance) / (radius * 2), 0, 1);
  return balanced - pressure * 180;
}

/** Derived approach geometry only: no targets, combat decisions, RNG or saved state. */
import { canOccupy, lineOfSight, terrainAt, UNIT_RADIUS } from './terrain.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const valid = a => a && typeof a.id === 'string' && Number.isInteger(a.lane) && a.lane >= 0 && a.lane < 15 &&
  point(a) && Number.isFinite(a.reach) && a.reach >= UNIT_RADIUS * 2 && typeof a.target?.id === 'string' && point(a.target);

/**
 * actors contains at most fifteen eligible allies with their individually visible,
 * preselected target: {id,lane,x,y,reach,target:{id,x,y}}. The caller excludes
 * manual control, retreat, relic duties and defensive/committed movement.
 * Results are goals, NEVER positions to assign directly to actors. Use ordinary
 * terrain routing. Missing entries mean retain the engine's ordinary approach.
 * Cosmetic legacy maps deliberately retain their original behavior.
 *
 * Fixed lane angles survive casualties and input reordering. Two rings keep
 * slots inside saber reach, so rear allies are not parked outside combat range.
 * Small alternative angles can clear terrain without projecting onto a wall's
 * wrong side. Reject blocked saber lines and overlapping reserved destinations;
 * do not run an A* search per candidate. Reachability remains the router's job.
 */
export function planEngagementPositions({ terrain, formation = 'line', team, actors = [] } = {}) {
  const plans = new Map();
  if (!terrain || terrain.cosmeticTerrainOnly || ![0, 1].includes(team) || !Array.isArray(actors)) return plans;
  const ordered = actors.filter(valid).slice(0, 15).sort((a, b) => a.lane - b.lane || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const reserved = [], seenLanes = new Set();
  for (const actor of ordered) {
    if (plans.has(actor.id) || seenLanes.has(actor.lane)) continue;
    seenLanes.add(actor.lane);
    // A lone pursuer keeps the familiar direct approach; avoid needless circling.
    if (!ordered.some(other => other.id !== actor.id && other.target.id === actor.target.id)) continue;
    const inner = actor.lane < 5, index = inner ? actor.lane : actor.lane - 5;
    const count = inner ? 5 : 10;
    // Alternate upper/lower slots from the team's approach side.
    const sequence = index === 0 ? 0 : (index % 2 ? 1 : -1) * Math.ceil(index / 2);
    const spacing = formation === 'spread' ? .98 : formation === 'wedge' ? .90 : .94;
    const radius = Math.max(UNIT_RADIUS * 2 + .1, actor.reach * (inner ? .51 : spacing));
    const baseAngle = sequence * Math.PI * 2 / count + (inner ? 0 : Math.PI / 10);
    let best = null, bestScore = Infinity;
    for (const offset of [0, -.16, .16, -.32, .32]) {
      // terrainAt clamps damage >= 0 and moveCost >= 1; equal scores never replace the first choice.
      if (Math.abs(offset) * 100 >= bestScore) continue;
      const angle = baseAngle + offset;
      const candidate = { x: actor.target.x + (team === 0 ? -1 : 1) * Math.cos(angle) * radius,
        y: actor.target.y + Math.sin(angle) * radius };
      if (distance(candidate, actor.target) > actor.reach || !canOccupy(terrain, candidate) ||
          !lineOfSight(terrain, candidate, actor.target, 'saber') ||
          reserved.some(goal => distance(candidate, goal) < UNIT_RADIUS * 2 + .05)) continue;
      const zone = terrainAt(terrain, candidate);
      // Stable nominal slot dominates small changes in approach distance.
      const score = Math.abs(offset) * 100 + zone.damagePerSecond * 50 + (zone.moveCost - 1) * 20;
      if (score < bestScore) { bestScore = score; best = candidate; }
    }
    if (best) {
      const role = inner ? 'engage' : 'flank';
      const result = { ...best, role, reason: inner ? 'Take a clear squad approach' : 'Use a separate attack angle' };
      plans.set(actor.id, result); reserved.push(result);
    }
  }
  return plans;
}

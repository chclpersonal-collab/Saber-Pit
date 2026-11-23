/** Pure deployment and public-objective orders. The simulation owns all motion. */
import { formationDestination, formationObjectiveDestination } from './formations.js';
import { canOccupy, getBounds, UNIT_RADIUS } from './terrain.js';

export const DEPLOYMENTS = Object.freeze(Object.fromEntries([
  ['standard', 'Standard', 'Start in the usual rear cover formation.'],
  ['forward', 'Forward', 'Start at the next cover bank, closer to the objective.'],
  ['reserve', 'Reserve', 'Start behind the usual cover formation.'],
].map(([id, name, description]) => [id, Object.freeze({ id, name, description })])));
export const SQUAD_ORDERS = Object.freeze(Object.fromEntries([
  ['advance', 'Advance', 'Move toward the objective and engage visible enemies.'],
  ['hold', 'Hold', 'Stay near the current cover bank and defend.'],
  ['flank', 'Flank', 'Approach the upper side of the objective, then advance.'],
  ['regroup', 'Regroup', 'Gather around a fixed point behind the squad.'],
  ['retreat', 'Retreat', 'Withdraw to the home cover bank.'],
].map(([id, name, description]) => [id, Object.freeze({ id, name, description })])));

const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const validTeam = team => team === 0 || team === 1;
const validLane = lane => Number.isInteger(lane) && lane >= 0 && lane < 15;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const direction = team => team === 0 ? 1 : -1;
const clearOf = (p, occupied) => occupied.every(q => distance(p, q) >= UNIT_RADIUS * 2 + .01);

// At most 81 candidates: center plus four square rings. Independent
// x/y reflection preserves equal-team symmetry even when obstacles force a tie.
// Fixed order and no A* make this suitable for orders as well as round setup.
function safeGoal(terrain, desired, team, occupied = []) {
  if (!point(desired)) return null;
  const b = getBounds(terrain), origin = { x: Math.max(b.minX, Math.min(b.maxX, desired.x)), y: Math.max(b.minY, Math.min(b.maxY, desired.y)) };
  for (let ring = 0; ring <= 4; ring++) {
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const p = { x: origin.x + dx * 20 * direction(team), y: origin.y + dy * 20 };
      if (canOccupy(terrain, p) && clearOf(p, occupied)) return p;
    }
  }
  return null;
}
function layoutLegal(terrain, layout) {
  const placed = [];
  for (const p of layout.values()) { if (!canOccupy(terrain, p) || !clearOf(p, placed)) return false; placed.push(p); }
  return true;
}

/** Map lane -> detached point. Only use at initial spawn/new round, never to
 * reposition living actors. Invalid or impossible geometry yields an empty map.
 * Standard/legacy preserve exact existing bank-zero formation points if legal.
 * Other presets search at most 81 locations per actor, then fall back as a whole
 * to the legal standard layout; they never return an incomplete deployment.
 */
export function deploymentPositions({ terrain, team, formation = 'line', preset = 'standard' } = {}) {
  const empty = new Map();
  if (!terrain || !validTeam(team)) return empty;
  const lanes = (terrain.coverNodes || []).filter(n => n.team === team && n.bank === 0 && validLane(n.lane)).map(n => n.lane).sort((a, b) => a - b);
  if (!lanes.length || lanes.length > 15 || new Set(lanes).size !== lanes.length) return empty;
  const baseline = new Map(lanes.map(lane => [lane, formationDestination(terrain, team, 0, lane, formation)]));
  if ([...baseline.values()].some(p => !point(p))) return empty;
  const fallback = layoutLegal(terrain, baseline) ? baseline : empty;
  if (terrain.cosmeticTerrainOnly || !Object.hasOwn(DEPLOYMENTS, preset) || preset === 'standard') return fallback;
  const result = new Map(), occupied = [];
  for (const lane of lanes) {
    const base = preset === 'forward' ? formationDestination(terrain, team, 1, lane, formation) : baseline.get(lane);
    if (!point(base)) return fallback;
    const desired = { x: base.x - (preset === 'reserve' ? direction(team) * 32 : 0), y: base.y };
    const p = safeGoal(terrain, desired, team, occupied);
    if (!p) return fallback;
    result.set(lane, p); occupied.push(p);
  }
  return result;
}

/** Only new orders return an override. anchor is public objective for flank,
 * or the fixed rear-side rally point captured by the engine for regroup.
 * flankReady is an engine-owned latch (arrival or timeout); ready returns null
 * so ordinary advance resumes. stageComplete does not move or mutate an actor.
 * Callers preserve manual, committed, emergency defense and relic priorities.
 */
export function commandDestination({ terrain, team, lane, formation = 'line', order, actor, anchor, flankReady = false } = {}) {
  if (!terrain || !validTeam(team) || !validLane(lane) || !point(actor) || !point(anchor) || !['flank', 'regroup'].includes(order)) return null;
  if (order === 'flank' && flankReady) return null;
  const column = Math.floor(lane / 5), row = lane % 5;
  let desired;
  if (order === 'flank') {
    // Public side approach, never a guessed hidden-enemy position.
    const radius = Number.isFinite(anchor.radius) ? Math.max(0, anchor.radius) : 108;
    const bounds = getBounds(terrain);
    const side = { x: anchor.x - direction(team) * 45,
      y: Math.max(bounds.minY + 70, anchor.y - radius - 70) };
    desired = formationObjectiveDestination(terrain, side, team, lane, formation);
  } else {
    const count = Math.min(5, (terrain.coverNodes || []).filter(n => n.team === team && n.bank === 0 && n.lane < 5).length || 5);
    const offset = row - (count - 1) / 2;
    desired = { x: anchor.x - direction(team) * (column * 26 + (formation === 'wedge' ? Math.abs(offset) * 12 : 0)),
      y: anchor.y + offset * (formation === 'spread' ? 34 : 26) };
  }
  const destination = safeGoal(terrain, desired, team);
  if (!destination) return null;
  return { destination, reason: order === 'flank' ? 'Reach the upper objective approach' : 'Gather at the squad rally point',
    tacticalOrder: order === 'flank' ? 'advance' : 'retreat', stageComplete: distance(actor, destination) <= 24 };
}

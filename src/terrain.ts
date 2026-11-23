/** Deterministic flat-world geometry. Rectangles use top-left x/y and width/height.
 * Solids and zones are canonical content, not moving actors. Navigation caches
 * are derived only: rebuilding them cannot change a query's answer or use RNG.
 */
export const UNIT_RADIUS = 9;
const EPS = 1e-7, CLEARANCE = 1e-4, CELL_SIZE = 20, MAX_SEARCH = 6000;
export interface Point {x: number; y: number}
export interface Bounds {minX: number; minY: number; maxX: number; maxY: number}
interface FlexibleBounds extends Partial<Bounds> {x?: number; y?: number; width?: number; height?: number}
export interface TerrainRect extends Point {id?: string; kind?: string; width?: number; height?: number; w?: number; h?: number}
export interface TerrainSolid extends TerrainRect {blocksMovement?: boolean; blocksSaber?: boolean; blocksSight?: boolean; coverDistance?: number}
export interface TerrainZone extends TerrainRect {moveCost?: number; damagePerSecond?: number}
export interface TerrainGeometry {
  playBounds?: FlexibleBounds; bounds?: FlexibleBounds; width?: number; height?: number;
  solids?: readonly TerrainSolid[]; zones?: readonly TerrainZone[];
}
export type OptionalTerrain = TerrainGeometry | null | undefined;
export interface PathOptions {radius?: number; maxNodes?: number}
interface Navigation {
  key: string; bounds: Bounds; cols: number; rows: number; sx: number; sy: number;
  points: Point[]; valid: Uint8Array; paths: Map<string, number[]>;
}
interface HeapEntry {f: number; h: number; i: number}
const caches = new WeakMap<TerrainGeometry, Navigation>();
const finite = (n: number | undefined, fallback = 0) => Number.isFinite(n) ? n! : fallback;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const solidRects = (terrain: OptionalTerrain) => (terrain?.solids || []).filter(s => s && s.blocksMovement !== false).map(rect);
const rect = (r: TerrainRect) => ({ id: r.id, kind: r.kind, x: finite(r.x), y: finite(r.y), width: Math.max(0, finite(r.width, finite(r.w))), height: Math.max(0, finite(r.height, finite(r.h))) });
type Rect = ReturnType<typeof rect>;
const inflate = (r: Rect, radius: number) => ({ ...r, x: r.x - radius, y: r.y - radius, width: r.width + radius * 2, height: r.height + radius * 2 });
const inside = (r: Rect, p: Point) => p.x > r.x + EPS && p.x < r.x + r.width - EPS && p.y > r.y + EPS && p.y < r.y + r.height - EPS;

/** playBounds describe outer playable edges; returned bounds are actor centers. */
export function getBounds(terrain: OptionalTerrain, radius = UNIT_RADIUS) {
  const b = terrain?.playBounds || terrain?.bounds || {};
  const w = Math.max(1, finite(terrain?.width, 960)), h = Math.max(1, finite(terrain?.height, 540));
  const r = Math.max(0, finite(radius, UNIT_RADIUS));
  const minX = finite(b.minX, finite(b.x)), minY = finite(b.minY, finite(b.y));
  const maxX = finite(b.maxX, b.width === undefined ? w : minX + b.width);
  const maxY = finite(b.maxY, b.height === undefined ? h : minY + b.height);
  return { minX: Math.min(minX + r, (minX + maxX) / 2), minY: Math.min(minY + r, (minY + maxY) / 2),
    maxX: Math.max(maxX - r, (minX + maxX) / 2), maxY: Math.max(maxY - r, (minY + maxY) / 2) };
}
function clampPoint(terrain: OptionalTerrain, point: Point | null | undefined, radius: number) {
  const b = getBounds(terrain, radius);
  return { x: clamp(finite(point?.x, b.minX), b.minX, b.maxX), y: clamp(finite(point?.y, b.minY), b.minY, b.maxY) };
}
export function canOccupy(terrain: OptionalTerrain, point: Point | null | undefined, radius = UNIT_RADIUS) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const b = getBounds(terrain, radius);
  if (point.x < b.minX - EPS || point.x > b.maxX + EPS || point.y < b.minY - EPS || point.y > b.maxY + EPS) return false;
  for (const raw of terrain?.solids || []) {
    if (raw.blocksMovement === false) continue;
    if (point.x > raw.x - radius + EPS && point.x < raw.x + finite(raw.width, finite(raw.w)) + radius - EPS &&
        point.y > raw.y - radius + EPS && point.y < raw.y + finite(raw.height, finite(raw.h)) + radius - EPS) return false;
  }
  return true;
}

/** Slab interval, excluding boundary-only contact so sliding is legal. */
function segmentRect(a: Point, b: Point, r: Rect) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let enter = -Infinity, exit = Infinity, nx = 0, ny = 0;
  for (const [p, d, lo, hi, axis] of [[a.x, dx, r.x, r.x + r.width, 0], [a.y, dy, r.y, r.y + r.height, 1]]) {
    if (d === 0) { if (p <= lo || p >= hi) return null; continue; }
    const t1 = (lo - p) / d, t2 = (hi - p) / d, near = Math.min(t1, t2), far = Math.max(t1, t2);
    if (near > enter) { enter = near; nx = axis === 0 ? (d > 0 ? -1 : 1) : 0; ny = axis === 1 ? (d > 0 ? -1 : 1) : 0; }
    exit = Math.min(exit, far);
    if (enter >= exit) return null;
  }
  if (exit <= 0 || enter >= 1) return null;
  return { enter: Math.max(0, enter), exit: Math.min(1, exit), nx, ny };
}
function segmentFree(terrain: OptionalTerrain, a: Point, b: Point, radius: number) {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  for (const raw of terrain?.solids || []) {
    if (raw.blocksMovement === false) continue;
    const r = rect(raw);
    if (maxX <= r.x - radius || minX >= r.x + r.width + radius || maxY <= r.y - radius || minY >= r.y + r.height + radius) continue;
    if (segmentRect(a, b, inflate(r, radius))) return false;
  }
  return true;
}
function clearMovement(terrain: OptionalTerrain, a: Point, b: Point, radius: number) {
  return canOccupy(terrain, a, radius) && canOccupy(terrain, b, radius) && segmentFree(terrain, a, b, radius);
}
export function traceAttack(terrain: OptionalTerrain, from: Point | null | undefined, to: Point | null | undefined, kind = 'force') {
  if (!from || !to || ![from.x, from.y, to.x, to.y].every(Number.isFinite)) return { clear: false, blocker: null, point: null };
  let first = null;
  for (const raw of terrain?.solids || []) {
    const r = rect(raw), blocks = kind === 'saber' ? raw.blocksSaber !== false : raw.blocksSight ?? raw.kind !== 'barricade';
    if (!blocks) continue;
    const hit = segmentRect(from, to, r);
    if (hit && (!first || hit.enter < first.t - EPS)) first = { t: hit.enter, blocker: raw.id ?? null };
  }
  return first ? { clear: false, blocker: first.blocker, point: { x: from.x + (to.x - from.x) * first.t, y: from.y + (to.y - from.y) * first.t } } : { clear: true, blocker: null, point: null };
}
export function lineOfSight(terrain: OptionalTerrain, from: Point | null | undefined, to: Point | null | undefined, kind = 'force') { return traceAttack(terrain, from, to, kind).clear; }
export function coverMultiplier(terrain: OptionalTerrain, attacker: Point, target: Point) {
  for (const raw of terrain?.solids || []) {
    if (raw.kind !== 'barricade') continue;
    const r = rect(raw), nearest = { x: clamp(target.x, r.x, r.x + r.width), y: clamp(target.y, r.y, r.y + r.height) };
    if (distance(target, nearest) <= finite(raw.coverDistance, 30) && segmentRect(attacker, target, r)) return .86;
  }
  return 1;
}
export function terrainAt(terrain: OptionalTerrain, point: Point) {
  let moveCost = 1, damagePerSecond = 0;
  const zoneIds = [];
  for (const raw of terrain?.zones || []) {
    if (!inside(rect(raw), point)) continue;
    moveCost = Math.max(moveCost, finite(raw.moveCost, 1));
    damagePerSecond = Math.max(damagePerSecond, Math.max(0, finite(raw.damagePerSecond)));
    if (raw.id !== undefined) zoneIds.push(raw.id);
  }
  return { moveCost, moveMultiplier: 1 / moveCost, damagePerSecond, zoneIds };
}

/** Conservative square footprint, shared by navigation and swept movement. */
export function moveSwept(terrain: OptionalTerrain, start: Point, desired: Point, radius = UNIT_RADIUS) {
  let p = clampPoint(terrain, start, radius), goal = clampPoint(terrain, desired, radius), blocked = distance(goal, desired) > EPS, collisionId: string | null = null;
  if (!canOccupy(terrain, p, radius)) return { ...p, blocked: true, collisionId: 'invalid-start' };
  const solids = solidRects(terrain).map(r => inflate(r, radius));
  for (let pass = 0; pass < 3; pass++) {
    let first = null;
    for (const r of solids) {
      const hit = segmentRect(p, goal, r);
      if (hit && (!first || hit.enter < first.enter - EPS)) first = { ...hit, id: r.id ?? null };
    }
    if (!first) { p = goal; break; }
    blocked = true; collisionId = first.id;
    const dx = goal.x - p.x, dy = goal.y - p.y, length = Math.hypot(dx, dy);
    const t = Math.max(0, first.enter - CLEARANCE / Math.max(1, length));
    p = { x: p.x + dx * t, y: p.y + dy * t };
    const remaining = { x: dx * (1 - t), y: dy * (1 - t) };
    if (first.nx) remaining.x = 0;
    if (first.ny) remaining.y = 0;
    goal = clampPoint(terrain, { x: p.x + remaining.x, y: p.y + remaining.y }, radius);
    if (distance(p, goal) <= EPS) break;
  }
  // A final occupancy guard also protects against sub-pixel floating-point drift.
  if (!canOccupy(terrain, p, radius)) return { ...clampPoint(terrain, start, radius), blocked: true, collisionId: collisionId || 'clearance' };
  return { ...p, blocked, collisionId };
}

function zoneParts(terrain: OptionalTerrain, a: Point, b: Point) {
  const breaks = [0, 1];
  for (const z of terrain?.zones || []) { const hit = segmentRect(a, b, rect(z)); if (hit) breaks.push(hit.enter, hit.exit); }
  breaks.sort((x, y) => x - y);
  const parts = [];
  for (let i = 1; i < breaks.length; i++) {
    const from = breaks[i - 1], to = breaks[i]; if (to - from < EPS) continue;
    const t = (from + to) / 2, local = terrainAt(terrain, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    parts.push({ from, to, ...local });
  }
  return parts;
}
/** Cost uses world-distance equivalents; 1 DPS adds .35 avoidance cost. */
function segmentCost(terrain: OptionalTerrain, a: Point, b: Point, hazards = true) {
  const length = distance(a, b);
  return zoneParts(terrain, a, b).reduce((sum, p) => sum + length * (p.to - p.from) * (p.moveCost + (hazards ? p.damagePerSecond * .35 : 0)), 0);
}
function pointWithinBudget(terrain: OptionalTerrain, a: Point, b: Point, budget: number) {
  const length = distance(a, b); if (length < EPS) return { ...b };
  for (const p of zoneParts(terrain, a, b)) {
    const cost = length * (p.to - p.from) * p.moveCost;
    if (cost > budget) { const t = p.from + budget / (length * p.moveCost); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    budget -= cost;
  }
  return { ...b };
}
function signature(terrain: OptionalTerrain, radius: number) {
  return JSON.stringify([getBounds(terrain, radius), terrain?.solids || [], terrain?.zones || [], radius]);
}
function navigation(terrain: OptionalTerrain, radius: number): Navigation {
  const key = signature(terrain, radius); let cached = caches.get(terrain!);
  if (cached?.key === key) return cached;
  const bounds = getBounds(terrain, radius), cols = Math.max(2, Math.ceil((bounds.maxX - bounds.minX) / CELL_SIZE) + 1), rows = Math.max(2, Math.ceil((bounds.maxY - bounds.minY) / CELL_SIZE) + 1);
  const sx = (bounds.maxX - bounds.minX) / (cols - 1), sy = (bounds.maxY - bounds.minY) / (rows - 1), points = [], valid = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x, p = { x: bounds.minX + x * sx, y: bounds.minY + y * sy }; points.push(p); valid[i] = Number(canOccupy(terrain, p, radius)); }
  cached = { key, bounds, cols, rows, sx, sy, points, valid, paths: new Map() }; caches.set(terrain!, cached); return cached;
}
function nearestNode(terrain: OptionalTerrain, nav: Navigation, point: Point, radius: number) {
  const x = clamp(Math.round((point.x - nav.bounds.minX) / nav.sx), 0, nav.cols - 1), y = clamp(Math.round((point.y - nav.bounds.minY) / nav.sy), 0, nav.rows - 1);
  for (let ring = 0; ring <= 4; ring++) {
    const candidates = [];
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring || x + dx < 0 || x + dx >= nav.cols || y + dy < 0 || y + dy >= nav.rows) continue;
      const i = (y + dy) * nav.cols + x + dx;
      if (nav.valid[i] && clearMovement(terrain, point, nav.points[i], radius)) candidates.push(i);
    }
    if (candidates.length) return candidates.sort((a, b) => distance(point, nav.points[a]) - distance(point, nav.points[b]) || a - b)[0];
  }
  return -1;
}
class Heap {
  declare data: HeapEntry[];
  constructor() { this.data = []; }
  less(a: HeapEntry, b: HeapEntry) { return a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.i < b.i))); }
  push(item: HeapEntry) { const a = this.data; a.push(item); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  pop() { const a = this.data, first = a[0], end = a.pop(); if (a.length) { a[0] = end!; let i = 0; for (;;) { let n = i, l = i * 2 + 1, r = l + 1; if (l < a.length && this.less(a[l], a[n])) n = l; if (r < a.length && this.less(a[r], a[n])) n = r; if (n === i) break; [a[i], a[n]] = [a[n], a[i]]; i = n; } } return first; }
}
const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
export function findPath(terrain: OptionalTerrain, start: Point, goal: Point, options: PathOptions = {}) {
  const radius = Math.max(0, finite(options.radius, UNIT_RADIUS));
  if (!canOccupy(terrain, start, radius) || !canOccupy(terrain, goal, radius)) return [];
  if (distance(start, goal) < EPS) return [{ ...goal }];
  const direct = clearMovement(terrain, start, goal, radius), directCost = direct ? segmentCost(terrain, start, goal) : Infinity;
  if (direct && directCost <= distance(start, goal) + EPS) return [{ ...goal }];
  const nav = navigation(terrain, radius), source = nearestNode(terrain, nav, start, radius), target = nearestNode(terrain, nav, goal, radius);
  if (source < 0 || target < 0) return direct ? [{ ...goal }] : [];
  const maxNodes = clamp(Math.floor(finite(options.maxNodes, MAX_SEARCH)), 1, MAX_SEARCH), cacheKey = `${source}:${target}:${maxNodes}`;
  let indices = nav.paths.get(cacheKey);
  if (indices === undefined) {
    const size = nav.points.length, scores = new Float64Array(size).fill(Infinity), previous = new Int32Array(size).fill(-1), closed = new Uint8Array(size), open = new Heap();
    scores[source] = 0; const h = distance(nav.points[source], nav.points[target]); open.push({ i: source, f: h, h });
    let found = false, visited = 0;
    while (open.data.length && visited < maxNodes) {
      const current = open.pop().i; if (closed[current]) continue;
      closed[current] = 1; visited++;
      if (current === target) { found = true; break; }
      const x = current % nav.cols, y = Math.floor(current / nav.cols);
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= nav.cols || ny < 0 || ny >= nav.rows) continue;
        const i = ny * nav.cols + nx;
        if (!nav.valid[i] || closed[i] || (dx && dy && (!nav.valid[y * nav.cols + nx] || !nav.valid[ny * nav.cols + x]))) continue;
        if (!segmentFree(terrain, nav.points[current], nav.points[i], radius)) continue;
        const score = scores[current] + segmentCost(terrain, nav.points[current], nav.points[i]);
        if (score < scores[i] - EPS) { scores[i] = score; previous[i] = current; const h = distance(nav.points[i], nav.points[target]); open.push({ i, f: score + h, h }); }
      }
    }
    indices = [];
    if (found) { for (let i = target; i !== -1; i = previous[i]) indices.push(i); indices.reverse(); }
    if (nav.paths.size >= 512) nav.paths.delete(nav.paths.keys().next().value!);
    nav.paths.set(cacheKey, indices);
  }
  if (!indices.length) return direct ? [{ ...goal }] : [];
  const points = [...indices.map(i => ({ ...nav.points[i] })), { ...goal }].filter((p, i, a) => i ? distance(p, a[i - 1]) > EPS : distance(p, start) > EPS);
  let pathCost = 0, last = start; for (const p of points) { pathCost += segmentCost(terrain, last, p); last = p; }
  return directCost <= pathCost + EPS ? [{ ...goal }] : points;
}
export function nearestWalkablePoint(terrain: OptionalTerrain, point: Point | null | undefined, radius = UNIT_RADIUS) {
  const p = clampPoint(terrain, point, radius); if (canOccupy(terrain, p, radius)) return p;
  const candidates = [];
  for (const raw of solidRects(terrain)) {
    const r = inflate(raw, radius + CLEARANCE);
    if (!inside(r, p)) continue;
    candidates.push({ x: r.x, y: p.y }, { x: r.x + r.width, y: p.y }, { x: p.x, y: r.y }, { x: p.x, y: r.y + r.height });
    for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.height]) candidates.push({ x, y });
  }
  const valid = candidates.map(q => clampPoint(terrain, q, radius)).filter(q => canOccupy(terrain, q, radius));
  valid.sort((a, b) => distance(p, a) - distance(p, b) || a.y - b.y || a.x - b.x);
  return valid[0] || null;
}
export function nextWaypoint(terrain: OptionalTerrain, start: Point, goal: Point, options: PathOptions = {}) {
  const path = findPath(terrain, start, goal, options); if (!path.length) return null;
  let selected = path[0], cost = 0, last = start;
  for (const point of path.slice(0, 12)) {
    cost += segmentCost(terrain, last, point); last = point;
    if (clearMovement(terrain, start, point, options.radius ?? UNIT_RADIUS) && segmentCost(terrain, start, point) <= cost + EPS) selected = point;
  }
  return { ...selected };
}
export function moveToward(terrain: OptionalTerrain, start: Point, goal: Point, maxDistance: number, options: PathOptions = {}) {
  const radius = options.radius ?? UNIT_RADIUS, destination = nearestWalkablePoint(terrain, goal, radius);
  if (!destination || !Number.isFinite(maxDistance) || maxDistance <= 0) return { x: start.x, y: start.y, blocked: false, reachable: !!destination };
  const waypoint = nextWaypoint(terrain, start, destination, options);
  if (!waypoint) return { x: start.x, y: start.y, blocked: true, reachable: false };
  const desired = pointWithinBudget(terrain, start, waypoint, maxDistance), result = moveSwept(terrain, start, desired, radius);
  return { ...result, reachable: true };
}

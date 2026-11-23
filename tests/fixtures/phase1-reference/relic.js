/** Relic objective rules. All decisions use public objective state and no RNG. */
export const RELIC_TARGET = 3;
export const RELIC_PICKUP_RADIUS = 22;
export const RELIC_EXTRACTION_RADIUS = 48;
export const RELIC_CARRIER_SPEED = .72;
export const RELIC_RESET_SECONDS = 2;
export const RELIC_DROP_LOCK_SECONDS = .5;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ready = (g, s) => s.alive && !s.pinned && !s.rallying && !s.attack && s.staggerUntil <= g.tick;
const byDistance = point => (a, b) => distance(a, point) - distance(b, point) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const isRelic = g => g?.config?.matchMode === 'relic' && g.objective?.kind === 'relic';
export const isRelicCarrier = (g, s) => isRelic(g) && g.objective.state === 'carried' && g.objective.carrierId === s?.id;
export const carrierMoveMultiplier = (g, s) => isRelicCarrier(g, s) ? RELIC_CARRIER_SPEED : 1;

export function createRelicObjective(terrain, targetScore = RELIC_TARGET) {
  const center = terrain.controlPoints[0], home = { x: center.x, y: center.y };
  return { id: 'relic', name: 'Relic', ...home, radius: RELIC_PICKUP_RADIUS, capture: 0, owner: null,
    points: [0, 0], targetScore, contested: false, presence: [0, 0], kind: 'relic',
    carrierId: null, state: 'available', home, unlockTick: 0,
    extractionZones: [0, 1].map(team => ({ team, x: terrain.width * (team ? .82 : .18), y: terrain.height / 2, radius: RELIC_EXTRACTION_RADIUS })) };
}

/** Called at the death site after knockback has settled, including direct damage callers. */
export function dropRelic(g, s, tickRate = 60) {
  if (!isRelicCarrier(g, s)) return null;
  Object.assign(g.objective, { x: s.x, y: s.y, state: 'available', carrierId: null, owner: null,
    contested: false, presence: [0, 0], unlockTick: g.tick + Math.round(RELIC_DROP_LOCK_SECONDS * tickRate) });
  return { type: 'relic-drop', team: s.team, text: `${s.name} dropped the relic` };
}

/** Advance the objective and end a pickup dash; the engine owns events, merit and the clock. */
export function advanceRelic(g, tickRate = 60) {
  if (!isRelic(g)) return [];
  const o = g.objective, events = [];
  if (o.state === 'carried') {
    const carrier = g.soldiers.find(s => s.id === o.carrierId);
    if (!carrier?.alive) {
      if (carrier) events.push(dropRelic(g, carrier, tickRate));
      return events;
    }
    o.x = carrier.x; o.y = carrier.y; o.owner = carrier.team;
    o.presence = [0, 1].map(team => g.soldiers.filter(s => s.alive && s.team === team && distance(s, o) <= o.radius).length);
    o.contested = o.presence[0] > 0 && o.presence[1] > 0;
    if (ready(g, carrier) && distance(carrier, o.extractionZones[carrier.team]) <= RELIC_EXTRACTION_RADIUS) {
      o.points[carrier.team] = Math.min(o.targetScore, o.points[carrier.team] + 1);
      Object.assign(o, { ...o.home, carrierId: null, owner: null, state: 'resetting',
        unlockTick: g.tick + Math.round(RELIC_RESET_SECONDS * tickRate), contested: false, presence: [0, 0] });
      events.push({ type: 'relic-delivery', team: carrier.team, text: `${carrier.name} delivered the relic (${o.points[carrier.team]}/${o.targetScore})` });
    }
    return events;
  }
  if (o.state === 'resetting') {
    if (g.tick < o.unlockTick) return events;
    o.state = 'available';
    events.push({ type: 'relic-ready', team: null, text: 'The relic is ready at the center' });
  }
  const nearby = g.soldiers.filter(s => s.alive && distance(s, o) <= o.radius);
  o.presence = [0, 1].map(team => nearby.filter(s => s.team === team).length);
  o.contested = o.presence[0] > 0 && o.presence[1] > 0;
  if (g.tick < o.unlockTick || o.contested) return events;
  const carrier = nearby.filter(s => ready(g, s)).sort(byDistance(o))[0];
  if (carrier) {
    Object.assign(o, { x: carrier.x, y: carrier.y, carrierId: carrier.id, owner: carrier.team, state: 'carried' });
    carrier.dashUntil = Math.min(carrier.dashUntil, g.tick);
    events.push({ type: 'relic-pickup', team: carrier.team, text: `${carrier.name} took the relic` });
  }
  return events;
}

/** Stable roles avoid every ally chasing a carrier or fighting over one pickup spot. */
export function relicAssignment(g, s) {
  if (!isRelic(g) || !s?.alive) return null;
  const o = g.objective, carrier = o.state === 'carried' ? g.soldiers.find(other => other.id === o.carrierId && other.alive) : null;
  const friends = g.soldiers.filter(other => other.alive && other.team === s.team).sort(byDistance(o));
  if (carrier?.id === s.id) return { role: 'deliver', reason: 'Carry relic to extraction', destination: { ...o.extractionZones[s.team] } };
  if (carrier && carrier.team !== s.team) {
    const zone = o.extractionZones[carrier.team], length = Math.max(1, distance(carrier, zone));
    // The marker is public even in fog; attacks still require ordinary perception.
    return { role: 'intercept', reason: 'Intercept relic carrier', destination: {
      x: carrier.x + (zone.x - carrier.x) / length * 26, y: carrier.y + (zone.y - carrier.y) / length * 26 } };
  }
  if (carrier) {
    const index = friends.filter(other => other.id !== carrier.id).findIndex(other => other.id === s.id);
    return { role: 'escort', reason: 'Escort relic carrier', destination: {
      x: carrier.x + (s.team === 0 ? 1 : -1) * (42 + Math.floor(index / 4) * 22),
      y: carrier.y + (index % 4 - 1.5) * 26 } };
  }
  const retriever = friends.find(other => !other.pinned && !other.rallying && other.staggerUntil <= g.tick) ?? friends[0];
  if (retriever?.id === s.id) return { role: 'retrieve', reason: o.state === 'resetting' ? 'Await relic reset' : 'Retrieve loose relic', destination: { x: o.x, y: o.y } };
  const index = friends.filter(other => other.id !== retriever?.id).findIndex(other => other.id === s.id);
  return { role: 'screen', reason: 'Cover relic retrieval', destination: {
    x: o.x + (s.team === 0 ? -1 : 1) * (40 + Math.floor(index / 4) * 24),
    y: o.y + (index % 4 - 1.5) * 30 } };
}

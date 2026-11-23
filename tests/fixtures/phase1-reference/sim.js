/** Deterministic saber combat; all persistent state is plain JSON. */
import { WEAPONS, KNIVES, FORMS, MAPS, QUALITY_LEVELS, FORCE_FAMILIES, createTerrain, evolveLoadout, startingLoadout } from './content.js';
import { createCareer, awardMerit, meritForRound, progressionSummary, combatSkillProfile, SOLDIER_GRADES, MAX_HEALTH_MULTIPLIER } from './progression.js';
import { combatFormProfile, selectFormMove, getFormMoves } from './combat-forms.js';
import { normalizeDualSabers, saberWieldProfile } from './dual-sabers.js';
import { chooseCombatSequence } from './combat-sequences.js';
import { startAirborne, advanceAirborne, canMeleeHit, airborneHeight, trainedJumpSpec } from './airborne.js';
import { selectForceAbility, forceAbilityWeapon, forceAbilityById } from './force-abilities.js';
import { chooseAction } from './tactics.js';
import { enemyFormsForRound } from './opponents.js';
import { FORMATIONS, TARGET_PRIORITIES, formationDestination, formationObjectiveDestination, targetScore } from './formations.js';
import { planEngagementPositions } from './squad-positioning.js';
import { DEPLOYMENTS, SQUAD_ORDERS, deploymentPositions, commandDestination } from './squad-commands.js';
import { createBattleLog, recordBattleEvent, buildBattleRecap } from './battle-recap.js';
import { normalizeMatchRules, resolveRoundOutcome } from './match-rules.js';
import { createMastery, createRoundPractice, settleMastery, createCommendations } from './mastery.js';
import { createBattlefield, MAP_SIZES } from './maps.js';
import { getBounds, lineOfSight, coverMultiplier, terrainAt, moveToward, moveSwept, nearestWalkablePoint, UNIT_RADIUS } from './terrain.js';
import { environmentAt, canPerceive } from './environment.js';
import { normalizeModifier, permitsForceAttacks } from './modifiers.js';
import { createRelicObjective, isRelicCarrier, carrierMoveMultiplier, relicAssignment, advanceRelic, dropRelic } from './relic.js';
export { WEAPONS, KNIVES, FORMS, MAPS };
export const WIDTH = 960, HEIGHT = 540, TICK_RATE = 60, ROUND_DURATION = 90;
export const ASSIST_WINDOW = 6, MAX_RECORD_COUNT = 1e9, MAX_TEAM_SIZE = 15;
export const MAX_FIGHTER_HP = Math.round(132 * MAX_HEALTH_MULTIPLIER * 1000) / 1000;
export const COVER_NODES = MAPS[0].coverNodes;
export const DOCTRINES = Object.freeze({
  balanced: Object.freeze({ id: 'balanced', name: 'Balanced', description: 'Steady movement, precision and resistance to pressure.', moveMultiplier: 1, accuracyBonus: 0, suppressionMultiplier: 1 }),
  assault: Object.freeze({ id: 'assault', name: 'Assault', description: 'Move 12% faster; precision -4.5 points and incoming pressure +10%. Auto pushes more often.', moveMultiplier: 1.12, accuracyBonus: -.045, suppressionMultiplier: 1.10 }),
  guard: Object.freeze({ id: 'guard', name: 'Guard', description: 'Precision +3.5 points and incoming pressure -18%; move 12% slower. Auto holds earlier under pressure.', moveMultiplier: .88, accuracyBonus: .035, suppressionMultiplier: .82 }),
});
const DT = 1 / TICK_RATE, BASE_HP = 120, MAX_EFFECTS = 160, MAX_EVENTS = 32;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rounded = n => Math.round(n * 1000) / 1000;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ticks = seconds => Math.max(1, Math.round(seconds * TICK_RATE));
// Presentation metadata only: gameplay always reads the authoritative x/y.
const snapshotPosition = entity => { entity.prevX = entity.x; entity.prevY = entity.y; };
function captureRenderPositions(g) {
  g.prevFrontLine = g.frontLine;
  for (const soldier of g.soldiers) snapshotPosition(soldier);
  if (g.objective?.kind === 'relic') snapshotPosition(g.objective);
}
/** Collapse interpolation after loading or an explicit teleport, preserving simulation time. */
export function resetRenderSnapshots(g) {
  if (!g) return g;
  captureRenderPositions(g);
  g.alpha = (g._accumulator ?? 0) / DT;
  return g;
}
// Phase-local caches are discarded before any damage/death settlement. They
// never enter saves and cannot outlive a moved position or committed attack.
const phaseCaches = new WeakMap();
function resetPhase(g) { phaseCaches.set(g, { living: [g.soldiers.filter(s => s.alive && s.team === 0), g.soldiers.filter(s => s.alive && s.team === 1)], targets: new Map(), contexts: new Map(), threats: new Map(), sight: new Map(), lines: new Map(), squadPlans: new Map() }); }
const aliveTeam = (g, team) => phaseCaches.get(g)?.living[team] ?? g.soldiers.filter(s => s.alive && s.team === team);
const average = (list, key) => list.length ? list.reduce((n, s) => n + s[key], 0) / list.length : 0;
const validDoctrine = id => typeof id === 'string' && Object.hasOwn(DOCTRINES, id);
const validForm = id => typeof id === 'string' && Object.hasOwn(FORMS, id);
const doctrineFor = (g, team) => DOCTRINES[g.doctrines[team]];
const formFor = s => FORMS[s.form];
const rankForXP = xp => xp >= 150 ? 3 : xp >= 90 ? 2 : xp >= 40 ? 1 : 0;
const record = () => ({ kills: 0, deaths: 0, assists: 0, environmentDeaths: 0 });
const soldierId = (team, lane) => `${team === 0 ? 'blue' : 'red'}-${lane}`;
const increment = (r, key) => { r[key] = Math.min(MAX_RECORD_COUNT, r[key] + 1); };
// Observation only: these counters never feed damage, cooldowns, HP or movement.
const practice = (s, form, metric, amount = 1) => { if (validForm(form)) s.formPractice[form][metric] = Math.min(MAX_RECORD_COUNT, s.formPractice[form][metric] + amount); };
/** Stable campaign slots are independent of the map's formation rows. */
export function normalizeConfig(options = {}) {
  const sizes = options.teamSizes ?? [5, 5];
  if (!Array.isArray(sizes) || sizes.length !== 2 || sizes.some(n => !Number.isInteger(n) || n < 1 || n > MAX_TEAM_SIZE)) throw new RangeError('Each team must have 1–15 fighters');
  const mapSize = options.mapSize ?? (options.teamSizes ? 'medium' : 'legacy');
  if (mapSize !== 'legacy' && !Object.hasOwn(MAP_SIZES, mapSize)) throw new RangeError('Unknown map size');
  if (mapSize === 'legacy' && sizes.some(n => n !== 5)) throw new RangeError('Legacy maps require five fighters per side');
  const environment = options.environment ?? 'clear';
  if (!['clear', 'fog', 'rain', 'sandstorm'].includes(environment)) throw new RangeError('Unknown environment');
  const mode = options.mode ?? 'spectate';
  if (!['spectate', 'play', 'command'].includes(mode)) throw new RangeError('Unknown play mode');
  const playerSlot = options.playerSlot ?? 0;
  if (!Number.isInteger(playerSlot) || playerSlot < 0 || playerSlot >= sizes[0]) throw new RangeError('Unknown player slot');
  const terrain = options.terrain ?? null;
  if (terrain !== null && !MAPS.some(map => map.id === terrain)) throw new RangeError('Unknown map');
  const opponentForm = options.opponentForm ?? options.enemyForm ?? null;
  if (opponentForm !== null && !validForm(opponentForm)) throw new RangeError('Unknown opponent form');
  const opponentMode = opponentForm !== null || options.forms?.[1] ? 'fixed' : (options.opponentMode ?? 'mixed');
  if (!['mixed', 'fixed'].includes(opponentMode)) throw new RangeError('Unknown opponent policy');
  const formations = options.formations ?? ['line', 'line'], targetPriorities = options.targetPriorities ?? ['balanced', 'balanced'];
  const deployments = options.deployments ?? ['standard', 'standard'];
  for (const [values, catalog, label] of [[formations, FORMATIONS, 'formation'], [targetPriorities, TARGET_PRIORITIES, 'target priority'], [deployments, DEPLOYMENTS, 'deployment']]) {
    if (!Array.isArray(values) || values.length !== 2 || values.some(id => typeof id !== 'string' || !Object.hasOwn(catalog, id))) throw new RangeError(`Unknown team ${label}`);
  }
  const startingRanks = options.startingRanks ?? ['F', 'F'];
  const startingSaberQuality = options.startingSaberQuality ?? ['standard', 'standard'];
  const startingForceFamily = options.startingForceFamily ?? ['force_push', 'force_push'];
  const startingForceQuality = options.startingForceQuality ?? ['standard', 'standard'];
  for (const [values, choices, label] of [
    [startingRanks, SOLDIER_GRADES.map(grade => grade.label), 'starting rank'],
    [startingSaberQuality, QUALITY_LEVELS.map(quality => quality.id), 'starting saber quality'],
    [startingForceFamily, FORCE_FAMILIES.map(power => power.id), 'starting Force type'],
    [startingForceQuality, QUALITY_LEVELS.map(quality => quality.id), 'starting Force quality'],
  ]) if (!Array.isArray(values) || values.length !== 2 || values.some(id => !choices.includes(id))) throw new RangeError(`Unknown team ${label}`);
  return { teamSizes: [...sizes], mapSize, terrain, environment, mode, playerSlot, opponentMode, opponentForm,
    formations: [...formations], targetPriorities: [...targetPriorities], ...normalizeMatchRules(options), modifier: normalizeModifier(options.modifier),
    startingRanks: [...startingRanks], startingSaberQuality: [...startingSaberQuality],
    startingForceFamily: [...startingForceFamily], startingForceQuality: [...startingForceQuality],
    startingDualSabers: normalizeDualSabers(options.startingDualSabers), deployments: [...deployments] };
}
/** Neutral per-round command metadata; goals remain derived, never stored paths. */
export function createCommandState(g) {
  return [0, 1].map(team => ({ issuedTick: 0, anchor: null, flankReached: [], manual: team === 0 && !g.autoCommand, flankUsed: false }));
}
const neutralInput = () => ({ moveX: 0, moveY: 0, attack: false, force: false, guard: false, dash: false, targetId: null });
const controlled = (g, s) => g.config?.mode === 'play' && g.control?.soldierId === s.id && s.team === 0;
const tacticalOrder = (g, s) => {
  const order = s.team === 0 ? g.playerOrder : g.enemyOrder;
  return s.rallying || order === 'regroup' ? 'retreat' : order === 'flank' ? 'advance' : order;
};
export function clearPlayerInput(g) { if (g?.control) g.control.input = neutralInput(); return g; }
export function setControlledFighter(g, id) {
  if (!g || g.status !== 'playing') return false;
  if (id === null) { clearPlayerInput(g); g.control.soldierId = null; g.config.mode = 'spectate'; g.autoCommand = true; g.commandState[0].manual = false; return true; }
  const s = g.soldiers.find(s => s.id === id && s.team === 0 && s.alive);
  if (!s) return false;
  clearPlayerInput(g); g.control.soldierId = id; g.config.mode = 'play'; g.config.playerSlot = s.lane; g.autoCommand = true; g.commandState[0].manual = false; return true;
}
export function setPlayerInput(g, input = {}) {
  const s = g?.soldiers?.find(s => s.id === g.control?.soldierId && s.alive);
  if (!s || g.config.mode !== 'play' || g.status !== 'playing') { clearPlayerInput(g); return false; }
  const next = g.control.input;
  for (const key of ['moveX', 'moveY']) if (Object.hasOwn(input, key)) next[key] = Number.isFinite(input[key]) ? clamp(input[key], -1, 1) : 0;
  if (Object.hasOwn(input, 'guard')) next.guard = !!input.guard;
  for (const key of ['attack', 'force', 'dash']) if (input[key] === true) next[key] = true;
  if (Object.hasOwn(input, 'targetId')) next.targetId = g.soldiers.some(t => t.alive && t.team === 1 && t.id === input.targetId) ? input.targetId : null;
  return true;
}
const worldBounds = g => g.config?.mapSize === 'legacy' ? { minX: 60, maxX: 900, minY: 68, maxY: 472 } : getBounds(g.terrain, UNIT_RADIUS);
const environmentCache = new WeakMap();
const defenseSnapshots = new WeakMap();
export function getEnvironment(g) {
  const id = g.config?.environment || 'clear', cached = environmentCache.get(g);
  if (cached && cached.id === id && cached.seed === g.seed && cached.round === g.round && cached.tick === g.tick) return cached.value;
  const value = Object.freeze(environmentAt(id, hashSeed(g.seed) + g.round - 1, g.tick));
  environmentCache.set(g, { id, seed: g.seed, round: g.round, tick: g.tick, value }); return value;
}
const perception = getEnvironment;
const sees = (g, s, target) => {
  if (g.config?.mapSize === 'legacy') return true;
  const cache = phaseCaches.get(g)?.sight;
  let row = cache?.get(s);
  const cached = row?.get(target); if (cached !== undefined) return cached;
  const visible = canPerceive(g.terrain, perception(g), s, target);
  if (cache) { if (!row) cache.set(s, row = new Map()); row.set(target, visible); }
  return visible;
};
/** Visible living opponents, in stable roster order; consumes no RNG. */
export function visibleEnemyTargets(g, id) {
  const s = g?.soldiers?.find(s => s.id === id && s.alive);
  return s ? aliveTeam(g, 1 - s.team).filter(enemy => sees(g, s, enemy)) : [];
}
const unobstructed = (g, s, target, kind) => {
  if (g.config?.mapSize === 'legacy') return true;
  const cache = phaseCaches.get(g)?.lines, key = `${s.id}:${target.id}:${kind}`;
  if (cache?.has(key)) return cache.get(key);
  const clear = lineOfSight(g.terrain, s, target, kind); cache?.set(key, clear); return clear;
};
function inCover(g, s) {
  if (s.moving) return false;
  if (g.config.mapSize === 'legacy') return g.terrain.coverNodes.some(n => dist(s, n) < 19);
  const enemies = aliveTeam(g, 1 - s.team).filter(e => sees(g, s, e));
  if (enemies.length) return enemies.some(e => coverMultiplier(g.terrain, e, s) < 1);
  return (g.terrain.solids || []).some(r => r.kind === 'barricade' && Math.hypot(s.x - clamp(s.x, r.x, r.x + r.width), s.y - clamp(s.y, r.y, r.y + r.height)) <= (r.coverDistance ?? 30));
}


function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 0x9e3779b9;
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) || 0x9e3779b9;
}
function random(g) { let x = g.rngState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; g.rngState = x >>> 0; return g.rngState / 4294967296; }
function event(g, type, team, text) {
  const entry = { id: g.nextEventId++, time: g.time, type, team, text };
  g.events.push(entry);
  recordBattleEvent(g.battleLog, entry);
  if (g.events.length > MAX_EVENTS) g.events.shift();
}
function effect(g, type, x, y, team, extras = {}) {
  const life = { saber: .28, force: .48, feedback: .7, block: .35, counter: .4, stagger: .4, dash: .3, impact: .25, death: .75, rank: .8 }[type] || .35;
  g.effects.push({ id: g.nextEffectId++, type, x, y, x2: x, y2: y, team, ttl: life, maxTtl: life, ...extras });
  if (g.effects.length > MAX_EFFECTS) g.effects.splice(0, g.effects.length - MAX_EFFECTS);
}
const formationNodeCache = new WeakMap();
function node(g, team, bank, lane) {
  let nodes = formationNodeCache.get(g.terrain);
  if (!nodes) { nodes = new Map(); formationNodeCache.set(g.terrain, nodes); }
  const key = `${team}/${bank}/${lane}/${g.config.formations[team]}`;
  if (!nodes.has(key)) nodes.set(key, formationDestination(g.terrain, team, bank, lane, g.config.formations[team]));
  return nodes.get(key);
}
function nearestBank(g, s) {
  let bank = 0;
  for (let b = 1; b <= 2; b++) if (dist(s, node(g, s.team, b, s.lane)) < dist(s, node(g, s.team, bank, s.lane))) bank = b;
  return bank;
}
function populateRound(g) {
  phaseCaches.delete(g);
  g.terrain = createBattlefield(hashSeed(g.seed) + g.round - 1, { ...g.config, terrain: g.terrainChoice });
  g.terrain.objective = { ...g.terrain.controlPoints[0] };
  Object.assign(g, {
    tick: 0, time: 0, timeLeft: g.config.roundDuration, roundDuration: g.config.roundDuration,
    status: 'playing', winner: null, reason: '', playerOrder: 'hold', enemyOrder: 'hold',
    playerTactic: 'guard', enemyTactic: 'guard', forceCooldown: 0, aiForceCooldown: 0,
    guardCooldown: 0, aiGuardCooldown: 0, effects: [], events: [], battleLog: createBattleLog(), commandState: createCommandState(g), frontLine: g.terrain.width / 2,
    _accumulator: 0, _nextAiDecision: 60, nextEffectId: 1, nextEventId: 1,
    stats: Object.fromEntries(['shots', 'hits', 'knifeHits', 'damage', 'suppression', 'coverTime', 'objectiveTime', 'saberSwings', 'saberHits', 'forceCasts', 'forceHits', 'blocks', 'counters', 'kills', 'deaths', 'assists', 'environmentDeaths'].map(k => [k, [0, 0]])),
    objective: g.config.matchMode === 'relic' ? createRelicObjective(g.terrain, g.config.targetScore) : { ...g.terrain.objective, capture: 0, owner: null, points: [0, 0], targetScore: g.config.targetScore, contested: false, presence: [0, 0] },
    squads: [0, 1].map(team => ({ team, doctrine: g.doctrines[team], order: 'hold', tactic: 'guard', morale: 82, suppression: 0, readiness: 1, rallyUntil: 0 })),
  });
  const placements = [0, 1].map(team => deploymentPositions({ terrain: g.terrain, team, formation: g.config.formations[team], preset: g.config.deployments[team] }));
  g.soldiers = [0, 1].flatMap(team => Array.from({ length: g.config.teamSizes[team] }, (_, lane) => {
    const cover = placements[team].get(lane), loadout = g.loadouts[team].roster[lane];
    const veteran = g.veterans[team][lane], rank = rankForXP(veteran), career = progressionSummary(g.careers[team][lane]);
    const maxHp = rounded((BASE_HP + rank * 4) * career.modifiers.healthMultiplier), form = g.forms[team][lane];
    return {
      id: soldierId(team, lane), team, lane, name: `${team === 0 ? 'Blue' : 'Red'} ${lane + 1}`,
      x: cover.x, y: cover.y, hp: maxHp, maxHp, alive: true, weapon: loadout.weapon, meleeWeapon: loadout.meleeWeapon,
      formPractice: createRoundPractice(), role: FORMS[form].trait, form, technique: FORMS[form].technique.name, rank, xp: veteran, ...record(),
      damageDealt: 0, suppression: 0, morale: 82, career, objectiveSeconds: 0, suppressionDealt: 0, meritEarned: 0, contributors: [],
      energy: 100, maxEnergy: 100, guard: false, guardUntil: 0, counterUntil: 0, staggerUntil: 0, staggerImmuneUntil: 0,
      observation: null, comboIndex: 0, comboUntil: 0, guardStartedTick: -1000, lastGuardTick: -1000,
      airborne: null, airborneHeight: 0, landingRecoveryUntil: 0,
      forceControl: null, lastForceAbility: null, forceAbilitySequence: 0, barrierUntil: 0, barrierEnergy: 0,
      dashUntil: 0, dashReadyTick: 0, saberReadyTick: 8 + Math.floor(random(g) * 20), forceReadyTick: 30 + lane * 9 + Math.floor(random(g) * 18),
      forceRequestedUntil: 0, attack: null, attackCooldown: 0, forceCooldown: 0, combatState: 'ready', tacticalReason: 'Opening position', lastOutcome: null,
      pinned: false, rallying: false, pinnedAtTick: -1000, stance: 'guard', cover: true, state: 'covered', melee: false,
      target: null, targetUntil: 0, facing: team === 0 ? 1 : -1, moving: false, bank: 0, holdBank: 0,
      destinationX: cover.x, destinationY: cover.y, nextMoveTick: 0, lastShotTick: -1000,
    };
  }));
  for (const s of g.soldiers) s.bank = s.holdBank = nearestBank(g, s);
  resetRenderSnapshots(g);
  g.control = { soldierId: g.config.mode === 'play' ? soldierId(0, g.config.playerSlot) : null, input: neutralInput() };
  event(g, 'round', null, `Round ${g.round}: ${g.config.matchMode === 'relic' ? 'deliver the relic three times or defeat the opposing squad' : g.config.matchMode === 'elimination' ? 'defeat the opposing squad' : 'hold the signal post or defeat the opposing squad'}`);
}
export function createGame(seed = 1, options = {}) {
  const config = normalizeConfig(options);
  const forms = config.teamSizes.map((size, team) => {
    const explicit = options.forms?.[team];
    if (explicit !== undefined) {
      if (!Array.isArray(explicit) || explicit.length !== size || explicit.some(id => !validForm(id))) throw new RangeError('Every fighter needs a valid form');
      return [...explicit];
    }
    if (team === 1) return enemyFormsForRound(seed, 1, size, config.opponentForm);
    return Array(size).fill(validForm(options.form) ? options.form : 'shii_cho');
  });
  const g = {
    config, seed, rngState: hashSeed(seed), round: 1, score: [0, 0], draws: 0, history: [], mutations: [],
    terrainChoice: config.terrain, autoCommand: options.mode === 'spectate' || options.mode === 'play' ? options.autoCommand !== false : !!options.autoCommand,
    doctrines: [options.doctrine, options.enemyDoctrine].map(id => validDoctrine(id) ? id : 'balanced'),
    mastery: config.teamSizes.map(size => Array.from({ length: size }, () => createMastery())),
    forms, careers: config.teamSizes.map((size, team) => Array.from({ length: size }, () => createCareer(SOLDIER_GRADES.find(grade => grade.label === config.startingRanks[team]).threshold))),
    records: { origin: 'saberfront', teams: [record(), record()], soldiers: [0, 1].flatMap(team => Array.from({ length: config.teamSizes[team] }, (_, lane) => ({ id: soldierId(team, lane), team, lane, ...record() }))) },
    roundReport: null, loadouts: config.teamSizes.map((size, team) => {
      const weapon = `${config.startingForceQuality[team] === 'standard' ? '' : config.startingForceQuality[team] + '_'}${config.startingForceFamily[team]}`;
      const meleeWeapon = `${config.startingSaberQuality[team] === 'standard' ? '' : config.startingSaberQuality[team] + '_'}saber`;
      return { weaponTier: WEAPONS[weapon].quality, knifeTier: KNIVES[meleeWeapon].quality, roster: Array.from({ length: size }, () => ({ weapon, meleeWeapon })) };
    }),
    veterans: config.teamSizes.map(size => Array(size).fill(0)),
  };
  populateRound(g); return g;
}
/** Migration supplies valid current persistent fields; no evolution or score increment. */
export function rebuildRound(g) { populateRound(g); return g; }
export function setDoctrine(g, id, team = 0) {
  if (!g || !['playing', 'ended'].includes(g.status) || !validDoctrine(id) || ![0, 1].includes(team)) return false;
  if (g.doctrines[team] === id) return true;
  g.doctrines[team] = id; g.squads[team].doctrine = id;
  if (g.status === 'playing') event(g, 'doctrine', team, `${team === 0 ? 'Blue' : 'Red'} doctrine: ${DOCTRINES[id].name}`);
  return true;
}
function setTeamTactic(g, key, catalog, id, team) {
  if (!g || !['playing', 'ended'].includes(g.status) || ![0, 1].includes(team) || typeof id !== 'string' || !Object.hasOwn(catalog, id)) return false;
  if (g.config[key][team] === id) return true;
  g.config[key][team] = id;
  if (g.status === 'playing') event(g, 'tactics', team, `${team === 0 ? 'Blue' : 'Red'} ${key === 'formations' ? 'formation' : 'target priority'}: ${catalog[id].name ?? id}`);
  return true;
}
export function setFormation(g, id, team = 0) { return setTeamTactic(g, 'formations', FORMATIONS, id, team); }
export function setTargetPriority(g, id, team = 0) { return setTeamTactic(g, 'targetPriorities', TARGET_PRIORITIES, id, team); }
/** Deployment changes only affect the next round, never teleport a living squad. */
export function setDeployment(g, id, team = 0) {
  if (!g || g.status !== 'ended' || ![0, 1].includes(team) || !Object.hasOwn(DEPLOYMENTS, id)) return false;
  g.config.deployments[team] = id; return true;
}
export function setForm(g, lane, id, team = 0) {
  if (!g || !['playing', 'ended'].includes(g.status) || !validForm(id) || ![0, 1].includes(team) || !Number.isInteger(lane) || lane < 0 || lane >= g.config.teamSizes[team]) return false;
  if (team === 1) { g.config.opponentMode = 'fixed'; g.config.opponentForm = null; }
  if (g.forms[team][lane] === id) return true;
  g.forms[team][lane] = id;
  const s = g.soldiers.find(s => s.team === team && s.lane === lane);
  s.form = id; s.role = FORMS[id].trait; s.technique = FORMS[id].technique.name;
  // A changed form starts its own repertoire; an in-flight attack retains its recorded form.
  s.comboIndex = 0; s.comboBeat = 0; s.comboUntil = 0; s.lastSaberMoveId = null; s.saberSequence = 0;
  if (g.status === 'playing') event(g, 'form', team, `${s.name}: ${FORMS[id].name}`);
  return true;
}
export function setAutoCommand(g, enabled, team = 0) {
  if (!g || g.status !== 'playing' || ![0, 1].includes(team)) return false;
  if (team === 0) g.autoCommand = !!enabled;
  g.commandState[team].manual = !enabled;
  g._nextAiDecision = Math.min(g._nextAiDecision, g.tick + 1);
  event(g, 'command', team, enabled ? 'Auto-command engaged' : 'Manual command engaged'); return true;
}
function setOrder(g, team, order, reissue = false) {
  const key = team === 0 ? 'playerOrder' : 'enemyOrder', previous = g[key];
  g[key] = order; g.squads[team].order = order;
  if (previous === order && !reissue) return;
  const friends = aliveTeam(g, team), old = g.commandState[team];
  const anchor = order === 'regroup' ? nearestWalkablePoint(g.terrain, {
    x: average(friends, 'x') - (team === 0 ? 1 : -1) * 70, y: average(friends, 'y'),
  }) : order === 'flank' ? { x: g.terrain.objective.x, y: g.terrain.objective.y } : null;
  g.commandState[team] = { issuedTick: g.tick, anchor, flankReached: [], manual: old.manual, flankUsed: old.flankUsed || order === 'flank' };
  for (const s of aliveTeam(g, team)) { s.bank = nearestBank(g, s); s.holdBank = s.bank; s.nextMoveTick = Math.min(s.nextMoveTick, g.tick + s.lane * 4); }
  event(g, 'order', team, `${team === 0 ? 'Blue' : 'Red'}: ${order}`);
}
const commandGoals = new WeakMap();
function commandPlan(g, s) {
  const order = s.team === 0 ? g.playerOrder : g.enemyOrder;
  if (!['flank', 'regroup'].includes(order) || s.rallying || controlled(g, s)) return null;
  const state = g.commandState[s.team];
  if (order === 'flank' && (state.flankReached.includes(s.id) || g.tick - state.issuedTick >= 12 * TICK_RATE)) return null;
  let teams = commandGoals.get(g); if (!teams) { teams = []; commandGoals.set(g, teams); }
  let cached = teams[s.team];
  if (!cached || cached.state !== state || cached.terrain !== g.terrain || cached.formation !== g.config.formations[s.team]) {
    cached = { state, terrain: g.terrain, formation: g.config.formations[s.team], plans: new Map() }; teams[s.team] = cached;
  }
  if (!cached.plans.has(s.id)) cached.plans.set(s.id, commandDestination({ terrain: g.terrain, team: s.team, lane: s.lane,
    formation: cached.formation, order, actor: s, anchor: state.anchor, flankReady: false }));
  return cached.plans.get(s.id);
}
function updateCommandProgress(g) {
  for (const team of [0, 1]) {
    if ((team === 0 ? g.playerOrder : g.enemyOrder) !== 'flank') continue;
    const state = g.commandState[team];
    for (const s of aliveTeam(g, team)) {
      if (controlled(g, s) || state.flankReached.includes(s.id)) continue;
      const plan = commandPlan(g, s);
      // A blocked or interrupted staging route cannot keep a fighter circling forever.
      if (plan && dist(s, plan.destination) <= 24) state.flankReached.push(s.id);
      if (!plan || state.flankReached.includes(s.id)) s.bank = s.holdBank = 2;
    }
  }
}
/** Read-only team status. Public anchor geometry reveals no hidden opponents. */
export function commandIntent(g, team = 0) {
  if (!g || ![0, 1].includes(team)) return null;
  const order = team === 0 ? g.playerOrder : g.enemyOrder, state = g.commandState[team];
  const actors = g.soldiers.filter(s => s.alive && s.team === team && !controlled(g, s));
  const completed = actors.filter(s => state.flankReached.includes(s.id)).length;
  return { order, label: SQUAD_ORDERS[order].name, reason: order === 'flank'
    ? `${completed}/${actors.length} reached the side approach. ${g.tick - state.issuedTick >= 12 * TICK_RATE ? 'Staging time expired; advance continues.' : 'Advance after arrival or 12 seconds.'} Defense and relic duties take priority.`
    : order === 'regroup' ? 'Assemble behind the current front. Defend locally; the relic carrier keeps delivering.' : SQUAD_ORDERS[order].description,
    eligible: g.status === 'playing' ? actors.length : 0, auto: team === 0 ? g.autoCommand : !state.manual,
    anchor: state.anchor ? { ...state.anchor } : null, completed, total: actors.length };
}
function supportActors(g, team, kind) {
  if (kind === 'force' && !permitsForceAttacks(g.config)) return [];
  return aliveTeam(g, team).filter(s => {
    if (controlled(g, s) || kind === 'force' && isRelicCarrier(g, s) || s.attack || s.staggerUntil > g.tick || s.pinned || s.rallying) return false;
    const target = selectTarget(g, s);
    if (!target) return false;
    const context = tacticalContext(g, s, target);
    if (kind === 'guard') return s.guardUntil <= g.tick && s.energy >= 8 + context.guardCost && (context.distance < 125 || context.threatKind !== null);
    return chooseAction({ ...context, forceRequested: true }).action === 'force';
  });
}
/** Read-only command eligibility, shared by the UI and command execution. */
export function commandReadiness(g, order, team = 0) {
  if (!g || g.status !== 'playing') return { ready: false, reason: 'Battle is not active', eligible: 0 };
  if (!['force', 'guard'].includes(order) || ![0, 1].includes(team)) return { ready: false, reason: 'Unknown support command', eligible: 0 };
  if (order === 'force' && !permitsForceAttacks(g.config)) return { ready: false, reason: 'Force attacks are disabled by Saber only', eligible: 0 };
  const key = team === 0 ? `${order}Cooldown` : `ai${order[0].toUpperCase()}${order.slice(1)}Cooldown`;
  if (g[key] > 1e-8) return { ready: false, reason: `Ready in ${Math.ceil(g[key])}s`, eligible: 0 };
  const eligible = supportActors(g, team, order).length;
  return { ready: eligible > 0, reason: eligible ? `${eligible} fighter${eligible === 1 ? '' : 's'} ready` : order === 'force' ? 'No safe, ready cast in range' : 'No ready fighter facing a threat', eligible };
}
function support(g, team, kind) {
  const key = team === 0 ? `${kind}Cooldown` : `ai${kind[0].toUpperCase()}${kind.slice(1)}Cooldown`;
  if (g[key] > 1e-8) return false;
  const friends = supportActors(g, team, kind);
  if (!friends.length) return false;
  for (const s of friends) {
    if (kind === 'force') { s.tacticalReason = 'Use requested Force cast'; startAttack(g, s, selectTarget(g, s), 'force'); }
    else { s.energy -= 8; s.guardUntil = g.tick + 120; s.tacticalReason = 'Honor guard order'; }
  }
  if (phaseCaches.has(g)) resetPhase(g);
  g[key] = kind === 'force' ? 6 : 7;
  event(g, kind, team, `${team === 0 ? 'Blue' : 'Red'}: ${kind === 'force' ? 'Force surge' : 'Guard stance'}`); return true;
}
export function command(g, order, team = 0) {
  if (!g || g.status !== 'playing' || ![0, 1].includes(team) || !aliveTeam(g, team).some(s => !controlled(g, s))) return false;
  if (['force', 'wave', 'grenade'].includes(order)) return support(g, team, 'force');
  if (['guard', 'barrier', 'smoke'].includes(order)) return support(g, team, 'guard');
  if (!Object.hasOwn(SQUAD_ORDERS, order)) return false;
  if (team === 0) g.autoCommand = false;
  g.commandState[team].manual = true; setOrder(g, team, order, true); return true;
}
function selectTarget(g, s) {
  const cache = phaseCaches.get(g)?.targets; if (cache?.has(s.id)) return cache.get(s.id);
  let best = null, bestScore = Infinity;
  const priority = g.config.targetPriorities[s.team];
  const carrier = g.config.matchMode === 'relic' && g.objective.state === 'carried' ? g.soldiers.find(enemy => enemy.id === g.objective.carrierId && enemy.alive && enemy.team !== s.team) : null;
  if (carrier && sees(g, s, carrier)) { cache?.set(s.id, carrier); return carrier; }
  for (const enemy of aliveTeam(g, 1 - s.team)) {
    if (!sees(g, s, enemy)) continue;
    const range = dist(s, enemy), score = targetScore({ distance: range, hp: enemy.hp, maxHp: enemy.maxHp, energy: enemy.energy,
      staggerTicks: Math.max(0, enemy.staggerUntil - g.tick), currentTarget: enemy.id === s.target,
      objectiveDistance: dist(enemy, g.objective), objectiveRadius: g.objective.radius, visible: true }, priority);
    if (score < bestScore) { bestScore = score; best = enemy; }
  }
  cache?.set(s.id, best); return best;
}
/** A threat must actually reach this actor; unrelated windups are not reads. */
function incomingThreats(g, s, reactedOnly = false) {
  const cache = phaseCaches.get(g)?.threats, key = `${s.id}:${reactedOnly}`; if (cache?.has(key)) return cache.get(key);
  const skill = combatSkillProfile(s.career);
  if (reactedOnly) { const read = incomingThreats(g, s).filter(enemy => g.tick - enemy.attack.startedTick >= skill.reactionTicks); cache?.set(key, read); return read; }
  const result = [];
  for (const enemy of aliveTeam(g, 1 - s.team)) {
    const attack = enemy.attack;
    if (!attack || attack.resolveTick < g.tick || !sees(g, s, enemy)) continue;
    const weapon = attack.kind === 'saber' ? KNIVES[attack.weapon] : forceAbilityWeapon(WEAPONS[attack.weapon], attack.abilityId);
    const area = attack.kind === 'force' && ['repulse', 'sweep'].includes(weapon.mechanic);
    if (attack.target !== s.id && !area) continue;
    const reach = attack.kind === 'saber' ? weapon.range + FORMS[attack.form].reachBonus + (attack.moveId ? selectFormMove(attack.form, attack.comboIndex || 0).reachBonus : 0) + 12 : weapon.range;
    if (dist(s, enemy) > reach || !unobstructed(g, enemy, s, attack.kind)) continue;
    if (area && !areaContains(enemy, s, attack, weapon)) continue;
    result.push(enemy);
  }
  result.sort((a, b) => a.attack.resolveTick - b.attack.resolveTick || a.id.localeCompare(b.id)); cache?.set(key, result); return result;
}
function recoveryTicks(g, enemy) {
  const form = formFor(enemy), skill = combatSkillProfile(enemy.career);
  const energyWait = cost => Math.ceil(Math.max(0, cost - enemy.energy) / form.energyRegen * TICK_RATE);
  return Math.max(0, enemy.staggerUntil - g.tick, enemy.attack ? enemy.attack.resolveTick - g.tick : 0,
    Math.min(Math.max(0, enemy.saberReadyTick - g.tick, energyWait(8 * skill.energyEfficiency)),
      permitsForceAttacks(g.config) ? Math.max(0, enemy.forceReadyTick - g.tick, energyWait(WEAPONS[enemy.weapon].energyCost * form.forceCostMultiplier * skill.energyEfficiency)) : Infinity));
}
function saberWindup(s, move, skill, counter) {
  // An earned trained riposte uses the planted blade instead of spending its
  // short counter window on a fresh voluntary leap. Ordinary attacks still jump.
  const jump = counter && skill.skill >= .28 ? null : trainedJumpSpec(move?.jump, skill);
  return Math.max(jump ? jump.durationTicks / TICK_RATE * .90 : 0,
    (counter ? .16 : .30) * formFor(s).attackIntervalMultiplier * (move?.windupMultiplier ?? 1) * skill.attackWindupMultiplier);
}
function combatSequence(g, s, target, skill = combatSkillProfile(s.career)) {
  const wield = saberWieldProfile(g.config, s), efficiency = skill.energyEfficiency * wield.energyMultiplier;
  return chooseCombatSequence({ formId: s.form, comboIndex: s.comboIndex || 0, comboLength: skill.comboLength, repertoireLength: getFormMoves(s.form).length, attackSequence: s.saberSequence || 0,
    lastMoveId: s.lastSaberMoveId || null, aerialRecoveryActive: g.tick < (s.aerialAttackReadyTick || 0), targetDistance: target ? dist(s, target) : 0,
    comboActive: s.comboUntil > g.tick, counterReady: s.counterUntil > g.tick,
    targetGuarding: !!target?.guard, targetEnergy: target?.energy ?? 100,
    targetStaggerTicks: target ? Math.max(0, target.staggerUntil - g.tick) : 0,
    targetRecoveryTicks: target ? recoveryTicks(g, target) : 0,
    nearbyEnemies: aliveTeam(g, 1 - s.team).filter(enemy => sees(g, s, enemy) && dist(s, enemy) < 125).length,
    threatCount: incomingThreats(g, s, true).filter(enemy => enemy.attack.resolveTick - g.tick <= 24).length,
    energy: s.energy / efficiency, energyReserve: skill.reserve / efficiency,
    lastOutcome: s.lastOutcome?.outcome, sameTarget: !s.lastOutcome || s.lastOutcome.targetId === target?.id,
    attackWindupMultiplier: skill.attackWindupMultiplier, combatSkill: skill.skill });
}
function tacticalContext(g, s, target) {
  const cache = phaseCaches.get(g)?.contexts, cacheKey = `${s.id}:${target?.id}`; if (cache?.has(cacheKey)) return cache.get(cacheKey);
  const form = formFor(s), saber = KNIVES[s.meleeWeapon], skill = combatSkillProfile(s.career), wield = saberWieldProfile(g.config, s);
  const sequence = combatSequence(g, s, target, skill), move = selectFormMove(s.form, sequence.index);
  const forceSituation = target && permitsForceAttacks(g.config) ? forceContext(g, s, target) : null;
  const ability = target && permitsForceAttacks(g.config) ? selectForceAbility(s, forceSituation) : null;
  const force = forceAbilityWeapon(WEAPONS[s.weapon], ability?.id);
  const enemyForm = target ? formFor(target) : null;
  const threats = incomingThreats(g, s), reacted = threats.filter(enemy => g.tick - enemy.attack.startedTick >= skill.reactionTicks);
  // A fresh faster strike cannot mask an older secondary attack already read.
  const threat = (reacted[0] || threats[0])?.attack;
  const nearby = aliveTeam(g, 1 - s.team).filter(e => sees(g, s, e) && dist(s, e) < 125);
  const secondary = reacted.filter(enemy => enemy.id !== target?.id);
  const otherRecovery = nearby.filter(enemy => enemy.id !== target?.id).map(enemy => recoveryTicks(g, enemy));
  const context = { targetVisible: !!target, saberLineOfSight: !!target && unobstructed(g, s, target, 'saber'), forceLineOfSight: !!target && unobstructed(g, s, target, 'force'), formId: s.form, energy: s.energy, saberReady: s.saberReadyTick <= g.tick && !(move.jump && s.airborne), forceReady: permitsForceAttacks(g.config) && s.forceReadyTick <= g.tick,
    saberRange: saber.range + form.reachBonus + move.reachBonus, forceRange: permitsForceAttacks(g.config) ? force.range : 0, distance: target ? dist(s, target) : Infinity,
    guardCost: form.blockCost * skill.energyEfficiency * skill.guardEnergyEfficiency * wield.blockCostMultiplier,
    forceCost: force.energyCost * form.forceCostMultiplier * skill.energyEfficiency, saberCost: move.energyCost * skill.energyEfficiency * wield.energyMultiplier, counterReady: s.counterUntil > g.tick,
    enemySaberRange: target ? KNIVES[target.meleeWeapon].range + enemyForm.reachBonus : 0,
    enemyRecoveryTicks: target ? recoveryTicks(g, target) : 0, enemyStaggerTicks: target ? Math.max(0, target.staggerUntil - g.tick) : 0, forceWindupTicks: ticks(force.windup),
    saberMoveIndex: sequence.index,
    saberWindupTicks: ticks(saberWindup(s, move, skill, s.counterUntil > g.tick)),
    threatCount: reacted.length, secondaryThreatTicks: secondary[0] ? secondary[0].attack.resolveTick - g.tick : Infinity,
    crowdRecoveryTicks: otherRecovery.length ? Math.min(...otherRecovery) : Infinity,
    nearbyAllies: aliveTeam(g, s.team).filter(friend => friend.id !== s.id && dist(s, friend) < 125).length,
    forceControlTargets: ability?.mechanic === 'repulse' ? forceSituation.repulseTargets : ability?.mechanic === 'sweep' ? forceSituation.sweepTargets : 0,
    guardOrdered: s.guardUntil > g.tick, forceRequested: s.forceRequestedUntil > g.tick,
    forceAbilityId: ability?.id ?? null, combatSkill: skill.skill, rankIndex: skill.rankIndex, reactionTicks: skill.reactionTicks,
    energyReserve: skill.reserve, parryWindowTicks: skill.parryWindowTicks,
    saberRecoveryTicks: Math.max(0, s.saberReadyTick - g.tick), comboReady: s.comboUntil > g.tick,
    threatAgeTicks: threat ? g.tick - threat.startedTick : 0,
    threatKind: threat?.kind ?? null, threatTicks: threat ? threat.resolveTick - g.tick : Infinity,
    enemyEnergy: target?.energy ?? 100, enemyStaggered: !!target && target.staggerUntil > g.tick,
    attackKind: target?.attack?.kind ?? null, nearbyEnemies: nearby.length,
    dashReady: !isRelicCarrier(g, s) && s.dashReadyTick <= g.tick, order: tacticalOrder(g, s) };
  cache?.set(cacheKey, context); return context;
}
/** Derived tactical intent; never mutates the game or consumes RNG. */
export function duelIntent(g, s) {
  if (s && controlled(g, s)) return playerIntent(g, s);
  if (!s?.alive) return { action: 'wait', move: 'hold', dash: false, reason: 'Fighter defeated', reserve: 0 };
  if (s.attack) return { action: 'wait', move: 'hold', dash: false, reason: 'Committed to attack', reserve: 0 };
  if (s.staggerUntil > g.tick || s.landingRecoveryUntil > g.tick || s.pinned || s.rallying) return { action: 'recover', move: 'hold', dash: false, reason: s.staggerUntil > g.tick ? 'Recover from stagger' : s.landingRecoveryUntil > g.tick ? 'Recover after landing' : s.pinned ? 'Recover from pressure' : 'Rally morale', reserve: 0 };
  const target = selectTarget(g, s), context = tacticalContext(g, s, target);
  const assignment = relicAssignment(g, s);
  if (assignment?.role === 'deliver') {
    const defense = chooseAction({ ...context, forceReady: false, guardOrdered: false });
    const defend = context.distance <= context.saberRange && (context.counterReady || context.enemyStaggered || context.threatKind !== null);
    return { ...defense, action: defend ? defense.action : context.threatKind !== null ? 'guard' : 'wait', move: 'objective', dash: false,
      reason: defend ? defense.reason : assignment.reason, targetId: target?.id ?? null };
  }
  if (assignment && context.order !== 'retreat') {
    // Retrieval and escort goals remain authoritative outside immediate saber combat.
    const decision = chooseAction({ ...context, order: 'advance', forceReady: assignment.role === 'retrieve' ? false : context.forceReady });
    return { ...decision, reason: context.distance > context.saberRange + 12 ? assignment.reason : decision.reason, targetId: target?.id ?? null };
  }
  // Finish a paid evasive step while the aimed attack still threatens its reach.
  if (s.dashUntil > g.tick && (context.threatKind !== null || context.nearbyEnemies > context.nearbyAllies + 1) && context.order !== 'retreat') {
    return { action: 'wait', move: 'evade', dash: false, reason: 'Finish evasive step', reserve: formFor(s).blockCost };
  }
  return { ...chooseAction(context), targetId: target?.id ?? null };
}
function playerTarget(g, s) {
  const chosen = g.soldiers.find(t => t.id === g.control.input.targetId && t.alive && t.team !== s.team);
  return chosen && sees(g, s, chosen) ? chosen : selectTarget(g, s);
}
function playerIntent(g, s) {
  const idle = { action: 'wait', move: 'manual', dash: false, reason: 'Player controlled', reserve: 0 };
  if (!s.alive || s.attack || s.staggerUntil > g.tick || s.landingRecoveryUntil > g.tick || s.pinned) return { ...idle, reason: !s.alive ? 'Fighter defeated' : s.attack ? 'Committed to attack' : 'Recover from landing, stagger or pressure' };
  const input = g.control.input, target = playerTarget(g, s), form = formFor(s);
  const distance = target ? dist(s, target) : Infinity;
  const context = tacticalContext(g, s, target);
  idle.abilityId = context.forceAbilityId; idle.moveIndex = context.saberMoveIndex;
  if (input.attack && context.saberReady && s.energy >= context.saberCost && distance <= context.saberRange && context.saberLineOfSight) idle.action = 'saber';
  else if (input.force && context.forceReady && s.energy >= context.forceCost && distance <= context.forceRange && context.forceLineOfSight) idle.action = 'force';
  idle.dash = !isRelicCarrier(g, s) && input.dash && (input.moveX !== 0 || input.moveY !== 0) && s.dashReadyTick <= g.tick && s.energy >= form.dashCost;
  idle.targetId = target?.id ?? null;
  idle.reason = idle.action === 'wait' ? input.guard ? 'Player guard' : 'Player controlled' : `Player ${idle.action}`;
  return idle;
}
function summarize(g) {
  for (const team of [0, 1]) {
    const friends = aliveTeam(g, team), squad = g.squads[team];
    squad.morale = average(friends, 'morale'); squad.suppression = average(friends, 'suppression');
    squad.readiness = friends.length ? friends.filter(s => !s.pinned && s.staggerUntil <= g.tick && s.energy >= 8).length / friends.length : 0;
  }
  const blue = aliveTeam(g, 0), red = aliveTeam(g, 1);
  if (blue.length && red.length) g.frontLine = clamp((average(blue, 'x') + average(red, 'x')) / 2, 80, g.terrain.width - 80);
}
function updateCommanders(g) {
  if (g.tick < g._nextAiDecision) return;
  g._nextAiDecision = g.tick + 60;
  for (const team of [0, 1]) {
    const friends = aliveTeam(g, team), enemies = aliveTeam(g, 1 - team), squad = g.squads[team];
    if (!friends.length || !enemies.length) continue;
    const autonomous = team === 0 ? g.autoCommand : !g.commandState[team].manual;
    let order = team === 0 ? g.playerOrder : g.enemyOrder, tactic = order === 'advance' ? 'close' : order === 'retreat' ? 'withdraw' : 'guard';
    if (autonomous) {
      const visibleEnemies = enemies.filter(e => friends.some(s => sees(g, s, e)));
      const pressured = squad.suppression > (g.doctrines[team] === 'guard' ? 48 : 64), close = visibleEnemies.some(e => friends.some(s => sees(g, s, e) && dist(s, e) < 100));
      const exhausted = average(friends, 'energy') < 24, objectivePressure = g.config.matchMode === 'elimination' || g.objective.owner !== team || g.objective.points[1 - team] > g.objective.points[team] + 3;
      const phase = Math.floor(g.time / 6) % 3;
      const commandState = g.commandState[team];
      // Learned squad maneuvers need several autonomous trained allies. This
      // symmetric gate neither reads hidden enemies nor changes singleton duels.
      const coordinated = g.config.mapSize !== 'legacy' && friends.filter(s => !controlled(g, s) && combatSkillProfile(s.career).skill >= .28).length >= 3;
      const staging = order === 'flank' && friends.some(s => !controlled(g, s) && !commandState.flankReached.includes(s.id)) && g.tick - commandState.issuedTick < 12 * TICK_RATE;
      const regrouping = order === 'regroup' && average(friends, 'energy') < 55 && g.tick - commandState.issuedTick < 6 * TICK_RATE;
      if (squad.morale < 36 || (exhausted && pressured)) { order = coordinated && squad.morale >= 36 ? 'regroup' : 'retreat'; tactic = 'rally'; }
      else if (close && visibleEnemies.some(e => e.staggerUntil > g.tick || e.energy < 15)) { order = 'advance'; tactic = 'counter'; }
      else if (pressured || (close && exhausted)) { order = 'hold'; tactic = 'guard'; }
      else if (regrouping) { order = 'regroup'; tactic = 'rally'; }
      else if (staging && !close) { order = 'flank'; tactic = 'flank'; }
      else if (coordinated && !commandState.flankUsed && !close && objectivePressure && g.config.matchMode !== 'relic' && phase === 0) { order = 'flank'; tactic = 'flank'; }
      else { order = objectivePressure && (phase !== 2 || g.time > 45 || g.doctrines[team] === 'assault') ? 'advance' : 'hold'; tactic = order === 'advance' ? 'close' : 'guard'; }
      setOrder(g, team, order); if (close || pressured) support(g, team, 'guard');
      // Queue requests; the common tactical snapshot chooses both sides before
      // any actor commits. Retrieval must not be stopped by a ranged command.
      const forceKey = team === 0 ? 'forceCooldown' : 'aiForceCooldown';
      if (g.time > 2 && g[forceKey] <= 1e-8) {
        const casters = supportActors(g, team, 'force').filter(s => relicAssignment(g, s)?.role !== 'retrieve');
        if (casters.length) { for (const s of casters) s.forceRequestedUntil = g.tick + 60; g[forceKey] = 6; }
      }
    }
    squad.tactic = tactic; if (team === 0) g.playerTactic = tactic; else g.enemyTactic = tactic;
  }
}
function physiology(g, s) {
  if (!s.alive) return;
  practice(s, s.form, 'ticks');
  const form = formFor(s), skill = combatSkillProfile(s.career);
  s.suppression = clamp(s.suppression - (s.cover ? 25 : 17) * skill.pressureRecoveryMultiplier * DT, 0, 100);
  s.morale = clamp(s.morale + (s.suppression > 65 ? -2 : s.rallying ? 8 : s.cover ? 3 : 1.1) * DT, 0, 100);
  if (!s.pinned && s.suppression >= 76) { s.pinned = true; s.pinnedAtTick = g.tick; }
  if (s.pinned && (s.suppression < 38 || g.tick - s.pinnedAtTick > 150)) s.pinned = false;
  if (!s.rallying && s.morale < 24) s.rallying = true;
  if (s.rallying && s.morale >= 55) s.rallying = false;
  s.energy = Math.min(s.maxEnergy, s.energy + form.energyRegen * (s.attack ? .45 : 1) * DT);
  s.attackCooldown = Math.max(0, (s.saberReadyTick - g.tick) / TICK_RATE); s.forceCooldown = Math.max(0, (s.forceReadyTick - g.tick) / TICK_RATE);
  s.contributors = s.contributors.filter(c => c.tick >= g.tick - ticks(ASSIST_WINDOW));
  s.guard = !s.attack && s.staggerUntil <= g.tick && s.energy >= form.blockCost * skill.energyEfficiency * skill.guardEnergyEfficiency * saberWieldProfile(g.config, s).blockCostMultiplier && (!controlled(g, s) || g.control.input.guard);
  s.combatState = s.staggerUntil > g.tick ? 'stagger' : s.attack ? s.attack.kind : s.counterUntil > g.tick ? 'counter' : s.guard ? 'guard' : 'ready';
}
/** Local footwork scores real reachable directions. It never relocates an actor,
 * sees hidden foes, overrides retreat, or grants an invulnerable dodge. */
function crowdFootwork(g, s, target, mode) {
  const enemies = aliveTeam(g, 1 - s.team).filter(enemy => sees(g, s, enemy) && dist(s, enemy) < 160);
  const length = Math.max(1, dist(s, target)), nx = (s.x - target.x) / length, ny = (s.y - target.y) / length;
  if (enemies.length < 2 && mode === 'evade') return { x: s.x + nx * 65, y: s.y + ny * 65 };
  let awayX = 0, awayY = 0;
  for (const enemy of enemies) { const distance = Math.max(16, dist(s, enemy)); awayX += (s.x - enemy.x) / (distance * distance); awayY += (s.y - enemy.y) / (distance * distance); }
  const away = Math.hypot(awayX, awayY); if (away > 1e-8) { awayX /= away; awayY /= away; } else { awayX = nx; awayY = ny; }
  const reach = KNIVES[s.meleeWeapon].range + formFor(s).reachBonus;
  const candidates = mode === 'evade' ? [
    { x: s.x + awayX * 70, y: s.y + awayY * 70 },
    { x: s.x + (awayX - awayY) * 50, y: s.y + (awayY + awayX) * 50 },
    { x: s.x + (awayX + awayY) * 50, y: s.y + (awayY - awayX) * 50 },
  ] : [-1, 1].map(side => ({ x: target.x + (nx * .90 - ny * side * .44) * Math.max(reach * .9, length), y: target.y + (ny * .90 + nx * side * .44) * Math.max(reach * .9, length) }));
  let best = { x: s.x, y: s.y }, bestScore = -Infinity;
  for (const proposed of candidates) {
    const bounds = worldBounds(g), bounded = { x: clamp(proposed.x, bounds.minX, bounds.maxX), y: clamp(proposed.y, bounds.minY, bounds.maxY) };
    const point = g.config.mapSize === 'legacy' ? bounded : moveSwept(g.terrain, s, bounded);
    const moved = dist(s, point); if (moved < 1) continue;
    let score = moved * .03;
    for (const enemy of enemies) { const d = dist(point, enemy); score += Math.min(100, d) * (enemy.id === target.id && mode === 'circle' ? .12 : 1); if (d < 32) score -= 45; }
    if (mode === 'circle') score -= Math.abs(dist(point, target) - reach * .93) * 1.8;
    if (g.config.mapSize !== 'legacy') score -= terrainAt(g.terrain, point).damagePerSecond * 25;
    if (score > bestScore) { best = point; bestScore = score; }
  }
  return best;
}
// Approach assignments share the movement phase's immutable positions and
// decisions. Derived plans never enter saves or survive movement/death changes.
function teamApproaches(g, team, decisions) {
  const cache = phaseCaches.get(g)?.squadPlans;
  if (cache?.has(team)) return cache.get(team);
  const actors = [];
  const order = team === 0 ? g.playerOrder : g.enemyOrder;
  if (g.status === 'playing' && g.config.mapSize !== 'legacy' && !['retreat', 'regroup'].includes(order)) {
    for (const s of aliveTeam(g, team)) {
      // Coordinated encirclement is learned with the same training threshold as
      // deliberate threat reads. Recruits keep ordinary formation movement;
      // this rule is symmetric and never inspects opponent rank or outcomes.
      if (combatSkillProfile(s.career).skill < .28) continue;
      if (controlled(g, s) || s.attack || s.airborne || s.pinned || s.rallying ||
          s.staggerUntil > g.tick || s.landingRecoveryUntil > g.tick || relicAssignment(g, s)) continue;
      if (order === 'flank' && g.tick - g.commandState[team].issuedTick < 12 * TICK_RATE && !g.commandState[team].flankReached.includes(s.id)) continue;
      const decision = decisions?.get(s.id) ?? duelIntent(g, s);
      if (decision.move !== 'close') continue;
      const target = selectTarget(g, s);
      if (!target || !(tacticalOrder(g, s) === 'advance' ? s.bank === 2 || dist(s, target) < 190 : dist(s, target) < 125)) continue;
      const reach = KNIVES[s.meleeWeapon].range + formFor(s).reachBonus + Math.min(0, selectFormMove(s.form, decision.moveIndex || 0).reachBonus);
      actors.push({ id: s.id, lane: s.lane, x: s.x, y: s.y, reach, target: { id: target.id, x: target.x, y: target.y } });
    }
  }
  const plans = actors.length > 1 ? planEngagementPositions({ terrain: g.terrain, formation: g.config.formations[team], team, actors }) : new Map();
  for (const actor of actors) {
    const plan = plans.get(actor.id);
    if (plan) plans.set(actor.id, { ...plan, targetId: actor.target.id });
  }
  cache?.set(team, plans);
  return plans;
}
/** Current squad positioning readout; pure and independent of inspection order. */
export function squadIntent(g, s) {
  if (!g || !s?.alive || !g.soldiers.includes(s)) return null;
  const plan = teamApproaches(g, s.team).get(s.id);
  return plan ? { ...plan } : null;
}
function moveSoldier(g, s, decision) {
  if (!s.alive) return;
  if (s.airborne) { s.moving = true; s.stance = 'run'; return; }
  if (controlled(g, s)) return movePlayer(g, s, decision);
  const enemy = selectTarget(g, s), form = formFor(s); s.target = enemy?.id || null;
  const order = tacticalOrder(g, s);
  let destination = node(g, s.team, order === 'retreat' ? 0 : s.holdBank, s.lane);
  // A compact selected cut needs a closer approach than the base blade measure.
  // Longer-reach moves may still use the ordinary conservative approach.
  const reach = KNIVES[s.meleeWeapon].range + form.reachBonus + Math.min(0, selectFormMove(s.form, decision.moveIndex || 0).reachBonus);
  if (order === 'advance') {
    if (dist(s, node(g, s.team, s.bank, s.lane)) < 5 && s.bank < 2 && !s.pinned && g.tick >= s.nextMoveTick && (Math.floor(g.tick / 100) % 2 === s.lane % 2 || aliveTeam(g, s.team).length <= 2)) { s.bank++; s.nextMoveTick = g.tick + 110; }
    destination = node(g, s.team, s.bank, s.lane); s.holdBank = s.bank;
    if (!enemy && s.bank === 2 && g.config.mapSize !== 'legacy') destination = formationObjectiveDestination(g.terrain, g.objective, s.team, s.lane, g.config.formations[s.team]);
    if (enemy && (s.bank === 2 || dist(s, enemy) < 190)) destination = { x: enemy.x - (s.team === 0 ? 1 : -1) * reach * .72, y: enemy.y };
  } else if (order === 'hold' && enemy && dist(s, enemy) < 125) destination = { x: enemy.x - (s.team === 0 ? 1 : -1) * reach * .8, y: enemy.y };
  const approach = phaseCaches.get(g)?.squadPlans.get(s.team)?.get(s.id);
  if (approach && enemy?.id === approach.targetId) destination = approach;
  // Tactical footwork applies locally; strategic retreat remains authoritative.
  if (enemy && order !== 'retreat' && (dist(s, enemy) < 190 || tacticalContext(g, s, enemy).threatKind !== null)) {
    if (decision.move === 'hold') destination = { x: s.x, y: s.y };
    else if (decision.move === 'evade' || decision.move === 'circle') destination = crowdFootwork(g, s, enemy, decision.move);
    else if (decision.move === 'space') {
      const length = Math.max(1, dist(s, enemy)), desired = reach + 5 + 10 * (1 - combatSkillProfile(s.career).footwork);
      destination = { x: enemy.x + (s.x - enemy.x) / length * desired, y: enemy.y + (s.y - enemy.y) / length * desired };
    }
    else if (decision.move === 'close' && !approach && s.observation?.targetId === enemy.id) {
      const lead = combatSkillProfile(s.career).predictionSeconds;
      destination = { x: destination.x + s.observation.vx * lead, y: destination.y + s.observation.vy * lead };
    }
  }
  // A stand-off point can lie on the wrong side of a barricade. Route through
  // an actual approach to the opponent until a clear saber angle is available.
  if (enemy && !approach && dist(s, enemy) < 190 && order !== 'retreat' && decision.move === 'close' && !unobstructed(g, s, enemy, 'saber')) destination = { x: enemy.x, y: enemy.y };
  const plan = commandPlan(g, s);
  if (plan) {
    // Follow a fixed public route or assembly point, while immediate defensive
    // footwork remains legal. No enemy can drag the staging goal across the map.
    const localDefense = enemy && (dist(s, enemy) <= reach + 12 || tacticalContext(g, s, enemy).threatKind !== null)
      && ['hold', 'evade', 'circle', 'space'].includes(decision.move);
    if (!localDefense) destination = plan.destination;
    else if (order === 'retreat') destination = ['evade', 'circle'].includes(decision.move)
      ? crowdFootwork(g, s, enemy, decision.move) : { x: s.x, y: s.y };
  }
  const assignment = relicAssignment(g, s);
  if (assignment && (assignment.role === 'deliver' || order !== 'retreat' && (s.team === 1 || g.autoCommand || order === 'advance'))) {
    destination = assignment.destination;
    // Carriers keep heading home. Others can evade or finish an immediate duel,
    // but a distant enemy cannot replace retrieval, escort or interception.
    if (assignment.role !== 'deliver' && enemy && dist(s, enemy) <= reach + 12 && unobstructed(g, s, enemy, 'saber')) {
      if (decision.move === 'hold') destination = { x: s.x, y: s.y };
      else if (decision.move === 'evade' || decision.move === 'circle') destination = crowdFootwork(g, s, enemy, decision.move);
    }
  }
  if (s.pinned || s.staggerUntil > g.tick || s.landingRecoveryUntil > g.tick || s.attack) destination = { x: s.x, y: s.y };
  if (enemy && decision.dash && !isRelicCarrier(g, s) && order !== 'retreat' && !s.attack && !s.pinned && s.staggerUntil <= g.tick && dist(s, enemy) < 210 && g.tick >= s.dashReadyTick && s.energy >= form.dashCost + tacticalContext(g, s, enemy).saberCost + decision.reserve) {
    s.energy -= form.dashCost; s.dashUntil = g.tick + 18; s.dashReadyTick = g.tick + ticks(form.dashCooldown);
    const jump = trainedJumpSpec(combatFormProfile(s.form).dashJump, combatSkillProfile(s.career));
    if (jump) { const length = Math.max(1, Math.hypot(destination.x - s.x, destination.y - s.y)); startAirborne(s, g.tick, { ...jump, directionX: (destination.x - s.x) / length, directionY: (destination.y - s.y) / length }); }
    effect(g, 'dash', s.x, s.y, s.team, { soldierId: s.id, form: s.form, motion: form.technique.motion });
  }
  const bounds = worldBounds(g);
  s.destinationX = clamp(destination.x, bounds.minX, bounds.maxX); s.destinationY = clamp(destination.y, bounds.minY, bounds.maxY);
  const dx = s.destinationX - s.x, dy = s.destinationY - s.y, length = Math.hypot(dx, dy); s.moving = length > 1.25;
  if (s.moving && !s.airborne) {
    const weather = getEnvironment(g);
    const dashing = !isRelicCarrier(g, s) && s.dashUntil > g.tick;
    const speed = (g.config.mapSize === 'legacy' ? 1 : dashing ? weather.dashMultiplier : weather.walkMultiplier) * (dashing ? 205 : order === 'retreat' ? 88 : 86) * (1 - s.suppression * .002) * (1 + s.rank * .015) * (['circle', 'evade', 'space'].includes(decision.move) ? 1 + .18 * combatSkillProfile(s.career).footwork : 1) * doctrineFor(g, s.team).moveMultiplier * carrierMoveMultiplier(g, s);
    const point = g.config.mapSize === 'legacy' ? { x: s.x + dx * Math.min(1, speed * DT / length), y: s.y + dy * Math.min(1, speed * DT / length) } : moveToward(g.terrain, s, { x: s.destinationX, y: s.destinationY }, speed * DT);
    s.x = clamp(point.x, bounds.minX, bounds.maxX); s.y = clamp(point.y, bounds.minY, bounds.maxY);
  }
  s.cover = inCover(g, s);
  if (enemy) s.facing = enemy.x >= s.x ? 1 : -1;
  s.melee = !!enemy && dist(s, enemy) <= reach;
  s.stance = s.staggerUntil > g.tick ? 'stagger' : s.attack ? s.attack.kind : s.moving ? 'run' : s.guard ? 'guard' : 'stand';
  s.state = s.staggerUntil > g.tick ? 'stagger' : s.attack ? 'firing' : s.moving ? 'moving' : s.cover ? 'covered' : 'ready';
}
function movePlayer(g, s, decision) {
  if (!s.alive) return;
  const input = g.control.input, form = formFor(s), target = playerTarget(g, s), bounds = worldBounds(g);
  s.target = target?.id ?? null;
  const locked = s.attack || s.staggerUntil > g.tick || s.landingRecoveryUntil > g.tick || s.airborne || s.pinned;
  const magnitude = Math.hypot(input.moveX, input.moveY), dx = magnitude ? input.moveX / Math.max(1, magnitude) : 0, dy = magnitude ? input.moveY / Math.max(1, magnitude) : 0;
  if (!locked && decision.dash && !isRelicCarrier(g, s)) { s.energy -= form.dashCost; s.dashUntil = g.tick + 18; s.dashReadyTick = g.tick + ticks(form.dashCooldown); const jump = trainedJumpSpec(combatFormProfile(s.form).dashJump, combatSkillProfile(s.career)); if (jump) startAirborne(s, g.tick, { ...jump, directionX: dx, directionY: dy }); effect(g, 'dash', s.x, s.y, s.team, { soldierId: s.id, form: s.form, motion: form.technique.motion }); }
  const weather = getEnvironment(g);
  const dashing = !isRelicCarrier(g, s) && s.dashUntil > g.tick;
  const speed = (g.config.mapSize === 'legacy' ? 1 : dashing ? weather.dashMultiplier : weather.walkMultiplier) * (dashing ? 205 : 86) * (1 - s.suppression * .002) * doctrineFor(g, s.team).moveMultiplier * carrierMoveMultiplier(g, s);
  const desired = { x: clamp(s.x + (locked || s.airborne ? 0 : dx * speed * DT), bounds.minX, bounds.maxX), y: clamp(s.y + (locked || s.airborne ? 0 : dy * speed * DT), bounds.minY, bounds.maxY) };
  const zone = g.config.mapSize === 'legacy' ? 1 : terrainAt(g.terrain, s).moveMultiplier;
  const adjusted = { x: s.x + (desired.x - s.x) * zone, y: s.y + (desired.y - s.y) * zone };
  const point = g.config.mapSize === 'legacy' ? adjusted : moveSwept(g.terrain, s, adjusted);
  s.moving = Math.hypot(point.x - s.x, point.y - s.y) > .001; s.x = point.x; s.y = point.y;
  s.destinationX = desired.x; s.destinationY = desired.y;
  s.cover = inCover(g, s);
  // A paid attack keeps its visible aim even if movement or target input changes.
  const committedTarget = s.attack && g.soldiers.find(other => other.id === s.attack.target);
  if (committedTarget) s.facing = committedTarget.x >= s.x ? 1 : -1;
  else if (!s.attack && dx) s.facing = dx > 0 ? 1 : -1;
  else if (!s.attack && target) s.facing = target.x >= s.x ? 1 : -1;
  s.melee = !!target && dist(s, target) <= KNIVES[s.meleeWeapon].range + form.reachBonus;
  s.stance = s.staggerUntil > g.tick ? 'stagger' : s.attack ? s.attack.kind : s.moving ? 'run' : s.guard ? 'guard' : 'stand';
  s.state = s.staggerUntil > g.tick ? 'stagger' : s.attack ? 'firing' : s.moving ? 'moving' : s.cover ? 'covered' : 'ready';
}
/** Simultaneous pair corrections avoid permanent crowd stacking; no RNG. */
function separateFighters(g) {
  if (g.config.mapSize === 'legacy') return;
  const active = g.soldiers.filter(s => s.alive);
  for (let pass = 0; pass < 2; pass++) {
    const offsets = active.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), minimum = UNIT_RADIUS * 2;
      if (distance >= minimum) continue;
      const nx = distance > 1e-8 ? dx / distance : 0, ny = distance > 1e-8 ? dy / distance : (i % 2 ? -1 : 1), push = (minimum - distance) * .5;
      // Squad movement cannot drag a manually controlled fighter. Route the
      // other actor around them; explicit combat knockback remains separate.
      const aShare = controlled(g, a) ? 0 : controlled(g, b) ? 2 : 1;
      const bShare = controlled(g, b) ? 0 : controlled(g, a) ? 2 : 1;
      offsets[i].x -= nx * push * aShare; offsets[i].y -= ny * push * aShare;
      offsets[j].x += nx * push * bShare; offsets[j].y += ny * push * bShare;
    }
    active.forEach((s, i) => { const point = moveSwept(g.terrain, s, { x: s.x + offsets[i].x, y: s.y + offsets[i].y }); s.x = point.x; s.y = point.y; });
  }
}
function startAttack(g, s, target, kind, plannedAbilityId = undefined, plannedMoveIndex = undefined) {
  if (kind === 'force' && !permitsForceAttacks(g.config)) return false;
  if (!s.alive || !target?.alive || target.team === s.team || s.attack || s.pinned || s.staggerUntil > g.tick || s.landingRecoveryUntil > g.tick || !sees(g, s, target) || !unobstructed(g, s, target, kind)) return false;
  const form = formFor(s), skill = combatSkillProfile(s.career), wield = saberWieldProfile(g.config, s);
  const comboIndex = kind === 'saber' ? Number.isInteger(plannedMoveIndex) && plannedMoveIndex >= 0 && plannedMoveIndex < getFormMoves(s.form).length ? plannedMoveIndex : combatSequence(g, s, target, skill).index : 0;
  const move = kind === 'saber' ? selectFormMove(s.form, comboIndex) : null;
  // A new acrobatic move needs its own real arc, never a borrowed dash landing.
  if (s.airborne?.controlSourceId || (move?.jump && s.airborne)) return false;
  const ability = kind === 'force' ? plannedAbilityId === undefined ? selectForceAbility(s, forceContext(g, s, target)) : forceAbilityById(plannedAbilityId) : null;
  const weapon = kind === 'saber' ? KNIVES[s.meleeWeapon] : forceAbilityWeapon(WEAPONS[s.weapon], ability?.id);
  const cost = (kind === 'saber' ? (move?.energyCost ?? 8) * wield.energyMultiplier : weapon.energyCost * form.forceCostMultiplier) * skill.energyEfficiency;
  if (s.energy < cost || (kind === 'saber' ? s.saberReadyTick : s.forceReadyTick) > g.tick || dist(s, target) > weapon.range + (kind === 'saber' ? form.reachBonus + (move?.reachBonus ?? 0) : 0)) return false;
  s.target = target.id; s.facing = target.x >= s.x ? 1 : -1;
  s.energy -= cost;
  const counter = kind === 'saber' && s.counterUntil > g.tick;
  const windup = kind === 'saber' ? saberWindup(s, move, skill, counter) : weapon.windup;
  const observation = s.observation?.targetId === target.id ? s.observation : null;
  const lead = Math.min(windup, skill.predictionSeconds);
  s.attack = { kind, target: target.id, startedTick: g.tick, resolveTick: g.tick + ticks(windup), counter, form: s.form, weapon: kind === 'saber' ? s.meleeWeapon : s.weapon,
    moveId: move?.id ?? null, comboIndex, abilityId: ability?.id ?? null, aimX: target.x + (observation?.vx || 0) * lead, aimY: target.y + (observation?.vy || 0) * lead };
  if (kind === 'saber' && wield.bladeCount === 2) Object.assign(s.attack, { dual: true, offhand: false, offhandResolveTick: s.attack.resolveTick + wield.offhandDelayTicks });
  if (kind === 'saber') { s.lastSaberMoveId = move?.id || null; s.saberSequence = ((s.saberSequence || 0) + 1) % 1000000; }
  if (move?.jump && !(counter && skill.skill >= .28) && !s.airborne && !isRelicCarrier(g, s)) { const length = Math.max(1, dist(s, target)), jump = trainedJumpSpec(move.jump, skill); if (startAirborne(s, g.tick, { ...jump, directionX: (target.x - s.x) / length, directionY: (target.y - s.y) / length })) s.aerialAttackReadyTick = g.tick + 110; }
  s.guard = false; s.combatState = kind; s.lastShotTick = g.tick;
  if (kind === 'saber') { s.saberReadyTick = g.tick + Math.max(ticks(windup) + 8 + (wield.bladeCount === 2 ? wield.offhandDelayTicks : 0), ticks(weapon.interval * form.attackIntervalMultiplier * (move?.recoveryMultiplier ?? 1) * s.career.modifiers.reloadMultiplier * skill.recoveryMultiplier * wield.recoveryMultiplier)); s.comboBeat = s.comboUntil > g.tick && s.lastOutcome?.targetId === target.id ? (s.comboBeat || 0) + 1 : 1; s.comboIndex = (comboIndex + 1) % getFormMoves(s.form).length; s.comboUntil = s.comboBeat < skill.comboLength ? s.saberReadyTick + 40 : 0; s.counterUntil = 0; g.stats.saberSwings[s.team]++; }
  else { s.forceReadyTick = g.tick + ticks(weapon.interval * s.career.modifiers.reloadMultiplier); s.forceRequestedUntil = 0; s.lastForceAbility = ability?.id ?? 'force_push'; s.forceAbilitySequence = (s.forceAbilitySequence || 0) + 1; g.stats.forceCasts[s.team]++; g.stats.shots[s.team]++; }
  s.attackCooldown = Math.max(0, (s.saberReadyTick - g.tick) / TICK_RATE);
  s.forceCooldown = Math.max(0, (s.forceReadyTick - g.tick) / TICK_RATE);
  effect(g, 'telegraph', s.x, s.y, s.team, { soldierId: s.id, targetId: target.id, form: s.form, kind, dual: !!s.attack.dual, offhand: false, comboIndex, moveId: move?.id ?? null, abilityId: ability?.id ?? null, motion: move?.motion ?? form.technique.motion, x2: s.attack.aimX, y2: s.attack.aimY, ttl: windup, maxTtl: windup });
  return true;
}
function attackFeedback(g, s, attack, target, outcome, damage = 0) {
  const isCounter = !!attack.counter && (outcome === 'hit' || outcome === 'blocked');
  const actual = rounded(Math.max(0, damage));
  const text = outcome === 'hit' ? `${isCounter ? 'Counter ' : ''}${actual}` : outcome === 'blocked' ? `Block ${actual}` :
    ({ miss: 'Miss', 'out-of-range': 'Out of reach', 'target-lost': 'Target lost', interrupted: 'Interrupted' }[outcome]);
  const payload = { outcome, damage: actual, kind: attack.kind, targetId: target?.id ?? null, tick: g.tick, isCounter };
  s.lastOutcome = payload;
  const extras = { ...payload, soldierId: s.id, form: attack.form, moveId: attack.moveId ?? null, abilityId: attack.abilityId ?? null, dual: !!attack.dual, offhand: !!attack.offhand, comboIndex: attack.comboIndex ?? 0, motion: attack.kind === 'saber' && attack.moveId ? selectFormMove(attack.form, attack.comboIndex || 0).motion : FORMS[attack.form].technique.motion,
    family: (attack.kind === 'saber' ? KNIVES[attack.weapon] : WEAPONS[attack.weapon]).family,
    x2: target?.x ?? s.x, y2: target?.y ?? s.y, counter: !!attack.counter };
  if (outcome !== 'interrupted') effect(g, attack.kind, s.x, s.y, s.team, extras);
  effect(g, 'feedback', outcome === 'interrupted' ? s.x : target?.x ?? s.x, outcome === 'interrupted' ? s.y : target?.y ?? s.y, s.team, { ...extras, text });
}
function collectAttack(g, s, impacts, decision) {
  if (!s.alive || s.staggerUntil > g.tick) return;
  if (s.attack) {
    if (g.tick < s.attack.resolveTick) return;
    const attack = s.attack, target = g.soldiers.find(e => e.alive && e.id === attack.target);
    s.attack = attack.dual && !attack.offhand ? { ...attack, offhand: true, resolveTick: attack.offhandResolveTick } : null;
    if (s.attack) { g.stats.saberSwings[s.team]++; if (target) { s.attack.aimX = target.x; s.attack.aimY = target.y; } }
    if (attack.kind === 'force' && !permitsForceAttacks(g.config)) { attackFeedback(g, s, attack, target, 'interrupted'); return; }
    if (attack.kind === 'force' && attack.abilityId === 'force_barrier') {
      const ability = forceAbilityById(attack.abilityId);
      effect(g, 'force', s.x, s.y, s.team, { soldierId: s.id, abilityId: ability.id, kind: 'force', x2: s.x, y2: s.y }); return;
    }
    if (attack.kind === 'force' && ['repulse', 'sweep'].includes(forceAbilityById(attack.abilityId)?.mechanic)) { collectAreaForce(g, s, attack, impacts); return; }
    if (!target || !sees(g, s, target)) { attackFeedback(g, s, attack, null, 'target-lost'); return; }
    const form = FORMS[attack.form], saber = attack.kind === 'saber', weapon = saber ? KNIVES[attack.weapon] : forceAbilityWeapon(WEAPONS[attack.weapon], attack.abilityId);
    const move = saber && attack.moveId ? selectFormMove(attack.form, attack.comboIndex || 0) : null;
    if (dist(s, target) > (saber ? weapon.range + form.reachBonus + (move?.reachBonus ?? 0) + 12 - (attack.offhand ? saberWieldProfile(g.config, s).offhandReachPenalty : 0) : weapon.range) || saber && !canMeleeHit(s, target, g.tick, 30 + (move?.reachBonus ?? 0))) { attackFeedback(g, s, attack, target, 'out-of-range'); return; }
    if (!unobstructed(g, s, target, attack.kind)) { attackFeedback(g, s, attack, target, 'out-of-range'); return; }
    if (!saber && Number.isFinite(attack.aimX)) {
      const ability = forceAbilityById(attack.abilityId);
      if (ability?.mechanic === 'throw' && Math.hypot(target.x - attack.aimX, target.y - attack.aimY) > 38) { attackFeedback(g, s, attack, target, 'miss'); return; }
      if (ability?.mechanic === 'sweep') {
        const aimed = Math.atan2(attack.aimY - s.y, attack.aimX - s.x), actual = Math.atan2(target.y - s.y, target.x - s.x);
        if (Math.abs(Math.atan2(Math.sin(actual - aimed), Math.cos(actual - aimed))) > ability.cone / 2) { attackFeedback(g, s, attack, target, 'miss'); return; }
      }
    }
    resolveContact(g, s, target, attack, weapon, move, impacts); return;
  }
  if (s.pinned || (!controlled(g, s) && s.rallying)) return;
  const target = g.soldiers.find(e => e.alive && e.id === decision.targetId);
  if (!target) return;
  if (decision.action === 'saber' || decision.action === 'force') startAttack(g, s, target, decision.action, decision.abilityId, decision.moveIndex);
  else if (decision.action === 'recover') s.combatState = 'recover';
}
/** Real contacts share the same contested defense, resource and record path. */
function resolveContact(g, s, target, attack, weapon, move, impacts) {
  const saber = attack.kind === 'saber', form = FORMS[attack.form], skill = combatSkillProfile(s.career);
  if (saber && Number.isFinite(attack.aimX)) {
    const aimed = Math.atan2(attack.aimY - s.y, attack.aimX - s.x), actual = Math.atan2(target.y - s.y, target.x - s.x);
    const error = Math.abs(Math.atan2(Math.sin(actual - aimed), Math.cos(actual - aimed)));
    if (error > (move?.arc ?? 1.2) / 2 + Math.atan2(12, dist(s, target))) { attackFeedback(g, s, attack, target, 'miss'); return; }
  }
  let accuracy = (saber ? .91 : weapon.accuracy) + s.career.modifiers.accuracyBonus + s.rank * .012 + doctrineFor(g, s.team).accuracyBonus - s.suppression * .0013;
  if (!saber) accuracy *= g.config.mapSize === 'legacy' ? (target.cover ? .86 : 1) : coverMultiplier(g.terrain, s, target);
  if (random(g) >= clamp(accuracy, .15, .97)) { attackFeedback(g, s, attack, target, 'miss'); return; }
  const wield = saberWieldProfile(g.config, s), targetWield = saberWieldProfile(g.config, target);
  let amount = weapon.damage * (saber ? form.damageMultiplier * (move?.damageMultiplier ?? 1) * (attack.counter ? form.counterMultiplier : 1) * (attack.dual ? attack.offhand ? wield.offhandDamageMultiplier : wield.primaryDamageMultiplier : 1) : 1);
  let suppression = saber ? (move?.pressure ?? 10) : weapon.suppression;
  const targetForm = formFor(target), targetSkill = combatSkillProfile(target.career), snapshot = defenseSnapshots.get(g)?.get(target.id);
  const kind = snapshot?.kind ?? target.attack?.kind;
  const read = g.tick - attack.startedTick >= targetSkill.reactionTicks && sees(g, target, s);
  const grounded = !target.airborne;
  // Landing recovery delays offense; a trained fighter already on the ground
  // may still read and pay for a defense. Reachable airborne frames stay exposed.
  const retained = kind === 'saber' && targetSkill.attackGuardRetention > 0 && read && grounded && (!controlled(g, target) || g.control.input.guard);
  const eligible = target.staggerUntil <= g.tick && !target.pinned && kind !== 'force' && (target.guard || retained);
  const timed = eligible && read && (retained || target.lastGuardTick === g.tick || (!controlled(g, target) && targetSkill.skill >= .28 && grounded));
  const cost = targetForm.blockCost * targetSkill.energyEfficiency * targetSkill.guardEnergyEfficiency * targetWield.blockCostMultiplier;
  const pressure = snapshot?.threatCount ?? 1;
  const capacity = Math.min(1, targetSkill.threatCapacity / Math.max(1, pressure));
  let chance = targetForm.blockChance + targetWield.guardBonus + (target.guardUntil > g.tick ? .22 : 0) + (saber ? 0 : .10);
  if (timed) chance += targetSkill.parryBonus + targetSkill.defenseReadBonus - skill.precisionBonus
    + Math.max(0, targetSkill.skill - skill.skill) * Math.max(0, .40 - targetForm.blockChance);
  if (retained) chance -= .30 * (1 - targetSkill.attackGuardRetention);
  const blocked = eligible && target.energy >= cost && random(g) < clamp(chance * capacity, 0, .97);
  if (blocked) {
    target.energy -= cost;
    amount *= saber ? timed ? (.16 - .10 * targetSkill.skill) * targetSkill.parryChipMultiplier : .16 : .23 * (timed ? targetSkill.parryChipMultiplier : 1);
    suppression *= .35;
    target.counterUntil = g.tick + 55; target.saberReadyTick = Math.min(target.saberReadyTick, g.tick + 8); g.stats.blocks[target.team]++; practice(target, target.form, 'blocks');
    effect(g, 'block', target.x, target.y, target.team, { soldierId: target.id, form: target.form, x2: s.x, y2: s.y });
  }
  if (saber) { g.stats.saberHits[s.team]++; g.stats.knifeHits[s.team]++; } else { g.stats.forceHits[s.team]++; g.stats.hits[s.team]++; }
  if (attack.counter) g.stats.counters[s.team]++;
  if (!saber) applyForceMechanic(g, s, target, attack, weapon, blocked, impacts);
  if (target.barrierUntil > g.tick && target.barrierEnergy > 0 && permitsForceAttacks(g.config)) { const absorbed = Math.min(target.barrierEnergy, amount * .4); target.barrierEnergy -= absorbed; amount -= absorbed; }
  impacts.push({ target: target.id, source: s.id, amount, suppression, kind: attack.kind, feedback: { attack, outcome: blocked ? 'blocked' : 'hit' },
    stagger: !blocked && (!saber || attack.counter) ? (saber ? .24 * (move?.staggerMultiplier ?? 1) : weapon.stagger) : 0, push: !blocked && !saber ? weapon.knockback : 0 });
}
function areaContains(s, target, attack, weapon) {
  if (dist(s, target) > weapon.radius) return false;
  if (weapon.mechanic !== 'sweep') return true;
  const aimed = Math.atan2((attack.aimY ?? target.y) - s.y, (attack.aimX ?? target.x) - s.x), actual = Math.atan2(target.y - s.y, target.x - s.x);
  return Math.abs(Math.atan2(Math.sin(actual - aimed), Math.cos(actual - aimed))) <= weapon.cone / 2;
}
function collectAreaForce(g, s, attack, impacts) {
  const weapon = forceAbilityWeapon(WEAPONS[attack.weapon], attack.abilityId);
  const targets = aliveTeam(g, 1 - s.team).filter(other => areaContains(s, other, attack, weapon) && sees(g, s, other) && unobstructed(g, s, other, 'force'));
  if (!targets.length) { attackFeedback(g, s, attack, null, 'out-of-range'); return; }
  for (const target of targets) resolveContact(g, s, target, attack, weapon, null, impacts);
}
/** Force effects share ordinary energy, range, sight, damage and stagger rules. */
function forceContext(g, s, target) {
  const skill = combatSkillProfile(s.career), enemies = aliveTeam(g, 1 - s.team).filter(e => sees(g, s, e));
  const aimed = { aimX: target.x, aimY: target.y };
  const count = id => { const ability = forceAbilityById(id); return enemies.filter(e => areaContains(s, e, aimed, ability) && unobstructed(g, s, e, 'force')).length; };
  const threats = incomingThreats(g, s, true);
  return { distance: dist(s, target), nearbyEnemies: enemies.filter(e => dist(s, e) < 140).length,
    repulseTargets: count('force_repulse'), sweepTargets: count('force_sweep'), incomingThreats: threats.length,
    forceCostMultiplier: formFor(s).forceCostMultiplier * skill.energyEfficiency, baseWeapon: WEAPONS[s.weapon], barrierActive: s.barrierUntil > g.tick && s.barrierEnergy > 0,
    enemyCarrier: isRelicCarrier(g, target), incomingAttack: threats.length > 0, targetGuarding: target.guard, targetRecovering: target.staggerUntil > g.tick,
    targetAirborne: airborneHeight(target, g.tick) > 15, forceRequested: s.forceRequestedUntil > g.tick };
}
function applyForceMechanic(g, s, target, attack, weapon, blocked, impacts) {
  if (!permitsForceAttacks(g.config)) return;
  const ability = forceAbilityById(attack.abilityId);
  if (!ability) return;
  if (ability.mechanic === 'barrier') { s.barrierUntil = g.tick + ability.barrierTicks; s.barrierEnergy = ability.barrierEnergy; }
  if (ability.mechanic === 'throw') s.saberReadyTick = Math.max(s.saberReadyTick, g.tick + ability.saberDelayTicks);
  if (blocked) return;
  if (ability.mechanic === 'lightning') impacts.push({ target: target.id, source: s.id, amount: 0, energyDrain: ability.energyDrain });
  if (ability.mechanic === 'grip') {
    s.forceControl = { targetId: target.id, untilTick: g.tick + ability.controlTicks, releaseTick: g.tick + ability.controlTicks, kind: ability.id };
    if (startAirborne(target, g.tick, { durationTicks: ability.controlTicks, height: 42, distance: 0, recoveryTicks: 8, rotations: 0 })) target.airborne.controlSourceId = s.id;
  }

}
function pendingForce(g, impacts) {
  for (const s of g.soldiers) {
    const control = s.forceControl;
    const releaseControl = () => {
      const target = control && g.soldiers.find(t => t.id === control.targetId);
      if (target?.airborne?.controlSourceId === s.id) { target.airborne = null; target.airborneHeight = 0; }
      s.forceControl = null;
    };
    if (!permitsForceAttacks(g.config)) { releaseControl(); s.barrierUntil = 0; s.barrierEnergy = 0; continue; }
    if (!control) continue;
    const target = g.soldiers.find(t => t.id === control.targetId && t.alive), ability = forceAbilityById(control.kind);
    if (!s.alive || s.staggerUntil > g.tick || !target || !ability || dist(s, target) > ability.range || !sees(g, s, target) || !unobstructed(g, s, target, 'force')) { releaseControl(); continue; }
    if (g.tick >= control.releaseTick) { impacts.push({ target: target.id, source: s.id, amount: 0, suppression: 4, push: ability.releaseKnockback, kind: 'force' }); s.forceControl = null; effect(g, 'force', s.x, s.y, s.team, { soldierId: s.id, targetId: target.id, abilityId: ability.id, x2: target.x, y2: target.y }); }
  }
}
function observeOpponent(g, s) {
  if (!s.alive) return;
  const target = selectTarget(g, s), old = s.observation;
  if (!target) { s.observation = null; return; }
  const continuous = old?.targetId === target.id && old.tick === g.tick - 1;
  s.observation = { targetId: target.id, x: target.x, y: target.y, tick: g.tick,
    vx: continuous ? clamp((target.x - old.x) * TICK_RATE, -220, 220) : 0,
    vy: continuous ? clamp((target.y - old.y) * TICK_RATE, -220, 220) : 0 };
}
function creditRecord(g, s, key) {
  increment(s, key); increment(g.records.teams[s.team], key); increment(g.records.soldiers.find(r => r.id === s.id), key);
  g.stats[key][s.team] = Math.min(MAX_RECORD_COUNT, g.stats[key][s.team] + 1);
}
/** No RNG: batch HP settlement mutates g and returns deaths. Six seconds of actual
 * enemy damage chooses the killer (lexical ID ties); other recent contributors
 * assist. A lethal batch without enemy damage is environmental. Dead targets are
 * ignored; all HP commits before attribution, allowing mutual kills. */
export function resolveDamage(g, impacts = []) {
  if (!g || g.status !== 'playing' || !Array.isArray(impacts)) return { deaths: [] };
  const totals = new Map(), rewards = new Map(), clean = [];
  for (const hit of impacts) {
    const target = g.soldiers.find(s => s.id === hit?.target && s.alive); if (!target) continue;
    const amount = typeof hit.amount === 'number' && Number.isFinite(hit.amount) ? clamp(hit.amount, 0, 1e6) : 0;
    const pressure = typeof hit.suppression === 'number' && Number.isFinite(hit.suppression) ? clamp(hit.suppression, 0, 100) * doctrineFor(g, target.team).suppressionMultiplier * combatSkillProfile(target.career).pressureMultiplier : 0;
    const source = g.soldiers.find(s => s.id === hit.source && s.team !== target.team);
    clean.push({ target, source, amount, pressure, feedback: hit.feedback });
    const total = totals.get(target.id) || { damage: 0, pressure: 0, enemyDamage: 0, stagger: 0, pushX: 0, pushY: 0, energyDrain: 0 };
    total.energyDrain += Number.isFinite(hit.energyDrain) ? clamp(hit.energyDrain, 0, 100) : 0;
    total.damage += amount; total.pressure += pressure; if (source) total.enemyDamage += amount;
    total.stagger = Math.max(total.stagger, Number.isFinite(hit.stagger) ? clamp(hit.stagger, 0, .65) : 0);
    if (source && Number.isFinite(hit.push)) { const length = Math.max(1, dist(source, target)), push = clamp(hit.push, -32, 32); total.pushX += (target.x - source.x) / length * push; total.pushY += (target.y - source.y) / length * push; }
    totals.set(target.id, total);
  }
  for (const { target, source, amount, pressure, feedback } of clean) {
    if (!source) continue;
    const total = totals.get(target.id), removed = target.hp - Math.max(0, rounded(target.hp - total.damage));
    const damage = total.damage ? amount * removed / total.damage : 0, effectivePressure = total.pressure ? pressure * Math.min(100 - target.suppression, total.pressure) / total.pressure : 0;
    const creditedForm = validForm(feedback?.attack?.form) ? feedback.attack.form : source.form;
    if (damage > 0) practice(source, creditedForm, 'damage', damage);
    source.damageDealt += damage; source.suppressionDealt += effectivePressure; g.stats.damage[source.team] += damage; g.stats.suppression[source.team] += effectivePressure;
    if (damage > 0) { target.contributors.push({ source: source.id, damage, tick: g.tick, form: creditedForm }); rewards.set(source.id, (rewards.get(source.id) || 0) + damage * .12); }
    if (feedback?.attack && ['hit', 'blocked'].includes(feedback.outcome)) {
      attackFeedback(g, source, feedback.attack, target, feedback.outcome, damage);
      if (feedback.attack.counter && damage > 0) effect(g, 'counter', source.x, source.y, source.team, { soldierId: source.id, form: feedback.attack.form, motion: FORMS[feedback.attack.form].technique.motion, x2: target.x, y2: target.y });
    }
  }
  const dead = [];
  for (const s of g.soldiers) {
    s.contributors = s.contributors.filter(c => c.tick >= g.tick - ticks(ASSIST_WINDOW)).slice(-160);
    const total = totals.get(s.id); if (!s.alive || !total) continue;
    s.hp = Math.max(0, rounded(s.hp - total.damage)); s.energy = Math.max(0, s.energy - total.energyDrain); s.suppression = clamp(s.suppression + total.pressure, 0, 100); s.morale = clamp(s.morale - total.damage * .12, 0, 100);
    if (total.stagger > 0 && g.tick >= s.staggerImmuneUntil) {
      if (s.attack) attackFeedback(g, s, s.attack, g.soldiers.find(other => other.id === s.attack.target), 'interrupted');
      s.staggerUntil = g.tick + ticks(total.stagger); s.staggerImmuneUntil = s.staggerUntil + 45; s.attack = null; s.guard = false; s.combatState = 'stagger'; effect(g, 'stagger', s.x, s.y, s.team, { soldierId: s.id });
    }
    const bounds = worldBounds(g), desired = { x: clamp(s.x + clamp(total.pushX, -32, 32), bounds.minX, bounds.maxX), y: clamp(s.y + clamp(total.pushY, -32, 32), bounds.minY, bounds.maxY) };
    const pushed = g.config.mapSize === 'legacy' ? desired : moveSwept(g.terrain, s, desired); s.x = pushed.x; s.y = pushed.y;
    if (s.hp <= 0) dead.push({ soldier: s, environmental: total.enemyDamage <= 0 });
  }
  const deaths = [];
  for (const { soldier: s, environmental } of dead) {
    if (s.attack) attackFeedback(g, s, s.attack, g.soldiers.find(other => other.id === s.attack.target), 'interrupted');
    Object.assign(s, { alive: false, state: 'dead', stance: 'stand', cover: false, melee: false, moving: false, target: null, attack: null, guard: false, airborne: null, airborneHeight: 0, combatState: 'dead' }); creditRecord(g, s, 'deaths');
    snapshotPosition(s);
    const dropped = dropRelic(g, s, TICK_RATE);
    if (dropped) { snapshotPosition(g.objective); event(g, dropped.type, dropped.team, dropped.text); }
    const contributions = new Map();
    if (!environmental) for (const c of s.contributors) contributions.set(c.source, (contributions.get(c.source) || 0) + c.damage);
    const ranked = [...contributions].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const killer = ranked.length ? g.soldiers.find(other => other.id === ranked[0][0]) : null, assists = [];
    if (killer) {
      const forms = new Map();
      for (const c of s.contributors) if (c.source === killer.id) { const form = validForm(c.form) ? c.form : null; forms.set(form, (forms.get(form) || 0) + c.damage); }
      const killForm = [...forms].sort((a, b) => b[1] - a[1] || (a[0] === null ? -1 : b[0] === null ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]?.[0];
      if (killForm) practice(killer, killForm, 'kills');
      creditRecord(g, killer, 'kills'); rewards.set(killer.id, (rewards.get(killer.id) || 0) + 25); killer.morale = clamp(killer.morale + 9, 0, 100);
      for (const [id] of ranked.slice(1)) { const helper = g.soldiers.find(other => other.id === id); if (helper) { creditRecord(g, helper, 'assists'); assists.push(id); } }
    } else creditRecord(g, s, 'environmentDeaths');
    for (const friend of aliveTeam(g, s.team)) friend.morale = clamp(friend.morale - (dist(friend, s) < 160 ? 10 : 5), 0, 100);
    effect(g, 'death', s.x, s.y, s.team, { soldierId: s.id }); event(g, 'casualty', s.team, `${s.name} fell${killer ? ` to ${killer.name}` : ' to the environment'}`);
    if (controlled(g, s)) clearPlayerInput(g);
    deaths.push({ soldierId: s.id, killerId: killer?.id ?? null, assists, environmental: !killer });
  }
  for (const s of g.soldiers) {
    s.xp = Math.min(150, rounded(s.xp + (rewards.get(s.id) || 0))); const rank = rankForXP(s.xp);
    if (rank > s.rank) { s.rank = rank; s.maxHp = rounded((BASE_HP + rank * 4) * s.career.modifiers.healthMultiplier); if (s.alive) { s.hp = Math.min(s.maxHp, s.hp + 4 * s.career.modifiers.healthMultiplier); effect(g, 'rank', s.x, s.y, s.team, { soldierId: s.id }); } }
  }
  return { deaths };
}
function updateObjective(g) {
  if (g.config.matchMode === 'elimination') return;
  if (g.config.matchMode === 'relic') {
    const carrier = g.soldiers.find(s => s.alive && isRelicCarrier(g, s));
    if (carrier) { carrier.objectiveSeconds += DT; g.stats.objectiveTime[carrier.team] += DT; practice(carrier, carrier.form, 'objectiveSeconds', DT); }
    for (const entry of advanceRelic(g, TICK_RATE)) {
      // Pickup, drop and delivery relocate the marker rather than moving it continuously.
      if (['relic-pickup', 'relic-drop', 'relic-delivery'].includes(entry.type)) snapshotPosition(g.objective);
      event(g, entry.type, entry.team, entry.text);
    }
    return;
  }
  const o = g.objective;
  o.presence = [0, 1].map(team => aliveTeam(g, team).filter(s => !s.pinned && !s.rallying && s.staggerUntil <= g.tick && dist(s, o) <= o.radius).length);
  o.contested = o.presence[0] > 0 && o.presence[1] > 0; const advantage = o.presence[0] - o.presence[1];
  if (!o.contested && advantage !== 0) o.capture = clamp(o.capture + Math.sign(advantage) * Math.min(3, Math.abs(advantage)) * 15 * DT, -100, 100);
  else if (!o.presence[0] && !o.presence[1] && o.owner === null) o.capture -= Math.sign(o.capture) * Math.min(Math.abs(o.capture), 5 * DT);
  const captured = o.capture >= 100 ? 0 : o.capture <= -100 ? 1 : null;
  if (captured !== null && captured !== o.owner) { o.owner = captured; for (const s of aliveTeam(g, captured)) s.morale = clamp(s.morale + 8, 0, 100); event(g, 'capture', captured, `${captured === 0 ? 'Blue' : 'Red'} captured the signal post`); }
  if (o.owner !== null && !o.contested && o.presence[o.owner] > 0 && o.presence[1 - o.owner] === 0) {
    o.points[o.owner] = Math.min(o.targetScore, o.points[o.owner] + DT); g.stats.objectiveTime[o.owner] += DT;
    for (const s of aliveTeam(g, o.owner)) if (!s.pinned && !s.rallying && s.staggerUntil <= g.tick && dist(s, o) <= o.radius) { s.objectiveSeconds += DT; practice(s, s.form, 'objectiveSeconds', DT); }
  }
}
function awardRoundCareers(g) {
  const careers = g.soldiers.map(s => {
    const before = progressionSummary(g.careers[s.team][s.lane]);
    const reward = meritForRound({ damageDealt: s.damageDealt, kills: s.kills, objectiveSeconds: s.objectiveSeconds, suppressionDealt: s.suppressionDealt, survived: s.alive, won: g.winner === s.team });
    g.careers[s.team][s.lane] = awardMerit(g.careers[s.team][s.lane], reward);
    const after = progressionSummary(g.careers[s.team][s.lane]), earned = after.merit - before.merit, promoted = after.gradeIndex > before.gradeIndex;
    s.career = after; s.meritEarned = earned; if (promoted) event(g, 'career', s.team, `${s.name} promoted to ${after.grade}`);
    return { soldierId: s.id, team: s.team, lane: s.lane, name: s.name, before, after, earned, promoted };
  });
  const commendations = createCommendations(g.soldiers);
  const mastery = g.soldiers.map(s => {
    const before = g.mastery[s.team][s.lane], awards = commendations.filter(award => award.soldierIds.includes(s.id)).map(award => award.id);
    const after = settleMastery(before, g.round, s.formPractice, awards);
    g.mastery[s.team][s.lane] = after;
    return { soldierId: s.id, team: s.team, lane: s.lane, before, after };
  });
  g.roundReport = { round: g.round, doctrines: [...g.doctrines], careers, mastery, commendations, records: { teams: g.records.teams.map(r => ({ ...r })), soldiers: g.records.soldiers.map(r => ({ ...r })) } };
}
function finishRound(g) {
  const outcome = resolveRoundOutcome(g);
  if (!outcome) return;
  const { survivors: counts, health } = outcome;
  g.winner = outcome.winner; g.reason = outcome.reason;
  g.status = 'ended'; if (g.winner === null) g.draws = Math.min(MAX_RECORD_COUNT, g.draws + 1); else g.score[g.winner] = Math.min(MAX_RECORD_COUNT, g.score[g.winner] + 1);
  awardRoundCareers(g);
  g.history.push({ round: g.round, winner: g.winner, reason: g.reason, time: g.time, terrain: g.terrain.id, survivors: counts, health: [...health], objective: [...g.objective.points] });
  if (g.history.length > 50) g.history.shift(); event(g, 'result', g.winner, g.winner === null ? 'Round drawn' : `${g.winner === 0 ? 'Blue' : 'Red'} won: ${g.reason.toLowerCase()}`);
  g.roundReport.recap = buildBattleRecap(g);
}
function tick(g) {
  captureRenderPositions(g);
  g.tick++; g.time = g.tick / TICK_RATE; g.timeLeft = Math.max(0, g.roundDuration - g.time);
  for (const key of ['forceCooldown', 'aiForceCooldown', 'guardCooldown', 'aiGuardCooldown']) g[key] = Math.max(0, g[key] - DT);
  for (const e of g.effects) e.ttl -= DT; g.effects = g.effects.filter(e => e.ttl > 0);
  for (const s of g.soldiers) {
    if (s.airborne) advanceAirborne(s, g.tick, (unit, dx, dy) => {
      const bounds = worldBounds(g), desired = { x: clamp(unit.x + dx, bounds.minX, bounds.maxX), y: clamp(unit.y + dy, bounds.minY, bounds.maxY) };
      const point = g.config.mapSize === 'legacy' ? desired : moveSwept(g.terrain, unit, desired); unit.x = point.x; unit.y = point.y;
    });
    physiology(g, s);
  }
  resetPhase(g);
  for (const s of g.soldiers) observeOpponent(g, s);
  summarize(g); updateCommanders(g); updateCommandProgress(g); resetPhase(g);
  const positions = g.soldiers.map(s => ({ x: s.x, y: s.y })), moved = [], movementDecisions = g.soldiers.map(s => duelIntent(g, s));
  const approachDecisions = new Map(g.soldiers.map((s, i) => [s.id, movementDecisions[i]]));
  for (const team of [0, 1]) teamApproaches(g, team, approachDecisions);
  for (let i = 0; i < g.soldiers.length; i++) { const s = g.soldiers[i]; moveSoldier(g, s, movementDecisions[i]); moved.push({ x: s.x, y: s.y }); s.x = positions[i].x; s.y = positions[i].y; }
  g.soldiers.forEach((s, i) => { s.x = moved[i].x; s.y = moved[i].y; });
  separateFighters(g); resetPhase(g);
  for (const s of g.soldiers) if (s.alive) { s.cover = inCover(g, s); if (s.cover) g.stats.coverTime[s.team] += DT; }
  const impacts = [], decisions = g.soldiers.map(s => duelIntent(g, s));
  // Every decision sees the same attacks and positions. Committing actors give up
  // their idle defense before any strike resolves, regardless of iteration order.
  g.soldiers.forEach((s, i) => {
    if (!s.attack && s.alive) s.tacticalReason = decisions[i].reason;
    if (['saber', 'force'].includes(decisions[i].action)) s.guard = false;
    if (decisions[i].action === 'guard' || controlled(g, s) && g.control.input.guard) {
      if (s.lastGuardTick !== g.tick - 1) s.guardStartedTick = g.tick;
      const context = tacticalContext(g, s, selectTarget(g, s));
      if (context.threatKind && context.threatAgeTicks >= context.reactionTicks && context.threatTicks <= context.parryWindowTicks) s.lastGuardTick = g.tick;
    }
    if (decisions[i].action === 'recover' && s.alive && s.staggerUntil <= g.tick) s.combatState = 'recover';
  });
  const defenses = new Map();
  for (let i = 0; i < g.soldiers.length; i++) {
    const s = g.soldiers[i]; if (!s.alive) continue;
    const decision = decisions[i], kind = s.attack?.kind || (['saber', 'force'].includes(decision.action) ? decision.action : null);
    const window = combatSkillProfile(s.career).parryWindowTicks;
    let threatCount = 0;
    for (const enemy of incomingThreats(g, s, true)) if (enemy.attack.resolveTick - g.tick <= window) threatCount++;
    defenses.set(s.id, { kind, threatCount });
  }
  defenseSnapshots.set(g, defenses);
  // Completed self-defense windups activate together, before the impact pass.
  // Otherwise roster order decides whether a same-tick strike sees a barrier.
  if (permitsForceAttacks(g.config)) for (const s of g.soldiers) {
    if (s.alive && s.staggerUntil <= g.tick && s.attack?.abilityId === 'force_barrier' && s.attack.resolveTick <= g.tick) {
      const ability = forceAbilityById('force_barrier'); s.barrierUntil = g.tick + ability.barrierTicks; s.barrierEnergy = ability.barrierEnergy;
    }
  }
  for (let i = 0; i < g.soldiers.length; i++) collectAttack(g, g.soldiers[i], impacts, decisions[i]);
  phaseCaches.delete(g);
  pendingForce(g, impacts);
  for (const s of g.soldiers) if (s.attack) s.guard = false;
  if (g.config.mapSize !== 'legacy') for (const s of g.soldiers) if (s.alive) { const hazard = terrainAt(g.terrain, s).damagePerSecond; if (hazard > 0) impacts.push({ target: s.id, amount: hazard * DT }); }
  defenseSnapshots.delete(g);
  resolveDamage(g, impacts); updateObjective(g); summarize(g); finishRound(g);
  for (const key of ['attack', 'force', 'dash']) g.control.input[key] = false;
}
export function step(g, dt) {
  if (!g || g.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return g;
  g._accumulator += Math.min(dt, g.roundDuration);
  while (g._accumulator + 1e-9 >= DT && g.status === 'playing') { g._accumulator = Math.max(0, g._accumulator - DT); tick(g); }
  if (g.status === 'ended' || g._accumulator < 1e-9) g._accumulator = 0;
  if (g.status === 'ended') captureRenderPositions(g);
  g.alpha = g._accumulator / DT;
  return g;
}
export function nextRound(g) {
  if (!g || g.status !== 'ended') return g;
  g.mutations = [];
  for (const team of [0, 1]) for (let lane = 0; lane < g.config.teamSizes[team]; lane++) {
    const prior = g.soldiers.find(s => s.team === team && s.lane === lane); g.veterans[team][lane] = prior?.alive ? prior.xp : 0;
    const evolved = evolveLoadout(g.loadouts[team].roster[lane], { rng: () => random(g) }); g.loadouts[team].roster[lane] = { weapon: evolved.weapon, meleeWeapon: evolved.meleeWeapon };
    for (const change of evolved.changes) g.mutations.push({ ...change, team, soldierId: prior.id, label: `${team === 0 ? 'Blue' : 'Red'} ${lane + 1}: ${change.label}` });
  }
  for (const team of [0, 1]) { g.loadouts[team].weaponTier = WEAPONS[g.loadouts[team].roster[0].weapon].quality; g.loadouts[team].knifeTier = KNIVES[g.loadouts[team].roster[0].meleeWeapon].quality; }
  g.round = Math.min(MAX_RECORD_COUNT, g.round + 1);
  if (g.config.opponentMode === 'mixed') g.forms[1] = enemyFormsForRound(g.seed, g.round, g.config.teamSizes[1]);
  populateRound(g); return g;
}


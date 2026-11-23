/** One browser-local campaign slot. No network, account or downloaded file required. */
import { createGame, normalizeConfig, clearPlayerInput, resetRenderSnapshots, MAX_FIGHTER_HP, WEAPONS, KNIVES, MAPS, DOCTRINES } from './sim.js?v=phase1-20261025';
import { progressionSummary, legacyProgressionSummary, LEGACY_MAX_MERIT, MAX_MERIT } from './progression.js';
import { FORMS } from './content.js';
import { isValidMastery, isValidRoundPractice, isValidCommendations, settleMastery } from './mastery.js';
import { canOccupy } from './terrain.js';
import { LEGACY_SAVE_KEY, MIGRATION_NOTICE, migrateLegacyCampaign, addV7ProgressionDefaults, addV8Defaults, addV9Defaults, addV10Defaults, addV11Defaults, V9_SOLDIER_DEFAULTS } from './migration.js?v=phase1-20261025';
import { SQUAD_ORDERS } from './squad-commands.js';
import { isValidBattleLog, isValidBattleRecap, buildBattleRecap } from './battle-recap.js';
import { permitsForceAttacks } from './modifiers.js';
import { forceAbilityById } from './force-abilities.js';
import { getFormMoves } from './combat-forms.js';
import { usesDualSabers, DUAL_SABER_PROFILE } from './dual-sabers.js';

export const SAVE_KEY = 'trenchline-campaign-v2';
const FORMAT = 2, MAX_BYTES = 1500000;
export const RULES_VERSION = 11;
const V7_CONFIG_KEYS = ['formations', 'targetPriorities', 'matchMode', 'roundDuration', 'targetScore', 'startingRanks', 'startingSaberQuality', 'startingForceFamily', 'startingForceQuality'];
const V8_CONFIG_KEYS = ['modifier'];
const V10_CONFIG_KEYS = ['startingDualSabers'];
const V11_CONFIG_KEYS = ['deployments'];
const UPGRADE_NOTICE = 'Save updated for battlefield commands. The battle, attacks in progress, careers, equipment and records were kept. Existing deployments stay unchanged until the next round. Older event history is marked partial; no missing actions are reconstructed. Combat and mastery metadata receives neutral defaults only when absent from its source version.';
const fail = () => { throw new Error('This campaign save is damaged or incompatible. Your current battle and stored save are unchanged.'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, lo, hi) => typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi;
const integer = (value, lo, hi) => Number.isInteger(value) && number(value, lo, hi);
const check = condition => { if (!condition) fail(); };

// Interpolation is disposable presentation state, never part of campaign validity.
// Copy only the containing objects so even malformed/cyclic metadata can be
// ignored without touching the running game or masking authoritative corruption.
function withoutRenderSnapshots(game) {
  if (!object(game)) return game;
  const copy = { ...game };
  delete copy.alpha;
  delete copy.prevFrontLine;
  const position = entity => {
    if (!object(entity)) return entity;
    const copy = { ...entity };
    delete copy.prevX; delete copy.prevY;
    return copy;
  };
  if (Array.isArray(game.soldiers)) copy.soldiers = game.soldiers.map(position);
  if (object(game.objective)) copy.objective = position(game.objective);
  return copy;
}

function safeTree(value, depth = 0) {
  check(depth < 12);
  if (typeof value === 'number') check(Number.isFinite(value) && Math.abs(value) < 1e12);
  else if (typeof value === 'string') check(value.length <= 1000);
  else if (value !== null && typeof value === 'object') {
    check(Object.keys(value).length <= 500);
    for (const [key, child] of Object.entries(value)) {
      check(!['__proto__', 'prototype', 'constructor'].includes(key));
      safeTree(child, depth + 1);
    }
  } else check(value === null || typeof value === 'boolean');
}
function shape(value, template) {
  if (template === null) return;
  if (Array.isArray(template)) {
    check(Array.isArray(value));
    if (template.length) { check(value.length === template.length); value.forEach((entry, i) => shape(entry, template[i])); }
  } else if (object(template)) {
    check(object(value));
    for (const [key, example] of Object.entries(template)) { check(Object.hasOwn(value, key)); shape(value[key], example); }
  } else check(typeof value === typeof template);
}
function pair(values, maximum = 1e9) { check(Array.isArray(values) && values.length === 2 && values.every(v => number(v, 0, maximum))); }
function collection(list, max, template) {
  check(Array.isArray(list) && list.length <= max);
  for (const item of list) shape(item, template);
}
function point(item, x = 'x', y = 'y', margin = 0, width = 960, height = 540) {
  check(number(item[x], -margin, width + margin) && number(item[y], -margin, height + margin));
}
function recordIds(list, nextId) {
  check(integer(nextId, 1, 1e9));
  const seen = new Set();
  for (const item of list) {
    check(integer(item.id, 1, nextId - 1) && !seen.has(item.id));
    seen.add(item.id);
  }
}

/** Validate a detached JSON object before it can replace a running game. */
export function validateCampaign(game, { legacy = false, rulesVersion = RULES_VERSION } = {}) {
  const originalGame = game;
  game = withoutRenderSnapshots(game);
  // v0.7 introduced mastery and extended careers. A v0.7 save already owns
  // these fields; adding optional v0.8 rules must never reset them.
  const oldRules = legacy || rulesVersion < 7;
  const beforeV8 = legacy || rulesVersion < 8;
  const beforeV9 = legacy || rulesVersion < 9;
  const beforeV10 = legacy || rulesVersion < 10;
  const beforeV11 = legacy || rulesVersion < 11;
  const maxHp = oldRules ? 158.401 : MAX_FIGHTER_HP + .001;
  const validCareerSnapshot = (snapshot, career = snapshot) => {
    if (JSON.stringify(snapshot) === JSON.stringify(oldRules ? legacyProgressionSummary(career) : progressionSummary(career))) return true;
    return !oldRules && career.merit <= LEGACY_MAX_MERIT && JSON.stringify(snapshot) === JSON.stringify(legacyProgressionSummary(career));
  };
  check(object(game)); safeTree(game);
  if (beforeV11) {
    check(!Object.hasOwn(game, 'commandState') && !Object.hasOwn(game, 'battleLog'));
    if (object(game.config)) check(!Object.hasOwn(game.config, 'deployments') && game.config.mode !== 'command');
    if (object(game.roundReport)) check(!Object.hasOwn(game.roundReport, 'recap'));
  }
  if (oldRules) {
    check(!Object.hasOwn(game, 'mastery'));
    check(Array.isArray(game.soldiers) && game.soldiers.every(s => !Object.hasOwn(s, 'formPractice')));
    if (object(game.roundReport)) check(!Object.hasOwn(game.roundReport, 'mastery') && !Object.hasOwn(game.roundReport, 'commendations'));
  }
  check((typeof game.seed === 'string' && game.seed.length <= 100) || number(game.seed, 0, 0xffffffff));
  const config = legacy ? normalizeConfig({ terrain: game.terrainChoice, mapSize: 'legacy' }) : normalizeConfig(game.config);
  if (!legacy) {
    const omittedKeys = [...(oldRules ? V7_CONFIG_KEYS : []), ...(beforeV8 ? V8_CONFIG_KEYS : []), ...(beforeV10 ? V10_CONFIG_KEYS : []), ...(beforeV11 ? V11_CONFIG_KEYS : [])];
    const expectedConfig = Object.fromEntries(Object.entries(config).filter(([key]) => !omittedKeys.includes(key)));
    check(object(game.config) && JSON.stringify(expectedConfig) === JSON.stringify(game.config));
    check(config.terrain === game.terrainChoice);
  }
  if (beforeV8) check(config.matchMode !== 'relic');
  const sizes = config.teamSizes, total = sizes[0] + sizes[1];
  const fresh = withoutRenderSnapshots(createGame(game.seed, config));
  if (legacy) { delete fresh.config; delete fresh.control; }
  else if (oldRules) for (const key of V7_CONFIG_KEYS) delete fresh.config[key];
  if (!legacy && beforeV8) for (const key of V8_CONFIG_KEYS) delete fresh.config[key];
  if (!legacy && beforeV10) for (const key of V10_CONFIG_KEYS) delete fresh.config[key];
  if (!legacy && beforeV11) for (const key of V11_CONFIG_KEYS) delete fresh.config[key];
  if (beforeV11) { delete fresh.commandState; delete fresh.battleLog; }
  if (oldRules) { delete fresh.mastery; fresh.soldiers.forEach(s => { delete s.formPractice; }); }
  if (beforeV9) fresh.soldiers.forEach(s => { for (const key of Object.keys(V9_SOLDIER_DEFAULTS)) delete s[key]; });
  const width = fresh.terrain.width, height = fresh.terrain.height;
  // These arrays grow during a battle; validate their item shapes below.
  fresh.events = [];
  fresh.terrain = {};
  fresh.soldiers.forEach(soldier => { soldier.career = {}; });
  shape(game, fresh);
  check(integer(game.rngState, 1, 0xffffffff));
  check(integer(game.round, 1, 1e9) && integer(game.draws, 0, 1e9)); pair(game.score);
  check(['playing', 'ended'].includes(game.status));
  check([null, 0, 1].includes(game.winner));
  const duration = oldRules ? 90 : config.roundDuration;
  check(game.roundDuration === duration && integer(game.tick, 0, duration * 60));
  check(Math.abs(game.time - game.tick / 60) < 1e-6 && number(game.timeLeft, 0, duration));
  check(Math.abs(game.timeLeft - Math.max(0, duration - game.time)) < 1e-6);
  check(number(game._accumulator, 0, duration));
  for (const key of ['forceCooldown', 'guardCooldown', 'aiForceCooldown', 'aiGuardCooldown']) check(number(game[key], 0, 7));
  for (const key of ['playerOrder', 'enemyOrder']) check((beforeV11 ? ['advance', 'hold', 'retreat'] : Object.keys(SQUAD_ORDERS)).includes(game[key]));
  if (!beforeV11) {
    check(Array.isArray(game.commandState) && game.commandState.length === 2);
    for (const team of [0, 1]) {
      const state = game.commandState[team], order = team === 0 ? game.playerOrder : game.enemyOrder;
      check(object(state) && Object.keys(state).length === 5 && integer(state.issuedTick, 0, game.tick));
      check(typeof state.manual === 'boolean' && typeof state.flankUsed === 'boolean');
      check(team !== 0 || state.manual === !game.autoCommand);
      check(Array.isArray(state.flankReached) && state.flankReached.length <= sizes[team] && new Set(state.flankReached).size === state.flankReached.length);
      check(state.flankReached.every(id => game.soldiers.some(s => s.team === team && s.id === id)));
      check(order === 'flank' || state.flankReached.length === 0);
      check(order !== 'flank' || state.flankUsed);
      if (state.anchor !== null) { check(object(state.anchor) && Object.keys(state.anchor).length === 2); point(state.anchor, 'x', 'y', 0, width, height); check(canOccupy(game.terrain, state.anchor)); }
      check(['flank', 'regroup'].includes(order) ? state.anchor !== null : state.anchor === null);
      check(game.squads[team].order === order);
    }
    check(isValidBattleLog(game.battleLog, { time: game.time, nextEventId: game.nextEventId }));
  }
  check(game.doctrines.every(id => Object.hasOwn(DOCTRINES, id)));
  check(game.terrainChoice === null || MAPS.some(map => map.id === game.terrainChoice));
  check(MAPS.some(map => map.id === game.terrain.id));
  // The board is content, not editable save data. Canonical geometry also prevents missing-cover crashes.
  const canonical = createGame(game.seed, { ...config, terrain: game.terrain.id });
  const map = canonical.terrain;
  check(JSON.stringify(game.terrain) === JSON.stringify(map));
  if (config.matchMode === 'relic') validateRelic(game, canonical.objective, width, height);
  else {
    for (const [key, value] of Object.entries(map.objective)) check(game.objective[key] === value);
    for (const key of ['kind', 'carrierId', 'state', 'home', 'extractionZones', 'unlockTick']) check(!Object.hasOwn(game.objective, key));
  }
  check(number(game.objective.capture, -100, 100));
  check([null, 0, 1].includes(game.objective.owner));
  check(game.objective.targetScore === config.targetScore); pair(game.objective.points, config.targetScore + .000001); pair(game.objective.presence, Math.max(...sizes));
  game.objective.presence.forEach((count, team) => check(integer(count, 0, sizes[team])));
  for (const stats of Object.values(game.stats)) pair(stats);
  if (!oldRules && config.matchMode === 'elimination') {
    check(game.objective.capture === 0 && game.objective.owner === null && game.objective.contested === false);
    for (const values of [game.objective.points, game.objective.presence, game.stats.objectiveTime]) check(values.every(v => v === 0));
    check(game.soldiers.every(s => s.objectiveSeconds === 0));
  }
  for (let team = 0; team < 2; team++) {
    check(game.squads[team].team === team && game.squads[team].doctrine === game.doctrines[team]);
    if (!oldRules) check(game.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + Object.values(s.formPractice).reduce((n, p) => n + p.blocks, 0), 0) <= game.stats.blocks[team]);
    for (let lane = 0; lane < sizes[team]; lane++) {
      const career = game.careers[team][lane], loadout = game.loadouts[team].roster[lane];
      check(integer(career.merit, 0, oldRules ? LEGACY_MAX_MERIT : MAX_MERIT));
      if (!oldRules) {
        const mastery = game.mastery[team][lane];
        check(isValidMastery(mastery) && mastery.lastSettledRound <= game.round);
        const careerKills = game.records.soldiers.find(r => r.team === team && r.lane === lane)?.kills;
        if (careerKills < 1e9) check(Object.values(mastery.forms).reduce((sum, row) => sum + row.kills, 0) <= careerKills);
        if (game.status === 'playing') check(mastery.lastSettledRound < game.round || game.round === 1e9);
      }
      check(Object.hasOwn(WEAPONS, loadout.weapon) && Object.hasOwn(KNIVES, loadout.meleeWeapon));
      check(number(game.veterans[team][lane], 0, 1e9));
      check(Object.hasOwn(FORMS, game.forms[team][lane]));
    }
  }
  for (let i = 0; i < total; i++) {
    const soldier = game.soldiers[i], expected = fresh.soldiers[i];
    check(soldier.id === expected.id && soldier.team === expected.team && soldier.lane === expected.lane);
    check(soldier.name === expected.name && Object.hasOwn(WEAPONS, soldier.weapon) && Object.hasOwn(KNIVES, soldier.meleeWeapon));
    check(number(soldier.x, 0, width) && number(soldier.y, 0, height));
    if (config.mapSize !== 'legacy') check(canOccupy(game.terrain, soldier));
    point(soldier, 'destinationX', 'destinationY', 100, width, height);
    check(number(soldier.maxHp, 120, maxHp) && number(soldier.hp, 0, soldier.maxHp));
    check(soldier.alive === (soldier.hp > 0));
    check(integer(soldier.rank, 0, 3) && number(soldier.xp, 0, 1e9));
    check(integer(soldier.bank, 0, 2) && integer(soldier.holdBank, 0, 2));
    check(number(soldier.morale, 0, 100) && number(soldier.suppression, 0, 100));
    check(soldier.target === null || game.soldiers.some(other => other.id === soldier.target));
    check(Object.hasOwn(FORMS, soldier.form));
    check(soldier.form === game.forms[soldier.team][soldier.lane]);
    check(soldier.maxEnergy === 100 && number(soldier.energy, 0, 100));
    if (!beforeV9) validateV9Soldier(game, soldier, width, height);
    for (const [key, value] of Object.entries(soldier)) {
      if (/Tick$|Until$/.test(key)) check(number(value, -1000, 10000));
      if (/Cooldown$/.test(key)) check(number(value, 0, 100));
    }
    if (soldier.attack !== null) {
      const a = soldier.attack;
      check(object(a) && ['saber', 'force'].includes(a.kind));
      if (!beforeV8 && !permitsForceAttacks(config)) check(a.kind !== 'force');
      check(game.soldiers.some(target => target.id === a.target && target.team !== soldier.team));
      check(integer(a.startedTick, 0, game.tick) && integer(a.resolveTick, a.startedTick, game.tick + 300));
      check(Object.hasOwn(FORMS, a.form) && typeof a.counter === 'boolean');
      check(Object.hasOwn(a.kind === 'saber' ? KNIVES : WEAPONS, a.weapon));
      if (Object.hasOwn(a, 'abilityId')) check(a.abilityId === null || a.kind === 'force' && !!forceAbilityById(a.abilityId));
      if (Object.hasOwn(a, 'moveId')) check(a.moveId === null || a.kind === 'saber' && getFormMoves(a.form).some(move => move.id === a.moveId));
      if (Object.hasOwn(a, 'aimX') || Object.hasOwn(a, 'aimY')) point(a, 'aimX', 'aimY', 100, width, height);
      if (Object.hasOwn(a, 'comboIndex')) {
        check(integer(a.comboIndex, 0, getFormMoves(a.form).length - 1));
        if (a.moveId !== null && a.moveId !== undefined) check(getFormMoves(a.form)[a.comboIndex].id === a.moveId);
      }
      if (['dual', 'offhand', 'offhandResolveTick'].some(key => Object.hasOwn(a, key))) {
        check(!beforeV10 && a.kind === 'saber' && usesDualSabers(config, soldier));
        check(a.dual === true && typeof a.offhand === 'boolean');
        check(integer(a.offhandResolveTick, a.startedTick + DUAL_SABER_PROFILE.offhandDelayTicks, game.tick + 300));
        if (a.offhand) {
          check(a.resolveTick === a.offhandResolveTick);
          check(a.offhandResolveTick - DUAL_SABER_PROFILE.offhandDelayTicks <= game.tick);
        } else check(a.offhandResolveTick === a.resolveTick + DUAL_SABER_PROFILE.offhandDelayTicks);
      }
    }
    if (!oldRules) {
      check(isValidRoundPractice(soldier.formPractice));
      const practices = Object.values(soldier.formPractice);
      check(practices.reduce((sum, p) => sum + p.ticks, 0) <= game.tick);
      check(practices.reduce((sum, p) => sum + p.kills, 0) <= soldier.kills);
      check(practices.reduce((sum, p) => sum + p.damage, 0) <= soldier.damageDealt + .000001);
      check(practices.reduce((sum, p) => sum + p.objectiveSeconds, 0) <= soldier.objectiveSeconds + .000001);
    }
    collection(soldier.contributors, 160, { source: '', damage: 0, tick: 0 });
    for (const c of soldier.contributors) {
      check(game.soldiers.some(other => other.id === c.source && other.team !== soldier.team));
      if (Object.hasOwn(c, 'form')) check(!oldRules && Object.hasOwn(FORMS, c.form));
      check(number(c.damage, Number.MIN_VALUE, maxHp) && integer(c.tick, Math.max(0, game.tick - 360), game.tick));
    }
    check(['ready', 'saber', 'force', 'guard', 'counter', 'stagger', 'recover', 'dead'].includes(soldier.combatState));
    check(typeof soldier.tacticalReason === 'string' && soldier.tacticalReason.length > 0 && soldier.tacticalReason.length <= 80);
    if (soldier.lastOutcome !== null) {
      const o = soldier.lastOutcome;
      check(object(o) && validOutcome(o.outcome) && number(o.damage, 0, maxHp));
      check(['saber', 'force'].includes(o.kind) && typeof o.isCounter === 'boolean' && integer(o.tick, 0, game.tick));
      check(o.targetId === null || game.soldiers.some(other => other.id === o.targetId && other.team !== soldier.team));
      if (['miss', 'out-of-range', 'target-lost', 'interrupted'].includes(o.outcome)) check(o.damage === 0);
    }
    for (const key of ['kills', 'deaths', 'assists', 'environmentDeaths']) check(integer(soldier[key], 0, ['deaths', 'environmentDeaths'].includes(key) ? 1 : sizes[1 - soldier.team]));
    check(soldier.deaths === (soldier.alive ? 0 : 1) && soldier.environmentDeaths <= soldier.deaths);
    check(number(soldier.damageDealt, 0, 1e6) && number(soldier.suppressionDealt, 0, 1e6) && number(soldier.objectiveSeconds, 0, duration + .001));
    check(validCareerSnapshot(soldier.career, game.careers[soldier.team][soldier.lane]));
  }
  collection(game.effects, 160, { id: 0, type: '', x: 0, y: 0, x2: 0, y2: 0, team: 0, ttl: 0, maxTtl: 0 });
  collection(game.events, 32, { id: 0, time: 0, type: '', team: null, text: '' });
  collection(game.history, 50, { round: 0, winner: null, reason: '', time: 0, terrain: '', survivors: [0, 0], health: [0, 0], objective: [0, 0] });
  collection(game.mutations, total * 2, { kind: '', label: '', team: 0, soldierId: '' });
  recordIds(game.effects, game.nextEffectId);
  recordIds(game.events, game.nextEventId);
  const effectTypes = ['telegraph', 'saber', 'force', 'block', 'counter', 'dash', 'stagger', 'impact', 'death', 'rank', 'feedback'];
  for (const effect of game.effects) {
    check(effectTypes.includes(effect.type) && [0, 1].includes(effect.team));
    point(effect, 'x', 'y', 100, width, height); point(effect, 'x2', 'y2', 100, width, height);
    check(number(effect.maxTtl, .01, 2) && effect.ttl > 0 && effect.ttl <= effect.maxTtl);
    if (Object.hasOwn(effect, 'radius')) check(number(effect.radius, 1, 200));
    if (Object.hasOwn(effect, 'form')) check(Object.hasOwn(FORMS, effect.form));
    if (Object.hasOwn(effect, 'soldierId')) check(game.soldiers.some(s => s.id === effect.soldierId && s.team === effect.team));
    // A resolved area cast can have no legal recipients. The engine records a
    // zero-damage, targetless out-of-range effect, not a contact with an actor.
    const emptyAreaCast = !beforeV9 && ['force', 'feedback'].includes(effect.type) && effect.kind === 'force'
      && ['repulse', 'sweep'].includes(forceAbilityById(effect.abilityId)?.mechanic)
      && effect.outcome === 'out-of-range' && effect.damage === 0 && effect.isCounter === false
      && game.soldiers.some(s => s.id === effect.soldierId && s.team === effect.team);
    if (Object.hasOwn(effect, 'targetId')) check((['feedback', 'saber', 'force'].includes(effect.type) && effect.targetId === null && (['target-lost', 'interrupted'].includes(effect.outcome) || emptyAreaCast)) || game.soldiers.some(s => s.id === effect.targetId && s.team !== effect.team));
    if (Object.hasOwn(effect, 'motion')) check(Object.values(FORMS).some(f => f.technique.motion === effect.motion));
    if (Object.hasOwn(effect, 'family')) check(effect.family === 'saber' || ['force_push', 'force_burst', 'force_pulse'].includes(effect.family));
    if (Object.hasOwn(effect, 'kind')) check(['saber', 'force'].includes(effect.kind));
    if (Object.hasOwn(effect, 'dual')) check(typeof effect.dual === 'boolean');
    if (Object.hasOwn(effect, 'offhand')) check(typeof effect.offhand === 'boolean' && (!effect.offhand || effect.dual === true && effect.kind === 'saber'));
    if (Object.hasOwn(effect, 'comboIndex')) check(integer(effect.comboIndex, 0, Math.max(...Object.keys(FORMS).map(id => getFormMoves(id).length)) - 1));
    if (Object.hasOwn(effect, 'abilityId')) check(effect.abilityId === null || !!forceAbilityById(effect.abilityId));
    if (Object.hasOwn(effect, 'moveId')) check(effect.moveId === null || getFormMoves(effect.form).some(move => move.id === effect.moveId));
    if (Object.hasOwn(effect, 'outcome')) check(validOutcome(effect.outcome));
    if (Object.hasOwn(effect, 'damage')) check(number(effect.damage, 0, maxHp));
    if (Object.hasOwn(effect, 'text')) check(typeof effect.text === 'string' && effect.text.length <= 40);
    if (Object.hasOwn(effect, 'isCounter')) check(typeof effect.isCounter === 'boolean');
    if (effect.type === 'feedback') check(validOutcome(effect.outcome) && number(effect.damage, 0, maxHp));
  }
  for (const event of game.events) {
    check([null, 0, 1].includes(event.team));
    check(['round', 'doctrine', 'command', 'order', 'force', 'guard', 'form', 'saber', 'block', 'counter', 'stagger', 'casualty', 'rank', 'capture', 'career', 'result', ...(oldRules ? [] : ['tactics']), ...(beforeV8 ? [] : ['relic-pickup', 'relic-drop', 'relic-delivery', 'relic-ready'])].includes(event.type));
    check(number(event.time, 0, game.time));
  }
  validateRecords(game, total);
  let previousRound = 0;
  for (const h of game.history) {
    check(integer(h.round, previousRound + 1, game.round) && [null, 0, 1].includes(h.winner));
    check(number(h.time, 0, oldRules ? 90 : 150) && MAPS.some(map => map.id === h.terrain));
    pair(h.survivors, Math.max(...sizes)); pair(h.health, Math.max(...sizes) * maxHp);
    h.survivors.forEach((n, team) => check(integer(n, 0, sizes[team]))); h.health.forEach((n, team) => check(n <= sizes[team] * maxHp)); pair(h.objective, 30.000001);
    previousRound = h.round;
  }
  for (const mutation of game.mutations) {
    check(['upgrade', 'downgrade', 'mixed'].includes(mutation.kind));
    check(['ranged', 'melee'].includes(mutation.slot));
    const catalog = mutation.slot === 'ranged' ? WEAPONS : KNIVES;
    check(Object.hasOwn(catalog, mutation.from) && Object.hasOwn(catalog, mutation.to));
    check(game.soldiers.some(soldier => soldier.id === mutation.soldierId && soldier.team === mutation.team));
  }
  if (game.roundReport !== null) {
    shape(game.roundReport, { round: 0, doctrines: ['', ''], careers: [] });
    check(integer(game.roundReport.round, 1, game.round));
    check(game.roundReport.doctrines.every(id => Object.hasOwn(DOCTRINES, id)));
    if (!beforeV11) {
      check(Object.hasOwn(game.roundReport, 'recap'));
      const recap = game.roundReport.recap;
      if (recap !== null) {
        check(isValidBattleRecap(recap, { round: game.roundReport.round, teamSizes: sizes }) && recap.status === 'ended');
        const summary = game.history.find(h => h.round === recap.round);
        check(summary && recap.winner === summary.winner && recap.reason === summary.reason && recap.duration === summary.time);
        if (recap.round === game.round) check(JSON.stringify(recap) === JSON.stringify(buildBattleRecap(game)));
      }
    }
    check(game.roundReport.careers.length === total);
    if (!oldRules) {
      const rows = game.roundReport.mastery;
      check(Array.isArray(rows) && rows.length === total && isValidCommendations(game.roundReport.commendations, game.roundReport.round === game.round ? game.soldiers : undefined));
      check(game.roundReport.commendations.every(award => award.soldierIds.every(id => game.soldiers.some(s => s.id === id))));
      const seen = new Set();
      for (const row of rows) {
        check(object(row) && integer(row.team, 0, 1) && integer(row.lane, 0, sizes[row.team] - 1));
        const soldier = game.soldiers.find(s => s.team === row.team && s.lane === row.lane);
        check(row.soldierId === soldier.id && !seen.has(row.soldierId)); seen.add(row.soldierId);
        check(isValidMastery(row.before) && isValidMastery(row.after));
        check(row.before.lastSettledRound <= row.after.lastSettledRound && row.after.lastSettledRound <= game.roundReport.round);
        check(JSON.stringify(row.after) === JSON.stringify(game.mastery[row.team][row.lane]));
        if (game.roundReport.round === game.round && row.after.lastSettledRound === game.roundReport.round && row.before.lastSettledRound < game.roundReport.round) {
          const awards = game.roundReport.commendations.filter(award => award.soldierIds.includes(soldier.id)).map(award => award.id);
          check(JSON.stringify(row.after) === JSON.stringify(settleMastery(row.before, game.roundReport.round, soldier.formPractice, awards)));
        }
        for (const form of Object.keys(FORMS)) for (const key of Object.keys(row.before.forms[form])) check(row.after.forms[form][key] >= row.before.forms[form][key]);
        for (const key of Object.keys(row.before.commendations)) check(row.after.commendations[key] >= row.before.commendations[key]);
      }
    }
    const reported = new Set();
    for (const item of game.roundReport.careers) {
      shape(item, { soldierId: '', team: 0, lane: 0, name: '', before: {}, after: {}, earned: 0, promoted: false });
      check(integer(item.team, 0, 1) && integer(item.lane, 0, sizes[item.team] - 1));
      const soldier = game.soldiers.find(soldier => soldier.team === item.team && soldier.lane === item.lane);
      check(item.soldierId === soldier.id && item.name === soldier.name && !reported.has(item.soldierId));
      reported.add(item.soldierId);
      check(integer(item.earned, 0, 180));
      check(validCareerSnapshot(item.before));
      check(validCareerSnapshot(item.after));
    }
  }
  if (!legacy) {
    check(object(game.control) && object(game.control.input));
    const input = game.control.input;
    check(game.control.soldierId === (config.mode === 'play' ? `blue-${config.playerSlot}` : null));
    check(number(input.moveX, -1, 1) && number(input.moveY, -1, 1));
    for (const key of ['attack', 'force', 'guard', 'dash']) check(typeof input[key] === 'boolean');
    check(input.targetId === null || game.soldiers.some(s => s.team === 1 && s.id === input.targetId));
  }
  return originalGame;
}

function validateRelic(game, expected, width, height) {
  const relic = game.objective;
  check(relic.kind === 'relic' && relic.id === expected.id && relic.name === expected.name);
  check(relic.radius === expected.radius && relic.capture === 0);
  check(JSON.stringify(relic.home) === JSON.stringify(expected.home));
  check(JSON.stringify(relic.extractionZones) === JSON.stringify(expected.extractionZones));
  check(['available', 'carried', 'resetting'].includes(relic.state));
  check(integer(relic.unlockTick, 0, game.tick + 120));
  point(relic, 'x', 'y', 0, width, height);
  // Loose relics are either at the canonical center or at a fighter's death
  // site. Both must remain reachable with the same body clearance as fighters.
  check(canOccupy(game.terrain, relic));
  check(relic.points.every(n => integer(n, 0, expected.targetScore)));
  if (relic.state === 'carried') {
    const carrier = game.soldiers.find(s => s.id === relic.carrierId);
    check(carrier && carrier.alive && relic.owner === carrier.team);
    check(relic.x === carrier.x && relic.y === carrier.y && relic.unlockTick <= game.tick);
    check(carrier.dashUntil <= game.tick);
  } else {
    check(relic.carrierId === null && relic.owner === null);
    if (relic.state === 'resetting') {
      check(relic.x === expected.home.x && relic.y === expected.home.y && relic.unlockTick > game.tick);
    } else check(relic.unlockTick <= game.tick + 30);
  }
}

function validateV9Soldier(game, s, width, height) {
  for (const key of Object.keys(V9_SOLDIER_DEFAULTS)) check(Object.hasOwn(s, key));
  if (Object.hasOwn(s, 'comboBeat')) check(integer(s.comboBeat, 0, 20));
  if (Object.hasOwn(s, 'saberSequence')) check(integer(s.saberSequence, 0, 1000000));
  if (Object.hasOwn(s, 'lastSaberMoveId')) check(s.lastSaberMoveId === null || getFormMoves(s.form).some(move => move.id === s.lastSaberMoveId));
  const enemyId = id => game.soldiers.some(other => other.id === id && other.team !== s.team);
  check(integer(s.comboIndex, 0, getFormMoves(s.form).length - 1) && integer(s.forceAbilitySequence, 0, 1e9));
  for (const key of ['comboUntil', 'barrierUntil', 'landingRecoveryUntil']) check(integer(s[key], 0, game.tick + 300));
  for (const key of ['guardStartedTick', 'lastGuardTick']) check(integer(s[key], -1000, game.tick));
  check(number(s.barrierEnergy, 0, 22) && number(s.airborneHeight, 0, 100));
  if (!permitsForceAttacks(game.config)) check(s.barrierUntil <= game.tick && s.barrierEnergy === 0);
  check(s.lastForceAbility === null || !!forceAbilityById(s.lastForceAbility));
  if (s.observation !== null) {
    const o = s.observation;
    check(object(o) && enemyId(o.targetId) && integer(o.tick, 0, game.tick));
    point(o, 'x', 'y', 100, width, height);
    check(number(o.vx, -10000, 10000) && number(o.vy, -10000, 10000));
  }
  if (s.forceControl !== null) {
    const control = s.forceControl;
    check(permitsForceAttacks(game.config) && object(control) && enemyId(control.targetId));
    check(forceAbilityById(control.kind)?.mechanic === 'grip');
    check(integer(control.releaseTick, 0, game.tick + 90) && integer(control.untilTick, 0, game.tick + 90));
    check(control.untilTick >= control.releaseTick);
  }
  if (s.airborne !== null) {
    const a = s.airborne;
    check(object(a) && integer(a.startTick, 0, game.tick) && integer(a.endTick, a.startTick + 12, a.startTick + 90));
    point(a, 'originX', 'originY', 100, width, height);
    check(number(a.directionX, -1.001, 1.001) && number(a.directionY, -1.001, 1.001));
    check(number(a.distance, 0, 180) && number(a.height, 0, 100));
    check(integer(a.recoveryTicks, 0, 45) && number(a.rotations, -3, 3) && number(a.appliedProgress, 0, 1));
    for (const [key, lo, hi] of [['lateralDistance', -48, 48], ['bankScale', -1, 1], ['tuckScale', 0, 1], ['travelScale', -1, 1]]) if (Object.hasOwn(a, key)) check(number(a[key], lo, hi));
    if (Object.hasOwn(a, 'trajectory')) check(['somersault', 'side-vault', 'low-vault', 'retreat'].includes(a.trajectory));
    if (Object.hasOwn(a, 'rotationAxis')) check(['pitch', 'roll', 'yaw'].includes(a.rotationAxis));
    if (Object.hasOwn(a, 'controlSourceId')) {
      check(permitsForceAttacks(game.config) && enemyId(a.controlSourceId));
      const source = game.soldiers.find(other => other.id === a.controlSourceId);
      check(source.forceControl?.kind === 'force_grip' && source.forceControl.targetId === s.id);
      check(source.forceControl.releaseTick === a.endTick && source.forceControl.untilTick === a.endTick);
      check(a.endTick - a.startTick === forceAbilityById('force_grip').controlTicks);
      check(a.distance === 0 && a.rotations === 0 && a.height === 42 && a.recoveryTicks === 8);
    }
  }
}

function validateRecords(game, total) {
  const records = game.records, counters = ['kills', 'deaths', 'assists', 'environmentDeaths'];
  check(object(records) && ['saberfront', 'migration-v0.3'].includes(records.origin));
  check(Array.isArray(records.teams) && records.teams.length === 2 && Array.isArray(records.soldiers) && records.soldiers.length === total);
  for (let i = 0; i < total; i++) {
    const row = records.soldiers[i], s = game.soldiers[i];
    check(row.id === s.id && row.team === s.team && row.lane === s.lane);
    for (const key of counters) check(integer(row[key], 0, 1e9));
    for (const key of counters) check(row[key] >= s[key]);
    check(row.environmentDeaths <= row.deaths);
  }
  for (let team = 0; team < 2; team++) {
    for (const key of counters) {
      check(integer(records.teams[team][key], 0, 1e9));
      check(records.teams[team][key] === Math.min(1e9, records.soldiers.filter(s => s.team === team).reduce((n, s) => n + s[key], 0)));
    }
    const other = records.teams[1 - team];
    if (other.deaths < 1e9 && records.teams[team].kills < 1e9) check(records.teams[team].kills === other.deaths - other.environmentDeaths);
    for (const key of counters) check(game.stats[key][team] === game.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0));
  }
}

function validOutcome(outcome) { return ['hit', 'blocked', 'miss', 'out-of-range', 'target-lost', 'interrupted'].includes(outcome); }

export function saveCampaign(game, storage) {
  try {
    const detached = JSON.parse(JSON.stringify(withoutRenderSnapshots(game)));
    addV9Defaults(detached);
    validateCampaign(detached);
    clearPlayerInput(detached);
    const encoded = JSON.stringify({ version: FORMAT, rulesVersion: RULES_VERSION, game: detached });
    check(encoded.length <= MAX_BYTES);
    (storage ?? globalThis.localStorage).setItem(SAVE_KEY, encoded);
    return { ok: true, error: null };
  } catch (error) { return { ok: false, error: error.message?.includes('campaign save') ? error.message : 'Browser storage is unavailable or full. Your battle is still running.' }; }
}
export function loadCampaign(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const modern = target.getItem(SAVE_KEY);
    const encoded = modern ?? target.getItem(LEGACY_SAVE_KEY);
    if (!encoded) return { game: null, error: 'No saved campaign in this browser yet.' };
    check(encoded.length <= MAX_BYTES);
    const envelope = JSON.parse(encoded);
    if (object(envelope)) envelope.game = withoutRenderSnapshots(envelope.game);
    safeTree(envelope);
    check(envelope?.version === (modern !== null ? FORMAT : 1));
    const migrated = modern === null;
    const upgraded = !migrated && (!Object.hasOwn(envelope, 'rulesVersion') || [5, 6, 7, 8, 9, 10].includes(envelope.rulesVersion));
    let game;
    if (migrated) game = migrateLegacyCampaign(envelope.game);
    else if (upgraded) {
      // Only absent v0.4 observation fields may be supplied. All original state
      // is validated against its strict five-slot geometry before adding metadata.
      if (!Object.hasOwn(envelope, 'rulesVersion')) {
        check(Array.isArray(envelope.game?.soldiers));
        for (const soldier of envelope.game.soldiers) {
          if (!Object.hasOwn(soldier, 'tacticalReason')) soldier.tacticalReason = 'resumed';
          if (!Object.hasOwn(soldier, 'lastOutcome')) soldier.lastOutcome = null;
        }
      }
      const legacy = ![6, 7, 8, 9, 10].includes(envelope.rulesVersion);
      validateCampaign(envelope.game, { legacy, rulesVersion: envelope.rulesVersion ?? 4 });
      game = envelope.game;
      game.config = normalizeConfig(legacy ? { terrain: game.terrainChoice, mapSize: 'legacy', teamSizes: [5, 5], opponentMode: 'mixed' } : game.config);
      if (legacy) game.control = { soldierId: null, input: { moveX: 0, moveY: 0, attack: false, force: false, guard: false, dash: false, targetId: null } };
      if ((envelope.rulesVersion ?? 4) < 7) addV7ProgressionDefaults(game);
      addV8Defaults(game);
      addV9Defaults(game);
      addV10Defaults(game);
      addV11Defaults(game);
    } else { check(envelope.rulesVersion === RULES_VERSION); game = envelope.game; }
    if (migrated) addV9Defaults(game);
    validateCampaign(game);
    // Keys/buttons are not held across browser suspension or save loading.
    clearPlayerInput(game);
    resetRenderSnapshots(game);
    return { game, error: null, migrated, upgraded, notice: migrated ? MIGRATION_NOTICE : upgraded ? UPGRADE_NOTICE : null };
  } catch { return { game: null, error: 'This campaign save is damaged, incompatible, or unavailable. Your current battle and stored save are unchanged.' }; }
}
export function hasSavedCampaign(storage) {
  try { const target = storage ?? globalThis.localStorage; return !!(target.getItem(SAVE_KEY) || target.getItem(LEGACY_SAVE_KEY)); } catch { return false; }
}
export function clearSavedCampaign(storage) {
  try { (storage ?? globalThis.localStorage).removeItem(SAVE_KEY); return true; } catch { return false; }
}


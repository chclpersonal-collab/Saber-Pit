/** v0.3 saves remain in their original browser slot. Only durable campaign data
 * crosses the combat-system boundary; an active round restarts explicitly. */
import { createGame, rebuildRound, createCommandState, MAPS, DOCTRINES } from './sim.js?v=1.4.0';
import { createBattleLog } from './battle-recap.js?v=1.4.0';
import { LEGACY_MAX_MERIT } from './progression.js?v=1.4.0';
import { createMastery, createRoundPractice } from './mastery.js?v=1.4.0';

export const LEGACY_SAVE_KEY = 'trenchline-campaign-v1';
export const MIGRATION_NOTICE = 'v0.3 save loaded. The round restarts with sabers and Force; if it had ended, the next round starts. Scores, careers, history and equipment quality are kept. Total stats start at zero because v0.3 did not track them. Your original save is kept.';
const check = value => { if (!value) throw new Error('Invalid legacy campaign save'); };
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const int = (v, min, max) => Number.isInteger(v) && num(v, min, max);
const pair = (v, max, integer = false) => Array.isArray(v) && v.length === 2 && v.every(n => (integer ? int : num)(n, 0, max));
const roster = v => Array.isArray(v) && v.length === 2 && v.every(t => Array.isArray(t) && t.length === 5);
const familyMap = { pistol: 'force_push', revolver: 'force_burst', shotgun: 'force_burst', carbine: 'force_pulse', smg: 'force_pulse' };
function equipment(id, melee = false) {
  check(typeof id === 'string');
  const match = /^(?:(worn|improved)_)?(pistol|revolver|shotgun|carbine|smg|knife)$/.exec(id);
  check(match && (melee ? match[2] === 'knife' : match[2] !== 'knife'));
  return `${match[1] ? match[1] + '_' : ''}${melee ? 'saber' : familyMap[match[2]]}`;
}

/** Input has already passed the envelope size and safe JSON tree checks. */
export function migrateLegacyCampaign(old) {
  check(old && typeof old === 'object' && !Array.isArray(old));
  check((typeof old.seed === 'string' && old.seed.length <= 100) || num(old.seed, 0, 0xffffffff));
  check(int(old.rngState, 1, 0xffffffff) && int(old.round, 1, 1e9 - 1));
  check(['playing', 'ended'].includes(old.status) && typeof old.autoCommand === 'boolean');
  check(pair(old.score, 1e9, true) && int(old.draws, 0, 1e9));
  check(old.terrainChoice === null || MAPS.some(m => m.id === old.terrainChoice));
  check(Array.isArray(old.doctrines) && old.doctrines.length === 2 && old.doctrines.every(id => Object.hasOwn(DOCTRINES, id)));
  check(roster(old.careers) && roster(old.veterans));
  check(old.careers.flat().every(c => c && int(c.merit, 0, LEGACY_MAX_MERIT)));
  check(old.veterans.flat().every(xp => num(xp, 0, 1e9)));
  check(Array.isArray(old.loadouts) && old.loadouts.length === 2 && old.loadouts.every(t => Array.isArray(t?.roster) && t.roster.length === 5));
  check(Array.isArray(old.soldiers) && old.soldiers.length === 10);
  for (let i = 0; i < 10; i++) {
    const s = old.soldiers[i], team = i < 5 ? 0 : 1, lane = i % 5;
    check(s && s.id === `${team ? 'red' : 'blue'}-${lane}` && s.team === team && s.lane === lane);
    check(typeof s.alive === 'boolean' && num(s.xp, 0, 1e9));
  }
  check(Array.isArray(old.history) && old.history.length <= 50);
  let previousRound = 0;
  for (const h of old.history) {
    check(h && int(h.round, previousRound + 1, old.round) && [null, 0, 1].includes(h.winner));
    check(typeof h.reason === 'string' && h.reason.length <= 1000 && num(h.time, 0, 90));
    check(MAPS.some(m => m.id === h.terrain) && pair(h.survivors, 5, true) && pair(h.health, 792.005) && pair(h.objective, 30.000001));
    previousRound = h.round;
  }
  const g = createGame(old.seed, { terrain: old.terrainChoice, mapSize: 'legacy', teamSizes: [5, 5], autoCommand: old.autoCommand, doctrine: old.doctrines[0], enemyDoctrine: old.doctrines[1] });
  g.round = old.round + (old.status === 'ended' ? 1 : 0);
  g.score = [...old.score]; g.draws = old.draws;
  g.careers = old.careers.map(t => t.map(c => ({ merit: c.merit })));
  g.history = structuredClone(old.history);
  g.veterans = [0, 1].map(team => old.soldiers.filter(s => s.team === team).map(s => s.alive ? s.xp : 0));
  g.loadouts = old.loadouts.map(t => ({ weaponTier: 1, knifeTier: 1, roster: t.roster.map(l => ({ weapon: equipment(l.weapon), meleeWeapon: equipment(l.meleeWeapon, true) })) }));
  g.rngState = old.rngState;
  g.records.origin = 'migration-v0.3';
  g.roundReport = null;
  rebuildRound(g);
  return g;
}

/** Only call after strict source-version validation. No historical form attribution is guessed. */
export function addV7ProgressionDefaults(game) {
  game.mastery = game.config.teamSizes.map(size => Array.from({ length: size }, () => createMastery()));
  for (const soldier of game.soldiers) soldier.formPractice = createRoundPractice();
  if (game.roundReport !== null) {
    game.roundReport.commendations = [];
    game.roundReport.mastery = game.soldiers.map(s => ({ soldierId: s.id, team: s.team, lane: s.lane,
      before: createMastery(), after: createMastery() }));
  }
  return game;
}

/** Optional v0.8 rules never rewrite a battle or infer historical objective data. */
export function addV8Defaults(game) {
  if (!Object.hasOwn(game.config, 'modifier')) game.config.modifier = 'standard';
  return game;
}

/** New combat metadata never rewrites an old pending attack, career, or record. */
export const V9_SOLDIER_DEFAULTS = Object.freeze({
  observation: null, comboIndex: 0, comboUntil: 0, guardStartedTick: -1000, lastGuardTick: -1000,
  forceControl: null, barrierUntil: 0, barrierEnergy: 0, lastForceAbility: null, forceAbilitySequence: 0,
  airborne: null, airborneHeight: 0, landingRecoveryUntil: 0,
});
export function addV9Defaults(game) {
  for (const soldier of game.soldiers) {
    for (const [key, value] of Object.entries(V9_SOLDIER_DEFAULTS)) {
      if (!Object.hasOwn(soldier, key)) soldier[key] = value;
    }
  }
  return game;
}

/** Existing careers and in-flight attacks never acquire a second blade. */
export function addV10Defaults(game) {
  if (!Object.hasOwn(game.config, 'startingDualSabers')) game.config.startingDualSabers = [false, false];
  return game;
}

/** Keep an in-flight older battle intact; its surviving event tail is partial. */
export function addV11Defaults(game) {
  if (!Object.hasOwn(game.config, 'deployments')) game.config.deployments = ['standard', 'standard'];
  if (!Object.hasOwn(game, 'commandState')) game.commandState = createCommandState(game);
  if (!Object.hasOwn(game, 'battleLog')) game.battleLog = createBattleLog({ events: game.events, complete: false });
  if (game.roundReport !== null && !Object.hasOwn(game.roundReport, 'recap')) game.roundReport.recap = null;
  return game;
}


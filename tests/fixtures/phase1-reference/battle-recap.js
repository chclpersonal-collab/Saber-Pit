/** Recorded facts only. No RNG, combat mutation, text parsing or inferred causes. */
import { isValidCommendations } from './mastery.js';
export const BATTLE_LOG_LIMIT = 48;
const types = new Set(['casualty', 'capture', 'relic-pickup', 'relic-drop', 'relic-delivery', 'force', 'guard', 'order']);
const metrics = ['kills', 'deaths', 'environmentDeaths', 'assists', 'blocks', 'counters'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const number = (value, max = 1e9) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const integer = (value, max = 1e9) => Number.isInteger(value) && number(value, max);
const pair = value => Array.isArray(value) && value.length === 2 && value.every(v => number(v));
const copyEvent = entry => ({ id: entry.id, time: entry.time, type: entry.type, team: entry.team, text: entry.text });
const validEvent = entry => keys(entry, ['id', 'time', 'type', 'team', 'text']) && integer(entry.id) && entry.id > 0 && number(entry.time) && types.has(entry.type) && [null, 0, 1].includes(entry.team) && typeof entry.text === 'string' && entry.text.length <= 1000;

/** Mutates only the supplied log. Unselected or invalid entries are ignored. */
export function recordBattleEvent(log, entry) {
  if (!isValidBattleLog(log) || !object(entry)) return log;
  const copy = copyEvent(entry), last = log.events.at(-1);
  if (!validEvent(copy) || last && (copy.id <= last.id || copy.time < last.time)) return log;
  log.events.push(copy); log.total = Math.min(1e9, log.total + 1);
  if (log.events.length > BATTLE_LOG_LIMIT) log.events.shift();
  return log;
}

export function createBattleLog({ events = [], complete = true } = {}) {
  const log = { events: [], total: 0, complete: complete === true };
  if (Array.isArray(events)) for (const entry of events) recordBattleEvent(log, entry);
  return log;
}

export function isValidBattleLog(log, { time = Infinity, nextEventId = Infinity } = {}) {
  if (!keys(log, ['events', 'total', 'complete']) || !Array.isArray(log.events) || log.events.length > BATTLE_LOG_LIMIT || !integer(log.total) || log.total < log.events.length || typeof log.complete !== 'boolean') return false;
  if (log.events.length !== Math.min(log.total, BATTLE_LOG_LIMIT)) return false;
  if (log.total >= nextEventId) return false;
  return log.events.every((entry, i) => validEvent(entry) && entry.time <= time && entry.id < nextEventId && (!i || entry.id > log.events[i - 1].id && entry.time >= log.events[i - 1].time));
}

const copiedPair = value => pair(value) ? [...value] : null;
const totalsFor = game => ({ ...Object.fromEntries(metrics.map(key => [key, copiedPair(game.stats?.[key])])), objective: copiedPair(game.objective?.points), mode: ['elimination', 'control', 'relic'].includes(game.config?.matchMode) ? game.config.matchMode : null });
const coverage = (kind, complete, total, retained, shown) => ({ kind, complete, total, retained, shown, truncated: total > retained, selectionOmitted: retained - shown });
const limitValue = value => Number.isFinite(value) ? Math.max(0, Math.min(BATTLE_LOG_LIMIT, Math.floor(value))) : 8;
const select = (recap, limit) => {
  const result = structuredClone(recap);
  result.events = limit ? result.events.slice(-limit) : [];
  result.coverage.shown = result.events.length;
  result.coverage.selectionOmitted = result.coverage.retained - result.events.length;
  return result;
};

/** Historical snapshots retain their original coverage; missing history is explicit. */
export function buildBattleRecap(game, { round = game?.round, limit = 8 } = {}) {
  const requested = integer(round) && round > 0 ? round : 1, count = limitValue(limit);
  if (requested !== game?.round) {
    const snapshot = game?.roundReport?.round === requested ? game.roundReport.recap : null;
    if (isValidBattleRecap(snapshot, { round: requested })) return select(snapshot, count);
    const history = game?.history?.find(entry => entry.round === requested);
    return { round: requested, status: history ? 'ended' : 'unavailable', winner: history?.winner ?? null, reason: history?.reason ?? '', duration: history?.time ?? 0, totals: history ? { ...Object.fromEntries(metrics.map(key => [key, null])), objective: copiedPair(history.objective), mode: null } : null, events: [], commendations: [], coverage: coverage(history ? 'summary-only' : 'unavailable', false, 0, 0, 0) };
  }
  const valid = isValidBattleLog(game?.battleLog), log = valid ? game.battleLog : createBattleLog({ events: game?.events, complete: false });
  const events = count ? log.events.slice(-count).map(copyEvent) : [];
  const awards = game?.roundReport?.round === requested && Array.isArray(game.roundReport.commendations) ? game.roundReport.commendations.filter(validAward).map(award => structuredClone(award)) : [];
  return { round: requested, status: game?.status === 'ended' ? 'ended' : 'playing', winner: game?.status === 'ended' ? game.winner : null, reason: game?.status === 'ended' ? game.reason : '', duration: game?.time ?? 0, totals: totalsFor(game || {}), events, commendations: awards, coverage: coverage('recorded', log.complete, log.total, log.events.length, events.length) };
}

const validAward = award => isValidCommendations([award]);

export function isValidBattleRecap(recap, { round, teamSizes } = {}) {
  if (!keys(recap, ['round', 'status', 'winner', 'reason', 'duration', 'totals', 'events', 'commendations', 'coverage']) || !integer(recap.round) || recap.round < 1 || round !== undefined && recap.round !== round || !['playing', 'ended', 'unavailable'].includes(recap.status) || ![null, 0, 1].includes(recap.winner) || typeof recap.reason !== 'string' || recap.reason.length > 1000 || !number(recap.duration)) return false;
  const c = recap.coverage;
  if (!keys(c, ['kind', 'complete', 'total', 'retained', 'shown', 'truncated', 'selectionOmitted']) || !['recorded', 'summary-only', 'unavailable'].includes(c.kind) || typeof c.complete !== 'boolean' || typeof c.truncated !== 'boolean' || !integer(c.total) || !integer(c.retained, 48) || !integer(c.shown, 48) || !integer(c.selectionOmitted, 48) || c.total < c.retained || c.retained < c.shown || c.selectionOmitted !== c.retained - c.shown || c.truncated !== (c.total > c.retained)) return false;
  if (!Array.isArray(recap.events) || recap.events.length !== c.shown || !recap.events.every((entry, i) => validEvent(entry) && entry.time <= recap.duration && (!i || entry.id > recap.events[i - 1].id && entry.time >= recap.events[i - 1].time))) return false;
  if (c.kind !== 'recorded' && (c.complete || c.total || c.retained || c.shown)) return false;
  if (c.kind === 'recorded' && c.retained !== Math.min(c.total, BATTLE_LOG_LIMIT)) return false;
  if (recap.status !== 'ended' && (recap.winner !== null || recap.reason !== '')) return false;
  if (c.kind === 'unavailable' && (recap.status !== 'unavailable' || recap.totals !== null || recap.duration !== 0 || recap.commendations?.length)) return false;
  if (c.kind !== 'unavailable' && (recap.status === 'unavailable' || recap.totals === null)) return false;
  if (c.kind === 'summary-only' && (recap.status !== 'ended' || recap.commendations?.length)) return false;
  if (recap.totals !== null && (!keys(recap.totals, [...metrics, 'objective', 'mode']) || ![null, 'elimination', 'control', 'relic'].includes(recap.totals.mode) || [...metrics, 'objective'].some(key => recap.totals[key] !== null && !pair(recap.totals[key])))) return false;
  if (!isValidCommendations(recap.commendations)) return false;
  if (recap.totals && metrics.some(key => recap.totals[key] !== null && !recap.totals[key].every(value => integer(value)))) return false;
  if (teamSizes && recap.commendations.some(a => a.soldierIds.some(id => Number(id.split('-')[1]) >= teamSizes[id.startsWith('blue') ? 0 : 1]))) return false;
  return true;
}

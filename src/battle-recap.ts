type RecapInput = {
  round?:number; time?:number; status?:string; winner?:number|null; reason?:string;
  battleLog?:unknown;events?:unknown;stats?:Partial<Record<Metric,unknown>>;
  config?:{matchMode?:string};objective?:{points?:unknown};
  history?:readonly {round:number;winner?:number|null;reason?:string;time?:number;objective?:unknown}[];
  roundReport?:{round:number;recap?:unknown;commendations?:unknown};
};
type RecapAward = {soldierIds:string[];id:string;metric:number};
type RecapEvent = {id:number;time:number;type:string;team:number|null;text:string};
type UnknownRecord = Record<string,unknown>;
export type BattleLog = {events:RecapEvent[];total:number;complete:boolean};
type Metric = typeof metrics[number];
type RecapTotals = Record<Metric|'objective',number[]|null> & {mode:string|null};
type RecapCoverageKind = 'recorded'|'summary-only'|'unavailable';
export type BattleRecap = {
 round:number;status:'playing'|'ended'|'unavailable';winner:number|null;reason:string;duration:number;
 totals:RecapTotals|null;events:RecapEvent[];commendations:RecapAward[];coverage:ReturnType<typeof coverage>;
};
/** Recorded facts only. No RNG, combat mutation, text parsing or inferred causes. */
import { isValidCommendations } from './mastery.js?v=1.4.0';
export const BATTLE_LOG_LIMIT = 48;
const types = new Set(['casualty', 'capture', 'relic-pickup', 'relic-drop', 'relic-delivery', 'force', 'guard', 'order']);
const metrics = ['kills', 'deaths', 'environmentDeaths', 'assists', 'blocks', 'counters'] as const;
const object = (value:unknown):value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value:unknown, expected:readonly string[]):value is UnknownRecord => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const number = (value:unknown, max = 1e9):value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const integer = (value:unknown, max = 1e9):value is number => Number.isInteger(value) && number(value, max);
const pair = (value:unknown):value is [number,number] => Array.isArray(value) && value.length === 2 && value.every(v => number(v));
const copyEvent = (entry:UnknownRecord|RecapEvent) => ({ id: entry.id, time: entry.time, type: entry.type, team: entry.team, text: entry.text });
const validEvent = (entry:unknown):entry is RecapEvent => keys(entry, ['id', 'time', 'type', 'team', 'text']) && integer(entry.id) && entry.id > 0 && number(entry.time) && types.has(entry.type as string) && [null, 0, 1].includes(entry.team as number|null) && typeof entry.text === 'string' && entry.text.length <= 1000;

/** Mutates only the supplied log. Unselected or invalid entries are ignored. */
export function recordBattleEvent<T>(log:T, entry:unknown):T {
  if (!isValidBattleLog(log) || !object(entry)) return log;
  const copy = copyEvent(entry), last = log.events.at(-1);
  if (!validEvent(copy) || last && (copy.id <= last.id || copy.time < last.time)) return log;
  log.events.push(copy); log.total = Math.min(1e9, log.total + 1);
  if (log.events.length > BATTLE_LOG_LIMIT) log.events.shift();
  return log;
}

export function createBattleLog({ events = [], complete = true }:{events?:unknown;complete?:unknown} = {}):BattleLog {
  const log:BattleLog = { events: [], total: 0, complete: complete === true };
  if (Array.isArray(events)) for (const entry of events) recordBattleEvent(log, entry);
  return log;
}

export function isValidBattleLog(log:unknown, { time = Infinity, nextEventId = Infinity } = {}):log is BattleLog {
  if (!keys(log, ['events', 'total', 'complete']) || !Array.isArray(log.events) || log.events.length > BATTLE_LOG_LIMIT || !integer(log.total) || log.total < log.events.length || typeof log.complete !== 'boolean') return false;
  if (log.events.length !== Math.min(log.total, BATTLE_LOG_LIMIT)) return false;
  if (log.total >= nextEventId) return false;
  const events=log.events as RecapEvent[];
  return events.every((entry, i) => validEvent(entry) && entry.time <= time && entry.id < nextEventId && (!i || entry.id > events[i - 1].id && entry.time >= events[i - 1].time));
}

const copiedPair = (value:unknown) => pair(value) ? [...value] : null;
const totalsFor = (game:RecapInput):RecapTotals => ({ ...(Object.fromEntries(metrics.map(key => [key, copiedPair(game.stats?.[key])])) as Record<Metric,number[]|null>), objective: copiedPair(game.objective?.points), mode: ['elimination', 'control', 'relic'].includes(game.config?.matchMode as string) ? game.config!.matchMode! : null });
const coverage = (kind:RecapCoverageKind, complete:boolean, total:number, retained:number, shown:number) => ({ kind, complete, total, retained, shown, truncated: total > retained, selectionOmitted: retained - shown });
const limitValue = (value:number) => Number.isFinite(value) ? Math.max(0, Math.min(BATTLE_LOG_LIMIT, Math.floor(value))) : 8;
const select = (recap:BattleRecap, limit:number) => {
  const result = structuredClone(recap);
  result.events = limit ? result.events.slice(-limit) : [];
  result.coverage.shown = result.events.length;
  result.coverage.selectionOmitted = result.coverage.retained - result.events.length;
  return result;
};

/** Historical snapshots retain their original coverage; missing history is explicit. */
export function buildBattleRecap(game:RecapInput|null|undefined, { round = game?.round, limit = 8 }:{round?:number;limit?:number} = {}):BattleRecap {
  const requested = integer(round) && round > 0 ? round : 1, count = limitValue(limit);
  if (requested !== game?.round) {
    const snapshot = game?.roundReport?.round === requested ? game!.roundReport!.recap : null;
    if (isValidBattleRecap(snapshot, { round: requested })) return select(snapshot, count);
    const history = game?.history?.find(entry => entry.round === requested);
    return { round: requested, status: history ? 'ended' : 'unavailable', winner: history?.winner ?? null, reason: history?.reason ?? '', duration: history?.time ?? 0, totals: history ? { ...(Object.fromEntries(metrics.map(key => [key, null])) as Record<Metric,null>), objective: copiedPair(history.objective), mode: null } : null, events: [], commendations: [], coverage: coverage(history ? 'summary-only' : 'unavailable', false, 0, 0, 0) };
  }
  const storedLog = game?.battleLog, log = isValidBattleLog(storedLog) ? storedLog : createBattleLog({ events: game?.events, complete: false });
  const events = count ? log.events.slice(-count).map(entry=>copyEvent(entry) as RecapEvent) : [];
  const awards = game?.roundReport?.round === requested && Array.isArray(game!.roundReport!.commendations) ? game!.roundReport!.commendations.filter(validAward).map(award => structuredClone(award)) : [];
  return { round: requested, status: game?.status === 'ended' ? 'ended' : 'playing', winner: game?.status === 'ended' ? game.winner! : null, reason: game?.status === 'ended' ? game.reason! : '', duration: game?.time ?? 0, totals: totalsFor(game || {}), events, commendations: awards, coverage: coverage('recorded', log.complete, log.total, log.events.length, events.length) };
}

const validAward = (award:unknown):award is RecapAward => isValidCommendations([award],undefined);

export function isValidBattleRecap(raw:unknown, { round, teamSizes }:{round?:number;teamSizes?:readonly number[]} = {}):raw is BattleRecap {
  const recap=raw as BattleRecap;
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
  if (recap.totals !== null && (!keys(recap.totals, [...metrics, 'objective', 'mode']) || ![null, 'elimination', 'control', 'relic'].includes(recap.totals.mode) || ([...metrics, 'objective'] as const).some(key => recap.totals![key] !== null && !pair(recap.totals![key])))) return false;
  if (!isValidCommendations(recap.commendations,undefined)) return false;
  if (recap.totals && metrics.some(key => recap.totals![key] !== null && !recap.totals![key]!.every(value => integer(value)))) return false;
  if (teamSizes && recap.commendations.some(a => a.soldierIds.some(id => Number(id.split('-')[1]) >= teamSizes[id.startsWith('blue') ? 0 : 1]))) return false;
  return true;
}

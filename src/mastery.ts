// @ts-nocheck
/** Observed form practice and round recognition. These records confer no buffs.
 * Careers, equipment and veteran experience remain separate systems. */
import { FORMS } from './content.js?v=1.4.0';

export const MAX_PRACTICE_COUNT = 1e9;
export const PRACTICE_FORMS = Object.freeze(Object.keys(FORMS));
export const ROUND_PRACTICE_LIMITS = Object.freeze({
  ticks: 9000, kills: 15, damage: 1e6, blocks: 10000, objectiveSeconds: 150.001,
});
export const COMMENDATION_RULES = Object.freeze([
  Object.freeze({ id: 'mvp', label: 'Round MVP', metric: 'damageDealt',
    description: 'Most recorded damage; kills break ties. Equal leaders share this round commendation.' }),
  Object.freeze({ id: 'defender', label: 'Defender', metric: 'blocks',
    description: 'Most recorded blocks. Equal leaders share this round commendation.' }),
  Object.freeze({ id: 'objective', label: 'Objective keeper', metric: 'objectiveSeconds',
    description: 'Most recorded eligible objective seconds. Equal leaders share this round commendation.' }),
]);

const metrics = ['kills', 'damage', 'blocks', 'objectiveSeconds'];
const recordKeys = ['rounds', ...metrics];
const ledgerKeys = ['ticks', ...metrics];
const awardIds = COMMENDATION_RULES.map(rule => rule.id);
const integerMetrics = new Set(['ticks', 'rounds', 'kills', 'blocks']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length
  && expected.every(key => Object.hasOwn(value, key));
const bounded = (value, max, integer = false) => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= max && (!integer || Number.isInteger(value));
const empty = fields => Object.fromEntries(fields.map(key => [key, 0]));
const copyForms = forms => Object.fromEntries(PRACTICE_FORMS.map(id => [id, { ...forms[id] }]));
const compareIds = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const validId = id => typeof id === 'string' && /^(?:blue|red)-(?:[0-9]|1[0-4])$/.test(id);
const totalFor = (ledger, metric) => PRACTICE_FORMS.reduce((sum, form) => sum + ledger[form][metric], 0);

/** Neutral, detached records. Never reconstruct practice from an old career. */
export function createMastery() {
  return {
    lastSettledRound: 0,
    forms: Object.fromEntries(PRACTICE_FORMS.map(id => [id, empty(recordKeys)])),
    commendations: empty(awardIds),
  };
}

/** The engine records live ticks and actual resolved metrics under their form. */
export function createRoundPractice() {
  return Object.fromEntries(PRACTICE_FORMS.map(id => [id, empty(ledgerKeys)]));
}

/** Strict checks for untrusted persistence. Unknown/missing forms are invalid. */
export function isValidMastery(value) {
  if (!keys(value, ['lastSettledRound', 'forms', 'commendations'])
    || !bounded(value.lastSettledRound, MAX_PRACTICE_COUNT, true)
    || !keys(value.forms, PRACTICE_FORMS) || !keys(value.commendations, awardIds)) return false;
  if (!awardIds.every(id => bounded(value.commendations[id], value.lastSettledRound, true))) return false;
  return PRACTICE_FORMS.every(id => {
    const row = value.forms[id];
    return keys(row, recordKeys) && recordKeys.every(key => bounded(row[key],
      key === 'rounds' ? value.lastSettledRound : MAX_PRACTICE_COUNT, integerMetrics.has(key)))
      && (row.rounds > 0 || metrics.every(key => row[key] === 0));
  });
}

export function isValidRoundPractice(value) {
  if (!keys(value, PRACTICE_FORMS)) return false;
  if (!PRACTICE_FORMS.every(id => keys(value[id], ledgerKeys) && ledgerKeys.every(key =>
    bounded(value[id][key], ROUND_PRACTICE_LIMITS[key], integerMetrics.has(key))))) return false;
  // A form change divides one fighter's round; it cannot multiply its limits.
  return ledgerKeys.every(key => bounded(totalFor(value, key), ROUND_PRACTICE_LIMITS[key], integerMetrics.has(key)));
}

/** Optional immutable event helper. The engine may update its own valid ledger
 * in place instead. Counts are integers; damage and seconds preserve evidence. */
export function recordPractice(ledger, form, metric, amount = 1) {
  if (!isValidRoundPractice(ledger)) throw new TypeError('Invalid round form practice');
  const next = copyForms(ledger);
  if (!PRACTICE_FORMS.includes(form) || !ledgerKeys.includes(metric)
    || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return next;
  const credit = integerMetrics.has(metric) ? Math.floor(amount) : amount;
  const remaining = Math.max(0, ROUND_PRACTICE_LIMITS[metric] - totalFor(ledger, metric));
  next[form][metric] += Math.min(credit, remaining);
  return next;
}

/** Settle once after a round ends, never on load or form selection. The saved
 * watermark makes retries and older reports inert. A form must have observed
 * live time or a resolved metric; selecting it for an unused/dead slot is not
 * practice. In-flight attacks can correctly count their original form. */
export function settleMastery(previous, round, ledger, commendations = []) {
  if (!isValidMastery(previous)) throw new TypeError('Invalid form mastery');
  if (!bounded(round, MAX_PRACTICE_COUNT, true) || round === 0) throw new RangeError('Invalid settlement round');
  if (!isValidRoundPractice(ledger)) throw new TypeError('Invalid round form practice');
  if (!Array.isArray(commendations) || commendations.some(id => !awardIds.includes(id))) throw new TypeError('Invalid round commendations');
  const next = { lastSettledRound: previous.lastSettledRound,
    forms: copyForms(previous.forms), commendations: { ...previous.commendations } };
  if (round <= previous.lastSettledRound) return next;
  next.lastSettledRound = round;
  for (const form of PRACTICE_FORMS) {
    const observed = ledger[form];
    if (!ledgerKeys.some(key => observed[key] > 0)) continue;
    const row = next.forms[form];
    row.rounds = Math.min(MAX_PRACTICE_COUNT, row.rounds + 1);
    for (const metric of metrics) row[metric] = Math.min(MAX_PRACTICE_COUNT, row[metric] + observed[metric]);
  }
  // An empty ledger must not acquire recognition from a supplied award label.
  if (PRACTICE_FORMS.some(form => metrics.some(key => ledger[form][key] > 0))) {
    for (const id of new Set(commendations)) next.commendations[id] = Math.min(MAX_PRACTICE_COUNT, next.commendations[id] + 1);
  }
  return next;
}

/** Recognition is descriptive, not a skill rating. Use only observed ledgers:
 * old saves lack per-form attribution and must not invent past achievements.
 * Positive metrics are required. Final ties are shared in stable ID order. */
export function createCommendations(soldiers = []) {
  if (!Array.isArray(soldiers)) return [];
  const seen = new Set();
  const candidates = soldiers.filter(soldier => {
    if (!object(soldier) || !validId(soldier.id) || !isValidRoundPractice(soldier.formPractice) || seen.has(soldier.id)) return false;
    seen.add(soldier.id); return true;
  }).map(soldier => ({
    id: soldier.id, damageDealt: totalFor(soldier.formPractice, 'damage'),
    kills: totalFor(soldier.formPractice, 'kills'), blocks: totalFor(soldier.formPractice, 'blocks'),
    objectiveSeconds: totalFor(soldier.formPractice, 'objectiveSeconds'),
  }));
  const result = [];
  for (const rule of COMMENDATION_RULES) {
    const value = Math.max(0, ...candidates.map(soldier => soldier[rule.metric]));
    if (value === 0) continue;
    let leaders = candidates.filter(soldier => soldier[rule.metric] === value);
    const kills = rule.id === 'mvp' ? Math.max(...leaders.map(soldier => soldier.kills)) : 0;
    if (rule.id === 'mvp') leaders = leaders.filter(soldier => soldier.kills === kills);
    result.push({ ...rule, value, kills, soldierIds: leaders.map(soldier => soldier.id).sort(compareIds) });
  }
  return result;
}

/** Pass soldiers when validating an ended report against the current ledger.
 * Omit them for an older, retained report whose battle is no longer current. */
export function isValidCommendations(value, soldiers) {
  if (!Array.isArray(value) || value.length > COMMENDATION_RULES.length) return false;
  let previousIndex = -1;
  for (const award of value) {
    if (!keys(award, ['id', 'label', 'metric', 'description', 'value', 'kills', 'soldierIds'])) return false;
    const index = awardIds.indexOf(award.id), rule = COMMENDATION_RULES[index];
    if (!rule || index <= previousIndex || award.label !== rule.label || award.metric !== rule.metric
      || award.description !== rule.description) return false;
    previousIndex = index;
    const limit = ROUND_PRACTICE_LIMITS[rule.id === 'mvp' ? 'damage' : rule.metric];
    if (!bounded(award.value, limit, rule.id === 'defender') || award.value <= 0
      || !bounded(award.kills, ROUND_PRACTICE_LIMITS.kills, true) || (rule.id !== 'mvp' && award.kills !== 0)
      || !Array.isArray(award.soldierIds) || award.soldierIds.length < 1 || award.soldierIds.length > 30) return false;
    if (!award.soldierIds.every((id, i) => validId(id) && (!i || compareIds(award.soldierIds[i - 1], id) < 0))) return false;
  }
  if (soldiers !== undefined) {
    if (!Array.isArray(soldiers)) return false;
    const expected = createCommendations(soldiers);
    if (value.length !== expected.length || value.some((award, i) =>
      award.id !== expected[i].id || award.value !== expected[i].value || award.kills !== expected[i].kills
      || award.soldierIds.join('|') !== expected[i].soldierIds.join('|'))) return false;
  }
  return true;
}

/** UI-only snapshot. There are deliberately no power multipliers or levels. */
export function masterySummary(mastery, form) {
  const source = isValidMastery(mastery) ? mastery : createMastery();
  const id = PRACTICE_FORMS.includes(form) ? form : PRACTICE_FORMS[0];
  return { form: id, formName: FORMS[id].name, ...source.forms[id],
    commendations: { ...source.commendations },
    totalCommendations: awardIds.reduce((sum, key) => sum + source.commendations[key], 0) };
}

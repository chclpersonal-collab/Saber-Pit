import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PRACTICE_COUNT, PRACTICE_FORMS, ROUND_PRACTICE_LIMITS, COMMENDATION_RULES,
  createMastery, createRoundPractice, recordPractice, settleMastery,
  createCommendations, isValidMastery, isValidRoundPractice,
  isValidCommendations, masterySummary,
} from '../dist/mastery.js';

const deepFreeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};
const ledger = (form, metrics) => Object.assign(createRoundPractice(), { [form]: { ...createRoundPractice()[form], ...metrics } });
const soldier = (id, metrics, form = 'shii_cho') => ({ id, formPractice: ledger(form, metrics) });

test('practice starts neutral for all nine configurations, independently of career', () => {
  const first = createMastery(), other = createMastery();
  assert.equal(PRACTICE_FORMS.length, 9);
  assert.equal(isValidMastery(first), true);
  assert.equal(isValidRoundPractice(createRoundPractice()), true);
  assert.equal(first.lastSettledRound, 0);
  assert.deepEqual(first.commendations, { mvp: 0, defender: 0, objective: 0 });
  for (const form of PRACTICE_FORMS) assert.deepEqual(first.forms[form], { rounds: 0, kills: 0, damage: 0, blocks: 0, objectiveSeconds: 0 });
  first.forms.shii_cho.damage = 9;
  assert.equal(other.forms.shii_cho.damage, 0);
  assert.equal(first.forms.makashi.damage, 0);
  assert.equal(createMastery({ merit: 2400 }).lastSettledRound, 0, 'old career data cannot invent form practice');
});

test('settlement is immutable, exact once, and unchanged after JSON load or older replay', () => {
  const before = deepFreeze(createMastery());
  const evidence = deepFreeze(ledger('makashi', { ticks: 120, kills: 2, damage: 128.75, blocks: 3, objectiveSeconds: 1.5 }));
  const after = settleMastery(before, 4, evidence, ['mvp', 'defender', 'mvp']);
  assert.deepEqual(after.forms.makashi, { rounds: 1, kills: 2, damage: 128.75, blocks: 3, objectiveSeconds: 1.5 });
  assert.deepEqual(after.commendations, { mvp: 1, defender: 1, objective: 0 });
  assert.equal(after.lastSettledRound, 4);
  assert.equal(isValidMastery(after), true);
  assert.deepEqual(before, createMastery());
  const loaded = JSON.parse(JSON.stringify(after));
  assert.deepEqual(settleMastery(loaded, 4, evidence, ['mvp', 'defender']), after);
  assert.deepEqual(settleMastery(loaded, 3, evidence, ['objective']), after);
  assert.equal(settleMastery(after, 5, evidence).forms.makashi.rounds, 2);
});

test('only forms with observed participation or resolved metrics receive a round', () => {
  let evidence = recordPractice(createRoundPractice(), 'soresu', 'ticks', 20);
  evidence = recordPractice(evidence, 'ataru', 'damage', 8.25); // In-flight strike after a form switch.
  const after = settleMastery(createMastery(), 1, evidence);
  assert.equal(after.forms.soresu.rounds, 1);
  assert.equal(after.forms.ataru.rounds, 1);
  assert.equal(after.forms.ataru.damage, 8.25);
  assert.equal(after.forms.juyo.rounds, 0, 'an unobserved selection gets no credit');
  assert.equal(after.forms.vaapad.rounds, 0, 'an unused dead slot gets no credit');
  const empty = settleMastery(createMastery(), 9, createRoundPractice(), ['mvp']);
  assert.equal(empty.lastSettledRound, 9, 'empty settlements still consume their idempotency key');
  assert.deepEqual(empty.forms, createMastery().forms);
  assert.deepEqual(empty.commendations, createMastery().commendations);
  assert.deepEqual(settleMastery(empty, 9, evidence, ['mvp']), empty, 'late resends cannot rewrite a settled round');
});

test('practice never gives a combat bonus and UI snapshots do not mutate records', () => {
  const trained = settleMastery(createMastery(), 1, ledger('niman', { ticks: 30, damage: 12, blocks: 1 }), ['mvp']);
  const summary = masterySummary(deepFreeze(trained), 'niman');
  assert.deepEqual(Object.keys(summary), ['form', 'formName', 'rounds', 'kills', 'damage', 'blocks', 'objectiveSeconds', 'commendations', 'totalCommendations']);
  assert.equal(summary.formName, 'Niman');
  assert.equal(summary.totalCommendations, 1);
  summary.commendations.mvp = 99;
  assert.equal(trained.commendations.mvp, 1);
  assert.equal(masterySummary(null, 'unknown').rounds, 0);
});

test('lifetime records and category awards cap without inflating or aliasing prior state', () => {
  const before = createMastery();
  before.lastSettledRound = MAX_PRACTICE_COUNT - 1;
  before.forms.shien = { rounds: MAX_PRACTICE_COUNT - 1, kills: MAX_PRACTICE_COUNT - 1,
    damage: MAX_PRACTICE_COUNT - .5, blocks: MAX_PRACTICE_COUNT - 1, objectiveSeconds: MAX_PRACTICE_COUNT - .5 };
  before.commendations = { mvp: MAX_PRACTICE_COUNT - 1, defender: MAX_PRACTICE_COUNT - 1, objective: MAX_PRACTICE_COUNT - 1 };
  const after = settleMastery(deepFreeze(before), MAX_PRACTICE_COUNT,
    ledger('shien', { ticks: 1, kills: 2, damage: 2, blocks: 2, objectiveSeconds: 2 }), ['mvp', 'defender', 'objective']);
  assert.equal(isValidMastery(after), true);
  for (const value of Object.values(after.forms.shien)) assert.equal(value, MAX_PRACTICE_COUNT);
  for (const value of Object.values(after.commendations)) assert.equal(value, MAX_PRACTICE_COUNT);
  assert.deepEqual(settleMastery(after, MAX_PRACTICE_COUNT, createRoundPractice()), after);
});

test('event helper bounds counts and round totals across form changes', () => {
  const original = deepFreeze(createRoundPractice());
  let next = recordPractice(original, 'shii_cho', 'ticks', 8999.7);
  next = recordPractice(next, 'makashi', 'ticks', 10);
  assert.equal(next.shii_cho.ticks, 8999);
  assert.equal(next.makashi.ticks, 1);
  next = recordPractice(next, 'niman', 'kills', 20);
  next = recordPractice(next, 'juyo', 'kills', 2);
  assert.equal(next.niman.kills, ROUND_PRACTICE_LIMITS.kills);
  assert.equal(next.juyo.kills, 0);
  assert.equal(isValidRoundPractice(next), true);
  for (const bad of [NaN, Infinity, -1, '3', null, {}]) assert.deepEqual(recordPractice(next, 'niman', 'damage', bad), next);
  assert.deepEqual(recordPractice(next, 'bogus', 'damage', 100), next);
  assert.deepEqual(recordPractice(next, 'niman', 'bonus', 100), next);
  assert.deepEqual(original, createRoundPractice());
});

test('strict validation rejects missing, unknown, nonfinite and inconsistent records', () => {
  for (const bad of [null, undefined, [], {}, 42, 'practice']) {
    assert.equal(isValidMastery(bad), false);
    assert.equal(isValidRoundPractice(bad), false);
  }
  const mutations = [
    value => { delete value.forms.shii_cho; },
    value => { value.forms.unknown = { ...value.forms.shii_cho }; },
    value => { value.forms.shii_cho.rounds = 1; },
    value => { value.forms.shii_cho.damage = 5; },
    value => { value.commendations.mvp = 1; },
    value => { value.lastSettledRound = .5; },
    value => { value.lastSettledRound = Infinity; },
    value => { value.forms.shii_cho.bonus = 1; },
    value => { value.forms.shii_cho.kills = NaN; },
    value => { value.forms.shii_cho.blocks = -1; },
  ];
  for (const mutate of mutations) { const value = createMastery(); mutate(value); assert.equal(isValidMastery(value), false); }
  for (const [metric, invalid] of [['ticks', 9001], ['kills', 15.5], ['damage', Infinity], ['blocks', -1], ['objectiveSeconds', 151]]) {
    assert.equal(isValidRoundPractice(ledger('soresu', { [metric]: invalid })), false);
  }
  const doubled = ledger('shii_cho', { ticks: 5000 }); doubled.makashi.ticks = 5000;
  assert.equal(isValidRoundPractice(doubled), false);
  assert.throws(() => settleMastery(createMastery(), 0, createRoundPractice()), /round/);
  assert.throws(() => settleMastery({}, 1, createRoundPractice()), /mastery/);
  assert.throws(() => settleMastery(createMastery(), 1, {}, []), /practice/);
  assert.throws(() => settleMastery(createMastery(), 1, createRoundPractice(), ['invented']), /commendations/);
});

test('commendations explain positive observed metrics, with kills breaking damage ties', () => {
  const fighters = deepFreeze([
    soldier('blue-0', { damage: 120, kills: 1, blocks: 3, objectiveSeconds: 2 }),
    soldier('red-0', { damage: 120, kills: 2, blocks: 1, objectiveSeconds: 3 }),
    soldier('blue-1', { damage: 50, kills: 3, blocks: 5, objectiveSeconds: 1 }),
  ]);
  const awards = createCommendations(fighters);
  assert.deepEqual(awards.map(({ id, value, kills, soldierIds }) => ({ id, value, kills, soldierIds })), [
    { id: 'mvp', value: 120, kills: 2, soldierIds: ['red-0'] },
    { id: 'defender', value: 5, kills: 0, soldierIds: ['blue-1'] },
    { id: 'objective', value: 3, kills: 0, soldierIds: ['red-0'] },
  ]);
  assert.equal(isValidCommendations(awards, fighters), true);
  assert.equal(isValidCommendations(JSON.parse(JSON.stringify(awards))), true);
  for (const award of awards) assert.equal(award.description, COMMENDATION_RULES.find(rule => rule.id === award.id).description);
});

test('exact ties share recognition in stable ID order regardless of soldier order', () => {
  const a = soldier('red-0', { damage: 12, kills: 1, blocks: 2, objectiveSeconds: 4 });
  const b = soldier('blue-10', { damage: 12, kills: 1, blocks: 2, objectiveSeconds: 4 });
  const c = soldier('blue-2', { damage: 12, kills: 1, blocks: 2, objectiveSeconds: 4 });
  const awards = createCommendations([a, b, c]);
  assert.deepEqual(awards, createCommendations([c, a, b]));
  for (const award of awards) assert.deepEqual(award.soldierIds, ['blue-10', 'blue-2', 'red-0']);
});

test('legacy totals, survival, selections and labels alone cannot invent commendations', () => {
  const migrated = { ...soldier('blue-0', {}), damageDealt: 999, kills: 15, blocks: 50, objectiveSeconds: 90, alive: true, form: 'juyo' };
  assert.deepEqual(createCommendations([migrated]), []);
  assert.deepEqual(createCommendations([soldier('blue-0', { ticks: 9000 })]), []);
  assert.deepEqual(createCommendations([{ id: 'blue-0', damageDealt: 999 }]), []);
  assert.deepEqual(createCommendations(null), []);
  assert.equal(isValidCommendations([], [migrated]), true);
  const observed = soldier('blue-0', { damage: 1, blocks: 1 });
  assert.equal(isValidCommendations([], [observed]), false);
});

test('commendation validation rejects fabricated winners, values, categories and duplicate grants', () => {
  const fighters = [soldier('blue-0', { damage: 40, kills: 1 }), soldier('red-0', { damage: 30 })];
  const valid = createCommendations(fighters);
  const mutations = [
    value => { value[0].soldierIds = ['red-0']; },
    value => { value[0].value = 41; },
    value => { value[0].kills = 2; },
    value => { value[0].soldierIds = ['blue-0', 'blue-0']; },
    value => { value[0].label = 'Legendary master'; },
    value => { value[0].description = 'Power increased'; },
    value => { value[0].value = 0; },
    value => { value[0].value = Infinity; },
    value => { value.push({ ...value[0] }); },
    value => { value[0].bonus = 20; },
  ];
  for (const mutate of mutations) {
    const value = JSON.parse(JSON.stringify(valid)); mutate(value);
    assert.equal(isValidCommendations(value, fighters), false);
  }
});

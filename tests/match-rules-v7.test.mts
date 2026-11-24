import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_MODES, ROUND_DURATIONS, DEFAULT_MATCH_RULES, normalizeMatchRules, describeMatchRules, resolveRoundOutcome } from '../dist/match-rules.js';

const soldier = (team, hp = 120, alive = hp > 0) => ({ team, hp, alive });
const battle = (options = {}, extra = {}) => ({
  config: normalizeMatchRules(options), tick: 0,
  soldiers: [soldier(0), soldier(1)],
  objective: { points: [0, 0], targetScore: 30 },
  ...extra,
});
const timeout = (options = {}, extra = {}) => battle(options, { tick: (options.roundDuration ?? 90) * 60, ...extra });

test('match defaults preserve legacy control, 90 seconds and a 30-point signal', () => {
  assert.deepEqual(normalizeMatchRules(), { matchMode: 'control', roundDuration: 90, targetScore: 30 });
  assert.deepEqual(normalizeMatchRules({ unrelated: true }), DEFAULT_MATCH_RULES);
  assert.deepEqual(ROUND_DURATIONS, [45, 90, 150]);
  assert.deepEqual(Object.keys(MATCH_MODES), ['control', 'elimination', 'relic']);
  for (const mode of Object.values(MATCH_MODES)) assert.ok(Object.isFrozen(mode));
  assert.ok(Object.isFrozen(MATCH_MODES) && Object.isFrozen(ROUND_DURATIONS) && Object.isFrozen(DEFAULT_MATCH_RULES));
  const options = { matchMode: 'elimination', roundDuration: 45, targetScore: 30 };
  assert.deepEqual(normalizeMatchRules(options), options);
  assert.notEqual(normalizeMatchRules(options), options);
});

test('unsupported modes, durations and signal targets fail explicitly', () => {
  for (const matchMode of ['', 'capture', 'constructor', '__proto__', 0, true, {}]) assert.throws(() => normalizeMatchRules({ matchMode }), RangeError);
  for (const roundDuration of [0, -1, 44, 46, 89, 91, 149, 151, '45', NaN, Infinity, true]) assert.throws(() => normalizeMatchRules({ roundDuration }), RangeError);
  for (const targetScore of [0, -1, 15, 29, 31, '30', NaN, Infinity, true]) assert.throws(() => normalizeMatchRules({ targetScore }), RangeError);
  for (const options of [null, [], 4, 'control']) assert.throws(() => normalizeMatchRules(options), RangeError);
});

test('both modes settle on the exact configured tick, with no premature timeout', () => {
  for (const matchMode of Object.keys(MATCH_MODES)) for (const roundDuration of ROUND_DURATIONS) {
    const game = timeout({ matchMode, roundDuration });
    game.tick--;
    assert.equal(resolveRoundOutcome(game), null);
    game.tick++;
    const result = resolveRoundOutcome(game);
    assert.equal(result.winner, null);
    assert.deepEqual(result.survivors, [1, 1]);
    assert.deepEqual(result.health, [120, 120]);
    assert.match(result.reason, /^Time limit:/);
  }
});

test('signal threshold ends control and never ends elimination', () => {
  for (const team of [0, 1]) {
    const points = team === 0 ? [30, 0] : [0, 30];
    const control = battle({}, { objective: { points }, tick: 150 });
    const result = resolveRoundOutcome(control);
    assert.equal(result.winner, team);
    assert.equal(result.reason, 'Signal post secured');
    assert.equal(resolveRoundOutcome({ ...control, config: normalizeMatchRules({ matchMode: 'elimination' }) }), null);
    control.objective.points[team] = 29.99;
    assert.equal(resolveRoundOutcome(control), null);
    control.objective.points[team] = 30 - 1e-9;
    assert.equal(resolveRoundOutcome(control).winner, team);
  }
});

test('elimination and mutual defeat take precedence over signal points in either mode', () => {
  for (const matchMode of Object.keys(MATCH_MODES)) {
    const game = battle({ matchMode }, { soldiers: [soldier(0, 0), soldier(1, 5)], objective: { points: [30, 0] } });
    assert.equal(resolveRoundOutcome(game).winner, 1);
    assert.equal(resolveRoundOutcome(game).reason, 'Squad defeated');
    game.soldiers[1] = soldier(1, 0);
    const result = resolveRoundOutcome(game);
    assert.equal(result.winner, null);
    assert.equal(result.reason, 'Mutual defeat');
    assert.deepEqual(result.health, [0, 0]);
  }
});

test('control timeout prioritizes signal points, then survivors, then total living health', () => {
  const game = timeout({}, { soldiers: [soldier(0, 1), soldier(1), soldier(1)], objective: { points: [1, 0] } });
  assert.equal(resolveRoundOutcome(game).winner, 0, 'signal points beat an opposing survivor advantage');
  game.objective.points = [1, 1];
  assert.equal(resolveRoundOutcome(game).winner, 1, 'survivors break equal points');
  game.soldiers = [soldier(0, 100), soldier(0, 20), soldier(1, 100), soldier(1, 19)];
  assert.equal(resolveRoundOutcome(game).winner, 0, 'total living HP breaks equal survivor counts');
  game.soldiers[3].hp = 20;
  assert.equal(resolveRoundOutcome(game).winner, null, 'exactly equal totals draw without consuming randomness');
});

test('elimination timeout ignores even a winning signal lead and compares survivors, then health', () => {
  const game = timeout({ matchMode: 'elimination' }, { soldiers: [soldier(0, 120), soldier(1, 1), soldier(1, 1)], objective: { points: [30, 0] } });
  assert.equal(resolveRoundOutcome(game).winner, 1, 'survivors win even with less health and fewer signal points');
  game.soldiers = [soldier(0, 10), soldier(1, 20)];
  assert.equal(resolveRoundOutcome(game).winner, 1, 'health breaks a tied survivor count');
  game.soldiers[0].hp = 20;
  assert.equal(resolveRoundOutcome(game).winner, null, 'signal points cannot break an elimination tie');
  assert.equal(resolveRoundOutcome(game).reason, 'Time limit: survivors, then health');
});

test('settlement preserves legacy thousandth precision and excludes dead fighters from health', () => {
  const game = timeout({}, { soldiers: [soldier(0, .1), soldier(0, .2), soldier(0, 999, false), soldier(1, .15), soldier(1, .15)], objective: { points: [.1 + .2, .3] } });
  const result = resolveRoundOutcome(game);
  assert.equal(result.winner, null);
  assert.deepEqual(result.survivors, [2, 2]);
  assert.deepEqual(result.health, [.3, .3]);
  game.soldiers[0].hp += .001;
  assert.equal(resolveRoundOutcome(game).winner, 0);
});

test('settlement is pure, detached and independent of global randomness or roster ordering', () => {
  const game = timeout({ matchMode: 'elimination', roundDuration: 150 }, { soldiers: [soldier(0, 20), soldier(0, 31), soldier(1, 40), soldier(1, 11)] });
  const prior = structuredClone(game), random = Math.random;
  Math.random = () => { throw new Error('Match rules must not consume randomness'); };
  try {
    const first = resolveRoundOutcome(game), second = resolveRoundOutcome(game);
    assert.deepEqual(first, second);
    assert.notEqual(first.objective, game.objective.points);
    assert.deepEqual(resolveRoundOutcome({ ...game, soldiers: [...game.soldiers].reverse() }), first);
    first.survivors[0] = 999; first.health[0] = 999; first.objective[0] = 999;
    assert.deepEqual(game, prior);
    assert.deepEqual(resolveRoundOutcome(game), second);
  } finally { Math.random = random; }
});

test('legacy games without config still resolve using default control rules', () => {
  const game = timeout({}, { objective: { points: [0, 1] } });
  delete game.config;
  game.roundDuration = 90;
  assert.equal(resolveRoundOutcome(game).winner, 1);
  for (const tickRate of [0, -1, NaN, Infinity, '60']) assert.throws(() => resolveRoundOutcome(game, tickRate), RangeError);
});

test('shared setup, HUD and report descriptions reflect mode and selected duration', () => {
  for (const roundDuration of ROUND_DURATIONS) {
    const control = describeMatchRules({ roundDuration });
    assert.equal(control.title, 'Control');
    assert.equal(control.objectiveEnabled, true);
    assert.equal(control.objectiveLabel, 'Signal · 30 to win');
    assert.match(control.summary, new RegExp(`At ${roundDuration} seconds,`));
    assert.match(control.summary, /signal points, then survivors, then health/);
    assert.match(control.reportDescription, new RegExp(`Control · ${roundDuration}s`));
    const elimination = describeMatchRules({ matchMode: 'elimination', roundDuration });
    assert.equal(elimination.title, 'Elimination');
    assert.equal(elimination.objectiveEnabled, false);
    assert.equal(elimination.objectiveLabel, 'Elimination · Fighters left');
    assert.match(elimination.summary, /The signal post is off/);
    assert.match(elimination.summary, new RegExp(`At ${roundDuration} seconds,`));
    assert.match(elimination.summary, /survivors, then health/);
    assert.doesNotMatch(elimination.summary, /30|signal points/);
    assert.match(elimination.reportDescription, new RegExp(`Elimination · ${roundDuration}s`));
    assert.doesNotMatch(elimination.reportDescription, /signal points/);
  }
});

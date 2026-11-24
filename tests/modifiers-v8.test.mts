import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFIERS, normalizeModifier, getModifier, permitsForceAttacks } from '../dist/modifiers.js';
import { createGame, normalizeConfig, step, command, commandReadiness, setPlayerInput, duelIntent } from '../dist/sim.js';

test('v8 modifiers are bounded and default to unchanged Standard combat', () => {
  assert.deepEqual(Object.keys(MODIFIERS), ['standard', 'saber_only']);
  assert.equal(normalizeModifier(), 'standard');
  assert.equal(getModifier('saber_only').name, 'Saber only');
  assert.equal(permitsForceAttacks({}), true);
  assert.equal(permitsForceAttacks({ modifier: 'saber_only' }), false);
  for (const modifier of ['unknown', 'constructor', '__proto__', '', null, 1, {}, ['standard']]) {
    assert.throws(() => normalizeModifier(modifier), /modifier/);
    assert.throws(() => normalizeConfig({ modifier }), /modifier/);
  }
  const original = createGame(821, { teamSizes: [3, 3], mapSize: 'small', mode: 'spectate' });
  const explicit = createGame(821, { teamSizes: [3, 3], mapSize: 'small', mode: 'spectate', modifier: 'standard' });
  step(original, 12); step(explicit, 12);
  assert.deepEqual(original, explicit, 'default and explicit Standard must share the same RNG and combat');
});

function duel(modifier, mode = 'spectate', range = 200) {
  const g = createGame(8, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', modifier, mode });
  g._nextAiDecision = 10000;
  g.soldiers.forEach((s, i) => { s.x = 380 + i * range; s.y = 270; s.forceReadyTick = 0; s.saberReadyTick = 0; });
  return g;
}

test('v8 Saber only rejects both teams Force support and aliases without spending resources', () => {
  const standard = duel('standard');
  assert.equal(commandReadiness(standard, 'force').ready, true, 'fixture has a legal Standard Force cast');
  assert.equal(command(standard, 'force'), true);
  assert.equal(standard.soldiers[0].attack.kind, 'force');
  const g = duel('saber_only'), before = structuredClone(g);
  for (const team of [0, 1]) assert.equal(commandReadiness(g, 'force', team).ready, false);
  for (const order of ['force', 'wave', 'grenade']) assert.equal(command(g, order), false);
  assert.deepEqual(g, before);
});

test('v8 Saber only blocks direct player Force while preserving guard, dash and saber attacks', () => {
  const g = duel('saber_only', 'play'), a = g.soldiers[0];
  setPlayerInput(g, { force: true });
  assert.notEqual(duelIntent(g, a).action, 'force');
  step(g, 1 / 60);
  assert.equal(g.stats.forceCasts[0], 0);
  assert.notEqual(a.attack?.kind, 'force');
  setPlayerInput(g, { guard: true }); step(g, 1 / 60);
  assert.equal(a.guard, true);
  setPlayerInput(g, { guard: false, moveX: 1, dash: true }); step(g, 1 / 60);
  assert.ok(a.dashUntil > g.tick, 'dash remains available to non-carriers');
  const close = duel('saber_only', 'play', 35);
  setPlayerInput(close, { attack: true }); step(close, 1 / 60);
  assert.equal(close.soldiers[0].attack?.kind, 'saber');
});

test('v8 Saber only applies equally to autonomous squads across Force equipment and forms', () => {
  const saberSwings = [0, 0];
  for (const [index, family] of ['force_push', 'force_burst', 'force_pulse'].entries()) {
    const g = createGame(820 + index, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'spectate',
      modifier: 'saber_only', form: 'niman', opponentForm: 'niman',
      startingForceFamily: [family, family], startingForceQuality: ['improved', 'improved'] });
    g._nextAiDecision = 10000;
    g.soldiers.forEach((s, team) => { s.x = 380 + team * 200; s.y = 270; s.forceReadyTick = 0; });
    for (const s of g.soldiers) {
      const intent = duelIntent(g, s);
      assert.equal(intent.move, 'close', 'Niman closes instead of holding unavailable Force spacing');
      assert.doesNotMatch(intent.reason, /Force/);
    }
    g.soldiers[1].x = g.soldiers[0].x + 35;
    step(g, 25);
    assert.deepEqual(g.stats.forceCasts, [0, 0]);
    assert.deepEqual(g.stats.forceHits, [0, 0]);
    assert.ok(g.soldiers.every(s => s.attack?.kind !== 'force'));
    g.stats.saberSwings.forEach((n, team) => { saberSwings[team] += n; });
  }
  assert.ok(saberSwings.every(n => n > 0), 'both squads still fight with sabers');
});

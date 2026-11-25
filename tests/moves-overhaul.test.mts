import test from 'node:test';
import assert from 'node:assert/strict';
import { FORM_MOVESETS, getFormMoves, selectFormMove, formMoveById } from '../dist/combat-forms.js';

const originals = {
  shii_cho: ['opening_sweep', 'crossing_cut', 'clearing_circle'],
  makashi: ['measured_thrust', 'disengaging_point', 'duelists_riposte'],
  soresu: ['shelter_circle', 'close_return', 'patient_riposte'],
  ataru: ['vaulting_cut', 'corkscrew_return', 'somersault_descent'],
  shien: ['returning_guard', 'deflection_sweep', 'returning_edge'],
  djem_so: ['driving_counter', 'guard_breaker', 'descending_finish'],
  niman: ['converging_weave', 'balanced_cross', 'opening_point'],
  juyo: ['relentless_flurry', 'broken_rhythm', 'fierce_finish'],
  vaapad: ['reversal_spiral', 'returning_flurry', 'controlled_reversal'],
};
const fighterFor = (form, move) => ({ form, attack: { kind: 'saber', form, moveId: move.id, startedTick: 10, resolveTick: 40 } });
const movingFields = ['depth', 'footwork', 'bodyRoll', 'twist', 'handHeight'];

test('nine configurations each provide six distinct frozen paths and preserve recorded first-three identities', () => {
  assert.deepEqual(Object.keys(FORM_MOVESETS).sort(), Object.keys(originals).sort());
  for (const [form, ids] of Object.entries(originals)) {
    const moves = getFormMoves(form);
    assert.ok(moves.length >= 6);
    assert.deepEqual(moves.slice(0, 3).map(move => move.id), ids);
    assert.equal(new Set(moves.map(move => move.id)).size, moves.length);
    assert.equal(new Set(moves.map(move => move.animation.path)).size, moves.length);
    assert.equal(selectFormMove(form, moves.length), moves[0]);
    assert.equal(selectFormMove(form, NaN), moves[0]);
    assert.equal(selectFormMove(form, -5), moves[0]);
    for (const move of moves) {
      assert.equal(formMoveById(form, move.id), move);
      assert.ok(Object.isFrozen(move) && Object.isFrozen(move.animation));
      assert.ok(move.energyCost >= 6 && move.energyCost <= 15);
      assert.ok(move.damageMultiplier > 0 && move.damageMultiplier <= 1.3);
      assert.ok(move.windupMultiplier > 0 && move.windupMultiplier <= 2.3);
      assert.ok(move.recoveryMultiplier >= .8 && move.recoveryMultiplier <= 1.3);
      assert.ok(move.reachBonus >= -3 && move.reachBonus <= 8);
      assert.ok([-1, 1].includes(move.animation.direction));
    }
  }
  assert.equal(formMoveById('ataru', 'unrecorded'), null);
});

test('Ataru includes grounded returns, lateral left/right aerials and distinct low/high arcs', () => {
  const moves = getFormMoves('ataru'), aerial = moves.filter(move => move.jump);
  assert.ok(moves.filter(move => !move.jump).length >= 2);
  assert.ok(aerial.some(move => move.jump.lateralDistance < 0));
  assert.ok(aerial.some(move => move.jump.lateralDistance > 0));
  assert.ok(aerial.some(move => move.jump.height < 30));
  assert.ok(aerial.some(move => move.jump.height >= 70));
  assert.ok(new Set(aerial.map(move => move.jump.rotations)).size >= 4);
  assert.ok(aerial.some(move => move.jump.rotations === 0));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMS } from '../dist/content.js?v=1.4.0';
import { combatFormProfile, selectFormMove, getFormMoves, moveSummary } from '../dist/combat-forms.js?v=1.4.0';
import { startAirborne, sampleAirborne, advanceAirborne, airborneHeight, canMeleeHit } from '../dist/airborne.js?v=1.4.0';

test('all seven primary forms retain nine save IDs and have bounded distinct combinations', () => {
  assert.equal(Object.keys(FORMS).length, 9);
  assert.equal(new Set(Object.values(FORMS).map(form => form.primaryForm)).size, 7);
  const signatures = new Set();
  for (const form of Object.values(FORMS)) {
    const moves = getFormMoves(form);
    assert.ok(moves.length >= 3);
    assert.equal(form.moves, moves);
    assert.equal(form.lore.classification, 'game-adaptation');
    assert.equal(selectFormMove(form, moves.length), moves[0]);
    assert.ok(moveSummary(form).includes(moves[2].name));
    signatures.add(JSON.stringify(moves));
    for (const move of moves) {
      assert.ok(Object.isFrozen(move));
      assert.ok(move.energyCost >= 6 && move.energyCost <= 15);
      assert.ok(move.damageMultiplier > 0 && move.damageMultiplier <= 1.3);
      assert.ok(move.windupMultiplier > 0 && move.windupMultiplier <= 2.3);
    }
  }
  assert.equal(signatures.size, 9);
});

test('Ataru arc is tick-derived, reaches a visible apex, lands and recovers', () => {
  const fighter = { x: 100, y: 100, facing: 1 };
  assert.equal(startAirborne(fighter, 10, { ...combatFormProfile('ataru').dashJump, directionX: 1, directionY: 0 }), true);
  assert.equal(airborneHeight(fighter, 10), 0);
  assert.equal(airborneHeight(fighter, 31), 76);
  const apex = sampleAirborne(fighter, 31);
  assert.equal(apex.x, 155);
  assert.equal(apex.rotation, Math.PI * 2);
  for (let tick = 11; tick <= 52; tick++) advanceAirborne(fighter, tick);
  assert.ok(Math.abs(fighter.x - 210) < 1e-8);
  assert.equal(fighter.airborne, null);
  assert.equal(fighter.airborneHeight, 0);
  assert.equal(fighter.landingRecoveryUntil, 64);
  assert.equal(startAirborne(fighter, 53, {}), false);
  assert.equal(startAirborne(fighter, 64, {}), true);
});

test('height changes actual melee contact without granting blanket immunity', () => {
  const air = { x: 0, y: 0 }, ground = { x: 1, y: 1 }, peer = { x: 0, y: 0 };
  startAirborne(air, 0, { durationTicks: 40, height: 70 });
  startAirborne(peer, 0, { durationTicks: 40, height: 70 });
  assert.equal(canMeleeHit(ground, air, 20), false);
  assert.equal(canMeleeHit(peer, air, 20), true);
  assert.equal(canMeleeHit(ground, air, 39), true);
  assert.equal(canMeleeHit(ground, air, 40), true);
});

test('swept collision owns horizontal movement and blocked travel never teleports later', () => {
  const fighter = { x: 0, y: 0 };
  startAirborne(fighter, 0, { durationTicks: 20, height: 50, distance: 100, directionX: 1, directionY: 0 });
  const wall = (unit, dx, dy) => { unit.x = Math.min(35, unit.x + dx); unit.y += dy; };
  for (let tick = 1; tick <= 20; tick++) advanceAirborne(fighter, tick, wall);
  assert.equal(fighter.x, 35);
  assert.equal(fighter.airborne, null);
  advanceAirborne(fighter, 21);
  assert.equal(fighter.x, 35);
});

test('repeated samples and duplicate advance ticks do not advance the trajectory', () => {
  const fighter = { x: 0, y: 0 };
  startAirborne(fighter, 0, { durationTicks: 20, height: 50, distance: 100 });
  assert.deepEqual(sampleAirborne(fighter, 10), sampleAirborne(fighter, 10));
  advanceAirborne(fighter, 10);
  assert.equal(fighter.x, 50);
  advanceAirborne(fighter, 10);
  assert.equal(fighter.x, 50);
  const saved = structuredClone(fighter);
  advanceAirborne(fighter, 20); advanceAirborne(saved, 20);
  assert.deepEqual(fighter, saved);
});

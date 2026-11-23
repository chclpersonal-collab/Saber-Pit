import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../dist/tactics.js';
import { FORMS } from '../dist/content.js';

const duel = Object.freeze({
  energy: 100, distance: 40, saberRange: 47, forceRange: 420,
  saberReady: true, forceReady: true, forceCost: 22, dashReady: true,
  counterReady: false, guardOrdered: false, forceRequested: false,
  enemyEnergy: 80, enemyStaggered: false, enemyRecoveryTicks: 0,
  forceWindupTicks: 27, enemySaberRange: 47, order: 'advance',
});

test('hidden targets never trigger attacks, counters, requests, or targeted pursuit', () => {
  for (const formId of Object.keys(FORMS)) for (const extra of [{}, { counterReady: true }, { forceRequested: true }, { distance: 150 }]) {
    const choice = chooseAction({ ...duel, formId, ...extra, targetVisible: false });
    assert.equal(choice.action, 'wait'); assert.equal(choice.move, 'hold'); assert.equal(choice.dash, false);
    assert.equal(choice.reason, 'No visible target');
  }
});

test('blocked attack lines request a new angle instead of phantom saber strikes or spacing deadlocks', () => {
  for (const formId of Object.keys(FORMS)) for (const distance of [40, 150]) {
    const choice = chooseAction({ ...duel, formId, distance, saberLineOfSight: false, forceLineOfSight: false });
    assert.equal(choice.action, 'wait', formId); assert.equal(choice.move, 'close', formId);
    assert.equal(choice.reason, 'Find clear attack angle'); assert.equal(choice.dash, false);
  }
});

test('low barricades block saber counters but preserve legal Force choices', () => {
  const blocked = { ...duel, saberLineOfSight: false, forceLineOfSight: true, counterReady: true };
  for (const formId of Object.keys(FORMS)) {
    const ordinary = chooseAction({ ...blocked, formId });
    assert.notEqual(ordinary.action, 'saber');
    assert.ok(ordinary.action === 'force' || ordinary.move === 'close');
    assert.equal(chooseAction({ ...blocked, formId, forceRequested: true }).action, 'force');
  }
});

test('blocked Force does not deny a legal saber strike or override guard and retreat orders', () => {
  for (const formId of Object.keys(FORMS)) {
    const blocked = { ...duel, formId, saberLineOfSight: true, forceLineOfSight: false };
    assert.equal(chooseAction(blocked).action, 'saber');
    assert.equal(chooseAction({ ...blocked, guardOrdered: true }).action, 'guard');
    const retreat = chooseAction({ ...blocked, saberLineOfSight: false, order: 'retreat' });
    assert.equal(retreat.move, 'hold'); assert.equal(retreat.dash, false);
  }
});

test('omitted terrain observations preserve legacy policy results', () => {
  for (const formId of Object.keys(FORMS)) for (const distance of [40, 150, 500]) {
    const context = { ...duel, formId, distance };
    assert.deepEqual(chooseAction(context), chooseAction({ ...context, targetVisible: true, saberLineOfSight: true, forceLineOfSight: true }));
  }
});

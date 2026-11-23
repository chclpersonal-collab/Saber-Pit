import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../dist/tactics.js';

const duel = Object.freeze({
  formId: 'shii_cho', energy: 80, distance: 40, saberRange: 47, forceRange: 420,
  saberReady: true, forceReady: true, forceCost: 22, dashReady: true,
  counterReady: false, guardOrdered: false, forceRequested: false,
  enemyEnergy: 80, enemyStaggered: false, order: 'advance',
});

test('same incoming windup provokes defense, mobile evasion or offensive commitment', () => {
  const incoming = { ...duel, threatKind: 'saber', threatTicks: 16 };
  for (const formId of ['soresu', 'shien', 'djem_so', 'vaapad']) {
    const choice = chooseAction({ ...incoming, formId });
    assert.equal(choice.action, 'guard', formId);
    assert.equal(choice.move, 'hold', formId);
  }
  const mobile = chooseAction({ ...incoming, formId: 'ataru' });
  assert.equal(mobile.action, 'wait');
  assert.equal(mobile.move, 'evade');
  assert.equal(mobile.dash, true);
  assert.equal(chooseAction({ ...incoming, formId: 'juyo' }).action, 'saber');
});

test('defensive patience ends when a threat resolves, counter opens or threat is remote', () => {
  const cautious = { ...duel, formId: 'soresu', threatKind: 'saber', threatTicks: 12 };
  assert.equal(chooseAction(cautious).action, 'guard');
  assert.equal(chooseAction({ ...cautious, threatTicks: -1 }).action, 'saber');
  assert.equal(chooseAction({ ...cautious, threatTicks: 40 }).action, 'saber');
  assert.equal(chooseAction({ ...cautious, counterReady: true }).action, 'saber');
  assert.match(chooseAction({ ...cautious, counterReady: true }).reason, /counter/);
});

test('guard orders create patience but cannot fabricate energy or override a counter', () => {
  assert.equal(chooseAction({ ...duel, guardOrdered: true }).action, 'guard');
  assert.equal(chooseAction({ ...duel, guardOrdered: true, energy: 2 }).action, 'recover');
  assert.equal(chooseAction({ ...duel, guardOrdered: true, counterReady: true, energy: 8 }).action, 'saber');
});

test('exhaustion changes commitment by form and prevents unaffordable evasion', () => {
  assert.equal(chooseAction({ ...duel, formId: 'juyo', energy: 14 }).action, 'saber');
  assert.equal(chooseAction({ ...duel, formId: 'niman', energy: 14 }).action, 'recover');
  const poorMobile = chooseAction({ ...duel, formId: 'ataru', energy: 10, threatKind: 'force', threatTicks: 10 });
  assert.equal(poorMobile.action, 'recover');
  assert.equal(poorMobile.dash, false);
  assert.equal(chooseAction({ ...duel, energy: 0 }).action, 'recover');
});

test('Niman exploits an opening with Force while saber specialists close or strike', () => {
  const opening = { ...duel, enemyStaggered: true, enemyStaggerTicks: 32, enemyRecoveryTicks: 32, forceWindupTicks: 27, enemySaberRange: 47 };
  assert.equal(chooseAction({ ...opening, formId: 'niman' }).action, 'force');
  assert.equal(chooseAction({ ...opening, formId: 'makashi' }).action, 'saber');
  const cooldown = { ...duel, distance: 150, forceReady: false };
  assert.equal(chooseAction({ ...cooldown, formId: 'niman', order: 'hold' }).move, 'hold');
  assert.equal(chooseAction({ ...cooldown, formId: 'ataru' }).dash, true);
  assert.equal(chooseAction({ ...cooldown, formId: 'makashi' }).move, 'close');
});

test('Niman keeps objective initiative while Force recovers without disregarding a hold order', () => {
  const cooldown = { ...duel, formId: 'niman', distance: 150, forceReady: false };
  const advance = chooseAction(cooldown);
  assert.equal(advance.action, 'wait');
  assert.equal(advance.move, 'close');
  assert.equal(advance.dash, false);
  assert.equal(chooseAction({ ...cooldown, order: 'hold' }).move, 'hold');
  assert.equal(chooseAction({ ...cooldown, energy: 5 }).action, 'recover');
  assert.equal(chooseAction({ ...cooldown, guardOrdered: true }).action, 'guard');
  assert.equal(chooseAction({ ...cooldown, forceReady: true }).action, 'force');
});

test('an unavailable requested cast falls back; a usable request spends reserve', () => {
  const requested = { ...duel, forceRequested: true };
  assert.equal(chooseAction({ ...requested, forceReady: false }).action, 'saber');
  assert.equal(chooseAction({ ...requested, energy: 18 }).action, 'saber');
  assert.equal(chooseAction({ ...requested, forceRange: 10 }).action, 'saber');
  assert.equal(chooseAction({ ...requested, energy: 22 }).action, 'force');
  assert.equal(chooseAction({ ...requested, counterReady: true }).action, 'saber');
});

test('requested Force cannot commit a slow close cast into an imminent aimed attack', () => {
  const threatened = { ...duel, forceRequested: true, distance: 45, threatKind: 'saber', threatTicks: 12, enemyRecoveryTicks: 32, forceWindupTicks: 27 };
  for (const formId of ['shii_cho', 'makashi', 'juyo', 'niman']) {
    assert.equal(chooseAction({ ...threatened, formId }).action, 'saber', formId);
    assert.notEqual(chooseAction({ ...threatened, formId, saberReady: false }).action, 'force', formId);
    assert.equal(chooseAction({ ...threatened, formId, threatTicks: -1 }).action, 'force', formId);
  }
  assert.equal(chooseAction({ ...threatened, threatKind: 'force' }).action, 'saber');
  assert.equal(chooseAction({ ...threatened, distance: 100 }).action, 'force');
  assert.equal(chooseAction({ ...threatened, energy: 8 }).action, 'recover');
});

test('Niman close Force requires measured recovery instead of an idle or vaguely staggered target', () => {
  const close = { ...duel, formId: 'niman', distance: 43, enemySaberRange: 47, forceWindupTicks: 27, enemyRecoveryTicks: 0 };
  assert.equal(chooseAction(close).action, 'saber');
  assert.equal(chooseAction({ ...close, forceRequested: true }).action, 'saber');
  assert.equal(chooseAction({ ...close, enemyStaggered: true, enemyStaggerTicks: 10 }).action, 'saber');
  assert.equal(chooseAction({ ...close, enemyRecoveryTicks: 27 }).action, 'saber');
  assert.equal(chooseAction({ ...close, enemyRecoveryTicks: 28 }).action, 'force');
  assert.equal(chooseAction({ ...close, enemyStaggered: true, enemyStaggerTicks: 28 }).action, 'force');
  assert.equal(chooseAction({ ...close, enemyRecoveryTicks: 28, counterReady: true }).reason, 'Use counter opening');
  assert.equal(chooseAction({ ...close, enemyRecoveryTicks: 28, guardOrdered: true }).action, 'guard');
});

test('Niman checks real enemy reach and own windup for both ordinary and requested casts', () => {
  const ready = { ...duel, formId: 'niman', distance: 65, enemySaberRange: 47, forceWindupTicks: 36, enemyRecoveryTicks: 0 };
  for (const forceRequested of [false, true]) {
    assert.equal(chooseAction({ ...ready, forceRequested }).action, 'force');
    assert.notEqual(chooseAction({ ...ready, forceRequested, enemySaberRange: 54 }).action, 'force');
    assert.notEqual(chooseAction({ ...ready, forceRequested, threatKind: 'saber', threatTicks: 30 }).action, 'force');
    assert.equal(chooseAction({ ...ready, forceRequested, threatKind: 'saber', threatTicks: 37 }).action, 'force');
  }
  const close = { ...ready, distance: 43, enemyRecoveryTicks: 30 };
  assert.equal(chooseAction({ ...close, forceWindupTicks: 27 }).action, 'force');
  assert.equal(chooseAction(close).action, 'saber');
  assert.equal(chooseAction({ ...close, forceWindupTicks: NaN, enemyRecoveryTicks: Infinity }).action, 'saber');
  assert.equal(chooseAction({ ...close, formId: 'juyo', forceRequested: true }).action, 'force');
});

test('policy is deterministic, input-pure, handles malformed snapshots and respects retreat dash restriction', () => {
  assert.deepEqual(chooseAction(duel), chooseAction(duel));
  assert.equal(duel.energy, 80);
  for (const context of [undefined, null, {}, { ...duel, distance: NaN }, { ...duel, distance: Infinity }]) {
    const action = chooseAction(context);
    assert.equal(action.action, 'wait');
    assert.equal(action.dash, false);
  }
  assert.equal(chooseAction({ ...duel, formId: '__proto__' }).action, 'saber');
  assert.equal(chooseAction({ ...duel, energy: Infinity }).action, 'recover');
  assert.equal(chooseAction({ ...duel, formId: 'ataru', distance: 150, forceReady: false, order: 'retreat' }).dash, false);
});

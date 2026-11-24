import { formMoveById } from '../dist/combat-forms.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command, commandReadiness, duelIntent, setForm, resolveDamage } from '../dist/sim.js';

function duel(form = 'shii_cho', range = 35, seed = 5) {
  const g = createGame(seed, { terrain: 'crossroads' }), a = g.soldiers[0], b = g.soldiers[5];
  g._nextAiDecision = 1e8;
  resolveDamage(g, g.soldiers.filter(s => s !== a && s !== b).map(s => ({ target: s.id, source: null, amount: 999 })));
  for (const s of [a, b]) { s.saberReadyTick = s.forceReadyTick = 1e8; s.bank = s.holdBank = 2; s.y = 270; }
  a.x = 420; b.x = a.x + range; setForm(g, 0, form);
  return { g, a, b };
}
const attack = (source, target, kind = 'saber', resolveTick = 15) => ({ kind, target: target.id, startedTick: 0, resolveTick, counter: false, form: source.form, weapon: kind === 'saber' ? source.meleeWeapon : source.weapon });

test('v5 support readiness rejects unreachable or committed actors without spending resources', () => {
  const g = createGame(5); g.soldiers.forEach(s => { s.forceReadyTick = 0; });
  const before = structuredClone(g);
  assert.equal(commandReadiness(g, 'force').ready, false);
  assert.equal(command(g, 'force'), false); assert.equal(command(g, 'guard'), false);
  assert.deepEqual(g, before);
  const { g: close, a, b } = duel(); a.attack = attack(a, b);
  const frozen = structuredClone(close);
  assert.equal(command(close, 'guard'), false); assert.equal(command(close, 'force'), false);
  assert.deepEqual(close, frozen);
});

test('v5 Force surge starts a real eligible cast immediately and never toggles Auto', () => {
  const { g, a } = duel('shii_cho', 200); a.forceReadyTick = 0; g.autoCommand = true;
  assert.deepEqual(commandReadiness(g, 'force'), { ready: true, reason: '1 fighter ready', eligible: 1 });
  assert.equal(command(g, 'force'), true); assert.equal(a.attack.kind, 'force'); assert.equal(a.energy, 78);
  assert.equal(g.stats.forceCasts[0], 1); assert.equal(g.forceCooldown, 6); assert.equal(g.autoCommand, true);
  assert.equal(command(g, 'force'), false);
});

test('v5 Guard stance creates patient defense instead of immediately spending on an attack', () => {
  const { g, a } = duel(); a.saberReadyTick = 0;
  assert.equal(command(g, 'guard'), true); assert.equal(a.energy, 92);
  step(g, .5);
  assert.equal(a.attack, null); assert.equal(g.stats.saberSwings[0], 0);
  assert.equal(a.tacticalReason, 'Honor guard order'); assert.equal(a.guard, true);
  a.counterUntil = g.tick + 30; step(g, 1 / 60);
  assert.equal(a.attack.kind, 'saber'); assert.equal(a.attack.counter, true);
});

test('v5 uncastable requests fall back to a legal saber attack and earned counters have priority', () => {
  const { g, a } = duel(); a.saberReadyTick = 0; a.forceReadyTick = 0; a.forceRequestedUntil = 90; a.energy = 20;
  step(g, 1 / 60); assert.equal(a.attack.kind, 'saber'); assert.equal(g.stats.forceCasts[0], 0);
  const counter = duel(); counter.a.saberReadyTick = counter.a.forceReadyTick = 0;
  counter.a.forceRequestedUntil = counter.a.counterUntil = 90;
  step(counter.g, 1 / 60); assert.equal(counter.a.attack.kind, 'saber'); assert.equal(counter.a.attack.counter, true);
});

test('v5 the same aimed windup produces defensive patience or offensive commitment by form', () => {
  for (const [form, expected] of [['soresu', null], ['juyo', 'saber']]) {
    const { g, a, b } = duel(form); g.tick = 15; g.time = g.tick / 60;
    a.saberReadyTick = 0; b.attack = attack(b, a, 'saber', 30);
    step(g, 1 / 60); assert.equal(a.attack?.kind ?? null, expected);
    if (form === 'soresu') {
      assert.equal(a.tacticalReason, 'Wait for incoming attack'); b.attack = null;
      step(g, 1 / 60); assert.equal(a.attack.kind, 'saber', 'defense ends when the threat clears');
    }
  }
});

test('v5 Ataru pays for an evasive step, continues it, and never replaces a retreat order', () => {
  const { g, a, b } = duel('ataru'); g.tick = 15; g.time = g.tick / 60;
  b.attack = attack(b, a, 'saber', 37);
  const startX = a.x; step(g, 3 / 60);
  assert.ok(a.x < startX - 5); assert.ok(a.energy < 90); assert.equal(a.attack, null);
  assert.ok(a.dashReadyTick > g.tick); assert.equal(a.tacticalReason, 'Finish evasive step');
  const retreat = duel('ataru'); retreat.b.attack = attack(retreat.b, retreat.a); command(retreat.g, 'retreat');
  step(retreat.g, 1 / 60); assert.equal(retreat.a.dashUntil, 0); assert.equal(retreat.g.playerOrder, 'retreat');
  assert.equal(retreat.a.destinationX, 175);
});

test('v5 form energy reserves make recovery a real decision, and Niman exploits a ranged opening', () => {
  const cautious = duel('soresu'); cautious.a.energy = 11; cautious.a.saberReadyTick = 0;
  const aggressive = duel('juyo'); aggressive.a.energy = 16; aggressive.a.saberReadyTick = 0;
  assert.equal(duelIntent(cautious.g, cautious.a).action, 'recover');
  assert.equal(duelIntent(aggressive.g, aggressive.a).action, 'saber');
  step(cautious.g, 1 / 60); assert.equal(cautious.a.attack, null); assert.equal(cautious.a.combatState, 'recover');
  const blended = duel('niman'); blended.a.saberReadyTick = blended.a.forceReadyTick = 0; blended.b.energy = 0;
  step(blended.g, 1 / 60); assert.equal(blended.a.attack.kind, 'force'); assert.equal(blended.a.tacticalReason, 'Cast during enemy recovery');
});

test('v5 impact feedback reports real credited HP, including proportional overkill', () => {
  const { g, a, b } = duel(); b.hp = 5;
  const visual = { attack: attack(a, b), outcome: 'hit' };
  resolveDamage(g, [{ target: b.id, source: a.id, amount: 100, feedback: visual }, { target: b.id, source: a.id, amount: 100, feedback: visual }]);
  const messages = g.effects.filter(e => e.type === 'feedback' && e.soldierId === a.id);
  assert.equal(messages.length, 2); assert.equal(messages.reduce((n, e) => n + e.damage, 0), 5);
  assert.ok(messages.every(e => e.outcome === 'hit' && e.damage === 2.5));
  assert.equal(a.lastOutcome.damage, 2.5); assert.equal(b.hp, 0);
});

test('v5 out-of-range and interrupted attacks have explicit zero-damage outcomes', () => {
  const { g, a, b } = duel('shii_cho', 200); a.attack = attack(a, b, 'saber', 1);
  step(g, 1 / 60); assert.equal(a.lastOutcome.outcome, 'out-of-range'); assert.equal(a.lastOutcome.damage, 0);
  assert.equal(b.hp, 120); assert.ok(g.effects.filter(e => e.type === 'saber').every(e => e.outcome === 'out-of-range'));
  a.attack = attack(a, b, 'force', g.tick + 27);
  const sourceX = a.x, sourceY = a.y;
  resolveDamage(g, [{ target: a.id, source: b.id, amount: 1, stagger: .3 }]);
  assert.equal(a.lastOutcome.outcome, 'interrupted'); assert.equal(a.lastOutcome.damage, 0);
  const feedback = g.effects.findLast(e => e.type === 'feedback' && e.outcome === 'interrupted');
  assert.equal(feedback.x, sourceX); assert.equal(feedback.y, sourceY);
  assert.equal(g.effects.filter(e => e.type === 'force').length, 0, 'interruption does not invent a completed cast');
});

test('v5 readiness and derived tactical intent are observation-only', () => {
  const { g, a } = duel('soresu'); const before = structuredClone(g);
  for (let i = 0; i < 20; i++) { duelIntent(g, a); commandReadiness(g, 'force'); commandReadiness(g, 'guard'); }
  assert.deepEqual(g, before);
});

test('v5 Niman advances during Force recovery instead of forfeiting the objective to spacing', () => {
  const advancing = duel('niman', 150), holding = duel('niman', 150);
  command(advancing.g, 'advance'); command(holding.g, 'hold');
  const startX = advancing.a.x;
  step(advancing.g, 1 / 60); step(holding.g, 1 / 60);
  assert.ok(advancing.a.x > startX, 'Advance produces actual forward movement during cooldown');
  assert.equal(advancing.a.tacticalReason, 'Advance while Force recovers');
  assert.equal(holding.a.x, startX, 'Hold retains the selected ranged spacing');
  assert.equal(holding.a.tacticalReason, 'Hold Force spacing');
  assert.equal(advancing.a.attack, null); assert.equal(advancing.a.energy, 100);
});

test('v5 Niman avoids a close Force windup against a ready saber or faster incoming attack', () => {
  for (const incoming of [false, true]) {
    const { g, a, b } = duel('niman', 43);
    a.saberReadyTick = a.forceReadyTick = b.saberReadyTick = b.forceReadyTick = 0;
    if (incoming) b.attack = attack(b, a, 'saber', 20);
    assert.equal(commandReadiness(g, 'force').ready, false);
    step(g, 1 / 60);
    assert.equal(a.attack.kind, 'saber'); assert.equal(g.stats.forceCasts[0], 0);
    const selected = formMoveById('niman', a.attack.moveId);
    assert.ok(selected);
    assert.equal(a.energy, 100 - selected.energyCost, 'fallback spends exactly the selected authored saber cost, never a Force charge');
  }
});

test('v5 Niman converts real cooldown and stagger openings into a physical Force cast', () => {
  for (const opening of ['cooldown', 'stagger']) {
    const { g, a, b } = duel('niman', 43);
    a.saberReadyTick = a.forceReadyTick = 0;
    b.saberReadyTick = b.forceReadyTick = opening === 'cooldown' ? 60 : 0;
    if (opening === 'stagger') b.staggerUntil = 40;
    assert.equal(commandReadiness(g, 'force').ready, true);
    step(g, 1 / 60);
    assert.equal(a.attack.kind, 'force'); assert.equal(a.attack.resolveTick - g.tick, 27);
    assert.equal(a.tacticalReason, 'Cast during enemy recovery');
    assert.ok(Math.abs(a.energy - 84.16) < 1e-8);
  }
});

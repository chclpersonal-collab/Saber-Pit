import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, duelIntent, resolveDamage, MAX_FIGHTER_HP } from '../dist/sim.js';
import { combatSkillProfile, progressionSummary, SOLDIER_GRADES } from '../dist/progression.js';
import { startAirborne } from '../dist/airborne.js';

function duel(rank = 'SSS+V', form = 'shii_cho') {
  const g = createGame(21, { startingRanks: [rank, 'F'], forms: [Array(5).fill(form), Array(5).fill('shii_cho')], modifier: 'saber_only' });
  const [a, b] = [g.soldiers[0], g.soldiers[5]];
  resolveDamage(g, g.soldiers.filter(s => s !== a && s !== b).map(s => ({ target: s.id, amount: 999 })));
  g._nextAiDecision = 1e8;
  for (const s of [a, b]) { s.y = 270; s.saberReadyTick = s.forceReadyTick = 1e8; s.bank = s.holdBank = 2; }
  a.x = 420; b.x = 455;
  return { g, a, b };
}
const aimed = (s, target, tick, resolveTick = tick + 18) => ({ kind: 'saber', target: target.id, startedTick: tick, resolveTick, counter: false, form: s.form, weapon: s.meleeWeapon });

test('v9 training rises at all fifteen ranks without changing historical career shape or health cap', () => {
  let previous;
  for (const grade of SOLDIER_GRADES) {
    const summary = progressionSummary(grade.threshold), profile = combatSkillProfile(summary);
    assert.deepEqual(Object.keys(summary.modifiers), ['healthMultiplier', 'accuracyBonus', 'reloadMultiplier']);
    assert.equal(profile.rankIndex, grade.index);
    assert.ok(profile.reactionTicks >= 2 && profile.parryBonus < 1);
    if (previous) { assert.ok(profile.skill > previous.skill); assert.ok(profile.energyEfficiency < previous.energyEfficiency); }
    previous = profile;
  }
  assert.equal(MAX_FIGHTER_HP, 171.6);
});

test('v9 a trained fighter reads a visible windup earlier, but cannot react at its first frame', () => {
  for (const [rank, expected] of [['F', 'saber'], ['SSS+V', 'guard']]) {
    const { g, a, b } = duel(rank); a.saberReadyTick = 0; b.attack = aimed(b, a, 0);
    assert.equal(duelIntent(g, a).action, 'saber');
    g.tick = 5;
    assert.equal(duelIntent(g, a).action, expected);
  }
});

test('v9 observation samples actual visible movement and derived inspection is pure', () => {
  const { g, a, b } = duel(); step(g, 1 / 60); b.x += 2; step(g, 1 / 60);
  assert.equal(a.observation.targetId, b.id); assert.ok(a.observation.vx > 0);
  const before = structuredClone(g);
  for (let i = 0; i < 8; i++) duelIntent(g, a);
  assert.deepEqual(g, before);
});

test('v9 elite saber skill wins a paired seeded sample even with equal HP', () => {
  let eliteWins = 0;
  for (let seed = 1; seed <= 4; seed++) for (const eliteTeam of [0, 1]) {
    const ranks = ['F', 'F']; ranks[eliteTeam] = 'SSS+V';
    const g = createGame(seed, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'spectate',
      matchMode: 'elimination', roundDuration: 90, startingRanks: ranks, forms: [['shii_cho'], ['shii_cho']], modifier: 'saber_only' });
    for (const s of g.soldiers) { s.hp = 120; s.maxHp = 120; }
    step(g, 90); if (g.winner === eliteTeam) eliteWins++;
  }
  assert.ok(eliteWins >= 6, `Elite won ${eliteWins}/8 equal-HP paired duels`);
});

test('v9 vertical melee misses use the same actual height shown by airborne animation', () => {
  const { g, a, b } = duel('F'); a.attack = aimed(a, b, 0, 15);
  startAirborne(b, 0, { durationTicks: 30, height: 80, distance: 0, recoveryTicks: 8 });
  step(g, 15 / 60);
  assert.equal(a.lastOutcome.outcome, 'out-of-range'); assert.equal(b.hp, 120);
});

test('v9 disabling Force cancels a paid pending cast and a queued grip release', () => {
  const { g, a, b } = duel();
  a.attack = { ...aimed(a, b, 0, 1), kind: 'force', weapon: a.weapon, abilityId: 'force_grip' };
  a.forceControl = { targetId: b.id, untilTick: 1, releaseTick: 1, kind: 'force_grip' };
  startAirborne(b, 0, { durationTicks: 26, height: 42, distance: 0, rotations: 0 }); b.airborne.controlSourceId = a.id;
  a.barrierUntil = 100; a.barrierEnergy = 22;
  const hp = b.hp, x = b.x; step(g, 1 / 60);
  assert.equal(a.attack, null); assert.equal(a.forceControl, null); assert.equal(a.barrierEnergy, 0);
  assert.equal(b.airborne, null); assert.equal(b.airborneHeight, 0);
  assert.equal(b.hp, hp); assert.equal(b.x, x); assert.equal(g.stats.forceHits[0], 0);
  assert.equal(a.lastOutcome.outcome, 'interrupted');
});

test('v9 grip releases when range breaks without deleting an independently authored jump', () => {
  const { g, a, b } = duel(); g.config.modifier = 'standard'; b.x = 850;
  a.forceControl = { targetId: b.id, untilTick: 100, releaseTick: 100, kind: 'force_grip' };
  startAirborne(b, 0, { durationTicks: 26, height: 42, distance: 0, rotations: 1 });
  step(g, 1 / 60); assert.equal(a.forceControl, null); assert.ok(b.airborne);
});

test('v9 pull obeys signed physical displacement and all ranks remain vulnerable', () => {
  const { g, a, b } = duel();
  const x = b.x;
  resolveDamage(g, [{ target: b.id, source: a.id, amount: 1, push: -15 }]);
  assert.ok(b.x < x);
  resolveDamage(g, [{ target: a.id, source: b.id, amount: 999 }]);
  assert.equal(a.alive, false);
});

test('v9 both casters commit the same pre-commit snapshot without a second-actor barrier advantage', () => {
  for (const reversed of [false, true]) {
    const { g, a, b } = duel(); g.config.modifier = 'standard'; b.career = progressionSummary(6000);
    a.x = 400; b.x = 600; a.forceReadyTick = b.forceReadyTick = 0;
    if (reversed) g.soldiers.reverse();
    step(g, 1 / 60);
    assert.equal(a.attack.kind, 'force'); assert.equal(b.attack.kind, 'force');
    assert.equal(a.attack.abilityId, b.attack.abilityId);
    assert.notEqual(b.attack.abilityId, 'force_barrier', 'A just-committed attack is not prior visible evidence');
  }
});

test('v9 autonomous Force support cannot stop either relic retriever for an opening cast', () => {
  for (const ranks of [['SSS+V', 'F'], ['F', 'SSS+V']]) {
    const g = createGame(29041, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'spectate',
      forms: [['shii_cho'], ['shii_cho']], startingRanks: ranks, matchMode: 'relic', modifier: 'standard' });
    step(g, 3);
    assert.deepEqual(g.stats.forceCasts, [0, 0]);
    assert.ok(Math.abs(g.soldiers[0].x + g.soldiers[1].x - g.terrain.width) < .001);
  }
});

test('v9 a barrier completing alongside an incoming impact protects equally in either roster order', () => {
  const outcomes = [];
  for (const reversed of [false, true]) {
    const { g, a, b } = duel('F'); g.config.modifier = 'standard'; a.x = 400; b.x = 600;
    for (const [s, target, abilityId] of [[a, b, 'force_barrier'], [b, a, 'force_push']]) {
      s.attack = { ...aimed(s, target, 0, 1), kind: 'force', weapon: s.weapon, abilityId, aimX: target.x, aimY: target.y };
    }
    if (reversed) g.soldiers.reverse();
    step(g, 1 / 60); outcomes.push([a.hp, a.barrierEnergy]);
  }
  assert.deepEqual(outcomes[0], outcomes[1]); assert.ok(outcomes[0][0] > 107);
});

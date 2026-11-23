import { formMoveById, getFormMoves } from '../dist/combat-forms.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command, resolveDamage, setForm, rebuildRound } from '../dist/sim.js';
import { FORMS, FORCE_POWERS } from '../dist/content.js';

function quiet(seed = 1) {
  const g = createGame(seed, { terrain: 'crossroads' });
  g._nextAiDecision = 1e8;
  for (const s of g.soldiers) s.saberReadyTick = s.forceReadyTick = 1e8;
  return g;
}
function duel(seed = 1, range = 35) {
  const g = quiet(seed), a = g.soldiers[0], b = g.soldiers[5];
  resolveDamage(g, g.soldiers.filter(s => s !== a && s !== b).map(s => ({ target: s.id, source: null, amount: 999 })));
  a.x = 450; b.x = 450 + range; a.y = b.y = 270;
  a.bank = a.holdBank = b.bank = b.holdBank = 2;
  return { g, a, b };
}

test('saber strikes telegraph before impact and spend real energy with a real cooldown', () => {
  const { g, a, b } = duel(); a.saberReadyTick = 0;
  step(g, 1 / 60);
  assert.equal(a.attack.kind, 'saber'); assert.equal(a.energy, 92);
  assert.equal(a.guard, false); assert.equal(b.hp, 120);
  assert.ok(a.attackCooldown > .7); assert.equal(g.stats.saberSwings[0], 1);
  assert.ok(g.effects.some(e => e.type === 'telegraph' && e.soldierId === a.id && e.motion === formMoveById(a.form, a.attack.moveId).motion));
  const contactTick = a.attack.resolveTick;
  step(g, (contactTick - g.tick - 1) / 60);
  assert.ok(a.attack, 'selected move must not resolve before its telegraph ends');
  assert.equal(b.hp, 120);
  step(g, 1 / 60);
  assert.equal(a.attack, null); assert.equal(g.stats.saberSwings[0], 1);
  assert.ok(g.effects.some(e => e.type === 'saber'));
});

test('ranged Force casts use their energy cost, windup, range and cooldown', () => {
  const { g, a } = duel(5, 200); a.forceReadyTick = 0;
  step(g, 1 / 60);
  assert.equal(a.attack.kind, 'force'); assert.equal(a.energy, 78);
  assert.equal(a.attack.resolveTick - a.attack.startedTick, 27);
  assert.equal(a.forceCooldown, FORCE_POWERS.force_push.interval);
  assert.equal(g.stats.forceCasts[0], 1);
  step(g, .6);
  assert.equal(g.stats.forceCasts[0], 1); assert.ok(g.effects.some(e => e.type === 'force'));
  const far = duel(5, 440); far.a.forceReadyTick = 0;
  step(far.g, 1 / 60); assert.equal(far.g.stats.forceCasts[0], 0);
});

test('exhausted actors cannot cast for free and regain energy without a permanent lock', () => {
  const { g, a, b } = duel(7, 200); a.forceReadyTick = 0; a.energy = 0;
  step(g, .5); assert.equal(g.stats.forceCasts[0], 0); assert.ok(a.energy > 0 && a.energy < 22);
  // v0.5 retains a defensive energy reserve rather than spending the instant cost alone.
  // Keep this resource test at Force distance; local tactical closing is tested separately.
  for (let frame = 0; frame < 180 && g.stats.forceCasts[0] === 0; frame++) {
    a.x = 450; b.x = 650; a.y = b.y = 270; step(g, 1 / 60);
  }
  assert.equal(g.stats.forceCasts[0], 1); assert.ok(a.energy >= 9 && a.energy <= 100);
});

test('Guard stance costs energy, has an independent cooldown and expires after two seconds', () => {
  const g = quiet();
  assert.equal(command(g, 'guard'), false, 'quiet distant fighters have no threat to guard against');
  const before = structuredClone(g);
  assert.equal(command(g, 'guard'), false); assert.deepEqual(g, before);
  for (let lane = 0; lane < 5; lane++) {
    const blue = g.soldiers[lane], red = g.soldiers[lane + 5];
    blue.x = 450; red.x = 520;
    blue.y = red.y = 130 + lane * 65;
    blue.bank = blue.holdBank = red.bank = red.holdBank = 2;
  }
  assert.equal(command(g, 'guard'), true); assert.equal(command(g, 'guard'), false);
  assert.equal(g.guardCooldown, 7); assert.ok(g.soldiers.filter(s => s.team === 0).every(s => s.energy === 92 && s.guardUntil === 120));
  step(g, 2.1); assert.ok(g.soldiers[0].guardUntil < g.tick); assert.ok(g.guardCooldown > 4);
});

test('guarding really blocks damage, spends block energy and creates counter windows', () => {
  let guardedDamage = 0, exposedDamage = 0, blocks = 0, counterWindows = 0;
  for (let seed = 1; seed <= 60; seed++) {
    for (const guarded of [true, false]) {
      const { g, a, b } = duel(seed); setForm(g, 0, 'soresu', 1);
      b.energy = guarded ? 100 : 0; if (guarded) b.guardUntil = 120;
      a.attack = { kind: 'saber', target: b.id, startedTick: 0, resolveTick: 1, counter: false, form: a.form, weapon: a.meleeWeapon };
      step(g, 1 / 60);
      if (guarded) { guardedDamage += 120 - b.hp; blocks += g.stats.blocks[1]; counterWindows += +(b.counterUntil > g.tick); }
      else exposedDamage += 120 - b.hp;
    }
  }
  assert.ok(blocks > 25); assert.equal(counterWindows, blocks); assert.ok(guardedDamage < exposedDamage * .6);
});

test('stagger interrupts a windup and has bounded duration plus recovery immunity', () => {
  const { g, a, b } = duel(); a.saberReadyTick = 0; step(g, 1 / 60); assert.ok(a.attack);
  resolveDamage(g, [{ target: a.id, source: b.id, amount: 1, stagger: .4 }]);
  assert.equal(a.attack, null); const until = a.staggerUntil;
  resolveDamage(g, [{ target: a.id, source: b.id, amount: 1, stagger: .65 }]);
  assert.equal(a.staggerUntil, until);
  a.saberReadyTick = 1e8; step(g, 1.2);
  assert.ok(a.staggerUntil < g.tick); assert.notEqual(a.combatState, 'stagger');
});

test('all nine forms telegraph their actual selected move and retain the nine motion families', () => {
  const motions = new Set();
  for (const [id, form] of Object.entries(FORMS)) {
    const { g, a } = duel(); setForm(g, 0, id); a.saberReadyTick = 0; step(g, 1 / 60);
    const e = g.effects.find(e => e.type === 'telegraph' && e.soldierId === a.id);
    assert.equal(e.form, id);
    const selected = formMoveById(id, a.attack.moveId);
    assert.ok(selected, 'telegraph identifies a real authored move');
    assert.equal(e.motion, selected.motion);
    for (const move of getFormMoves(id)) motions.add(move.motion);
  }
  assert.equal(motions.size, 9);
});

test('rebuildRound preserves restored persistent fields without evolving or scoring', () => {
  const g = createGame(4); g.round = 8; g.score = [4, 3]; g.careers[0][0].merit = 800;
  g.records.origin = 'migration-v0.3'; g.records.soldiers[0].kills = g.records.teams[0].kills = 9;
  const before = structuredClone({ round: g.round, score: g.score, careers: g.careers, records: g.records, forms: g.forms, loadouts: g.loadouts });
  rebuildRound(g);
  assert.deepEqual({ round: g.round, score: g.score, careers: g.careers, records: g.records, forms: g.forms, loadouts: g.loadouts }, before);
  assert.equal(g.time, 0); assert.equal(g.status, 'playing'); assert.equal(g.soldiers[0].career.grade, 'S');
});

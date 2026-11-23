import { authoritativeState } from './helpers/presentation-state.mjs';
/** Independent overhaul regressions: presentation purity and durable combat saves. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startAirborne } from '../dist/airborne.js';
import { sampleFighterRig } from '../dist/pose-rig.js';
import { sampleCombatPose } from '../dist/choreography.js';
import { getFormMoves } from '../dist/combat-forms.js';
import { FORMS } from '../dist/content.js';
import { createGame, step, setForm } from '../dist/sim.js';
import { saveCampaign, loadCampaign, SAVE_KEY } from '../dist/persistence.js';

const storage = encoded => {
  const slots = new Map(encoded ? [[SAVE_KEY, encoded]] : []);
  return { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value), removeItem: key => slots.delete(key) };
};
function finiteNumbers(value, path = 'pose') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is finite`);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) finiteNumbers(child, `${path}.${key}`);
}
function checkpoint(game) {
  const mem = storage();
  const saved = saveCampaign(game, mem);
  assert.equal(saved.ok, true, saved.error);
  const loaded = loadCampaign(mem);
  assert.equal(loaded.error, null);
  assert.deepEqual(authoritativeState(loaded.game), authoritativeState(game));
  return loaded.game;
}

for (const dual of [false, true]) for (const reducedMotion of [false, true]) {
  test(`overhaul every form pose is finite, repeatable and read-only (dual=${dual}, reduced=${reducedMotion})`, () => {
    for (const form of Object.keys(FORMS)) for (const move of getFormMoves(form)) {
      for (const kind of ['saber', 'force']) for (const tick of [0, 4, 11, 18, 20, 24, 41, 60]) {
        const fighter = { form, x: 40, y: 60, facing: 1, comboIndex: 1, comboUntil: 70,
          attack: tick < 20 ? { kind, startedTick: 0, resolveTick: 20, form, moveId: move.id, offhand: dual } : null };
        const options = { fighter, tick, motion: move.motion, dual, reducedMotion, aimAngle: .37,
          swing: tick >= 20 ? { tick: 20, outcome: 'hit', offhand: dual, form, moveId: move.id } : null };
        const before = structuredClone(options);
        const pose = sampleCombatPose(options);
        finiteNumbers(pose);
        assert.equal(typeof pose.phase, 'string');
        assert.deepEqual(sampleCombatPose(options), pose, `${form}/${move.id}/${kind}/${tick} is repeatable`);
        assert.deepEqual(options, before, 'render sampling cannot mutate combat state');
        if (reducedMotion) {
          assert.equal(pose.trail, 0);
          assert.equal(pose.lean, 0);
          assert.equal(pose.crouch, 0);
        }
      }
    }
  });
}

test('overhaul Ataru authored moves have distinct pose trajectories, not one repeated jump silhouette', () => {
  const signatures = getFormMoves('ataru').map(move => JSON.stringify([2, 7, 12, 17, 19].map(tick => {
    const pose = sampleCombatPose({ fighter: { form: 'ataru', attack: { kind: 'saber', form: 'ataru', moveId: move.id, startedTick: 0, resolveTick: 20 } }, tick, motion: move.motion });
    return pose;
  })));
  assert.equal(new Set(signatures).size, getFormMoves('ataru').length, 'each authored Ataru move must remain visually distinguishable');
});

test('overhaul guard, stagger and parry remain finite without creating combat state', () => {
  for (const fighter of [{ guard: true }, { staggerUntil: 12 }, {}]) for (const reducedMotion of [false, true]) {
    const options = { fighter, tick: 5, block: { tick: 2 }, reducedMotion, dual: true };
    const before = structuredClone(options);
    finiteNumbers(sampleCombatPose(options));
    assert.deepEqual(options, before);
  }
});

for (const phase of ['active', 'ended']) test(`overhaul genuine v08 ${phase} save keeps career history and original bytes`, () => {
  const encoded = fs.readFileSync(new URL(`../docs/evidence/v0.9-v08-fixtures/${phase}.json`, import.meta.url), 'utf8');
  const original = JSON.parse(encoded).game, mem = storage(encoded), loaded = loadCampaign(mem);
  assert.equal(loaded.error, null);
  assert.equal(mem.getItem(SAVE_KEY), encoded, 'loading must not overwrite the recoverable original');
  for (const field of ['careers', 'records', 'history', 'mastery', 'score', 'round', 'loadouts', 'forms']) assert.deepEqual(loaded.game[field], original[field], field);
  checkpoint(loaded.game);
});

test('overhaul legacy v09 arc without choreography fields round-trips and continues identically', () => {
  const game = createGame(114, { forms: [['ataru'], ['soresu']], teamSizes: [1, 1], modifier: 'saber_only' });
  const fighter = game.soldiers[0];
  fighter.airborne = { startTick: 0, endTick: 36, originX: fighter.x, originY: fighter.y,
    directionX: 1, directionY: 0, distance: 14, height: 44, recoveryTicks: 9, rotations: 1, appliedProgress: 0 };
  fighter.airborneHeight = 0;
  const restored = checkpoint(game);
  step(game, 1); step(restored, 1);
  assert.deepEqual(restored, game);
  checkpoint(game);
});

for (const modifier of ['standard', 'saber_only']) test(`overhaul active multi-form battle resumes exactly (${modifier})`, () => {
  const forms = ['ataru', 'makashi', 'djem_so', 'juyo', 'niman'];
  const game = createGame(115, { forms: [forms, [...forms].reverse()], teamSizes: [5, 5], startingRanks: ['SSS+V', 'SSS+V'], modifier });
  step(game, 4);
  const restored = checkpoint(game);
  step(game, 2); step(restored, 2);
  assert.deepEqual(restored, game);
  finiteNumbers(game.soldiers);
});


test('overhaul every authored move produces a finite attached depth rig across facings and accessibility modes', () => {
  for (const form of Object.keys(FORMS)) for (const move of getFormMoves(form)) {
    for (const facing of [-1, 1]) for (const reducedMotion of [false, true]) for (const dual of [false, true]) for (const tick of [0, 7, 13, 19, 28]) {
      const fighter = { form, facing, x: 10, y: 20, attack: tick < 20 ? { kind: 'saber', form, moveId: move.id, startedTick: 0, resolveTick: 20 } : null };
      const swing = tick >= 20 ? { tick: 20, form, moveId: move.id, outcome: 'hit' } : null;
      const pose = sampleCombatPose({ fighter, tick, swing, motion: move.motion, move, reducedMotion, dual });
      const options = { fighter, tick, pose, swing, motion: move.motion, move, reducedMotion, dual };
      const before = structuredClone(options), rig = sampleFighterRig(options);
      finiteNumbers(rig);
      assert.deepEqual(sampleFighterRig(options), rig);
      assert.deepEqual(options, before);
      assert.equal(rig.blades.length, dual ? 2 : 1);
      for (const blade of rig.blades) {
        assert.ok(rig.joints[blade.hand]); assert.ok(rig.projected[blade.tip]);
        const hand = rig.joints[blade.hand], tip = rig.joints[blade.tip];
        assert.ok(Math.abs(Math.hypot(tip.x - hand.x, tip.y - hand.y, tip.z - hand.z) - blade.length) < 1e-8, `${form}/${move.id} has a rigid attached blade`);
        if (reducedMotion) assert.equal(blade.trailOpacity, 0);
      }
    }
  }
});

test('overhaul all expanded combo indices round-trip and out-of-range indices still reject', () => {
  for (const form of Object.keys(FORMS)) {
    const game = createGame(116, { forms: [[form], [form]], teamSizes: [1, 1] });
    for (let index = 0; index < getFormMoves(form).length; index++) {
      game.soldiers[0].comboIndex = index;
      checkpoint(game);
    }
    game.soldiers[0].comboIndex = getFormMoves(form).length;
    const mem = storage();
    assert.equal(saveCampaign(game, mem).ok, false, `${form} rejects the first out-of-range combo`);
  }
});

test('overhaul historical save adds only neutral command/equipment defaults and marks incomplete logs honestly', () => {
  const encoded = fs.readFileSync(new URL('../docs/evidence/v0.9-v08-fixtures/active.json', import.meta.url), 'utf8');
  const game = loadCampaign(storage(encoded)).game;
  assert.deepEqual(game.config.startingDualSabers, [false, false]);
  assert.deepEqual(game.config.deployments, ['standard', 'standard']);
  assert.equal(game.battleLog.complete, false);
  assert.equal(game.commandState.length, 2);
  for (const command of game.commandState) {
    assert.equal(command.manual, false); assert.equal(command.anchor, null);
    assert.equal(command.flankUsed, false); assert.deepEqual(command.flankReached, []);
  }
});


test('overhaul every authored Ataru trajectory survives active save and deterministic landing', () => {
  for (const move of getFormMoves('ataru').filter(move => move.jump)) {
    const game = createGame(117, { forms: [['ataru'], ['soresu']], teamSizes: [1, 1], modifier: 'saber_only' });
    const fighter = game.soldiers[0];
    assert.equal(startAirborne(fighter, game.tick, move.jump), true, move.id);
    const restored = checkpoint(game);
    step(game, .25); step(restored, .25);
    assert.deepEqual(restored, game, `${move.id} initial arc continuation`);
    const midflight = checkpoint(game);
    step(game, 1); step(midflight, 1);
    assert.deepEqual(midflight, game, `${move.id} landing continuation`);
  }
});

test('overhaul malformed trajectory fields cannot smuggle impossible travel through a save', () => {
  const game = createGame(118, { forms: [['ataru'], ['soresu']], teamSizes: [1, 1] });
  startAirborne(game.soldiers[0], 0, getFormMoves('ataru').find(move => move.jump).jump);
  const mem = storage(); assert.equal(saveCampaign(game, mem).ok, true);
  const good = mem.getItem(SAVE_KEY);
  for (const [key, value] of [['travelScale', 1.01], ['travelScale', -1.01], ['lateralDistance', 48.01], ['lateralDistance', -48.01], ['trajectory', 'teleport'], ['rotationAxis', 'unknown']]) {
    const bad = JSON.parse(good); bad.game.soldiers[0].airborne[key] = value;
    const encoded = JSON.stringify(bad); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null, `${key}=${value} must reject`);
    assert.equal(mem.getItem(SAVE_KEY), encoded, 'rejection leaves original bytes intact');
  }
});


test('overhaul form changes preserve pending contacts without leaving unsaveable sequence metadata', () => {
  const game = createGame(119, { forms: [['ataru'], ['soresu']], teamSizes: [1, 1] });
  const fighter = game.soldiers[0], enemy = game.soldiers[1];
  const moves = getFormMoves('ataru'), move = moves.at(-1);
  fighter.comboIndex = moves.length - 1; fighter.lastSaberMoveId = move.id; fighter.comboBeat = 2;
  fighter.attack = { kind: 'saber', target: enemy.id, startedTick: 0, resolveTick: 20,
    counter: false, form: 'ataru', weapon: fighter.meleeWeapon, moveId: move.id, comboIndex: moves.length - 1 };
  const pending = structuredClone(fighter.attack);
  checkpoint(game); // Establish that the pre-switch fixture is itself valid.
  assert.equal(setForm(game, 0, 'makashi'), true);
  assert.deepEqual(fighter.attack, pending, 'switching form does not rewrite a paid recorded contact');
  checkpoint(game);
});

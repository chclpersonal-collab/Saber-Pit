import test from 'node:test';
import assert from 'node:assert/strict';
import { startAirborne, sampleAirborne, advanceAirborne, trainedJumpSpec, canMeleeHit } from '../dist/airborne.js';
import { chooseCombatSequence } from '../dist/combat-sequences.js';
import { getFormMoves } from '../dist/combat-forms.js';
const actor = () => ({ x: 100, y: 100, facing: 1, energy: 80 });

test('aerial repertoire has deterministic distinct paths and mirrored side vaults', () => {
  const samples = ['somersault', 'side-vault', 'low-vault', 'retreat'].map(trajectory => {
    const s = actor(); startAirborne(s, 0, { trajectory, durationTicks: 40, distance: 40, height: 40 });
    const a = sampleAirborne(s, 20); assert.deepEqual(sampleAirborne(s, 20), a);
    assert.equal(s.x, 100); assert.equal(s.energy, 80); return a;
  });
  assert.equal(new Set(samples.map(s => `${s.x},${s.y}`)).size, 4);
  const left = actor(), right = actor();
  startAirborne(left, 0, { trajectory: 'side-vault', lateralDistance: -20, durationTicks: 40 });
  startAirborne(right, 0, { trajectory: 'side-vault', lateralDistance: 20, durationTicks: 40 });
  const a = sampleAirborne(left, 20), b = sampleAirborne(right, 20);
  assert.equal(a.rotationAxis, 'roll'); assert.equal(a.bank, -b.bank);
  assert.equal(a.rotation, -b.rotation); assert.equal(a.y - 100, -(b.y - 100));
});

test('curved vault uses swept movement, never banks blocked travel for later teleport', () => {
  const s = actor(); startAirborne(s, 0, { trajectory: 'side-vault', distance: 40, durationTicks: 40 });
  const calls = []; const blocked = (unit, dx, dy) => { calls.push([dx, dy]); };
  for (let tick = 1; tick <= 20; tick++) advanceAirborne(s, tick, blocked);
  assert.equal(s.x, 100); assert.equal(s.y, 100);
  const expected = sampleAirborne(s, 21); advanceAirborne(s, 21);
  assert.ok(Math.abs(s.x - 100 - expected.dx) < 1e-9);
  assert.ok(Math.abs(s.y - 100 - expected.dy) < 1e-9);
  assert.equal(calls.length, 20); assert.ok(calls.some(([,dy]) => dy > 0));
  const before = { x: s.x, y: s.y }; advanceAirborne(s, 21); assert.equal(s.x, before.x); assert.equal(s.y, before.y);
});

test('all trajectories land, keep resource state, and remain vulnerable at shared height', () => {
  for (const trajectory of ['somersault', 'side-vault', 'low-vault', 'retreat']) {
    const s = actor(), enemy = actor();
    const spec = { trajectory, durationTicks: 40, height: 20, distance: 30, recoveryTicks: 8 };
    startAirborne(s, 0, spec); startAirborne(enemy, 0, spec);
    assert.equal(canMeleeHit(s, enemy, 20), true);
    for (let tick = 1; tick <= 40; tick++) advanceAirborne(s, tick);
    assert.equal(s.airborne, null); assert.equal(s.airborneHeight, 0);
    assert.equal(s.landingRecoveryUntil, 48); assert.equal(s.energy, 80);
    assert.ok(Math.abs(s.y - 100) < 1e-8);
  }
});

test('training preserves authored trajectory geometry and legacy arcs remain straight', () => {
  const spec = { trajectory: 'side-vault', height: 32, distance: 24, lateralDistance: -16, durationTicks: 40, recoveryTicks: 12 };
  const trained = trainedJumpSpec(spec, 1);
  assert.equal(trained.lateralDistance, -16); assert.equal(trained.height, 32); assert.equal(trained.distance, 24);
  assert.ok(trained.durationTicks < spec.durationTicks);
  const legacy = actor(); legacy.airborne = { startTick: 0, endTick: 40, originX: 100, originY: 100, directionX: 1, directionY: 0, distance: 40, height: 40, rotations: 1, recoveryTicks: 8, appliedProgress: 0 };
  const sample = sampleAirborne(legacy, 20); assert.equal(sample.x, 120); assert.equal(sample.y, 100); assert.equal(sample.height, 40);
});

test('recent aerial sequence prefers a legal affordable grounded return without repeating', () => {
  const moves = getFormMoves('ataru');
  const ground = moves.filter(move => !move.jump); assert.ok(ground.length >= 2);
  const common = { formId: 'ataru', comboLength: moves.length, energy: 100, comboActive: true, aerialRecoveryActive: true };
  const a = chooseCombatSequence({ ...common, comboIndex: 1, lastMoveId: moves[0].id });
  assert.equal(moves[a.index].jump, null);
  const b = chooseCombatSequence({ ...common, comboIndex: a.index + 1, lastMoveId: moves[a.index].id });
  assert.equal(moves[b.index].jump, null); assert.notEqual(a.index, b.index);
});

test('novices access repertoire variety without gaining a long finisher chain', () => {
  const moves = getFormMoves('ataru');
  const seen = new Set();
  let lastMoveId;
  for (let attackSequence = 0; attackSequence < 12; attackSequence++) {
    const choice = chooseCombatSequence({ formId: 'ataru', comboLength: 1, repertoireLength: moves.length,
      comboActive: false, energy: 100, attackSequence, lastMoveId });
    assert.notEqual(moves[choice.index].id, lastMoveId);
    lastMoveId = moves[choice.index].id; seen.add(choice.index);
  }
  assert.ok(seen.size >= 3, `Only ${seen.size} opening lines were selected`);
  assert.ok([...seen].some(index => !moves[index].jump));
  const novice = chooseCombatSequence({ formId: 'ataru', comboLength: 1, repertoireLength: moves.length,
    comboActive: true, comboIndex: 6, lastOutcome: 'hit', targetRecoveryTicks: 100, energy: 100 });
  assert.notEqual(novice.reason, 'Finish a connected combination in a measured opening');
});

test('actual seeded novice and advanced duels use varied moves and bounded aerial commitments', async () => {
  const { createGame, step } = await import('../dist/sim.js');
  const { FORMS } = await import('../dist/content.js');
  for (const rank of ['F', 'SSS+V']) for (const form of Object.keys(FORMS)) {
    const g = createGame(29, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'spectate',
      matchMode: 'elimination', roundDuration: 90, startingRanks: [rank, rank], forms: [[form], ['shii_cho']], modifier: 'saber_only' });
    let lastEffect = 0, previousMove, starts = 0, airborneStarts = 0;
    const ids = new Set();
    for (let frame = 0; frame < 5401 && g.status === 'playing'; frame++) {
      step(g, 1 / 60);
      for (const s of g.soldiers) {
        for (const key of ['x', 'y', 'hp', 'energy', 'airborneHeight']) assert.ok(Number.isFinite(s[key]), `${form}/${rank}/${key}`);
        assert.ok(s.energy >= 0 && s.energy <= 100);
      }
      for (const e of g.effects.filter(e => e.id > lastEffect)) {
        lastEffect = Math.max(lastEffect, e.id);
        if (e.type !== 'telegraph' || e.kind !== 'saber' || e.team !== 0) continue;
        assert.notEqual(e.moveId, previousMove, `${form}/${rank} repeated an attack`);
        previousMove = e.moveId; ids.add(e.moveId); starts++;
        if (g.soldiers.find(s => s.id === e.soldierId).airborne) airborneStarts++;
      }
    }
    assert.ok(starts >= 3 && ids.size >= 3, `${form}/${rank}: ${starts} starts across ${ids.size} moves`);
    if (form === 'ataru') assert.ok(airborneStarts < starts / 2, `${rank}: ${airborneStarts}/${starts} aerial attacks`);
  }
});

test('fresh aerial approaches rotate independently of the intervening grounded beats', () => {
  const moves = getFormMoves('ataru'), selected = new Set();
  for (let attackSequence = 0; attackSequence < 18; attackSequence += 3) {
    const choice = chooseCombatSequence({ formId: 'ataru', comboLength: 1, repertoireLength: moves.length,
      comboActive: false, energy: 100, attackSequence, lastMoveId: 'retreating_snap_cut' });
    assert.ok(moves[choice.index].jump); selected.add(moves[choice.index].id);
  }
  assert.equal(selected.size, moves.filter(move => move.jump).length);
});

test('authored rotation aliases normalize and yaw exposes a finite twist', () => {
  for (const [rotationAxis, expected] of [['somersault', 'pitch'], ['cartwheel', 'roll'], ['twist', 'yaw'], ['pitch', 'pitch'], ['roll', 'roll'], ['yaw', 'yaw']]) {
    const s = actor(); startAirborne(s, 0, { rotationAxis, durationTicks: 40, rotations: 1 });
    assert.equal(s.airborne.rotationAxis, expected);
    const sample = sampleAirborne(s, 20);
    assert.equal(sample.rotationAxis, expected); assert.ok(Number.isFinite(sample.twist));
    assert.equal(sample.twist, expected === 'yaw' ? Math.PI : 0);
  }
});

test('fractional visual rotations settle upright without changing physical arcs', () => {
  for (const rotations of [-.75, .75, 1.5, 2]) {
    const s = actor(); startAirborne(s, 0, { rotationAxis: 'yaw', rotations, durationTicks: 40, height: 40, distance: 20, recoveryTicks: 10 });
    const apex = sampleAirborne(s, 20), end = sampleAirborne(s, 40);
    assert.equal(apex.height, 40); assert.equal(apex.rotation, rotations * Math.PI);
    assert.ok(Math.abs(Math.sin(end.visualRotation)) < 1e-8);
    assert.ok(Math.abs(Math.cos(end.visualRotation) - 1) < 1e-8);
    assert.equal(end.visualTwist, end.visualRotation);
    assert.equal(end.rotation, rotations * Math.PI * 2);
    advanceAirborne(s, 40);
    const landed = sampleAirborne(s, 40), settled = sampleAirborne(s, 50);
    assert.equal(landed.height, 0); assert.equal(landed.visualRotation, 0);
    assert.equal(landed.landingCompression, 1); assert.equal(settled.landingCompression, 0);
    assert.equal(s.x, 120); assert.equal(s.energy, 80);
  }
});

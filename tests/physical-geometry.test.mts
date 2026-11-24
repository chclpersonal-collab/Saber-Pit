/** Geometric acceptance for visible cut planes. Distinct JSON signatures alone
 * cannot distinguish a horizontal cut from a vertical arm waggle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMS } from '../dist/content.js';
import { getFormMoves } from '../dist/combat-forms.js';
import { sampleCombatPose } from '../dist/choreography.js';
import { sampleFighterRig } from '../dist/pose-rig.js';

const span = values => Math.max(...values) - Math.min(...values);
function cycle(form, move, { facing = 1, reducedMotion = false, dual = false, timestamps = null } = {}) {
  // Rank-F single-blade authored windup at 60 Hz, including a jump commitment.
  const contactTick = Math.ceil(Math.max(18 * FORMS[form].attackIntervalMultiplier * move.windupMultiplier, (move.jump?.durationTicks ?? 0) * .9));
  const timeline = timestamps ?? Array.from({ length: (contactTick + 22) * 4 + 1 }, (_, sample) => sample / 4);
  return timeline.map(tick => {
    const fighter = { form, facing, attack: tick <= contactTick ? { kind: 'saber', form, moveId: move.id, startedTick: 0, resolveTick: contactTick } : null };
    const swing = tick > contactTick ? { tick: contactTick, form, moveId: move.id, outcome: 'hit' } : null;
    const input = { fighter, tick, swing, move, motion: move.motion, reducedMotion, dual, aimAngle: 0 };
    const pose = sampleCombatPose(input);
    return sampleFighterRig({ ...input, pose });
  });
}
function bladeSpan(rigs, dimension, projected = true) {
  return span(rigs.map(rig => {
    const points = projected ? rig.projected : rig.joints;
    return points.tipMain[dimension] - points.handMain[dimension];
  }));
}
const catalog = Object.keys(FORMS).flatMap(form => getFormMoves(form).map(move => ({ form, move })));

for (const { form, move } of catalog.filter(({ move }) => move.animation.plane === 'horizontal')) {
  test(`geometry ${form}/${move.id} travels left-right through depth, not a vertical blade waggle`, () => {
    const rigs = cycle(form, move).filter(rig => ['strike', 'follow-through'].includes(rig.phase));
    const width = bladeSpan(rigs, 'x'), height = bladeSpan(rigs, 'y');
    assert.ok(width >= 28, `projected lateral blade span ${width.toFixed(2)}px must be substantial`);
    assert.ok(height <= 18, `horizontal projected height span ${height.toFixed(2)}px must stay restrained`);
    assert.ok(width >= height * 2, `horizontal width ${width.toFixed(2)} must dominate height ${height.toFixed(2)}`);
    assert.ok(bladeSpan(rigs, 'y', false) < 1, 'a horizontal cut keeps its physical blade elevation');
    assert.ok(bladeSpan(rigs, 'z', false) >= 20, 'the cut must traverse depth, not merely slide its hand');
  });
}

test('geometry vertical and diagonal attacks inhabit genuinely different physical planes', () => {
  const vertical = getFormMoves('djem_so').find(move => move.animation.plane === 'vertical');
  const diagonal = getFormMoves('shii_cho').find(move => move.animation.plane === 'diagonal');
  const active = rigs => rigs.filter(rig => ['strike', 'follow-through'].includes(rig.phase));
  const v = active(cycle('djem_so', vertical)), d = active(cycle('shii_cho', diagonal));
  assert.ok(bladeSpan(v, 'y') >= 35, 'vertical cut must travel visibly up/down');
  assert.ok(bladeSpan(v, 'y') > bladeSpan(v, 'x') * 1.25, 'vertical travel dominates lateral travel');
  assert.ok(bladeSpan(v, 'z', false) < 1, 'vertical edge stays in its physical vertical plane');
  assert.ok(bladeSpan(d, 'x') >= 18 && bladeSpan(d, 'y') >= 20, 'diagonal cuts need both lateral and vertical travel');
  assert.ok(bladeSpan(d, 'z', false) >= 10, 'diagonal cuts must turn through a real third dimension');
});

test('geometry a full cut articulates torso, arm and lead leg while the blade remains rigidly attached', () => {
  const move = getFormMoves('shii_cho')[0], rigs = cycle('shii_cho', move);
  assert.ok(span(rigs.map(rig => rig.projected.shoulderMain.x)) >= 6, 'shoulder displacement should be visible at game scale');
  assert.ok(span(rigs.map(rig => rig.projected.pelvis.x)) >= 2, 'hips must transfer weight rather than a static torso');
  assert.ok(span(rigs.map(rig => rig.projected.kneeMain.x)) >= 2, 'lead knee participates in the cut');
  assert.ok(span(rigs.map(rig => rig.projected.handMain.x - rig.projected.shoulderMain.x)) >= 4, 'arm must articulate relative to shoulder');
  for (const { form, move } of catalog) for (const dual of [false, true]) {
    for (const rig of cycle(form, move, { dual })) for (const blade of rig.blades) {
      const hand = rig.joints[blade.hand], tip = rig.joints[blade.tip], hilt = rig.joints[blade.hilt];
      assert.ok(Math.abs(Math.hypot(tip.x - hand.x, tip.y - hand.y, tip.z - hand.z) - blade.length) < 1e-8, `${form}/${move.id} blade cannot stretch`);
      assert.ok(Math.abs(Math.hypot(hilt.x - hand.x, hilt.y - hand.y, hilt.z - hand.z) - 3.5) < 1e-8, `${form}/${move.id} hilt stays attached`);
    }
  }
});

test('geometry mirrored facing preserves travel and reduced motion removes secondary body motion', () => {
  const move = getFormMoves('shii_cho')[0];
  const right = cycle('shii_cho', move), left = cycle('shii_cho', move, { facing: -1 });
  for (let i = 0; i < right.length; i++) for (const key of Object.keys(right[i].projected)) {
    assert.ok(Math.abs(right[i].projected[key].x + left[i].projected[key].x) < 1e-8, key);
    assert.equal(right[i].projected[key].y, left[i].projected[key].y);
  }
  const reduced = cycle('shii_cho', move, { reducedMotion: true });
  for (const joint of ['pelvis', 'footMain', 'footOff']) {
    assert.ok(span(reduced.map(rig => rig.projected[joint].x)) < 1e-8, `${joint} has no secondary horizontal motion`);
    assert.ok(span(reduced.map(rig => rig.projected[joint].y)) < 1e-8, `${joint} has no secondary bobbing`);
  }
  for (const rig of reduced) for (const blade of rig.blades) assert.equal(blade.trailOpacity, 0);
});

test('geometry linked cuts carry the previous visible pose into the next chamber without snapping', () => {
  const [first, second] = getFormMoves('shii_cho');
  const swing = { tick: 100, form: 'shii_cho', moveId: first.id, outcome: 'hit' };
  const fighter = { form: 'shii_cho', comboUntil: 200, attack: null };
  const before = sampleCombatPose({ fighter, tick: 107, swing });
  const after = sampleCombatPose({ fighter: { ...fighter, attack: { kind: 'saber', form: 'shii_cho', moveId: second.id, startedTick: 107, resolveTick: 137 } }, tick: 107, swing });
  for (const key of ['angle', 'bladeYaw', 'bladePitch', 'extension', 'lean', 'crouch', 'depth', 'footwork', 'bodyRoll', 'twist', 'handHeight']) {
    assert.equal(after[key], before[key], `${key} must connect exactly at the new chamber's first frame`);
  }
});

test('geometry complete ready-chamber-contact-recovery cycles are continuous at every phase boundary', () => {
  // A fast slash is allowed high velocity. Test infinitesimal offsets at phase
  // boundaries rather than conflating an arbitrary speed cap with continuity.
  const epsilon = .00001, jumps = [];
  for (const { form, move } of catalog) {
    const contact = Math.ceil(Math.max(18 * FORMS[form].attackIntervalMultiplier * move.windupMultiplier, (move.jump?.durationTicks ?? 0) * .9));
    for (const boundary of [0, contact * .56, contact, contact + 22 * .45, contact + 22]) {
      const rigs = cycle(form, move, { timestamps: [boundary - epsilon, boundary + epsilon] });
      for (const name of ['pelvis', 'shoulderMain', 'elbowMain', 'handMain', 'kneeMain', 'footMain', 'tipMain']) {
        const a = rigs[0].projected[name], b = rigs[1].projected[name];
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance > .01) jumps.push(`${form}/${move.id} ${name}: ${distance.toFixed(4)}px at tick ${boundary}`);
      }
    }
  }
  assert.deepEqual(jumps, [], 'no discontinuities between choreography phases');
});

test('geometry cross-plane combo links preserve actual body joints and rigid weapon grips', () => {
  for (const form of Object.keys(FORMS)) {
    const moves = getFormMoves(form);
    for (let i = 0; i < moves.length; i++) for (const dual of [false, true]) {
      const first = moves[i], second = moves[(i + 1) % moves.length];
      const swing = { tick: 100, form, moveId: first.id, outcome: 'hit' };
      const fighter = { form, facing: 1, comboUntil: 200, attack: null };
      const beforePose = sampleCombatPose({ fighter, tick: 107, swing, move: first, dual });
      const before = sampleFighterRig({ fighter, tick: 107, swing, move: first, motion: first.motion, pose: beforePose, dual });
      const next = { ...fighter, attack: { kind: 'saber', form, moveId: second.id, startedTick: 107, resolveTick: 137 } };
      const pose = sampleCombatPose({ fighter: next, tick: 107, swing, move: second, dual });
      const after = sampleFighterRig({ fighter: next, tick: 107, swing, move: second, motion: second.motion, pose, dual });
      for (const name of Object.keys(before.projected)) {
        assert.ok(Math.hypot(before.projected[name].x - after.projected[name].x, before.projected[name].y - after.projected[name].y) < 1e-8, `${form} ${first.id}→${second.id}: ${name} connects without snapping`);
      }
    }
  }
});

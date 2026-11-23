import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command } from '../dist/sim.js';
import { startAirborne, sampleAirborne } from '../dist/airborne.js';
import { sampleCombatPose } from '../dist/choreography.js';
import { sampleFighterRig } from '../dist/pose-rig.js';
import { renderPosition, createRenderFrame } from '../dist/render-interpolation.js';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const interpolatedX = (soldier, alpha) => renderPosition(soldier, alpha).x;
const repeats = values => values.slice(1).filter((value, i) => Math.abs(value - values[i]) < 1e-9).length;

// Numerical fixed-step audit, not a browser/monitor refresh-rate measurement.
// Initial frames, stationary units, pauses and endpoint easing may repeat legitimately.
test('120 Hz numerical moving window replaces alternating fixed-tick holds with half-tick position increments', () => {
  const game = createGame(67); command(game, 'advance');
  const rows = [];
  for (let frame = 1; frame <= 16; frame++) {
    step(game, 1 / 120);
    const soldier = game.soldiers[0];
    const view = createRenderFrame(game);
    near(view.soldiers[0].x, interpolatedX(soldier, game.alpha), 'actual frame position');
    near(view.tick, game.tick + game.alpha, 'actual sampler time');
    rows.push({ frame, tick: game.tick, alpha: game.alpha, raw: soldier.x, rendered: interpolatedX(soldier, game.alpha) });
  }
  // Frame 2 is the first completed tick; frame 1 has no previous movement yet.
  const moving = rows.slice(1);
  assert.deepEqual(moving.slice(0, 6).map(row => row.alpha), [0, .5, 0, .5, 0, .5]);
  assert.equal(repeats(moving.map(row => row.raw)), 7);
  assert.equal(repeats(moving.map(row => row.rendered)), 0);
  for (let i = 1; i < moving.length; i++) near(moving[i].rendered - moving[i - 1].rendered, 86 / 120, 'world pixels per 120 Hz frame');
  near(moving[0].rendered, 150, 'start of interpolation window');
  near(moving[1].rendered, 150 + 86 / 120, 'half-tick midpoint');
});

test('stationary snapshots and paused redraws legitimately repeat without moving judder', () => {
  const stationary = { prevX: 40, x: 40 };
  assert.deepEqual([0, .25, .5, .75].map(alpha => interpolatedX(stationary, alpha)), [40, 40, 40, 40]);
  const game = createGame(67); command(game, 'advance'); step(game, 1 / 40);
  const before = structuredClone(game);
  const positions = Array.from({ length: 4 }, () => interpolatedX(game.soldiers[0], game.alpha));
  assert.equal(repeats(positions), 3);
  assert.deepEqual(game, before, 'redrawing without simulation advancement does not advance alpha');
});

test('requested tick+alpha sampler clock leads prev-to-current positional clock by exactly one fixed tick', () => {
  for (const tick of [1, 2, 40]) for (const alpha of [0, .25, .5, .75]) {
    const positionClock = tick - 1 + alpha;
    const samplerClock = createRenderFrame({ tick, alpha, soldiers: [] }).tick;
    near(samplerClock - positionClock, 1, 'tick phase lead');
    near((samplerClock - positionClock) / 60, 1 / 60, 'seconds phase lead');
  }
});

test('airborne sampler preserves half ticks for height, displacement and rotation without mutation', () => {
  const fighter = { x: 100, y: 100, facing: 1 };
  startAirborne(fighter, 0, { durationTicks: 40, distance: 80, height: 40, rotations: 1 });
  const before = structuredClone(fighter);
  const times = [4, 4.5, 5, 5.5, 6, 6.5];
  const samples = times.map(tick => sampleAirborne(fighter, tick));
  samples.forEach((sample, i) => {
    near(sample.progress, times[i] / 40, 'fractional arc progress');
    near(sample.x, 100 + 2 * times[i], 'fractional world displacement');
    near(sample.height, 160 * sample.progress * (1 - sample.progress), 'fractional ballistic height');
    near(sample.rotation, sample.progress * Math.PI * 2, 'fractional rotation');
  });
  assert.equal(repeats(samples.map(sample => sample.height)), 0);
  assert.deepEqual(fighter, before);
});

test('combat and rig samplers preserve half ticks across moving attack and recovery windows', () => {
  for (const stage of ['attack', 'recovery']) {
    const fighter = { team: 0, facing: 1, attack: stage === 'attack' ? { kind: 'saber', startedTick: 0, resolveTick: 20 } : null };
    const swing = stage === 'recovery' ? { tick: 0, outcome: 'hit' } : null;
    const before = structuredClone({ fighter, swing });
    const times = [4, 4.5, 5, 5.5, 6, 6.5];
    const samples = times.map(tick => {
      const pose = sampleCombatPose({ fighter, swing, tick, motion: 'sweep' });
      return { pose, rig: sampleFighterRig({ fighter, swing, pose, tick, motion: 'sweep' }) };
    });
    samples.forEach(({ pose, rig }, i) => {
      const expected = times[i] / (stage === 'attack' ? 20 : 22);
      near(pose.swingProgress, expected + (stage === 'recovery' ? 1 : 0), 'fractional combat progress');
      near(rig.progress, expected, 'fractional rig progress');
      for (const joint of Object.values(rig.joints)) for (const component of Object.values(joint)) assert.ok(Number.isFinite(component));
    });
    assert.equal(repeats(samples.map(sample => sample.pose.angle)), 0, `${stage} angle has no duplicated half-ticks`);
    assert.equal(new Set(samples.map(sample => JSON.stringify(sample.rig.projected))).size, times.length);
    assert.deepEqual({ fighter, swing }, before);
  }
});

test('walking rig retains fractional stride timing while idle feet remain planted', () => {
  const fighter = { team: 0, facing: 1, lane: 0 };
  const times = [4, 4.5, 5, 5.5, 6, 6.5];
  const walking = times.map(tick => sampleFighterRig({ fighter, tick, moving: true }));
  // The v1.5 rendered stride is wider; its fractional clock is unchanged.
  walking.forEach((rig, i) => near(rig.joints.footMain.x, 8 + Math.sin(times[i] * .23) * 7.6, 'fractional walking stride'));
  assert.equal(new Set(walking.map(rig => JSON.stringify(rig.projected))).size, times.length);
  const idle = times.map(tick => sampleFighterRig({ fighter, tick, moving: false }));
  assert.equal(new Set(idle.map(rig => JSON.stringify(rig.joints.footMain))).size, 1);
  assert.equal(new Set(idle.map(rig => JSON.stringify(rig.joints.footOff))).size, 1);
  assert.ok(new Set(idle.map(rig => JSON.stringify(rig.projected.head))).size > 1);
});

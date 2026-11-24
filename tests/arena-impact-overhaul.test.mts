import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaImpact } from '../dist/arena-impact.js';

const effect = (id, type, extra) => ({ id, type, x: 40, y: 90, x2: 71, y2: 111, ...extra });

test('accents use only classified authoritative events and deduplicate old batches', () => {
  const renderer = createArenaImpact();
  const events = [
    effect(1, 'saber', { outcome: 'hit', damage: 4 }),
    effect(2, 'saber', { outcome: 'blocked', damage: 0 }),
    effect(3, 'saber', { outcome: 'hit', damage: 7, isCounter: true }),
    effect(4, 'saber', { outcome: 'miss', damage: 0 }),
    effect(5, 'feedback', { outcome: 'hit', damage: 7 }),
    effect(6, 'force', { outcome: 'hit', damage: 0 }),
    effect(7, 'force', { abilityId: 'force_barrier' }),
    effect(8, 'force', { outcome: 'out-of-range' }),
    effect(9, 'death'),
  ];
  renderer.observe(events); renderer.observe(events);
  assert.deepEqual(renderer.inspect().kinds, ['hit', 'clash', 'counter', 'force', 'barrier', 'ko']);
  renderer.advance(.35);
  assert.deepEqual(renderer.inspect().kinds, ['counter', 'force', 'barrier', 'ko']);
  renderer.advance(.15);
  assert.equal(renderer.inspect().active, 0);
});

test('reduced, low effects, pause and hidden filters clear effects safely', () => {
  for (const options of [{ reducedMotion: true }, { fullEffects: false }, { paused: true }, { visible: false }]) {
    const renderer = createArenaImpact();
    const events = [effect(1, 'death'), effect(2, 'death')];
    renderer.observe(events.slice(0, 1));
    renderer.advance(.1, options); renderer.observe(events); renderer.advance(.1);
    renderer.observe(events);
    assert.equal(renderer.inspect().active, 0);
  }
  const renderer = createArenaImpact();
  renderer.reset([effect(1, 'death')]);
  renderer.observe([effect(1, 'death'), effect(2, 'death')]);
  assert.equal(renderer.inspect().active, 1);
});

test('the fixed pool prefers knockouts and canvas state is restored', () => {
  const renderer = createArenaImpact();
  renderer.observe(Array.from({ length: 50 }, (_, i) => effect(i + 1, 'saber', { outcome: 'hit', damage: 6 })));
  renderer.observe([effect(51, 'death')]);
  renderer.observe(Array.from({ length: 50 }, (_, i) => effect(i + 52, 'saber', { outcome: 'hit', damage: 6 })));
  assert.equal(renderer.inspect().active, 32); assert(renderer.inspect().kinds.includes('ko'));
  const calls = [];
  const ctx = Object.fromEntries(['save', 'beginPath', 'moveTo', 'lineTo', 'arc', 'stroke', 'restore'].map(name => [
    name, (...args) => { assert(args.every(Number.isFinite)); calls.push(name); },
  ]));
  renderer.advance(.07); renderer.draw(ctx, { player: '#aaeeff' });
  assert.equal(calls[0], 'save'); assert.equal(calls.at(-1), 'restore');
  assert(calls.includes('arc')); assert(calls.includes('lineTo')); assert.equal(ctx.strokeStyle, '#aaeeff');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderFrame, renderPosition } from '../dist/render-interpolation.js';

test('render view interpolates soldier, relic and frontline without mutating authority', () => {
  const soldier = { id: 'blue-0', x: 20, y: 40, prevX: 10, prevY: 20, alive: true };
  const effect = { type: 'saber', soldierId: soldier.id, x: 12, y: 24, x2: 30, y2: 60 };
  const game = { tick: 3, alpha: .5, soldiers: [soldier], objective: { x: 20, y: 40, prevX: 10, prevY: 20 }, frontLine: 30, prevFrontLine: 20, effects: [effect] };
  const saved = JSON.stringify(game), frame = createRenderFrame(game);
  assert.deepEqual({ x: frame.soldiers[0].x, y: frame.soldiers[0].y }, { x: 15, y: 30 });
  assert.equal(frame.fighters.get('blue-0'), frame.soldiers[0]);
  assert.equal(frame.objective.x, 15); assert.equal(frame.frontLine, 25);
  assert.equal(frame.tick, 3.5);
  assert.deepEqual(frame.effects[0], effect, 'historical event anchors do not follow fighters');
  assert.equal(JSON.stringify(game), saved);
  assert.notEqual(frame.soldiers[0], soldier);
});

test('stopped view uses current positions and integer sampler time', () => {
  const game = { tick: 3, alpha: .5, soldiers: [{ id: 'blue-0', x: 20, y: 40, prevX: 10, prevY: 20 }], objective: { x: 20, y: 40, prevX: 10, prevY: 20 } };
  const frame = createRenderFrame(game, { interpolate: false });
  assert.equal(frame.soldiers[0].x, 20); assert.equal(frame.objective.x, 20);
  assert.equal(frame.tick, 3); assert.equal(frame.alpha, 0);
});

test('missing snapshot coordinates and malformed alpha cannot poison rendering', () => {
  assert.deepEqual(renderPosition({ x: 20, y: 40 }, .5), { x: 20, y: 40 });
  const entity = { x: 20, y: 40, prevX: 10, prevY: 20 };
  assert.deepEqual(renderPosition(entity, -1), { x: 10, y: 20 });
  assert.deepEqual(renderPosition(entity, 2), { x: 20, y: 40 });
  assert.deepEqual(renderPosition(entity, NaN), { x: 10, y: 20 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationEffects, PRESENTATION_EFFECT_SECONDS as D } from '../dist/presentation-effects.js';
const hit = { id: 1, type: 'saber', outcome: 'hit', x: 5, y: 7, x2: 20, y2: 30, team: 0 };
test('authoritative contacts are immutable, deduplicated and do not invent misses', () => {
  const fx = createPresentationEffects(), before = JSON.stringify(hit);
  fx.observe([hit, hit, { ...hit, id: 2, outcome: 'miss' }, { ...hit, id: 3, type: 'block' }]);
  assert.equal(fx.inspect().contacts.length, 1); assert.equal(JSON.stringify(hit), before);
  assert.ok(fx.inspect().contacts[0].count >= 6 && fx.inspect().contacts[0].count <= 10);
});
test('effect lifetimes are elapsed-time equivalents at 60/120/144 Hz', () => {
  for (const hz of [60, 120, 144]) {
    const fx = createPresentationEffects(); fx.observe([hit]);
    let n = 0; while (fx.inspect().contacts.length && n < hz) { fx.advance(1 / hz); n++; }
    assert.ok(n / hz >= D.sparks - 1e-9); assert.ok(n / hz <= D.sparks + 1 / hz + 1e-9);
    assert.deepEqual(fx.shake(), { x: 0, y: 0 });
  }
});
test('trail retains at most six time-sampled blade segments without stale teleport bridge', () => {
  const fx = createPresentationEffects();
  for (let i = 0; i < 30; i++) { fx.advance(1 / 120); fx.sampleBlade('a', { x: i, y: 0 }, { x: i + 10, y: i }, { active: true }); }
  assert.ok(fx.inspect().trails[0].samples.length <= 6);
  fx.advance(1 / 60); fx.sampleBlade('a', { x: 500, y: 0 }, { x: 510, y: 0 }, { active: true });
  assert.equal(fx.inspect().trails[0].samples.length, 1);
  fx.advance(.2); assert.equal(fx.inspect().trails.length, 0);
});
test('reduced motion, pause and hidden boundaries remove flash, shake and smears', () => {
  for (const options of [{ reducedMotion: true }, { paused: true }, { visible: false }]) {
    const fx = createPresentationEffects(); fx.observe([hit]); fx.sampleBlade('a', {}, {}, { active: true }); fx.advance(.01, options);
    assert.equal(fx.inspect().contacts.length, 0); assert.equal(fx.inspect().trails.length, 0); assert.deepEqual(fx.shake(), { x: 0, y: 0 });
  }
});
test('reset marks restored events as seen and starts a new clean clock', () => {
  const fx = createPresentationEffects(); fx.observe([hit]); fx.advance(.02); fx.reset([hit]); fx.observe([hit]);
  assert.equal(fx.inspect().time, 0); assert.equal(fx.inspect().contacts.length, 0);
  fx.observe([{ ...hit, id: 2 }]); assert.equal(fx.inspect().contacts.length, 1);
});
test('force push travels from caster to target without mutating authoritative event', () => {
  const fx = createPresentationEffects(), e = { id: 7, type: 'force', abilityId: 'force_push', x: 0, y: 0, x2: 80, y2: 0 };
  fx.observe([e]); fx.advance(D.force / 2); const arcs = [];
  const ctx = { save() {}, restore() {}, beginPath() {}, arc(...a) { arcs.push(a); }, stroke() {} };
  fx.draw(ctx); assert.equal(arcs[0][0], 40); assert.equal(arcs[0][2], 22); assert.equal(e.x, 0);
});
test('drawing restores canvas state even if a drawing operation fails', () => {
  const fx = createPresentationEffects(); fx.observe([hit]); let restored = false;
  assert.throws(() => fx.draw({ save() {}, restore() { restored = true; }, beginPath() { throw Error('test'); } })); assert.equal(restored, true);
});
test('white contact burst lasts 2.5 fixed-60Hz frames at every refresh cadence', () => {
  for (const hz of [60,120,144]) {
    const fx=createPresentationEffects(); fx.observe([hit]); let flashes=0;
    for(let n=0;n<Math.ceil(hz*.1);n++) {
      const ctx={save(){},restore(){},beginPath(){},arc(){},fill(){flashes++;},moveTo(){},lineTo(){},stroke(){}};
      fx.draw(ctx); fx.advance(1/hz);
    }
    assert.ok(flashes/hz>=D.flash-1e-9 && flashes/hz<=D.flash+1/hz+1e-9);
  }
});
test('malformed presentation inputs cannot generate NaN canvas coordinates', () => {
  const fx=createPresentationEffects(),values=[];
  fx.advance(NaN); fx.observe([{...hit,x2:NaN,y2:Infinity}]);
  fx.sampleBlade('a',{x:NaN,y:Infinity},{},{active:true}); fx.advance(.02);
  fx.sampleBlade('a',{}, {},{active:true});
  const ctx={save(){},restore(){},beginPath(){},closePath(){},fill(){},stroke(){},arc(...a){values.push(...a);},moveTo(...a){values.push(...a);},lineTo(...a){values.push(...a);}};
  fx.draw(ctx); assert.ok(values.every(Number.isFinite));
});

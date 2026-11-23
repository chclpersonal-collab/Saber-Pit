import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationClock, HIT_STOP_SECONDS } from '../dist/presentation-clock.js';

const game = () => ({ tick: 1, round: 1, rng: 123, effects: [] });
const feedback = (id, outcome='hit', kind='saber', type='feedback') => ({ id, type, kind, outcome });

for (const rate of [60, 120, 144]) for (const outcome of ['hit', 'blocked']) {
  test(`${outcome} stop is ${HIT_STOP_SECONDS[outcome]} seconds at ${rate}Hz`, () => {
    const g=game(), clock=createPresentationClock(); clock.reset(g);
    g.effects.push(feedback(1,outcome)); clock.observe(g);
    let elapsed=0, eligible=0;
    for(let i=0;i<rate;i++){ elapsed+=1/rate; eligible+=clock.consume(1/rate); }
    assert.ok(Math.abs(elapsed-eligible-HIT_STOP_SECONDS[outcome])<1e-12);
    assert.equal(clock.remaining,0);
  });
}
test('feedback observed once; matching saber/block and force do not double-trigger',()=>{
  const g=game(),clock=createPresentationClock();clock.reset(g);
  g.effects.push(feedback(1,'blocked','saber','block'),feedback(2,'blocked','saber','saber'),feedback(3,'blocked'));
  assert.equal(clock.observe(g),.1);clock.consume(.07);const before=clock.remaining;
  assert.equal(clock.observe(g),0);assert.equal(clock.remaining,before);
  g.effects.push(feedback(4,'hit','force'),feedback(5,'miss'));assert.equal(clock.observe(g),0);
});
test('simultaneous contacts use maximum duration and never mutate authoritative data',()=>{
  const g=game(),clock=createPresentationClock();clock.reset(g);
  g.effects.push(feedback(1),feedback(2,'blocked'),feedback(3));
  const before=JSON.stringify(g);Object.freeze(g.effects);Object.freeze(g);
  assert.equal(clock.observe(g),.1);assert.equal(clock.consume(.025),0);
  assert.equal(JSON.stringify(g),before);
});
test('pause/load/reset primes effects and discards transient without replay',()=>{
  const g=game(),clock=createPresentationClock();clock.reset(g);g.effects.push(feedback(1));clock.observe(g);
  clock.reset(g);assert.equal(clock.remaining,0);assert.equal(clock.observe(g),0);
  const loaded=structuredClone(g);assert.equal(clock.observe(loaded),0);
  loaded.effects.push(feedback(2));assert.equal(clock.observe(loaded),4/60);
  loaded.tick=0;assert.equal(clock.observe(loaded),0);assert.equal(clock.remaining,0);
  loaded.round++;assert.equal(clock.observe(loaded),0);
});
test('invalid elapsed cannot produce NaN or consume a stop',()=>{
  const g=game(),clock=createPresentationClock();clock.reset(g);g.effects.push(feedback(1));clock.observe(g);
  for(const elapsed of [NaN,Infinity,-1,undefined])assert.equal(clock.consume(elapsed),0);
  assert.equal(clock.remaining,4/60);assert.equal(clock.consume(.2),.2-4/60);
});
test('within-frame stop consumes only remaining wall time and leaves fractional resumption',()=>{
  const g=game(),clock=createPresentationClock();clock.reset(g);
  assert.equal(clock.consume(1/60),1/60);g.tick++;g.effects.push(feedback(1));clock.observe(g);
  assert.equal(clock.consume(.04),0);
  assert.ok(Math.abs(clock.consume(.04)-(.08-4/60))<1e-12);
});

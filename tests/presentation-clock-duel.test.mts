import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../dist/sim.js';
import { createPresentationClock } from '../dist/presentation-clock.js';

const config = {teamSizes:[1,1],mapSize:'large',terrain:'crossroads',environment:'clear',mode:'spectate',roundDuration:150};
// Compare all state, excluding only display interpolation/step remainder.
function authoritative(g) {
  const copy=structuredClone(g);delete copy.alpha;delete copy._accumulator;return copy;
}

for(const hz of [60,120,144])for(const speed of [1,2,4]){
  test(`full duel clock driver preserves every authoritative tick at ${hz}Hz, ${speed}x`,()=>{
    const g=createGame(120120,config),baseline=createGame(120120,config),clock=createPresentationClock();clock.reset(g);
    let frames=0,contacts=0,heldSeconds=0;
    while(g.status==='playing'&&frames++<60000){
      let remaining=1/hz;
      while(remaining>1e-12&&g.status==='playing'){
        const beforeHold=remaining;remaining=clock.consume(remaining);heldSeconds+=beforeHold-remaining;
        if(remaining<=1e-12)break;
        const dt=Math.min(1/60,remaining*speed),beforeTick=g.tick;
        step(g,dt);if(clock.observe(g)>0)contacts++;
        remaining-=dt/speed;
        if(g.tick!==beforeTick){
          step(baseline,1/60);
          assert.deepEqual(authoritative(g),authoritative(baseline),`divergence at tick ${g.tick}`);
        }
      }
    }
    assert.equal(g.status,'ended');assert.equal(baseline.status,'ended');
    assert.ok(contacts>0,'real saber contacts exercised hit-stop');assert.ok(heldSeconds>0);
    assert.deepEqual(g,baseline,'full ended state matches, including RNG, careers and outcome');
  });
}

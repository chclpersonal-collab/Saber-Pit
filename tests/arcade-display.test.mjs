import test from 'node:test';
import assert from 'node:assert/strict';
import {FRAME_STEP,advanceSim,displayDelta,displayFighters,fighterSamples,newDisplayClock,resetDisplayClock} from '../dist/arcade-display.js';
for(const rate of [60,120,144,165,240]){
 test(`render measurements track ${rate} FPS while combat stays 120 ticks per second`,()=>{
  const clock=newDisplayClock(), sim={remainder:0};let ticks=0;
  for(let n=0;n<=rate*2;n++)advanceSim(sim,displayDelta(clock,n*1000/rate),{playing:()=>true,step:()=>ticks++});
  assert.equal(ticks,240);assert.equal(clock.fps,rate);
 });
}
test('movement and facing cross the midpoint without snapping at high refresh',()=>{
 const f={id:'f',x:1,y:5,face:Math.PI-.05,action:'idle',actionTime:1};
 const previous=fighterSamples([f]);
 Object.assign(f,{x:3,y:7,face:-Math.PI+.05,actionTime:1.02});
 const [p]=displayFighters([f],previous,FRAME_STEP/2);
 assert.equal(p.x,2);assert.equal(p.y,6);assert.ok(Math.abs(p.face-Math.PI)<1e-6);
 assert.equal(f.x,3);
 Object.assign(f,{action:'ko',actionTime:0,hp:0});
 assert.equal(displayFighters([f],previous,0)[0].actionTime,0);
});
test('visibility reset prevents catch-up and hit stop clears stale interpolation',()=>{
 const clock=newDisplayClock(), state={remainder:FRAME_STEP/2,previous:new Map()};
 displayDelta(clock,2);resetDisplayClock(clock);assert.equal(displayDelta(clock,60000),0);
 advanceSim(state,.016,{blocked:true});assert.equal(state.remainder,0);assert.equal(state.previous,null);
});
test('air motion interpolates within the current phase without blending into floor contact',()=>{
 const f={id:'a',action:'rush',technique:'vault',airPhase:'airborne',airHeight:24,airProgress:.32};
 const previous=fighterSamples([f]);
 let sample=displayFighters([{...f,airHeight:32,airProgress:.38}],previous,FRAME_STEP/2)[0];
 assert.equal(sample.airHeight,28);assert.ok(Math.abs(sample.airProgress-.35)<1e-8);
 sample=displayFighters([{...f,airPhase:'landing',airHeight:0,airProgress:0}],previous,FRAME_STEP/2)[0];
 assert.equal(sample.airHeight,0);assert.equal(sample.airPhase,'landing');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
const moduleFrom=(file: string,migrated: boolean)=>import(new URL((migrated?'../dist/':'../baseline/dist/')+file+'.js',import.meta.url));
const [display,baseline]=await Promise.all([moduleFrom('arcade-display',true),moduleFrom('arcade-display',false)]);

test('typed Arcade presentation preserves wrapped turning, airborne phase boundaries and fixed clock',()=>{
  const before=[{id:'A',x:31,y:78,face:3.10,action:'jump',actionTime:.12,
    airPhase:'airborne',airHeight:10,airProgress:.3,groundDistance:32}];
  const same=[{...before[0],x:34,y:81,face:-3.10,actionTime:.128,airHeight:11,airProgress:.31}];
  const next=[{...same[0],action:'slash',actionTime:0,airPhase:'landing',airHeight:0,airProgress:0}];
  const prev=display.fighterSamples(before);
  for(const roster of [same,next])
    assert.deepEqual(display.displayFighters(roster,prev,display.FRAME_STEP*.5),
      baseline.displayFighters(roster,baseline.fighterSamples(before),baseline.FRAME_STEP*.5));
  const view=display.displayFighters(same,prev,display.FRAME_STEP*.5)[0];
  assert.ok(Math.abs(view.face-Math.PI)<.001);
  const landed=display.displayFighters(next,prev,display.FRAME_STEP*.5)[0];
  assert.deepEqual([landed.x,landed.airHeight,landed.actionTime],[32.5,0,0]);
  assert.deepEqual([next[0].x,next[0].airHeight],[34,0]);
  const c=display.newDisplayClock(),old=baseline.newDisplayClock();
  for(const t of [0,17,29,350,364,389,418,435])
    assert.equal(display.displayDelta(c,t),baseline.displayDelta(old,t));
  assert.deepEqual(c,old);
});

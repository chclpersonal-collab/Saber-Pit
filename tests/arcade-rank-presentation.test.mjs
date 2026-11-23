import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,sampleArcadePresentation,arcadeBladeWorld} from '../dist/arcade-fighters.js';
const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('all fifteen ranks share exact blade geometry but visible recovery discipline improves with rank',()=>{
  const state={x:140,y:320,face:.3,action:'slash',attack:'slash',attackFamily:'cut',form:'shii_cho',actionTime:.4,
    actionDuration:.64,attackSpec:{contact:.22}};
  const source=sampleArcadeFighter(state,1);
  let y=Infinity;
  const shapes=new Set();
  for(let gradeIndex=0;gradeIndex<=14;gradeIndex++){
    const f={...state,career:{gradeIndex}}, shown=sampleArcadePresentation(f,source);
    assert.ok(shown.shoulder.y<y);y=shown.shoulder.y;
    assert.deepEqual(arcadeBladeWorld(f,source).tip,arcadeBladeWorld(f,shown).tip);
    shapes.add(shown.shoulder.y.toFixed(3));
    for(const l of source.legs.filter(l=>l.planted))assert.deepEqual(l.foot,shown.legs.find(k=>k.side===l.side).foot);
  }
  assert.equal(shapes.size,15);
});
test('rank footwork paths vary visibly, easing from and back to the same pose anchor',()=>{
  const state={action:'dash',technique:'sidestep',form:'makashi',face:0,x:140,y:260,actionDuration:.34,
    actionTime:.17,career:{gradeIndex:14}};
  const source=sampleArcadeFighter(state,1), paths=['check','side','slip','arc','switch','wheel','return'];
  const signatures=new Set(paths.map(path=>sampleArcadePresentation({...state,rankFootwork:{path,bearing:1}},source))
    .map(r=>[r.shoulder.x.toFixed(3),r.shoulder.y.toFixed(3)].join(',')));
  assert.equal(signatures.size,7);
  for(const actionTime of [0,.34]){
    const f={...state,actionTime};
    const anchor=sampleArcadeFighter(f,1);
    const exhibition=sampleArcadePresentation({...f,rankFootwork:{path:'wheel',bearing:1}},anchor);
    assert.ok(close(anchor.shoulder,exhibition.shoulder)<.001);
    assert.ok(close(anchor.hand,exhibition.hand)<.001);
  }
});

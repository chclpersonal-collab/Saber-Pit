import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
import test from 'node:test';
import assert from 'node:assert/strict';
const sample=f=>{const r=sampleArcadeFighter(f,1);return {r,world:arcadeBladeWorld(f,r)};};
const input={gear:{weapon:'staff'},x:420,y:270,face:0,form:'shii_cho',
  attack:'slash',action:'slash',actionDuration:.61,attackSpec:{contact:.21,offhand:{contact:.30}}};
const heading=(segment,face)=>((segment.tip.x-segment.hand.x)*Math.cos(face)+(segment.tip.y-segment.hand.y)*Math.sin(face));
test('fixed staff ends clearly take turns leading attacks at both exact contact beats',()=>{
  for(const face of [0,1.1,1.6,2.2,3.14,4.72]){
    for(const lead of ['primary','rear']){
      const f={...input,face,staffLead:lead};
      const first=sample({...f,actionTime:.21}).world, second=sample({...f,actionTime:.30}).world;
      const leadIndex=lead==='rear'?1:0;
      assert.equal(first.blades[0].id,'main');assert.equal(first.blades[1].id,'rear');
      assert.ok(heading(first.blades[leadIndex],face)>42);
      assert.ok(heading(second.blades[1-leadIndex],face)>42);
      assert.ok(heading(first.blades[1-leadIndex],face)<-42);
    }
  }
});
test('rear-led shaft remains linked through every sampled frame and uses a distinct body transfer',()=>{
  const rear={...input,staffLead:'rear'};
  let last=null;
  for(let i=0;i<121;i++){
    const next=sample({...rear,actionTime:i*.005});
    const [a,b]=next.world.blades;
    const u=[a.tip.x-a.hand.x,a.tip.y-a.hand.y],v=[b.tip.x-b.hand.x,b.tip.y-b.hand.y];
    assert.ok(Math.abs(u[0]+v[0])<1e-6&&Math.abs(u[1]+v[1])<1e-6);
    if(last)assert.ok(next.world.blades.every((part,j)=>Math.hypot(part.tip.x-last.blades[j].tip.x,part.tip.y-last.blades[j].tip.y)<14));
    last=next.world;
  }
  const f=sample({...input,staffLead:'primary',actionTime:.21}).r;
  const r=sample({...rear,actionTime:.21}).r;
  assert.ok(r.torsoTurn < f.torsoTurn-.4);
  assert.ok(r.lean > f.lean+2);
});

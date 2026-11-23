import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
const f={action:'free_hand',technique:'unarmed_palm',attack:'unarmed_palm',attackSpec:{freeHand:true,contact:.22},
 actionDuration:.56,form:'juyo',x:300,y:350,face:.25};
const pose=(base,t)=>{const r=sampleArcadeFighter({...base,actionTime:t},2);return {r,w:arcadeBladeWorld(base,r)};};
const dot=(a,b,c)=>Math.hypot(a.x-b.x,a.y-b.y);
test('off-hand action leaves the blade held and staff free palm returns to its shaft',()=>{
 for(const weapon of ['single','staff']){
  const q={...f,gear:{weapon}}, entry=pose(q,0), mid=pose(q,.22), done=pose(q,.56);
  assert.equal(mid.r.freeHandAction,true);assert.equal(mid.r.freeHandExtension,1);
  assert.ok(dot(mid.w.freeHand,mid.w.hand)>22);
  assert.ok(mid.w.freeHand.x>entry.w.freeHand.x+24);
  assert.ok(dot(mid.w.tip,mid.w.hand)>40);
  assert.equal(mid.r.trail,0);
  if(weapon==='staff'){
    const [a,b]=mid.w.blades;
    assert.ok(Math.abs((a.tip.x-a.hand.x)+(b.tip.x-b.hand.x))<1e-7);
    assert.ok(Math.abs((a.tip.y-a.hand.y)+(b.tip.y-b.hand.y))<1e-7);
    const rest=arcadeBladeWorld(q,sampleArcadeFighter({...q,action:'idle'},2));
    assert.ok(dot(done.w.freeHand,rest.freeHand)<2);
  }
 }
});
test('occupied dual blades and unflagged state do not open the free palm',()=>{
 for(const q of [{...f,gear:{weapon:'dual'}},{...f,gear:{weapon:'single'},attackSpec:{contact:.22}}]){
  const a=pose(q,.22);
  assert.equal(a.r.freeHandAction,false);
  assert.equal(a.r.freeHandExtension,0);
 }
});

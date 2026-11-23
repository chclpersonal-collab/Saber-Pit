import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
import test from 'node:test';
import assert from 'node:assert/strict';
const families=['cut','sweep','thrust','screen','rise','vault','return','cast'];
const setup={form:'shii_cho',face:.2,x:350,y:260,action:'slash',actionDuration:.72,attackSpec:{contact:.26}};
const sample=(f,time)=>{const rig=sampleArcadeFighter({...f,actionTime:time},1);return {rig,world:arcadeBladeWorld(f,rig)};};
const n=v=>Math.round(v*10);
test('whole-body chamber and recovery discriminate even when sharing the same base action',()=>{
 for(const gear of [{weapon:'single'},{weapon:'dual',grip:'backhand'},{weapon:'staff'}]){
   const chamber=new Set(), carry=new Set();
   for(const attackFamily of families){
     const f={...setup,gear,attackFamily};
     for(const [time,clip] of [[.13,chamber],[.46,carry]]){
       const {rig,world}=sample(f,time);
       clip.add([rig.lean,rig.bend,rig.wide,rig.torsoTurn,rig.hand.y,world.tip.x,world.tip.y].map(n).join(':'));
     }
     assert.deepEqual(sample(f,.26).world,sample({...f,attackFamily:null},.26).world);
   }
   assert.equal(chamber.size,8);assert.equal(carry.size,8);
 }
});
test('seven blade clips remain continuous across authoritative 120hz stance and contact steps',()=>{
 for(const weapon of ['single','dual','staff'])for(const attackFamily of families.slice(0,-1)){
    const f={...setup,gear:{weapon},attackFamily}, frames=[];
    for(let i=0;i<=86;i++)frames.push(sample(f,i/120).world.tip);
    const gaps=frames.slice(1).map((p,i)=>Math.hypot(p.x-frames[i].x,p.y-frames[i].y));
    assert.ok(Math.max(...gaps)<24,weapon+'/'+attackFamily+' '+Math.max(...gaps));
 }
});

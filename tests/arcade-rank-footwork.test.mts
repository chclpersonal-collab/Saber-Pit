import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,ARCADE_RANK_FOOTWORK,arcadeRankFootworkFor,ARCADE_ATTACKS} from '../dist/arcade-engine.js';
import {SOLDIER_GRADES} from '../dist/progression.js';

const dt=1/120;
const grade=i=>SOLDIER_GRADES[i].label??SOLDIER_GRADES[i].grade??SOLDIER_GRADES[i];
function fixture(index,form='makashi'){
 const s=createArcade({form,seed:31,terrain:'underpit',startingRanks:[grade(index),grade(index)]});
 const [p,e]=s.fighters;Object.assign(p,{x:445,y:320,face:0});Object.assign(e,{x:675,y:320,face:Math.PI,action:'stagger',actionDuration:60,think:300});
 return {s,p,e};
}
test('rank-gated footwork adds seven actual movement patterns without removing the normal low-rank dash',()=>{
 let prev=0;
 for(let i=0;i<15;i++){
   const n=arcadeRankFootworkFor(i).length;
   assert.ok(n>=prev);prev=n;
 }
 assert.equal(arcadeRankFootworkFor(0).length,0);
 assert.equal(arcadeRankFootworkFor(14).length,7);
 const paths=[];
 for(const move of ARCADE_RANK_FOOTWORK){
   const cmd={technique:'footwork:'+move.id,aimX:675,aimY:320};
   let {s,p}=fixture(move.minRank-1);
   stepArcade(s,dt,cmd);assert.equal(p.rankFootwork,undefined);
   ({s,p}=fixture(move.minRank));
   stepArcade(s,dt,cmd);
   assert.equal(p.rankFootwork.id,move.id);assert.equal(p.invuln,0);assert.equal(p.attack,null);
   assert.ok(p.energy<100-move.cost+1);
   const trace=[];
   for(let i=0;p.rankFootwork&&i<80;i++){
     stepArcade(s,dt);trace.push([Math.round(p.x),Math.round(p.y)]);
     assert.equal(p.invuln,0);assert.ok(Math.abs(p.face)<.01);
   }
   assert.ok(trace.length>=24);
   assert.ok(Math.hypot(p.x-445,p.y-320)>30);
   paths.push(JSON.stringify(trace));
 }
 assert.equal(new Set(paths).size,7);
 const {s,p}=fixture(0);stepArcade(s,dt,{x:1,dash:true});
 assert.equal(p.action,'dash');assert.equal(p.invuln,.115);
});
test('incorrect footwork read is punishable by a real incoming blade',()=>{
 const {s,p,e}=fixture(14);e.x=515;
 stepArcade(s,dt,{technique:'footwork:return_step',aimX:e.x,aimY:e.y});
 const spec=ARCADE_ATTACKS.slash;
 Object.assign(e,{attack:'slash',attackSpec:spec,action:'slash',actionTime:spec.contact-.001,actionDuration:spec.duration,contact:false});
 stepArcade(s,dt);
 assert.ok(s.events.some(event=>event.kind==='hit'&&event.targetId===p.id));
 assert.equal(p.rankFootwork,null);assert.equal(p.action,'stagger');
});

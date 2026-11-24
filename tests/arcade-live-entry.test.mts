import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const dt=1/120;
const difference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function match(liveEntry){
 const g=createArcade({mode:'duel',seed:351,form:'shii_cho',terrain:'underpit',weaponFlow:true,styleChoreo:true,styleTravel:true,
   continuousCombat:true,activeFootwork:true,arenaCuts:true,peasantMotion:true,stanceFlow:true,repertoireSupport:true,liveEntry,
   teamForms:[['shii_cho'],['soresu']],startingRanks:['SSS+V','SSS+V'],teamSizes:[1,1],chessStyles:['queen','none']});
 const [f,e]=g.fighters;
 Object.assign(f,{x:500,y:310,face:0});
 Object.assign(e,{x:690,y:310,face:Math.PI,think:999,action:'stagger',actionDuration:40});
 return {g,f};
}
test('first slash starts while moving, steers through a fractional angle and cannot track after release',()=>{
 const {g,f}=match(true);
 for(let i=0;i<25;i++)stepArcade(g,dt,{x:0,y:.9,aimX:700,aimY:310});
 assert.equal(f.action,'run');
 const aim=(a)=>({aimX:f.x+Math.cos(a)*100,aimY:f.y+Math.sin(a)*100});
 const before=f.face;
 stepArcade(g,dt,{...aim(.588),y:.9,strike:true});
 assert.equal(f.attack,'slash');
 const started=g.events.find(e=>e.contact>0&&e.fighterId===f.id);
 assert.ok(started?.entryKind);
 assert.equal(f.poseFrom.kind,'live_entry');
 assert.ok(difference(f.face,before)<.13);
 let individualSteps=0,previous=f.face;
 while(f.attack&&!f.contact){
   stepArcade(g,dt,{...aim(.712),y:.9});
   const change=difference(previous,f.face);if(change>1e-5)individualSteps++;
   assert.ok(change<.13);
   previous=f.face;
 }
 assert.ok(individualSteps>=3);
 const released=f.face;
 for(let i=0;i<6;i++)stepArcade(g,dt,aim(-1.13));
 assert.ok(difference(released,f.face)<1e-8);
});
test('old battle versions do not opt in to live entries',()=>{
 const {g,f}=match(false);
 for(let i=0;i<25;i++)stepArcade(g,dt,{y:.9,aimX:700,aimY:310});
 stepArcade(g,dt,{y:.9,strike:true,aimX:665,aimY:345});
 assert.equal(f.attack,'slash');
 assert.notEqual(f.poseFrom.kind,'live_entry');
 assert.equal(f.liveAim,undefined);
});

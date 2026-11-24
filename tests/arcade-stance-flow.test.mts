import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

const dt=1/120;
function fixture(on,mode='duel'){
 const g=createArcade({mode,seed:351,form:'ataru',terrain:'underpit',weaponFlow:true,styleChoreo:true,styleTravel:true,
   continuousCombat:true,activeFootwork:true,arenaCuts:true,peasantMotion:true,stanceFlow:on,repertoireSupport:true,
   teamForms:[['ataru'],['soresu']],startingRanks:['SSS+V','SSS+V'],teamSizes:[1,1],chessStyles:['queen','bishop']});
 const [f,e]=g.fighters;
 Object.assign(f,{x:500,y:310,face:0});
 Object.assign(e,{x:625,y:310,face:Math.PI,think:999,action:'stagger',actionDuration:40});
 return {g,f,e};
}
function drill(on,route){
 const {g,f}=fixture(on);
 for(let i=0;i<140;i++){
  const strike=route==='air'?f.airPhase==='airborne'&&f.airProgress>.23:f.airPhase==='landing';
  stepArcade(g,dt,{aimX:625,aimY:310,x:i===0?-.35:0, jump:i===0,strike});
  if(f.attack)return {g,f};
 }
 return {g,f};
}
test('actual floor-level landing can start a normal cut without a stand-up reset',()=>{
 const {f}=drill(true,'floor');
 assert.equal(f.attack,'slash');
 assert.equal(f.poseFrom.body.airPhase,'landing');
 assert.equal(f.airHeight,0);
 assert.ok(f.poseFrom.body.bend>5&&f.attackSpec.contact>=.12);
 assert.equal(f.invuln,0);
 assert.equal(drill(false,'floor').f.attack,null);
});
test('backward jump keeps the cut attached to the real airborne pose',()=>{
 const {g,f}=drill(true,'air');
 assert.ok(g.events.some(e=>e.kind==='jump'));
 assert.equal(f.airPhase,'airborne');
 assert.equal(f.poseFrom.body.airPhase,'airborne');
 assert.ok(f.airHeight>8&&f.attackSpec.contact>0);
 assert.ok(Math.abs(f.face)<1.2,'keeps weapon aimed toward the rival instead of turning away with travel');
});
test('a stagger is not a floor attack and does not gain invulnerability',()=>{
 const {g,f}=fixture(true);
 f.action='stagger';f.actionDuration=.4;
 for(let i=0;i<12;i++)stepArcade(g,dt,{strike:true,aimX:625,aimY:310});
 assert.equal(f.attack,null);
 assert.equal(f.invuln,0);
});

test('uncontrolled fighters pick floor-level and in-flight strikes in a real squad fight',()=>{
 const g=createArcade({mode:'watch',seed:139,limit:45,terrain:'underpit',teamSizes:[3,3],
  teamForms:[['ataru','djem_so','juyo'],['niman','ataru','shii_cho']],startingRanks:['SSS+V','SSS+V'],
  styleChoreo:true,peasantMotion:true,activeFootwork:true,styleTravel:true,repertoireSupport:true,anticipatingCombat:true,
  continuousCombat:true,weaponFlow:true,arenaCuts:true,circuitCuts:true,ratingSkill:true,matchGoalPlanning:true,
  exchangeVariety:true,fluidFootwork:true,stanceFlow:true});
 let low=0,air=0;const seen=new Set();
 for(let i=0;i<5400&&g.phase==='playing'&&(!low||!air);i++){
  stepArcade(g,dt);
  for(const f of g.fighters){
   if(!f.attack||seen.has(f.attackSerial))continue;
   seen.add(f.attackSerial);
   if(f.poseFrom?.body?.airPhase==='landing'){
    assert.equal(f.airHeight,0);
    assert.ok(f.attackSpec.contact>0);
    low++;
   }
   if(f.poseFrom?.body?.airPhase==='airborne')air++;
  }
 }
 assert.ok(low>0&&air>0);
});

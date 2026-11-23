import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {activeClashEmitters} from '../dist/arcade-clashes.js';
import {arcadeBladeWorld,sampleArcadeFighter} from '../dist/arcade-fighters.js';
const dt=1/120;
const step=(s,n,input={})=>{for(let i=0;i<n;i++)stepArcade(s,dt,input);};
function arranged(trailingEnemy=true){
  const terrain='underpit',s=createArcade({form:'makashi',seed:51,terrain,mode:'squad',
    teamSizes:[1,trailingEnemy?2:1],startingSaberWeapon:['staff','single'],teamForms:['makashi','soresu'],rule:'control'});
  const [p,front,back]=s.fighters;
  const position=()=>{
    Object.assign(p,{x:550,y:310,face:0,vx:0,vy:0,kx:0,ky:0});
    for(const [i,f] of [front,back].entries())if(f)Object.assign(f,{x:550+(i===0?61:-61),y:310,face:i===0?Math.PI:0,
      vx:0,vy:0,kx:0,ky:0,think:999,action:'stagger',actionTime:0,actionDuration:30});
  };
  position();return {s,p,front,back,position};
}
test('staff rotates true forward and back lanes between physical ends without double-tagging a body',()=>{
  const {s,p,front,back,position}=arranged();
  for(const [lead,trail] of [['primary','rear'],['rear','primary'],['primary','rear']]){
    position();
    const cut=s.eventId;
    step(s,1,{strike:true,aimX:front.x,aimY:front.y});
    assert.equal(p.staffLead,lead);assert.equal(p.attackSpec.blade,lead);
    assert.equal(p.attackSpec.leadBlade,lead==='primary'?'main':'rear');
    assert.equal(p.attackSpec.offhand.blade,trail);
    assert.equal(p.attackSpec.backLane,false);assert.equal(p.attackSpec.offhand.backLane,true);
    const swings=p.stats.saberSwings;
    step(s,Math.ceil(p.attackSpec.contact/dt)+1);
    const hits=s.events.filter(e=>e.id>cut&&e.kind==='hit'&&e.fighterId===p.id);
    assert.deepEqual(hits.map(e=>[e.targetId,e.blade,e.backLane]),[[front.id,lead,false],[back.id,trail,true]]);
    assert.equal(p.stats.saberSwings,swings);
    step(s,100);
  }
  assert.equal(p.moves.staff_primary_hit,3);assert.equal(p.moves.staff_rear_hit,3);
  assert.equal(p.stats.saberHits,6);assert.equal(p.stats.saberLanded,3);
});
test('rear-first staff attacks can be chained from a real preceding release',()=>{
  const {s,p,front}=arranged(false);
  step(s,1,{strike:true,aimX:front.x,aimY:front.y});
  step(s,26);step(s,1,{strike:true,aimX:front.x,aimY:front.y});
  for(let i=0;i<50&&p.chainDepth<2;i++)step(s,1);
  assert.equal(p.chainDepth,2);assert.equal(p.staffLead,'rear');
  assert.ok(p.poseFrom?.hand&&p.poseFrom?.offhand?.hand);
  assert.equal(p.poseFrom.kind,'chain');
  assert.equal(p.attackSpec.blade,'rear');
});

test('rear-first physical clash uses the same world emitter as the rendered shaft',()=>{
  const {s,p,front,position}=arranged(false);
  step(s,1,{strike:true,aimX:front.x,aimY:front.y});step(s,110);position();
  step(s,1,{strike:true,aimX:front.x,aimY:front.y});
  p.actionTime=p.attackSpec.contact-.015;
  const world=arcadeBladeWorld(p,sampleArcadeFighter(p,s.time));
  p.offhandContact=true;
  const blades=activeClashEmitters(p,s.time);
  assert.deepEqual(blades.map(b=>b.bladeId),['rear']);
  assert.deepEqual(blades[0].hand,world.offhand.hand);assert.deepEqual(blades[0].tip,world.offhand.tip);
  p.contact=true;p.offhandContact=false;
  assert.deepEqual(activeClashEmitters(p,s.time).map(b=>b.bladeId),['primary']);
});

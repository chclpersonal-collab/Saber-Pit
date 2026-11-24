import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {activeClashEmitters} from '../dist/arcade-clashes.js';
const tick=1/120;
const swing=(s,target)=>stepArcade(s,tick,{strike:true,aimX:target.x,aimY:target.y});
const advance=(s,t)=>{for(let i=0;i<t;i++)stepArcade(s,tick);};
function fixture(weapon,grip,rank='A',flow=true,withRear=false){
  const s=createArcade({weaponFlow:flow,form:'shii_cho',mode:'squad',teamSizes:[1,withRear?2:1],
    startingRanks:[rank,rank],startingSaberWeapon:[weapon,'single'],startingSaberGrip:[grip,'forward'],rule:'control',seed:43});
  const [p,front,rear]=s.fighters;
  Object.assign(p,{x:550,y:300,face:0});
  for(const [f,x,face] of [[front,610,Math.PI],[rear,490,0]])if(f)
    Object.assign(f,{x,y:300,face,action:'stagger',actionDuration:60,think:100});
  return {s,p,front,rear};
}
test('flow is opt-in and physical single-grip tradeoffs and rank recovery remain distinct',()=>{
  const forward=fixture('single','forward','F'),reverse=fixture('single','backhand','F'),master=fixture('single','backhand','SSS+V');
  const archived=fixture('single','backhand','F',false);
  for(const {s,p,front} of [forward,reverse,master,archived]){swing(s,front);assert.equal(p.weaponFlow,s.config.weaponFlow);}
  assert.ok(reverse.p.attackSpec.reach<forward.p.attackSpec.reach);
  assert.ok(reverse.p.attackSpec.contact<forward.p.attackSpec.contact);
  assert.ok(reverse.p.attackSpec.duration<archived.p.attackSpec.duration);
  assert.ok(master.p.attackSpec.duration<reverse.p.attackSpec.duration);
  assert.equal(reverse.p.poseFrom.kind,'weapon_flow');assert.equal(archived.p.poseFrom,null);
  assert.ok(reverse.p.poseEntryDuration<reverse.p.attackSpec.contact*.53);
});
test('dual calls separate live blade windows and two actual contacts',()=>{
 for(const grip of ['forward','backhand']){
   const {s,p,front}=fixture('dual',grip);swing(s,front);
   const spec=p.attackSpec;
   assert.ok(spec.offhand.contact-spec.contact>=.059&&spec.offhand.contact-spec.contact<.10);
   const blades=new Set();
   for(let i=0;i<55;i++){
     for(const b of activeClashEmitters(p,s.time))blades.add(b.bladeId);
     stepArcade(s,tick);
   }
   assert.deepEqual([...blades],['primary','offhand']);
   const hits=s.events.filter(e=>e.kind==='hit'&&e.fighterId===p.id);
   assert.deepEqual(hits.map(e=>e.blade),['primary','offhand']);
   assert.ok(hits[1].time-hits[0].time>=.058);
 }
});
test('staff uses actual opposing ends and alternates lead without duplicate victim hits',()=>{
 const {s,p,front,rear}=fixture('staff','forward','A',true,true);
 for(const [wave,expected] of [['primary','rear'],['rear','primary']].entries()){
   for(const [f,x] of [[p,550],[front,610],[rear,490]])Object.assign(f,{x,y:300,kx:0,ky:0,vx:0,vy:0});
   swing(s,front);
   assert.equal(p.attackSpec.blade,expected[0]);
   assert.equal(p.attackSpec.offhand.contact,p.attackSpec.contact);
   const last=s.eventId;advance(s,76);
   const hits=s.events.filter(e=>e.id>last&&e.kind==='hit'&&e.fighterId===p.id);
   assert.deepEqual(hits.map(e=>[e.blade,e.targetId]),[[expected[0],front.id],[expected[1],rear.id]]);
   assert.equal(p.stats.saberSwings,wave+1);
 }
});

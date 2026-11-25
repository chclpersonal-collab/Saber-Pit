import assert from 'node:assert/strict';
import test from 'node:test';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {normalizeArcadeGear} from '../dist/arcade-loadouts.js';
import {sampleOrbitSabers} from '../dist/arcade-orbit-sabers.js';
import {activeClashEmitters} from '../dist/arcade-clashes.js';
import {normalizeBattleHero} from '../dist/arcade-heroes.js';

const acquire=(opts={})=>{
 const g=createArcade({mode:'duel',rule:'control',seed:17,saberOnly:true,startingSaberWeapon:['orbit','single'],...opts});
 const [f,o]=g.fighters;
 Object.assign(f,{x:400,y:380,face:0});Object.assign(o,{x:482,y:380,face:Math.PI,think:99,action:'stagger',actionDuration:20});
 return {g,f,o};
};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
test('Traya loadout is opt-in and has exactly three detached moving emitters',()=>{
 const opts=normalizeArcadeGear({startingSaberWeapon:['orbit'],startingSaberGrip:['backhand'],startingDualPhase:[true]});
 assert.deepEqual(opts.startingSaberWeapon,['orbit','single']);assert.deepEqual(opts.startingSaberGrip,['forward','forward']);
 assert.deepEqual(opts.startingDualPhase,[false,false]);
 assert.equal(normalizeBattleHero({id:'hero-9',name:'Asha',weapon:'orbit'})?.weapon,'orbit');
 const {f}=acquire();assert.equal(f.gear.bladeCount,3);
 let prior=sampleOrbitSabers(f,0);
 assert.equal(prior.length,3);const start=prior;
 for(let i=1;i<=420;i++){
   const t=i/120,cur=sampleOrbitSabers(f,t),reduced=sampleOrbitSabers(f,t,true);
   for(let j=0;j<3;j++){
     assert.ok(distance(cur[j].hand,prior[j].hand)<1);
     assert.ok(distance(cur[j].tip,prior[j].tip)<2);
     assert.ok(Math.abs(distance(cur[j].hand,cur[j].tip)-38)<.0001);
     assert.deepEqual(cur[j].hand,reduced[j].hand);assert.deepEqual(cur[j].tip,reduced[j].tip);
   }
   prior=cur;
 }
 assert.ok(start.every((blade,i)=>distance(blade.hand,prior[i].hand)>6));
 assert.deepEqual(activeClashEmitters(f,0),[]);
});
test('light attacks release one blade; heavy attack telegraphs and releases three; single target cannot be triple-hit',()=>{
 for(const heavy of [false,true]){
   const {g,f,o}=acquire();
   const aim={aimX:o.x,aimY:o.y};
   stepArcade(g,1/120,{...aim,...(heavy?{heavy:true}:{strike:true})});
   assert.ok(f.attackSpec?.orbit);
   assert.ok(Boolean(f.attackSpec.orbitThird)===heavy);
   const live=new Set<string>();
   let prior=sampleOrbitSabers(f,g.time);
   for(let i=0;i<154;i++){
     const next=sampleOrbitSabers(f,g.time);
     for(const blade of activeClashEmitters(f,g.time)){
       const painted=next.find(p=>p.id===blade.bladeId)!;
       live.add(blade.bladeId);assert.deepEqual(blade.hand,painted.hand);assert.deepEqual(blade.tip,painted.tip);
     }
     for(let j=0;j<3;j++){
       assert.ok(distance(next[j].hand,prior[j].hand)<19);
       assert.ok(distance(next[j].tip,prior[j].tip)<25);
     }
     prior=next;
     stepArcade(g,1/120,aim);
   }
   assert.deepEqual([...live],heavy?['primary','offhand','orbit_third']:['primary']);
   const hits=g.events.filter(e=>e.kind==='hit'&&e.fighterId===f.id);
   assert.equal(hits.length,1);
 }
});
test('a defending fighter can parry the Orbit release; a sideways rival is not struck by idle blades',()=>{
 const {g,f,o}=acquire();
 Object.assign(o,{x:484,y:380,action:'guard',actionTime:.20,parryTime:.55,guardBearing:Math.PI,guardDirected:true,guardLane:'center'});
 const aim={aimX:o.x,aimY:o.y};
 stepArcade(g,1/120,{...aim,heavy:true});
 for(let i=0;i<112;i++){
   if(f.attackSpec?.orbit&&!f.contact&&f.attackSpec.contact-f.actionTime<.09)o.parryTime=.10;
   stepArcade(g,1/120,aim);
 }
 assert.ok(g.events.some(e=>e.kind==='parry'));
 assert.ok(!g.events.some(e=>e.kind==='slash'&&e.offhand&&e.fighterId===f.id));
 const {g:idle,f:idleOwner,o:rival}=acquire();
 Object.assign(rival,{x:idleOwner.x,y:idleOwner.y+44});
 for(let i=0;i<180;i++)stepArcade(idle,1/120,{});
 assert.equal(idleOwner.stats.saberHits,0);
});

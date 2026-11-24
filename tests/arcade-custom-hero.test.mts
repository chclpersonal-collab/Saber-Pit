import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

const hero={id:'arena-hero',name:'Arena Hero',form:'makashi',weapon:'staff'};
const dt=1/120;
function surround(flag,withHero=true){
 const s=createArcade({mode:'watch',customHeroTactics:flag,form:'makashi',teamSizes:[1,3],terrain:'underpit',
   startingRanks:['SSS+V','SSS+V'],heroLineup:withHero?{'0-0':hero}:undefined});
 const [h,a,b,c]=s.fighters;
 Object.assign(h,{x:530,y:330,face:0,think:10});
 for(const [f,x,y] of [[a,655,330],[b,570,210],[c,570,450]])Object.assign(f,{x,y,action:'stagger',actionDuration:6,think:3});
 return {s,h};
}
test('opt-in Saved Hero takes an actual unobstructed early exit with normal feet',()=>{
 const enabled=surround(true),plain=surround(false),regular=surround(true,false);
 for(const {s,h} of [enabled,plain,regular]){
   for(let i=0;i<40;i++){
     stepArcade(s,dt);
     assert.equal(h.invuln,0);assert.notEqual(h.action,'dash');
   }
 }
 const exits=enabled.s.events.filter(e=>e.kind==='hero_reposition');
 assert.equal(exits.length,1);assert.ok(exits[0].destinationX<exits[0].x);
 assert.ok(enabled.h.x<plain.h.x-24);
 assert.ok(!plain.s.events.some(e=>e.kind==='hero_reposition'));
 assert.ok(!regular.s.events.some(e=>e.kind==='hero_reposition'));
});
test('wall in exit lane makes Hero stay out of that lane, never clip',()=>{
 const {s,h}=surround(true);
 s.terrain.solids.push({kind:'wall',x:468,y:242,width:38,height:188});
 for(let i=0;i<40;i++)stepArcade(s,dt);
 assert.ok(h.x>=506+h.radius-.001);
 const exits=s.events.filter(e=>e.kind==='hero_reposition');
 assert.ok(exits.every(e=>e.destinationX>=506+h.radius));
});
test('guard-aware opt-in Tràkata remains honest, optional, and blockable',()=>{
 for(const customHeroTactics of [false,true]){
   const s=createArcade({mode:'duel',customHeroTactics,form:'soresu',startingRanks:['SSS+V','SSS+V'],heroLineup:{'1-0':hero}});
   const [p,h]=s.fighters;Object.assign(p,{x:460,y:330,face:0});Object.assign(h,{x:552,y:330,face:Math.PI,think:10,eliteReady:20});
   for(let i=0;i<120;i++)stepArcade(s,dt,{guard:true,aimX:h.x,aimY:h.y});
   const off=s.events.filter(e=>e.kind==='trakata_off');
   assert.equal(off.length,customHeroTactics?1:0);
   if(customHeroTactics){
     assert.ok(off[0].time>=.18);
     assert.ok(s.events.some(e=>e.kind==='trakata_on'&&!e.interrupted));
     assert.ok(p.stats.blocks>0);assert.equal(h.stats.saberHits,0);
   }
 }
});
test('advanced opponent routes commit actual attacks only after opt-in and observed transitions',()=>{
 for(const advancedArena of [false,true]){
   const s=createArcade({mode:'watch',advancedArena,seed:1,limit:45,terrain:'underpit',
     form:'shii_cho',teamSizes:[1,1],teamForms:[['shii_cho'],['shii_cho']],startingRanks:['SSS+V','SSS+V']});
   const seen=[];let id=0;
   while(s.phase==='playing'){
     stepArcade(s,1/60);
     for(const e of s.events)if(e.id>id){seen.push(e);id=e.id;}
   }
   const routes=seen.filter(e=>e.kind==='advanced_route');
   if(!advancedArena){assert.equal(routes.length,0);continue;}
   assert.deepEqual(new Set(routes.map(e=>e.route)),new Set(['parry','travel','whiff']));
   for(const e of routes){
     const actual=seen.find(entry=>entry.id===e.id-1);
     assert.equal(e.fighterId,actual.fighterId);assert.equal(e.move,actual.technique);assert.ok(actual.contact>0);
     if(e.route==='parry')assert.ok(seen.some(p=>p.kind==='parry'&&p.fighterId===e.fighterId&&p.time<=e.time&&e.time-p.time<.84));
     if(e.route==='travel')assert.ok(seen.some(p=>p.kind==='rank_footwork'&&p.fighterId===e.fighterId&&e.time>=p.time+p.duration-.018&&e.time-p.time<=p.duration+.29));
   }
   assert.ok(s.time>=38.25);
 }
});

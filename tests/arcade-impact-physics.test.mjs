import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

function strike({impactPhysics,heavy=false,guard=false,wall=false}){
 const form='djem_so';
 const terrain=wall?{id:'contact-wall',solids:[{x:525,y:165,width:32,height:350}]}:'underpit';
 const g=createArcade({mode:'duel',form,terrain,seed:4646,startingRanks:['SSS+V','SSS+V'],
   teamForms:[[form],[form]],chessStyles:['king','king'],impactPhysics,
   continuousCombat:true,arenaCuts:true,styleTravel:true,peasantMotion:true,liveEntry:true,
   styleChoreo:true,advancedArena:true,expandedCombat:true,perfectParryStamina:true,circuitCuts:true});
 const [a,b]=g.fighters;
 Object.assign(a,{x:423,y:300,face:0});
 Object.assign(b,{x:498,y:300,face:Math.PI,think:9999,action:guard?'guard':'stagger',actionDuration:90,guardUntil:90,
   guardBearing:Math.PI,guardLane:'center',guardDirected:true,parryTime:0});
 let event,startX,startTick,reaction,stun;
 for(let i=0;i<180;i++){
   if(guard&&!event)Object.assign(b,{action:'guard',actionDuration:90,face:Math.PI,guardBearing:Math.PI,parryTime:0});
   const x=b.x;
   stepArcade(g,1/120,{heavy:heavy&&i===0,strike:!heavy&&i===0,aimX:b.x,aimY:b.y});
   if(wall)assert.ok(b.x<=525,'target must stop at the solid wall');
   if(!event){
     event=g.events.find(e=>e.time===g.time&&(e.kind==='block'?e.fighterId===b.id:e.targetId===b.id)&&['hit','launch','block'].includes(e.kind));
     if(event){startX=x;startTick=i;reaction=b.impactReaction;stun=b.actionDuration;}
   }
   if(event&&i-startTick===19)return {event,travel:b.x-startX,reaction,stun};
 }
 assert.fail('expected real engine contact');
}
test('clean saber contacts separate the bodies without altering the first hit injury or stun',()=>{
 for(const heavy of [false,true]){
   const old=strike({impactPhysics:false,heavy}),next=strike({impactPhysics:true,heavy});
   assert.equal(old.event.kind,'hit');
   assert.equal(next.event.kind,'hit');
   assert.equal(old.event.damage,next.event.damage);
   assert.equal(old.stun,next.stun);
   assert.ok(next.travel>old.travel*1.6);
   assert.ok(Math.cos(next.reaction.bearing)>.98);
 }
 const light=strike({impactPhysics:true}),heavy=strike({impactPhysics:true,heavy:true});
 assert.ok(heavy.travel>light.travel*1.15);
});
test('a guard only yields a small shove and heavy recoil cannot tunnel through walls',()=>{
 const guarded=strike({impactPhysics:true,heavy:true,guard:true});
 const heavy=strike({impactPhysics:true,heavy:true});
 const wall=strike({impactPhysics:true,heavy:true,wall:true});
 assert.equal(guarded.event.kind,'block');
 assert.equal(guarded.event.damage,0);
 assert.ok(guarded.travel<heavy.travel*.8);
 assert.ok(wall.travel<heavy.travel);
});

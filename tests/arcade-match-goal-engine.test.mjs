import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,arcadeMovesFor} from '../dist/arcade-engine.js';
import {arcadeInjuryModifiers} from '../dist/arcade-injuries.js';

const frame=1/120;
function fixture(options={}){
 const s=createArcade({mode:'watch',limit:45,sideElo:[1510,1690],teamSizes:[1,2],terrain:'underpit',
   startingRanks:['SSS+V','SSS+V'],teamForms:[['soresu'],['makashi','djem_so']],...options});
 s.time=38;
 const [a,b,c]=s.fighters;
 Object.assign(a,{x:510,y:335,face:0,think:99});
 a.injuries.torso.front=70;a.injuries.leftLeg.front=40;a.injuryEffects=arcadeInjuryModifiers(a.injuries);
 for(const [f,x,y] of [[b,615,335],[c,624,275]])Object.assign(f,{x,y,face:Math.PI,action:'stagger',actionDuration:50,think:100});
 return {s,a,b,c};
}
const advance=({s},n)=>{for(let i=0;i<n;i++)stepArcade(s,frame);};
test('a losing, outnumbered fighter angles away on foot only in the opt-in watch format',()=>{
 const on=fixture({matchGoalPlanning:true}),off=fixture(),objective=fixture({matchGoalPlanning:true,rule:'control'});
 for(const f of [on,off,objective])advance(f,48);
 const event=on.s.events.find(e=>e.kind==='match_goal');
 assert.equal(event.fighterId,on.a.id);assert.equal(event.previous,'win');assert.equal(event.goal,'draw');
 assert.equal(event.reason,'outnumbered');assert.equal(on.a.matchGoal,'draw');assert.equal(on.a.invuln,0);
 assert.ok(on.a.y>off.a.y+12,'strategy chooses real lateral spacing');
 assert.equal(off.a.matchGoal,undefined);assert.equal(objective.a.matchGoal,undefined);
});
test('a real opening returns a clock-minded fighter to winning intent',()=>{
 const f=fixture({matchGoalPlanning:true});advance(f,35);
 assert.equal(f.a.matchGoal,'draw');
 Object.assign(f.b,{x:590,y:f.a.y,face:Math.PI,exposedUntil:f.s.time+1.5});
 advance(f,40);
 assert.equal(f.a.matchGoal,'win');
 assert.ok(f.s.events.some(e=>e.kind==='match_goal'&&e.fighterId===f.a.id&&e.previous==='draw'&&e.reason==='counter-opening'));
});

test('new circuit cuts use exactly their authored rank gates and only the opt-in repertoire',()=>{
 const cards=arcadeMovesFor('makashi',14,{circuitCuts:true}).filter(c=>c.circuitCut);
 assert.equal(cards.length,2);
 for(const card of cards)for(const [opt,rank,expect] of [[false,'SSS+V',false],[true,'F',false],[true,'SSS+V',true]]){
   const s=createArcade({form:'makashi',circuitCuts:opt,startingRanks:[rank,rank]});
   const [p,e]=s.fighters;Object.assign(p,{x:460,y:310,face:0});Object.assign(e,{x:529,y:310,action:'stagger',actionDuration:60,think:100});
   stepArcade(s,frame,{technique:card.id,aimX:e.x,aimY:e.y});
   assert.equal(s.events.some(x=>x.technique===card.id&&x.contact>0),expect);
 }
});

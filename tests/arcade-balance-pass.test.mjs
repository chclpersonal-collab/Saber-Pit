import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

function exchange(kind,balancePass,withoutOpening=false){
 const duel=kind==='feint', form=duel?'makashi':'juyo',size=duel?1:2;
 const g=createArcade({mode:'watch',seed:12,form,teamForms:[Array(size).fill(form),Array(size).fill('soresu')],
   teamSizes:[size,size],startingRanks:['SSS+V','SSS+V'],balancePass,exchangeVariety:true,arenaCuts:true,
   repertoireSupport:true,weaponFlow:true,continuousCombat:true,anticipatingCombat:true});
 const [a,ally]=g.fighters.filter(f=>f.team===0),[b,c]=g.fighters.filter(f=>f.team===1);
 Object.assign(a,{x:500,y:320,face:0,think:10});
 if(duel)Object.assign(b,{x:593,y:320,face:Math.PI,action:'guard',actionTime:.18,parryTime:0,think:10,decision:'guard',guardUntil:10});
 else{
   Object.assign(ally,{x:260,y:500,think:10});
   Object.assign(b,{x:593,y:292,face:Math.PI,action:'stagger',actionDuration:3});
   Object.assign(c,{x:593,y:withoutOpening?510:348,face:Math.PI,action:'stagger',actionDuration:3});
 }
 const collected=new Map();
 for(let i=0;i<80;i++){
   stepArcade(g,1/120);
   for(const e of g.events)if(e.fighterId===a.id)collected.set(e.id,e);
   if(duel&&withoutOpening&&a.feintFollowup==='ex_mk_false_line')b.x=800;
 }
 return [...collected.values()];
}
const committed=(events,id)=>events.find(e=>e.technique===id&&e.contact>0);
test('Makashi baits an established guard with False Line and aborts when the rival escapes',()=>{
 const id='ex_mk_false_line',real=exchange('feint',true);
 const bait=real.find(e=>e.kind==='feint'&&e.feintFollowup===id);
 const attack=committed(real,id);
 assert.ok(bait&&attack&&bait.id<attack.id);
 assert.equal(committed(exchange('feint',false),id),undefined);
 const escaped=exchange('feint',true,true);
 assert.ok(escaped.some(e=>e.kind==='feint'&&e.feintFollowup===id));
 assert.equal(committed(escaped,id),undefined);
});
test('Juyo uses Crossfire Turn for two distinct reachable targets and lands both hits',()=>{
 const id='ex_jy_crossfire_turn',real=exchange('sweep',true);
 assert.ok(committed(real,id));
 const hit=new Set(real.filter(e=>e.kind==='hit'&&e.technique===id&&e.damage>0).map(e=>e.targetId));
 assert.equal(hit.size,2);
 assert.equal(committed(exchange('sweep',false),id),undefined);
 assert.equal(committed(exchange('sweep',true,true),id),undefined);
});

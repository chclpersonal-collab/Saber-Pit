import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
function pressure(guardCounterplay,{defense='held',rank='SSS+V'}={}){
 const g=createArcade({mode:'duel',teamSizes:[1,1],teamForms:[['djem_so'],['soresu']],form:'djem_so',
   startingRanks:[rank,'SSS+V'],chessStyles:['king','king'],seed:59,guardCounterplay,
   perfectParryStamina:true,arenaCuts:true,circuitCuts:true,exchangeVariety:true,weaponFlow:true,anticipatingCombat:true});
 const [a,b]=g.fighters;
 Object.assign(a,{x:425,y:311,face:0,energy:100});
 Object.assign(b,{x:495,y:311,face:Math.PI,energy:100,think:10000,action:'guard',guardBearing:Math.PI,
   guardDirected:true,guardUntil:300,actionDuration:300,actionTime:.3,parryTime:0});
 let commits=0,blocks=0,cursor=0,releaseAt=null;
 const seen=[];
 for(let t=0;t<460;t++){
   Object.assign(a,{x:425,y:311,kx:0,ky:0});Object.assign(b,{x:495,y:311,kx:0,ky:0});
   if(defense==='reset'&&blocks===2&&releaseAt===null){
     Object.assign(b,{action:'idle',actionTime:0,actionDuration:0,guardUntil:0});releaseAt=t;
   }else if(releaseAt===null||t>=releaseAt+12){
     if(b.action!=='guard')b.actionTime=0;
     Object.assign(b,{action:'guard',actionDuration:300,guardUntil:300,parryTime:defense==='parry'&&blocks>=2?.12:0});
   }
   const input=a.actionDuration===0&&commits<3?
     {technique:['ds_shoulder_cut','ds_shoulder_cut','ds_crushing_reply'][commits++],aimX:b.x,aimY:b.y}:{aimX:b.x,aimY:b.y};
   stepArcade(g,1/120,input);
   for(const e of g.events)if(e.id>cursor){cursor=e.id;seen.push(e);if(e.kind==='block')blocks++;}
   if(commits===3&&a.actionDuration===0)break;
 }
 return {seen,blocks};
}
test('an uninterrupted guard pays one bounded stamina premium, but releasing or timing a fresh parry avoids it',()=>{
 const compare=pressure(false),active=pressure(true);
 assert.equal(compare.blocks,3);assert.equal(active.blocks,3);
 const extra=active.seen.filter(e=>e.kind==='guard_pressure');
 assert.equal(extra.length,1);assert.ok(extra[0].extraStamina>0&&extra[0].extraStamina<=9);
 assert.ok(compare.seen.every(e=>e.kind!=='guard_pressure'));
 for(const defense of ['reset','parry']){
   const attempt=pressure(true,{defense});
   assert.ok(attempt.seen.every(e=>e.kind!=='guard_pressure'));
   if(defense==='parry')assert.ok(attempt.seen.some(e=>e.kind==='parry'));
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const dt=1/120;
function exchange(recoveryFlow){
 const g=createArcade({mode:'duel',seed:17,teamForms:[['shii_cho'],['soresu']],startingRanks:['SSS+V','SSS+V'],
   weaponFlow:true,impactPhysics:true,fluidFootwork:true,recoveryFlow});
 const [a,b]=g.fighters;
 Object.assign(a,{x:450,y:305,face:0});
 Object.assign(b,{x:526,y:305,face:Math.PI,control:true,guardLock:.55});
 stepArcade(g,dt,{heavy:true,aimX:b.x,aimY:b.y});
 b.think=10;
 let stun,unlocked,y,plan;
 for(let i=0;i<220;i++){
   stepArcade(g,dt);
   if(stun===undefined&&b.impactReaction?.kind==='hard'){
     stun=b.actionDuration;b.control=false;
   }
   if(stun!==undefined&&unlocked===undefined&&b.actionDuration===0){unlocked=g.time;y=b.y;}
   if(b.impactRecovery&&!plan)plan={...b.impactRecovery};
   if(unlocked!==undefined&&g.time-unlocked>=.18)return {stun,unlocked,plan,lateral:Math.abs(b.y-y)};
 }
 assert.fail('expected hard hit, full stun and exit');
}
test('an AI fighter uses a real lateral recovery only after the full knockback stun',()=>{
 const prior=exchange(false),recovery=exchange(true);
 assert.equal(prior.stun,recovery.stun);
 assert.equal(prior.unlocked,recovery.unlocked);
 assert.equal(prior.plan,undefined);
 assert.equal(recovery.plan?.kind,'lateral');
 assert.ok(recovery.plan.at>=recovery.unlocked);
 assert.ok(recovery.lateral>=6&&recovery.lateral>prior.lateral*2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
function match(seed,patched,teamSizes=[1,1],ranks=['SSS+V','SSS+V']){
 const g=createArcade({mode:'watch',seed,limit:45,terrain:'underpit',teamSizes,teamForms:[['ataru'],['niman']],startingRanks:ranks,
  styleChoreo:true,peasantMotion:true,activeFootwork:true,styleTravel:true,repertoireSupport:true,anticipatingCombat:true,continuousCombat:true,
  weaponFlow:true,arenaCuts:true,circuitCuts:true,ratingSkill:true,matchGoalPlanning:true,exchangeVariety:true,fluidFootwork:patched});
 let cursor=0;const jumps=new Set();
 for(let i=0;i<5402&&g.phase==='playing';i++){
   stepArcade(g,1/120);
   if(cursor===g.eventId)continue;
   for(const e of g.events)if(e.id>cursor){cursor=e.id;if(e.kind==='jump')jumps.add(e.id);}
 }
 return {jumps:jumps.size,time:g.time,phase:g.phase,kills:g.stats.kills,deaths:g.stats.deaths};
}
test('new AI finds actual jumps in a duel and five-person squad fixture that used to stay grounded',()=>{
 const before=match(351,false),after=match(351,true);
 assert.equal(before.jumps,0);
 assert.ok(after.jumps>=2&&after.time>=before.time);
 const oldSquad=match(139,false,[5,5],['A','A']),newSquad=match(139,true,[5,5],['A','A']);
 assert.ok(newSquad.jumps>oldSquad.jumps+2);
});
test('mobility patch leaves the uneven master trial exact',()=>{
 const sizes=[1,15],ranks=['SSS+V','F'];
 const before=match(693,false,sizes,ranks),after=match(693,true,sizes,ranks);
 assert.deepEqual(after,before);
 assert.equal(after.phase,'won');
});

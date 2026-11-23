import assert from 'node:assert/strict';
import test from 'node:test';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARCADE_TECHNIQUES} from '../dist/arcade-repertoire.js';
const dt=1/120;
const opts={mode:'watch',seed:1069,terrain:'open',teamSizes:[1,1],startingRanks:['SSS+V','SSS+V'],arenaCuts:true,saberOnly:true};
function stage(form,repertoireSupport,seconds){
 const g=createArcade({...opts,teamForms:[form,'soresu'],repertoireSupport});
 const [f,e]=g.fighters;
 f.x=500;f.y=320;f.face=0;f.energy=75;f.think=.27;
 e.x=588;e.y=320;e.face=Math.PI;e.think=.29;e.action='stagger';e.actionDuration=seconds;
 return {g,f,e};
}
test('an existing Djem So or Juyo named heavy becomes a timely real punish, not a generic rename',()=>{
 for(const form of ['djem_so','juyo']){
   const old=stage(form,false,.62),narrow=stage(form,true,.21),open=stage(form,true,.62);
   for(const {g} of [old,narrow,open])stepArcade(g,dt);
   assert.equal(old.f.attack,null);
   assert.notEqual(ARCADE_TECHNIQUES[narrow.f.attack]?.role,'heavy');
   const move=ARCADE_TECHNIQUES[open.f.attack];
   assert.equal(move?.role,'heavy');
   assert.equal(move.form,form);
   assert.equal(open.f.attackSpec.reach,move.reach);
   assert.ok(open.f.attackSpec.contact>=.20&&open.f.attackSpec.contact<open.e.actionDuration);
 }
});
test('habits follow deterministic fighter identity; older behavior opts out',()=>{
 const before=createArcade({...opts,teamForms:['ataru','djem_so']});
 const yes=createArcade({...opts,teamForms:['ataru','djem_so'],repertoireSupport:true});
 const copy=createArcade({...opts,teamForms:['ataru','djem_so'],seed:66,repertoireSupport:true});
 for(const g of [before,yes,copy]){
   g.fighters[0].appearanceSeed=6132;g.fighters[1].appearanceSeed=7307;stepArcade(g,dt);
 }
 assert.ok(before.fighters.every(f=>f.combatHabit===undefined));
 assert.deepEqual(yes.fighters.map(f=>f.combatHabit),copy.fighters.map(f=>f.combatHabit));
 assert.ok(yes.fighters.every(f=>['opening_reader','lane_builder','tempo_keeper'].includes(f.combatHabit)));
});
test('the new AI preference never changes a controlled basic Slash',()=>{
 const old=createArcade({...opts,mode:'duel',teamForms:['juyo','soresu']});
 const yes=createArcade({...opts,mode:'duel',teamForms:['juyo','soresu'],repertoireSupport:true});
 for(const g of [old,yes])stepArcade(g,dt,{strike:true});
 assert.equal(yes.fighters[0].attack,'slash');
 assert.deepEqual(old.fighters[0].attackSpec,yes.fighters[0].attackSpec);
 assert.equal(yes.fighters[0].combatHabit,undefined);
});

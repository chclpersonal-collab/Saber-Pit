import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const flags=Object.fromEntries('perfectParryStamina continuousCombat anticipatingCombat arenaCuts activeFootwork styleTravel repertoireSupport styleChoreo peasantMotion exchangeVariety fluidFootwork eloReads stanceFlow liveEntry impactPhysics recoveryFlow weaponFlow expandedCombat circuitCuts ratingSkill customHeroTactics advancedArena balancePass'.split(' ').map(k=>[k,true]));
function sample(closeChoice){
 const g=createArcade({...flags,closeChoice,mode:'watch',terrain:'underpit',seed:139,limit:45,
   teamSizes:[1,1],startingRanks:['SSS+V','SSS+V'],teamForms:[['shii_cho'],['makashi']],
   chessStyles:['king','bishop'],startingSaberWeapon:['single','dual']});
 const events=[];
 for(let i=0,last=0;i<3000&&g.phase==='playing';i++){
   stepArcade(g,1/120);
   if(g.eventId===last)continue;
   events.push(...g.events.filter(x=>x.id>last));
   last=g.eventId;
 }
 return events;
}
test('Makashi can vary a repeated Wrist Cut in a narrow opening but the reply still uses ordinary defense and contact',()=>{
 const old=sample(false),live=sample(true);
 assert.ok(old.some(e=>e.technique==='mk_wrist_cut'&&e.contact>0));
 assert.ok(old.every(e=>!e.closeAlternate));
 const entries=live.filter(e=>e.closeAlternate==='mk_wrist_cut');
 assert.ok(entries.length>=2&&new Set(entries.map(e=>e.technique)).size>=2);
 assert.ok(entries.every(e=>e.form==='makashi'&&e.contact>0&&e.technique!=='mk_wrist_cut'));
 const picked=new Set(entries.map(e=>e.technique));
 assert.ok(live.some(e=>e.kind==='hit'&&e.damage>0&&picked.has(e.technique)));
 assert.ok(live.some(e=>e.kind==='parry'&&entries.some(a=>a.fighterId===e.targetId&&e.time>a.time&&e.time-a.time<.35)));
});

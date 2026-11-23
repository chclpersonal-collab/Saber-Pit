import assert from 'node:assert/strict';
import test from 'node:test';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const dt=1/120;
const config={mode:'watch',seed:117931,limit:45,terrain:'underpit',teamSizes:[1,1],teamForms:['ataru','soresu'],
  startingRanks:['SSS+V','SSS+V'],chessStyles:['king','none'],continuousCombat:true,anticipatingCombat:true,arenaCuts:true,saberOnly:true};
test('point-blank AI takes a real open strike without waiting for a fresh think tick',()=>{
 const a=createArcade(config),b=createArcade({...config,activeFootwork:true});
 for(const g of [a,b]){
  const [f,e]=g.fighters;f.x=500;f.y=320;e.x=539;e.y=320;f.face=0;e.face=Math.PI;
  f.think=.30; f.eliteReady=1;
  e.action='stagger';e.actionDuration=.30;
  stepArcade(g,dt);
 }
 assert.equal(a.fighters[0].attack,null);
 assert.ok(b.fighters[0].attack);
 const e=b.events.find(e=>e.team===0&&e.contact>0);
 assert.ok(e&&e.contact>.08);
});
test('a point-blank illegal world lane remains illegal',()=>{
 const g=createArcade({...config,activeFootwork:true,chessStyles:['bishop','none']});
 const [f,e]=g.fighters;f.x=500;f.y=320;e.x=539;e.y=320;f.face=0;e.face=Math.PI;
 f.think=.30;f.eliteReady=1;f.chessReviewAt=9;
 e.action='stagger';e.actionDuration=.30;
 stepArcade(g,dt);
 assert.equal(f.stats.saberHits,0);
 assert.equal(f.attack,null);
 assert.ok(Math.abs(f.vy)>0);
});
test('tactical jumps and distinct aerial attacks are real and paced in watched 1v1',()=>{
 const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
 const styles=['king','queen','rook','bishop','knight','pawn'];
 const maps=['underpit','crossroads','zigzag','craterfield'];
 const air=new Set(),kind=new Set();
 for(let i=0;i<forms.length;i++){
   const g=createArcade({...config,teamForms:[forms[i],forms[(i+3)%7]],chessStyles:[styles[i%6],styles[(i+3)%6]],
     terrain:maps[i%4],seed:117931+i*2897,saberOnly:false,activeFootwork:true,weaponFlow:true});
   const jumps=new Map; let last=0;
   while(g.phase==='playing'){
     stepArcade(g,.1);
     for(const e of g.events)if(e.id>last){
       if(e.kind==='jump'){
         const previous=jumps.get(e.fighterId);
         if(previous!==undefined)assert.ok(e.time-previous>=4.49);
         jumps.set(e.fighterId,e.time);kind.add(e.jumpKind);
       }
       if(e.airStrike&&e.contact>0)air.add(e.airStrike);
     }
     last=g.eventId;
   }
 }
 assert.ok(kind.size>=6);
 assert.ok(air.size>=3);
});

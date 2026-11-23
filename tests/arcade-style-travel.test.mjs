import assert from 'node:assert/strict';
import test from 'node:test';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const setup=(style,styleTravel)=>createArcade({mode:'duel',seed:234,teamSizes:[1,1],teamForms:['shii_cho','soresu'],
  startingRanks:['F','F'],chessStyles:[style,'none'],terrain:'open',styleTravel});
const dt=1/120,r=Math.PI/4;
test('every combat style can move freely in all eight test directions',()=>{
 for (const style of ['pawn','rook','bishop','king','queen','knight'])for(let i=0;i<8;i++){
   const g=setup(style,true), old=setup(style,false), x=Math.cos(i*r),y=Math.sin(i*r);
   for(const h of [g,old]){
     const [f,e]=h.fighters; f.x=500;f.y=320;e.x=880;e.y=500;e.action='stagger';e.actionDuration=4;
     for(let j=0;j<16;j++)stepArcade(h,dt,{x,y,aimX:830,aimY:239});
     assert.ok((f.x-500)*x+(f.y-320)*y>3);
   }
   assert.equal(g.fighters[0].styleTravel,true);
   assert.equal(old.fighters[0].styleTravel,undefined);
   assert.deepEqual([g.fighters[0].x,g.fighters[0].y],[old.fighters[0].x,old.fighters[0].y]);
 }
});
function released(style,styleTravel,bearing,heading=bearing){
 const g=setup(style,styleTravel),[f,e]=g.fighters;
 f.x=500;f.y=320;e.x=500+72*Math.cos(bearing);e.y=320+72*Math.sin(bearing);
 f.face=heading;e.face=bearing+Math.PI;e.action='stagger';e.actionDuration=4;
 const aim={aimX:500+72*Math.cos(heading),aimY:320+72*Math.sin(heading)};
 stepArcade(g,dt,{...aim,strike:true});
 f.actionTime=f.attackSpec.contact-dt*.3;stepArcade(g,dt,aim);
 return f.stats.saberLanded;
}
test('Rook and Bishop release on four respective map directions',()=>{
 for(let i=0;i<8;i++){
   assert.equal(released('rook',true,i*r),Number(i%2===0));
   assert.equal(released('bishop',true,i*r),Number(i%2===1));
 }
});
test('new Pawn releases straight ahead from any chosen heading, while old diagonals replay',()=>{
 assert.equal(released('pawn',false,0,0),0);
 assert.equal(released('pawn',false,r,0),1);
 assert.equal(released('pawn',true,r,0),0);
 for(let i=0;i<8;i++)assert.equal(released('pawn',true,i*r),1);
});

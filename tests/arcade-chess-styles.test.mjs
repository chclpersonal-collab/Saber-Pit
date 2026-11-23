import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_CHESS_STYLES,arcadeChessStyleFor,arcadeChessAllowsLane,arcadeChessDesiredBearing,
 arcadeChessMove,arcadeChessPawnStrike,normalizeArcadeChessStyle} from '../dist/arcade-chess-styles.js';

test('Classic is unchanged; Mixed is a stable per-fighter rotation across all six selections',()=>{
 assert.equal(Object.keys(ARCADE_CHESS_STYLES).length,8);
 assert.equal(ARCADE_CHESS_STYLES.none.label,'Classic');
 assert.equal(normalizeArcadeChessStyle('constructor'),'none');
 assert.equal(arcadeChessStyleFor('queen',15,11),'queen');
 const roll=()=>Array.from({length:13},(_,slot)=>arcadeChessStyleFor('mixed',slot,125));
 assert.deepEqual(roll(),roll());assert.equal(new Set(roll().slice(0,6)).size,6);
 const spec={reach:97,arc:.93,cost:23,contact:.235,duration:.611,offhand:{reach:84,arc:.86,contact:.33,blade:'rear'}};
 assert.equal(arcadeChessMove('none',spec),spec);
 const king=arcadeChessMove('king',spec),queen=arcadeChessMove('queen',spec);
 assert.ok(king.reach<spec.reach&&king.arc>spec.arc);
 assert.ok(queen.reach>spec.reach&&queen.arc>spec.arc&&queen.cost===spec.cost);
 assert.ok(king.offhand.reach<spec.offhand.reach&&queen.offhand.reach>spec.offhand.reach);
 for(const tuned of [king,queen]){
   assert.equal(tuned.cost,spec.cost);assert.equal(tuned.contact,spec.contact);assert.equal(tuned.duration,spec.duration);
   assert.equal(tuned.offhand.contact,spec.offhand.contact);assert.equal(tuned.offhand.blade,spec.offhand.blade);
 }
 assert.equal(arcadeChessMove('queen',{...spec,expanded:true}).reach,spec.reach);
});
test('Rook and Bishop geometry is relative to arena axes, including opposing emitter',()=>{
 for(const facing of [0,.2,1.1,Math.PI]){
   assert.equal(arcadeChessAllowsLane('rook',{bearing:Math.PI,face:facing,backLane:true}),true);
   assert.equal(arcadeChessAllowsLane('rook',{bearing:Math.PI/4,face:facing}),false);
   assert.equal(arcadeChessAllowsLane('bishop',{bearing:Math.PI/4,face:facing}),true);
   assert.equal(arcadeChessAllowsLane('bishop',{bearing:Math.PI,face:facing,backLane:true}),false);
 }
 assert.equal(arcadeChessAllowsLane('rook',{bearing:.50,face:.2}),true);
 assert.equal(arcadeChessAllowsLane('bishop',{bearing:Math.PI/4+.53,face:.2}),true);
 const bearing=arcadeChessDesiredBearing('bishop',{bearing:.1,face:.1});
 assert.ok(Math.abs(bearing-Math.PI/4)<1e-8);
 assert.equal(arcadeChessDesiredBearing('none',{bearing:.35}),.35);
});
test('Knight uses actual target facing and has a bounded close front check, not a guard bypass',()=>{
 const front={bearing:0,face:0,targetFace:Math.PI};
 assert.equal(arcadeChessAllowsLane('knight',{...front,distance:60}),false);
 assert.equal(arcadeChessAllowsLane('knight',{...front,distance:48}),true);
 const side={...front,targetFace:Math.PI/2,distance:91};
 assert.equal(arcadeChessAllowsLane('knight',side),true);
 const sought=arcadeChessDesiredBearing('knight',{...front,distance:91});
 assert.ok(arcadeChessAllowsLane('knight',{...front,distance:91,bearing:sought}));
});
test('Pawn attacks narrow forward diagonals and only distinct consecutive commits promote',()=>{
 assert.equal(arcadeChessAllowsLane('pawn',{bearing:0,face:0}),false);
 assert.equal(arcadeChessAllowsLane('pawn',{bearing:Math.PI/4,face:0}),true);
 assert.equal(arcadeChessAllowsLane('pawn',{bearing:-Math.PI/4,face:0}),true);
 assert.equal(arcadeChessAllowsLane('pawn',{bearing:3*Math.PI/4,face:0}),false);
 assert.equal(arcadeChessAllowsLane('pawn',{bearing:0,face:0,promoted:true}),true);
 const add=(state,serial,landed=true,retreated=false)=>arcadeChessPawnStrike(state,{serial,landed,retreated});
 let p=add(undefined,10);assert.equal(p.streak,1);
 p=add(p,10);assert.equal(p.streak,1);
 p=add(p,11,false);assert.equal(p.streak,0);
 p=add(add(p,12),13,true,true);assert.equal(p.streak,0);
 p=add(add(add(p,14),15),16);assert.equal(p.promoted,true);
 p=add(p,17,false,true);assert.equal(p.promoted,true);assert.equal(p.streak,3);
});

test('adaptive choice selects all six pieces from authentic geometry, then respects recovery hysteresis',async()=>{
 const {chooseArcadeChessStyle:choose}=await import('../dist/arcade-chess-styles.js');
 const fromQueen={baseStyle:'queen',currentStyle:'queen',sinceSwitch:3};
 const cases=[
  ['king',{distance:51,bearing:0,targetFace:Math.PI,threat:1,imminent:true}],
  ['queen',{distance:154,bearing:.75,targetFace:Math.PI+.75}],
  ['rook',{distance:128,bearing:0,targetFace:Math.PI}],
  ['bishop',{distance:92,bearing:Math.PI/4,targetFace:Math.PI*1.25}],
  ['knight',{distance:82,bearing:.1,targetFace:Math.PI/2+.1,guarded:true}],
  ['pawn',{distance:55,bearing:Math.PI/4,targetFace:Math.PI*1.25,pawnStreak:1}],
 ];
 for(const [piece,context] of cases){
   assert.equal(choose({...fromQueen,...context}),piece);
   assert.equal(choose({...fromQueen,...context,committed:true}),'queen');
   assert.equal(choose({...fromQueen,...context,sinceSwitch:1.5}),'queen');
 }
 assert.equal(choose({...fromQueen,distance:NaN,bearing:.1}),'queen');
});

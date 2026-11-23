import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

const dt=1/120;
test('only concrete roster pieces override the side picker; old Arena remains neutral',()=>{
 const base={mode:'watch',seed:71,teamSizes:[4,3],chessStyles:['rook','mixed']};
 const original=createArcade(base),different=createArcade({...base,
   fighterChessStyles:[['king','none','mixed','bad'],['pawn',null,'queen']]});
 const old=original.fighters.map(f=>f.chessStyle),actual=different.fighters.map(f=>f.chessStyle);
 assert.deepEqual(actual,['king',old[1],old[2],old[3],'pawn',old[5],'queen']);
 const neutral=createArcade({seed:71}), invalid=createArcade({seed:71,fighterChessStyles:[['none'],['mixed']]});
 for(let i=0;i<120;i++){stepArcade(neutral,dt);stepArcade(invalid,dt);}
 assert.deepEqual(invalid,neutral);
 assert.equal(createArcade({fighterChessStyles:[['bishop']]}).fighters[0].chessStyle,'bishop');
});
test('same-form bots seek distinct style ranges before attacking; Bishop and Knight take a lane',()=>{
 const result={};
 for(const style of ['king','pawn','rook','bishop','queen','knight','none']){
  const s=createArcade({mode:'watch',teamSizes:[1,1],seed:44,terrain:'open',chessStyles:[style,'none'],
    form:'makashi',teamForms:[['makashi'],['makashi']],startingRanks:['F','F']});
  const [a,b]=s.fighters;
  Object.assign(a,{x:450,y:320,face:0,think:100});
  Object.assign(b,{x:565,y:320,face:Math.PI,think:100,action:'stagger',actionDuration:60});
  for(let i=0;i<140;i++)stepArcade(s,dt);
  assert.equal(a.stats.saberSwings,0);
  result[style]={range:Math.hypot(a.x-b.x,a.y-b.y),side:Math.abs(a.y-b.y)};
 }
 assert.ok(result.king.range+19<result.queen.range);
 assert.ok(result.pawn.range+19<result.rook.range);
 assert.ok(result.rook.side<result.knight.side-22);
 assert.ok(result.bishop.side>5);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,sampleArcadeStyleSpin,arcadeBladeWorld,arcadeFeetWorld} from '../dist/arcade-fighters.js';
const fighter=(style,at,extra={})=>({
  x:430,y:295,id:'spin',face:.07,airPhase:'grounded',airHeight:0,alive:true,
  styleTravel:true,chessStyle:style,form:'shii_cho',action:'sweep',actionTime:at,actionDuration:.85,
  attack:'sweep',attackSpec:{contact:.34,duration:.85,motion:{path:'arc',chamber:1.55,finish:-1.1}},
  ...extra,
});
const spin=(f,reducedMotion=false)=>{const r=sampleArcadeFighter(f,0,{reducedMotion});return [r,sampleArcadeStyleSpin(f,r)];};

test('a compact King turn passes through faster and travels less than Queen flowing rotation',()=>{
  const max=(style)=>{const deltas=[],turns=[],cloth=[];let last=0;
    for(let i=0;i<60;i++){
      const t=.34+i/120, f=fighter(style,t),[raw,art]=spin(f);
      if(!art.styleSpin)continue;
      last=t;deltas.push(Math.hypot(art.shoulder.x-raw.shoulder.x,art.shoulder.y-raw.shoulder.y));
      turns.push(Math.abs(art.styleSpin.yaw));cloth.push(art.styleSpin.cloth);
    }
    return {last,delta:Math.max(...deltas),turn:Math.max(...turns),cloth:Math.max(...cloth)};
  };
  const king=max('king'),queen=max('queen');
  assert(king.last+.14<queen.last);
  assert(king.delta>7&&queen.delta>king.delta*1.25);
  assert(queen.turn>king.turn*1.5&&queen.cloth>king.cloth*3);
});

test('exact follow-through geometry never moves either saber emitter, glove, or foot',()=>{
  for(const [weapon,style] of [['staff','king'],['dual','queen'],['single','queen']]){
    for(const t of [.39,.43,.50,.57,.64]){
      const f=fighter(style,t,{gear:{weapon,grip:'forward'}});
      const [raw,art]=spin(f);
      const pick=r=>arcadeBladeWorld(f,r).blades;
      assert.deepEqual(pick(art),pick(raw));
      assert.deepEqual(arcadeFeetWorld(f,art),arcadeFeetWorld(f,raw));
      assert.equal(art.hand,raw.hand);assert.equal(art.backHand,raw.backHand);
      assert.equal(art.waist,raw.waist);assert.equal(art.roll,raw.roll);
    }
  }
});

test('only opted-in grounded broad saber follow-through receives style side-pose',()=>{
  for(const [f,motion] of [
    [fighter('queen',.32),false],[fighter('king',.73),false],[fighter('king',.47,{styleTravel:false}),false],
    [fighter('rook',.47),false],[fighter('queen',.47,{saberOff:true}),false],
    [fighter('queen',.47,{airPhase:'airborne',airHeight:13}),false],[fighter('queen',.47,{action:'force'}),false],
    [fighter('queen',.47,{action:'rush'}),false],[fighter('queen',.47),true],
  ]){
    const [raw,art]=spin(f,motion);assert.equal(art,raw);
  }
  const [_,art]=spin(fighter('rook',.47,{attackSpec:{contact:.34,duration:.85,chessStyle:'queen'}}));
  assert.equal(art.styleSpin.style,'queen');
});

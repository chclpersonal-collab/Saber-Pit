import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,arcadeBladeWorld,arcadeFeetWorld} from '../dist/arcade-fighters.js';
import {sampleChessSwing} from '../dist/arcade-style-choreo.js';
const six=['king','queen','bishop','rook','knight','pawn'];
const base={x:520,y:330,id:'open-cut',face:0,form:'shii_cho',action:'slash',attack:'sc_open_cut',technique:'sc_open_cut',
  actionDuration:.57,alive:true,airPhase:'grounded',airHeight:0,styleChoreo:true};
const f=(style,time,extra={})=>({...base,actionTime:time,attackSpec:{contact:.247,duration:.57,chessStyle:style},...extra});
const pose=(state)=>{const rig=sampleArcadeFighter(state,0);return {rig,world:arcadeBladeWorld(state,rig)};};
const rounded=q=>[Math.round(q.x*10),Math.round(q.y*10)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('same Open Cut has six different actual hand and blade poses during chamber, release and recovery',()=>{
  for(const time of [.142,.247,.405]){
    const signatures=six.map(style=>{
      const {rig,world}=pose(f(style,time));
      assert.equal(rig.chessChoreo.style,style);
      return JSON.stringify([rounded(world.hand),rounded(world.tip)]);
    });
    assert.equal(new Set(signatures).size,6);
  }
  const kin=sampleChessSwing('king',{elapsed:.362,duration:.57,contact:.247});
  const q=sampleChessSwing('queen',{elapsed:.398,duration:.57,contact:.247});
  assert(Math.abs(q.yaw)>Math.abs(kin.yaw)*1.9&&q.reach>0&&kin.reach<0);
  const chamber=sampleChessSwing('bishop',{elapsed:.145,duration:.57,contact:.247});
  const recovery=sampleChessSwing('bishop',{elapsed:.344,duration:.57,contact:.247});
  assert(chamber.height< -12&&recovery.height>12);
});

test('physical styles keep release near classic geometry and preserve held blade lengths across cardinal facings',()=>{
  for(const style of six)for(const weapon of ['single','dual','staff'])for(const face of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const gear={weapon,grip:'forward'}, attackSpec={contact:.247,duration:.57,chessStyle:style,
      ...(weapon==='single'?{}:{offhand:{contact:.395}})};
    const extras={gear,face,attackSpec};
    const contact=f(style,.247,extras), tuned=pose(contact), old=pose({...contact,styleChoreo:false});
    assert(dist(tuned.world.tip,old.world.tip)<11,JSON.stringify({style,weapon,face,delta:dist(tuned.world.tip,old.world.tip)}));
    let prev=null;
    for(let k=0;k<=68;k++){
      const p=f(style,k/120,extras),{rig,world}=pose(p);
      for(const [j,blade] of world.blades.entries()){
        assert(Math.abs(dist(blade.tip,blade.hand)-dist(old.world.blades[j].tip,old.world.blades[j].hand))<1e-6);
        if(prev)assert(dist(blade.tip,prev[j].tip)<34);
      }
      if(weapon==='staff'){
        const [a,b]=world.blades, d1=[a.tip.x-a.hand.x,a.tip.y-a.hand.y],d2=[b.tip.x-b.hand.x,b.tip.y-b.hand.y];
        assert(Math.abs(d1[0]*d2[1]-d1[1]*d2[0])<1e-7);
      }
      assert(arcadeFeetWorld(p,rig).every(l=>Number.isFinite(l.toes.x)&&Number.isFinite(l.toes.y)));
      prev=world.blades;
    }
  }
});

test('nonopt-in, neutral, non-saber, and airborne preserve existing motion',()=>{
  const plain=f('queen',.14,{styleChoreo:false}), r=pose(plain).rig;
  assert.deepEqual(pose({...plain,attackSpec:{...plain.attackSpec,chessStyle:'rook'}}).rig,r);
  for(const patch of [
    {attackSpec:{...plain.attackSpec,chessStyle:'none'}},{saberOff:true},
    {attackSpec:{...plain.attackSpec,freeHand:true}}, {airPhase:'airborne',airHeight:24},
  ]){
    assert.deepEqual(pose({...plain,...patch,styleChoreo:true}).rig,pose({...plain,...patch}).rig);
  }
});

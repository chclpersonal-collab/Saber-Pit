import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
const tick=1/120;
const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const arc=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const bladeAngle=b=>Math.atan2(b.tip.y-b.hand.y,b.tip.x-b.hand.x);
function fight(weapon,active=true){
  const game=createArcade({mode:'duel',startingSaberWeapon:[weapon,'single'],teamForms:['shii_cho','niman'],
    startingRanks:['SSS+V','SSS+V'],fighterChessStyles:[['queen'],['rook']],styleChoreo:active,weaponFlow:true,
    seed:148,limit:45,terrain:'open'});
  return [game,game.fighters[0],game.fighters[1]];
}
const pose=(s,f)=>arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
function act(s,f,rival,input){
  // Isolate the player's transition and never let a clash or stagger mask it.
  rival.x=s.width-110;rival.y=s.height-80;rival.vx=0;rival.vy=0;
  stepArcade(s,tick,{aimX:f.x+80,aimY:f.y,...input});
  return pose(s,f);
}

test('a committed cut carries real momentum into linked blade entry and then guard',()=>{
  for(const weapon of ['single','dual','staff']){
    const [s,f,e]=fight(weapon);
    let last=act(s,f,e,{strike:true}),linked=false,settled=false;
    for(let i=1;i<275;i++){
      const next=act(s,f,e,{strike:i===34,guard:i>=38});
      const entry=f.poseFrom;
      if(!linked&&f.chainDepth>1&&entry?.kind==='chain'){
        linked=true;assert(entry.momentum?.main);
        assert(delta(last.tip,next.tip)<15);
        assert(Math.abs(arc(bladeAngle(next),bladeAngle(last)))<.43);
      }
      if(f.action==='guard'){
        if(!settled){
          assert(entry?.momentum?.main);
          assert.equal(f.poseEntryDuration,.155);
          assert(delta(last.tip,next.tip)<15);
        }
        settled=true;
      }
      if(weapon==='staff'){
        const [main,back]=next.blades;
        assert(Math.abs(Math.abs(arc(bladeAngle(main),bladeAngle(back)))-Math.PI)<1e-6);
      }
      last=next;
      if(linked&&settled&&f.actionTime>.18)break;
    }
    assert(linked&&settled,JSON.stringify({weapon,linked,settled}));
  }
});

test('guard release unwinds into neutral and old replay flags do not receive new momentum',()=>{
  for(const flag of [true,false]){
    const [s,f,e]=fight('single',flag);
    let g;
    for(let i=0;i<20;i++)g=act(s,f,e,{guard:true});
    assert.equal(f.action,'guard');
    const neutral=act(s,f,e,{guard:false});
    assert.equal(f.action,'idle');
    if(flag){
      assert.equal(f.poseFrom.kind,'guard_recover');
      assert(delta(g.tip,neutral.tip)<4);
      assert(f.poseFrom.momentum?.main);
    }else assert(!f.poseFrom?.momentum);
  }
});

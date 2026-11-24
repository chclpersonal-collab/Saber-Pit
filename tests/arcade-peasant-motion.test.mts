import test from 'node:test';
import assert from 'node:assert/strict';
import {peasantReleaseArc,samplePeasantPhrase,peasantHandoff} from '../dist/arcade-peasant-motion.js';
const times={duration:.62,contact:.24,offContact:.39};
test('new release offset is bounded and speed crosses actual contact without a stop',()=>{
  const d=1e-7,w=.10;
  assert.equal(peasantReleaseArc(0,w),0);
  assert(Math.abs(peasantReleaseArc(d,w)/d-peasantReleaseArc(-d,w)/-d)<1e-8);
  assert(peasantReleaseArc(d,w)/d>60);
  for(const dt of [-.1,-.05,-.03,.03,.05,.1])assert(Math.abs(peasantReleaseArc(dt,w))<=1);
  for(const family of ['cut','sweep','thrust','rise','screen','vault']){
    const a=samplePeasantPhrase({family,time:times.contact,...times});
    assert.equal(a.yaw,0);assert.equal(a.reach,0);assert.equal(a.height,0);
  }
});
test('dual wrists use independent release phases and staff shares one correction',()=>{
  const main=samplePeasantPhrase({family:'sweep',kit:'dual',time:.26,...times});
  const off=samplePeasantPhrase({family:'sweep',kit:'dual',time:.42,...times});
  assert(main.yaw!==0&&off.offYaw!==0);
  const staff=samplePeasantPhrase({family:'sweep',kit:'staff',time:.26,...times});
  assert.equal(staff.offYaw,0);assert.equal(staff.offReach,0);
});
test('guard or linked attack handoff inherits entrance speed and comes to rest at destination',()=>{
  const d=1e-7,t=.16;
  for(const secondary of [false,true]){
    assert.deepEqual(peasantHandoff(0,t,secondary),{feed:1,tangent:0});
    assert.deepEqual(peasantHandoff(t,t,secondary),{feed:0,tangent:0});
    assert(Math.abs(peasantHandoff(d,t,secondary).tangent/d-1)<.0001);
    assert(peasantHandoff(t*.43,t,secondary).tangent>0);
  }
  assert(peasantHandoff(t*.57,t,true).feed>peasantHandoff(t*.57,t,false).feed);
});

test('v3 rig overlays real outward arm arcs and preserves first contact/length for all saber kits',async()=>{
  const {sampleArcadeFighter,arcadeBladeWorld}=await import('../dist/arcade-fighters.js');
  const action={face:.27,x:510,y:325,form:'shii_cho',action:'sweep',attack:'sc_gate_sweep',technique:'sc_gate_sweep',
    alive:true,airPhase:'grounded',airHeight:0,actionDuration:times.duration,styleChoreo:true};
  const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const look=(state,t,flag)=>{const f={...state,actionTime:t,peasantMotion:flag};return arcadeBladeWorld(f,sampleArcadeFighter(f,5));};
  for(const weapon of ['single','dual','staff']){
    const state={...action,gear:{weapon,grip:'forward'},attackSpec:{contact:times.contact,duration:times.duration,chessStyle:'queen',
      ...(weapon==='single'?{}:{offhand:{contact:times.offContact}})}};
    const actual=look(state,times.contact,true), classic=look(state,times.contact,false);
    assert.deepEqual(actual.blades,classic.blades);
    assert(gap(look(state,.265,true).tip,look(state,.265,false).tip)>3);
    let last=null;
    for(let n=1;n<times.duration*120;n++){
      const b=look(state,n/120,true).blades;
      for(const [i,p] of b.entries()){
        assert(Math.abs(gap(p.hand,p.tip)-gap(actual.blades[i].hand,actual.blades[i].tip))<1e-7);
        if(last)assert(gap(last[i].tip,p.tip)<29);
      }
      if(weapon==='staff'){
        const [a,z]=b;
        assert(Math.abs((a.tip.x-a.hand.x)*(z.tip.y-z.hand.y)-(a.tip.y-a.hand.y)*(z.tip.x-z.hand.x))<1e-7);
      }
      last=b;
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
const forms={shii_cho:'wheel',makashi:'line',soresu:'compact',ataru:'corkscrew',djem_so:'bound',niman:'drift',juyo:'pounce'};
const f=(form,airPhase,gear,jumpKind=forms[form])=>({form,gear,jumpKind,action:'jump',face:.25,x:420,y:360,airFacing:.25,
  actionDuration:.8,actionTime:.32,airPhase,airProgress:.44,airHeight:airPhase==='airborne'?39:0});
test('all jump varieties give distinct windup, apex and recovery poses on all weapon kits',()=>{
  for(const gear of [{weapon:'single'},{weapon:'dual',grip:'backhand'},{weapon:'staff'}]){
    for(const phase of ['takeoff','airborne','landing']){
      const signatures=new Set();
      for(const form of Object.keys(forms)){
        const input=f(form,phase,gear), r=sampleArcadeFighter(input), pose=arcadeBladeWorld(input,r);
        signatures.add([r.bend,r.lean,r.roll,r.legs[0].k.y,pose.tip.x,pose.tip.y].map(x=>Math.round(x*10)).join(','));
        assert.equal(r.hop,input.airHeight);
        assert.ok(r.legs.every(l=>l.planted===(phase!=='airborne')));
        if(gear.weapon==='staff'){
          const [a,b]=pose.blades;
          const cross=(a.tip.x-a.hand.x)*(b.tip.y-b.hand.y)-(a.tip.y-a.hand.y)*(b.tip.x-b.hand.x);
          assert.ok(Math.abs(cross)<1e-7);
        }
      }
      assert.equal(signatures.size,7);
    }
  }
});
test('Ataru crossflip winds in the opposite direction and reduced motion removes decorative rotation',()=>{
  const cork=f('ataru','airborne',{weapon:'single'});
  const cross={...cork,jumpKind:'crossflip'};
  assert.ok(sampleArcadeFighter(cork).trick.angle>0);
  assert.ok(sampleArcadeFighter(cross).trick.angle<0);
  assert.equal(sampleArcadeFighter(cross,0,{reducedMotion:true}).trick.angle,0);
  assert.equal(sampleArcadeFighter(cross,0,{reducedMotion:true}).hop,cross.airHeight);
});

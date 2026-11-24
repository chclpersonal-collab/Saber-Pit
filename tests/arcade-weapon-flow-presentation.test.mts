import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
import {sampleWeaponFlow} from '../dist/arcade-weapon-flow.js';
const loadouts=[['single','single','forward'],['reverse','single','backhand'],['dual','dual','forward'],
  ['reverseDual','dual','backhand'],['staff','staff','forward']];
const attacks=['cut','sweep','thrust','screen','rise','vault','return'];
function fixture(weapon,grip,attackFamily,staffLead='primary'){
  const mult=weapon!=='single';
  return {x:395,y:335,form:'shii_cho',face:.53,gear:{weapon,grip},staffLead,
    attack:'slash',attackFamily,action:'slash',actionDuration:.72,
    attackSpec:{contact:.28,...(mult?{offhand:{contact:.41}}:{})}};
}
const world=(f,t)=>arcadeBladeWorld(f,sampleArcadeFighter({...f,actionTime:t},1));
const difference=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('all five kits have distinct winding and recovery, exact live contacts and untouched old replay',()=>{
  const signatures=new Set();
  for(const [kit,weapon,grip] of loadouts){
    const f=fixture(weapon,grip,'sweep','rear'), flow={...f,weaponFlow:true};
    assert.deepEqual(world({...f,weaponFlow:false},.19),world(f,.19));
    const old=world(f,.19).tip,a=world(flow,.19).tip,b=world(flow,.57).tip;
    assert.ok(difference(old,a)>7,kit);
    signatures.add([a.x,a.y,b.x,b.y].map(x=>x.toFixed(1)).join(','));
    for(const time of [.28,.41].slice(0,weapon==='single'?1:2))assert.deepEqual(world(flow,time),world(f,time));
  }
  assert.equal(signatures.size,5);
  assert.ok(Math.abs(sampleWeaponFlow({kit:'reverse',t:.2}).pitch)>Math.abs(sampleWeaponFlow({kit:'single',t:.2}).pitch));
});
test('staff never flexes and no kit jumps across sampled 120 Hz attack frames',()=>{
  let worst=0;
  for(const [kit,weapon,grip] of loadouts)for(const attack of attacks)
    for(const facing of [.04,.64,1.57,2.4,3.8]){
      const f={...fixture(weapon,grip,attack,'rear'),face:facing,weaponFlow:true};
      let prior;
      for(let i=0;i<=86;i++){
        const frame=world(f,i/120);
        if(prior)for(const [j,b] of frame.blades.entries())worst=Math.max(worst,difference(b.tip,prior.blades[j].tip));
        if(weapon==='staff'){
          const [a,b]=frame.blades;
          assert.ok(Math.abs((a.tip.x-a.hand.x)+(b.tip.x-b.hand.x))<1e-7);
          assert.ok(Math.abs((a.tip.y-a.hand.y)+(b.tip.y-b.hand.y))<1e-7);
        }
        prior=frame;
      }
    }
  assert.ok(worst<43,'largest step '+worst);
});

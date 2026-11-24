import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';

const dt=1/120;
const sample=(s,f)=>arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
function fixture(form='makashi',weapon='staff'){
  const s=createArcade({mode:'duel',seed:71,form,startingSaberWeapon:[weapon,'single']});
  const [p,e]=s.fighters;
  Object.assign(p,{x:470,y:320,face:0});
  Object.assign(e,{x:970,y:350,action:'stagger',actionDuration:60,think:300});
  return {s,p,e};
}

test('a post-release reversal does not teleport either staff end or delay the dash',()=>{
  const {s,p}=fixture();
  stepArcade(s,dt,{heavy:true,aimX:965,aimY:320});
  assert.equal(p.attack,'thrust');
  while(p.actionTime<p.attackSpec.contact+.13)stepArcade(s,dt);
  const before=sample(s,p),x=p.x,swings=p.stats.saberSwings;
  stepArcade(s,dt,{dash:true,x:-1});
  assert.equal(p.action,'dash');
  assert.equal(p.attack,null);
  assert.equal(p.stats.saberSwings,swings);
  assert.ok(p.x<x-1&&Math.abs(p.face)>3,'dash movement and collision bearing start immediately');
  assert.equal(p.poseFrom.kind,'dash');
  assert.equal(p.poseFrom.legs.length,2);
  assert.equal(p.invuln,.115);
  const after=sample(s,p);
  for(const [i,b] of after.blades.entries()){
    assert.ok(Math.hypot(b.tip.x-before.blades[i].tip.x,b.tip.y-before.blades[i].tip.y)<24);
  }
});

test('Force recovery blend survives neutral locomotion changes without resetting',()=>{
  const {s,p}=fixture('niman','single');
  stepArcade(s,dt,{force:true,aimX:970,aimY:350});
  assert.equal(p.action,'force');
  while(p.action==='force')stepArcade(s,dt);
  assert.equal(p.action,'idle');
  const entry=p.poseFrom;
  assert.equal(entry.kind,'force_recover');
  assert.equal(p.poseEntryOffset,0);
  stepArcade(s,dt,{});
  stepArcade(s,dt,{x:1});
  assert.equal(p.action,'run');
  assert.equal(p.poseFrom,entry);
  assert.ok(p.poseEntryOffset>=dt);
  stepArcade(s,dt,{strike:true,aimX:970,aimY:350});
  assert.equal(p.action,'slash');
  assert.equal(p.poseEntryOffset,0);
});

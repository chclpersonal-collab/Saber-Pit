import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {arcadeLimbDisabled,arcadeRegionalCondition,createArcadeInjuries} from '../dist/arcade-injuries.js';
import {sampleArcadeFighter,sampleArcadeRegionalPose} from '../dist/arcade-fighters.js';

const game=(extra={})=>createArcade({mode:'duel',seed:9,teamSizes:[1,1],startingRanks:['A','A'],
  form:'shii_cho',localVersus:true,regionalInjuries:true,...extra});
const wound=(fighter,part,pct)=>fighter.injuries[part].front=pct;
test('a combined local score disables exactly at 74%, never from damage elsewhere',()=>{
  const injuries=createArcadeInjuries();
  injuries.rightArm={front:66,rear:23.5};
  injuries.head.front=99;
  assert.equal(arcadeLimbDisabled(injuries,'rightArm'),false);
  assert.equal(arcadeRegionalCondition(injuries).find(x=>x.id==='rightArm')?.pct,73);
  injuries.rightArm.rear=24;
  assert.equal(arcadeLimbDisabled(injuries,'rightArm'),true);
  assert.equal(arcadeRegionalCondition(injuries).find(x=>x.id==='rightArm')?.pct,74);
  assert.equal(arcadeLimbDisabled(injuries,'leftArm'),false);
  assert.equal(arcadeRegionalCondition(injuries)[0]?.labelCondition,'Critical');
});
test('right-arm threshold removes sword and guard, and does not remove Force',()=>{
  for(const pct of [73,74]) {
    const s=game(), f=s.fighters[0];
    wound(f,'rightArm',pct);
    stepArcade(s,1/60,{strike:true});
    assert.equal(f.stats.saberSwings,pct===73?1:0);
  }
  for(const input of [{guard:true},{force:true}]) {
    const s=game(),f=s.fighters[0];
    wound(f,'rightArm',74);
    stepArcade(s,1/60,input);
    assert.equal(f.action,input.guard?'idle':'force');
  }
});
test('left-arm injury suppresses the second release but preserves the primary',()=>{
  const s=game({startingSaberWeapon:['dual','single'],weaponFlow:true});
  const f=s.fighters[0];wound(f,'leftArm',74);
  stepArcade(s,1/60,{strike:true});
  assert.equal(f.stats.saberSwings,1);
  assert.ok(f.attackSpec);
  assert.equal(f.attackSpec.offhand,undefined);
});
test('a disabled leg removes jumping and dashing without freezing normal movement',()=>{
  const s=game(),f=s.fighters[0],start=f.x;
  wound(f,'leftLeg',74);
  for(let i=0;i<25;i++)stepArcade(s,1/60,{jump:true,dash:true,x:-1});
  assert.equal(f.airHeight,0);
  assert.equal(f.moves.jump,undefined);
  assert.equal(f.moves.dash,undefined);
  assert.ok(f.x<start-5);
});
test('legacy replay options preserve hand and limb behavior',()=>{
  const s=game({regionalInjuries:false}),f=s.fighters[0];
  wound(f,'rightArm',100);
  stepArcade(s,1/60,{strike:true});
  assert.equal(f.stats.saberSwings,1);
});
test('KO pose keeps falling while simulation time is frozen, with reduced motion opt out',()=>{
  const s=game(),f=s.fighters[0];
  f.action='ko';f.actionTime=0;f.actionDuration=1;f.alive=false;
  f.injuryReaction={at:3,bearing:0,region:'leftLeg',strength:1};
  const r=sampleArcadeFighter(f,4);
  const start=sampleArcadeRegionalPose(f,r,4);
  const fall=sampleArcadeRegionalPose({...f},r,4.5);
  assert.equal(start.regionalFall?.progress,0);
  assert.ok(fall.regionalFall?.angle>1);
  assert.notDeepEqual(fall.legs,r.legs);
  assert.equal(f.actionTime,0);
  const reduced=sampleArcadeRegionalPose(f,sampleArcadeFighter(f,4.5,{reducedMotion:true}),4.5);
  assert.equal(reduced.regionalFall?.progress,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleFighterRig, projectJoint, drawFighterRig } from '../dist/pose-rig.js';
test('rig is deterministic, finite, and does not mutate simulation inputs',()=>{
  const fighter={team:0,facing:1,attack:{kind:'saber',startedTick:0,resolveTick:20}};
  const before=JSON.stringify(fighter);
  const input={fighter,tick:13,pose:{phase:'strike',angle:.3,extension:4,lean:3,crouch:2,trail:.2},dual:true};
  const a=sampleFighterRig(input),b=sampleFighterRig(input);
  assert.deepEqual(a,b);assert.equal(JSON.stringify(fighter),before);
  for(const joint of Object.values(a.joints))for(const n of Object.values(joint))assert.ok(Number.isFinite(n));
  for(const joint of Object.values(a.projected))for(const n of Object.values(joint))assert.ok(Number.isFinite(n));
  assert.equal(a.blades.length,2);
});
test('all nine motion families have distinct depth pose signatures',()=>{
  const signatures=new Set();
  for(const motion of ['sweep','thrust','orbit','leap','redirect','cleave','weave','flurry','riposte']){
    const rig=sampleFighterRig({motion,tick:10,fighter:{attack:{startedTick:0,resolveTick:20}},pose:{phase:'strike',angle:.2}});
    signatures.add(JSON.stringify(rig.joints));
  }
  assert.equal(signatures.size,9);
});
test('facing mirrors projection, and each blade stays exactly attached to its hand',()=>{
  assert.equal(projectJoint({x:8,y:0,z:10},1).x,-projectJoint({x:8,y:0,z:10},-1).x);
  const rig=sampleFighterRig({dual:true,pose:{depth:12,angle:0}});
  for(const b of rig.blades){const h=rig.joints[b.hand],t=rig.joints[b.tip];assert.ok(Math.abs(Math.hypot(t.x-h.x,t.y-h.y,t.z-h.z)-b.length)<1e-9);}
});
test('grounded foot planting is independent of torso crouch and lean',()=>{
  const a=sampleFighterRig({pose:{crouch:0,lean:0}}),b=sampleFighterRig({pose:{crouch:5,lean:6}});
  assert.deepEqual(a.joints.footMain,b.joints.footMain);assert.deepEqual(a.joints.footOff,b.joints.footOff);
  assert.notDeepEqual(a.joints.pelvis,b.joints.pelvis);
});
test('reduced motion suppresses dynamic depth and trail',()=>{
  const rig=sampleFighterRig({reducedMotion:true,moving:true,pose:{depth:15,twist:1,trail:.4,lean:5,crouch:3,footwork:6}});
  assert.equal(rig.twist,0);assert.equal(rig.joints.pelvis.x,0);assert.equal(rig.blades[0].trailOpacity,0);
});
test('renderer balances canvas state and performs depth-sorted drawing',()=>{
  let saves=0,restores=0,strokes=0;
  const ctx={globalAlpha:1,save(){saves++},restore(){restores++},beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},fill(){},stroke(){strokes++}};
  const rig=sampleFighterRig({dual:true});assert.equal(drawFighterRig(ctx,rig),rig);
  assert.equal(saves,restores);assert.ok(strokes>12);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeImpactFx,arcadeShakeOffset,arcadeSwingEase,arcadeSmear,ARCADE_IMPACT_HOLD_MAX_MS} from '../dist/arcade-impact-fx.js';

test('reduced motion turns off hold, flash and shake for every kind',()=>{
  for(const kind of ['hit','heavy','block','parry','clash','break','ko'] as const)
    assert.deepEqual(arcadeImpactFx({kind,damage:30,reducedMotion:true}),{holdMs:0,flashFrames:0,shakePx:0,shakeMs:0});
});

test('hold grows with damage and never passes the cap',()=>{
  const light=arcadeImpactFx({kind:'hit',damage:5,reducedMotion:false});
  const hard=arcadeImpactFx({kind:'hit',damage:30,reducedMotion:false});
  assert.ok(hard.holdMs>light.holdMs);
  for(const damage of [0,50,500,Number.NaN])
    assert.ok(arcadeImpactFx({kind:'ko',damage,reducedMotion:false}).holdMs<=ARCADE_IMPACT_HOLD_MAX_MS);
});

test('shake decays to zero and is deterministic',()=>{
  const fx=arcadeImpactFx({kind:'heavy',damage:20,reducedMotion:false});
  assert.deepEqual(arcadeShakeOffset(fx,10,3),arcadeShakeOffset(fx,10,3));
  assert.deepEqual(arcadeShakeOffset(fx,fx.shakeMs,3),{x:0,y:0});
  const o=arcadeShakeOffset(fx,0,3);
  assert.ok(Math.abs(o.x)<=fx.shakePx&&Math.abs(o.y)<=fx.shakePx);
});

test('swing eases back before contact and overshoots after it',()=>{
  assert.ok(arcadeSwingEase(.1,.4)<0);
  assert.ok(Math.abs(arcadeSwingEase(.4,.4))<1e-9);
  assert.ok(arcadeSwingEase(.6,.4)>0);
  assert.ok(Math.abs(arcadeSwingEase(1,.4))<1e-9);
  assert.ok(Math.abs(arcadeSwingEase(.1,.4,true))<Math.abs(arcadeSwingEase(.1,.4)));
  assert.equal(arcadeSwingEase(.5,0),0);
});

test('smear covers the sweep and skips tiny ones',()=>{
  const base={x:0,y:0,hilt:10,reach:90,heavy:false,reducedMotion:false};
  assert.equal(arcadeSmear({...base,fromAngle:0,toAngle:.05}).points.length,0);
  const s=arcadeSmear({...base,fromAngle:0,toAngle:1.2});
  assert.ok(s.points.length>=6);
  assert.deepEqual(s.points[0],[90,0]);
  for(const [px,py] of s.points)assert.ok(Math.hypot(px,py)<=90.01);
  assert.ok(arcadeSmear({...base,fromAngle:0,toAngle:1.2,heavy:true}).alpha>s.alpha);
  assert.ok(arcadeSmear({...base,fromAngle:0,toAngle:1.2,reducedMotion:true}).alpha<s.alpha);
});

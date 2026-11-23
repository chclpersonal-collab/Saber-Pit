import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sampleSharedCombatBeats, applySharedCombatBeat } from '../dist/combat-sequences.js';

const pair = () => [{id:'blue-0',team:0,x:20,y:30,alive:true,attack:{kind:'saber',target:'red-0',startedTick:10,resolveTick:30}},
  {id:'red-0',team:1,x:55,y:30,alive:true}];
test('Phase 7 leaves the entire authoritative move chooser byte-for-byte unchanged', () => {
  const source=readFileSync(new URL('../dist/combat-sequences.js',import.meta.url),'utf8').split('// The functions above')[0].trim().replace(/\r\n/g,'\n').replace(/\?v=1\.4\.0/g,'');
  assert.equal(createHash('sha256').update(source).digest('hex'),'1f334669026ebece2d275ca020e98db4e3ddba1a5f737da8c565c1a8772c3725');
});
test('one real attack shares a clock and opposed torso reactions across both actors', () => {
  const fighters=pair(), before=JSON.stringify(fighters);
  const beats=sampleSharedCombatBeats({fighters,tick:20.25});
  assert.equal(beats.size,2);
  const a=beats.get('blue-0'),b=beats.get('red-0');
  assert.equal(a.pairId,b.pairId); assert.equal(a.progress,b.progress); assert.equal(a.phase,'exchange');
  assert.equal(a.twist,-b.twist); assert.equal(a.role,'initiator'); assert.equal(b.role,'responder');
  assert.equal(JSON.stringify(fighters),before);
});
test('only a resolved blocked contact creates planted lock then a breakaway', () => {
  const fighters=pair(); fighters[0].attack=null;
  const swings=new Map([['blue-0',{id:9,tick:30,targetId:'red-0',outcome:'blocked'}]]);
  const a=sampleSharedCombatBeats({fighters,swings,tick:34}).get('blue-0');
  assert.equal(a.phase,'blade-lock'); assert.equal(a.accent,'planted-push'); assert.equal(a.sparkWeight,1);
  assert.equal(sampleSharedCombatBeats({fighters,swings,tick:42}).get('blue-0').phase,'break-away');
  swings.get('blue-0').outcome='miss';
  assert.equal(sampleSharedCombatBeats({fighters,swings,tick:34}).get('blue-0').sparkWeight,0);
  assert.equal(sampleSharedCombatBeats({fighters,swings,tick:53}).size,0);
});
test('squad pairing is disjoint, deterministic and independent of fighter iteration order', () => {
  const fighters=pair(); fighters.push({id:'blue-1',team:0,x:22,y:30,alive:true,attack:{kind:'saber',target:'red-0',startedTick:11,resolveTick:31}});
  const a=sampleSharedCombatBeats({fighters,tick:22}),b=sampleSharedCombatBeats({fighters:[...fighters].reverse(),tick:22});
  assert.deepEqual(a,b); assert.equal(a.size,2); assert.ok(a.has('blue-1')); assert.ok(!a.has('blue-0'));
});
test('acrobatics only accent real flight, grounded attacks never request fake jumps', () => {
  const fighters=pair();
  assert.equal(sampleSharedCombatBeats({fighters,tick:20}).get('blue-0').accent,'commit');
  fighters[0].airborne={startTick:10,endTick:30,trajectory:'somersault'};
  assert.equal(sampleSharedCombatBeats({fighters,tick:20}).get('blue-0').accent,'flip-return');
  fighters[0].airborne.trajectory='side-vault';
  assert.equal(sampleSharedCombatBeats({fighters,tick:20}).get('blue-0').accent,'vault-return');
});
test('pose application preserves blade contact, range channels and source pose', () => {
  const beat=sampleSharedCombatBeats({fighters:pair(),tick:20}).get('blue-0');
  const pose=Object.freeze({angle:.4,bladeYaw:.3,bladePitch:.2,extension:7,phase:'strike',lean:2});
  const result=applySharedCombatBeat(pose,beat);
  for(const k of ['angle','bladeYaw','bladePitch','extension','phase']) assert.equal(result[k],pose[k]);
  assert.notEqual(result.lean,pose.lean); assert.deepEqual(applySharedCombatBeat(pose,beat,true),pose);
});
test('reduced motion, reset/rewind, missing target and distant pairing are inert', () => {
  const fighters=pair();
  assert.equal(sampleSharedCombatBeats({fighters,tick:20,reducedMotion:true}).size,0);
  assert.equal(sampleSharedCombatBeats({fighters,tick:0}).size,0);
  assert.equal(sampleSharedCombatBeats({fighters:[],tick:20}).size,0);
  fighters[1].x=999; assert.equal(sampleSharedCombatBeats({fighters,tick:20}).size,0);
});
test('fractional samples are finite, continuously sampled and free of mutable session state', () => {
  const fighters=pair();
  for(let t=10;t<30;t+=1/8){
    const b=sampleSharedCombatBeats({fighters,tick:t}).get('blue-0');
    for(const key of ['lean','crouch','twist','bodyRoll','footwork','progress']) assert.ok(Number.isFinite(b[key]));
  }
  const a=sampleSharedCombatBeats({fighters,tick:20.1}).get('blue-0'),b=sampleSharedCombatBeats({fighters,tick:20.2}).get('blue-0');
  assert.notEqual(a.progress,b.progress); assert.notEqual(a.twist,b.twist);
});

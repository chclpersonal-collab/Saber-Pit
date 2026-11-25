import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,sampleArcadeRenderRig,arcadeBladeWorld} from '../dist/arcade-fighters.js';
import {arcadeBasis} from '../dist/arcade-rig-projection.js';

const delta=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const length=(p)=>Math.hypot(p.x,p.y);
const paint=(f,t)=>{
  const raw=sampleArcadeFighter(f,t), art=sampleArcadeRenderRig(f,raw,t);
  assert.deepEqual(arcadeBladeWorld(f,art).blades,arcadeBladeWorld(f,art.held).blades);
  return {raw,art};
};
const base=()=>({id:'s',x:300,y:260,alive:true,peasantMotion:true,recoveryFlow:true,face:0,
  airPhase:'grounded',form:'djem_so',gear:{weapon:'staff'},action:'idle',actionTime:0,actionDuration:0});
test('matching weapon contact, different body phrases signal chamber, release, and overshoot',()=>{
  const motions=[['sweep','sweep'],['slash','cut'],['rush','thrust'],['slash','rise'],['slash','screen'],['slash','return']];
  const release=new Map(), follow=new Map();
  for(const [action,attackFamily] of motions){
    const f=base(), ready=paint(f,0).art;
    Object.assign(f,{action,attack:action,attackFamily,attackSpec:{contact:.125},actionDuration:.40,attackSerial:1});
    for(let i=1;i<=49;i++){
      f.actionTime=(i-1)/120;
      const {raw,art}=paint(f,i/120);
      const offset=delta(art.shoulder,raw.shoulder);
      if(i===1)assert.ok(length(delta(art.shoulder,ready.shoulder))<1e-8);
      if(i===16)release.set(attackFamily,offset);
      if(i===25)follow.set(attackFamily,offset);
      if(i===49)assert.ok(length(offset)<.12);
    }
  }
  assert.ok(release.get('thrust').x>8&&release.get('thrust').y>-3);
  assert.ok(release.get('sweep').y>2&&follow.get('sweep').x>9);
  assert.ok(release.get('rise').y<-6&&follow.get('rise').y<-8);
  assert.ok(release.get('screen').x<0&&release.get('screen').y<-5);
  assert.ok(release.get('return').x<0&&follow.get('return').x<-6);
  assert.ok(length(delta(follow.get('sweep'),follow.get('rise')))>12);
});

test('a short linked staff strike carries from the actual outgoing silhouette, then shows a new chamber before contact',()=>{
  const f={...base(),action:'sweep',attack:'sweep',attackFamily:'sweep',attackSpec:{contact:.14},
    actionDuration:.38,actionTime:.22,attackSerial:1};
  const finish=paint(f,.22).art;
  Object.assign(f,{action:'rush',attack:'rush',attackFamily:'thrust',attackSpec:{contact:.085},
    actionDuration:.28,actionTime:0,attackSerial:2,chainFrom:'sweep'});
  const start=paint(f,.22+1/120).art;
  assert.ok(length(delta(arcadeBasis(f,start).project(start.shoulder),arcadeBasis(f,finish).project(finish.shoulder)))<1e-8);
  let noLateReset=true;
  for(let i=1;i<=11;i++){
    f.actionTime=i/120;
    const {raw,art}=paint(f,.22+(i+1)/120);
    if(i===6)assert.ok(art.shoulder.x<raw.shoulder.x-3);
    if(i===11)assert.ok(art.shoulder.x>raw.shoulder.x+8);
    noLateReset&&=Number.isFinite(art.head.x)&&Number.isFinite(art.head.y);
  }
  assert.ok(noLateReset);
  const physical=sampleArcadeFighter(f,.34,{reducedMotion:true}), art=sampleArcadeRenderRig(f,physical,.34);
  assert.deepEqual(art.shoulder,physical.shoulder);
});

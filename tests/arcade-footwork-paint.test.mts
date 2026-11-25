import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,sampleArcadeFootwork,sampleArcadeRenderRig,arcadeFeetWorld,arcadeBladeWorld} from '../dist/arcade-fighters.js';
import {displayFighters,FRAME_STEP} from '../dist/arcade-display.js';
const baseline=()=>({id:'circle',action:'idle',actionTime:0,actionDuration:0,face:0,x:500,y:300,
  alive:true,airPhase:'grounded',airHeight:0,groundDistance:0,groundSpeed:37,vx:37,vy:0,form:'makashi',body:'femboy'});
const rig=(f,t,reducedMotion=false)=>sampleArcadeFighter(f,t,{reducedMotion});

test('close circling uses actual travel, lifts feet, and keeps the support foot locked',()=>{
  const actor=baseline();
  let painted=null, source=null, movement=0, locked=0, baseDrift=0, fixedDrift=0, lift=0;
  for(let i=0;i<=300;i++){
    const t=i/90, a=t*1.95, radius=19;
    actor.x=500+radius*Math.cos(a);actor.y=300+radius*Math.sin(a);
    actor.face=a+Math.PI;actor.vx=-Math.sin(a)*37;actor.vy=Math.cos(a)*37;
    actor.groundDistance=t*37;
    const raw=rig(actor,t), next=sampleArcadeFootwork(actor,raw,t);
    assert.deepEqual(arcadeBladeWorld(actor,next),arcadeBladeWorld(actor,raw));
    const world=arcadeFeetWorld(actor,next), original=arcadeFeetWorld(actor,raw);
    if(painted){
      for(const f of world){
        const before=painted.find(p=>p.side===f.side), a=original.find(p=>p.side===f.side), b=source.find(p=>p.side===f.side);
        const delta=Math.hypot(f.foot.x-before.foot.x,f.foot.y-before.foot.y);
        if(f.planted&&before.planted){locked++;fixedDrift+=delta;}
        if(a.planted&&b.planted)baseDrift+=Math.hypot(a.foot.x-b.foot.x,a.foot.y-b.foot.y);
        if(!f.planted){movement+=delta;lift=Math.max(lift,actor.y-f.foot.y);}
      }
    }
    painted=world;source=original;
  }
  assert(locked>200&&movement>100&&lift>10);
  assert(fixedDrift<baseDrift*.3,JSON.stringify({fixedDrift,baseDrift,locked}));
});

test('blocked requested velocity does not override observed perpendicular slide or animate a stationary actor',()=>{
  const actor=baseline();actor.vx=120;actor.vy=0;actor.groundSpeed=37;
  const draw=(y,dy,d,t)=>{
    actor.y=y;actor.groundDistance=d;
    const [view]=displayFighters([actor],new Map([[actor.id,{...actor,y:y-dy}]]),FRAME_STEP);
    const physical=rig(view,t);
    return {view,physical,painted:sampleArcadeFootwork(view,physical,t)};
  };
  const a=draw(300,37*FRAME_STEP,0,0), b=draw(300.5,37*FRAME_STEP,.5,1/60);
  const soleV=arcadeFeetWorld(b.view,b.painted);
  assert(soleV.some(sole=>Math.abs(sole.foot.y-b.view.y)>11));
  const stopped=draw(300.5,0,.5,2/60);
  const settled=draw(300.5,0,.5,.16);
  assert.equal(settled.painted,settled.physical);
  assert.equal(stopped.painted.action,stopped.physical.action);
  assert.deepEqual(arcadeBladeWorld(stopped.view,stopped.painted),arcadeBladeWorld(stopped.view,stopped.physical));
  const reduced=rig(a.view,0,true);
  assert.equal(sampleArcadeFootwork(a.view,reduced,0),reduced);
});

test('weapon recovery, aerial poses and clips never inherit a walking plant',()=>{
  const actor=baseline();sampleArcadeFootwork(actor,rig(actor,0),0);
  for(const [action,airPhase] of [['slash','grounded'],['idle','airborne'],['rush','grounded'],['parry','grounded']]){
    Object.assign(actor,{action,airPhase,airHeight:airPhase==='airborne'?25:0});
    const r=rig(actor,.02);
    assert.equal(sampleArcadeFootwork(actor,r,.02),r);
  }
});

test('marked planted soles and toes stay fixed across a shallow run and sudden facing switch',()=>{
  const actor=baseline();
  let old=[], contacts=0, largestSlip=0, maxRise=0;
  for(let i=0;i<180;i++){
    const t=i/90,speed=i<90?18:135, heading=i>=135?Math.PI*.61:0;
    if(i){
      actor.groundDistance+=speed/90;
      actor.x+=Math.cos(heading)*speed/90;actor.y+=Math.sin(heading)*speed/90;
    }
    Object.assign(actor,{vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed,groundSpeed:speed,
      face:i<102?0:i<119?2.65:-2.45});
    const original=rig(actor,t), painted=sampleArcadeFootwork(actor,original,t);
    assert.deepEqual(arcadeBladeWorld(actor,painted),arcadeBladeWorld(actor,original));
    const soles=arcadeFeetWorld(actor,painted);
    for(const a of soles){
      const b=old.find(v=>v.side===a.side);
      if(a.planted&&b?.planted){
        contacts++;
        for(const key of ['foot','toes'])largestSlip=Math.max(largestSlip,Math.hypot(a[key].x-b[key].x,a[key].y-b[key].y));
      }else if(!a.planted)maxRise=Math.max(maxRise,actor.y-a.foot.y);
    }
    old=soles;
  }
  assert(contacts>120&&maxRise>14);
  assert(largestSlip<1e-6,JSON.stringify({largestSlip,contacts,maxRise}));
});

test('v3 holds painted sole and toe positions across a grounded attack and guard recovery',()=>{
  const actor={...baseline(),peasantMotion:true,groundSpeed:0,vx:0,vy:0,gear:{weapon:'staff'}};
  const sample=(time)=>{
    const physical=rig(actor,time), art=sampleArcadeFootwork(actor,physical,time);
    assert.deepEqual(arcadeBladeWorld(actor,art).blades,arcadeBladeWorld(actor,physical).blades);
    return arcadeFeetWorld(actor,art).sort((a,b)=>a.side-b.side);
  };
  const ready=sample(0);
  Object.assign(actor,{action:'sweep',attack:'sweep',attackSerial:44,actionTime:.43,actionDuration:.57,attackSpec:{contact:.28}});
  const entry=sample(.0083);
  assert.deepEqual(entry.map(l=>l.foot),ready.map(l=>l.foot));
  assert.deepEqual(entry.map(l=>l.toes),ready.map(l=>l.toes));
  assert.equal(entry.filter(l=>l.planted).length,1);
  const held=sample(.03);
  const support=entry.find(l=>l.planted);
  assert.deepEqual(held.find(l=>l.side===support.side).foot,support.foot);
  const attack=sample(.13);
  Object.assign(actor,{action:'guard',attack:null,actionTime:0,actionDuration:0});
  const guard=sample(.138);
  assert.deepEqual(guard.map(l=>l.foot),attack.map(l=>l.foot));
  assert.deepEqual(guard.map(l=>l.toes),attack.map(l=>l.toes));
});

test('v3 grounded handoff never preserves a stale plant across an air, KO, or teleport discontinuity',()=>{
  for(const target of [{action:'jump',airPhase:'airborne',airHeight:30},{action:'ko',alive:false},{x:610,action:'guard'}]){
    const actor={...baseline(),peasantMotion:true,groundSpeed:0,vx:0,vy:0};
    sampleArcadeFootwork(actor,rig(actor,0),0);
    Object.assign(actor,target);
    const physical=rig(actor,1/120);
    assert.equal(sampleArcadeFootwork(actor,physical,1/120),physical);
  }
  const actor={...baseline(),peasantMotion:false,groundSpeed:0,vx:0,vy:0};
  sampleArcadeFootwork(actor,rig(actor,0),0);
  Object.assign(actor,{action:'sweep',attack:'sweep',actionTime:.4,actionDuration:.57,attackSpec:{contact:.28}});
  const physical=rig(actor,1/120);
  assert.equal(sampleArcadeFootwork(actor,physical,1/120),physical);
});

test('v3 bridges the silhouette into a new pose on separate beats without moving weapons or replay geometry',()=>{
  const actor={...baseline(),peasantMotion:true,groundSpeed:0,vx:0,vy:0,gear:{weapon:'staff'}};
  const paint=(t)=>{
    const physical=rig(actor,t), art=sampleArcadeFootwork(actor,physical,t);
    assert.deepEqual(arcadeBladeWorld(actor,art).blades,arcadeBladeWorld(actor,physical).blades);
    assert.equal(art.hand,physical.hand);assert.equal(art.waist,physical.waist);
    return {physical,art};
  };
  const rest=paint(0).art;
  Object.assign(actor,{face:Math.PI-.04,action:'sweep',attack:'sweep',actionTime:.41,actionDuration:.75,attackSpec:{contact:.31}});
  const {art:at,physical}=paint(.0083);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert(distance(at.head,rest.head)<1e-7&&distance(physical.head,rest.head)>8);
  const later=paint(.119);
  assert(distance(later.art.head,later.physical.head)>0.1);
  const independent={...actor};
  const target=sampleArcadeFootwork(independent,rig(independent,.119),.119);
  assert(distance(later.art.shoulder,target.shoulder)<1e-7);
  assert(distance(later.art.head,target.head)>.1);
  const legacy={...actor,peasantMotion:false};
  const l=rig(legacy,.119);
  assert.equal(sampleArcadeFootwork(legacy,l,.119),l);
});

test('live dash cancel carries the screen pose rather than replacing it with a generic ready crouch',()=>{
  const f={...baseline(),peasantMotion:true,recoveryFlow:true,action:'slash',technique:'open_cut',attack:'open_cut',
    face:0,actionTime:.26,actionDuration:.43,attackSpec:{contact:.17},gear:{weapon:'dual'}};
  const paint=(actor,t)=>sampleArcadeFootwork(actor,rig(actor,t),t);
  const before=paint(f,.125), feet=arcadeFeetWorld(f,before);
  Object.assign(f,{action:'dash',technique:'dash',attack:null,face:Math.PI-.13,
    actionTime:0,actionDuration:.24,x:f.x+2.9});
  const neutral=rig(f,.133), first=paint(f,.133);
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.ok(d(first.head,before.head)<1e-8&&d(neutral.head,before.head)>5);
  assert.ok(arcadeFeetWorld(f,first).every(l=>d(l.foot,feet.find(v=>v.side===l.side).foot)<1e-8));
  assert.deepEqual(arcadeBladeWorld(f,first).blades,arcadeBladeWorld(f,neutral).blades);
  const prior={...f,recoveryFlow:false};
  assert.equal(paint(prior,.133).head.x,neutral.head.x);
  const reduced=rig(f,.14,true);
  assert.equal(sampleArcadeFootwork(f,reduced,.14),reduced);
});

test('live Peasant render hands real support into takeoff and landing without altering flight or blade',()=>{
  const actor={...baseline(),peasantMotion:true,recoveryFlow:true,form:'ataru',gear:{weapon:'staff'}};
  const paint=(t)=>{
    const raw=rig(actor,t), r=sampleArcadeRenderRig(actor,raw,t);
    assert.equal(r.hop,raw.hop);
    assert.deepEqual(arcadeBladeWorld(actor,r).blades,arcadeBladeWorld(actor,r.held).blades);
    return r;
  };
  const old=paint(0),feet=arcadeFeetWorld(actor,old);
  Object.assign(actor,{x:actor.x+.5,action:'jump',actionTime:.008,actionDuration:.57,
    airPhase:'takeoff',airProgress:.05,airHeight:0,jumpKind:'corkscrew'});
  const launch=paint(.008);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.ok(arcadeFeetWorld(actor,launch).every(l=>distance(l.foot,feet.find(v=>v.side===l.side).foot)<1e-8));
  const reduced=rig(actor,.010,true), disabled=sampleArcadeRenderRig(actor,reduced,.010);
  assert.deepEqual(disabled.legs,reduced.legs);
  Object.assign(actor,{airPhase:'airborne',airProgress:.98,airHeight:2,actionTime:.44});
  const flight=paint(.44), landingFeet=arcadeFeetWorld(actor,flight);
  Object.assign(actor,{airPhase:'landing',airProgress:0,airHeight:0,actionTime:.448});
  const land=paint(.448);
  assert.ok(arcadeFeetWorld(actor,land).every(l=>{
    const old=landingFeet.find(v=>v.side===l.side).foot;
    return distance(l.foot,{x:old.x,y:old.y+2})<1e-8;
  }));
  assert.equal(land.hop,0);
});

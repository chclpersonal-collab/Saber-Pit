import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter, sampleArcadeRenderRig, arcadeFeetWorld, arcadeBladeWorld} from '../dist/arcade-fighters.js';

const fixture=()=>({id:'stride',x:400,y:300,action:'idle',actionTime:0,actionDuration:0,face:0,alive:true,
  airPhase:'grounded',airHeight:0,groundDistance:0,groundSpeed:0,vx:0,vy:0,form:'djem_so',body:'femboy',
  peasantMotion:true,recoveryFlow:true,gear:{weapon:'staff'}});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const drive=(f,speed,angle=0)=>{
  f.vx=Math.cos(angle)*speed;f.vy=Math.sin(angle)*speed;f.groundSpeed=speed;
  f.x+=f.vx/120;f.y+=f.vy/120;f.groundDistance+=speed/120;
};
function boots(f,i,reducedMotion=false) {
  const raw=sampleArcadeFighter(f,i/120,{reducedMotion}), render=sampleArcadeRenderRig(f,raw,i/120);
  assert.deepEqual(arcadeBladeWorld(f,render).blades,arcadeBladeWorld(f,raw).blades);
  return arcadeFeetWorld(f,render);
}
test('v5 braking holds a world-space sole and closes the free foot before a measured restart',()=>{
  const f=fixture();let pre;
  for(let i=0;i<28;i++){drive(f,105);pre=boots(f,i);}
  const candidates=pre.filter(b=>b.planted).sort((a,b)=>dist(a.foot,f)-dist(b.foot,f));
  assert.ok(candidates[0]);
  const fixed=candidates[0], free=pre.find(l=>l.side!==fixed.side);
  const close=[];
  for(let i=28;i<48;i++){
    drive(f,0);
    const current=boots(f,i), supported=current.find(l=>l.side===fixed.side);
    assert.ok(supported.planted);
    assert.ok(dist(supported.foot,fixed.foot)<1e-7&&dist(supported.toes,fixed.toes)<1e-7);
    close.push(current.find(l=>l.side===free.side));
  }
  assert.ok(close.some(l=>l.foot.y<Math.min(free.foot.y,close.at(-1).foot.y)-.15));
  const prev=boots(f,48);
  drive(f,70,1.1);
  const next=boots(f,49);
  for(const sole of next)assert.ok(dist(sole.foot,prev.find(l=>l.side===sole.side).foot)<2.2);
});

test('v5 speed changes cannot touch down a swinging boot before its current cycle wraps',()=>{
  const f=fixture();let last, firstAir;
  // Advances to the speed-dependent contact boundary in a running stride,
  // then immediately changes pace to a walk before the swing has finished.
  for(let i=0;i<34;i++){
    drive(f,160);
    last=boots(f,i);
    const front=last.find(l=>l.side===0);
    if(front&&!front.planted){firstAir=i;break;}
  }
  assert.ok(firstAir!==undefined&&f.groundDistance<38);
  drive(f,45);last=boots(f,firstAir+1);
  assert.equal(last.find(l=>l.side===0).planted,false);
  const reduced=sampleArcadeFighter(f,1,{reducedMotion:true});
  assert.deepEqual(sampleArcadeRenderRig(f,reduced,1).legs,reduced.legs);
});

test('stopped fighter can turn and enter an attack without discarding planted feet',()=>{
  const f=fixture(); let feet;
  for(let i=0;i<28;i++){drive(f,105);feet=boots(f,i);}
  const support=feet.filter(l=>l.planted).sort((a,b)=>dist(a.foot,f)-dist(b.foot,f))[0];
  for(let i=28;i<=41;i++){
    drive(f,0);
    f.face=(i-28)/14*Math.PI*.8;
    feet=boots(f,i);
    const firm=feet.find(l=>l.side===support.side);
    assert.ok(firm.planted&&dist(firm.foot,support.foot)<1e-7);
  }
  Object.assign(f,{action:'sweep',attack:'sweep',attackSerial:3,actionTime:.0083,actionDuration:.53,attackSpec:{contact:.28}});
  const start=boots(f,42);
  assert.ok(start.every(l=>dist(l.foot,feet.find(p=>p.side===l.side).foot)<1e-7));
  Object.assign(f,{action:'jump',attack:null,airPhase:'airborne',airHeight:35,airProgress:.34});
  const physical=sampleArcadeFighter(f,.5), rendered=sampleArcadeRenderRig(f,physical,.5);
  assert.equal(rendered.hop,physical.hop);
  const fresh={...f};
  assert.deepEqual(rendered.legs,sampleArcadeRenderRig(fresh,sampleArcadeFighter(fresh,.5),.5).legs);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter,arcadeBladeWorld,arcadeFeetWorld} from '../dist/arcade-fighters.js';
const render=f=>{const r=sampleArcadeFighter(f,1);return {r,w:arcadeBladeWorld(f,r)};};
const close=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-7);
for(const weapon of ['single','dual','staff'])test(weapon+' link starts on prior true blade and clears before contact',()=>{
  const before={gear:{weapon},x:250,y:240,face:.61,form:'shii_cho',action:'sweep',actionDuration:.65,actionTime:.43};
  const old=render(before);
  const base={...before,x:254,y:238,face:.35,action:'slash',attack:'slash2',combo:2,actionDuration:.4,attackSpec:{contact:.18},actionTime:0};
  const {lean,bend,wide,torsoTurn}=old.r;
  const linked={...base,poseFrom:{...old.w,origin:{x:before.x,y:before.y},body:{lean,bend,wide,torsoTurn}},
    poseEntryDuration:.15};
  const now=render(linked), shift=p=>({x:p.x+4,y:p.y-2});
  now.w.blades.forEach((b,i)=>{close(b.hand,shift(old.w.blades[i].hand));close(b.tip,shift(old.w.blades[i].tip));});
  assert.equal(now.r.lean,lean);
  const contact=render({...linked,actionTime:.18}), core=render({...base,actionTime:.18});
  assert.deepEqual(contact.w,core.w);
});

test('hit-stun inherits the interrupted actual pose, including repeat stagger and staff',()=>{
  for(const weapon of ['single','dual','staff']){
    const initial={gear:{weapon},x:310,y:230,face:.31,form:'shii_cho',action:'sweep',attack:'wide_cut',
      attackFamily:'sweep',actionTime:.29,actionDuration:.69,attackSpec:{contact:.30}};
    const capture=f=>{
      const {r,w}=render(f);
      return {...w,origin:{x:f.x,y:f.y},kind:'stagger',body:{lean:r.lean,bend:r.bend,wide:r.wide,torsoTurn:r.torsoTurn}};
    };
    const source=capture(initial);
    const template={...initial,action:'stagger',attack:null,actionDuration:.48,actionTime:0,poseFrom:source,poseEntryDuration:.11};
    for(const target of [template,{...template,poseFrom:capture({...template,actionTime:.046})}]){
      const start=render(target), own=target.poseFrom;
      start.w.blades.forEach((b,i)=>{close(b.hand,own.blades[i].hand);close(b.tip,own.blades[i].tip);});
      const next=render({...target,actionTime:1/120});
      assert.ok(next.w.blades.every((b,i)=>Math.hypot(b.tip.x-own.blades[i].tip.x,b.tip.y-own.blades[i].tip.y)<10));
      const end=render({...target,actionTime:.11}), natural=render({...target,actionTime:.11,poseFrom:null});
      assert.deepEqual(end.w,natural.w);
    }
  }
});

test('dash pivot preserves the entry soles and translates the hilt while leaving push-off planted',()=>{
  const f={form:'makashi',x:300,y:250,face:.10,action:'ready'};
  const old=render(f), legs=arcadeFeetWorld(f,old.r);
  const poseFrom={...old.w,legs,origin:{x:f.x,y:f.y},kind:'dash',body:{lean:old.r.lean,bend:old.r.bend}};
  const dodge={...f,face:Math.PI-.2,action:'dash',actionTime:0,actionDuration:.27,poseFrom,poseEntryDuration:.095};
  const changed=render(dodge);
  close(old.w.hand,changed.w.hand);close(old.w.tip,changed.w.tip);close(old.w.freeHand,changed.w.freeHand);
  const joined=arcadeFeetWorld(dodge,changed.r);
  for(const prior of legs)close(joined.find(l=>l.side===prior.side).foot,prior.foot);
  const advanced={...dodge,x:f.x+5,actionTime:1/120}, moving=render(advanced);
  for(const prior of legs){
    const foot=arcadeFeetWorld(advanced,moving.r).find(l=>l.side===prior.side).foot;
    assert.ok(Math.hypot(foot.x-prior.foot.x,foot.y-prior.foot.y)<3);
  }
  const done=render({...dodge,actionTime:.01,poseEntryOffset:.09});
  const noBridge=render({...dodge,actionTime:.01,poseFrom:null});
  assert.deepEqual(done.w,noBridge.w);
});

test('dash recovery keeps a single angular branch when the target blade crosses 180°',()=>{
  const base={form:'shii_cho',gear:{weapon:'single'},x:250,y:350,face:3.083,
    action:'dash',actionDuration:.26,actionTime:.26};
  const source=render(base), snapshot={...source.w,facing:base.face,kind:'dash_recover',origin:{x:base.x,y:base.y}};
  const next={...base,action:'walk',actionDuration:0,poseEntryDuration:.095,poseFrom:snapshot};
  const frames=Array.from({length:12},(_,i)=>render({...next,face:base.face*(1-i/12),actionTime:i/120}).w.tip);
  assert.ok(Math.max(...frames.slice(1).map((p,i)=>Math.hypot(p.x-frames[i].x,p.y-frames[i].y)))<50);
  close(source.w.tip,frames[0]);
});

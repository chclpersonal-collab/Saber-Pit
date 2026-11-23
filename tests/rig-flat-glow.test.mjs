import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleFighterRig, drawFighterRig } from '../dist/pose-rig.js';

function recordingContext() {
  const records=[],stack=[];
  const ctx={globalAlpha:.7,globalCompositeOperation:'multiply',lineCap:'butt',lineJoin:'miter',lineWidth:9,strokeStyle:'old',fillStyle:'old',path:[],
    save(){stack.push(Object.fromEntries(['globalAlpha','globalCompositeOperation','lineCap','lineJoin','lineWidth','strokeStyle','fillStyle'].map(k=>[k,this[k]])));},
    restore(){Object.assign(this,stack.pop());},beginPath(){this.path=[];},moveTo(x,y){this.path.push(['M',x,y]);},lineTo(x,y){this.path.push(['L',x,y]);},
    arc(...args){this.path.push(['arc',...args]);},
    stroke(){records.push({kind:'stroke',path:this.path.slice(),width:this.lineWidth,color:this.strokeStyle,alpha:this.globalAlpha,blend:this.globalCompositeOperation,cap:this.lineCap});},
    fill(){records.push({kind:'fill',path:this.path.slice(),color:this.fillStyle,blend:this.globalCompositeOperation});}
  };return {ctx,records,stack};
}

test('flat skeleton uses one rounded four-pixel path per limb and one filled circle head',()=>{
  const {ctx,records,stack}=recordingContext();
  drawFighterRig(ctx,sampleFighterRig(),{teamColor:'#123456',blade:'#abcdef'});
  const body=records.filter(r=>r.blend==='source-over');
  assert.equal(body.filter(r=>r.kind==='fill').length,1);
  assert.equal(body.find(r=>r.kind==='fill').path[0][0],'arc');
  assert.ok(body.every(r=>r.color==='#123456'));
  const limbs=body.filter(r=>r.kind==='stroke'&&r.path.length===4);
  assert.equal(limbs.length,4);
  assert.ok(limbs.every(r=>r.width===4&&r.cap==='round'));
  assert.equal(stack.length,0);
  assert.equal(ctx.globalAlpha,.7);assert.equal(ctx.globalCompositeOperation,'multiply');assert.equal(ctx.lineWidth,9);
});

test('each saber gets exact additive glow passes with no leaked composite or alpha',()=>{
  const {ctx,records}=recordingContext();
  drawFighterRig(ctx,sampleFighterRig({dual:true}),{blade:'#abcdef'});
  const glow=records.filter(r=>r.blend==='lighter');
  assert.equal(glow.length,6);
  for(let i=0;i<glow.length;i+=3)assert.deepEqual(glow.slice(i,i+3).map(r=>[r.width,r.alpha,r.color]),[[14,.15,'#abcdef'],[7,.4,'#abcdef'],[2.5,1,'#ffffff']]);
  assert.equal(ctx.globalCompositeOperation,'multiply');assert.equal(ctx.globalAlpha,.7);
});

test('minimal effects retains white core without glow or synthetic smear polygons',()=>{
  const {ctx,records}=recordingContext();
  drawFighterRig(ctx,sampleFighterRig({pose:{phase:'strike',trail:1}}),{effects:'minimal'});
  assert.deepEqual(records.filter(r=>r.blend==='lighter').map(r=>r.width),[2.5]);
  assert.equal(records.filter(r=>r.kind==='fill').length,1);
});

test('walking alternates visible feet while planted idle feet remain stable',()=>{
  const a=sampleFighterRig({moving:true,tick:Math.PI/(.23*2)}),b=sampleFighterRig({moving:true,tick:Math.PI*3/(.23*2)});
  assert.ok(a.joints.footMain.y<a.joints.footOff.y);
  assert.ok(b.joints.footOff.y<b.joints.footMain.y);
  assert.ok(Math.abs(a.joints.footMain.x-b.joints.footMain.x)>=9.9);
  assert.deepEqual(sampleFighterRig({tick:0}).joints.footMain,sampleFighterRig({tick:100}).joints.footMain);
});

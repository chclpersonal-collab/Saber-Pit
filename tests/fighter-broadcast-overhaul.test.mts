import assert from 'node:assert/strict';
import test from 'node:test';
import { drawFighterRig, sampleFighterRig } from '../dist/pose-rig.js';
import { sampleCombatPose } from '../dist/choreography.js';

const forward = s => ({fighter:{team:0, facing:1,...s}});
test('travel alternates knee lift, opposing arm pump and heel return',()=>{
  const a=sampleFighterRig({...forward(),moving:true,tick:0});
  const b=sampleFighterRig({...forward(),moving:true,tick:Math.PI/.23});
  assert.ok(a.joints.footMain.y < a.joints.footOff.y-4);
  assert.ok(b.joints.footOff.y < b.joints.footMain.y-4);
  const x=sampleFighterRig({...forward(),moving:true,tick:Math.PI/(.23*2)});
  const y=sampleFighterRig({...forward(),moving:true,tick:Math.PI*3/(.23*2)});
  assert.ok(x.joints.handMain.x<y.joints.handMain.x-5);
  assert.ok(x.joints.handOff.x>y.joints.handOff.x+6);
});
test('ready breathing keeps soles planted and reduced rigs do not breathe or swing arms',()=>{
  const a=sampleFighterRig({tick:0}),b=sampleFighterRig({tick:Math.PI/(.09*2)});
  assert.notDeepEqual(a.joints.head,b.joints.head);
  assert.deepEqual(a.joints.footMain,b.joints.footMain);
  assert.deepEqual(a.joints.footOff,b.joints.footOff);
  assert.deepEqual(sampleFighterRig({moving:true,tick:3,reducedMotion:true}).joints,
    sampleFighterRig({moving:true,tick:110,reducedMotion:true}).joints);
});
test('guard braces and a thrust plants in a wider stride than its anticipation',()=>{
  const guarded=sampleFighterRig({fighter:{guard:true}});
  const ready=sampleFighterRig();
  assert.ok(guarded.joints.footMain.x-ready.joints.footMain.x>=2.5);
  const fighter={attack:{kind:'saber',startedTick:0,resolveTick:30}};
  const at = tick => sampleFighterRig({fighter,motion:'thrust',tick,
    pose:sampleCombatPose({fighter,motion:'thrust',tick})});
  assert.equal(at(30).phase,'strike');
  assert.ok(at(30).joints.footMain.x>at(3).joints.footMain.x+6);
  const {joints,blades}=at(30), blade=blades[0],h=joints[blade.hand],t=joints[blade.tip];
  assert.ok(Math.abs(Math.hypot(t.x-h.x,t.y-h.y,t.z-h.z)-25)<1e-9);
});
test('broadcast art has solid helmet and opposite facing visor trim without altering minimal blade passes',()=>{
  const record = facing => {
    const lines=[], fills=[], stack=[];
    const ctx={save(){stack.push([this.globalCompositeOperation,this.globalAlpha]);},
      restore(){[this.globalCompositeOperation,this.globalAlpha]=stack.pop();},
      beginPath(){this.path=[];},moveTo(x,y){this.path.push([x,y]);},
      lineTo(x,y){this.path.push([x,y]);},arc(x,y,r){this.path.push([x,y,r]);},
      stroke(){lines.push({blend:this.globalCompositeOperation,path:this.path,color:this.strokeStyle,width:this.lineWidth});},
      fill(){fills.push({path:this.path,color:this.fillStyle});}};
    drawFighterRig(ctx,sampleFighterRig({fighter:{facing}}),{appearance:'broadcast',effects:'minimal'});
    assert.equal(stack.length,0);
    return {lines,fills};
  };
  const a=record(1), b=record(-1);
  assert.ok(a.fills.some(f=>f.path[0][2]===7.6 && f.color==='#060a15'));
  assert.deepEqual(a.lines.filter(r=>r.blend==='lighter').map(r=>r.width),[2.5]);
  const visor=a.lines.find(r=>r.color==='#effeff').path, opposite=b.lines.find(r=>r.color==='#effeff').path;
  assert.ok(visor[1][0]>visor[0][0] && opposite[1][0]<opposite[0][0]);
});

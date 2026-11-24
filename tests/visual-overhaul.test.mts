/** Layout geometry, not browser or real-device performance evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitBattleCamera, worldToCanvas, canvasToWorld } from '../dist/camera.js';

for (const [width, height] of [[320,240], [390,300], [844,390], [960,540], [1440,720]]) {
  test(`overhaul camera keeps legal airborne artwork inside ${width}x${height}`, () => {
    for (const [worldWidth, worldHeight] of [[720,440], [960,540], [1440,810]]) {
      const bounds = { minX:40, minY:50, maxX:worldWidth-40, maxY:worldHeight-50 };
      const camera = fitBattleCamera({ width, height, worldWidth, worldHeight, bounds });
      const silhouette = 56 * camera.spriteScale;
      for (const x of [bounds.minX,bounds.maxX]) for (const y of [bounds.minY,bounds.maxY]) {
        const ground = worldToCanvas(camera,x,y), apex = worldToCanvas(camera,x,y-100);
        assert.ok(ground.x-silhouette>=-1e-8 && ground.x+silhouette<=width+1e-8);
        assert.ok(ground.y+silhouette<=height+1e-8);
        assert.ok(apex.y-Math.max(61,silhouette)>=-1e-8);
        const inverse = canvasToWorld(camera,ground.x,ground.y);
        assert.ok(Math.abs(inverse.x-x)<1e-8 && Math.abs(inverse.y-y)<1e-8);
      }
    }
  });
}

test('overhaul hidden or tiny canvas keeps a finite camera inverse', () => {
  for (const size of [0,1,4]) {
    const camera = fitBattleCamera({ width:size,height:size });
    assert.ok(Object.values(camera).every(Number.isFinite));
    assert.ok(Object.values(canvasToWorld(camera,0,0)).every(Number.isFinite));
  }
});

test('overhaul authored rigs including airborne yaw fit the camera silhouette allowance', async () => {
  const { FORM_MOVESETS } = await import('../dist/combat-forms.js');
  const { sampleCombatPose } = await import('../dist/choreography.js');
  const { sampleFighterRig } = await import('../dist/pose-rig.js');
  const { startAirborne, sampleAirborne } = await import('../dist/airborne.js');
  for (const [form, profile] of Object.entries(FORM_MOVESETS)) for (const move of profile.comboSteps) {
    for (let tick = 0; tick <= 42; tick++) for (const aimAngle of [-Math.PI/2, 0, Math.PI/2]) for (const dual of [false,true]) for (const facing of [-1,1]) {
      const fighter = { form, x:0, y:0, facing, attack:tick<20 ? {kind:'saber',startedTick:0,resolveTick:20,moveId:move.id,form} : null };
      if (move.jump) startAirborne(fighter,0,move.jump,{x:facing,y:0});
      const flight = sampleAirborne(fighter,tick);
      const swing = tick>=20 ? {tick:20,moveId:move.id,form,outcome:'hit'} : null;
      const pose = sampleCombatPose({fighter,tick,swing,motion:move.motion,dual,aimAngle});
      const rig = sampleFighterRig({fighter,tick,swing,flight,pose,motion:move.motion,move,dual,aimAngle});
      for (const [joint,p] of Object.entries(rig.projected)) assert.ok(Math.hypot(p.x,p.y)+3<=56, `${form}/${move.id}/${tick}/${joint} including glow fits`);
    }
  }
});

// Audit the complete physical cutting interval. Ready/chamber and the return
// to guard are intentionally allowed outside the cut plane and need their own
// continuity checks; including them here would misclassify a raised guard.
test('full sweeps reverse through depth and diagonal edges stay in their tilted plane', async () => {
  const { FORM_MOVESETS } = await import('../dist/combat-forms.js');
  const { sampleCombatPose } = await import('../dist/choreography.js');
  const { sampleFighterRig } = await import('../dist/pose-rig.js');
  const catalog = Object.entries(FORM_MOVESETS).flatMap(([form,p])=>p.comboSteps.map(move=>({form,move})));
  const signs = {};
  for (const path of ['left_sweep','right_sweep','rising_diagonal','falling_diagonal']) {
    const {form,move} = catalog.find(entry=>entry.move.animation.path===path);
    for (const aimAngle of [0,.4,-.4]) {
      const points=[];
      for (let i=0;i<=374;i++) {
        const tick=11.2+(29.9-11.2)*i/374;
        const fighter={form,facing:1,attack:tick<20?{kind:'saber',form,moveId:move.id,startedTick:0,resolveTick:20}:null};
        const swing=tick>=20?{tick:20,form,moveId:move.id,outcome:'hit'}:null;
        const input={fighter,tick,move,swing,motion:move.motion,aimAngle};
        const pose=sampleCombatPose(input), rig=sampleFighterRig({...input,pose});
        const p=rig.joints.tipMain,h=rig.joints.handMain;
        const vector={x:p.x-h.x,y:p.y-h.y,z:p.z-h.z}; points.push(vector);
        if(move.animation.plane==='horizontal') assert.ok(Math.abs(vector.y-25*Math.sin(aimAngle))<1e-8,'horizontal cutting elevation is stable');
        else assert.ok(Math.abs(vector.y*Math.cos(aimAngle)-vector.x*Math.sin(aimAngle)-vector.z)<1e-8,'diagonal edge stays in fixed tilted plane even with aim rotation');
      }
      if(aimAngle===0) {
        const span=k=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k]));
        assert.ok(span('x')>25 && span('z')>30,'the entire sweep crosses lateral and depth space');
        signs[path]=Math.sign(points.slice(1).reduce((sum,p,i)=>sum+points[i].x*p.z-points[i].z*p.x,0));
      }
    }
  }
  assert.equal(signs.left_sweep,-signs.right_sweep);
  assert.notEqual(signs.left_sweep,0);
  assert.equal(signs.rising_diagonal,-signs.falling_diagonal);
});

test('linked moves preserve every projected joint at the exact handoff', async () => {
  const { FORM_MOVESETS } = await import('../dist/combat-forms.js');
  const { sampleCombatPose } = await import('../dist/choreography.js');
  const { sampleFighterRig } = await import('../dist/pose-rig.js');
  for(const [form,profile] of Object.entries(FORM_MOVESETS)) for(const previous of profile.comboSteps) for(const next of profile.comboSteps) for(const tick of [25,32,39]) {
    const swing={tick:20,form,moveId:previous.id,outcome:'hit'};
    const base={form,facing:1,comboUntil:100};
    const rigs=[previous,next].map((move,index)=>{
      const fighter={...base,attack:index?{kind:'saber',form,moveId:move.id,startedTick:tick,resolveTick:tick+20}:null};
      const input={fighter,tick,swing,move,motion:move.motion};
      return sampleFighterRig({...input,pose:sampleCombatPose(input)});
    });
    for(const name of Object.keys(rigs[0].projected)) {
      const a=rigs[0].projected[name],b=rigs[1].projected[name];
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,`${form}/${previous.id}->${next.id}/${tick}/${name} cannot pop`);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_LONG_BLADE_SCALE, arcadeFoot, arcadeGait, arcadeFeetWorld, arcadeBladeWorld, sampleArcadeImpactPose, sampleArcadeRecoveryPose, sampleArcadeBladeInterruption, sampleArcadeFighter as pose, drawArcadeFighter} from '../dist/arcade-fighters.js';

test('ground-distance foot contacts anchor in the world and alternate through a clearance phase',()=>{
  const f={face:0,vx:210,vy:0};
  const a=pose({...f,x:100,groundDistance:0},0);
  const b=pose({...f,x:108,groundDistance:8},1);
  assert.ok(a.legs.some(x=>x.planted) && a.legs.some(x=>!x.planted));
  assert.ok(Math.abs(100+a.legs.find(x=>x.planted).foot.x*a.type.scale-(108+b.legs.find(x=>x.planted).foot.x*b.type.scale))<1e-9);
  assert.ok(Math.abs(100+arcadeFoot(0).reach - (108+arcadeFoot(8).reach))<1e-9);
  assert.ok(arcadeFoot(43.5).lift>=13.9);
  assert.equal(arcadeFoot(87).planted,false);
  assert.ok(arcadeFoot(12).sole>arcadeFoot(0).sole);
  assert.ok(arcadeFoot(15,0).planted !== arcadeFoot(15,.5).planted);
});
test('vertical strafing supports the ground foot while the chest aims independently',()=>{
  const f={x:90,face:0,vx:0,vy:170};
  const a=pose({...f,y:100,groundDistance:2},0);
  const b=pose({...f,y:113,groundDistance:15},1);
  const get=p=>p.legs.find(x=>x.planted).foot;
  assert.ok(Math.abs(100+get(a).y*a.type.scale-(113+get(b).y*b.type.scale))<1e-9);
  assert.ok(a.hand.x>a.shoulder.x);
});
test('attack families and slash steps give substantially distinct held poses',()=>{
  const x={actionDuration:.5,actionTime:.218,face:0};
  const fast=pose({...x,action:'slash',combo:1});
  const second=pose({...x,action:'slash',combo:2});
  const jab=pose({...x,action:'rush'});
  const sweep=pose({...x,action:'sweep'});
  const upper=pose({...x,action:'uppercut'});
  assert.equal(fast.action,'slash');
  assert.ok(Math.abs(fast.blade.y-second.blade.y)>8);
  assert.ok(jab.blade.x>fast.blade.x+12);
  assert.ok(Math.abs(sweep.blade.y-jab.blade.y)>10);
  assert.ok(upper.hop>20 && sweep.hop===0);
  assert.notEqual(jab.helmet.y,sweep.helmet.y);
});
test('reduced motion cuts idle movement and trails and keeps leg contact static',()=>{
  const x={action:'uppercut',actionTime:.21,actionDuration:.435};
  const p=pose(x,4,{reducedMotion:true});
  assert.equal(p.trail,0);
  assert.equal(p.roll,0);
  assert.ok(p.hop<pose(x,4).hop);
  const r={action:'run',vx:170,face:0};
  assert.deepEqual(pose({...r,groundDistance:4},0,{reducedMotion:true}).legs,
    pose({...r,groundDistance:38},5,{reducedMotion:true}).legs);
});
test('paced motion is deterministic, finite and needs an actual integrated distance',()=>{
  const input=Object.freeze({action:'run',vx:180,x:130,y:280,groundDistance:120,face:1.8,hp:102,team:1});
  const a=pose(input,0);
  const b=pose(input,2);
  assert.deepEqual(a.legs,b.legs);
  for(const key of ['hand','blade','waist','shoulder','helmet'])for(const n of Object.values(a[key]))assert.ok(Number.isFinite(n));
});
test('renderer keeps art local and restores canvas state for every engine action',()=>{
  for(const action of ['idle','run','guard','slash','rush','sweep','uppercut','dash','stagger','ko']){
    let saves=0, polygons=0, shapes=0;
    const noop=()=>{};
    const ctx={globalAlpha:1,save(){saves++;},restore(){saves--;},translate:noop,scale:noop,rotate:noop,beginPath:noop,
      moveTo:noop,lineTo:noop,quadraticCurveTo:noop,bezierCurveTo:noop,closePath(){polygons++;},stroke:noop,fill(){shapes++;},ellipse:noop,arc:noop};
    drawArcadeFighter(ctx,{x:300,y:400,action,actionTime:.25,actionDuration:.45,team:0,id:3,hp:action==='ko'?0:100},1);
    assert.equal(saves,0);
    assert.ok(polygons>=9 && shapes>=10);
  }
});
test('the same team can choose either human silhouette and retain team color',()=>{
  const male=pose({team:0,body:'femboy',face:0});
  const female=pose({team:0,body:'woman',face:0});
  assert.equal(male.type.id,'femboy');
  assert.equal(female.type.id,'woman');
  assert.deepEqual(male.palette,female.palette);
  assert.ok(female.type.hip>male.type.hip);
  assert.ok(female.type.waist < male.type.waist);
  assert.ok(female.head.y < male.head.y);
});
test('seven lore-informed forms have distinct stances and blade paths',()=>{
  const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
  const options={face:0,body:'femboy',team:0};
  const angles=forms.map(form=>pose({form,...options}).blade);
  assert.equal(new Set(angles.map(b=>JSON.stringify(b))).size,7);
  const slash={...options,action:'slash',actionTime:.18,actionDuration:.285,combo:1};
  const samples=forms.map(form=>pose({...slash,form}));
  assert.equal(new Set(samples.map(s=>JSON.stringify(s.blade))).size,7);
  assert.ok(samples[3].hop>3);
  assert.ok(samples[2].hop===0);
  const niman=pose({...options,form:'niman',action:'force',actionTime:.22,actionDuration:.44});
  assert.ok(niman.backHand.x>niman.hand.x+35);
  const ataru=pose({...options,form:'ataru',action:'rush',technique:'vault',actionTime:.19,actionDuration:.43});
  assert.ok(ataru.hop>30);
});
test('authored contact shows a forward thrust and its entry/exit matches the chosen guard',()=>{
  const f={face:0,form:'makashi',action:'rush',technique:'thrust',actionDuration:.41,
    attackSpec:{contact:.187,duration:.41}};
  const waiting=pose({...f,action:'idle',actionTime:0},0);
  const start=pose({...f,actionTime:0},0),finish=pose({...f,actionTime:.41},0);
  for(const key of ['hand','head','backHand']) {
    assert.deepEqual(start[key],waiting[key]);
    assert.deepEqual(finish[key],waiting[key]);
  }
  const hit=pose({...f,actionTime:.187},0);
  assert.ok(hit.blade.x-hit.hand.x>49);
  assert.ok(hit.blade.x-start.blade.x>41);
});
test('ghost uses no bloom, shadow, or selection rings and honors caller opacity',()=>{
  let depth=0;const calls=[];
  const noop=()=>{};
  const ctx={globalAlpha:.24,save(){depth++;},restore(){depth--;},translate:noop,scale:noop,rotate:noop,
    beginPath:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,bezierCurveTo:noop,closePath:noop,
    stroke(){calls.push({alpha:this.globalAlpha,blend:this.globalCompositeOperation});},
    fill(){calls.push({alpha:this.globalAlpha,blend:this.globalCompositeOperation});},ellipse:noop,arc:noop};
  drawArcadeFighter(ctx,{body:'woman',x:400,y:200,action:'sweep',actionTime:.18,actionDuration:.54,face:.15},0,{ghost:true,selected:true});
  assert.equal(depth,0);
  assert.ok(calls.length===7 && calls.every(c=>c.alpha===.24 && c.blend!=='lighter'));
});

test('slow walking has double support and running has a short real flight phase',()=>{
  const slow=[],fast=[];
  for(let d=0;d<=106;d++){
    slow.push(+arcadeGait(d,0,0).planted+ +arcadeGait(d,1,0).planted);
    fast.push(+arcadeGait(d,0,1).planted+ +arcadeGait(d,1,1).planted);
  }
  assert.ok(slow.filter(x=>x===2).length>23);
  assert.ok(slow.every(x=>x>=1));
  assert.ok(fast.filter(x=>x===0).length>=10 && fast.filter(x=>x===0).length<=16);
  assert.ok(fast.every(x=>x<=1));
  assert.equal(pose({action:'walk',vx:100}).gait,'walk');
  assert.equal(pose({action:'run',vx:180}).gait,'run');
});
test('grounded uppercuts stay grounded; actual jump uses height, charge and landing compression',()=>{
  const base={action:'uppercut',technique:'riposte',form:'djem_so',actionTime:.3,actionDuration:.6,face:0};
  const ground=pose({...base,airPhase:'grounded',airHeight:0});
  const charge=pose({...base,airPhase:'takeoff',airHeight:0,airProgress:.45});
  const rise=pose({...base,airPhase:'airborne',airHeight:38,airProgress:.52});
  const touchdown=pose({...base,airPhase:'landing',airHeight:0,airProgress:.25});
  assert.equal(ground.hop,0);
  assert.ok(charge.head.y>ground.head.y+5);
  assert.ok(charge.legs.every(leg=>leg.planted));
  assert.equal(rise.hop,38);
  assert.equal(rise.roll,0);
  assert.ok(rise.legs.every(leg=>!leg.planted));
  assert.equal(touchdown.hop,0);
  assert.ok(touchdown.head.y>ground.head.y+5);
  assert.equal(pose({...base,airPhase:'airborne',airHeight:38,airProgress:.52},0,{reducedMotion:true}).hop,38);
});
test('world blade projection follows real jump height and does not move the simulation',()=>{
  const f=Object.freeze({x:520,y:330,form:'ataru',action:'rush',technique:'vault',actionTime:.25,actionDuration:.53,
    airPhase:'airborne',airHeight:38,airProgress:.5,face:.3});
  const r=pose(f,.78), world=arcadeBladeWorld(f,r);
  assert.ok(world.tip.y < f.y-r.hop);
  assert.equal(r.trick.kind,'vault-flip');
  assert.ok(r.trick.angle>Math.PI && r.trick.angle<Math.PI+.25);
  assert.ok(Math.abs(Math.hypot(world.tip.x-world.hand.x,world.tip.y-world.hand.y)-
    Math.hypot(r.blade.x-r.hand.x,r.blade.y-r.hand.y)*r.type.scale)<1e-8);
});

test('Ataru’s actual vault completes a single air-only forward flip and unfolds to land',()=>{
  const vault={x:500,y:305,action:'rush',technique:'vault',form:'ataru',actionTime:.42,actionDuration:.92,face:0};
  const rigs=Array.from({length:71},(_,i)=>{
    const progress=(i+1)/72;
    return pose({...vault,airPhase:'airborne',airHeight:53*4*progress*(1-progress),airProgress:progress});
  });
  for(let i=1;i<rigs.length;i++){
    assert.ok(rigs[i].trick.angle>=rigs[i-1].trick.angle);
    assert.ok(rigs[i].trick.angle-rigs[i-1].trick.angle<.23);
  }
  assert.equal(rigs[0].trick.angle,0);
  assert.ok(rigs[34].trick.tuck>.96);
  assert.ok(Math.cos(rigs[34].trick.angle)<-.9);
  assert.ok(Math.abs(rigs.at(-1).trick.angle-Math.PI*2)<1e-9);
  for(const airPhase of ['grounded','takeoff','landing']){
    const r=pose({...vault,airPhase,airProgress:.5,airHeight:0});
    assert.equal(r.trick.kind,null); assert.equal(r.hop,0);
  }
});
test('confirmed Ataru parry follow-up turns in the opposite direction; ordinary dodges and other forms do not',()=>{
  const f={action:'dash',technique:'vault_step',form:'ataru',airPhase:'airborne',airHeight:32,airProgress:.5,
    actionTime:.24,actionDuration:.54,face:0};
  const dodge=pose(f);
  assert.equal(dodge.trick.kind,null);
  const follow=pose({...f,airTrick:'parry_flip'});
  assert.equal(follow.trick.kind,'parry-flip');
  assert.ok(Math.abs(follow.trick.angle+Math.PI)<1e-9);
  for(const form of ['makashi','soresu','djem_so','niman','juyo','shii_cho']){
    const r=pose({...f,form,airTrick:'parry_flip'});
    assert.equal(r.trick.kind,null);
    assert.equal(r.trick.angle,0);
  }
  const accessible=pose({...f,airTrick:'parry_flip'},0,{reducedMotion:true});
  assert.equal(accessible.trick.angle,0);
  assert.equal(accessible.hop,32);
});

test('Jar’Kai draws a shorter attached blade whose forward cut waits for the actual offhand contact',()=>{
  const f={face:0,form:'niman',action:'slash',attack:'slash',actionDuration:.75,
    actionTime:.24,attackSpec:{contact:.24,offhand:{contact:.34}}};
  assert.equal(pose(f).offBlade,null);
  const dual={...f,gear:{dualSabers:true}};
  const first=pose(dual),follow=pose({...dual,actionTime:.34});
  assert.ok(first.offActive<.15);
  assert.ok(follow.offActive>.99);
  assert.ok(follow.offBlade.x-follow.backHand.x>34);
  assert.ok(Math.hypot(follow.offBlade.x-follow.backHand.x,follow.offBlade.y-follow.backHand.y)<
    Math.hypot(follow.blade.x-follow.hand.x,follow.blade.y-follow.hand.y));
  const points=arcadeBladeWorld(dual,follow);
  assert.ok(points.offhand.tip.x>points.offhand.hand.x);
});

test('clash holds the actual measured crossing, preserves blade length, and then recoils into guard',()=>{
  const f={id:'a',x:435,y:322,face:0,form:'djem_so',action:'clash',actionDuration:.46,
    airPhase:'grounded',airHeight:0,clashRole:'attacker',
    clashX:486,clashY:273,clashFrom:{hand:{x:454,y:278},tip:{x:501,y:270.65625}}};
  const rigAt=p=>pose({...f,actionTime:p*f.actionDuration},1.22);
  const bladeAt=p=>arcadeBladeWorld(f,rigAt(p));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const length=dist(f.clashFrom.hand,f.clashFrom.tip);
  const first=bladeAt(0);
  assert.ok(dist(first.hand,f.clashFrom.hand)<1e-8 && dist(first.tip,f.clashFrom.tip)<1e-8);
  for(const p of [.15,.24,.34]){
    const rig=rigAt(p),blade=bladeAt(p),q=rig.clash.point;
    assert.equal(rig.clash.bound,true);
    assert.ok(Math.abs(dist(blade.hand,blade.tip)-length)<1e-8);
    assert.ok(Math.abs(dist(blade.hand,q)+dist(q,blade.tip)-length)<1e-8);
  }
  assert.ok(bladeAt(.62).hand.x<bladeAt(.28).hand.x-9);
  const idle={...f,action:'idle',actionDuration:0,actionTime:0};
  const settled=arcadeBladeWorld(idle,pose(idle,1.22));
  assert.ok(dist(bladeAt(1).tip,settled.tip)<1e-8);
});
test('airborne bind keeps real height and pins only the marked offhand blade',()=>{
  const f={x:510,y:315,face:.31,form:'ataru',action:'clash',actionDuration:.44,actionTime:.11,
    airPhase:'airborne',airHeight:33,airProgress:.49,gear:{dualSabers:true},clashRole:'defender',
    clashX:544,clashY:242,clashFrom:{hand:{x:523,y:252},tip:{x:556,y:236.25},offhand:true}};
  const r=pose(f,3), blades=arcadeBladeWorld(f,r), q=r.clash.point;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.equal(r.hop,33);
  assert.ok(Math.abs(dist(blades.offhand.hand,q)+dist(q,blades.offhand.tip)-dist(blades.offhand.hand,blades.offhand.tip))<1e-8);
  assert.ok(dist(blades.tip,q)>2);
});

test('body rims precede the original cel layers, keep team colors, and skip KO and ghosts',()=>{
  const calls=[];
  class ProbePath {
    count=0;
    addPath(){this.count++;}
    moveTo(){this.count++;} lineTo(){} quadraticCurveTo(){} bezierCurveTo(){} ellipse(){} closePath(){}
  }
  const noop=()=>{};
  const ctx={globalAlpha:1,save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,
    moveTo:noop,lineTo:noop,quadraticCurveTo:noop,bezierCurveTo:noop,ellipse:noop,arc:noop,closePath:noop,
    fill(path){calls.push({op:'fill',color:this.fillStyle,path});},
    stroke(path){calls.push({op:'stroke',color:this.strokeStyle,path,width:this.lineWidth});}};
  const pathFactory=()=>new ProbePath();
  const actor={id:'a',x:200,y:300,team:0,body:'femboy',action:'idle',face:0,hp:100};
  drawArcadeFighter(ctx,actor,1,{pathFactory,crowded:true});
  const rim=calls.findIndex(c=>c.color==='#b5fcf5'&&c.path?.count>0);
  const seam=calls.findIndex(c=>c.color==='#060914'&&c.path?.count>0);
  const skin=calls.findIndex(c=>c.color==='#ebded1'&&c.op==='fill');
  assert.ok(rim>=0&&seam>rim&&skin>seam);
  calls.length=0;
  drawArcadeFighter(ctx,{...actor,team:1},1,{pathFactory});
  assert.ok(calls.some(c=>c.color==='#b3a699'&&c.path?.count>0));
  calls.length=0;
  drawArcadeFighter(ctx,{...actor,hp:0,action:'ko',actionTime:.99,actionDuration:1},1,{pathFactory,crowded:true});
  drawArcadeFighter(ctx,actor,1,{pathFactory,crowded:true,ghost:true});
  assert.ok(calls.every(c=>!c.path?.count));
});

test('backhand blades trail the wrist at rest and turn forward on the real attack beat',()=>{
  const base={face:0,x:50,y:90,form:'makashi',hp:50};
  const gear={weapon:'single',grip:'backhand'};
  const a=arcadeBladeWorld(base,pose(base)), b=arcadeBladeWorld(base,pose({...base,gear}));
  assert.ok(b.tip.x<b.hand.x && b.tip.y>b.hand.y);
  assert.notDeepEqual(a.tip,b.tip);
  const attack={...base,gear,action:'rush',actionTime:.306,actionDuration:.721,attackSpec:{contact:.306}};
  const cut=arcadeBladeWorld(attack,pose(attack));
  assert.ok(cut.tip.x>cut.hand.x+42);
  const dual={...base,gear:{weapon:'dual',grip:'backhand'}};
  const both=arcadeBladeWorld(dual,pose(dual));
  assert.deepEqual(both.blades.map(blade=>blade.id),['main','off']);
  assert.ok(both.offhand.tip.x<both.offhand.hand.x && both.offhand.tip.y>both.offhand.hand.y);
});

test('staff front and rear stay on one rigid axis throughout attack and rear bind',()=>{
  const f={face:.54,x:220,y:310,hp:100,form:'shii_cho',
    gear:{weapon:'staff',grip:'forward'},action:'sweep',attackSpec:{contact:.42,offhand:{contact:.60}},actionDuration:.90};
  const verify=(a,b)=>{
    const v=Math.hypot(a.tip.x-a.hand.x,a.tip.y-a.hand.y),w=Math.hypot(b.tip.x-b.hand.x,b.tip.y-b.hand.y);
    assert.ok(Math.abs(v-w)<1e-7);
    const cross=(a.tip.x-a.hand.x)*(b.tip.y-b.hand.y)-(a.tip.y-a.hand.y)*(b.tip.x-b.hand.x);
    assert.ok(Math.abs(cross)<1e-7);
    assert.ok(Math.hypot(a.hand.x-b.hand.x,a.hand.y-b.hand.y)>20);
  };
  for(const time of [.01,.25,.42,.54,.60,.78,.895]){
    const input={...f,actionTime:time};
    const world=arcadeBladeWorld(input,pose(input));
    assert.deepEqual(world.blades.map(x=>x.id),['main','rear']);
    verify(...world.blades);
  }
  const source=arcadeBladeWorld(f,pose({...f,actionTime:.60})).offhand;
  const bind={...f,action:'clash',clashX:source.tip.x+3,clashY:source.tip.y+2,
    clashFrom:{...source,offhand:true},actionTime:.15,actionDuration:.60};
  const rig=pose(bind),world=arcadeBladeWorld(bind,rig);
  assert.ok(rig.clash.bound);
  verify(...world.blades);
  const dx=world.offhand.tip.x-world.offhand.hand.x,dy=world.offhand.tip.y-world.offhand.hand.y;
  assert.ok(Math.abs(dx*(bind.clashY-world.offhand.hand.y)-dy*(bind.clashX-world.offhand.hand.x))<1e-7);
});

test('dual phase extends every actual blade immediately without changing the emitter or grip',()=>{
  for(const weapon of ['single','dual','staff']){
    for(const grip of ['forward','backhand']){
      const f={x:105,y:141,face:.94,hp:100,form:'makashi',gear:{weapon,grip,dualPhase:true}};
      const short=arcadeBladeWorld(f,pose(f,10));
      const longF={...f,saberPhase:'long',saberPhaseChangedAt:10};
      const longRig=pose(longF,10);
      const long=arcadeBladeWorld(longF,longRig);
      assert.equal(short.phase,'short');assert.equal(long.phase,'long');
      assert.equal(longRig.ignition,1);
      assert.equal(pose(longF,10,{reducedMotion:true}).ignition,0);
      assert.equal(pose(longF,10.181).ignition,0);
      for(let i=0;i<short.blades.length;i++){
        const a=short.blades[i],b=long.blades[i];
        const length=q=>Math.hypot(q.tip.x-q.hand.x,q.tip.y-q.hand.y);
        assert.ok(Math.hypot(a.hand.x-b.hand.x,a.hand.y-b.hand.y)<1e-8);
        assert.ok(Math.abs(length(b)/length(a)-ARCADE_LONG_BLADE_SCALE)<1e-8);
      }
      assert.equal(pose({...longF,gear:{weapon,grip,dualPhase:false}},10).saberPhase,'short');
    }
  }
});

test('multi-saber endpoints stay full-length for every facing and join continuously to neutral',()=>{
  const length=b=>Math.hypot(b.tip.x-b.hand.x,b.tip.y-b.hand.y);
  const gap=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  for(const weapon of ['staff','dual'])for(const grip of ['forward','backhand']){
    for(const form of ['makashi','ataru','juyo','soresu']){
      for(let face=0;face<2*Math.PI;face+=.33){
        const f={gear:{weapon,grip},face,form,x:350,y:212,actionDuration:.9};
        const rig=(action,actionTime)=>{
          const input={...f,action,actionTime,attackSpec:{contact:.40,offhand:{contact:weapon==='staff'?.40:.62}}};
          return arcadeBladeWorld(input,pose(input,1));
        };
        const idle=rig('idle',0), first=rig('sweep',0), last=rig('sweep',.9);
        for(let i=0;i<first.blades.length;i++){
          assert.ok(gap(idle.blades[i].tip,first.blades[i].tip)<2);
          assert.ok(gap(idle.blades[i].tip,last.blades[i].tip)<2);
        }
        let prev=first;
        for(let t=.01;t<.9;t+=.01){
          const next=rig('sweep',t);
          for(let i=0;i<next.blades.length;i++){
            assert.ok(length(next.blades[i])>35);
            assert.ok(gap(prev.blades[i].tip,next.blades[i].tip)<17,`${weapon} ${grip} ${form} ${face} ${t} ${i}`);
          }
          prev=next;
        }
      }
    }
  }
});

test('directional guards and harmless blade feints read distinctly for every weapon kit',()=>{
  const f={x:200,y:300,face:0,form:'makashi',alive:true,actionDuration:.32};
  for(const gear of [{weapon:'single'},{weapon:'single',grip:'backhand'},
    {weapon:'dual'},{weapon:'dual',grip:'backhand'},{weapon:'staff'}]){
    const left=pose({...f,gear,action:'guard',guardLane:'left',guardBearing:-.70});
    const right=pose({...f,gear,action:'guard',guardLane:'right',guardBearing:.70});
    assert.ok(right.hand.y>left.hand.y+4);
    const show=pose({...f,gear,action:'feint',feintBearing:.70,actionTime:.09});
    const pull=pose({...f,gear,action:'feint',feintBearing:.70,actionTime:.212});
    assert.equal(show.action,'feint');assert.equal(show.trail,0);assert.equal(show.offTrail,0);
    assert.ok(show.hand.x>pull.hand.x+8);
    assert.equal(show.hop,0);
  }
});

test('rabbit duelist uses cosmetic ears and retains the same physical rig',()=>{
  const base={x:420,y:330,face:.86,team:1,form:'ataru',action:'rush',technique:'vault',
    actionTime:.43,actionDuration:.92,airPhase:'airborne',airProgress:.45,airHeight:37,
    gear:{weapon:'staff'}};
  const rabbit=pose({...base,body:'rabbit'},1), regular=pose({...base,body:'femboy'},1);
  assert.equal(rabbit.type.id,'rabbit');
  assert.deepEqual(rabbit.legs,regular.legs);
  assert.deepEqual(arcadeBladeWorld(base,rabbit),arcadeBladeWorld(base,regular));
});

test('seven real aerial poses are distinct, land without sliding and do not alter projected blade contacts',()=>{
  const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
  const signatures=new Set(), joints=new Set();
  for(const form of forms){
    const f={form,x:360,y:200,face:.12,action:'idle',airPhase:'airborne',airHeight:26,airProgress:.5};
    const mid=pose(f,.4); signatures.add(mid.airStyle);
    joints.add(JSON.stringify(mid.legs.map(l=>[Math.round(l.foot.x),Math.round(l.foot.y),Math.round(l.k.y)])));
    assert.equal(mid.hop,26);
    assert.ok(mid.legs.every(l=>!l.planted));
    const land={...f,airPhase:'landing',airHeight:0};
    const start=pose({...land,airProgress:0},.4), end=pose({...land,airProgress:1},.4);
    assert.deepEqual(start.legs.map(l=>l.foot),end.legs.map(l=>l.foot));
    const planted=pose({...land,airProgress:.5},.4);
    assert.deepEqual(planted.legs.map(l=>l.foot),start.legs.map(l=>l.foot));
    assert.ok(planted.legs.every(l=>l.planted));
    const zero=pose({...f,airProgress:0},.4);
    assert.equal(arcadeBladeWorld(f,mid).blades.length,arcadeBladeWorld(f,zero).blades.length);
  }
  assert.equal(signatures.size,7);assert.equal(joints.size,7);
});


test('an actual Ataru corkscrew renders only during confirmed jump flight',()=>{
  const f={form:'ataru',action:'jump',jumpKind:'corkscrew',airPhase:'airborne',airHeight:37,airProgress:.52};
  assert.equal(pose(f).trick.kind,'corkscrew');
  assert.equal(pose({...f,airPhase:'takeoff',airHeight:0}).trick.kind,null);
  assert.equal(pose({...f,form:'makashi'}).trick.kind,null);
});

test('actual jump carries seven different saber angles without drawing attack trails',()=>{
  const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
  const base={action:'jump',jumpKind:'bound',airHeight:29,airPhase:'airborne',airProgress:.50,
    actionTime:.3,actionDuration:.65,face:0};
  for(const gear of [{weapon:'single'},{weapon:'dual',grip:'backhand'},{weapon:'staff'}]){
    const angles=forms.map(form=>{
      const f={...base,form,gear}, r=pose(f);
      assert.equal(r.trail,0);assert.equal(r.offTrail,0);
      const b=arcadeBladeWorld(f,r);
      return Math.round(Math.atan2(b.tip.y-b.hand.y,b.tip.x-b.hand.x)*10);
    });
    assert.equal(new Set(angles).size,7);
  }
});

test('turning through both depth axes retains full single saber length and continuous tip',()=>{
  for(const grip of ['forward','backhand']){
    const f={gear:{weapon:'single',grip},x:360,y:190,form:'makashi'};
    let prior, span;
    for(let i=0;i<=360;i++){
      const input={...f,face:i*Math.PI/180}, rig=pose(input), blade=arcadeBladeWorld(input,rig);
      const len=Math.hypot(blade.tip.x-blade.hand.x,blade.tip.y-blade.hand.y);
      span??=len;
      assert.ok(Math.abs(len-span)<1e-7);
      if(prior)assert.ok(Math.hypot(blade.tip.x-prior.tip.x,blade.tip.y-prior.tip.y)<4);
      prior=blade;
    }
  }
});

test('air-facing continuity never reverses corkscrew when a fighter turns',()=>{
  const f={x:320,y:260,form:'ataru',action:'jump',jumpKind:'corkscrew',airFacing:.40,
    airPhase:'airborne',airHeight:38,airProgress:.65,actionTime:.42,actionDuration:.71};
  const a=pose({...f,face:Math.PI*.5-.10}), b=pose({...f,face:Math.PI*.5+.10});
  assert.notEqual(a.hdx,b.hdx);
  assert.equal(a.flightSide,b.flightSide);
  assert.equal(a.trick.angle,b.trick.angle);
  const p=arcadeBladeWorld(f,a),q=arcadeBladeWorld(f,b);
  assert.ok(Math.hypot(p.tip.x-q.tip.x,p.tip.y-q.tip.y)<24);
});

test('stance flow turns linked repeats from measured entry into alternating grounded loads',()=>{
  const f={id:'chain',x:300,y:250,face:0,form:'shii_cho',peasantMotion:true,action:'slash',attack:'open_cut',
    actionTime:.18,actionDuration:.42,attackSpec:{contact:.18},chainFrom:'open_cut'};
  const measured=(depth,stanceFlow)=>pose({...f,chainDepth:depth,stanceFlow},1);
  const [oldSecond,oldThird,newSecond,newThird]=[measured(2,false),measured(3,false),measured(2,true),measured(3,true)];
  assert.equal(oldSecond.lean,oldThird.lean);
  assert.ok(newSecond.lean<oldSecond.lean*.42);
  assert.ok(newThird.lean<oldThird.lean*.68);
  assert.ok(newSecond.torsoTurn<-.27&&newThird.torsoTurn>.27);
  assert.ok(newSecond.bend<newThird.bend);
});

test('stance flow carries a side-loaded aerial launch into its real blade and leg positions',()=>{
  const f={id:'air',x:310,y:260,face:0,form:'shii_cho',peasantMotion:true,action:'jump',
    jumpKind:'bound',airFacing:0,airPhase:'airborne',airProgress:.28,airHeight:31,actionTime:.12,actionDuration:.5};
  const prior=pose(f,1), world=arcadeBladeWorld(f,prior), oldFeet=arcadeFeetWorld(f,prior);
  const entry={...world,origin:{x:f.x,y:f.y},facing:f.face,kind:'air',
    body:{lean:prior.lean,bend:prior.bend,wide:prior.wide,torsoTurn:prior.torsoTurn,roll:prior.roll,airPhase:'airborne'},
    legs:oldFeet};
  const attack={...f,action:'slash',actionTime:0,actionDuration:.36,technique:'air_cut',attack:'air_cut',airStrike:'air_cut',
    attackSpec:{contact:.16},poseFrom:entry,poseEntryDuration:.12};
  const old=pose(attack,1),current=pose({...attack,stanceFlow:true},1);
  const stanceFeet=arcadeFeetWorld(attack,current),oldJumpFeet=arcadeFeetWorld(attack,old);
  const feetError=arr=>arr.reduce((sum,v)=>sum+Math.hypot(v.foot.x-oldFeet.find(p=>p.side===v.side).foot.x,v.foot.y-oldFeet.find(p=>p.side===v.side).foot.y),0);
  assert.ok(Math.abs(old.roll-prior.roll)>.02);
  assert.ok(Math.abs(current.roll-prior.roll)<1e-8);
  assert.ok(feetError(stanceFeet)<1e-8&&feetError(oldJumpFeet)>3);
  const drawn=arcadeBladeWorld(attack,current);
  assert.ok(Math.hypot(drawn.tip.x-world.tip.x,drawn.tip.y-world.tip.y)<1e-8);
  assert.equal(current.hop,f.airHeight);
});

test('live first strike inherits run/guard torso through a turning entry and meets exact captured blade',()=>{
  for(const action of ['ready','guard']) for(const bearing of [-2.1,-.44,.9,2.8]){
    const f={id:'entry',x:250,y:300,liveEntry:true,peasantMotion:true,form:'shii_cho',face:bearing,
      vx:118,vy:-87,groundSpeed:145,groundDistance:37,airPhase:'grounded',airHeight:0,action,actionTime:.09};
    const before=pose(f,1), geom=arcadeBladeWorld(f,before), boots=arcadeFeetWorld(f,before);
    const attack={...f,face:bearing+1.76,action:'slash',attack:'open_cut',actionTime:0, actionDuration:.38,
      attackSpec:{contact:.18},poseEntryDuration:.136,poseFrom:{...geom,kind:'live_entry',origin:{x:f.x,y:f.y},
        facing:f.face,body:before,legs:boots,stride:{bearing:Math.atan2(f.vy,f.vx),vx:f.vx,vy:f.vy,kind:'lateral'}}};
    const first=pose(attack,1),legacy=pose({...attack,liveEntry:false},1);
    const diff=(x,y)=>Math.hypot(x.x-y.x,x.y-y.y);
    assert.ok(diff(first.shoulder,before.shoulder)<1e-7);
    assert.ok(diff(legacy.shoulder,before.shoulder)>1);
    assert.ok(diff(arcadeBladeWorld(attack,first).tip,geom.tip)<1e-7);
    assert.ok(arcadeFeetWorld(attack,first).every(b=>diff(b.foot,boots.find(x=>x.side===b.side).foot)<1e-7));
    let previous=first;
    for(let i=1;i<=18;i++){
      const at=pose({...attack,actionTime:i/120},1+i/120);
      assert.ok(diff(at.shoulder,previous.shoulder)<5);
      previous=at;
    }
    assert.equal(previous.bodyForward,previous.forward);
  }
});

test('contact art shows directional torso recoil and weighted catch without moving the physical blade',()=>{
  const f={id:'contact',x:250,y:300,face:0,action:'stagger',actionTime:.04,actionDuration:.26,
    impactPhysics:true,impactReaction:{at:1,bearing:Math.PI,strength:1,kind:'hard'}};
  const rig=pose(f,1.04), direction=(overrides={})=>sampleArcadeImpactPose({...f,...overrides},rig,1.044);
  const hard=direction(), left=hard.shoulder.x-rig.shoulder.x;
  const right=direction({impactReaction:{...f.impactReaction,bearing:0}}).shoulder.x-rig.shoulder.x;
  const glance=direction({impactReaction:{...f.impactReaction,kind:'glance'}}).shoulder.x-rig.shoulder.x;
  assert.ok(left<-8&&right>8&&Math.abs(glance)<Math.abs(left)*.4);
  assert.deepEqual(arcadeBladeWorld(f,hard).blades,arcadeBladeWorld(f,rig).blades);
  const catchPose=sampleArcadeImpactPose(f,rig,1.124);
  assert.equal(catchPose.legs.filter((l,i)=>l.foot.x!==rig.legs[i].foot.x).length,1);
  const fixed=sampleArcadeImpactPose(f,{...rig,reducedMotion:true},1.124);
  assert.ok(fixed.legs.every((l,i)=>l.foot.x===rig.legs[i].foot.x&&l.foot.y===rig.legs[i].foot.y));
  assert.strictEqual(direction({impactPhysics:false}),rig);
  assert.strictEqual(sampleArcadeImpactPose(f,rig,1.3),rig);
});

test('post-impact movement bridges actual painted recoil and preserves one world support without moving the saber',()=>{
  const f={id:'recovery',x:250,y:300,face:0,action:'stagger',actionTime:.184,actionDuration:.26,
    airPhase:'grounded',airHeight:0,impactPhysics:true,recoveryFlow:true,
    impactReaction:{at:1,bearing:Math.PI,strength:1,kind:'hard'}};
  const hit=sampleArcadeImpactPose(f,pose(f,1.184),1.184);
  sampleArcadeRecoveryPose(f,hit,1.184);
  const oldFeet=arcadeFeetWorld(f,hit);
  const untouched={...f,recoveryFlow:false};
  Object.assign(f,{action:'ready',x:254,face:.42,actionTime:0,impactRecovery:{at:1.2,impactAt:1,
    bearing:Math.PI,duration:.23,kind:'lateral',strength:1}});
  const neutral=pose(f,1.2), first=sampleArcadeRecoveryPose(f,neutral,1.2);
  const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.ok(delta(hit.shoulder,neutral.shoulder)>5);
  const worldShoulder=(actor,r)=>{
    const turn=(r.roll+(r.trick?.angle??0))*r.flightSide, cs=Math.cos(turn),ss=Math.sin(turn);
    const x=r.shoulder.x-r.waist.x,y=r.shoulder.y-r.waist.y;
    return {x:actor.x+(r.waist.x+x*cs-y*ss)*r.type.scale,
      y:actor.y-r.hop+(r.waist.y+x*ss+y*cs)*r.type.scale};
  };
  const old=worldShoulder(untouched,hit);
  assert.ok(delta({x:old.x+4,y:old.y},worldShoulder(f,first))<1e-8);
  assert.deepEqual(arcadeBladeWorld(f,first).blades,arcadeBladeWorld(f,neutral).blades);
  assert.ok(arcadeFeetWorld(f,first).every(l=>delta(l.foot,oldFeet.find(o=>o.side===l.side).foot)<1e-8));
  const settle=sampleArcadeRecoveryPose(f,neutral,1.235);
  const settledFeet=arcadeFeetWorld(f,settle);
  assert.equal(settledFeet.filter(l=>delta(l.foot,oldFeet.find(o=>o.side===l.side).foot)<1e-8).length,1);
  assert.strictEqual(sampleArcadeRecoveryPose(untouched,neutral,1.235),neutral);
  assert.strictEqual(sampleArcadeRecoveryPose(f,neutral,1.44),neutral);
});

test('painted saber interrupt carries each emitter without altering live strike or staff rigidity',()=>{
  for(const weapon of ['single','dual','staff'])for(const kind of ['stagger','guard','parry','dash']){
    const f={id:'cancel',x:230,y:260,face:0,action:'slash',attack:'open_cut',actionTime:.20,actionDuration:.4,
      attackSpec:{contact:.17},gear:{weapon},form:'shii_cho',recoveryFlow:true};
    const before=pose(f,1),baseline=arcadeBladeWorld(f,before);
    assert.equal(sampleArcadeBladeInterruption(f,before,1),before);
    Object.assign(f,{action:kind,attack:null,face:.78,actionTime:.015,x:f.x+1.3});
    const after=pose(f,1.01), cancel=sampleArcadeBladeInterruption(f,after,1.01);
    assert.notEqual(cancel,after);
    const old=baseline.blades,drawn=arcadeBladeWorld(f,cancel).blades;
    for(const [i,b] of drawn.entries()){
      assert.ok(Math.hypot(b.hand.x-old[i].hand.x-1.3,b.hand.y-old[i].hand.y)<1e-8);
      const size=x=>Math.hypot(x.tip.x-x.hand.x,x.tip.y-x.hand.y);
      assert.ok(Math.abs(size(b)-size(arcadeBladeWorld(f,after).blades[i]))<1e-8);
    }
    if(weapon==='staff'){
      const [a,b]=drawn, dx=a.tip.x-a.hand.x,dy=a.tip.y-a.hand.y;
      assert.ok(Math.abs(dx*(b.tip.y-b.hand.y)-dy*(b.tip.x-b.hand.x))<1e-8);
    }
    const reduced={...after,reducedMotion:true};
    assert.equal(sampleArcadeBladeInterruption(f,reduced,1.02),reduced);
    assert.equal(sampleArcadeBladeInterruption({...f,recoveryFlow:false},after,1.02),after);
    const bind={...after,action:'clash',clash:{bound:true}};
    assert.equal(sampleArcadeBladeInterruption(f,bind,1.023),bind);
  }
});

test('each form stands at rest in its own stance, shared by the battle idle and every preview',async()=>{
  const {sampleArcadeFormStance,arcadeFormStance}=await import('../dist/arcade-fighters.js');
  const {createArcade}=await import('../dist/arcade-engine.js');
  const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
  const pitch=r=>Math.atan2(r.blade.y-r.emitter.y,r.blade.x-r.emitter.x);
  const rest=(f,remember=false)=>sampleArcadeFormStance(f,pose(f,1.5),1.5,remember);
  const looks=forms.map(form=>{
    const game=createArcade({mode:'duel',seed:3,form,peasantMotion:true,liveEntry:true,recoveryFlow:true,stanceFlow:true});
    const battle=game.fighters.find(f=>f.team===0), before=JSON.stringify(battle);
    assert.equal(battle.form,form);assert.equal(battle.action,'idle');
    const shown=rest(battle);
    assert.equal(JSON.stringify(battle),before,'sampling never writes to the fighter');
    // The preview path builds a fresh idle fighter; it must draw the very same stance.
    const preview=rest({peasantMotion:true,id:battle.id,team:0,face:battle.face,form,action:'idle',actionTime:.28,actionDuration:.65,gear:{weapon:'single',grip:'forward'},x:0,y:0,liveEntry:true});
    for(const k of ['hand','backHand','shoulder','head','emitter','blade'])for(const a of ['x','y']){
      assert.ok(Number.isFinite(shown[k][a]),form+' '+k);
      assert.ok(Math.abs(shown[k][a]-preview[k][a])<1e-9,form+' preview '+k);
    }
    // The engine's own grip is left exactly as it was.
    assert.deepEqual(pose(battle,1.5).blade,pose(battle,1.5).blade);
    assert.notDeepEqual(shown.blade,pose(battle,1.5).blade,form+' rests in its stance, not the engine grip');
    // Pink mirrors Blue about the facing.
    const pink=rest({...preview,team:1,face:Math.PI});
    const turn=pitch(pink)-(Math.PI-pitch(rest({...preview,face:0})));
    assert.ok(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<1e-9,form+' mirror');
    return {form,pitch:pitch(shown),hand:shown.hand,head:shown.head};
  });
  for(let i=0;i<looks.length;i++)for(let j=i+1;j<looks.length;j++){
    const a=looks[i],b=looks[j];
    const apart=Math.abs(Math.atan2(Math.sin(a.pitch-b.pitch),Math.cos(a.pitch-b.pitch)))+Math.hypot(a.hand.x-b.hand.x,a.hand.y-b.hand.y)/20;
    assert.ok(apart>.3,`${a.form} and ${b.form} read as different stances`);
  }
  assert.equal(arcadeFormStance('Vaapad'),arcadeFormStance('juyo'));
  assert.equal(arcadeFormStance('shien'),arcadeFormStance('djem_so'));
  assert.equal(arcadeFormStance('unknown'),null);
});

test('the rest stance eases out into a strike and back after it, with the blade held',async()=>{
  const {sampleArcadeFormStance}=await import('../dist/arcade-fighters.js');
  const actor={peasantMotion:true,id:'b',team:0,face:0,form:'ataru',x:0,y:0};
  const self={actor:{}};// one fighter across frames, as the arena's display copies are
  const at=(time,extra)=>{const f={...actor,...extra,[Symbol.for('saber-pit.render-footwork')]:self};const p=pose(f,time);return {p,r:sampleArcadeFormStance(f,p,time)};};
  const idle={action:'idle',actionTime:0,actionDuration:0};
  const swing=t=>({action:'slash',actionTime:t,actionDuration:.3,combo:1});
  const span=r=>Math.hypot(r.blade.x-r.emitter.x,r.blade.y-r.emitter.y);
  const rest=at(0,idle).r;
  const early=at(.02,swing(.02)), late=at(.2,swing(.2)), back=at(.36,idle), home=at(.6,idle);
  assert.notDeepEqual(early.r.blade,early.p.blade,'still easing out of the stance');
  assert.ok(Math.abs(span(early.r)-span(early.p))<2,'blade stays attached while blending');
  assert.deepEqual(late.r,late.p,'the strike itself is the engine pose');
  assert.notDeepEqual(back.r.blade,rest.blade,'easing back in');
  assert.ok(Math.hypot(home.r.blade.x-rest.blade.x,home.r.blade.y-rest.blade.y)<1.5,'settled back in the stance');
  const reduced=sampleArcadeFormStance({...actor,...idle,id:'c'},pose({...actor,...idle},0,{reducedMotion:true}),0);
  assert.ok(Number.isFinite(reduced.blade.x));
});

test('stance hand-offs never teleport a hand or blade, and a strike is the engine blade before contact',async()=>{
  const {sampleArcadeRenderRig,sampleArcadePresentation}=await import('../dist/arcade-fighters.js');
  const {createArcade}=await import('../dist/arcade-engine.js');
  // Limits per 60 fps frame, actor-relative. The fastest single frame of a plain slash from the engine grip
  // (no stance) is 35.2 px at the grip and 82.7 px at the blade tip; walking moves under 2.5 px. A hand-off may
  // never move faster than the game's own swing already does.
  const GRIP=36, TIP=84, dt=1/60, WALK=Symbol.for('saber-pit.render-footwork');
  const base={...createArcade({mode:'duel',seed:3,peasantMotion:true,liveEntry:true,recoveryFlow:true,stanceFlow:true,styleChoreo:true,impactPhysics:true}).fighters[0]};
  const kits={single:{weapon:'single',grip:'forward'},staff:{weapon:'staff',grip:'forward'},dual:{weapon:'dual',grip:'forward',dualSabers:true},orbit:{weapon:'orbit',grip:'forward'}};
  const idle={action:'idle',actionTime:0,actionDuration:0,attack:null,attackSpec:null,attackSerial:null};
  const slash=t=>({action:'slash',actionTime:t,actionDuration:.3,attack:'slash',attackSerial:7,combo:1,attackSpec:{contact:.12}});
  const seqs={
    attackAndBack:i=>i<15?idle:i<33?slash((i-15)*dt):idle,
    guard:i=>i<15?idle:i<40?{...idle,action:'guard',actionTime:(i-15)*dt}:idle,
    dash:i=>i<15?idle:i<33?{...idle,action:'dash',actionTime:(i-15)*dt,actionDuration:.3}:idle,
    swingIntoGuard:i=>i<15?idle:i<20?slash((i-15)*dt):i<40?{...idle,action:'guard',actionTime:(i-20)*dt}:idle,
  };
  for(const form of ['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'])for(const [kit,gear] of Object.entries(kits))
  for(const face of [0,Math.PI])for(const [name,seq] of Object.entries(seqs)){
    const actor={};let last=null;
    for(let i=0;i<70;i++){
      const f={...base,form,gear,face,team:face?1:0,x:400,y:300,vx:0,vy:0,poseFrom:null,...seq(i),[WALK]:{actor}};
      const time=10+i*dt, physical=pose(f,time), r=sampleArcadeRenderRig(f,physical,time);
      const joints={hand:r.hand,backHand:r.backHand,...(kit==='orbit'?{}:{grip:r.emitter,tip:r.blade,offGrip:r.offEmitter,offTip:r.offBlade})};
      if(last)for(const [j,p] of Object.entries(joints))if(p&&last[j]){
        const step=Math.hypot(p.x-last[j].x,p.y-last[j].y), cap=/tip/i.test(j)?TIP:GRIP;
        assert.ok(step<=cap,`${form} ${kit} ${face?'pink':'blue'} ${name} frame ${i} ${j} moved ${step.toFixed(1)}px`);
      }
      // From 60% of the way to contact the drawn strike is exactly the engine's blade.
      if(f.attack&&f.actionTime>=.12*.6&&f.actionTime<=.12){
        const raw=sampleArcadePresentation(f,physical);
        assert.ok(Math.hypot(r.blade.x-raw.blade.x,r.blade.y-raw.blade.y)<1e-6,`${form} ${kit} ${name} contact blade`);
      }
      last=joints;
    }
  }
});

test('live duels never teleport a drawn hand or blade, through the fastest real moves and the known snaps',async()=>{
  const {createArcade,stepArcade}=await import('../dist/arcade-engine.js');
  const {sampleArcadeRenderRig,ARCADE_DRAWN_STEP}=await import('../dist/arcade-fighters.js');
  const {arcadeBasis}=await import('../dist/arcade-rig-projection.js');
  const flags={peasantMotion:true,liveEntry:true,recoveryFlow:true,stanceFlow:true,styleChoreo:true,impactPhysics:true,continuousCombat:true,anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,repertoireSupport:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,balancePass:true,closeChoice:true,guardCounterplay:true,weaponFlow:true};
  // Seeded duels picked from a survey of every attack the engine starts (9 forms x 4 kits x 3 seeds x 2 ranks):
  // the shortest real contact per family, and the three snaps the stance work left (an air hit landing back at
  // rest, a jump straight into an air slash, the dash carry spin). Frames run at 60 fps, both fighters drawn.
  const duels=[
    ['air hit landing',['ataru','soresu'],['single','single'],3,260],
    ['jump into slash',['niman','soresu'],['single','single'],3,460],
    ['dash spin',['soresu','soresu'],['single','single'],3,395],
    ['air strike, contact .087',['ataru','soresu'],['single','dual'],8,170],
    ['light .145 and riposte .170',['soresu','juyo'],['single','dual'],13,790],
    ['sweep .179',['shii_cho','shii_cho'],['dual','dual'],3,495],
    ['rush .155 and heavy .239',['makashi','makashi'],['dual','dual'],3,250],
    ['feint follow-up .181',['makashi','makashi'],['staff','orbit'],13,300],
    ['orbit air .089',['soresu','djem_so'],['orbit','single'],8,130],
    ['orbit sweep .184',['shii_cho','shii_cho'],['orbit','single'],3,485],
  ];
  const worst={hand:0,tip:0,head:0};let strikes=0,carriedAtContact=0;
  for(const [name,forms,kits,seed,frames] of duels){
    const game=createArcade({mode:'watch',seed,teamSizes:[1,1],teamForms:forms.map(f=>[f]),startingSaberWeapon:kits,startingRanks:['SSS+V','SSS+V'],...flags});
    const last=new Map();
    for(let frame=0;frame<=frames;frame++){
      stepArcade(game,1/120);stepArcade(game,1/120);
      for(const f of game.fighters){
        const raw=pose(f,game.time), r=sampleArcadeRenderRig(f,raw,game.time);
        // Measured on the drawn figure relative to its own root: body roll, flips and scale applied, travel and
        // hop taken out. Orbit blades fly on their own engine path and are drawn from it; only the hands are rig
        // joints there. The head is held to the hand limit, so a whole-body snap (a flip spun back) shows too.
        const {project}=arcadeBasis({x:0,y:r.hop},r), at=p=>p&&project(p);
        const joints={head:at(r.head),hand:at(r.hand),backHand:at(r.backHand),...(raw.orbitBlades?{}:{tip:at(r.blade),offTip:at(r.offBlade)})};
        const side=Math.sign(Math.cos(f.face)), prior=last.get(f.id);
        // A facing flip mirrors the figure, and a bind or knockout lands at once.
        if(prior&&f.alive&&prior.side===side&&!(raw.action!==prior.action&&['clash','ko'].includes(raw.action)))
          for(const [k,p] of Object.entries(joints))if(p&&prior.joints[k]){
            const d=Math.hypot(p.x-prior.joints[k].x,p.y-prior.joints[k].y), kind=k.endsWith('ip')?'tip':'hand';
            worst[k==='head'?'head':kind]=Math.max(worst[k==='head'?'head':kind],d);
            assert.ok(d<=ARCADE_DRAWN_STEP[kind]+.5,`${name}: ${k} moved ${d.toFixed(1)} px in one frame at ${frame} (${prior.action} > ${raw.action})`);
          }
        if(f.attack&&f.actionTime>=f.attackSpec?.contact){strikes++;
          if(r.drawnCarry>0||r.held.gripHandoff>0)carriedAtContact++;}
        last.set(f.id,{joints,side,action:raw.action});
      }
    }
  }
  assert.ok(strikes>100);
  assert.equal(carriedAtContact,0,'at and after contact the drawn blade is the engine blade');
  assert.ok(worst.tip>60&&worst.hand>20,JSON.stringify(worst));
});

test('the drawn hand, blade and head limits hold at 120 Hz, 30 Hz and with dropped frames, and contact stays exact',async()=>{
  const {createArcade,stepArcade}=await import('../dist/arcade-engine.js');
  const {sampleArcadeRenderRig,ARCADE_DRAWN_STEP}=await import('../dist/arcade-fighters.js');
  const {arcadeBasis}=await import('../dist/arcade-rig-projection.js');
  const flags={peasantMotion:true,liveEntry:true,recoveryFlow:true,stanceFlow:true,styleChoreo:true,impactPhysics:true,continuousCombat:true,anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,repertoireSupport:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,balancePass:true,closeChoice:true,guardCounterplay:true,weaponFlow:true};
  // The sim always steps 1/120 s; a drawn frame takes that many sim steps, so the sim is the same at every rate.
  const cadences=[['120 Hz',[1]],['30 Hz',[4]],['dropped frames',[2,2,6,2,8]]];
  const duels=[
    ['air hit landing',['ataru','soresu'],['single','single'],3,4.4],
    ['jump into slash',['niman','soresu'],['single','single'],3,7.7],
    ['dash spin',['soresu','soresu'],['single','single'],3,6.7],
    ['air strike, contact .087',['ataru','soresu'],['single','dual'],8,2.8],
  ];
  const limit={hand:ARCADE_DRAWN_STEP.hand,tip:ARCADE_DRAWN_STEP.tip};
  for(const [rate,steps] of cadences){
    let strikes=0,longest=0;
    for(const [name,forms,kits,seed,seconds] of duels){
      const game=createArcade({mode:'watch',seed,teamSizes:[1,1],teamForms:forms.map(f=>[f]),startingSaberWeapon:kits,startingRanks:['SSS+V','SSS+V'],...flags});
      const last=new Map(),carrying=new Map();let frame=0;
      while(game.time<seconds){
        const before=game.time;for(let s=0;s<steps[frame++%steps.length];s++)stepArcade(game,1/120);
        const frames=(game.time-before)*60;
        for(const f of game.fighters){
          const raw=pose(f,game.time),r=sampleArcadeRenderRig(f,raw,game.time);
          const {project}=arcadeBasis({x:0,y:r.hop},r),at=p=>p&&project(p);
          const joints={head:at(r.head),hand:at(r.hand),backHand:at(r.backHand),...(raw.orbitBlades?{}:{tip:at(r.blade),offTip:at(r.offBlade)})};
          const side=Math.sign(Math.cos(f.face)),prior=last.get(f.id);
          if(prior&&f.alive&&prior.side===side&&!(raw.action!==prior.action&&['clash','ko'].includes(raw.action)))
            for(const [k,p] of Object.entries(joints))if(p&&prior.joints[k]){
              const d=Math.hypot(p.x-prior.joints[k].x,p.y-prior.joints[k].y);
              // Hands and blades are held to a speed: the 60 fps limit, scaled by how long the frame is. The head
              // carries no layer of its own, so it is held to the 60 fps step, scaled only for frames over 1/60 s.
              const most=k==='head'?ARCADE_DRAWN_STEP.hand*Math.max(1,frames):limit[k.endsWith('ip')?'tip':'hand']*frames;
              assert.ok(d<=most+.5,`${rate}, ${name}: ${k} moved ${d.toFixed(1)} px in a ${(frames/60*1000).toFixed(1)} ms frame at ${game.time.toFixed(3)} s (${prior.action} > ${raw.action})`);
            }
          if(f.attack&&f.actionTime>=f.attackSpec?.contact){strikes++;
            assert.ok(!(r.drawnCarry>0)&&!(r.held.gripHandoff>0),`${rate}, ${name}: carried at contact`);}
          // A carry always settles: none outlasts the longest ease (120 ms) by more than a frame.
          if(r.drawnCarry>0){if(!carrying.has(f.id))carrying.set(f.id,game.time);longest=Math.max(longest,game.time-carrying.get(f.id));}
          else carrying.delete(f.id);
          last.set(f.id,{joints,side,action:raw.action});
        }
      }
    }
    assert.ok(strikes>20,`${rate}: ${strikes} contact frames`);
    assert.ok(longest<=.12+4/60,`${rate}: a carry lasted ${longest.toFixed(3)} s`);
  }
});

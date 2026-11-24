import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARENA_MOTION_FLOW} from '../dist/arcade-motion-flow.js';
import {arcadeBladeWorld,arcadeFeetWorld,sampleArcadeFighter,sampleArcadeRenderRig} from '../dist/arcade-fighters.js';

const dt=1/120;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function run(form,kit,max=550){
  const fight=createArcade({
    seed:11237,mode:'duel',form,teamSizes:[1,1],teamForms:[form,'soresu'],
    startingSaberWeapon:[kit,'single'],startingRanks:['SSS+V','SSS+V'],
    liveEntry:true,stanceFlow:true,peasantMotion:true,recoveryFlow:true,impactPhysics:true,
    fluidFootwork:true,weaponFlow:true,activeFootwork:true,anticipatingCombat:true,
    continuousCombat:true,motionFlow:ARENA_MOTION_FLOW,
  });
  const [f,e]=fight.fighters;
  Object.assign(f,{x:390,y:360});
  Object.assign(e,{x:1000,y:600,action:'stagger',actionDuration:50});
  const frames=[];
  for(let i=0;i<=max;i++){
    const move=i<60?{x:1,walk:true}:i<106?{x:1}:i<141?{y:-1}:i<173?{x:-1}:i<196?{}:i<222?{x:-1}:i<284?{x:1}:i<380?{y:1}:{};
    stepArcade(fight,dt,{...move,aimX:850,aimY:300,guard:i>=117&&i<136,
      strike:i===82||i===210||i===269,jump:i===251||i===472,dash:i===307});
    const p=sampleArcadeFighter(f,fight.time);
    const r=sampleArcadeRenderRig(f,p,fight.time);
    const raw=arcadeBladeWorld(f,p).blades;
    const painted=arcadeBladeWorld(f,r).blades;
    assert.equal(r.hop,p.hop);
    assert.deepEqual(arcadeBladeWorld(f,sampleArcadeFighter(f,fight.time)).blades,raw);
    if(f.attack)assert.deepEqual(painted,raw);
    frames.push({phase:r.airPhase,action:r.action,x:f.x,y:f.y,hop:p.hop,
      feet:arcadeFeetWorld(f,r).sort((a,b)=>a.side-b.side),raw,painted});
  }
  return frames;
}
test('Ataru dash follows its actual takeoff speed without dumping the painted sole handoff',()=>{
  const frames=run('ataru','dual',323);
  const prior=frames[315], current=frames[316];
  assert.equal(current.action,'dash');
  assert.equal(prior.phase,'takeoff');
  assert.equal(current.phase,'airborne');
  assert.ok(distance(prior,current)>2.7);
  assert.ok(frames[317].hop>3);
  for(let i=316;i<=322;i++){
    const A=frames[i-1],B=frames[i];
    assert.ok(B.feet.every((foot,j)=>distance(foot.foot,A.feet[j].foot)<18),String(i));
  }
  for(let i=315;i<=320;i++)assert.deepEqual(frames[i].painted,frames[i].raw);
});

test('passive Juyo jump blade reposes ease away from the antipode while preserving angular length and eventual target',()=>{
  const frames=run('juyo','single');
  const blur=(field,i)=>distance(frames[i-1][field][0].tip,frames[i][field][0].tip);
  for(const seam of [477,506]){
    assert.ok(blur('raw',seam)>75);
    assert.equal(frames[seam].action,'jump');
    for(let i=seam;i<seam+15;i++){
      const {raw:[a],painted:[b]}=frames[i];
      assert.ok(Math.abs(distance(a.hand,a.tip)-distance(b.hand,b.tip))<1e-6);
      assert.ok(blur('painted',i)<34,String(i));
    }
    assert.ok(distance(frames[seam+15].painted[0].tip,frames[seam+15].raw[0].tip)<.7);
  }
});

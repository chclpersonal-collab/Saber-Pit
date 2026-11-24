import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARENA_MOTION_FLOW} from '../dist/arcade-motion-flow.js';
import {arcadeBasis} from '../dist/arcade-rig-projection.js';
import {arcadeBladeWorld,sampleArcadeFighter,sampleArcadeImpactPose,sampleArcadePresentation,sampleArcadeRenderRig} from '../dist/arcade-fighters.js';

const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const dt=1/120;
const flags={liveEntry:true,stanceFlow:true,peasantMotion:true,recoveryFlow:true,impactPhysics:true,
  fluidFootwork:true,weaponFlow:true,activeFootwork:true,anticipatingCombat:true,continuousCombat:true,
  motionFlow:ARENA_MOTION_FLOW};
const localToRoot=(f,r,key)=>{const p=arcadeBasis(f,r).project(r[key]);return {x:p.x-f.x,y:p.y-f.y};};

test('contact recoil remains directional without double-rotating the last painted pose in a live match',()=>{
  const game=createArcade({
    seed:1,mode:'watch',teamSizes:[3,3],startingRanks:['SSS+V','SSS+V'],
    teamForms:[['juyo','ataru','soresu'],['makashi','shii_cho','djem_so']],...flags,
  });
  const f=game.fighters.find(q=>q.id==='0-1');
  let last, maxAfter=0, advance=0;
  for(let i=0;i<=225;i++){
    stepArcade(game,dt);
    const physical=sampleArcadeFighter(f,game.time), rendered=sampleArcadeRenderRig(f,physical,game.time);
    if(f.attack)assert.deepEqual(arcadeBladeWorld(f,rendered).blades,arcadeBladeWorld(f,sampleArcadePresentation(f,physical)).blades);
    const pose={head:localToRoot(f,rendered,'head'),shoulder:localToRoot(f,rendered,'shoulder')};
    if(i===213){
      assert.equal(physical.action,'hit');
      assert.equal(f.impactReaction.kind,'glance');
      assert.ok(d(pose.head,last.head)<8,'head seam smaller despite true hit rotation');
      assert.ok(d(pose.shoulder,last.shoulder)<9,'actual shoulder is visually anchored before recoil');
    }
    if(i>213){maxAfter=Math.max(maxAfter,d(pose.head,last.head));advance+=d(pose.head,last.head);}
    last=pose;
  }
  assert.ok(maxAfter<9,'did not merely delay the snap by one frame');
  assert.ok(advance>1,'recoil and recovery still visible');
});

test('the observed Ataru wrist seam preserves the live corkscrew, both hilts, and active release',()=>{
  const game=createArcade({
    seed:11237,mode:'duel',form:'ataru',teamSizes:[1,1],teamForms:['ataru','soresu'],
    startingSaberWeapon:['dual','single'],startingSaberGrip:['forward','forward'],
    startingRanks:['SSS+V','SSS+V'],...flags,
  });
  const [f,e]=game.fighters;
  Object.assign(f,{x:390,y:360});Object.assign(e,{x:1000,y:600,action:'stagger',actionDuration:50});
  let last,largest=0;
  for(let i=0;i<=534;i++){
    const move=i<60?{x:1,walk:true}:i<106?{x:1}:i<141?{y:-1}:i<173?{x:-1}:i<196?{}:i<222?{x:-1}:i<284?{x:1}:i<380?{y:1}:{};
    stepArcade(game,dt,{...move,aimX:850,aimY:300,guard:i>=117&&i<136,
      strike:i===82||i===210||i===269,jump:i===251||i===472,dash:i===307});
    const physical=sampleArcadeFighter(f,game.time), paint=sampleArcadeRenderRig(f,physical,game.time);
    const raw=arcadeBladeWorld(f,sampleArcadePresentation(f,physical)).blades, art=arcadeBladeWorld(f,paint).blades;
    assert.equal(paint.hop,physical.hop);
    assert.equal(paint.trick,physical.trick);
    if(f.attack)assert.deepEqual(art,raw);
    if(i>=521){
      assert.ok(art.every((b,j)=>d(b.hand,raw[j].hand)<1e-7),'both moving hilts stay authoritative');
      assert.ok(art.every((b,j)=>Math.abs(d(b.hand,b.tip)-d(raw[j].hand,raw[j].tip))<1e-7),'blade lengths stay exact');
      largest=Math.max(largest,d(art[0].tip,last.art[0].tip));
    }
    if(i===521){
      assert.equal(physical.trick.kind,'corkscrew');
      assert.ok(physical.trick.angle-last.twist>.23);
      assert.ok(d(raw[0].tip,last.raw[0].tip)>75);
      assert.ok(d(art[0].tip,last.art[0].tip)<14);
      assert.deepEqual(art[1],raw[1]);
    }
    last={art,raw,twist:physical.trick.angle};
  }
  assert.ok(largest<25,'correction did not defer the jump to a later frame');
});

test('a verified hard contact produces bounded directional robe follow-through, disabled in reduced motion',()=>{
  const duel=createArcade({mode:'duel',teamSizes:[1,1],...flags});
  const f=duel.fighters[0], t=1.09;
  const sample=(kind,bearing,reducedMotion=false)=>{
    Object.assign(f,{action:'hitstun',actionTime:.06,actionDuration:.2,impactReaction:{kind,at:1,bearing,strength:1}});
    const raw=sampleArcadeFighter(f,t,{reducedMotion}), art=sampleArcadeImpactPose(f,raw,t);
    assert.deepEqual(arcadeBladeWorld(f,raw).blades,arcadeBladeWorld(f,art).blades);
    return art.torsoTurn-raw.torsoTurn;
  };
  const forward=sample('hard',0), reverse=sample('hard',Math.PI);
  assert.ok(forward>.32&&reverse<-.32);
  assert.ok(Math.abs(sample('glance',0))<forward*.6);
  assert.equal(sample('hard',0,true),0);
});

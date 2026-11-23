// @ts-nocheck
import { sampleCombatPose } from './choreography.js?v=1.4.0';
import { formMoveById } from './combat-forms.js?v=1.4.0';
/** Depth-aware presentation rig. All lengths are local sprite pixels; z points
 * toward the camera. This module never changes simulation state or resolves hits.
 * sampleFighterRig -> drawFighterRig, inside the caller's existing sprite scale.
 * The rig owns facing/lean/crouch. The caller owns world position and airborne roll.
 */
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const vec = (x, y, z = 0) => ({ x, y, z });
const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
const midpoint = (a, b, bend = 0, depth = 0) => vec((a.x+b.x)/2, (a.y+b.y)/2+bend, (a.z+b.z)/2+depth);
const PROFILES = Object.freeze({
  sweep: { depth: 11, twist: .72, hand: 0, spread: 6 },
  thrust: { depth: 3, twist: .28, hand: -1, spread: 9 },
  orbit: { depth: 16, twist: 1.05, hand: -4, spread: 7 },
  leap: { depth: 9, twist: .65, hand: -7, spread: 5 },
  redirect: { depth: -8, twist: -.52, hand: -3, spread: 6 },
  cleave: { depth: 5, twist: .4, hand: -6, spread: 8 },
  weave: { depth: -13, twist: -.68, hand: 2, spread: 7 },
  flurry: { depth: 14, twist: .85, hand: -2, spread: 8 },
  riposte: { depth: -10, twist: -.8, hand: 1, spread: 9 },
});

/** Weak perspective keeps the established 2D art style while foreshortening
 * limbs and blades that turn into/out of the screen. */
export function projectJoint(point = {}, facing = 1) {
  const z = clamp(finite(point.z), -75, 75);
  const scale = 1 + z / 200;
  return { x: finite(point.x) * (facing < 0 ? -1 : 1) * scale,
    y: finite(point.y) * scale - z * .24, depth: z, scale };
}

export function sampleFighterRig({ fighter = {}, tick = 0, pose = {}, motion = 'sweep',
  move = null, swing = null, flight = null, dual = false, reducedMotion = false, aimAngle = 0,
  moving = fighter.moving ?? fighter.state === 'moving' } = {}) {
  const profile = PROFILES[motion] || PROFILES.sweep;
  const animation = move?.animation || fighter.attack?.move?.animation || {};
  const yaw = !reducedMotion && flight?.airborne && flight.rotationAxis === 'yaw' ? finite(flight.visualRotation,finite(flight.rotation)) : 0;
  const facing = fighter.facing ? Math.sign(fighter.facing) : fighter.team === 1 ? -1 : 1;
  const phase = pose.phase || (fighter.guard ? 'guard' : 'ready');
  const attacking = ['anticipation', 'strike', 'follow-through', 'recovery'].includes(phase);
  const attack = fighter.attack;
  const contactTick = attack?.offhand ? finite(attack.offhandResolveTick,attack.resolveTick) : attack?.resolveTick;
  const startTick = attack?.offhand ? contactTick-7 : attack?.startedTick;
  const progress = attack ? clamp((tick-finite(startTick,tick)) / Math.max(1,finite(contactTick,tick+1)-finite(startTick,tick)),0,1)
    : swing ? clamp((tick-finite(swing.tick,tick))/22,0,1) : 0;
  const pulse = attacking ? Math.sin(progress * Math.PI) : 0;
  const direction = finite(pose.direction, finite(animation.direction,1));
  // Authored choreography depth is an accent, expanded into local rig pixels.
  const depth = reducedMotion ? 0 : Number.isFinite(pose.depth) ? clamp(pose.depth * 2.8,-18,18) : profile.depth * pulse * direction;
  const plane = pose.plane || animation.plane || (motion==='thrust'?'thrust':motion==='cleave'?'vertical':'diagonal');
  const attackWeight = attacking && !reducedMotion ? 1 : 0;
  const swingYaw = finite(pose.bladeYaw, finite(pose.angle)-aimAngle);
  const twist = reducedMotion ? 0 : clamp(finite(pose.twist,profile.twist*pulse*direction) + (plane!=='vertical'?Math.sin(swingYaw)*.78*attackWeight:0),-1.5,1.5);
  const gaitPhase = tick*.23 + finite(fighter.lane)*.7;
  const gait = moving && !attacking && !flight?.airborne && phase==='ready' && !reducedMotion;
  const guarded = phase==='guard' || phase==='parry';
  const strideSignal = Math.sin(gaitPhase);
  const idle = !gait && !flight?.airborne && !reducedMotion;
  const breath = idle ? Math.sin(tick*.09 + finite(fighter.lane)*.9) : 0;
  // Emphasize weight transfer at the body while the game retains the original
  // root, contact tick and target. Idle keeps both feet planted.
  const lean = reducedMotion ? 0 : finite(pose.lean)*1.35 +
    (gait ? 2.5 + Math.cos(gaitPhase)*.65 : 0) + (guarded ? -.75 : 0) + breath*.42;
  const crouch = reducedMotion ? 0 : finite(pose.crouch)*1.16 + clamp(finite(flight?.landingCompression),0,1)*5.2 +
    (gait ? .4 + Math.cos(2*gaitPhase)*1 : 0) + (guarded ? 1.6 : 0) + breath*.7;
  const step = reducedMotion ? 0 : finite(pose.footwork);
  const stride = gait ? strideSignal : 0;
  const liftMain = gait ? Math.max(0,Math.cos(gaitPhase))*5.5 + Math.max(0,stride)*2.5 : 0;
  const liftOff = gait ? Math.max(0,-Math.cos(gaitPhase))*5.5 + Math.max(0,-stride)*2.5 : 0;
  const shoulderWidth = 5.2*Math.cos(twist), shoulderDepth = 5.2*Math.sin(twist);
  const spread = profile.spread + 2 + (animation.stance === 'wide' ? 2 : animation.stance === 'narrow' ? -2 : 0) +
    (!reducedMotion && guarded ? 2.5 : 0);
  const pelvis = vec(lean*.62,4+crouch,Math.sin(twist)*-2);
  const neck = vec(lean,-5+crouch,-Math.sin(twist)*1.4);
  const shoulderRock = gait ? stride*.8 : 0;
  const shoulderMain = add(neck,vec(shoulderWidth,3-shoulderRock,2+shoulderDepth));
  const shoulderOff = add(neck,vec(-shoulderWidth,3+shoulderRock,-2-shoulderDepth));
  const extension = finite(pose.extension);
  const handHeight = finite(pose.handHeight,profile.hand*pulse)*(plane==='horizontal'?.18:1);
  const offActive = dual && Boolean(pose.offhandActive);
  const mainAngle = finite(pose.angle, fighter.guard ? -1.4 : -.7);
  const offAngle = finite(pose.offAngle,-1.85);
  const handMain = vec(lean+8+(offActive?0:extension) - stride*3.5,
    crouch+handHeight + (gait ? Math.cos(gaitPhase)*1.3 : 0),3+depth*.48+stride*1.8);
  const handOff = dual ? vec(lean+(offActive?10+extension:-4) + stride*4,crouch+(offActive?handHeight:4),-3-depth*.35-stride*2)
    : vec(lean+4+extension*.65,crouch+handHeight+1,handMain.z-1.6);
  // The grip itself follows the shoulder around the torso. Horizontal cuts
  // therefore travel back-to-front in X/Z, rather than merely rotating a saber
  // above an otherwise motionless hand. Keep inactive guard hands independent.
  const arc = reducedMotion ? 0 : pulse;
  const placeGrip=(hand,angle,active)=>{
    if (!attacking || reducedMotion || !active) return;
    const azimuth=plane==='vertical'?0:angle;
    const radius=8+extension*.35;
    hand.x += (Math.cos(azimuth)-1)*radius;
    hand.z += Math.sin(azimuth)*radius;
    if (plane==='diagonal') hand.y += Math.sin(angle)*2.5;
    if (plane==='vertical') hand.y += Math.sin(mainAngle)*arc*2;
  };
  placeGrip(handMain,swingYaw,!offActive);
  if (dual) placeGrip(handOff,finite(pose.offBladeYaw,offAngle-aimAngle),offActive);
  else if (gait) { handOff.x=lean-4+stride*4; handOff.y=4+crouch; handOff.z=-5-stride*2; }
  else { handOff.x=handMain.x-3.3;handOff.y=handMain.y+1;handOff.z=handMain.z-1.6; }
  if (phase === 'force') { handOff.x=lean+13; handOff.y=-4+crouch; handOff.z=6; }
  const hipMain = add(pelvis,vec(3.2*Math.cos(twist*.55),0,2+Math.sin(twist*.55)*3));
  const hipOff = add(pelvis,vec(-3.2*Math.cos(twist*.55),0,-2-Math.sin(twist*.55)*3));
  // The root and hips can turn/lunge while planted feet stay on their ground
  // plane. Locomotion alone lifts feet; a crouch never makes the feet float.
  // The front leg lands during the wind-up, drives the contact and steps
  // back only on recovery. Motion families share timing but differ in reach.
  const fallBack = !attack && attacking;
  const retreat = clamp((progress-.35)/.65,0,1);
  const stepPhase = fallBack ? 1-retreat : clamp((progress-.1)/.55,0,1);
  const stepEase = stepPhase*stepPhase*(3-2*stepPhase);
  const drive = motion==='thrust' ? 7.4 : motion==='cleave'||motion==='leap' ? 6.1 : 4.7;
  const reachStep = attackWeight*(drive+Math.abs(step)*1.1)*stepEase;
  const stepLift = attackWeight*Math.sin(stepPhase*Math.PI)*(fallBack?3.2:5.75);
  const backBrace = attackWeight * stepEase * (motion==='cleave'||motion==='orbit' ? 3.2 : 2.1);
  const footMain = vec(spread+stride*7.6+reachStep,12-liftMain-stepLift,3+stride*1.4);
  const footOff = vec(-spread-stride*7.6-backBrace,12-liftOff,-3-stride*1.4);

  const joints = { pelvis, neck, head:add(neck,vec(.3-lean*.12,-6,-twist*.5)),
    shoulderMain, shoulderOff, handMain, handOff,
    elbowMain:midpoint(shoulderMain,handMain,5.5+Math.sin(mainAngle)*arc*1.8,-2-twist*1.6),
    elbowOff:midpoint(shoulderOff,handOff,5.5+Math.sin(offAngle)*arc,-2+twist),
    hipMain, hipOff, footMain, footOff,
    kneeMain:midpoint(hipMain,footMain,-1-liftMain*.35,2),
    kneeOff:midpoint(hipOff,footOff,-1-liftOff*.35,-2) };
  // Airborne height remains the caller's transform. Here only the silhouette
  // articulates: knees gather for a vault rather than a rigid rotating sticker.
  if (flight?.airborne && !reducedMotion) {
    const tuck = clamp(finite(flight.tuck),0,1);
    for (const side of ['Main','Off']) {
      const sign=side==='Main'?1:-1;
      joints['foot'+side].y-=tuck*7;
      joints['foot'+side].x=mix(joints['foot'+side].x,sign*4,tuck*.75);
      joints['knee'+side].y-=tuck*4;
      joints['knee'+side].x+=sign*tuck*3;
    }
  }
  const blades = [];
  const makeBlade = (hand, angle, length, isOff) => {
    const explicitYaw=isOff?pose.offBladeYaw:pose.bladeYaw;
    const explicitPitch=isOff?pose.offBladePitch:pose.bladePitch;
    const deviation=angle-aimAngle;
    const active=attacking && (!dual || isOff===offActive);
    let bladeYaw=0, bladePitch=angle;
    if (active) {
      bladeYaw=finite(explicitYaw,plane==='horizontal'?deviation:plane==='diagonal'?deviation*.7:plane==='thrust'?deviation*.6:0);
      bladePitch=finite(explicitPitch,plane==='horizontal'?aimAngle:plane==='diagonal'?aimAngle+deviation*.7:plane==='thrust'?aimAngle+deviation*.15:angle);
    }
    // True spherical channels: horizontal azimuth never becomes screen Y.
    const axisAt=(azimuth,elevation)=>vec(Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation));
    const axis=axisAt(bladeYaw,bladePitch);
    const tip = add(joints[hand],vec(axis.x*length,axis.y*length,axis.z*length));
    const hilt = add(joints[hand],vec(-axis.x*3.5,-axis.y*3.5,-axis.z*3.5));
    const tipName = isOff?'tipOff':'tipMain', hiltName = isOff?'hiltOff':'hiltMain';
    joints[tipName]=tip; joints[hiltName]=hilt;
    // A small ribbon samples the immediate preceding orientation, not a hit.
    const trail = reducedMotion ? 0 : clamp(finite(pose.trail),0,1);
    const previousAxis=axisAt(bladeYaw-(active&&plane!=='vertical'?trail*direction:0),bladePitch-(!active||plane!=='horizontal'?trail*direction:0));
    const previous=add(joints[hand],vec(previousAxis.x*length,previousAxis.y*length,previousAxis.z*length));
    blades.push({hand,tip:tipName,hilt:hiltName,trail:projectJoint(previous,facing),trailJoint:previous,trailOpacity:trail,offhand:isOff,length});
  };
  if (dual) makeBlade('handOff',offAngle,21,true);
  makeBlade('handMain',mainAngle,25,false);
  // Lean is already present; roll adds a restrained shoulder/head cant only.
  const roll = reducedMotion ? 0 : clamp(finite(pose.bodyRoll)+finite(flight?.bank)*.25,-.65,.65);
  if (roll) for (const name of ['head','neck','shoulderMain','shoulderOff']) {
    const p=joints[name], x=p.x-pelvis.x, y=p.y-pelvis.y;
    p.x=pelvis.x+x*Math.cos(roll)-y*Math.sin(roll); p.y=pelvis.y+x*Math.sin(roll)+y*Math.cos(roll);
  }
  // A corkscrew turns around the body's vertical axis, not the canvas plane.
  // Rotate the complete attached skeleton and weapon geometry together so the
  // near arm becomes the far arm, with actual foreshortening at quarter turns.
  if (yaw) {
    const c=Math.cos(yaw), s=Math.sin(yaw);
    const turn=p=>{const x=p.x,z=p.z;p.x=x*c+z*s;p.z=z*c-x*s;};
    Object.values(joints).forEach(turn);
    for(const b of blades) { turn(b.trailJoint); b.trail=projectJoint(b.trailJoint,facing); }
  }
  // A linked cut inherits the previous physical silhouette as well as blade
  // orientation. Blend only the early chamber, never the real contact phase.
  // Rebuild rigid blades from normalized directions after blending the joints.
  const linked = attack?.kind==='saber' && swing && startTick>=swing.tick && startTick-swing.tick<22 && fighter.comboUntil>startTick;
  if (linked && !reducedMotion && progress<.28) {
    const oldFighter={...fighter,attack:null};
    const oldMove=formMoveById(swing.form||fighter.form,swing.moveId);
    const oldPose=sampleCombatPose({fighter:oldFighter,tick:startTick,swing,move:oldMove,motion:oldMove?.motion||motion,dual,aimAngle});
    const prior=sampleFighterRig({fighter:oldFighter,tick:startTick,pose:oldPose,motion:oldMove?.motion||motion,move:oldMove,swing,flight,dual,aimAngle,moving:false});
    const t=clamp(progress/.28,0,1), blend=t*t*(3-2*t);
    const directions=blades.map(b=>{
      const tip=joints[b.tip],hand=joints[b.hand],pt=prior.joints[b.tip],ph=prior.joints[b.hand];
      const a=vec(mix(pt.x-ph.x,tip.x-hand.x,blend),mix(pt.y-ph.y,tip.y-hand.y,blend),mix(pt.z-ph.z,tip.z-hand.z,blend));
      const length=Math.hypot(a.x,a.y,a.z)||1;return vec(a.x/length,a.y/length,a.z/length);
    });
    for(const [name,p] of Object.entries(joints))if(prior.joints[name])for(const axis of ['x','y','z'])p[axis]=mix(prior.joints[name][axis],p[axis],blend);
    blades.forEach((b,i)=>{
      const axis=directions[i],hand=joints[b.hand];
      joints[b.tip]=add(hand,vec(axis.x*b.length,axis.y*b.length,axis.z*b.length));
      joints[b.hilt]=add(hand,vec(-axis.x*3.5,-axis.y*3.5,-axis.z*3.5));
      b.trailOpacity*=blend;
    });
  }
  const projected = Object.fromEntries(Object.entries(joints).map(([name,p])=>[name,projectJoint(p,facing)]));
  return {joints,projected,blades,phase,motion,twist,facing,dual,progress,aimAngle,yaw,backFacing:Math.cos(yaw)<0};
}

/** Flat stick-figure presentation. Every limb is a single rounded path; depth
 * changes draw order and geometry, never color/shading. Lengths and stroke widths
 * use sprite pixels (about four CSS pixels at the normal camera scale).
 * All additive light is isolated to the blade, and canvas state is restored. */
export function drawFighterRig(ctx, rig, {teamColor='#8ee9d0',blade=teamColor,
  effects='full',appearance='classic',dark='#071422'} = {}) {
  const p=rig.projected;
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.globalCompositeOperation='source-over';
  const stroke=(points,color,width)=>{
    ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  const broadcast=appearance==='broadcast';
  const point=(x,y)=>({x,y});
  const dot=(x,y,r,color)=>{
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  };
  const limb=(names,leg)=>{
    const points=names.map(name=>p[name]);
    if (!broadcast) return stroke(points,teamColor,4);
    // A dark outline carries the silhouette over lit flooring; flat trim
    // follows the segment geometry instead of floating over the animation.
    stroke(points,'#060a15',leg?7.2:6.6);
    stroke(points,teamColor,leg?4.5:4.2);
    const joint=points[2],end=points[3];
    const cuff=point(mix(joint.x,end.x,.62),mix(joint.y,end.y,.62));
    if (leg) {
      stroke([cuff,end],dark,3.3);
      stroke([end,point(end.x+rig.facing*3.4,end.y+.6)],'#060a15',5);
      stroke([end,point(end.x+rig.facing*3.4,end.y+.6)],teamColor,2.7);
    } else {
      stroke([cuff,end],'#e7fcff',1.35);
    }
  };
  const paintBlade=b=>{
    const hand=p[b.hand],tip=p[b.tip],hilt=p[b.hilt];
    // Exact additive three-pass saber. Minimal effects keeps a quiet core.
    ctx.save();ctx.globalCompositeOperation='lighter';
    if(effects!=='minimal') {
      ctx.globalAlpha=.15;stroke([hand,tip],blade,14);
      ctx.globalAlpha=.4;stroke([hand,tip],blade,7);
    }
    ctx.globalAlpha=1;stroke([hand,tip],'#ffffff',2.5);
    ctx.restore();
    if(broadcast) {
      stroke([hilt,hand],'#060a15',5.5);
      stroke([hilt,hand],'#e7fcff',2.65);
    } else stroke([hilt,hand],teamColor,4);
  };
  const parts=[];
  for(const side of ['Main','Off']) {
    parts.push({z:(rig.joints['hip'+side].z+rig.joints['foot'+side].z)/2,
      draw:()=>limb(['pelvis','hip'+side,'knee'+side,'foot'+side],true)});
    parts.push({z:(rig.joints['shoulder'+side].z+rig.joints['hand'+side].z)/2,
      draw:()=>limb(['neck','shoulder'+side,'elbow'+side,'hand'+side])});
  }
  for(const b of rig.blades)parts.push({z:(rig.joints[b.hand].z+rig.joints[b.tip].z)/2,draw:()=>paintBlade(b)});
  parts.push({z:(rig.joints.pelvis.z+rig.joints.neck.z)/2,draw:()=>{
    if (!broadcast) {
      stroke([p.neck,p.pelvis],teamColor,4);
      dot(p.head.x,p.head.y,5.8,teamColor);
      return;
    }
    stroke([p.neck,p.pelvis],'#060a15',10.1);
    stroke([p.neck,p.pelvis],teamColor,7.1);
    stroke([point(mix(p.neck.x,p.pelvis.x,.3),mix(p.neck.y,p.pelvis.y,.3)),
      point(mix(p.neck.x,p.pelvis.x,.77),mix(p.neck.y,p.pelvis.y,.77))],dark,2.55);
    dot(p.head.x,p.head.y,7.6,'#060a15');
    dot(p.head.x,p.head.y,6.15,teamColor);
    if(!rig.backFacing) {
      const {x,y}=p.head, forward=rig.facing;
      stroke([point(x-forward*2.2,y-.6),point(x+forward*4.6,y-.9)],'#06101e',2.8);
      stroke([point(x+forward*.6,y-.87),point(x+forward*3.5,y-.99)],'#effeff',1.2);
    } else {
      stroke([point(p.head.x,p.head.y-3.8),point(p.head.x,p.head.y+.8)],dark,1.5);
    }
  }});
  parts.sort((a,b)=>a.z-b.z).forEach(part=>part.draw());
  ctx.restore();return rig;
}

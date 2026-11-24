/**
 * Presentation-only impact styling for Arena: hold frames, flash, shake,
 * blade smears, anticipation and follow-through. Nothing here reads or
 * changes the simulation. A "hold" freezes how a pose is drawn while the
 * simulation keeps running; the painter just keeps showing the impact pose.
 */

export type ArcadeImpactKind='hit'|'heavy'|'block'|'parry'|'clash'|'break'|'ko';

export interface ArcadeImpactInput {
  kind:ArcadeImpactKind;
  /** Damage dealt by the contact, 0 for blocks and parries. */
  damage:number;
  reducedMotion:boolean;
}

export interface ArcadeImpactFx {
  /** How long the impact pose is held on screen, in ms. Simulation keeps running. */
  holdMs:number;
  /** Frames of white flash on the struck fighter. */
  flashFrames:number;
  /** Peak camera shake in px, and how long it decays. */
  shakePx:number;
  shakeMs:number;
}

const BASE:Readonly<Record<ArcadeImpactKind,ArcadeImpactFx>>=Object.freeze({
  hit:Object.freeze({holdMs:50,flashFrames:1,shakePx:2,shakeMs:90}),
  heavy:Object.freeze({holdMs:70,flashFrames:2,shakePx:5,shakeMs:140}),
  block:Object.freeze({holdMs:35,flashFrames:0,shakePx:1,shakeMs:70}),
  parry:Object.freeze({holdMs:60,flashFrames:1,shakePx:2,shakeMs:100}),
  clash:Object.freeze({holdMs:65,flashFrames:1,shakePx:3,shakeMs:120}),
  break:Object.freeze({holdMs:75,flashFrames:2,shakePx:5,shakeMs:150}),
  ko:Object.freeze({holdMs:80,flashFrames:2,shakePx:6,shakeMs:180}),
});
export const ARCADE_IMPACT_HOLD_MAX_MS=80;
const REDUCED:ArcadeImpactFx=Object.freeze({holdMs:0,flashFrames:0,shakePx:0,shakeMs:0});

/** Scales with damage inside each kind's band; reduced motion turns it all off. */
export function arcadeImpactFx({kind,damage,reducedMotion}:ArcadeImpactInput):ArcadeImpactFx{
  const base=BASE[kind]??BASE.hit;
  if(reducedMotion)return REDUCED;
  const d=Number.isFinite(damage)?Math.max(0,damage):0;
  const scale=kind==='hit'||kind==='heavy'?Math.min(1.6,.8+d/40):1;
  return Object.freeze({
    holdMs:Math.min(ARCADE_IMPACT_HOLD_MAX_MS,Math.round(base.holdMs*scale)),
    flashFrames:base.flashFrames,
    shakePx:Math.round(base.shakePx*scale*10)/10,
    shakeMs:Math.round(base.shakeMs*scale),
  });
}

/** Shake offset at a moment, decaying linearly; deterministic per seed. */
export function arcadeShakeOffset(fx:ArcadeImpactFx,elapsedMs:number,seed:number):{x:number;y:number}{
  if(fx.shakePx<=0||fx.shakeMs<=0||elapsedMs<0||elapsedMs>=fx.shakeMs)return {x:0,y:0};
  const k=fx.shakePx*(1-elapsedMs/fx.shakeMs);
  const a=Math.sin(seed*12.9898+elapsedMs*.083)*43758.5453;
  const b=Math.sin(seed*78.233+elapsedMs*.071)*24634.6345;
  return {x:Math.round((a-Math.floor(a)-.5)*2*k*100)/100,y:Math.round((b-Math.floor(b)-.5)*2*k*100)/100};
}

/**
 * Wind-back before contact, then overshoot and settle after it. Returns an
 * angle offset as a fraction of the swing arc: negative pulls back against
 * the swing, positive carries past its end.
 */
export function arcadeSwingEase(progress:number,contact:number,reducedMotion=false):number{
  if(!Number.isFinite(progress)||!Number.isFinite(contact)||contact<=0||contact>=1)return 0;
  const p=Math.max(0,Math.min(1,progress));
  const pull=reducedMotion?.06:.16, carry=reducedMotion?.04:.12;
  const windEnd=contact*.45;
  if(p<windEnd)return -pull*Math.sin(Math.PI*.5*p/windEnd);
  if(p<contact){const q=(p-windEnd)/(contact-windEnd);return -pull*(1-q)*(1-q);}
  const r=(p-contact)/(1-contact);
  return carry*Math.sin(Math.PI*Math.min(1,r*1.6))*(1-r);
}

export interface ArcadeSmearInput {
  x:number;y:number;
  /** Blade angle at the start and end of this frame's sweep, radians. */
  fromAngle:number;toAngle:number;
  /** Inner and outer blade radius. */
  hilt:number;reach:number;
  heavy:boolean;reducedMotion:boolean;
}

/**
 * A closed polygon covering the blade's sweep this frame: outer edge along
 * the tip's arc, inner edge back along the hilt's arc. Empty for tiny sweeps.
 */
export function arcadeSmear({x,y,fromAngle,toAngle,hilt,reach,heavy,reducedMotion}:ArcadeSmearInput):{points:readonly [number,number][];alpha:number}{
  const sweep=toAngle-fromAngle;
  if(![x,y,fromAngle,toAngle,hilt,reach].every(Number.isFinite)||Math.abs(sweep)<.08||reach<=hilt)return {points:[],alpha:0};
  const steps=Math.max(2,Math.min(12,Math.ceil(Math.abs(sweep)/.18)));
  const inner=hilt+(reach-hilt)*(heavy?.25:.45);
  const pts:[number,number][]=[];
  for(let i=0;i<=steps;i++){const a=fromAngle+sweep*i/steps;pts.push([x+Math.cos(a)*reach,y+Math.sin(a)*reach]);}
  for(let i=steps;i>=0;i--){const a=fromAngle+sweep*i/steps;pts.push([x+Math.cos(a)*inner,y+Math.sin(a)*inner]);}
  const alpha=(heavy?.55:.4)*(reducedMotion?.5:1);
  return {points:pts.map(([px,py])=>[Math.round(px*100)/100,Math.round(py*100)/100] as [number,number]),alpha};
}

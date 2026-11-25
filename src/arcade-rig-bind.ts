/** World-anchored weapon bind, retaining full physical saber length. */
import {arcadeBasis} from './arcade-rig-projection.js?v=6.0.2';
import type {Point} from './arcade-rig-projection.js?v=6.0.2';
type BindFighter=Parameters<typeof arcadeBasis>[0] & {clashX:number;clashY:number;clashRole?:string;
 clashFrom?:{hand?:Point;tip?:Point}};
type Frame=Parameters<typeof arcadeBasis>[1];
const P=(x:number,y:number):Point=>({x,y});
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
export function clashBind(f:BindFighter,r:Frame,neutralHand:Point,neutralTip:Point,t:number,reducedMotion:boolean){
  const {project,local}=arcadeBasis(f,r), point=P(f.clashX,f.clashY);
  const start=f.clashFrom;
  const good=(p?:Point):p is Point=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
  const h=good(start?.hand)?start!.hand!:project(neutralHand);
  const tip=good(start?.tip)?start!.tip!:project(neutralTip);
  const dx=tip.x-h.x,dy=tip.y-h.y;
  const length=Math.max(1,Math.hypot(dx,dy)), base=Math.atan2(dy,dx);
  const notch=clamp(((point.x-h.x)*dx+(point.y-h.y)*dy)/(length*length),.16,1);
  const shift=(f.clashRole==='defender'?-.20:.16)*r.hdx*(reducedMotion?.65:1);
  const wind=smooth(t/.13), release=smooth((t-.36)/.29), settle=smooth((t-.59)/.41);
  const angle=base+shift*wind-shift*2.85*release;
  const ux=Math.cos(angle),uy=Math.sin(angle);
  const backward=release*(f.clashRole==='defender'?18:13);
  const anchor=P(point.x-r.hdx*backward,point.y-release*5.8);
  const bh=P(anchor.x-ux*length*notch,anchor.y-uy*length*notch);
  const bt=P(anchor.x+ux*length*(1-notch),anchor.y+uy*length*(1-notch));
  const blend=(a:Point,b:Point,weight:number)=>P(mix(a.x,b.x,weight),mix(a.y,b.y,weight));
  // Interpolate orientation and projected length, not both tips linearly:
  // otherwise opposing end angles briefly collapse the physical blade.
  const palm=blend(blend(h,bh,wind),project(neutralHand),settle);
  const entryAngle=angle;
  const goal=project(neutralTip), natural=project(neutralHand);
  const naturalAngle=Math.atan2(goal.y-natural.y,goal.x-natural.x);
  const relative=Math.atan2(Math.sin(naturalAngle-entryAngle),Math.cos(naturalAngle-entryAngle));
  const blendedAngle=entryAngle+relative*settle;
  const blendedLength=mix(length,Math.hypot(goal.x-natural.x,goal.y-natural.y),settle);
  const end=P(palm.x+Math.cos(blendedAngle)*blendedLength,palm.y+Math.sin(blendedAngle)*blendedLength);
  return {hand:local(palm),tip:local(end),point,bindWeight:wind*(1-settle),
    bound:t>=.13&&t<=.36};
}


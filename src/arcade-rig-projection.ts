/** Canvas/world conversions shared by live paint and blade collision. */
import type {OrbitBlade} from './arcade-orbit-sabers.js?v=6.0.2-rc2';
export type Point={x:number;y:number};
type Origin={x?:number;y?:number};
type RigFrame={roll:number;flightSide?:number|null;hdx:number;trick?:{angle?:number}|null;
 type:{scale:number;id:string};hop:number;waist:Point};
type RigLeg={side:number;foot:Point;toes:Point;k:Point;planted:boolean};
type BladeRig=RigFrame & {emitter?:Point|null;hand:Point;blade:Point;backHand:Point;
 shoulder:Point;offEmitter?:Point|null;offBlade?:Point|null;staff:boolean;saberPhase:string;orbitBlades?:readonly OrbitBlade[]};
type Emitter={id:'main'|'rear'|'off'|'orbit_third';hand:Point;tip:Point};
const finite=(v?:number)=>Number.isFinite(v)?v!:0;
const point=(x:number,y:number):Point=>({x,y});
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const arcadeRigRotation=(r:RigFrame)=>(r.roll+finite(r.trick?.angle))*(r.flightSide??r.hdx);
export function arcadeBasis(f:Origin,r:RigFrame){
  const scale=r.type.scale, rotate=arcadeRigRotation(r), cos=Math.cos(rotate),sin=Math.sin(rotate);
  const x=finite(f.x),y=finite(f.y)-r.hop,px=r.waist.x,py=r.waist.y;
  return {
    project:(p:Point)=>{
      const dx=p.x-px,dy=p.y-py;
      return point(x+(px+dx*cos-dy*sin)*scale,y+(py+dx*sin+dy*cos)*scale);
    },
    local:(p:Point)=>{
      const dx=(p.x-x)/scale-px,dy=(p.y-y)/scale-py;
      return point(px+dx*cos+dy*sin,py+dy*cos-dx*sin);
    }
  };
}
export function arcadeHeroLabelWorld(f:Origin,r:RigFrame & {head:Point;legs:readonly RigLeg[]}){
  const {project}=arcadeBasis(f,r);
  const head=project(r.head);
  const top=Math.min(head.y-(r.type.id==='rabbit'?40:23)*r.type.scale,
    project(r.waist).y-8,...r.legs.map(l=>project(l.foot).y-12));
  return {x:head.x,y:top};
}
export function arcadeFeetWorld(f:Origin,r:RigFrame & {legs:readonly RigLeg[]}){
  const {project}=arcadeBasis(f,r);
  return r.legs.map(l=>({side:l.side,foot:project(l.foot),toes:project(l.toes),k:project(l.k),planted:l.planted}));
}
export function arcadeBladeWorld(f:Origin,r:BladeRig) {
  const {project}=arcadeBasis(f,r);
  const primary={hand:project(r.emitter??r.hand),tip:project(r.blade)};
  const blades:Emitter[]=[{id:'main',...primary}];
  const body=project(point(mix(r.waist.x,r.shoulder.x,.57),mix(r.waist.y,r.shoulder.y,.57)));
  const freeHand=project(r.backHand);
  if(r.orbitBlades?.length===3){
    const [a,b,c]=r.orbitBlades;
    return {hand:a.hand,tip:a.tip,offhand:{hand:b.hand,tip:b.tip},phase:r.saberPhase,body,freeHand,
      blades:[{id:'main',hand:a.hand,tip:a.tip},{id:'off',hand:b.hand,tip:b.tip},{id:'orbit_third',hand:c.hand,tip:c.tip}] as Emitter[]};
  }
  if(!r.offBlade)return {...primary,phase:r.saberPhase,body,freeHand,blades};
  const offhand={hand:project(r.offEmitter??r.backHand),tip:project(r.offBlade)};
  blades.push({id:r.staff?'rear':'off',...offhand});
  return {...primary,offhand,phase:r.saberPhase,body,freeHand,blades};
}

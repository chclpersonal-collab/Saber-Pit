import type {Point} from './arcade-rig-projection.js?v=6.0.2-rc2';

/** Shared, deterministic emitter choreography. Paint never advances combat. */
export type OrbitBladeId='primary'|'offhand'|'orbit_third';
export type OrbitBlade={id:OrbitBladeId;hand:Point;tip:Point;charge:number;trail:number};
export type OrbitCarry={time:number;x:number;y:number;blades:OrbitBlade[]};
type PoseInput={x?:number;y?:number;face?:number;airHeight?:number;action?:string|{type?:string;kind?:string};attack?:unknown;actionTime?:number;actionDuration?:number;
 orbitCarry?:OrbitCarry|null;clashBlade?:string|null;clashFrom?:{hand?:Point;tip?:Point}|null;attackSpec?:{contact?:number;reach?:number;arc?:number;freeHand?:boolean;orbit?:boolean;
 offhand?:{contact?:number;reach?:number};orbitThird?:{contact?:number;reach?:number}}|null};
const TAU=Math.PI*2;
const mix=(a:number,b:number,n:number)=>a+(b-a)*n;
const damp=(x:number)=>{const n=Math.min(1,Math.max(0,x));return n*n*(3-2*n);};
export function sampleOrbitSabers(f:PoseInput,t:number,reduced=false):OrbitBlade[]{
  const action=typeof f.action==='string'?f.action:f.action?.kind??f.action?.type??'idle';
  const spec=f.attackSpec, age=f.actionTime??0;
  const slots=[spec,spec?.offhand,spec?.orbitThird] as const;
  const face=f.face??0, groundY=(f.y??0)-(f.airHeight??0);
  const dx=Math.cos(face),dy=Math.sin(face);
  const forward={x:dx,y:dy*.78}, side={x:-dy,y:dx};
  const root={x:f.x??0,y:groundY-40};
  const restPhase=t*1.90;
  return (['primary','offhand','orbit_third'] as const).map((id,i)=>{
    const key=f.attack&&spec?.orbit&&slots[i]&&action!=='force'?slots[i]:null;
    const contact=key?.contact??0, reach=key?.reach??76;
    const wind=key&&age<contact?damp((age-Math.max(0,contact-.135))/Math.min(contact,.135)):0;
    const after=key&&age>=contact?damp((age-contact)/Math.max(.09,(f.actionDuration??contact+.14)-contact)):0;
    const attack=key?(age<contact?wind:1-after):0;
    const a=restPhase+i*TAU/3;
    const rest={x:root.x+Math.cos(a)*55,y:root.y-12+Math.sin(a)*29};
    const offset=(i===1?-12:i===2?12:0)*(.70+.30*Math.abs(dx));
    const chamber=key&&age<contact?Math.sin(Math.PI*wind):0;
    const lane=Math.min(97,Math.max(48,reach-15)), inner=lane-54;
    const from={x:root.x+forward.x*inner+side.x*offset,y:root.y+forward.y*inner+side.y*offset};
    const to={x:root.x+forward.x*lane+side.x*offset*.43,y:root.y+forward.y*lane+side.y*offset*.43};
    const pitch=i===0?-.4:i===1?-1.95:1.57;
    const spin=t*2.60+i*TAU/3+pitch;
    // Select the angular branch from the start of the attack; interpolating
    // a freshly wrapped shortest angle every frame flips near the antipode.
    const laneYaw=Math.atan2(to.y-from.y,to.x-from.x);
    const anchored=spin-age*2.60;
    const unwrapped=laneYaw+TAU*Math.round((anchored-laneYaw)/TAU);
    const yaw=mix(spin,unwrapped,attack)+chamber*(i===1?-.22:.22);
    const length=mix(38,Math.hypot(to.x-from.x,to.y-from.y),attack);
    const hand={x:mix(rest.x,from.x,attack)-forward.x*chamber*11,y:mix(rest.y,from.y,attack)-chamber*(i===2?-11:10)};
    const tip={x:hand.x+Math.cos(yaw)*length,y:hand.y+Math.sin(yaw)*length};
    // All blades recoil when focus breaks. The clashing blade starts at the
    // exact collision pose before rejoining the orbit.
    const clash=action==='clash'&&f.clashBlade===id?f.clashFrom:null;
    if(clash?.hand&&clash.tip){
      const rebound=damp(age/.30);
      for(const axis of ['x','y'] as const){hand[axis]=mix(clash.hand[axis],hand[axis],rebound);tip[axis]=mix(clash.tip[axis],tip[axis],rebound);}
    }
    const old=f.orbitCarry?.blades[i], elapsed=t-(f.orbitCarry?.time??-1);
    if(old&&elapsed>=0&&elapsed<.10){
      const carried=f.orbitCarry!, a=damp(elapsed/.10), shiftX=(f.x??0)-carried.x, shiftY=(f.y??0)-carried.y;
      const start=Math.atan2(old.tip.y-old.hand.y,old.tip.x-old.hand.x);
      const end=Math.atan2(tip.y-hand.y,tip.x-hand.x);
      const yaw=start+Math.atan2(Math.sin(end-start),Math.cos(end-start))*a;
      const span=mix(Math.hypot(old.tip.x-old.hand.x,old.tip.y-old.hand.y),Math.hypot(tip.x-hand.x,tip.y-hand.y),a);
      hand.x=mix(old.hand.x+shiftX,hand.x,a);hand.y=mix(old.hand.y+shiftY,hand.y,a);
      tip.x=hand.x+Math.cos(yaw)*span;tip.y=hand.y+Math.sin(yaw)*span;
    }
    return {id,hand,tip,charge:key&&age<contact?wind:0,trail:reduced?0:attack*(1-(key&&age<contact?.55:0))};
  });
}

/** Checks the lit segment against a body capsule's central bands. */
export function orbitHitsBody(blade:Pick<OrbitBlade,'hand'|'tip'>,body:{x:number;y:number;airHeight?:number;radius:number}){
  const {hand,tip}=blade,dx=tip.x-hand.x,dy=tip.y-hand.y;
  const height=body.y-(body.airHeight??0), radius=Math.min(19,Math.max(11,body.radius*.78));
  for(const offset of [24,40,55]){
    const p={x:body.x,y:height-offset};
    const u=Math.min(1,Math.max(0,((p.x-hand.x)*dx+(p.y-hand.y)*dy)/(dx*dx+dy*dy||1)));
    if(Math.hypot(p.x-hand.x-u*dx,p.y-hand.y-u*dy)<=radius)return true;
  }
  return false;
}

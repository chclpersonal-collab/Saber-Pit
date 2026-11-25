type P={x:number;y:number};
type BareBlade={hand:P;tip:P};
type BladeId='primary'|'offhand'|'rear'|'orbit_third';
type Body={lean:number;bend:number;wide:number;torsoTurn:number};
type Emitter=BareBlade & {body:Body;offhand:boolean;bladeId:BladeId};
type ClashFighter=P & {team:number;airHeight?:number;alive?:boolean;hp?:number;attack?:string|null;action:string;
 contact?:boolean;offhandContact?:boolean;orbitThirdContact?:boolean;actionTime:number;gear?:{dualSabers?:boolean;weapon?:string;staff?:boolean};
 attackSpec?:{orbit?:boolean;orbitThird?:{contact?:number};freeHand?:boolean;contact?:number;blade?:BladeId;offhand?:{contact?:number;blade?:BladeId}}|null};
type Solid={kind:string;x:number;y:number;width:number;height:number};
/** Blade clashes use the same articulated pose/projection as the canvas. 2D
 * contact is constrained by fighter depth so perspective alone can't clash. */
import {sampleArcadeFighter,arcadeBladeWorld} from './arcade-fighters.js?v=5.0.0';
import {sampleOrbitSabers} from './arcade-orbit-sabers.js';
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(v,hi));
const cross=(a:P,b:P)=>a.x*b.y-a.y*b.x;
const minus=(a:P,b:P)=>({x:a.x-b.x,y:a.y-b.y});
const pos=(a:P,b:P,t:number)=>({x:a.x+b.x*t,y:a.y+b.y*t});
function closestOn(a:P,b:P,p:P){
  const ab=minus(b,a), ap=minus(p,a);
  const t=clamp((ap.x*ab.x+ap.y*ab.y)/(ab.x*ab.x+ab.y*ab.y||1),0,1);
  return pos(a,ab,t);
}
function trim(b:BareBlade){
  const v=minus(b.tip,b.hand);
  return [pos(b.hand,v,.12),b.tip];
}
/** Intersection of the blade bodies, with a small tolerance for blade width. */
export function bladeIntersection(one:BareBlade|null|undefined,two:BareBlade|null|undefined,tolerance=3.4) {
  if(!one?.hand||!one?.tip||!two?.hand||!two?.tip)return null;
  const [a,b]=trim(one),[c,d]=trim(two);
  const ab=minus(b,a),cd=minus(d,c),ca=minus(c,a),den=cross(ab,cd);
  if(Math.abs(den)>1e-7){
    const t=cross(ca,cd)/den,u=cross(ca,ab)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1)return pos(a,ab,t);
  }
  let best=null,dist=tolerance*tolerance;
  for(const [p,q] of [[a,closestOn(c,d,a)],[b,closestOn(c,d,b)],[c,closestOn(a,b,c)],[d,closestOn(a,b,d)]]){
    const n=(p.x-q.x)**2+(p.y-q.y)**2;
    if(n<dist){dist=n;best={x:(p.x+q.x)/2,y:(p.y+q.y)/2};}
  }
  return best;
}
const releases=(time:number,contact?:number)=>contact!==undefined&&Number.isFinite(contact)&&time>=Math.max(contact*.53,contact-.116)&&time<=contact+.027;
function releaseMask(f:ClashFighter) {
  if((f.alive===false||(f.alive===undefined&&f.hp!<=0))||!f.attack||f.attackSpec?.freeHand===true||f.attack==='force'||f.action==='force')return 0;
  return (!f.contact&&releases(f.actionTime,f.attackSpec?.contact)?1:0)
    |((f.attackSpec?.orbit||f.gear?.dualSabers||f.gear?.weapon==='staff'||f.gear?.staff)&&!f.offhandContact&&releases(f.actionTime,f.attackSpec?.offhand?.contact)?2:0)
    |(f.attackSpec?.orbit&&!f.orbitThirdContact&&releases(f.actionTime,f.attackSpec.orbitThird?.contact)?4:0);
}
export function activeClashBlade(f:ClashFighter){return releaseMask(f)>0;}
/** The physical emitters participating in this tick, regardless of order. */
export function activeClashEmitters(f:ClashFighter,time:number):Emitter[]{
  const mask=releaseMask(f);
  if(!mask)return [];
  const rig=sampleArcadeFighter(f,time);
  const {lean,bend,wide,torsoTurn}=rig,body={lean,bend,wide,torsoTurn};
  if(f.attackSpec?.orbit){
    return sampleOrbitSabers(f,time).filter((_,i)=>(mask&(1<<i))!==0)
      .map(({id,hand,tip})=>({bladeId:id,hand,tip,body,offhand:id!=='primary'}));
  }
  const w:{hand:P;tip:P;offhand?:BareBlade}=arcadeBladeWorld(f,rig),staff=f.gear?.weapon==='staff'||f.gear?.staff;
  const on=(physical:BladeId):Emitter|undefined=>physical==='rear'||physical==='offhand'
    ?w.offhand&&{...w.offhand,body,offhand:true,bladeId:physical}
    :{hand:w.hand,tip:w.tip,body,offhand:false,bladeId:'primary'};
  const lead=f.attackSpec?.blade??'primary';
  const trail=f.attackSpec?.offhand?.blade??(staff?'rear':'offhand');
  return [mask&1?on(lead):null,mask&2?on(trail):null].filter((candidate):candidate is Emitter=>Boolean(candidate));
}
/** Earliest pair is determined by stable fighter order, spectators never use RNG. */
export function findArcadeBladeContact<F extends ClashFighter>(state:{fighters:F[];time:number;terrain?:{solids?:Solid[]}}){
  const active=state.fighters.filter(activeClashBlade),baked=new Map<F,Emitter[]>();
  const blade=(f:F)=>{
    if(!baked.has(f))baked.set(f,activeClashEmitters(f,state.time));
    return baked.get(f)!;
  };
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j],dx=a.x-b.x,dy=a.y-b.y;
    if(a.team===b.team||Math.abs(dy)>37||dx*dx+dy*dy>180**2||
       Math.abs((a.airHeight??0)-(b.airHeight??0))>39)continue;
    const ba=blade(a),bb=blade(b);
    for(const u of ba)for(const v of bb){
      const p=bladeIntersection(u,v);if(!p)continue;
      // Reject the projection flowing through a real wall between their bases.
      if(state.terrain?.solids?.some(r=>r.kind==='wall'&&insideSegment(a,b,r)))continue;
      return {a,b,x:p.x,y:p.y,groundY:(a.y+b.y)*.5,offhandA:u.offhand,offhandB:v.offhand,bladeA:u,bladeB:v,bladeIdA:u.bladeId,bladeIdB:v.bladeId};
    }
  }
  return null;
}
function insideSegment(a:P,b:P,r:Solid){
  let min=0,max=1;
  for(const [i,j,lo,hi] of [[a.x,b.x,r.x,r.x+r.width],[a.y,b.y,r.y,r.y+r.height]]){
    if(i===j){if(i<lo||i>hi)return false;continue;}
    const t=(lo-i)/(j-i),u=(hi-i)/(j-i);
    min=Math.max(min,Math.min(t,u));max=Math.min(max,Math.max(t,u));
    if(min>max)return false;
  }
  return min<max;
}

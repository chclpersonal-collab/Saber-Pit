/** Blade clashes use the same articulated pose/projection as the canvas. 2D
 * contact is constrained by fighter depth so perspective alone can't clash. */
import {sampleArcadeFighter,arcadeBladeWorld} from './arcade-fighters.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,hi));
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const pos=(a,b,t)=>({x:a.x+b.x*t,y:a.y+b.y*t});
function closestOn(a,b,p){
  const ab=minus(b,a), ap=minus(p,a);
  const t=clamp((ap.x*ab.x+ap.y*ab.y)/(ab.x*ab.x+ab.y*ab.y||1),0,1);
  return pos(a,ab,t);
}
function trim(b){
  const v=minus(b.tip,b.hand);
  return [pos(b.hand,v,.12),b.tip];
}
/** Intersection of the blade bodies, with a small tolerance for blade width. */
export function bladeIntersection(one,two,tolerance=3.4) {
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
const releases=(time,contact)=>Number.isFinite(contact)&&time>=Math.max(contact*.53,contact-.116)&&time<=contact+.027;
function releaseMask(f) {
  if((f.alive===false||(f.alive===undefined&&f.hp<=0))||!f.attack||f.attack==='force'||f.action==='force')return 0;
  return (!f.contact&&releases(f.actionTime,f.attackSpec?.contact)?1:0)
    |((f.gear?.dualSabers||f.gear?.weapon==='staff'||f.gear?.staff)&&!f.offhandContact&&releases(f.actionTime,f.attackSpec?.offhand?.contact)?2:0);
}
export function activeClashBlade(f){return releaseMask(f)>0;}
/** The physical emitters participating in this tick, regardless of order. */
export function activeClashEmitters(f,time){
  const mask=releaseMask(f);
  if(!mask)return [];
  const rig=sampleArcadeFighter(f,time);
  const {lean,bend,wide,torsoTurn}=rig,body={lean,bend,wide,torsoTurn};
  const w=arcadeBladeWorld(f,rig),staff=f.gear?.weapon==='staff'||f.gear?.staff;
  const on=physical=>physical==='rear'||physical==='offhand'
    ?w.offhand&&{...w.offhand,body,offhand:true,bladeId:physical}
    :{hand:w.hand,tip:w.tip,body,offhand:false,bladeId:'primary'};
  const lead=f.attackSpec?.blade??'primary';
  const trail=f.attackSpec?.offhand?.blade??(staff?'rear':'offhand');
  return [mask&1?on(lead):null,mask&2?on(trail):null].filter(Boolean);
}
/** Earliest pair is determined by stable fighter order, spectators never use RNG. */
export function findArcadeBladeContact(state){
  const active=state.fighters.filter(activeClashBlade),baked=new Map();
  const blade=f=>{
    if(!baked.has(f))baked.set(f,activeClashEmitters(f,state.time));
    return baked.get(f);
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
function insideSegment(a,b,r){
  let min=0,max=1;
  for(const [i,j,lo,hi] of [[a.x,b.x,r.x,r.x+r.width],[a.y,b.y,r.y,r.y+r.height]]){
    if(i===j){if(i<lo||i>hi)return false;continue;}
    const t=(lo-i)/(j-i),u=(hi-i)/(j-i);
    min=Math.max(min,Math.min(t,u));max=Math.min(max,Math.max(t,u));
    if(min>max)return false;
  }
  return min<max;
}

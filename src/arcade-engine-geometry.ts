/** Authoritative top-down body and cover queries. Positions stay live during separation. */
export interface ArcadePoint { x: number; y: number }
export interface ArcadeBody extends ArcadePoint {
  alive: boolean;
  radius: number;
  slot: number;
  team: 0 | 1;
}
export interface ArcadeCover extends ArcadePoint {
  width: number;
  height: number;
  kind?: string;
  damagePerSecond?: number;
  moveScale?: number;
}
export interface ArcadeBounds { minX: number; maxX: number; minY: number; maxY: number }
export interface ArcadeGeometry {
  terrain: { solids: readonly ArcadeCover[] };
  fighters: readonly ArcadeBody[];
  bounds: ArcadeBounds;
  config: { impactPhysics?: boolean };
}

export const bodyGap = 36;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const inside=(x: number,y: number,rect: ArcadeCover,pad=0)=>x>rect.x-pad&&x<rect.x+rect.width+pad&&y>rect.y-pad&&y<rect.y+rect.height+pad;
export const openAt=(s: Pick<ArcadeGeometry,'terrain'>,x: number,y: number,pad: number)=>!s.terrain.solids.some(r=>inside(x,y,r,pad));
export function crossed(x: number,y: number,tx: number,ty: number,rect: ArcadeCover,pad=0){
  const x0=rect.x-pad,x1=rect.x+rect.width+pad,y0=rect.y-pad,y1=rect.y+rect.height+pad;
  if((x<x0&&tx<x0)||(x>x1&&tx>x1)||(y<y0&&ty<y0)||(y>y1&&ty>y1))return false;
  const dx=tx-x,dy=ty-y;
  let near=0,far=1;
  if(Math.abs(dx)>1e-7){const a=(x0-x)/dx,b=(x1-x)/dx;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
  if(Math.abs(dy)>1e-7){const a=(y0-y)/dy,b=(y1-y)/dy;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
  return near<=far;
}
export const blockedBetween=(s: Pick<ArcadeGeometry,'terrain'>,x: number,y: number,tx: number,ty: number,pad=0)=>s.terrain.solids.find(r=>crossed(x,y,tx,ty,r,pad));
export const canSlide=(s: Pick<ArcadeGeometry,'terrain'>,f: Pick<ArcadeBody,'radius'>,x: number,y: number,tx: number,ty: number)=>{
  if(openAt(s,tx,ty,f.radius) && !blockedBetween(s,x,y,tx,ty,f.radius-.1))return true;
  // If externally placed inside cover, permit an exit only to a clear point.
  return !openAt(s,x,y,f.radius-.1)&&openAt(s,tx,ty,f.radius);
};
// Sweep the ground-plane body disk through the entire step. Feet keep
// a landing footprint during vaults; short jumps cannot merge silhouettes.
export function bodyMotionFraction(s: Pick<ArcadeGeometry,'fighters'>,f: ArcadeBody,x: number,y: number,tx: number,ty: number){
  if(!f.alive)return 1;
  const dx=tx-x,dy=ty-y,len2=dx*dx+dy*dy;
  if(len2<1e-12)return 1;
  let portion=1;
  for(const o of s.fighters){
    if(o===f||!o.alive)continue;
    const ax=x-o.x,ay=y-o.y,r=f.radius+o.radius;
    if(Math.abs(ax)>r+Math.abs(dx)||Math.abs(ay)>r+Math.abs(dy))continue;
    const dot=ax*dx+ay*dy;
    if(dot>=0)continue;
    const c=ax*ax+ay*ay-r*r;
    if(c<=0)return 0;
    const discr=dot*dot-len2*c;
    if(discr<=0)continue;
    const entry=(-dot-Math.sqrt(discr))/len2;
    if(entry<portion)portion=Math.max(0,entry-1e-5);
  }
  return portion;
}
export function separate(s: ArcadeGeometry){
  const {minX,maxX,minY,maxY}=s.bounds;
  const runners=s.fighters.filter(f=>f.alive);
  // Repeated constrained projection solves rows and corner jams, where
  // assigning each fighter half the correction let wall-side stacks persist.
  const passes=s.config.impactPhysics?(runners.length>4?7:4):(runners.length>4?5:3);
  for(let pass=0;pass<passes;pass++){
    let unresolved=false;
    for(let i=0;i<runners.length;i++)for(let j=i+1;j<runners.length;j++){
      const a=runners[i],b=runners[j];

      const dx=b.x-a.x,dy=b.y-a.y;
      const gap=bodyGap+(a.team===b.team?6:0);
      if(Math.abs(dx)>=gap||Math.abs(dy)>=gap)continue;
      const d=Math.hypot(dx,dy);
      if(d>=gap-.2)continue;
      unresolved=true;
      const bearing=(a.slot*2.39996+b.slot*1.61803+(a.team===b.team?.9:0))%(Math.PI*2);
      const nx=d>.001?dx/d:Math.cos(bearing),ny=d>.001?dy/d:Math.sin(bearing);
      const m=gap-d;
      const shift=(f: ArcadeBody,sign: number,target: number)=>{
        const tx=clamp(f.x+nx*target*sign,minX,maxX),ty=clamp(f.y+ny*target*sign,minY,maxY);
        if(!canSlide(s,f,f.x,f.y,tx,ty))return 0;
        const fraction=bodyMotionFraction(s,f,f.x,f.y,tx,ty);
        const moved=((tx-f.x)*nx+(ty-f.y)*ny)*sign*fraction;
        f.x+=(tx-f.x)*fraction;f.y+=(ty-f.y)*fraction;return moved;
      };
      const half=shift(a,-1,m*.5);
      const second=shift(b,1,m-half);
      if(half+second<m-.15)shift(a,-1,m-half-second);
      // A wall can pin both along the normal, particularly as a vault lands.
      // Give the pair a tangent escape rather than leaving them on one spot.
      const adx=b.x-a.x,ady=b.y-a.y;
      if(adx*adx+ady*ady<gap*gap*(s.config.impactPhysics?.86:.69)){
        const options=[a,b],orig=Math.hypot(adx,ady);
        let best: { f: ArcadeBody; tx: number; ty: number } | null=null,bestD=orig+1;
        for(const f of options)for(const sign of [-1,1]){
          const distance=(gap-orig)*.65;
          let tx=clamp(f.x-ny*distance*sign,minX,maxX),ty=clamp(f.y+nx*distance*sign,minY,maxY);
          const fraction=bodyMotionFraction(s,f,f.x,f.y,tx,ty);
          tx=f.x+(tx-f.x)*fraction;ty=f.y+(ty-f.y)*fraction;
          const other=f===a?b:a,candidate=Math.hypot(tx-other.x,ty-other.y);
          if(candidate>bestD&&canSlide(s,f,f.x,f.y,tx,ty)){
            best={f,tx,ty};bestD=candidate;
          }
        }
        if(best){best.f.x=best.tx;best.f.y=best.ty;}
      }
    }
    if(!unresolved)break;
  }
}

interface PathArena extends Pick<ArcadeGeometry, 'terrain' | 'bounds'> {
  time: number;
  liveByTeam?: readonly [number, number];
}
interface PathFighter extends ArcadeBody {
  masterRoute?: { tx: number; ty: number; until: number; points: ArcadePoint[]; blocked?: boolean };
  route?: (ArcadePoint & { until: number }) | null;
  rankDominance: number;
}
interface SpawnArena extends Pick<ArcadeGeometry, 'terrain' | 'bounds'> {
  width: number;
  height: number;
  fighters: readonly ArcadePoint[];
  config: { formations: readonly string[]; deployments: readonly string[] };
}

function masterPath(s: PathArena,f: PathFighter,enemy: ArcadePoint): ArcadePoint | null{
  const old=f.masterRoute;
  if(old&&old.until>s.time&&Math.hypot(old.tx-enemy.x,old.ty-enemy.y)<58){
    if(old.blocked)return null;
    while(old.points.length&&Math.hypot(old.points[0].x-f.x,old.points[0].y-f.y)<17)old.points.shift();
    if(old.points.length&&!blockedBetween(s,f.x,f.y,old.points[0].x,old.points[0].y,f.radius-.2))return old.points[0];
  }
  const pad=f.radius+7, b=s.bounds;
  const nodes=[{x:f.x,y:f.y},{x:enemy.x,y:enemy.y}];
  for(const block of s.terrain.solids){
    for(const x of [block.x-pad,block.x+block.width+pad])for(const y of [block.y-pad,block.y+block.height+pad]){
      if(x>b.minX&&x<b.maxX&&y>b.minY&&y<b.maxY&&openAt(s,x,y,f.radius+1))nodes.push({x,y});
    }
  }
  const scores=Array<number>(nodes.length).fill(Infinity), parents=Array<number>(nodes.length).fill(-1), closed=new Set<number>();
  const distance=(i: number,j: number)=>Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
  scores[0]=0;
  for(let tries=0;tries<nodes.length;tries++){
    let best=-1,estimate=Infinity;
    for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&scores[i]+distance(i,1)<estimate){
      best=i;estimate=scores[i]+distance(i,1);
    }
    if(best<0)break;
    if(best===1){
      const points=[];let i=parents[best];
      while(i>0){points.unshift(nodes[i]);i=parents[i];}
      f.masterRoute={tx:enemy.x,ty:enemy.y,until:s.time+1.12,points};
      return points[0]??enemy;
    }
    closed.add(best);const a=nodes[best];
    for(let i=1;i<nodes.length;i++){
      const score=scores[best]+distance(best,i);
      if(closed.has(i)||score>=scores[i])continue;
      const n=nodes[i];
      if(!blockedBetween(s,a.x,a.y,n.x,n.y,f.radius-.2)){scores[i]=score;parents[i]=best;}
    }
  }
  f.masterRoute={tx:enemy.x,ty:enemy.y,until:s.time+.6,points:[],blocked:true};
  return null;
}
export function chooseRoute(s: PathArena,f: PathFighter,enemy: ArcadePoint): ArcadePoint{
  if(!s.terrain.solids.length)return enemy;
  const block=blockedBetween(s,f.x,f.y,enemy.x,enemy.y,f.radius+1);
  if(!block){f.route=null;return enemy;}
  if(f.rankDominance>=10&&((s.liveByTeam?.[1-f.team]??Infinity)<=5||s.liveByTeam?.[f.team]===1)){const route=masterPath(s,f,enemy);if(route)return route;}
  if(f.route&&f.route.until>s.time&&Math.hypot(f.route.x-f.x,f.route.y-f.y)>24)return f.route;
  const p=f.radius+10, {minX,maxX,minY,maxY}=s.bounds;
  const points=[{x:block.x-p,y:block.y-p},{x:block.x+block.width+p,y:block.y-p},
    {x:block.x-p,y:block.y+block.height+p},{x:block.x+block.width+p,y:block.y+block.height+p}];
  const valid=points.filter(({x,y})=>x>=minX&&x<=maxX&&y>=minY&&y<=maxY&&openAt(s,x,y,f.radius)&&!blockedBetween(s,f.x,f.y,x,y,f.radius));
  const distance=(point: ArcadePoint)=>Math.hypot(point.x-f.x,point.y-f.y)+Math.hypot(enemy.x-point.x,enemy.y-point.y);
  valid.sort((a,b)=>distance(a)-distance(b));
  if(valid.length){f.route={...valid[0],until:s.time+.55};return f.route;}
  return enemy;
}
export function spawnPosition(s: SpawnArena,team: 0 | 1,slot: number,count: number): [number,number]{
  const {bounds:b}=s, mid=(b.minY+b.maxY)/2, xSpan=b.maxX-b.minX;
  const dir=team===0?1:-1, edge=team===0?b.minX:b.maxX, formation=s.config.formations[team];
  let x,y;
  if(count<=3&&formation==='line'){
    x=s.width*(team===0?(slot>0?.23:.31):(slot>0?.77:.69));
    y=clamp(s.height*.5+(slot>0?(slot%2?1:-1)*Math.min(110,s.height*.18):0),b.minY,b.maxY);
  }else{
    const row=slot%5;const col=Math.floor(slot/5);const order=[0,1,-1,2,-2];
    const gap=Math.min(75,(b.maxY-b.minY-40)/4);
    y=mid+order[row]*gap;
    x=edge+dir*(xSpan*(formation==='spread'?.33:.30)-col*48-(formation==='wedge'?Math.abs(order[row])*26:0));
    if(formation==='spread')y=mid+order[row]*gap+([0,1,-1][col]??0)*Math.min(gap*.34,23);
  }
  x+=dir*(s.config.deployments[team]==='forward'?56:s.config.deployments[team]==='reserve'?-56:0);
  const trim=(xx: number,yy: number): [number,number]=>[clamp(xx,b.minX+5,b.maxX-5),clamp(yy,b.minY+5,b.maxY-5)];
  for(let i=0;i<8;i++) for(const dy of [0,30,-30,60,-60]){
    const [xx,yy]=trim(x-dir*i*36,y+dy);
    if(openAt(s,xx,yy,17)&&!s.fighters.some(other=>Math.hypot(other.x-xx,other.y-yy)<bodyGap))return [xx,yy];
  }
  // Very dense or blocked starts use a nearest legal same-side grid cell.
  const alternatives=[];
  for(let px=b.minX+19;px<b.maxX-19;px+=37){
    if(team===0?px>s.width*.46:px<s.width*.54)continue;
    for(let py=b.minY+19;py<b.maxY-19;py+=37){
      if(openAt(s,px,py,17)&&s.fighters.every(other=>Math.hypot(other.x-px,other.y-py)>=bodyGap))
        alternatives.push({x:px,y:py,d:Math.hypot(px-x,py-y)});
    }
  }
  alternatives.sort((a,b)=>a.d-b.d);
  return alternatives.length?[alternatives[0].x,alternatives[0].y]:trim(x,y);
}

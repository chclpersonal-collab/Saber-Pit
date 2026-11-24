/** All visible collision walls and navigation waypoints share these authored world coordinates. */
type Point={x:number;y:number};
type Team=0|1;
type Lane=0|1|2;
const p=(x:number,y:number):Point=>({x,y});
const line=(...points:Point[])=>points;
const defense=(blue:Point,pink:Point):readonly [Point,Point]=>[blue,pink];
const pad=(id:string,x:number,y:number,x2:number,y2:number)=>({id,x,y,x2,y2,points:[p(x,y),p(x2,y),p(x2,y2),p(x,y2)]});
export const MOBA_BATTLEFIELD={
  width:1280,height:720,
  lanes:[
    {id:0,name:'Cinder Ridge',width:75,points:line(p(115,165),p(230,158),p(365,185),p(485,130),p(640,107),p(795,130),p(915,185),p(1050,158),p(1165,165)),towerNodes:defense(p(365,185),p(915,185))},
    {id:1,name:'Bellway',width:102,points:line(p(115,360),p(274,366),p(365,360),p(530,360),p(640,360),p(750,360),p(915,360),p(1006,354),p(1165,360)),towerNodes:defense(p(365,360),p(915,360))},
    {id:2,name:'Ash Canal',width:82,points:line(p(115,555),p(220,561),p(365,535),p(485,589),p(640,616),p(795,589),p(915,535),p(1060,561),p(1165,555)),towerNodes:defense(p(365,535),p(915,535))},
  ],
  crossings:[
    {id:'west_gate',width:69,points:line(p(230,158),p(260,240),p(274,366),p(254,477),p(220,561))},
    {id:'bell_forum',width:107,points:line(p(640,107),p(615,248),p(640,360),p(665,470),p(640,616))},
    {id:'east_gate',width:69,points:line(p(1050,158),p(1020,240),p(1006,354),p(1026,477),p(1060,561))},
  ],
  blockers:[pad('west_arch',452,247,547,294),pad('east_arch',733,247,828,294),pad('west_canal',452,426,547,473),pad('east_canal',733,426,828,473)],
  cores:defense(p(72,360),p(1208,360)),
  spawns:defense(p(115,360),p(1165,360)),
  forum:{center:p(640,360),radius:83},
} as const;

const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function mobaClearPath(a:Point,b:Point,radius=0):boolean {
  const dx=b.x-a.x,dy=b.y-a.y;
  for(const wall of MOBA_BATTLEFIELD.blockers){
    const left=wall.x-radius,right=wall.x2+radius,top=wall.y-radius,bottom=wall.y2+radius;
    if(Math.max(a.x,b.x)<left||Math.min(a.x,b.x)>right||Math.max(a.y,b.y)<top||Math.min(a.y,b.y)>bottom)continue;
    const xi=dx===0?-Infinity:((dx>0?left:right)-a.x)/dx;
    const xo=dx===0?Infinity:((dx>0?right:left)-a.x)/dx;
    const yi=dy===0?-Infinity:((dy>0?top:bottom)-a.y)/dy;
    const yo=dy===0?Infinity:((dy>0?bottom:top)-a.y)/dy;
    if(Math.max(0,xi,yi)<=Math.min(1,xo,yo))return false;
  }
  return true;
}
const bounded=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
export function mobaWalk(a:Point,dx:number,dy:number,radius:number):Point {
  const x=bounded(a.x+dx,34,MOBA_BATTLEFIELD.width-34),y=bounded(a.y+dy,55,MOBA_BATTLEFIELD.height-55);
  if(mobaClearPath(a,{x,y},radius))return {x,y};
  const alongX={x,y:a.y},alongY={x:a.x,y};
  if(Math.abs(dx)>Math.abs(dy)){
    if(mobaClearPath(a,alongX,radius))return alongX;
    if(mobaClearPath(a,alongY,radius))return alongY;
  }else{
    if(mobaClearPath(a,alongY,radius))return alongY;
    if(mobaClearPath(a,alongX,radius))return alongX;
  }
  return {x:a.x,y:a.y};
}
export function mobaLaneWaypoint(lane:Lane,team:Team,origin:Point,end:Point){
  const direction=team===0?1:-1;
  const points=MOBA_BATTLEFIELD.lanes[lane].points;
  const path=team===0?points:[...points].reverse();
  if(direction*(end.x-origin.x)<0)return end;
  return path.find(n=>direction*(n.x-origin.x)>7&&direction*(end.x-n.x)>7)??end;
}
/** Routes toward the authored clearing or terrain corners if direct movement is screened. */
export function mobaNavPoint(from:Point,to:Point,radius:number):Point{
  if(mobaClearPath(from,to,radius))return to;
  const nodes=MOBA_BATTLEFIELD.blockers.flatMap(w=>{
    const r=radius+8;
    return [p(w.x-r,w.y-r),p(w.x2+r,w.y-r),p(w.x-r,w.y2+r),p(w.x2+r,w.y2+r)];
  });
  const graph=[from,...nodes,to], goal=graph.length-1;
  const cost=graph.map((_,i)=>i===0?0:Infinity), parents=graph.map(()=>-1), seen=new Set<number>();
  for(let k=0;k<graph.length;k++){
    const current=cost.reduce((best,d,i)=>!seen.has(i)&&(best===-1||d<cost[best])?i:best,-1);
    if(current<0||!Number.isFinite(cost[current])||current===goal)break;
    seen.add(current);
    for(let i=1;i<graph.length;i++){
      if(i===current||seen.has(i)||!mobaClearPath(graph[current],graph[i],radius))continue;
      const next=cost[current]+distance(graph[current],graph[i]);
      if(next<cost[i]){cost[i]=next;parents[i]=current;}
    }
  }
  if(parents[goal]<0)return from;
  let step=goal;
  while(parents[step]>0)step=parents[step];
  return graph[step];
}

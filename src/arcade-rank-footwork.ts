type Plan=ReturnType<typeof arcadeFootworkPlan>;
/** Grounded spacing for simulation-rank training. Speeds are pixels/second. */
const move=(id:string,label:string,minRank:number,path:string,duration:number,cost:number,speed:number,lane:number,turn:number,variation:number)=>Object.freeze({
  id,label,minRank,path,duration,cost,speed,lane,turn,variation,
});
export const ARCADE_RANK_FOOTWORK=Object.freeze([
  move('check_step','Check Step',2,'check',.22,8,257,2.90,0,.30),
  move('outside_step','Outside Step',4,'side',.27,11,289,1.67,.17,.55),
  move('slip_step','Slip Step',6,'slip',.30,13,301,1.99,-.40,.52),
  move('draw_arc','Draw Arc',8,'arc',.33,15,313,1.23,.70,.69),
  move('switch_step','Switch Step',10,'switch',.35,16,324,1.85,-.82,.71),
  move('wheel_step','Wheel Step',12,'wheel',.39,17,334,1.42,.54,.87),
  move('return_step','Return Step',14,'return',.42,18,340,2.32,-1.27,.88),
]);
const byId=Object.freeze(Object.fromEntries(ARCADE_RANK_FOOTWORK.map(m=>[m.id,m])));
const bounded=(i:unknown)=>Math.max(0,Math.min(14,Math.floor(Number(i)||0)));
const tables=Object.freeze(Array.from({length:15},(_,index)=>Object.freeze(ARCADE_RANK_FOOTWORK.filter(m=>m.minRank<=index))));
export const arcadeRankFootworkFor=(index:number)=>tables[bounded(index)];
export const arcadeRankFootworkById=(id:string,index:number)=>{
  const spec=Object.hasOwn(byId,id)?byId[id]:null;
  return spec&&spec.minRank<=bounded(index)?spec:null;
};
const identity:Record<string,{pace:number;arc:number}>={
  shii_cho:{pace:1,arc:1},makashi:{pace:1.05,arc:.83},soresu:{pace:.88,arc:.86},
  ataru:{pace:1.11,arc:1.16},djem_so:{pace:.92,arc:.88},niman:{pace:.98,arc:1.08},juyo:{pace:1.08,arc:1.12},
};
const smooth=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
export function arcadeFootworkPlan(spec:ReturnType<typeof move>,{face,side,form,grade}:{face:number;side:number;form:string;grade:number}){
  const type=identity[form]??identity.shii_cho;
  return {...spec,face,side,bearing:face+side*spec.lane,
    turn:spec.turn*type.arc,speed:spec.speed*type.pace*(1+(bounded(grade)-spec.minRank)*.007)};
}
export function arcadeFootworkMotion(plan:Plan,time:number){
  const phase=Math.min(1,Math.max(0,time/plan.duration));
  const transfer=smooth((phase-.23)/.59);
  const bearing=plan.bearing+plan.side*plan.turn*transfer;
  const push=Math.sin(Math.PI*phase)**.88;
  const second=1+Math.sin(phase*Math.PI*2-Math.PI*.4)*plan.variation*.24;
  const speed=plan.speed*push*second;
  return {x:Math.cos(bearing)*speed,y:Math.sin(bearing)*speed};
}
export function planPeerFootwork(index:number,{form,danger,retreat,serial}:{form:string;danger:boolean;retreat:boolean;serial:number}){
  const options=arcadeRankFootworkFor(index);
  if(!options.length)return null;
  // Prefer compact forms on a very short clock, not the highest unlocked
  // technique automatically. A different choice pays its own time and gas.
  let pool:typeof options=options.filter(m=>danger?m.path==='check'||m.path==='side'||m.path==='slip':
    retreat?m.path!=='arc':m.path!=='check');
  if(!pool.length)pool=options;
  if(pool.length>2){
    const favored=({makashi:'slip',soresu:'check',ataru:'wheel',djem_so:'return',niman:'arc',juyo:'switch',shii_cho:'side'} as Record<string,string>)[form];
    const favorite=pool.find(m=>m.path===favored);
    if(favorite&&(serial%3===0))return favorite;
  }
  return pool[serial%pool.length];
}

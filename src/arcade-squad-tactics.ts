/**
 * Squad-level planning for Arena AI teams: roles, formation slots, one
 * shared phase, focus fire, peeling and regrouping. Pure and deterministic:
 * it reads a snapshot and returns orders, it never touches the simulation.
 * Rank sets how well a squad coordinates, never how fast or hard it hits.
 */

export type ArcadeSquadRole='frontline'|'flanker'|'support';
export type ArcadeSquadPhase='form'|'engage'|'hold'|'regroup'|'retreat';
export type ArcadeSquadOrderKind='slot'|'engage'|'flank'|'peel'|'hold'|'regroup'|'retreat';
export type ArcadeSquadFormation='line'|'wedge'|'spread';

export interface ArcadeSquadUnit {
  id:string;x:number;y:number;
  /** Health and stamina, 0-100. */
  hp:number;energy:number;
  /** 0 is F, 14 is SSS+V. */
  gradeIndex:number;
  alive:boolean;
}

export interface ArcadeSquadSnapshot {
  allies:readonly ArcadeSquadUnit[];
  foes:readonly ArcadeSquadUnit[];
  formation:ArcadeSquadFormation;
  doctrine:'balanced'|'aggressive'|'defensive';
  /** Phase from the previous plan, so a squad does not flicker between phases. */
  previous?:ArcadeSquadPhase|null;
  /** Seconds the squad has spent in the previous phase. Forming and holding give way to engaging. */
  phaseAge?:number;
}

/** Longest a squad forms up, or holds a defensive line, before it commits. */
export const ARCADE_SQUAD_FORM_LIMIT=2.5;
export const ARCADE_SQUAD_HOLD_LIMIT=6;

export interface ArcadeSquadOrder {
  kind:ArcadeSquadOrderKind;
  targetId?:string;
  x?:number;y?:number;
}

export interface ArcadeSquadPlan {
  phase:ArcadeSquadPhase;
  roles:Readonly<Record<string,ArcadeSquadRole>>;
  focusId:string|null;
  orders:Readonly<Record<string,ArcadeSquadOrder>>;
}

const MAX_GRADE=14;
const SLOT_GAP=58;
const IN_SLOT=46;
const ENGAGE_RANGE=150;
const PEEL_RANGE=95;
const LOW_HP=32;
/** Allies closer than this get pushed apart so a team fight never collapses into one blob. */
export const ARCADE_SQUAD_MIN_GAP=44;
/** How far round a target attackers stand, so two on one foe come from two sides. */
const APPROACH_RING=40;

/** 0 for an all-F squad, 1 for all SSS+V. */
export function arcadeSquadCoordination(allies:readonly ArcadeSquadUnit[]):number{
  const live=allies.filter(a=>a.alive);
  if(!live.length)return 0;
  const avg=live.reduce((s,a)=>s+Math.max(0,Math.min(MAX_GRADE,a.gradeIndex||0)),0)/live.length;
  return Math.round(avg/MAX_GRADE*1000)/1000;
}

/** What a squad at this coordination level knows how to do. */
export function arcadeSquadSkills(coordination:number){
  return Object.freeze({
    formation:true,
    focus:coordination>=.07,       // E and up share a target
    retreat:coordination>=.14,     // D and up pull back to recover
    peel:coordination>=.21,        // C and up protect a hurt ally
    flank:coordination>=.28,       // B and up send flankers wide
    staggeredEngage:coordination>=.35, // A and up wait until most are in place
    // Even an F squad caps how many gang one foe; trained squads may stack a third on the focus.
    maxPerTarget:coordination>=.07?3:2,
  });
}

const centroid=(units:readonly ArcadeSquadUnit[])=>{
  const n=units.length||1;
  return {x:units.reduce((s,u)=>s+u.x,0)/n,y:units.reduce((s,u)=>s+u.y,0)/n};
};
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const round=(v:number)=>Math.round(v*100)/100;

/** Strongest half hold the front, the most rested of the rest flank, the most hurt support. */
export function assignArcadeSquadRoles(allies:readonly ArcadeSquadUnit[]):Record<string,ArcadeSquadRole>{
  const live=allies.filter(a=>a.alive);
  const score=(a:ArcadeSquadUnit)=>a.hp*.7+a.energy*.3;
  const sorted=[...live].sort((a,b)=>score(b)-score(a)||(a.id<b.id?-1:a.id>b.id?1:0));
  const roles:Record<string,ArcadeSquadRole>={};
  const front=Math.max(1,Math.ceil(sorted.length/2));
  sorted.forEach((a,i)=>{roles[a.id]=i<front?'frontline':'flanker';});
  if(sorted.length>=3){
    const hurt=[...sorted].sort((a,b)=>a.hp-b.hp||(a.id<b.id?-1:1))[0];
    if(hurt.hp<60)roles[hurt.id]='support';
    else roles[sorted[sorted.length-1].id]='support';
  }
  return roles;
}

/** Formation slots facing the foe, centred a little behind the squad's centre. */
export function arcadeSquadSlots(allies:readonly ArcadeSquadUnit[],foes:readonly ArcadeSquadUnit[],formation:ArcadeSquadFormation,roles:Record<string,ArcadeSquadRole>){
  const live=allies.filter(a=>a.alive);
  const own=centroid(live), enemy=centroid(foes.filter(f=>f.alive));
  const facing=Math.atan2(enemy.y-own.y,enemy.x-own.x)||0;
  const fx=Math.cos(facing),fy=Math.sin(facing),sx=-fy,sy=fx;
  const order=[...live].sort((a,b)=>{
    const rank={frontline:0,flanker:1,support:2};
    return rank[roles[a.id]]-rank[roles[b.id]]||(a.id<b.id?-1:1);
  });
  const slots:Record<string,{x:number;y:number}>={};
  const n=order.length;
  order.forEach((a,i)=>{
    const lane=i-(n-1)/2;
    let ahead=0,side=lane*SLOT_GAP;
    if(formation==='wedge')ahead=-Math.abs(lane)*SLOT_GAP*.7;
    if(formation==='spread')side=lane*SLOT_GAP*1.6;
    if(roles[a.id]==='support')ahead-=SLOT_GAP*.9;
    slots[a.id]={x:round(own.x+fx*ahead+sx*side),y:round(own.y+fy*ahead+sy*side)};
  });
  return slots;
}

/** Hurt foe that at least two allies can reach soon; nearest to the squad as a tiebreak. */
export function arcadeSquadFocus(allies:readonly ArcadeSquadUnit[],foes:readonly ArcadeSquadUnit[]):string|null{
  const live=allies.filter(a=>a.alive), targets=foes.filter(f=>f.alive);
  if(!targets.length||!live.length)return null;
  const own=centroid(live);
  const reachable=(f:ArcadeSquadUnit)=>live.filter(a=>dist(a,f)<ENGAGE_RANGE*1.6).length;
  const pool=targets.filter(f=>reachable(f)>=Math.min(2,live.length));
  const list=pool.length?pool:targets;
  return [...list].sort((a,b)=>a.hp-b.hp||dist(a,own)-dist(b,own)||(a.id<b.id?-1:1))[0].id;
}

/**
 * Share foes out so no foe is ganged by more than maxPerTarget. The focus
 * target fills first with the closest allies, then each other ally takes the
 * nearest foe that still has room, which spreads a big fight along a front.
 */
export function assignArcadeSquadTargets(allies:readonly ArcadeSquadUnit[],foes:readonly ArcadeSquadUnit[],focusId:string|null,maxPerTarget:number):Record<string,string>{
  const live=allies.filter(a=>a.alive), targets=foes.filter(f=>f.alive);
  const out:Record<string,string>={};
  if(!live.length||!targets.length)return out;
  const cap=Math.max(maxPerTarget,Math.ceil(live.length/targets.length));
  const load:Record<string,number>={};
  const byId=(x:ArcadeSquadUnit,y:ArcadeSquadUnit)=>x.id<y.id?-1:x.id>y.id?1:0;
  const focus=targets.find(f=>f.id===focusId);
  const left=new Set(live.map(a=>a.id));
  if(focus){
    for(const a of [...live].sort((x,y)=>dist(x,focus)-dist(y,focus)||byId(x,y)).slice(0,cap)){
      out[a.id]=focus.id;load[focus.id]=(load[focus.id]??0)+1;left.delete(a.id);
    }
  }
  // Closest pairs claim first, so the fight splits into local duels and pairs.
  const pairs:{a:ArcadeSquadUnit;f:ArcadeSquadUnit;d:number}[]=[];
  for(const a of live)if(left.has(a.id))for(const f of targets)pairs.push({a,f,d:dist(a,f)});
  pairs.sort((x,y)=>x.d-y.d||byId(x.a,y.a)||byId(x.f,y.f));
  for(const {a,f} of pairs){
    if(!left.has(a.id)||(load[f.id]??0)>=cap)continue;
    out[a.id]=f.id;load[f.id]=(load[f.id]??0)+1;left.delete(a.id);
  }
  return out;
}

/**
 * Push apart allies standing closer than minGap. Returns a small offset per
 * ally for the engine to add to its move goal; allies already apart get none.
 */
export function arcadeSquadSpacing(allies:readonly ArcadeSquadUnit[],minGap=ARCADE_SQUAD_MIN_GAP):Record<string,{x:number;y:number}>{
  const live=[...allies.filter(a=>a.alive)].sort((x,y)=>x.id<y.id?-1:1);
  const out:Record<string,{x:number;y:number}>={};
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
    const a=live[i],b=live[j];
    const d=dist(a,b);
    if(d>=minGap)continue;
    // Stacked units split along a fixed, id-based angle so the result stays deterministic.
    const angle=d>.001?Math.atan2(a.y-b.y,a.x-b.x):(i*2.399963+j)%(Math.PI*2);
    const push=(minGap-d)/2;
    const pa=(out[a.id]??={x:0,y:0}),pb=(out[b.id]??={x:0,y:0});
    pa.x+=Math.cos(angle)*push;pa.y+=Math.sin(angle)*push;
    pb.x-=Math.cos(angle)*push;pb.y-=Math.sin(angle)*push;
  }
  for(const id of Object.keys(out))out[id]=Object.freeze({x:round(out[id].x),y:round(out[id].y)});
  return out;
}

function choosePhase(s:ArcadeSquadSnapshot,skills:ReturnType<typeof arcadeSquadSkills>,slots:Record<string,{x:number;y:number}>):ArcadeSquadPhase{
  const live=s.allies.filter(a=>a.alive), foes=s.foes.filter(f=>f.alive);
  if(!live.length||!foes.length)return 'hold';
  const avg=(u:readonly ArcadeSquadUnit[])=>u.reduce((t,a)=>t+a.hp,0)/u.length;
  const losing=avg(live)<35&&avg(live)<avg(foes)-15&&live.length<=foes.length;
  if(skills.retreat&&losing)return 'retreat';
  const own=centroid(live);
  const contact=foes.some(f=>dist(f,own)<ENGAGE_RANGE);
  const inPlace=live.filter(a=>dist(a,slots[a.id])<IN_SLOT).length;
  const ready=inPlace>=Math.ceil(live.length*.66);
  const scattered=live.some(a=>dist(a,own)>SLOT_GAP*live.length*1.4);
  if(skills.retreat&&s.previous==='retreat'&&avg(live)<50&&!contact)return 'regroup';
  if(s.previous==='engage'&&contact)return 'engage';
  if(scattered&&!contact&&skills.staggeredEngage)return 'regroup';
  const age=s.phaseAge??0;
  if(s.previous==='hold'&&age>=ARCADE_SQUAD_HOLD_LIMIT)return 'engage';
  if(s.doctrine==='defensive'&&!contact)return 'hold';
  if((s.previous==='form'||s.previous==='regroup')&&age>=ARCADE_SQUAD_FORM_LIMIT)return 'engage';
  if(!skills.staggeredEngage)return 'engage';
  return ready||contact||s.doctrine==='aggressive'?'engage':'form';
}

export function planArcadeSquad(s:ArcadeSquadSnapshot):ArcadeSquadPlan{
  const live=s.allies.filter(a=>a.alive), foes=s.foes.filter(f=>f.alive);
  const coordination=arcadeSquadCoordination(s.allies);
  const skills=arcadeSquadSkills(coordination);
  const roles=assignArcadeSquadRoles(s.allies);
  const slots=arcadeSquadSlots(s.allies,s.foes,s.formation,roles);
  const phase=choosePhase(s,skills,slots);
  const focusId=skills.focus?arcadeSquadFocus(s.allies,s.foes):null;
  const orders:Record<string,ArcadeSquadOrder>={};
  const own=centroid(live), enemy=centroid(foes);
  const away=Math.atan2(own.y-enemy.y,own.x-enemy.x)||0;
  const nearestFoe=(a:ArcadeSquadUnit)=>[...foes].sort((x,y)=>dist(a,x)-dist(a,y)||(x.id<y.id?-1:1))[0];
  const assigned=phase==='engage'||phase==='hold'?assignArcadeSquadTargets(live,foes,focusId,skills.maxPerTarget):{};
  const attackers:Record<string,number>={};
  for(const a of live){
    const slot=slots[a.id];
    if(phase==='retreat'){orders[a.id]={kind:'retreat',x:round(a.x+Math.cos(away)*120),y:round(a.y+Math.sin(away)*120)};continue;}
    if(phase==='regroup'){orders[a.id]={kind:'regroup',x:slot.x,y:slot.y};continue;}
    if(phase==='form'){orders[a.id]={kind:'slot',x:slot.x,y:slot.y};continue;}
    if(phase==='hold'){orders[a.id]={kind:'hold',x:slot.x,y:slot.y};continue;}
    const target=assigned[a.id];
    const t=foes.find(f=>f.id===target);
    if(!t)continue;
    if(skills.flank&&roles[a.id]==='flanker'){
      const side=Math.sign((a.x-own.x)*-Math.sin(away)+(a.y-own.y)*Math.cos(away))||1;
      orders[a.id]={kind:'flank',targetId:target,x:round(t.x-Math.sin(away)*side*70),y:round(t.y+Math.cos(away)*side*70)};
    }else{
      // Attackers on one foe take different points round it: centre, then left, then right.
      const slot=(attackers[target]??=0);attackers[target]++;
      const angle=away+[0,.95,-.95][slot%3];
      orders[a.id]={kind:'engage',targetId:target,x:round(t.x+Math.cos(angle)*APPROACH_RING),y:round(t.y+Math.sin(angle)*APPROACH_RING)};
    }
  }
  if(skills.peel&&(phase==='engage'||phase==='hold')){
    for(const hurt of live.filter(a=>a.hp<LOW_HP)){
      const threat=foes.filter(f=>dist(f,hurt)<PEEL_RANGE).sort((x,y)=>dist(x,hurt)-dist(y,hurt))[0];
      if(!threat)continue;
      const helper=live.filter(a=>a.id!==hurt.id&&a.hp>=50&&orders[a.id]?.kind!=='peel')
        .sort((x,y)=>dist(x,hurt)-dist(y,hurt)||(x.id<y.id?-1:1))[0];
      if(helper)orders[helper.id]={kind:'peel',targetId:threat.id};
      orders[hurt.id]={kind:'retreat',x:round(hurt.x+Math.cos(away)*90),y:round(hurt.y+Math.sin(away)*90)};
    }
  }
  for(const id of Object.keys(orders))Object.freeze(orders[id]);
  return Object.freeze({phase,roles:Object.freeze(roles),focusId,orders:Object.freeze(orders)});
}

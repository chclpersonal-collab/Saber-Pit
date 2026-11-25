/** LOOMEN v6 crowd AI: fear, morale, spacing, an engage cap, elite escapes and personalities.
 *  Runs only when `config.crowdAI` is on (the live v6 Arena), on top of the authored and smart layers.
 *  It never steers a player-controlled fighter. Every draw is a hash of the tick, fighter and salt,
 *  so matches stay deterministic and the game RNG stream is untouched. */
import type {SimCommand,SimFighter,SimGame} from './arcade-engine-state.js?v=6.0.2-rc2';
import {arcadeInjuryBurden} from './arcade-injuries.js?v=6.0.2-rc2';
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=3.1.0';

export type CrowdPersona='reckless'|'coward'|'showoff'|'tactician'|'loyal'|'opportunist'|'grudge';
export const CROWD_PERSONAS:readonly CrowdPersona[]=Object.freeze(['reckless','coward','showoff','tactician','loyal','opportunist','grudge']);
export const CROWD_PERSONA_LABELS:Readonly<Record<CrowdPersona,string>>=Object.freeze({
  reckless:'Reckless',coward:'Coward',showoff:'Showoff',tactician:'Tactician',loyal:'Loyal',opportunist:'Opportunist',grudge:'Grudge'});
/** Speech the crowd may bark. Short and rare by design: never names or descriptors. */
export const CROWD_BARKS=Object.freeze(['Run!','Mine!','Help!','Come on!','Too easy','Now!','Hold!'] as const);
export type CrowdBark=typeof CROWD_BARKS[number];
export type CrowdState='fight'|'flee';
export type CrowdRole='engage'|'ring'|'hold'|'free';
export type CrowdPoseKind='flinch'|'taunt'|'cower'|'victory';

interface Traits {
  aggression:number;  // 0..1 how readily it swings when it may
  fearScale:number;   // multiplies fear from a rank gap
  breakAt:number;     // morale under this (with real fear) breaks and runs
  ring:number;        // extra standoff distance while waiting, px
  engage:number;      // priority for one of the few engage slots
  heavy:number;force:number; // combo and Force habits: chance to turn a light swing heavy or into Force
  bark:number;        // how chatty
  defense:number;     // how often it bothers to read and answer a swing
}
const TRAITS:Readonly<Record<CrowdPersona,Traits>>={
  reckless:   {aggression:1,  fearScale:.35,breakAt:.08,ring:-30,engage:2.2,heavy:.30,force:.04,bark:.8,defense:0.5},
  coward:     {aggression:.3, fearScale:1.55,breakAt:.58,ring:75, engage:-1.6,heavy:0, force:0,  bark:.9,defense:0.92},
  showoff:    {aggression:.8, fearScale:.7, breakAt:.24,ring:10, engage:.9, heavy:.18,force:.22,bark:1,defense:0.8},
  tactician:  {aggression:.55,fearScale:.9, breakAt:.30,ring:30, engage:0,  heavy:.08,force:.08,bark:.5,defense:1},
  loyal:      {aggression:.65,fearScale:.85,breakAt:.22,ring:15, engage:.5, heavy:.10,force:.06,bark:.6,defense:0.95},
  opportunist:{aggression:.5, fearScale:1,  breakAt:.34,ring:35, engage:-.4,heavy:.05,force:.05,bark:.5,defense:0.9},
  grudge:     {aggression:.75,fearScale:.75,breakAt:.22,ring:0,  engage:1,  heavy:.15,force:.06,bark:.6,defense:0.82},
};
export const crowdTraits=(p:CrowdPersona)=>TRAITS[p];

export interface CrowdMind {
  persona:CrowdPersona;
  fear:number;morale:number;shock:number;
  state:CrowdState;role:CrowdRole;
  threatId:string|null;targetId:string|null;
  fleeUntil:number;fleeAngle:number;
  hesitateUntil:number;tauntUntil:number;
  lastHitBy:string|null;lastHitAt:number;
  barkAt:number;engagedSince:number;
  escapeUntil:number;escapeAngle:number;escapeReadyAt:number;forceReadyAt:number;
  anchor:{x:number;y:number}|null;
  pose:{kind:CrowdPoseKind;at:number;until:number}|null;
  breaks:number;wound:number;
}
export interface CrowdGame {next:number;lastEvent:number;barkAt:number;breaks:number[];flee:number;scatter:number;scatterAt:number;escapes:number}
type CrowdFighter=SimFighter&{crowd?:CrowdMind};
type CrowdSim=SimGame&{crowd?:CrowdGame};

const TAU=Math.PI*2;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const angleDelta=(a:number,b:number)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const PLAN_STEP=.1;
/** Nobody left to hide behind: once a side is down to this share of its fighters (two at least), it stops breaking and fights it out. */
const LAST_STAND=.4;
/** At most this many fighters swing at one target; the rest wait, circle or hang back. */
export const CROWD_ENGAGE_CAP=3;
const ELITE_GRADE=9;

function hash(a:number,b:number,c:number){
  let h=(Math.imul(a^0x9e3779b9,0x85ebca6b)^Math.imul(b+0x632be5ab,0xc2b2ae35)^Math.imul(c,0x27d4eb2f))>>>0;
  h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;
  return ((h^(h>>>15))>>>0)/4294967296;
}
const draw=(s:SimGame,f:SimFighter,salt:number)=>hash(s.tick,(f.slot+1)*(f.team+3),salt);

/** Seeded and mirrored: slot n of Blue and slot n of Pink always share a personality,
 *  so both sides get the same mix. Every run of seven slots holds all seven personalities. */
export function crowdPersonaFor(seed:number,slot:number):CrowdPersona{
  const order=[...CROWD_PERSONAS];
  const block=Math.floor(slot/order.length);
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(hash(seed>>>0,block,i+101)*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  return order[slot%order.length];
}

/** Fear from the rank gap alone: close ranks barely care, F against SSS+ is terror. */
export function crowdGapFear(gap:number){
  return gap<=2?0:clamp(((gap-2)/10)**1.1,0,1);
}

/** 0 fresh, 1 near death: vital wounds, and half of leg wounds, as squad planning reads them. Cached each plan step. */
export function crowdWound(f:SimFighter){
  const cached=(f as CrowdFighter).crowd?.wound;
  if(typeof cached==='number')return cached;
  const b=arcadeInjuryBurden(f.injuries);
  return clamp(Math.max(b[4] as number,(b[6] as number)*.5),0,1);
}
export function initCrowd(s:SimGame,seed:number){
  const sim=s as CrowdSim;
  sim.crowd={next:0,lastEvent:s.eventId,barkAt:-9,breaks:[],flee:0,scatter:0,scatterAt:-9,escapes:0};
  for(const f of s.fighters as CrowdFighter[]){
    const persona=crowdPersonaFor(seed,f.slot);
    f.crowd={persona,fear:0,morale:1,shock:0,state:'fight',role:'free',threatId:null,targetId:null,fleeUntil:0,fleeAngle:0,
      hesitateUntil:0,tauntUntil:0,lastHitBy:null,lastHitAt:-9,barkAt:-9,engagedSince:-9,escapeUntil:0,escapeAngle:0,escapeReadyAt:0,forceReadyAt:0,
      anchor:null,pose:null,breaks:0,wound:0};
  }
}

function emit(s:SimGame,kind:string,f:SimFighter,extra:Record<string,unknown>={}){
  s.events.push({id:++s.eventId,kind,x:f.x,y:f.y,face:f.face,team:f.team,fighterId:f.id,time:s.time,form:f.form,technique:f.technique,...extra} as SimGame['events'][number]);
  if(s.events.length>48)s.events.splice(0,s.events.length-48);
}
/** Rare speech: per-fighter and match-wide cooldowns, gated by how chatty the personality is. */
function bark(s:CrowdSim,f:CrowdFighter,text:CrowdBark,chance=1){
  const m=f.crowd!,g=s.crowd!;
  if(f.control||s.time-m.barkAt<20||s.time-g.barkAt<7)return false;
  if(draw(s,f,text.length*31+7)>=chance*TRAITS[m.persona].bark)return false;
  m.barkAt=s.time;g.barkAt=s.time;
  emit(s,'crowd_bark',f,{bark:text,persona:m.persona});
  return true;
}
const pose=(s:SimGame,m:CrowdMind,kind:CrowdPoseKind,seconds:number)=>{m.pose={kind,at:s.time,until:s.time+seconds};};

/** The most dangerous live foe nearby: rank first, then distance. */
function threatOf(s:SimGame,f:SimFighter){
  let best:SimFighter|null=null,score=-Infinity;
  for(const o of s.fighters){
    if(!o.alive||o.team===f.team)continue;
    const d=Math.hypot(o.x-f.x,o.y-f.y);
    if(d>360)continue;
    const v=o.career.gradeIndex*40-d*.12;
    if(v>score){score=v;best=o;}
  }
  return best;
}

function readEvents(s:CrowdSim){
  const g=s.crowd!;
  for(const e of s.events){
    if(e.id<=g.lastEvent)continue;
    g.lastEvent=e.id;
    if(e.kind!=='hit'&&e.kind!=='launch'&&e.kind!=='ko')continue;
    const attacker=s.fighters.find(o=>o.id===e.fighterId) as CrowdFighter|undefined;
    const victim=s.fighters.find(o=>o.id===e.targetId) as CrowdFighter|undefined;
    if(!attacker||!victim||attacker.team===victim.team)continue;
    if(victim.crowd){victim.crowd.lastHitBy=attacker.id;victim.crowd.lastHitAt=s.time;}
    for(const o of s.fighters as CrowdFighter[]){
      const m=o.crowd;
      if(!m||!o.alive||o.control)continue;
      const fearOf=crowdGapFear(attacker.career.gradeIndex-o.career.gradeIndex)*TRAITS[m.persona].fearScale;
      if(e.kind==='ko'&&o.team===victim.team&&o!==victim){
        const near=Math.hypot(victim.x-o.x,victim.y-o.y);
        if(near<320){
          // An ally just dropped: frightened fighters lose heart, flinch and back off.
          m.morale=clamp(m.morale-.05-.22*fearOf*(near<180?1:.6),0,1);
          m.shock=clamp(m.shock+.55*fearOf,0,1);
          if(fearOf>.15){m.hesitateUntil=Math.max(m.hesitateUntil,s.time+.45+1.1*fearOf);if(fearOf>.35)pose(s,m,'flinch',.38);}
        }
      }else if(e.kind!=='ko'&&o===victim){
        m.morale=clamp(m.morale-.07*fearOf,0,1);
      }else if(e.kind!=='ko'&&o.team===attacker.team&&victim.crowd&&o.crowd){
        // The threat bleeds: everyone it frightens takes heart.
        const scare=crowdGapFear(victim.career.gradeIndex-o.career.gradeIndex);
        if(scare>0&&Math.hypot(victim.x-o.x,victim.y-o.y)<420)m.morale=clamp(m.morale+.06*scare,0,1);
      }
      if(e.kind==='ko'&&o===attacker){
        // Taunts after a kill: the showoff poses, elites mock.
        if(m.persona==='showoff'||o.career.gradeIndex-victim.career.gradeIndex>=6){
          if(bark(s,o,'Too easy',m.persona==='showoff'?.9:.35)&&m.persona==='showoff'){m.tauntUntil=s.time+.8;pose(s,m,'taunt',.8);}
        }
      }
    }
  }
}

/** Number of live allies (same team) within r of a point. */
function alliesNear(s:SimGame,team:number,x:number,y:number,r:number,skip:SimFighter|null){
  let n=0;
  for(const o of s.fighters)if(o!==skip&&o.alive&&o.team===team&&(o.x-x)**2+(o.y-y)**2<r*r)n++;
  return n;
}

function updateMind(s:CrowdSim,f:CrowdFighter,dt:number){
  const m=f.crowd!;
  if(m.pose&&m.pose.until<=s.time)m.pose=null;
  const threat=threatOf(s,f);
  m.threatId=threat?.id??null;
  const t=TRAITS[m.persona];
  m.shock=Math.max(0,m.shock-dt*.6);
  if(!threat){m.fear=Math.max(0,m.fear-dt);m.morale=clamp(m.morale+dt*.1,0,1);if(m.state==='flee')m.state='fight';return;}
  const gap=threat.career.gradeIndex-f.career.gradeIndex;
  const base=crowdGapFear(gap);
  const d=Math.hypot(threat.x-f.x,threat.y-f.y);
  const company=alliesNear(s,f.team,f.x,f.y,170,f);
  const hurt=crowdWound(f), threatHurt=crowdWound(threat);
  const facing=Math.abs(angleDelta(threat.face,Math.atan2(f.y-threat.y,f.x-threat.x)))<1.2;
  let fear=base*t.fearScale*(1+.6*hurt)*(1-.3*Math.min(1,company/4))*(1-.55*threatHurt)*(facing?1.08:.85)+m.shock*.5;
  fear=clamp(fear,0,1);
  m.fear+=(fear-m.fear)*Math.min(1,dt*4);
  // Morale: drains while a feared foe is close and looking, recovers when it looks away, is hurt, or is far.
  if(base>0){
    const close=d<280;
    if(close&&facing)m.morale-=dt*.11*m.fear*m.fear;
    else m.morale+=dt*(d>380?.14:.07)*(1-.5*m.fear);
    if(threatHurt>.35)m.morale+=dt*.05;
  }else m.morale+=dt*.08;
  m.morale=clamp(m.morale,0,1);
  if(f.control)return;
  if(m.state==='fight'){
    // The last few have nobody to hide behind: they stand and fight.
    const standing=s.liveByTeam?.[f.team]??alliesNear(s,f.team,f.x,f.y,1e5,null);
    const lastStand=Math.max(2,Math.round((s.config.teamSizes?.[f.team]??standing)*LAST_STAND));
    if(base>.12&&m.morale<t.breakAt*.6**m.breaks&&m.fear>.28&&standing>lastStand){
      m.state='flee';m.breaks++;
      m.fleeUntil=s.time+1.6+1.6*m.fear+draw(s,f,41)*.8;
      m.fleeAngle=Math.atan2(f.y-threat.y,f.x-threat.x)+(draw(s,f,43)-.5)*1.3;
      const g=s.crowd!;g.flee++;
      emit(s,'crowd_flee',f,{targetId:threat.id,persona:m.persona});
      g.breaks=g.breaks.filter(x=>x>s.time-.9);g.breaks.push(s.time);
      if(g.breaks.length>=3&&s.time-g.scatterAt>2.5){g.scatter++;g.scatterAt=s.time;emit(s,'crowd_scatter',f,{targetId:threat.id,count:g.breaks.length});}
      bark(s,f,'Run!',m.persona==='coward'?1:.45);
      pose(s,m,'cower',.5);
    }else if(hurt>.6&&m.fear>.35&&company>0)bark(s,f,'Help!',.12);
  }else{
    m.morale=clamp(m.morale+dt*(d>300?.16:.05),0,1);
    if(s.time>=m.fleeUntil&&(m.morale>=t.breakAt+.22||d>420)){m.state='fight';m.morale=Math.max(m.morale,t.breakAt+.22);if(m.persona==='tactician'||m.persona==='loyal')bark(s,f,'Hold!',.3);}
  }
}

/** Pick a target the way the personality wants. Returns the engine's choice when nothing better fits. */
export function crowdTarget(s:SimGame,f:SimFighter,fallback:SimFighter|null):SimFighter|null{
  const m=(f as CrowdFighter).crowd;
  if(!m||f.control||!f.alive)return fallback;
  const sight=Math.min(s.weather?.sightRange??600,600);
  const live=(id:string|null)=>id?s.fighters.find(o=>o.id===id&&o.alive&&o.team!==f.team)??null:null;
  const within=(o:SimFighter|null)=>o&&Math.hypot(o.x-f.x,o.y-f.y)<=sight?o:null;
  const outnumbered=eliteOutnumbered(s,f);
  if(outnumbered){
    // An elite against a crowd keeps its back safe first: anyone already in sword range is the target,
    // the weakest of them kept until it drops. With nobody close it picks off stragglers:
    // isolated, fleeing or hurt foes.
    let best:SimFighter|null=null,score=Infinity,close=false;
    for(const o of s.fighters){
      if(!o.alive||o.team===f.team)continue;
      const d=Math.hypot(o.x-f.x,o.y-f.y);
      if(d<118){
        const v=d*.6-crowdWound(o)*90-(o.id===m.targetId?45:0)-(o.attack&&!o.contact?40:0);
        if(!close||v<score){score=v;best=o;close=true;}
      }
    }
    if(!close)for(const o of s.fighters){
      if(!o.alive||o.team===f.team)continue;
      const d=Math.hypot(o.x-f.x,o.y-f.y);if(d>sight)continue;
      const om=(o as CrowdFighter).crowd;
      const support=alliesNear(s,o.team,o.x,o.y,110,o);
      const v=d+support*45-(om?.state==='flee'?70:0)-crowdWound(o)*120-(o.id===m.targetId?90:0);
      if(v<score){score=v;best=o;}
    }
    if(best){m.targetId=best.id;return best;}
  }
  let pick:SimFighter|null=null;
  if(m.persona==='grudge'&&s.time-m.lastHitAt<9)pick=within(live(m.lastHitBy));
  else if(m.persona==='opportunist'){
    let score=Infinity;
    for(const o of s.fighters){
      if(!o.alive||o.team===f.team)continue;
      const d=Math.hypot(o.x-f.x,o.y-f.y);if(d>sight*.7)continue;
      const v=d-crowdWound(o)*220-(o.action==='stagger'?60:0);
      if(v<score){score=v;pick=o;}
    }
  }else if(m.persona==='loyal'){
    // Protect the ally under the most pressure: go for whoever is on them.
    let score=Infinity;
    for(const o of s.fighters){
      if(!o.alive||o.team===f.team)continue;
      const d=Math.hypot(o.x-f.x,o.y-f.y);if(d>sight*.8)continue;
      let near=Infinity;
      for(const a of s.fighters)if(a!==f&&a.alive&&a.team===f.team)near=Math.min(near,Math.hypot(a.x-o.x,a.y-o.y));
      const v=d*.5+(near<120?0:120)+near*.3;
      if(v<score){score=v;pick=o;}
    }
  }
  pick=pick??fallback;
  m.targetId=pick?.id??null;
  return pick;
}

/** A high rank facing a crowd of much weaker foes: it plays the whole floor, not the nearest blade. */
function eliteOutnumbered(s:SimGame,f:SimFighter){
  if(f.career.gradeIndex<ELITE_GRADE)return false;
  let foes=0,weaker=0,allies=0;
  for(const o of s.fighters){if(!o.alive)continue;if(o.team===f.team)allies++;else{foes++;if(f.career.gradeIndex-o.career.gradeIndex>=4)weaker++;}}
  // Also the mop-up: a master left facing only much weaker stragglers keeps hunting them the same way.
  return foes>=allies+2&&weaker*2>=foes||foes>0&&foes>=allies&&weaker===foes;
}

/** Throttled team planning: minds, then engage slots per target. */
export function crowdPlan(s:SimGame,targets:(f:SimFighter)=>SimFighter|null){
  const sim=s as CrowdSim, g=sim.crowd;
  if(!g)return;
  readEvents(sim);
  if(s.time<g.next)return;
  const dt=s.time-(g.next-PLAN_STEP);
  g.next=s.time+PLAN_STEP;
  for(const f of s.fighters as CrowdFighter[])if(f.alive&&f.crowd){
    const b=arcadeInjuryBurden(f.injuries);
    f.crowd.wound=clamp(Math.max(b[4] as number,(b[6] as number)*.5),0,1);
  }
  for(const f of s.fighters as CrowdFighter[])if(f.alive&&f.crowd)updateMind(sim,f,Math.min(.25,Math.max(0,dt)));
  // Engage slots: per target, the best few candidates swing; everyone else waits on a ring.
  const groups=new Map<string,{f:CrowdFighter;score:number}[]>();
  for(const f of s.fighters as CrowdFighter[]){
    const m=f.crowd;
    if(!m||!f.alive||f.control){if(m)m.role='free';continue;}
    if(m.state==='flee'){m.role='hold';continue;}
    if(eliteOutnumbered(s,f)){m.role='free';continue;}
    const target=targets(f);
    if(!target){m.role='free';continue;}
    const d=Math.hypot(target.x-f.x,target.y-f.y);
    const t=TRAITS[m.persona];
    // Hunted: the target is coming for this fighter. Backing off at a walk only buys a cut in the back,
    // so it turns and meets it, and takes one of the few engage slots first.
    const hunted=(target as CrowdFighter).crowd?.targetId===f.id&&d<150;
    const score=d-t.engage*45+m.fear*140-(m.role==='engage'?70:0)+(s.time<m.hesitateUntil?120:0)+draw(s,f,5)*10-(hunted?400:0);
    let list=groups.get(target.id);if(!list)groups.set(target.id,list=[]);
    list.push({f,score});
  }
  for(const [id,list] of groups){
    const target=s.fighters.find(o=>o.id===id)!;
    list.sort((a,b)=>a.score-b.score||a.f.slot-b.f.slot);
    // A peer target takes the full cap; a feared one gets fewer takers when the crowd is scared.
    const cap=CROWD_ENGAGE_CAP;
    let n=0;
    for(const {f} of list){
      const m=f.crowd!;
      const strong=crowdGapFear(target.career.gradeIndex-f.career.gradeIndex);
      const want=n<cap&&(m.persona!=='coward'||strong<.3||n<1);
      if(want){
        if(m.role!=='engage'){
          m.engagedSince=s.time;
          if(strong>.4&&(m.persona==='reckless'||m.persona==='showoff'))bark(sim,f,m.persona==='reckless'?'Mine!':'Come on!',.55);
        }
        m.role='engage';n++;
      }else m.role=m.fear>.55||m.persona==='coward'?'hold':'ring';
    }
  }
}

/** Steering away from nearby allies so the crowd never stacks on one spot. */
function separation(s:SimGame,f:SimFighter,r:number){
  let x=0,y=0;
  for(const o of s.fighters){
    if(o===f||!o.alive||o.team!==f.team)continue;
    const dx=f.x-o.x,dy=f.y-o.y,d2=dx*dx+dy*dy;
    if(d2>=r*r)continue;
    const d=Math.sqrt(d2)||.001,push=(r-d)/r;
    x+=dx/d*push;y+=dy/d*push;
  }
  return {x,y};
}
const defensive=(c:SimCommand)=>Boolean(c.guard)||Boolean(c.dash&&c.evasion);
const quiet=(c:SimCommand):SimCommand=>({...c,strike:false,heavy:false,force:false,feint:false,technique:null,expandedMove:null,advanced:null,chain:null,trakata:false,activeJump:null,rankFootwork:null});
function steer(c:SimCommand,x:number,y:number,aim?:number):SimCommand{
  const len=Math.hypot(x,y);
  const out={...c,x:len>1?x/len:x,y:len>1?y/len:y};
  if(aim!==undefined)out.aim=aim;
  return out;
}

/** Open floor around a point: how far the nearest wall or edge is (small = good back cover). */
function edgeDistance(s:SimGame,x:number,y:number){
  const b=s.bounds;return Math.min(x-b.minX,b.maxX-x,y-b.minY,b.maxY-y);
}
function eliteEscape(s:CrowdSim,f:CrowdFighter,enemy:SimFighter|null,c:SimCommand):SimCommand{
  const m=f.crowd!;
  const busy=f.attack||f.action==='stagger'||f.action==='clash'||f.action==='dash'||f.action==='force'||f.airPhase==='airborne';
  // Read the surround: foes close by and the widest open lane between them.
  const near:number[]=[];let frontCount=0,cx=0,cy=0,count=0,close=0,winding=0;
  for(const o of s.fighters){
    if(!o.alive||o.team===f.team)continue;
    const dx=o.x-f.x,dy=o.y-f.y,d=Math.hypot(dx,dy);
    if(d<175){near.push(Math.atan2(dy,dx));cx+=o.x;cy+=o.y;count++;}
    if(d<115){close++;if(o.attack&&!o.contact)winding++;}
    if(d<140&&Math.abs(angleDelta(f.face,Math.atan2(dy,dx)))<.85)frontCount++;
  }
  if(s.time<m.escapeUntil&&!busy){
    // Commit the break-out: keep running the open lane.
    return steer(quiet(c),Math.cos(m.escapeAngle),Math.sin(m.escapeAngle),c.aim);
  }
  // A wide crowd cut only pays when two bodies are really in reach in front: on one body it just scores the legs.
  // With one foe in reach, drive a straight heavy cut through it instead.
  const crowdCut=Boolean(c.technique&&ARCADE_TECHNIQUES[c.technique]?.role==='crowd');
  if((c.heavy&&!c.strike&&!c.technique||crowdCut&&!c.strike)&&enemy&&f.airPhase==='grounded'){
    let inReach=0;
    for(const o of s.fighters)if(o.alive&&o.team!==f.team&&Math.hypot(o.x-f.x,o.y-f.y)<118&&Math.abs(angleDelta(c.aim??f.face,Math.atan2(o.y-f.y,o.x-f.x)))<1.2)inReach++;
    if(inReach<2)c={...c,heavy:true,technique:'rush',expandedMove:null,aim:Math.atan2(enemy.y-f.y,enemy.x-f.x)};
  }
  // Force only pays against a knot in front; otherwise it scatters the crowd and drags the round out.
  if(c.force&&!busy&&frontCount<2){
    const d=enemy?Math.hypot(enemy.x-f.x,enemy.y-f.y):Infinity;
    c={...c,force:false,strike:d<98};
  }
  if(near.length<3||busy)return elitePress(s,f,enemy,anchorStep(s,f,enemy,c,count?{x:cx/count,y:cy/count}:null));
  near.sort((a,b)=>a-b);
  let gap=0,gapAt=0;
  for(let i=0;i<near.length;i++){
    const a=near[i],b=i+1<near.length?near[i+1]:near[0]+TAU,span=b-a;
    if(span>gap){gap=span;gapAt=a+span/2;}
  }
  // Only a real trap is worth leaving: blades closing from several sides, or a body pile on top of us.
  const surrounded=(close>=3&&gap<2.6&&winding>=2)||close>=5||(close>=3&&m.wound>.45&&gap<2.2);
  if(!surrounded)return elitePress(s,f,enemy,anchorStep(s,f,enemy,c,{x:cx/count,y:cy/count}));
  // Push a tight knot in front back with the Force first: it clears up to three bodies.
  if(frontCount>=3&&f.energy>=40&&!s.config.saberOnly&&s.time>=m.forceReadyAt){
    m.forceReadyAt=s.time+4.5;
    return {...quiet(c),force:true,guard:false,dash:false,aim:f.face};
  }
  // Pick the lane: the widest gap, bent toward open floor and away from the walls we'd be pinned on.
  const b=s.bounds;
  let best=gapAt,bestScore=-Infinity;
  for(const off of [0,-.35,.35,-.7,.7]){
    const a=gapAt+off,x=f.x+Math.cos(a)*120,y=f.y+Math.sin(a)*120;
    if(x<b.minX+20||x>b.maxX-20||y<b.minY+20||y>b.maxY-20)continue;
    let clear=Infinity;
    for(const o of s.fighters)if(o.alive&&o.team!==f.team)clear=Math.min(clear,Math.hypot(o.x-x,o.y-y));
    const score=clear-Math.abs(off)*30;
    if(score>bestScore){bestScore=score;best=a;}
  }
  if(s.time>=m.escapeReadyAt&&f.energy>=20){
    m.escapeAngle=best;m.escapeUntil=s.time+.45;m.escapeReadyAt=s.time+3.2;
    s.crowd!.escapes++;
    emit(s,'crowd_escape',f,{persona:m.persona});
    const weapon=String(f.gear.weapon);
    // Orbit blades and the double-blade sweep the ring while breaking out; a single blade dashes clean.
    if((weapon==='orbit'||weapon==='staff')&&f.energy>=34&&frontCount>=1)return steer({...quiet(c),heavy:true,aim:best},Math.cos(best),Math.sin(best));
    return {...quiet(c),dash:true,evasion:'dash',rollFace:best,aim:best,x:Math.cos(best),y:Math.sin(best)};
  }
  return c;
}
/** A master hunting a scared crowd does not wait at the edge of reach: it walks the target down,
 *  closes the last stretch with a dash, and cuts as soon as the target is in reach. */
function elitePress(s:CrowdSim,f:CrowdFighter,enemy:SimFighter|null,c:SimCommand):SimCommand{
  const m=f.crowd!;
  if(!enemy||defensive(c)||f.attack||f.action==='stagger'||f.action==='dash'||f.action==='force'||f.airPhase==='airborne')return c;
  if(m.anchor)return c;
  const d=Math.hypot(enemy.x-f.x,enemy.y-f.y),aim=Math.atan2(enemy.y-f.y,enemy.x-f.x);
  if(d<=92){
    if(c.strike||c.heavy||c.force)return c;
    // In reach and the target is not mid-cut into us: take the cut.
    const threatening=Boolean(enemy.attack&&!enemy.contact);
    return threatening?c:{...c,strike:true,aim};
  }
  const swing=Boolean(c.strike||c.heavy||c.force||c.technique||c.expandedMove||c.advanced||c.chain);
  if(swing&&(d<112||(c.force&&d<170)||enemy.attack))return c;
  // Just out of reach: a lunging heavy cut covers the gap and lands square.
  if(d>95&&d<165&&f.energy>=32&&!enemy.attack&&f.airPhase==='grounded')
    return {...quiet(c),heavy:true,technique:'rush',aim,x:Math.cos(aim),y:Math.sin(aim)};
  // Further out: no swing at air. Walk the target down, or close the last stretch with a dash.
  if(d>118&&d<250&&f.energy>=40&&s.time>=m.escapeReadyAt-1.6){
    m.escapeReadyAt=Math.max(m.escapeReadyAt,s.time+2.4);
    return {...quiet(c),dash:true,evasion:'dash',rollFace:aim,aim,x:Math.cos(aim),y:Math.sin(aim)};
  }
  return steer(swing?quiet(c):c,Math.cos(aim),Math.sin(aim),aim);
}
/** Outnumbered but not yet surrounded: fight with the back near a wall or edge, then hunt stragglers. */
function anchorStep(s:SimGame,f:CrowdFighter,enemy:SimFighter|null,c:SimCommand,crowdAt:{x:number;y:number}|null){
  const m=f.crowd!;
  if(!crowdAt||!enemy||defensive(c)||f.attack)return c;
  const dEnemy=Math.hypot(enemy.x-f.x,enemy.y-f.y);
  let pressing=0;
  for(const o of s.fighters)if(o.alive&&o.team!==f.team&&Math.hypot(o.x-f.x,o.y-f.y)<220)pressing++;
  if(pressing<4||dEnemy<95||m.wound<.3){m.anchor=null;return c;}
  if(!m.anchor||draw(s,f,71)<.02){
    // The closest stretch of wall or edge that lies away from the crowd.
    const b=s.bounds,inset=48,awayX=f.x-crowdAt.x,awayY=f.y-crowdAt.y;
    const options=[{x:b.minX+inset,y:f.y},{x:b.maxX-inset,y:f.y},{x:f.x,y:b.minY+inset},{x:f.x,y:b.maxY-inset}];
    let best=options[0],score=Infinity;
    for(const p of options){
      const d=Math.hypot(p.x-f.x,p.y-f.y),toward=((p.x-f.x)*awayX+(p.y-f.y)*awayY)/((d||1)*(Math.hypot(awayX,awayY)||1));
      const v=d-toward*160;
      if(v<score){score=v;best=p;}
    }
    m.anchor=best;
  }
  const dx=m.anchor.x-f.x,dy=m.anchor.y-f.y,d=Math.hypot(dx,dy);
  if(d<40||edgeDistance(s,f.x,f.y)<60)return c;
  return steer(c,(c.x??0)*.4+dx/d*.8,(c.y??0)*.4+dy/d*.8);
}

/** Final say on a bot's command: fear, roles, spacing and personality. The player's fighter is never touched. */
export function crowdSteer(s:SimGame,f:SimFighter,enemy:SimFighter|null,c:SimCommand):SimCommand{
  const sim=s as CrowdSim, me=f as CrowdFighter, m=me.crowd;
  if(!sim.crowd||!m||f.control||!f.alive)return c;
  const t=TRAITS[m.persona];
  if(eliteOutnumbered(s,f))return eliteEscape(sim,me,enemy,c);
  const threat=m.threatId?s.fighters.find(o=>o.id===m.threatId&&o.alive)??null:null;
  const sep=separation(s,f,62);
  if(m.state==='flee'&&threat){
    // Scatter: run from the threat on a personal heading, spread from allies; a cornered runner turns and fights.
    const d=Math.hypot(threat.x-f.x,threat.y-f.y);
    const cornered=d<70&&edgeDistance(s,f.x,f.y)<55;
    if(cornered||defensive(c))return c;
    // A runner shows its back: whatever catches it lands clean.
    if((f.exposedUntil??0)<s.time+.2){f.exposedUntil=s.time+.2;f.exposedBy='terror';}
    const away=Math.atan2(f.y-threat.y,f.x-threat.x);
    let a=m.fleeAngle+angleDelta(m.fleeAngle,away)*.35;
    const b=s.bounds,px=f.x+Math.cos(a)*70,py=f.y+Math.sin(a)*70;
    if(px<b.minX+30||px>b.maxX-30)a=Math.PI-a;
    if(py<b.minY+30||py>b.maxY-30)a=-a;
    m.fleeAngle=a;
    return steer(quiet(c),Math.cos(a)+sep.x*1.2,Math.sin(a)+sep.y*1.2,a);
  }
  if(!enemy)return sep.x||sep.y?steer(c,(c.x??0)+sep.x,(c.y??0)+sep.y):c;
  const d=Math.hypot(enemy.x-f.x,enemy.y-f.y), aim=Math.atan2(enemy.y-f.y,enemy.x-f.x);
  const fearOf=crowdGapFear(enemy.career.gradeIndex-f.career.gradeIndex)*t.fearScale;
  // Terror: a far stronger blade coming in can lock a frightened fighter up. No guard, no dodge, just a flinch.
  if(enemy.attack&&!enemy.contact&&d<140&&fearOf>.45&&m.fear>.45&&!f.attack){
    const freeze=Math.min(.9,1.2*Math.min(1,m.fear)*(1.2-.4*t.defense));
    if(hash(enemy.attackSerial??0,(f.slot+1)*(f.team+3),151)<freeze){
      if(!m.pose)pose(s,m,'flinch',.3);
      // Frozen means open: the cut that lands now lands clean.
      if((f.exposedUntil??0)<s.time+.35){f.exposedUntil=s.time+.35;f.exposedBy='terror';}
      return {...quiet(c),guard:false,dash:false,evasion:null,x:0,y:0,aim};
    }
  }
  if(defensive(c))return c;
  // A showoff's taunt: stands tall, blade low, no swing, while nobody is close.
  if(s.time<m.tauntUntil&&d>110)return steer(quiet(c),0,0,aim);
  const opening=enemy.action==='stagger'||(enemy.exposedUntil??0)>s.time||Boolean(enemy.attack&&enemy.contact)||
    s.fighters.some(o=>o!==f&&o.alive&&o.team===f.team&&o.attack&&Math.hypot(o.x-enemy.x,o.y-enemy.y)<95);
  const backTurned=Math.abs(angleDelta(enemy.face,Math.atan2(f.y-enemy.y,f.x-enemy.x)))>1.9;
  if(m.role==='ring'||m.role==='hold'){
    // Wait off the target on a loose ring: hold the radius, drift around it, keep apart from allies.
    const radius=(m.role==='hold'?205:150)+t.ring+m.fear*70;
    const radial=d<radius-18?-1:d>radius+30?1:0;
    const around=aim+Math.PI/2*((f.slot%2)?1:-1);
    const drift=m.persona==='tactician'?.55:.35;
    // An opportunist darts in on a real opening from behind or the side.
    if((m.persona==='opportunist'||m.persona==='tactician'||m.persona==='reckless')&&opening&&(backTurned||m.persona==='reckless')&&d<130&&fearOf<.9)
      return steer({...c,strike:true,heavy:false,force:false,aim},Math.cos(aim),Math.sin(aim),aim);
    let x=Math.cos(aim)*radial*.9+Math.cos(around)*drift+sep.x*1.4,y=Math.sin(aim)*radial*.9+Math.sin(around)*drift+sep.y*1.4;
    // Giving ground while facing the blade is a walk, not a sprint: a determined hunter can still close.
    const len=Math.hypot(x,y);
    if(radial<0&&len>.6){x*=.6/len;y*=.6/len;}
    return steer(quiet(c),x,y,aim);
  }
  let out=c;
  // Fear makes engaged fighters hesitate: fewer swings into a feared foe unless it is open.
  const swinging=Boolean(c.strike||c.heavy||c.force);
  const hesitating=s.time<m.hesitateUntil&&fearOf>.15&&(enemy as CrowdFighter).crowd?.targetId!==f.id;
  if(hesitating){
    const back=d<150?-.85:0;
    return steer(quiet(c),Math.cos(aim)*back+sep.x,Math.sin(aim)*back+sep.y,aim);
  }
  if(swinging&&fearOf>0&&!opening){
    const go=t.aggression*(1-.75*Math.min(1,fearOf))+.12;
    if(draw(s,f,91)>=go)out=quiet(c);
  }
  // Personality combo and Force habits, kept small.
  if(out.strike&&!out.heavy&&!out.force&&f.energy>=30){
    const r=draw(s,f,97);
    if(r<t.heavy*.25)out={...out,strike:false,heavy:true};
    else if(r>1-t.force*.18&&!s.config.saberOnly&&d<150&&f.energy>=34)out={...out,strike:false,force:true};
  }
  // Frightened fighters keep their distance between swings instead of crowding the blade, unless hunted.
  const hunted=(enemy as CrowdFighter).crowd?.targetId===f.id;
  const wary=m.persona==='coward'||m.persona==='opportunist'||m.persona==='tactician';
  if(!hunted&&wary&&!out.strike&&!out.heavy&&!out.force&&fearOf>.25&&!opening&&d<110){
    const back=-.6*Math.min(1,fearOf);
    out=steer(out,(out.x??0)*.4+Math.cos(aim)*back,(out.y??0)*.4+Math.sin(aim)*back);
  }
  // Engaged fighters come from different sides: drift toward a flank lane, never stack.
  if(d>95&&!out.strike&&!out.heavy){
    const side=((f.slot%3)-1)*1.05;
    if(side){const lane=aim+side;out=steer(out,(out.x??0)*.7+Math.cos(lane)*.35,(out.y??0)*.7+Math.sin(lane)*.35);}
    // Against a feared foe, the few who engage commit: hovering at the edge of its reach only gets them cut.
    // Between near-equal ranks the regular footwork keeps the spacing, so mirrors stay mirrors.
    if(fearOf>0&&d>(wary?100:80))out=steer(out,(out.x??0)*.4+Math.cos(aim)*.6,(out.y??0)*.4+Math.sin(aim)*.6);
  }
  if(sep.x||sep.y)out=steer(out,(out.x??0)+sep.x*1.1,(out.y??0)+sep.y*1.1);
  return out;
}

/** Fear as a skill penalty for the smart defence layer: a terrified fighter reacts late. */
export function crowdFear(f:SimFighter){
  const m=(f as CrowdFighter).crowd;
  return m&&!f.control?m.fear:0;
}
/** Multiplier on the smart layer's chance to answer a swing: fear makes reads late, a reckless fighter barely guards. */
export function crowdDefense(f:SimFighter,attacker?:SimFighter|null){
  const m=(f as CrowdFighter).crowd;
  if(!m||f.control)return 1;
  // Masters keep most of their discipline whatever their temperament.
  const temper=1-(1-TRAITS[m.persona].defense)*(1-.8*f.career.gradeIndex/14);
  const outclassed=attacker?.85*crowdGapFear(attacker.career.gradeIndex-f.career.gradeIndex):0;
  return (1-.7*Math.max(m.fear,outclassed))*temper;
}

/** Round over: the winners still standing strike a victory pose; one showoff (or the lone master) gloats. */
export function crowdFinish(s:SimGame){
  const sim=s as CrowdSim;
  if(!sim.crowd||s.phase==='playing')return;
  const winner=s.phase==='won'?0:s.phase==='lost'?1:null;
  if(winner===null)return;
  let said=false;
  for(const f of s.fighters as CrowdFighter[]){
    if(!f.alive||f.team!==winner||!f.crowd)continue;
    f.crowd.pose={kind:'victory',at:s.time,until:s.time+60};
    if(!said&&!f.control&&(f.crowd.persona==='showoff'||s.fighters.filter(o=>o.team===winner).length===1)){
      sim.crowd.barkAt=-9;f.crowd.barkAt=-9;
      said=bark(sim,f,'Too easy',1/TRAITS[f.crowd.persona].bark);
    }
  }
}

/** Per-match tallies for stats and audits. */
export function crowdTallies(s:SimGame){
  const g=(s as CrowdSim).crowd;
  return g?{flee:g.flee,scatter:g.scatter,escapes:g.escapes}:null;
}
export function crowdPersonaOf(f:unknown):CrowdPersona|null{
  const m=(f as CrowdFighter|null)?.crowd;
  return m?m.persona:null;
}

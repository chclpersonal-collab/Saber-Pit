/** LOOMEN v6 fighter AI layer.
 *  Runs on top of the authored AI for every computer-controlled fighter on BOTH sides (Blue and Pink),
 *  only when `config.smartAI` is on, so seeded tournament replays and their tests keep their history.
 *  It never touches a player-controlled fighter: those do only what the player presses.
 *  Skill scales with rank: F reacts sometimes, SSS+ V almost always, and everyone learns spam. */
import type {SimCommand,SimFighter,SimGame,SimMove} from './arcade-engine-state.js?v=6.0.2-rc2';
import {contactChainOpen} from './arcade-motion-flow.js?v=6.0.2-rc2';
import {pacingLift} from './arcade-engine-rank.js?v=6.0.2-rc2';
import {arcadeLimbDisabled} from './arcade-injuries.js?v=6.0.2-rc2';
import {sampleOrbitSabers,orbitHitsBody} from './arcade-orbit-sabers.js?v=6.0.2-rc2';
import {crowdDefense} from './arcade-crowd-ai.js?v=6.0.2-rc2';

interface SmartMemory {
  seenSerial: number | null;      // enemy attack serial already judged
  plan: 'parry' | 'slip' | 'hold' | null;
  planSerial: number | null;
  slipSide: number;
  starts: {at:number; family:string}[]; // visible attacks, never unreleased inputs
  enemyId: string | null;
  punishSerial: number | null;    // our own attack serial spent on the last punish
  lastPunishAt: number;
  baitUntil: number;
  guardUntil: number;            // keep a raised guard through the contact frame
}
type SmartFighter = SimFighter & {smart?: SmartMemory};

const TAU=Math.PI*2;
const angleDelta=(a: number,b: number)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const clamp=(n: number,lo: number,hi: number)=>Math.max(lo,Math.min(hi,n));

/** 0..1 skill from rank: F 0.50, A 0.66, SSS+ 0.82, SSS+ V 1.00. */
export const smartSkill=(gradeIndex: number)=>clamp(.5+.5*(gradeIndex/14)**1.15,.5,1);

function memory(f: SmartFighter,enemy: SimFighter): SmartMemory {
  if(!f.smart||f.smart.enemyId!==enemy.id)
    f.smart={seenSerial:null,plan:null,planSerial:null,slipSide:1,starts:[],enemyId:enemy.id,punishSerial:null,lastPunishAt:-9,baitUntil:0,guardUntil:0};
  return f.smart;
}

/** A deterministic 0..1 draw from the game seed stream, so matches stay replayable. */
function draw(s: SimGame,f: SimFighter,salt: number){
  const t=Math.floor(s.time*120);
  let h=(Math.imul(t^0x9e3779b9,0x85ebca6b)^Math.imul((f.slot+1)*(f.team+3),0xc2b2ae35)^Math.imul(salt,0x27d4eb2f))>>>0;
  h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;
  return ((h^(h>>>15))>>>0)/4294967296;
}

// Same limb gates as the engine: guard needs the sword arm (orbit emitters need no hands), dash needs both legs.
const limbOut=(f: SimFighter,limb: Parameters<typeof arcadeLimbDisabled>[1])=>f.regionalInjuries===true&&arcadeLimbDisabled(f.injuries,limb);
export const smartCanGuard=(f: SimFighter)=>String(f.gear.weapon)==='orbit'||!limbOut(f,'rightArm');
export const smartCanSlip=(f: SimFighter)=>!limbOut(f,'leftLeg')&&!limbOut(f,'rightLeg');

type Blade={contact?:number;reach?:number;arc?:number;backLane?:boolean;blade?:string};
/** Every unresolved blade of the enemy's swing, so twin and orbit follow-ups are read, not just the first cut. */
function pendingBlades(enemy: SimFighter){
  const spec=enemy.attackSpec as (SimMove&{offhand?:Blade;orbitThird?:Blade;orbit?:boolean}) | null;
  if(!spec)return [];
  const out: {hit:Blade;id:'primary'|'offhand'|'orbit_third';bearing:number}[]=[];
  if(!enemy.contact)out.push({hit:spec as Blade,id:'primary',bearing:enemy.face});
  if(spec.offhand&&!enemy.offhandContact)out.push({hit:spec.offhand,id:'offhand',bearing:enemy.face+((spec.offhand.backLane??spec.offhand.blade==='rear')?Math.PI:0)});
  if(spec.orbitThird&&!enemy.orbitThirdContact)out.push({hit:spec.orbitThird,id:'orbit_third',bearing:enemy.face});
  return out;
}
/** Closest approach of a lit blade segment to the body's central bands (matches orbitHitsBody's sampling). */
function bladeGap(b: {hand:{x:number;y:number};tip:{x:number;y:number}},f: SimFighter){
  const dx=b.tip.x-b.hand.x,dy=b.tip.y-b.hand.y,h=f.y-(f.airHeight??0);
  let best=Infinity;
  for(const off of [24,40,55]){
    const px=f.x,py=h-off,u=clamp(((px-b.hand.x)*dx+(py-b.hand.y)*dy)/(dx*dx+dy*dy||1),0,1);
    best=Math.min(best,Math.hypot(px-b.hand.x-u*dx,py-b.hand.y-u*dy));
  }
  return best;
}
/** Latest contact time of the whole swing, primary and follow-up blades. */
const lastContact=(spec: SimMove|null)=>{
  const sp=spec as (SimMove&{offhand?:Blade;orbitThird?:Blade})|null;
  return Math.max(sp?.contact??.2,sp?.offhand?.contact??0,sp?.orbitThird?.contact??0);
};

export function smartThreat(s: SimGame,f: SimFighter,enemy: SimFighter){
  const spec=enemy.attackSpec as (SimMove&{orbit?:boolean}) | null;
  if(!enemy.alive||!enemy.attack||!spec)return null;
  const d=Math.hypot(f.x-enemy.x,f.y-enemy.y), toMe=Math.atan2(f.y-enemy.y,f.x-enemy.x);
  let until=Infinity,last=0;
  for(const {hit,id,bearing} of pendingBlades(enemy)){
    const left=(hit.contact??.2)-enemy.actionTime;
    if(left<=0)continue;
    let threat: boolean;
    if(spec.orbit){
      // Emitter blades enter on offset lanes beside the body, not along the face: read where that blade will be lit at contact.
      const at={...enemy,actionTime:hit.contact??.2,orbitCarry:null} as Parameters<typeof sampleOrbitSabers>[0];
      const blade=sampleOrbitSabers(at,s.time+left).find(b=>b.id===id);
      // Same body bands the engine tests, widened by how far we could drift before it lands.
      threat=Boolean(blade)&&(orbitHitsBody(blade!,f)||bladeGap(blade!,f)<=19+Math.min(60,left*240));
    }else{
      const reach=(hit.reach??spec.reach??80)+f.radius+26;
      threat=d<=reach+left*240&&Math.abs(angleDelta(bearing,toMe))<=(hit.arc??spec.arc??1)+.45;
    }
    if(!threat)continue;
    until=Math.min(until,left);last=Math.max(last,left);
  }
  if(!Number.isFinite(until))return null;
  return {until,last,d,force:enemy.action==='force'};
}

/** True only when the enemy can't answer before our own swing would land. */
function recovering(enemy: SimFighter){
  const spec=enemy.attackSpec as SimMove | null, left=enemy.actionDuration-enemy.actionTime;
  if(enemy.action==='stagger')return left>.14;
  if(enemy.guardLock>.14)return true;
  return Boolean(enemy.attack&&spec&&enemy.actionTime>lastContact(spec)+.03&&left>.2);
}

/** An ally standing in the line to the enemy would take the swing: leave the lane-finding to the authored AI. */
function allyInLane(s: SimGame,f: SimFighter,enemy: SimFighter){
  const dx=enemy.x-f.x,dy=enemy.y-f.y,len=Math.hypot(dx,dy)||1;
  return s.fighters.some(a=>a!==f&&a.alive&&a.team===f.team&&(()=>{
    const t=((a.x-f.x)*dx+(a.y-f.y)*dy)/(len*len);
    if(t<=0||t>=1)return false;
    return Math.abs((a.x-f.x)*dy-(a.y-f.y)*dx)/len<a.radius+4;
  })());
}

export function smartCommands(s: SimGame,f: SimFighter,enemy: SimFighter | null,base: SimCommand): SimCommand {
  if(!s.config.smartAI||f.control||!f.alive||!enemy||!enemy.alive)return base;
  // Audit hook: a side can be held to the authored AI to measure the difference head to head.
  if((s as SimGame&{smartTeams?:readonly boolean[]}).smartTeams?.[f.team]===false)return base;
  const me=f as SmartFighter, m=memory(me,enemy), q=smartSkill(f.career.gradeIndex);
  const serial=enemy.attackSerial??null;
  const aim=Math.atan2(enemy.y-f.y,enemy.x-f.x), d=Math.hypot(enemy.x-f.x,enemy.y-f.y);

  // Learn rhythm: every new enemy swing is logged; three inside 2.4 s is spam and gets read harder.
  if(serial!=null&&enemy.attack&&serial!==m.seenSerial){m.seenSerial=serial;m.starts.push({at:s.time,family:enemy.attackFamily??enemy.attack});}
  m.starts=m.starts.filter(t=>t.at>s.time-2.4).slice(-8);
  const family=enemy.attackFamily??enemy.attack??m.starts.at(-1)?.family;
  const spam=clamp((m.starts.filter(sample=>sample.family===family).length-1)/3,0,1);

  // 1. Defend a committed incoming swing. One judgement per swing, then hold it.
  const threat=smartThreat(s,f,enemy);
  const canGuard=smartCanGuard(f), canSlip=smartCanSlip(f);
  if(threat){
    if(m.planSerial!==serial){
      m.planSerial=serial;
      // Crowd AI: terror of a far stronger foe makes the read late; a reckless fighter barely guards.
      const chance=clamp(.30+.62*q+.22*spam,0,.985)*(s.config.crowdAI?crowdDefense(f,enemy):1);
      const roll=draw(s,f,serial??0);
      // Parry is the answer to blade work: it refunds stamina and staggers the attacker. Slip the Force, or when spent.
      const want=threat.force||f.energy<5||f.guardLock>0?'slip':'parry';
      // A disabled sword arm can't raise a guard and a disabled leg can't dash: take the answer the body still has.
      const plan=want==='parry'?(canGuard?'parry':canSlip?'slip':'hold'):(canSlip?'slip':canGuard&&!threat.force?'parry':'hold');
      m.plan=roll<chance?plan:'hold';
      m.slipSide=draw(s,f,(serial??0)+13)<.5?1:-1;
    }
    if(m.plan==='parry'||m.plan==='slip'){
      // Parry windows run ~0.16-0.26 s, so start guard just before contact; slip a little earlier.
      const window=m.plan==='parry'?.07+.07*q:.12+.06*q;
      const out: SimCommand={...base,strike:false,heavy:false,force:false,feint:false,technique:null,expandedMove:null,advanced:null,chain:null};
      if(threat.until<=window||f.action==='guard'){
        // Hold the guard until the last blade of the swing has resolved, not just the first.
        if(m.plan==='parry'&&canGuard&&f.energy>=6){m.guardUntil=s.time+threat.last+.1;return {...out,guard:true,guardAim:null,aim,x:0,y:0,dash:false};}
        const side=aim+Math.PI/2*m.slipSide+(d<70?Math.PI*.22*m.slipSide:0);
        if(canSlip)return {...out,guard:false,dash:f.energy>=10,evasion:'sidestep',aim,x:Math.cos(side),y:Math.sin(side)};
        // No guard and no dash: walk out of the lane.
        return {...out,guard:false,dash:false,aim,x:-Math.cos(aim)*.6+Math.cos(side)*.6,y:-Math.sin(aim)*.6+Math.sin(side)*.6};
      }
      // Waiting for the window: do not walk into the swing or start a slower move.
      return {...out,guard:false,dash:false,x:(base.x??0)*.35,y:(base.y??0)*.35};
    }
  }

  // The swing resolves on the frame its contact flips, which can come before or after our update; hold through it.
  if(m.guardUntil>s.time&&f.action==='guard'&&canGuard&&!(pendingBlades(enemy).length===0&&recovering(enemy)))
    return {...base,strike:false,heavy:false,force:false,feint:false,technique:null,expandedMove:null,advanced:null,chain:null,dash:false,guard:true,guardAim:null,aim,x:0,y:0};

  // 2. Punish: just parried, enemy whiffed, staggered or guard-broken, and we are in reach.
  const parried=(f.counterUntil??0)>s.time&&f.counterTarget===enemy.id;
  const open=recovering(enemy)||parried;
  const ownMove=f.attackSpec;
  const liveLink=Boolean(ownMove&&f.actionTime<f.actionDuration&&contactChainOpen(s.config.motionFlow,f,ownMove));
  const readyToSwing=liveLink||f.actionDuration===0||f.action==='guard'||f.action==='walk'||f.action==='run'||f.action==='idle';
  if(open&&d<112&&readyToSwing&&f.energy>=8&&s.time-m.lastPunishAt>.18&&!allyInLane(s,f,enemy)){
    if(draw(s,f,977)<.55+.45*q){
      m.lastPunishAt=s.time;
      const heavy=enemy.action==='stagger'&&f.energy>=24&&draw(s,f,331)<.35+.3*q;
      return {...base,guard:false,dash:false,strike:!heavy,heavy,aim,x:Math.cos(aim)*(d>70?1:.2),y:Math.sin(aim)*(d>70?1:.2)};
    }
  }
  // The authored layer doesn't know about limbs: never pass on a guard or dash this body can't make.
  if((base.guard&&!canGuard)||(base.dash&&!canSlip))base={...base,guard:base.guard&&canGuard,dash:base.dash&&canSlip};

  // 3. Spacing and bait vs a spammer: hover just outside their reach so the next swing whiffs.
  // Low on stamina: back off and breathe instead of trading. Vs a spammer: hover outside their reach.
  if(f.energy<24&&!open&&d<150)m.baitUntil=s.time+.2;
  else if(spam>.3&&!enemy.attack&&d<150&&d>40&&f.energy>=10&&draw(s,f,571)<q){
    m.baitUntil=s.time+.25;
  }
  if(m.baitUntil>s.time&&!open){
    const want=118, step=d<want?-1:d>want+20?1:0, circle=aim+Math.PI/2*(f.slot%2?1:-1);
    return {...base,strike:false,heavy:false,guard:false,aim,
      x:Math.cos(aim)*step*.8+Math.cos(circle)*.4,y:Math.sin(aim)*step*.8+Math.sin(circle)*.4};
  }

  // 4. Don't throw a swing at a raised guard from the front unless it is a guard-pressure heavy.
  //    A foe with a dead sword arm can't hold that guard, so press them instead.
  if(enemy.action==='guard'&&smartCanGuard(enemy)&&(base.strike)&&d<100&&draw(s,f,199)<q*.6){
    const flank=aim+(f.slot%2?.9:-.9);
    return {...base,strike:false,heavy:f.energy>=30&&draw(s,f,211)<.4,aim,x:Math.cos(flank),y:Math.sin(flank)};
  }
  return base;
}

/** v6 hit-chain decay, same for every fighter (player and computer, Blue and Pink).
 *  Back-to-back hits inside 1.1 s stun less and hurt less, so mashing one button can't lock anyone down,
 *  and a base toughness multiplier means nobody drops in a handful of swings. */
const CHAIN_DAMAGE=[1,.82,.66,.55,.48] as const, CHAIN_STUN=[1,.5,.28,.14,.08] as const;
export const SMART_TOUGHNESS=.7;
export function smartChain(s: SimGame,victim: SimFighter){
  const v=victim as SimFighter&{smartChainAt?:number;smartChainCount?:number};
  const n=s.time-(v.smartChainAt??-9)<1.1?Math.min(4,(v.smartChainCount??0)+1):0;
  v.smartChainAt=s.time;v.smartChainCount=n;
  // Elite pacing already measures the opening of SSS+ V mirrors, so toughness phases in as that pacing lifts:
  // the decisive end of an elite match hits exactly as hard as any other v6 match.
  const tough=s.elitePacing?1-(1-SMART_TOUGHNESS)*pacingLift(s as Parameters<typeof pacingLift>[0]):SMART_TOUGHNESS;
  return {damage:CHAIN_DAMAGE[n]*tough,stun:CHAIN_STUN[n]};
}

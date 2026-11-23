// @ts-nocheck
/** Last completed bout's actual preparation, short verified tactical history
 * and result. This module never infers an intent from combat or awards wins. */
const VERSION=1,MAX_CHANGE=18,MAX_ENTRANTS=48;
const intents=new Set(['win','draw']);
const tactics=new Set(['balanced','aggressive','defensive']);
const trim=(value,n=68)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,n):'';
const duration=(n,limit)=>Number.isFinite(n)&&n>=0&&n<=limit?Math.round(n*1000)/1000:null;
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max?x:null;
const intentOf=x=>intents.has(x)?x:null;
const ids=actor=>trim(actor?.id,64);
function sideOf(actor,plan,team){
  const id=ids(actor),name=trim(actor?.name??actor?.displayName);
  if(!id||!name)return null;
  const initialIntent=intentOf(plan?.intention??plan?.intent??plan?.matchGoal??plan?.goal);
  return {id,name,team,initialIntent,initialReason:trim(plan?.intentionReason??plan?.intentReason,52)||null,
    initialDoctrine:tactics.has(plan?.doctrine)?plan.doctrine:null,changes:[],truncated:0};
}
export function createMatchReport({fighters,teams,plans,limit,seed,stage,round,clock}={}){
  const sides=Array.isArray(fighters)?fighters.map((f,i)=>sideOf(f,plans?.[i],integer(f?.team,0,1)??i)):
    Array.isArray(teams)?teams.map((team,i)=>sideOf(team,plans?.[i],i)):[];
  if(sides.length<2||sides.length>10||sides.some(x=>!x||![0,1].includes(x.team))||new Set(sides.map(x=>x.id)).size!==sides.length||new Set(sides.map(x=>x.team)).size!==2)return null;
  const seconds=duration(limit,600);
  if(!seconds)return null;
  return {version:VERSION,seed:integer(seed,0,0xffffffff),stage:trim(stage,34)||null,round:integer(round,0,30),
    limit:seconds,clock:{seconds,source:trim(clock?.source,34)||null,reason:trim(clock?.reason,52)||null},
    sides,lastEventId:0};
}
export function appendMatchReportEvents(report,events){
  if(!report||!Array.isArray(events)||!Array.isArray(report.sides))return report;
  for(const e of events){
    if(!e||typeof e!=='object')continue;
    const sequence=integer(e.id,1,Number.MAX_SAFE_INTEGER);
    if(sequence!==null&&sequence<=report.lastEventId)continue;
    if(sequence!==null)report.lastEventId=sequence;
    if(e.kind!=='match_goal'&&e.kind!=='tournament_intent')continue;
    const time=duration(e.time,report.limit+.05), intention=intentOf(e.goal??e.intention??e.intent);
    if(time===null||!intention)continue;
    const team=integer(e.team,0,1);
    const direct=report.sides.find(s=>s.id===e.fighterId);
    const side=direct&&(team===null||direct.team===team)?direct:report.sides.length===2&&team!==null?report.sides.find(s=>s.team===team):null;
    if(!side)continue;
    const previous=intentOf(e.previous??e.from), last=side.changes.at(-1);
    const known=last?.intention??side.initialIntent;
    if(last&&time<last.time||known===intention||previous&&known&&previous!==known)continue;
    if(!known&&!previous){
      // Only a real start event may establish starting intent; a late
      // sighting cannot be backdated or described as a verified switch.
      if(time===0){side.initialIntent=intention;side.initialReason=trim(e.reason,52)||null;}
      continue;
    }
    const change={time,intention,previous:known??previous,reason:trim(e.reason,52)||null};
    if(side.changes.length>=MAX_CHANGE){side.changes.splice(1,1);side.truncated++;}
    side.changes.push(change);
  }
  return report;
}
export function finishMatchReport(report,outcome){
  if(!report||!outcome)return null;
  const winnerIndex=outcome.winnerIndex===null?null:integer(outcome.winnerIndex,0,1);
  const elapsed=duration(outcome.elapsed??outcome.time,report.limit+.05), reason=trim(outcome.reason,40);
  if(elapsed===null||!reason||outcome.winnerIndex!==null&&winnerIndex===null)return null;
  const {lastEventId,...rest}=report;
  return sanitizeMatchReport({...rest,elapsed,result:{winnerIndex,reason}});
}
export function sanitizeMatchReport(raw){
  if(raw?.version!==VERSION||!Array.isArray(raw.sides)||raw.sides.length<2||raw.sides.length>10)return null;
  let report=createMatchReport({fighters:raw.sides,plans:raw.sides.map(side=>({
    intention:side?.initialIntent,intentionReason:side?.initialReason,doctrine:side?.initialDoctrine
  })),limit:raw.limit,seed:raw.seed,stage:raw.stage,round:raw.round,clock:raw.clock});
  if(!report)return null;
  const elapsed=duration(raw.elapsed,report.limit+.05), winnerIndex=raw.result?.winnerIndex,
    reason=trim(raw.result?.reason,40);
  if(elapsed===null||!reason||![0,1,null].includes(winnerIndex))return null;
  for(const [i,side] of report.sides.entries()){
    const saved=raw.sides[i];
    if(saved.team!==side.team||!Array.isArray(saved.changes)||saved.changes.length>MAX_ENTRANTS)return null;
    let lastTime=-1;
    side.truncated=integer(saved.truncated,0,100000)??0;
    for(const entry of saved.changes.slice(0,MAX_CHANGE)){
      const time=duration(entry?.time,elapsed+.001),intention=intentOf(entry?.intention),previous=intentOf(entry?.previous);
      if(time===null||time<lastTime||!intention||!previous||intention===previous)return null;
      side.changes.push({time,intention,previous,reason:trim(entry.reason,52)||null});lastTime=time;
    }
  }
  delete report.lastEventId;
  return {...report,elapsed,result:{winnerIndex,reason}};
}

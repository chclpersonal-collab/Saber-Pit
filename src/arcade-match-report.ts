/** Last completed bout's actual preparation, short verified tactical history
 * and result. This module never infers an intent from combat or awards wins. */
type Intent='win'|'draw';
type Doctrine='balanced'|'aggressive'|'defensive';
type Actor={id?:unknown;name?:unknown;displayName?:unknown;team?:unknown};
type Plan={intent?:unknown;intention?:unknown;matchGoal?:unknown;goal?:unknown;intentionReason?:unknown;intentReason?:unknown;doctrine?:unknown};
type Clock={source?:unknown;reason?:unknown};
type Fixture={fighters?:Actor[];teams?:Actor[];plans?:Plan[];limit?:unknown;seed?:unknown;stage?:unknown;round?:unknown;clock?:Clock};
type IntentChange={time:number;intention:Intent;previous:Intent;reason:string|null};
type Side={id:string;name:string;team:number;initialIntent:Intent|null;initialReason:string|null;initialDoctrine:Doctrine|null;changes:IntentChange[];truncated:number};
type Event={id?:unknown;kind?:unknown;time?:unknown;goal?:unknown;intention?:unknown;intent?:unknown;team?:unknown;fighterId?:unknown;previous?:unknown;from?:unknown;reason?:unknown};
type Outcome={winnerIndex?:unknown;elapsed?:unknown;time?:unknown;reason?:unknown};
type SavedReport={version?:unknown;limit?:unknown;seed?:unknown;stage?:unknown;round?:unknown;clock?:Clock;elapsed?:unknown;result?:Outcome;
  sides?:Array<Actor & {initialIntent?:unknown;initialReason?:unknown;initialDoctrine?:unknown;truncated?:unknown;changes?:Array<{time?:unknown;intention?:unknown;previous?:unknown;reason?:unknown}>}>};
const VERSION=1,MAX_CHANGE=18,MAX_ENTRANTS=48;
const intents=new Set<unknown>(['win','draw']);
const tactics=new Set<unknown>(['balanced','aggressive','defensive']);
const trim=(value:unknown,n=68)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,n):'';
const duration=(n:unknown,limit:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=limit?Math.round(n*1000)/1000:null;
const integer=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max?x:null;
const intentOf=(x:unknown):Intent|null=>intents.has(x)?x as Intent:null;
const ids=(actor?:Actor|null)=>trim(actor?.id,64);
function sideOf(actor:Actor|null|undefined,plan:Plan|undefined,team:number):Side|null{
  const id=ids(actor),name=trim(actor?.name??actor?.displayName);
  if(!id||!name)return null;
  const initialIntent=intentOf(plan?.intention??plan?.intent??plan?.matchGoal??plan?.goal);
  return {id,name,team,initialIntent,initialReason:trim(plan?.intentionReason??plan?.intentReason,52)||null,
    initialDoctrine:tactics.has(plan?.doctrine)?plan?.doctrine as Doctrine:null,changes:[],truncated:0};
}
export function createMatchReport({fighters,teams,plans,limit,seed,stage,round,clock}:Fixture={}){
  const sides=Array.isArray(fighters)?fighters.map((f,i)=>sideOf(f,plans?.[i],integer(f?.team,0,1)??i)):
    Array.isArray(teams)?teams.map((team,i)=>sideOf(team,plans?.[i],i)):[];
  if(sides.length<2||sides.length>10||sides.some(x=>!x||![0,1].includes(x.team))||new Set(sides.map(x=>x!.id)).size!==sides.length||new Set(sides.map(x=>x!.team)).size!==2)return null;
  const seconds=duration(limit,600);
  if(!seconds)return null;
  return {version:VERSION,seed:integer(seed,0,0xffffffff),stage:trim(stage,34)||null,round:integer(round,0,30),
    limit:seconds,clock:{seconds,source:trim(clock?.source,34)||null,reason:trim(clock?.reason,52)||null},
    sides:sides as Side[],lastEventId:0};
}
type Report=NonNullable<ReturnType<typeof createMatchReport>>;
export function appendMatchReportEvents(report:Report|null|undefined,events:Event[]|null|undefined){
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
    const change={time,intention,previous:(known??previous)!,reason:trim(e.reason,52)||null};
    if(side.changes.length>=MAX_CHANGE){side.changes.splice(1,1);side.truncated++;}
    side.changes.push(change);
  }
  return report;
}
export function finishMatchReport(report:Report|null|undefined,outcome:Outcome|null|undefined){
  if(!report||!outcome)return null;
  const winnerIndex=outcome.winnerIndex===null?null:integer(outcome.winnerIndex,0,1);
  const elapsed=duration(outcome.elapsed??outcome.time,report.limit+.05), reason=trim(outcome.reason,40);
  if(elapsed===null||!reason||outcome.winnerIndex!==null&&winnerIndex===null)return null;
  const {lastEventId,...rest}=report;
  return sanitizeMatchReport({...rest,elapsed,result:{winnerIndex,reason}});
}
export function sanitizeMatchReport(value:unknown){
  const raw=value as SavedReport|null|undefined;
  if(raw?.version!==VERSION||!Array.isArray(raw.sides)||raw.sides.length<2||raw.sides.length>10)return null;
  let report=createMatchReport({fighters:raw.sides,plans:raw.sides.map(side=>({
    intention:side?.initialIntent,intentionReason:side?.initialReason,doctrine:side?.initialDoctrine
  })),limit:raw.limit,seed:raw.seed,stage:raw.stage,round:raw.round,clock:raw.clock});
  if(!report)return null;
  const elapsed=duration(raw.elapsed,report.limit+.05), winnerIndex=raw.result?.winnerIndex,
    reason=trim(raw.result?.reason,40);
  if(elapsed===null||!reason||!(winnerIndex===0||winnerIndex===1||winnerIndex===null))return null;
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
  const {lastEventId,...savedReport}=report;
  return {...savedReport,elapsed,result:{winnerIndex,reason}};
}

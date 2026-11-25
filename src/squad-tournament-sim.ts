import {createMatchReport,appendMatchReportEvents,finishMatchReport} from './arcade-match-report.js?v=2.33.0';
/** Real 5v5 Arcade fixtures. Replays re-run the exact same seeded setup/ticks. */
import {createArcade,stepArcade,ARCADE_FORMS,ARCADE_STAT_KEYS} from './arcade-engine.js?v=6.0.2';
import {arcadeChessStyleForId,normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {arcadeFighterGear} from './arcade-loadouts.js?v=6.0.2';
import {fighterGender,appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';

type RawGear={weapon?:string;grip?:string;dualPhase?:boolean;forceFamily?:string};
type RawMember=RawGear&{id?:string;name?:string;body?:string;gender?:string;appearanceSeed?:number;form?:string;chessStyle?:string;gear?:RawGear};
type RawTeam={id?:string;name?:string;combatElo?:number;elo?:number;fighters?:readonly RawMember[];members?:readonly RawMember[];roster?:readonly RawMember[]};
type Fixture={teams?:readonly RawTeam[];squads?:readonly RawTeam[];ruleset?:number;seed?:number|string;round?:number;limit?:number;terrain?:string};
type LiveFighter={id:string;team:number;slot:number;stats:Record<string,unknown>;alive:boolean;gear:ReturnType<typeof arcadeFighterGear>;
  squadMemberId:string;displayName:string;loadoutChosen:boolean;chessStyle:string;matchGoal:string};
type TraceEvent=NonNullable<Parameters<typeof appendMatchReportEvents>[1]>[number];
type LiveGame={fighters:LiveFighter[];phase:string;endReason?:string;time:number;limit:number;eventId:number;events:TraceEvent[];config:{matchGoalPlanning:boolean}};
type MemberResult={chessStyle?:string;id:string;name:string;alive:boolean;stats:Record<string,number>;kills:number;deaths:number};
type Descriptor=ReturnType<typeof descriptor>&{matchReport?:ReturnType<typeof finishMatchReport>};
export const SQUAD_REPLAY_RULESET=30;
export const SQUAD_SIM_TICK=1/120;
const GRADE='SSS+V';
const SIDE_SIZE=5;
const concreteChessStyle=(value:unknown)=>{const style=normalizeArcadeChessStyle(value);return style==='none'||style==='mixed'?null:style;};
const sub=(value:unknown,fallback:string)=>typeof value==='string'&&value.trim()?value.trim().slice(0,80):fallback;
const choice=<T>(value:unknown,allowed:readonly T[],fallback:T)=>allowed.includes(value as T)?value as T:fallback;
const safe=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
const gearOptions=(raw?:RawGear)=>{
  const weapon=choice(raw?.weapon,['single','dual','staff'],'single');
  return {
    weapon,grip:weapon==='staff'?'forward':choice(raw?.grip,['forward','backhand'],'forward'),
    dualPhase:raw?.dualPhase===true,
    forceFamily:choice(raw?.forceFamily,['force_push','force_pulse','force_burst'],'force_push'),
  };
};
function descriptor(fixture:Fixture){
  const source=fixture?.teams??fixture?.squads;
  if(!Array.isArray(source)||source.length!==2)throw new TypeError('Squad bouts need exactly two squads.');
  const archived=Number.isInteger(fixture.ruleset);
  const ruleset=archived?fixture.ruleset!:SQUAD_REPLAY_RULESET;
  const teams=(source as readonly RawTeam[]).map((side,i)=>{
    const members=side?.fighters??side?.members??side?.roster;
    if(!Array.isArray(members)||members.length!==SIDE_SIZE||members.some(m=>!m||typeof m!=='object'))
      throw new TypeError('Each squad needs exactly five fighters.');
    const id=sub(side.id,'squad-'+i);
    const rating=side.combatElo??side.elo;
    const combatElo=typeof rating==='number'&&Number.isFinite(rating)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,rating)):1500;
    return {...(ruleset>=10?{combatElo}:{}),id,name:sub(side.name,'Squad '+(i+1)),
      fighters:(members as readonly RawMember[]).map((f,j)=>{
        const key=sub(f.id,id+'-'+j),body=choice(f.body,['woman','rabbit','femboy'],'femboy');
        const chessStyle=ruleset>=12?(archived?concreteChessStyle(f.chessStyle):arcadeChessStyleForId(key)):null;
        if(ruleset>=12&&!chessStyle)throw new TypeError('Squad chess replays require each fighter’s recorded style.');
        return {...(chessStyle?{chessStyle}:{}),id:key,name:sub(f.name,'Fighter '+(j+1)),body,gender:fighterGender(f.gender,body,key),
          appearanceSeed:Number.isSafeInteger(f.appearanceSeed)?f.appearanceSeed!>>>0:appearanceSeedFor(key),
          form:Object.hasOwn(ARCADE_FORMS,f.form!)?f.form!:'shii_cho',rank:GRADE,gear:gearOptions(f.gear??f)};
      }),
    };
  });
  return {ruleset,seed:typeof fixture.seed==='string'?fixture.seed.slice(0,80):safe(fixture.seed,1),
    round:Number.isInteger(fixture.round)&&fixture.round!>=0?fixture.round!:1,
    limit:choice(Number(fixture.limit),[45,75,90,150],75),terrain:sub(fixture.terrain,'underpit'),teams};
}
export function createSquadReplay(source:Fixture,factory:unknown=createArcade){
  const {ruleset,teams,seed,round,limit,terrain}=descriptor(source);
  const game=(factory as (config:Record<string,unknown>)=>LiveGame)({mode:'watch',rule:'elimination',continuousCombat:ruleset>=13,anticipatingCombat:ruleset>=14,arenaCuts:ruleset>=15,activeFootwork:ruleset>=16,styleTravel:ruleset>=17,repertoireSupport:ruleset>=18,styleChoreo:ruleset>=19,peasantMotion:ruleset>=20,exchangeVariety:ruleset>=21,fluidFootwork:ruleset>=22,eloReads:ruleset>=22,stanceFlow:ruleset>=23,liveEntry:ruleset>=24,impactPhysics:ruleset>=25,recoveryFlow:ruleset>=26,balancePass:ruleset>=27,closeChoice:ruleset>=28,guardCounterplay:ruleset>=29,squadDecisive:ruleset>=30,weaponFlow:ruleset>=9,ratingSkill:ruleset>=10,matchGoalPlanning:ruleset>=11,circuitCuts:ruleset>=11,sideElo:teams.map(t=>t.combatElo),fighterRatings:teams.map(t=>t.fighters.map(()=>t.combatElo)),teamSizes:[SIDE_SIZE,SIDE_SIZE],
    ...(ruleset>=12?{fighterChessStyles:teams.map(t=>t.fighters.map(f=>f.chessStyle))}:{}),
    startingRanks:[GRADE,GRADE],teamForms:teams.map(t=>t.fighters.map(f=>f.form)),seed,round,limit,terrain});
  for(const f of game.fighters){
    const member=teams[f.team].fighters[f.slot],{body,gender,appearanceSeed,id,name,gear}=member;
    Object.assign(f,{body,gender,appearanceSeed,squadMemberId:id,displayName:name});
    f.gear=arcadeFighterGear({startingSaberWeapon:[gear.weapon],startingSaberGrip:[gear.grip],
      startingDualPhase:[gear.dualPhase],startingForceFamily:[gear.forceFamily]},0);
    f.loadoutChosen=true;
  }
  return game;
}
export function squadReplayWinner(game:Pick<LiveGame,'endReason'|'phase'>){
  if(game.endReason==='timeout')return null;
  return game.phase==='won'?0:game.phase==='lost'?1:null;
}
/** A squad bout that advances on demand, one SQUAD_SIM_TICK per step, simulated or with a seated person's controls.
 *  observe() follows each step and finish() reads the result and replay the same way for both. */
export function startSquadBout(fixture:Fixture){
  const replay:Descriptor=descriptor(fixture),game=createSquadReplay(replay);
  const trace=game.config.matchGoalPlanning?createMatchReport({...replay,
    fighters:game.fighters.map(f=>({id:f.id,name:f.displayName,team:f.team})),
    plans:game.fighters.map(f=>({goal:f.matchGoal})),clock:{source:'tournament settings'}}):null;
  const observe=()=>{if(trace&&game.eventId>trace.lastEventId)appendMatchReportEvents(trace,game.events);};
  const finish=()=>{
    const winnerIndex=squadReplayWinner(game);
    if(trace)replay.matchReport=finishMatchReport(trace,{time:game.time,winnerIndex,reason:game.endReason??'simulation-limit'});
    const members:MemberResult[][]=[[],[]];
    for(const f of game.fighters){
      const stats=Object.fromEntries(ARCADE_STAT_KEYS.map(k=>[k,safe(f.stats[k])]));
      members[f.team].push({...(replay.ruleset>=12?{chessStyle:f.chessStyle}:{}),id:f.squadMemberId,name:f.displayName,alive:f.alive,stats,kills:stats.kills,deaths:stats.deaths});
    }
    const tally=(key:'kills'|'deaths')=>members.map(side=>side.reduce((n,f)=>n+f[key],0));
    return {winnerIndex,winner:winnerIndex===null?null:replay.teams[winnerIndex].id,
      reason:game.endReason??'simulation-limit',time:game.time,elapsed:game.time,kills:tally('kills'),deaths:tally('deaths'),damage:members.map(side=>side.reduce((n,f)=>n+f.stats.damage,0)),members,replay};
  };
  return {game,observe,finish};
}
export function playSquadBout(fixture:Fixture){
  const live=startSquadBout(fixture), {game}=live;
  const budget=Math.ceil(game.limit*120)+3;
  for(let n=0;n<budget&&game.phase==='playing';n++){
    (stepArcade as unknown as (match:LiveGame,tick:number)=>unknown)(game,SQUAD_SIM_TICK);
    live.observe();
  }
  return live.finish();
}

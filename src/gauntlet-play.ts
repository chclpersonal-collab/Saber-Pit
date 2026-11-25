/** Gauntlet bouts a person fights as the solo fighter.
 *  Same fixture, rules, clock and learning as a simulated bout; only the solo fighter's controls change.
 *  A bout counts once: it is written only if the saved season still expects this exact fixture next. */
import {createGauntletBattle,createGauntletRecorder,stepGauntletBattle,GAUNTLET_STEP,type GauntletInput,type GauntletBoutResult} from './gauntlet-sim.js?v=6.0.2';
import {nextGauntletBout,recordGauntletBout} from './gauntlet-tournament.js?v=6.0.2';

type State=Parameters<typeof nextGauntletBout>[0];
type Fixture=NonNullable<ReturnType<typeof nextGauntletBout>>;
type Game=ReturnType<typeof createGauntletBattle>;

/** Kept on this device beside the save, never inside it: lets "Watch last bout" show the bout that was fought. */
export const GAUNTLET_HUMAN_KEY='saber-pit:gauntlet:human-bout:1';
const FLAGS=['strike','heavy','dash','guard','force','phase','feint','jump','walk'] as const;
const MAX_RUNS=40000;

export interface HumanControls {
  x?: number; y?: number; technique?: string | null;
  strike?: boolean; heavy?: boolean; dash?: boolean; guard?: boolean; force?: boolean;
  phase?: boolean; feint?: boolean; jump?: boolean; walk?: boolean;
  /** Where the person aims, in arena units (mouse, touch or pad), or absent. */
  aimX?: number; aimY?: number;
}
/** One logged control state: stick x and y in hundredths, a flag bitmask, the technique (or ''), and the aim point in whole arena units (or null). */
export type HumanRun=[tick:number,x:number,y:number,flags:number,technique:string,aimX:number|null,aimY:number|null];
export interface HumanBoutLog { v: 1; season: number; fixtureId: string; cursor: number; ticks: number; runs: HumanRun[] }

const axis=(n: unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(-1,Math.min(1,n))*100):0;
const techniqueOf=(t: unknown)=>typeof t==='string'?t.replace(/[^a-z0-9_:]/gi,'').slice(0,40):'';
const AIM_LIMIT=100000;
const aimOf=(n: unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(-AIM_LIMIT,Math.min(AIM_LIMIT,n))):null;
function encode(c: HumanControls, tick: number): HumanRun{
  let flags=0;
  FLAGS.forEach((name,i)=>{if(c[name])flags|=1<<i;});
  const aimX=aimOf(c.aimX), aimY=aimOf(c.aimY), aimed=aimX!==null&&aimY!==null;
  return [tick,axis(c.x),axis(c.y),flags,techniqueOf(c.technique),aimed?aimX:null,aimed?aimY:null];
}
function decode(run: HumanRun): GauntletInput{
  const [,x,y,flags,technique,aimX,aimY]=run, input: Record<string,unknown>={x:x/100,y:y/100,technique:technique||null};
  if(aimX!==null&&aimY!==null){input.aimX=aimX;input.aimY=aimY;}
  FLAGS.forEach((name,i)=>{input[name]=Boolean(flags&(1<<i));});
  return input as GauntletInput;
}
const same=(a: HumanRun,b: HumanRun)=>a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3]&&a[4]===b[4]&&a[5]===b[5]&&a[6]===b[6];

/** The live bout. step() advances exactly one Gauntlet tick with the person's controls. */
export function startHumanBout(state: State){
  const fixture=nextGauntletBout(state);
  if(!fixture||!state.active)return null;
  const game=createGauntletBattle(fixture,{human:true}), recorder=createGauntletRecorder(game);
  const runs: HumanRun[]=[];
  let ticks=0, result: GauntletBoutResult | null=null;
  const max=Math.ceil(game.limit/GAUNTLET_STEP)+2;
  return {
    fixture, game, season: state.season, cursor: state.active.cursor,
    get ticks(){return ticks;},
    get over(){return game.phase!=='playing';},
    step(controls: HumanControls={}){
      if(game.phase!=='playing')return game;
      if(ticks>=max)throw new Error('Gauntlet bout did not reach its deadline.');
      const run=encode(controls,ticks), last=runs.at(-1);
      if(!last||!same(last,run)){
        if(runs.length>=MAX_RUNS)throw new Error('Too many control changes to keep this bout.');
        runs.push(run);
      }
      stepGauntletBattle(game,GAUNTLET_STEP,decode(run));
      recorder.observe();ticks++;
      return game;
    },
    result(){return result??=recorder.result();},
    log(cursorAfter: number): HumanBoutLog{return {v:1,season:state.season,fixtureId:fixture.id,cursor:cursorAfter,ticks,runs:runs.map(r=>[...r] as HumanRun)};},
  };
}
export type HumanBout=NonNullable<ReturnType<typeof startHumanBout>>;

/** Bout numbers repeat across seasons and resets, so a fixture is matched by its draw and its four fighters too. */
const sameFixture=(a: Fixture,b: Fixture)=>a.id===b.id&&a.seed===b.seed&&a.limit===b.limit&&a.terrain===b.terrain&&
  a.fighters.length===b.fighters.length&&a.fighters.every((f,i)=>f.id===b.fighters[i]!.id);
export type CommitOutcome={ok:true;state:State}|{ok:false;reason:'stale'|'unfinished'|'rejected'};
/** Settle a finished human bout into the season once. A changed or already-settled season is never written. */
export function commitHumanBout(state: State,bout: HumanBout): CommitOutcome{
  if(!bout.over)return {ok:false,reason:'unfinished'};
  const expected=nextGauntletBout(state);
  if(!expected||!state.active||state.season!==bout.season||state.active.cursor!==bout.cursor||!sameFixture(expected,bout.fixture))
    return {ok:false,reason:'stale'};
  const next=recordGauntletBout(state,bout.fixture.id,bout.result());
  if(next===state||next.active?.cursor!==state.active.cursor+1)return {ok:false,reason:'rejected'};
  return {ok:true,state:next};
}

export function readHumanLog(raw: string | null | undefined): HumanBoutLog | null{
  try{
    const v=JSON.parse(raw??'null') as Partial<HumanBoutLog> | null;
    if(v?.v!==1||!Number.isSafeInteger(v.season)||typeof v.fixtureId!=='string'||!Number.isSafeInteger(v.cursor)||
      !Number.isSafeInteger(v.ticks)||v.ticks!<1||!Array.isArray(v.runs)||!v.runs.length||v.runs.length>MAX_RUNS)return null;
    let prev=-1;
    for(const r of v.runs){
      const aim=(n: unknown)=>n===null||Number.isInteger(n)&&Math.abs(n as number)<=AIM_LIMIT;
      if(!Array.isArray(r)||r.length!==7||!aim(r[5])||!aim(r[6])||(r[5]===null)!==(r[6]===null)||!Number.isSafeInteger(r[0])||r[0]<=prev||r[0]>=v.ticks!||
        ![r[1],r[2]].every(n=>Number.isInteger(n)&&n>=-100&&n<=100)||!Number.isInteger(r[3])||r[3]<0||r[3]>=1<<FLAGS.length||
        typeof r[4]!=='string'||techniqueOf(r[4])!==r[4])return null;
      prev=r[0];
    }
    if(v.runs[0]![0]!==0)return null;
    return v as HumanBoutLog;
  }catch{return null;}
}
/** True when the saved log is the person's own fight of the season's last settled bout. */
export function humanLogMatches(log: HumanBoutLog | null,state: State): log is HumanBoutLog{
  const a=state.active;
  return Boolean(log&&a?.lastFixture&&log.season===state.season&&log.cursor===a.cursor&&log.fixtureId===(a.lastFixture as {id?:string}).id);
}
/** Replays the fought bout from its controls: a fresh human battle plus a stepper that feeds each logged tick. */
export function humanReplay(fixture: Fixture | NonNullable<NonNullable<State['active']>['lastFixture']>,log: HumanBoutLog){
  const game: Game=createGauntletBattle(fixture as Fixture,{human:true});
  let tick=0, index=0;
  const step=(g: Game)=>{
    if(g.phase!=='playing')return g;
    while(index+1<log.runs.length&&log.runs[index+1]![0]<=tick)index++;
    stepGauntletBattle(g,GAUNTLET_STEP,tick<log.ticks?decode(log.runs[index]!):{});
    tick++;
    return g;
  };
  return {game,step};
}

/** Written in place of the log when the full log cannot be stored, so a fought bout is never replayed as an AI fight. */
export function humanMarker(season: number,fixtureId: string,cursor: number){
  return {v:1 as const,season,fixtureId,cursor,unavailable:true as const};
}
/** What "Watch last bout" may show for the season's last settled bout:
 *  the person's own fight, "unavailable" when that bout was fought but its controls were not kept, or none (a simulated bout). */
export function humanBoutReplay(raw: string | null | undefined,state: State): {kind:'none'}|{kind:'unavailable'}|{kind:'replay';log:HumanBoutLog}{
  const log=readHumanLog(raw);
  if(humanLogMatches(log,state))return {kind:'replay',log};
  try{
    const v=JSON.parse(raw??'null') as {season?: unknown;cursor?: unknown;fixtureId?: unknown} | null;
    const a=state.active;
    if(v&&a?.lastFixture&&v.season===state.season&&v.cursor===a.cursor&&v.fixtureId===(a.lastFixture as {id?:string}).id)return {kind:'unavailable'};
  }catch{/* unreadable: not tied to this bout */}
  return {kind:'none'};
}

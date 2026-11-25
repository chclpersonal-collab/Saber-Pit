/** Tournament bouts a person fights as Blue: the Blue fighter of a 1v1, or the first fighter of the Blue squad in a 5v5.
 *  Same fixture, rules, clock and learning as a simulated bout; only that fighter's controls change.
 *  A bout counts once: it is written only if the saved bracket still expects this exact fixture and attempt. */
import {stepArcade} from './arcade-engine.js?v=6.0.2';
import {nextTournamentBout,runTournamentStep} from './arcade-tournament.js?v=6.0.3-seat';
import {nextSquadBout,runSquadStep} from './squad-tournament.js?v=6.0.3-seat';
import {startTournamentBout,createTournamentReplay,TOURNAMENT_REPLAY_RULESET} from './arcade-tournament-sim.js?v=6.0.3-seat';
import {startSquadBout,createSquadReplay,SQUAD_REPLAY_RULESET} from './squad-tournament-sim.js?v=6.0.3-seat';
import {logControls,replayControls,readHumanLog,type HumanControls,type HumanRun,type HumanBoutLog} from './gauntlet-play.js?v=6.0.3-seat';

export type TournamentFormat='solo'|'squad';
type SoloState=Parameters<typeof nextTournamentBout>[0];
type SquadState=Parameters<typeof nextSquadBout>[0];
type State=SoloState|SquadState;
type Fixture={id:string;attempt:number;seed:number;limit:number;terrain?:string;fighterIds?:(string|null)[];teamIds?:string[];teams?:{fighters:{id:string}[]}[]};
type Fighter={id:string;team:number;control?:boolean};
type Game={phase:string;endReason?:string;limit:number;fighters:Fighter[]};
type Replay={seed:number;ruleset:number;fighters?:{id:string}[];teams?:{id:string}[];plans?:object[]};
const TICK=1/120;

/** Kept on this device beside each save, never inside it: lets Watch show the bout that was fought. */
export const TOURNAMENT_HUMAN_KEYS={solo:'saber-pit:tournament:human-bout:1',squad:'saber-pit:squad-tournament:human-bout:1'} as const;
export interface TournamentBoutLog extends HumanBoutLog { bracket: number; seed: number; sides: string[] }

const nextOf=(format: TournamentFormat,state: State)=>(format==='squad'?nextSquadBout(state as SquadState):nextTournamentBout(state as SoloState)) as Fixture|null;
const sides=(f: Fixture)=>(f.teamIds??f.fighterIds??[]).map(String);
const roster=(f: Fixture)=>[...sides(f),...(f.teams??[]).flatMap(t=>t.fighters.map(m=>m.id))].join('|');
const blue=(game: Game)=>game.fighters.find(f=>f.team===0)!;

/** The live bout. step() advances exactly one 1/120 s tick with the person's controls. */
export function startTournamentHumanBout(format: TournamentFormat,state: State){
  const fixture=nextOf(format,state), active=state.active;
  if(!fixture||!active)return null;
  const live=format==='squad'?startSquadBout(fixture as Parameters<typeof startSquadBout>[0]):startTournamentBout(fixture as Parameters<typeof startTournamentBout>[0]);
  const game=live.game as unknown as Game;
  blue(game).control=true;
  const runs: HumanRun[]=[], max=Math.ceil(game.limit/TICK)+3, season=state.season, bracket=active.seed;
  let ticks=0, result: ReturnType<typeof live.finish> | null=null;
  return {
    format, fixture, game, season, bracket,
    get over(){return game.phase!=='playing';},
    step(controls: HumanControls={}){
      if(game.phase!=='playing')return;
      if(ticks>=max)throw new Error('Tournament bout did not reach its deadline.');
      (stepArcade as unknown as (g: Game,dt: number,input: unknown)=>void)(game,TICK,logControls(runs,controls,ticks));
      live.observe();ticks++;
      // A tournament bout that runs out the clock is a draw (a rematch), whatever the survivors: the match screen says so too.
      if(game.endReason==='timeout')game.phase='draw';
    },
    result(){return result??=live.finish();},
    log(): TournamentBoutLog{
      return {v:1,season,fixtureId:fixture.id,cursor:fixture.attempt,ticks,runs:runs.map(r=>[...r] as HumanRun),bracket,seed:fixture.seed,sides:sides(fixture)};
    },
    /** Written in place of the log when the full log cannot be stored, so a fought bout is never replayed as an AI fight. */
    marker(){return {v:1,season,fixtureId:fixture.id,cursor:fixture.attempt,bracket,seed:fixture.seed,sides:sides(fixture),unavailable:true};},
  };
}
export type TournamentHumanBout=NonNullable<ReturnType<typeof startTournamentHumanBout>>;

export type TournamentCommit={ok:true;state:State}|{ok:false;reason:'stale'|'unfinished'|'rejected'};
/** Settle a finished human bout into the bracket once, through the same step a simulated bout takes. A changed bracket is never written. */
export function commitTournamentHumanBout(state: State,bout: TournamentHumanBout): TournamentCommit{
  if(!bout.over)return {ok:false,reason:'unfinished'};
  const expected=nextOf(bout.format,state), f=bout.fixture;
  if(!expected||!state.active||state.season!==bout.season||state.active.seed!==bout.bracket||expected.id!==f.id||expected.attempt!==f.attempt||
     expected.seed!==f.seed||expected.limit!==f.limit||expected.terrain!==f.terrain||roster(expected)!==roster(f))return {ok:false,reason:'stale'};
  const result=bout.result() as never;
  const done=bout.format==='squad'?runSquadStep(state as SquadState,()=>result):runTournamentStep(state as SoloState,()=>result);
  if(!done)return {ok:false,reason:'rejected'};
  const replay=state.active?.lastReplay as {seed?: number;fought?: true} | null | undefined;
  if(replay&&replay.seed===f.seed)replay.fought=true;
  return {ok:true,state};
}

/** True when the bracket's next bout is a rematch of this one: it was drawn and queued again. */
export const tournamentRematch=(state: State,bout: TournamentHumanBout)=>nextOf(bout.format,state)?.id===bout.fixture.id;
/** What Watch may show for the bracket's last replay: the person's own fight, "unavailable" when that bout was fought
 *  but its controls were not kept (or its rules have since changed), or none (a simulated bout). */
export function tournamentHumanReplay(raw: string | null | undefined,state: State): {kind:'none'}|{kind:'unavailable'}|{kind:'replay';log:TournamentBoutLog}{
  const active=state.active, replay=active?.lastReplay as Replay | null | undefined;
  let saved: Partial<TournamentBoutLog> | null=null;
  try{saved=JSON.parse(raw??'null');}catch{/* unreadable: not tied to this bout */}
  const ids=(replay?.teams??replay?.fighters??[]).map(s=>s.id).join('|');
  if(!replay||!saved||saved.season!==state.season||saved.bracket!==active!.seed||saved.seed!==replay.seed||
     !Array.isArray(saved.sides)||saved.sides.join('|')!==ids)return (replay as {fought?: true} | null | undefined)?.fought?{kind:'unavailable'}:{kind:'none'};
  const log=readHumanLog(raw) as TournamentBoutLog | null;
  const current=replay.teams?SQUAD_REPLAY_RULESET:TOURNAMENT_REPLAY_RULESET;
  return log&&replay.ruleset===current?{kind:'replay',log}:{kind:'unavailable'};
}
/** Replays the fought bout from its controls: the saved fixture with Blue under the logged controls, one 1/120 s tick per step. */
export function tournamentHumanGame(format: TournamentFormat,replay: Replay,log: TournamentBoutLog,rules: {createArcade: unknown;stepArcade: unknown}){
  const game=(format==='squad'?createSquadReplay(replay as never,rules.createArcade):createTournamentReplay(replay as never,replay.plans as never,rules.createArcade)) as unknown as Game;
  const me=blue(game), next=replayControls(log), step=rules.stepArcade as (g: Game,dt: number,input: unknown)=>void;
  me.control=true;
  return {game,markedId:me.id,step:(g: Game)=>{if(g.phase==='playing')step(g,TICK,next());return g;}};
}

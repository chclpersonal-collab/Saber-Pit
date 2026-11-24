/**
 * Per-match opponent reading for Arena AI. Pure and deterministic: callers
 * pass observations and a seeded rng, nothing here touches the simulation,
 * damage or reaction speed. Rank changes what a fighter knows and how well
 * it adapts, never how fast it reacts or how hard it hits.
 */

export type ArcadeTactic='pressure'|'space'|'recover'|'whiff_punish'|'bait'|'stamina_press'|'guard_read';
export type ArcadeTell='feint_step'|'guard_shift'|'measure_step'|null;
export type ArcadeObservationKind='swing'|'whiff'|'guard'|'dash'|'feint'|'hit_taken';

export interface ArcadeObservation {
  kind:ArcadeObservationKind;
  /** Match time in seconds. */
  t:number;
  /** Side the foe favoured, relative to this fighter: -1 left, 0 centre, 1 right. */
  side?:-1|0|1;
  /** Seconds between the threat appearing and the foe's guard, for 'guard'. */
  delay?:number;
  /** Whether the foe kept walking in after missing, for 'whiff'. */
  chased?:boolean;
}

interface TacticRecord {tries:number;wins:number}

export interface ArcadeOpponentModel {
  readonly lastSwingAt:number|null;
  /** Smoothed seconds between the foe's swings. */
  readonly swingInterval:number|null;
  /** Smoothed seconds the foe takes to raise guard against a threat. */
  readonly guardDelay:number|null;
  readonly sides:readonly [number,number,number];
  readonly swings:number;
  readonly whiffs:number;
  readonly whiffChases:number;
  readonly guards:number;
  readonly feints:number;
  readonly tactics:Readonly<Partial<Record<ArcadeTactic,TacticRecord>>>;
  readonly current:ArcadeTactic|null;
}

export interface ArcadeTacticContext {
  /** 0 is F, 14 is SSS+V. */
  gradeIndex:number;
  /** Stamina of this fighter and of its foe, 0-100. */
  selfEnergy:number;
  foeEnergy:number;
  /** Centre distance and this fighter's strike reach, in arena units. */
  distance:number;
  reach:number;
  /** True while the foe is recovering from a swing that missed. */
  foeWhiffing:boolean;
  /** Seeded random source from the match, in [0, 1). */
  rng:()=>number;
}

export interface ArcadeTacticChoice {
  tactic:ArcadeTactic;
  /** A small visible sign of the read, so a player can see the thinking. */
  tell:ArcadeTell;
  /** True when this choice is a deliberate novice mistake. */
  mistake:boolean;
}

const SMOOTH=.35;
const TACTIC_ORDER:readonly ArcadeTactic[]=Object.freeze(['pressure','space','recover','whiff_punish','bait','stamina_press','guard_read']);
/** Grade index at which each tactic is learned. */
export const ARCADE_TACTIC_GRADE:Readonly<Record<ArcadeTactic,number>>=Object.freeze({
  pressure:0,space:0,recover:1,whiff_punish:2,bait:3,stamina_press:4,guard_read:5,
});
const MAX_GRADE=14;
const clampGrade=(g:number)=>Number.isFinite(g)?Math.max(0,Math.min(MAX_GRADE,Math.trunc(g))):0;

export function arcadeKnownTactics(gradeIndex:number):readonly ArcadeTactic[]{
  const g=clampGrade(gradeIndex);
  return TACTIC_ORDER.filter(t=>ARCADE_TACTIC_GRADE[t]<=g);
}

/** Chance of a visible wrong call: F .35 down to .02 at SSS+V. */
export function arcadeMistakeRate(gradeIndex:number):number{
  const g=clampGrade(gradeIndex);
  return Math.round((.35-(.33*g/MAX_GRADE))*1000)/1000;
}

/** Fighters from grade C (3) up drop a tactic that keeps failing. */
export function arcadeAdapts(gradeIndex:number):boolean{return clampGrade(gradeIndex)>=3;}

export function createArcadeOpponentModel():ArcadeOpponentModel{
  return Object.freeze({lastSwingAt:null,swingInterval:null,guardDelay:null,sides:Object.freeze([0,0,0]) as readonly [number,number,number],
    swings:0,whiffs:0,whiffChases:0,guards:0,feints:0,tactics:Object.freeze({}),current:null});
}

const smooth=(prev:number|null,next:number)=>prev===null?next:prev+(next-prev)*SMOOTH;

/** Returns a new model; the input is never changed. */
export function observeArcadeOpponent(model:ArcadeOpponentModel,obs:ArcadeObservation):ArcadeOpponentModel{
  if(!obs||!Number.isFinite(obs.t))return model;
  const sides:[number,number,number]=[...model.sides];
  if(obs.side===-1||obs.side===0||obs.side===1)sides[obs.side+1]++;
  let {lastSwingAt,swingInterval,guardDelay,swings,whiffs,whiffChases,guards,feints}=model;
  switch(obs.kind){
    case 'swing':{
      const gap=lastSwingAt===null?null:obs.t-lastSwingAt;
      if(gap!==null&&gap>0&&gap<4)swingInterval=smooth(swingInterval,gap);
      lastSwingAt=obs.t;swings++;break;
    }
    case 'whiff':whiffs++;if(obs.chased)whiffChases++;break;
    case 'guard':guards++;
      if(typeof obs.delay==='number'&&Number.isFinite(obs.delay)&&obs.delay>=0&&obs.delay<2)guardDelay=smooth(guardDelay,obs.delay);
      break;
    case 'feint':feints++;break;
    default:break;
  }
  return Object.freeze({...model,lastSwingAt,swingInterval,guardDelay,swings,whiffs,whiffChases,guards,feints,
    sides:Object.freeze(sides) as readonly [number,number,number]});
}

/** Record whether the last tactic paid off (landed, forced a block, avoided a hit). */
export function reportArcadeTactic(model:ArcadeOpponentModel,tactic:ArcadeTactic,success:boolean):ArcadeOpponentModel{
  const prev=model.tactics[tactic]??{tries:0,wins:0};
  const tactics=Object.freeze({...model.tactics,[tactic]:Object.freeze({tries:prev.tries+1,wins:prev.wins+(success?1:0)})});
  return Object.freeze({...model,tactics});
}

/** The side the foe leans to after enough evidence, or null. */
export function arcadeFavouredSide(model:ArcadeOpponentModel):-1|1|null{
  const [left,,right]=model.sides;
  if(left+right<4)return null;
  if(left>=right*2)return -1;
  if(right>=left*2)return 1;
  return null;
}

function failing(model:ArcadeOpponentModel,tactic:ArcadeTactic){
  const r=model.tactics[tactic];
  return Boolean(r&&r.tries>=3&&r.wins/r.tries<.35);
}

/** Score each known tactic from the read and the moment. Higher is better. */
function scores(model:ArcadeOpponentModel,ctx:ArcadeTacticContext,known:readonly ArcadeTactic[]){
  const near=ctx.distance<=ctx.reach*1.1;
  const out=new Map<ArcadeTactic,number>();
  const chaser=model.whiffs>=2&&model.whiffChases/model.whiffs>=.5;
  const fastSwinger=model.swingInterval!==null&&model.swingInterval<.6;
  const slowGuard=model.guardDelay!==null&&model.guardDelay>.25;
  for(const t of known){
    let v=.2;
    if(t==='pressure')v+=near?.4:.1;
    if(t==='space')v+=fastSwinger?.5:near?.2:.05;
    if(t==='recover')v+=ctx.selfEnergy<30?.7:0;
    if(t==='whiff_punish')v+=ctx.foeWhiffing?.9:chaser?.3:0;
    if(t==='bait')v+=model.guards>=3?.45:model.feints===0&&model.swings>=4?.25:0;
    if(t==='stamina_press')v+=ctx.foeEnergy<30?.65:0;
    if(t==='guard_read')v+=slowGuard?.5:0;
    out.set(t,v);
  }
  return out;
}

const TELLS:Readonly<Record<ArcadeTactic,ArcadeTell>>=Object.freeze({
  pressure:null,space:'measure_step',recover:null,whiff_punish:null,bait:'feint_step',stamina_press:null,guard_read:'guard_shift',
});

/**
 * Pick the next tactic. Known tactics depend on rank; novices sometimes make
 * a visible wrong call; adapting ranks drop tactics that keep failing.
 */
export function chooseArcadeTactic(model:ArcadeOpponentModel,ctx:ArcadeTacticContext):ArcadeTacticChoice{
  const known=arcadeKnownTactics(ctx.gradeIndex);
  const scored=scores(model,ctx,known);
  if(arcadeAdapts(ctx.gradeIndex)){
    for(const t of known)if(failing(model,t)&&known.some(o=>o!==t&&!failing(model,o)))scored.set(t,(scored.get(t)??0)-.6);
  }
  const ranked=[...scored.entries()].sort((a,b)=>b[1]-a[1]||TACTIC_ORDER.indexOf(a[0])-TACTIC_ORDER.indexOf(b[0]));
  const roll=ctx.rng();
  const mistake=ranked.length>1&&roll<arcadeMistakeRate(ctx.gradeIndex);
  const pick=mistake?ranked[1+Math.floor(ctx.rng()*(ranked.length-1))][0]:ranked[0][0];
  return Object.freeze({tactic:pick,tell:TELLS[pick],mistake});
}


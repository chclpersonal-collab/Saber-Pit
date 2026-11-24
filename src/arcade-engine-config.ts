import {normalizeTeamLooks,ARENA_TEAM_GENDERS,ARENA_TEAM_APPEARANCES} from './arcade-team-looks.js';
/** Options that the current game normalizes before the first authoritative tick. */
import {normalizeArcadeForcePool} from './arcade-force-pool.js';
import type {ArcadeForcePoolId} from './arcade-force-pool.js';
import {normalizeArcadeGear} from './arcade-loadouts.js?v=3.1.0';
import {normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {ENVIRONMENTS} from './environment.js?v=1.4.0';
import type {ArcadeBounds,ArcadeCover} from './arcade-engine-geometry.js';
import {normalizeArcadeMotionFlow} from './arcade-motion-flow.js?v=5.0.0';
import type {ArcadeMotionFlow,ArcadeMotionFlowInput} from './arcade-motion-flow.js?v=5.0.0';
import type {ArcadeRecord} from './arcade-engine-stats.js';

export type ArcadeRule='elimination'|'control'|'relic';
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const optionSet=<T extends string>(value:string|undefined,choices:readonly T[],fallback:T): T=>choices.includes(value as T)?value as T:fallback;
const doctrineAliases: Readonly<Record<string,string|undefined>>={assault:'aggressive',guard:'defensive'};

type Flag='perfectParryStamina'|'continuousCombat'|'anticipatingCombat'|'arenaCuts'|'activeFootwork'|'styleTravel'|'repertoireSupport'|'styleChoreo'|'peasantMotion'|'exchangeVariety'|'stanceFlow'|'impactPhysics'|'recoveryFlow'|'balancePass'|'closeChoice'|'guardCounterplay'|'minorMoves'|'forceVariants'|'liveEntry'|'eloReads'|'fluidFootwork'|'arenaRatingSkill';
type Toggle='customHeroTactics'|'advancedArena'|'weaponFlow'|'expandedCombat'|'ratingSkill'|'matchGoalPlanning'|'circuitCuts'|'soloTournamentClock'|'squadDecisive';
type GearOptions='startingSaberQuality'|'startingDualSabers'|'startingSaberWeapon'|'startingSaberGrip'|'startingDualPhase'|'startingForceFamily'|'startingForceQuality';
type InputRecord=Partial<ArcadeRecord>;
type CareerValue=number|{merit:number};
type CareerInputs=Partial<Record<`${number}-${number}`,CareerValue>>&{0?:readonly CareerValue[];1?:readonly CareerValue[]};
type RankSetting=string|readonly string[];
type RankInputs=readonly RankSetting[]|{blue?:RankSetting;red?:RankSetting;0?:RankSetting;1?:RankSetting};
interface InputTerrain {id?:string;bounds?:Partial<ArcadeBounds>;solids?:readonly ArcadeCover[];zones?:readonly ArcadeCover[]}
export interface ArcadeOptions extends Partial<Record<Flag|Toggle,boolean>>, Partial<Record<GearOptions,unknown>> {
  motionFlow?: ArcadeMotionFlowInput;
  teamGenders?:readonly unknown[];
  teamAppearances?:readonly unknown[];
  forcePools?: readonly (readonly string[]|null)[];
  mode?: string;
  seed?: number|string;
  width?: number;
  height?: number;
  archetype?: string;
  form?: string;
  body?: string;
  round?: number;
  records?: {teams?: readonly InputRecord[];soldiers?: readonly (InputRecord&{id?:string;team?:number;slot?:number})[]}|null;
  careers?: CareerInputs | null;
  startingRanks?: RankInputs;
  teamSizes?: readonly (number|string|null)[];
  limit?: number|string;
  playerSlot?: number|string;
  teamForms?: readonly (string|readonly string[]|null)[];
  saberOnly?: boolean;
  terrain?: InputTerrain|string|null;
  doctrines?: readonly string[];
  targeting?: readonly string[];
  formations?: readonly string[];
  rule?: string;
  weather?: string;
  environment?: string;
  deployments?: readonly string[];
  heroLineup?: unknown;
  sideElo?: readonly number[];
  fighterRatings?: readonly (readonly (number|null|undefined)[]|null)[];
  chessStyles?: readonly (string|null)[];
  fighterChessStyles?: readonly (readonly (string|null)[]|null)[];
}
export interface ArcadeConfig extends ReturnType<typeof normalizeArcadeGear>, Partial<Record<Flag,true>> {
  motionFlow?: ArcadeMotionFlow;
  novicePractice?:true; // Arena controller only: unrated playback speed, no engine changes.
  teamGenders?:ReturnType<typeof normalizeTeamLooks<typeof ARENA_TEAM_GENDERS[number]>>;
  teamAppearances?:ReturnType<typeof normalizeTeamLooks<typeof ARENA_TEAM_APPEARANCES[number]>>;
  forcePools?:readonly [readonly ArcadeForcePoolId[],readonly ArcadeForcePoolId[]];
  teamSizes:[number,number];limit:number;rule:ArcadeRule;weather:string;
  playerSlot:number;saberOnly:boolean;teamForms:(string|readonly string[]|null)[];
  doctrines:string[];targeting:string[];formations:string[];deployments:string[];
  circuitCuts:boolean;matchGoalPlanning:boolean;weaponFlow:boolean;expandedCombat:boolean;customHeroTactics:boolean;advancedArena:boolean;
  chessStyles?:string[];fighterChessStyles?:(string|null)[][];
}

export function buildArcadeConfig(options: ArcadeOptions,mode: string,sizes: [number,number]): ArcadeConfig {
  const {startingSaberQuality,startingDualSabers,startingSaberWeapon,startingSaberGrip,startingDualPhase,startingForceFamily,startingForceQuality,limit,soloTournamentClock,rule,circuitCuts,matchGoalPlanning,weaponFlow,expandedCombat,customHeroTactics,advancedArena,playerSlot,teamForms,saberOnly,doctrines,targeting,formations,weather,environment,deployments,chessStyles,fighterChessStyles,perfectParryStamina,continuousCombat,anticipatingCombat,arenaCuts,activeFootwork,styleTravel,repertoireSupport,styleChoreo,peasantMotion,exchangeVariety,stanceFlow,impactPhysics,recoveryFlow,balancePass,closeChoice,guardCounterplay,minorMoves,forceVariants,liveEntry,eloReads,ratingSkill,fluidFootwork,arenaRatingSkill}=options;
  const requestedLimit=Number(limit);
  const longSoloClock=requestedLimit===360&&soloTournamentClock===true&&mode==='watch'&&sizes.every(n=>n===1)&&(!rule||rule==='elimination');
  const config: ArcadeConfig={...normalizeArcadeGear({startingSaberQuality,startingDualSabers,startingSaberWeapon,startingSaberGrip,startingDualPhase,startingForceFamily,startingForceQuality}),teamSizes:sizes,limit:longSoloClock||[45,75,90,150].includes(requestedLimit)?requestedLimit:75,
    circuitCuts:circuitCuts===true,matchGoalPlanning:matchGoalPlanning===true&&mode==='watch'&&(!rule||rule==='elimination'),
    weaponFlow:weaponFlow===true,expandedCombat:expandedCombat===true,customHeroTactics:customHeroTactics===true&&mode!=='command',
    advancedArena:advancedArena===true&&mode!=='command'&&(!rule||rule==='elimination'),
    playerSlot:Number.isInteger(Number(playerSlot))?clamp(Number(playerSlot),0,sizes[0]-1):0,
    teamForms:[teamForms?.[0]??null,teamForms?.[1]??null],saberOnly:Boolean(saberOnly),
    doctrines:[0,1].map(i=>optionSet((doctrines?.[i]===undefined?undefined:doctrineAliases[doctrines[i]])??doctrines?.[i],['balanced','aggressive','defensive'],'balanced')),
    targeting:[0,1].map(i=>optionSet(targeting?.[i],['balanced','nearest','weakest','objective'],'balanced')),
    formations:[0,1].map(i=>optionSet(formations?.[i],['line','wedge','spread'],'line')),
    rule:optionSet<ArcadeRule>(rule,['elimination','control','relic'],'elimination'),
    weather:optionSet(weather??environment,Object.keys(ENVIRONMENTS),'clear'),
    deployments:[0,1].map(i=>optionSet(deployments?.[i],['standard','forward','reserve'],'standard'))};
  const pools=[normalizeArcadeForcePool(options.forcePools?.[0]),normalizeArcadeForcePool(options.forcePools?.[1])] as const;
  if(!config.saberOnly&&['duel','squad','watch','command'].includes(mode)&&!config.matchGoalPlanning&&!options.soloTournamentClock&&pools.some(pool=>pool.length))config.forcePools=pools;
  const genders=normalizeTeamLooks(options.teamGenders,ARENA_TEAM_GENDERS);
  const looks=normalizeTeamLooks(options.teamAppearances,ARENA_TEAM_APPEARANCES);
  if(genders)config.teamGenders=genders;
  if(looks)config.teamAppearances=looks;
  const styleOptions=[0,1].map(i=>normalizeArcadeChessStyle(chessStyles?.[i]));
  if(styleOptions.some(x=>x!=='none'))config.chessStyles=styleOptions;
  const concreteStyles=[0,1].map(i=>Array.from({length:sizes[i]},(_,slot)=>{
    const style=normalizeArcadeChessStyle(fighterChessStyles?.[i]?.[slot]);
    return style==='none'||style==='mixed'?null:style;
  }));
  if(concreteStyles.some(side=>side.some(Boolean)))config.fighterChessStyles=concreteStyles;
  if(perfectParryStamina===true)config.perfectParryStamina=true;
  if(continuousCombat===true)config.continuousCombat=true;
  if(anticipatingCombat===true)config.anticipatingCombat=true;
  if(arenaCuts===true)config.arenaCuts=true;
  if(activeFootwork===true)config.activeFootwork=true;
  if(styleTravel===true)config.styleTravel=true;
  if(repertoireSupport===true)config.repertoireSupport=true;
  if(!options.motionFlow&&styleChoreo===true)config.styleChoreo=true;
  if(!options.motionFlow&&peasantMotion===true)config.peasantMotion=true;
  if(exchangeVariety===true)config.exchangeVariety=true;
  if(!options.motionFlow&&stanceFlow===true)config.stanceFlow=true;
  if(impactPhysics===true)config.impactPhysics=true;
  if(!options.motionFlow&&recoveryFlow===true&&impactPhysics===true)config.recoveryFlow=true;
  if(balancePass===true)config.balancePass=true;
  if(closeChoice===true)config.closeChoice=true;
  if(guardCounterplay===true)config.guardCounterplay=true;
  if(minorMoves===true)config.minorMoves=true;
  if(forceVariants===true&&expandedCombat===true)config.forceVariants=true;
  if(!options.motionFlow&&liveEntry===true)config.liveEntry=true;
  if(arenaRatingSkill===true)config.arenaRatingSkill=true;
  if(eloReads===true&&ratingSkill===true)config.eloReads=true;
  if(fluidFootwork===true)config.fluidFootwork=true;
  if(options.motionFlow)config.motionFlow=normalizeArcadeMotionFlow(options.motionFlow,impactPhysics===true);
  return config;
}

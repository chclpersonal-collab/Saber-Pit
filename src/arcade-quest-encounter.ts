// @ts-nocheck
/** The Bell Beneath uses one deterministic Arcade duel live and headlessly. */
import {createArcade,stepArcade} from './arcade-engine.js?v=3.0.0';
import {normalizeBattleHero} from './arcade-heroes.js?v=2.42.0';

import {arcadeChessStyleForId,normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';

export const QUEST_ENCOUNTER_TICK=1/120;
export const QUEST_ENCOUNTER_LIMIT=30;
export const QUEST_ENCOUNTER_VERSION=19;
export const BELL_GUARDIAN=Object.freeze({name:'Veyr of the Hollow Bell',form:'djem_so',grade:'SSS+III',body:'femboy',gender:'nonbinary',weapon:'staff'});
const validSeed=seed=>Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff;
const cleanHero=raw=>{
  if(!raw||typeof raw!=='object')return null;
  return normalizeBattleHero({...raw,weapon:raw.weapon??raw.gear?.weapon,grip:raw.grip??raw.gear?.grip,
    dualPhase:raw.dualPhase??raw.gear?.dualPhase,forceFamily:raw.forceFamily??raw.gear?.forceFamily,
    adaptation:raw.adaptation??raw.profile??raw.heroAdaptation});
};
function createGame(descriptor){
  const {seed,hero,chessStyles}=descriptor;
  const foe=BELL_GUARDIAN;
  const game=createArcade({mode:'watch',seed,width:1120,height:640,terrain:'underpit',limit:45,rule:'elimination',
    teamSizes:[1,1],chessStyles,continuousCombat:descriptor.version>=3,anticipatingCombat:descriptor.version>=4,arenaCuts:descriptor.version>=5,activeFootwork:descriptor.version>=6,styleTravel:descriptor.version>=7,repertoireSupport:descriptor.version>=8,styleChoreo:descriptor.version>=9,peasantMotion:descriptor.version>=10,exchangeVariety:descriptor.version>=11,fluidFootwork:descriptor.version>=12,eloReads:descriptor.version>=12,stanceFlow:descriptor.version>=13,liveEntry:descriptor.version>=14,impactPhysics:descriptor.version>=15,recoveryFlow:descriptor.version>=16,balancePass:descriptor.version>=17,closeChoice:descriptor.version>=18,guardCounterplay:descriptor.version>=19,ratingSkill:descriptor.version>=12,teamForms:[[hero.form],[foe.form]],startingRanks:['SSS+V',foe.grade],heroLineup:{'0-0':hero},
    startingSaberWeapon:[hero.weapon,foe.weapon],startingForceFamily:[hero.forceFamily,'force_push'],
    doctrines:[hero.doctrine,'defensive']});
  const [player,guardian]=game.fighters;
  player.displayName=hero.name;
  Object.assign(guardian,{displayName:foe.name,body:foe.body,gender:foe.gender,appearanceSeed:0xaced7650});
  // The public Arcade lobby has fixed clocks; the quest owns its shorter cap.
  game.limit=QUEST_ENCOUNTER_LIMIT;game.config.limit=QUEST_ENCOUNTER_LIMIT;
  game.elitePacing={active:true,stage:'measured',measuredUntil:.23,fullAt:.52};
  game.questCarry=0;
  return game;
}
export function normalizeQuestEncounterDescriptor(raw){
  if(![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,QUEST_ENCOUNTER_VERSION].includes(raw?.version)||!validSeed(raw.seed))return null;
  const hero=cleanHero(raw.hero);
  if(!hero)return null;
  if(raw.version===1)return {version:1,seed:raw.seed,hero};
  const chessStyles=Array.isArray(raw.chessStyles)?raw.chessStyles.map(normalizeArcadeChessStyle):[];
  if(chessStyles.length!==2||chessStyles.some(style=>style==='none'||style==='mixed'))return null;
  return {version:raw.version,seed:raw.seed,hero,chessStyles};
}
export function createQuestEncounter(seed,hero,{legacy=false}={}){
  return restoreQuestEncounter(legacy?{version:1,seed,hero}:{version:QUEST_ENCOUNTER_VERSION,seed,hero,
    chessStyles:[arcadeChessStyleForId(hero?.id),arcadeChessStyleForId('veyr-hollow-bell')]});
}
export function restoreQuestEncounter(raw){
  const descriptor=normalizeQuestEncounterDescriptor(raw);
  return descriptor?{descriptor,game:createGame(descriptor)}:null;
}
export function stepQuestEncounter(game,dt=QUEST_ENCOUNTER_TICK){
  if(!game||game.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return game;
  const elapsed=(game.questCarry??0)+dt;
  const ticks=Math.min(Math.floor((elapsed+1e-9)/QUEST_ENCOUNTER_TICK),Math.ceil(QUEST_ENCOUNTER_LIMIT/QUEST_ENCOUNTER_TICK)+2);
  game.questCarry=Math.max(0,elapsed-ticks*QUEST_ENCOUNTER_TICK);
  for(let n=0;n<ticks&&game.phase==='playing';n++)stepArcade(game,QUEST_ENCOUNTER_TICK);
  if(game.endReason==='timeout'){
    game.phase='draw';const ending=game.events.at(-1);
    if(ending?.kind==='round')ending.phase='draw';
  }
  return game;
}
export function questEncounterResult(game){
  if(!game||game.phase==='playing')return null;
  return {status:game.phase,winnerIndex:game.phase==='won'?0:game.phase==='lost'?1:null,
    reason:game.endReason,elapsed:game.time,kills:[...game.stats.kills],deaths:[...game.stats.deaths]};
}
export function resolveQuestEncounter(descriptor){
  const entry=restoreQuestEncounter(descriptor);
  if(!entry)return null;
  stepQuestEncounter(entry.game,QUEST_ENCOUNTER_LIMIT+QUEST_ENCOUNTER_TICK);
  return questEncounterResult(entry.game);
}

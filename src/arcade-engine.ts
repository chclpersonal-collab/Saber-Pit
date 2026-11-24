import {contactChainApplies,contactChainOpen} from './arcade-motion-flow.js?v=5.0.0';
import type {SimGame,SimFighter,SimMove,BladeCast,BladeSegment,Technique,LocalPressure,SimCommand,Cover,Point} from './arcade-engine-state.js';
import type {ArcadeOptions,ArcadeInput} from './arcade-engine-api.js?v=5.0.0';
import {bodyGap,inside,openAt,crossed,blockedBetween,canSlide,bodyMotionFraction,separate,chooseRoute,spawnPosition} from './arcade-engine-geometry.js';
import {aerialArcs,vaultArc,evadeArc,launchArc,startAir,updateAir} from './arcade-engine-air.js';
import {ARCADE_STAT_KEYS,record,roundStats,credit,recordDamage,recordKnockout} from './arcade-engine-stats.js';
export {ARCADE_STAT_KEYS};
import {neutralAction,setAction,spend} from './arcade-engine-actions.js';
import {outcome} from './arcade-engine-outcome.js';
import {ARCADE_RANK_COMBAT,countMove,rankGap,masteryRatio,rankStrikeScale,elitePair,pacingLift,pacedDamage} from './arcade-engine-rank.js';
export {ARCADE_RANK_COMBAT};
import {stepGame} from './arcade-engine-step.js';
import {archetypes,ARCADE_FORMS,ARCADE_FORM_IDS,ARCADE_ATTACKS,legacyForm,profile,styleTimings,quickCounter,art,arcadeContactHeight} from './arcade-engine-profile.js';
export {ARCADE_FORMS,ARCADE_FORM_IDS,ARCADE_ATTACKS,arcadeContactHeight};
import {buildArcadeConfig} from './arcade-engine-config.js?v=5.0.0';
import {arcadeBodyStaminaReward} from './arcade-stamina.js?v=2.37.0';
import {arcadeChessStyleFor,arcadeChessMove,arcadeChessAllowsLane,arcadeChessDesiredBearing,arcadeChessPawnStrike,chooseArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {chooseArenaMatchGoal} from './arcade-match-goal.js?v=2.33.0';
import {arcadeEloSkill,arenaReadSkill,arenaPatternRead} from './arcade-elo-skill.js?v=2.32.0';
import {arcadeExpandedMoveById} from './arcade-expanded-combat.js?v=3.1.0';
export {ARCADE_EXPANDED_MOVES,arcadeExpandedMovesFor} from './arcade-expanded-combat.js?v=3.1.0';
import {chooseAdvancedFollowup} from './arcade-advanced-moves.js?v=2.30.0';
import {arcadeRankFootworkById,arcadeFootworkMotion,arcadeFootworkPlan,planPeerFootwork} from './arcade-rank-footwork.js?v=2.27.0';
export {ARCADE_RANK_FOOTWORK,arcadeRankFootworkFor} from './arcade-rank-footwork.js?v=2.27.0';
import {arcadeAttackPresentation,chooseFormCommit} from './arcade-move-choice.js?v=2.30.0';
import {ARCADE_AIR_ATTACKS,ARCADE_AIR_STRIKES,arcadeJumpProfile,arcadeJumpMotion} from './arcade-air-gameplay.js?v=2.25.3';
export {ARCADE_AIR_STRIKES};
import {normalizeHeroTactics,observeHeroPlan} from './arcade-hero-tactics.js?v=2.18.0';
import {fighterGender,appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';
import {normalizeHeroLineup} from './arcade-heroes.js?v=2.42.0';
/** The real-time Saber Pit arcade rules. No DOM, browser clocks, or external state. */
import {findArcadeBladeContact} from './arcade-clashes.js?v=5.0.0';
import {sampleArcadeFighter,arcadeBladeWorld,arcadeFeetWorld} from './arcade-fighters.js?v=5.0.0';
import {ARCADE_TECHNIQUES,arcadeMovesFor} from './arcade-repertoire.js?v=3.1.0';
import {createArcadeInjuries,applyArcadeInjury,arcadeInjuryModifiers,compareArcadeDanger,arcadeInjuryBurden} from './arcade-injuries.js?v=2.9.0';
export {arcadeMovesFor};
import {createArcadeTerrain} from './arcade-stage.js';
import {advanceArcadeObjective,arcadeObjectiveMove,carrierSpeedScale,createArcadeObjective,isArcadeCarrier} from './arcade-objectives.js';
import {arcadeFighterGear,arcadeGearMove} from './arcade-loadouts.js?v=3.1.0';
import {environmentAt} from './environment.js?v=1.4.0';
import {planArcadeSquad,arcadeSquadSpacing,ARCADE_SQUAD_MIN_GAP} from './arcade-squad-tactics.js?v=5.1.0';
import type {ArcadeSquadUnit,ArcadeSquadFormation} from './arcade-squad-tactics.js?v=5.1.0';
import {combatSkillProfile, progressionSummary, SOLDIER_GRADES} from "./progression.js?v=1.4.0";
const finite=(value:unknown): value is number=>Number.isFinite(value);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const ARCADE_MAX_TEAM_SIZE=24;
function rng(state: Pick<SimGame,"rng">) { state.rng ^= state.rng<<13; state.rng ^= state.rng>>>17; state.rng ^= state.rng<<5; return (state.rng>>>0)/4294967296; }
function blendAngle(a: number,b: number,amount: number){return a+angleDelta(b,a)*amount;}
const dashDuration=.205;
export const ARCADE_TRAKATA_ID='trakata';
type BladeWorld=ReturnType<typeof arcadeBladeWorld>&{offhand?:BladeSegment};
const attackByName=(id:string|null|undefined): SimMove | undefined=>ARCADE_ATTACKS[id as keyof typeof ARCADE_ATTACKS];
const atk = (f: SimFighter): SimMove | null | undefined=>f.attack&&!f.saberOff ? (f.attackSpec??attackByName(f.attack)??ARCADE_AIR_ATTACKS[f.attack]) : null;
function event(s: SimGame,kind: string,f: SimFighter,x: number=f.x,y: number=f.y,extra: Record<string, unknown>={}){
  s.events.push({id:++s.eventId,kind,x,y,face:f.face,team:f.team,fighterId:f.id,time:s.time,form:f.form,technique:f.technique,weapon:f.gear?.weapon,grip:f.gear?.grip,saberPhase:f.saberPhase,
    ...(s.config?.anticipatingCombat&&f.chessStyle?{chessStyle:(f.attack&&f.attackSpec?.chessStyle)||f.chessStyle,
      chessPromoted:f.attack&&f.attackSpec?.chessStyle?f.attackSpec.chessPromoted===true:f.chessPawn?.promoted===true}:{}),...extra});
  if(s.events.length>48) s.events.splice(0,s.events.length-48);
}
const teamSize=(n: unknown,fallback: number)=>finite(Number(n))&&n!==null&&n!==''?clamp(Math.floor(Number(n)),1,ARCADE_MAX_TEAM_SIZE):fallback;
const terrainParts=(parts: unknown, kind: string) => (Array.isArray(parts)?parts:[]).slice(0,40).filter(rect=>
  finite(rect?.x)&&finite(rect?.y)&&finite(rect?.width)&&finite(rect?.height)&&rect.width>0&&rect.height>0
).map(rect=>({...rect,kind:rect.kind??kind}));
function terrainFor(value: ArcadeOptions["terrain"],w: number,h: number) {
  const defaultBounds={minX:42,maxX:w-42,minY:h*.21875,maxY:h*(585/640)};
  const source=value&&typeof value==='object'?value:{id:typeof value==='string'?value:'open'};
  const read=(key:keyof SimGame['bounds'])=>{
    const value=source.bounds?.[key];return finite(value)?clamp(value,0,key.endsWith('X')?w:h):defaultBounds[key];
  };
  const bounds={minX:read('minX'),maxX:read('maxX'),minY:read('minY'),maxY:read('maxY')};
  return {id:source.id??'open',bounds:bounds.maxX-bounds.minX>80&&bounds.maxY-bounds.minY>80?bounds:defaultBounds,
    solids:terrainParts(source.solids,'wall'),zones:terrainParts(source.zones,'rough')};
}
function startingMerit(value: unknown) {
  const label=typeof value==='string' ? value.trim().toUpperCase().replace(/\s+/g,'').replace('(ENTRY)','') : 'F';
  return SOLDIER_GRADES.find(g=>g.label===label)?.threshold??0;
}
function makeFighter(s: SimGame,team: 0|1,slot: number,count: number,control: boolean,careers: ArcadeOptions["careers"],startingRanks: ArcadeOptions["startingRanks"]): SimFighter {
  const id=`${team}-${slot}` as const;
  const hero=s.heroLineup[id]??null;
  const supplied=careers?.[id]??careers?.[team]?.[slot];
  const side=startingRanks?.[team]??(startingRanks as Exclude<typeof startingRanks, readonly unknown[]> | undefined)?.[team===0?'blue':'red'];
  const career=progressionSummary(hero?startingMerit('SSS+V'):supplied??startingMerit(Array.isArray(side)?side[slot]:side));
  const skill=combatSkillProfile(career);
  const archetype: SimFighter['archetype'] = control ? s.playerArchetype : count===1 ? (team===0?'vanguard':'duelist') : (['vanguard','duelist','warden'] as const)[slot%3];
  const preset=s.config.teamForms[team];
  const explicit=typeof preset==='string'?preset:preset?.[slot]??null;
  const picked=Object.hasOwn(ARCADE_FORMS,explicit!)?explicit:null;
  const lead=team===0&&slot===((s.mode==='watch'||s.mode==='command')?0:s.config.playerSlot);
  const form=(hero?.form??(s.formRules?(picked??(lead&&explicit!=='mixed'?s.playerForm:ARCADE_FORM_IDS[(s.round-1+team*3+slot+(team===1&&count===1?1:0))%ARCADE_FORM_IDS.length])):legacyForm[archetype])) as SimFighter['form'];
  const injuries=createArcadeInjuries();
  const injuryEffects=arcadeInjuryModifiers(injuries);
  const body=(hero?.body??(lead?s.playerBody:(team+slot+s.round)%2===0?'woman':'femboy')) as SimFighter['body'];
  const visualKey=hero?.id??`roster:${s.weatherSeed}:${id}`;
  const gender=fighterGender(hero?.gender,body,visualKey),appearanceSeed=hero?.appearanceSeed??appearanceSeedFor(visualKey);
  const gear=hero?arcadeFighterGear({
    startingSaberWeapon:[hero.weapon],startingSaberGrip:[hero.grip],startingDualPhase:[hero.dualPhase],
    startingForceFamily:[hero.forceFamily]
  },0):arcadeFighterGear(s.config,team);
  const [x,y]=spawnPosition(s,team,slot,count);
  const initial: Omit<SimFighter,'rankDominance'>={id,team,control,slot,archetype,form,body,gender,appearanceSeed,career,skill,rankCombat:ARCADE_RANK_COMBAT[career.gradeIndex],moves:{},gear,weaponFlow:s.config.weaponFlow===true,expandedCombat:s.config.expandedCombat===true,circuitCuts:s.config.circuitCuts===true,heroId:hero?.id,displayName:hero?.name,heroDoctrine:hero?.doctrine,
    ...(hero?{...(hero.preferredMove?{tournamentMove:hero.preferredMove}:{}),heroPlan:hero.doctrine,heroAdaptation:normalizeHeroTactics((('heroAdaptation' in hero ? hero.heroAdaptation : undefined)??hero.adaptation) as Parameters<typeof normalizeHeroTactics>[0]),
      heroElo:finite(hero.elo)?hero.elo:undefined,heroEloFloorGrade:hero.eloFloorGrade??('heroEloFloorGrade' in hero ? hero.heroEloFloorGrade as string|undefined : undefined)}:{}),formRules:s.formRules||Boolean(hero),x,y,face:team===0?0:Math.PI,
    vx:0,vy:0,kx:0,ky:0,radius:17,groundDistance:0,groundSpeed:0,alive:true,injuries,injuryEffects,saberPhase:'short',
    energy:100,action:'idle',actionTime:0,actionDuration:0,attack:null,attackSpec:null,contact:false,offhandContact:false,technique:null,counterUntil:0,guardLane:'center',guardBearing:null,combo:0,
    parryTime:0,invuln:0,guardLock:0,airborne:0,airArc:null,airPhase:'grounded',airHeight:0,airProgress:0,airTime:0,airDuration:0,think:.09+slot*.11,decision:null,buffer:null,guardHeld:false,stats:roundStats(),contributors:[],targetId:null,targetUntil:0,counterMove:false};
  // The first authoritative tick fills rankDominance before any fighter acts.
  return initial as SimFighter;
}
export function createArcade({mode='duel',seed=1,width=1120,height=640,archetype='vanguard',form,body='femboy',round=1,motionFlow,records,careers,startingRanks,teamSizes,limit,playerSlot,teamForms,saberOnly=false,terrain,doctrines,targeting,formations,rule,weather,environment,deployments,startingSaberQuality,startingDualSabers,startingSaberWeapon,startingSaberGrip,startingDualPhase,startingForceFamily,startingForceQuality,heroLineup,customHeroTactics=false,advancedArena=false,weaponFlow=false,expandedCombat=false,ratingSkill=false,arenaRatingSkill=false,sideElo,fighterRatings,matchGoalPlanning=false,circuitCuts=false,soloTournamentClock=false,chessStyles,fighterChessStyles,perfectParryStamina=false,continuousCombat=false,anticipatingCombat=false,arenaCuts=false,activeFootwork=false,styleTravel=false,repertoireSupport=false,styleChoreo=false,peasantMotion=false,exchangeVariety=false,stanceFlow=false,impactPhysics=false,recoveryFlow=false,balancePass=false,closeChoice=false,guardCounterplay=false,squadDecisive=false,squadTactics=false,minorMoves=false,forceVariants=false,liveEntry=false,eloReads=false,fluidFootwork=false}: ArcadeOptions={}){
  mode=['duel','squad','watch','command'].includes(mode)?mode:'duel';
  width=clamp(finite(width)?width:1120,480,2400);height=clamp(finite(height)?height:640,360,1440);
  const stringSeed=typeof seed==='string'?Array.from(seed).reduce((n,c)=>Math.imul(n^c.codePointAt(0)!,16777619),-2128831035):Number(seed);
  const hasForm=Object.hasOwn(ARCADE_FORMS,form!);
  const formRules=hasForm||Array.isArray(teamForms);
  const fallback=mode==='duel'?1:3;
  const sizes: [number,number]=[teamSize(teamSizes?.[0],fallback),teamSize(teamSizes?.[1],fallback)];
  const map=terrainFor(typeof terrain==='string'&&terrain!=='open'?createArcadeTerrain(terrain,width,height,round):terrain,width,height);
  const config=buildArcadeConfig({motionFlow,startingSaberQuality, startingDualSabers, startingSaberWeapon, startingSaberGrip, startingDualPhase, startingForceFamily, startingForceQuality, limit, soloTournamentClock, rule, circuitCuts, matchGoalPlanning, weaponFlow, expandedCombat, customHeroTactics, advancedArena, playerSlot, teamForms, saberOnly, doctrines, targeting, formations, weather, environment, deployments, chessStyles, fighterChessStyles, perfectParryStamina, continuousCombat, anticipatingCombat, arenaCuts, activeFootwork, styleTravel, repertoireSupport, styleChoreo, peasantMotion, exchangeVariety, stanceFlow, impactPhysics, recoveryFlow, balancePass, closeChoice, guardCounterplay, minorMoves, forceVariants, liveEntry, eloReads, ratingSkill, fluidFootwork, arenaRatingSkill},mode,sizes);
  const s: SimGame={mode:mode as SimGame['mode'],width,height,formRules,config,heroLineup:normalizeHeroLineup(heroLineup),terrain:map,playerForm:(hasForm?form:legacyForm[archetype as keyof typeof legacyForm]??'shii_cho') as SimGame['playerForm'],playerBody:['woman','rabbit'].includes(body)?body as SimGame['playerBody']:'femboy',time:0,round:Number.isInteger(round)&&round>0?round:1,phase:'playing',fighters:[],events:[], /* simulation arrays are populated below */eventId:0,
    bounds:map.bounds,objective:createArcadeObjective(config.rule,width,height,map.bounds),order:'push',weather:null,weatherSeed:stringSeed>>>0,
    rng:(stringSeed>>>0)||1, playerArchetype:Object.hasOwn(archetypes,archetype)?archetype as SimGame['playerArchetype']:'vanguard',edges:{},limit:config.limit,tick:0,
    stats:Object.fromEntries(ARCADE_STAT_KEYS.map(k=>[k,[0,0]])) as SimGame['stats'],records:{teams:[record(records?.teams?.[0]),record(records?.teams?.[1])],soldiers:[]},
    pressure:mode==='watch'||!Number.isInteger(round)?0:clamp((round-1)/9,0,1)};
  for(const team of [0,1] as const)for(let i=0;i<sizes[team];i++)s.fighters.push(makeFighter(s,team,i,sizes[team],team===0&&i===config.playerSlot&&mode!=='watch'&&mode!=='command',careers,startingRanks));
  s.weather=environmentAt(config.weather,s.weatherSeed,0);
  for (const f of s.fighters) {
    if(config.chessStyles||config.fighterChessStyles){
      const chessStyle=config.fighterChessStyles?.[f.team]?.[f.slot]??
        arcadeChessStyleFor(config.chessStyles?.[f.team],f.slot,(stringSeed>>>0)||1);
      if(chessStyle!=='none'){
        f.chessStyle=chessStyle;
        if(config.anticipatingCombat&&!f.control)f.chessBaseStyle=chessStyle;
      }
    }
    if(ratingSkill===true||config.matchGoalPlanning||config.arenaRatingSkill){
      const sample=f.heroElo??fighterRatings?.[f.team]?.[f.slot]??sideElo?.[f.team];
      if(config.arenaRatingSkill)f.arenaReadSkill=arenaReadSkill(sample);
      else if(ratingSkill===true)f.eloSkill=arcadeEloSkill(sample,true);
      if(config.matchGoalPlanning){f.matchGoal='win';f.matchGoalSince=0;f.matchGoalRating=finite(sample)?sample:1500;}
    }
    if(config.continuousCombat)f.continuousCombat=true;
    if(config.styleTravel)f.styleTravel=true;
    if(config.motionFlow?.styleTurns??config.styleChoreo)f.styleChoreo=true;
    if(config.motionFlow?.stanceFollowThrough??config.stanceFlow)f.stanceFlow=true;
    if(config.impactPhysics)f.impactPhysics=true;
    if(config.motionFlow?.impactRecovery??config.recoveryFlow)f.recoveryFlow=true;
    if(config.motionFlow?.movingEntries??config.liveEntry)f.liveEntry=true;
    if(config.motionFlow?.plantFeet??config.peasantMotion){f.peasantMotion=true;f.groundPace=0;f.groundBearing=f.face;f.landedAt=-Infinity;}
    f.spawn={x:f.x,y:f.y};
    f.loadoutChosen=Boolean(f.heroId)||Array.isArray(startingForceFamily)||Array.isArray(startingForceQuality);
    const prior=Array.isArray(records?.soldiers)?records.soldiers.find(r=>r?.id===f.id&&r.team===f.team&&r.slot===f.slot):null;
    s.records.soldiers.push({id:f.id,team:f.team,slot:f.slot,lane:f.slot,...record(prior)});
  }
  // Solo against at least three equally ranked masters. Only bots use the
  // coordination; a controlled fighter keeps all of their normal inputs.
  s.eliteCrossfire=mode!=='command'&&config.rule==='elimination'&&Math.min(...sizes)===1&&
    Math.max(...sizes)>=3&&s.fighters.every(f=>f.career.gradeIndex===14);
  const decisiveSquad=squadDecisive===true&&mode==='watch'&&sizes.every(n=>n===5);
  // Organized squads: off unless asked for, never in duels, so rated play and old replays stay unchanged.
  // The key is only added when on, so state hashes of every existing mode stay byte-identical.
  // Never with Arena Elo: a rated setup stays byte-identical even if the flag is passed by mistake.
  if(squadTactics===true&&arenaRatingSkill!==true&&mode!=='duel'&&sizes.some(n=>n>1))s.squadTactics={next:0,plans:[null,null],since:[0,0]};
  s.elitePacing=config.rule==='elimination'&&sizes[0]===sizes[1]&&s.fighters.every(f=>f.career.grade==='SSS+V') ?
    {active:true,stage:'measured',fullAt:decisiveSquad?.47:.91,measuredUntil:decisiveSquad?.24:.81,
      ...(decisiveSquad?{injuryCapUntil:.32}:{})} : null;
  return s;
}

function releaseThreat(attacker: SimFighter,victim: SimFighter,now: number,frontOnly: boolean=false){
  const move=atk(attacker);
  if(!move)return false;
  const dx=victim.x-attacker.x,dy=victim.y-attacker.y,angle=Math.atan2(dy,dx);
  if(frontOnly&&Math.abs(angleDelta(angle+Math.PI,victim.face))>1.27)return false;
  const isThreat=(blade: BladeCast|undefined,released: boolean,turn: number=0)=>{
    if(!blade||released)return false;
    const time=blade.contact-attacker.actionTime;
    return time>0&&time<now&&dx*dx+dy*dy<=(blade.reach+27)**2&&Math.abs(angleDelta(angle,attacker.face+turn))<blade.arc+.17;
  };
  return isThreat(move,attacker.contact)||
    isThreat(move.offhand,attacker.offhandContact,(move.offhand?.backLane??move.offhand?.blade==='rear')?Math.PI:0);
}
function rememberAttacker(s: SimGame,f: SimFighter,hostile: SimFighter,from: number){
  if(f.control||!f.alive||Math.abs(angleDelta(from,f.face))<1.12)return;
  // Don't reset the reaction clock under a flurry from the same source.
  const prior=f.rearHit;
  const delay=.27-f.career.gradeIndex*.0075;
  f.rearHit={id:hostile.id,readyAt:prior?.id===hostile.id&&prior.expires>s.time?prior.readyAt:s.time+delay,expires:s.time+1.48};
}
function nearest(s: SimGame,f: SimFighter){
  let best=null,score=Infinity;
  const policy=f.control?'nearest':s.config.targeting[f.team];
  for(const o of s.fighters)if(o.team!==f.team&&o.alive){
    const d=Math.hypot(o.x-f.x,o.y-f.y);
    if(!f.control&&d>s.weather!.sightRange)continue;
    const injury=policy==='weakest'?o.injuryEffects.moveSpeed*45+o.injuryEffects.guardEfficiency*65:0;
    const value=d+(policy==='weakest'?injury:policy==='objective'?Math.hypot(o.x-s.width*.5,o.y-s.height*.5)*.29:0);
    if(value<score){score=value;best=o;}
  }
  f.awarenessFacing=false;
  if(f.control||!best)return best;
  const memory=f.rearHit;
  if(memory&&s.time>=memory.readyAt&&s.time<memory.expires&&!atk(f)){
    const remembered=s.fighters.find(o=>o.id===memory.id&&o.alive&&o.team!==f.team);
    if(remembered&&Math.hypot(remembered.x-f.x,remembered.y-f.y)<Math.min(253,s.weather!.sightRange)&&
       !blockedBetween(s,f.x,f.y,remembered.x,remembered.y)){
      const front=s.fighters.find(o=>o.alive&&o.team!==f.team&&o.id!==remembered.id&&releaseThreat(o,f,.21,true)&&
        !blockedBetween(s,f.x,f.y,o.x,o.y));
      if(front)return front;
      f.targetId=remembered.id;f.targetUntil=s.time+.22;f.awarenessFacing=true;return remembered;
    }
  }
  const old=s.fighters.find(o=>o.id===f.targetId&&o.alive);
  if(old&&s.time<f.targetUntil&&Math.hypot(old.x-f.x,old.y-f.y)<=Math.min(s.weather!.sightRange,score*1.55+25))return old;
  f.targetId=best.id;f.targetUntil=s.time+.48;
  return best;
}
function turnForAttack(f: SimFighter,to: number){if(finite(to))f.face=to;}
function expose(s: SimGame,f: SimFighter,reason: string,seconds: number){
  f.exposedBy=reason;f.exposedUntil=s.time+seconds;
  if(s.elitePacing){
    f.recentMistakes=(f.recentMistakes??[]).filter(t=>t>s.time-7).slice(-5);
    f.recentMistakes.push(s.time);
  }
}
const saberReachInLongPhase=(reach:number)=>26+Math.max(0,reach-26)*1.26;
function changeSaberPhase(s: SimGame,f: SimFighter,desired: SimFighter["saberPhase"]){
  if(!f.gear.dualPhase||!f.alive||f.saberPhase===desired||f.saberPhaseReadyAt!>s.time||
      f.actionDuration>0||!['idle','walk','run'].includes(f.action)||f.energy<11)return false;
  f.energy=Math.max(0,f.energy-(desired==='long'?5:2));
  f.saberPhase=desired;
  f.saberPhaseChangedAt=s.time;
  f.saberPhaseReadyAt=s.time+1.15;
  countMove(f,'phase_'+desired);
  const geometry=arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
  event(s,'saber_phase',f,undefined,undefined,{phase:desired,
    contactX:geometry.hand?.x,contactY:geometry.hand?.y,blades:geometry.blades??[{id:'main',hand:geometry.hand,tip:geometry.tip}]});
  return true;
}
function isFeintable(f: SimFighter){
  const move=atk(f);
  return move&&f.action!=='force'&&!f.contact&&f.actionTime<move.contact*.56&&!f.airArc&&f.airPhase==='grounded';
}
function beginFeint(s: SimGame,f: SimFighter,bearing: number,followup: string | null=null,redirect: number | null=null){
  if(!f.alive||f.energy<12||f.guardLock>0||f.feintReadyAt!>s.time||
    (f.actionDuration>0&&!isFeintable(f))||!spend(f,6))return false;
  f.attack=null;f.attackSpec=null;f.combo=0;f.technique='feint';f.buffer=null;
  f.feintBearing=bearing;f.feintRedirect=redirect;f.feintFollowup=followup;f.feintReadyAt=s.time+2.8;
  f.feintSerial=(f.feintSerial??0)+1;turnForAttack(f,bearing);
  setAction(f,'feint',.34);countMove(f,'feint');credit(s,f,'feints');
  event(s,'feint',f,undefined,undefined,{feintBearing:bearing,...(s.config.balancePass&&followup==='ex_mk_false_line'?{feintFollowup:followup}:{})});return true;
}
function trakataEvent(s: SimGame,f: SimFighter,kind: string,extra: Record<string,unknown>={}){
  const w=arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
  event(s,kind,f,undefined,undefined,{contactX:w.hand.x,contactY:w.hand.y,blades:w.blades,...extra});
}
function beginTrakata(s: SimGame,f: SimFighter,bearing: number){
  if(!f.heroId||!f.alive||f.saberOff||f.airArc||f.airPhase!=='grounded'||f.guardLock>0||
     (f.trakataReadyAt??0)>s.time||(f.actionDuration>0&&!isFeintable(f))||!spend(f,23))return false;
  const pose=entryPose(s,f,'guard'),fake=bearing+(f.slot%2===0?.36:-.36);
  f.attack=null;f.attackSpec=null;f.contact=true;f.offhandContact=true;f.combo=0;f.buffer=null;
  f.technique=ARCADE_TRAKATA_ID;f.feintBearing=fake;f.feintFollowup=null;f.feintRedirect=null;
  f.feintReadyAt=Math.max(f.feintReadyAt??0,s.time+.48);
  f.feintSerial=(f.feintSerial??0)+1;f.trakataReadyAt=s.time+7.4;f.trakataAim=bearing;
  f.saberOff=true;
  turnForAttack(f,fake);setAction(f,'feint',.43);
  f.poseFrom=pose;f.poseEntryDuration=.095;
  countMove(f,ARCADE_TRAKATA_ID);credit(s,f,'feints');
  expose(s,f,ARCADE_TRAKATA_ID,.20);
  trakataEvent(s,f,'trakata_off');
  return true;
}
function relightTrakata(s: SimGame,f: SimFighter,interrupted: boolean=false){
  if(!f.saberOff)return;
  f.saberOff=false;f.trakataIgnitedAt=s.time;
  trakataEvent(s,f,'trakata_on',{interrupted});
}
function guardSource(victim: SimFighter,from: number,spec: SimMove){
  const left=angleDelta(from,victim.guardBearing??victim.face);
  // Actual grip and emitter can subtly move the attacking line. This never
  // swings a blade through an ally or overrides world contact geometry.
  const bladeOffset=(spec.backLane??spec.blade==='rear')?-.11:spec.isOffhand?-.18:(spec.bladeTurn??0)*.6;
  return left+bladeOffset;
}
function confirmGuardRead(s: SimGame,victim: SimFighter,attacker: SimFighter,x: number,y: number,kind: string){
  const serial=attacker.id+':'+(attacker.attackSerial??s.tick);
  if(!victim.guardDirected||victim.lastReadSerial===serial)return;
  victim.lastReadSerial=serial;
  credit(s,victim,'guardReads');countMove(victim,'guard_read');
  event(s,'read',victim,x,y,{targetId:attacker.id,guardLane:victim.guardLane,
    guardBearing:victim.guardBearing,readKind:kind,contactY:y-38-victim.airHeight});
}
const authoringLateral=(move: SimMove | null | undefined)=>move?.tactical==='slip_counter'||move?.tactical==='moving_guard';
function entryPose(s: SimGame,f: SimFighter,kind: string): NonNullable<SimFighter["poseFrom"]>{
  const rig=sampleArcadeFighter(f,s.time), world: BladeWorld=arcadeBladeWorld(f,rig);
  let momentum=(f.styleChoreo||f.peasantMotion||f.liveEntry)&&f.actionTime===0?f.poseFrom?.momentum:undefined;
  if((f.styleChoreo||f.peasantMotion||f.liveEntry)&&f.airPhase==='grounded'&&f.actionTime>0&&
      (f.peasantMotion||kind==='live_entry'||['chain','weapon_flow','weapon_recover','guard','guard_recover','counter','staff','force_recover'].includes(kind))){
    const sample=Math.min(1/120,f.actionTime);
    const past={...f,actionTime:f.actionTime-sample};
    const prev: BladeWorld=arcadeBladeWorld(past,sampleArcadeFighter(past,s.time-sample));
    const rate=(a: BladeSegment|undefined,b: BladeSegment|undefined)=>{
      if(!a?.hand||!b?.hand)return null;
      const yaw=(o: BladeSegment)=>Math.atan2(o.tip.y-o.hand.y,o.tip.x-o.hand.x);
      const dx=(b.hand.x-a.hand.x)/sample,dy=(b.hand.y-a.hand.y)/sample;
      const k=Math.min(1,380/(Math.hypot(dx,dy)||1));
      return {x:dx*k,y:dy*k,angle:clamp(angleDelta(yaw(b),yaw(a))/sample,-12,12)};
    };
    momentum={main:rate(prev,world),offhand:rate(prev.offhand,world.offhand)};
  }
  return {...(momentum?{momentum}:{}),hand:world.hand,tip:world.tip,offhand:world.offhand,freeHand:world.freeHand,
    legs:f.peasantMotion||kind==='live_entry'||kind==='dash'||kind==='dash_recover'||kind==='force_recover'||kind==='weapon_recover'?arcadeFeetWorld(f,rig):undefined,
    origin:{x:f.x,y:f.y},facing:f.face,
    body:{lean:rig.lean,bend:rig.bend,wide:rig.wide,torsoTurn:rig.torsoTurn,...(f.stanceFlow?{roll:rig.roll,airPhase:rig.airPhase,airProgress:f.airProgress,attackFamily:rig.attackFamily}:{}),...(f.liveEntry?{rhythm:rig.rhythm,roll:rig.roll}:{})},kind};
}
const chainLimit=(f: SimFighter)=>f.formRules?(f.form==='juyo'?4:f.career.gradeIndex>=12?3:2):3;
function chainWindow(s: SimGame,f: SimFighter,move: SimMove){
  if(contactChainApplies(s.config.motionFlow,f,move))return contactChainOpen(s.config.motionFlow,f,move);
  const threshold=s.elitePacing?.83:f.form==='juyo'?.71:.78;
  return f.action!=='force'&&f.airPhase!=='airborne'&&(!move.airStrike||f.airPhase==='grounded')&&
    f.actionTime>=Math.max(move.contact+.105,(move.offhand?.contact??0)+.041,move.duration*threshold);
}
// Each grip exchanges recovery for reach or a second live release.
// A new rig can move faster between these timings without inventing contact.
function weaponFlowTiming(f: SimFighter,move: SimMove){
  const reverse=f.gear.grip==='backhand',staff=f.gear.weapon==='staff',dual=f.gear.weapon==='dual';
  const training=f.career.gradeIndex/14;
  const windScale=staff?.98:dual?reverse?.94:.935:reverse?.89:.96;
  const recoverScale=staff?1.06:dual?reverse?1.08:1.04:reverse?.88:.91;
  const rankFlow=1-training*(staff?.026:dual?.040:.060);
  const contact=move.contact*windScale;
  const duration=contact+(move.duration-move.contact)*recoverScale*rankFlow;
  const offhand=move.offhand?{...move.offhand,contact:staff?contact:contact+(reverse?.088:.072)-training*.009}:undefined;
  const reach=move.reach*(staff?1:dual?1:reverse?.98:1.025);
  const cost=move.cost*(staff?1.04:dual?1.035:reverse?1.02:.97);
  return {...move,contact,duration:Math.max(duration,(offhand?.contact??contact)+(dual?.061:.078)),offhand,reach,cost};
}
function expandedMove(s: SimGame,f: SimFighter,id: string | null | undefined){
  const move=s.config.expandedCombat?arcadeExpandedMoveById(id!,{forceVariants:s.config.forceVariants===true}):null;
  if(!move||s.config.saberOnly||move.minRank>f.career.gradeIndex)return null;
  if(move.kind==='free_hand'&&f.gear.weapon==='dual')return null;
  return move;
}
function startExpanded(s: SimGame,f: SimFighter,id: string | null | undefined,bearing: number){
  const move=expandedMove(s,f,id);
  if(!move||!f.alive||f.saberOff||f.actionDuration>0||f.airArc||f.airPhase!=='grounded'||f.guardLock>0||
    (f.expandedReadyAt??0)>s.time||!spend(f,move.cost))return false;
  const force=move.kind==='force',action=force?'force':'free_hand';
  const pose=entryPose(s,f,'weapon_flow'),strength=force?f.injuryEffects.forcePower:f.injuryEffects.saberPower;
  const skill=f.career.gradeIndex/14;
  const contact=move.contact*(1-skill*.04);
  const spec={...move,contact,duration:contact+(move.duration-move.contact)*(1-skill*.06),
    damage:move.damage*strength,lunge:(move as {lunge?:number}).lunge??(force?0:58),freeHand:!force,expanded:true};
  f.attack=id!;f.attackSpec=spec;f.technique=id!;f.contact=false;f.offhandContact=true;f.combo=0;
  f.counterMove=false;f.releaseOutcome=null;f.buffer=null;f.chainDepth=1;
  if(s.config.motionFlow)f.motionLinkedHit=false;if(s.config.motionFlow?.blockRebound)f.motionLinkedBlock=false;f.invuln=0;f.face=bearing;
  f.attackFamily=force?'cast':'cut';f.attackVariant='center';
  f.attackSerial=s.eventId+1;f.expandedReadyAt=s.time+(f.control?1.05:4.6);
  if(force){credit(s,f,'forceCasts');f.lastForceAt=s.time;}else countMove(f,'unarmed_swings');
  countMove(f,id!);setAction(f,action,spec.duration);
  f.poseFrom=pose;f.poseEntryDuration=Math.min(.08,contact*.40);
  event(s,action,f,undefined,undefined,{expanded:true,effect:move.effect,freeHand:!force,
    contact,duration:spec.duration});
  return true;
}
function liveGroundEntry(f: SimFighter,bearing: number,move: SimMove,authored: Technique | null | undefined,excluded: boolean){
  if(!f.liveEntry||excluded||!finite(bearing)||f.actionDuration!==0||
     f.airArc||f.airPhase!=='grounded'||!(neutralAction(f.action)||f.action==='guard')||
     move.contact<.095||authored?.air||authored?.tactical==='moving_guard')return null;
  const vx=f.vx,vy=f.vy,speed=Math.min(Math.hypot(vx,vy),f.groundSpeed??0);
  const forward=vx*Math.cos(bearing)+vy*Math.sin(bearing), side=vy*Math.cos(bearing)-vx*Math.sin(bearing);
  const turn=Math.abs(angleDelta(bearing,f.face));
  const kind=f.action==='guard'?'guard':speed>=23?
    (Math.abs(side)>Math.abs(forward)*.87?'lateral':forward>=0?'advance':'retreat'):
    turn>=.22?'pivot':null;
  return kind?{kind,vx,vy,bearing,side:Math.sign(side),groundDistance:f.groundDistance}:null;
}
function attack(s: SimGame,f: SimFighter,name: string,to: number,{redirected=false,linked=false}: {redirected?: boolean; linked?: boolean}={}){
  if(f.saberOff)return false;
  if(name==='force'&&s.config.saberOnly)name='wide_cut';
  const authored=ARCADE_TECHNIQUES[name!];
  const airCut=ARCADE_AIR_ATTACKS[name];
  const base: SimMove|undefined=authored??attackByName(name)??airCut;
  if(airCut&&(!f.jumpKind||f.action!=='jump'||f.airPhase!=='airborne'||f.airStrikeSpent))return false;
  if((authored&&(authored.form!==f.form||authored.minRank>f.career.gradeIndex||authored.circuitCut&&!s.config.circuitCuts||authored.arenaCut&&!s.config.arenaCuts||authored.exchangeCut&&!s.config.exchangeVariety||authored.minorMove&&!s.config.minorMoves))||!base||f.guardLock>.005)return false;
  if(authored?.tactical==='feint_redirect'&&!redirected){
    const dir=finite(to)?to:f.face,shift=(f.slot%2===0?1:-1)*.48;
    return beginFeint(s,f,dir+shift,name,dir);
  }
  const forceMove=name==='force'||authored?.mapAction==='force';
  if(forceMove&&s.config.saberOnly)return false;
  const def=profile(f);
  const counter=(name==='riposte'||authored?.role==='counter')&&f.counterUntil>s.time;
  const riposteSource=counter?f.counterTarget:null;
  let move: SimMove=f.formRules&&name.startsWith('slash')?{...base,duration:base.duration*def.tempo!,contact:base.contact*def.tempo!,
    arc:base.arc*def.arc!,reach:base.reach*def.reach!,damage:base.damage+(f.form==='juyo'?2:0)}
    :counter&&!authored?{...base,duration:.39,contact:.165,cost:19,damage:40,lunge:475,recoil:.37}:base;
  if(f.formRules&&styleTimings[name as keyof typeof styleTimings]) {
    const [duration,contact,lunge]=counter?quickCounter:styleTimings[name as keyof typeof styleTimings];
    const pace=name.startsWith('slash')?def.tempo!:1;
    move={...move,duration:duration*pace,contact:contact*pace,lunge};
  }
  if(f.career.gradeIndex>0) {
    // Keep the form's clear telegraph while letting stronger careers recover
    // sooner and use less energy. No random hit bonus: geometry remains decisive.
    const contact=move.contact*(1-(f.formRules?.08:.15)*f.skill.skill);
    move={...move, contact, duration:contact+(move.duration-move.contact)*f.career.modifiers.reloadMultiplier,
      cost:move.cost*(1-.22*f.skill.skill)};
  }
  const train=f.rankCombat;
  if(train.index>=9&&!forceMove){
    const weak=s.fighters.filter(e=>e.alive&&e.team!==f.team&&rankGap(f,e)>=6&&Math.hypot(e.x-f.x,e.y-f.y)<185).length;
    if(weak>=2){
      const sweeping=authored?.role==='crowd'||name==='wide_cut'||name==='frenzy'||name==='sweep';
      move={...move,arc:Math.min(2.89,move.arc+(sweeping?.99:.48)*train.index/14),
        reach:move.reach+(sweeping?33:19)*train.index/14,rankSweep:sweeping||train.index>=13&&name.startsWith('slash')};
    }
  }
  move=arcadeGearMove(f.gear,forceMove?'force':name,move) as SimMove;
  if(authored?.forceAbility)move={...move,forceAbility:authored.forceAbility};
  if(!forceMove&&f.gear.grip==='backhand'){
    // The tip trails the wrist. Commit nearer, recover sooner and cover
    // more of the wrist-side arc instead of gaining phantom forward reach.
    move={...move,reach:move.reach*.88,arc:Math.min(2.75,move.arc+.20),
      duration:move.contact+(move.duration-move.contact)*.91,
      damage:move.damage*.96,offhand:move.offhand?{...move.offhand,reach:move.offhand.reach*.88,arc:Math.min(2.75,move.offhand.arc+.18)}:undefined};
  }
  if(!forceMove&&f.gear.weapon==='staff'){
    // One rigid shaft, two physical emitters. Each new commitment presents
    // the other end along the live attack lane; only the lane is exchanged.
    const lead=(f.staffCommitments??0)%2===0?'primary':'rear';
    const trailing: NonNullable<BladeCast['blade']>=lead==='primary'?'rear':'primary';
    const farEnd={contact:move.contact,damage:move.damage*.74,reach:Math.min(101,move.reach*.79),
      arc:Math.min(1.47,Math.max(.94,move.arc*.74)),knock:move.knock*.68,recoil:move.recoil*.80,
      blade:trailing,backLane:true};
    move={...move,reach:move.reach*.95,damage:move.damage*.94,arc:Math.min(1.57,move.arc),
      cost:move.cost*1.12,staff:true,leadBlade:lead==='primary'?'main':'rear',blade:lead,backLane:false,offhand:farEnd};
  }
  if(!forceMove&&f.weaponFlow)move=weaponFlowTiming(f,move);
  if(!forceMove&&f.gear.dualPhase&&f.saberPhase==='long'){
    move={...move,reach:saberReachInLongPhase(move.reach),cost:move.cost*1.16,
      duration:move.contact+(move.duration-move.contact)*1.12,
      offhand:move.offhand?{...move.offhand,reach:saberReachInLongPhase(move.offhand.reach)}:undefined};
  }
  const strength=forceMove?f.injuryEffects.forcePower:f.injuryEffects.saberPower;
  move={...move,damage:move.damage*strength,offhand:move.offhand?{...move.offhand,damage:move.offhand.damage*strength}:undefined};
  if(f.rankDominance>=8)move={...move,cost:move.cost*(1-.39*masteryRatio(f.rankDominance))};
  if(linked)move={...move,cost:move.cost*(1+.069*(f.chainDepth??1))};
  if(f.chessStyle&&!forceMove){
    const options={grade:f.career.gradeIndex,promoted:f.chessPawn?.promoted===true};
    move={...arcadeChessMove(f.chessStyle,move,options),chessPromoted:options.promoted,
      ...((s.config.anticipatingCombat||f.styleChoreo)?{chessStyle:f.chessStyle}:{})};
  }
  const prior=atk(f);
  // A paid form jump can carry a normal follow-up without buying another
  // launch or replaying its named special. Finish every emitter within the
  // original movement arc; a longer follow-up waits to be grounded.
  const airCarry=Boolean(s.config.motionFlow&&linked&&f.airPhase!=='grounded'&&f.airArc?.kind&&prior&&
    contactChainOpen(s.config.motionFlow,f,prior));
  if(airCarry&&(forceMove||airCut||name==='vault'||authored?.air||Math.max(move.contact,move.offhand?.contact??0)+.012>f.airDuration-f.airTime))return false;
  if(!spend(f,move.cost))return false;
  finishChessPawn(f);
  const previous=linked?f.attack:null;
  if(s.config.continuousCombat&&!forceMove)f.attackDrive={x:f.vx,y:f.vy};
  const staffTransfer=move.staff&&f.staffLead!==undefined&&f.staffLead!==move.blade;
  const live=liveGroundEntry(f,to,move,authored,forceMove||linked||Boolean(airCut));
  const landingEntry=f.stanceFlow&&f.action==='jump'&&f.airPhase==='landing';
  const pose=airCut||landingEntry||airCarry?entryPose(s,f,'air'):linked?entryPose(s,f,'chain'):live?entryPose(s,f,'live_entry'):counter?entryPose(s,f,'counter'):
    staffTransfer?entryPose(s,f,'staff'):f.weaponFlow&&!forceMove?entryPose(s,f,'weapon_flow'):null;
  if(move.staff){f.staffLead=move.blade;f.staffCommitments=(f.staffCommitments??0)+1;}
  f.chainDepth=linked?(f.chainDepth??1)+1:1;
  f.chainRepeat=linked&&previous===name?(f.chainRepeat??0)+1:0;
  f.chainFrom=previous;
  f.chainCarryUntil=linked?s.time+move.contact:0;
  if(linked)countMove(f,'chain_follow');
  const impactPlan=f.recoveryFlow&&!linked?f.impactRecovery:undefined;
  const recoveryFollowup=impactPlan?.followup===name&&impactPlan.serial===f.attackSerial&&
    s.time-impactPlan.at<impactPlan.duration+.33?impactPlan.kind:null;
  if(recoveryFollowup)countMove(f,'recovery_reentry');
  f.airStrike=airCut?.id??null;
  if(airCut){f.airStrikeSpent=true;f.airRequest=null;}
  if(counter){f.counterUntil=0;f.parryCounterUntil=0;}
  f.riposteTarget=riposteSource;
  if(authoringLateral(authored)){
    const turn=(f.slot%2===0?1:-1)*(authored.tactical==='slip_counter'?.62:.78);
    const direction=(finite(to)?to:f.face)+turn;
    f.stepBearing=direction;f.stepUntil=s.time+(authored.tactical==='slip_counter'?.21:.34);
    if(authored.tactical==='moving_guard'){
      f.guardBearing=finite(to)?to:f.face;f.guardLane=turn>0?'right':'left';f.guardDirected=true;
    }
  }else f.stepUntil=0;
  f.counterMove=counter;f.lastOpponentMove=name;
  const attackView=arcadeAttackPresentation(name,authored??airCut,airCut?.action??authored?.mapAction??art(name));
  f.attackFamily=attackView.family;f.attackVariant=attackView.variant;
  f.attackChoices=[...(f.attackChoices??[]).slice(-3),{id:name,family:attackView.family}];
  credit(s,f,forceMove?'forceCasts':'saberSwings');countMove(f,name);
  if(forceMove)f.lastForceAt=s.time;
  if(!live)turnForAttack(f,to); f.attack=name;f.attackSpec=move;f.technique=name;f.contact=false;f.offhandContact=false;f.buffer=null;f.attackSerial=s.eventId+1;f.staffTouched=null;f.staffLanded=false;f.releaseOutcome=null;
  if(s.config.motionFlow){f.motionLinkedHit=false;f.motionAirCarry=airCarry;}
  if(s.config.motionFlow?.blockRebound)f.motionLinkedBlock=false;
  if(live){
    f.liveAim={serial:f.attackSerial,base:f.face,target:to,until:Math.max(0,move.contact-.031)};
    if(pose)pose.stride=live;
  }
  if(f.chessStyle==='pawn'&&!forceMove)f.chessPawnPending=f.attackSerial;
  if(f.eliteEngaged&&!f.control){
    const tactical=s.elitePacing?(1-pacingLift(s))*(.30+(s.limit-45)*.0045):-(f.eliteRankEdge??0)*.075;
    if(s.config.anticipatingCombat)f.eliteReady=s.time+move.duration+clamp((.16+rng(s)*.28+tactical)*.44,.13,.42);
    else f.eliteReady=s.time+move.duration+.16+rng(s)*.28+tactical;
  }
  f.combo=name==='slash4'?4:name==='slash3'?3:name==='slash2'?2:name==='slash'?1:0;
  if(name==='vault'||authored?.air)startAir(f,aerialArcs[authored?.air as keyof typeof aerialArcs]??vaultArc);
  if(authored)credit(s,f,'rankMoves');
  const action=airCut?.action??authored?.mapAction??art(name);
  setAction(f,action,move.duration);
  if(pose){
    f.poseFrom=pose;
    f.poseEntryDuration=live&&pose.kind==='live_entry'?Math.min(.155,move.contact*.72):
      f.stanceFlow&&!forceMove&&(airCut||landingEntry||linked)?
      airCut||landingEntry||airCarry?Math.min(.145,move.contact*.71):Math.min(.165,move.contact*.78)
      :airCut?move.contact*.51:f.styleChoreo&&!forceMove?
      Math.min(pose.kind==='chain'?.175:.155,move.contact*.69):
      pose.kind==='weapon_flow'?Math.min(.085,move.contact*.44):Math.min(.155,move.contact*.67);
  }
  event(s,action,f,undefined,undefined,{attackFamily:f.attackFamily,attackVariant:f.attackVariant,...(s.config.closeChoice&&f.closeAlternate?.id===name&&f.closeAlternate.at===s.time?{closeAlternate:'mk_wrist_cut'}:{}),...(recoveryFollowup?{recoveryFollowup}:{}),...(live?{entryKind:live.kind}:{}),...(authored?.arenaCut?{arenaCut:true,cutOpening:authored.opening??authored.motion?.path??'cut'}:{}),...(airCut?{airStrike:name,jumpKind:f.jumpKind}:{}),chainDepth:f.chainDepth,chainFrom:previous,rankMove:Boolean(authored),combo:f.combo,contact:move.contact,duration:move.duration,counter,blade:forceMove?undefined:move.blade??'primary',...(move.staff?{staffLead:f.staffLead,backLane:false}:{}),forceAbility:move.forceAbility});
  return true;
}
function dash(s: SimGame,f: SimFighter,dir: number,evasion: string | null | undefined){
  if(isArcadeCarrier(s,f))return false;
  const acrobat=f.formRules&&f.form==='ataru';
  if(!spend(f,acrobat?15:19))return false;
  const evade=acrobat?'vault_step':evasion==='sidestep'||evasion==='backstep'?evasion:'dash';
  const pose=entryPose(s,f,'dash');
  countMove(f,evade);
  f.face=dir;f.contact=false;f.attack=null;f.combo=0;f.buffer=null;f.invuln=acrobat?0:.115;f.technique=evade==='dash'?null:evade;
  if(acrobat)startAir(f,evadeArc,finite(f.lastParryAt)&&s.time-f.lastParryAt!<1?'parry_flip':null);
  setAction(f,'dash',f.formRules?acrobat?.405:.26:dashDuration);
  f.poseFrom=pose;f.poseEntryDuration=.095;
  event(s,'dash',f);return true;
}
function tryRankFootwork(s: SimGame,f: SimFighter,id: string,face: number,side: number){
  const spec=arcadeRankFootworkById(id,f.career.gradeIndex);
  if(!spec||!f.alive||f.actionDuration>0||f.airArc||f.airPhase!=='grounded'||
     f.saberOff||f.guardLock>0||(f.footworkReadyAt??0)>s.time||isArcadeCarrier(s,f))return false;
  const entry=entryPose(s,f,'dash');
  if(!spend(f,spec.cost))return false;
  const plan=arcadeFootworkPlan(spec,{face,side,form:f.form,grade:f.career.gradeIndex});
  f.attack=null;f.attackSpec=null;f.combo=0;f.buffer=null;f.invuln=0;
  f.technique=spec.path==='check'?'backstep':'sidestep';f.face=face;
  setAction(f,'dash',spec.duration);f.rankFootwork=plan;
  f.footworkReadyAt=s.time+(f.control?.70:4.5);
  if(s.config.advancedArena&&!f.control)f.advancedTravelStart={x:f.x,y:f.y,id};
  f.poseFrom=entry;f.poseEntryDuration=.095;
  countMove(f,spec.id);
  event(s,'rank_footwork',f,undefined,undefined,{footwork:spec.id,path:spec.path,bearing:plan!.bearing,duration:spec.duration});
  return true;
}
function jump(s: SimGame,f: SimFighter,bearing: number,traversing: boolean,combatAim: number | undefined){
  if(!f.alive||f.airArc||f.airPhase!=='grounded'||f.actionDuration>0||
    !['idle','walk','run'].includes(f.action)||f.jumpReadyAt!>s.time||isArcadeCarrier(s,f))return false;
  const arc=arcadeJumpProfile(f.form,bearing,f.face,traversing);
  f.airStrikeSpent=false;f.airStrike=null;f.airRequest=null;
  if(!spend(f,arc.cost))return false;
  f.jumpKind=arc.kind;f.jumpBearing=bearing;f.jumpDrive=traversing?arc.drive:0;
  f.jumpReadyAt=s.time+arc.takeoff+arc.flight+arc.landing+.34;
  f.attack=null;f.attackSpec=null;f.buffer=null;f.combo=0;f.technique=null;
  countMove(f,'jump');turnForAttack(f,finite(combatAim)?combatAim:bearing);startAir(f,arc);
  setAction(f,'jump',f.airDuration);
  event(s,'jump',f,undefined,undefined,{jumpKind:f.jumpKind,jumpBearing:bearing});return true;
}
// Contact changes velocity, not coordinates or hit stun. Terrain and other
// body disks still sweep the result on every subsequent simulation step.
function bodyImpulse(s: SimGame,f: SimFighter,bearing: number,speed: number,kind: string){
  if(!finite(speed)||Math.abs(speed)<1)return;
  const heading=speed<0?bearing+Math.PI:bearing, amount=Math.abs(speed);
  const x=Math.cos(heading),y=Math.sin(heading);
  const carry=f.kx*x+f.ky*y;
  const limit=kind==='hard'?590:kind==='clash'?235:kind==='guard'?190:290;
  const push=Math.min(amount,Math.max(0,limit-carry));
  f.kx+=x*push;f.ky+=y*push;
  const magnitude=Math.hypot(f.kx,f.ky);
  if(magnitude>620){f.kx*=620/magnitude;f.ky*=620/magnitude;}
  if(push>=19)f.impactReaction={at:s.time,bearing:heading,strength:clamp(push/480,.10,1),kind};
}
function stagger(s: SimGame,f: SimFighter,seconds: number){
  if(f.saberOff&&f.alive)relightTrakata(s,f,true);
  f.trakataAim=null;
  // Capture the blade socket while the interrupted action still owns the pose.
  // Guard break and recoil can share a tick; do not re-sample the new stagger.
  const pose=f.action==='stagger'&&f.actionTime===0&&f.poseFrom?.kind==='stagger'
    ? f.poseFrom : entryPose(s,f,'stagger');
  f.attack=null;f.buffer=null;f.combo=0;f.releaseOutcome=null;setAction(f,'stagger',seconds);
  f.poseFrom=pose;f.poseEntryDuration=Math.min(.13,seconds);
}
function injuryRoll(s: SimGame,attacker: SimFighter,victim: SimFighter){
  // Separate deterministic channel so contacts do not perturb AI choice timing.
  const code=Math.imul(s.tick+1,0x27d4eb2d)^(s.eventId+1)^Math.imul(attacker.slot+1+attacker.team*31,0x9e3779b9)^Math.imul(victim.slot+1+victim.team*37,0x85ebca6b);
  let h=code^s.weatherSeed;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/4294967296;
}
function updateInjury(f: SimFighter,result: ReturnType<typeof applyArcadeInjury>){
  if(result.changed){
    f.injuries=result.injuries;
    f.injuryEffects=arcadeInjuryModifiers(f.injuries,{dual:f.gear?.dualSabers});
  }
  if(result.fatal){
    f.alive=false;f.fatalRegion=result.region;f.fatalDirection=result.direction as "front"|"rear";
  }
}
function injure(s: SimGame,attacker: SimFighter,victim: SimFighter,spec: SimMove,amount: number,blocked: boolean,punish: boolean,from: number){
  const incoming=angleDelta(from,victim.face), travel=angleDelta(Math.atan2(victim.y-attacker.y,victim.x-attacker.x),attacker.face);
  const direction=Math.abs(incoming)>2.26?'rear':Math.abs(incoming)>.86?'side':'front';
  const left=(Math.sin(incoming)+(spec.isOffhand?-.55:.28)*(attacker.gear.grip==='backhand'?-1:1))<0;
  const arm=left?'leftArm':'rightArm',leg=left?'leftLeg':'rightLeg';
  const path=ARCADE_TECHNIQUES[attacker.technique!]?.role;
  const action=attacker.action;
  const stableLine=Math.abs(angleDelta(travel,(spec.backLane??spec.blade==='rear')?Math.PI:spec.bladeTurn??0))<(action==='rush'?.36:.52);
  const quality=clamp((stableLine?.67:.43)+(punish?.22:0)+(victim.action==='stagger'?.08:0)+(direction==='rear'?.08:0),0,1);
  let region='torso';
  if(action==='force')region=stableLine?'torso':leg;
  else if(action==='sweep'||path==='crowd')region=stableLine&&punish?'torso':leg;
  else if(action==='uppercut'||attacker.airHeight>23)region=stableLine?'head':arm;
  else if(action==='rush')region=stableLine?'torso':arm;
  else if(action==='slash')region=stableLine?(attacker.combo>=3||punish?'head':'torso'):arm;
  const result=applyArcadeInjury(victim.injuries,{region,amount,quality,attackerRank:attacker.career.gradeIndex,
    defenderRank:victim.career.gradeIndex,blocked,roll:injuryRoll(s,attacker,victim),direction});
  updateInjury(victim,result);
  const zoneY=region==='head'?57:region==='torso'?40:region.endsWith('Arm')?33:15;
  return {delta:result.impact??result.delta,meta:{region,direction,injuryTier:result.tier,
    injuryOutcome:result.outcome,contactY:victim.y-zoneY-victim.airHeight,fatal:result.fatal}};
}
function applyDamage(s: SimGame,attacker: SimFighter,victim: SimFighter,spec: SimMove){
  const angle=Math.atan2(victim.y-attacker.y,victim.x-attacker.x);
  const from=Math.atan2(attacker.y-victim.y,attacker.x-victim.x);
  const def=profile(victim);
  const superiority=rankGap(victim,attacker), mastery=masteryRatio(superiority);
  const moveIsForce=attacker.action==='force',freeHand=spec.freeHand===true;
  const deflecting=(victim.attack==='deflect'||victim.attackSpec?.deflect)&&victim.actionTime>=.04&&victim.actionTime<=(victim.attackSpec?.contact??.245);
  const guarding=victim.action==='guard', movingGuard=deflecting&&ARCADE_TECHNIQUES[victim.technique!]?.tactical==='moving_guard';
  const directed=guarding||movingGuard;
  const coverage0=victim.crossfire&&guarding&&victim.energy>18?1.53:movingGuard?1.00:deflecting?1.77:victim.guardDirected?victim.guardLane==='center'?1.04:.81:1.33;
  const coverage=coverage0*(victim.forceVeiledUntil!>s.time?.78:1);
  const closeGuard=(guarding||deflecting)&&Math.abs(directed?guardSource(victim,from,spec):angleDelta(from,victim.face))<coverage;
  const origin={sx:attacker.x,sy:attacker.y,forceAbility:spec.forceAbility,offhand:Boolean(spec.isOffhand),blade:moveIsForce||freeHand?undefined:spec.blade??(spec.isOffhand?'offhand':'primary'),...(spec.staff?{staffLead:attacker.staffLead,backLane:Boolean(spec.backLane)}:{}),...(spec.expanded?{expanded:true,effect:spec.effect,freeHand}:{} )};
  const impactX=victim.x-Math.cos(angle)*8,impactY=victim.y-Math.sin(angle)*8;
  if(victim.invuln>0&&victim.action==='dash'&&victim.airPhase==='grounded')return 'evade';
  if(victim.wardUntil!>s.time&&victim.wardCharges!>0){
    victim.wardCharges!--;credit(s,victim,'blocks');countMove(victim,'force_ward_block');
    event(s,'force_ward',victim,impactX,impactY,{targetId:attacker.id,...origin});return 'block';
  }
  if(closeGuard&&!moveIsForce&&((victim.parryTime>0&&!(victim.forceVeiledUntil!>s.time))||deflecting)&&victim.energy>=5&&(superiority>=-5||s.time-(victim.lastParryAt??-Infinity)>.45+Math.abs(superiority)*.043)){
    const perfect=s.config.perfectParryStamina&&guarding&&!freeHand&&victim.parryTime>0&&
      victim.actionTime<=.085&&s.time>=(victim.perfectParryReadyAt??0);
    const afterBase=Math.min(100,victim.energy+13);
    if(perfect){victim.perfectParryReadyAt=s.time+.30;countMove(victim,'perfect_parry');}
    victim.energy=Math.min(100,afterBase+(perfect?9:0));
    const reward=perfect?{perfect:true,staminaRestored:victim.energy-afterBase}:null;
    victim.parryTime=0;victim.counterUntil=s.time+1.04;victim.counterTarget=attacker.id;victim.parryCounterUntil=s.time+.83;
    attacker.energy=Math.max(0,attacker.energy-11);stagger(s,attacker,.44);
    if(elitePair(attacker,victim))expose(s,attacker,'parried',.62);
    if(s.config.impactPhysics)bodyImpulse(s,attacker,angle+Math.PI,266,'guard');
    else{attacker.kx-=Math.cos(angle)*210;attacker.ky-=Math.sin(angle)*210;}
    if(s.config.guardCounterplay&&s.config.teamSizes[0]===s.config.teamSizes[1]&&Math.abs(rankGap(attacker,victim))<=2)
      attacker.lastGuardParry={by:victim.id,at:s.time,family:attacker.attackChoices?.at(-1)?.family,deflect:Boolean(deflecting)};
    victim.lastParryAt=s.time;countMove(victim,'parry');credit(s,victim,'blocks');credit(s,victim,'parries');
    event(s,'parry',victim,impactX,impactY,{targetId:attacker.id,...origin,...reward});confirmGuardRead(s,victim,attacker,impactX,impactY,'parry');return 'parry';
  }
  // A master can read a novice blade on a real front/side line, provided
  // they are not stunned or already in an exposed release and can pay for it.
  const releasing=victim.attack&&Math.abs((victim.attackSpec?.contact??0)-victim.actionTime)<(superiority>=12?.033:.073);
  if(s.time-(victim.rankDeflectAt??-Infinity)>.16)victim.rankReadCount=0;
  const canDeflect=!victim.saberOff&&superiority>=4&&!moveIsForce&&!closeGuard&&!releasing&&victim.action!=='stagger'&&victim.action!=='clash'&&
    victim.energy>=3&&(superiority>=10?(victim.rankReadCount??0)<2+Math.min(Math.floor(victim.rankCombat.reads*.28),Math.floor(mastery*4)):s.time-(victim.rankDeflectAt??-Infinity)>=.25-mastery*.16)&&
    Math.abs(angleDelta(from,victim.face))<=1.02+mastery*1.92;
  if(canDeflect){
    victim.rankDeflectAt=s.time;victim.rankReadCount=(victim.rankReadCount??0)+1;victim.energy=Math.max(0,victim.energy-(4-mastery*3.3));
    attacker.energy=Math.max(0,attacker.energy-4-mastery*6);
    if(superiority>=8)stagger(s,attacker,.12+mastery*.15);
    credit(s,victim,'blocks');credit(s,victim,'rankDeflections');countMove(victim,'rank_deflect');
    event(s,'rank_deflect',victim,impactX,impactY,{targetId:attacker.id,damage:0,...origin});
    return 'block';
  }
  const rawDamage=Math.max(1,Math.round(spec.damage*(s.mode==='watch'?.65:attacker.control?1:attacker.team===1?.72+.14*s.pressure:.8)*rankStrikeScale(attacker,victim)));
  let damage=rawDamage, blocked=false, breakGuard=false;
  if(spec.forceAbility==='stasis'){
    victim.stasisUntil=Math.max(victim.stasisUntil??0,s.time+.85);
    event(s,'force_stasis',attacker,impactX,impactY,{targetId:victim.id,...origin});
  }
  if(closeGuard){
    const observeGuard=s.config.guardCounterplay&&guarding&&!moveIsForce&&!freeHand&&
      s.config.teamSizes[0]===s.config.teamSizes[1]&&Math.abs(rankGap(attacker,victim))<=2;
    const held=observeGuard&&victim.actionTime>=.155&&victim.parryTime<=0;
    const guardStart=s.time-victim.actionTime;
    const guardRead=held?attacker.heldGuardOpening:null;
    const authored=ARCADE_TECHNIQUES[attacker.attack!];
    const pressure=guardRead?.target===victim.id&&Math.abs(guardRead.guardStart-guardStart)<.025&&guardRead.count>=2&&guardRead.serial!==attacker.attackSerial&&
      s.time-guardRead.at<2.7&&(authored?.role==='heavy'||spec.recoil>=.28)&&
      attacker.attackSerial!==attacker.guardPressSerial&&!spec.isOffhand;
    const lowStamina=s.config.perfectParryStamina&&!moveIsForce&&!freeHand&&victim.energy<=30;
    const normalCost=(lowStamina?1.18:1)*rawDamage*.89/Math.max(.35,victim.injuryEffects.guardEfficiency)*(def.guardCost??1)*(moveIsForce?1.45:1)*(1-.26*victim.skill.skill);
    const extra=pressure?Math.min(9,normalCost*.38+2):0;
    const guardCost=normalCost+extra;
    if(pressure){
      attacker.guardPressSerial=attacker.attackSerial;attacker.heldGuardOpening=null;
      countMove(attacker,'guard_pressure');
      event(s,'guard_pressure',attacker,impactX,impactY,{targetId:victim.id,extraStamina:extra});
    }else if(held&&victim.energy>=guardCost&&!spec.isOffhand&&attacker.attackSerial!=null){
      const previous=attacker.heldGuardOpening;
      if(previous?.serial!==attacker.attackSerial){
        const same=previous?.target===victim.id&&Math.abs(previous.guardStart-guardStart)<.025&&s.time-previous.at<2.7;
        attacker.heldGuardOpening={target:victim.id,guardStart,at:s.time,serial:attacker.attackSerial,
          count:same?Math.min(2,previous.count+1):1};
      }
    }
    if(victim.energy>=guardCost){
      victim.energy-=guardCost;victim.counterUntil=s.time+.83;victim.counterTarget=attacker.id;blocked=true;credit(s,victim,'blocks');countMove(victim,'block');damage=Math.max(1, Math.round(rawDamage*.12));
      if(s.config.impactPhysics)bodyImpulse(s,victim,angle,clamp(spec.knock*.35,20,124),'guard');
      else{victim.kx+=Math.cos(angle)*spec.knock*.28;victim.ky+=Math.sin(angle)*spec.knock*.28;}

    }else{
      victim.energy=0;victim.guardLock=.55;stagger(s,victim,.57);breakGuard=true;countMove(attacker,'guard_break');damage=Math.round(rawDamage*.84);

    }
  }
  const punish=!blocked&&damage>0&&victim.exposedUntil!>s.time;
  // A ready grandmaster caught while sliding a real outside angle turns a
  // marginal hit into a graze, not an automatic block. A clean rear, committed
  // windup, air hit, exhausted guard or an earned punish stays full strength.
  const bodyLine=Math.abs(angleDelta(from,victim.face));
  const strikeLine=Math.abs(angleDelta(from+Math.PI,attacker.face+((spec.backLane??spec.blade==='rear')?Math.PI:spec.bladeTurn??0)));
  const sliding=Math.abs(Math.cos(from)*victim.vy-Math.sin(from)*victim.vx)>28;
  const braced=!moveIsForce&&!blocked&&!punish&&!breakGuard&&victim.localRead&&elitePair(attacker,victim)&&victim.energy>=15&&
    victim.airPhase!=='airborne'&&bodyLine<2.22&&
    (victim.action==='guard'||(['run','walk','dash','idle'].includes(victim.action)&&(sliding||bodyLine>.73||strikeLine>.22)));
  if(!punish&&!blocked&&!breakGuard&&!s.elitePacing&&elitePair(attacker,victim)&&
      s.liveByTeam![0]!==s.liveByTeam![1]&&s.config.teamSizes[0]!==s.config.teamSizes[1]&&victim.energy>=12){
    // Equally trained opponents can contain ordinary contact even in an
    // uneven roster. This attenuates injury, never removes contact and
    // applies to both sides; an earned opening always hits at full force.
    damage=Math.max(1,Math.round(damage*(s.liveByTeam![victim.team]<s.liveByTeam![attacker.team]?(bodyLine<2.22?0.33:0.56):(bodyLine<2.22?.64:.82))));
  }
  if(braced){
    victim.energy-=4;
    countMove(victim,'pressure_graze');
    damage=Math.max(1,Math.round(damage*.63));
  }
  damage=pacedDamage(s,victim,damage,punish,blocked);
  const punishReason=punish?victim.exposedBy:undefined;
  if(punish){credit(s,attacker,'punishes');victim.exposedUntil=0;victim.exposedBy=null;}
  if(breakGuard&&elitePair(attacker,victim))expose(s,victim,'guard_break',.66);
  const impact=injure(s,attacker,victim,spec,damage,blocked,punish,from);
  damage=impact.delta;
  recordDamage(s,attacker,victim,damage);
  if(!victim.alive&&damage===0)victim.contributors.push({id:attacker.id,time:s.time,damage:0});
  if(superiority<=-8&&!blocked&&damage>0)attacker.energy=Math.min(100,attacker.energy+Math.min(11,damage*.16));
  if(s.config.perfectParryStamina&&damage>0&&!moveIsForce&&!freeHand&&!blocked&&!breakGuard&&!braced&&
      attacker.attackSerial!=null&&attacker.staminaHitSerial!==attacker.attackSerial){
    const reward=arcadeBodyStaminaReward(impact.meta.region);
    if(reward>0){
      attacker.staminaHitSerial=attacker.attackSerial;
      const prev=attacker.energy;
      attacker.energy=Math.min(100,prev+reward);
      const staminaGain=attacker.energy-prev;
      if(staminaGain>0){
        countMove(attacker,'stamina_hit');
        event(s,'stamina_hit',attacker,impactX,impactY,{region:impact.meta.region,staminaGain,targetId:victim.id});
      }
    }
  }
  if(blocked){
    if(s.config.motionFlow?.blockRebound&&guarding&&!deflecting&&!moveIsForce&&!freeHand&&
       !spec.airStrike&&attacker.airPhase==='grounded'&&!attacker.airArc)attacker.motionLinkedBlock=true;
    event(s,'block',victim,impactX,impactY,{targetId:attacker.id,damage,...origin,...impact.meta});
    confirmGuardRead(s,victim,attacker,impactX,impactY,'block');
  }
  else if(breakGuard)event(s,'break',attacker,impactX,impactY,{targetId:victim.id,damage,...origin,...impact.meta});
  if (!blocked) {
    if(spec.effect==='lowCheck')victim.forceAnchoredUntil=Math.max(victim.forceAnchoredUntil??0,s.time+.34);
    rememberAttacker(s,victim,attacker,from);
    if(freeHand)countMove(attacker,'unarmed_hits');else credit(s,attacker,moveIsForce?'forceHits':'saberHits');
    if(attacker.counterMove){
      credit(s,attacker,'counters');
      if((attacker.control||s.config.teamSizes[0]===s.config.teamSizes[1])&&attacker.riposteSerial!==attacker.attackSerial&&attacker.riposteTarget===victim.id){
        attacker.riposteSerial=attacker.attackSerial;credit(s,attacker,'ripostes');countMove(attacker,'landed_riposte');
        event(s,'riposte',attacker,impactX,impactY,{targetId:victim.id,damage,...origin,...impact.meta});
      }
    }
  }
  if(!closeGuard||victim.action==='stagger'){
    const composed=victim.technique!==ARCADE_TRAKATA_ID&&superiority>=6&&victim.energy>=2&&victim.action!=='stagger'&&!breakGuard;
    const launched=(attacker.attack==='uppercut'||spec.launch)&&!spec.isOffhand&&victim.alive&&!composed;
    const recoil=spec.recoil*(1-(.65+victim.rankCombat.stability*.10)*mastery);
    const knock=spec.knock*(1-.78*mastery)*(spec.forceAbility==='pull'?-.83:spec.forceAbility==='stasis'?.28:1);
    if(s.config.impactPhysics&&!moveIsForce){
      const hard=!braced&&!composed&&!freeHand&&(breakGuard||launched||spec.recoil>=.29||spec.knock>=185);
      const inAir=victim.airPhase==='airborne';
      const gain=composed?1.12:braced?1.31:freeHand?1.19:hard?1.58:1.55;
      const base=(composed?16:braced?18:freeHand?33:hard?76:64)*(1-.76*mastery);
      const speed=(Math.max(0,knock)*gain+base)*(inAir?.87:1);
      bodyImpulse(s,victim,angle,speed,hard?'hard':'glance');
      if(hard&&attacker.alive&&attacker.airPhase==='grounded')
        bodyImpulse(s,attacker,angle+Math.PI,Math.min(73,speed*.14),'glance');
    }else{victim.kx+=Math.cos(angle)*knock;victim.ky+=Math.sin(angle)*knock;}
    if(composed){
      victim.energy=Math.max(0,victim.energy-(2.4-mastery*1.3));
      credit(s,victim,'rankComposure');countMove(victim,'rank_composure');
      if(s.time-(victim.composureAt??-Infinity)>.30){
        victim.composureAt=s.time;event(s,'rank_composure',victim,impactX,impactY,{targetId:attacker.id,...origin});
      }
    }
    // Direct hits cancel telegraphs, not their residual knockback or display.
    if(victim.alive&&!composed){stagger(s,victim, Math.max(victim.action==='stagger'?victim.actionDuration-victim.actionTime:0, recoil));if(launched)startAir(victim,launchArc);}
    event(s,launched?'launch':'hit',attacker,impactX,impactY,{targetId:victim.id,damage,...origin,...impact.meta,...(braced?{pressureGraze:true}:{}),...(punish?{punish:true,punishReason}:{})});
    if(moveIsForce)event(s,spec.forceAbility==='pull'?'force_pull':'push',attacker,impactX,impactY,{targetId:victim.id,...origin});
  }
  if(!blocked&&elitePair(attacker,victim)){victim.lastEliteTouchAt=s.time;victim.lastEliteTouchBy=attacker.id;
    victim.lastEliteTouchFrom=from;}
  if(!victim.alive){setAction(victim,'ko',1);victim.attack=null;victim.combo=0;victim.buffer=null;const attribution=recordKnockout(s,victim);event(s,'ko',attacker,victim.x,victim.y,{targetId:victim.id,...origin,...impact.meta,...attribution});}
  return blocked?'block':'hit';
}
// Trace the attack line to each target separately: a wide cut can still
// reach an exposed opponent to one side. A raised vault can clear a grounded ally.
function allyInLane(s: SimGame,f: SimFighter,x: number,y: number){
  const dx=x-f.x,dy=y-f.y,length=Math.hypot(dx,dy);
  if(length<1||(s.liveByTeam?.[f.team]??2)<2)return null;
  const nx=dx/length,ny=dy/length;
  let nearest=null,depth=length;
  for(const a of s.fighters){
    if(a===f||!a.alive||a.team!==f.team||Math.abs((a.airHeight??0)-(f.airHeight??0))>38)continue;
    const ax=a.x-f.x,ay=a.y-f.y,along=ax*nx+ay*ny;
    if(along<=4||along>=depth||Math.abs(ax*ny-ay*nx)>a.radius+3)continue;
    nearest=a;depth=along;
  }
  return nearest;
}
function alternateLane(s: SimGame,f: SimFighter,enemy: SimFighter,blocker: SimFighter){
  const base=Math.atan2(blocker.y-enemy.y,blocker.x-enemy.x), preferred=f.slot%2===0?1:-1;
  const radius=91, {minX,maxX,minY,maxY}=s.bounds;
  let best=null,cost=Infinity;
  for(const n of [1,-1,2,-2,3,-3]){
    const angle=base+n*preferred*.69,x=enemy.x+radius*Math.cos(angle),y=enemy.y+radius*Math.sin(angle);
    if(x<minX||x>maxX||y<minY||y>maxY||!openAt(s,x,y,f.radius)||blockedBetween(s,x,y,enemy.x,enemy.y))continue;
    let score=Math.hypot(x-f.x,y-f.y)+(Math.abs(n)-1)*15+(n<0?13:0);
    if(blockedBetween(s,f.x,f.y,x,y,f.radius))score+=45;
    for(const ally of s.fighters)if(ally!==f&&ally.alive&&ally.team===f.team)
      score+=Math.max(0,55-Math.hypot(x-ally.x,y-ally.y))*1.8;
    if(score<cost){cost=score;best={x,y};}
  }
  return best;
}
function contactBlade(s: SimGame,f: SimFighter,spec: SimMove){
  if(f.action==='force'||spec.freeHand)return spec;
  const rear=spec.blade==='rear';
  const reverse=f.gear.grip==='backhand';
  if(!rear&&!reverse&&f.gear.weapon!=='staff')return spec;
  const world: BladeWorld=arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
  const physical=spec.blade??(spec.isOffhand?'offhand':'primary');
  const bladeId=physical==='rear'?'rear':physical==='offhand'?'off':'main';
  const segment=world.blades?.find(b=>b.id===bladeId)??(bladeId==='main'?world:world.offhand);
  if(!segment)return {...spec,unavailable:true};
  const dx=segment.tip.x-segment.hand.x,dy=segment.tip.y-segment.hand.y;
  const length=Math.hypot(dx,dy);
  if(length<8)return {...spec,unavailable:true};
  // The two-dimensional rig already foreshortens edge-on silhouettes. Use
  // wrist side as an arc bias rather than misreading screen height as depth.
  const turn=reverse?(spec.isOffhand?-1:1)*Math.min(.26,.12+Math.abs(dy)/length*.15):0;
  return {...spec,bladeTurn:turn,bladePointX:segment.tip.x,bladePointY:segment.tip.y};
}
function expandedUtility(s: SimGame,f: SimFighter,spec: SimMove){
  const {effect}=spec;
  if(effect==='lattice'){
    if(!(f.wardUntil!>s.time&&f.wardCharges!>0)){f.wardUntil=s.time+.84;f.wardCharges=1;}
    event(s,'force_ward',f,undefined,undefined,{expanded:true,effect,forceAbility:'ward'});return true;
  }
  if(effect==='echoStep'){
    const x=f.x+Math.cos(f.face)*44,y=f.y+Math.sin(f.face)*44,b=s.bounds;
    if(x>=b.minX+4&&x<=b.maxX-4&&y>=b.minY+4&&y<=b.maxY-4&&!blockedBetween(s,f.x,f.y,x,y,f.radius)&&!allyInLane(s,f,x,y)){
      f.echoStepUntil=s.time+.185;f.echoStepBearing=f.face;
      event(s,'expanded_contact',f,undefined,undefined,{effect,destinationX:x,destinationY:y});
    }
    return true;
  }
  if(!['anchor','veil','siphon'].includes(effect!))return false;
  const within=s.fighters.filter(o=>o.alive&&o.team!==f.team&&Math.hypot(o.x-f.x,o.y-f.y)<=spec.reach+o.radius&&
    arcadeContactHeight(f,o,spec)&&Math.abs(angleDelta(Math.atan2(o.y-f.y,o.x-f.x),f.face))<=spec.arc&&
    !s.terrain.solids.some(r=>r.kind!=='barricade'&&crossed(f.x,f.y,o.x,o.y,r))&&!allyInLane(s,f,o.x,o.y))
    .sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y));
  for(const o of within){
    if(o.invuln>0&&o.action==='dash'&&o.airPhase==='grounded')continue;
    const defended=o.action==='guard'&&Math.abs(angleDelta(Math.atan2(f.y-o.y,f.x-o.x),o.guardBearing??o.face))<.91&&o.energy>=5;
    if(defended||(o.wardUntil!>s.time&&o.wardCharges!>0)){
      if(defended)o.energy-=5;else o.wardCharges!--;
      credit(s,o,'blocks');countMove(o,'block');
      f.releaseOutcome='guarded';
      event(s,'block',o,o.x,o.y,{targetId:f.id,expanded:true,effect,damage:0});
      return true;
    }
    if(effect==='anchor')o.forceAnchoredUntil=Math.max(o.forceAnchoredUntil??0,s.time+.78);
    else if(effect==='veil')o.forceVeiledUntil=Math.max(o.forceVeiledUntil??0,s.time+.74);
    else {
      const transfer=Math.min(9,o.energy,100-f.energy);
      o.energy-=transfer;f.energy+=transfer;
    }
    credit(s,f,'forceHits');credit(s,f,'forceLanded');countMove(f,'force_'+effect+'_contact');
    f.releaseOutcome='landed';
    event(s,'expanded_contact',f,o.x,o.y,{targetId:o.id,effect});return true;
  }
  f.releaseOutcome='miss';
  return true;
}
function finishChessPawn(f: SimFighter,landed: boolean=false){
  if(f.chessPawnPending==null)return;
  f.chessPawn=arcadeChessPawnStrike(f.chessPawn,{serial:f.chessPawnPending,landed});
  f.chessPawnPending=null;
  f.chessPawnRetreat=0;
}
function contact(s: SimGame,f: SimFighter,spec: SimMove){
  if(f.saberOff)return;
  if(spec.expanded)event(s,'expanded_release',f,undefined,undefined,{effect:spec.effect,moveId:f.attack,freeHand:spec.freeHand});
  if(spec.expanded&&!spec.freeHand&&expandedUtility(s,f,spec))return;
  if(spec.forceAbility==='ward'){
    f.wardUntil=s.time+1.15;f.wardCharges=1;
    event(s,'force_ward',f,undefined,undefined,{forceAbility:'ward'});
    return;
  }
  spec=contactBlade(s,f,spec);
  if(spec.unavailable)return;
  const back=spec.backLane??spec.blade==='rear',bladeAngle=f.face+(back?Math.PI:spec.bladeTurn??0);
  const chessStyle=f.action==='force'||spec.freeHand?null:(spec.chessStyle??f.chessStyle);
  const canReach=(t:{o:SimFighter;dx:number;dy:number;d:number})=>!chessStyle||arcadeChessAllowsLane(chessStyle,{bearing:Math.atan2(t.dy,t.dx),face:f.face,targetFace:t.o.face,
    backLane:back,promoted:spec.chessPromoted===true,styleTravel:s.config.styleTravel,distance:t.d,reach:spec.reach});
  // Resolve in spatial order to keep near bodies first and avoid an artificial stab through a crowd.
  const candidates=s.fighters.filter(o=>o.team!==f.team&&o.alive).map(o=>({o,dx:o.x-f.x,dy:o.y-f.y,d:Math.hypot(o.x-f.x,o.y-f.y)}))
    .filter(t=>t.d<=spec.reach+t.o.radius&&arcadeContactHeight(f,t.o,spec)&&!s.terrain.solids.some(r=>(f.action!=='force'||r.kind!=='barricade')&&crossed(f.x,f.y,t.o.x,t.o.y,r))&&Math.abs(angleDelta(Math.atan2(t.dy,t.dx),bladeAngle))<=spec.arc&&canReach(t))
    .sort((a,b)=>a.d-b.d);
  const cap=spec.expanded?(spec.cap??1):back?Math.min(3,spec.cap??2):Math.max(spec.cap??0,['sweep','wide_cut','force'].includes(f.attack!)?3:f.attack==='slash3'||f.attack==='frenzy'||(f.formRules&&f.form==='shii_cho')?2:1,
    spec.rankSweep?f.rankCombat.crowdCap:1);
  let used=0, landed=false,parried=false,screened=null;
  const force=f.action==='force';
  const staff=f.gear.weapon==='staff'&&!force&&!spec.freeHand;
  if(staff)f.staffTouched??=new Set();
  for(const target of candidates){
    if(staff&&f.staffTouched!.has(target.o.id))continue;
    const ally=allyInLane(s,f,target.o.x,target.o.y);
    if(ally){screened??=ally;continue;}
    const result=applyDamage(s,f,target.o,spec);
    if(staff&&result!=='evade')f.staffTouched!.add(target.o.id);
    if(result==='hit'){
      landed=true;
      if(staff)countMove(f,spec.blade==='rear'?'staff_rear_hit':'staff_primary_hit');
    }
    if(result==='parry'){parried=true;break;}
    if(result!=='evade'&&++used===cap)break;
  }
  if(!used&&!landed&&!parried&&screened){
    credit(s,f,'allyBlocks');
    event(s,'ally_blocked',f,screened.x,screened.y,{targetId:screened.id,offhand:Boolean(spec.isOffhand),blade:spec.blade??(spec.isOffhand?'offhand':'primary')});
  }
  if(landed||used>0||!spec.isOffhand)f.releaseOutcome=parried?'parried':landed?'landed':used>0?'guarded':'miss';
  if(landed){
    if(s.config.motionFlow)f.motionLinkedHit=true;
    if(chessStyle==='pawn')finishChessPawn(f,true);
    if(spec.freeHand)countMove(f,'unarmed_landed');else if(!staff||!f.staffLanded)credit(s,f,force?'forceLanded':'saberLanded');
    if(staff)f.staffLanded=true;
    f.exposedUntil=0;f.exposedBy=null;
  }
  else if(!used&&!parried&&!spec.isOffhand&&s.fighters.some(e=>e.team!==f.team&&e.alive&&elitePair(f,e)&&Math.hypot(e.x-f.x,e.y-f.y)<=spec.reach+109)){
    const left=Math.max(0,f.actionDuration-f.actionTime);
    expose(s,f,'whiff',Math.min(.61,left+.18));credit(s,f,'whiffs');
  }
}
const combatHabits=['opening_reader','lane_builder','tempo_keeper'] as const;
function combatHabit(f: SimFighter){
  const seed=Number.isInteger(f.appearanceSeed)?f.appearanceSeed>>>0:appearanceSeedFor(f.heroId??f.id);
  return combatHabits[((seed^(seed>>>13))>>>0)%combatHabits.length];
}
function situationalRepertoire(s: SimGame,f: SimFighter,enemy: SimFighter,moves: readonly Technique[],role: string,range: number){
  if(!s.config.repertoireSupport||!enemy||f.control||!['counter','crowd','heavy'].includes(role)||f.career.gradeIndex<4)return null;
  const aim=Math.atan2(enemy.y-f.y,enemy.x-f.x), incoming=atk(enemy);
  const wind=incoming&&!enemy.contact?incoming.contact-enemy.actionTime:Infinity;
  const grounded=enemy.airPhase!=='airborne', vulnerable=enemy.exposedUntil!>s.time+.15||enemy.action==='stagger';
  const verifiedCounter=f.counterTarget===enemy.id&&f.counterUntil>s.time;
  const lane=(m: Pick<SimMove,"reach"|"arc">,target: SimFighter)=>{
    const d=Math.hypot(target.x-f.x,target.y-f.y), bearing=Math.atan2(target.y-f.y,target.x-f.x);
    return d<=m.reach+target.radius&&Math.abs(angleDelta(bearing,aim))<=m.arc&&
      (!f.chessStyle||arcadeChessAllowsLane(f.chessStyle,{bearing,face:aim,targetFace:target.face,distance:d,
        promoted:f.chessPawn?.promoted===true,styleTravel:s.config.styleTravel}))&&
      !blockedBetween(s,f.x,f.y,target.x,target.y)&&!allyInLane(s,f,target.x,target.y);
  };
  const recent=f.attackChoices?.slice(-3)??[], fitted=[];
  for(const move of moves){
    if(move.role!==role||move.mapAction==='force'||move.cost>f.energy||!lane(move,enemy))continue;
    const spec=arcadeChessMove(f.chessStyle,move,{promoted:f.chessPawn?.promoted===true});
    if(!lane(spec,enemy))continue;
    let value;
    if(role==='crowd'){
      const targets=s.fighters.filter(o=>o.alive&&o.team!==f.team&&lane(spec,o)&&arcadeContactHeight(f,o,spec)).length;
      if(targets<2||spec.contact>.45)continue;
      value=Math.min(spec.cap??2,targets)*2.1+Math.min(spec.arc,2.4)*.35-spec.contact*3;
    }else if(role==='counter'){
      const covering=Boolean(move.deflect&&wind>=.10&&wind<=spec.contact+.045);
      if(!covering&&!verifiedCounter)continue;
      if(!covering&&finite(wind)&&wind+.035<spec.contact)continue;
      if(move.launch&&!grounded)continue;
      if(spec.contact>.35||(!grounded&&!move.launch&&range>92))continue;
      value=(covering?2.65:1)+(vulnerable&&(move.launch||move.tactical==='slip_counter')?.85:0)+
        Math.min(25,spec.reach-range)*.032-spec.contact*3;
    }else{
      if(!grounded||wind<spec.contact+.035||move.tactical)continue;
      if(move.air){
        // Take a long-vault opening only when there is room to land.
        if(f.form!=='ataru'||!(move.arenaCut||move.exchangeCut)||range<94||range>132||
          (!vulnerable&&enemy.action!=='run')||
          !footworkPath(s,f,aim,Math.min(68,range-enemy.radius-f.radius-7)))continue;
        value=2+(vulnerable?.6:0)-spec.contact;
      }else{
        const guardPressure=enemy.action==='guard'&&enemy.parryTime<=0&&enemy.energy<42&&f.energy>=39;
        const remaining=enemy.action==='stagger'?enemy.actionDuration-enemy.actionTime:(enemy.exposedUntil??0)-s.time;
        if(move.minRank<4||range<(f.form==='juyo'||f.form==='djem_so'?51:63)||range>121||
          (!guardPressure&&(!vulnerable||remaining<spec.contact+.09))||spec.contact>.42)continue;
        value=2+(guardPressure&&move.cap>1?.12:0)+Math.min(22,spec.reach-range)*.035-spec.contact*2;
      }
    }
    const habit=f.combatHabit;
    value+=habit==='opening_reader'?(move.deflect||move.opening==='intercept'?.12:0):
      habit==='lane_builder'?(move.role==='crowd'||move.tactical==='slip_counter'?.12:0):
      habit==='tempo_keeper'?(move.contact<.26?.12:0):0;
    fitted.push({move,value});
  }
  if(!fitted.length)return null;
  const best=Math.max(...fitted.map(x=>x.value));
  const similar=fitted.filter(x=>(s.config.exchangeVariety||x.move.arenaCut||role==='heavy'&&x.move.minRank>=4)&&x.value>=best-(s.config.exchangeVariety?.92:.68));
  similar.sort((a,b)=>((f.moves[a.move.id]??0)+(recent.some(r=>r.id===a.move.id)?2:0))-
    ((f.moves[b.move.id]??0)+(recent.some(r=>r.id===b.move.id)?2:0))||b.value-a.value||a.move.id.localeCompare(b.move.id));
  return similar[0]?.move.id??null;
}
function rankTechnique(s: SimGame,f: SimFighter,enemy: SimFighter,intent: string,crowd: number){
  if(!f.formRules)return null;
  const mirror=s.config.teamSizes[0]===s.config.teamSizes[1];
  const moves=arcadeMovesFor(f.form,f.career.gradeIndex,{tactical:mirror,rankCuts:true,circuitCuts:s.config.circuitCuts,arenaCuts:s.config.arenaCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves});
  const d=enemy?Math.hypot(enemy.x-f.x,enemy.y-f.y):0;
  const arenaCrowd=s.config.arenaCuts&&enemy&&intent==='heavy'&&f.rankCombat.index>=11&&
    s.fighters.filter(e=>e.alive&&e.team!==f.team&&Math.hypot(e.x-f.x,e.y-f.y)<148&&
      Math.abs(angleDelta(Math.atan2(e.y-f.y,e.x-f.x),Math.atan2(enemy.y-f.y,enemy.x-f.x)))<1.04).length>=2;
  const role=intent==='force'?'force':(arenaCrowd||crowd>=2&&f.rankCombat.index>=11)?'crowd':
    f.counterUntil>s.time&&f.rankCombat.index>=6?'counter':intent;
  const situational=situationalRepertoire(s,f,enemy,moves,role,d);
  if(situational)return situational;
  let pool=moves.filter(m=>(role==='force'||m.role===role)&&(intent==='force'?m.mapAction==='force':m.mapAction!=='force')&&d<m.reach+(m.air?100:31)&&m.cost*.75<=f.energy&&(!m.tactical||f.rankDominance<5));
  const preferred=f.tournamentMove, recent=f.attackChoices?.at(-1);
  const learnedFits=()=>preferred&&recent?.id!==preferred&&pool.some(m=>m.id===preferred&&m.reach+(m.air?46:6)>=d&&m.cost<=f.energy);
  if(!mirror){
    if(learnedFits())return preferred;
    pool.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||b.minRank-a.minRank);
    return pool[0]?.id??null;
  }
  // Force, trained counters and crowd cuts keep their original unlocks and
  // intent. Only an ordinary symmetric saber exchange may weigh a different
  // family if it fits the range and foe better.
  if(!enemy||intent==='force'||role==='crowd'||role==='counter'||Math.abs(rankGap(f,enemy))>4){
    if(intent!=='force'&&learnedFits())return preferred;
    pool.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||b.minRank-a.minRank);
    return pool[0]?.id??null;
  }
  const opts: Parameters<typeof chooseFormCommit>[0][number][]=moves.filter(m=>m.mapAction!=='force'&&!m.air&&['light','heavy'].includes(m.role)&&m.cost<=f.energy&&
    d<m.reach+32).map(move=>({id:move.id,action:move.mapAction,move,intentMatch:move.role===intent}));
  for(const move of pool){
    if(!opts.some(o=>o.id===move.id))opts.push({id:move.id,action:move.mapAction,move,intentMatch:true});
  }
  for(const choice of ['slash',profile(f).heavy]){
    const move=attackByName(choice);
    if(move&&choice!=='force'&&!opts.some(o=>o.id===choice))
      opts.push({id:choice,action:art(choice),move,intentMatch:(choice==='slash')===(intent==='light')});
  }
  const line=Math.abs(angleDelta(Math.atan2(enemy.y-f.y,enemy.x-f.x),f.face));
  const side=angleDelta(Math.atan2(f.y-enemy.y,f.x-enemy.x),enemy.guardBearing??enemy.face);
  const incoming=atk(enemy),wind=incoming&&!enemy.contact?Math.max(0,incoming.contact-enemy.actionTime):0;
  const choice={form:f.form,distance:d,line,side,guarded:enemy.action==='guard',open:enemy.exposedUntil!>s.time,
    wind,crowd,counter:f.counterUntil>s.time,history:f.attackChoices,energy:f.energy,preferred:preferred??undefined,variety:s.config.exchangeVariety?f.moves:undefined,advancedArena:s.config.advancedArena,rank:f.career.gradeIndex};
  if(s.config.arenaCuts&&f.career.gradeIndex>=1){
    const fitted=opts.filter(({id,move:m})=>ARCADE_TECHNIQUES[id!]&&
      d<=m.reach+(m.air?58:16)&&(!m.tactical||m.tactical!=='moving_guard'||Boolean(wind)||choice.counter)&&
      (m.role!=='heavy'||intent==='heavy'||(choice.open&&f.energy>=42)||
        (s.config.exchangeVariety&&f.energy>=48&&!wind&&m.contact<=.37&&d>=58&&d<=m.reach-7&&!m.tactical&&!m.air))&&
      (m.role!=='light'||intent==='light'||d<92));
    const alternatives=fitted.filter(o=>o.id!==recent?.id);
    const authored=chooseFormCommit(alternatives,choice)??chooseFormCommit(fitted,choice);
    if(authored)return authored;
  }
  return chooseFormCommit(opts,choice)??pool[0]?.id??null;
}
function eliteLocalPressure(s: SimGame,f: SimFighter){
  if(f.career.gradeIndex<12||(s.liveByTeam?.[1-f.team]??0)<2)return null;
  const threats=[];
  let support=0;
  for(const o of s.fighters){
    if(o===f||!o.alive)continue;
    const dx=o.x-f.x,dy=o.y-f.y,d2=dx*dx+dy*dy;
    if(o.team===f.team){
      if(d2<208**2&&o.action!=='stagger'&&!blockedBetween(s,f.x,f.y,o.x,o.y))support++;
      continue;
    }
    if(d2>268**2||!elitePair(f,o)||blockedBetween(s,f.x,f.y,o.x,o.y))continue;
    const d=Math.sqrt(d2),angle=Math.atan2(dy,dx),spec=atk(o);
    let time=Infinity;
    if(spec){
      for(const [hit,done,bearing] of [[spec,o.contact,o.face],[spec.offhand,o.offhandContact,o.face+((spec.offhand?.backLane??spec.offhand?.blade==='rear')?Math.PI:0)]] as const){
        if(!hit||done)continue;
        const release=hit.contact-o.actionTime;
        if(release<=0||release>.40||d>hit.reach+32||Math.abs(angleDelta(angle+Math.PI,bearing))>hit.arc+.22)continue;
        time=Math.min(time,release);
      }
    }
    threats.push({o,d,angle,time});
  }
  if(threats.length<2||threats.length<=support+1)return null;
  threats.sort((a,b)=>a.time-b.time||a.d-b.d);
  return {threats,imminent:threats.filter(t=>t.time<.24),closest:Math.min(...threats.map(t=>t.d))};
}
function pressureFootwork(s: SimGame,f: SimFighter,info: LocalPressure,heading: number){
  let best=null,high=-Infinity;
  for(const delta of [-1.15,1.15,-1.88,1.88,-2.47,2.47]){
    const direction=heading+delta,x=f.x+Math.cos(direction)*74,y=f.y+Math.sin(direction)*74;
    const b=s.bounds;
    if(x<b.minX+4||x>b.maxX-4||y<b.minY+4||y>b.maxY-4||blockedBetween(s,f.x,f.y,x,y,f.radius))continue;
    let score=-Math.abs(delta)*12,near=Infinity,inside=0;
    for(const t of info.threats){
      const distance=Math.hypot(x-t.o.x,y-t.o.y);near=Math.min(near,distance);
      inside+=distance<102?1:0;
      if(t.time<.28)score+=Math.min(137,distance)*.48;
      score+=Math.min(156,distance)*.18;
    }
    if(near<45)score-=95;else score-=inside*17;
    if(score>high){high=score;best=direction;}
  }
  return best;
}
// Read feet and visible blades, then reserve a brief ordinary movement
// exit before three lanes converge. No dash, faster stats, or mitigation.
function heroExitPath(s: SimGame,f: SimFighter,local: LocalPressure){
  const nearby=local.threats.filter(t=>t.d<172);
  if(nearby.length<2||!nearby.some((a,i)=>nearby.slice(i+1).some(b=>Math.abs(angleDelta(a.angle,b.angle))>1.13)))return null;
  const current=local.closest,b=s.bounds, distance=53;
  let best=null,bestScore=-Infinity;
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,dx=Math.cos(angle),dy=Math.sin(angle),x=f.x+dx*distance,y=f.y+dy*distance;
    if(x<b.minX+9||x>b.maxX-9||y<b.minY+9||y>b.maxY-9||blockedBetween(s,f.x,f.y,x,y,f.radius)||
       s.terrain.zones.some(z=>z.damagePerSecond!>0&&inside(x,y,z)))continue;
    let min=Infinity,sum=0;
    for(const {o} of nearby){
      const n=Math.hypot(x-o.x,y-o.y);
      min=Math.min(min,n);sum+=Math.min(n,196);
    }
    if(min<current+13||s.fighters.some(o=>{
      if(o===f||!o.alive)return false;
      const ox=o.x-f.x,oy=o.y-f.y,along=ox*dx+oy*dy;
      return along>6&&along<distance+o.radius&&Math.abs(ox*dy-oy*dx)<o.radius+f.radius+2;
    }))continue;
    const score=min+sum*.17;
    if(score>bestScore){bestScore=score;best={angle,x,y};}
  }
  return best;
}
function refreshMatchGoal(s: SimGame,f: SimFighter,enemy: SimFighter,{range,urgent,danger,local,opening}: {range:number;urgent:boolean;danger:boolean;local:LocalPressure|null;opening:boolean}){
  if(!s.config.matchGoalPlanning||f.control||((f.matchGoalSampleAt??0)>s.time&&!(opening&&f.matchGoal==='draw')))return;
  if(f.matchGoal==='win'&&(f.matchGoalSince??0)>0&&atk(f))return;
  f.matchGoalSampleAt=s.time+.28;
  const outgoing=f.injuryEffects,incoming=enemy.injuryEffects;
  const impairment=((outgoing.saberPower-incoming.saberPower)*.9+(outgoing.moveSpeed-incoming.moveSpeed)*.65+
    (outgoing.guardEfficiency-incoming.guardEfficiency)*.55)*1.30;
  const injuryEdge=clamp(impairment-compareArcadeDanger(f.injuries,enemy.injuries)*.10,-1,1);
  const pressure=clamp((range<138?.18:0)+(range<78?.11:0)+(urgent?.20:0)+(danger?.17:0)+
    Math.max(0,(local?.threats.length??1)-1)*.13,0,1);
  const previous=f.matchGoal;
  const goalInput={time:s.time,limit:s.limit,elo:f.matchGoalRating,opponentElo:enemy.matchGoalRating,
    selfAlive:s.liveByTeam![f.team],enemyAlive:s.liveByTeam![enemy.team],injuryEdge,pressure,currentGoal:previous,
    opening,form:f.form,stamina:f.energy/100};
  const goal=chooseArenaMatchGoal(goalInput);
  if(goal!==previous){
    f.matchGoal=goal;f.matchGoalSince=s.time;
    const reason=goal==='draw'?(s.liveByTeam![f.team]<s.liveByTeam![enemy.team]?'outnumbered':
      injuryEdge<-.25?'injury-risk':f.matchGoalRating!<enemy.matchGoalRating!?'rating-risk':'clock-risk')
      :opening?'counter-opening':'seek-decisive';
    event(s,'match_goal',f,undefined,undefined,{goal,previous,reason});
    countMove(f,'intent_'+goal);
  }
}
function clockSpacing(s: SimGame,f: SimFighter,enemy: SimFighter,aim: number,range: number,orbit: number){
  // Avoid one direction forever or walking through walls / a partner. At
  // long range even a draw plan returns to a measured fighting distance.
  const side=Math.sign(orbit)||1;
  for(const offset of [side*1.79,-side*1.79,side*2.53,-side*2.53]){
    const bearing=aim+offset,dx=Math.cos(bearing),dy=Math.sin(bearing),tx=f.x+dx*40,ty=f.y+dy*40,b=s.bounds;
    if(tx<b.minX+8||tx>b.maxX-8||ty<b.minY+8||ty>b.maxY-8||
       Math.hypot(tx-enemy.x,ty-enemy.y)>167||blockedBetween(s,f.x,f.y,tx,ty,f.radius)||
       allyInLane(s,f,tx,ty)||s.terrain.zones.some(z=>z.damagePerSecond!>0&&inside(tx,ty,z)))continue;
    const pace=range<88?.82:.67;
    return {x:dx*pace,y:dy*pace,aim};
  }
  return null;
}
function continuation(s: SimGame,f: SimFighter,enemy: SimFighter,range: number,aligned: boolean,urgent: boolean){
  const move=atk(f);
  const timed=Boolean(move&&contactChainOpen(s.config.motionFlow,f,move));
  const hit=timed&&f.motionLinkedHit===true;
  // A hit by either emitter wins over the other emitter's ordinary block.
  const outcome=s.config.motionFlow?.blockRebound&&hit?'landed':f.releaseOutcome;
  if(!move||!chainWindow(s,f,move)||!aligned||urgent||f.energy<25||f.chainDepth!>=chainLimit(f)||
     Math.abs(rankGap(f,enemy))>4||range>123||enemy.action==='dash'||enemy.airPhase==='airborne'||
     !timed&&!['landed','guarded'].includes(outcome!))return null;
  if(outcome==='guarded'&&enemy.action!=='guard'&&enemy.action!=='stagger')return null;
  if(f.career.gradeIndex<8&&f.form!=='juyo'&&outcome==='guarded'&&enemy.exposedUntil!<=s.time)return null;
  if(outcome==='guarded'&&f.chainDepth!>1&&f.form!=='juyo')return null;
  const active=ARCADE_TECHNIQUES[f.attack!], base=ARCADE_ATTACKS[f.attack as keyof typeof ARCADE_ATTACKS];
  const finalStage=s.elitePacing&&s.elitePacing.stage==='decisive';
  const canRepeat=(f.chainRepeat??0)<(f.form==='juyo'?2:1)&&!active?.air&&!(active?.tactical)&&
    range<(move.reach+3)&&outcome==='landed'&&enemy.action!=='guard'&&
    (active?.role==='light'||f.form==='juyo'||base&&f.attack!.startsWith('slash'));
  if(!f.stanceFlow&&canRepeat&&(!s.config.arenaCuts||!f.attack!.startsWith('slash'))&&f.energy>=37&&(f.form==='juyo'||enemy.action==='stagger'||finalStage))return f.attack;
  const pool=arcadeMovesFor(f.form,f.career.gradeIndex,{circuitCuts:s.config.circuitCuts,arenaCuts:s.config.arenaCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves}).filter(m=>m.id!==f.attack&&!m.air&&m.mapAction!=='force'&&m.role==='light'&&
    m.contact<.31&&range<=m.reach+10&&f.energy>=m.cost+10);
  if(enemy.action==='guard'&&outcome!=='landed'&&f.form==='soresu')return null;
  if(hit&&f.airPhase!=='grounded'&&f.airArc?.kind){
    // Deliberately favor a short grounded-kit cut; attack() verifies exact
    // final timing before spending anything.
    return pool.sort((a,b)=>a.contact-b.contact)[0]?.id??'slash';
  }
  if(f.stanceFlow){
    if(f.airPhase!=='grounded'||f.airArc||!pool.length)return null;
    const aim=Math.atan2(enemy.y-f.y,enemy.x-f.x);
    const ux=Math.cos(aim),uy=Math.sin(aim);
    const drive=(f.vx??0)*ux+(f.vy??0)*uy;
    const separation=(enemy.vx-f.vx)*ux+(enemy.vy-f.vy)*uy;
    const rig=sampleArcadeFighter(f,s.time);
    const rear=rig.staff&&(move.offhand&&f.offhandContact?move.offhand.blade==='rear':f.staffLead==='rear');
    const h=rear?rig.offEmitter:rig.emitter??rig.hand,tip=rear?rig.offBlade:rig.blade;
    const bladeFacing=Math.atan2(tip!.y-h.y,(tip!.x-h.x)*rig.hdx);
    const loaded=(rig.lean??0)>8||(rig.bend??0)>9||drive>38;
    const promoted=f.chessPawn?.promoted===true, style=f.chessStyle;
    if(style&&!arcadeChessAllowsLane(style,{bearing:aim,face:aim,targetFace:enemy.face,promoted,
      distance:range,styleTravel:s.config.styleTravel}))return null;
    const options=[];
    for(const m of pool){
      const family=arcadeAttackPresentation(m.id,m,m.mapAction).family;
      const next=arcadeChessMove(style,m,{promoted});
      const dist=range+clamp(separation*.13,-14,18);
      const turn=Math.abs(angleDelta(aim,f.face));
      if(dist>next.reach+6||turn>next.arc*.72+.09||loaded&&drive>44&&family==='thrust'&&f.attackFamily==='thrust')continue;
      const chamber=(m.motion?.chamber??-.7)*(rig.reverse?-1:1);
      const recoveryTurn=Math.abs(angleDelta(chamber,bladeFacing));
      if(loaded&&recoveryTurn>2.39&&family===f.attackFamily)continue;
      const base=Math.abs(next.reach-dist)*.028+m.contact*3.2;
      const sidePenalty=drive<-38&&family==='thrust'?1.25:0;
      const familyPenalty=family===f.attackFamily?(loaded?1.7:.55):0;
      const known=(f.moves[m.id]??0)*.09+(f.attackChoices?.slice(-2).some(o=>o.id===m.id)?.68:0);
      options.push({id:m.id,score:base+recoveryTurn*(loaded?.91:.45)+sidePenalty+familyPenalty+known});
    }
    // No compatible next chamber: finish the active recovery; the existing
    // step/turn planner can re-enter, without cutting off real release frames.
    return options.sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id))[0]?.id??null;
  }
  return pool.sort((a,b)=>{
    const fit=(m:Technique)=>Math.abs(m.reach-range)*.035+(f.moves[m.id]??0)*.08+m.contact*3;
    return fit(a)-fit(b);
  })[0]?.id??(range<96&&f.attack!=='slash'?'slash':null);
}
function footworkPath(s: SimGame,f: SimFighter,bearing: number,distance: number){
  const x=f.x+Math.cos(bearing)*distance,y=f.y+Math.sin(bearing)*distance,b=s.bounds;
  return x>=b.minX+4&&x<=b.maxX-4&&y>=b.minY+4&&y<=b.maxY-4&&openAt(s,x,y,f.radius)&&
    !blockedBetween(s,f.x,f.y,x,y,f.radius)&&bodyMotionFraction(s,f,f.x,f.y,x,y)>.82;
}
// A recoil response starts only after the engine releases the original
// action lock. Neither visible injury nor actual airborne time is skipped.
function recoveryIntent(s: SimGame,f: SimFighter,enemy: SimFighter,{d,aim,orbit,untilContact,threatened,clear}: {d:number;aim:number;orbit:number;untilContact:number;threatened:boolean;clear:boolean}){
  const hit=f.impactReaction;
  if(!f.recoveryFlow||!hit||!['hard','clash'].includes(hit.kind)||s.time-hit.at>.86||
    f.actionDuration!==0||f.airArc||f.airPhase!=='grounded'||!clear||d<43||d>165||
    f.saberOff||f.energy<12||isArcadeCarrier(s,f))return null;
  const imminent=threatened&&untilContact>.045&&untilContact<.195;
  let plan=f.impactRecovery;
  if(plan?.impactAt!==hit.at){
    const earlier=f.impactRecovery?.at??-Infinity;
    if(s.time-earlier<.56)return null;
    const guardable=imminent&&enemy.action!=='force'&&f.guardLock===0&&f.energy>=18&&
      Math.abs(angleDelta(aim,f.face))<.72;
    const naturallyGuard=['soresu','djem_so','makashi'].includes(f.form)||f.action==='guard';
    const side=Math.sign(Math.sin(hit.bearing-aim))||Math.sign(orbit)||1;
    let kind,bearing;
    if(guardable&&naturallyGuard){kind='guard';bearing=aim;}
    else{
      for(const sign of [side,-side]){
        const route=aim+sign*(d<86?1.92:1.55);
        if(footworkPath(s,f,route,24)){kind='lateral';bearing=route;break;}
      }
      if(!kind&&guardable){kind='guard';bearing=aim;}
      if(!kind&&imminent&&footworkPath(s,f,aim+Math.PI,23)){kind='backstep';bearing=aim+Math.PI;}
    }
    if(!kind)return null;
    const duration=kind==='guard'?.205:hit.kind==='clash'?.17:.20;
    plan=f.impactRecovery={at:s.time,impactAt:hit.at,duration,kind,bearing:bearing!,strength:hit.strength,
      target:enemy.id,serial:f.attackSerial,last:f.attackChoices?.at(-1)};
  }
  if(plan!.target!==enemy.id||s.time-plan!.at>=plan!.duration)return null;
  if(plan!.kind==='guard')return {guard:true,guardAim:aim,x:0,y:0,aim};
  if(!footworkPath(s,f,plan!.bearing,13))return null;
  const speed=plan!.kind==='backstep'?.62:.58;
  return {x:Math.cos(plan!.bearing)*speed,y:Math.sin(plan!.bearing)*speed,aim};
}
function selectBalanceEntry(s: SimGame,f: SimFighter,enemy: SimFighter,{d,aim,incoming,formChoice,role,planned}: {d:number;aim:number;incoming:SimMove|null|undefined;formChoice:string|null|undefined;role:string;planned:boolean}){
  const latest=f.attackChoices?.at(-1);
  if(!s.config.balancePass||f.career.gradeIndex<4||!s.config.exchangeVariety||d<42||d>138||
     s.time<(f.balanceReadyAt??0))return null;
  const promoted=f.chessPawn?.promoted===true,style=f.chessStyle;
  const lane=(move: SimMove,o:SimFighter)=>{
    const bearing=Math.atan2(o.y-f.y,o.x-f.x),distance=Math.hypot(o.x-f.x,o.y-f.y);
    const spec=arcadeChessMove(style,move,{promoted});
    return Math.abs(angleDelta(bearing,aim))<=spec.arc-.04&&distance<=spec.reach+o.radius*.40&&
      (!style||arcadeChessAllowsLane(style,{bearing,face:aim,targetFace:o.face,promoted,distance,styleTravel:s.config.styleTravel}))&&
      !blockedBetween(s,f.x,f.y,o.x,o.y)&&!allyInLane(s,f,o.x,o.y)&&o.airPhase!=='airborne';
  };
  if(f.form==='makashi'){
    const move=ARCADE_TECHNIQUES.ex_mk_false_line;
    const patientGuard=enemy.action==='guard'&&enemy.parryTime<=.075&&d>=73&&
      (enemy.actionTime>=.10||enemy.energy<=52);
    const safeRelease=!incoming||enemy.contact&&(!incoming.offhand||enemy.offhandContact);
    if(f.career.gradeIndex>=move.minRank&&patientGuard&&safeRelease&&(f.feintReadyAt??0)<=s.time&&
      f.energy>=move.cost+16&&latest?.id!==move.id&&lane(move,enemy)){
      f.balanceReadyAt=s.time+2.9;
      f.falseLineTarget=enemy.id;
      return move.id;
    }
  }else if(f.form==='juyo'&&s.config.teamSizes[1-f.team]>=2){
    const move=ARCADE_TECHNIQUES.ex_jy_crossfire_turn;
    if(f.career.gradeIndex>=move.minRank&&f.energy>=move.cost+11&&latest?.id!==move.id&&lane(move,enemy)){
      const paired=s.fighters.some(o=>o!==enemy&&o.alive&&o.team!==f.team&&
        Math.abs(angleDelta(Math.atan2(o.y-f.y,o.x-f.x),aim))>.22&&lane(move,o));
      if(paired){f.balanceReadyAt=s.time+1.24;return move.id;}
    }
  }
  if(!planned||!formChoice||latest?.id!==formChoice||f.attackChoices!.slice(-3).filter(c=>c.id===formChoice).length<2)return null;
  const current=ARCADE_TECHNIQUES[formChoice!]??attackByName(formChoice);
  if(!current||current.air||current.tactical||current.mapAction==='force')return null;
  const options=arcadeMovesFor(f.form,f.career.gradeIndex,{rankCuts:true,arenaCuts:s.config.arenaCuts,
    circuitCuts:s.config.circuitCuts,exchangeVariety:true,minorMoves:s.config.minorMoves}).filter(m=>m.role===role&&m.id!==formChoice&&!m.air&&!m.tactical&&
    m.mapAction!=='force'&&m.cost<=Math.min(f.energy-6,current.cost+3)&&m.contact<=current.contact+.025&&
    lane(m,enemy)&&(!incoming||enemy.contact||m.contact<=incoming.contact-enemy.actionTime-.03));
  options.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||a.contact-b.contact);
  return options[0]?.id??null;
}
function tacticalJump(s: SimGame,f: SimFighter,enemy: SimFighter,{d,aim,orbit,incoming,untilContact,obstructed,follow,allyScreen}: {d:number;aim:number;orbit:number;incoming:SimMove|null|undefined;untilContact:number;obstructed:boolean;follow:boolean|null;allyScreen:SimFighter|null}){
  const age=f.career.gradeIndex, ataru=f.form==='ataru', fluid=s.config.fluidFootwork===true&&s.config.teamSizes[0]===s.config.teamSizes[1];
  if(!f.formRules||f.actionDuration||f.airPhase!=='grounded'||!neutralAction(f.action)||
     f.jumpReadyAt!>s.time||(f.aiJumpNextAt??(fluid?1.45:2.1)+(f.slot%4)*.35)>s.time||f.energy<(fluid?(ataru?37:42):ataru?39:45)||
     d<(fluid?54:49)||d>(fluid?(ataru?168:151):ataru?154:139)||follow||obstructed||(!fluid&&allyScreen)||isArcadeCarrier(s,f))return null;
  const enemyMoving=Math.hypot(enemy.vx,enemy.vy)>30;
  const longIncoming=incoming&&!enemy.contact&&untilContact>=(fluid?.215:.29)&&untilContact<.59;
  const opening=enemy.action==='stagger'&&enemy.actionDuration-enemy.actionTime>.23||
    enemy.exposedUntil!>s.time+.28||enemy.action==='run'&&enemyMoving;
  const laneClear=!incoming||(fluid&&enemy.contact&&(!incoming.offhand||enemy.offhandContact));
  const groundedGap=laneClear&&enemy.airPhase==='grounded'&&enemy.action!=='guard'&&
    d>=78&&(f.groundSpeed>35||enemyMoving);
  const lateralGap=fluid&&laneClear&&d>=74&&enemy.airPhase==='grounded'&&
    (allyScreen||enemy.action==='guard'&&enemy.parryTime<=0&&d>=89||f.groundSpeed<33&&enemy.groundSpeed<32||d>=93&&enemy.contact);
  if(!longIncoming&&!opening&&!groundedGap&&!lateralGap)return null;
  const side=Math.sign(orbit)||1;
  const template=longIncoming||lateralGap||fluid&&allyScreen?[1.12,-1.12,1.47,-1.47]:ataru?[.82,-.82,.24,-.24]:
    f.form==='makashi'||f.form==='juyo'?[.28,-.28,.60,-.60]:[.67,-.67,.33,-.33];
  for(const offset of template){
    const bearing=aim+offset*side;
    const check=ataru?65:f.form==='soresu'?39:57;
    if(footworkPath(s,f,bearing,check))return {bearing,aim,purpose:longIncoming?'evade':opening?'entry':'cross'};
  }
  return null;
}
function ai(s: SimGame,f: SimFighter,enemy: SimFighter | null,dt: number): SimCommand {
  if(s.config.repertoireSupport&&!f.combatHabit)f.combatHabit=combatHabit(f);
  const objectiveMove=arcadeObjectiveMove(s,f);
  const commanded=s.mode==='command'&&f.team===0;
  const order=commanded?s.order:'push';
  const ordered=order==='hold'?(f.orderAnchor??f.spawn):order==='regroup'?f.spawn:order==='flank'?{
    x:s.width*.56,y:s.bounds.minY+42+Math.floor(f.slot/5)*32}:null;
  const hazard=f.rankDominance>=9&&!atk(f)?s.terrain.zones.find(z=>z.damagePerSecond!>0&&inside(f.x,f.y,z)):null;
  let escape=null;
  if(hazard){
    const p=24, b=s.bounds;
    const options=[{x:hazard.x-p,y:f.y},{x:hazard.x+hazard.width+p,y:f.y},{x:f.x,y:hazard.y-p},{x:f.x,y:hazard.y+hazard.height+p}];
    escape=options.filter(pt=>pt.x>b.minX&&pt.x<b.maxX&&pt.y>b.minY&&pt.y<b.maxY&&openAt(s,pt.x,pt.y,f.radius)).sort((a,b)=>
      Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0]??null;
  }
  const destination: (Point & {role?:string})|null|undefined=isArcadeCarrier(s,f)?objectiveMove:escape?{...escape,role:'escape'}:ordered??objectiveMove;
  if(!enemy){
    const goal=destination??{x:s.width*(f.team===0?.56:.44),y:s.height*.5+((f.slot%5)-2)*39};
    const near=Math.hypot(goal.x-f.x,goal.y-f.y), route=chooseRoute(s,f,goal);
    const angle=Math.atan2(route.y-f.y,route.x-f.x), speed=near<16?0:1;
    return {x:Math.cos(angle)*speed,y:Math.sin(angle)*speed,aim:angle};
  }
  const d=Math.hypot(enemy.x-f.x,enemy.y-f.y), aim=Math.atan2(enemy.y-f.y,enemy.x-f.x), def=profile(f);
  const rankAdvantage=rankGap(f,enemy);
  const scan=rankAdvantage!==0?(f.rankCombat.awareness-1)*2.5:0;
  const incoming=atk(enemy), threatened=incoming&&enemy.actionTime<incoming.contact&&d<incoming.reach+42+scan&&Math.abs(angleDelta(enemy.face,aim+Math.PI))<incoming.arc+.16;
  const difficulty=f.team===1?s.pressure:0;
  const distanceToGoal=destination?Math.hypot(destination.x-f.x,destination.y-f.y):Infinity;
  const follow=destination&&(destination.role==='escape'||order==='regroup'||order==='hold'||(!((d<145)&&order==='push')&&distanceToGoal>16));
  const allyScreen=!follow&&d<300?allyInLane(s,f,enemy.x,enemy.y):null;
  const lane=allyScreen&&!atk(f)?alternateLane(s,f,enemy,allyScreen):null;
  const path=chooseRoute(s,f,follow?destination:lane??enemy), obstructed=Boolean(blockedBetween(s,f.x,f.y,enemy.x,enemy.y));
  const detour=path!==enemy&&!follow;
  const travelAim=path===enemy?aim:Math.atan2(path.y-f.y,path.x-f.x);
  const settledForRead=!f.attack&&f.actionDuration===0&&f.airPhase==='grounded';
  if(f.heroId){
    const change=observeHeroPlan(f,enemy,s.time,dt,d<222&&!obstructed&&!follow,settledForRead);
    if(change){countMove(f,'hero_plan_'+change.plan);event(s,'hero_plan',f,undefined,undefined,change);}
  }
  const doctrine=f.heroPlan??f.heroDoctrine??s.config.doctrines[f.team];
  const aligned=Math.abs(angleDelta(aim,f.face))<.72;
  const turningToHit=f.awarenessFacing&&Math.abs(angleDelta(aim,f.face))>.82;
  const untilContact=threatened?incoming.contact-enemy.actionTime:Infinity;
  const urgent=untilContact<.16&&untilContact>0;
  const elite=elitePair(f,enemy)&&!follow&&!obstructed&&order==='push';
  f.eliteEngaged=elite;
  f.eliteRankEdge=elite&&!s.elitePacing?clamp(rankAdvantage,-2,2):0;
  const ready=!atk(f)&&f.action!=='dash'&&f.action!=='stagger'&&f.action!=='clash';
  const crowd=rankAdvantage>=5&&f.rankCombat.index>=8?s.fighters.reduce((n,x)=>n+Number(x.alive&&x.team!==f.team&&
    rankGap(f,x)>=5&&Math.hypot(x.x-f.x,x.y-f.y)<180),0):0;
  const local=elite&&!isArcadeCarrier(s,f)?eliteLocalPressure(s,f):null;
  const crossingElite=s.eliteCrossfire&&elite;
  const isolated=crossingElite&&s.config.teamSizes[f.team]===1&&(local?.threats.length??0)>=2;
  const attackerGroup=crossingElite&&s.config.teamSizes[f.team]>=3&&s.liveByTeam![f.team]>=2;
  f.crossfire=Boolean(isolated);
  const danger=local?.imminent[0];
  f.localRead=Boolean(local&&local.closest<169);
  if(s.config.anticipatingCombat&&f.chessBaseStyle&&ready&&f.actionDuration===0&&!f.attack&&
     f.airPhase==='grounded'&&neutralAction(f.action)&&!f.saberOff&&!urgent&&!danger&&
     !allyScreen&&!obstructed&&!follow&&!detour&&d<158&&d>28&&s.time>=(f.chessReviewAt??0)){
    const last=f.chessSwitchedAt??-Infinity;
    f.chessReviewAt=s.time+.33;
    const before=f.chessStyle;
    const next=chooseArcadeChessStyle({baseStyle:f.chessBaseStyle,currentStyle:before,distance:d,
      bearing:aim,face:f.face,targetFace:enemy.face,threat:Boolean(threatened),
      guarded:enemy.action==='guard',imminent:urgent,crowd,committed:false,sinceSwitch:s.time-last,
      pawnStreak:f.chessPawn?.streak,chessPromoted:f.chessPawn?.promoted===true,styleTravel:s.config.styleTravel});
    if(next&&next!==before&&s.time-last>=.90){
      f.chessStyle=next;f.chessSwitchedAt=s.time;f.chessReviewAt=s.time+1.04;
      if(before==='pawn'&&!f.chessPawn?.promoted&&f.chessPawn?.streak){
        f.chessPawn=arcadeChessPawnStrike(f.chessPawn,{retreated:true});f.chessPawnRetreat=0;
      }
      event(s,'chess_style',f,undefined,undefined,{chessStyle:next,previousChessStyle:before,before,style:next});
    }
  }

  const opening=elite&&!danger&&!allyScreen&&ready&&aligned&&enemy.exposedUntil!>s.time+.18-(f.eloSkill?.readRecovery??0)&&d<106&&f.energy>=13;
  refreshMatchGoal(s,f,enemy,{range:d,urgent,danger:Boolean(danger),local,opening});
  let plannedBlock=false, plannedDodge=false;
  const arenaIQ=f.arenaReadSkill;
  const arenaEdge=arenaIQ?.level?Math.tanh((arenaIQ.rating-(enemy.arenaReadSkill?.rating??100))/200):0;
  const readLevel=s.config.eloReads?Math.max(0,f.eloSkill?.level??0):0;
  const pattern=readLevel&&threatened&&!obstructed&&!allyScreen&&!follow&&f.airPhase==='grounded'&&
    (enemy.attackChoices?.length??0)>=3&&enemy.attackChoices!.slice(-3).every(o=>o.family===enemy.attackFamily);
  if(arenaIQ?.level&&incoming&&enemy.attack&&enemy.attackFamily&&enemy.attackSerial!=null&&
    !obstructed&&!follow&&d<195&&enemy.actionTime<incoming.contact){
    const previous=f.arenaPattern;
    if(previous?.rival!==enemy.id||s.time-previous.time>7)
      f.arenaPattern={rival:enemy.id,serial:enemy.attackSerial,time:s.time,patterns:[{family:enemy.attackFamily}]};
    else if(previous.serial!==enemy.attackSerial){
      previous.serial=enemy.attackSerial;previous.time=s.time;
      previous.patterns=[...previous.patterns.slice(-3),{family:enemy.attackFamily}];
    }
  }
  const learned=arenaPatternRead(arenaIQ,enemy.arenaReadSkill,enemy.attackFamily,
    f.arenaPattern?.rival===enemy.id?f.arenaPattern.patterns:undefined);
  const arenaPoised=learned>0&&threatened&&!obstructed&&!allyScreen&&!follow&&f.airPhase==='grounded'&&enemy.action!=='force';
  const poised=(pattern||arenaPoised)&&Math.abs(angleDelta(aim,f.face))<.66&&f.energy>=24&&f.guardLock<=0;
  const measuredRead=poised&&untilContact>0&&untilContact<=.118+readLevel*.075+learned*.085;
  if((elite||arenaPoised)&&ready&&!danger&&(urgent||measuredRead)&&f.action!=='guard'&&f.energy>=12&&f.reactedTo!==enemy.attackSerial){
    const favorGuard=def.guardAI??.45;
    const canDash=f.energy>27&&!isArcadeCarrier(s,f);
    // A read can be wrong; current direction, gas and one reaction per committed move matter.
    const lead=(f.eloSkill?.readLead??0)+(arenaIQ?.level?arenaIQ.level*.032+arenaEdge*.018:0);
    if(untilContact<=.10+lead||measuredRead||(!canDash&&untilContact<=.15+lead)){
      f.reactedTo=enemy.attackSerial;
      const read=rng(s);
      const heroParryBias=f.heroPlan==='defensive'?.09:f.heroPlan==='aggressive'?-.06:0;
      const blockGate=.28+.40*favorGuard+f.eliteRankEdge*.08+heroParryBias+(poised?.11*readLevel+.14*learned:0)+(arenaIQ?.level ? .08*arenaEdge : 0);
      if(poised)f.lastRatedRead={time:s.time,remaining:untilContact,family:enemy.attackFamily!,choice:enemy.action!=='force'&&read<blockGate?'guard':canDash&&read<.73?'dodge':'hold'};
      if(enemy.action!=='force'&&read<blockGate){
        f.decision='guard';f.guardUntil=s.time+.26;plannedBlock=true;
      }else if(canDash&&read<.73){
        plannedDodge=true;
      }
    }
  }
  f.think-=dt;
  const peerSwarm=elite&&!s.elitePacing&&s.config.teamSizes[f.team]>s.config.teamSizes[enemy.team]&&
    s.liveByTeam![f.team]>s.liveByTeam![enemy.team];
  // Nearby teammates read the actual committed release. Those sharing its
  // lane circle into available space instead of stepping into the same hit.
  const partnerRelease=attackerGroup?s.fighters.find(a=>{
    const move=atk(a);
    if(a===f||!a.alive||a.team!==f.team||!move||a.contact)return false;
    const x=enemy.x-a.x,y=enemy.y-a.y;
    const t=move.contact-a.actionTime;
    return t>0&&t<0.41&&x*x+y*y<(move.reach+48)**2&&Math.abs(angleDelta(Math.atan2(y,x),a.face))<move.arc+.18;
  }):null;
  const laneSeparation=partnerRelease?Math.abs(angleDelta(Math.atan2(partnerRelease.y-enemy.y,partnerRelease.x-enemy.x),aim+Math.PI)):Math.PI;
  const forming=Boolean(partnerRelease&&laneSeparation<2.8);
  const partnerLanding=attackerGroup&&enemy.action==='stagger'&&enemy.actionTime<.115&&d>70;
  // A follow-up from the same side should not cross the previous attacker's
  // recovery path. The opening remains available from a distinct flank.
  const coveringAfter=attackerGroup&&enemy.lastEliteTouchBy!==f.id&&s.time-(enemy.lastEliteTouchAt??-Infinity)<1.25&&
    Math.abs(angleDelta(enemy.lastEliteTouchFrom!,aim+Math.PI))<3.14;
  const peerForceClear=!peerSwarm||s.fighters.every(ally=>ally===f||!ally.alive||ally.team!==f.team||
    Math.abs(ally.x-enemy.x)>230||Math.abs(ally.y-enemy.y)>230||s.time-(ally.lastForceAt??-Infinity)>2.7);
  const measuredForceReady=peerForceClear&&(!s.elitePacing||s.time-(f.lastForceAt??-Infinity)>4);
  let strike=false,heavy=false,roll=false,force=false,feint=false,guardAim=null;
  const tacticalRoster=f.formRules&&s.config.teamSizes[0]===s.config.teamSizes[1];
  const matchedPeer=tacticalRoster&&Math.abs(rankAdvantage)<=3;
  const peerTactics=(tacticalRoster||Boolean(f.heroId))&&f.career.gradeIndex>=4&&rankAdvantage<5&&!follow&&!obstructed;
  const defensiveReading=peerTactics&&ready&&threatened&&incoming&&untilContact<.16&&d<132;
  if(defensiveReading&&f.action==='guard')guardAim=aim+Math.sign(angleDelta(enemy.face,aim+Math.PI))*.25;
  if(peerTactics&&ready&&enemy.action==='feint'&&d<137&&enemy.actionTime>=.105&&f.readFeint!==enemy.id+'/'+enemy.feintSerial){
    f.readFeint=enemy.id+'/'+enemy.feintSerial;
    // Less trained fighters cover the presented strike more readily. A
    // patient foe can wait it out; no forced stagger or false block.
    const overplayed=readLevel>.55&&f.lastFeintFoe===enemy.id&&s.time-(f.lastFeintSeen??-Infinity)<4.6;
    if(readLevel){f.lastFeintFoe=enemy.id;f.lastFeintSeen=s.time;}
    if((f.career.gradeIndex<9||f.energy<30)&&f.energy>11&&!overplayed){
      f.decision='guard';f.guardUntil=s.time+.32;guardAim=aim+Math.sign(angleDelta(enemy.feintBearing??enemy.face,aim+Math.PI))*.44;
      f.baitBearing=guardAim;f.baitUntil=f.guardUntil;
    }
  }
  if(f.baitUntil!>s.time&&f.decision==='guard'&&!urgent)guardAim=f.baitBearing;
  if(f.think<=0){
    f.think=(def.wind+.048+rng(s)*.15-difficulty*.047)*(1-.28*f.skill.skill)*(1-(rankAdvantage!==0?f.rankCombat.initiative*.40:0))*(f.eloSkill?.decisionClock??1)*(arenaIQ?.level?arenaIQ.decisionClock:1);
    if(!elite&&rankAdvantage<5&&urgent&&f.energy>13&&f.action!=='dash'&&f.action!=='guard'){
      const rating=rng(s), preference=(def.guardAI??(f.archetype==='warden'?.69:f.archetype==='duelist'?.34:.47))+difficulty*.11+f.skill.skill*.076+(doctrine==='defensive'?.18:doctrine==='aggressive'?-.14:0);
      if(rating<preference){ f.decision='guard'; f.guardUntil=s.time+.23+rng(s)*.14; }
      else if(rating<preference+.26 && f.energy>27)roll=true;
    }
    if(f.guardUntil!<=s.time||!f.guardUntil) f.decision=null;
    const current=atk(f);
    // Less trained peers no longer queue a fresh strike on every think tick.
    // Keep Juyo's clean combo, and let genuinely exposed targets invite a follow-up.
    const canChain=current&&f.contact&&f.actionTime>current.contact+.11&&
      ((f.form==='juyo'&&f.combo>0&&f.combo<3)||enemy.exposedUntil!>s.time+.19)&&f.energy>27;
    const canCommit=elite||!matchedPeer||!current||canChain;
    if(canCommit&&!obstructed&&!allyScreen&&order!=='regroup'&&destination?.role!=='escape'&&f.decision!=='guard'&&!roll&&f.guardLock<=0&&(aligned||atk(f))&&(!elite||(ready&&!urgent&&(f.eliteReady??0)<=s.time))){
      const nearby=s.fighters.filter(e=>e.team!==f.team&&e.alive&&Math.hypot(e.x-f.x,e.y-f.y)<146).length;
      if(!s.config.saberOnly&&measuredForceReady&&f.loadoutChosen&&d>120&&d<180&&f.energy>67&&rng(s)<.34)force=true;
      else if((f.formRules?['makashi','ataru','niman'].includes(f.form):f.archetype==='duelist')&&d>130&&d<(f.form==='niman'?182:230)&&(f.form!=='niman'||measuredForceReady)&&f.energy>34&&rng(s)<.68)heavy=true;
      else if(d<=def.pressure+12+(f.saberPhase==='long'?16:0)){
        const roleChance={vanguard:nearby>1?.86:.57,warden:enemy.action==='stagger'?.86:.52,duelist:.22};
        const byForm={shii_cho:nearby>1?.91:.42, makashi:.31, soresu:urgent?.75:.14, ataru:.50, djem_so:f.counterUntil>s.time?.93:.40, niman:measuredForceReady?.44:0, juyo:.32};
        const heavyChance=f.formRules?byForm[f.form]:roleChance[f.archetype];
        heavy=f.energy>32&&rng(s)<heavyChance;
        strike=!heavy;
      }
    }
  }
  if(elite){
    if(plannedDodge){roll=true;strike=false;heavy=false;force=false;}
    else if(opening&&!plannedBlock&&!urgent){
      f.decision=null;strike=true;heavy=false;force=false;
    }
  }
  // A rated opponent can exploit a real committed release/miss while it
  // is still ahead of schedule. It still has to reach with a legal move.
  const liveRatedOpening=arenaEdge>.19&&arenaIQ!.level>.45&&ready&&!urgent&&!danger&&
    !plannedBlock&&!plannedDodge&&!follow&&!obstructed&&!allyScreen&&aligned&&d<90&&f.energy>=19&&
    enemy.exposedBy==='whiff'&&(enemy.exposedUntil??0)>s.time+.16;
  if(liveRatedOpening){f.decision=null;strike=true;heavy=false;force=false;}
  if(!elite&&crowd>=2&&ready&&!obstructed&&!allyScreen&&!follow&&aligned&&f.energy>=24&&d<144){
    f.decision=null;strike=false;heavy=true;roll=false;force=false;
  }
  if(f.rankDominance>=10&&ready&&!obstructed&&!allyScreen&&!follow&&aligned&&d<112&&f.energy>=15&&f.decision!=='guard'){
    strike=!heavy;force=false;
  }
  if((forming||partnerLanding||coveringAfter)&&ready){strike=false;heavy=false;force=false;}
  // Cadence comes from reading the opponent, not cycling animation names:
  // a shielded rival invites a bait or another angle; exposed targets invite
  // a timed counter; unsafe committed attacks discourage an immediate swing.
  if(!elite&&matchedPeer&&ready&&threatened&&untilContact<.22&&f.energy>15&&enemy.action!=='force'){
    // Facing a real moving blade takes priority over a fresh attack. This
    // isn't a guaranteed parry; holding too early still drains stamina.
    if((def.guardAI??.4)>=.44&&f.reactedTo!==enemy.attackSerial){
      f.reactedTo=enemy.attackSerial;f.decision='guard';f.guardUntil=s.time+.25;
      strike=false;heavy=false;force=false;
      if(peerTactics)guardAim=aim+Math.sign(angleDelta(enemy.face,aim+Math.PI))*.28;
    }
  }
  // Strong reads commit a directional guard on the actual release rather
  // than just swinging more often. Commit once and only with real stamina.
  if(arenaEdge>.19&&arenaIQ!.level>.45&&ready&&threatened&&untilContact<.105&&untilContact>0&&
    aligned&&!danger&&!follow&&!obstructed&&!allyScreen&&enemy.action!=='force'&&f.guardLock<=0&&f.energy>21&&
    !plannedDodge&&f.action!=='guard'){
    f.reactedTo=enemy.attackSerial;f.decision='guard';f.guardUntil=Math.max(f.guardUntil??0,s.time+.16);
    strike=false;heavy=false;force=false;roll=false;guardAim=aim;
  }
  if(f.heroPlan==='defensive'&&rankAdvantage<5&&ready&&urgent&&aligned&&f.energy>12&&enemy.action!=='force'&&
     f.guardLock<=0){
    strike=false;heavy=false;force=false;f.decision='guard';f.guardUntil=s.time+.24;guardAim=aim;
  }
  if(peerTactics&&ready&&(strike||heavy)&&!force&&f.energy>26&&enemy.action==='guard'&&d>=63&&d<139&&
     (f.feintReadyAt??0)<=s.time&&(f.heroPlan==='aggressive'||(f.stats.saberSwings+f.slot+f.team)%3===1)){
    strike=false;heavy=false;feint=true;
  }
  let defensiveAim=null, guardingLane=null, slip=null, pressureGuard=false, pressureRecover=false;
  if(local){
    // Reading the attack in front is insufficient when a second live blade is
    // near release. Face the earlier commitment or leave the crossing arcs.
    if(danger&&ready&&danger.time<.22&&danger.d<160){strike=false;heavy=false;force=false;}
    const bearing=danger?.angle??aim;
    const split=local.imminent.some(t=>Math.abs(angleDelta(t.angle,bearing))>1.28);
    const soon=danger&&danger.time<.19;
    const readyToRecover=f.action==='stagger'&&f.actionDuration-f.actionTime<.15&&f.actionTime>.13&&f.airPhase!=='airborne'&&f.energy>=24&&(f.pressureRecoverAt??0)<s.time;
    const receding=atk(f),canSlipAfterRelease=receding&&f.contact&&f.actionTime>=receding.duration*.72&&
      f.actionTime>Math.max(receding.contact+(f.formRules?.115:.065),(receding.offhand?.contact??0)+.038)&&f.airPhase!=='airborne';
    const canRespond=ready&&f.actionDuration===0||readyToRecover||canSlipAfterRelease;
    if(soon&&canRespond&&f.guardLock===0){
      defensiveAim=bearing;
      const separated=local.threats.some(t=>Math.abs(angleDelta(t.angle,bearing))>1.50&&t.d<167);
      if((!isolated||danger.time<0.095)&&(canSlipAfterRelease||split||danger.o.action==='force'||separated&&f.energy>(isolated?30:45))&&f.energy>(isolated?25:32))
        slip=pressureFootwork(s,f,local,bearing);
      if(slip===null&&!canSlipAfterRelease&&f.energy>=11&&danger.o.action!=='force'){
        pressureGuard=true;
        if(isolated&&f.energy>14&&f.airPhase!=='airborne')guardingLane=pressureFootwork(s,f,local,bearing);
        f.decision=null;
      }
      if(slip!==null||pressureGuard){
        if(readyToRecover)pressureRecover=true;
        strike=false;heavy=false;force=false;roll=slip!==null;
      }
    }else if(ready&&local.closest<145&&!opening&&local.threats.some(t=>Math.abs(angleDelta(t.angle,aim))>1.15&&t.d<169)){
      // In a crossfire, don't throw a blind long heavy and hand both rivals a
      // free hit. Take the open lane or bank a quick strike if already close.
      if(d<95&&f.energy>20&&heavy&&local.imminent.length===0){strike=true;heavy=false;}
      if(!strike&&!force){
        const lane=pressureFootwork(s,f,local,aim);
        if(lane!==null){defensiveAim=lane;heavy=false;}
      }
    }
  }
  const aimClear=!obstructed&&!allyScreen&&!follow&&!turningToHit&&!forming&&!coveringAfter&&order!=='regroup';
  const customHero=Boolean(s.config.customHeroTactics&&s.config.rule==='elimination'&&f.heroId&&!f.control);
  if(customHero){
    const canExit=ready&&f.actionDuration===0&&f.action!=='guard'&&!plannedBlock&&!pressureGuard&&slip===null&&
      !danger&&!urgent&&!follow&&!turningToHit&&!opening&&f.airPhase==='grounded'&&local&&local.closest>=66&&local.closest<167;
    if(canExit&&(f.heroExit?.until??0)>s.time){
      const exit=f.heroExit!, dx=exit.x-f.x, dy=exit.y-f.y, distance=Math.hypot(dx,dy);
      if(distance>8&&!blockedBetween(s,f.x,f.y,exit.x,exit.y,f.radius)){
        return {x:dx/distance*.92,y:dy/distance*.92,aim};
      }
    }
    if(!canExit)f.heroExit=null;
    if(canExit&&(f.heroExitReadyAt??0)<=s.time){
      const exit=heroExitPath(s,f,local);
      if(exit){
        f.heroExit={...exit,until:s.time+.30};f.heroExitReadyAt=s.time+1.6;
        countMove(f,'hero_reposition');event(s,'hero_reposition',f,undefined,undefined,{destinationX:exit.x,destinationY:exit.y});
        return {x:Math.cos(exit.angle)*.92,y:Math.sin(exit.angle)*.92,aim};
      }
    }
  }

  const matchedLineups=s.config.teamSizes[0]===s.config.teamSizes[1];
  const chain=matchedLineups&&aimClear&&!roll&&!danger&&!pressureGuard?continuation(s,f,enemy,d,aligned,urgent):null;
  const canAnswer=matchedLineups&&aimClear&&ready&&!urgent&&!danger&&!roll&&aligned&&f.counterTarget===enemy.id&&
    f.counterUntil>s.time&&f.energy>=19&&d<105&&(f.formRules||f.heroId)&&Math.abs(rankAdvantage)<=4&&
    (enemy.action==='stagger'||enemy.exposedUntil!>s.time+.14);
  if(canAnswer){
    f.decision=null;strike=true;heavy=false;force=false;feint=false;
  }
  if(s.config.anticipatingCombat){
    const active=atk(f);
    const planWindow=active&&f.contact&&f.actionDuration-f.actionTime<=.26&&f.actionDuration>f.actionTime&&
      f.airPhase==='grounded'&&!['force','free_hand'].includes(f.action);
    if(f.saberOff||f.action==='stagger'||f.action==='clash'||f.action==='dash'||f.action==='ko'||
       f.decision==='guard'||!aimClear||urgent||danger||roll||pressureGuard||plannedBlock){
      f.nextExchange=null;
    }else if(planWindow&&d<158&&f.nextExchange?.serial!==f.attackSerial){
      // Read only visible travel and recovery. No knowledge of the rival's
      // cached AI choice, and no resource or parry privilege for a plan.
      const future=Math.hypot(enemy.x-f.x+(enemy.vx-f.vx)*.16,enemy.y-f.y+(enemy.vy-f.vy)*.16);
      const push=enemy.exposedUntil!>s.time+.21||enemy.action==='stagger';
      const prefersHeavy=push&&f.energy>=49&&future>72&&future<106&&f.form!=='soresu';
      f.nextExchange={target:enemy.id,serial:f.attackSerial,expires:s.time+.77,heavy:prefersHeavy};
    }
    const plan=f.nextExchange;
    if(plan&&(plan.target!==enemy.id||plan.expires<=s.time))f.nextExchange=null;
    else if(plan&&ready&&f.actionDuration===0&&!strike&&!heavy&&!force&&!feint&&!chain&&!canAnswer&&
      f.airPhase==='grounded'&&aligned&&f.guardLock===0&&f.energy>=19&&s.time>=(f.eliteReady??0)){
      const style=f.chessStyle,promoted=f.chessPawn?.promoted===true;
      const fit=arcadeChessMove(style,{reach:88*(def.reach??1),arc:1.12,cost:7},{promoted});
      const relative={bearing:aim,face:aim,targetFace:enemy.face,promoted,distance:d,styleTravel:s.config.styleTravel};
      if(d<=fit.reach+enemy.radius-15&&(!style||arcadeChessAllowsLane(style,relative))){
        heavy=plan.heavy&&f.energy>=39&&d>=64;
        strike=!heavy;
        f.nextExchange=null;
      }
    }
  }
  const authoredChoice=(strike||heavy||force)&&ready?rankTechnique(s,f,enemy,force?'force':heavy?'heavy':'light',crowd):null;
  let technique=canAnswer&&ARCADE_TECHNIQUES[authoredChoice!]?.role!=='counter'
    ?(f.career.gradeIndex>=8||f.form==='djem_so'?'riposte':'slash')
    :authoredChoice;
  let advanced=null;
  if(s.config.advancedArena&&aimClear&&matchedLineups&&Math.abs(rankAdvantage)<=3&&
     !urgent&&!danger&&!roll&&!pressureGuard&&!feint&&!force&&!chain&&f.airPhase==='grounded'&&
     f.career.gradeIndex>=5&&(f.advancedReadyAt??0)<=s.time){
    const active=atk(f);
    const completedMiss=active&&f.releaseOutcome==='miss'&&f.actionTime>=active.duration*.90&&
      chainWindow(s,f,active)&&f.chainDepth!<chainLimit(f);
    const realParry=ready&&f.actionDuration===0&&f.parryCounterUntil!>s.time&&f.counterTarget===enemy.id;
    const advancedTravel=ready&&f.actionDuration===0&&f.advancedTravel?.until!>s.time;
    const trigger=realParry?'parry':completedMiss?'whiff':advancedTravel?'travel':null;
    if(trigger){
      const moves=arcadeMovesFor(f.form,f.career.gradeIndex,{tactical:true,rankCuts:true,circuitCuts:s.config.circuitCuts,arenaCuts:s.config.arenaCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves}).filter(m=>m.tactical!=='feint_redirect');
      const wind=incoming&&!enemy.contact?Math.max(0,incoming.contact-enemy.actionTime):Infinity;
      const move=chooseAdvancedFollowup(moves,{advancedArena:true,rank:f.career.gradeIndex,trigger,
        previous:active?{...active,id:f.attack!}:undefined,window:realParry?f.parryCounterUntil!-s.time:undefined,
        previousId:f.attack??f.attackChoices?.at(-1)?.id??f.advancedTravel?.id,
        distance:d,line:Math.abs(angleDelta(aim,f.face)),wind,energy:f.energy,
        side:angleDelta(aim+Math.PI,enemy.guardBearing??enemy.face),guarded:enemy.action==='guard',crowd});
      if(move&&ARCADE_TECHNIQUES[move!]?.tactical!=='feint_redirect')advanced={move,trigger};
    }
  }
  let strikeAim=aim;
  if(technique&&ARCADE_TECHNIQUES[technique!]?.role==='crowd'){
    let dx=0,dy=0;
    for(const e of s.fighters)if(e.alive&&e.team!==f.team){
      const d=Math.hypot(e.x-f.x,e.y-f.y), toward=Math.atan2(e.y-f.y,e.x-f.x);
      if(d<158&&Math.abs(angleDelta(toward,aim))<1.1){dx+=Math.cos(toward);dy+=Math.sin(toward);}
    }
    if(dx||dy)strikeAim=Math.atan2(dy,dx);
  }
  const orbit=(def.orbit??(f.archetype==='duelist'?1:f.archetype==='warden'?.74:.39))*(f.slot%2===0?1:-1);
  const pocket=f.formRules?(f.form==='makashi'?91:f.form==='niman'?s.elitePacing?87:108:f.form==='soresu'?64:f.form==='juyo'?60:74):74;
  const ideal=pocket+(doctrine==='defensive'?f.heroId?23:17:doctrine==='aggressive'?-15:0)+(elite?9:crowd>=2?-15:0);
  const initiative=matchedLineups&&f.formRules&&Math.abs(rankAdvantage)<=4&&d>46&&d<156&&aimClear&&!urgent&&
    !enemy.attack&&(f.releaseOutcome==='landed'&&f.actionTime<f.actionDuration+.12||f.counterUntil>s.time);
  let advance=initiative&&!guardingLane&&!forming?.62:guardingLane!==null?.55:forming&&d<153?-.1:local&&local.closest<125&&!strike&&!force&&!heavy&&!follow&&!obstructed?-.18:allyScreen&&!lane&&!follow&&!obstructed?.04:follow?(distanceToGoal<18?0:1):detour||obstructed?1:urgent&&rankAdvantage<6&&!strike&&!heavy?-.42:d>def.pressure+10?1:d<ideal-22?-.33:clamp((d-ideal)/34,-.28,.56);
  const latePressure=s.config.matchGoalPlanning&&f.matchGoal==='win'&&s.limit-s.time<Math.min(12,s.limit*.29);
  if(latePressure&&d>90&&aimClear&&!urgent&&!danger&&!guardingLane&&f.energy>=22)
    advance=Math.max(advance,d>123?.91:.55);
  if(turningToHit&&!danger){
    // Awareness can turn or step, but cannot snap into a new rear guard
    // or a counter before the feet and weapon catch up.
    strike=false;heavy=false;force=false;feint=false;roll=false;pressureGuard=false;
    f.decision=null;guardAim=null;
  }
  if(feint&&(pressureGuard||roll||danger))feint=false;
  if((plannedBlock||pressureGuard)&&guardAim===null&&(peerTactics||isolated))
    guardAim=defensiveAim??aim;
  const evade=roll&&!s.elitePacing&&f.rankCombat.index>=3?
    (f.form==='makashi'||f.form==='soresu'||f.form==='djem_so'?'backstep':'sidestep'):null;
  const angle=guardingLane??slip??(travelAim+(roll?Math.sign(orbit)*(elite?2.0:evade==='backstep'?2.67:1.52):0));
  if(s.config.matchGoalPlanning&&f.matchGoal==='draw'&&ready&&f.actionDuration===0&&f.airPhase==='grounded'&&
     aimClear&&d<136&&!urgent&&!danger&&!plannedBlock&&!pressureGuard&&!roll&&!opening&&!canAnswer&&f.decision!=='guard'){
    const space=clockSpacing(s,f,enemy,aim,d,orbit);
    if(space)return space;
  }
  let strafe=guardingLane!==null?0:obstructed||follow||detour?0:forming?Math.sign(orbit)*.68:d>185?.10:orbit*(urgent?.70:d>ideal+22?.14:.24);
  if(f.chessStyle&&!obstructed&&!follow&&!detour&&ready&&!urgent&&!danger&&!roll&&!pressureGuard&&d<170){
    const promoted=f.chessPawn?.promoted===true;
    const effective=promoted&&f.chessStyle==='pawn'?'queen':f.chessStyle;
    // Only approach geometry changes; actual attacks keep the form, rank,
    // weapon and timing already selected. An opening still takes priority.
    if(!initiative&&!forming&&!coveringAfter&&!opening&&!canAnswer&&f.decision!=='guard'){
      const shift=effective==='king'?-18:effective==='pawn'?-13:effective==='rook'?15:effective==='queen'?9:effective==='bishop'?5:-7;
      const target=clamp(ideal+shift,54,137);
      advance=clamp((d-target)/31,-.39,.82);
      if(effective==='rook')strafe*=.44;
      else if(effective==='knight')strafe=clamp(strafe*1.30,-.84,.84);
    }
    const relative={bearing:aim,face:aim,targetFace:enemy.face,promoted,distance:d,styleTravel:s.config.styleTravel};
    let wanted=arcadeChessDesiredBearing(f.chessStyle,relative);
    if((f.chessStyle==='rook'||f.chessStyle==='bishop')&&d>36){
      const future=Math.atan2(enemy.y-f.y+(enemy.vy-f.vy)*.13,enemy.x-f.x+(enemy.vx-f.vx)*.13);
      if(wanted===aim&&!arcadeChessAllowsLane(f.chessStyle,{...relative,bearing:future})){
        wanted=arcadeChessDesiredBearing(f.chessStyle,{...relative,bearing:future});
      }
    }
    const turn=finite(wanted)?angleDelta(wanted,aim):0;
    if(Math.abs(turn)>.08){
      strafe=clamp(-turn*2,-.90,.90);
      // Orbit to a legal lane. For a constantly tracking opponent, allow the
      // short check window to be reached instead of circling indefinitely.
      if(d<82&&f.chessStyle!=='knight')advance=Math.min(.10,advance);
      else if(f.chessStyle==='knight')advance=Math.max(.36,advance);
      if(!force&&(strike||heavy)&&!arcadeChessAllowsLane(f.chessStyle,relative))strike=heavy=false;
    }
  }
  if(s.config.continuousCombat&&ready&&f.actionDuration===0&&f.airPhase==='grounded'&&
     !urgent&&!danger&&!roll&&!pressureGuard&&!plannedBlock&&!turningToHit&&
     !obstructed&&!follow&&!detour&&!allyScreen&&!forming&&!coveringAfter&&f.guardLock===0&&f.decision!=='guard'&&d<185){
    const style=f.chessStyle, promoted=f.chessPawn?.promoted===true;
    const relative={bearing:aim,face:aim,targetFace:enemy.face,promoted,distance:d,styleTravel:s.config.styleTravel};
    const legal=!style||arcadeChessAllowsLane(style,relative);
    const base=arcadeChessMove(style,{reach:88*(def.reach??1),arc:1.12,cost:7},{promoted});
    const strikeWindow=base.reach+enemy.radius-12;
    if(legal){
      // Cross the pocket instead of indefinitely matching the opponent's orbit.
      if(d>strikeWindow*.85&&d<151)advance=Math.max(advance,.47);
      if(d>=41&&d<=strikeWindow&&aligned&&!strike&&!heavy&&!force&&!feint&&!advanced&&!canAnswer&&
         f.energy>=23&&s.time>=(f.engageAt??0)&&s.time>=(f.eliteReady??0)){
        strike=true;
        f.engageAt=s.time+.88;
      }
    }else{
      // Steer to an actual legal sector, without stalling at its boundary.
      const preferred=arcadeChessDesiredBearing(style,relative);
      const turn=angleDelta(preferred!,aim);
      if(finite(turn)&&Math.abs(turn)>.08)strafe=clamp(-turn*2.6,-.92,.92);
      if(style==='knight')advance=Math.max(advance,d>49?.69:.29);
      else if(d<67)advance=Math.min(advance,.06);
      else if(d>96)advance=Math.max(advance,.31);
    }
  }
  if(s.config.anticipatingCombat&&!follow&&!detour&&!forming&&!coveringAfter&&
     !urgent&&!danger&&!pressureGuard&&!plannedBlock&&!roll&&!turningToHit&&f.decision!=='guard'&&
     ready&&f.actionDuration===0&&f.airPhase==='grounded'&&d<166&&d>40){
    const planned=f.nextExchange?.target===enemy.id;
    const room=!f.chessStyle||arcadeChessAllowsLane(f.chessStyle,{bearing:aim,face:aim,targetFace:enemy.face,
      promoted:f.chessPawn?.promoted===true,distance:d,styleTravel:s.config.styleTravel});
    if(room&&d>68&&planned&&!obstructed&&!allyScreen)advance=Math.max(.36,advance);
    const crowdedStep=s.config.teamSizes[f.team]>1&&f.groundSpeed<9;
    if(!strike&&!heavy&&!force&&!feint&&(crowdedStep||Math.hypot(advance,strafe)<.27)){
      // Pick a reachable step on either side before stopping; don't move
      // through the occupied foot lane, wall, ally or collision boundaries.
      const sign=Math.sign(strafe)||Math.sign(orbit)||1;
      for(const side of [sign,-sign]){
        const bearing=aim+side*Math.PI/2, x=f.x+Math.cos(bearing)*23,y=f.y+Math.sin(bearing)*23;
        const b=s.bounds;
        if(x<b.minX||x>b.maxX||y<b.minY||y>b.maxY||!openAt(s,x,y,f.radius)||blockedBetween(s,f.x,f.y,x,y,f.radius))continue;
        if(crowdedStep&&bodyMotionFraction(s,f,f.x,f.y,x,y)<.72)continue;
        strafe=side*(crowdedStep?.53:planned?.42:.31);
        if(crowdedStep)advance=clamp(advance,-.12,.16);
        break;
      }
    }
  }
  if(s.config.activeFootwork&&ready&&f.actionDuration===0&&f.airPhase==='grounded'&&d<Math.max(43,f.radius+enemy.radius+11)&&
     !urgent&&!danger&&!follow&&!roll&&!plannedBlock&&!pressureGuard&&!turningToHit&&!forming&&
     !canAnswer&&!advanced&&!isArcadeCarrier(s,f)&&f.decision!=='guard'){
    const legal=!f.chessStyle||arcadeChessAllowsLane(f.chessStyle,{bearing:aim,face:aim,targetFace:enemy.face,
      promoted:f.chessPawn?.promoted===true,distance:d,styleTravel:s.config.styleTravel});
    if(!obstructed&&!allyScreen&&legal&&Math.abs(angleDelta(aim,f.face))<.64&&f.guardLock<=0&&f.energy>=12&&
       s.time>=(f.closeActionAt??0)&&!strike&&!heavy&&!force&&!feint){
      strike=true;
      f.closeActionAt=s.time+.35;
    }else{
      const want=f.chessStyle&&!legal?arcadeChessDesiredBearing(f.chessStyle,{bearing:aim,face:aim,targetFace:enemy.face,
        promoted:f.chessPawn?.promoted===true,distance:d,styleTravel:s.config.styleTravel}):aim;
      const toward=-Math.sign(angleDelta(want!,aim))||Math.sign(orbit)||1;
      for(const side of [toward,-toward]){
        if(!footworkPath(s,f,aim+side*1.86,28))continue;
        advance=-.13;strafe=side*.77;break;
      }
    }
  }
  if(f.peasantMotion&&ready&&f.actionDuration===0&&f.airPhase==='grounded'&&
    d>48&&d<138&&!danger&&!urgent&&!incoming&&!roll&&!pressureGuard&&!plannedBlock&&
    !follow&&!detour&&!obstructed&&!forming&&!coveringAfter&&!strike&&!heavy&&!force&&!feint&&!advanced&&
    f.decision!=='guard'&&Math.hypot(advance,strafe)<.39&&f.groundSpeed<27){
    // An actionable pause becomes a deliberate half-step, not a cancelled recovery.
    const side=Math.sign(strafe)||Math.sign(orbit)||1;
    const lean=f.form==='soresu'||f.form==='makashi'?-.09:.18;
    for(const flank of [side,-side]){
      if(!footworkPath(s,f,aim+flank*(Math.PI/2-lean),25))continue;
      advance=lean;strafe=flank*.48;break;
    }
  }
  const keepAuthoredAir=s.config.repertoireSupport&&Boolean((ARCADE_TECHNIQUES[technique!]?.arenaCut||ARCADE_TECHNIQUES[technique!]?.exchangeCut)&&ARCADE_TECHNIQUES[technique!]?.air);
  const jumpPlan=s.config.activeFootwork&&!keepAuthoredAir&&ready&&!pressureGuard&&!plannedBlock&&!canAnswer&&!advanced&&!chain&&
    !feint&&!force&&!roll&&f.decision!=='guard'?tacticalJump(s,f,enemy,{d,aim,orbit,incoming,untilContact,obstructed,follow,allyScreen}):null;
  const activeJump=s.config.fluidFootwork&&s.config.teamSizes[0]===s.config.teamSizes[1]&&jumpPlan?.purpose==='cross'&&
    (strike||heavy)&&d<=95?null:jumpPlan;
  if(activeJump){strike=false;heavy=false;}
  // Rare lateral vault in squad Watch: replace an already selected dodge,
  // never generate a free evade or perturb duel/tournament RNG.
  const wantsVault=!s.config.activeFootwork&&roll&&ready&&f.actionDuration===0&&f.action!=='guard'&&f.decision!=='guard'&&
    s.mode==='watch'&&!s.elitePacing&&!s.eliteCrossfire&&s.config.teamSizes.every(n=>n>=2)&&
    f.formRules&&f.form!=='ataru'&&f.rankCombat.index>=4&&f.energy>=33&&!f.aiVaultUsed&&s.time>(f.jumpReadyAt??0)&&
    !obstructed&&!allyScreen&&!follow&&incoming&&incoming.arc>=1.08&&d>=incoming.reach*.63&&
    (enemy.attackSerial!+f.slot*31+f.team*7)%4===0;
  let vaultExit=false;
  if(wantsVault){
    const tx=f.x+Math.cos(angle)*61,ty=f.y+Math.sin(angle)*61;
    const clear=tx>=s.bounds.minX&&tx<=s.bounds.maxX&&ty>=s.bounds.minY&&ty<=s.bounds.maxY&&
      !blockedBetween(s,f.x,f.y,tx,ty,f.radius)&&!allyInLane(s,f,tx,ty);
    vaultExit=Boolean(clear);
  }
  // A rare, already-open squad approach can use the form's airborne entry.
  // Never force a jump through a screened lane or alter ranked 1v1 pacing.
  const airEntry=!s.config.activeFootwork&&(strike||heavy)&&ready&&f.actionDuration===0&&s.mode==='watch'&&
    s.config.teamSizes.every(n=>n>=2)&&!s.elitePacing&&!f.aiAirEntryUsed&&f.formRules&&
    f.career.gradeIndex>=8&&Math.abs(rankAdvantage)<=3&&f.energy>=51&&
    !urgent&&!roll&&!follow&&!obstructed&&!allyScreen&&
    enemy.action==='stagger'&&enemy.actionDuration-enemy.actionTime>.17&&d>=71&&d<=111&&
    (f.stats.saberSwings+f.slot*3+f.team)%4===2;
  if(airEntry){strike=false;heavy=false;}
  // A deployed Hero may choose the blade-off variant when baiting a guarding
  // opponent in a clear lane, never as an emergency defense or free hit.
  const freshGuard=enemy.action==='guard'&&enemy.actionTime>=.18&&enemy.parryTime<=0;
  const safeRecovery=enemy.exposedBy==='whiff'&&enemy.exposedUntil!>s.time+.34&&
    (enemy.attackSerial??0)%3===((f.slot+f.team)%3)&&!local;
  const trakataOpportunity=customHero&&aimClear&&ready&&f.actionDuration===0&&aligned&&
    !danger&&!urgent&&!roll&&!pressureGuard&&!plannedBlock&&f.decision!=='guard'&&!chain&&!canAnswer&&!advanced&&!airEntry&&!vaultExit&&!activeJump&&
    (freshGuard||safeRecovery)&&f.energy>=67;
  const trakata=f.heroId&&(feint||trakataOpportunity)&&!danger&&d>=69&&d<=107&&f.energy>=64&&(f.trakataReadyAt??0)<=s.time;
  if(trakata){feint=false;if(customHero){strike=false;heavy=false;force=false;}}
  // Upgrade only an intentional, non-panic retreat already selected by the
  // combat AI. Preserve unequal-rank defenses and emergency crossfire exits.
  const footworkSerial=(enemy.attackSerial??s.tick)+f.slot*7+f.team*11;
  let rankFootwork=null;
  const prepared=untilContact>.073&&roll&&footworkSerial%3===0;
  const claimable=enemy.exposedBy==='whiff'&&enemy.exposedUntil!>s.time+.18&&d>=78&&d<153&&footworkSerial%5===1;
  const circleGuard=enemy.action==='guard'&&enemy.parryTime>.085&&d>=105&&d<146&&
    f.decision!=='guard'&&(s.tick+f.slot*31+f.team*7)%19===14;
  const reclaim=!roll&&!strike&&!heavy&&!force&&!feint&&!trakata&&!airEntry&&!activeJump&&f.career.gradeIndex>=8&&(claimable||circleGuard);
  if((prepared||reclaim)&&ready&&!danger&&!pressureGuard&&!vaultExit&&!follow&&!obstructed&&!allyScreen&&
     !s.eliteCrossfire&&matchedLineups&&Math.abs(rankAdvantage)<=2&&f.formRules&&
     f.energy>33&&(f.footworkReadyAt??0)<=s.time){
    const spec=planPeerFootwork(f.career.gradeIndex,{form:f.form,danger:untilContact<.18,
      retreat:d<93,serial:Math.floor(footworkSerial/3)});
    if(spec){
      const side=Math.sign(orbit),bearing=aim+side*spec.lane;
      const tx=f.x+Math.cos(bearing)*54,ty=f.y+Math.sin(bearing)*54;
      if(tx>=s.bounds.minX+8&&tx<=s.bounds.maxX-8&&ty>=s.bounds.minY+8&&ty<=s.bounds.maxY-8&&
         !blockedBetween(s,f.x,f.y,tx,ty,f.radius)&&!allyInLane(s,f,tx,ty))
        rankFootwork={id:spec.id,face:aim,side};
    }
  }
  if(s.config.expandedCombat&&!s.config.saberOnly&&!f.control&&aimClear&&ready&&f.actionDuration===0&&
      f.airPhase==='grounded'&&!roll&&!urgent&&!danger&&!feint&&!trakata&&!advanced&&!pressureGuard&&!canAnswer&&!activeJump&&
      f.decision!=='guard'&&(f.expandedReadyAt??0)<=s.time&&f.energy>=24&&Math.abs(rankAdvantage)<=4&&
      (s.tick+f.slot*9+f.team*7)%13===6){
    const close=enemy.action==='stagger'||enemy.exposedUntil!>s.time+.24||
      d<73&&!incoming&&enemy.action!=='guard'&&Math.abs(angleDelta(aim,f.face))<.56&&f.energy>=32;
    const locked=enemy.action==='guard'&&enemy.energy<=40;
    const wardWindow=threatened&&untilContact>.355&&untilContact<.56&&f.career.gradeIndex>=10&&
      !(f.wardUntil!>s.time&&f.wardCharges!>0)&&f.energy>=45;
    const echoWindow=locked&&d>=91&&d<127&&f.career.gradeIndex>=7&&f.energy>=57&&
      !incoming&&(s.tick+f.slot*7+f.team)%3===0;
    const first=wardWindow?'force_lattice':echoWindow?'force_echo_step':
      close&&d<71&&f.gear.weapon!=='dual'?f.career.gradeIndex>=7&&Math.abs(angleDelta(aim,f.face))<.5?'unarmed_low_check':
        f.career.gradeIndex>=4&&d>55?'unarmed_hook':'unarmed_palm':
      d<85&&d>49&&f.career.gradeIndex>=11&&f.energy>=53&&
        s.fighters.some(o=>o!==enemy&&o.alive&&o.team!==f.team&&Math.hypot(o.x-f.x,o.y-f.y)<90)?'unarmed_spin':
      d<95&&d>45&&enemy.action==='run'&&f.career.gradeIndex>=5?'force_veil':
      d>69&&d<130&&enemy.action!=='guard'&&enemy.energy>=31&&f.energy<57&&f.career.gradeIndex>=13?'force_siphon':
      d>89&&d<136&&enemy.action==='run'?'force_anchor':
      d>58&&d<87&&locked?'force_arc_wave':null;
    const selected=expandedMove(s,f,first);
    if(selected){
      if(echoWindow){
        const bearing=aim+Math.sign(orbit)*1.22,x=f.x+Math.cos(bearing)*44,y=f.y+Math.sin(bearing)*44;
        if(!blockedBetween(s,f.x,f.y,x,y,f.radius)&&!allyInLane(s,f,x,y))
          return {expandedMove:selected.id,expandedAim:bearing,aim};
      }else return {expandedMove:selected.id,expandedAim:aim,aim};
    }
  }
  if(s.config.repertoireSupport&&s.config.arenaCuts&&ready&&f.actionDuration===0&&aimClear&&
      !urgent&&!danger&&!roll&&!pressureGuard&&!plannedBlock&&!advanced&&!canAnswer&&!chain&&!force&&!feint&&
      !trakata&&!vaultExit&&!airEntry&&!activeJump&&f.decision!=='guard'&&f.guardLock===0&&aligned&&
      f.energy>=26&&s.time>=(f.eliteReady??0)&&s.time>=(f.repertoireReadyAt??0)){
    const moves=arcadeMovesFor(f.form,f.career.gradeIndex,{tactical:true,rankCuts:true,circuitCuts:s.config.circuitCuts,arenaCuts:true,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves});
    const guardedWindow=f.form==='soresu'&&threatened&&untilContact>=.16&&untilContact<=.26;
    const counterWindow=f.counterTarget===enemy.id&&f.counterUntil>s.time&&
      (enemy.action==='stagger'||enemy.exposedUntil!>s.time+.16);
    const openAir=f.form==='ataru'&&(enemy.action==='run'||enemy.exposedUntil!>s.time+.24||enemy.action==='stagger');
    const heavyWindow=['shii_cho','djem_so','juyo','niman'].includes(f.form)&&
      ((enemy.action==='guard'&&enemy.parryTime<=0&&enemy.energy<42&&f.energy>=39)||
       (enemy.action==='stagger'&&enemy.actionDuration-enemy.actionTime>.38)||enemy.exposedUntil!>s.time+.38);
    const routed=guardedWindow||counterWindow?situationalRepertoire(s,f,enemy,moves,'counter',d):
      openAir||heavyWindow?situationalRepertoire(s,f,enemy,moves,'heavy',d):null;
    if(routed){
      technique=routed;strike=true;heavy=false;
      const preferred=f.combatHabit==='opening_reader'&&guardedWindow||
        f.combatHabit==='lane_builder'&&openAir||f.combatHabit==='tempo_keeper'&&counterWindow;
      f.repertoireReadyAt=s.time+(preferred?.74:.88);
    }
  }
  // Late movement steering can schedule an opening after the earlier
  // chooser ran; resolve it against the same repertoire before releasing.
  if(s.config.arenaCuts&&ready&&!technique&&!force&&(strike||heavy)&&!roll&&!pressureGuard&&!plannedBlock&&!trakata&&!vaultExit&&!airEntry)
    technique=rankTechnique(s,f,enemy,heavy?'heavy':'light',crowd);
  if(f.liveEntry&&matchedLineups&&aimClear&&ready&&f.actionDuration===0&&
     (strike||heavy)&&!force&&!feint&&!chain&&!activeJump&&!vaultExit&&!airEntry&&!roll&&!pressureGuard&&!plannedBlock&&
     !canAnswer&&!advanced&&!trakata&&f.action!=='guard'&&f.decision!=='guard'){
    const fallback=ARCADE_TECHNIQUES[technique!]??attackByName(technique)??ARCADE_ATTACKS.slash;
    const stride=liveGroundEntry(f,aim,fallback,null,false);
    if(stride&&stride.kind!=='pivot'&&(!technique||!ARCADE_TECHNIQUES[technique!]?.tactical&&!ARCADE_TECHNIQUES[technique!]?.air)){
      const aimedAngle=angleDelta(aim,f.face), promoted=f.chessPawn?.promoted===true;
      const role=heavy?'heavy':'light';
      const desire=stride.kind==='advance'&&d>=75&&f.form==='makashi'?'thrust':stride.kind==='lateral'?'sweep':
        stride.kind==='retreat'?(f.form==='soresu'?'screen':'cut'):null;
      if(desire&&f.energy>=28&&Math.abs(aimedAngle)<.56&&(!f.chessStyle||arcadeChessAllowsLane(f.chessStyle,
        {bearing:aim,face:aim,targetFace:enemy.face,distance:d,promoted,styleTravel:s.config.styleTravel}))){
        const moves=arcadeMovesFor(f.form,f.career.gradeIndex,{rankCuts:true,arenaCuts:s.config.arenaCuts,
          circuitCuts:s.config.circuitCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves});
        const fitted=moves.filter(m=>m.role===role&&!m.air&&!m.tactical&&m.mapAction!=='force'&&m.cost<=f.energy-5&&
          m.contact<=fallback.contact+.045&&d<=arcadeChessMove(f.chessStyle,m,{promoted}).reach+5&&
          arcadeAttackPresentation(m.id,m,m.mapAction).family===desire);
        fitted.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||Math.abs(a.reach-d)-Math.abs(b.reach-d));
        if(fitted[0])technique=fitted[0].id;
      }
    }
  }
  if(f.recoveryFlow&&matchedLineups&&ready&&!pressureGuard&&!plannedBlock&&!roll&&!advanced&&!canAnswer&&!chain&&
     !trakata&&!activeJump&&!vaultExit&&!airEntry&&!force&&!feint){
    const recovery=recoveryIntent(s,f,enemy,{d,aim,orbit,untilContact,threatened:Boolean(threatened),clear:aimClear&&!danger});
    if(recovery)return recovery;
    const plan=f.impactRecovery!;
    if(plan?.target===enemy.id&&plan.serial===f.attackSerial&&s.time-plan!.at>=plan!.duration&&s.time-plan!.at<plan!.duration+.33&&
       (strike||heavy)&&aimClear&&aligned&&!urgent&&f.actionDuration===0&&plan.last?.id){
      const promoted=f.chessPawn?.promoted===true,style=f.chessStyle;
      const relative={bearing:aim,face:aim,targetFace:enemy.face,distance:d,promoted,styleTravel:s.config.styleTravel};
      if(!style||arcadeChessAllowsLane(style,relative)){
        const role=heavy?'heavy':'light';
        const options=arcadeMovesFor(f.form,f.career.gradeIndex,{rankCuts:true,arenaCuts:s.config.arenaCuts,
          circuitCuts:s.config.circuitCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves}).filter(m=>m.role===role&&
            m.id!==plan.last!.id&&!m.air&&!m.tactical&&m.mapAction!=='force'&&m.cost<=f.energy-5&&
            m.contact<.37&&d<=arcadeChessMove(style,m,{promoted}).reach+5&&
            arcadeAttackPresentation(m.id,m,m.mapAction).family!==plan.last!.family);
        options.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||a.contact-b.contact);
        if(options[0]){technique=options[0].id;plan.followup=technique;}
      }
    }
  }
  if(s.config.balancePass&&matchedLineups&&ready&&f.actionDuration===0&&aimClear&&aligned&&f.airPhase==='grounded'&&
    !urgent&&!danger&&!roll&&!pressureGuard&&!plannedBlock&&!canAnswer&&!chain&&!advanced&&!trakata&&
    !activeJump&&!vaultExit&&!airEntry&&!force&&!feint&&f.decision!=='guard'&&f.guardLock===0&&s.time>=(f.eliteReady??0)){
    const varied=selectBalanceEntry(s,f,enemy,{d,aim,incoming,formChoice:technique,role:heavy?'heavy':'light',planned:strike||heavy});
    if(varied){technique=varied;strike=true;heavy=false;}
  }
  if(s.config.closeChoice&&matchedLineups&&f.form==='makashi'&&technique==='mk_wrist_cut'&&
    (strike||heavy)&&f.actionDuration===0&&f.airPhase==='grounded'&&aimClear&&!f.saberOff&&
    !force&&!feint&&!advanced&&!canAnswer&&!chain&&!urgent&&!danger&&!roll&&!pressureGuard&&!plannedBlock&&
    !trakata&&!activeJump&&!vaultExit&&!airEntry&&f.decision!=='guard'&&f.guardLock===0&&enemy.action!=='guard'){
    // Wrist Cut covers a broad moving line. A settled inside line sometimes
    // permits a quick point instead, but without stealing the original swing
    // if the narrow blade cannot realistically reach in time.
    const current=ARCADE_TECHNIQUES.mk_wrist_cut;
    const line=Math.abs(angleDelta(aim,f.face)), dx=enemy.vx-f.vx,dy=enemy.vy-f.vy;
    const cross=Math.abs(-Math.sin(aim)*dx+Math.cos(aim)*dy);
    const drift=dx*Math.cos(aim)+dy*Math.sin(aim);
    const predicted=d+clamp(drift*.18,-8,12);
    const promoted=f.chessPawn?.promoted===true,style=f.chessStyle;
    if(d>=55&&d<=103&&line<=.28&&cross<=57&&f.energy>=17&&
       (f.moves[current.id]??0)>=2&&(!incoming||enemy.contact&&(!incoming.offhand||enemy.offhandContact))&&
       (!style||arcadeChessAllowsLane(style,{bearing:aim,face:aim,targetFace:enemy.face,promoted,distance:d,styleTravel:s.config.styleTravel}))){
      const grip=f.gear.grip==='backhand'?.88:f.gear.weapon==='staff'?.95:1;
      const options=arcadeMovesFor('makashi',f.career.gradeIndex,{rankCuts:true,arenaCuts:s.config.arenaCuts,
        circuitCuts:s.config.circuitCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves}).filter(m=>{
        if(m.role!=='light'||m.id===current.id||m.tactical||m.air||m.cost>current.cost+2||
          m.contact>current.contact+.025||arcadeAttackPresentation(m.id,m,m.mapAction).family!=='thrust'||
          (f.moves[m.id]??0)>=(f.moves[current.id]??0)-1||f.attackChoices?.at(-1)?.id===m.id)return false;
        const fit=arcadeChessMove(style,m,{promoted});
        return predicted<=fit.reach*grip+enemy.radius*.18&&cross*.16/Math.max(55,d)+line*.28<fit.arc*.72;
      });
      options.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||a.contact-b.contact||a.id.localeCompare(b.id));
      if(options[0]){
        technique=options[0].id;
        f.closeAlternate={id:technique,at:s.time};
      }
    }
  }
  if(s.config.guardCounterplay&&matchedLineups&&Math.abs(rankAdvantage)<=2&&
    ready&&f.actionDuration===0&&aimClear&&aligned&&f.airPhase==='grounded'&&
    !urgent&&!danger&&!roll&&!pressureGuard&&!plannedBlock&&!canAnswer&&!chain&&!advanced&&!trakata&&
    !activeJump&&!vaultExit&&!airEntry&&!force&&!feint&&f.decision!=='guard'&&f.guardLock===0&&
    s.time>=(f.eliteReady??0)&&enemy.action==='guard'&&enemy.parryTime<=0&&enemy.actionTime>=.155&&
    f.heldGuardOpening?.target===enemy.id&&Math.abs(f.heldGuardOpening.guardStart-(s.time-enemy.actionTime))<.025&&f.heldGuardOpening.count>=2&&s.time-f.heldGuardOpening.at<2.45&&
    f.energy>=33&&enemy.energy>=12&&enemy.energy<=59&&d>=55&&d<=110){
    const style=f.chessStyle,promoted=f.chessPawn?.promoted===true;
    const legal=!style||arcadeChessAllowsLane(style,{bearing:aim,face:aim,targetFace:enemy.face,promoted,distance:d,styleTravel:s.config.styleTravel});
    if(legal){
      const kit=f.gear.grip==='backhand'?.88:f.gear.weapon==='staff'?.95:1;
      const candidates=arcadeMovesFor(f.form,f.career.gradeIndex,{rankCuts:true,arenaCuts:s.config.arenaCuts,
        circuitCuts:s.config.circuitCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves}).filter(m=>m.role==='heavy'&&
          m.mapAction!=='force'&&!m.air&&!m.tactical&&m.cost<=f.energy-8&&m.contact<=.39&&
          d<=arcadeChessMove(style,m,{promoted}).reach*kit+3);
      candidates.sort((a,b)=>b.damage-a.damage||a.contact-b.contact);
      if(candidates[0]){technique=candidates[0].id;heavy=true;strike=false;}
    }
  }
  const readStop=s.config.guardCounterplay&&f.guardLaneChange;
  if(matchedLineups&&readStop?.target===enemy.id&&s.time<readStop.until&&f.actionDuration===0&&
     f.airPhase==='grounded'&&!urgent&&!danger&&!roll&&!pressureGuard&&!plannedBlock&&!canAnswer&&!advanced&&!trakata&&f.decision!=='guard'&&aimClear&&
     footworkPath(s,f,readStop.bearing,12)){
    return {x:Math.cos(readStop.bearing)*.63,y:Math.sin(readStop.bearing)*.63,aim};
  }
  if(s.config.guardCounterplay&&matchedLineups&&Math.abs(rankAdvantage)<=2&&f.lastGuardParry?.by===enemy.id&&
     s.time-f.lastGuardParry.at<=2.55&&f.lastGuardParry.at>(f.guardLaneChange?.readAt??-Infinity)&&
     (strike||heavy)&&!force&&!feint&&!chain&&!advanced&&!canAnswer&&!trakata&&!activeJump&&!vaultExit&&!airEntry&&!roll&&
     !urgent&&!danger&&!pressureGuard&&!plannedBlock&&f.decision!=='guard'&&aimClear&&aligned&&f.actionDuration===0&&
     f.airPhase==='grounded'&&d>=57&&d<=121&&Math.abs(angleDelta(aim+Math.PI,enemy.guardBearing??enemy.face))<.95){
    const proposed=ARCADE_TECHNIQUES[technique!]??attackByName(technique)??ARCADE_ATTACKS.slash;
    const family=arcadeAttackPresentation(technique??'slash',proposed,proposed.mapAction??'slash').family;
    const exposed=enemy.exposedUntil!>s.time+.17&&enemy.action!=='guard'&&!(incoming?.deflect);
    if(!exposed&&(enemy.action==='guard'||incoming?.deflect||f.lastGuardParry.deflect&&family===f.lastGuardParry.family)){
      const side=Math.sign(Math.sin(enemy.face-aim))||Math.sign(orbit)||1;
      for(const flank of [side,-side]){
        const bearing=aim+flank*(d<82?1.55:1.19);
        if(!footworkPath(s,f,bearing,24))continue;
        f.guardLaneChange={target:enemy.id,readAt:f.lastGuardParry.at,until:s.time+.16,bearing};
        countMove(f,'guard_lane_change');
        event(s,'guard_lane_change',f,undefined,undefined,{targetId:enemy.id,bearing});
        return {x:Math.cos(bearing)*.63,y:Math.sin(bearing)*.63,aim};
      }
    }
  }
  // A healthy lead with only seconds left is worth protecting. This is
  // ordinary visible spacing using the same injury and remaining-clock state
  // available to a playing opponent; it never chooses a winner or adds stats.
  if(arenaEdge>.19&&arenaIQ!.level>.45&&matchedLineups&&s.config.rule==='elimination'&&
    s.config.teamSizes[0]===1&&s.limit-s.time<7&&ready&&f.actionDuration===0&&f.airPhase==='grounded'&&
    aimClear&&!urgent&&!danger&&!follow&&!roll&&!pressureGuard&&!plannedBlock&&!canAnswer&&d<142&&
    (f.injuryEffects.burden[0]<enemy.injuryEffects.burden[0]||
      f.injuryEffects.burden[4]+.17<enemy.injuryEffects.burden[4])&&
    compareArcadeDanger(f.injuryEffects.burden,enemy.injuryEffects.burden)<0){
    const space=clockSpacing(s,f,enemy,aim,d,orbit);
    if(space)return space;
  }
  // Rank and grip still determine the physical move. Experienced AI can
  // turn down a bad exchange, and select a reachable counter in a visible gap.
  if(arenaIQ?.level&&arenaEdge>.19&&ready&&f.airPhase==='grounded'&&f.actionDuration===0&&
    aimClear&&aligned&&!danger&&!follow&&!roll&&!pressureGuard&&!plannedBlock&&!trakata&&!vaultExit&&!airEntry&&
    !activeJump&&!chain&&!advanced&&f.guardLock<=0&&d<146){
    const guarded=enemy.action==='guard'&&Math.abs(angleDelta(aim+Math.PI,enemy.guardBearing??enemy.face))<.82;
    if(guarded&&enemy.energy>=22&&!canAnswer&&(strike||heavy)&&f.energy<73){
      const turn=Math.sign(orbit)||1;
      for(const side of [turn,-turn]){
        const from=aim+side*1.35;
        if(footworkPath(s,f,from,22))return {x:Math.cos(from)*.56,y:Math.sin(from)*.56,aim};
      }
    }
    const until=Math.max(0,(enemy.exposedUntil??0)-s.time,
      enemy.action==='stagger'?enemy.actionDuration-enemy.actionTime:0);
    if(until>.17&&d<125&&!guarded&&!urgent&&f.energy>=22){
      const moves=arcadeMovesFor(f.form,f.career.gradeIndex,{rankCuts:true,circuitCuts:s.config.circuitCuts,
        arenaCuts:s.config.arenaCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves});
      const response=moves.filter(m=>m.mapAction!=='force'&&!m.air&&m.contact<until-.026&&m.cost<f.energy-10&&
        d<=arcadeChessMove(f.chessStyle,m,{promoted:f.chessPawn?.promoted===true}).reach*.92+enemy.radius*.38);
      response.sort((a,b)=>(b.damage-a.damage)*.13-(b.contact-a.contact)*9-(b.cost-a.cost)*.055);
      if(response[0])return {strike:true,technique:response[0].id,aim};
    }
  }
  if(advanced&&!pressureGuard&&!plannedBlock&&!trakata&&!vaultExit&&!airEntry&&f.decision!=='guard')
    return {advanced,aim};
  if(defensiveAim!==null&&slip===null&&!pressureGuard&&!obstructed&&!follow)
    return {x:Math.cos(defensiveAim)*.73,y:Math.sin(defensiveAim)*.73,aim};
  return {x:Math.cos(angle)*advance-Math.sin(angle)*strafe,
    y:Math.sin(angle)*advance+Math.cos(angle)*strafe,strike,heavy,force,feint,trakata,technique,rankFootwork,chain,guardAim,evasion:evade,jump:vaultExit||airEntry||Boolean(activeJump),activeJump,airEntry,dash:!vaultExit&&roll&&(!obstructed&&!allyScreen&&!follow||slip!==null),pressureRecover,guard:pressureGuard||f.decision==='guard'&&(order!=='regroup'&&destination?.role!=='escape'),rollFace:activeJump?.bearing??(airEntry?aim:angle),aim:defensiveAim??(obstructed||follow||detour?travelAim:strikeAim)};
}
function actionStep(s: SimGame,f: SimFighter,dt: number,commands: SimCommand,enemy: SimFighter | null){
  f.invuln=Math.max(0,f.invuln-dt);f.parryTime=Math.max(0,f.parryTime-dt);
  f.guardLock=Math.max(0,f.guardLock-dt);
  if(f.buffer&&s.time>f.buffer.until) f.buffer=null;
  const vecX=clamp(finite(commands.x)?commands.x:0,-1,1),vecY=clamp(finite(commands.y)?commands.y:0,-1,1);
  const mag=Math.hypot(vecX,vecY), moveX=vecX/Math.max(1,mag),moveY=vecY/Math.max(1,mag);
  const manualAim=finite(commands.aimX)&&finite(commands.aimY)&&Math.hypot(commands.aimX!-f.x,commands.aimY!-f.y)>.1;
  const clashStrike=f.buffer?.clashStrike===true&&f.action!=='clash';
  if(clashStrike)f.buffer=null; // a one-shot attempt, even if stamina is insufficient
  const force=commands.force&&!s.config.saberOnly;
  const selected=f.control&&commands.technique?ARCADE_TECHNIQUES[commands.technique!]:null;
  const explicit=selected?.form===f.form&&selected.minRank<=f.career.gradeIndex&&(!selected.circuitCut||s.config.circuitCuts)&&(!selected.arenaCut||s.config.arenaCuts)&&(!selected.exchangeCut||s.config.exchangeVariety)&&(!selected.minorMove||s.config.minorMoves)?selected.id:null;
  const request=explicit?(selected!.mapAction==='force'&&s.config.saberOnly?null:explicit):force?'force':commands.heavy?'heavy':commands.strike?'strike':null;
  const useTrakata=f.heroId&&(f.control?commands.technique===ARCADE_TRAKATA_ID:commands.trakata);
  const footworkId=f.control&&typeof commands.technique==='string'&&commands.technique.startsWith('footwork:')?commands.technique.slice(9):null;
  const requestExpanded=f.control?commands.technique:commands.expandedMove;
  const offense=request||expandedMove(s,f,requestExpanded)||commands.guard||useTrakata||footworkId;
  const aim=manualAim?Math.atan2(commands.aimY!-f.y,commands.aimX!-f.x)
    : finite(commands.aim)?commands.aim
    : enemy&&offense?Math.atan2(enemy.y-f.y,enemy.x-f.x)
    : mag>.07?Math.atan2(moveY,moveX)
    : enemy?Math.atan2(enemy.y-f.y,enemy.x-f.x):f.face;
  if(!f.alive){
    f.actionTime=Math.min(f.actionDuration,f.actionTime+dt);f.vx=0;f.vy=0;return;
  }
  const def=profile(f);
  if(commands.phase&&!commands.guard){
    changeSaberPhase(s,f,f.saberPhase==='long'?'short':'long');
  }else if(!f.control&&enemy&&f.gear.dualPhase&&!commands.guard&&!request&&!commands.dash){
    const distance=Math.hypot(enemy.x-f.x,enemy.y-f.y),pressure=profile(f).pressure;
    if(f.saberPhase==='short'&&f.energy>=43&&distance>pressure+11&&distance<pressure+111&&!blockedBetween(s,f.x,f.y,enemy.x,enemy.y))
      changeSaberPhase(s,f,'long');
    else if(f.saberPhase==='long'&&(distance<pressure*.66||f.energy<31))changeSaberPhase(s,f,'short');
  }
  const moving=mag>.08;
  const walking=f.formRules&&moving&&(commands.walk||mag<.67);
  if(commands.pressureRecover&&!f.control&&f.action==='stagger'){
    f.energy-=8;f.pressureRecoverAt=s.time+.90;
    countMove(f,'pressure_recover');setAction(f,'idle');
  }
  if(useTrakata&&!commands.guard)beginTrakata(s,f,aim);
  if(requestExpanded&&!commands.guard)startExpanded(s,f,requestExpanded,finite(commands.expandedAim)?commands.expandedAim:aim);
  if(commands.feint&&!f.saberOff){
    const combat=finite(commands.aim)?commands.aim:aim;
    const fake=f.control?combat:combat+(f.slot%2===0?.34:-.34);
    if(beginFeint(s,f,fake,f.control?null:'slash',f.control?null:combat)){
      f.vx*=.4;f.vy*=.4;
    }
  }
  if(s.config.advancedArena&&!f.control&&commands.advanced){
    const {move,trigger}=commands.advanced, active=atk(f);
    const linked=Boolean(active&&trigger==='whiff');
    if((linked||(f.actionDuration===0&&trigger!=='whiff'))&&attack(s,f,move,aim,{linked})){
      f.advancedReadyAt=s.time+1.55;f.advancedTravel=null;
      countMove(f,'advanced_'+trigger);
      event(s,'advanced_route',f,undefined,undefined,{route:trigger,move});
    }
  }
  let attacking=atk(f);
  const dashAngle=finite(commands.rollFace)?commands.rollFace:mag>.07?Math.atan2(moveY,moveX):aim;
  if(f.action==='jump'){
    if(commands.strike&&f.control&&!f.airStrikeSpent)f.airRequest={until:s.time+.34,aim};
    const airMove=ARCADE_AIR_STRIKES[f.form];
    const remains=(f.airArc?.takeoff??0)+(f.airArc?.flight??0)-f.airTime;
    const airFacing=f.airFacing??f.face;
    const aiAim=enemy?Math.atan2(enemy.y-f.y,enemy.x-f.x):airFacing;
    const opportunity=!f.control&&f.aiVaultUsed&&enemy?.alive&&f.career.gradeIndex>=8&&
      !isArcadeCarrier(s,f)&&f.energy>=29&&Math.hypot(enemy.x-f.x,enemy.y-f.y)<(airMove?.reach??0)+8&&
      Math.abs(angleDelta(aiAim,airFacing))<.73&&!atk(enemy)&&enemy.action!=='guard'&&f.airProgress>.14&&
      !blockedBetween(s,f.x,f.y,enemy.x,enemy.y)&&!allyInLane(s,f,enemy.x,enemy.y);
    const tactical=s.config.activeFootwork&&!f.control&&f.aiJumpPurpose&&enemy?.alive&&f.energy>=(airMove?.cost??Infinity)+2&&
      Math.hypot(enemy.x-f.x,enemy.y-f.y)<(airMove?.reach??0)+9&&
      Math.abs(angleDelta(aiAim,airFacing))<.87&&enemy.parryTime<=0&&
      !blockedBetween(s,f.x,f.y,enemy.x,enemy.y)&&!allyInLane(s,f,enemy.x,enemy.y);
    const intentional=f.airRequest?.until!>=s.time||opportunity||tactical;
    const lowLanding=f.stanceFlow&&f.airPhase==='landing'&&f.airProgress>=.42&&
      !f.airStrikeSpent&&!commands.guard&&f.guardLock<=0;
    const plantedCut=lowLanding&&f.control&&f.airRequest?.until!>=s.time&&Math.abs(angleDelta(aim,airFacing))<1.15;
    let lowReply=null;
    if(lowLanding&&!f.control&&enemy?.alive&&enemy.airPhase!=='airborne'&&enemy.action!=='guard'&&
        s.config.teamSizes[0]===s.config.teamSizes[1]&&f.career.gradeIndex>=4&&(f.aiJumpPurpose||f.aiVaultUsed)&&
        !isArcadeCarrier(s,f)&&Math.abs(angleDelta(aiAim,airFacing))<.92&&
        !blockedBetween(s,f.x,f.y,enemy.x,enemy.y)&&!allyInLane(s,f,enemy.x,enemy.y)){
      const distance=Math.hypot(enemy.x-f.x,enemy.y-f.y), incoming=atk(enemy);
      const open=enemy.action==='stagger'||enemy.contact||!incoming;
      const promoted=f.chessPawn?.promoted===true;
      if(open&&distance<=99&&(!f.chessStyle||arcadeChessAllowsLane(f.chessStyle,{bearing:aiAim,face:aiAim,
          targetFace:enemy.face,promoted,distance,styleTravel:s.config.styleTravel}))){
        const fits=arcadeMovesFor(f.form,f.career.gradeIndex,{rankCuts:true,circuitCuts:s.config.circuitCuts,
          arenaCuts:s.config.arenaCuts,exchangeVariety:s.config.exchangeVariety,minorMoves:s.config.minorMoves}).filter(m=>{
          if(m.role!=='light'||m.air||m.tactical||m.contact>.27||m.cost+5>f.energy)return false;
          const tuned=arcadeChessMove(f.chessStyle,m,{promoted});
          return distance<=tuned.reach-3&&Math.abs(angleDelta(aiAim,f.face))<tuned.arc+.08;
        });
        fits.sort((a,b)=>Number(a.motion.path==='point')-Number(b.motion.path==='point')||
          (f.moves[a.id]??0)*.012+a.contact-(f.moves[b.id]??0)*.012-b.contact);
        lowReply=fits[0]?.id??null;
      }
    }
    if(plantedCut||lowReply){
      // Feet are back on the floor. Reuse normal cut collision and spend;
      // the low landing pose supplies the entry, never an invulnerable hit.
      if(attack(s,f,lowReply??'slash',lowReply?aiAim:aim)){f.airStrikeSpent=true;f.airRequest=null;}
    }else if(airMove&&intentional&&f.airPhase==='airborne'&&f.airProgress>.08&&!f.airStrikeSpent&&remains>airMove.contact+.012){
      const want=f.control?(manualAim?aim:f.airRequest!.aim):aiAim;
      const steer=clamp(angleDelta(want,airFacing),-.98,.98);
      attack(s,f,airMove.id,airFacing+steer);
    }
  }else if(f.action==='feint'&&f.technique===ARCADE_TRAKATA_ID){
    if(f.saberOff&&f.actionTime>=.20)relightTrakata(s,f);
    if(!f.saberOff&&f.actionTime>=.26&&f.trakataAim!==null){
      const bearing=manualAim?aim:f.trakataAim;
      f.trakataAim=null;
      attack(s,f,'slash',bearing!);
    }
  }else if(f.action==='feint'){
    const measuredFeint=s.config.balancePass&&!f.control&&f.feintFollowup==='ex_mk_false_line';
    if(request&&!measuredFeint)f.buffer={type:request,until:s.time+.39};
    if(f.actionTime>=f.actionDuration*.66){
      if(measuredFeint){
        const target=enemy?.alive&&enemy.id===f.falseLineTarget, move=ARCADE_TECHNIQUES.ex_mk_false_line;
        const reach=arcadeChessMove(f.chessStyle,move,{promoted:f.chessPawn?.promoted===true}).reach;
        if(!target||Math.hypot(enemy.x-f.x,enemy.y-f.y)>reach+enemy.radius*.48||
          blockedBetween(s,f.x,f.y,enemy.x,enemy.y)||allyInLane(s,f,enemy.x,enemy.y))f.feintFollowup=null;
      }
      const queued=f.buffer?.type;
      const follow=queued?(ARCADE_TECHNIQUES[queued!]?queued:queued==='heavy'?def.heavy:queued==='force'?'force':'slash'):f.feintFollowup;
      if(follow){
        if(attack(s,f,follow,queued?aim:f.feintRedirect??aim,{redirected:true})){
          f.feintFollowup=null;f.feintRedirect=null;
        }
      }
    }
  }else if(f.action==='dash'){
    // Let an input during the dash queue a real attack as its invulnerability ends.
    if(request) f.buffer={type:request,until:s.time+.32};
    if(f.actionTime>=(f.formRules?f.actionDuration*.78:.132)&&f.airPhase!=='airborne'&&f.buffer){
      const followup=ARCADE_TECHNIQUES[f.buffer!.type!]?f.buffer!.type:f.buffer!.type==='force'?'force':f.buffer!.type==='heavy'?def.heavy:'slash';
      attack(s,f,followup,aim);
    }
  } else if(f.action==='clash'&&f.control&&s.config.motionFlow?.clashStrikeBuffer){
    // Hold one explicit Slash edge through the real blade lock, not through
    // another interruption. Other commands keep their regular priorities.
    if(request==='strike'&&!commands.guard&&f.airPhase==='grounded'&&!f.airArc)
      f.buffer={type:'strike',until:s.time+Math.max(0,f.actionDuration-f.actionTime)+.10,clashStrike:true};
  } else if(attacking){
    if(request) f.buffer={type:request,until:s.time+(f.formRules?.59:.39)};
    const canCancel=f.actionTime>Math.max(attacking.contact+(f.formRules?.115:.065),(attacking.offhand?.contact??0)+.038)&&f.airPhase!=='airborne'&&(!attacking.airStrike||f.airPhase==='grounded');
    const timedChain=contactChainApplies(s.config.motionFlow,f,attacking);
    const buffered=f.buffer?.type;
    const follow=buffered===undefined?null:buffered==='strike'?(f.combo===0?'slash':'slash'+(f.combo+1)):
      buffered==='heavy'?def.heavy:buffered;
    const forceFollow=follow==='force'||Boolean(follow&&ARCADE_TECHNIQUES[follow]?.mapAction==='force');
    if(canCancel&&commands.dash) dash(s,f,dashAngle,commands.evasion);
    else if(commands.chain&&chainWindow(s,f,attacking)&&f.chainDepth!<chainLimit(f))
      attack(s,f,commands.chain,aim,{linked:true});
    else if(timedChain&&!forceFollow&&follow&&contactChainOpen(s.config.motionFlow,f,attacking)&&f.chainDepth!<chainLimit(f)&&(
      buffered==='strike'?f.combo<(def.comboCap??3):buffered==='heavy'||Boolean(ARCADE_TECHNIQUES[follow])
    )){
      attack(s,f,follow,aim,{linked:true});
    }
    else if(!timedChain&&canCancel&&f.chainDepth!<chainLimit(f)&&f.buffer?.type==='strike'&&f.combo>0&&f.combo<(def.comboCap??3)&&f.actionTime>=attacking.duration*(f.formRules?(f.form==='juyo'?.72:.82):.68)){
      attack(s,f,'slash'+(f.combo+1),aim,{linked:true});
    } else if((!timedChain||forceFollow)&&canCancel&&f.chainDepth!<chainLimit(f)&&(['heavy','force'].includes(f.buffer?.type!)||ARCADE_TECHNIQUES[f.buffer?.type!])&&f.actionTime>=attacking.duration*(f.formRules?.85:.76)&&(f.combo>0||f.control&&f.chainDepth!<chainLimit(f))){
      attack(s,f,ARCADE_TECHNIQUES[f.buffer!.type!]?f.buffer!.type:f.buffer!.type==='force'?'force':def.heavy,aim,{linked:f.buffer!.type!=='force'});
    }
  } else if(f.actionDuration===0&&f.action!=='stagger'&&f.airPhase!=='airborne'){
    const backAim=f.stanceFlow&&f.control&&manualAim&&mag>.08&&Math.cos(angleDelta(dashAngle,aim))<-.55?aim:undefined;
    if(commands.jump&&!commands.guard&&jump(s,f,dashAngle,!f.control||mag>.08,commands.activeJump?.aim??backAim)){
      if(!f.control){
        if(commands.activeJump){
          f.aiJumpPurpose=commands.activeJump.purpose;
          f.aiJumpNextAt=s.time+(s.config.fluidFootwork&&s.config.teamSizes[0]===s.config.teamSizes[1]?(f.form==='ataru'?2.9:4.8):(f.form==='ataru'?4.5:7.6))+f.slot%4*.45;
        }else {f.aiVaultUsed=true;if(commands.airEntry)f.aiAirEntryUsed=true;}
      }
      else if(commands.strike)f.airRequest={until:s.time+.34,aim};
    }
    if(f.actionDuration===0&&!commands.guard){
      const rankMove=commands.rankFootwork;
      const steering=mag>.08?Math.sign(Math.sin(dashAngle-aim)):0;
      if(footworkId)tryRankFootwork(s,f,footworkId,aim,steering||(f.slot%2===0?1:-1));
      else if(rankMove)tryRankFootwork(s,f,rankMove.id,rankMove.face,rankMove.side);
    }
    if(f.actionDuration===0&&commands.dash)dash(s,f,dashAngle,commands.evasion);
    if(f.actionDuration===0&&(explicit||ARCADE_TECHNIQUES[f.buffer?.type!]))attack(s,f,explicit??f.buffer!.type,aim);
    if(f.actionDuration===0&&(force||f.buffer?.type==='force'))attack(s,f,commands.technique??'force',aim);
    const nearbyLower=f.control&&f.rankDominance>=8?s.fighters.filter(e=>e.team!==f.team&&e.alive&&Math.hypot(e.x-f.x,e.y-f.y)<166).length:0;
    if(f.actionDuration===0&&(commands.heavy||f.buffer?.type==='heavy'))attack(s,f,commands.technique??
      (nearbyLower>=2?rankTechnique(s,f,enemy!,'heavy',nearbyLower):null)??def.heavy,aim);
    if(f.actionDuration===0&&(commands.strike||f.buffer?.type==='strike'||
      clashStrike&&!commands.guard&&f.airPhase==='grounded'&&!f.airArc)){
      const parryFollow=f.parryCounterUntil!>s.time&&enemy?.id===f.counterTarget&&
        Math.hypot(enemy!.x-f.x,enemy!.y-f.y)<130&&(f.control||f.career.gradeIndex>=6&&s.config.teamSizes[0]===s.config.teamSizes[1]);
      attack(s,f,commands.technique??(parryFollow?'riposte':'slash'),
        clashStrike&&!commands.strike&&!manualAim&&enemy?Math.atan2(enemy.y-f.y,enemy.x-f.x):aim);
    }
    if(f.actionDuration===0){
      if(commands.guard&&f.guardLock===0&&f.energy>.1){
        const pose=f.action!=='guard'&&f.action!=='stagger'?entryPose(s,f,'guard'):null;
        const bearing=finite(commands.guardAim)?commands.guardAim:aim;
        const relative=enemy?angleDelta(bearing,Math.atan2(enemy.y-f.y,enemy.x-f.x)):0;
        f.guardLane=relative<-.24?'left':relative>.24?'right':'center';
        f.guardDirected=Boolean(manualAim||finite(commands.guardAim));
        if(f.action!=='guard'&&!f.guardHeld){
          countMove(f,'guard');f.parryTime=(def.parry??(f.archetype==='warden'?.205:.155))+f.skill.skill*.055;f.face=bearing;f.guardBearing=bearing;
        }else f.guardBearing=blendAngle(f.guardBearing??f.face,bearing,Math.min(1,dt*16*f.injuryEffects.turnSpeed));
        f.guardRead=f.parryTime>0?'ready':'held';
        setAction(f,'guard');
        if(pose){f.poseFrom=pose;f.poseEntryDuration=f.styleChoreo?.155:.095;}
        f.energy=Math.max(0,f.energy-dt*7*(def.guardCost??1)*(1-.26*f.skill.skill)*(f.rankDominance!==0?f.rankCombat.holdEfficiency:1));
      }else {
        const exit=f.styleChoreo&&f.action==='guard'?entryPose(s,f,'guard_recover'):null;
        f.guardRead=null;setAction(f,moving?(walking?'walk':'run'):'idle');
        if(exit){f.poseFrom=exit;f.poseEntryDuration=.145;}
      }
      f.face=blendAngle(f.face,f.action==='guard'?f.guardBearing!:aim,Math.min(1,dt*(f.awarenessFacing?10:16)*f.injuryEffects.turnSpeed));
    }
  } else if(f.action==='stagger'&&request){
    f.buffer={type:request,until:s.time+.22};
  }
  if(f.rankDominance>=9&&f.action!=='ko')f.energy=Math.min(100,f.energy+dt*(12+masteryRatio(f.rankDominance)*17));
  f.guardHeld=Boolean(commands.guard);
  f.actionTime+=dt;
  attacking=atk(f);
  const liveAim=f.liveEntry&&attacking&&f.liveAim?.serial===f.attackSerial?f.liveAim:null;
  if(liveAim&&!f.contact&&f.actionTime<=liveAim.until){
    // A bounded wind-up correction, never a turn on the last contact frames.
    const correction=(f.control?manualAim:enemy&&enemy.alive&&!blockedBetween(s,f.x,f.y,enemy.x,enemy.y))?
      clamp(angleDelta(aim,liveAim.target),f.control?-.26:-.12,f.control?.26:.12):0;
    const target=liveAim.base+clamp(angleDelta(liveAim.target+correction,liveAim.base),-.89,.89);
    const turn=dt*(f.control?8.6:7.4)*f.injuryEffects.turnSpeed;
    f.face+=clamp(angleDelta(target,f.face),-turn,turn);
  }
  if(f.echoStepUntil!>s.time&&f.action==='force'&&f.technique==='force_echo_step'){
    f.vx=Math.cos(f.echoStepBearing!)*236;f.vy=Math.sin(f.echoStepBearing!)*236;
  } else if(f.action==='jump'||((attacking?.airStrike||
      f.motionAirCarry&&!['stagger','clash','ko'].includes(f.action))&&f.airArc)){
    const arc=f.airArc;
    const {x,y}=arc?arcadeJumpMotion(arc as Extract<typeof arc,{kind:string}>,f.airPhase,f.airProgress,f.jumpDrive??0,f.jumpBearing!):{x:0,y:0};
    f.vx=x;f.vy=y;
  } else if(f.action==='dash'&&f.rankFootwork){
    const velocity=arcadeFootworkMotion(f.rankFootwork,f.actionTime), penalty=f.injuryEffects.moveSpeed;
    f.vx=velocity.x*penalty;f.vy=velocity.y*penalty;
  } else if(f.action==='dash'){
    const p=clamp(f.actionTime/f.actionDuration,0,1);
    const burst=f.formRules?(f.technique==='vault_step'?
      f.airPhase==='airborne'?337:f.airPhase==='takeoff'?75:54:
      448*Math.sin(Math.PI*(.13+.87*p))) : 585*(1-.52*p);
    f.vx=Math.cos(f.face)*burst;f.vy=Math.sin(f.face)*burst;
  } else if(attacking?.airStrike){
    f.vx=0;f.vy=0;
  } else if(attacking){
    const elapsed=f.actionTime;
    const phase=clamp((elapsed-.028)/Math.max(.045,attacking.contact-.028),0,1);
    let burst=elapsed<=attacking.contact?attacking.lunge*Math.sin(phase*Math.PI*.83):attacking.lunge*.46*Math.max(0,1-(elapsed-attacking.contact)/.10);
    if(f.formRules){
      const plant=clamp((elapsed-(attacking.contact-.12))/.25,0,1);
      burst=f.technique==='vault'||ARCADE_TECHNIQUES[f.technique!]?.air?(f.airPhase==='airborne'?attacking.lunge:f.airPhase==='takeoff'?61:36)
        :attacking.lunge*Math.sin(Math.PI*plant)**2;
    }
    f.vx=Math.cos(f.face)*burst;f.vy=Math.sin(f.face)*burst;
    const steer=s.config.motionFlow?.windupSteering;
    if(steer&&f.control&&f.airPhase==='grounded'&&!f.airArc&&!f.contact&&!attacking.airStrike&&
      f.action!=='force'&&f.action!=='free_hand'&&elapsed<attacking.contact){
      // Shift a committed cut sideways without changing aim, release time
      // or any normal solid/body collision rule.
      const dx=-Math.sin(f.face),dy=Math.cos(f.face),lateral=moveX*dx+moveY*dy;
      const weight=Math.min(1,elapsed/.055,(attacking.contact-elapsed)/.065);
      const shift=lateral*def.speed*steer*weight;
      f.vx+=dx*shift;f.vy+=dy*shift;
    }
    if(f.stepUntil!>s.time){
      f.vx+=Math.cos(f.stepBearing!)*71;f.vy+=Math.sin(f.stepBearing!)*71;
    }
    if(s.config.fluidFootwork&&!f.control&&enemy&&f.airPhase==='grounded'&&f.action!=='force'&&f.action!=='free_hand'&&
      elapsed>Math.max(attacking.contact,attacking.offhand?.contact??0)+.04&&f.releaseOutcome&&
      f.releaseOutcome!=='pending'&&Math.hypot(enemy.x-f.x,enemy.y-f.y)<132&&s.config.teamSizes[0]===s.config.teamSizes[1]){
      // Clear the completed release lane using ordinary ground physics.
      const progress=clamp((elapsed-Math.max(attacking.contact,attacking.offhand?.contact??0)-.04)/.12,0,1);
      const sign=(f.slot+f.team+(f.attackSerial??0))%2?1:-1, direction=f.face+sign*(f.form==='juyo'?1.12:1.76);
      if(footworkPath(s,f,direction,15)){f.vx+=Math.cos(direction)*31*progress;f.vy+=Math.sin(direction)*31*progress;}
    }
    if(s.config.continuousCombat&&f.attackDrive&&f.airPhase==='grounded'&&f.action!=='force'&&f.action!=='free_hand'){
      const from=f.attackDrive, carry=Math.max(0,1-elapsed/.13)**2;
      const length=Math.hypot(from.x,from.y);
      const scale=length>110?110/length:1;
      f.vx+=from.x*scale*carry;f.vy+=from.y*scale*carry;
      if(elapsed>attacking.contact+.06){
        const release=clamp((elapsed-attacking.contact-.06)/.11,0,1);
        const drive=f.control?.31:.26, exitX=moveX||(!f.control&&mag<.01?Math.cos(f.face)*.40:0),
          exitY=moveY||(!f.control&&mag<.01?Math.sin(f.face)*.40:0);
        f.vx+=exitX*def.speed*drive*release;f.vy+=exitY*def.speed*drive*release;
      }
    }
  } else if(s.config.continuousCombat&&f.action==='feint'&&f.airPhase==='grounded'){
    // A feint remains a short readable interruption but needn't glue the feet down.
    const pace=(def.speed??170)*.34;
    f.vx+=(moveX*pace-f.vx)*Math.min(1,dt*14);
    f.vy+=(moveY*pace-f.vy)*Math.min(1,dt*14);
  } else if(f.action==='stagger'||f.action==='clash'||f.action==='feint'||f.airPhase==='airborne'){f.vx=0;f.vy=0;}
  else{
    const speed=def.speed*(f.action==='guard'?(f.crossfire?.54:.30):walking?.49:1);
    const cx=walking?moveX/mag:moveX,cy=walking?moveY/mag:moveY;
    const acceleration=f.formRules?(moving?10:18):17;
    if(f.peasantMotion&&finite(f.landedAt)&&s.time-f.landedAt!<.12){
      // Bleed only existing forward carry on landing; no extra displacement or free action.
      const k=1-clamp((s.time-f.landedAt!)/.12,0,1), drift=f.landingDrive;
      if(drift){f.vx+=(drift.x-f.vx)*dt*3*k;f.vy+=(drift.y-f.vy)*dt*3*k;}
    }
    if(f.peasantMotion){
      const dx=cx*speed-f.vx,dy=cy*speed-f.vy,delta=Math.hypot(dx,dy);
      const opposing=f.vx*cx+f.vy*cy<0,
        step=dt*(moving?(opposing?1550:f.action==='guard'?1330:1210):2080);
      const blend=delta<1e-6?1:Math.min(1,step/delta);
      f.vx+=dx*blend;f.vy+=dy*blend;
    }else{
      f.vx+= (cx*speed-f.vx)*Math.min(1,dt*acceleration);
      f.vy+= (cy*speed-f.vy)*Math.min(1,dt*acceleration);
    }
    if(f.action!=='guard'){
      const foesNeedMore=f.rankDominance>=4;
      f.energy=Math.min(100,f.energy+dt*(f.action==='idle'?26:20)*(foesNeedMore?f.rankCombat.staminaRecovery:f.crossfire&&moving?1.28:1));
    }
  }
}
const during = (s: SimGame,f: SimFighter,dt: number)=>{
  const ox=f.x,oy=f.y;
  const {minX,maxX,minY,maxY}=s.bounds;
  const zone=s.terrain.zones.find(r=>inside(f.x,f.y,r));
  const raw=zone?.moveCost, speedScale=finite(raw)?raw>.99?1/clamp(raw,1,5):clamp(raw,.2,1):1;
  const ease=f.injuryEffects.moveSpeed*(f.stasisUntil!>s.time?.42:f.forceAnchoredUntil!>s.time?.59:1)*carrierSpeedScale(s,f)*(f.action==='dash'?s.weather!.dashMultiplier:s.weather!.walkMultiplier);
  const tx=clamp(ox+(f.vx*speedScale*ease+f.kx)*dt,minX,maxX);
  const ty=clamp(oy+(f.vy*speedScale*ease+f.ky)*dt,minY,maxY);
  if(canSlide(s,f,f.x,f.y,tx,f.y)){
    const move=bodyMotionFraction(s,f,f.x,f.y,tx,f.y);
    f.x+=(tx-f.x)*move;if(move<1)f.kx=0;
  }else f.kx=0;
  if(canSlide(s,f,f.x,f.y,f.x,ty)){
    const move=bodyMotionFraction(s,f,f.x,f.y,f.x,ty);
    f.y+=(ty-f.y)*move;if(move<1)f.ky=0;
  }else f.ky=0;
  if(f.impactPhysics){
    const recent=f.impactReaction&&s.time-f.impactReaction.at<.32;
    const coast=recent?(f.airPhase==='airborne'?6.8:f.impactReaction!.kind==='hard'?8.1:
      f.impactReaction!.kind==='clash'?9.9:f.impactReaction!.kind==='guard'?13:10.1):12;
    const retain=Math.exp(-dt*coast);
    if(tx===minX&&f.x===minX&&f.kx<0||tx===maxX&&f.x===maxX&&f.kx>0)f.kx=0;
    if(ty===minY&&f.y===minY&&f.ky<0||ty===maxY&&f.y===maxY&&f.ky>0)f.ky=0;
    f.kx=Math.abs(f.kx)>1?f.kx*retain:0;f.ky=Math.abs(f.ky)>1?f.ky*retain:0;
  }else{f.kx*=Math.max(0,1-dt*12);f.ky*=Math.max(0,1-dt*12);}
  const travel=Math.hypot(f.x-ox,f.y-oy);
  f.groundSpeed=f.airPhase==='airborne'?0:travel/dt;
  if(f.peasantMotion){
    const vx=(f.x-ox)/dt,vy=(f.y-oy)/dt;
    f.groundPace=Math.min(1,f.groundSpeed/220);
    if(f.groundSpeed>3)f.groundBearing=Math.atan2(vy,vx);
    // Do not feed blocked axis momentum back into the next free-ground step.
    if(f.airPhase==='grounded'&&f.actionDuration===0){
      if(Math.abs(tx-ox)>.02&&Math.abs(f.x-ox)<.015)f.vx=0;
      if(Math.abs(ty-oy)>.02&&Math.abs(f.y-oy)<.015)f.vy=0;
    }
  }
  if(f.airPhase!=='airborne')f.groundDistance+=travel;
  if(f.alive && f.airHeight<18 && finite(zone?.damagePerSecond) && zone!.damagePerSecond!!>0) {
    f.hazardDamage=(f.hazardDamage??0)+zone!.damagePerSecond!!*dt;
    if(f.hazardDamage>=7) {
      const damage=Math.floor(f.hazardDamage);f.hazardDamage-=damage;
      const region=f.slot%2===0?'leftLeg':'rightLeg';
      const applied=applyArcadeInjury(f.injuries,{region,amount:damage,quality:.32,roll:injuryRoll(s,f,f),direction:'front'});
      updateInjury(f,applied);
      credit(s,f,'damageTaken',applied.impact??applied.delta);
      if(!f.alive) {
        f.contributors=[];setAction(f,'ko',1);f.attack=null;f.combo=0;f.buffer=null;
        event(s,'ko',f,f.x,f.y,{targetId:f.id,region,injuryTier:applied.tier,injuryOutcome:applied.outcome,fatal:true,environmental:true,...recordKnockout(s,f)});
      }
    }
  } else if(!zone||!zone!.damagePerSecond!)f.hazardDamage=0;
};
function resolveArcadeBladeClashes(s: SimGame) {
  // Each successful pair removes both attacks from this tick. Other independent
  // pairs may still collide; body damage only resolves after all blade stops.
  for(let i=0;i<Math.floor(s.fighters.length/2);i++){
    const contact=findArcadeBladeContact(s);
    if(!contact)break;
    const {a,b,x,y,groundY,bladeA,bladeB,offhandA,offhandB,bladeIdA,bladeIdB}=contact;
    if(!atk(a)||!atk(b)||!a.alive||!b.alive||a.team===b.team)break;
    for(const [f,blade,offhand] of [[a,bladeA,offhandA],[b,bladeB,offhandB]] as const){
      f.clashX=x;f.clashY=y;f.clashFrom={...blade,offhand};f.clashBlade=blade.bladeId;f.clashOffhand=offhand;f.clashRole=f===a?'attacker':'defender';
      f.attack=null;f.attackSpec=null;f.technique='blade_clash';f.contact=true;f.offhandContact=true;f.counterMove=false;
      f.combo=0;f.buffer=null;f.releaseOutcome=null;f.vx=0;f.vy=0;f.energy=Math.max(0,f.energy-5);
      const other=f===a?b:a;
      const gradeGap=rankGap(f,other);
      const clashTime=gradeGap===0?.42:gradeGap>0?.42-.25*masteryRatio(gradeGap):.42+.17*masteryRatio(-gradeGap);
      setAction(f,'clash',clashTime);countMove(f,'clash');
      if(f.eliteEngaged&&!f.control)f.eliteReady=Math.max(f.eliteReady??0,s.time+.49);
      credit(s,f,'clashes');
    }
    if(s.config.impactPhysics){
      const bearing=Math.atan2(b.y-a.y,b.x-a.x);
      const recoil=(a.airPhase==='airborne'||b.airPhase==='airborne')?112:151;
      bodyImpulse(s,a,bearing+Math.PI,recoil,'clash');bodyImpulse(s,b,bearing,recoil,'clash');
    }
    event(s,'clash',a,x,y,{groundY,targetId:b.id,aId:a.id,bId:b.id,offhandA,offhandB,bladeA:bladeIdA,bladeB:bladeIdB,damage:0});
  }
}

/** Health for squad planning: 100 unhurt, falling with vital wounds and, half as much, leg wounds. */
const squadHealth=(f: SimFighter)=>{const b=arcadeInjuryBurden(f.injuries);return Math.round(100*Math.max(0,1-Math.max(b[4] as number,(b[6] as number)*.5)));};
const squadUnit=(f: SimFighter): ArcadeSquadUnit=>({id:f.id,x:f.x,y:f.y,hp:squadHealth(f),energy:f.energy,gradeIndex:f.career.gradeIndex,alive:f.alive});
function planSquads(s: SimGame){
  const squad=s.squadTactics;
  if(!squad||s.time<squad.next)return;
  squad.next=s.time+.25;
  for(const team of [0,1] as const){
    const allies=s.fighters.filter(f=>f.team===team), foes=s.fighters.filter(f=>f.team!==team);
    if(allies.length<2){squad.plans[team]=null;continue;}
    const previous=squad.plans[team]?.phase??null;
    const plan=planArcadeSquad({allies:allies.map(squadUnit),foes:foes.map(squadUnit),
      formation:(s.config.formations[team]??'line') as ArcadeSquadFormation,
      doctrine:(s.config.doctrines[team]??'balanced') as 'balanced'|'aggressive'|'defensive',previous,phaseAge:s.time-squad.since[team]});
    if(plan.phase!==previous)squad.since[team]=s.time;
    squad.plans[team]=plan;
  }
}
/** The squad's pick for this bot (gang cap, focus, peel), or the usual nearest foe. */
function squadTarget(s: SimGame,f: SimFighter){
  const order=!f.control&&f.alive?s.squadTactics?.plans[f.team]?.orders[f.id]:undefined;
  const pick=order?.targetId?s.fighters.find(o=>o.id===order.targetId&&o.alive&&o.team!==f.team):null;
  if(pick&&Math.hypot(pick.x-f.x,pick.y-f.y)<=s.weather!.sightRange){f.targetId=pick.id;f.targetUntil=s.time+.3;return pick;}
  return nearest(s,f);
}
/** Steer a bot's walk: spread from allies, form up or fall back as ordered. Attacks are never touched. */
function squadSteer(s: SimGame,f: SimFighter,enemy: SimFighter | null,commands: SimCommand){
  const plan=s.squadTactics?.plans[f.team];
  if(!plan||f.control||!f.alive||commands.strike||commands.heavy||commands.force||commands.dash)return commands;
  const order=plan.orders[f.id];
  let x=commands.x??0,y=commands.y??0;
  const far=!enemy||Math.hypot(enemy.x-f.x,enemy.y-f.y)>150;
  if(order&&order.x!=null&&order.y!=null&&(order.kind==='retreat'||far&&['slot','regroup','hold'].includes(order.kind))){
    const dx=order.x-f.x,dy=order.y-f.y,d=Math.hypot(dx,dy);
    if(d>12){x=dx/d;y=dy/d;}else if(order.kind!=='retreat'){x=0;y=0;}
  }
  const push=arcadeSquadSpacing(s.fighters.filter(o=>o.team===f.team).map(squadUnit))[f.id];
  if(push){x+=push.x/ARCADE_SQUAD_MIN_GAP*1.2;y+=push.y/ARCADE_SQUAD_MIN_GAP*1.2;}
  const len=Math.hypot(x,y);
  return len>1?{...commands,x:x/len,y:y/len}:{...commands,x,y};
}

function tick(s: SimGame,dt: number,input: ArcadeInput){
  s.time+=dt;
  if(s.elitePacing){const lift=pacingLift(s);s.elitePacing.stage=lift===0?'measured':lift===1?'decisive':'opening';}
  s.weather=environmentAt(s.config.weather,s.weatherSeed,s.time*60);
  const top=[-1,-1];s.liveByTeam=[0,0];
  for(const f of s.fighters)if(f.alive){top[f.team]=Math.max(top[f.team],f.career.gradeIndex);s.liveByTeam![f.team]++;}
  for(const f of s.fighters)f.rankDominance=top[1-f.team]<0?0:f.career.gradeIndex-top[1-f.team];
  const order=(++s.tick%2?s.fighters:[...s.fighters].reverse());
  if(s.squadTactics)planSquads(s);
  for(const f of order){
    const enemy=s.squadTactics?squadTarget(s,f):nearest(s,f);
    const commands=f.control?input:f.alive?(s.squadTactics?squadSteer(s,f,enemy,ai(s,f,enemy,dt)):ai(s,f,enemy,dt)):{};
    if(f.chessStyle==='pawn'&&f.chessPawn?.streak&&!f.chessPawn.promoted&&f.chessPawnPending==null&&enemy){
      const dx=f.x-enemy.x,dy=f.y-enemy.y,distance=Math.hypot(dx,dy);
      const outward=distance>0?(f.vx*dx+f.vy*dy)/distance:0;
      const voluntary=(f.action==='walk'||f.action==='run'||f.action==='dash')&&outward>48;
      f.chessPawnRetreat=voluntary?(f.chessPawnRetreat??0)+outward*dt:0;
      if(f.chessPawnRetreat>=20){f.chessPawn=arcadeChessPawnStrike(f.chessPawn,{retreated:true});f.chessPawnRetreat=0;}
    }
    const previousAir=f.peasantMotion?f.airPhase:null;
    updateAir(f,dt);
    if(previousAir==='airborne'&&f.airPhase!=='airborne'){
      f.landedAt=s.time;
      const k=Math.min(.32,85/(Math.hypot(f.vx,f.vy)||1));
      f.landingDrive={x:f.vx*k,y:f.vy*k};
    }
    actionStep(s,f,dt,commands,enemy);
  }
  for(const f of order){
    if(f.chessPawnPending!=null&&!f.attack)finishChessPawn(f);
    during(s,f,dt);
  }
  separate(s);
  resolveArcadeBladeClashes(s);
  for(const f of order){
    const attackSpec=atk(f);
    if(f.alive&&attackSpec&&!f.contact&&f.actionTime>=attackSpec.contact){f.contact=true;contact(s,f,attackSpec);}
    if(f.alive&&!f.saberOff&&f.attack&&attackSpec?.offhand&&!f.offhandContact&&f.actionTime>=attackSpec.offhand.contact){
      f.offhandContact=true;
      const blade=attackSpec.offhand.blade??'offhand';
      if(!attackSpec.staff)credit(s,f,'saberSwings');countMove(f,attackSpec.staff?'staff_trail_release':blade);
      event(s,'slash',f,undefined,undefined,{combo:f.combo,contact:0,offhand:true,blade,...(attackSpec.staff?{staffLead:f.staffLead,backLane:true}:{})});
      contact(s,f,{...attackSpec,...attackSpec.offhand,isOffhand:true});
    }
  }
  for(const f of s.fighters){
    if(f.action!=='ko'&&f.actionDuration>0&&f.actionTime>=f.actionDuration){
      if(f.saberOff)relightTrakata(s,f,true);
      if(s.config.advancedArena&&f.rankFootwork&&f.advancedTravelStart){
        const origin=f.advancedTravelStart;
        if(Math.hypot(f.x-origin.x,f.y-origin.y)>=21)f.advancedTravel={id:origin.id,until:s.time+.28};
      }
      if(f.advancedTravelStart)f.advancedTravelStart=null;
      const recovery=f.action==='dash'?'dash_recover':f.action==='force'?'force_recover':
        f.weaponFlow&&f.attack&&!f.airArc?'weapon_recover':null;
      const pose=recovery?entryPose(s,f,recovery):null;
      finishChessPawn(f);
      f.attack=null;f.technique=null;f.airStrike=null;f.combo=0;setAction(f,'idle');
      if(pose){f.poseFrom=pose;f.poseEntryDuration=f.styleChoreo&&recovery==='weapon_recover'?.185:.095;}
    }
  }
  outcome(s,advanceArcadeObjective(s,dt),event);
}
/** Mutates and returns state. dt in seconds; attack/dash inputs are rising-edge actions; guard is held. */
export function stepArcade(s: SimGame,dt: number,input: ArcadeInput={}){
  return stepGame(s,dt,input,tick);
}

// @ts-nocheck
import {arcadeChessStyleForId,normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {createMatchReport,appendMatchReportEvents,finishMatchReport} from './arcade-match-report.js?v=2.33.0';
import {learnTournamentLoadout,sanitizeTournamentLoadout,selectTournamentLoadout,validTournamentMove} from './arcade-tournament-adaptation.js?v=2.42.0';
import {fighterGender,appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';
import {createArcade, stepArcade, ARCADE_FORMS, ARCADE_STAT_KEYS} from './arcade-engine.js?v=3.0.0';

export const TOURNAMENT_REPLAY_RULESET=30;
const DOCTRINES=['balanced','aggressive','defensive'];
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const valid=(value,otherwise)=>Number.isFinite(value)?value:otherwise;
const count=n=>Math.floor(clamp(valid(n,0),0,100000));
const rates=['accuracy','pressure','guardRate','forceRate','whiffRate','counterRate'];
const prior={
  shii_cho:[.47,.28,.08], makashi:[.48,.38,.06], soresu:[.32,.65,.06],
  ataru:[.73,.20,.08], djem_so:[.54,.43,.07], niman:[.45,.36,.29], juyo:[.80,.16,.07],
};
const rosterForm=f=>Object.hasOwn(ARCADE_FORMS,f?.form)?f.form:'shii_cho';
const adaptationOf=f=>f?.adaptation??f?.profile;
const jitter=(seed,id,choice)=>{
  let out=2166136261;
  for(const c of String(seed)+'|'+String(id??'')+'|'+choice)out=Math.imul(out^c.charCodeAt(0),16777619);
  return (out>>>0)/4294967296;
};
export function tournamentAdaptation(value={}){
  const bouts=count(value?.bouts), wins=Math.min(bouts,count(value?.wins));
  const variants=Object.fromEntries(DOCTRINES.map(key=>{
    const v=value?.variants?.[key], n=Math.min(bouts,count(v?.bouts));
    return [key,{bouts:n,wins:Math.min(n,count(v?.wins)),score:clamp(valid(v?.score,0),-n,n)}];
  }));
  const observed=Object.fromEntries(rates.map(key=>[key,clamp(valid(value?.observed?.[key],0))]));
  const lastDoctrine=DOCTRINES.includes(value?.lastDoctrine)?value.lastDoctrine:'balanced';
  const loadouts=sanitizeTournamentLoadout(value?.loadouts);
  return {bouts,wins,lastDoctrine,variants,observed,...(loadouts?{loadouts}:{})};
}
export function selectTournamentPlan(fighter,opponent,seed=1){
  const own=tournamentAdaptation(adaptationOf(fighter)), foe=tournamentAdaptation(adaptationOf(opponent));
  const form=rosterForm(fighter), [basePressure,baseGuard,baseForce]=prior[rosterForm(opponent)];
  const learn=foe.bouts/(foe.bouts+2.5);
  const estimate=(key,initial)=>initial*(1-learn)+foe.observed[key]*learn;
  const pressure=estimate('pressure',basePressure), guard=estimate('guardRate',baseGuard);
  const force=estimate('forceRate',baseForce), accuracy=estimate('accuracy',.48);
  const whiff=estimate('whiffRate',.28), counter=estimate('counterRate',.20);
  const adaptation={
    balanced:.02+guard*(.05+counter*.40)+force*.08,
    aggressive:(1-pressure)*.39+(1-guard)*.17+whiff*.32-counter*.26-.22,
    defensive:pressure*(.38+accuracy*.23)+force*.22-(1-pressure)*.13-.14,
  };
  const identity=form==='soresu'?'defensive':['ataru','juyo'].includes(form)?'aggressive':'balanced';
  const rated=DOCTRINES.map(doctrine=>{
    const tried=own.variants[doctrine];
    const result=tried.score/(tried.bouts+2.75), explore=.185*Math.sqrt(Math.log(own.bouts+2)/(tried.bouts+1));
    const preference=doctrine===identity?.058:0;
    return {doctrine,rating:adaptation[doctrine]+preference+result*.57+explore+(jitter(seed,fighter?.id,doctrine)-.5)*.055};
  });
  rated.sort((a,b)=>b.rating-a.rating);
  return {doctrine:rated[0].doctrine};
}
const rate=(a,b)=>clamp(a/Math.max(1,b));
function learnBout(old, doctrine, own, foe, won, draw, elapsed){
  const p=tournamentAdaptation(old), stats=own, other=foe;
  const wins=won?1:0, evidence={
    accuracy:rate(stats.saberLanded,stats.saberSwings),
    pressure:rate(stats.saberSwings+stats.forceCasts,elapsed*1.85),
    guardRate:rate(stats.blocks,other.saberSwings+other.forceCasts),
    forceRate:rate(stats.forceCasts,stats.saberSwings+stats.forceCasts),
    whiffRate:rate(stats.whiffs,stats.saberSwings),
    counterRate:rate(stats.counters,stats.saberLanded+stats.forceLanded),
  };
  const previous=p.variants[doctrine], weight=p.bouts===0?1:Math.max(.16,1/(1+p.bouts));
  const tempo=(stats.damage-other.damage)/Math.max(100,stats.damage+other.damage);
  const score=(draw?0:won?.75:-.75)+.25*tempo;
  return tournamentAdaptation({bouts:p.bouts+1,wins:p.wins+wins,lastDoctrine:doctrine,
    variants:{...p.variants,[doctrine]:{bouts:previous.bouts+1,wins:previous.wins+wins,score:previous.score+score}},
    observed:Object.fromEntries(rates.map(key=>[key,p.observed[key]*(1-weight)+evidence[key]*weight]))});
}
export function tournamentHeroLoadout(record={}){
  const gear=record.gear??record;
  const weapon=['single','dual','staff'].includes(gear.weapon)?gear.weapon:'single';
  const body=['woman','rabbit'].includes(record.body)?record.body:'femboy';
  const squad=record.sourceKind==='squad'&&/^q[0-9a-z]+-t[0-9a-z]+-f[1-5]$/.test(record.id);
  const appearanceSeed=squad&&Number.isSafeInteger(record.appearanceSeed)&&record.appearanceSeed>=0&&record.appearanceSeed<=0xffffffff?
    record.appearanceSeed:appearanceSeedFor(record.id);
  return {form:rosterForm(record),body,gender:fighterGender(record.gender,body,record.id),appearanceSeed,
    ...(squad?{sourceKind:'squad'}:{}),
    grade:record.grade??record.rank??'A',elo:record.elo,eloFloorGrade:record.eloFloorGrade,weapon,grip:weapon!=='staff'&&gear.grip==='backhand'?'backhand':'forward',
    dualPhase:gear.dualPhase===true,forceFamily:gear.forceFamily??record.forceFamily??'force_push',
    preferredMove:validTournamentMove(adaptationOf(record)?.loadouts?.last?.move,rosterForm(record),record.grade??record.rank),
    doctrine:tournamentAdaptation(adaptationOf(record)).lastDoctrine,adaptation:tournamentAdaptation(adaptationOf(record))};
}
function replayDescriptor(bout, forcePlans){
  const sides=bout.fighters??[bout.left,bout.right];
  if(!sides?.[0]||!sides?.[1])throw new TypeError('Tournament bouts require two fighters');
  const seed=bout.seed??1, grade=bout.grade??'A', ruleset=Number.isInteger(bout.ruleset)?bout.ruleset:TOURNAMENT_REPLAY_RULESET;
  const supplied=forcePlans??bout.plans;
  const plans=sides.map((f,i)=>DOCTRINES.includes(supplied?.[i]?.doctrine)
    ?{doctrine:supplied[i].doctrine,...(validTournamentMove(supplied[i].move,f.form,grade)?{move:supplied[i].move}:{})}
    :selectTournamentPlan(f,sides[1-i],seed));
  const fighters=sides.map((f,i)=>{
    const id=f.id??String(i);
    const {form,body,gender,appearanceSeed,weapon,grip,dualPhase,forceFamily}=tournamentHeroLoadout({...f,id});
    const rating=f.combatElo??f.elo;
    const combatElo=Number.isFinite(rating)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,rating)):1500;
    let chessStyle;
    if(ruleset>=13){
      chessStyle=Number.isInteger(bout.ruleset)?normalizeArcadeChessStyle(f.chessStyle):arcadeChessStyleForId(id);
      if(chessStyle==='none'||chessStyle==='mixed')throw new TypeError('Solo chess replays require each fighter’s recorded style.');
    }
    return {...(ruleset>=13?{chessStyle}:{}),...(ruleset>=11?{combatElo}:{}),id,name:f.name??('Fighter '+(i+1)),form,body,gender,appearanceSeed,grade,gear:{weapon,grip,dualPhase,forceFamily}};
  });
  return {ruleset,seed,round:bout.round??1,limit:[45,75,90,150,360].includes(Number(bout.limit))?Number(bout.limit):45,
    terrain:bout.terrain??'open',grade,fighters,plans};
}
export function createTournamentReplay(bout, forcePlans, factory=createArcade){
  const {ruleset,seed,round,limit,terrain,grade,fighters,plans}=replayDescriptor(bout,forcePlans);
  const gear=fighters.map(f=>f.gear);
  const game=factory({mode:'watch',round,seed,limit,terrain,soloTournamentClock:limit===360,continuousCombat:ruleset>=14,anticipatingCombat:ruleset>=15,arenaCuts:ruleset>=16,activeFootwork:ruleset>=17,styleTravel:ruleset>=18,repertoireSupport:ruleset>=19,styleChoreo:ruleset>=20,peasantMotion:ruleset>=21,exchangeVariety:ruleset>=22,fluidFootwork:ruleset>=23,eloReads:ruleset>=23,stanceFlow:ruleset>=24,liveEntry:ruleset>=25,impactPhysics:ruleset>=26,recoveryFlow:ruleset>=27,balancePass:ruleset>=28,closeChoice:ruleset>=29,guardCounterplay:ruleset>=30,...(ruleset>=13?{chessStyles:fighters.map(f=>f.chessStyle)}:{}),weaponFlow:ruleset>=10,ratingSkill:ruleset>=11,matchGoalPlanning:ruleset>=12,circuitCuts:ruleset>=12,sideElo:fighters.map(f=>f.combatElo),fighterRatings:fighters.map(f=>[f.combatElo]),teamForms:fighters.map(f=>f.form),
    teamSizes:[1,1],startingRanks:[grade,grade],doctrines:plans.map(a=>a.doctrine),
    startingSaberWeapon:gear.map(a=>a.weapon),startingSaberGrip:gear.map(a=>a.grip),
    startingDualPhase:gear.map(a=>a.dualPhase),startingForceFamily:gear.map(a=>a.forceFamily),body:fighters[0].body});
  for(const [i,f] of game.fighters.entries()){
    const {body,gender,appearanceSeed}=fighters[i];
    Object.assign(f,{body,gender,appearanceSeed,tournamentMove:plans[i].move??null});
  }
  return game;
}
export function playTournamentBout(bout){
  const sides=bout.fighters??[bout.left,bout.right];
  // Only live entrants consult learned evidence. Historical descriptors
  // already contain the actual applied form, kit and doctrine and are fixed.
  const isReplay=Number.isInteger(bout.ruleset);
  const selected=sides.map((f,i)=>isReplay?{...f,reason:'results'}:selectTournamentLoadout({...f,grade:bout.grade??f.grade},sides[1-i],bout.seed??1));
  const fighters=sides.map((f,i)=>{
    if(isReplay)return f;
    const {weapon,grip,dualPhase}=selected[i];
    return {...f,gear:{...(f.gear??{}),weapon,grip,dualPhase}};
  });
  const appliedPlans=isReplay?bout.plans:fighters.map((f,i)=>({
    ...(bout.plans?.[i]??selectTournamentPlan(f,fighters[1-i],bout.seed??1)),
    move:validTournamentMove(selected[i].move,f.form,bout.grade??f.grade),
  }));
  const replay=replayDescriptor({...bout,fighters,plans:appliedPlans});
  const {plans}=replay, game=createTournamentReplay(replay);
  const trace=game.config.matchGoalPlanning?createMatchReport({...replay,
    fighters:game.fighters.map((f,i)=>({id:f.id,name:replay.fighters[i].name,team:f.team})),
    plans:game.fighters.map((f,i)=>({...plans[i],goal:f.matchGoal})),clock:{source:'tournament settings'}}):null;
  // Each .1 s call advances the same authoritative 120-Hz substeps used by
  // real battles. The cap protects the tournament from an engine regression.
  const budget=Math.ceil(game.limit*10)+3;
  let lastEvent=0;
  const landed=game.fighters.map(()=>Object.create(null));
  const actorIndex=Object.fromEntries(game.fighters.map((f,i)=>[f.id,i]));
  for(let n=0;n<budget&&game.phase==='playing';n++){
    stepArcade(game,.1);
    if(game.eventId===lastEvent)continue;
    if(trace)appendMatchReportEvents(trace,game.events);
    for(const e of game.events){
      if(e.id<=lastEvent||!e.technique||!(e.damage>0)||!['hit','launch','break'].includes(e.kind))continue;
      const hits=landed[actorIndex[e.fighterId]];
      if(hits)hits[e.technique]=(hits[e.technique]??0)+1;
    }
    lastEvent=game.eventId;
  }
  const winnerIndex=game.endReason==='timeout'?null:game.phase==='won'?0:game.phase==='lost'?1:null;
  if(trace)replay.matchReport=finishMatchReport(trace,{time:game.time,winnerIndex,reason:game.endReason??'simulation-limit'});
  const stats=game.fighters.map(f=>Object.fromEntries(ARCADE_STAT_KEYS.map(k=>[k,valid(f.stats[k],0)])));
  const adaptations=sides.map((f,i)=>{
    const old=adaptationOf(f), seen=learnBout(old,plans[i].doctrine,stats[i],stats[1-i],i===winnerIndex,winnerIndex===null,game.time);
    const applied={...replay.fighters[i],move:plans[i].move,reason:selected[i].reason};
    const other={...sides[1-i],form:replay.fighters[1-i].form};
    const loadouts=learnTournamentLoadout(old,applied,stats[i],stats[1-i],winnerIndex===null?.5:i===winnerIndex?1:0,other,game.fighters[i].moves,landed[i]);
    return {...seen,loadouts};
  });
  return {winnerIndex,winner:winnerIndex===null?null:sides[winnerIndex].id??null,
    reason:game.endReason??'simulation-limit',time:game.time,elapsed:game.time,
    stats,kills:stats.map(s=>s.kills),deaths:stats.map(s=>s.deaths),
    plans,replay,adaptations,profiles:adaptations};
}

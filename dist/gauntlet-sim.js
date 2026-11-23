import {createArcade,stepArcade,ARCADE_FORMS} from './arcade-engine.js?v=3.0.0';
import {ARCADE_MAPS} from './arcade-stage.js?v=2.13.0';
import {arcadeChessStyleForId} from './arcade-chess-styles.js?v=2.44.0';
import {fighterGender,appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';
import {arcadeFighterGear} from './arcade-loadouts.js?v=2.10.0';
import {validTournamentMove} from './arcade-tournament-adaptation.js?v=2.42.0';

import {GAUNTLET_SIM_VERSION,gauntletReplayVersion} from './gauntlet-rules.js';
export {GAUNTLET_SIM_VERSION};
export const GAUNTLET_STEP=1/120;
const FORCES=['force_push','force_burst','force_pulse'];
const DOCTRINES=['balanced','aggressive','defensive'];
const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
const clamp=(x,low,high)=>Math.max(low,Math.min(x,high));
const unit=(x,fallback=.5)=>clamp(finite(x,fallback),0,1);
const clean=(x,max=48)=>typeof x==='string'?x.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const flags=Object.freeze({
  weaponFlow:true,expandedCombat:true,ratingSkill:true,matchGoalPlanning:true,circuitCuts:true,continuousCombat:true,
  anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,repertoireSupport:true,styleChoreo:true,
  peasantMotion:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,stanceFlow:true,liveEntry:true,
  impactPhysics:true,recoveryFlow:true,balancePass:true,closeChoice:true,guardCounterplay:true,minorMoves:true,
  forceVariants:true,advancedArena:true,
});
const slotRole=i=>i===0?'solo':'trio';

function fighterProfile(f,role){
  const profile=f.profile??f.adaptation;
  const raw=profile?.[role]??profile;
  return {
    bouts:clamp(Math.floor(finite(raw?.bouts)),0,1000000),
    guard:unit(raw?.guard),pressure:unit(raw?.pressure),mobility:unit(raw?.mobility),
    doctrine:DOCTRINES.includes(raw?.doctrine)?raw.doctrine:'balanced',
    preferredMove:validTournamentMove(raw?.preferredMove,f.form,'SSS+V'),
  };
}

function normalizeFighter(raw,index){
  const id=clean(raw?.id,80);
  if(!id)throw new TypeError('Every gauntlet fighter must have an ID.');
  const body=['woman','rabbit'].includes(raw.body)?raw.body:'femboy', role=slotRole(index);
  const form=Object.hasOwn(ARCADE_FORMS,raw.form)?raw.form:'shii_cho';
  const gear=raw.gear??{};
  const weapon=['single','dual','staff'].includes(gear.weapon)?gear.weapon:gear.dualSabers===true?'dual':'single';
  const grip=weapon!=='staff'&&gear.grip==='backhand'?'backhand':'forward';
  return {
    id,role,form,body,name:clean(raw.name)||'Fighter '+(index+1),gender:fighterGender(raw.gender,body,id),
    appearanceSeed:Number.isInteger(raw.appearanceSeed)?raw.appearanceSeed>>>0:appearanceSeedFor(id),
    gear:{weapon,grip,dualPhase:gear.dualPhase===true,forceFamily:FORCES.includes(gear.forceFamily)?gear.forceFamily:'force_push'},
    elo:clamp(finite(raw.combatElo??raw.elo,1500),0,25000),profile:fighterProfile({...raw,form},role),
  };
}

function normalizeFixture(fixture){
  if(!Array.isArray(fixture?.fighters)||fixture.fighters.length!==4)
    throw new TypeError('A gauntlet requires exactly one solo fighter and three rivals.');
  const simulationVersion=gauntletReplayVersion(fixture);
  if(simulationVersion===null)
    throw new RangeError('This version of the gauntlet simulation is not available.');
  const fighters=fixture.fighters.map(normalizeFighter);
  if(new Set(fighters.map(f=>f.id)).size!==4)throw new TypeError('Gauntlet fighter IDs must be distinct.');
  return {
    id:clean(fixture.id,80),fighters,simulationVersion,
    seed:Number.isSafeInteger(fixture.seed)?fixture.seed>>>0:1,
    limit:clamp(Math.round(finite(fixture.limit,90)),15,600),
    terrain:Object.hasOwn(ARCADE_MAPS,fixture.terrain)?fixture.terrain:'underpit',
  };
}

// Read only previous recorded bouts. Engine still chooses each action.
function selectPlan(f,opponents,index){
  const p=f.profile;
  const learned=opponents.filter(o=>o.profile.bouts>=2);
  let doctrine=p.doctrine;
  if(p.bouts>=2){
    const their=(key)=>learned.length?learned.reduce((sum,o)=>sum+o.profile[key],0)/learned.length:.50;
    const pressure=p.pressure*.47+their('guard')*.26+their('mobility')*.10+
      (doctrine==='aggressive'?.14:0)+(index===0?0:.025);
    const defense=p.guard*.47+their('pressure')*.28+
      (doctrine==='defensive'?.15:0)+(index===0?.07:0);
    if(Math.abs(pressure-defense)>.075)doctrine=pressure>defense?'aggressive':'defensive';
  }
  return {id:f.id,doctrine,preferredMove:p.preferredMove};
}

export function createGauntletBattle(fixture){
  const {id,seed,limit,terrain,fighters,simulationVersion}=normalizeFixture(fixture);
  const plans=fighters.map((f,i)=>selectPlan(f,i===0?fighters.slice(1):fighters.slice(0,1),i));
  const halves=[fighters.slice(0,1),fighters.slice(1)];
  const gear=([a,b])=>({startingSaberWeapon:[a.gear.weapon,b.gear.weapon],
    startingSaberGrip:[a.gear.grip,b.gear.grip],startingDualPhase:[a.gear.dualPhase,b.gear.dualPhase],
    startingForceFamily:[a.gear.forceFamily,b.gear.forceFamily]});
  const game=createArcade({...flags,mode:'watch',seed,limit,terrain,rule:'elimination',
    teamSizes:[1,3],startingRanks:['SSS+V','SSS+V'],teamForms:halves.map(side=>side.map(f=>f.form)),
    fighterRatings:halves.map(side=>side.map(f=>f.elo)),fighterChessStyles:halves.map(side=>side.map(f=>arcadeChessStyleForId(f.id))),
    ...gear([fighters[0],fighters[1]]),
  });
  game.limit=game.config.limit=limit;
  game.gauntlet={id,seed,simulationVersion,limit,terrain,plans,tuning:{soloRecovery:0,trioTax:0,taxed:new Map()}};
  game.fighters.forEach((actor,index)=>{
    const f=fighters[index], plan=plans[index];
    Object.assign(actor,{gauntletFighterId:f.id,displayName:f.name,body:f.body,gender:f.gender,appearanceSeed:f.appearanceSeed,
      gear:arcadeFighterGear(gear([f,f]),0),heroPlan:plan.doctrine,tournamentMove:plan.preferredMove,loadoutChosen:true});
  });
  return game;
}

// Two small stamina changes, restricted to multi-attacker exchanges in Gauntlet.
export function applyGauntletBalance(game,dt){
  const [solo,...trio]=game.fighters, state=game.gauntlet.tuning;
  if(!solo.alive)return;
  const nearby=trio.filter(f=>f.alive&&Math.hypot(f.x-solo.x,f.y-solo.y)<175);
  if(nearby.length>=2&&!solo.attack&&solo.airPhase==='grounded'&&
      ['idle','walk','run'].includes(solo.action)&&Math.hypot(solo.vx,solo.vy)>38){
    const gain=Math.max(0,Math.min(6*dt,80-solo.energy));
    solo.energy+=gain;state.soloRecovery+=gain;
  }
  const winding=nearby.filter(f=>f.attack&&f.attackSerial!=null&&!f.contact&&f.actionTime<.15);
  // The earliest attack in the overlapping window is free. Each additional
  // commitment pays the tax at most once, even if three blades overlap.
  winding.sort((a,b)=>b.actionTime-a.actionTime||a.attackSerial-b.attackSerial||a.slot-b.slot);
  for(const f of winding.slice(1)){
    if(state.taxed.get(f.id)===f.attackSerial)continue;
    const cost=Math.min(3,f.energy);
    state.taxed.set(f.id,f.attackSerial);f.energy-=cost;state.trioTax+=cost;
  }
}

/** Normalize tournament result on the actual engine tick, never from score. */
export function stepGauntletBattle(game,dt=GAUNTLET_STEP){
  stepArcade(game,dt);
  if(game.phase==='playing'&&game.gauntlet.simulationVersion>=2)applyGauntletBalance(game,dt);
  if(game.endReason==='timeout'&&game.phase!=='draw'){
    game.phase='draw';
    const end=game.events.at(-1);
    if(end?.kind==='round')end.phase='draw';
  }
  return game;
}

export function simulateGauntlet(fixture){
  const game=createGauntletBattle(fixture), actors=game.fighters;
  const rows=actors.map(()=>({ticks:0,guardTicks:0,closingTicks:0,distance:0,hits:{},lastX:0,lastY:0}));
  rows.forEach((r,i)=>{r.lastX=actors[i].x;r.lastY=actors[i].y;});
  const actorIndex=new Map(actors.map((a,i)=>[a.id,i]));
  let lastEvent=0;
  for(let n=0,max=Math.ceil(game.limit/GAUNTLET_STEP)+2;n<max&&game.phase==='playing';n++){
    stepGauntletBattle(game);
    actors.forEach((a,i)=>{
      const row=rows[i];
      const dx=a.x-row.lastX,dy=a.y-row.lastY;
      row.lastX=a.x;row.lastY=a.y;
      if(!a.alive)return;
      row.ticks++;
      if(a.action==='guard')row.guardTicks++;
      if(actors.some(o=>o.alive&&o.team!==a.team&&(o.x-a.x)**2+(o.y-a.y)**2<145**2))row.closingTicks++;
      // Voluntary rather than forced travel: exclude stagger, clash and KO.
      if(!['stagger','clash','ko'].includes(a.action))row.distance+=Math.hypot(dx,dy);
    });
    if(game.eventId===lastEvent)continue;
    for(const e of game.events){
      if(e.id<=lastEvent||!['hit','launch'].includes(e.kind)||!(e.damage>0)||!e.technique)continue;
      const index=actorIndex.get(e.fighterId), actor=actors[index];
      const move=actor&&validTournamentMove(e.technique,actor.form,'SSS+V');
      if(move)rows[index].hits[move]=(rows[index].hits[move]??0)+1;
    }
    lastEvent=game.eventId;
  }
  if(game.phase==='playing')throw new Error('Gauntlet simulation did not reach its deadline.');
  const winnerIndex=game.endReason==='timeout'?null:game.phase==='won'?0:game.phase==='lost'?1:null;
  const observations=actors.map((f,i)=>{
    const row=rows[i],plan=game.gauntlet.plans[i],stats={...f.stats};
    const elapsed=Math.max(.1,row.ticks*GAUNTLET_STEP);
    const preferredMove=Object.keys(row.hits).sort((a,b)=>row.hits[b]-row.hits[a]||a.localeCompare(b))[0]??plan.preferredMove;
    return {id:plan.id,fighterId:plan.id,arenaId:f.id,team:f.team,role:slotRole(i),alive:f.alive,form:f.form,
      kills:stats.kills,deaths:stats.deaths,assists:stats.assists,damage:stats.damage,stats,
      guard:unit(row.guardTicks/Math.max(1,row.ticks)*2.3+stats.blocks/elapsed*.50,0),
      pressure:unit(stats.saberSwings/elapsed*.35+row.closingTicks/Math.max(1,row.ticks)*.41,0),
      mobility:unit(row.distance/elapsed/180,0),
      doctrine:plan.doctrine,appliedMove:plan.preferredMove,preferredMove,
    };
  });
  return {winnerIndex,winner:winnerIndex,reason:game.endReason,time:Math.round(game.time*1e6)/1e6,
    fighters:observations,observations,simulationVersion:game.gauntlet.simulationVersion,
    staminaTuning:{soloRecovery:game.gauntlet.tuning.soloRecovery,trioTax:game.gauntlet.tuning.trioTax}};
}

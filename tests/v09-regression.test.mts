import { authoritativeState } from './helpers/presentation-state.mjs';
/** Independent release regression: natural rounds, exact continuation, old saves. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,step,nextRound,MAX_FIGHTER_HP} from '../dist/sim.js';
import {saveCampaign,loadCampaign,SAVE_KEY} from '../dist/persistence.js';
import {SOLDIER_GRADES,gradeDisplayLabel} from '../dist/progression.js';
import {canOccupy} from '../dist/terrain.js';
import {FORCE_ABILITIES} from '../dist/force-abilities.js';
import {resolveDamage} from '../dist/sim.js';
const memory = encoded => {const data=new Map(encoded?[[SAVE_KEY,encoded]]:[]);return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function roundTrip(game){const store=memory();const saved=saveCampaign(game,store);assert.equal(saved.ok,true,saved.error);const loaded=loadCampaign(store);assert.equal(loaded.error,null);assert.deepEqual(authoritativeState(loaded.game),authoritativeState(game));return loaded.game;}
function valid(game){
  assert.ok(game.tick<=game.config.roundDuration*60);
  for(const fighter of game.soldiers){assert.ok(Number.isFinite(fighter.hp)&&fighter.hp>=0&&fighter.hp<=fighter.maxHp&&fighter.maxHp<=MAX_FIGHTER_HP);assert.equal(fighter.alive,fighter.hp>0);assert.ok(fighter.energy>=0&&fighter.energy<=100);assert.ok(canOccupy(game.terrain,fighter));}
  if(game.config.modifier==='saber_only'){assert.deepEqual(game.stats.forceCasts,[0,0]);assert.ok(game.soldiers.every(s=>s.attack?.kind!=='force'));}
}
test('v09 all distinct top rank labels remain selectable across 1 through 15 fighters',()=>{
  assert.deepEqual(SOLDIER_GRADES.slice(9).map(g=>gradeDisplayLabel(g.label)),['SSS+ (entry)','SSS+ I','SSS+ II','SSS+ III','SSS+ IV','SSS+ V']);
  for(let n=1;n<=15;n++)for(const mapSize of ['small','medium','large']){const g=createGame(900+n,{teamSizes:[n,16-n],mapSize,startingRanks:['SSS+','SSS+V']});assert.equal(g.soldiers.length,16);assert.equal(g.soldiers[0].career.grade,'SSS+');assert.equal(g.soldiers.at(-1).career.grade,'SSS+V');valid(g);}
});
for(const matchMode of ['elimination','control','relic'])for(const modifier of ['standard','saber_only'])test(`v09 natural endless ${matchMode}/${modifier} preserves cumulative records and deterministic checkpoints`,()=>{
  let game=createGame(904,{teamSizes:[3,3],mapSize:'small',terrain:'crossroads',mode:'spectate',matchMode,modifier,roundDuration:45,startingRanks:['SSS+V','F'],forms:[['ataru','niman','makashi'],['ataru','niman','makashi']]});
  let totalWins=0;
  for(let round=1;round<=3;round++){
    step(game,3);valid(game);const loaded=roundTrip(game);step(game,1);step(loaded,1);assert.deepEqual(loaded,game,'save/load resumes exact deterministic state');
    step(game,45);assert.equal(game.status,'ended');valid(game);roundTrip(game);
    totalWins++;assert.equal(game.score[0]+game.score[1]+game.draws,totalWins);
    assert.ok(game.soldiers.every(s=>s.career.merit===game.careers[s.team][s.lane].merit));
    const durable=structuredClone({records:game.records,score:game.score,careers:game.careers,mastery:game.mastery});
    nextRound(game);assert.equal(game.round,round+1);assert.equal(game.status,'playing');
    for(const key of Object.keys(durable))assert.deepEqual(game[key],durable[key],`${key} retained at round transition`);
  }
});
for(const state of ['active','ended'])test(`v09 genuine v08 ${state} migration keeps durable history and original stored bytes`,()=>{
  const encoded=fs.readFileSync(new URL(`../docs/evidence/v0.9-v08-fixtures/${state}.json`,import.meta.url),'utf8'),old=JSON.parse(encoded).game;
  const store=memory(encoded),loaded=loadCampaign(store);assert.equal(loaded.error,null);assert.ok(loaded.game);assert.equal(store.getItem(SAVE_KEY),encoded);
  for(const key of ['round','score','draws','careers','records','mastery','history','forms','loadouts'])assert.deepEqual(loaded.game[key],old[key],key);
  assert.equal(loaded.game.config.matchMode,'relic');assert.equal(loaded.game.config.modifier,'saber_only');valid(loaded.game);roundTrip(loaded.game);
});

test('v09 each Force mechanic resolves through the real simulator and Saber only cancels it',()=>{
  // Deliberately controlled mechanics fixture; rank outcome audits use natural spawns.
  const fixture=(id,modifier='standard')=>{
    const g=createGame(21,{startingRanks:['SSS+V','F'],modifier});
    const a=g.soldiers[0],b=g.soldiers[5],c=g.soldiers[6];
    resolveDamage(g,g.soldiers.filter(s=>![a,b,c].includes(s)).map(s=>({target:s.id,amount:999})));
    g._nextAiDecision=1e8;
    for(const s of [a,b,c]){s.saberReadyTick=s.forceReadyTick=1e8;s.bank=s.holdBank=2;s.y=270;}
    a.x=420;b.x=490;c.x=510;c.y=280;
    // This fixture isolates each on-hit mechanic, not AI defense selection.
    b.staggerUntil=c.staggerUntil=10; b.guard=c.guard=false;
    a.attack={kind:'force',target:b.id,startedTick:0,resolveTick:1,counter:false,form:a.form,weapon:a.weapon,abilityId:id,aimX:b.x,aimY:b.y};
    return {g,a,b,c};
  };
  for(const id of Object.keys(FORCE_ABILITIES)){
    const {g,a,b,c}=fixture(id);const hp=b.hp,energy=b.energy,x=b.x,otherHp=c.hp;
    step(g,1/60);if(id!=='force_barrier')assert.equal(a.lastOutcome?.outcome,'hit',id);
    if(id==='force_push')assert.ok(b.x>x,id);
    if(id==='force_pull')assert.ok(b.x<x,id);
    if(id==='force_barrier'){assert.ok(a.barrierUntil>g.tick);assert.ok(a.barrierEnergy>0);assert.equal(b.hp,hp);}
    if(id==='force_throw')assert.ok(a.saberReadyTick>=g.tick+FORCE_ABILITIES[id].saberDelayTicks);
    if(id==='force_grip'){assert.equal(a.forceControl.targetId,b.id);assert.ok(b.airborne);}
    if(id==='force_lightning')assert.ok(b.energy<energy-10);
    if(['force_repulse','force_sweep'].includes(id))assert.ok(c.hp<otherHp,id);
    const disabled=fixture(id,'saber_only'),before=disabled.b.hp;step(disabled.g,1/60);
    assert.equal(disabled.a.attack,null);assert.equal(disabled.b.hp,before);assert.deepEqual(disabled.g.stats.forceCasts,[0,0]);
  }
});

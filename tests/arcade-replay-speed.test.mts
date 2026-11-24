import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplayStepper,normalizeReplaySpeed,REPLAY_TICK} from '../dist/replay-stepper.js';
const dist=process.env.SABER_CORE_DIST??new URL('../dist/',import.meta.url).href;
const {stepArcade}=await import(new URL('arcade-engine.js',dist));
const {createTournamentReplay,TOURNAMENT_REPLAY_RULESET}=await import(new URL('arcade-tournament-sim.js',dist));
const {createSquadReplay,SQUAD_REPLAY_RULESET}=await import(new URL('squad-tournament-sim.js',dist));
const {createQuestEncounter,stepQuestEncounter,questEncounterResult}=await import(new URL('arcade-quest-encounter.js',dist));
const fighters=[
  {id:'a',name:'Temu Rae',form:'ataru',chessStyle:'knight',body:'rabbit'},
  {id:'b',name:'Nara Qiu',form:'soresu',chessStyle:'queen',body:'woman'}
];
const teams=[{id:'one',name:'Temu-Nara'},{id:'two',name:'Iru-Qiu'}].map((t,i)=>({
  ...t,fighters:Array.from({length:5},(_,j)=>({...fighters[(i+j)%2],id:t.id+j}))
}));
test('1/2/4/8× advance exact 120Hz ticks; frame work cap carries, rather than loses, backlog',()=>{
 let ticks=0;
 const s=createReplayStepper({playing:()=>true,step:dt=>{assert.equal(dt,1/120);ticks++;},sample:()=>ticks});
 assert.equal(normalizeReplaySpeed(-8),1);
 for(const speed of [1,2,4,8]){
   assert.equal(s.setSpeed(String(speed)),speed);
   assert.equal(s.advance(1/60),speed*2);
 }
 assert.equal(ticks,30);assert.equal(s.previous,29);
 const delta=1.23,required=Math.floor(delta*8/REPLAY_TICK);
 assert(s.advance(delta)<required);
 while(s.remainder>=REPLAY_TICK)s.advance(0);
 assert.equal(ticks,30+required);assert.equal(s.previous,ticks-1);
});
test('quarter and half pace carry fractional render frames without dropping simulation ticks',()=>{
 let ticks=0;const s=createReplayStepper({speed:.25,playing:()=>true,step:dt=>{assert.equal(dt,REPLAY_TICK);ticks++;}});
 assert.equal(s.advance(1/60),0);
 assert.equal(s.advance(1/60),1);
 assert.equal(s.setSpeed('0.5'),.5);
 assert.equal(s.advance(1/60),1);
 assert.equal(ticks,2);
});
function finish(make,step,pace){
  const game=make();
  const s=createReplayStepper({speed:pace,playing:()=>game.phase==='playing',step:dt=>step(game,dt)});
  for(let i=0;game.phase==='playing'&&i<30000;i++){
    if(i===39&&pace===8)s.setSpeed(2);
    if(i===61&&pace===8)s.setSpeed(8);
    s.advance(i%23===0?.14:i%3===0?.01:.017);
  }
  assert.notEqual(game.phase,'playing');
  return game;
}
const result=g=>({
  time:g.time,phase:g.phase,reason:g.endReason,kills:g.stats.kills,deaths:g.stats.deaths,
  moves:g.fighters.map(f=>f.moves),events:g.events, rng:g.rng
});
test('same solo and 5v5 engines reproduce outcome, time, K/D, moves, events and RNG with bursty 8× replay and live switches',()=>{
  for(const make of [
    ()=>createTournamentReplay({ruleset:TOURNAMENT_REPLAY_RULESET,fighters,seed:21,grade:'A',limit:45,terrain:'underpit'}),
    ()=>createSquadReplay({ruleset:SQUAD_REPLAY_RULESET,teams,seed:316954,round:1,limit:45,terrain:'underpit'}),
  ])assert.deepEqual(result(finish(make,stepArcade,8)),result(finish(make,stepArcade,1)));
});
test('completed quest replay pace preserves the encounter result',()=>{
  const make=()=>createQuestEncounter(17,{id:'hero-test',name:'Aurel of the Shore',form:'djem_so',elo:1600}).game;
  const baseline=questEncounterResult(finish(make,stepQuestEncounter,1));
  for(const pace of [.25,8])assert.deepEqual(questEncounterResult(finish(make,stepQuestEncounter,pace)),baseline);
});

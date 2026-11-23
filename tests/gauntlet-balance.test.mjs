import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGauntlet,saveGauntlet,startGauntlet,nextGauntletBout,recordGauntletBout} from '../dist/gauntlet-tournament.js';
import {applyGauntletBalance,createGauntletBattle,simulateGauntlet,stepGauntletBattle} from '../dist/gauntlet-sim.js';

const fixture=()=>nextGauntletBout(startGauntlet(loadGauntlet({getItem:()=>null}),{seed:1492,limit:30}));
function place(game){
  const [solo,...trio]=game.fighters;
  Object.assign(solo,{x:300,y:300,vx:60,vy:0,energy:50,airPhase:'grounded',action:'run',attack:null});
  for(let i=0;i<3;i++)Object.assign(trio[i],{x:380,y:310+i*20,energy:50,attack:'slash',attackSerial:20+i,actionTime:.10-i*.02,contact:false});
  return [solo,...trio];
}

test('Gauntlet solo movement recovers stamina only under nearby crossfire; overlapping trio attacks each pay once',()=>{
  const game=createGauntletBattle(fixture()), [solo,lead,two,three]=place(game);
  applyGauntletBalance(game,1/120);
  assert.equal(solo.energy,50.05);
  assert.deepEqual([lead.energy,two.energy,three.energy],[50,47,47]);
  applyGauntletBalance(game,1/120);
  assert.deepEqual([lead.energy,two.energy,three.energy],[50,47,47]);
  solo.attack='slash';
  const energy=solo.energy;
  applyGauntletBalance(game,1/120);assert.equal(solo.energy,energy);
  solo.attack=null; two.alive=false; three.alive=false;
  applyGauntletBalance(game,1/120);assert.equal(solo.energy,energy);
});

test('legacy unversioned replays still use the original rules; new fixtures and reloads preserve the new rules',()=>{
  const store={raw:null,getItem(){return this.raw},setItem(key,value){this.raw=value}};
  let state=startGauntlet(loadGauntlet(store),{seed:224,limit:30});
  const f=nextGauntletBout(state);
  assert.equal(f.simulationVersion,2);
  const modern=simulateGauntlet(f);
  assert.equal(modern.simulationVersion,2);
  state=recordGauntletBout(state,f.id,modern);
  assert(saveGauntlet(state,store));assert.equal(loadGauntlet(store).active.lastFixture.simulationVersion,2);
  const old=JSON.parse(store.raw);delete old.active.lastFixture.simulationVersion;store.raw=JSON.stringify(old);
  const loaded=loadGauntlet(store), legacy=simulateGauntlet(loaded.active.lastFixture);
  assert.equal(legacy.simulationVersion,1);
  assert.deepEqual(legacy.staminaTuning,{soloRecovery:0,trioTax:0});
  assert.equal(nextGauntletBout(loaded).simulationVersion,2);
});

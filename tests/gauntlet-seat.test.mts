import test from 'node:test';
import assert from 'node:assert/strict';

// The seat reads and writes the page's own storage, so the tests give it one they can break on purpose.
const data=new Map<string,string>();
let refuse: (key: string,value: string)=>boolean=()=>false;
(globalThis as {localStorage?: unknown}).localStorage={
  getItem:(k: string)=>data.get(k)??null,
  setItem:(k: string,v: string)=>{if(refuse(k,v))throw new Error('QuotaExceededError');data.set(k,String(v));},
  removeItem:(k: string)=>{data.delete(k);},
};
const {GAUNTLET_KEY,startGauntlet,loadGauntlet,saveGauntlet,nextGauntletBout,recordGauntletBout}=await import('../dist/gauntlet-tournament.js?v=4.01.1');
const {simulateGauntlet}=await import('../dist/gauntlet-sim.js?v=3.2.3');
const {openGauntletSeat}=await import('../dist/gauntlet-seat.js');
const {GAUNTLET_HUMAN_KEY,humanBoutReplay}=await import('../dist/gauntlet-play.js');
const {exportArcadeBackup,inspectArcadeBackup,restoreArcadeBackup}=await import('../dist/arcade-backup.js');

function fresh(seed=41){
  data.clear();refuse=()=>false;
  assert.equal(saveGauntlet(startGauntlet(loadGauntlet(),{seed,limit:15})),true);
}
async function fightOut(){
  const opened=openGauntletSeat();
  assert.equal(opened.ok,true);
  const seat=(opened as {seat: {game: {phase: string};step(i: unknown): void;finish(): Promise<{saved: boolean;text: string}>}}).seat;
  while(seat.game.phase==='playing')seat.step({});
  return seat;
}

test('a fought bout saves its controls, and Watch last bout shows that fight',async()=>{
  fresh();
  const end=await (await fightOut()).finish();
  assert.equal(end.saved,true);
  assert.equal(humanBoutReplay(data.get(GAUNTLET_HUMAN_KEY),loadGauntlet()).kind,'replay');
});

test('if storage refuses the full log, the save says the replay is unavailable instead of faking one',async()=>{
  fresh();
  const seat=await fightOut();
  refuse=(k,v)=>k===GAUNTLET_HUMAN_KEY&&v.includes('"runs"');
  const end=await seat.finish();
  assert.equal(end.saved,true);
  const state=loadGauntlet();
  assert.equal(state.active.cursor,1);
  assert.deepEqual(humanBoutReplay(data.get(GAUNTLET_HUMAN_KEY),state),{kind:'unavailable'});
});

test('if storage refuses even the marker, the bout is not saved',async()=>{
  fresh();
  const before=data.get(GAUNTLET_KEY);
  const seat=await fightOut();
  refuse=k=>k===GAUNTLET_HUMAN_KEY;
  const end=await seat.finish();
  assert.equal(end.saved,false);
  assert.match(end.text,/storage full/);
  assert.equal(data.get(GAUNTLET_KEY),before);
});

test('if the season save fails, the earlier fight record is put back and can never match a later simulated bout',async()=>{
  fresh();
  data.set(GAUNTLET_HUMAN_KEY,'{"earlier":true}');
  const seat=await fightOut();
  refuse=k=>k===GAUNTLET_KEY;
  const end=await seat.finish();
  assert.equal(end.saved,false);
  assert.equal(data.get(GAUNTLET_HUMAN_KEY),'{"earlier":true}');
  refuse=()=>false;
  let state=loadGauntlet();const f=nextGauntletBout(state);
  state=recordGauntletBout(state,f.id,simulateGauntlet(f));assert.equal(saveGauntlet(state),true);
  assert.equal(humanBoutReplay(data.get(GAUNTLET_HUMAN_KEY),loadGauntlet()).kind,'none','the simulated bout replays as simulated');
});

test('a simulated bout after a fought one replays as simulated',async()=>{
  fresh();
  await (await fightOut()).finish();
  let state=loadGauntlet();const f=nextGauntletBout(state);
  state=recordGauntletBout(state,f.id,simulateGauntlet(f));assert.equal(saveGauntlet(state),true);
  assert.equal(humanBoutReplay(data.get(GAUNTLET_HUMAN_KEY),loadGauntlet()).kind,'none');
});

test('two tabs: a bout settled in another tab while this one fights is not written twice',async()=>{
  fresh();
  const seat=await fightOut();
  let other=loadGauntlet();const f=nextGauntletBout(other);
  other=recordGauntletBout(other,f.id,simulateGauntlet(f));assert.equal(saveGauntlet(other),true);
  const saved=data.get(GAUNTLET_KEY);
  const end=await seat.finish();
  assert.equal(end.saved,false);
  assert.match(end.text,/another tab/);
  assert.equal(data.get(GAUNTLET_KEY),saved);
});

test('a seat link with nothing to fight returns its reason instead of opening',()=>{
  data.clear();refuse=()=>false;
  const opened=openGauntletSeat();
  assert.equal(opened.ok,false);
  assert.match((opened as {text: string}).text,/draw a bracket/);
});

test('restored from a backup on a new device, a fought bout says Replay unavailable, never an AI replay',async()=>{
  fresh();
  assert.equal((await (await fightOut()).finish()).saved,true);
  const file=exportArcadeBackup(globalThis.localStorage as never);
  assert.equal(file.ok,true);
  const map=new Map<string,string>(), empty={getItem:(k: string)=>map.get(k)??null,setItem:(k: string,v: string)=>{map.set(k,v);},removeItem:(k: string)=>{map.delete(k);}};
  assert.equal(restoreArcadeBackup(inspectArcadeBackup((file as {text: string}).text),empty as never).ok,true);
  assert.equal(map.has(GAUNTLET_HUMAN_KEY),false,'the controls stay on the first device');
  let restored=loadGauntlet(empty as never);
  assert.ok(restored.active?.lastFixture);
  assert.equal(humanBoutReplay(null,restored).kind,'unavailable');
  const f=nextGauntletBout(restored);
  restored=recordGauntletBout(restored,f.id,simulateGauntlet(f));
  assert.equal(humanBoutReplay(null,restored).kind,'none','the next simulated bout replays as simulated');
});

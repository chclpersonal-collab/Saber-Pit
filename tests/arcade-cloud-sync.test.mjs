import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserCloudTransport,createCloudSync} from '../dist/arcade-cloud-sync.js';
const dist=process.env.SABER_CORE_DIST??new URL('../dist/',import.meta.url).href;
const backup=await import(new URL('arcade-backup.js',dist));
const {loadTournament,startTournament,saveTournament,resetTournament,runTournamentStep}=await import(new URL('arcade-tournament.js',dist));
function browser(){
  const values=new Map();
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
}
function localSave(storage,seed){
  const state=loadTournament(storage);
  startTournament(state,{seed,fieldSize:32});saveTournament(state,storage);
  return state;
}
function lab(){
  const sections={};
  const calls=[];
  let offline=false,conflict=false;
  const request=async(url,opt)=>{
    calls.push([url,opt.method]);
    assert.equal(opt.credentials,'same-origin');
    if(offline)throw Error('Offline');
    const key=url.split('/').at(-1);
    const reply=(status,v)=>new Response(JSON.stringify(v),{status});
    if(opt.method==='GET')return reply(200,{version:1,sections});
    const {baseRevision,value}=JSON.parse(opt.body),expected=sections[key]?.revision??0;
    if(expected!==baseRevision||conflict)return reply(409,{error:'conflict'});
    const revision=expected+1;
    sections[key]={revision,value,updatedAt:'2026-11-23'};
    return reply(200,{version:1,section:key,revision});
  };
  function device(){
    const storage=browser(),copies=new Map();
    const transport=createBrowserCloudTransport({request});
    const controller=createCloudSync({storage,transport,backup,preserve:async(k,v)=>Boolean(copies.set(k,v))});
    return {storage,copies,...controller};
  }
  return {device,calls,sections,setOffline:v=>{offline=v},setConflict:v=>{conflict=v}};
}
test('disabled does no network; first PC upload and blank phone one-click load use real backup validation',async()=>{
  const l=lab(),pc=l.device(),phone=l.device();
  localSave(pc.storage,781);
  assert.equal((await pc.sync()).status,'disabled');assert.deepEqual(l.calls,[]);
  assert.equal((await pc.sync({action:'enable'})).status,'uploaded');
  const saved=l.sections.duel.value;
  assert.equal((await phone.sync({action:'enable'})).status,'downloaded');
  assert.deepEqual(loadTournament(phone.storage),saved);
  assert.equal((await phone.sync()).status,'current');
  assert.equal(l.calls.filter(([,method])=>method==='PUT').length,1);
});
test('different local save requires explicit review, preserves recovery, and stale confirmation never applies',async()=>{
  const l=lab(),pc=l.device(),phone=l.device();
  localSave(pc.storage,721);localSave(phone.storage,812);
  await pc.sync({action:'enable'});
  const v=await phone.sync({action:'enable'});
  assert.equal(v.status,'conflict');assert.equal(v.device.duel.seasons,1);
  assert.equal((await phone.sync({action:'cloud',expectedRevision:'77.0.0',expectedLocalDigest:v.localDigest})).status,'changed');
  assert.equal((await phone.sync({action:'cloud',expectedRevision:v.cloudRevision,expectedLocalDigest:v.localDigest})).status,'downloaded');
  assert.equal(backup.inspectArcadeBackup(phone.copies.get('previous-device')).ok,true);
});
test('resets and offline changes never overwrite cloud; stale PUT is surfaced',async()=>{
  const l=lab(),pc=l.device();
  const pcState=localSave(pc.storage,732);
  await pc.sync({action:'enable'});
  l.setOffline(true);
  runTournamentStep(pcState,()=>({winnerIndex:0,time:5,reason:"elimination",kills:[1,0],deaths:[0,1]}));saveTournament(pcState,pc.storage);
  assert.equal((await pc.sync()).status,'error');
  assert.equal(l.sections.duel.revision,1);
  l.setOffline(false);l.setConflict(true);
  assert.equal((await pc.sync()).status,'changed');
  l.setConflict(false);
  assert.equal((await pc.sync()).status,'uploaded');
  assert.equal(l.sections.duel.revision,2);
  const reset=resetTournament(pcState);saveTournament(reset,pc.storage);
  const v=await pc.sync();
  assert.equal(v.status,'reset');
  assert.equal((await pc.sync({action:'device',expectedRevision:v.cloudRevision,expectedLocalDigest:v.localDigest})).status,'reset');
  assert.equal(l.sections.duel.revision,2);
  await pc.sync({action:'disable'});const before=l.calls.length;
  assert.equal((await pc.sync()).status,'disabled');assert.equal(l.calls.length,before);
});

test('linked clean phone pulls later PC progress at startup; dirty phone does not pull it',async()=>{
  const l=lab(),pc=l.device(),phone=l.device(),dirty=l.device();
  const pcState=localSave(pc.storage,384);
  await pc.sync({action:'enable'});
  saveTournament(loadTournament(phone.storage),phone.storage);
  assert.equal((await phone.sync({action:'enable'})).status,'downloaded');
  assert.equal((await dirty.sync({action:'enable'})).status,'downloaded');
  const win=()=>({winnerIndex:0,time:5,reason:'elimination',kills:[1,0],deaths:[0,1]});
  const tr=loadTournament(dirty.storage);
  runTournamentStep(tr,()=>({...win(),winnerIndex:1,kills:[0,1],deaths:[1,0]}));saveTournament(tr,dirty.storage);
  runTournamentStep(pcState,win);saveTournament(pcState,pc.storage);
  assert.equal((await pc.sync()).status,'uploaded');
  assert.equal((await phone.sync({action:'startup'})).status,'downloaded');
  assert.deepEqual(loadTournament(phone.storage),l.sections.duel.value);
  assert.equal((await dirty.sync({action:'startup'})).status,'conflict');
  assert.equal((await dirty.sync()).status,'conflict');
  assert.notDeepEqual(loadTournament(dirty.storage),l.sections.duel.value);
});

test('versioned empty saves never initialize Cloud, and startup GET receives an abort signal',async()=>{
  const l=lab(),phone=l.device();
  saveTournament(loadTournament(phone.storage),phone.storage);
  assert.equal((await phone.sync({action:'enable'})).status,'empty');
  assert.deepEqual(Object.keys(l.sections),[]);
  assert.equal(l.calls.some(([,method])=>method==='PUT'),false);
  const request=async(_,options)=>{
    assert.equal(options.method,'GET');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({version:1,sections:{}}));
  };
  assert.equal(await createBrowserCloudTransport({request}).read({timeout:1800}),null);
});

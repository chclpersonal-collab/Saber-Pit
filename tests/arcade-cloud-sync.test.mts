import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOUD_SYNC_KEY,createBrowserCloudTransport,createCloudSync} from '../dist/arcade-cloud-sync.js';
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
function lab({capable=false}={}){
  const sections={};
  const calls=[];
  let offline=false,conflict=false;
  const request=async(url,opt)=>{
    calls.push([url,opt.method]);
    assert.equal(opt.credentials,'same-origin');
    if(offline)throw Error('Offline');
    const key=url.split('/').at(-1);
    const reply=(status,v)=>new Response(JSON.stringify(v),{status});
    if(opt.method==='GET'){
      assert.equal(url,'/api/cloud-save?scope=all');
      return reply(200,{version:1,sections,...(capable?{capability:'saber-pit-cloud-save',supportedSections:['duel','squad','quest','arena','gauntlet']}:{} )});
    }
    const {baseRevision,value}=JSON.parse(opt.body),expected=sections[key]?.revision??0;
    if(expected!==baseRevision||conflict)return reply(409,{error:'conflict'});
    const revision=expected+1;
    sections[key]={revision,value,updatedAt:'2026-11-23'};
    return reply(200,{version:1,section:key,revision});
  };
  function device(){
    const storage=browser(),copies=new Map();
    const transport=createBrowserCloudTransport({request});
    const controller=createCloudSync({storage,transport,backup:{...backup,exportArcadeBackup:(store,sections)=>backup.exportArcadeBackup(store,{sections})},preserve:async(k,v)=>Boolean(copies.set(k,v))});
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

test('verified new browser auto-restores clean cloud progress and an explicit disable survives reopening',async()=>{
  const l=lab({capable:true}),pc=l.device(),phone=l.device();
  const source=localSave(pc.storage,490);
  assert.equal((await pc.sync({action:'enable'})).status,'uploaded');
  assert.equal(pc.prefs().rev,'1.0.0');
  assert.equal((await phone.sync({action:'startup',discover:true})).status,'downloaded');
  assert.equal(phone.prefs().enabled,true);
  assert.deepEqual(loadTournament(phone.storage),source);
  assert.equal(l.calls.filter(([,method])=>method==='PUT').length,1);
  await phone.sync({action:'disable'});
  assert.equal(JSON.parse(phone.storage.getItem(CLOUD_SYNC_KEY)).enabled,false);
  const n=l.calls.length;
  assert.equal((await phone.sync({action:'startup',discover:true})).status,'disabled');
  assert.equal(l.calls.length,n);
});

test('discovery neither uploads nor overwrites unlinked legacy, divergent, or mounted clients',async()=>{
  const wrong=lab(),old=wrong.device(),clone=wrong.device();
  localSave(old.storage,1); await old.sync({action:'enable'});
  assert.equal((await clone.sync({action:'startup',discover:true})).status,'disabled');
  assert.equal(clone.prefs().enabled,false);
  assert.equal(clone.storage.getItem(CLOUD_SYNC_KEY),null);
  const l=lab({capable:true}),pc=l.device(),mounted=l.device(),dirty=l.device();
  const initial=localSave(dirty.storage,547);
  assert.equal((await dirty.sync({action:'startup',discover:true})).status,'unlinked');
  assert.equal(l.calls.some(([,method])=>method==='PUT'),false);
  localSave(pc.storage,12); await pc.sync({action:'enable'});
  assert.equal((await dirty.sync({action:'startup',discover:true})).status,'conflict');
  assert.deepEqual(loadTournament(dirty.storage),initial);
  assert.equal((await mounted.sync({action:'startup',discover:true,revealOnly:true})).status,'cloud-newer');
  assert.equal(mounted.prefs().enabled,false);
  assert.equal(loadTournament(mounted.storage).season,0);
});

test('Arena Elo goes both ways across new browser startup, old workers never receive new sections',async()=>{
  const {saveArcadeCareer,readArcadeCareer}=await import(new URL('arcade-career.js',dist));
  const arena={mode:'duel',seed:22,round:8,careers:{'0-0':{merit:520}},arenaRatings:{'0-0':188.5}};
  const legacy=lab(),old=legacy.device();
  saveArcadeCareer(arena,old.storage);localSave(old.storage,72);
  assert.equal((await old.sync({action:'enable'})).status,'uploaded');
  assert.equal(legacy.calls.some(([url])=>url.endsWith('/arena')),false);
  const l=lab({capable:true}),pc=l.device(),phone=l.device();
  localSave(pc.storage,72);
  assert.equal((await pc.sync({action:'enable'})).status,'uploaded');
  assert.equal(pc.prefs().rev,'1.0.0');
  assert.ok(saveArcadeCareer(arena,pc.storage));
  // A known existing row advanced after an interrupted acknowledgement. Its
  // bytes still agree, so only create the new missing section.
  l.sections.duel.revision=2;
  assert.equal((await pc.sync()).status,'uploaded');
  assert.equal(pc.prefs().rev,'2.0.0.1.0');
  assert.equal((await phone.sync({action:'startup',discover:true})).status,'downloaded');
  assert.deepEqual(readArcadeCareer(phone.storage).arenaRatings,{'0-0':188.5});
  assert.ok(saveArcadeCareer({...arena,round:9,arenaRatings:{'0-0':196}},pc.storage));
  assert.equal((await pc.sync()).status,'uploaded');
  assert.equal((await phone.sync()).status,'cloud-newer');
  assert.equal(readArcadeCareer(phone.storage).round,8); // mounted check never overwrites state
  assert.equal((await phone.sync({action:'startup'})).status,'downloaded');
  assert.equal(readArcadeCareer(phone.storage).round,9);
});


test('mounted checks distinguish a safe refresh from review and do not restore themselves',async()=>{
  const l=lab({capable:true}),pc=l.device(),phone=l.device(),dirty=l.device(),fresh=l.device();
  const pcState=localSave(pc.storage,402);
  assert.equal((await pc.sync({action:'enable'})).status,'uploaded');
  for(const device of [phone,dirty])assert.equal((await device.sync({action:'startup',discover:true})).status,'downloaded');
  const observe=()=>({winnerIndex:0,time:6,reason:'elimination',kills:[1,0],deaths:[0,1]});
  const observed=loadTournament(dirty.storage);
  runTournamentStep(observed,()=>({...observe(),winnerIndex:1,kills:[0,1],deaths:[1,0]}));
  saveTournament(observed,dirty.storage);
  runTournamentStep(pcState,observe);saveTournament(pcState,pc.storage);
  assert.equal((await pc.sync()).status,'uploaded');
  const before=loadTournament(phone.storage);
  const result=await phone.sync();
  assert.equal(result.status,'cloud-newer');assert.equal(result.canRefresh,true);
  assert.deepEqual(loadTournament(phone.storage),before);
  const divergent=await dirty.sync();
  assert.equal(divergent.status,'conflict');assert.equal(divergent.canRefresh,undefined);
  assert.deepEqual(loadTournament(dirty.storage),observed);
  const reveal=await fresh.sync({action:'startup',discover:true,revealOnly:true});
  assert.equal(reveal.canRefresh,true);
  assert.equal(fresh.storage.getItem(CLOUD_SYNC_KEY),null);
  assert.equal((await phone.sync({action:'startup',discover:true})).status,'downloaded');
  assert.equal((await fresh.sync({action:'startup',discover:true})).status,'downloaded');
  assert.deepEqual(loadTournament(phone.storage),loadTournament(pc.storage));
  assert.deepEqual(loadTournament(fresh.storage),loadTournament(pc.storage));
  assert.ok(phone.copies.get('previous-device'));
  assert.equal(l.calls.filter(([,method])=>method==='PUT').length,2);
});

test('one same-owner cloud carries all five actual save sections across independent profiles',async()=>{
  const l=lab({capable:true}),source=l.device(),target=l.device();
  const {saveTournamentHero,nextTournamentBout}=await import(new URL('arcade-tournament.js',dist));
  const s=await import(new URL('squad-tournament.js',dist));
  const q=await import(new URL('arcade-quests.js',dist));
  const a=await import(new URL('arcade-career.js',dist));
  const g=await import(new URL('gauntlet-tournament.js',dist));
  const won=()=>({winnerIndex:0,kills:[1,0],deaths:[0,1],time:10,reason:'elimination'});
  const solo=localSave(source.storage,48);const id=nextTournamentBout(solo).fighterIds[0];runTournamentStep(solo,won);
  const hero=saveTournamentHero(solo,id);saveTournament(solo,source.storage);
  const squad=s.startSquadTournament(s.loadSquadTournament(source.storage),{seed:19});s.runSquadStep(squad,won);s.saveSquadTournament(squad,source.storage);
  const quests=q.loadQuests(source.storage);q.deployQuest(quests,hero.id,[hero],123456);q.saveQuests(quests,source.storage);
  assert.ok(a.saveArcadeCareer({mode:'watch',round:9,seed:48,careers:{'0-0':{merit:401},'1-0':{merit:680}},arenaRatings:{'0-0':153.5,'1-0':144.5}},source.storage));
  let gauntlet=g.startGauntlet(undefined,{seed:777});gauntlet=g.recordGauntletBout(gauntlet,g.nextGauntletBout(gauntlet).id,won());assert.ok(g.saveGauntlet(gauntlet,source.storage));
  const sections=['duel','squad','quest','arena','gauntlet'];
  const read=store=>backup.exportArcadeBackup(store,{sections}).bundle.sections;
  assert.equal((await source.sync({action:'startup',discover:true})).status,'unlinked');
  assert.equal((await source.sync({action:'enable'})).status,'uploaded');
  assert.deepEqual(Object.keys(read(source.storage)).sort(),sections.toSorted());
  assert.equal((await target.sync({action:'startup',discover:true})).status,'downloaded');
  assert.deepEqual(read(target.storage),read(source.storage));
  assert.equal(l.calls.filter(([,method])=>method==='PUT').length,5);
  runTournamentStep(solo,won);saveTournament(solo,source.storage);
  assert.equal((await source.sync()).status,'uploaded');
  assert.equal((await target.sync()).canRefresh,true);
  assert.equal((await target.sync({action:'startup',discover:true})).status,'downloaded');
  assert.deepEqual(read(target.storage),read(source.storage));
  assert.deepEqual(l.calls.filter(([,method])=>method==='PUT').map(([path])=>path.split('/').at(-1)),[...sections,'duel']);
});

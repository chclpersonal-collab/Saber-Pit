import test from 'node:test';
import assert from 'node:assert/strict';
import {GAUNTLET_KEY,loadGauntlet,nextGauntletBout} from '../dist/gauntlet-tournament.js';

test('Gauntlet desk schedules, runs seasons, safely resumes, and keeps other saves intact',async()=>{
  const touched=['document','window','localStorage','navigator','Worker','setTimeout','clearTimeout'];
  const originals=Object.fromEntries(touched.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const oldObjectURL=URL.createObjectURL, oldRevoke=URL.revokeObjectURL;
  const elements=new Map(), events={}, memory=new Map([['saber-pit:tournament:1','existing solo'],['saber-pit:squad-tournament:1','existing squads']]);
  const queue=[], timers=new Map();
  let timerId=0,locked=false,maxActive=0,csv=null;
  const ready=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
  class E{
    constructor(tag){Object.assign(this,{tag,value:'',hidden:false,disabled:false,checked:false,open:false,children:[],events:{},textContent:''});}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    addEventListener(k,handler){this.events[k]=handler;}
    setAttribute(){}
    focus(){globalThis.document.activeElement=this;}
    scrollIntoView(){}
    click(){this.fire('click');}
    remove(){}
    showModal(){this.open=true;}
    close(){this.open=false;this.fire('close');}
    fire(type='click'){if(!this.disabled)this.events[type]?.({target:this,preventDefault(){}});}
  }
  const $=id=>{if(!elements.has(id))elements.set(id,new E('id'));return elements.get(id);};
  const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const real=()=>loadGauntlet(storage);
  const texts=n=>typeof n==='string'?n:[n.textContent,...n.children.flatMap(texts)].join(' ');
  const flushTimer=async()=>{const time=timers.entries().next().value;assert(time);timers.delete(time[0]);time[1]();await ready();};
  function complete(winnerIndex=0){
    assert.equal(queue.length,1);
    const w=queue.shift();
    w.onmessage({data:{result:{winnerIndex,time:winnerIndex===null?w.fixture.limit:12.25,reason:winnerIndex===null?'timeout':'elimination',
      fighters:w.fixture.fighters.map(f=>({fighterId:f.id,doctrine:f.role==='solo'?'defensive':'aggressive',guard:.6,pressure:.45,mobility:.55}))}}});
    return w;
  }
  try{
    Object.assign(globalThis,{document:{getElementById:$,createElement:tag=>new E(tag),body:new E('body')},
      window:{addEventListener:(name,handler)=>{events[name]=handler;}},localStorage:storage,
      Worker:class{
        postMessage({fixture}){this.fixture=fixture;queue.push(this);maxActive=Math.max(maxActive,queue.length);}
        terminate(){const i=queue.indexOf(this);if(i>=0)queue.splice(i,1);}
      },setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{async request(_,opts,handler){
      assert.equal(opts.ifAvailable,true);if(locked)return handler(null);
      locked=true;try{return await handler({});}finally{locked=false;}
    }}}});
    URL.createObjectURL=blob=>{csv=blob;return 'blob:gauntlet-test';};
    URL.revokeObjectURL=()=>{};
    $('gSeed').value='123';$('gArena').value='rotation';$('gLimit').value='75';
    await import('../dist/gauntlet.js');
    assert.equal($('gPlay').disabled,true);
    assert.equal($('gSetup').hidden,false);
    assert.equal($('gSetupTitle').textContent,'Start a season');
    $('gSetup').fire('submit');await ready();
    assert.equal(real().season,1);assert.equal(real().active.limit,75);assert.equal(real().active.groups.length,4);
    assert.match($('gSeasonBadge').textContent,/Season 1 · Week 1/);
    assert.equal($('gGroups').children.length,4);
    assert.equal($('gSetup').hidden,true);
    assert.doesNotMatch(texts($('gGroups')),/Advances to final/);
    $('gRun').fire();await ready();
    assert.equal(queue[0].fixture.id,nextGauntletBout(real()).id);
    const solo=queue[0].fixture.soloId;
    const badges=()=> $('gLedgerRows').children.flatMap(row=>row.children[0].children[0]?.children??[]).filter(b=>b&&typeof b==='object').map(b=>b.textContent);
    assert.deepEqual(badges(),[]); // 1500 seed Elo alone does not earn a title.
    $('gStop').fire();assert.equal($('gStop').disabled,true);
    const first=complete();await ready();
    assert.equal(real().active.cursor,1);assert.match($('gStatus').textContent,/Stopped/);
    assert.equal(real().fighters.find(f=>f.id===solo).solo.wins,1);
    assert.equal(real().fighters.find(f=>f.id===solo).adaptation.solo.bouts,1);
    assert.deepEqual(badges(),['GM','GM','GM','GM']);
    const saved=memory.get(GAUNTLET_KEY);
    first.onmessage({data:{result:{winnerIndex:0}}});await ready();
    assert.equal(memory.get(GAUNTLET_KEY),saved);
    assert.match(texts($('gDeltas')),/\+12/);
    $('gFind').value=real().fighters.find(f=>f.id===solo).name;$('gFind').fire('input');
    assert.equal($('gLedgerRows').children.length,1);
    $('gLedgerRows').children[0].children[0].children[0].fire();
    assert.match(texts($('gRoleReports')),/1 studied/);
    assert.match($('gFighterMeta').textContent,/Current Elo .*Peak Elo/);$('gFavorite').fire();
    $('gFind').value='';$('gFavoritesOnly').checked=true;$('gFavoritesOnly').fire('change');
    assert.equal($('gLedgerRows').children.length,1);
    $('gStageFilter').value='final';$('gStageFilter').fire('change');assert.equal($('gGroups').hidden,true);
    $('gCsv').fire();assert.match(await csv.text(),/Solo victory/);
    timers.clear();
    locked=true;$('gPlay').fire();await ready();assert.match($('gStatus').textContent,/another tab/);locked=false;
    $('gPlay').fire();await ready();assert.equal(queue[0].fixture.id,nextGauntletBout(real()).id);
    const priorSave=memory.get(GAUNTLET_KEY), parsed=JSON.parse(priorSave);
    const participants=parsed.fighters.filter(f=>f.solo.wins+f.trio.losses>0);
    for(let i=0;i<3;i++)participants[i].peakElo=1600+i*100;
    const fromAnother=JSON.stringify(parsed)+' ';memory.set(GAUNTLET_KEY,fromAnother);
    events.storage({key:GAUNTLET_KEY});await ready();assert.equal(queue.length,0);
    assert.equal(memory.get(GAUNTLET_KEY),fromAnother);assert.equal(real().active.cursor,1);
    $('gFavoritesOnly').checked=false;$('gFavoritesOnly').fire('change');
    assert.deepEqual([...badges()].sort(),['AGM','GM','HGM','SGM']);
    assert(real().fighters.find(f=>f.id===participants[2].id).elo<1800);
    $('gPlay').fire();await ready();
    const leaving=queue[0];events.pagehide();await ready();
    leaving.onmessage({data:{result:{winnerIndex:0}}});await ready();
    events.pageshow({persisted:true});assert.equal(queue.length,0);
    assert.equal(memory.get(GAUNTLET_KEY),fromAnother);
    $('gRun').focus();$('gRun').fire();await ready();
    for(let i=1;i<20;i++){complete(0);await ready();if(i<19)await flushTimer();}
    assert.equal(real().active.status,'complete');assert.equal(real().active.bouts.length,20);
    assert.match(texts($('gMedals')),/Gold · Champion/);assert.equal(maxActive,1);
    const completed=real().active;
    assert.deepEqual($('gGroups').children.map(card=>card.children[1].children.filter(row=>row.className==='g-advances').length),[1,1,1,1]);
    assert.deepEqual(completed.standings.map((rows,i)=>texts($('gGroups').children[i].children[1].children[0]).includes(real().fighters.find(f=>f.id===rows[0].id).name)),[true,true,true,true]);
    assert.match(texts($('gGroups').children[0]),/4 \/ 4 bouts/);
    assert.equal($('gSetup').hidden,false);
    assert.equal($('gSetupTitle').textContent,'Start Season 2');
    assert.match($('gSetupHelp').textContent,/roster and career Elo carry over/);
    assert.equal(document.activeElement,$('gDraw'));
    $('gSetup').fire('submit');await ready();assert.equal(real().season,2);
    $('gRun').fire();await ready();
    for(let i=0;i<20;i++){complete(null);await ready();if(i<19)await flushTimer();}
    assert.equal(real().active.status,'complete');
    assert.match($('gProgressText').textContent,/20 draws/);
    assert.match(texts($('gMedals')),/No champion or medals awarded/);
    $('gReset').fire();assert.equal($('gResetDialog').open,true);$('gResetDialog').returnValue='cancel';$('gResetDialog').close();
    assert.equal(real().season,2);
    $('gReset').fire();$('gResetDialog').returnValue='reset';$('gResetDialog').close();await ready();
    assert.equal(real().season,0);assert.equal(memory.get(GAUNTLET_KEY),undefined);

    const marker='saber-pit:gauntlet:auto-resume:1';
    $('gSeed').value='987';$('gLimit').value='45';$('gArena').value='rotation';
    $('gAuto').fire();await ready();
    assert.equal(real().season,1);
    assert.equal(real().active.seed,987);assert.equal($('gSeed').value,'');
    assert.equal($('gAuto').textContent,'Auto Seasons running');
    for(let i=0;i<20;i++){complete();await ready();if(i<19)await flushTimer();}
    assert.equal(real().season,1);assert.equal(real().active.status,'complete');assert.equal(queue.length,0);
    const roster=real().fighters;
    await flushTimer();
    assert.equal(real().season,2);assert.equal(real().active.seed,988);
    assert.equal(real().active.limit,45);assert.equal(real().active.terrain,'rotation');
    assert.deepEqual(real().fighters,roster,'drawing the next season preserves career data');
    assert.equal(real().history.length,1);
    complete();await ready();await flushTimer();
    const exactNext=queue[0].fixture, abandoned=queue[0], priorBytes=memory.get(GAUNTLET_KEY);
    const priorMarker=memory.get(marker);
    assert.ok(priorMarker&&priorMarker.length<80);
    events.pagehide();await ready();
    assert.equal(queue.length,0);
    abandoned.onmessage({data:{result:{winnerIndex:0}}});await ready();
    assert.equal(memory.get(GAUNTLET_KEY),priorBytes);
    assert.equal(memory.get(marker),priorMarker);

    elements.clear();
    await import('../dist/gauntlet.js?remount=auto');
    assert.equal(queue.length,0,'opening the tab must not start a worker');
    assert.equal($('gAuto').textContent,'Resume Auto Seasons');
    assert.match($('gAutoHelp').textContent,/won’t start on its own/);
    assert.equal($('gLimit').value,'45');assert.equal($('gArena').value,'rotation');
    locked=true;$('gAuto').fire();await ready();
    assert.match($('gStatus').textContent,/another tab/);assert.equal(queue.length,0);locked=false;
    $('gAuto').fire();await ready();
    assert.deepEqual(queue[0].fixture,exactNext);
    const before=real().fighters.find(f=>f.id===exactNext.soloId);
    $('gStop').fire();assert.equal(memory.has(marker),false);
    const resumed=complete();await ready();
    assert.equal(real().season,2);assert.equal(real().active.cursor,2);
    assert.equal(real().fighters.find(f=>f.id===before.id).adaptation.solo.bouts,before.adaptation.solo.bouts+1);
    assert.equal(timers.size,0);assert.equal($('gAuto').textContent,'Auto Seasons');
    const settledBytes=memory.get(GAUNTLET_KEY);
    resumed.onmessage({data:{result:{winnerIndex:0}}});await ready();
    assert.equal(memory.get(GAUNTLET_KEY),settledBytes);

    $('gAuto').fire();await ready();
    events.pagehide();await ready();
    memory.set(GAUNTLET_KEY,settledBytes+' ');
    events.pageshow({persisted:true});await ready();
    assert.equal($('gAuto').textContent,'Auto Seasons','a different save revision cannot offer resume');
    assert.equal(queue.length,0);
    $('gAuto').fire();await ready();
    for(let i=2;i<20;i++){complete();await ready();if(i<19)await flushTimer();}
    $('gStop').fire();await ready();
    assert.equal(real().season,2,'a stop in the rollover gap must not draw another season');
    assert.equal(real().active.status,'complete');
    assert.equal(timers.size,0);assert.equal(memory.has(marker),false);

    $('gSeed').value='54';$('gLimit').value='90';$('gArena').value='crossroads';
    $('gAuto').fire();await ready();
    assert.equal(real().season,3);assert.equal(real().active.seed,54);
    assert.equal(real().active.limit,90);assert.equal(real().active.terrain,'crossroads');
    $('gStop').fire();events.pagehide();await ready();
    assert.equal(memory.has(marker),false,'explicit Stop is durable even before the current bout settles');
    assert.equal(real().active.cursor,0);
    assert.equal(memory.get('saber-pit:tournament:1'),'existing solo');
    assert.equal(memory.get('saber-pit:squad-tournament:1'),'existing squads');
  }finally{
    URL.createObjectURL=oldObjectURL;URL.revokeObjectURL=oldRevoke;
    for(const key of touched){if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
  }
});

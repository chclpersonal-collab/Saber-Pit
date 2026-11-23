import test from 'node:test';
import assert from 'node:assert/strict';

test('Auto Seasons advances both actual brackets with a single worker and protects saves',async()=>{
  const names=['document','location','history','window','localStorage','Worker','setTimeout','clearTimeout','navigator'];
  const originals=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  try{
    const URLfor=name=>new URL('../dist/'+name+'.js',import.meta.url);
    const {TOURNAMENT_KEY,loadTournament,nextTournamentBout}=await import(URLfor('arcade-tournament'));
    const {updateEloPair}=await import(URLfor('arcade-elo'));
    const {SQUAD_TOURNAMENT_KEY,loadSquadTournament}=await import(URLfor('squad-tournament'));
    const {playTournamentBout}=await import(URLfor('arcade-tournament-sim'));
    const elements=new Map(), winHandlers={}, data=new Map(), timerQueue=new Map(), pending=[];
    const soloResume='saber-pit:auto-seasons:resume:1:solo',squadResume='saber-pit:auto-seasons:resume:1:squad';
    let timerId=0, occupied=false, attempted=0, maxConcurrent=0, timeoutWrite=false;
    class E {
     constructor(){Object.assign(this,{value:'',hidden:false,disabled:false,open:false,textContent:'',dataset:{},attrs:{},children:[],handlers:{},validity:{badInput:false},classList:{toggle(){},add(){}}});}
     append(...args){this.children.push(...args);}
     replaceChildren(...args){this.children=[...args];}
     setAttribute(k,v){this.attrs[k]=v;}
     addEventListener(type,cb){this.handlers[type]=cb;}
     fire(x='click'){if(this.disabled)return;return this.handlers[x]?.({preventDefault(){},target:this});}
     getContext(){return null;} focus(){} scrollIntoView(){} closest(){return null;}
    }
    const el=id=>{if(!elements.has(id))elements.set(id,new E());return elements.get(id);};
    Object.assign(globalThis,{document:{getElementById:el,createElement:()=>new E(),querySelectorAll:()=>[]},
     location:{hash:'',pathname:'/tournament.html',search:''},history:{replaceState(){}},
     window:{addEventListener(k,fn){winHandlers[k]=fn;}},
     localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(timeoutWrite)throw Error('quota');data.set(k,v);},removeItem(k){data.delete(k);}},
     Worker:class{
       constructor(url){this.url=url;}
       postMessage(input){this.input=input;pending.push(this);attempted++;maxConcurrent=Math.max(maxConcurrent,pending.length);}
       done(result){pending.splice(pending.indexOf(this),1);this.onmessage({data:{result:result??{winnerIndex:0,reason:'elimination',kills:[1,0],deaths:[0,1],time:1}}});}
       terminate(){const i=pending.indexOf(this);if(i>=0)pending.splice(i,1);}
     },
     setTimeout(fn,delay){timerQueue.set(++timerId,{fn,delay});return timerId;},
     clearTimeout(id){timerQueue.delete(id);}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(key,opts,cb)=>{
     if(occupied)return cb(null);
     occupied=true;try{return await cb({name:key});}finally{occupied=false;}
    }}}});
    el('fieldInput').value='32';el('terrainInput').value='rotation';el('newSetup').hidden=true;
    await import(URLfor('tournament'));
    assert.equal(el('leaderForms').hidden,true);
    assert.equal(el('leaderForms').textContent,'');
    const tick=async()=>{const now=timerQueue.keys().next();assert(!now.done);const t=timerQueue.get(now.value);timerQueue.delete(now.value);t.fn();await Promise.resolve();return t.delay;};
    const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
    const readSolo=()=>loadTournament(globalThis.localStorage),readSquad=()=>loadSquadTournament(globalThis.localStorage);
    const simulate=async()=>{assert.equal(pending.length,1);pending[0].done();await flush();};
    const auto=el('autoSeasons');
    occupied=true;auto.fire();await flush();
    assert.equal(timerQueue.size,0);assert.match(el('tourStatus').textContent,/another tab/);
    occupied=false;auto.fire();await flush();await tick();
    assert.equal(el('activeSeed').hidden,false);
    assert.equal(el('activeSeedValue').textContent,String(readSolo().active.seed));
    await el('copyActiveSeed').fire();assert.match(el('tourStatus').textContent,/Bracket seed:/);
    assert.equal(readSolo().season,1);assert.equal(readSolo().active.limit,360);assert.equal(readSolo().active.terrain,'rotation');assert.equal(readSolo().active.fieldSize,32);
    assert.match(pending[0].url.pathname,/solo-tournament-worker/);assert.equal(auto.attrs['aria-pressed'],'true');
    assert.equal(el('cancelButton').hidden,true);assert.equal(el('squadFormat').disabled,true);
    auto.fire();assert.equal(auto.disabled,true);assert.equal(pending.length,1);
    await simulate();assert.equal(auto.attrs['aria-pressed'],'false');assert.equal(timerQueue.size,0);assert.match(el('tourStatus').textContent,/last bout was saved/);
    assert.equal(data.has(soloResume),false);
    const first=readSolo().active;assert.equal(first.qualifiers.flat().filter(r=>r.result).length,1);
    auto.fire();await flush();
    for(let i=0;i<32;i++){await tick();await simulate();}
    assert.equal(readSolo().season,2);assert.equal(readSolo().active.limit,360);assert.equal(readSolo().active.terrain,'rotation');assert.equal(readSolo().active.fieldSize,32);
    auto.fire();await flush();assert.equal(timerQueue.size,0);assert.equal(auto.attrs['aria-pressed'],'false');
    el('squadFormat').fire();await flush();auto.fire();await flush();await tick();
    assert.match(pending[0].url.pathname,/squad-tournament-worker/);assert.equal(readSquad().season,1);assert.equal(readSquad().active.limit,150);
    for(let i=0;i<23;i++){await simulate();await tick();}
    assert.equal(readSquad().season,2);assert(data.has(squadResume));
    assert.equal(el('seasonArchiveRows').children.length,1);
    assert.equal(el('seasonArchiveRows').children[0].children[1].textContent,'Week 1');
    const searchable=Object.values(readSquad().teams)[0].fighters[0].name;
    el('careerSearch').value=searchable;el('careerSearch').fire('input');
    assert.match(el('careerSearchNote').textContent,/match/);
    assert(el('careerSearchRows').children.length>0);
    el('careerSearch').value='Impossible_xxxx';el('careerSearch').fire('input');
    assert.match(el('careerSearchNote').textContent,/No matches/);
    el('careerSearch').value='';el('careerSearch').fire('input');
    const before=data.get(SQUAD_TOURNAMENT_KEY);
    data.set(SQUAD_TOURNAMENT_KEY,before+' ');winHandlers.storage({key:SQUAD_TOURNAMENT_KEY});await flush();
    assert.equal(auto.attrs['aria-pressed'],'false');assert.equal(pending.length,0);assert.equal(timerQueue.size,0);assert.equal(data.get(SQUAD_TOURNAMENT_KEY),before+' ');
    assert.equal(readSolo().season,2);assert.equal(data.has(squadResume),false);
    // A finished squad exposes one action per fighter. Saving changes only
    // the shared Hero vault, never the squad or solo standings.
    const squadBefore=data.get(SQUAD_TOURNAMENT_KEY), soloBefore=readSolo(), squad=readSquad();
    const team=Object.values(squad.teams).find(t=>t.wins+t.draws+t.losses>0);
    const teamButton=new E();teamButton.dataset.teamId=team.id;
    const select=(selector,button)=>el('tournamentApp').handlers.click({target:{closest:key=>key===selector?button:null}});
    select('[data-team-id]',teamButton);
    const members=el('teamMembers').children;
    assert.equal(members.length,5);
    const save=members[0].children[1];
    assert.equal(save.textContent,'Save Hero');assert.equal(save.disabled,false);
    timeoutWrite=true;select('[data-squad-member]',save);timeoutWrite=false;
    assert.equal(Object.hasOwn(readSolo().heroes,team.fighters[0].id),false);
    select('[data-squad-member]',el('teamMembers').children[0].children[1]);
    const savedSquadHero=readSolo().heroes[team.fighters[0].id];
    assert.equal(savedSquadHero.sourceKind,'squad');
    assert.equal(el('teamMembers').children[0].children[1].textContent,'View Hero');
    assert.equal(el('fighterName').textContent,team.fighters[0].name);
    assert.equal(el('saveHero').hidden,true);
    assert.equal(el('removeHero').hidden,false);
    assert.equal(el('teamMembers').children[1].children[1].textContent,'Save Hero');
    assert.equal(data.get(SQUAD_TOURNAMENT_KEY),squadBefore);
    assert.deepEqual(readSolo().records,soloBefore.records);
    assert.equal(maxConcurrent,1);
    auto.fire();await flush();await tick();timeoutWrite=true;await simulate();timeoutWrite=false;
    assert.equal(auto.attrs['aria-pressed'],'false');assert.match(el('tourStatus').textContent,/could not save/);
    assert.equal(auto.textContent,'Resume Auto Seasons');
    el('soloFormat').fire();auto.fire();await flush();await tick();
    winHandlers.pagehide();await flush();assert.equal(timerQueue.size,0);assert.equal(pending.length,0);
    winHandlers.pageshow({persisted:true});assert.equal(auto.attrs['aria-pressed'],'false');
    assert.equal(auto.textContent,'Resume Auto Seasons');
    const locks=navigator.locks;navigator.locks=null;auto.fire();assert.match(el('tourStatus').textContent,/tab locking/);
    navigator.locks=locks;
    // A newly drawn short solo season must still offload to the worker in Auto.
    // Replace local progress as an external tab would, then choose explicit setup.
    data.delete(TOURNAMENT_KEY);winHandlers.storage({key:TOURNAMENT_KEY});
    el('newButton').fire();el('fieldInput').value='24';el('fieldInput').fire('change');
    el('limitInput').value='45';el('limitInput').fire('change');
    el('terrainInput').value='underpit';el('seedInput').value='12211';
    auto.fire();await flush();await tick();
    assert.match(pending[0].url.pathname,/solo-tournament-worker/);
    assert.equal(pending[0].input.limit,45);assert.equal(readSolo().active.seed,12211);
    const genuine=playTournamentBout(pending[0].input);
    auto.fire();pending[0].done(genuine);await flush();
    const saved=readSolo().active.lastReplay;
    assert.equal(saved.seed,genuine.replay.seed);
    const replayed=playTournamentBout(saved);
    for(const field of ['reason','time','winnerIndex','kills','deaths'])
      assert.deepEqual(replayed[field],genuine[field],field);
    assert(!auto.disabled&&timerQueue.size===0);
    assert.equal(data.has(soloResume),false);

    // An interrupted in-flight bout wasn't settled. A full, fresh module and
    // fresh document must offer to resume, but never start work on their own.
    auto.fire();await flush();await tick();
    const interrupted=pending[0], snapshot=data.get(TOURNAMENT_KEY), previous=readSolo();
    const next=nextTournamentBout(previous), previousSquad=data.get(SQUAD_TOURNAMENT_KEY), marker=data.get(soloResume);
    assert.equal(interrupted.input.id,next.id);assert(marker.length<640);
    const {exportArcadeBackup}=await import(URLfor('arcade-backup'));
    const backup=exportArcadeBackup();
    assert(backup.ok);assert(!backup.text.includes(JSON.parse(marker).owner));
    const result=playTournamentBout(interrupted.input);
    winHandlers.pagehide();await flush();interrupted.onmessage({data:{result}});await flush();
    assert.equal(data.get(TOURNAMENT_KEY),snapshot);
    elements.clear();
    for(const key of Object.keys(winHandlers))delete winHandlers[key];
    el('fieldInput').value='32';el('terrainInput').value='rotation';el('newSetup').hidden=true;
    const remount=URLfor('tournament');remount.search='fresh-document';
    await import(remount);
    const resume=el('autoSeasons');
    assert.equal(resume.textContent,'Resume Auto Seasons');
    assert.match(el('autoResumeHint').textContent,/Season 1/);
    assert.equal(resume.attrs['aria-pressed'],'false');
    assert.equal(timerQueue.size,0);assert.equal(pending.length,0);
    el('squadFormat').fire();
    assert.equal(resume.textContent,'Resume Auto Seasons'); // independent squad save-failure marker
    assert.notEqual(data.get(squadResume),marker);
    el('soloFormat').fire();assert.equal(resume.textContent,'Resume Auto Seasons');
    data.set(TOURNAMENT_KEY,snapshot+' ');winHandlers.storage({key:TOURNAMENT_KEY});
    assert.equal(resume.textContent,'Auto Seasons');
    data.set(TOURNAMENT_KEY,snapshot);winHandlers.storage({key:TOURNAMENT_KEY});
    assert.equal(resume.textContent,'Resume Auto Seasons');

    resume.fire();await flush();await tick();
    const continued=pending[0];
    assert.deepEqual([continued.input.id,continued.input.attempt,continued.input.seed,continued.input.limit],
      [next.id,next.attempt,next.seed,45]);
    interrupted.onmessage({data:{result}});await flush();
    assert.equal(data.get(TOURNAMENT_KEY),snapshot);
    resume.fire();assert.equal(data.has(soloResume),false);
    continued.done(result);await flush();
    const after=readSolo(), once=data.get(TOURNAMENT_KEY);
    const score=result.winnerIndex===null?.5:result.winnerIndex===0?1:0;
    const expected=updateEloPair(...next.fighterIds.map(id=>({rating:previous.records[id].elo,grade:previous.records[id].grade})),score);
    for(const [i,id] of next.fighterIds.entries()){
      assert.equal(after.records[id].elo,i===0?expected.ratingA:expected.ratingB);
      assert.equal(after.records[id].profile.bouts,previous.records[id].profile.bouts+1);
    }
    continued.onmessage({data:{result}});await flush();
    assert.equal(data.get(TOURNAMENT_KEY),once);
    assert.equal(data.get(SQUAD_TOURNAMENT_KEY),previousSquad);
    assert.equal(timerQueue.size,0);assert.equal(resume.textContent,'Auto Seasons');

    // If navigating away while an intentional stop is pending, don't restore
    // the offer or settle that cancelled worker when its response arrives.
    resume.fire();await flush();await tick();
    const finalWorker=pending[0];resume.fire();
    assert.equal(data.has(soloResume),false);
    winHandlers.pagehide();await flush();finalWorker.onmessage({data:{result}});await flush();
    winHandlers.pageshow({persisted:true});
    assert.equal(resume.textContent,'Auto Seasons');
    assert.equal(data.get(TOURNAMENT_KEY),once);
    assert.ok(attempted>=63);

    // The new label summarizes only the displayed rated 1v1 Top 10.
    const ranked=readSolo(), sample=Object.values(ranked.records).slice(0,12);
    const forms=['soresu','soresu','soresu','soresu','soresu','soresu','makashi','makashi','djem_so','djem_so','juyo','juyo'];
    assert.equal(sample.length,12);
    sample.forEach((entry,i)=>Object.assign(entry,{elo:1800-i,form:forms[i],wins:1}));
    const rankedRaw=JSON.stringify(ranked);
    data.set(TOURNAMENT_KEY,rankedRaw);winHandlers.storage({key:TOURNAMENT_KEY});
    assert.equal(el('leaderForms').hidden,false);
    assert.equal(el('leaderForms').textContent,'Top 10 forms: Soresu 6 · Djem So 2 · Makashi 2');
    assert.equal(data.get(TOURNAMENT_KEY),rankedRaw);
    el('squadFormat').fire();
    assert.equal(el('leaderForms').hidden,true);assert.equal(el('leaderForms').textContent,'');
    el('soloFormat').fire();
    assert.equal(el('leaderForms').textContent,'Top 10 forms: Soresu 6 · Djem So 2 · Makashi 2');
  }finally{
   for(const name of names){if(originals[name])Object.defineProperty(globalThis,name,originals[name]);else delete globalThis[name];}
  }
});

import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,startGauntlet,nextGauntletBout,recordGauntletBout,resetGauntlet,gauntletLeaderboard} from './gauntlet-tournament.js?v=3.2.3';
import {seasonWeek} from './tournament-calendar.js?v=3.0.1';
import {fighterGenderLabel} from './arcade-fighter-profiles.js?v=2.18.3';
import {drawArcadeFighterPreview} from './arcade-painter.js?v=4.0.0';
import {ARCADE_CHESS_STYLES} from './arcade-chess-styles.js?v=2.44.0';
import {masteryTitle} from './arcade-mastery-title.js?v=2.33.0';
import {combatMoveLabel} from './arcade-callouts.js?v=3.1.0';

const $=id=>document.getElementById(id);
const formNames={shii_cho:'Shii-Cho',makashi:'Makashi',soresu:'Soresu',ataru:'Ataru',djem_so:'Djem So',niman:'Niman',juyo:'Juyo'};
const maps={underpit:'The Underpit',foundry:'The Foundry',ember_ring:'Ember Ring',crossroads:'Crossroads',zigzag:'Zigzag',craterfield:'Craterfield',rotation:'Arena rotation'};
const groups=['A','B','C','D'], STAR_KEY='saber-pit:gauntlet:stars:1', AUTO_KEY='saber-pit:gauntlet:auto-resume:1';
const el=(tag,content,style)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(style)node.className=style;return node;};
const raw=key=>{try{return globalThis.localStorage.getItem(key);}catch{return undefined;}};
let state=loadGauntlet(), known=raw(GAUNTLET_KEY), activeJob=null, workerJob=null, waiting=null, claiming=false;
let resumeDigest, digestSource;
let selected=null, replay=null, replayEpoch=0, replayPaused=false, stars=readStars(), leftPage=false, pageEpoch=0;
const count=x=>Number.isFinite(x)?Math.max(0,Math.trunc(x)):0;
const score=n=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:1}):'—';
const points=n=>Number.isFinite(n)?Number.isInteger(n)?String(n):n===.5?'½':Math.floor(n)+'½':'0';
const clocks=n=>Number.isFinite(n)?(n>=60?Math.floor(n/60)+':'+String(n%60).padStart(2,'0'):n+'s'):'—';
const tempo=n=>Number.isFinite(n)?n.toFixed(1)+'s':'—';
const wdl=row=>[row?.wins,row?.draws,row?.losses].map(count).join('–');
const played=row=>count(row?.wins)+count(row?.draws)+count(row?.losses);
const percent=n=>Number.isFinite(n)?Math.round(n*100)+'%':'—';
const signed=n=>Number.isFinite(n)?(n>0?'+':'')+score(n):'—';
const fighterFor=id=>state.fighters.find(f=>f.id===id);
const name=id=>fighterFor(id)?.name??'Fighter';
function addMastery(node,fighter){
  if(!fighter)return node;
  const title=masteryTitle(Math.max(fighter.elo,fighter.peakElo),played(fighter.solo)+played(fighter.trio)>0);
  if(title){
    const badge=el('span',title,'mastery-title');
    badge.setAttribute('aria-label','Mastery title '+title);
    node.append(' ',badge);
  }
  return node;
}
const form=id=>formNames[id]??'Unknown form';
const heading=text=>typeof text==='string'&&text?text[0].toUpperCase()+text.slice(1):'Balanced';
const notify=text=>{$('gStatus').textContent=text;};
const busy=()=>Boolean(activeJob)||claiming;
const resultOf=b=>b.winner===0?'Solo victory':b.winner===1?'Trio victory':'Draw';
const stageOf=b=>b.phase==='final'?'Final':'Group '+(groups[b.group]??'—');

// A revision marker outside the portable save never starts work on its own.
function hasAutoResume(){
  const marker=raw(AUTO_KEY);
  return Boolean(marker&&state.active&&typeof known==='string'&&marker===autoDigest());
}
function autoDigest(){
  if(digestSource===known)return resumeDigest;
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<known.length;i++){
    const c=known.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,0x85ebca6b);b^=b>>>13;
  }
  digestSource=known;
  return resumeDigest=[state.season,known.length,a>>>0,b>>>0].join(':');
}
function rememberAuto(){
  try{if(state.active&&typeof known==='string')globalThis.localStorage.setItem(AUTO_KEY,autoDigest());}catch{/* Resume is optional. */}
}
function clearAuto(){
  try{globalThis.localStorage.removeItem(AUTO_KEY);}catch{/* The save itself is unchanged. */}
}
function syncSetup(){
  if(!state.active)return;
  if([45,75,90,150].includes(state.active.limit))$('gLimit').value=String(state.active.limit);
  if(Object.hasOwn(maps,state.active.terrain))$('gArena').value=state.active.terrain;
}
function setupOptions(){
  const input=$('gSeed'), seed=input.value?Number(input.value):Math.floor(Math.random()*4294967294)+1;
  if(!Number.isSafeInteger(seed)||seed<1||seed>4294967295){notify('Enter a seed from 1 to 4,294,967,295.');input.focus();return null;}
  return {seed,limit:Number($('gLimit').value),terrain:$('gArena').value};
}
function drawSeason(options){
  const next=startGauntlet(state,options);
  if(next.season!==state.season+1||!saveState(next))return false;
  $('gSeed').value='';syncSetup();return true;
}
function readStars(){
  try{const list=JSON.parse(raw(STAR_KEY)??'[]');return new Set(Array.isArray(list)?list.filter(x=>typeof x==='string'&&/^g[a-z0-9]+-f\d+$/.test(x)).slice(0,64):[]);}catch{return new Set();}
}
function reviewFighter(id, focus=true){
  if(!state.fighters.some(f=>f.id===id))return;
  selected=id;renderLedger();renderFighter();
  if(focus){$('gFighterName').focus({preventScroll:true});$('gFighterName').scrollIntoView({block:'nearest'});}
}
function saveState(next){
  let written;
  const storage={setItem(key,value){globalThis.localStorage.setItem(key,value);written=value;}};
  if(!saveGauntlet(next,storage))return false;
  known=written;
  if(raw(GAUNTLET_KEY)!==known){reload();return false;}
  state=loadGauntlet();
  return true;
}
function reload(){
  state=loadGauntlet();known=raw(GAUNTLET_KEY);
  if(!state.fighters.some(f=>f.id===selected))selected=null;
  syncSetup();
}
function checkSave(){
  if(raw(GAUNTLET_KEY)===known)return true;
  reload();cancelWork();render();notify('Loaded Gauntlet progress from another tab. No pending bout was counted.');
  return false;
}
function cancelWork(){
  activeJob=null;workerJob?.finish(null,null);waiting?.();waiting=null;
}
function withLock(task,{requireWorker=false}={}){
  if(busy()||leftPage||$('gReplay').open||$('gResetDialog').open)return;
  if(requireWorker&&typeof Worker!=='function'){notify('This browser cannot run a sequence of bouts. Use Next bout.');return;}
  const locks=globalThis.navigator?.locks;
  if(requireWorker&&typeof locks?.request!=='function'){notify('This browser cannot lock tournament tabs. Use Next bout.');return;}
  const epoch=pageEpoch;claiming=true;renderControls();
  const prepare=async available=>{
    if(epoch!==pageEpoch)return;
    claiming=false;
    if(leftPage){renderControls();return;}
    if(!available){renderControls();notify('The Gauntlet is busy in another tab.');return;}
    if(!checkSave()){renderControls();return;}
    await task();
  };
  const failed=error=>{if(epoch!==pageEpoch)return;claiming=false;cancelWork();render();console.error('Gauntlet operation stopped',error);notify('Could not continue. Already saved bouts were kept.');};
  try{
    const promise=typeof locks?.request==='function'?locks.request('saber-pit:progress:'+GAUNTLET_KEY,{ifAvailable:true},lock=>prepare(Boolean(lock))):prepare(true);
    Promise.resolve(promise).catch(failed);
  }catch(error){failed(error);}
}
function work(fixture){
  if(typeof Worker!=='function')return import('./gauntlet-sim.js?v=3.2.3').then(({simulateGauntlet})=>simulateGauntlet(fixture));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./gauntlet-worker.js?v=3.2.3',import.meta.url),{type:'module'});
    const finish=(error,result)=>{
      if(workerJob?.worker!==worker)return;
      workerJob=null;worker.terminate();
      if(error)reject(error);else resolve(result);
    };
    workerJob={worker,finish};
    worker.onmessage=({data})=>data?.error?finish(new Error(data.error)):finish(null,data?.result);
    worker.onerror=event=>{event.preventDefault();finish(new Error(event.message||'Worker failed'));};
    try{worker.postMessage({fixture});}catch(error){finish(error);}
  });
}
function yieldBeforeNext(){
  return new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);waiting=null;resolve();};
    const timer=setTimeout(done,70);waiting=done;
  });
}
async function run(multiple,{auto=false,firstDraw=null}={}){
  if(!auto&&!nextGauntletBout(state))return;
  if(auto)rememberAuto();else if(hasAutoResume())clearAuto();
  const job={stop:false,inFlight:false,auto};
  activeJob=job;renderControls();
  try{
    do{
      if(activeJob!==job||!checkSave())return;
      let fixture=nextGauntletBout(state);
      if(!fixture&&auto&&(!state.active||state.active.status==='complete')){
        const prior=state.active;
        // Use the explicit seed once, then derive each new seed from the saved season.
        const options=firstDraw??{seed:(prior.seed%4294967295)+1,limit:prior.limit,terrain:prior.terrain};
        firstDraw=null;
        if(!drawSeason(options))throw new Error('Could not save next Gauntlet season');
        rememberAuto();render();
        fixture=nextGauntletBout(state);
      }
      if(!fixture)break;
      job.inFlight=true;
      notify(`${job.auto?'Auto Seasons · Season '+state.season+' · ':''}${stageOf(fixture)} · simulating bout ${state.active.cursor+1} of 20…`);
      const answer=await work(fixture);
      job.inFlight=false;
      if(activeJob!==job||!checkSave())return;
      if(!answer||![0,1,null].includes(answer.winnerIndex))throw new Error('Incomplete bout result');
      const next=recordGauntletBout(state,fixture.id,answer);
      if(next.active?.cursor!==state.active.cursor+1)throw new Error('Unexpected fixture or duplicate result');
      if(!saveState(next)){cancelWork();render();notify('Could not save this bout. The last verified save was kept.');return;}
      if(auto&&!job.stop)rememberAuto();
      render();
      notify(auto&&state.active.status==='complete'&&!job.stop
        ?`Auto Seasons · Season ${state.season} complete. Drawing the next season…`
        :`${resultOf(state.active.bouts.at(-1))} · bout ${state.active.cursor} saved.`);
      if(!multiple||job.stop||(!auto&&!nextGauntletBout(state)))break;
      await yieldBeforeNext();
    }while(!job.stop);
    if(activeJob!==job)return;
    activeJob=null;render();
    if(job.stop)notify('Stopped. Completed bouts were kept.');
    else if(state.active?.status==='complete'){
      notify('Season complete. Results and career Elo saved.');
      if([document.body,$('gPlay'),$('gRun')].includes(document.activeElement))$('gDraw').focus();
    }
  }catch(error){
    if(activeJob!==job)return;
    console.error('Gauntlet bout failed',error);cancelWork();render();
    notify('Could not finish this bout. Previously saved results were kept.');
  }
}
function renderControls(){
  const next=nextGauntletBout(state), disabled=busy();
  $('gPlay').disabled=disabled||!next;
  $('gRun').disabled=disabled||!next;
  const resume=!disabled&&hasAutoResume();
  $('gAuto').disabled=disabled;
  $('gAuto').textContent=activeJob?.auto?'Auto Seasons running':resume?'Resume Auto Seasons':'Auto Seasons';
  $('gAutoHelp').textContent=activeJob?.auto?'Keep this tab open to keep running. Each finished bout is saved.':resume
    ?'Resume from the last saved bout. It won’t start on its own.'
    :'Runs season after season. Keep this tab open.';
  $('gStop').hidden=!activeJob;
  $('gStop').disabled=Boolean(activeJob?.stop);
  $('gStop').textContent=activeJob?.stop?'Finishing current bout…':'Stop after bout';
  $('gWatch').hidden=!state.active?.lastFixture;
  $('gWatch').disabled=disabled;
  $('gSetup').hidden=Boolean(state.active&&state.active.status!=='complete');
  $('gSetupTitle').textContent=state.season?'Start Season '+(state.season+1):'Start a season';
  $('gSetupHelp').textContent=state.season
    ?'Your roster and career Elo carry over. Download the current bout log first if you want to keep it.'
    :'Choose a bout length and arena. Leave the seed blank for a random draw.';
  for(const id of ['gDraw','gSeed','gLimit','gArena'])$(id).disabled=disabled;
  $('gDraw').textContent=state.season?'Draw next bracket':'Draw bracket';
  $('gReset').disabled=disabled||!state.season&&!(typeof known==='string'&&known);
}
function renderDesk(){
  const a=state.active,next=nextGauntletBout(state);
  $('gSeasonBadge').textContent=state.season?`Season ${state.season} · Week ${seasonWeek(state.season)}`:'No season';
  $('gNextStage').textContent=next?stageOf(next):state.season?'SEASON COMPLETE':'READY TO DRAW';
  $('gNextTitle').textContent=next?name(next.soloId)+' vs '+next.trioIds.map(name).join(' / '):state.season?'All bouts settled':'No bout scheduled';
  $('gNextDetail').textContent=next?`Solo vs trio · ${maps[next.terrain]??next.terrain} · ${clocks(next.limit)}`:state.season?'Review the season podium or draw the next bracket when you’re ready.':'Draw a season to begin.';
  $('gProgress').hidden=!a;
  $('gBar').value=a?.cursor??0;
  const draws=a?.bouts.filter(x=>x.winner===null).length??0;
  $('gProgressText').textContent=`${a?.cursor??0} of 20 bouts saved · ${draws} ${draws===1?'draw':'draws'}`;
}
function bracketCard(title,rows,settled,qualifies=false){
  const card=el('section',undefined,'g-group'),top=el('div',undefined,'g-round-caption');
  top.append(el('h3',title),el('span',`${settled} / 4 bouts`));
  card.append(top);
  if(!rows.length){card.append(el('p','Awaiting qualifying results.','muted'));return card;}
  const list=el('ol');
  for(const [i,r] of rows.entries()){
    const advances=qualifies&&settled===4&&i===0;
    const item=el('li',undefined,advances?'g-advances':undefined);
    const identity=el('div',undefined,'g-bracket-fighter');
    identity.append(addMastery(el('span',name(r.id)),fighterFor(r.id)));
    if(advances)identity.append(el('span','Advances to final','g-advance-tag'));
    item.append(identity,el('span',`${points(r.soloPoints)} solo · ${points(r.points)} total`,'g-points'));
    list.append(item);
  }
  card.append(list);return card;
}
function renderBracket(){
  const a=state.active, filter=$('gStageFilter').value||'all';
  $('gGroups').hidden=filter==='final';
  $('gFinal').hidden=filter==='groups';
  if(!a){
    $('gGroups').replaceChildren(el('p','Draw a season to see all four groups.','muted'));
    $('gFinal').replaceChildren(bracketCard('Final',[],0));
    return;
  }
  $('gGroups').replaceChildren(...groups.map((label,i)=>bracketCard('Group '+label,a.standings?.[i]??[],
    a.bouts.filter(b=>b.phase==='groups'&&b.group===i).length,true)));
  $('gFinal').replaceChildren(bracketCard('Final',a.finalStandings??[],a.bouts.filter(b=>b.phase==='final').length));
}
function renderMedals(){
  const a=state.active,activeSeason=a?.status==='complete', former=state.lastChampion;
  if(activeSeason){
    const tied=!former||former.draw===true||!former.id||former.season!==state.season;
    if(tied){$('gMedals').replaceChildren(el('p','Final drawn. No champion or medals awarded.','muted'));return;}
    const list=el('ol',undefined,'g-medals');
    for(const [i,row] of (a.finalStandings??[]).slice(0,3).entries()){
      const item=el('li');item.append(addMastery(el('span',name(row.id)),fighterFor(row.id)),el('span',['Gold · Champion','Silver','Bronze'][i],'g-ordinal'));list.append(item);
    }
    $('gMedals').replaceChildren(list);
  }else{
    $('gMedals').replaceChildren(el('p',former?.id?`Last champion: ${former.name} · Season ${former.season}`:'Finish a season to award medals.','muted'));
  }
}
function renderLedger(){
  const needle=$('gFind').value.trim().toLocaleLowerCase(), role=$('gRole').value||'all';
  const ranked=gauntletLeaderboard(state).filter(f=>(!needle||f.name.toLocaleLowerCase().includes(needle))&&
    (role==='all'||played(f[role])>0)&&(!$('gFavoritesOnly').checked||stars.has(f.id)));
  if($('gSort').value==='peak')ranked.sort((a,b)=>b.peakElo-a.peakElo||b.elo-a.elo);
  if(!ranked.length){
    const row=el('tr'),msg=el('td',state.fighters.length?'No fighters match these filters.':'No fighters recruited yet.','muted');msg.colSpan=5;
    row.append(msg);$('gLedgerRows').replaceChildren(row);return;
  }
  $('gLedgerRows').replaceChildren(...ranked.map(f=>{
    const row=el('tr'),td=el('td'),button=el('button',(stars.has(f.id)?'★ ':'')+f.name,'g-fighter-link');
    button.type='button';button.setAttribute('aria-pressed',String(selected===f.id));button.addEventListener('click',()=>reviewFighter(f.id));
    if(selected===f.id)row.className='g-selected';
    td.append(addMastery(button,f));
    row.append(td,el('td',score(f.elo)),el('td',score(f.peakElo)),el('td',wdl(f.solo)),el('td',wdl(f.trio)));
    return row;
  }));
}
function roleSummary(title,record,adaptation){
  const box=el('section'),p=adaptation??{};
  box.append(el('h4',title),el('p',`${wdl(record)} W–D–L · ${count(p.bouts)} studied`));
  if(count(p.bouts)){
    box.append(el('p',`Plan: ${heading(p.doctrine??p.lastDoctrine)}`),
      el('p',`Guard ${percent(p.guard)} · Pressure ${percent(p.pressure)} · Mobility ${percent(p.mobility)}`));
    const named=combatMoveLabel(p.preferredMove);
    if(named)box.append(el('p','Favored move: '+named));
  }
  return box;
}
function renderFighter(){
  const f=state.fighters.find(x=>x.id===selected);$('gFighter').hidden=!f;if(!f)return;
  $('gFighterName').textContent=f.name;addMastery($('gFighterName'),f);
  $('gFighterMeta').textContent=[form(f.form),'SSS+ V',fighterGenderLabel(f.gender),`Current Elo ${score(f.elo)}`,`Peak Elo ${score(f.peakElo)}`].join(' · ');
  const weapon={single:'Single saber',dual:'Dual sabers',staff:'Double-bladed saber'}[f.gear?.weapon??f.weapon];
  const grip=(f.gear?.grip??f.grip)==='backhand'?'Backhand':null;
  const style=ARCADE_CHESS_STYLES[f.chessStyle]?.label;
  $('gFighterGear').textContent=[weapon,grip,style?style+' style':null].filter(Boolean).join(' · ');
  const portrait=$('gFighterPortrait'),ctx=portrait.getContext?.('2d');
  portrait.hidden=!ctx;
  if(ctx){
    ctx.clearRect(0,0,portrait.width,portrait.height);
    drawArcadeFighterPreview(ctx,f,{reducedMotion:true,framing:'portrait'});
  }
  const star=stars.has(f.id);$('gFavorite').setAttribute('aria-pressed',String(star));$('gFavorite').textContent=star?'Remove star':'Star fighter';
  $('gRoleReports').replaceChildren(roleSummary('Solo role',f.solo,f.adaptation?.solo),roleSummary('Trio role',f.trio,f.adaptation?.trio));
}
function renderReport(){
  const bouts=state.active?.bouts??[], last=bouts.at(-1);
  $('gReport').hidden=!last;$('gLog').hidden=!last;
  if(!last)return;
  $('gLogCount').textContent=`· ${bouts.length} saved`;
  const list=el('ol');
  for(const b of bouts){list.append(el('li',`${stageOf(b)} · ${name(b.soloId)} vs ${b.trioIds.map(name).join(' / ')} · ${resultOf(b)}, ${tempo(b.time)}`));}
  $('gBoutLog').replaceChildren(list);
  $('gOutcome').textContent=`${stageOf(last)} · ${resultOf(last)} · ${tempo(last.time)}. Exact Elo changes and updated role profiles:`;
  $('gDeltas').replaceChildren(...[last.soloId,...last.trioIds].map((id,i)=>{
    const f=state.fighters.find(x=>x.id===id), role=i===0?'solo':'trio', p=f?.adaptation?.[role], div=el('div'),label=el('span',name(id));
    label.append(el('small',`${heading(role)} · ${heading(p?.doctrine)} · guard ${percent(p?.guard)} / pressure ${percent(p?.pressure)}`));
    div.append(label,el('span',signed(last.eloDelta?.[i]),'g-delta'));return div;
  }));
}
function render(){
  renderControls();renderDesk();renderBracket();renderMedals();renderLedger();renderFighter();renderReport();
}
function csvCell(value){
  const text=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(text)&&typeof value!=='number'?"'":'')+text.replaceAll('"','""')+'"';
}
function downloadCsv(){
  const bouts=state.active?.bouts??[];if(!bouts.length)return;
  const fields=['Season','Stage','Bout','Solo','Trio 1','Trio 2','Trio 3','Outcome','Elapsed seconds','Arena','Solo Elo','Trio 1 Elo','Trio 2 Elo','Trio 3 Elo'];
  const lines=[fields,...bouts.map((b,i)=>[state.season,stageOf(b),i+1,name(b.soloId),...b.trioIds.map(name),resultOf(b),b.time,maps[b.terrain]??b.terrain,...b.eloDelta])];
  const content='\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=el('a');link.href=url;link.download=`saber-pit-gauntlet-season-${state.season}.csv`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10_000);
  notify('Season results downloaded as CSV.');
}
async function openReplay(){
  if(busy()||$('gReplay').open||!state.active?.lastFixture)return;
  const fixture=state.active.lastFixture, session=++replayEpoch, status=$('gReplayStatus');
  replayPaused=false;$('gReplayPause').textContent='Pause';$('gReplayPause').disabled=true;
  $('gReplaySpeed').value='1';$('gReplaySpeed').disabled=true;
  status.textContent='Opening replay…';$('gReplay').showModal();
  try{
    const [{createGauntletBattle,stepGauntletBattle},{startArcadeTournamentPlayback},{arcadeReplayRules}]=await Promise.all([
      import('./gauntlet-sim.js?v=3.2.3'),import('./tournament-replay.js?v=4.0.0'),import('./arcade-replay-rules.js?v=3.2.0')]);
    const rules={...await arcadeReplayRules(),stepArcade:stepGauntletBattle};
    const valid=()=>session===replayEpoch&&$('gReplay').open;
    if(!valid())return;
    replay=startArcadeTournamentPlayback($('gReplayCanvas'),createGauntletBattle(fixture),fixture.terrain,rules,{
      drawOnTimeout:true,showMemberNames:true,
      onFrame(left){if(valid())status.textContent=`Replay only · ${clocks(left<=1e-6?0:Math.ceil(left))} remaining`;},
      onEnd(winner){if(valid()){status.textContent=(winner===0?'Solo victory':winner===1?'Trio victory':'Draw')+' · replay only.';$('gReplayPause').disabled=true;$('gReplaySpeed').disabled=true;}}
    });
    $('gReplayPause').disabled=!replay.pause;$('gReplaySpeed').disabled=!replay.setSpeed;
  }catch(error){if(session===replayEpoch){console.error('Gauntlet replay failed',error);status.textContent='Could not open the replay. Your save was unchanged.';}}
}
$('gSetup').addEventListener('submit',event=>{
  event.preventDefault();if(state.active&&state.active.status!=='complete')return;
  const options=setupOptions();if(!options)return;
  withLock(()=>{
    if(state.active&&state.active.status!=='complete')return;
    if(!drawSeason(options)){render();notify('Could not save the new season. Check browser storage.');return;}
    clearAuto();render();notify(`Season ${state.season} saved. Choose Next bout, Run bracket, or Auto Seasons.`);$('gPlay').focus();
  });
});
$('gPlay').addEventListener('click',()=>withLock(()=>run(false)));
$('gRun').addEventListener('click',()=>withLock(()=>run(true),{requireWorker:true}));
$('gAuto').addEventListener('click',()=>{
  const resume=hasAutoResume(), canDraw=!state.active||state.active.status==='complete';
  const firstDraw=!resume&&canDraw?setupOptions():null;
  if(!resume&&canDraw&&!firstDraw)return;
  withLock(()=>{
    if(resume&&!hasAutoResume()){renderControls();notify('The saved Auto Seasons session changed.');return;}
    return run(true,{auto:true,firstDraw});
  },{requireWorker:true});
});
$('gStop').addEventListener('click',()=>{
  const job=activeJob;if(!job)return;
  job.stop=true;if(job.auto)clearAuto();waiting?.();renderControls();
  notify(job.inFlight?'Stopping after this bout. Keep the tab open.':'Stopping before the next bout.');
});
$('gStageFilter').addEventListener('change',renderBracket);
for(const id of ['gFind','gRole','gSort','gFavoritesOnly'])$(id).addEventListener(id==='gFind'?'input':'change',renderLedger);
$('gFavorite').addEventListener('click',()=>{
  if(!selected)return;
  if(stars.has(selected))stars.delete(selected);else stars.add(selected);
  try{globalThis.localStorage.setItem(STAR_KEY,JSON.stringify([...stars].slice(-64)));}catch{/* Stars may last only for this tab. */}
  renderFighter();renderLedger();
});
$('gCsv').addEventListener('click',downloadCsv);
$('gWatch').addEventListener('click',openReplay);
$('gReplayPause').addEventListener('click',()=>{
  if(!replay)return;
  replayPaused=!replayPaused;
  if(replayPaused)replay.pause();else replay.resume();
  $('gReplayPause').textContent=replayPaused?'Resume':'Pause';
});
$('gReplaySpeed').addEventListener('change',()=>replay?.setSpeed?.(Number($('gReplaySpeed').value)));
$('gReplay').addEventListener('close',()=>{replayEpoch++;replay?.destroy?.();replay=null;$('gWatch').focus();});
$('gReset').addEventListener('click',()=>{if(!busy()){$('gResetDialog').returnValue='';$('gResetDialog').showModal();}});
$('gResetDialog').addEventListener('close',()=>{
  if($('gResetDialog').returnValue!=='reset'){$('gReset').focus();return;}
  withLock(()=>{
    resetGauntlet();
    const after=raw(GAUNTLET_KEY);
    if(after===null)clearAuto();
    reload();render();
    notify(after===null?'Gauntlet reset. Other game saves were kept.':'Could not clear this browser’s Gauntlet save.');
    $('gDraw').focus();
  });
});
window.addEventListener('storage',({key})=>{
  if(key===STAR_KEY){stars=readStars();renderLedger();renderFighter();}
  if(key===null||key===GAUNTLET_KEY)checkSave();
  if(key===null||key===AUTO_KEY)renderControls();
});
window.addEventListener('pagehide',()=>{pageEpoch++;leftPage=true;claiming=false;replayEpoch++;replay?.destroy?.();replay=null;cancelWork();});
window.addEventListener('pageshow',event=>{if(event.persisted){leftPage=false;if($('gReplay').open)$('gReplay').close();if(checkSave())notify('');render();}});
syncSetup();
render();

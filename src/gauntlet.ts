import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,startGauntlet,nextGauntletBout,recordGauntletBout,resetGauntlet,gauntletLeaderboard} from './gauntlet-tournament.js?v=6.0.2';
import {seasonWeek} from './tournament-calendar.js?v=3.0.1';
import {fighterGenderLabel} from './arcade-fighter-profiles.js?v=2.18.3';
import {drawArcadeFighterPreview} from './arcade-painter.js?v=6.0.2';
import {ARCADE_CHESS_STYLES} from './arcade-chess-styles.js?v=2.44.0';
import {masteryTitle} from './arcade-mastery-title.js?v=2.33.0';
import {combatMoveLabel} from './arcade-callouts.js?v=6.0.2';
import {arcadeSaberOption} from './arcade-loadouts.js?v=6.0.2';

import type {startArcadeTournamentPlayback} from './tournament-replay.js?v=6.0.2';
import {GAUNTLET_HUMAN_KEY,humanBoutReplay,humanReplay} from './gauntlet-play.js?v=6.0.2';
type SaveState = ReturnType<typeof loadGauntlet>;
type Season = NonNullable<SaveState['active']>;
type Fighter = SaveState['fighters'][number];
type SavedBout = Season['bouts'][number];
type Fixture = NonNullable<ReturnType<typeof nextGauntletBout>>;
type Standing = Season['standings'][number][number];
type BoutResult = Parameters<typeof recordGauntletBout>[2];
type Role = 'solo' | 'trio';
type RoleRecord = Fighter[Role];
type Profile = Fighter['adaptation'][Role];
interface DrawOptions { seed: number; limit: number; terrain: string }
interface RunOptions { auto?: boolean; firstDraw?: DrawOptions | null }
interface BoutJob { stop: boolean; inFlight: boolean; auto: boolean }
interface WorkerPayload { error?: string; result?: BoutResult }
type FinishWorker = (error?: unknown, result?: BoutResult | null) => void;
interface PendingWorker { worker: Worker; finish: FinishWorker }
type ReplayController = ReturnType<typeof startArcadeTournamentPlayback>;
type WorkerFinish = BoutResult | null | undefined;
interface DomMap {
  gLimit: HTMLSelectElement; gArena: HTMLSelectElement; gSeed: HTMLInputElement; gDraw: HTMLButtonElement;
  gReplay: HTMLDialogElement; gResetDialog: HTMLDialogElement; gPlay: HTMLButtonElement; gRun: HTMLButtonElement;
  gAuto: HTMLButtonElement; gStop: HTMLButtonElement; gWatch: HTMLButtonElement; gReset: HTMLButtonElement;
  gBar: HTMLProgressElement; gStageFilter: HTMLSelectElement; gFind: HTMLInputElement; gRole: HTMLSelectElement;
  gFavoritesOnly: HTMLInputElement; gSort: HTMLSelectElement; gFighterPortrait: HTMLCanvasElement;
  gReplayPause: HTMLButtonElement; gReplaySkip: HTMLButtonElement; gReplaySpeed: HTMLSelectElement; gReplayCanvas: HTMLCanvasElement;
  gFight: HTMLButtonElement;
}
const $=<ID extends string>(id: ID)=>document.getElementById(id) as ID extends keyof DomMap ? DomMap[ID] : HTMLElement;
const formNames: Readonly<Record<string,string>>={shii_cho:'Shii-Cho',makashi:'Makashi',soresu:'Soresu',ataru:'Ataru',djem_so:'Djem So',niman:'Niman',juyo:'Juyo'};
const maps: Readonly<Record<string,string>>={underpit:'The Underpit',foundry:'The Foundry',ember_ring:'Ember Ring',crossroads:'Crossroads',zigzag:'Zigzag',craterfield:'Craterfield',rotation:'Rotation'};
const groups=['A','B','C','D'], STAR_KEY='saber-pit:gauntlet:stars:1', AUTO_KEY='saber-pit:gauntlet:auto-resume:1';
const el=<K extends keyof HTMLElementTagNameMap>(tag: K,content?: string,style?: string)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(style)node.className=style;return node;};
/** Short facts as separate v6-meta chips instead of a dotted chain. */
const meta=(...parts: (string | null | undefined | false)[])=>{const out: (string | HTMLSpanElement)[]=[];for(const part of parts){if(!part)continue;if(out.length)out.push(' ');out.push(el('span',part,'v6-meta'));}return out;};
const raw=(key: string)=>{try{return globalThis.localStorage.getItem(key);}catch{return undefined;}};
let state=loadGauntlet(), known=raw(GAUNTLET_KEY), activeJob: BoutJob | null=null, workerJob: PendingWorker | null=null, waiting: (()=>void) | null=null, claiming=false;
let resumeDigest: string | undefined, digestSource: string | null | undefined;
let selected: string | null=null, replay: ReplayController | null=null, replayEpoch=0, replayPaused=false, stars=readStars(), leftPage=false, pageEpoch=0;
const count=(x?: number | null)=>Number.isFinite(x)?Math.max(0,Math.trunc(x!)):0;
const score=(n?: number | null)=>Number.isFinite(n)?n!.toLocaleString(undefined,{maximumFractionDigits:1}):'—';
const points=(n: number)=>Number.isFinite(n)?Number.isInteger(n)?String(n):n===.5?'½':Math.floor(n)+'½':'0';
const clocks=(n: number)=>Number.isFinite(n)?(n>=60?Math.floor(n/60)+':'+String(n%60).padStart(2,'0'):n+'s'):'—';
const tempo=(n?: number | null)=>Number.isFinite(n)?n!.toFixed(1)+'s':'—';
const wdl=(row?: RoleRecord | null)=>[row?.wins,row?.draws,row?.losses].map(count).join('–');
const played=(row?: RoleRecord | null)=>count(row?.wins)+count(row?.draws)+count(row?.losses);
const percent=(n?: number | null)=>Number.isFinite(n)?Math.round(n!*100)+'%':'—';
const signed=(n?: number | null)=>Number.isFinite(n)?(n!>0?'+':'')+score(n):'—';
const fighterFor=(id: string)=>state.fighters.find(f=>f.id===id);
const name=(id: string)=>fighterFor(id)?.name??'Fighter';
function addMastery<T extends HTMLElement>(node: T,fighter?: Fighter | null): T{
  if(!fighter)return node;
  const title=masteryTitle(Math.max(fighter.elo,fighter.peakElo),played(fighter.solo)+played(fighter.trio)>0);
  if(title){
    const badge=el('span',title,'mastery-title');
    badge.setAttribute('aria-label','Mastery title '+title);
    node.append(' ',badge);
  }
  return node;
}
const form=(id: string)=>formNames[id]??'Unknown';
const heading=(text: unknown)=>typeof text==='string'&&text?text[0].toUpperCase()+text.slice(1):'Balanced';
const notify=(text: string)=>{$('gStatus').textContent=text;};
const busy=()=>Boolean(activeJob)||claiming;
const resultOf=(b: Pick<SavedBout,'winner'>)=>b.winner===0?'Solo victory':b.winner===1?'Trio victory':'Draw';
const resultLabel=(winner?: 0 | 1 | null)=>winner===0?'Solo Win':winner===1?'Trio Win':'Draw';
const stageOf=(b: Pick<SavedBout,'phase'|'group'>)=>b.phase==='final'?'Final':'Group '+(groups[b.group!]??'—');

// A revision marker outside the portable save never starts work on its own.
function hasAutoResume(){
  const marker=raw(AUTO_KEY);
  return Boolean(marker&&state.active&&typeof known==='string'&&marker===autoDigest());
}
function autoDigest(): string {
  if(digestSource===known)return resumeDigest!;
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<known!.length;i++){
    const c=known!.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,0x85ebca6b);b^=b>>>13;
  }
  digestSource=known;
  return resumeDigest=[state.season,known!.length,a>>>0,b>>>0].join(':');
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
  if(!Number.isSafeInteger(seed)||seed<1||seed>4294967295){notify('Seed must be 1–4,294,967,295');input.focus();return null;}
  return {seed,limit:Number($('gLimit').value),terrain:$('gArena').value};
}
function drawSeason(options: DrawOptions){
  const next=startGauntlet(state,options);
  if(next.season!==state.season+1||!saveState(next))return false;
  $('gSeed').value='';syncSetup();return true;
}
function readStars(): Set<string> {
  try{const list=JSON.parse(raw(STAR_KEY)??'[]');return new Set(Array.isArray(list)?list.filter(x=>typeof x==='string'&&/^g[a-z0-9]+-f\d+$/.test(x)).slice(0,64):[]);}catch{return new Set();}
}
function reviewFighter(id: string, focus=true){
  if(!state.fighters.some(f=>f.id===id))return;
  selected=id;renderLedger();renderFighter();
  if(focus){$('gFighterName').focus({preventScroll:true});$('gFighterName').scrollIntoView({block:'nearest'});}
}
function saveState(next: SaveState){
  let written: string | undefined;
  const storage={setItem(key: string,value: string){globalThis.localStorage.setItem(key,value);written=value;}};
  if(!saveGauntlet(next,storage as Storage))return false;
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
  reload();cancelWork();render();notify('Reloaded from another tab');
  return false;
}
function cancelWork(){
  activeJob=null;workerJob?.finish(null,null);waiting?.();waiting=null;
}
function withLock(task: () => void | Promise<void>,{requireWorker=false}={}){
  if(busy()||leftPage||$('gReplay').open||$('gResetDialog').open)return;
  if(requireWorker&&typeof Worker!=='function'){notify('Browser cannot run brackets');return;}
  const locks=globalThis.navigator?.locks;
  if(requireWorker&&typeof locks?.request!=='function'){notify('Browser cannot lock tabs');return;}
  const epoch=pageEpoch;claiming=true;renderControls();
  const prepare=async (available: boolean)=>{
    if(epoch!==pageEpoch)return;
    claiming=false;
    if(leftPage){renderControls();return;}
    if(!available){renderControls();notify('Busy in another tab');return;}
    if(!checkSave()){renderControls();return;}
    await task();
  };
  const failed=(error: unknown)=>{if(epoch!==pageEpoch)return;claiming=false;cancelWork();render();console.error('Gauntlet operation stopped',error);notify('Couldn’t continue, saved bouts kept');};
  try{
    const promise=typeof locks?.request==='function'?locks.request('saber-pit:progress:'+GAUNTLET_KEY,{ifAvailable:true},lock=>prepare(Boolean(lock))):prepare(true);
    Promise.resolve(promise).catch(failed);
  }catch(error){failed(error);}
}
function work(fixture: Fixture): Promise<WorkerFinish> {
  if(typeof Worker!=='function')return import('./gauntlet-sim.js?v=6.0.2').then(({simulateGauntlet})=>simulateGauntlet(fixture));
  return new Promise<WorkerFinish>((resolve,reject)=>{
    const worker=new Worker(new URL('./gauntlet-worker.js?v=6.0.2',import.meta.url),{type:'module'});
    const finish: FinishWorker=(error,result)=>{
      if(workerJob?.worker!==worker)return;
      workerJob=null;worker.terminate();
      if(error)reject(error);else resolve(result);
    };
    workerJob={worker,finish};
    worker.onmessage=({data}: MessageEvent<WorkerPayload>)=>data?.error?finish(new Error(data.error)):finish(null,data?.result);
    worker.onerror=event=>{event.preventDefault();finish(new Error(event.message||'Worker failed'));};
    try{worker.postMessage({fixture});}catch(error){finish(error);}
  });
}
function yieldBeforeNext(){
  return new Promise<void>(resolve=>{
    const done=()=>{clearTimeout(timer);waiting=null;resolve();};
    const timer=setTimeout(done,70);waiting=done;
  });
}
async function run(multiple: boolean,{auto=false,firstDraw=null}: RunOptions={}){
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
        const options=firstDraw??{seed:(prior!.seed%4294967295)+1,limit:prior!.limit,terrain:prior!.terrain};
        firstDraw=null;
        if(!drawSeason(options))throw new Error('Could not save next Gauntlet season');
        rememberAuto();render();
        fixture=nextGauntletBout(state);
      }
      if(!fixture)break;
      job.inFlight=true;
      notify(`${job.auto?'Auto: season '+state.season+', bout':'Simulating bout'} ${state.active!.cursor+1}/20`);
      const answer=await work(fixture);
      job.inFlight=false;
      if(activeJob!==job||!checkSave())return;
      if(!answer||![0,1,null].includes(answer.winnerIndex))throw new Error('Incomplete bout result');
      const next=recordGauntletBout(state,fixture.id,answer);
      if(next.active?.cursor!==state.active!.cursor+1)throw new Error('Unexpected fixture or duplicate result');
      if(!saveState(next)){cancelWork();render();notify('Not saved: last save kept');return;}
      if(auto&&!job.stop)rememberAuto();
      render();
      notify(auto&&state.active!.status==='complete'&&!job.stop
        ?`Season ${state.season} done, drawing next`
        :`Bout ${state.active!.cursor} saved`);
      if(!multiple||job.stop||(!auto&&!nextGauntletBout(state)))break;
      await yieldBeforeNext();
    }while(!job.stop);
    if(activeJob!==job)return;
    activeJob=null;render();
    if(job.stop)notify('Stopped, bouts kept');
    else if(state.active?.status==='complete'){
      notify('Season complete');
      if([document.body,$('gPlay'),$('gRun')].includes(document.activeElement as HTMLElement))$('gDraw').focus();
    }
  }catch(error){
    if(activeJob!==job)return;
    console.error('Gauntlet bout failed',error);cancelWork();render();
    notify('Bout failed, saves kept');
  }
}
function renderControls(){
  const next=nextGauntletBout(state), disabled=busy();
  $('gPlay').disabled=disabled||!next;
  $('gFight').disabled=disabled||!next;
  $('gRun').disabled=disabled||!next;
  const resume=!disabled&&hasAutoResume();
  $('gAuto').disabled=disabled;
  $('gAuto').textContent=activeJob?.auto?'Auto Running':resume?'Resume Auto':'Auto Seasons';
  $('gAutoHelp').textContent=activeJob?.auto?'Keep this tab open':resume
    ?'Resumes from the last saved bout'
    :'Runs seasons back to back';
  $('gStop').hidden=!activeJob;
  $('gStop').disabled=Boolean(activeJob?.stop);
  $('gStop').textContent=activeJob?.stop?'Stopping…':'Stop';
  $('gWatch').hidden=!state.active?.lastFixture;
  $('gWatch').disabled=disabled;
  $('gSetup').hidden=Boolean(state.active&&state.active.status!=='complete');
  $('gSetupTitle').textContent=state.season?'Season '+(state.season+1):'New Season';
  $('gSetupHelp').textContent=state.season
    ?'Roster and Elo carry over'
    :'Blank seed draws at random';
  for(const id of ['gDraw','gSeed','gLimit','gArena'] as const)$(id).disabled=disabled;
  $('gDraw').textContent=state.season?'Next Bracket':'Draw Bracket';
  $('gReset').disabled=disabled||!state.season&&!(typeof known==='string'&&known);
}
function renderDesk(){
  const a=state.active,next=nextGauntletBout(state);
  if(state.season)$('gSeasonBadge').replaceChildren(...meta(`Season ${state.season}`,`Week ${seasonWeek(state.season)}`));else $('gSeasonBadge').textContent='No Season';
  $('gNextStage').textContent=next?stageOf(next):state.season?'Season Complete':'Ready';
  $('gNextTitle').textContent=next?name(next.soloId)+' vs '+next.trioIds.map(name).join(' / '):state.season?'All Bouts Done':'No Bout';
  $('gNextDetail').replaceChildren(...(next?meta('1v3',maps[next.terrain]??next.terrain,clocks(next.limit)):[]));
  $('gProgress').hidden=!a;
  $('gBar').value=a?.cursor??0;
  const draws=a?.bouts.filter(x=>x.winner===null).length??0;
  $('gProgressText').replaceChildren(...meta(`${a?.cursor??0}/20 Bouts`,`${draws} ${draws===1?'Draw':'Draws'}`));
}
function bracketCard(title: string,rows: readonly Standing[],settled: number,qualifies=false){
  const card=el('section',undefined,'g-group'),top=el('div',undefined,'g-round-caption');
  top.append(el('h3',title),el('span',`${settled}/4`));
  card.append(top);
  if(!rows.length){card.append(el('p','TBD','muted'));return card;}
  const list=el('ol');
  for(const [i,r] of rows.entries()){
    const advances=qualifies&&settled===4&&i===0;
    const item=el('li',undefined,advances?'g-advances':undefined);
    const identity=el('div',undefined,'g-bracket-fighter');
    identity.append(addMastery(el('span',name(r.id)),fighterFor(r.id)));
    if(advances)identity.append(el('span','To Final','g-advance-tag'));
    const pts=el('span',undefined,'g-points');pts.append(...meta(`${points(r.soloPoints)} Solo`,`${points(r.points)} Pts`));
    item.append(identity,pts);
    list.append(item);
  }
  card.append(list);return card;
}
function renderBracket(){
  const a=state.active, filter=$('gStageFilter').value||'all';
  $('gGroups').hidden=filter==='final';
  $('gFinal').hidden=filter==='groups';
  if(!a){
    $('gGroups').replaceChildren(el('p','No season yet','muted'));
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
    const tied=!former||(former as {draw?: boolean}).draw===true||!former.id||former.season!==state.season;
    if(tied){$('gMedals').replaceChildren(el('p','Final drawn, no medals','muted'));return;}
    const list=el('ol',undefined,'g-medals');
    for(const [i,row] of (a.finalStandings??[]).slice(0,3).entries()){
      const item=el('li');item.append(addMastery(el('span',name(row.id)),fighterFor(row.id)),el('span',['Gold','Silver','Bronze'][i],'g-ordinal'));list.append(item);
    }
    $('gMedals').replaceChildren(list);
  }else{
    const line=el('p',former?.id?undefined:'No medals yet','muted');if(former?.id)line.append(...meta('Last Champion',former.name,`Season ${former.season}`));
    $('gMedals').replaceChildren(line);
  }
}
function renderLedger(){
  const needle=$('gFind').value.trim().toLocaleLowerCase(), role=($('gRole').value||'all') as Role | 'all';
  const ranked=gauntletLeaderboard(state).filter(f=>(!needle||f.name.toLocaleLowerCase().includes(needle))&&
    (role==='all'||played(f[role])>0)&&(!$('gFavoritesOnly').checked||stars.has(f.id)));
  if($('gSort').value==='peak')ranked.sort((a,b)=>b.peakElo-a.peakElo||b.elo-a.elo);
  if(!ranked.length){
    const row=el('tr'),msg=el('td',state.fighters.length?'No matches':'No fighters yet','muted');msg.colSpan=5;
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
function roleSummary(title: string,record: RoleRecord,adaptation?: Profile | null){
  const box=el('section'),p: Partial<Profile>=adaptation??{};
  const line=(...parts: (string | null | undefined | false)[])=>{const row=el('p');row.append(...meta(...parts));return row;};
  box.append(el('h4',title),line(`W–D–L ${wdl(record)}`,`Bouts ${count(p.bouts)}`));
  if(count(p.bouts)){
    box.append(line(`Plan ${heading(p.doctrine??p.lastDoctrine)}`),
      line(`Guard ${percent(p.guard)}`,`Pressure ${percent(p.pressure)}`,`Mobility ${percent(p.mobility)}`));
    const named=combatMoveLabel(p.preferredMove!);
    if(named)box.append(line('Move '+named));
  }
  return box;
}
function renderFighter(){
  const f=state.fighters.find(x=>x.id===selected);$('gFighter').hidden=!f;if(!f)return;
  $('gFighterName').textContent=f.name;addMastery($('gFighterName'),f);
  $('gFighterMeta').replaceChildren(...meta(form(f.form),'SSS+ V',fighterGenderLabel(f.gender),`Elo ${score(f.elo)}`,`Peak ${score(f.peakElo)}`));
  const weaponId=f.gear?.weapon??f.weapon;
  const saber=weaponId?arcadeSaberOption({weapon:weaponId,grip:(f.gear?.grip??f.grip)==='backhand'?'backhand':'forward'}).label:null;
  const style=ARCADE_CHESS_STYLES[f.chessStyle]?.label;
  $('gFighterGear').replaceChildren(...meta(saber,style));
  const portrait=$('gFighterPortrait'),ctx=portrait.getContext?.('2d');
  portrait.hidden=!ctx;
  if(ctx){
    ctx.clearRect(0,0,portrait.width,portrait.height);
    drawArcadeFighterPreview(ctx,f,{reducedMotion:true,framing:'portrait'});
  }
  const star=stars.has(f.id);$('gFavorite').setAttribute('aria-pressed',String(star));$('gFavorite').textContent=star?'Unstar':'Star';
  $('gRoleReports').replaceChildren(roleSummary('Solo',f.solo,f.adaptation?.solo),roleSummary('Trio',f.trio,f.adaptation?.trio));
}
function renderReport(){
  const bouts=state.active?.bouts??[], last=bouts.at(-1);
  $('gReport').hidden=!last;$('gLog').hidden=!last;
  if(!last)return;
  $('gLogCount').textContent=String(bouts.length);
  const list=el('ol');
  for(const b of bouts){const item=el('li');item.append(...meta(stageOf(b),`${name(b.soloId)} vs ${b.trioIds.map(name).join(' / ')}`,resultLabel(b.winner),tempo(b.time)));list.append(item);}
  $('gBoutLog').replaceChildren(list);
  $('gOutcome').replaceChildren(...meta(stageOf(last),resultLabel(last.winner),tempo(last.time)));
  $('gDeltas').replaceChildren(...[last.soloId,...last.trioIds].map((id,i)=>{
    const f=state.fighters.find(x=>x.id===id), role=i===0?'solo':'trio', p=f?.adaptation?.[role], div=el('div'),label=el('span',name(id));
    const small=el('small');small.append(...meta(heading(role),heading(p?.doctrine),`Guard ${percent(p?.guard)}`,`Pressure ${percent(p?.pressure)}`));label.append(small);
    div.append(label,el('span',signed(last.eloDelta?.[i]),'g-delta'));return div;
  }));
}
function render(){
  renderControls();renderDesk();renderBracket();renderMedals();renderLedger();renderFighter();renderReport();
}
function csvCell(value: unknown){
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
  notify('CSV downloaded');
}
async function openReplay(){
  if(busy()||$('gReplay').open||!state.active?.lastFixture)return;
  const fixture=state.active.lastFixture, session=++replayEpoch, status=$('gReplayStatus');
  replayPaused=false;$('gReplayPause').textContent='Pause';$('gReplayPause').disabled=true;$('gReplaySkip').disabled=true;
  $('gReplaySpeed').value='1';$('gReplaySpeed').disabled=true;
  status.textContent='Loading replay…';$('gReplay').showModal();
  try{
    const [{createGauntletBattle,stepGauntletBattle},{startArcadeTournamentPlayback},{arcadeReplayRules}]=await Promise.all([
      import('./gauntlet-sim.js?v=6.0.2'),import('./tournament-replay.js?v=6.0.2'),import('./arcade-replay-rules.js?v=6.0.2')]);
    const rules={...await arcadeReplayRules(),stepArcade:stepGauntletBattle};
    const valid=()=>session===replayEpoch&&$('gReplay').open;
    if(!valid())return;
    const fought=humanBoutReplay(raw(GAUNTLET_HUMAN_KEY),state);
    // A bout you fought is only ever shown as your own fight. Without its controls there is no replay.
    if(fought.kind==='unavailable'){status.textContent='Replay unavailable for your bout';return;}
    const human=fought.kind==='replay'?humanReplay(fixture,fought.log):null;
    replay=startArcadeTournamentPlayback($('gReplayCanvas'),human?.game??createGauntletBattle(fixture),fixture.terrain,human?{...rules,stepArcade:human.step}:rules,{
      drawOnTimeout:true,showMemberNames:true,...(human?{markedId:(human.game.fighters[0] as {id:string}).id}:{}),
      onFrame(left?: number){if(valid())status.textContent=clocks(left!<=1e-6?0:Math.ceil(left!));},
      onSkipError(){if(valid()){replayPaused=false;$('gReplayPause').disabled=false;$('gReplayPause').textContent='Pause';$('gReplaySpeed').disabled=false;status.textContent='Skip failed, replay resumed';}},
      onEnd(winner?: 0 | 1 | null){if(valid()){status.textContent=resultLabel(winner);$('gReplayPause').disabled=true;$('gReplaySkip').disabled=true;$('gReplaySpeed').disabled=true;}}
    });
    $('gReplayPause').disabled=!replay.pause;$('gReplaySpeed').disabled=!replay.setSpeed;$('gReplaySkip').disabled=!replay.skip;
  }catch(error){if(session===replayEpoch){console.error('Gauntlet replay failed',error);status.textContent='Couldn’t open replay';}}
}
$('gSetup').addEventListener('submit',event=>{
  event.preventDefault();if(state.active&&state.active.status!=='complete')return;
  const options=setupOptions();if(!options)return;
  withLock(()=>{
    if(state.active&&state.active.status!=='complete')return;
    if(!drawSeason(options)){render();notify('Season not saved: storage blocked');return;}
    clearAuto();render();notify(`Season ${state.season} drawn`);$('gPlay').focus();
  });
});
$('gPlay').addEventListener('click',()=>withLock(()=>run(false)));
$('gRun').addEventListener('click',()=>withLock(()=>run(true),{requireWorker:true}));
$('gAuto').addEventListener('click',()=>{
  const resume=hasAutoResume(), canDraw=!state.active||state.active.status==='complete';
  const firstDraw=!resume&&canDraw?setupOptions():null;
  if(!resume&&canDraw&&!firstDraw)return;
  withLock(()=>{
    if(resume&&!hasAutoResume()){renderControls();notify('Auto session changed');return;}
    return run(true,{auto:true,firstDraw});
  },{requireWorker:true});
});
$('gStop').addEventListener('click',()=>{
  const job=activeJob;if(!job)return;
  job.stop=true;if(job.auto)clearAuto();waiting?.();renderControls();
  notify(job.inFlight?'Stopping after this bout':'Stopping');
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
// Fight next bout: opens the v6 match screen with the person in the Blue seat. That screen settles the bout
// once, under this save's lock; leaving it before the end saves nothing.
$('gFight').addEventListener('click',()=>{
  if(busy()||leftPage||!checkSave()||!nextGauntletBout(state))return;
  location.assign('./index.html?seat=gauntlet');
});

$('gReplayPause').addEventListener('click',()=>{
  if(!replay)return;
  replayPaused=!replayPaused;
  if(replayPaused)replay.pause();else replay.resume();
  $('gReplayPause').textContent=replayPaused?'Resume':'Pause';
});
$('gReplaySkip').addEventListener('click',()=>{if(replay?.skip?.()){$('gReplaySkip').disabled=true;$('gReplayPause').disabled=true;$('gReplaySpeed').disabled=true;$('gReplayStatus').textContent='Skipping…';}});
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
    notify(after===null?'Gauntlet reset':'Couldn’t clear Gauntlet save');
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

/** v6 menu shell: the approved home grid, player card, Play screen and Pause column.
 *  It only drives the existing setup controls (select change events, preset clicks, form submit).
 *  No save, storage key or rating code is read for writing here. */
import {readArcadeCareer} from './arcade-career.js?v=4.01.1';
import {statsView} from './arcade-stats-page.js';
import {paintV6Scene,paintV6Fighter,paintV6Card,type V6Scene,type V6Card} from './arcade-v6-scene.js';
import {SOLDIER_GRADES} from './progression.js?v=1.4.0';
import {ARCADE_SABER_OPTIONS} from './arcade-loadouts.js?v=3.1.0';

const body=document.body;
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T|null;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,cls?:string,text?:string){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
const canvases=new Map<HTMLCanvasElement,V6Scene>();
const cards=new Map<HTMLCanvasElement,V6Card>();
const paintAll=()=>{for(const [c,s] of canvases)if(c.isConnected&&c.offsetParent!==null)paintV6Scene(c,s);for(const [c,k] of cards)if(c.isConnected&&c.offsetParent!==null)paintV6Card(c,k);};
function art(scene:V6Scene){const c=el('canvas','v6-art');c.setAttribute('aria-hidden','true');canvases.set(c,scene);return c;}

/* ---------- player card ---------- */
function playerCard(){
  const card=el('div','v6-player');card.setAttribute('aria-label','Your Arena Record');
  const fill=()=>{
    const view=statsView(readArcadeCareer()),you=view?.you??null;
    card.replaceChildren();
    const av=el('span','v6-avatar');av.setAttribute('aria-hidden','true');
    const who=el('span','v6-who');who.append(el('b',undefined,you?`${you.team===0?'Blue':'Pink'} ${you.slot+1}`:'You'));
    const bodyTxt=get<HTMLSelectElement>('bodyStyle')?.selectedOptions[0]?.text,formTxt=get<HTMLSelectElement>('style')?.selectedOptions[0]?.text?.replace(/^[IVX]+\s*·\s*/,'');
    const parts=[bodyTxt,formTxt].filter((t):t is string=>!!t);if(parts.length){const line=el('small');for(const t of parts)line.append(line.childNodes.length?' ':'',el('span','v6-meta',t));who.append(line);}
    const stat=(v:string,k:string,cls='')=>{const s=el('span','v6-stat '+cls);s.append(el('b',undefined,v),el('small',undefined,k));return s;};
    // K/D and Win stay blank until the round record travels with Saves across devices.
    card.append(av,who,stat(you?.rank?.split(' ')[0]??'—','Rank','v6-rank'),stat(you?.elo!=null?String(Math.round(you.elo)):'—','Elo'),stat('—','K/D'),stat('—','Win'));
  };
  fill();return {card,fill};
}

/* ---------- home grid ---------- */
const home=el('section','v6-home');home.id='v6Home';home.setAttribute('aria-label','Play');
const {card:homeCard,fill:fillCard}=playerCard();
function tile(opts:{title:string;card:V6Card;cta:string;href?:string;onPlay?:()=>void;tag?:string;tagTone?:string;tone?:string;big?:boolean}){
  const t=el('article','v6-card v6-card-'+opts.card+(opts.big?' v6-card-big':''));
  const cv=el('canvas','v6-art');cv.setAttribute('aria-hidden','true');cards.set(cv,opts.card);t.append(cv);
  if(opts.tag)t.append(el('span','v6-tag v6-tag-'+(opts.tagTone??'red'),opts.tag));
  const txt=el('div','v6-card-text');
  txt.append(el('h2',undefined,opts.title));
  const row=el('div','v6-card-actions');
  if(opts.href){
    const cover=el('a','v6-cover');cover.href=opts.href;cover.tabIndex=-1;cover.setAttribute('aria-hidden','true');t.append(cover);
    const a=el('a','v6-cta '+(opts.tone??'v6-cta-2'),opts.cta);a.href=opts.href;a.setAttribute('aria-label',`${opts.cta} ${opts.title}`);row.append(a);
  }else{const b=el('button','v6-cta v6-play-main',opts.cta);b.type='button';b.addEventListener('click',()=>opts.onPlay?.());row.append(b);}
  txt.append(row);t.append(txt);return {t,row};
}
const arena=tile({title:'Arena',card:'arena',cta:'Play',tag:'Ranked',big:true,onPlay:()=>showPlay()});
const modesBtn=el('button','v6-cta v6-cta-2','Modes');modesBtn.type='button';modesBtn.addEventListener('click',()=>showPlay());arena.row.append(modesBtn);
// Move the existing resume control; the career module still owns visibility and click handling.
const resumeFromHome=get('homeContinue');
if(resumeFromHome){resumeFromHome.className='v6-cta v6-cta-2';resumeFromHome.textContent='Continue';arena.row.append(resumeFromHome);}
const grid=el('div','v6-grid');
grid.append(arena.t,
  tile({title:'MOBA',card:'fronts',cta:'Play',tag:'NEW',tagTone:'green',tone:'v6-cta-cyan',href:'./moba.html'}).t,
  tile({title:'Tournament',card:'tournament',cta:'Open',href:'./tournament.html'}).t,
  tile({title:'Gauntlet',card:'gauntlet',cta:'Climb',href:'./gauntlet.html'}).t,
  tile({title:'Heroes',card:'heroes',cta:'Manage',href:'./tournament.html#heroesPanel'}).t);
const ICON={
  home:'<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3Z"/>',
  stats:'<path d="M4 20V10h3v10Zm6.5 0V4h3v16ZM17 20v-7h3v7ZM2 21h20v1.5H2Z"/>',
  heroes:'<circle cx="12" cy="7.5" r="4.5"/><path d="M3 21c0-5 4-8 9-8s9 3 9 8Z"/>',
  saves:'<path d="M4 3h16v18H4Zm4 4v10h8V7Z"/>',
  settings:'<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 4.6-.1-2.4 2-1.6-2-3.4-2.4.9a8 8 0 0 0-2-1.2L15.5 3h-4l-.4 2.5a8 8 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a8 8 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a8 8 0 0 0 2 1.2l.4 2.5h4l.4-2.5a8 8 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6Z"/>'};
const more=el('nav','v6-nav');more.setAttribute('aria-label','Menu');
for(const [key,label,act] of [['home','Home',()=>showHome()],['stats','Stats',()=>document.querySelector<HTMLButtonElement>('[data-open-stats]')?.click()],['heroes','Heroes','./tournament.html#heroesPanel'],['saves','Saves','./backup.html'],['settings','Settings',()=>get<HTMLButtonElement>('settingsOpen')?.click()]] as const){
  const n=typeof act==='string'?Object.assign(el('a'),{href:act}):Object.assign(el('button'),{type:'button'});
  n.className='v6-nav-item';if(key==='home')n.setAttribute('aria-current','page');
  n.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICON[key]}</svg>`;n.append(el('span',undefined,label));
  if(typeof act!=='string')n.addEventListener('click',act);more.append(n);
}
home.append(grid);
const entry=get('entry');entry?.before(home);
get('frameRate')?.before(more,homeCard);

/* ---------- Play screen (restyled setup) ---------- */
const lobby=get<HTMLFormElement>('lobby');
const play=el('div','v6-play');play.id='v6Play';
const head=el('div','v6-play-head');const back=el('button','v6-back');back.type='button';back.setAttribute('aria-label','Home');back.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
back.addEventListener('click',()=>showHome());head.append(back,el('h2',undefined,'Play'));
const list=el('div','v6-modes');list.setAttribute('role','group');list.setAttribute('aria-label','Match modes');
const MODE_ROWS:[string,string,string,V6Scene][]=[['duel','Duel','','duel'],['squad','Squads','','squad'],['watch','Showdown','','squad'],['master','Master Trial','','solo'],['hero','Hero','','heroes']];
const THUMB:Record<string,V6Card>={duel:'arena',squad:'heroes',watch:'heroes',master:'gauntlet',hero:'heroes'};
function thumbArt(card:V6Card){const cv=el('canvas','v6-thumb');cv.setAttribute('aria-hidden','true');cards.set(cv,card);return cv;}
const presetSource=(p:string)=>p==='hero'?get<HTMLButtonElement>('watchHero'):document.querySelector<HTMLButtonElement>(`[data-preset="${p}"]`);
const modeButtons:HTMLButtonElement[]=[];
for(const [preset,name,sub,scene] of MODE_ROWS){
  const src=presetSource(preset);if(!src)continue;
  const b=el('button','v6-mode');b.type='button';b.dataset.v6Preset=preset;
  void sub;void scene;
  const tx=el('span','v6-mode-text');tx.append(el('b',undefined,name));
  b.append(thumbArt(THUMB[preset]??'arena'),tx);b.addEventListener('click',()=>{src.click();syncModes();});
  modeButtons.push(b);list.append(b);
  if(preset==='squad')for(const [name,href,card] of [['MOBA','./moba.html','fronts'],['Gauntlet','./gauntlet.html','gauntlet'],['Tournament','./tournament.html','tournament'],['Squad Tournament','./tournament.html#squads','tournament']] as const){
    const a=el('a','v6-mode v6-mode-link');a.href=href;const tx=el('span','v6-mode-text');tx.append(el('b',undefined,name));a.append(thumbArt(card),tx);list.append(a);
  }
}
const stage=el('div','v6-stage');const stageArt=art('duel');const stageTitle=el('h3','v6-stage-title','Duel');
const chips=el('div','v6-chips');
function chipRow(label:string,selectId:string,options:[string,string][]){
  const sel=get<HTMLSelectElement>(selectId);if(!sel)return;
  const g=el('fieldset','v6-chip-row');g.append(el('legend',undefined,label));
  const btns=options.map(([v,t])=>{const b=el('button','v6-chip',t);b.type='button';b.dataset.value=v;b.addEventListener('click',()=>{sel.value=v;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));syncChips();});g.append(b);return b;});
  chipSyncs.push(()=>{for(const b of btns){b.setAttribute('aria-pressed',String(b.dataset.value===sel.value));b.disabled=sel.disabled;}g.hidden=sel.closest('[hidden]')!==null&&!sel.closest('#customizeMatch');});
  chips.append(g);
}
const chipSyncs:(()=>void)[]=[];const syncChips=()=>{for(const f of chipSyncs)f();};
chipRow('Rules','rule',[['elimination','Elimination'],['control','Control'],['relic','Relic']]);
chipRow('Map','mapSize',[['small','Small'],['medium','Medium'],['large','Large']]);
chipRow('Play As','participation',[['play','Fighter'],['command','Commander'],['watch','Watch']]);
chipRow('Round','duration',[['45','45s'],['90','90s'],['150','150s']]);
const go=el('div','v6-go');
const playBtn=el('button','v6-cta v6-play-btn','Play');playBtn.type='submit';playBtn.setAttribute('form','lobby');playBtn.setAttribute('aria-describedby','arenaRatingStatus');
const loadoutBtn=el('button','v6-cta v6-cta-2','Loadout');loadoutBtn.type='button';
loadoutBtn.addEventListener('click',()=>showLoadout());
go.append(playBtn,loadoutBtn);
const stageText=el('div','v6-stage-text');stageText.append(stageTitle,chips,go);
stage.append(stageArt,stageText);
play.append(head,list,stage);
lobby?.prepend(play);
// Keep the actual controls, so the existing start/save handlers and state remain authoritative.
const playTools=el('details','v6-play-tools');
const playToolsSummary=el('summary',undefined,'More Modes');
const playToolRow=el('div','v6-play-tool-row');
for(const id of ['autoDuelStart','formsGuide','rankSetup']){
 const item=get(id);
 if(item){item.classList.add('v6-cta','v6-cta-2');playToolRow.append(item);}
}
const classic=lobby?.querySelector<HTMLAnchorElement>('a[href="./classic.html"]');
if(classic){classic.classList.add('v6-cta','v6-cta-2');classic.textContent='Legacy Classic';playToolRow.append(classic);}
for(const [label,href] of [['Style Lab','./style-lab.html'],['Idle RPG','./idle-rpg.html']]){
 const link=el('a','v6-cta v6-cta-2',label);link.href=href;playToolRow.append(link);
}
playTools.append(playToolsSummary,playToolRow);
play.after(playTools);
const custom=get<HTMLDetailsElement>('customizeMatch');const customSum=custom?.querySelector('summary');if(customSum)customSum.textContent='More Options';
function syncModes(){
  let active:HTMLButtonElement|undefined;
  for(const b of modeButtons){const src=presetSource(b.dataset.v6Preset??'');const on=src?.getAttribute('aria-pressed')==='true';b.setAttribute('aria-current',String(on));b.setAttribute('aria-pressed',String(on));b.disabled=!!src?.disabled;if(on)active=b;}
  const row=MODE_ROWS.find(r=>r[0]===active?.dataset.v6Preset);
  stageTitle.textContent=row?row[1]:'Custom Match';
  if(matchMedia('(max-width:760px)').matches){if(active&&active.nextSibling!==chips)active.after(chips);}else if(chips.parentElement!==stageText)stageText.insertBefore(chips,go);
  const scene=row?row[3]:'squad';if(canvases.get(stageArt)!==scene){canvases.set(stageArt,scene);if(stageArt.offsetParent)paintV6Scene(stageArt,scene);}
  syncChips();
}
lobby?.addEventListener('change',()=>queueMicrotask(()=>{syncModes();fillCard();}));
lobby?.addEventListener('click',()=>setTimeout(syncModes,0));

/* ---------- views ---------- */
function setScreen(s:'home'|'play'|'loadout'){body.dataset.v6=s;requestAnimationFrame(()=>{paintAll();syncModes();});}
function showHome(){setScreen('home');fillCard();window.scrollTo(0,0);}
function showPlay(){setScreen('play');window.scrollTo(0,0);}
for(const a of document.querySelectorAll<HTMLAnchorElement>('a.launch-setup[href="#entry"]'))a.addEventListener('click',e=>{e.preventDefault();showPlay();});
let lastView=body.dataset.view;
/* HUD: the player's own Elo beside their name, as in the mock. */
const hudElo=el('span','v6-hud-elo');hudElo.setAttribute('aria-label','Your Elo');
const hudName=get('blueName');
function fillHudElo(){
  hudElo.textContent=hudName?.dataset.ownElo??'';
  hudElo.hidden=!hudElo.textContent;
  if(hudName&&hudElo.previousElementSibling!==hudName)hudName.after(hudElo);
}
if(hudName)new MutationObserver(fillHudElo).observe(hudName,{attributes:true,attributeFilter:['data-own-elo']});
new MutationObserver(()=>{const v=body.dataset.view;if(v===lastView)return;lastView=v;if(v==='menu'){fillCard();requestAnimationFrame(paintAll);}if(v==='game')fillHudElo();}).observe(body,{attributes:true,attributeFilter:['data-view']});
let resizeTimer=0;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=window.setTimeout(paintAll,120);});
setScreen(location.hash==='#entry'?'play':'home');
// Links from the other pages' bottom nav.
if(location.hash==='#stats')document.querySelector<HTMLButtonElement>('[data-open-stats]')?.click();
else if(location.hash==='#settings')get<HTMLButtonElement>('settingsOpen')?.click();

/* ---------- pause column ---------- */
const pauseActions=document.querySelector('#pauseOverlay .dialog-actions');
const leave=pauseActions?.querySelector<HTMLButtonElement>('[data-home]');
if(leave){leave.textContent='Leave';leave.classList.add('v6-danger');pauseActions?.append(leave);}
const keys=get('keysOpen');if(keys)keys.textContent='Controls';
const pSet=get('pauseSettings');if(pSet&&keys)keys.before(pSet);
const pauseLine=el('p','v6-pause-line');
document.querySelector('#pauseOverlay .dialog')?.append(pauseLine);
new MutationObserver(()=>{const o=get('pauseOverlay');if(!o||o.hidden)return;
  // The mock's footer: Round and Elo, label then bold value. K/D is not readable from the menu layer.
  const round=(get('round')?.textContent??'').replace(/^Round\s*/i,''),elo=hudElo.textContent??'';
  pauseLine.replaceChildren();
  for(const [label,value] of [['Round',round],['Elo',elo]] as const)if(value){const s=el('span',undefined,label+' ');s.append(el('b',undefined,value));pauseLine.append(s);}
}).observe(get('pauseOverlay')??body,{attributes:true,attributeFilter:['hidden']});

/* ---------- Loadout screen ---------- */
const loadout=el('section','v6-loadout');loadout.id='v6Loadout';loadout.setAttribute('aria-label','Loadout');
const lHead=el('div','v6-play-head');const lBack=el('button','v6-back');lBack.type='button';lBack.setAttribute('aria-label','Back to Play');lBack.innerHTML=back.innerHTML;
lBack.addEventListener('click',()=>showPlay());lHead.append(lBack,el('h2',undefined,'Loadout'));
const hero=el('canvas','v6-loadout-art');hero.setAttribute('aria-hidden','true');
const heroName=el('p','v6-loadout-name');
const panel=el('div','v6-loadout-panel');
const tabs=el('div','v6-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Loadout');
const panes=el('div','v6-panes');
const TABS:[string,string][]=[['look','Look'],['form','Form'],['saber','Saber'],['force','Force']];
const tabBtns=TABS.map(([id,label],i)=>{const b=el('button','v6-tab',label);b.type='button';b.setAttribute('role','tab');b.id='v6tab-'+id;b.setAttribute('aria-controls','v6pane-'+id);
  b.addEventListener('click',()=>selectTab(i));b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){e.preventDefault();const n=(i+d+TABS.length)%TABS.length;selectTab(n);tabBtns[n]?.focus();}});tabs.append(b);return b;});
const paneEls=TABS.map(([id])=>{const p=el('div','v6-pane');p.id='v6pane-'+id;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby','v6tab-'+id);panes.append(p);return p;});
function selectTab(n:number){tabBtns.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===n));b.tabIndex=i===n?0:-1;});paneEls.forEach((p,i)=>{p.hidden=i!==n;});}
/** Loadout picks are tiles that fill their tab: the bare name, plus one small tag where it says something
 *  (a form's numeral, a blade count). No "· detail" tails, no "saber(s)", no repeated section heading. */
const pickName=(t:string)=>t.replace(/^[IVX]+\s*·\s*/,'').split(' · ')[0]!.replace(/^Force (\w)/,(_,c:string)=>c.toUpperCase()).replace(/ sabers?$/i,'').trim();
const pickTag=(selectId:string,o:HTMLOptionElement)=>selectId==='style'?o.dataset.roman??'':
  selectId.startsWith('saberKit')?((n=ARCADE_SABER_OPTIONS.find(k=>k.id===o.value) as {blades?:number}|undefined)=>n?.blades?'×'+n.blades:'')():'';
function chipsFrom(selectId:string,pane:HTMLElement,label:string){
  const sel=get<HTMLSelectElement>(selectId);pane.replaceChildren();if(!sel){pane.append(el('p','v6-empty','Locked'));return;}
  const g=el('div','v6-picks');g.setAttribute('role','group');g.setAttribute('aria-label',label);g.dataset.pick=selectId;
  for(const o of sel.options){const b=el('button','v6-pick');b.type='button';b.dataset.value=o.value;b.append(el('b',undefined,pickName(o.text)));
    const tag=pickTag(selectId,o);if(tag){const t=el('span','v6-tag',tag);t.setAttribute('aria-hidden','true');b.append(t);}
    if(selectId.startsWith('startingForceFamily')){const dot=el('i','v6-dot');dot.dataset.force=o.value;dot.setAttribute('aria-hidden','true');b.prepend(dot);}
    b.disabled=o.disabled||sel.disabled;b.setAttribute('aria-pressed',String(o.value===sel.value));
    b.addEventListener('click',()=>{sel.value=o.value;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));chipsFrom(selectId,pane,label);paintHero();fillCard();});g.append(b);}
  pane.append(g);
}
const LOOK_CARDS:[string,string][]=[['woman','Woman'],['femboy','Femboy'],['rabbit','Rabbit']];
function lookPane(){
  const pane=paneEls[0];const sel=get<HTMLSelectElement>('bodyStyle');if(!pane)return;pane.replaceChildren();
  const row=el('div','v6-looks');
  for(const [v,name] of LOOK_CARDS){const b=el('button','v6-look');b.type='button';b.setAttribute('aria-pressed',String(sel?.value===v));b.disabled=!sel||sel.disabled;
    const cv=el('canvas','v6-look-art');cv.setAttribute('aria-hidden','true');b.append(cv,el('b',undefined,name));
    b.addEventListener('click',()=>{if(!sel)return;sel.value=v;sel.dispatchEvent(new Event('change',{bubbles:true}));lookPane();paintHero();});row.append(b);}
  pane.append(row);
  requestAnimationFrame(()=>{row.querySelectorAll<HTMLButtonElement>('.v6-look').forEach((b,i)=>{const cv=b.querySelector('canvas');const lk=LOOK_CARDS[i];if(cv&&lk)paintV6Fighter(cv,lk[0],{stage:false});});});
}
function paintHero(){const body=get<HTMLSelectElement>('bodyStyle')?.value??'woman';const form=get<HTMLSelectElement>('style');
  const view=statsView(readArcadeCareer()),you=view?.you??null;heroName.replaceChildren();
  const rk=el('span','v6-loadout-rank',you?.rank?.split(' ')[0]??'—');rk.setAttribute('aria-label','Rank');heroName.append(rk,(form?.selectedOptions[0]?.text??'').replace(/^[IVX]+\s*·\s*/,''));
  if(hero.offsetParent)paintV6Fighter(hero,body);}
const ready=el('button','v6-cta v6-ready','Ready');ready.type='button';ready.addEventListener('click',()=>showPlay());
panel.append(tabs,panes,ready);
loadout.append(lHead,hero,heroName,panel);
entry?.before(loadout);
function showLoadout(){
  lookPane();chipsFrom('style',paneEls[1]??panel,'Form');chipsFrom('saberKit0',paneEls[2]??panel,'Saber');chipsFrom('startingForceFamily0',paneEls[3]??panel,'Force');
  selectTab(0);setScreen('loadout');window.scrollTo(0,0);requestAnimationFrame(paintHero);
}
addEventListener('resize',()=>{if(body.dataset.v6==='loadout')paintHero();});

/* ---------- results wording like the mock ---------- */
const resultTitle=get('resultTitle');
const winnerArt=el('canvas','v6-result-art');winnerArt.setAttribute('aria-hidden','true');resultTitle?.before(winnerArt);
new MutationObserver(()=>{const o=get('result');if(!o||o.hidden||!resultTitle)return;
  // Only your own win shows your fighter; a draw, a loss or a watched round shows no winner art.
  const look=o.dataset.winnerBody;
  winnerArt.hidden=!look;
  if(look)requestAnimationFrame(()=>{if(winnerArt.offsetParent&&o.dataset.winnerBody===look)paintV6Fighter(winnerArt,look,{stage:false,bare:true});});
  trimResult(o);
}).observe(get('result')??body,{attributes:true,attributeFilter:['hidden']});
/** Meta pills under the title (mode, round, time, badge) and the Elo bar read as rank to next rank, as in the mock. */
const resultLeave=document.querySelector<HTMLButtonElement>('#result .dialog-actions [data-home]');
resultLeave?.classList.add('v6-result-leave');
function trimResult(o:HTMLElement){
  const top=o.querySelector<HTMLElement>('.r-top');
  if(top&&resultTitle&&resultTitle.nextElementSibling!==top)resultTitle.after(top);
  const next=o.querySelector<HTMLElement>('#resultElo .r-next'),rank=o.querySelector('#resultElo .r-rank')?.textContent??'';
  if(next&&!next.dataset.v6){
    const i=SOLDIER_GRADES.findIndex(g=>g.displayLabel===rank||g.label===rank),up=i>=0?SOLDIER_GRADES[i+1]:undefined;
    const raw=next.textContent??'',left=raw.match(/^([\d.,]+) to current Elo cap$/)?.[1];
    const right=!up?'Top Rank':left?`${left} to ${up.displayLabel}`:/^At current Elo cap$/.test(raw)?`At ${up.displayLabel}`:raw;
    next.replaceChildren(el('span',undefined,rank),el('span',undefined,right));next.dataset.v6='1';
  }
  // A seated bout (Gauntlet) goes back to its own page, and its save line always shows.
  const seatLabel=body.dataset.seat?body.dataset.seatLabel:'';
  if(resultLeave){resultLeave.textContent=seatLabel?'Back':get('again')?.hidden?'Setup':'Leave';
    if(seatLabel)resultLeave.setAttribute('aria-label','Back to '+seatLabel);else resultLeave.removeAttribute('aria-label');}
  const note=get('rankResult');
  if(note&&seatLabel)note.hidden=false;
  else if(note){
    // Training progress stays in Stats; only a save badge (Not Saved, Save Conflict) shows here.
    const badge=note.dataset.saveBadge??'';
    note.replaceChildren(...(badge?[el('span','r-badge r-save-badge',badge)]:[]));note.hidden=!badge;
  }
}

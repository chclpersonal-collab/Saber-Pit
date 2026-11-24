/** v6 menu shell: the approved home grid, player card, Play screen and Pause column.
 *  It only drives the existing setup controls (select change events, preset clicks, form submit).
 *  No save, storage key or rating code is read for writing here. */
import {readArcadeCareer} from './arcade-career.js?v=4.01.1';
import {statsView} from './arcade-stats-page.js';
import {paintV6Scene,paintV6Fighter,type V6Scene} from './arcade-v6-scene.js';

const body=document.body;
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T|null;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,cls?:string,text?:string){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
const canvases=new Map<HTMLCanvasElement,V6Scene>();
const paintAll=()=>{for(const [c,s] of canvases)if(c.isConnected&&c.offsetParent!==null)paintV6Scene(c,s);};
function art(scene:V6Scene){const c=el('canvas','v6-art');c.setAttribute('aria-hidden','true');canvases.set(c,scene);return c;}

/* ---------- player card ---------- */
function playerCard(){
  const card=el('div','v6-player');card.setAttribute('aria-label','Your Arena record');
  const fill=()=>{
    const view=statsView(readArcadeCareer()),you=view?.you??view?.best??null;
    card.replaceChildren();
    const av=el('span','v6-avatar');av.setAttribute('aria-hidden','true');
    const who=el('span','v6-who');who.append(el('b',undefined,you?`${you.team===0?'Blue':'Pink'} ${you.slot+1}`:'New fighter'),el('small',undefined,view?`${view.mode} · round ${view.round}`:'No rated rounds yet'));
    const stat=(v:string,k:string,cls='')=>{const s=el('span','v6-stat '+cls);s.append(el('b',undefined,v),el('small',undefined,k));return s;};
    // K/D and Win stay blank until the round record travels with Saves across devices.
    card.append(av,who,stat(you?.rank?.split(' ')[0]??'—','Rank','v6-rank'),stat(you?.elo!=null?String(Math.round(you.elo)):'—','Elo'),stat('—','K/D'),stat('—','Win'));
  };
  fill();return {card,fill};
}

/* ---------- home grid ---------- */
const home=el('section','v6-home');home.id='v6Home';home.setAttribute('aria-label','Play');
const {card:homeCard,fill:fillCard}=playerCard();
function tile(opts:{title:string;sub:string;scene:V6Scene;cta:string;href?:string;onPlay?:()=>void;tag?:string;big?:boolean}){
  const t=el('article','v6-card'+(opts.big?' v6-card-big':''));
  t.append(art(opts.scene));
  const txt=el('div','v6-card-text');
  if(opts.tag)txt.append(el('span','v6-tag',opts.tag));
  txt.append(el('h2',undefined,opts.title),el('p',undefined,opts.sub));
  const row=el('div','v6-card-actions');
  if(opts.href){const a=el('a','v6-cta',opts.cta);a.href=opts.href;row.append(a);}
  else{const b=el('button','v6-cta',opts.cta);b.type='button';b.addEventListener('click',()=>opts.onPlay?.());row.append(b);}
  txt.append(row);t.append(txt);return {t,row};
}
const arena=tile({title:'Arena',sub:'Duel · Elimination',scene:'duel',cta:'Play',tag:'RANKED',big:true,onPlay:()=>showPlay()});
const modesBtn=el('button','v6-cta v6-cta-2','Modes');modesBtn.type='button';modesBtn.addEventListener('click',()=>showPlay());arena.row.append(modesBtn);
const grid=el('div','v6-grid');
grid.append(arena.t,
  tile({title:'Three Fronts',sub:'Lanes, towers, pushes',scene:'fronts',cta:'Play',tag:'NEW',href:'./moba.html'}).t,
  tile({title:'Tournament',sub:'Bracket',scene:'bracket',cta:'Open',href:'./tournament.html'}).t,
  tile({title:'Gauntlet',sub:'Solo climb',scene:'solo',cta:'Climb',href:'./gauntlet.html'}).t,
  tile({title:'Heroes',sub:'Saved fighters',scene:'heroes',cta:'Manage',href:'./tournament.html'}).t);
const more=el('nav','v6-more');more.setAttribute('aria-label','More');
for(const [label,href] of [['Style Lab','./style-lab.html'],['Idle RPG','./idle-rpg.html'],['Saves','./backup.html'],['Classic','./classic.html']] as const){const a=el('a',undefined,label);a.href=href;more.append(a);}
home.append(grid,more);
const entry=get('entry');entry?.before(home);
get('frameRate')?.before(homeCard);

/* ---------- Play screen (restyled setup) ---------- */
const lobby=get<HTMLFormElement>('lobby');
const play=el('div','v6-play');play.id='v6Play';
const head=el('div','v6-play-head');const back=el('button','v6-back');back.type='button';back.setAttribute('aria-label','Back to home');back.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
back.addEventListener('click',()=>showHome());head.append(back,el('h2',undefined,'Play'));
const list=el('div','v6-modes');list.setAttribute('role','list');
const MODE_ROWS:[string,string,string,V6Scene][]=[['duel','Duel','1v1 · You fight','duel'],['squad','Squads','3v3 · You fight','squad'],['watch','Showdown','5v5 · Watch','squad'],['master','Master trial','1v15 · Watch','solo'],['hero','Watch a Hero','Saved Hero · Watch','heroes']];
const presetSource=(p:string)=>p==='hero'?get<HTMLButtonElement>('watchHero'):document.querySelector<HTMLButtonElement>(`[data-preset="${p}"]`);
const modeButtons:HTMLButtonElement[]=[];
for(const [preset,name,sub,scene] of MODE_ROWS){
  const src=presetSource(preset);if(!src)continue;
  const b=el('button','v6-mode');b.type='button';b.dataset.v6Preset=preset;b.setAttribute('role','listitem');
  const thumb=el('span','v6-thumb');thumb.dataset.scene=scene;
  const tx=el('span','v6-mode-text');tx.append(el('b',undefined,name),el('small',undefined,sub));
  b.append(thumb,tx);b.addEventListener('click',()=>{src.click();syncModes();});
  modeButtons.push(b);list.append(b);
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
chipRow('Play as','participation',[['play','Fighter'],['command','Commander'],['watch','Watch']]);
chipRow('Round','duration',[['45','45'],['90','90'],['150','150']]);
const go=el('div','v6-go');
const playBtn=el('button','v6-cta v6-play-btn','Play');playBtn.type='submit';playBtn.setAttribute('form','lobby');playBtn.setAttribute('aria-describedby','arenaRatingStatus');
const loadoutBtn=el('button','v6-cta v6-cta-2','Loadout');loadoutBtn.type='button';
loadoutBtn.addEventListener('click',()=>showLoadout());
go.append(playBtn,loadoutBtn);
const stageText=el('div','v6-stage-text');stageText.append(stageTitle,chips,go);
stage.append(stageArt,stageText);
play.append(head,list,stage);
lobby?.prepend(play);
const custom=get<HTMLDetailsElement>('customizeMatch');const customSum=custom?.querySelector('summary');if(customSum)customSum.textContent='More options';
function syncModes(){
  let active:HTMLButtonElement|undefined;
  for(const b of modeButtons){const src=presetSource(b.dataset.v6Preset??'');const on=src?.getAttribute('aria-pressed')==='true';b.setAttribute('aria-current',String(on));b.disabled=!!src?.disabled;if(on)active=b;}
  const row=MODE_ROWS.find(r=>r[0]===active?.dataset.v6Preset);
  stageTitle.textContent=row?row[1]:'Custom match';
  const scene=row?row[3]:'squad';if(canvases.get(stageArt)!==scene){canvases.set(stageArt,scene);if(stageArt.offsetParent)paintV6Scene(stageArt,scene);}
  syncChips();
}
lobby?.addEventListener('change',()=>queueMicrotask(syncModes));
lobby?.addEventListener('click',()=>setTimeout(syncModes,0));

/* ---------- views ---------- */
function setScreen(s:'home'|'play'|'loadout'){body.dataset.v6=s;requestAnimationFrame(()=>{paintAll();syncModes();});}
function showHome(){setScreen('home');fillCard();window.scrollTo(0,0);}
function showPlay(){setScreen('play');window.scrollTo(0,0);}
for(const a of document.querySelectorAll<HTMLAnchorElement>('a.launch-setup[href="#entry"]'))a.addEventListener('click',e=>{e.preventDefault();showPlay();});
let lastView=body.dataset.view;
/* HUD: the player's own Elo beside their name, as in the mock. */
const hudElo=el('span','v6-hud-elo');hudElo.setAttribute('aria-label','Your Elo');
function fillHudElo(){
  const view=statsView(readArcadeCareer()),you=view?.you??view?.best??null;
  hudElo.textContent=you?.elo!=null?String(Math.round(you.elo)):'';
  hudElo.hidden=!hudElo.textContent;
  const name=get('blueName');if(name&&hudElo.previousElementSibling!==name)name.after(hudElo);
}
new MutationObserver(()=>{const v=body.dataset.view;if(v===lastView)return;lastView=v;if(v==='menu'){fillCard();requestAnimationFrame(paintAll);}if(v==='game')fillHudElo();}).observe(body,{attributes:true,attributeFilter:['data-view']});
const roundEl=get('round');if(roundEl)new MutationObserver(fillHudElo).observe(roundEl,{childList:true,characterData:true,subtree:true});
let resizeTimer=0;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=window.setTimeout(paintAll,120);});
setScreen(location.hash==='#entry'?'play':'home');

/* ---------- pause column ---------- */
const pauseActions=document.querySelector('#pauseOverlay .dialog-actions');
const leave=pauseActions?.querySelector<HTMLButtonElement>('[data-home]');
if(leave){leave.textContent='Leave match';leave.classList.add('v6-danger');pauseActions?.append(leave);}
const keys=get('keysOpen');if(keys)keys.textContent='Controls';
const pauseLine=el('p','v6-pause-line');
document.querySelector('#pauseOverlay .dialog')?.append(pauseLine);
new MutationObserver(()=>{const o=get('pauseOverlay');if(!o||o.hidden)return;
  const round=get('round')?.textContent??'',bk=get('blueCount')?.textContent??'',rk=get('blueRank')?.textContent??'';
  pauseLine.textContent=[round,rk&&`Rank ${rk}`,bk&&`Standing ${bk}`].filter(Boolean).join(' · ');
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
function chipsFrom(selectId:string,pane:HTMLElement,label:string){
  const sel=get<HTMLSelectElement>(selectId);pane.replaceChildren();if(!sel){pane.append(el('p','v6-empty','Not available for this match.'));return;}
  const g=el('fieldset','v6-chip-row v6-chip-wrap');g.append(el('legend',undefined,label));
  for(const o of sel.options){const b=el('button','v6-chip',o.text);b.type='button';b.dataset.value=o.value;b.disabled=o.disabled||sel.disabled;b.setAttribute('aria-pressed',String(o.value===sel.value));
    b.addEventListener('click',()=>{sel.value=o.value;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));chipsFrom(selectId,pane,label);});g.append(b);}
  pane.append(g);
}
const LOOK_CARDS:[string,string][]=[['woman','Woman'],['femboy','Femboy'],['rabbit','Rabbit']];
function lookPane(){
  const pane=paneEls[0];const sel=get<HTMLSelectElement>('bodyStyle');if(!pane)return;pane.replaceChildren();
  const row=el('div','v6-looks');
  for(const [v,name] of LOOK_CARDS){const b=el('button','v6-look');b.type='button';b.setAttribute('aria-pressed',String(sel?.value===v));b.disabled=!sel||sel.disabled;
    const cv=el('canvas','v6-look-art');cv.setAttribute('aria-hidden','true');b.append(cv,el('b',undefined,name));
    b.addEventListener('click',()=>{if(!sel)return;sel.value=v;sel.dispatchEvent(new Event('change',{bubbles:true}));lookPane();paintHero();});row.append(b);}
  pane.append(row);requestAnimationFrame(()=>{row.querySelectorAll<HTMLButtonElement>('.v6-look').forEach((b,i)=>{const cv=b.querySelector('canvas');const lk=LOOK_CARDS[i];if(cv&&lk)paintV6Fighter(cv,lk[0],{stage:false});});});
}
function paintHero(){const body=get<HTMLSelectElement>('bodyStyle')?.value??'woman';const form=get<HTMLSelectElement>('style');heroName.textContent=form?.selectedOptions[0]?.text??'';if(hero.offsetParent)paintV6Fighter(hero,body);}
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
new MutationObserver(()=>{const o=get('result');if(!o||o.hidden||!resultTitle)return;
  const t=resultTitle.textContent;if(t==='Round won')resultTitle.textContent='Victory';else if(t==='Round lost')resultTitle.textContent='Defeat';
}).observe(get('result')??body,{attributes:true,attributeFilter:['hidden']});

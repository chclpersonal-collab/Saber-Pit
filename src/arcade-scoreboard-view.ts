import type {ScoreboardModel} from './arcade-scoreboard.js';

/**
 * Scoreboard panel. Hold the bound key to peek; tap Stats to pin it open on touch or with a mouse.
 * It never pauses the match and never takes the canvas's input. Markup lives in index.html.
 */
type Opened='hold'|'toggle'|null;
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string|number,cl?:string)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);
  if(cl)node.className=cl;
  return node;
};

export function renderArenaScoreboard(root:HTMLElement,model:ScoreboardModel){
  const q=(id:string)=>root.querySelector<HTMLElement>('#'+id);
  const blue=q('scoreboardBlue'),pink=q('scoreboardPink'),meta=q('scoreboardMeta'),badge=q('scoreboardBadge'),note=q('scoreboardNote'),body=q('scoreboardRows'),round=q('scoreboardRound');
  if(blue)blue.textContent=String(model.score[0]);
  if(pink)pink.textContent=String(model.score[1]);
  if(meta)meta.textContent=model.meta;
  if(round)round.textContent=model.round;
  if(badge){badge.textContent=model.badge;badge.dataset.rated=String(model.rated);}
  if(note)note.textContent=model.note;
  if(!body)return;
  const rows:HTMLTableRowElement[]=[];
  for(const team of model.teams){
    const head=el('tr',undefined,'sb-team '+team.side), cell=el('th',team.name);
    cell.colSpan=5;cell.scope='rowgroup';cell.append(el('small',team.alive+'/'+team.total+' standing'));
    head.append(cell);rows.push(head);
    for(const r of team.rows){
      const row=el('tr',undefined,[r.me?'me':'',r.ko?'ko':''].filter(Boolean).join(' ')||undefined);
      const name=el('th');name.scope='row';
      name.append(el('span',undefined,'sb-dot '+team.side),el('span',r.rank,'sb-rank'),el('span',r.name,'sb-name'));
      if(r.me)name.append(el('span',' (you)','sr'));
      if(r.ko)name.append(el('span',' (down)','sr'));
      row.append(name,el('td',r.k),el('td',r.d),el('td',r.dmg.toLocaleString('en-US')),el('td',r.elo));
      rows.push(row);
    }
  }
  body.replaceChildren(...rows);
}

export function mountArenaScoreboard(options:{
  root:HTMLElement|null;toggle:HTMLButtonElement|null;details:HTMLButtonElement|null;close:HTMLButtonElement|null;
  model:()=>ScoreboardModel|null;onDetails:()=>void;canOpen:()=>boolean;
}){
  const {root,toggle,details,close}=options;
  let opened:Opened=null, returnTo:HTMLElement|null=null, last='';
  const sync=()=>{
    if(!root)return;
    root.hidden=!opened;root.dataset.opened=opened??'';
    // The panel sits inside the arena's stacking context; lift that context while open so phone controls stay underneath.
    if(opened)document.body.dataset.scoreboard=opened;else delete document.body.dataset.scoreboard;
    toggle?.setAttribute('aria-expanded',String(opened==='toggle'));
  };
  function refresh(){
    if(!root||!opened)return;
    const model=options.model();if(!model)return hide(false);
    const key=JSON.stringify(model);if(key===last)return;
    last=key;renderArenaScoreboard(root,model);
  }
  function show(how:Exclude<Opened,null>){
    if(!root||!options.canOpen())return;
    if(opened==='toggle'&&how==='hold')return;
    if(!opened){
      const active=document.activeElement;
      returnTo=active instanceof HTMLElement&&active!==document.body?active:null;
    }
    opened=how;last='';sync();refresh();
  }
  /** Close; put focus back where it was only if focus was inside the panel. */
  function hide(restore=true){
    if(!opened)return;
    const inside=Boolean(root&&document.activeElement&&root.contains(document.activeElement));
    opened=null;sync();
    if(restore&&inside)(returnTo&&returnTo.isConnected?returnTo:toggle)?.focus({preventScroll:true});
    returnTo=null;
  }
  toggle?.addEventListener('click',()=>{if(opened==='toggle')hide();else show('toggle');});
  close?.addEventListener('click',()=>hide());
  details?.addEventListener('click',()=>{hide(false);options.onDetails();});
  root?.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened==='toggle'){e.preventDefault();e.stopPropagation();hide();}});
  sync();
  return {
    /** Key down shows, key up hides. A panel pinned open by tap ignores the key. */
    hold(down:boolean){if(down)show('hold');else if(opened==='hold')hide();},
    toggle(){if(opened==='toggle')hide();else show('toggle');},
    close(restore=false){hide(restore);},
    refresh,
    get opened(){return opened;},
  };
}

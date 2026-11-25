import type {ScoreboardModel} from './arcade-scoreboard.js';

/**
 * Scoreboard panel. Hold the bound key to peek; tap Stats to pin it open on touch or with a mouse.
 * It never pauses the match; pinning makes background controls inactive. Markup lives in index.html.
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
  if(meta)meta.replaceChildren(...model.meta.flatMap((t,i)=>i?[' ',el('span',t,'v6-meta')]:[el('span',t,'v6-meta')]));
  if(round)round.textContent=model.round;
  if(badge){badge.textContent=model.badge;badge.dataset.rated=String(model.rated);}
  if(note){note.textContent=model.note;note.hidden=!model.note;}
  if(!body)return;
  const rows:HTMLTableRowElement[]=[];
  for(const team of model.teams){
    const head=el('tr',undefined,'sb-team '+team.side), cell=el('th',team.name);
    cell.colSpan=5;cell.scope='rowgroup';const alive=el('small',team.alive+'/'+team.total);alive.setAttribute('aria-label',team.alive+' of '+team.total+' standing');cell.append(alive);
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
  root:HTMLDialogElement|null;toggle:HTMLButtonElement|null;details:HTMLButtonElement|null;close:HTMLButtonElement|null;
  model:()=>ScoreboardModel|null;onDetails:()=>void;canOpen:()=>boolean;onPin?:()=>void;onUnavailable?:()=>void;
}){
  const {root,toggle,details,close}=options;
  let opened:Opened=null, returnTo:HTMLElement|null=null, last='',lastRefresh=-Infinity;
  const sync=()=>{
    if(!root)return;
    root.hidden=!opened;root.dataset.opened=opened??'';
    // The panel sits inside the arena's stacking context; lift that context while open so phone controls stay underneath.
    if(opened)document.body.dataset.scoreboard=opened;else delete document.body.dataset.scoreboard;
    toggle?.setAttribute('aria-expanded',String(opened==='toggle'));
  };
  function refresh(){
    if(!root||!opened)return;
    const now=performance.now();if(now-lastRefresh<120)return;lastRefresh=now;
    const model=options.model();if(!model)return hide(false);
    const key=JSON.stringify(model);if(key===last)return;
    last=key;renderArenaScoreboard(root,model);
  }
  function show(how:Exclude<Opened,null>){
    if(!root||!options.canOpen()||opened===how||opened==='toggle')return;
    if(how==='toggle'){
      const active=document.activeElement;
      returnTo=active instanceof HTMLElement&&active!==document.body?active:toggle;
      root.removeAttribute('open'); // The keyboard peek does not move focus.
      opened=how;sync();options.onPin?.();
      root.showModal();close?.focus({preventScroll:true});
    }else{
      opened=how;sync();root.setAttribute('open','');
    }
    last='';lastRefresh=-Infinity;refresh();
  }
  function hide(restore=true){
    if(!opened)return;
    const wasModal=opened==='toggle';opened=null;
    // Use the native close path for a pinned board so the background is interactive again.
    if(wasModal&&root?.open)root.close();
    else root?.removeAttribute('open');
    sync();
    if(restore&&wasModal)(returnTo?.isConnected?returnTo:toggle)?.focus({preventScroll:true});
    returnTo=null;
  }
  toggle?.addEventListener('click',()=>{
    if(opened==='toggle')hide();
    else if(options.canOpen())show('toggle');
    else options.onUnavailable?.();
  });
  close?.addEventListener('click',()=>hide());
  details?.addEventListener('click',()=>{hide(false);options.onDetails();});
  root?.addEventListener('cancel',e=>{if(opened==='toggle'){e.preventDefault();hide();}});
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

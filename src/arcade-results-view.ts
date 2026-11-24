import type {RoundResultModel} from './arcade-results.js';

/** Fills the result card's stat line and Elo block. Markup lives in index.html. */
export function renderRoundResult(root:HTMLElement,model:RoundResultModel){
  const q=(id:string)=>root.querySelector<HTMLElement>('#'+id);
  const badge=q('resultBadge'),eyebrow=q('resultRound'),who=q('resultWho'),tiles=q('resultTiles'),hits=q('resultHits'),elo=q('resultElo');
  root.dataset.rated=String(model.badge==='RATED');
  if(eyebrow)eyebrow.textContent=model.eyebrow;
  if(badge){badge.textContent=model.badge;badge.dataset.rated=String(model.badge==='RATED');}
  if(who){who.textContent=model.who??'';who.hidden=!model.who;}
  if(tiles)tiles.replaceChildren(...model.tiles.map(t=>{
    const box=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=t.label;dd.textContent=t.value;box.append(dd,dt);return box;
  }));
  if(hits)hits.textContent=model.hits;
  if(!elo)return;
  elo.dataset.kind=model.elo.kind;
  if(model.elo.kind!=='saved'){
    const note=document.createElement('p');note.className='r-elo-note';note.textContent=model.elo.text;
    elo.replaceChildren(note);return;
  }
  const e=model.elo;
  const head=document.createElement('p');head.className='r-elo-head';
  const rank=document.createElement('b');rank.className='r-rank';rank.textContent=e.rank;
  const rating=document.createElement('b');rating.className='r-rating';rating.textContent=e.rating;
  const unit=document.createElement('span');unit.className='r-unit';unit.textContent='Elo';
  const delta=document.createElement('b');delta.className='r-delta';delta.dataset.up=String(e.up);delta.dataset.flat=String(e.delta.startsWith('±'));delta.textContent=e.delta;
  const saved=document.createElement('span');saved.className='r-saved';saved.textContent='✓ saved';
  if(e.who){const who=document.createElement('span');who.className='r-unit';who.textContent=e.who;head.append(who);}
  head.append(rank,rating,unit,delta,saved);
  const bar=document.createElement('div');bar.className='r-bar';bar.setAttribute('aria-hidden','true');
  bar.style.setProperty('--pct',(e.pct*100).toFixed(1)+'%');bar.style.setProperty('--gain',(e.gainPct*100).toFixed(1)+'%');
  const next=document.createElement('p');next.className='r-next';next.textContent=e.toNext;
  elo.replaceChildren(head,bar,next);
}

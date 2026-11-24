/** Stats page: read-only view of the saved Arena run. Nothing here writes a save. */
import {readArcadeCareer} from './arcade-career.js?v=4.01.1';
import {arenaNormalRating} from './arcade-normal-elo.js';
import {gradeForMerit} from './progression.js?v=1.4.0';

export type StatsFighter={id:string;team:0|1;slot:number;elo:number;rated:boolean;rank:string};
export type StatsView={
  round:number;mode:string;you:StatsFighter|null;teams:[StatsFighter[],StatsFighter[]];
  best:StatsFighter|null;ratedCount:number;
}|null;

const MODE_NAMES:Record<string,string>={duel:'Duel',squad:'Squad',watch:'Showdown'};

export function statsView(save:ReturnType<typeof readArcadeCareer>):StatsView {
  if(!save)return null;
  const ids=new Set([...Object.keys(save.careers),...Object.keys(save.arenaRatings)]);
  const fighters=[...ids].map(id=>{
    const [team,slot]=id.split('-').map(Number) as [number,number];
    const rated=Object.hasOwn(save.arenaRatings,id);
    return {id,team:team as 0|1,slot,rated,elo:arenaNormalRating(save.arenaRatings[id]),
      rank:gradeForMerit(save.careers[id]?.merit??0).displayLabel};
  }).sort((a,b)=>a.team-b.team||a.slot-b.slot);
  const teams:[StatsFighter[],StatsFighter[]]=[fighters.filter(f=>f.team===0),fighters.filter(f=>f.team===1)];
  const rated=fighters.filter(f=>f.rated);
  const best=rated.reduce<StatsFighter|null>((top,f)=>!top||f.elo>top.elo?f:top,null);
  const you=save.mode==='watch'?null:fighters.find(f=>f.id==='0-0')??null;
  return {round:save.round??1,mode:MODE_NAMES[save.mode??'']??'Arena',you,teams,best,ratedCount:rated.length};
}

const fmt=(n:number)=>Number.isInteger(n)?String(n):n.toFixed(1);
const label=(f:StatsFighter)=>`${f.team===0?'Blue':'Red'} ${f.slot+1}`;

function el<K extends keyof HTMLElementTagNameMap>(tag:K,cls?:string,text?:string){
  const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;
}

export function renderStats(root:HTMLElement,view:StatsView){
  root.replaceChildren();
  if(!view){
    const empty=el('div','st-empty');
    empty.append(el('b',undefined,'No saved run yet'),el('span',undefined,'Play a match and your rank and Elo show up here.'));
    root.append(empty);return;
  }
  const head=el('section','st-card st-hero');head.setAttribute('aria-label','Your run');
  const who=el('div','st-who');
  who.append(el('b',undefined,view.you?'You · '+label(view.you):view.mode),el('span',undefined,`${view.mode} · round ${view.round}`));
  const tiles=el('dl','st-tiles');
  const tile=(name:string,value:string,cls='')=>{const d=el('div','st-tile '+cls);d.append(el('dd',undefined,value),el('dt',undefined,name));tiles.append(d);};
  const main=view.you??view.best;
  if(main){tile('Rank',main.rank,'st-rank');tile('Elo',main.rated?fmt(main.elo):'Unrated');}
  tile('Rated fighters',String(view.ratedCount));
  if(view.best&&view.best!==main)tile('Top Elo',fmt(view.best.elo)+' · '+label(view.best));
  head.append(who,tiles);root.append(head);

  const max=Math.max(1,...view.teams.flat().map(f=>f.elo));
  const board=el('div','st-teams');
  view.teams.forEach((team,i)=>{
    if(!team.length)return;
    const card=el('section','st-card st-team st-team-'+(i?'red':'blue'));
    const h=el('h3',undefined,i?'Red team':'Blue team');const id='stTeam'+i;h.id=id;card.setAttribute('aria-labelledby',id);
    const list=el('ol','st-list');
    for(const f of team){
      const row=el('li','st-row'+(view.you?.id===f.id?' st-you':''));
      const name=el('span','st-name',label(f)+(view.you?.id===f.id?' (you)':''));
      const rank=el('span','st-badge',f.rank);
      const bar=el('span','st-bar');bar.setAttribute('aria-hidden','true');
      const fill=el('i');fill.style.width=f.rated?Math.max(4,Math.round(f.elo/max*100))+'%':'0%';bar.append(fill);
      const elo=el('span','st-elo',f.rated?fmt(f.elo):'—');elo.title=f.rated?'Arena Elo':'No rated rounds yet';
      row.append(name,rank,bar,elo);list.append(row);
    }
    card.append(h,list);board.append(card);
  });
  root.append(board);
}

export function mountStatsPage(open:HTMLElement[]){
  const dialog=document.getElementById('statsPage') as HTMLDialogElement|null;
  const body=document.getElementById('statsPageBody');
  if(!dialog||!body)return;
  let back:HTMLElement|null=null;
  const show=(from:HTMLElement)=>{back=from;renderStats(body,statsView(readArcadeCareer()));dialog.showModal();};
  for(const b of open)b.addEventListener('click',e=>{e.preventDefault();show(b);});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>back?.focus({preventScroll:true}));
}

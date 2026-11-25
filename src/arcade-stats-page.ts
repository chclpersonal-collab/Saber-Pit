/** Stats page: read-only view of the saved Arena run. Nothing here writes a save. */
import {readArcadeCareer} from './arcade-career.js?v=4.01.1';
import {gradeForMerit} from './progression.js?v=1.4.0';

export type StatsFighter={id:string;team:0|1;slot:number;elo:number|null;rated:boolean;rank:string|null};
export type StatsView={
  round:number;mode:string;you:StatsFighter|null;teams:[StatsFighter[],StatsFighter[]];
  best:StatsFighter|null;ratedCount:number;
}|null;

const MODE_NAMES:Record<string,string>={duel:'Duel',squad:'Squad',watch:'Showdown',command:'Commander'};

export function statsView(save:ReturnType<typeof readArcadeCareer>):StatsView {
  if(!save)return null;
  const ids=new Set([...Object.keys(save.careers),...Object.keys(save.arenaRatings)]);
  const fighters=[...ids].map(id=>{
    const [team,slot]=id.split('-').map(Number) as [number,number];
    const elo=Object.hasOwn(save.arenaRatings,id)?save.arenaRatings[id]:null;
    const career=save.careers[id];
    return {id,team:team as 0|1,slot,rated:elo!==null,elo,
      rank:career?gradeForMerit(career.merit).displayLabel:null};
  }).sort((a,b)=>a.team-b.team||a.slot-b.slot);
  const teams:[StatsFighter[],StatsFighter[]]=[fighters.filter(f=>f.team===0),fighters.filter(f=>f.team===1)];
  const rated=fighters.filter(f=>f.rated);
  const best=rated.reduce<StatsFighter|null>((top,f)=>!top||(f.elo??0)>(top.elo??0)?f:top,null);
  const setup='setup' in save?save.setup:null;
  const selected=setup&&typeof setup==='object'&&'playerSlot' in setup?setup.playerSlot:undefined;
  const playerSlot=typeof selected==='number'&&Number.isInteger(selected)&&selected>=0&&selected<=23?selected:0;
  const you=save.mode==='duel'||save.mode==='squad'?fighters.find(f=>f.id==='0-'+playerSlot)??null:null;
  return {round:save.round??1,mode:MODE_NAMES[save.mode??'']??'Arena',you,teams,best,ratedCount:rated.length};
}

const fmt=(n:number|null)=>n===null?'—':Number.isInteger(n)?String(n):n.toFixed(1);
const label=(f:StatsFighter)=>`${f.team===0?'Blue':'Pink'} ${f.slot+1}`;

function el<K extends keyof HTMLElementTagNameMap>(tag:K,cls?:string,text?:string){
  const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;
}

export function renderStats(root:HTMLElement,view:StatsView){
  root.replaceChildren();
  if(!view){
    const empty=el('div','st-empty');
    empty.append(el('b',undefined,'No Saved Run'));
    root.append(empty);return;
  }
  const head=el('section','st-card st-hero');head.setAttribute('aria-label','Your Run');
  const who=el('div','st-who');
  const meta=el('span');for(const part of view.you?[view.mode,'Round '+view.round]:['Round '+view.round])meta.append(meta.childNodes.length?' ':'',el('span','v6-meta',part));
  who.append(el('b',undefined,view.you?label(view.you):view.mode),meta);
  const tiles=el('dl','st-tiles');
  const tile=(name:string,value:string,cls='')=>{const d=el('div','st-tile '+cls);d.append(el('dt',undefined,name),el('dd',undefined,value));tiles.append(d);};
  const main=view.you??view.best;
  if(main){tile(view.you?'Rank':'Top Rank',main.rank??'—','st-rank');tile(view.you?'Elo':'Top Elo',fmt(main.elo));}
  tile('Rated',String(view.ratedCount));
  if(view.best&&view.best!==main)tile('Best Elo',fmt(view.best.elo));
  head.append(who,tiles);root.append(head);

  const board=el('div','st-teams');
  view.teams.forEach((team,i)=>{
    if(!team.length)return;
    const card=el('section','st-card st-team st-team-'+(i?'pink':'blue'));
    const h=el('h3',undefined,i?'Pink':'Blue');const id='stTeam'+i;h.id=id;card.setAttribute('aria-labelledby',id);
    const list=el('ol','st-list');
    for(const f of team){
      const row=el('li','st-row'+(view.you?.id===f.id?' st-you':''));
      const name=el('span','st-name',label(f)+(view.you?.id===f.id?' (You)':''));
      const rank=el('span','st-badge',f.rank??'—');
      rank.setAttribute('aria-label',f.rank?'Rank '+f.rank:'No Rank');
      const elo=el('span','st-elo',fmt(f.elo));
      elo.setAttribute('aria-label',f.rated?'Elo '+fmt(f.elo):'No Elo');
      row.append(name,rank,elo);list.append(row);
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
  const show=(from:HTMLElement)=>{if(dialog.open)return;back=from;renderStats(body,statsView(readArcadeCareer()));dialog.showModal();};
  for(const b of open)b.addEventListener('click',e=>{e.preventDefault();show(b);});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{back?.focus({preventScroll:true});back=null;});
  return dialog;
}

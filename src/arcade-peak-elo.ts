import {eloFloor} from './arcade-elo.js?v=2.18.5';
/** Peaks are archival, not seed ratings. A null season means we know the
 * saved rating, but lack the earlier measurement that established it. */
type Peak={id:string;name:string;peakElo:number;peakSeason:number|null};
type PeakState={peaks?:Record<string,Peak>;season?:number;active?:{season?:number}|null};
type PeakActor={id:string;name?:unknown;elo?:number;rank?:unknown};
const MAX_PEAKS=150;
const clampInt=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isInteger(n)?Math.max(min,Math.min(max,n)):min;
const safeName=(name:unknown)=>typeof name==='string'?name.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,72):'';
const validRating=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const compare=(a:Peak,b:Peak)=>b.peakElo-a.peakElo||(a.peakSeason??Infinity)-(b.peakSeason??Infinity)
  ||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
export function peakLeaderboard(state:PeakState|null|undefined,limit=10){
  return Object.values(state?.peaks??{}).sort(compare).slice(0,clampInt(limit,0,10))
    .map((row,i)=>({id:row.id,name:row.name,peakElo:row.peakElo,peakSeason:row.peakSeason,place:i+1}));
}
export function readEloPeaks(raw:unknown,maxSeason:number,validId:(candidate:unknown)=>string|null|undefined){
  const rows:Peak[]=[];
  for(const row of Object.values(raw&&typeof raw==='object'?raw:{}).slice(0,MAX_PEAKS*2)){
    const candidate=row as Partial<Peak>|null|undefined;
    const id=validId(candidate?.id), name=safeName(candidate?.name), peakElo=candidate?.peakElo;
    if(!id||!name||!validRating(peakElo))continue;
    const peakSeason=typeof candidate?.peakSeason==='number'&&Number.isInteger(candidate.peakSeason)&&candidate.peakSeason>0&&candidate.peakSeason<=maxSeason?candidate.peakSeason:null;
    rows.push({id,name,peakElo,peakSeason});
  }
  const result:Record<string,Peak>={};
  for(const row of rows.sort(compare).slice(0,MAX_PEAKS))if(!Object.hasOwn(result,row.id))result[row.id]=row;
  return result;
}
function remember(state:PeakState,actor:PeakActor|null|undefined,rating:unknown,season:number|null){
  if(!actor?.id||!safeName(actor.name)||!validRating(rating))return;
  const peaks=state.peaks??(state.peaks={}), prev=Object.hasOwn(peaks,actor.id)?peaks[actor.id]:null;
  if(prev&&prev.peakElo>=rating)return;
  peaks[actor.id]={id:actor.id,name:safeName(actor.name),peakElo:rating,peakSeason:season};
  if(Object.keys(peaks).length>MAX_PEAKS){
    state.peaks=Object.fromEntries(Object.values(peaks).sort(compare).slice(0,MAX_PEAKS).map(p=>[p.id,p]));
  }
}
export function seedKnownEloPeak(state:PeakState,actor:PeakActor|null|undefined,rating:unknown=actor?.elo){
  remember(state,actor,rating,null);
}
export function recordRatedEloPeak(state:PeakState,actor:PeakActor|null|undefined,before:number){
  if(validRating(before)&&before>eloFloor(actor?.rank))seedKnownEloPeak(state,actor,before);
  const season=state.active?.season??state.season;
  if(typeof actor?.elo==='number'&&actor.elo>before&&typeof season==='number'&&Number.isSafeInteger(season)&&season>0)remember(state,actor,actor.elo,season);
}

import {eloFloor} from './arcade-elo.js?v=2.18.5';
/** Peaks are archival, not seed ratings. A null season means we know the
 * saved rating, but lack the earlier measurement that established it. */
const MAX_PEAKS=150;
const clampInt=(n,min,max)=>Number.isInteger(n)?Math.max(min,Math.min(max,n)):min;
const safeName=name=>typeof name==='string'?name.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,72):'';
const validRating=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const compare=(a,b)=>b.peakElo-a.peakElo||(a.peakSeason??Infinity)-(b.peakSeason??Infinity)
  ||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
export function peakLeaderboard(state,limit=10){
  return Object.values(state?.peaks??{}).sort(compare).slice(0,clampInt(limit,0,10))
    .map((row,i)=>({id:row.id,name:row.name,peakElo:row.peakElo,peakSeason:row.peakSeason,place:i+1}));
}
export function readEloPeaks(raw,maxSeason,validId){
  const rows=[];
  for(const row of Object.values(raw&&typeof raw==='object'?raw:{}).slice(0,MAX_PEAKS*2)){
    const id=validId(row?.id), name=safeName(row?.name), peakElo=row?.peakElo;
    if(!id||!name||!validRating(peakElo))continue;
    const peakSeason=Number.isInteger(row.peakSeason)&&row.peakSeason>0&&row.peakSeason<=maxSeason?row.peakSeason:null;
    rows.push({id,name,peakElo,peakSeason});
  }
  const result={};
  for(const row of rows.sort(compare).slice(0,MAX_PEAKS))if(!Object.hasOwn(result,row.id))result[row.id]=row;
  return result;
}
function remember(state,actor,rating,season){
  if(!actor?.id||!safeName(actor.name)||!validRating(rating))return;
  const peaks=state.peaks??(state.peaks={}), prev=Object.hasOwn(peaks,actor.id)?peaks[actor.id]:null;
  if(prev?.peakElo>=rating)return;
  peaks[actor.id]={id:actor.id,name:safeName(actor.name),peakElo:rating,peakSeason:season};
  if(Object.keys(peaks).length>MAX_PEAKS){
    state.peaks=Object.fromEntries(Object.values(peaks).sort(compare).slice(0,MAX_PEAKS).map(p=>[p.id,p]));
  }
}
export function seedKnownEloPeak(state,actor,rating=actor?.elo){
  remember(state,actor,rating,null);
}
export function recordRatedEloPeak(state,actor,before){
  if(validRating(before)&&before>eloFloor(actor?.rank))seedKnownEloPeak(state,actor,before);
  const season=state.active?.season??state.season;
  if(actor?.elo>before&&Number.isSafeInteger(season)&&season>0)remember(state,actor,actor.elo,season);
}

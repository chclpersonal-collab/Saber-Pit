/**
 * End-of-round result model. Pure: takes numbers the round already produced and the save
 * outcome, and returns what the result card shows. An Elo change appears only once it is saved.
 */
export type RoundSaveOutcome='saved'|'conflict'|'session-only'|'unavailable'|'untracked';
export type RoundLine={kills:unknown;deaths:unknown;damage:unknown;parries:unknown;saberHits:unknown;saberSwings:unknown};
/** cap is the current Elo cap for this rank; Elo never promotes the training rank. */
export type RoundElo={who?:string|null;rank:string;ratingBefore:unknown;ratingAfter:unknown;delta:unknown;floor:number;cap:unknown};
export type RoundResultInput={
  mode:string;teamSizes:readonly number[];round:number;seconds:number;rated:boolean;save:RoundSaveOutcome;
  /** Whose line this is: the player's fighter, or a side's total when watching. */
  who:string|null;line:RoundLine;elo?:RoundElo|null;
};
/** Unsaved and unrated rounds carry a short badge, never a sentence. */
export type RoundEloView=
  {kind:'saved';who:string|null;rank:string;rating:string;delta:string;up:boolean;toCap:string;bar:boolean;pct:number;gainPct:number}|
  {kind:'unrecorded';badge:'NOT SAVED'}|
  {kind:'unrated';badge:''};
export type RoundResultModel={
  /** Separate pills: mode, size (not for 1v1), round, clock. */
  meta:string[];badge:'RATED'|'UNRATED';who:string|null;
  tiles:{label:string;value:string}[];elo:RoundEloView;
};

const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?Math.floor(n):0;
const num=(n:unknown,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
const text=(n:number)=>(Math.round(n*2)/2).toLocaleString('en-US');
const clock=(s:number)=>{const t=Math.max(0,Math.floor(num(s)));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};

const MODE_TAGS:Record<string,string>={duel:'Duel',squad:'Squads',watch:'Watch',command:'Commander'};
/** Plain category tags the way real games label modes: the mode, then the team size. */
export function resultModeTag(mode:string,teamSizes:readonly number[]):string[] {
  const [a=1,b=1]=teamSizes.map(n=>Math.max(1,Math.floor(num(n,1))));
  const size=a+'v'+b,name=Object.hasOwn(MODE_TAGS,mode)?MODE_TAGS[mode]!:'';
  return name?[name,size]:[size];
}

export function resultElo(input:Pick<RoundResultInput,'rated'|'save'|'elo'>):RoundEloView {
  if(!input.rated)return {kind:'unrated',badge:''};
  if(input.save!=='saved'||!input.elo)return {kind:'unrecorded',badge:'NOT SAVED'};
  const e=input.elo;
  const {ratingAfter:after,ratingBefore:before,delta}=e;
  if(typeof after!=='number'||!Number.isFinite(after)||after<=0||
     typeof before!=='number'||!Number.isFinite(before)||before<=0||
     typeof delta!=='number'||!Number.isFinite(delta))
    return {kind:'unrecorded',badge:'NOT SAVED'};
  const cap=typeof e.cap==='number'&&Number.isFinite(e.cap)&&e.cap>0?e.cap:null;
  // Arena Elo starts at 100 whatever the training rank, so a rating can sit below its rank's floor.
  const low=after<e.floor?Math.floor(Math.min(before,after)/100)*100:e.floor;
  const top=cap===null?null:Math.max(cap,low+1);
  const span=top===null?1:top-low;
  const pct=top===null?0:Math.min(1,Math.max(0,(after-low)/span));
  const gainPct=top===null||delta<=0?0:Math.min(pct,Math.max(0,delta/span));
  const left=top===null?0:top-after;
  return {
    kind:'saved',who:e.who??null,rank:e.rank,rating:text(after),delta:(delta>0?'+':delta<0?'−':'±')+text(Math.abs(delta)),up:delta>0,
    toCap:top===null?'No Elo cap':left>.25?text(left)+' to current Elo cap':'At current Elo cap',
    bar:top!==null,pct,gainPct,
  };
}

export function buildRoundResult(input:RoundResultInput):RoundResultModel {
  const l=input.line;
  return {
    meta:[...resultModeTag(input.mode,input.teamSizes).filter(t=>t!=='1v1'),'Round '+Math.max(1,Math.floor(num(input.round,1))),clock(input.seconds)],
    badge:input.rated?'RATED':'UNRATED',who:input.who,
    tiles:[
      {label:'Kills',value:String(count(l.kills))},{label:'Deaths',value:String(count(l.deaths))},
      {label:'DMG',value:Math.round(count(l.damage)).toLocaleString('en-US')},{label:'Parries',value:String(count(l.parries))},
    ],
    elo:resultElo(input),
  };
}

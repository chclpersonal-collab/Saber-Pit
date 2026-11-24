/**
 * End-of-round result model. Pure: takes numbers the round already produced and the save
 * outcome, and returns what the result card shows. An Elo change appears only once it is saved.
 */
export type RoundSaveOutcome='saved'|'conflict'|'session-only'|'unavailable'|'untracked';
export type RoundLine={kills:unknown;deaths:unknown;damage:unknown;parries:unknown;saberHits:unknown;saberSwings:unknown};
export type RoundElo={who?:string|null;rank:string;ratingBefore:unknown;ratingAfter:unknown;delta:unknown;floor:number;nextRank:string|null;nextFloor:number|null};
export type RoundResultInput={
  mode:string;teamSizes:readonly number[];round:number;seconds:number;rated:boolean;save:RoundSaveOutcome;
  /** Whose line this is: the player's fighter, or a side's total when watching. */
  who:string|null;line:RoundLine;elo?:RoundElo|null;
};
export type RoundEloView=
  {kind:'saved';who:string|null;rank:string;rating:string;delta:string;up:boolean;toNext:string;pct:number;gainPct:number}|
  {kind:'unrecorded';text:string}|
  {kind:'unrated';text:string};
export type RoundResultModel={
  eyebrow:string;badge:'RATED'|'UNRATED';who:string|null;
  tiles:{label:string;value:string}[];hits:string;elo:RoundEloView;
};

const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?Math.floor(n):0;
const num=(n:unknown,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
const text=(n:number)=>(Math.round(n*2)/2).toLocaleString('en-US');
const clock=(s:number)=>{const t=Math.max(0,Math.floor(num(s)));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};

/** Plain category tags the way real games label modes. */
export function resultModeTag(mode:string,teamSizes:readonly number[]):string {
  const [a=1,b=1]=teamSizes.map(n=>Math.max(1,Math.floor(num(n,1))));
  const size=a+'v'+b;
  if(mode==='duel')return 'Duel · '+size;
  if(mode==='squad')return 'Squads · '+size;
  if(mode==='watch')return 'Watch · '+size;
  if(mode==='command')return 'Commander · '+size;
  return size;
}

export function resultElo(input:Pick<RoundResultInput,'rated'|'save'|'elo'>):RoundEloView {
  if(!input.rated)return {kind:'unrated',text:'Unrated round. Elo unchanged.'};
  if(input.save!=='saved'||!input.elo)return {kind:'unrecorded',text:'Elo not recorded.'};
  const e=input.elo, after=num(e.ratingAfter,e.floor), before=num(e.ratingBefore,after), delta=num(e.delta,after-before);
  // Arena Elo starts at 100 whatever the career rank, so a rating can sit below its rank's floor.
  const low=after<e.floor?Math.floor(Math.min(before,after)/100)*100:e.floor;
  const top=e.nextFloor===null?null:Math.max(e.nextFloor,low+1);
  const span=top===null?1:top-low;
  const pct=top===null?1:Math.min(1,Math.max(0,(after-low)/span));
  const gainPct=top===null||delta<=0?0:Math.min(pct,Math.max(0,delta/span));
  const left=top===null?0:top-after;
  return {
    kind:'saved',who:e.who??null,rank:e.rank,rating:text(after),delta:(delta>0?'+':delta<0?'−':'±')+text(Math.abs(delta)),up:delta>0,
    toNext:top===null?'Top rank':left>.5?text(left)+' to '+e.nextRank:'At cap · rank up to raise it',
    pct,gainPct,
  };
}

export function buildRoundResult(input:RoundResultInput):RoundResultModel {
  const l=input.line;
  return {
    eyebrow:['Round '+Math.max(1,Math.floor(num(input.round,1))),resultModeTag(input.mode,input.teamSizes),clock(input.seconds)].join(' · '),
    badge:input.rated?'RATED':'UNRATED',who:input.who,
    tiles:[
      {label:'Kills',value:String(count(l.kills))},{label:'Deaths',value:String(count(l.deaths))},
      {label:'Damage',value:Math.round(count(l.damage)).toLocaleString('en-US')},{label:'Parries',value:String(count(l.parries))},
    ],
    hits:'Saber hits '+count(l.saberHits)+' · Swings '+count(l.saberSwings),
    elo:resultElo(input),
  };
}

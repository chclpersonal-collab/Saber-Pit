/** Ratings for regular Arena run slots. Tournament and Hero models do not use this ledger. */
import {ELO_K,eloExpected,eloFloor} from './arcade-elo.js?v=2.18.5';
import {SOLDIER_GRADES} from './progression.js?v=1.4.0';

export const ARENA_NORMAL_ELO_START=100;
export const ARENA_NORMAL_ELO_MAX_TEAM=15;
type Team=0|1;
export type ArenaNormalRatings=Record<string,number>;
export type ArenaNormalMatch={
  mode?:string;
  config?:{rule?:string;teamSizes?:readonly number[];matchGoalPlanning?:boolean};
  fighters:readonly {id:string;team:number;heroId?:string|null}[];
};
export type ArenaNormalRatingChange={
  ratingBefore:number;
  ratingAfter:number;
  ratingDelta:number;
  ratingCap:number|null;
};
const slotId=/^[01]-(?:[0-9]|1[0-4])$/;

export function arenaNormalRating(value:unknown):number {
  if(typeof value!=='number'||!Number.isFinite(value))return ARENA_NORMAL_ELO_START;
  // Keep arbitrary stored inputs inside a range where half-point arithmetic is exact.
  return Math.max(ARENA_NORMAL_ELO_START,Math.round(Math.min(value,Number.MAX_SAFE_INTEGER/2)*2)/2);
}
export function safeArenaNormalRatings(value:unknown):ArenaNormalRatings {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([id,rating])=>slotId.test(id)&&typeof rating==='number'&&Number.isFinite(rating))
    .map(([id,rating])=>[id,arenaNormalRating(rating)]));
}
export function arenaNormalCap(gradeIndex:unknown):number|null {
  const index=typeof gradeIndex==='number'&&Number.isInteger(gradeIndex)&&gradeIndex>=0&&gradeIndex<SOLDIER_GRADES.length
    ?gradeIndex:0;
  const next=SOLDIER_GRADES[index+1];
  return next?eloFloor(next.label)-.5:null;
}
/** Runtime call site is the Arena career, never a tournament or replay adapter. */
export function arenaNormalRanked(game:ArenaNormalMatch|null|undefined):boolean {
  if(!game||!['duel','squad','watch'].includes(game.mode??'')||
     game.config?.rule!=='elimination'||game.config.matchGoalPlanning)return false;
  const sizes=game.config.teamSizes;
  const count=sizes?.[0];
  if(sizes?.length!==2||count===undefined||!Number.isInteger(count)||count<1||count>ARENA_NORMAL_ELO_MAX_TEAM||sizes[1]!==count||game.fighters.length!==count*2)return false;
  const byId=new Map(game.fighters.map(f=>[f.id,f]));
  for(const team of [0,1] as const)for(let slot=0;slot<count;slot++){
    const fighter=byId.get(`${team}-${slot}`);
    if(!fighter||fighter.team!==team||fighter.heroId)return false;
  }
  return true;
}
type RankedSlot={id:string;team:Team;gradeIndex:number};
/** Round the paired team transfer once, then gate individual positive gains. */
export function updateArenaNormalRatings(
  prior:ArenaNormalRatings, slots:readonly RankedSlot[], winning:Team|null, rated:boolean,
):{arenaRatings:ArenaNormalRatings;changes:Record<string,ArenaNormalRatingChange>} {
  const arenaRatings=safeArenaNormalRatings(prior);
  const means:[number,number]=[0,0];
  const counts:[number,number]=[0,0];
  for(const f of slots){
    means[f.team]+=arenaNormalRating(arenaRatings[f.id]);
    counts[f.team]++;
  }
  const effective=rated&&counts[0]>0&&counts[1]>0;
  const expected=effective?eloExpected(means[0]/counts[0],means[1]/counts[1]):.5;
  const actual=winning===null?.5:winning===0?1:0;
  const raw=effective?ELO_K*(actual-expected):0;
  const transferA=(raw<0?-Math.round(-raw*2):Math.round(raw*2))/2;
  const changes:Record<string,ArenaNormalRatingChange>={};
  for(const f of slots){
    const ratingBefore=arenaNormalRating(arenaRatings[f.id]);
    const ratingCap=arenaNormalCap(f.gradeIndex);
    const transfer=f.team===0?transferA:-transferA;
    // A different lobby grade can put someone above their current cap. Keep
    // points they earned earlier, but don't add more until training catches up.
    const allowed=transfer>0&&ratingCap!==null?Math.min(transfer,Math.max(0,ratingCap-ratingBefore)):transfer;
    const ratingAfter=effective?arenaNormalRating(ratingBefore+allowed):ratingBefore;
    if(effective)arenaRatings[f.id]=ratingAfter;
    changes[f.id]={ratingBefore,ratingAfter,ratingDelta:ratingAfter-ratingBefore,ratingCap};
  }
  return {arenaRatings,changes};
}

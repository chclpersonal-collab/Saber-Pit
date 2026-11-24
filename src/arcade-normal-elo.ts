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
type Knockout={victimId:string;killerId:string|null;assists:readonly string[]};
/** Per knockout, fund a shared kill/assist transfer using pre-round individual ratings. */
export function updateArenaNormalRatings(
  prior:ArenaNormalRatings, slots:readonly RankedSlot[], knockouts:readonly Knockout[], rated:boolean,
):{arenaRatings:ArenaNormalRatings;changes:Record<string,ArenaNormalRatingChange>} {
  const arenaRatings=safeArenaNormalRatings(prior);
  const byId=new Map(slots.map(f=>[f.id,f]));
  const adjustments=new Map<string,number>();
  const seen=new Set<string>();
  const add=(id:string,halfPoints:number)=>adjustments.set(id,(adjustments.get(id)??0)+halfPoints);
  for(const ko of rated?knockouts:[]){
    const victim=byId.get(ko.victimId), killer=ko.killerId?byId.get(ko.killerId):undefined;
    if(!victim||!killer||killer.team===victim.team||seen.has(victim.id))continue;
    seen.add(victim.id);
    const assists=[...new Set(ko.assists)].filter(id=>id!==killer.id&&byId.get(id)?.team===killer.team).sort();
    const pool=Math.round(2*ELO_K*(1-eloExpected(arenaNormalRating(arenaRatings[killer.id]),arenaNormalRating(arenaRatings[victim.id]))));
    const assistPool=assists.length?Math.round(pool*.25):0;
    add(victim.id,-pool);
    add(killer.id,pool-assistPool);
    // Round shares in half points, deterministically preserving the total.
    assists.forEach((id,i)=>add(id,Math.round(assistPool*(i+1)/assists.length)-Math.round(assistPool*i/assists.length)));
  }
  const changes:Record<string,ArenaNormalRatingChange>={};
  for(const f of slots){
    const ratingBefore=arenaNormalRating(arenaRatings[f.id]);
    const ratingCap=arenaNormalCap(f.gradeIndex);
    const transfer=(adjustments.get(f.id)??0)/2;
    // An already higher rating is retained but may not increase above the current rank cap.
    const allowed=transfer>0&&ratingCap!==null?Math.min(transfer,Math.max(0,ratingCap-ratingBefore)):transfer;
    const ratingAfter=arenaNormalRating(ratingBefore+allowed);
    if(rated)arenaRatings[f.id]=ratingAfter;
    changes[f.id]={ratingBefore,ratingAfter,ratingDelta:ratingAfter-ratingBefore,ratingCap};
  }
  return {arenaRatings,changes};
}

import {arcadeKnockoutFor} from './arcade-engine-stats.js';
import {notifyCloudSaveCommitted} from './cloud-save-commit.js';
import {createCareer, awardMerit, meritForRound, progressionSummary} from './progression.js?v=1.4.0';

import {ELO_SCALE,migrateLegacyElo} from './arcade-elo.js?v=2.18.5';
import {arenaNormalRanked,arenaNormalRating,arenaNormalCap,safeArenaNormalRatings,updateArenaNormalRatings} from './arcade-normal-elo.js';
import type {ArenaNormalMatch,ArenaNormalRatings,ArenaNormalRatingChange} from './arcade-normal-elo.js';

export const ARCADE_CAREER_KEY='saber-pit-arcade-careers-v1';
type Career = ReturnType<typeof createCareer>;
type Summary = ReturnType<typeof progressionSummary>;
type Fighter = { id:string;career:Career;stats?:{damage?:number;kills?:number};hp?:number;alive?:boolean;team:number;heroId?:string|null };
type Game = Omit<ArenaNormalMatch,'fighters'> & {phase:string;fighters:readonly Fighter[]};
type FinalReport = { id: string; before: Summary; after: Summary; reward: number; promoted: boolean } & ArenaNormalRatingChange;
type Settlement = { careers: Record<string,Career>; report: FinalReport[];arenaRatings:ArenaNormalRatings;rated:boolean };
type CareerSave = { version?: number; mode: string; seed: number; round: number; eloScale?: number;
  careers?: Record<string,{merit?: number}>; arenaRatings?:unknown; heroLineup?: Record<string,unknown>; [section:string]:unknown };
const modes=['duel','squad','watch','command'];
const slots=/^[01]-(?:[0-9]|1[0-9]|2[0-3])$/;
export function safeCareers(candidate?: Record<string,{merit?:number}|null>|null){
  return Object.fromEntries(Object.entries(candidate??{}).filter(([id,career])=>slots.test(id)&&career&&Number.isFinite(career.merit)).map(([id,career])=>[id,createCareer(career?.merit)]));
}
export function classicCareers(game?: {careers?: readonly (readonly ({merit?:number}|null)[]|undefined)[]}|null){
  return Object.fromEntries([0,1].flatMap(team=>(game?.careers?.[team]??[]).slice(0,15).map((career,slot)=>[`${team}-${slot}`,createCareer(career?.merit)])));
}
export function readArcadeCareer(storage?:Pick<Storage,'getItem'>|null){
  try{
    const data=JSON.parse((storage??globalThis.localStorage).getItem(ARCADE_CAREER_KEY)??'null') as Partial<CareerSave>|null;
    if(data?.version!==1||!modes.includes(data.mode??'')||typeof data.round!=='number'||!Number.isInteger(data.round)||data.round<1||data.round>100000||!Number.isInteger(data.seed))return null;
    const heroLineup=data.heroLineup;
    const migrate=data.eloScale!==ELO_SCALE&&heroLineup&&typeof heroLineup==='object'&&!Array.isArray(heroLineup);
    return {...data,eloScale:ELO_SCALE,careers:safeCareers(data.careers),arenaRatings:safeArenaNormalRatings(data.arenaRatings),
      ...(migrate?{heroLineup:Object.fromEntries(Object.entries(heroLineup).map(([slot,h])=>
        [slot,h&&typeof h==='object'?{...h,elo:migrateLegacyElo((h as {elo?:unknown}).elo)}:h]))}:{})};
  }catch{return null;}
}
export function saveArcadeCareer(data:object,storage?:Pick<Storage,'setItem'>|null){
  try{const target=storage??globalThis.localStorage;target.setItem(ARCADE_CAREER_KEY,JSON.stringify({...data,...('arenaRatings' in data?{arenaRatings:safeArenaNormalRatings(data.arenaRatings)}:{}),version:1,eloScale:ELO_SCALE}));notifyCloudSaveCommitted(target);return true;}
  catch{return false;}
}
const settled=new WeakMap<Game,Settlement>();
export function settleArcadeCareer(game:Game|null|undefined,priorArenaRatings:unknown={}):Settlement|null {
  if(!game||!['won','lost','draw'].includes(game.phase))return null;
  const previous=settled.get(game);
  if(previous)return previous;
  const winning=game.phase==='won'?0:game.phase==='lost'?1:null;
  const ledgers=safeArenaNormalRatings(priorArenaRatings);
  const rated=arenaNormalRanked(game);
  const rewards=game.fighters.map(f=>{
    const before=progressionSummary(f.career);
    const survived=f.alive??((f.hp??0)>0);
    const reward=meritForRound({damageDealt:f.stats?.damage,kills:f.stats?.kills,survived,won:f.team===winning});
    const after=progressionSummary(awardMerit(before,reward));
    return {id:f.id,team:f.team,before,after,reward:after.merit-before.merit,promoted:after.gradeIndex>before.gradeIndex};
  });
  const knockouts=game.fighters.flatMap(victim=>{
    const attribution=arcadeKnockoutFor(victim);
    return attribution?[{victimId:victim.id,...attribution}]:[];
  });
  const {arenaRatings,changes}=updateArenaNormalRatings(ledgers,rewards.flatMap(f=>
    f.team===0||f.team===1?[{id:f.id,team:f.team,gradeIndex:f.after.gradeIndex}]:[]),knockouts,rated);
  const report=rewards.map(({team:_,...row})=>{
    const rating=arenaNormalRating(ledgers[row.id]);
    return {...row,...(changes[row.id]??{ratingBefore:rating,ratingAfter:rating,ratingDelta:0,ratingCap:arenaNormalCap(row.after.gradeIndex)})};
  });
  const result={careers:Object.fromEntries(report.map(({id,after})=>[id,createCareer(after.merit)])),report,arenaRatings,rated};
  settled.set(game,result);
  return result;
}

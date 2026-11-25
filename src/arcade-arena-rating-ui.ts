import {ARENA_NORMAL_ELO_MAX_TEAM,arenaNormalRanked} from './arcade-normal-elo.js';

type PickedHeroes=Readonly<Record<string,{id:string}|undefined>>;
export function arenaLobbyRating(mode:string,rule:string,teamSizes:readonly number[],heroes:PickedHeroes,forcePools?:readonly (readonly string[])[],novicePractice=false,squadTactics=false,opponentReads=false){
  const valid=teamSizes.length===2&&teamSizes.every(n=>Number.isInteger(n)&&n>=1&&n<=24);
  const fighters=valid?teamSizes.flatMap((size,team)=>Array.from({length:size},(_,slot)=>{
    const id=team+'-'+slot;
    return {id,team,heroId:heroes[id]?.id};
  })):[];
  const rated=arenaNormalRanked({mode,config:{rule,teamSizes,forcePools,novicePractice,squadTactics,opponentReads},fighters});
  if(rated)return {rated,label:'Rated'};
  const size=teamSizes[0];
  if(mode==='command')return {rated,label:'Unrated · Commander'};
  if(rule!=='elimination')return {rated,label:'Unrated · Not Elimination'};
  if(fighters.some(f=>f.heroId))return {rated,label:'Unrated · Saved Hero'};
  if(opponentReads)return {rated,label:'Unrated · Adaptive Sparring'};
  if(squadTactics)return {rated,label:'Unrated · Squad Drills'};
  if(novicePractice)return {rated,label:'Unrated · Practice 0.75×'};
  if(forcePools?.some(pool=>pool.length))return {rated,label:'Unrated · Custom Force'};
  if(!valid)return {rated,label:'Set Team Sizes'};
  if(size!==teamSizes[1])return {rated,label:'Unrated · Uneven Teams'};
  if(size>ARENA_NORMAL_ELO_MAX_TEAM)return {rated,label:'Unrated · Over 15v15'};
  return {rated,label:'Unrated'};
}

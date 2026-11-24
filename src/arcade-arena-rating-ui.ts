import {ARENA_NORMAL_ELO_MAX_TEAM,ARENA_NORMAL_ELO_START,arenaNormalRanked} from './arcade-normal-elo.js';

type PickedHeroes=Readonly<Record<string,{id:string}|undefined>>;
export function arenaLobbyRating(mode:string,rule:string,teamSizes:readonly number[],heroes:PickedHeroes,forcePools?:readonly (readonly string[])[],novicePractice=false){
  const valid=teamSizes.length===2&&teamSizes.every(n=>Number.isInteger(n)&&n>=1&&n<=24);
  const fighters=valid?teamSizes.flatMap((size,team)=>Array.from({length:size},(_,slot)=>{
    const id=team+'-'+slot;
    return {id,team,heroId:heroes[id]?.id};
  })):[];
  const rated=arenaNormalRanked({mode,config:{rule,teamSizes,forcePools,novicePractice},fighters});
  if(rated)return {rated,label:'Rated · starts at '+ARENA_NORMAL_ELO_START+' Elo'};
  const size=teamSizes[0];
  if(mode==='command')return {rated,label:'Unrated · Commander mode'};
  if(rule!=='elimination')return {rated,label:'Unrated · Elo requires Elimination'};
  if(fighters.some(f=>f.heroId))return {rated,label:'Unrated · Saved Hero selected'};
  if(novicePractice)return {rated,label:'Unrated · novice practice at 0.75× speed'};
  if(forcePools?.some(pool=>pool.length))return {rated,label:'Unrated · custom AI Force loadout'};
  if(!valid)return {rated,label:'Enter both team sizes to check Elo'};
  if(size!==teamSizes[1])return {rated,label:'Unrated · teams must be the same size'};
  if(size>ARENA_NORMAL_ELO_MAX_TEAM)return {rated,label:'Unrated · Elo ends at 15v15'};
  return {rated,label:'Unrated'};
}

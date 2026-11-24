import {appearanceSeedFor,fighterGenderLabel,FIGHTER_GENDERS} from './arcade-fighter-profiles.js?v=2.18.3';
export const ARENA_TEAM_GENDERS=['default','mixed',...FIGHTER_GENDERS] as const;
export const ARENA_TEAM_APPEARANCES=['default','mixed','femboy','woman','rabbit'] as const;
export type TeamLookValue=typeof ARENA_TEAM_GENDERS[number]|typeof ARENA_TEAM_APPEARANCES[number];
type TeamValue<T>=readonly [T,T];
export function normalizeTeamLooks<T extends TeamLookValue>(values:unknown,options:readonly T[]):TeamValue<T>|undefined {
  if(!Array.isArray(values))return;
  const clean=(side:number)=>options.includes(values[side])?values[side] as T:'default' as T;
  const list=[clean(0),clean(1)] as const;
  return list.some(x=>x!=='default')?list:undefined;
}
export function arenaTeamLook<T extends TeamLookValue>(list:TeamValue<T>|undefined,options:readonly T[],
  seed:number,team:0|1,slot:number,axis:string):Exclude<T,'default'|'mixed'>|undefined {
  const picked=list?.[team];
  if(!picked||picked==='default')return;
  const available=options.filter(v=>v!=='default'&&v!=='mixed');
  // A seed chooses starting member and direction; every three seats include each option.
  const salt=appearanceSeedFor(axis+':'+seed+':'+team);
  const index=(salt%available.length+slot*(salt%2?1:available.length-1))%available.length;
  return (picked==='mixed'?available[index]:picked) as Exclude<T,'default'|'mixed'>;
}

/** Summarize the actual fighter, never an unresolved team setting or save pick. */
export function arenaFighterAppearance(f:{gender:unknown;body:unknown;heroId?:string|null}){
  const body=f.body==='woman'?'Slim-thick woman':f.body==='femboy'?'Femboy':f.body==='rabbit'?'Rabbit duelist':'Unspecified';
  return {gender:fighterGenderLabel(f.gender)||'Unspecified',appearance:body,source:f.heroId?'Saved Hero':'Match roster'};
}

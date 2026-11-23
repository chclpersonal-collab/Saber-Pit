export const FIGHTER_GENDERS=Object.freeze(['female','male','nonbinary'] as const);
export type FighterGender = typeof FIGHTER_GENDERS[number];
const LABELS=Object.freeze({female:'Female',male:'Male',nonbinary:'Nonbinary'});
export const fighterGenderLabel=(gender: unknown)=>Object.hasOwn(LABELS,gender as PropertyKey)?LABELS[gender as FighterGender]:'';
export const validFighterGender=(gender: unknown): gender is FighterGender=>FIGHTER_GENDERS.includes(gender as FighterGender);

export function appearanceSeedFor(key: unknown){
  let hash=2166136261;
  for(const c of String(key??'fighter'))hash=Math.imul(hash^c.codePointAt(0)!,16777619);
  return hash>>>0;
}

// Existing presets supply a starting label only. A saved Hero can use any
// label without changing their body rig, weapon, identity, or career stats.
export function fighterGender(gender: unknown,body: unknown,key: unknown){
  if(validFighterGender(gender))return gender;
  if(body==='woman')return 'female';
  if(body==='femboy')return 'male';
  return FIGHTER_GENDERS[appearanceSeedFor(key)%FIGHTER_GENDERS.length];
}

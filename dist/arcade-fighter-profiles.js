export const FIGHTER_GENDERS=Object.freeze(['female','male','nonbinary']);
const LABELS=Object.freeze({female:'Female',male:'Male',nonbinary:'Nonbinary'});
export const fighterGenderLabel=gender=>Object.hasOwn(LABELS,gender)?LABELS[gender]:'';
export const validFighterGender=gender=>FIGHTER_GENDERS.includes(gender);

export function appearanceSeedFor(key){
  let hash=2166136261;
  for(const c of String(key??'fighter'))hash=Math.imul(hash^c.codePointAt(0),16777619);
  return hash>>>0;
}

// Existing presets supply a starting label only. A saved Hero can use any
// label without changing their body rig, weapon, identity, or career stats.
export function fighterGender(gender,body,key){
  if(validFighterGender(gender))return gender;
  if(body==='woman')return 'female';
  if(body==='femboy')return 'male';
  return FIGHTER_GENDERS[appearanceSeedFor(key)%FIGHTER_GENDERS.length];
}

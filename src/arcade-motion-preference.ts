/** Full motion is the Saber Pit default. An explicit setting stays local. */
export const ARCADE_MOTION_KEY='saber-pit:motion:1';
export function readArcadeReducedMotion(storage?: Pick<Storage,'getItem'> | null){
  try{return (storage??globalThis.localStorage)?.getItem(ARCADE_MOTION_KEY)==='reduced';}
  catch{return false;}
}
export function saveArcadeReducedMotion(reduced: unknown,storage?: Pick<Storage,'setItem'> | null){
  try{
    const target=storage??globalThis.localStorage;
    if(!target?.setItem)return false;
    target.setItem(ARCADE_MOTION_KEY,reduced===true?'reduced':'full');
    return true;
  }catch{return false;}
}

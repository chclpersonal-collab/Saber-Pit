/** Full motion is the Saber Pit default. An explicit setting stays local. */
export const ARCADE_MOTION_KEY='saber-pit:motion:1';
export function readArcadeReducedMotion(storage){
  try{return (storage??globalThis.localStorage)?.getItem(ARCADE_MOTION_KEY)==='reduced';}
  catch{return false;}
}
export function saveArcadeReducedMotion(reduced,storage){
  try{
    const target=storage??globalThis.localStorage;
    if(!target?.setItem)return false;
    target.setItem(ARCADE_MOTION_KEY,reduced===true?'reduced':'full');
    return true;
  }catch{return false;}
}

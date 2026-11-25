type Fixture={id?:string}|null|undefined;
type Active={terrain?:string;seed?:number;qualifiers?:Fixture[];opening?:Fixture[];rounds?:Fixture[][]}|null|undefined;
import {ARCADE_MAPS} from './arcade-stage.js?v=6.0.2-rc2';
export const TOURNAMENT_ROTATION='rotation';
// The four distinct layouts (the other two official open stages share
// Underpit's geometry). Keep this pool stable for saved rotation seasons.
export const TOURNAMENT_ROTATION_MAPS=Object.freeze(['underpit','crossroads','zigzag','craterfield']);
const mapHash=(key:string)=>{
  let number=2166136261;
  for(const c of key)number=Math.imul(number^c.codePointAt(0)!,16777619);
  number^=number>>>16;number=Math.imul(number,0x85ebca6b);number^=number>>>13;
  return number>>>0;
};
function permutation(seed:number){
  const cards=[...TOURNAMENT_ROTATION_MAPS];let x=seed||1;
  for(let i=cards.length-1;i>0;i--){
    x^=x<<13;x^=x>>>17;x^=x<<5;
    const j=(x>>>0)%(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];
  }
  return cards;
}
export function tournamentTerrainOption(value:string|undefined){
  return value===TOURNAMENT_ROTATION||Object.hasOwn(ARCADE_MAPS,value as string)?value:'underpit';
}
export function tournamentFixtureTerrain(active:Active,fixture:Fixture){
  const preset=tournamentTerrainOption(active?.terrain);
  if(preset!==TOURNAMENT_ROTATION)return preset;
  if(typeof fixture?.id!=='string'||!Number.isSafeInteger(active?.seed))return TOURNAMENT_ROTATION_MAPS[0];
  const list=<T>(v:T[]|undefined):T[]=>Array.isArray(v)?v:[];
  const all=[...list(active?.qualifiers),...list(active?.opening),...list(active?.rounds).flatMap(list)];
  const order=all.findIndex(item=>item?.id===fixture.id);
  const seed='saber-pit-maps:1/'+(active!.seed!>>>0)+'/';
  if(order<0)return TOURNAMENT_ROTATION_MAPS[mapHash(seed+fixture.id)%TOURNAMENT_ROTATION_MAPS.length];
  const cycle=Math.floor(order/TOURNAMENT_ROTATION_MAPS.length);
  const cards=permutation(mapHash(seed+cycle));
  return cards[order%cards.length];
}

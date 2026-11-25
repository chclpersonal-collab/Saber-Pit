import {arenaFixedMapSize,engineForcePools,presets,ARCADE_MAPS,type ArcadeSetup} from './arcade-setup.js';
import {ARCADE_FORCE_FAMILIES} from './arcade-loadouts.js';
import {arcadeForcePoolEntry} from './arcade-force-pool.js';

const rules={elimination:'Elimination',control:'Control',relic:'Relic'} as const;
const appearance={mixed:'Mixed Look',femboy:'Femboy',woman:'Woman',rabbit:'Rabbit'} as const;
function find<T>(table:Readonly<Record<string,T>>,key:string):T|undefined{
  return Object.hasOwn(table,key)?table[key]:undefined;
}
type PresetKey=keyof typeof presets;
export function activeArenaPreset(s:ArcadeSetup,key:string){
  if(!Object.hasOwn(presets,key))return false;
  const p=presets[key as PresetKey];
  return s.participation===p.participation&&s.rule===p.rule&&s.teamSizes.join()===p.teamSizes.join()
    &&(key!=='master'||(s.startingRanks.join()==='SSS+V,F'&&!s.heroPicks.some(hero=>hero.id)));
}
/** Setup summary as separate pills (the lobby renders each as .v6-meta), never a "·" chain. */
export function arenaSetupSummaryParts(s:ArcadeSetup):string[]{
  const fixed=arenaFixedMapSize(s.mapId);
  const play=s.participation==='play'?(s.form==='mixed'?'Mixed':'Fighter'):s.participation==='command'?'Commander':'Watch';
  const size=fixed?fixed.join('×'):s.mapSize[0].toUpperCase()+s.mapSize.slice(1);
  const sideNames=['Blue','Pink'];
  const pools=engineForcePools(s).map((pool,i)=>pool.length?
    sideNames[i]+' AI: '+pool.map(id=>arcadeForcePoolEntry(id)?.label??'').filter(Boolean).join(', '):'').filter(Boolean);
  const looks=sideNames.map((side,i)=>{
    const body=s.teamAppearances?.[i];const gender=s.teamGenders?.[i];
    const values=[body&&body!=='default'?appearance[body]:null,gender&&gender!=='default'?(gender==='mixed'?'Mixed Gender':gender[0]!.toUpperCase()+gender.slice(1)):null].filter(Boolean);
    return values.length?side+' '+values.join(', '):'';
  }).filter(Boolean);
  const primary=s.startingForceFamily.map((id,i)=>id==='force_push'?'':sideNames[i]+' '+(ARCADE_FORCE_FAMILIES.find(power=>power.id===id)?.label??'')).filter(Boolean);
  const defaultLook=s.teamAppearances?.every(value=>value!=='default')||(!looks.length&&s.body==='femboy')?'':find(appearance,s.body)??'Femboy';
  return [play,s.teamSizes.join('v'),find(rules,s.rule)??'',find(ARCADE_MAPS,s.mapId)?.[0]??'',size,s.duration+'s',
    ...(s.saberOnly?['Sabers Only']:[...pools,...primary]),...looks,defaultLook].filter(Boolean);
}
/** Plain-text form of the same pills, for logs and tests. */
export function arenaSetupSummary(s:ArcadeSetup){
  return arenaSetupSummaryParts(s).join(' · ');
}

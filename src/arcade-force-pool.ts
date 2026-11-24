/** Explicit custom-Arena Force catalogue. A missing side pool leaves legacy AI intact. */
export const ARCADE_FORCE_POOL=[
  {id:'force_push',label:'Push',description:'Strong knockback in a forward cone.',style:'cast',cost:18,range:125,cooldown:2.2},
  {id:'force_burst',label:'Burst',description:'Wider, harder hit at short range; higher cost.',style:'cast',cost:23,range:95,cooldown:2.6},
  {id:'force_pulse',label:'Pulse',description:'Quick, narrow ranged hit with light knockback.',style:'cast',cost:15,range:163,cooldown:2.0},
  {id:'force_pull',label:'Pull',description:'Draw one exposed foe toward you; weak damage and narrow aim.',style:'pull',cost:21,range:142,cooldown:3.4},
  {id:'force_anchor',label:'Anchor',description:'Slow a moving foe briefly; guard and walls block it.',style:'anchor',cost:20,range:125,cooldown:3.8},
  {id:'force_lattice',label:'Lattice',description:'Raise a timed ward that absorbs one incoming hit.',style:'lattice',cost:28,range:0,cooldown:5.1},
  {id:'force_echo_step',label:'Echo Step',description:'Step across clear ground; no invulnerability.',style:'echoStep',cost:23,range:0,cooldown:4.4},
  {id:'force_siphon',label:'Siphon',description:'Recover up to nine stamina from one exposed foe.',style:'siphon',cost:17,range:139,cooldown:4.0},
] as const;
export type ArcadeForcePoolId=(typeof ARCADE_FORCE_POOL)[number]['id'];
const codes=new Set<string>(ARCADE_FORCE_POOL.map(x=>x.id));
export function normalizeArcadeForcePool(value:unknown):ArcadeForcePoolId[]{
  if(!Array.isArray(value))return [];
  return Array.from(new Set(value.slice(0,32).filter((x):x is ArcadeForcePoolId=>typeof x==='string'&&codes.has(x)))).slice(0,3);
}
export const arcadeForcePoolEntry=(id:string|undefined)=>ARCADE_FORCE_POOL.find(x=>x.id===id);

export type ForcePoolSituation={ distance:number; energy:number; moving:boolean; guarded:boolean; targetEnergy:number;
  imminent:number; exposed:boolean; opponents:number; screened:boolean; warded:boolean; clearStep:boolean; buildingThreat?:boolean };
export function chooseArcadeForcePool(pool:readonly ArcadeForcePoolId[],context:ForcePoolSituation,utilityOnly=false){
  const {distance:d,energy,moving,guarded,targetEnergy,imminent,exposed,opponents,screened,warded,clearStep}=context;
  const candidates=pool.flatMap((id,index)=>{
    const row=arcadeForcePoolEntry(id)!;
    if(row.cost>energy||(row.range>0&&(d>row.range||screened)))return [];
    const safe=imminent<=0||imminent>=.35;
    const score=id==='force_lattice'?(!warded&&d<=142&&imminent>=.36&&imminent<=.82?10:!warded&&context.buildingThreat&&d<=79&&energy>=46?5:0):
      id==='force_echo_step'?(safe&&clearStep&&guarded&&d>=76&&d<=141?6:0):
      id==='force_anchor'?(safe&&moving&&!guarded&&d>=62?7:0):
      id==='force_siphon'?(safe&&!guarded&&energy<=64&&targetEnergy>=20&&d>=48?8:0):
      id==='force_pull'?(safe&&!guarded&&d>=65&&(moving||exposed)?5+d/100:0):
      utilityOnly?0:
      id==='force_burst'?(safe&&d<=95?3+(opponents>1?4.9:0):0):
      id==='force_pulse'?(safe&&d>=94?4.5+d/65:0):
      safe?4+(d<89?1.8:0):0;
    return score>0?[{id,index,score}]:[];
  });
  return candidates.sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.id;
}

type Region=keyof typeof zoneProfiles;
type Ledger=Partial<Record<Region,{front?:number;rear?:number}>>|null|undefined;
type Strike={amount?:number;quality?:number;rank?:number;attackerRank?:number;defenderRank?:number;direction?:string;blocked?:boolean;region?:string;roll?:number};
type Equip={weaponHand?:string;dual?:boolean};
/** Fictional Saber Pit balance. Zone values and percentages have no real-world meaning. */
const clamp=(n:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const finite=(value:number|undefined,fallback=0)=>Number.isFinite(value)?value!:fallback;
const round=(n:number,digits=3)=>Number(n.toFixed(digits));

export const ARCADE_BODY_REGIONS=Object.freeze([
  {id:'head',label:'Head'}, {id:'torso',label:'Torso'},
  {id:'leftArm',label:'Left arm'}, {id:'rightArm',label:'Right arm'},
  {id:'leftLeg',label:'Left leg'}, {id:'rightLeg',label:'Right leg'},
].map(row=>Object.freeze(row as {id:Region;label:string})));

export const ARCADE_INJURY_REFERENCE=Object.freeze({
  label:'Reference clean strike',amount:18,quality:.74,
  description:'Fictional chance for a reference clean strike at equal rank, based on this region’s current injury. Guarded hits cannot be fatal.',
});

const zoneProfiles=Object.freeze({
  head:Object.freeze({injury:1.16,weak:.22,heavy:1.00,local:.28,max:.94}),
  torso:Object.freeze({injury:1.03,weak:.16,heavy:.92,local:.23,max:.91}),
  leftArm:Object.freeze({injury:.94,weak:.043,heavy:.78,local:.16,max:.84}),
  rightArm:Object.freeze({injury:.94,weak:.043,heavy:.78,local:.16,max:.84}),
  leftLeg:Object.freeze({injury:.98,weak:.055,heavy:.81,local:.17,max:.87}),
  rightLeg:Object.freeze({injury:.98,weak:.055,heavy:.81,local:.17,max:.87}),
});

const labels=Object.freeze(['Ready','Strained','Impaired','Disabled']);
const hasRegion=(id:unknown):id is Region=>typeof id==='string'&&Object.hasOwn(zoneProfiles,id);
const surface=(direction?:string)=>direction==='rear'?'rear':'front';
const localSurface=(injuries:Ledger,region:Region,direction?:string)=>clamp(finite(injuries?.[region]?.[surface(direction)]),0,100);
const localRegion=(injuries:Ledger,region:Region)=>{
  const a=localSurface(injuries,region,'front'),b=localSurface(injuries,region,'rear');
  // Both surfaces can matter in this region; other body regions cannot.
  return clamp(Math.max(a,b)+.34*Math.min(a,b),0,100);
};
const conditionTier=(value:number)=>value>=74?3:value>=43?2:value>=18?1:0;
const boundedRank=(value?:number)=>clamp(Math.trunc(finite(value)),0,14);

export function createArcadeInjuries(){
  return Object.fromEntries(ARCADE_BODY_REGIONS.map(({id})=>[id,{front:0,rear:0}]));
}
export const createArcadeCondition=createArcadeInjuries;

export function arcadeInjuryLabel(injuries:Ledger,region?:string,direction?:string){
  if(!hasRegion(region))return 'Unknown';
  return labels[conditionTier(direction?localSurface(injuries,region,direction):localRegion(injuries,region))];
}

function strike({amount,quality,rank,attackerRank=rank,defenderRank,direction,blocked}:Strike={}){
  const a=clamp(finite(amount),0,140);
  return {amount:a,quality:clamp(finite(quality,.50+a/120)),
    attackerRank:boundedRank(attackerRank),defenderRank:boundedRank(defenderRank),
    direction:surface(direction),blocked:blocked===true};
}
function fatalChance(injuries:Ledger,region:string|undefined,hit:ReturnType<typeof strike>){
  if(!hasRegion(region)||hit.blocked||hit.amount<=4)return 0;
  const profile=zoneProfiles[region];
  const surfaceInjury=localSurface(injuries,region,hit.direction);
  const current=localRegion(injuries,region);
  const injury=(.67*surfaceInjury+.33*current)/100;
  const clean=.61+.55*hit.quality;
  const direct=Math.pow(clamp((hit.amount-4)/48,0,1.45),1.24)*profile.weak;
  const heavy=Math.pow(clamp((hit.amount-20)/53,0,1.2),1.49)*profile.heavy;
  const injuryRisk=injury*profile.local*clamp((hit.amount-4)/21);
  const rankFactor=1+(hit.attackerRank-hit.defenderRank)*.009;
  const directionFactor=hit.direction==='rear'?1.10:1;
  return clamp((direct+heavy+injuryRisk)*clean*rankFactor*directionFactor,0,profile.max);
}

/** Exact probability used by applyArcadeInjury, without consuming a roll. */
export function arcadeFatalChance(injuries:Ledger,{region,...options}:Strike={}){
  return fatalChance(injuries,region,strike(options));
}

/**
 * Caller supplies one deterministic RNG roll. No reducer is allowed to kill
 * solely because a condition value hit a limit. A guarded contact spends
 * arena resources outside this module, without causing a penetrating injury.
 */
export function applyArcadeInjury(injuries:Ledger,{region,roll,...options}:Strike={}){
  injuries=injuries??createArcadeInjuries();
  const hit=strike(options);
  const {direction}=hit;
  const prior=hasRegion(region)?localSurface(injuries,region,direction):0;
  const base={injuries,region,direction,fatal:false,changed:false,delta:0,impact:0,tier:conditionTier(prior),fatalChance:0,outcome:'glance'};
  if(!hasRegion(region))return base;
  if(hit.blocked)return {...base,outcome:'blocked'};
  if(hit.amount<=0)return base;
  const probability=fatalChance(injuries,region,hit);
  const fatal=Number.isFinite(roll)&&roll!>=0&&roll!<1&&roll!<probability;
  const profile=zoneProfiles[region];
  const contactScale=hit.amount<=4?.24:.72+.28*hit.quality;
  const weighted=hit.amount*profile.injury*contactScale*(direction==='rear'?1.14:1);
  const after=round(clamp(prior+weighted,0,100));
  const delta=round(after-prior);
  const updated=delta>0?{...injuries,
    [region]:{front:localSurface(injuries,region,'front'),rear:localSurface(injuries,region,'rear'),[direction]:after},
  }:injuries;
  return {injuries:updated,region,direction,fatal,changed:delta>0,delta,impact:delta,
    tier:conditionTier(after),fatalChance:probability,outcome:fatal?'fatal':delta>0&&hit.amount>4?'injury':'glance'};
}

function channels(injuries:Ledger,{weaponHand='right'}:Equip={}){
  const weapon=weaponHand==='left'?'leftArm':'rightArm';
  const other=weapon==='leftArm'?'rightArm':'leftArm';
  return {
    head:localRegion(injuries,'head')/100,torso:localRegion(injuries,'torso')/100,
    weapon:localRegion(injuries,weapon)/100,offhand:localRegion(injuries,other)/100,
    leftLeg:localRegion(injuries,'leftLeg')/100,rightLeg:localRegion(injuries,'rightLeg')/100,
  };
}

/** A timeout tool, not a pool. Earlier channels take priority over later ones. */
export function arcadeInjuryBurden(injuries:Ledger,options?:Equip){
  const c=channels(injuries,options);
  const vital=Math.max(c.head,c.torso),leg=Math.max(c.leftLeg,c.rightLeg);
  const tier=(n:number)=>conditionTier(n*100);
  return [tier(vital),tier(leg),tier(c.weapon),tier(c.offhand),round(vital),round(c.torso),round(leg),
    round(Math.min(c.leftLeg,c.rightLeg)),round(c.weapon),round(c.offhand)];
}

/** Positive means the first fighter is in worse functional condition. */
export function compareArcadeDanger(a:Ledger|number[],b:Ledger|number[]){
  const first=Array.isArray(a)?a:arcadeInjuryBurden(a);
  const second=Array.isArray(b)?b:arcadeInjuryBurden(b);
  for(let i=0;i<Math.max(first.length,second.length);i++){
    const d=finite(first[i])-finite(second[i]);
    if(d!==0)return Math.sign(d);
  }
  return 0;
}

export function arcadeInjuryEffects(injuries:Ledger,options:Equip={}){
  const c=channels(injuries,options);
  const highLeg=Math.max(c.leftLeg,c.rightLeg),lowLeg=Math.min(c.leftLeg,c.rightLeg);
  const moveScale=round(clamp(1-.37*highLeg-.18*lowLeg-.13*c.torso-.07*c.head,.25,1));
  const attackScale=round(clamp(1-.45*c.weapon-(options.dual ? .20 : .08)*c.offhand-.16*c.torso-.08*c.head,.23,1));
  const guardScale=round(clamp(1-.26*c.weapon-.27*c.offhand-.18*c.torso-.06*c.head,.23,1));
  const forcePower=round(clamp(1-.39*c.head-.20*c.torso,.35,1));
  const turnSpeed=round(clamp(1-.19*highLeg-.09*lowLeg-.29*c.head,.34,1));
  return {moveScale,attackScale,guardScale,burden:arcadeInjuryBurden(injuries,options),
    moveSpeed:moveScale,saberPower:attackScale,guardEfficiency:guardScale,forcePower,turnSpeed};
}
export const arcadeInjuryModifiers=arcadeInjuryEffects;

/** Safe UI labels; condition is local injury severity, not remaining health. */
export function arcadeInjuryReport(injuries:Ledger,{direction='front',attackerRank=0,defenderRank=attackerRank}:Strike={}){
  direction=surface(direction);
  return ARCADE_BODY_REGIONS.map(({id,label})=>{
    const condition=localSurface(injuries,id,direction);
    const tier=conditionTier(condition);
    const chance=arcadeFatalChance(injuries,{region:id,direction,attackerRank,defenderRank,
      amount:ARCADE_INJURY_REFERENCE.amount,quality:ARCADE_INJURY_REFERENCE.quality});
    return {id,label,direction,condition,tier,severityLabel:labels[tier],fatalChance:chance,fatalPct:round(100*chance,1)};
  });
}

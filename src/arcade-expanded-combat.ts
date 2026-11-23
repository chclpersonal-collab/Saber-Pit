// @ts-nocheck
/** Fictional Force and unarmed arena mechanics. Definitive catalog for
 * controls, previews, and the simulation. All times are seconds. */
const force=[
  ['force_arc_wave','Arc Wave','arcWave',1,'Send a low, expanding pulse outward. It clears nearby grounded opponents without a saber strike.',[.295,.725,105,Math.PI,21,5,255,.16],3],
  ['force_anchor','Anchor','anchor',3,'Briefly slow an opponent caught inside the cast lane.',[.325,.765,125,.66,20,0,0,.10],1],
  ['force_veil','Veil','veil',5,'Disrupt a nearby opponent’s ability to read your next attack or cover their guard.',[.285,.710,112,.81,22,0,0,.10],1],
  ['force_echo_step','Echo Step','echoStep',7,'Cross a short stretch of open ground. Walls still stop you; the step grants no invulnerability.',[.225,.613,84,.32,23,0,0,0],1],
  ['force_lattice','Lattice','lattice',10,'Place a single-use ward around yourself. It expends on a real incoming hit.',[.345,.810,0,0,28,0,0,0],1],
  ['force_siphon','Siphon','siphon',13,'Take a limited amount of stamina from an opponent on actual unguarded contact.',[.405,.897,139,.51,17,0,0,.11],1],
];
// Optional Arena-only alternatives; re-use shipped effects and resolution,
// but demand different spacing, entry timing and defensive resources.
const forceVariants=[
  ['force_breakwater','Close Repulse','arcWave',4,'Use a quick, close pulse against up to two grounded rivals. It pushes less than Arc Wave and costs more stamina.',[.175,.505,63,Math.PI,26,3,165,.10],2],
  ['force_tether','Tether','anchor',8,'Slow one rival at long range. The cast is narrow, slower than Anchor, and can be stopped by a wall, guard, or ward.',[.475,1.015,196,.25,29,0,0,.10],1],
];
const freeHand=[
  ['unarmed_palm','Palm Check','palm',0,'A quick close-range arena strike with low damage and a compact recovery.',[.183,.453,54,.66,7,13,79,.12],1],
  ['unarmed_hook','Hook','hook',4,'Take a wider angle at arm’s length. Costs more stamina and leaves a longer opening.',[.244,.611,60,.88,11,19,130,.20],1],
  ['unarmed_low_check','Low Check','lowCheck',7,'Check a close opponent’s movement with a low, short-range hit.',[.251,.620,64,.65,13,15,89,.16],1],
  ['unarmed_spin','Turning Strike','spin',11,'A wider unarmed commitment that can catch two nearby opponents.',[.340,.813,67,1.24,19,23,164,.25],2],
];
const entry=(kind,[id,label,effect,minRank,description,[contact,duration,reach,arc,cost,damage,knock,recoil],cap])=>Object.freeze({
  id,label,name:label,kind,effect,minRank,description,contact,duration,reach,arc,cost,damage,knock,recoil,cap,
  manual:true,mapAction:kind==='force'?'force':'free_hand',
});
const moves=[...force.map(row=>entry('force',row)),...freeHand.map(row=>entry('free_hand',row))];
export const ARCADE_EXPANDED_MOVES=Object.freeze(Object.fromEntries(moves.map(move=>[move.id,move])));
const variants=forceVariants.map(row=>entry('force',row));
export const ARCADE_FORCE_VARIANTS=Object.freeze(Object.fromEntries(variants.map(move=>[move.id,move])));
const EMPTY=Object.freeze([]);
const byGrade=Object.freeze(Array.from({length:15},(_,rank)=>Object.freeze(moves.filter(m=>m.minRank<=rank))));
const forceByGrade=Object.freeze(byGrade.map(group=>Object.freeze(group.filter(m=>m.kind==='force'))));
const variantByGrade=Object.freeze(byGrade.map((group,rank)=>Object.freeze([...group,...variants.filter(m=>m.minRank<=rank)])));
const forceVariantByGrade=Object.freeze(variantByGrade.map(group=>Object.freeze(group.filter(m=>m.kind==='force'))));
export function arcadeExpandedMoveById(id,{forceVariants=false}={}){
  if(Object.hasOwn(ARCADE_EXPANDED_MOVES,id))return ARCADE_EXPANDED_MOVES[id];
  return forceVariants&&Object.hasOwn(ARCADE_FORCE_VARIANTS,id)?ARCADE_FORCE_VARIANTS[id]:null;
}
export function arcadeExpandedMovesFor(gradeIndex=0,{saberOnly=false,weapon,forceVariants=false}={}){
  if(saberOnly)return EMPTY;
  const groups=forceVariants?(weapon==='dual'?forceVariantByGrade:variantByGrade):(weapon==='dual'?forceByGrade:byGrade);
  return groups[Number.isFinite(gradeIndex)?Math.min(14,Math.max(0,Math.trunc(gradeIndex))):0];
}

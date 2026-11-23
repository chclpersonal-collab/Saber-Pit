// @ts-nocheck
import {ARCADE_MINOR_MOVES} from './arcade-minor-moves.js?v=3.1.0';
export {ARCADE_MINOR_MOVES} from './arcade-minor-moves.js?v=3.1.0';
import {ARCADE_EXCHANGE_CUT_ROWS} from './arcade-exchange-cuts.js?v=3.0.1';
import {ARCADE_CIRCUIT_CUTS} from './arcade-circuit-cuts.js?v=2.33.0';
import {ARCADE_RANK_CUTS} from './arcade-rank-cuts.js?v=2.27.0';
/** Original game choreography for the seven saber forms. These are authored
 * gameplay moves, not a catalogue of canonical techniques. The engine uses
 * their contact/reach/arc; the rig uses the linked motion at that same contact. */
const p=(path,chamber,finish,wind,cut,reach,lift,lean,brace,twist,lead)=>Object.freeze(
  {path,chamber,finish,wind,cut,reach,lift,lean,brace,twist,lead});
const choreography={
  sweep:p('arc',-1.75,1.26,.56,-3,6,0,3,5,.23,2),
  wheel:p('arc',1.76,-1.31,.53,2,5,-4,4,6,-.27,2),
  crescent:p('arc',-1.12,1.42,.58,-4,8,-6,7,8,.31,3),
  hook:p('arc',1.24,-1.49,.48,0,4,2,2,3,-.23,3),
  cut:p('diagonal',-1.68,.92,.65,-5,8,-8,7,7,.32,3),
  high:p('diagonal',-2.28,1.04,.63,-6,6,-11,5,9,.43,3),
  shoulderDrive:p('diagonal',-1.32,.52,.58,-5,13,-5,12,8,.31,6),
  sunder:p('diagonal',-2.47,1.25,.71,-11,9,-14,10,12,.48,4),
  rising:p('diagonal',1.52,-1.52,.46,0,7,-5,6,8,-.30,2),
  point:p('point',-.93,.21,.61,-3,9,-2,7,5,.15,4),
  lowpoint:p('point',.81,.30,.53,-2,9,6,5,6,-.16,4),
  feint:p('feint',-.86,.35,.68,-5,10,4,6,6,.19,4),
  bind:p('screen',-.61,.54,.56,0,3,-4,-3,5,.11,1),
  peel:p('screen',.83,-.54,.51,-1,5,-7,-4,5,.16,1),
  pulse:p('diagonal',-1.08,.71,.54,-1,7,-6,4,5,.22,3),
  vault:p('aerial',1.73,-1.05,.57,-4,6,-5,4,6,.17,3),
  crossVault:p('aerial',-1.54,1.36,.51,-3,7,-8,5,5,-.24,3),
  highVault:p('aerial',1.89,-1.53,.58,-2,7,-9,4,8,.31,2),
  nearTurn:p('arc',-.88,1.21,.44,-1,4,1,3,3,.28,2),
  broadPivot:p('arc',1.92,-1.84,.60,3,7,3,4,9,-.42,2),
  probingPoint:p('point',-.51,.18,.48,-2,7,4,6,4,.09,2),
  diagonalBind:p('point',.95,-.27,.56,-4,11,-1,8,6,-.22,4),
  shortScreen:p('screen',.59,-.31,.41,-2,2,0,-3,7,.11,1),
  hingeCover:p('screen',-1.01,.76,.58,1,5,-7,-5,9,.24,3),
  rebound:p('diagonal',.85,-1.22,.46,-2,6,-4,8,5,-.26,5),
  corkscrew:p('aerial',-2.16,1.61,.63,1,8,-10,9,9,-.41,5),
  anchorEdge:p('diagonal',-1.02,.76,.59,-4,4,-4,4,12,.20,0),
  breakwater:p('diagonal',1.73,-1.76,.50,3,8,-11,9,10,-.34,3),
  crossStep:p('diagonal',-.65,1.35,.50,0,7,-4,7,4,.30,5),
  twinOrbit:p('arc',1.52,-1.52,.59,0,9,-1,5,6,-.31,4),
  snapHook:p('arc',1.28,-.94,.37,-2,5,3,10,3,-.36,4),
  stormReturn:p('diagonal',-2.16,1.62,.41,-4,9,-5,13,5,.46,6),
};
const tech=(id,name,form,minRank,role,mapAction,motion,[contact,duration,reach,arc,damage,cost,lunge,knock,recoil],extra={})=>
  Object.freeze({id,name,form,minRank,role,mapAction,motion:choreography[motion],
    contact,duration,reach,arc,damage,cost,lunge,knock,recoil,cap:1,...extra});
const table=[];
const add=(form,rows)=>rows.forEach(row=>table.push(tech(row[0],row[1],form,...row.slice(2))));
add('shii_cho',[
  ['sc_open_cut','Open Cut',0,'light','slash','sweep',[.247,.571,91,1.30,16,8,137,111,.15]],
  ['sc_gate_sweep','Gate Sweep',0,'heavy','sweep','wheel',[.435,.947,111,1.90,25,23,116,217,.28],{cap:2}],
  ['sc_return_edge','Returning Edge',4,'light','slash','hook',[.24,.573,97,1.44,18,10,143,134,.18]],
  ['sc_turning_answer','Turning Answer',6,'counter','sweep','crescent',[.254,.617,101,1.64,26,16,149,169,.30]],
  ['sc_high_cleaver','High Cleaver',8,'heavy','sweep','high',[.398,.883,115,1.50,33,24,155,238,.39],{cap:2}],
  ['sc_three_corner','Three-Corner Wheel',11,'crowd','sweep','wheel',[.410,.872,124,2.30,30,29,138,214,.33],{cap:3}],
]);
add('makashi',[
  ['mk_measured_point','Measured Point',0,'light','rush','point',[.227,.544,98,.42,16,7,170,102,.16]],
  ['mk_line_thrust','Line Thrust',0,'heavy','rush','lowpoint',[.306,.721,131,.47,26,21,193,162,.29]],
  ['mk_false_opening','False Opening',4,'light','rush','feint',[.262,.645,112,.45,21,12,176,118,.19]],
  ['mk_stop_hit','Stop Hit',6,'counter','rush','point',[.194,.552,116,.40,29,17,217,166,.30]],
  ['mk_needle_lunge','Needle Lunge',8,'heavy','rush','point',[.278,.702,143,.43,34,24,226,190,.33]],
  ['mk_dueling_cross','Dueling Crosscut',11,'crowd','sweep','cut',[.333,.740,103,1.41,26,25,145,151,.27],{cap:2}],
]);
add('soresu',[
  ['sr_short_turn','Short Turn',0,'light','slash','bind',[.233,.531,79,.87,14,6,82,92,.14]],
  ['sr_gate_close','Closing Gate',0,'heavy','slash','peel',[.302,.713,83,.92,20,16,88,135,.24],{deflect:true}],
  ['sr_veil_cut','Veil Cut',4,'light','slash','peel',[.229,.544,86,.98,16,7,102,98,.16]],
  ['sr_catching_edge','Catching Edge',6,'counter','slash','bind',[.217,.581,87,1.04,22,11,87,139,.24],{deflect:true}],
  ['sr_closed_circle','Closed Circle',8,'heavy','sweep','sweep',[.355,.793,100,1.58,25,20,94,162,.26],{cap:2,deflect:true}],
  ['sr_guarding_ring','Guarding Ring',11,'crowd','sweep','wheel',[.351,.823,108,2.08,23,22,101,177,.28],{cap:3,deflect:true}],
]);
add('ataru',[
  ['at_ascending_cut','Ascending Cut',0,'light','slash','rising',[.243,.564,90,1.12,17,9,142,133,.17]],
  ['at_front_vault','Front Vault',0,'heavy','rush','vault',[.426,.938,108,1.21,26,25,251,217,.29],{air:'vault'}],
  ['at_vault_return','Vault Return',4,'light','slash','cut',[.213,.581,94,1.19,18,10,167,127,.19]],
  ['at_cross_vault','Cross Vault',6,'counter','rush','crossVault',[.356,.806,112,1.14,27,21,241,203,.32],{air:'crossVault'}],
  ['at_sky_split','Sky Split',8,'heavy','rush','highVault',[.438,.984,118,1.48,32,28,254,259,.39],{air:'highVault',cap:2}],
  ['at_airwheel','Leaping Wheel',11,'crowd','rush','crossVault',[.402,.947,120,1.86,31,28,248,247,.37],{air:'crossVault',cap:3}],
]);
add('djem_so',[
  ['ds_solid_cut','Solid Cut',0,'light','slash','cut',[.275,.623,92,1.08,18,9,117,130,.21]],
  ['ds_crushing_reply','Crushing Reply',0,'heavy','uppercut','high',[.392,.920,102,1.11,29,25,153,248,.43],{launch:true}],
  ['ds_guard_breaker','Guard Breaker',4,'light','slash','rising',[.256,.627,98,1.12,21,11,146,147,.25]],
  ['ds_reversal','Weighted Reversal',6,'counter','uppercut','rising',[.247,.637,112,1.21,35,17,164,247,.45],{launch:true}],
  ['ds_overhead_sunder','Overhead Sunder',8,'heavy','sweep','high',[.442,.979,116,1.24,38,29,151,294,.48]],
  ['ds_wide_reversal','Outer Reversal',11,'crowd','sweep','crescent',[.409,.921,120,1.85,33,29,149,259,.41],{cap:3}],
]);
add('niman',[
  ['nm_center_cut','Center Cut',0,'light','slash','pulse',[.246,.569,92,1.11,16,8,124,112,.17]],
  ['nm_parting_cut','Parting Cut',0,'heavy','sweep','crescent',[.359,.812,106,1.42,24,20,131,170,.27],{cap:2}],
  ['nm_returning_palm','Open Palm Cut',4,'light','slash','hook',[.243,.601,94,1.25,19,10,134,137,.22]],
  ['nm_settling_counter','Settling Counter',6,'counter','slash','pulse',[.215,.570,104,1.15,27,14,145,156,.27]],
  ['nm_diagonal_flow','Diagonal Flow',8,'heavy','sweep','high',[.356,.812,117,1.49,30,22,142,193,.33],{cap:2}],
  ['nm_joined_current','Joined Current',11,'crowd','sweep','wheel',[.357,.851,116,2.04,28,25,134,201,.35],{cap:3}],
]);
add('juyo',[
  ['jy_open_edge','Open Edge',0,'light','slash','rising',[.215,.530,95,1.14,18,9,153,123,.18]],
  ['jy_relentless_cut','Relentless Cut',0,'heavy','sweep','crescent',[.325,.747,112,1.39,27,24,173,210,.31]],
  ['jy_double_return','Double Return',4,'light','slash','hook',[.219,.522,102,1.28,21,13,170,151,.23]],
  ['jy_raking_answer','Raking Answer',6,'counter','slash','wheel',[.198,.536,106,1.36,27,17,178,186,.30]],
  ['jy_final_press','Final Press',8,'heavy','sweep','rising',[.302,.722,116,1.42,35,29,192,255,.40],{cap:2}],
  ['jy_fury_wheel','Fury Wheel',11,'crowd','sweep','wheel',[.340,.786,120,2.10,33,32,184,234,.39],{cap:3}],
]);
// Each row progresses through the same ten previously empty grade slots.
// Form-specific motion, timing/spacing biases, and tactical roles keep an
// unlock from being a universal damage upgrade or a renamed starter attack.
const milestones=[1,2,3,5,7,9,10,12,13,14];
const expansion={
 shii_cho:[
 ['Low Reaping Cut','hook'],['Crossing Step','cut'],['Clearing Push','push'],
 ['Broad Reprisal','crescent'],['Draw to Center','pull'],['Low Compass','sweep'],
 ['Breaking the Circle','wheel'],['Still Center','stasis'],['Four Gates','high'],['Outer Perimeter','ward']],
 makashi:[
 ['Wrist Cut','cut'],['Retreating Point','lowpoint'],['Distance Check','push'],
 ['Passing Needle','feint'],['Line Invitation','pull'],['Under the Guard','point'],
 ['Disengaging Point','lowpoint'],['Held Opening','stasis'],['Patient Riposte','point'],['Duelist’s Boundary','ward']],
 soresu:[
 ['Half Shield','bind'],['Sliding Cover','peel'],['Breathing Room','push'],
 ['Closing Screen','bind'],['Controlled Draw','pull'],['Inside Deflection','peel'],
 ['Lattice Guard','wheel'],['Quiet Hold','stasis'],['Sheltering Turn','sweep'],['Last Shelter','ward']],
 ataru:[
 ['Spring Cut','cut'],['Scissor Vault','crossVault'],['Separation Burst','push'],
 ['Rebounding Edge','rising'],['Passing Draw','pull'],['Falling Crescent','highVault'],
 ['Long Vault','vault'],['Fixed Horizon','stasis'],['Descending Wheel','crossVault'],['Landing Screen','ward']],
 djem_so:[
 ['Shoulder Cut','cut'],['Driving Edge','shoulderDrive'],['Bracing Burst','push'],
 ['Rising Reversal','rising'],['Draw and Break','pull'],['Falling Hammer','high'],
 ['Underhand Break','rising'],['Weight of Stillness','stasis'],['Sundering Reply','sunder'],['Unbroken Ground','ward']],
 niman:[
 ['Crossed Current','hook'],['Inside Flow','pulse'],['Palm Wave','push'],
 ['Passing Current','cut'],['Drawing Palm','pull'],['Reversing Flow','rising'],
 ['Meeting Currents','crescent'],['Stillwater Hold','stasis'],['Tidal Wheel','wheel'],['Quiet Sanctuary','ward']],
 juyo:[
 ['Jagged Return','hook'],['Lashing Edge','rising'],['Rupture','push'],
 ['Second Wound','cut'],['Reeling Draw','pull'],['Blind Angle','feint'],
 ['Tearing Wheel','wheel'],['Held Fury','stasis'],['Fracture Wheel','crescent'],['Pressure Wall','ward']],
};
const forceMoves={
 push:[.34,.75,169,.71,10,24,0,570,.30],
 pull:[.39,.86,159,.51,7,26,0,400,.26],
 stasis:[.44,.97,147,.60,5,30,0,110,.36],
 ward:[.42,.92,92,2.60,0,29,0,0,.15],
};
const motionClass=m=>choreography[m].path;
const rankRole=['light','heavy','heavy','counter','heavy','heavy','crowd','heavy','counter','heavy'];
const formBias={
 shii_cho:[.025,4,.16,6,1],makashi:[-.020,12,-.15,37,-1],
 soresu:[.010,-9,-.05,-24,-2],ataru:[-.012,0,.03,33,0],
 djem_so:[.047,1,-.04,0,4],niman:[-.003,2,.08,-5,0],juyo:[-.028,1,.12,31,2],
};
for(const [form,rows] of Object.entries(expansion)){
 const [tempo,space,width,drive,power]=formBias[form];
 const prefix=table.find(m=>m.form===form).id.split('_')[0];
 rows.forEach(([name,motion],i)=>{
   const rank=milestones[i],role=rankRole[i],id=prefix+'_'+name.toLowerCase().replace(/’/g,'').replace(/[^a-z0-9]+/g,'_');
   if(forceMoves[motion]){
     const [contact,duration,reach,arc,damage,cost,lunge,knock,recoil]=forceMoves[motion];
     table.push(tech(id,name,form,rank,role,'force','pulse',
       [contact+tempo,duration+2*tempo,reach+space,arc+width,damage,cost,lunge,knock,recoil],
       {forceAbility:motion,cap:motion==='ward'?4:motion==='pull'?1:3}));
     return;
   }
   const path=motionClass(motion), air=path==='aerial', point=path==='point'||path==='feint';
   const crowd=role==='crowd', heavy=role==='heavy', counter=role==='counter';
   const action=air||point?'rush':crowd||heavy?(form==='djem_so'?'uppercut':'sweep'):'slash';
   const contact=(air?.38:heavy?.34:counter?.22:.235)+tempo+i*.0029;
   const duration=contact+(air?.48:heavy?.46:.33)+i*.006;
   const damage=14+power+(air?6:0)+(heavy?9:counter?6:0)+Math.floor(rank/3);
   const deflect=form==='soresu'&&rank!==1;
   table.push(tech(id,name,form,rank,role,action,motion,
     [contact,duration,91+space+rank+(point?13:air?6:0),Math.max(.29,(point?.51:crowd?1.73:1.27)+width),
      damage,8+Math.floor(rank*.68)+(heavy?7:0),(air?225:point?166:117)+drive,
      106+rank*4+(heavy?65:0)+(form==='djem_so'?50:0),.16+rank*.009+(heavy?.06:0)],
     {...(air?{air:motion}:{}),...(deflect?{deflect:true}:{}),...(form==='djem_so'&&action==='uppercut'?{launch:true}:{}),
       cap:crowd?3:heavy&&!point?2:1}));
 });
}
// Bonus tactical kit. These are distinct mechanics, not damage upgrades
// replacing the core rank unlock. Each form keeps its own reply geometry.
const tacticalRows={
 shii_cho:['Gate Slip','False Compass','Walking Gate','crescent','hook','wheel'],
 makashi:['Outside Riposte','Point Invitation','Sliding Parry','lowpoint','feint','point'],
 soresu:['Sheltered Reply','False Opening Guard','Mantle Turn','bind','peel','bind'],
 ataru:['Spring Slip','Broken Beat','Passing Screen','rising','cut','hook'],
 djem_so:['Leverage Answer','Hanging Bait','Turning Brace','rising','sunder','high'],
 niman:['Cross Current','False Flow','Drifting Screen','pulse','hook','peel'],
 juyo:['Driving Slip','False Fury','Raking Screen','cut','feint','rising'],
};
const tactics=[];
for(const [form,[slip,redirect,guard,a,b,c]] of Object.entries(tacticalRows)){
 const [tempo,space,width,drive,power]=formBias[form];
 const prefix=table.find(m=>m.form===form).id.split('_')[0];
 const point=m=>['point','lowpoint','feint'].includes(m);
 const make=(tag,name,rank,role,motion,guard=false)=>tech(prefix+'_'+tag,name,form,rank,role,
   point(motion)?'rush':motion==='wheel'?'sweep':'slash',motion,
   [(.226+(guard?.042:0))+tempo,.63+tempo*2,94+space+(point(motion)?12:0),
    (guard?1.26:point(motion)?.51:1.13)+width,21+power+(guard?-4:0),guard?18:16,
    115+drive,147+power*4,.24],{tactical:tag,...(guard?{deflect:true}:{}),cap:guard&&motion==='wheel'?2:1});
 tactics.push(make('slip_counter',slip,5,'counter',a),make('feint_redirect',redirect,9,'heavy',b),
   make('moving_guard',guard,13,'counter',c,true));
}
const arenaRows={
 shii_cho:[
  ['ac_sc_corner_cut','Corner Cut',1,'light','slash','nearTurn',[.208,.493,86,1.34,13,7,122,88,.13],{opening:'inside'}],
  ['ac_sc_pivot_fan','Pivot Fan',12,'crowd','sweep','broadPivot',[.346,.838,119,2.39,27,24,109,188,.28],{cap:3,opening:'wide'}],
 ],
 makashi:[
  ['ac_mk_quick_probe','Quick Probe',1,'light','rush','probingPoint',[.180,.467,91,.36,12,6,153,77,.12],{opening:'inside'}],
  ['ac_mk_spiral_bind','Spiral Bind',13,'counter','rush','diagonalBind',[.231,.632,121,.47,28,16,205,156,.28],{tactical:'slip_counter',opening:'intercept'}],
 ],
 soresu:[
  ['ac_sr_guard_tip','Guard Tip',2,'light','slash','shortScreen',[.194,.471,74,.81,12,6,72,79,.12],{opening:'outside'}],
  ['ac_sr_hinge_screen','Hinge Screen',12,'counter','slash','hingeCover',[.264,.682,90,1.24,21,18,85,133,.24],{tactical:'moving_guard',deflect:true,opening:'intercept'}],
 ],
 ataru:[
  ['ac_at_rebound_cut','Rebound Cut',2,'light','slash','rebound',[.214,.546,94,1.13,16,9,181,119,.18],{opening:'outside'}],
  ['ac_at_corkscrew_entry','Corkscrew Entry',14,'heavy','rush','corkscrew',[.385,.902,125,1.42,30,26,257,219,.31],{air:'crossVault',cap:2,opening:'outside'}],
 ],
 djem_so:[
  ['ac_ds_anchored_edge','Anchored Edge',1,'light','slash','anchorEdge',[.241,.591,85,1.01,18,8,89,131,.21],{opening:'inside'}],
  ['ac_ds_breakwater','Breakwater',12,'counter','uppercut','breakwater',[.280,.726,105,1.16,33,21,152,243,.43],{launch:true,opening:'intercept'}],
 ],
 niman:[
  ['ac_nm_cross_step','Cross-Step Edge',2,'light','slash','crossStep',[.217,.518,97,.92,15,8,157,96,.16],{opening:'inside'}],
  ['ac_nm_twin_orbit','Twin Orbit',13,'crowd','sweep','twinOrbit',[.319,.795,112,1.92,25,23,133,164,.28],{cap:2,opening:'wide'}],
 ],
 juyo:[
  ['ac_jy_hook_opening','Snap Hook',1,'light','slash','snapHook',[.173,.452,86,1.09,15,8,183,93,.14],{opening:'outside'}],
  ['ac_jy_storm_return','Storm Return',14,'light','slash','stormReturn',[.251,.642,103,1.05,23,15,195,152,.22],{opening:'inside'}],
 ],
};
export const ARCADE_ARENA_CUTS=Object.freeze(Object.entries(arenaRows).flatMap(([form,rows])=>
  rows.map(([id,name,rank,role,action,motion,timing,extra])=>tech(id,name,form,rank,role,action,motion,timing,{...extra,arenaCut:true}))));
export const ARCADE_EXCHANGE_CUTS=Object.freeze(Object.entries(ARCADE_EXCHANGE_CUT_ROWS).flatMap(([form,rows])=>
  rows.map(([id,name,rank,role,action,motion,timing,extra])=>tech(id,name,form,rank,role,action,motion,timing,{...extra,exchangeCut:true}))));
table.sort((a,b)=>a.minRank-b.minRank);
export const ARCADE_TECHNIQUES=Object.freeze(Object.fromEntries([...table,...tactics,...ARCADE_RANK_CUTS,...ARCADE_CIRCUIT_CUTS,...ARCADE_ARENA_CUTS,...ARCADE_EXCHANGE_CUTS,...ARCADE_MINOR_MOVES].map(move=>[move.id,move])));
export const ARCADE_REPERTOIRE=Object.freeze(Object.fromEntries(
  [...new Set(table.map(m=>m.form))].map(form=>[form,Object.freeze(table.filter(move=>move.form===form))])));
const tiers=Object.freeze(Object.fromEntries(Object.entries(ARCADE_REPERTOIRE).map(([form,moves])=>[form,
  Object.freeze(Array.from({length:15},(_,rank)=>Object.freeze(moves.filter(m=>m.minRank<=rank))))])));
const EMPTY=Object.freeze([]);
const tacticTiers=Object.freeze(Object.fromEntries(Object.keys(ARCADE_REPERTOIRE).map(form=>[form,
  Object.freeze(Array.from({length:15},(_,rank)=>Object.freeze(tactics.filter(m=>m.form===form&&m.minRank<=rank))))])));
const allTiers=Object.freeze(Object.fromEntries(Object.keys(ARCADE_REPERTOIRE).map(form=>[form,
  Object.freeze(tiers[form].map((moves,rank)=>Object.freeze([...moves,...tacticTiers[form][rank]].sort((a,b)=>a.minRank-b.minRank))))])));
const rankOf=gradeIndex=>Number.isFinite(gradeIndex)?Math.max(0,Math.min(14,Math.floor(gradeIndex))):0;
const addCuts=(base,cuts)=>Object.freeze(Object.fromEntries(Object.entries(base).map(([form,levels])=>[
  form,Object.freeze(levels.map((moves,rank)=>Object.freeze([
    ...moves,...cuts.filter(m=>m.form===form&&m.minRank<=rank),
  ].sort((a,b)=>a.minRank-b.minRank)))),
])));
const cutTiers=addCuts(tiers,ARCADE_RANK_CUTS), allCutTiers=addCuts(allTiers,ARCADE_RANK_CUTS);
const circuitTiers=[tiers,allTiers,cutTiers,allCutTiers].map(base=>addCuts(base,ARCADE_CIRCUIT_CUTS));
const arenaTiers=[tiers,allTiers,cutTiers,allCutTiers,...circuitTiers].map(base=>addCuts(base,ARCADE_ARENA_CUTS));
const poolVariants=[tiers,allTiers,cutTiers,allCutTiers,...circuitTiers,...arenaTiers];
const exchangeTiers=new Map(poolVariants.map(base=>[base,addCuts(base,ARCADE_EXCHANGE_CUTS)]));
const minorTiers=new Map([...poolVariants,...exchangeTiers.values()].map(base=>[base,addCuts(base,ARCADE_MINOR_MOVES)]));
export function arcadeMovesFor(form,gradeIndex=0,{tactical=false,rankCuts=false,circuitCuts=false,arenaCuts=false,exchangeVariety=false,minorMoves=false}={}){
  const index=Number(tactical===true)+2*Number(rankCuts===true);
  const options=arenaCuts?arenaTiers[index+4*Number(circuitCuts===true)]:circuitCuts?circuitTiers[index]:
    rankCuts?(tactical?allCutTiers:cutTiers):(tactical?allTiers:tiers);
  const selected=exchangeVariety===true?exchangeTiers.get(options):options;
  return (minorMoves===true?minorTiers.get(selected):selected)?.[form]?.[rankOf(gradeIndex)]??EMPTY;
}
export function arcadeTacticsFor(form,gradeIndex=0){
  return tacticTiers[form]?.[rankOf(gradeIndex)]??EMPTY;
}

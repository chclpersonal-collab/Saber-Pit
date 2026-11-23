type Spec=[number,number,number,number,number,number,number,number,number];
type Flags={opening?:string;air?:string;deflect?:boolean;cap?:number;launch?:boolean;tactical?:string};
/** Original hand-authored Saber Pit exchanges. Numerical timings are in seconds
 * and geometry in game units. Each row is consumed by the repertoire's queue,
 * hit solver and shared weapon pose, rather than choosing a display alias. */
const pose=(path:string,chamber:number,finish:number,wind:number,cut:number,reach:number,lift:number,lean:number,brace:number,twist:number,lead:number)=>Object.freeze({
  path,chamber,finish,wind,cut,reach,lift,lean,brace,twist,lead
});
const row=(id:string,name:string,rank:number,role:string,action:string,fallback:string,spec:Spec,motion:ReturnType<typeof pose>,flags:Flags={})=>Object.freeze([
  id,name,rank,role,action,fallback,Object.freeze(spec),Object.freeze({...flags,motion})
] as const);
const pair=(a:ReturnType<typeof row>,b:ReturnType<typeof row>)=>Object.freeze([a,b]);
export const ARCADE_EXCHANGE_CUT_ROWS=Object.freeze({
  shii_cho:pair(
    // Fast low outside opening vs a delayed wide multi-target return.
    row('ex_sc_low_gate','Low Gate',2,'light','sweep','hook',[.208,.542,88,1.36,15,8,108,114,.17],
      pose('arc',1.10,-1.56,.42,2,5,8,-3,7,-.31,2),{opening:'outside'}),
    row('ex_sc_cornerwheel','Cornerwheel',11,'crowd','sweep','broadPivot',[.372,.890,115,2.56,26,25,112,214,.34],
      pose('arc',-2.18,1.94,.63,-6,9,4,9,11,.49,5),{cap:3,opening:'wide'})
  ),
  makashi:pair(
    // A low long point with a tiny lane; the second lies about its lane,
    // then releases a narrower quick line following the real feint stage.
    row('ex_mk_underthread','Underthread',3,'light','rush','lowpoint',[.232,.547,107,.33,16,8,166,96,.16],
      pose('point',.92,.11,.57,-3,12,7,7,6,-.19,4),{opening:'inside'}),
    row('ex_mk_false_line','False Line',8,'heavy','rush','feint',[.269,.691,119,.38,25,19,194,145,.26],
      pose('feint',-1.29,.26,.73,-5,14,-7,10,5,.23,5),{tactical:'feint_redirect',opening:'outside'})
  ),
  soresu:pair(
    // A static forward catch and a retreating moving guard cover different lines.
    row('ex_sr_raised_shutter','Raised Shutter',4,'counter','slash','bind',[.202,.523,76,.93,16,9,81,90,.18],
      pose('screen',-.91,.31,.44,1,5,-11,-5,11,.14,1),{deflect:true,opening:'intercept'}),
    row('ex_sr_foldaway','Foldaway Cover',11,'counter','slash','peel',[.283,.720,91,1.46,22,19,99,143,.27],
      pose('screen',1.31,-.93,.59,-3,5,-1,-11,12,-.27,2),{tactical:'moving_guard',deflect:true,opening:'wide'})
  ),
  ataru:pair(
    // Different actual jump arcs (cross vs higher flight), and different
    // release: short descending slash versus longer reaching overhead cut.
    row('ex_at_skip_cross','Skip Cross',3,'light','slash','crossVault',[.219,.644,86,1.13,15,12,158,96,.16],
      pose('aerial',-.96,1.39,.46,-6,6,-7,4,6,.19,5),{air:'crossVault',opening:'inside'}),
    row('ex_at_roof_drop','Roof Drop',10,'heavy','uppercut','highVault',[.402,.907,111,.96,28,25,189,220,.36],
      pose('aerial',-2.34,-.82,.68,-10,9,-17,11,11,-.34,4),{air:'highVault',opening:'outside'})
  ),
  djem_so:pair(
    row('ex_ds_braced_return','Braced Return',4,'counter','slash','anchorEdge',[.230,.578,83,1.16,22,12,94,148,.24],
      pose('diagonal',1.24,-1.08,.49,4,5,-1,4,13,-.27,1),{opening:'intercept'}),
    row('ex_ds_upheave','Upheave',10,'heavy','uppercut','sunder',[.364,.807,99,.84,31,23,130,237,.39],
      pose('diagonal',1.85,-2.14,.62,4,7,-16,11,15,-.44,5),{launch:true,opening:'intercept'})
  ),
  niman:pair(
    row('ex_nm_threaded_step','Threaded Step',4,'counter','slash','crossStep',[.252,.611,87,1.06,18,12,122,127,.22],
      pose('diagonal',-1.10,1.25,.53,-7,6,-3,2,4,.35,5),{tactical:'slip_counter',opening:'inside'}),
    row('ex_nm_split_fan','Split Fan',11,'crowd','sweep','twinOrbit',[.324,.775,107,2.12,23,21,124,155,.29],
      pose('arc',1.76,-1.90,.52,2,8,4,6,6,-.41,3),{cap:2,opening:'wide'})
  ),
  juyo:pair(
    row('ex_jy_stolen_beat','Stolen Beat',4,'light','slash','snapHook',[.168,.462,81,.94,15,8,154,102,.17],
      pose('diagonal',1.47,-.72,.29,4,4,-2,8,3,-.30,6),{opening:'outside'}),
    row('ex_jy_crossfire_turn','Crossfire Turn',10,'heavy','sweep','stormReturn',[.298,.706,108,1.58,29,23,191,194,.33],
      pose('arc',-1.91,1.71,.55,-5,10,2,13,9,.48,7),{cap:2,opening:'inside'})
  ),
});

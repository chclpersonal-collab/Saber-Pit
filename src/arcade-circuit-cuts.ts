// @ts-nocheck
/** Circuit-only saber phrases. Existing engine contact and the rendered
 * rig share these precise timing and geometry values. */
const rows={
  shii_cho:[
    ['sc_gate_feeler','Gate Feeler','light','sweep','arc','outside',1.26,-.98,.247,.617,103,1.22,14,9,121,1],
    ['sc_reversed_compass','Reversed Compass','crowd','sweep','arc','wide',2.01,-1.58,.397,.925,123,2.26,27,27,135,3]],
  makashi:[
    ['mk_brief_engagement','Brief Engagement','light','rush','point','inside',-.57,.19,.205,.547,94,.34,14,9,143,1],
    ['mk_receding_counter','Receding Counter','counter','rush','point','intercept',1.02,-.21,.188,.607,122,.39,21,19,116,1]],
  soresu:[
    ['sr_side_canopy','Side Canopy','heavy','slash','screen','outside',1.05,-.62,.314,.704,85,.94,17,15,82,1],
    ['sr_closing_shutter','Closing Shutter','counter','slash','screen','intercept',-1.04,.48,.185,.640,81,1.02,18,16,72,1]],
  ataru:[
    ['at_skip_edge','Skip Edge','light','slash','diagonal','outside',1.09,-.94,.228,.584,92,1.08,16,10,158,1],
    ['at_back_arc_vault','Back-Arc Vault','crowd','rush','aerial','wide',1.88,-1.42,.402,.956,121,1.82,25,29,237,3]],
  djem_so:[
    ['ds_braced_entry','Braced Entry','heavy','sweep','diagonal','inside',-2.12,.82,.395,.918,103,1.11,23,19,127,1],
    ['ds_closing_press','Closing Press','counter','uppercut','diagonal','intercept',1.47,-1.10,.210,.723,99,.98,26,22,122,1]],
  niman:[
    ['nm_splitting_beat','Splitting Beat','light','slash','diagonal','outside',1.05,-.82,.240,.568,94,1.14,15,9,125,1],
    ['nm_detouring_circle','Detouring Circle','heavy','sweep','arc','inside',-1.61,1.03,.339,.843,113,1.68,23,22,130,2]],
  juyo:[
    ['jy_staggered_cut','Staggered Cut','light','slash','diagonal','outside',1.35,-1.24,.237,.556,98,1.20,16,12,172,1],
    ['jy_broken_pendulum','Broken Pendulum','heavy','sweep','arc','inside',-1.93,1.60,.319,.848,115,1.84,28,27,179,2]],
};

export const ARCADE_CIRCUIT_CUTS=Object.freeze(Object.entries(rows).flatMap(([form,entries])=>entries.map((def,index)=>{
  const [suffix,name,role,mapAction,path,opening,chamber,finish,contact,duration,reach,arc,damage,cost,lunge,cap]=def;
  const motion=Object.freeze({path,chamber,finish,
    wind:opening==='intercept'?.41:role==='heavy'?.67:.55,cut:chamber<0?-3:2,reach:path==='point'?10:5,
    lift:path==='aerial'?-9:path==='screen'?2:form==='djem_so'?-8:-3,lean:form==='soresu'?-3:8,
    brace:form==='djem_so'?11:role==='crowd'?7:5,twist:chamber*.23,lead:path==='point'?4:2});
  return Object.freeze({id:'ct_'+suffix,name,form,minRank:index===0?3:13,
    role,mapAction,motion,opening,contact,duration,reach,arc,damage,cost,lunge,cap,
    knock:82+damage*4,recoil:.15+damage*.006,circuitCut:true,
    ...(path==='aerial'?{air:'crossVault'}:{}),...(path==='screen'?{deflect:true}:{}),
    ...(mapAction==='uppercut'?{launch:true}:{}),
  });
})));

export const CIRCUIT_CUT_HINTS=Object.freeze({
  ct_sc_gate_feeler:'Quick outside arc for nearby space.',
  ct_sc_reversed_compass:'Wide reverse sweep that can reach several foes.',
  ct_mk_brief_engagement:'Fast, narrow point on a clean line.',
  ct_mk_receding_counter:'Long stopping point with less forward travel.',
  ct_sr_side_canopy:'Compact side screen with a longer recovery.',
  ct_sr_closing_shutter:'Fast, close defensive answer.',
  ct_at_skip_edge:'Quick grounded cut with forward momentum.',
  ct_at_back_arc_vault:'Broad aerial arc with a committed landing.',
  ct_ds_braced_entry:'Heavy braced cut with a deliberate windup.',
  ct_ds_closing_press:'Tight rising counter that can launch on contact.',
  ct_nm_splitting_beat:'Light outside cut for changing rhythm.',
  ct_nm_detouring_circle:'Wider inside sweep that can catch two foes.',
  ct_jy_staggered_cut:'Fast outside slash with aggressive travel.',
  ct_jy_broken_pendulum:'Committed inside return with broad coverage.',
});

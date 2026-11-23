/** Additional original saber commitments. Ranks unlock alternatives, not
 * stronger copies: each cut exchanges reach, timing, coverage or recovery. */
const rows={
  shii_cho:[
    ['cross_step','Cross-Step Cut','arc','inside',-1.45,.95, .259,.610, 94,1.39,15,10,124],
    ['return_gate','Return Gate','arc','outside',1.60,-1.15, .300,.730,103,1.59,22,19,124],
    ['crossing_wheel','Crossing Wheel','arc','wide',-1.96,1.70, .392,.896,112,2.17,27,27,125],
    ['falling_gate','Falling Gate','diagonal','intercept',.98,-.84, .189,.608,84,.94,20,18,108]],
  makashi:[
    ['shallow_disengage','Shallow Disengage','point','inside',-.74,.33, .234,.552,97,.43,14,8,148],
    ['outside_pass','Outside Pass','point','outside',.92,-.28, .306,.703,124,.45,24,18,178],
    ['descending_cross','Descending Cross','diagonal','wide',-1.49,1.1, .362,.849,103,1.49,24,23,139],
    ['half_time_point','Half-Time Point','point','intercept',.64,-.12, .181,.580,101,.33,21,17,184]],
  soresu:[
    ['inside_cover','Inside Cover','screen','inside',-.77,.52, .240,.544,80,.88,13,7,79],
    ['outside_hinge','Outside Hinge','screen','outside',1.06,-.64, .294,.689,87,1.14,19,16,88],
    ['folding_circle','Folding Circle','arc','wide',-1.27,1.23, .370,.839,99,1.81,21,22,90],
    ['hinge_reply','Hinge Reply','screen','intercept',.81,-.49, .177,.569,77,.88,16,14,73]],
  ataru:[
    ['spring_diagonal','Spring Diagonal','diagonal','inside',-1.32,.79, .234,.553,89,1.03,16,10,153],
    ['turning_vault','Turning Vault','aerial','outside',1.78,-1.15, .366,.875,109,1.09,23,22,211],
    ['horizon_wheel','Horizon Wheel','aerial','wide',-1.70,1.47, .391,.937,116,1.79,26,26,229],
    ['springback_cut','Springback Cut','diagonal','intercept',.98,-1.06, .186,.627,83,.99,20,20,139]],
  djem_so:[
    ['inside_leverage','Inside Leverage','diagonal','inside',-1.34,.79, .274,.643,87,1.03,17,10,110],
    ['falling_brace','Falling Brace','diagonal','outside',2.24,-.87, .376,.876,112,1.15,27,22,128],
    ['turning_anvil','Turning Anvil','arc','wide',-1.64,1.48, .409,.931,113,1.86,29,28,118],
    ['rising_leverage','Rising Leverage','diagonal','intercept',1.20,-1.02, .203,.684,91,.91,24,21,117]],
  niman:[
    ['inside_current','Inside Current','diagonal','inside',-1.03,.85, .246,.587,91,1.10,15,8,115],
    ['drifting_gate','Drifting Gate','arc','outside',1.38,-1.18, .316,.753,106,1.50,22,18,125],
    ['forked_current','Forked Current','arc','wide',-1.57,1.31, .371,.849,110,1.96,24,23,123],
    ['center_return','Center Return','diagonal','intercept',.92,-.87, .192,.593,89,.95,19,16,107]],
  juyo:[
    ['inside_rake','Inside Rake','diagonal','inside',-1.36,1.12, .224,.563,92,1.16,17,11,156],
    ['offbeat_lash','Offbeat Lash','diagonal','outside',1.51,-1.34, .281,.714,108,1.37,24,23,162],
    ['backward_wheel','Backward Wheel','arc','wide',-1.76,1.66, .357,.832,115,2.02,29,30,174],
    ['half_beat_rake','Half-Beat Rake','diagonal','intercept',1.13,-1.39, .178,.610,88,1.04,21,22,165]],
};
const prefixes={shii_cho:'sc',makashi:'mk',soresu:'sr',ataru:'at',djem_so:'ds',niman:'nm',juyo:'jy'};
const minRanks=[2,7,10,14];
const roles=['light','heavy','crowd','light'];
const keys=Object.entries(rows);
export const ARCADE_RANK_CUTS=Object.freeze(keys.flatMap(([form,rows])=>rows.map((row,i)=>{
  const [tag,name,path,opening,chamber,finish,contact,duration,reach,arc,damage,cost,lunge]=row;
  const motion=Object.freeze({path,chamber,finish,wind:opening==='intercept'?.44:.56,cut:-2,
    reach:path==='point'?10:5,lift:path==='aerial'?-7:path==='screen'?1:-3,lean:path==='screen'?-2:6,
    brace:opening==='wide'?8:5,twist:chamber*.20,lead:path==='point'?5:2});
  const air=path==='aerial'?(i===1?'crossVault':'highVault'):null;
  return Object.freeze({id:prefixes[form]+'_trained_'+tag,name,form,minRank:minRanks[i],role:roles[i],
    mapAction:path==='point'||air?'rush':path==='arc'?'sweep':'slash',motion,opening,
    contact,duration,reach,arc,damage,cost,lunge,knock:87+damage*3,recoil:i===3?.24:.16+i*.055,
    cap:i===2?(form==='makashi'?2:3):1,...(air?{air}:{}),...(path==='screen'&&i>0?{deflect:true}:{})});
})));

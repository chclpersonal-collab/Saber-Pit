// Declarative presets. Match start still passes through the validated setup form.
const freeze = config => Object.freeze({...config, forms:Object.freeze(config.forms)});
export const QUICK_FIGHTS = Object.freeze({
  duel: freeze({mode:'play', friendly:1, enemy:1, rules:'elimination', duration:45, map:'crossroads', weather:'clear', rank:'A', forms:['makashi'], opponent:'soresu', modifier:'saber_only'}),
  relic: freeze({mode:'command', friendly:3, enemy:3, rules:'relic', duration:90, map:'zigzag', weather:'rain', rank:'B', forms:['ataru','soresu','niman'], opponent:'mixed', modifier:'standard'}),
  showdown: freeze({mode:'spectate', friendly:5, enemy:5, rules:'elimination', duration:90, map:'craterfield', weather:'clear', rank:'SS', formation:'spread', priority:'nearest', forms:['ataru','djem_so','juyo','makashi','niman'], opponent:'mixed', modifier:'standard'})
});

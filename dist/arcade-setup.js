import {normalizeHeroPick} from './arcade-heroes.js?v=2.42.0';
import {SOLDIER_GRADES} from './progression.js?v=1.4.0';
import {normalizeArcadeGear} from './arcade-loadouts.js?v=3.1.0';
import {normalizeArcadeChessStyle,arcadeChessStyleForId} from './arcade-chess-styles.js?v=2.44.0';
const FORMS=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const RANKS=SOLDIER_GRADES.map(x=>x.label);
export const ARCADE_MAX_FIGHTERS=24;
export const ARCADE_SETUP_KEY='saber-pit-arcade-setup-v1';
export const ARCADE_MAPS={
  rotation:['Arena rotation','Open rings that rotate each round. No walls.'],
  underpit:['The Underpit','Open arena with clear sightlines.'],
  foundry:['The Foundry','Open forge court under timber arches.'],
  ember_ring:['Ember Ring','Open rooftop ring above a dusk village.'],
  crossroads:['Crossroads','Multiple approaches around central walls.'],
  zigzag:['Zigzag','Staggered barriers break up direct approaches.'],
  craterfield:['Craterfield','Rough ground and dangerous vents. Watch your footing.']
};
export const SIZE={
  small:[960,540], medium:[1280,720], large:[1600,900]
};
export const presets={
  duel:{participation:'play',teamSizes:[1,1],rule:'elimination'},
  squad:{participation:'play',teamSizes:[3,3],rule:'elimination'},
  watch:{participation:'watch',teamSizes:[5,5],rule:'elimination'},
  master:{participation:'watch',teamSizes:[1,15],rule:'elimination',startingRanks:['SSS+V','F']}
};
function pick(value,choices,def){return choices.includes(value)?value:def;}
const arenaChessStyle=value=>{
  const style=normalizeArcadeChessStyle(value);
  return style==='none'?'mixed':style;
};
function integer(value,min,max,def){return value===''||value===null||value===undefined||!Number.isFinite(Number(value))?def:Math.max(min,Math.min(max,Math.trunc(Number(value))));}
export function normalizeSetup(raw={}){
  raw=raw&&typeof raw==='object'?raw:{};
  const form=pick(raw.form,['mixed',...FORMS],'makashi');
  const fixedForm=form==='mixed'?pick(raw.fixedForm,FORMS,'makashi'):form;
  const teamSizes=[0,1].map(i=>integer(raw.teamSizes?.[i],1,ARCADE_MAX_FIGHTERS,3));
  return {
    ...normalizeArcadeGear(raw),
    environment:pick(raw.environment,['clear','rain','fog','sandstorm'],'clear'),
    deployments:[0,1].map(i=>pick(raw.deployments?.[i],['standard','forward','reserve'],'standard')),
    participation:pick(raw.participation,['play','watch','command'],'play'),
    teamSizes, heroPicks: teamSizes.map((count,i)=>normalizeHeroPick(raw.heroPicks?.[i],count)), rule:pick(raw.rule,['elimination','control','relic'],'elimination'),
    duration:pick(+raw.duration,[45,75,90,150],90),
    mapId:pick(raw.mapId,Object.keys(ARCADE_MAPS),'rotation'),
    mapSize:pick(raw.mapSize,Object.keys(SIZE),'medium'),
    form,fixedForm,body:pick(raw.body,['femboy','woman','rabbit'],'femboy'),
    playerSlot:integer(raw.playerSlot,0,teamSizes[0]-1,0), pace:pick(+raw.pace,[.75,1,1.5,2,4],1),
    seed:integer(raw.seed,1,4294967295,null), saberOnly:raw.saberOnly===true,
    startingRanks:[0,1].map(i=>pick(raw.startingRanks?.[i],RANKS,'F')),
    chessStyles:[0,1].map(i=>arenaChessStyle(raw.chessStyles?.[i])),
    doctrines:[0,1].map(i=>pick(raw.doctrines?.[i],['balanced','aggressive','defensive'],'balanced')),
    targeting:[0,1].map(i=>pick(raw.targeting?.[i],['balanced','nearest','weakest','objective'],'balanced')),
    formations:[0,1].map(i=>pick(raw.formations?.[i],['line','wedge','spread'],'line')),
    groupForms:[0,1].map(i=>pick(raw.groupForms?.[i],['mixed',...FORMS],'mixed')),
    teamForms:[0,1].map(i=>Array.from({length:ARCADE_MAX_FIGHTERS},(_,j)=>pick(raw.teamForms?.[i]?.[j],['mixed',...FORMS],null)))
  };
}
// Fighter / Mixed is a lobby presentation of the same controlled engine
// mode. Keep the concrete form on hand when the player switches back.
export function setupPlayAs(cfg){
  return cfg.participation==='play'&&cfg.form==='mixed'?'play-mixed':cfg.participation;
}
export function playAsSetup(value,style,prior){
  const fixedForm=pick(style,FORMS,prior.fixedForm);
  return {participation:value==='play-mixed'?'play':value,
    form:value==='play-mixed'?'mixed':value==='play'?fixedForm:prior.form,fixedForm};
}
export function setupMode(cfg){
  return cfg.participation==='watch'?'watch':cfg.participation==='command'?'command':cfg.teamSizes.every(n=>n===1)?'duel':'squad';
}
// An explicit shortcut only: ordinary lobby edits never change Play As.
export function watchHeroSetup(cfg,heroes,requestedId){
  if(!Array.isArray(heroes))return null;
  const fallback=cfg?.heroPicks?.map(p=>p.id)??[];
  const ids=requestedId?[requestedId]:[...fallback,...heroes.map(hero=>hero?.id)];
  const hero=ids.map(id=>heroes.find(row=>row?.id===id)).find(row=>row?.id);
  if(!hero)return null;
  return normalizeSetup({...cfg,participation:'watch',rule:'elimination',teamSizes:[1,3],
    startingRanks:['SSS+V','SSS+V'],playerSlot:0,heroPicks:[{id:hero.id,slot:0},{id:'',slot:0}]});
}
export function lobbyHeroControl(cfg,team){
  const hero=cfg?.heroPicks?.[team];
  if(!hero?.id)return null;
  return team===0&&cfg.participation==='play'&&hero.slot===cfg.playerSlot?'manual':'ai';
}
export function engineLineups(cfg){
  const result=cfg.teamForms.map((team,i)=>team.slice(0,cfg.teamSizes[i]).map(form=>form??cfg.groupForms[i]));
  if(cfg.participation==='play')result[0][cfg.playerSlot]=cfg.form;
  return result;
}
// On a Mixed side a saved Hero keeps the chess style attached to their ID;
// non-Hero slots are filled by the engine's seeded Mixed rotation.
export function engineChessStyleOverrides(cfg,heroLineup){
  return cfg.teamSizes.map((size,i)=>Array.from({length:size},(_,slot)=>{
    const id=heroLineup?.[i+'-'+slot]?.id;
    return cfg.chessStyles[i]==='mixed'&&typeof id==='string'&&id?arcadeChessStyleForId(id):undefined;
  }));
}
export function loadSetup(storage){
  try{return normalizeSetup(JSON.parse((storage??globalThis.localStorage).getItem(ARCADE_SETUP_KEY)));}
  catch{return normalizeSetup();}
}
export function saveSetup(value,storage){
  try{(storage??globalThis.localStorage).setItem(ARCADE_SETUP_KEY,JSON.stringify(normalizeSetup(value)));return true;}
  catch{return false;}
}

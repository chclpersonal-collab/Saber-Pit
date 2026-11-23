import {TOURNAMENT_KEY,loadTournament} from './arcade-tournament.js?v=3.0.0';
import {SQUAD_TOURNAMENT_KEY,loadSquadTournament} from './squad-tournament.js?v=2.40.0';
import {GAUNTLET_KEY,GAUNTLET_MAX_SAVE_CHARS,normalizeGauntlet} from './gauntlet-tournament.js';
import {QUEST_STORAGE_KEY,loadQuests} from './arcade-quests.js?v=3.3.0';

export const BACKUP_FORMAT='saber-pit-local-backup';
export const MAX_BACKUP_BYTES=2_500_000;
const CONFIG={
  duel:{key:TOURNAMENT_KEY,limit:1_000_000,versions:[1],load:loadTournament,tables:['records','heroes'],label:'1v1 tournament'},
  squad:{key:SQUAD_TOURNAMENT_KEY,limit:1_000_000,versions:[1],load:loadSquadTournament,tables:['teams'],label:'5v5 tournament'},
  gauntlet:{key:GAUNTLET_KEY,limit:GAUNTLET_MAX_SAVE_CHARS,versions:[1],label:'1v3 Gauntlet'},
  quest:{key:QUEST_STORAGE_KEY,limit:36_000,versions:[1,2],load:loadQuests,tables:[],label:'The Bell Beneath'},
};
export const BACKUP_SECTIONS=Object.freeze(Object.fromEntries(Object.entries(CONFIG).map(([k,o])=>[k,o.label])));
const object=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const has=(o,k)=>Object.hasOwn(o,k);
const bytes=s=>new TextEncoder().encode(s).length;
const store=storage=>storage===undefined?globalThis.localStorage:storage;
const fail=error=>({ok:false,error});
function normalized(config,raw){
  if(!object(raw)||!config.versions.includes(raw.version))throw new Error(config.label+' has an unsupported save format.');
  const payload=JSON.stringify(raw);
  if(payload.length>config.limit)throw new Error(config.label+' exceeds its local save limit.');
  if(config.key===GAUNTLET_KEY){
    const state=normalizeGauntlet(raw);
    if(!state)throw new Error('1v3 Gauntlet contains invalid progress.');
    return state;
  }
  if(config.tables.some(key=>!object(raw[key]))||(!config.tables.length&&!has(raw,'run')))throw new Error(config.label+' is missing required save data.');
  const state=config.load({getItem:key=>key===config.key?payload:null});
  const entityIds=(o,key)=>Object.keys(o[key]??{}).sort().join('|');
  if(config.tables.some(key=>entityIds(raw,key)!==entityIds(state,key)))throw new Error(config.label+' contains invalid roster entries.');
  if(raw.active!=null&&state.active==null||raw.run!=null&&state.run==null||raw.campaign!==undefined&&!state.campaign)
    throw new Error(config.label+' contains invalid active progress.');
  if(config.tables.length&&(!Number.isSafeInteger(raw.season)||raw.season<0||state.season!==raw.season||
    !Array.isArray(raw.history)||state.history.length!==raw.history.length||
    (raw.peaks!==undefined&&(!object(raw.peaks)||entityIds(raw,'peaks')!==entityIds(state,'peaks')))))
    throw new Error(config.label+' contains invalid career history.');
  if(state.active){
    const stages=[raw.active.qualifiers,raw.active.opening,...(Array.isArray(raw.active.rounds)?raw.active.rounds:[])];
    const actual=[state.active.qualifiers,state.active.opening,...state.active.rounds].flatMap(a=>Array.isArray(a)?a:[]);
    const results=stages.flatMap(a=>Array.isArray(a)?a:[]);
    const finished=rows=>rows.filter(row=>row?.result).map(row=>row.id).sort().join('|');
    if(finished(results)!==finished(actual))throw new Error(config.label+' contains invalid settled matches.');
  }
  return state;
}
function entries(value,config,k){
  if(k==='quest'){
    const run=value.run,campaign=value.campaign;
    const legacy=run?.claimedAt!=null?'Seal claimed':run?.result?.status??(run?'Legacy duel deployed':'No attempt');
    return {label:config.label,attempts:run?.attempt??0,questStatus:campaign?'Campaign progress saved':legacy};
  }
  if(k==='gauntlet')return {label:config.label,seasons:value.season,records:Object.keys(value.fighters).length,heroes:0,peaks:0};
  return {label:config.label,seasons:value.season,records:Object.keys(value[k==='duel'?'records':'teams']).length,
    heroes:k==='duel'?Object.keys(value.heroes).length:0,peaks:Object.keys(value.peaks??{}).length};
}
export function inspectArcadeBackup(text){
  try{
    if(typeof text!=='string'||text.length>MAX_BACKUP_BYTES||bytes(text)>MAX_BACKUP_BYTES)return fail('This file is larger than the backup limit.');
    const raw=JSON.parse(text);
    if(raw?.format!==BACKUP_FORMAT||raw.version!==1||!object(raw.sections))
      return fail('Choose a Saber Pit backup JSON file.');
    const included=Object.keys(raw.sections);
    if(!included.length||included.some(k=>!has(CONFIG,k)))return fail('The backup contains no supported set of saves.');
    const sections={},summary={};
    for(const k of included){
      const config=CONFIG[k], clean=normalized(config,raw.sections[k]);
      sections[k]=clean;summary[k]=entries(clean,config,k);
    }
    return {ok:true,bundle:{format:BACKUP_FORMAT,version:1,createdAt:typeof raw.createdAt==='string'?raw.createdAt.slice(0,40):null,sections},summary};
  }catch(e){return fail(e instanceof SyntaxError?'This file is not valid JSON.':e.message||'Backup validation failed.');}
}
export function exportArcadeBackup(storage,{sections=Object.keys(CONFIG),now=new Date()}={}){
  try{
    const source=store(storage);
    if(!source)return fail('Browser storage is unavailable.');
    const states={};
    for(const k of new Set(sections)){
      if(!has(CONFIG,k))return fail('Unsupported save section.');
      const config=CONFIG[k], value=source.getItem(config.key);
      if(value===null||value===undefined)continue;
      if(value.length>config.limit)return fail(config.label+' exceeds its local save limit.');
      states[k]=normalized(config,JSON.parse(value));
    }
    if(!Object.keys(states).length)return fail('There are no saved sections in this browser yet.');
    const bundle={format:BACKUP_FORMAT,version:1,createdAt:new Date(now).toISOString(),sections:states};
    const text=JSON.stringify(bundle,null,2);
    // For large mounted careers use compact JSON instead of dropping data.
    const output=bytes(text)<=MAX_BACKUP_BYTES?text:JSON.stringify(bundle);
    return bytes(output)<=MAX_BACKUP_BYTES?{ok:true,text:output,bundle}:fail('This backup is larger than the file limit. Export fewer sections.');
  }catch(e){return fail(e instanceof SyntaxError?'A local save could not be read.':e.message||'Export failed.');}
}
export function restoreArcadeBackup(inspection,storage,{sections}={}){
  try{
    if(!inspection?.ok)return fail('Validate a backup before importing.');
    const checked=inspectArcadeBackup(JSON.stringify(inspection.bundle));
    if(!checked.ok)return checked;
    const available=checked.bundle.sections, picked=[...new Set(sections??Object.keys(available))];
    if(!picked.length||picked.some(k=>!has(available,k)))return fail('Select at least one included save section.');
    const target=store(storage);
    if(!target||typeof target.getItem!=='function'||typeof target.setItem!=='function'||typeof target.removeItem!=='function')
      return fail('Writable browser storage is unavailable.');
    const operations=picked.map(k=>({key:CONFIG[k].key,value:JSON.stringify(available[k]),previous:target.getItem(CONFIG[k].key)}));
    const touched=[];
    try{
      for(const operation of operations){
        touched.push(operation);
        target.setItem(operation.key,operation.value);
      }
    }catch{
      let rollback=true;
      for(const operation of touched.reverse()){
        try{
          if(target.getItem(operation.key)===operation.previous)continue;
          if(operation.previous==null)target.removeItem(operation.key);
          else target.setItem(operation.key,operation.previous);
        }catch{rollback=false;}
      }
      return {...fail(rollback?'Import failed. Your previous saves were restored.':'Import failed, and some saves could not be rolled back. Keep the backup file.'),rollback};
    }
    return {ok:true,restored:picked};
  }catch{return fail('Could not prepare the import. No changes were made.');}
}

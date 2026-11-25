import {TOURNAMENT_KEY,loadTournament} from './arcade-tournament.js?v=6.0.2-rc2';
import {SQUAD_TOURNAMENT_KEY,loadSquadTournament} from './squad-tournament.js?v=6.0.2-rc2';
import {GAUNTLET_KEY,GAUNTLET_MAX_SAVE_CHARS,normalizeGauntlet} from './gauntlet-tournament.js?v=6.0.2-rc2';
import {ARCADE_CAREER_KEY,readArcadeCareer} from './arcade-career.js?v=6.0.2-rc2';
import {normalizeHeroLineup} from './arcade-heroes.js?v=6.0.2-rc2';
import {arenaNormalRating} from './arcade-normal-elo.js?v=6.0.2-rc2';
import {QUEST_STORAGE_KEY,loadQuests} from './arcade-quests.js?v=6.0.2-rc2';

import type {QuestSave} from './arcade-quests.js?v=6.0.2-rc2';
import type {SaveStorage, StorageReader} from './arcade-save-types.js?v=6.0.2-rc2';

export type BackupSection = 'arena' | 'duel' | 'squad' | 'gauntlet' | 'quest';
interface SavedMatch { id: string; result?: unknown }
interface SavedBracket { qualifiers?: SavedMatch[]; opening?: SavedMatch[]; rounds: SavedMatch[][] }
interface TournamentSave { version: number; active?: SavedBracket | null; season: number; history: unknown[]; peaks?: Record<string,unknown> }
export interface DuelSave extends TournamentSave { records: Record<string,unknown>; heroes: Record<string,unknown> }
export interface SquadSave extends TournamentSave { teams: Record<string,unknown> }
export type GauntletSave = NonNullable<ReturnType<typeof normalizeGauntlet>>;
export type ArenaSave = NonNullable<ReturnType<typeof readArcadeCareer>>;
export interface BackupStates { arena: ArenaSave; duel: DuelSave; squad: SquadSave; gauntlet: GauntletSave; quest: QuestSave }
export interface BackupBundle {
  format: 'saber-pit-local-backup';
  version: 1;
  createdAt?: string | null;
  sections: Partial<BackupStates>;
}
export interface CareerSummary { label: string; seasons: number; records: number; heroes: number; peaks: number }
export interface QuestSummary { label: string; attempts: number; questStatus: string }
export interface ArenaSummary {label:string;round:number;fighters:number;ratedFighters:number}
export type BackupSummary = Partial<Record<BackupSection, CareerSummary | QuestSummary | ArenaSummary>>;
export interface BackupFailure { ok: false; error: string; rollback?: boolean }
export interface BackupInspection { ok: true; bundle: BackupBundle; summary: BackupSummary }
export interface BackupExport { ok: true; bundle: BackupBundle; text: string }
export interface BackupRestored { ok: true; restored: BackupSection[] }
interface SectionConfig {
  readonly key: string;
  readonly limit: number;
  readonly versions: readonly number[];
  readonly label: string;
  readonly tables?: readonly string[];
  readonly load?: (storage: StorageReader) => unknown;
}
interface UncheckedSection {
  version?: number;
  active?: SavedBracket | null;
  run?: unknown;
  campaign?: unknown;
  season?: number;
  history?: unknown[];
  peaks?: unknown;
  [prop: string]: unknown;
}
interface ImportOperation { key: string; value: string; previous: string | null | undefined }

export const BACKUP_FORMAT='saber-pit-local-backup';
export const MAX_BACKUP_BYTES=3_100_000;
const CONFIG: Readonly<Record<BackupSection,SectionConfig>>={
  arena:{key:ARCADE_CAREER_KEY,limit:160_000,versions:[1],label:'Arena run'},
  duel:{key:TOURNAMENT_KEY,limit:1_000_000,versions:[1],load:loadTournament,tables:['records','heroes'],label:'1v1 tournament'},
  squad:{key:SQUAD_TOURNAMENT_KEY,limit:1_000_000,versions:[1],load:loadSquadTournament,tables:['teams'],label:'5v5 tournament'},
  gauntlet:{key:GAUNTLET_KEY,limit:GAUNTLET_MAX_SAVE_CHARS,versions:[1],label:'1v3 Gauntlet'},
  quest:{key:QUEST_STORAGE_KEY,limit:36_000,versions:[1,2],load:loadQuests,tables:[],label:'The Bell Beneath'},
};
export const BACKUP_SECTIONS=Object.freeze(Object.fromEntries(Object.entries(CONFIG).map(([k,o])=>[k,o.label])));
const object=(v: unknown): boolean=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const has=(o: object,k: PropertyKey)=>Object.hasOwn(o,k);
const bytes=(s: string)=>new TextEncoder().encode(s).length;
const store=<T extends StorageReader>(storage: T | null | undefined): T | Storage | null=>storage===undefined?globalThis.localStorage:storage;
const fail=(error: string): BackupFailure=>({ok:false,error});
const sameKeys=(left:object,right:object)=>Object.keys(left).sort().join('|')===Object.keys(right).sort().join('|');
const slotId=/^[01]-(?:[0-9]|1[0-9]|2[0-3])$/;
const isRecord=(value:unknown):value is Record<string,unknown>=>object(value);
function validArenaRecords(value:unknown) {
  if(value===undefined||value===null)return true;
  if(!isRecord(value)||!Array.isArray(value.teams)||value.teams.length!==2||
    !Array.isArray(value.soldiers)||value.soldiers.length>48)return false;
  const counters=(row:unknown)=>isRecord(row)&&['kills','deaths','assists','environmentDeaths'].every(key=>
    row[key]===undefined||(typeof row[key]==='number'&&Number.isSafeInteger(row[key])&&row[key]>=0&&row[key]<=1e9));
  return value.teams.every(counters)&&value.soldiers.every(row=>counters(row)&&isRecord(row)&&
    typeof row.id==='string'&&slotId.test(row.id))&&new Set(value.soldiers.map(row=>row.id)).size===value.soldiers.length;
}
function normalizeArena(raw:UncheckedSection,payload:string,key:string):ArenaSave {
  const loaded=readArcadeCareer({getItem:k=>k===key?payload:null});
  if(!loaded||!isRecord(raw.careers)||!sameKeys(raw.careers,loaded.careers)||
    !Object.entries(raw.careers).every(([id,row])=>isRecord(row)&&row.merit===loaded.careers[id]?.merit)||
    (raw.setup!==undefined&&!isRecord(raw.setup))||
    (raw.heroLineup!==undefined&&(!isRecord(raw.heroLineup)||
      !sameKeys(raw.heroLineup,normalizeHeroLineup(loaded.heroLineup))))||!validArenaRecords(raw.records))
    throw new Error('Arena run contains invalid career progress.');
  if(raw.arenaRatings!==undefined&&(!isRecord(raw.arenaRatings)||
    !sameKeys(raw.arenaRatings,loaded.arenaRatings)||!Object.entries(raw.arenaRatings).every(([slot,rating])=>
      typeof rating==='number'&&rating===arenaNormalRating(rating)&&loaded.arenaRatings[slot]===rating)))
    throw new Error('Arena run contains invalid Elo ratings.');
  return loaded;
}
function normalized(config: SectionConfig,unchecked: unknown): BackupStates[BackupSection] {
  const raw=unchecked as UncheckedSection;
  if(!object(raw)||!config.versions.includes(raw.version!))throw new Error(config.label+' has an unsupported save format.');
  const payload=JSON.stringify(raw);
  if(payload.length>config.limit)throw new Error(config.label+' exceeds its local save limit.');
  if(config.key===ARCADE_CAREER_KEY)return normalizeArena(raw,payload,config.key);
  if(config.key===GAUNTLET_KEY){
    const state=normalizeGauntlet(raw);
    // Do not advertise a full restore if the canonical parser had to drop an
    // explicitly saved replay checkpoint.
    const originalActive=raw.active as (SavedBracket&{lastFixture?:{id?:string}})|null|undefined;
    if(!state||(originalActive?.lastFixture!=null&&(!state.active?.lastFixture||
      (originalActive.lastFixture.id!==undefined&&originalActive.lastFixture.id!==state.active.lastFixture.id))))
      throw new Error('1v3 Gauntlet contains invalid progress or replay data.');
    return state;
  }
  if(config.tables!.some(key=>!object(raw[key]))||(!config.tables!.length&&!has(raw,'run')))throw new Error(config.label+' is missing required save data.');
  const state=config.load!({getItem:key=>key===config.key?payload:null}) as UncheckedSection;
  const entityIds=(o: UncheckedSection,key: string)=>Object.keys(o[key]??{}).sort().join('|');
  if(config.tables!.some(key=>entityIds(raw,key)!==entityIds(state,key)))throw new Error(config.label+' contains invalid roster entries.');
  if(raw.active!=null&&state.active==null||raw.run!=null&&state.run==null||raw.campaign!==undefined&&!state.campaign)
    throw new Error(config.label+' contains invalid active progress.');
  if(config.tables!.length&&(!Number.isSafeInteger(raw.season)||raw.season!<0||state.season!==raw.season||
    !Array.isArray(raw.history)||state.history!.length!==raw.history.length||
    (raw.peaks!==undefined&&(!object(raw.peaks)||entityIds(raw,'peaks')!==entityIds(state,'peaks')))))
    throw new Error(config.label+' contains invalid career history.');
  if(state.active){
    const stages=[raw.active!.qualifiers,raw.active!.opening,...(Array.isArray(raw.active!.rounds)?raw.active!.rounds:[])];
    const actual=[state.active.qualifiers,state.active.opening,...state.active.rounds].flatMap(a=>Array.isArray(a)?a:[]);
    const results=stages.flatMap(a=>Array.isArray(a)?a:[]);
    const finished=(rows: SavedMatch[])=>rows.filter(row=>row?.result).map(row=>row.id).sort().join('|');
    if(finished(results)!==finished(actual))throw new Error(config.label+' contains invalid settled matches.');
  }
  return state as unknown as DuelSave | SquadSave | QuestSave;
}
function entries(value: BackupStates[BackupSection],config: SectionConfig,k: BackupSection): CareerSummary | QuestSummary | ArenaSummary {
  if(k==='arena'){
    const run=value as ArenaSave;
    return {label:config.label,round:run.round!,fighters:Object.keys(run.careers).length,ratedFighters:Object.keys(run.arenaRatings).length};
  }
  if(k==='quest'){
    const {run,campaign}=value as QuestSave;
    const legacy=run?.claimedAt!=null?'Seal claimed':run?.result?.status??(run?'Legacy duel deployed':'No attempt');
    return {label:config.label,attempts:run?.attempt??0,questStatus:campaign?'Campaign progress saved':legacy};
  }
  if(k==='gauntlet')return {label:config.label,seasons:(value as GauntletSave).season,records:Object.keys((value as GauntletSave).fighters).length,heroes:0,peaks:0};
  const career=value as DuelSave | SquadSave;
  return {label:config.label,seasons:career.season,records:Object.keys(k==='duel'?(career as DuelSave).records:(career as SquadSave).teams).length,
    heroes:k==='duel'?Object.keys((career as DuelSave).heroes).length:0,peaks:Object.keys(career.peaks??{}).length};
}
export function inspectArcadeBackup(text: unknown): BackupInspection | BackupFailure {
  try{
    if(typeof text!=='string'||text.length>MAX_BACKUP_BYTES||bytes(text)>MAX_BACKUP_BYTES)return fail('This file is larger than the backup limit.');
    const raw=JSON.parse(text) as {format?: unknown; version?: unknown; createdAt?: unknown; sections: Record<string,unknown>} | null;
    if(raw?.format!==BACKUP_FORMAT||raw.version!==1||!object(raw.sections))
      return fail('Choose a Loomen backup JSON file.');
    const included=Object.keys(raw.sections) as BackupSection[];
    if(!included.length||included.some(k=>!has(CONFIG,k)))return fail('The backup contains no supported set of saves.');
    const sections: Partial<BackupStates>={},summary: BackupSummary={};
    for(const k of included){
      const config=CONFIG[k], clean=normalized(config,raw.sections[k]);
      (sections as Record<BackupSection,BackupStates[BackupSection]>)[k]=clean;summary[k]=entries(clean,config,k);
    }
    return {ok:true,bundle:{format:BACKUP_FORMAT,version:1,createdAt:typeof raw.createdAt==='string'?raw.createdAt.slice(0,40):null,sections},summary};
  }catch(e){return fail(e instanceof SyntaxError?'This file is not valid JSON.':(e as Error).message||'Backup validation failed.');}
}
export function exportArcadeBackup(storage?: StorageReader | null,{sections=Object.keys(CONFIG) as BackupSection[],now=new Date()}: {sections?: readonly BackupSection[]; now?: Date | string | number}={}): BackupExport | BackupFailure {
  try{
    const source=store(storage);
    if(!source)return fail('Browser storage is unavailable.');
    const states: Partial<BackupStates>={};
    for(const k of new Set(sections)){
      if(!has(CONFIG,k))return fail('Unsupported save section.');
      const config=CONFIG[k], value=source.getItem(config.key);
      if(value===null||value===undefined)continue;
      if(value.length>config.limit)return fail(config.label+' exceeds its local save limit.');
      (states as Record<BackupSection,BackupStates[BackupSection]>)[k]=normalized(config,JSON.parse(value));
    }
    if(!Object.keys(states).length)return fail('There are no saved sections in this browser yet.');
    const bundle: BackupBundle={format:BACKUP_FORMAT,version:1,createdAt:new Date(now).toISOString(),sections:states};
    const text=JSON.stringify(bundle,null,2);
    // For large mounted careers use compact JSON instead of dropping data.
    const output=bytes(text)<=MAX_BACKUP_BYTES?text:JSON.stringify(bundle);
    return bytes(output)<=MAX_BACKUP_BYTES?{ok:true,text:output,bundle}:fail('This backup is larger than the file limit. Export fewer sections.');
  }catch(e){return fail(e instanceof SyntaxError?'A local save could not be read.':(e as Error).message||'Export failed.');}
}
export function restoreArcadeBackup(inspection: BackupInspection | BackupFailure | null | undefined,storage?: SaveStorage | null,{sections}: {sections?: readonly BackupSection[]}={}): BackupRestored | BackupFailure {
  try{
    if(!inspection?.ok)return fail('Validate a backup before importing.');
    const checked=inspectArcadeBackup(JSON.stringify(inspection.bundle));
    if(!checked.ok)return checked;
    const available=checked.bundle.sections, picked=[...new Set(sections??(Object.keys(available) as BackupSection[]))];
    if(!picked.length||picked.some(k=>!has(available,k)))return fail('Select at least one included save section.');
    const target=store(storage);
    if(!target||typeof target.getItem!=='function'||typeof target.setItem!=='function'||typeof target.removeItem!=='function')
      return fail('Writable browser storage is unavailable.');
    const operations=picked.map(k=>({key:CONFIG[k].key,value:JSON.stringify(available[k]),previous:target.getItem(CONFIG[k].key)}));
    const touched: ImportOperation[]=[];
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

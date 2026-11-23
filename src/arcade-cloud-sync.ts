/** Cloud transport is injectable. Save contents are validated by arcade-backup
 * before either upload or import. There is no network traffic when disabled. */
import type {BackupBundle, BackupExport, BackupFailure, BackupInspection, BackupRestored, BackupSection, BackupStates, BackupSummary, DuelSave, SquadSave} from './arcade-backup.js';
import type {QuestSave} from './arcade-quests.js';
import type {SaveStorage, StorageReader} from './arcade-save-types.js';

export type RecoveryReason = 'previous-cloud' | 'previous-device';
export interface RecoveryCopy { reason: string; text: string; at: string }
interface CareerFloor { season: number; records: number; peaks: number }
interface QuestFloor { attempt: number; claimed: number; campaign: number }
type ProgressFloors = Partial<Record<Exclude<BackupSection,'quest'>,CareerFloor> & {quest: QuestFloor}>;
export interface CloudPrefs {
  enabled: boolean;
  rev: string | null;
  digest: string | null;
  pause: 'reset' | null;
  floors: ProgressFloors;
}
export type SyncAction = 'check' | 'startup' | 'enable' | 'disable' | 'device' | 'cloud';
export interface SyncRequest { action?: SyncAction; expectedRevision?: string | null; expectedLocalDigest?: string | null }
type ConflictStatus = 'conflict' | 'changed' | 'reset' | 'recovery-blocked' | 'cloud-newer';
interface SyncView { localDigest: string | null; cloudRevision: string | null; device: BackupSummary | null; cloud: BackupSummary | null }
export type SyncResult =
  | { status: 'busy' | 'disabled' }
  | { status: 'error'; error: string }
  | { status: 'empty' }
  | (SyncView & {status: ConflictStatus | 'uploaded' | 'downloaded' | 'pending' | 'current' | 'empty'});
export interface CloudSnapshot { revision: string; bundle: BackupBundle }
export interface CloudWriteRequest { revision: string | null; bundle: BackupBundle; confirmReplace?: boolean }
export type CloudWriteReply = {revision: string | null; conflict?: false} | {conflict: true; body?: {error?: string} | null};
export interface CloudTransport {
  read(options?: {timeout?: number}): Promise<CloudSnapshot | null>;
  write(options: CloudWriteRequest): Promise<CloudWriteReply>;
}
interface CloudBackupAdapter {
  exportArcadeBackup(storage: SaveStorage): BackupExport | BackupFailure;
  inspectArcadeBackup(text: unknown): BackupInspection | BackupFailure;
  restoreArcadeBackup(inspection: BackupInspection, storage: SaveStorage): BackupRestored | BackupFailure;
}
export interface CloudSyncOptions {
  storage: SaveStorage;
  transport: CloudTransport;
  backup: CloudBackupAdapter;
  preserve: (reason: RecoveryReason, text: string) => boolean | Promise<boolean>;
  hash?: (bundle?: BackupBundle | null) => Promise<string | null>;
}
interface CloudSectionRecord { revision: number; value: BackupStates[BackupSection] }
interface CloudApiReply {
  version?: number;
  section?: string;
  revision?: number;
  sections: Partial<Record<BackupSection, CloudSectionRecord>>;
  conflict?: true;
  body?: {error?: string} | null;
}
interface ApiOptions { method?: 'GET' | 'PUT'; payload?: Record<string,unknown>; timeout?: number }

export const CLOUD_SYNC_KEY='saber-pit-cloud-sync-v1';
const plain=(v: unknown): v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const revision=(v: unknown): string | null=>typeof v==='string'&&v.length<=256&&v.length?v:null;
const fallback: CloudPrefs={enabled:false,rev:null,digest:null,pause:null,floors:{}};
export function cloudSyncPrefs(storage: StorageReader): CloudPrefs {
  try{
    const v=JSON.parse(storage.getItem(CLOUD_SYNC_KEY)!) as CloudPrefs | null;
    if(v?.enabled!==true)return {...fallback};
    return {enabled:true,rev:revision(v.rev),digest:typeof v.digest==='string'?v.digest:null,
      pause:v.pause==='reset'?'reset':null,floors:plain(v.floors)?v.floors:{}};
  }catch{return {...fallback};}
}
const canonical=(v: unknown): unknown=>Array.isArray(v)?v.map(canonical):plain(v)?
  Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export async function cloudDigest(bundle?: BackupBundle | null): Promise<string | null> {
  if(!bundle)return null;
  const data=new TextEncoder().encode(JSON.stringify(canonical(bundle.sections)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
}
const sectionsOf=(b: BackupBundle | null | undefined)=>b?.sections??{};
const hasProgress=(b: BackupBundle | null | undefined)=>Object.entries(sectionsOf(b)).some(([k,state])=>
  k==='quest'?Boolean((state as QuestSave).run||(state as QuestSave).campaign?.revision):((state as DuelSave | SquadSave).season>0||
    Object.keys((state as DuelSave).records??(state as SquadSave).teams??{}).length>0||Object.keys((state as DuelSave).heroes??{}).length>0||
    Object.keys((state as DuelSave | SquadSave).peaks??{}).length>0));
function floorsOf(b: BackupBundle | null | undefined): ProgressFloors {
  const out: ProgressFloors={};
  for(const [kind,s] of Object.entries(sectionsOf(b))){
    if(kind==='quest'){
      const q=s as QuestSave;
      out.quest={attempt:q.run?.attempt??0,claimed:Number(q.run?.claimedAt!=null),campaign:q.campaign?.revision??0};
    }else{
      const career=s as DuelSave | SquadSave;
      out[kind as Exclude<BackupSection,'quest'>]={season:career.season??0,records:Object.keys((career as DuelSave).records??(career as SquadSave).teams??{}).length,
        peaks:Object.keys(career.peaks??{}).length};
    }
  }
  return out;
}
// Heroes may be intentionally unsaved and tournament rosters are periodically
// pruned; record count is cautionary only within the same season.
function rolledBack(old: ProgressFloors | null | undefined,next: ProgressFloors): boolean {
  return Object.entries(old??{}).some(([k,v])=>{
    const now=next[k as BackupSection];
    if(!now)return true;
    if(k==='quest'){
      const a=now as QuestFloor,b=v as QuestFloor;
      return (a.campaign??0)<(b.campaign??0)||a.attempt<b.attempt||(a.attempt===b.attempt&&a.claimed<b.claimed);
    }
    const a=now as CareerFloor,b=v as CareerFloor;
    return a.season<b.season||(a.season===b.season&&(a.records<b.records||a.peaks<b.peaks));
  });
}

export function createCloudSync({storage, transport, backup, preserve, hash=cloudDigest}: CloudSyncOptions){
  let lock=false;
  const prefs=()=>cloudSyncPrefs(storage);
  const save=(p: CloudPrefs)=>storage.setItem(CLOUD_SYNC_KEY,JSON.stringify(p));
  const setBaseline=(remote: {revision: string | null} | null,digest: string | null,bundle?: BackupBundle)=>{
    if(prefs().enabled)save({enabled:true,rev:remote?.revision??null,digest,pause:null,floors:floorsOf(bundle)});
  };
  const snapshots=async(timeout?: number)=>{
    const exported=backup.exportArcadeBackup(storage);
    const local=exported.ok?backup.inspectArcadeBackup(exported.text):exported;
    if(!local.ok&&local.error!=='There are no saved sections in this browser yet.')throw Error(local.error);
    const response=await transport.read({timeout});
    if(response!==null&&!revision(response?.revision))throw Error('Cloud revision is unavailable.');
    const remote=response===null?null:backup.inspectArcadeBackup(JSON.stringify(response.bundle));
    if(remote&&!remote.ok)throw Error('Cloud save could not be validated. No changes were made.');
    return {local:local.ok?local:null,remote:remote??null,response};
  };
  async function synchronize({action='check',expectedRevision,expectedLocalDigest}: SyncRequest={}): Promise<SyncResult> {
    if(lock)return {status:'busy'};
    if(action==='disable'){
      storage.removeItem(CLOUD_SYNC_KEY);return {status:'disabled'};
    }
    let p=prefs();
    if(!p.enabled&&action!=='enable')return {status:'disabled'};
    const linking=action==='enable'&&!p.enabled;
    if(linking){save({...fallback,enabled:true});p=prefs();action='check';}
    lock=true;
    try{
      const {local,remote,response}=await snapshots(action==='startup'?1800:undefined);
      const [localDigest,remoteDigest]=await Promise.all([hash(local?.bundle),hash(remote?.bundle)]);
      if(!prefs().enabled)return {status:'disabled'};
      const view={localDigest,cloudRevision:response?.revision??null,device:local?.summary??null,cloud:remote?.summary??null};
      const conflict=(reason: ConflictStatus='conflict')=>({status:reason,...view});
      const upload=async(): Promise<SyncResult>=>{
        if(!local)return conflict('reset');
        const latest=backup.exportArcadeBackup(storage);
        if(!latest.ok||await hash(latest.bundle)!==localDigest)return conflict('changed');
        if(!prefs().enabled)return {status:'disabled'};
        const next=await transport.write({revision:response?.revision??null,bundle:local.bundle,confirmReplace:action==='device'});
        if(next?.conflict){
          const reason=next.body?.error==='would_replace_progress'?'reset':'changed';
          if(reason==='reset'&&prefs().enabled)save({...prefs(),pause:'reset'});
          return conflict(reason);
        }
        if(!revision(next?.revision))throw Error('Cloud did not confirm the save.');
        setBaseline(next,localDigest,local.bundle);
        return {status:'uploaded',...view,cloudRevision:next.revision};
      };
      const reset=p.pause==='reset'||rolledBack(p.floors,floorsOf(local?.bundle));
      const blankFirstLink=linking&&remote&&!hasProgress(local?.bundle);
      const safePull=action==='startup'&&remote&&!reset&&localDigest!==remoteDigest&&
        (!hasProgress(local?.bundle)||(p.rev&&p.rev!==response!.revision&&localDigest===p.digest));
      if(action==='device'||action==='cloud'||blankFirstLink||safePull){
        if(!blankFirstLink&&!safePull&&(expectedRevision!==view.cloudRevision||expectedLocalDigest!==localDigest))return conflict('changed');
        if(action==='device'){
          if(rolledBack(floorsOf(remote?.bundle),floorsOf(local?.bundle)))return conflict('reset');
          if(remote&&!await preserve('previous-cloud',JSON.stringify(remote.bundle)))return conflict('recovery-blocked');
          return await upload();
        }
        if(!remote)return conflict('changed');
        if(local&&hasProgress(local.bundle)&&!await preserve('previous-device',JSON.stringify(local.bundle)))return conflict('recovery-blocked');
        const latest=backup.exportArcadeBackup(storage);
        if((latest.ok?await hash(latest.bundle):null)!==localDigest)return conflict('changed');
        if(!prefs().enabled)return {status:'disabled'};
        const apply=backup.restoreArcadeBackup(remote,storage);
        if(!apply.ok)throw Error(apply.error);
        // Imports preserve local-only sections. Do not treat those preserved
        // sections as new progress until the device actually changes.
        const merged=backup.exportArcadeBackup(storage);
        if(!merged.ok)throw Error(merged.error);
        setBaseline(response,await hash(merged.bundle),merged.bundle);
        return {status:'downloaded',...view};
      }
      if(localDigest===remoteDigest){
        setBaseline(response,localDigest,local?.bundle);
        return {status:local?'current':'empty',...view};
      }
      if(reset){
        save({...p,pause:'reset'});return conflict('reset');
      }
      if(action==='startup')return response?.revision!==p.rev&&remote?conflict('conflict'):{status:'pending',...view};
      if(!hasProgress(local?.bundle)&&!remote)return {status:'empty',...view};
      if(!remote&&!p.rev)return await upload();
      if(response?.revision!==p.rev||!p.rev)return conflict(localDigest===p.digest||!local?'cloud-newer':'conflict');
      if(localDigest!==p.digest)return await upload();
      return {status:'current',...view};
    }catch(e){return {status:'error',error:(e as Error | null)?.message||'Cloud is unavailable. Device saves are unchanged.'};}
    finally{lock=false;}
  }
  return {sync:synchronize,prefs};
}

/** Store an extra validated recovery copy before replacing data, without
 * consuming the small browser localStorage quota or exposing the account key. */
export function storeCloudRecovery(reason: string,text: string): Promise<boolean> {
  return new Promise(resolve=>{
    try{
      const open=indexedDB.open('saber-pit-cloud-recovery',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('copies');
      open.onerror=()=>resolve(false);open.onblocked=()=>resolve(false);
      open.onsuccess=()=>{
        const db=open.result;
        try{
          const tx=db.transaction('copies','readwrite');
          tx.objectStore('copies').put({reason,text,at:new Date().toISOString()},reason);
          tx.oncomplete=()=>{db.close();resolve(true);};
          tx.onabort=tx.onerror=()=>{db.close();resolve(false);};
        }catch{db.close();resolve(false);}
      };
    }catch{resolve(false);}
  });
}

const cloudKinds=['duel','squad','quest'] as const;
const revisionOf=(sections: Partial<Record<BackupSection, CloudSectionRecord>>)=>{
  const values=cloudKinds.map(k=>sections[k]?.revision??0);
  return values.some(Boolean)?values.join('.'):null;
};
export function createBrowserCloudTransport({request=globalThis.fetch?.bind(globalThis)}: {request?: typeof fetch}={}): CloudTransport {
  let sections: Partial<Record<BackupSection, CloudSectionRecord>>={};
  async function api(path: string,{method='GET',payload,timeout}: ApiOptions={}): Promise<CloudApiReply> {
    const response=await request('/api/cloud-save'+path,{method,credentials:'same-origin',cache:'no-store',
      ...(timeout?{signal:AbortSignal.timeout(timeout)}:{}),
      ...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
    if(response.status===401)throw Error('Sign in to OpenAI on this browser to link your saves.');
    const body=await response.json().catch(()=>null) as CloudApiReply | null;
    if(response.status===409)return {conflict:true,body:body as {error?: string} | null} as CloudApiReply;
    if(!response.ok||!body)throw Error('Cloud save is unavailable. Device progress is safe.');
    return body;
  }
  return {
    async read({timeout}={}){
      const data=await api('',{timeout});
      if(data.version!==1||!plain(data.sections)||Object.entries(data.sections).some(([k,s])=>
        !cloudKinds.includes(k as typeof cloudKinds[number])||!plain(s)||!Number.isSafeInteger(s.revision)||s.revision<1||!plain(s.value)))
        throw Error('Cloud save response could not be validated.');
      sections=data.sections;
      const revision=revisionOf(sections);
      if(revision===null)return null;
      return {revision,bundle:{format:'saber-pit-local-backup',version:1,sections:
        Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.value]))}};
    },
    async write({bundle,revision,confirmReplace}){
      if(revisionOf(sections)!==revision)return {conflict:true};
      for(const [k,value] of Object.entries(bundle.sections)){
        const record=sections[k as BackupSection];
        if(record&&JSON.stringify(canonical(record.value))===JSON.stringify(canonical(value)))continue;
        const result=await api('/'+k,{method:'PUT',payload:{baseRevision:record?.revision??0,value,
          ...(confirmReplace?{confirmReplace:true}:{})}});
        if(result.conflict)return result as {conflict: true; body?: {error?: string} | null};
        if(result.version!==1||result.section!==k||!Number.isSafeInteger(result.revision)||
            result.revision!<=(record?.revision??0))throw Error('Cloud did not confirm the updated section.');
        sections[k as BackupSection]={revision:result.revision!,value};
      }
      return {revision:revisionOf(sections)};
    },
  };
}

export function readCloudRecovery(reason: string): Promise<RecoveryCopy | null> {
  return new Promise(resolve=>{
    try{
      const open=indexedDB.open('saber-pit-cloud-recovery',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('copies');
      open.onerror=()=>resolve(null);open.onblocked=()=>resolve(null);
      open.onsuccess=()=>{
        const db=open.result;
        try{
          const request=db.transaction('copies','readonly').objectStore('copies').get(reason);
          request.onsuccess=()=>{db.close();resolve(request.result as RecoveryCopy | null | undefined??null);};
          request.onerror=()=>{db.close();resolve(null);};
        }catch{db.close();resolve(null);}
      };
    }catch{resolve(null);}
  });
}

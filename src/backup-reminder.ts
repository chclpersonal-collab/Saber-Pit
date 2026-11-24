import type {SaveStorage, StorageReader} from './arcade-save-types.js';
import {hasArcadeSaves} from './arcade-backup.js?v=4.01.1';
import {cloudSyncPrefs} from './arcade-cloud-sync.js';

export const BACKUP_STAMP_KEY='saber-pit-backup-reminder-v1';
export const BACKUP_REMIND_DAYS=7;
const DAY=86_400_000;
interface Stamp { saved: number | null; snooze: number | null }

function readStamp(storage: StorageReader): Stamp {
  try{
    const v=JSON.parse(storage.getItem(BACKUP_STAMP_KEY)!) as Partial<Stamp> | null;
    const num=(n: unknown)=>typeof n==='number'&&Number.isFinite(n)?n:null;
    return {saved:num(v?.saved),snooze:num(v?.snooze)};
  }catch{return {saved:null,snooze:null};}
}
function writeStamp(storage: SaveStorage,stamp: Stamp){try{storage.setItem(BACKUP_STAMP_KEY,JSON.stringify(stamp));}catch{/* Reminder only. */}}
const local=(): Storage | null=>{try{return globalThis.localStorage??null;}catch{return null;}};

/** Days since the last file download, or null when none is recorded. */
export function daysSinceBackup(storage: StorageReader | null=local(),now=Date.now()): number | null {
  if(!storage)return null;
  const {saved}=readStamp(storage);
  return saved===null?null:Math.max(0,Math.floor((now-saved)/DAY));
}
/** A reminder is due when there are saves, cloud sync is off, and no download or snooze in the last 7 days. */
export function backupReminderDue(storage: StorageReader | null=local(),now=Date.now()): boolean {
  if(!storage||!hasArcadeSaves(storage)||cloudSyncPrefs(storage).enabled)return false;
  const {saved,snooze}=readStamp(storage);
  if(snooze!==null&&now<snooze)return false;
  if(saved===null){
    if(snooze!==null)return true;
    // First visit with saves: start the clock instead of nagging right away.
    writeStamp(storage as SaveStorage,{saved:null,snooze:now+BACKUP_REMIND_DAYS*DAY});
    return false;
  }
  return now-saved>=BACKUP_REMIND_DAYS*DAY;
}
export function markBackupSaved(storage: SaveStorage | null=local(),now=Date.now()){if(storage)writeStamp(storage,{saved:now,snooze:null});}
export function snoozeBackupReminder(storage: SaveStorage | null=local(),now=Date.now()){
  if(storage)writeStamp(storage,{...readStamp(storage),snooze:now+BACKUP_REMIND_DAYS*DAY});
}

function mount(){
  if(!backupReminderDue())return;
  const days=daysSinceBackup();
  const bar=document.createElement('aside');
  bar.id='backupReminder';bar.setAttribute('role','status');
  bar.style.cssText='position:fixed;right:16px;bottom:16px;z-index:50;display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);padding:8px 8px 8px 14px;background:#10181dF2;border:1px solid #2c3d44;border-left:3px solid #e8b66d;color:#ecf4f0;font:600 14px/1.3 system-ui,sans-serif';
  const text=document.createElement('span');
  text.textContent=days===null?'Back up your saves':'Last backup '+days+' days ago';
  const go=document.createElement('a');
  go.href='./backup.html';go.textContent='Back up';
  go.style.cssText='display:inline-flex;align-items:center;min-height:36px;padding:0 12px;background:#e8b66d;color:#0e1417;text-decoration:none;font-weight:700';
  const later=document.createElement('button');
  later.type='button';later.textContent='Later';later.setAttribute('aria-label','Remind me in a week');
  later.style.cssText='min-height:36px;padding:0 10px;background:transparent;border:1px solid #3f5552;color:#a4b5b9;font:inherit;cursor:pointer';
  later.addEventListener('click',()=>{snoozeBackupReminder();bar.remove();});
  bar.append(text,go,later);document.body.append(bar);
}
if(typeof document!=='undefined'&&document.body&&!document.getElementById('backupReminder'))mount();

import type {SaveStorage, StorageReader} from './arcade-save-types.js';
import {hasArcadeSaves} from './arcade-backup.js?v=4.01.1';
import {cloudSyncPrefs} from './arcade-cloud-sync.js';

/** Last file download time, kept under its own key, outside every backup section and sync. */
export const BACKUP_STAMP_KEY='saber-pit-backup-reminder-v1';
export const BACKUP_REMIND_DAYS=7;
const DAY=86_400_000;
const local=(): Storage | null=>{try{return globalThis.localStorage??null;}catch{return null;}};

function savedAt(storage: StorageReader): number | null {
  try{
    const v=(JSON.parse(storage.getItem(BACKUP_STAMP_KEY)!) as {saved?: unknown} | null)?.saved;
    return typeof v==='number'&&Number.isFinite(v)?v:null;
  }catch{return null;}
}
/** Days since the last file download, or null when none is recorded. */
export function daysSinceBackup(storage: StorageReader | null=local(),now=Date.now()): number | null {
  const saved=storage?savedAt(storage):null;
  return saved===null?null:Math.max(0,Math.floor((now-saved)/DAY));
}
/** Due when there are saves, cloud sync is off, and no file download in the last 7 days. Read-only. */
export function backupReminderDue(storage: StorageReader | null=local(),now=Date.now()): boolean {
  if(!storage||!hasArcadeSaves(storage)||cloudSyncPrefs(storage).enabled)return false;
  const saved=savedAt(storage);
  return saved===null||now-saved>=BACKUP_REMIND_DAYS*DAY;
}
export function markBackupSaved(storage: SaveStorage | null=local(),now=Date.now()){
  try{storage?.setItem(BACKUP_STAMP_KEY,JSON.stringify({saved:now}));}catch{/* Reminder only. */}
}
/** One line for the Saves page, next to the download button. */
export function backupReminderText(storage: StorageReader | null=local(),now=Date.now()): {text: string; due: boolean} {
  const due=backupReminderDue(storage,now), d=daysSinceBackup(storage,now);
  if(d===null)return {text:due?'No backup file yet.':'',due};
  const ago=d===0?'today':d+(d===1?' day':' days')+' ago';
  return {text:due?'Last backup '+ago+'. Time for a new one.':'Last backup '+ago+'.',due};
}

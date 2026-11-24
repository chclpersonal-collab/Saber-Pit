import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKUP_STAMP_KEY,backupReminderDue,backupReminderText,daysSinceBackup,markBackupSaved} from '../dist/backup-reminder.js';
import {hasArcadeSaves} from '../dist/arcade-backup.js';
import {CLOUD_SYNC_KEY} from '../dist/arcade-cloud-sync.js';
import {QUEST_STORAGE_KEY} from '../dist/arcade-quests.js';
const DAY=86_400_000, t0=Date.UTC(2026,10,1);
const store=(seed:Record<string,string>={})=>{const map=new Map(Object.entries(seed));const writes:string[]=[];return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{writes.push(k);map.set(k,v);},removeItem:(k:string)=>void map.delete(k),writes};};
const withSave=()=>store({[QUEST_STORAGE_KEY]:'{}'});

test('no saves: never due',()=>{
  const s=store();
  assert.equal(hasArcadeSaves(s),false);
  assert.equal(backupReminderDue(s,t0+30*DAY),false);
  assert.equal(backupReminderText(s,t0).text,'');
});
test('saves and no backup file yet: due',()=>{
  const s=withSave();
  assert.equal(backupReminderDue(s,t0),true);
  assert.deepEqual(backupReminderText(s,t0),{text:'No backup file yet.',due:true});
});
test('a download clears it for 7 days',()=>{
  const s=withSave();
  markBackupSaved(s,t0);
  assert.equal(daysSinceBackup(s,t0+3*DAY+5),3);
  assert.deepEqual(backupReminderText(s,t0+6*DAY),{text:'Last backup 6 days ago.',due:false});
  assert.deepEqual(backupReminderText(s,t0+9*DAY),{text:'Last backup 9 days ago. Time for a new one.',due:true});
});
test('cloud sync on: never due',()=>{
  const s=withSave();
  s.setItem(CLOUD_SYNC_KEY,JSON.stringify({enabled:true}));
  assert.equal(backupReminderDue(s,t0+30*DAY),false);
});
test('reading never writes; only a download writes, and only its own key',()=>{
  const s=withSave();
  backupReminderDue(s,t0);backupReminderText(s,t0);daysSinceBackup(s,t0);
  assert.deepEqual(s.writes,[]);
  markBackupSaved(s,t0);
  assert.deepEqual(s.writes,[BACKUP_STAMP_KEY]);
});
test('broken stamp is treated as no download',()=>{
  const s=withSave();
  s.setItem(BACKUP_STAMP_KEY,'not json');
  assert.equal(daysSinceBackup(s,t0),null);
  assert.equal(backupReminderDue(s,t0),true);
});

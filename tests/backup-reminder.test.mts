import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKUP_STAMP_KEY,backupReminderDue,daysSinceBackup,markBackupSaved,snoozeBackupReminder} from '../dist/backup-reminder.js';
import {hasArcadeSaves} from '../dist/arcade-backup.js';
import {CLOUD_SYNC_KEY} from '../dist/arcade-cloud-sync.js';
import {QUEST_STORAGE_KEY} from '../dist/arcade-quests.js';
const DAY=86_400_000, t0=Date.UTC(2026,10,1);
const store=(seed:Record<string,string>={})=>{const map=new Map(Object.entries(seed));return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>void map.set(k,v),removeItem:(k:string)=>void map.delete(k),map};};
const withSave=()=>store({[QUEST_STORAGE_KEY]:'{}'});

test('no saves: never reminds',()=>{
  const s=store();
  assert.equal(hasArcadeSaves(s),false);
  assert.equal(backupReminderDue(s,t0),false);
  assert.equal(backupReminderDue(s,t0+30*DAY),false);
});
test('first visit starts a 7 day clock, then reminds',()=>{
  const s=withSave();
  assert.equal(backupReminderDue(s,t0),false);
  assert.equal(backupReminderDue(s,t0+6*DAY),false);
  assert.equal(backupReminderDue(s,t0+7*DAY),true);
  assert.equal(daysSinceBackup(s,t0),null);
});
test('a download resets the clock; 7 days later it reminds again',()=>{
  const s=withSave();
  markBackupSaved(s,t0);
  assert.equal(daysSinceBackup(s,t0+3*DAY+5),3);
  assert.equal(backupReminderDue(s,t0+6*DAY),false);
  assert.equal(backupReminderDue(s,t0+7*DAY),true);
});
test('Later snoozes for a week',()=>{
  const s=withSave();
  markBackupSaved(s,t0);
  snoozeBackupReminder(s,t0+8*DAY);
  assert.equal(backupReminderDue(s,t0+10*DAY),false);
  assert.equal(backupReminderDue(s,t0+15*DAY),true);
  assert.equal(daysSinceBackup(s,t0+15*DAY),15);
});
test('cloud sync on: no reminder',()=>{
  const s=withSave();
  s.setItem(CLOUD_SYNC_KEY,JSON.stringify({enabled:true}));
  markBackupSaved(s,t0);
  assert.equal(backupReminderDue(s,t0+30*DAY),false);
});
test('broken stamp is treated as no download',()=>{
  const s=withSave();
  s.setItem(BACKUP_STAMP_KEY,'not json');
  assert.equal(daysSinceBackup(s,t0),null);
  assert.equal(backupReminderDue(s,t0),false);
});

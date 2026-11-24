import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadTournament,saveTournament,startTournament,TOURNAMENT_KEY} from '../dist/arcade-tournament.js';
import {CLOUD_SYNC_KEY} from '../dist/arcade-cloud-sync.js';

const DAY=86_400_000, KEY='saber-pit-manual-backup-reminder-v1';
test('Saves-only reminder observes valid progress, snoozes, and resets on an actual backup click, never while linked',async t=>{
  const html=await readFile(new URL('../dist/backup.html',import.meta.url),'utf8');
  const anchorTag=/<div class="backup-reminder" id="backupReminder" hidden>/;
  assert.match(html,anchorTag);
  for(const page of ['index','tournament','idle-rpg','moba']){
    assert.doesNotMatch(await readFile(new URL('../dist/'+page+'.html',import.meta.url),'utf8'),/id="backupReminder"/);
  }
  const disk=new Map(), saves={getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>disk.set(k,v),removeItem:(k:string)=>disk.delete(k)};
  let now=Date.UTC(2026,10,24), selected='', clicks=0, openBlob:Blob|null=null, failDownload=false;
  let rejectCloud:(reason:Error)=>void=()=>assert.fail('No cloud request');
  t.mock.method(Date,'now',()=>now);
  t.mock.method(URL,'createObjectURL',(blob:Blob)=>{if(failDownload)throw Error('Disabled');openBlob=blob;return 'blob:test';});
  t.mock.method(URL,'revokeObjectURL',()=>{});
  t.mock.method(globalThis,'fetch',()=>new Promise((_resolve,reject)=>{rejectCloud=reject;}));
  class Element {
    handlers:Record<string,((event:Event)=>unknown)[]>= {};
    hidden=false; disabled=false; textContent=''; dataset:Record<string,string>={};
    constructor(public id=''){}
    addEventListener(name:string,fn:(event:Event)=>unknown){(this.handlers[name]??=[]).push(fn);}
    dispatchEvent(e:Event){return this.handlers[e.type]?.map(fn=>fn(e))??[];}
    click(){if(this.id==='anchor')clicks++;return this.dispatchEvent(new Event('click'));}
    append(){} remove(){} focus(){selected=this.id;}
  }
  const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element(id)]));
  ids.backupReminder.hidden=true;
  const win=new Element('window'),doc=Object.assign(new Element('document'),{
    getElementById:(id:string)=>ids[id],body:new Element('body'),visibilityState:'visible',createElement:()=>new Element('anchor')
  });
  for(const [key,value] of Object.entries({document:doc,window:win,localStorage:saves})){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else Reflect.deleteProperty(globalThis,key);});
  }
  await import('../dist/backup.js');
  await import('../dist/cloud-sync-panel.js');
  const refresh=()=>win.dispatchEvent(new Event('focus'));
  assert.equal(ids.backupReminder.hidden,true);
  assert.equal(saves.getItem(KEY),null);
  now+=8*DAY;refresh();
  assert.equal(ids.backupReminder.hidden,true);
  assert.equal(saves.getItem(KEY),null);

  saves.setItem(TOURNAMENT_KEY,'broken');
  refresh();assert.equal(saves.getItem(KEY),null);
  assert.ok(saveTournament(startTournament(loadTournament(),{seed:27}),saves));
  const localBefore=saves.getItem(TOURNAMENT_KEY);
  refresh();const observed=now;
  assert.equal(saves.getItem(KEY),String(observed+7*DAY));
  now=observed+7*DAY-1;refresh();assert.equal(ids.backupReminder.hidden,true);
  now++;refresh();assert.equal(ids.backupReminder.hidden,false);
  assert.equal(clicks,0,'aging must not download anything');

  // Use the real panel so this also catches same-tab preference/event failures.
  const enabling=ids.cloudEnable.click()[0];
  assert.equal(JSON.parse(saves.getItem(CLOUD_SYNC_KEY)).enabled,true);
  assert.equal(ids.backupReminder.hidden,true,'hide immediately, without waiting for sync');
  rejectCloud(new Error('synthetic offline'));
  await enabling;
  now+=10*DAY;refresh();assert.equal(ids.backupReminder.hidden,true,'linked stays quiet despite failed cloud fetch');
  await ids.cloudDisable.click()[0];
  assert.equal(ids.backupReminder.hidden,false);
  ids.backupLater.click();
  assert.equal(ids.backupReminder.hidden,true);
  assert.equal(selected,'downloadBackup');
  assert.equal(clicks,0,'Later must not download anything');

  now+=DAY-1;refresh();assert.equal(ids.backupReminder.hidden,true);
  now++;refresh();assert.equal(ids.backupReminder.hidden,false);
  failDownload=true;
  ids.downloadBackup.click();
  assert.equal(clicks,0);
  assert.equal(ids.backupReminder.hidden,false,'failed download must not reset reminder');
  failDownload=false;
  ids.downloadBackup.click();
  assert.equal(clicks,1);
  assert.equal(ids.backupReminder.hidden,true);
  assert.equal(saves.getItem(KEY),String(now+7*DAY));
  assert.equal(saves.getItem(TOURNAMENT_KEY),localBefore);
  const blob=openBlob as Blob|null;assert.ok(blob);
  assert.doesNotMatch(await blob.text(),new RegExp(KEY));
  now+=7*DAY;refresh();assert.equal(ids.backupReminder.hidden,false);
});

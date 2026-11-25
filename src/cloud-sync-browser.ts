import {CLOUD_SAVE_COMMITTED} from './cloud-save-commit.js';
import {createCloudSyncScheduler} from './cloud-sync-scheduler.js?v=6.0.2';
import type {SyncResult} from './arcade-cloud-sync.js?v=6.0.2';
import type {StorageReader} from './arcade-save-types.js?v=6.0.2';
import * as files from './arcade-backup.js?v=6.0.2';
import {createCloudSync,createBrowserCloudTransport,storeCloudRecovery} from './arcade-cloud-sync.js?v=6.0.2';
const unavailable={getItem:()=>null,setItem:()=>{throw Error('Site storage is disabled.');},removeItem:()=>{}};
const storage=(()=>{try{return globalThis.localStorage??unavailable;}catch{return unavailable;}})();
const backup={...files,exportArcadeBackup:(storage?: StorageReader,sections?:readonly files.BackupSection[])=>
  files.exportArcadeBackup(storage,{sections:sections??['duel','squad','quest']})};
export const browserSync=createCloudSync({storage,transport:createBrowserCloudTransport(),
  backup,preserve:storeCloudRecovery});
let started=false,discoveryRetries=0;
export function promptIfNeeded(result: SyncResult | null | undefined){
  if(!result)return;
  if(['current','uploaded','downloaded'].includes(result.status)) {
    document.getElementById('cloudSyncNotice')?.remove();
    for(const label of document.querySelectorAll<HTMLElement>('[data-cloud-original]')){
      label.textContent=label.dataset.cloudOriginal??'Saves';delete label.dataset.cloudOriginal;
      const link=label.closest('a');
      if(link&&link.dataset.cloudTitle!==undefined){
        if(link.dataset.cloudTitle)link.title=link.dataset.cloudTitle;else link.removeAttribute('title');
        delete link.dataset.cloudTitle;
      }
    }
    return;
  }
  if(!['changed','conflict','cloud-newer','reset','recovery-blocked','unlinked','pending'].includes(result.status))return;
  const message=result.status==='unlinked'?'Link cloud saves':result.status==='cloud-newer'?'Cloud save available':result.status==='pending'?'Save sync pending':'Review save sync';
  const host=document.querySelector<HTMLElement>('[data-cloud-notice-host]');
  if(!host)for(const a of document.querySelectorAll<HTMLAnchorElement>('a[href="./backup.html"]')){
    if(a.id==='cloudSyncNotice')continue;
    const label=a.querySelector('span')??a;
    label.dataset.cloudOriginal??=label.textContent??'';label.textContent=message;
    a.dataset.cloudTitle??=a.title;
    a.title='Progress needs review before syncing';
  }
  const canRefresh='canRefresh' in result&&result.canRefresh;
  if(!document.getElementById('cloudSyncNotice')){
    const a=document.createElement('a');
    a.href='./backup.html';a.id='cloudSyncNotice';
    if(host)host.append(a);
    else{
      // Other screens retain an actionable, in-flow notice without relying
      // on their page-specific navigation or fight layouts.
      a.style.cssText='display:block;width:fit-content;max-width:calc(100% - 24px);margin:8px auto;padding:9px 13px;color:#f6e5c9;background:#211c18;border:1px solid #a68b63;border-radius:6px;font-size:.875rem;';
      document.body.append(a);
    }
  }
  const notice=document.getElementById('cloudSyncNotice') as HTMLAnchorElement;
  notice.href=canRefresh?window.location.href:'./backup.html';
  notice.onclick=canRefresh?event=>{event.preventDefault();window.location.reload();}:null;
  notice.textContent=canRefresh?'Reload to use newer save':message;
  notice.title=canRefresh?'Finish any active match first. Reloading opens the latest save if it is safe to download.':'Review save sync choices';
}
export async function syncBeforeGame(){
  if(navigator.onLine===false){discoveryRetries=2;return;}
  const result=await browserSync.sync({action:'startup',discover:true});
  if(result.status==='error')discoveryRetries=2;
  promptIfNeeded(result);
}
export function announceSyncedSave(){
  window.dispatchEvent(new Event('saber-cloud-save-loaded'));
}
export function startCloudUploads(){
  if(started)return;
  started=true;
  // Do not restore over a mounted game: the next page load can safely pull
  // when local progress still matches its acknowledged baseline.
  const canSync=()=>navigator.onLine!==false&&(browserSync.prefs().enabled||discoveryRetries>0);
  const runner=createCloudSyncScheduler({canSync,sync:()=>{
    if(browserSync.prefs().enabled)return browserSync.sync();
    discoveryRetries--;
    return browserSync.sync({action:'startup',discover:true,revealOnly:true});
  },observe:promptIfNeeded,
    schedule:(task,delay)=>window.setTimeout(task,delay),cancel:handle=>window.clearTimeout(handle as number)});
  const visibleCheck=()=>{if(document.visibilityState==='visible')runner.trigger(0);};
  // Recovers pending local progress after an interrupted upload, and detects
  // changes from other devices even when this tab's own digest is unchanged.
  visibleCheck();
  window.setInterval(visibleCheck,25_000);
  window.addEventListener('online',visibleCheck);
  window.addEventListener('focus',visibleCheck);
  window.addEventListener('storage',()=>runner.trigger());
  document.addEventListener('visibilitychange',()=>runner.trigger(0));
  window.addEventListener('pagehide',runner.flush);
  window.addEventListener(CLOUD_SAVE_COMMITTED,()=>runner.trigger());
}

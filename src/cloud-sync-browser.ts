// @ts-nocheck
import * as files from './arcade-backup.js?v=3.3.0';
import {createCloudSync,createBrowserCloudTransport,storeCloudRecovery,cloudDigest} from './arcade-cloud-sync.js?v=3.3.0';
const unavailable={getItem:()=>null,setItem:()=>{throw Error('Site storage is disabled.');},removeItem:()=>{}};
const storage=(()=>{try{return globalThis.localStorage??unavailable;}catch{return unavailable;}})();
// Gauntlet is supported by manual file backup only. Cloud retains its
// existing formats, schema, and digests.
const backup={...files,exportArcadeBackup:storage=>files.exportArcadeBackup(storage,{sections:['duel','squad','quest']})};
export const browserSync=createCloudSync({storage,transport:createBrowserCloudTransport(),
  backup,preserve:storeCloudRecovery});
let timer=0;
function promptIfNeeded(result){
  if(!['changed','conflict','cloud-newer','reset'].includes(result?.status))return;
  for(const a of document.querySelectorAll('a[href="./backup.html"]')){
    a.textContent='Manage saves · review sync';
    a.title='Progress needs review before syncing';
  }
}
export async function syncBeforeGame(){
  if(!browserSync.prefs().enabled||navigator.onLine===false)return;
  promptIfNeeded(await browserSync.sync({action:'startup'}));
}
export function announceSyncedSave(){
  window.dispatchEvent(new Event('saber-cloud-save-loaded'));
}
export function startCloudUploads(){
  // Existing game modules mount their in-memory state on load. Never import
  // over a mounted game. They only upload local progress; Backup pulls.
  async function check(){
    if(document.visibilityState==='hidden'||navigator.onLine===false||!browserSync.prefs().enabled)return;
    try{
      const local=backup.exportArcadeBackup();
      if(await cloudDigest(local.ok?local.bundle:null)!==browserSync.prefs().digest)
        promptIfNeeded(await browserSync.sync());
    }catch{/* Existing file backups and game saves always work offline. */}
  }
  clearInterval(timer);timer=setInterval(check,12_000);
  window.addEventListener('online',check);
  window.addEventListener('storage',check);
  document.addEventListener('visibilitychange',check);
}

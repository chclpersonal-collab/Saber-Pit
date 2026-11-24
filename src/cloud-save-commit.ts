/** Same-document localStorage writes do not issue a StorageEvent. */
export const CLOUD_SAVE_COMMITTED='saber-cloud-save-committed';
export function notifyCloudSaveCommitted(target:unknown):void {
  if(typeof window==='undefined')return;
  try{if(target===window.localStorage)window.dispatchEvent(new Event(CLOUD_SAVE_COMMITTED));}
  catch{/* The save has already committed; a notification can't invalidate it. */}
}

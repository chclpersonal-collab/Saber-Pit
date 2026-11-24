import type {BackupSummary, CareerSummary, QuestSummary} from './arcade-backup.js';
import type {SyncAction, SyncResult} from './arcade-cloud-sync.js';
type SyncPresentation = SyncResult & {
  cloud?: BackupSummary | null; device?: BackupSummary | null;
  cloudRevision?: string | null; localDigest?: string | null; error?: string;
};
import {browserSync,announceSyncedSave} from './cloud-sync-browser.js?v=4.01.1';
import {readCloudRecovery} from './arcade-cloud-sync.js';
const $=<T extends HTMLElement=HTMLButtonElement>(id: string)=>document.getElementById(id) as T;
const controls=['cloudEnable','cloudDisable','cloudCheck','cloudDevice','cloudPull'];
let last: SyncPresentation | null=null;
function draw(result: SyncPresentation | null){
  const enabled=browserSync.prefs().enabled;
  $('cloudEnable').hidden=enabled;$('cloudDisable').hidden=!enabled;$('cloudCheck').hidden=!enabled;
  $('cloudEnable').disabled=$('cloudDisable').disabled=$('cloudCheck').disabled=false;
  const status=result?.status??(enabled?'enabled':'disabled');
  const compare=['cloud-newer','conflict','reset','changed','recovery-blocked'].includes(status);
  $('cloudCompare').hidden=!compare;
  $('cloudPull').hidden=!result?.cloud;
  $('cloudDevice').hidden=!result?.device||status==='reset'||status==='cloud-newer';
  $('cloudPull').disabled=$('cloudDevice').disabled=false;
  const summary=(items?: BackupSummary | null)=>!items?'No saves found.':Object.values(items).map(x=>x.label+': '+
    (('round' in x&&'fighters' in x)?x.round+' · '+x.fighters+' slots'+('ratedFighters' in x?' · '+x.ratedFighters+' rated':''):((x as QuestSummary).questStatus??((x as CareerSummary).seasons+' seasons · '+(x as CareerSummary).records+' records'+((x as CareerSummary).heroes?' · '+(x as CareerSummary).heroes+' Heroes':''))))).join(' / ');
  if(compare){$('cloudLocalSummary').textContent=summary(result!.device);$('cloudRemoteSummary').textContent=summary(result!.cloud);}
  $('cloudStatus').textContent=({
    disabled:'Sync is off. Saves stay on this device.',
    enabled:'Sync is on for this device.',
    unlinked:'Device progress has not linked yet. Turn on sync to start.',
    current:'This device is up to date.',
    empty:'Sync is on. Play to start a save.',
    uploaded:'Device progress saved to the cloud.',
    downloaded:'Cloud progress loaded. Reopen game tabs to use it.',
    'cloud-newer':'Cloud progress is available. Review it before loading.',
    conflict:'This device and the cloud have different progress. Choose which to use.',
    reset:'This device appears to have been reset. The cloud copy will stay unchanged.',
    changed:'Progress changed while you were reviewing. Check again before replacing anything.',
    'recovery-blocked':'Could not preserve a recovery copy, so no saves were replaced.',
    busy:'Please wait for the current sync.',
    error:result?.error
  } as Partial<Record<SyncResult['status'] | 'enabled', string>>)[status]??'';
}
async function go(action: SyncAction){
  if(['device','cloud'].includes(action)&&!last)return;
  for(const id of controls)$(id).disabled=true;
  $('cloudStatus').textContent='Checking saves…';
  try{last=await browserSync.sync({action,expectedRevision:last?.cloudRevision,expectedLocalDigest:last?.localDigest});}
  catch{last={status:'error',error:'Site storage must be enabled before linking saves.'};}
  if(last.status==='downloaded')announceSyncedSave();
  draw(last);
}
for(const [id,action] of Object.entries({cloudEnable:'enable',cloudDisable:'disable',cloudCheck:'check',cloudDevice:'device',cloudPull:'cloud'} as const))
  $(id).addEventListener('click',()=>go(action));
$<HTMLSelectElement>('cloudRecovery').addEventListener('change',async e=>{
  const select=e.target as HTMLSelectElement;
  if(!select.value)return;
  const copy=await readCloudRecovery(select.value);
  select.value='';
  if(!copy){$('cloudStatus').textContent='No recovery copy of that save was found.';return;}
  const url=URL.createObjectURL(new Blob([copy.text],{type:'application/json'}));
  const a=document.createElement('a');a.download='saber-pit-recovery-'+copy.reason+'.json';a.href=url;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
});
draw(null);
if(browserSync.prefs().enabled)go('check');

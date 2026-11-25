import type {BackupSummary, CareerSummary, QuestSummary} from './arcade-backup.js?v=6.0.2';
import type {SyncAction, SyncResult} from './arcade-cloud-sync.js?v=6.0.2';
type SyncPresentation = SyncResult & {
  cloud?: BackupSummary | null; device?: BackupSummary | null;
  cloudRevision?: string | null; localDigest?: string | null; error?: string;
};
import {browserSync,announceSyncedSave} from './cloud-sync-browser.js?v=6.0.2';
import {readCloudRecovery} from './arcade-cloud-sync.js?v=6.0.2';
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
  const facts=(x: NonNullable<BackupSummary[keyof BackupSummary]>)=>('round' in x&&'fighters' in x)?['Round '+x.round,x.fighters+' Slots',...('ratedFighters' in x?[x.ratedFighters+' Rated']:[])]
    :(x as QuestSummary).questStatus?[(x as QuestSummary).questStatus]:[(x as CareerSummary).seasons+' Seasons',(x as CareerSummary).records+' Records',...((x as CareerSummary).heroes?[(x as CareerSummary).heroes+' Heroes']:[])];
  /** Each save is a v6-meta span: "Label: facts", instead of a "·" chain. */
  const summary=(el: HTMLElement,items?: BackupSummary | null)=>{
    el.textContent='';
    if(!items){el.textContent='No saves';return;}
    Object.values(items).forEach((x,i)=>{const span=document.createElement('span');span.className='v6-meta';span.textContent=x.label+': '+facts(x).join(', ');if(i)el.append(' ');el.append(span);});
  };
  if(compare){summary($('cloudLocalSummary'),result!.device);summary($('cloudRemoteSummary'),result!.cloud);}
  $('cloudStatus').textContent=({
    disabled:'Sync off, saves stay here',
    enabled:'Sync on',
    unlinked:'Not linked yet',
    current:'Up to date',
    empty:'Sync on, no saves yet',
    uploaded:'Saved to cloud',
    downloaded:'Cloud loaded, reopen game tabs',
    'cloud-newer':'Newer cloud save, review first',
    conflict:'Device and cloud differ, pick one',
    reset:'Device reset, cloud copy kept',
    changed:'Saves changed, check again',
    'recovery-blocked':'No recovery copy, nothing replaced',
    busy:'Sync in progress',
    error:result?.error
  } as Partial<Record<SyncResult['status'] | 'enabled', string>>)[status]??'';
}
async function go(action: SyncAction){
  if(['device','cloud'].includes(action)&&!last)return;
  for(const id of controls)$(id).disabled=true;
  $('cloudStatus').textContent='Checking saves';
  try{
    const task=browserSync.sync({action,expectedRevision:last?.cloudRevision,expectedLocalDigest:last?.localDigest});
    // Enable/disable updates local preferences before the cloud request finishes.
    if(action==='enable'||action==='disable')window.dispatchEvent(new Event('saber-cloud-prefs-changed'));
    last=await task;
  }
  catch{last={status:'error',error:'Turn on site storage first'};}
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
  if(!copy){$('cloudStatus').textContent='No recovery copy found';return;}
  const url=URL.createObjectURL(new Blob([copy.text],{type:'application/json'}));
  const a=document.createElement('a');a.download='saber-pit-recovery-'+copy.reason+'.json';a.href=url;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
});
draw(null);
if(browserSync.prefs().enabled)go('check');

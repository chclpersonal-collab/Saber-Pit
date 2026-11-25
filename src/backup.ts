import type {BackupInspection, BackupSection, ArenaSummary, CareerSummary, QuestSummary} from './arcade-backup.js?v=6.0.2';
import {MAX_BACKUP_BYTES,exportArcadeBackup,inspectArcadeBackup,restoreArcadeBackup} from './arcade-backup.js?v=6.0.2';
import {cloudSyncPrefs} from './arcade-cloud-sync.js?v=6.0.2';
const $=<T extends HTMLElement=HTMLElement>(id: string)=>document.getElementById(id) as T;
const picker=$<HTMLInputElement>('backupFile'), preview=$('backupPreview'), confirm=$<HTMLInputElement>('backupConfirm'), replace=$<HTMLButtonElement>('restoreBackup');
const sections=$('backupSections'), report=$('backupStatus');
const reminder=$('backupReminder'), download=$<HTMLButtonElement>('downloadBackup');
const DAY=86_400_000, WEEK=7*DAY, REMINDER_KEY='saber-pit-manual-backup-reminder-v1';
function deferReminder(delay: number){
  reminder.hidden=true;
  try{localStorage.setItem(REMINDER_KEY,String(Date.now()+delay));}catch{/* Optional UI metadata only. */}
}
function refreshReminder(){
  reminder.hidden=true;
  try{
    if(cloudSyncPrefs(localStorage).enabled)return;
    const now=Date.now(), due=Number(localStorage.getItem(REMINDER_KEY));
    if(due>now&&due<=now+WEEK)return;
    if(!exportArcadeBackup().ok)return;
    if(!Number.isSafeInteger(due)||due<=0||due>now+WEEK){deferReminder(WEEK);return;}
    reminder.hidden=false;
  }catch{/* Unavailable storage is not a reason to display a warning. */}
}
$('backupLater').addEventListener('click',()=>{deferReminder(DAY);download.focus();});
for(const event of ['focus','storage','saber-cloud-prefs-changed'])window.addEventListener(event,refreshReminder);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshReminder();});
refreshReminder();
let inspected: BackupInspection | null=null, revision=0;
function announce(message: string,tone=''){report.textContent=message;report.dataset.tone=tone;}
function node<K extends keyof HTMLElementTagNameMap>(tag: K,content?: string){
  const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;
  return el;
}
function current(){return [...sections.querySelectorAll<HTMLInputElement>('input:checked')].map(box=>box.value as BackupSection);}
function sync(){replace.disabled=!inspected||!confirm.checked||!current().length;}
function resetPreview(){
  inspected=null;preview.hidden=true;confirm.checked=false;sections.replaceChildren();sync();
}
function facts(k: string,entry: CareerSummary | QuestSummary | ArenaSummary): string[]{
  if(k==='arena'){const item=entry as ArenaSummary;return ['Round '+item.round,item.fighters+' Fighters',item.ratedFighters+' Rated'];}
  if(k==='quest'){const item=entry as QuestSummary;return [item.questStatus,...(item.attempts?['Attempt '+item.attempts]:[])];}
  const item=entry as CareerSummary;
  if(k==='gauntlet')return [item.seasons+' Weeks',item.records+' Fighters'];
  const detail=[item.seasons+(item.seasons===1?' Season':' Seasons'),item.records+(k==='duel'?' Fighters':' Teams'),item.peaks+' Peaks'];
  if(k==='duel')detail.push(item.heroes+' Saved Heroes');
  return detail;
}
/** Facts in a row: separate v6-meta spans instead of a "·" chain. */
function summary(k: string,entry: CareerSummary | QuestSummary | ArenaSummary){
  const small=node('small');
  facts(k,entry).forEach((text,i)=>{const span=node('span',text);span.className='v6-meta';if(i)small.append(' ');small.append(span);});
  return small;
}
picker.addEventListener('change',async()=>{
  const ticket=++revision;
  resetPreview();
  const file=picker.files?.[0];
  if(!file){announce('');return;}
  if(file.size>MAX_BACKUP_BYTES){announce('File over 3.1 MB','error');return;}
  announce('Checking backup');
  try{
    const result=inspectArcadeBackup(await file.text());
    if(ticket!==revision)return;
    if(!result.ok){announce(result.error,'error');return;}
    inspected=result;
    for(const [k,item] of Object.entries(result.summary)){
      const row=node('label'), checkbox=node('input'), label=node('span');
      checkbox.type='checkbox';checkbox.value=k;checkbox.checked=true;
      label.append(node('strong',item.label),summary(k,item));
      row.className='section-row';row.append(checkbox,label);sections.append(row);
    }
    const date=new Date(result.bundle.createdAt??'');
    $('backupDate').textContent=Number.isFinite(date.valueOf())?'Created '+date.toLocaleString():'';
    preview.hidden=false;sync();announce('Backup ready to review','success');
  }catch{if(ticket===revision)announce('File could not open','error');}
});
download.addEventListener('click',()=>{
  const result=exportArcadeBackup();
  if(!result.ok){announce(result.error,'error');return;}
  let url: string | undefined;
  try{
    url=URL.createObjectURL(new Blob([result.text],{type:'application/json'}));
    const a=node('a');a.href=url;a.download='saber-pit-save-'+result.bundle.createdAt!.slice(0,10)+'.json';a.hidden=true;
    document.body.append(a);
    try{a.click();}finally{a.remove();}
    deferReminder(WEEK);
    announce('Backup downloaded','success');
  }catch{announce('Download failed','error');}
  finally{if(url)setTimeout(()=>URL.revokeObjectURL(url!),2000);}
});
confirm.addEventListener('change',sync);
sections.addEventListener('change',()=>{confirm.checked=false;sync();});
replace.addEventListener('click',()=>{
  if(replace.disabled)return;
  const result=restoreArcadeBackup(inspected,undefined,{sections:current()});
  if(!result.ok){announce(result.error,'error');return;}
  resetPreview();picker.value='';refreshReminder();
  announce('Saves restored, reload game tabs','success');
});

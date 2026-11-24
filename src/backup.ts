import type {BackupInspection, BackupSection, ArenaSummary, CareerSummary, QuestSummary} from './arcade-backup.js';
import {MAX_BACKUP_BYTES,exportArcadeBackup,inspectArcadeBackup,restoreArcadeBackup} from './arcade-backup.js?v=4.01.1';
const $=<T extends HTMLElement=HTMLElement>(id: string)=>document.getElementById(id) as T;
const picker=$<HTMLInputElement>('backupFile'), preview=$('backupPreview'), confirm=$<HTMLInputElement>('backupConfirm'), replace=$<HTMLButtonElement>('restoreBackup');
const sections=$('backupSections'), report=$('backupStatus');
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
function summary(k: string,entry: CareerSummary | QuestSummary | ArenaSummary){
  if(k==='arena'){const item=entry as ArenaSummary;return 'Round '+item.round+' · '+item.fighters+' fighters · '+item.ratedFighters+' rated slots';}
  if(k==='quest'){const item=entry as QuestSummary;return item.questStatus+(item.attempts?' · Attempt '+item.attempts:'');}
  const item=entry as CareerSummary;
  if(k==='gauntlet')return item.seasons+' in-game weeks · '+item.records+' fighters';
  const detail=[item.seasons+' season'+(item.seasons===1?'':'s'),item.records+(k==='duel'?' fighters':' teams'),item.peaks+' peak records'];
  if(k==='duel')detail.push(item.heroes+' Saved Heroes');
  return detail.join(' · ');
}
picker.addEventListener('change',async()=>{
  const ticket=++revision;
  resetPreview();
  const file=picker.files?.[0];
  if(!file){announce('');return;}
  if(file.size>MAX_BACKUP_BYTES){announce('This file exceeds the 3.1 MB backup limit.','error');return;}
  announce('Checking backup…');
  try{
    const result=inspectArcadeBackup(await file.text());
    if(ticket!==revision)return;
    if(!result.ok){announce(result.error,'error');return;}
    inspected=result;
    for(const [k,item] of Object.entries(result.summary)){
      const row=node('label'), checkbox=node('input'), label=node('span');
      checkbox.type='checkbox';checkbox.value=k;checkbox.checked=true;
      label.append(node('strong',item.label),node('small',summary(k,item)));
      row.className='section-row';row.append(checkbox,label);sections.append(row);
    }
    const date=new Date(result.bundle.createdAt??'');
    $('backupDate').textContent=Number.isFinite(date.valueOf())?'Backup created '+date.toLocaleString():'';
    preview.hidden=false;sync();announce('Backup checked. Review the sections before replacing saves.','success');
  }catch{if(ticket===revision)announce('The selected file could not be opened.','error');}
});
$('downloadBackup').addEventListener('click',()=>{
  const result=exportArcadeBackup();
  if(!result.ok){announce(result.error,'error');return;}
  let url: string | undefined;
  try{
    url=URL.createObjectURL(new Blob([result.text],{type:'application/json'}));
    const a=node('a');a.href=url;a.download='saber-pit-save-'+result.bundle.createdAt!.slice(0,10)+'.json';a.hidden=true;
    document.body.append(a);a.click();a.remove();
    announce('Backup ready. Look in your downloads.','success');
  }catch{announce('The browser could not start the download.','error');}
  finally{if(url)setTimeout(()=>URL.revokeObjectURL(url!),2000);}
});
confirm.addEventListener('change',sync);
sections.addEventListener('change',()=>{confirm.checked=false;sync();});
replace.addEventListener('click',()=>{
  if(replace.disabled)return;
  const result=restoreArcadeBackup(inspected,undefined,{sections:current()});
  if(!result.ok){announce(result.error,'error');return;}
  resetPreview();picker.value='';
  announce('Selected saves restored. Open a game mode or reload any game tabs that are already open.','success');
});

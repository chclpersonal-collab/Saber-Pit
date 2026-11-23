import {browserSync,announceSyncedSave} from './cloud-sync-browser.js?v=3.3.0';
import {readCloudRecovery} from './arcade-cloud-sync.js';
const $=id=>document.getElementById(id);
const controls=['cloudEnable','cloudDisable','cloudCheck','cloudDevice','cloudPull'];
let last=null;
function draw(result){
  const enabled=browserSync.prefs().enabled;
  $('cloudEnable').hidden=enabled;$('cloudDisable').hidden=!enabled;$('cloudCheck').hidden=!enabled;
  $('cloudEnable').disabled=$('cloudDisable').disabled=$('cloudCheck').disabled=false;
  const status=result?.status??(enabled?'enabled':'disabled');
  const compare=['cloud-newer','conflict','reset','changed','recovery-blocked'].includes(status);
  $('cloudCompare').hidden=!compare;
  $('cloudPull').hidden=!result?.cloud;
  $('cloudDevice').hidden=!result?.device||status==='reset'||status==='cloud-newer';
  $('cloudPull').disabled=$('cloudDevice').disabled=false;
  const summary=items=>!items?'No saves found.':Object.values(items).map(x=>x.label+': '+
    (x.questStatus??(x.seasons+' seasons · '+x.records+' records'+(x.heroes?' · '+x.heroes+' Heroes':'')))).join(' / ');
  if(compare){$('cloudLocalSummary').textContent=summary(result.device);$('cloudRemoteSummary').textContent=summary(result.cloud);}
  $('cloudStatus').textContent=({
    disabled:'Sync is off. Saves stay on this device.',
    enabled:'Sync is on for this device.',
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
  })[status]??'';
}
async function go(action){
  if(['device','cloud'].includes(action)&&!last)return;
  for(const id of controls)$(id).disabled=true;
  $('cloudStatus').textContent='Checking saves…';
  try{last=await browserSync.sync({action,expectedRevision:last?.cloudRevision,expectedLocalDigest:last?.localDigest});}
  catch{last={status:'error',error:'Site storage must be enabled before linking saves.'};}
  if(last.status==='downloaded')announceSyncedSave();
  draw(last);
}
for(const [id,action] of Object.entries({cloudEnable:'enable',cloudDisable:'disable',cloudCheck:'check',cloudDevice:'device',cloudPull:'cloud'}))
  $(id).addEventListener('click',()=>go(action));
$('cloudRecovery').addEventListener('change',async e=>{
  if(!e.target.value)return;
  const copy=await readCloudRecovery(e.target.value);
  e.target.value='';
  if(!copy){$('cloudStatus').textContent='No recovery copy of that save was found.';return;}
  const url=URL.createObjectURL(new Blob([copy.text],{type:'application/json'}));
  const a=document.createElement('a');a.download='saber-pit-recovery-'+copy.reason+'.json';a.href=url;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
});
draw(null);
if(browserSync.prefs().enabled)go('check');

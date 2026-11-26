/** Arena startup gate: the purple loader in index.html stays up until the v6 home is mounted.
 *  The older layout is never revealed: a slow, failed or half-mounted start only offers a reload.
 *  The Reload link also appears from index.html's own CSS after 8s, so it shows even if this file never loads. */
const body=document.body;
const boot=document.getElementById('loomenBoot');
const status=document.getElementById('loomenBootStatus');
const showProblem=(message:string):void=>{
  if(!body.hasAttribute('data-loomen-boot'))return;
  if(status)status.textContent=message;
  if(boot)boot.dataset.failed='true';
};
const timeout=setTimeout(()=>showProblem('Still loading'),8000);
import('./arcade-sync-entry.js?v=6.0.3-back').then(()=>{
  requestAnimationFrame(()=>{
    clearTimeout(timeout);
    // A seated bout (?seat=gauntlet) opens straight into the match screen; the home is still mounted behind it.
    const view=body.dataset.view, seated=Boolean(body.dataset.seat||body.dataset.seatOpening);
    const skin=getComputedStyle(document.documentElement).getPropertyValue('--loomen-v6-skin').trim();
    if(skin!=='ready'||!document.getElementById('v6Home')||!body.dataset.v6||!(view==='menu'||seated&&view==='game')){
      showProblem('Load failed');
      return;
    }
    if(boot)boot.hidden=true;
    const app=document.getElementById('app');
    app?.removeAttribute('inert');
    app?.removeAttribute('aria-hidden');
    body.removeAttribute('data-loomen-boot');
  });
}).catch(()=>{
  clearTimeout(timeout);
  showProblem('Load failed');
});
export {};

/** Arena startup gate: the purple loader in index.html stays up until the v6 home is mounted.
 *  The older layout is never revealed: a slow, failed or half-mounted start only offers a reload. */
const body=document.body;
const boot=document.getElementById('loomenBoot');
const status=document.getElementById('loomenBootStatus');
const retry=document.getElementById('loomenBootRetry');
const showProblem=(message:string):void=>{
  if(!body.hasAttribute('data-loomen-boot'))return;
  if(status)status.textContent=message;
  if(retry)retry.hidden=false;
};
const timeout=setTimeout(()=>showProblem('Taking longer than expected. You can reload.'),8000);
import('./arcade-sync-entry.js?v=6.0.1-boot').then(()=>{
  requestAnimationFrame(()=>{
    clearTimeout(timeout);
    if(!document.getElementById('v6Home')||!body.dataset.v6||body.dataset.view!=='menu'){
      showProblem('LOOMEN couldn’t finish loading.');
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
  showProblem('LOOMEN couldn’t finish loading.');
});
export {};

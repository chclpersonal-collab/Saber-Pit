import {simulateGauntlet} from './gauntlet-sim.js?v=3.2.3';
export function gauntletWorkerReply(message){
  try { return {result:simulateGauntlet(message?.fixture??message)}; }
  catch(error){ return {error:error instanceof Error?error.message:'The gauntlet fight could not be simulated.'}; }
}
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
  globalThis.addEventListener('message',e=>globalThis.postMessage(gauntletWorkerReply(e.data)));
}

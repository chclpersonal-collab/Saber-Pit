import {simulateGauntlet} from './gauntlet-sim.js?v=3.2.3';
import type {GauntletFixture, GauntletWorkerRequest, GauntletWorkerReply, TournamentWorkerPort} from './tournament-worker-contract.js';

declare const WorkerGlobalScope: abstract new (...args: never[]) =>
  TournamentWorkerPort<GauntletWorkerRequest, GauntletWorkerReply>;

export function gauntletWorkerReply(message: GauntletWorkerRequest | GauntletFixture): GauntletWorkerReply {
  try {
    // The browser sends an envelope. The original entry point also accepts
    // a bare fixture; simulator validation still handles invalid payloads.
    const fixture=(message as GauntletWorkerRequest | null)?.fixture??message;
    return {result:simulateGauntlet(fixture as GauntletFixture)};
  }
  catch(error){ return {error:error instanceof Error?error.message:'The gauntlet fight could not be simulated.'}; }
}
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
  globalThis.addEventListener('message',e=>globalThis.postMessage(gauntletWorkerReply(e.data)));
}

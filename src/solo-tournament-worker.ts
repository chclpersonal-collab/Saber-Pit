import {playTournamentBout} from './arcade-tournament-sim.js?v=3.0.0';
import type {SoloWorkerRequest, SoloWorkerReply, TournamentWorkerPort} from './tournament-worker-contract.js';

declare const self: TournamentWorkerPort<SoloWorkerRequest, SoloWorkerReply>;

self.onmessage=({data})=>{
  try{self.postMessage({result:playTournamentBout(data)});}
  catch(error){self.postMessage({error:(error as {message?: string} | null | undefined)?.message??'Could not simulate bout.'});}
};

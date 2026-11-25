import {playTournamentBout} from './arcade-tournament-sim.js?v=6.0.3-seat';
import type {SoloWorkerRequest, SoloWorkerReply, TournamentWorkerPort} from './tournament-worker-contract.js?v=6.0.3-seat';

declare const self: TournamentWorkerPort<SoloWorkerRequest, SoloWorkerReply>;

self.onmessage=({data})=>{
  try{self.postMessage({result:playTournamentBout(data)});}
  catch(error){self.postMessage({error:(error as {message?: string} | null | undefined)?.message??'Could not simulate bout.'});}
};

import {playSquadBout} from './squad-tournament-sim.js?v=3.2.4';
import type {SquadWorkerRequest, SquadWorkerReply, TournamentWorkerPort} from './tournament-worker-contract.js';

declare const self: TournamentWorkerPort<SquadWorkerRequest, SquadWorkerReply>;

self.onmessage=({data})=>{
  try{self.postMessage({result:playSquadBout(data)});}
  catch(error){self.postMessage({error:(error as {message?: string} | null | undefined)?.message??'Could not simulate bout.'});}
};

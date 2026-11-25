import {playSquadBout} from './squad-tournament-sim.js?v=6.0.3-seat';
import type {SquadWorkerRequest, SquadWorkerReply, TournamentWorkerPort} from './tournament-worker-contract.js?v=6.0.3-seat';

declare const self: TournamentWorkerPort<SquadWorkerRequest, SquadWorkerReply>;

self.onmessage=({data})=>{
  try{self.postMessage({result:playSquadBout(data)});}
  catch(error){self.postMessage({error:(error as {message?: string} | null | undefined)?.message??'Could not simulate bout.'});}
};

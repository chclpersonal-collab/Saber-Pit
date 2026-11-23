import {playTournamentBout} from './arcade-tournament-sim.js?v=3.0.0';
self.onmessage=({data})=>{
  try{self.postMessage({result:playTournamentBout(data)});}
  catch(error){self.postMessage({error:error?.message??'Could not simulate bout.'});}
};

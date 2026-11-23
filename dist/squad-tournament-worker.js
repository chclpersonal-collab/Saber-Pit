import {playSquadBout} from './squad-tournament-sim.js?v=3.2.4';
self.onmessage=({data})=>{
  try{self.postMessage({result:playSquadBout(data)});}
  catch(error){self.postMessage({error:error?.message??'Could not simulate bout.'});}
};

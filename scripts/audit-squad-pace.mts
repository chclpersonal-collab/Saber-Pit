import {loadSquadTournament,startSquadTournament,nextSquadBout} from '../dist/squad-tournament.js';
import {playSquadBout,SQUAD_REPLAY_RULESET} from '../dist/squad-tournament-sim.js';

const requested=(process.argv[2]??'75').split(',').map(Number);
const sample=Number(process.argv[3]??12);
for (const limit of requested){
  const rows=Array.from({length:sample},(_,n)=>{
    const season=startSquadTournament(loadSquadTournament({getItem:()=>null}),{seed:1492+n*313,limit,terrain:'rotation'});
    return nextSquadBout(season);
  });
  const versions=[...new Set([29,SQUAD_REPLAY_RULESET])];
  for(const version of versions){
    let draws=0, a=0, b=0, totalTime=0, totalKO=0, closeDraws=0;
    for(const [index,f] of rows.entries()){
      const teams=index%2?[...f.teams].reverse():f.teams;
      const base={...f,teams};
      // Record concrete chess styles through the current format before
      // evaluating either historical ruleset on this exact pairing.
      const result=playSquadBout({...base,ruleset:version});
      if(result.winnerIndex===null){draws++;closeDraws+=Number(Math.max(...result.deaths)>=4);}
      else if(result.winnerIndex===0)a++;else b++;
      totalKO+=result.deaths.reduce((x,y)=>x+y,0);totalTime+=result.time;
    }
    console.log({limit,version,sample,draws,a,b,closeDraws,meanKOs:Number((totalKO/sample).toFixed(2)),meanSeconds:Number((totalTime/sample).toFixed(2))});
  }
}

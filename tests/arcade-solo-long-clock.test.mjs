import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {createTournamentReplay,playTournamentBout} from '../dist/arcade-tournament-sim.js';
import {sanitizeMatchReport} from '../dist/arcade-match-report.js';

test('360 seconds stays opt-in and only for watched solo elimination',()=>{
  for(const extra of [
    {mode:'duel',teamSizes:[1,1],soloTournamentClock:true},
    {mode:'watch',teamSizes:[1,1]},
    {mode:'watch',teamSizes:[5,5],soloTournamentClock:true},
    {mode:'watch',teamSizes:[1,1],rule:'control',soloTournamentClock:true},
  ])assert.equal(createArcade({limit:360,...extra}).limit,75);
  assert.equal(createArcade({mode:'watch',limit:360,teamSizes:[1,1],soloTournamentClock:true}).limit,360);
  for(const clock of [45,75,90,150])assert.equal(createArcade({mode:'duel',limit:clock}).limit,clock);
});

for(const [name,seed,ruleset] of [['legacy',11,12],['chess',3,13]])
test(name+' solo six-minute timeout has no fictitious kills, serializes and replays exactly',()=>{
  const original=playTournamentBout({ruleset,seed,grade:'SSS+V',limit:360,terrain:'crossroads',
    fighters:[{id:'a',name:'A',form:'soresu',chessStyle:'knight'},{id:'b',name:'B',form:'soresu',chessStyle:'queen'}]});
  assert.equal(original.reason,'timeout');
  assert.equal(original.winnerIndex,null);
  assert.deepEqual(original.kills,[0,0]);
  assert.deepEqual(original.deaths,[0,0]);
  assert.ok(Math.abs(original.time-360)<1e-8);
  const replay=JSON.parse(JSON.stringify(original.replay));
  assert.equal(replay.limit,360);
  assert.equal(sanitizeMatchReport(replay.matchReport)?.limit,360);
  assert.equal(sanitizeMatchReport(replay.matchReport)?.elapsed,360);
  const game=createTournamentReplay(replay);
  assert.equal(game.limit,360);
  for(let i=0;i<3605&&game.phase==='playing';i++)stepArcade(game,.1);
  assert.equal(game.time,original.time);
  assert.equal(game.endReason,original.reason);
  assert.deepEqual(game.fighters.map(f=>f.stats),original.stats);
});

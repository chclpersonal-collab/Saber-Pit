import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeReplayRules} from '../dist/arcade-replay-rules.js';
import {createTournamentReplay,TOURNAMENT_REPLAY_RULESET} from '../dist/arcade-tournament-sim.js';
import {createSquadReplay,SQUAD_REPLAY_RULESET} from '../dist/squad-tournament-sim.js';

const fighters=[
  {id:'a',name:'Temu Rae',form:'ataru',body:'rabbit'},
  {id:'b',name:'Nara Qiu',form:'soresu',body:'woman'}
];
const teams=[{id:'one',name:'Temu-Nara'},{id:'two',name:'Iru-Qiu'}].map((t,i)=>({
  ...t,fighters:Array.from({length:5},(_,j)=>({...fighters[(i+j)%2],id:t.id+j}))
}));
function run(game,step){
  for(let n=0;n<game.limit*120+3&&game.phase==='playing';n++)step(game,1/120);
  return [game.phase==='won'?0:game.phase==='lost'?1:null,Math.round(game.time*120),game.stats.kills,game.stats.deaths,game.endReason];
}
test('replays from the previous solo and squad rules preserve recorded outcomes',async()=>{
  const {createArcade,stepArcade}=await arcadeReplayRules(219);
  const solo=createTournamentReplay({ruleset:2,fighters,seed:21,grade:'A',limit:45,terrain:'underpit'},undefined,createArcade);
  const squad=createSquadReplay({ruleset:1,teams,seed:316954,round:1,limit:45,terrain:'underpit'},createArcade);
  assert.deepEqual(run(solo,stepArcade),[1,1084,[0,1],[1,0],'elimination']);
  assert.deepEqual(run(squad,stepArcade),[0,5400,[0,0],[0,0],'timeout']);
  assert.equal(TOURNAMENT_REPLAY_RULESET,30);
  assert.equal(SQUAD_REPLAY_RULESET,30);
  const active=await arcadeReplayRules();
  assert.notEqual(active.stepArcade,stepArcade);
});
test('v2.20 solo and squad replay fixtures retain their own outcomes',async()=>{
  const {createArcade,stepArcade}=await arcadeReplayRules(220);
  const solo=createTournamentReplay({ruleset:3,fighters,seed:21,grade:'A',limit:45,terrain:'underpit'},undefined,createArcade);
  const squad=createSquadReplay({ruleset:2,teams,seed:316954,round:1,limit:45,terrain:'underpit'},createArcade);
  assert.deepEqual(run(solo,stepArcade),[1,2678,[0,1],[1,0],'elimination']);
  assert.deepEqual(run(squad,stepArcade),[1,5400,[0,2],[2,0],'timeout']);
});
test('v2.21 replays with staff and dual sabers do not pick up new weapon timing',async()=>{
  const {createArcade,stepArcade}=await arcadeReplayRules(221);
  const equipped=fighters.map((f,i)=>({...f,gear:i?{weapon:'dual',grip:'backhand'}:{weapon:'staff',dualPhase:true}}));
  const squads=teams.map((t,i)=>({...t,fighters:Array.from({length:5},(_,j)=>({...equipped[(i+j)%2],id:t.id+j}))}));
  const solo=createTournamentReplay({ruleset:4,fighters:equipped,seed:21,grade:'A',limit:45,terrain:'underpit'},undefined,createArcade);
  const squad=createSquadReplay({ruleset:3,teams:squads,seed:316954,round:1,limit:45,terrain:'underpit'},createArcade);
  assert.deepEqual(run(solo,stepArcade),[1,3292,[0,1],[1,0],'elimination']);
  assert.deepEqual(run(squad,stepArcade),[1,5400,[0,2],[2,0],'timeout']);
});
test('v2.22 alternate-tip staff tournament replays retain their recorded results',async()=>{
  const {createArcade,stepArcade}=await arcadeReplayRules(222);
  const equipped=fighters.map((f,i)=>({...f,gear:i?{weapon:'dual',grip:'backhand'}:{weapon:'staff',dualPhase:true}}));
  const squads=teams.map((t,i)=>({...t,fighters:Array.from({length:5},(_,j)=>({...equipped[(i+j)%2],id:t.id+j}))}));
  const solo=createTournamentReplay({ruleset:5,fighters:equipped,seed:21,grade:'A',limit:45,terrain:'underpit'},undefined,createArcade);
  const squad=createSquadReplay({ruleset:4,teams:squads,seed:316954,round:1,limit:45,terrain:'underpit'},createArcade);
  assert.deepEqual(run(solo,stepArcade),[0,3042,[1,0],[0,1],'elimination']);
  assert.deepEqual(run(squad,stepArcade),[1,5400,[0,1],[1,0],'timeout']);
});
test('v2.23 directional-pivot recordings use the engine that created them',async()=>{
  const {createArcade,stepArcade}=await arcadeReplayRules(223);
  const equipped=fighters.map((f,i)=>({...f,gear:i?{weapon:'dual',grip:'backhand'}:{weapon:'staff',dualPhase:true}}));
  const squads=teams.map((t,i)=>({...t,fighters:Array.from({length:5},(_,j)=>({...equipped[(i+j)%2],id:t.id+j}))}));
  const solo=createTournamentReplay({ruleset:6,fighters:equipped,seed:21,grade:'A',limit:45,terrain:'underpit'},undefined,createArcade);
  const squad=createSquadReplay({ruleset:5,teams:squads,seed:316954,round:1,limit:45,terrain:'underpit'},createArcade);
  assert.deepEqual(run(solo,stepArcade),[1,2323,[0,1],[1,0],'elimination']);
  assert.deepEqual(run(squad,stepArcade),[0,5400,[1,1],[1,1],'timeout']);
});
test('pre-rank-update draw-era replays preserve their exact combat timeline',async()=>{
  const {createArcade,stepArcade}=await arcadeReplayRules(226);
  const equipped=fighters.map((f,i)=>({...f,gear:i?{weapon:'dual',grip:'backhand'}:{weapon:'staff',dualPhase:true}}));
  const squads=teams.map((t,i)=>({...t,fighters:Array.from({length:5},(_,j)=>({...equipped[(i+j)%2],id:t.id+j}))}));
  const solo=createTournamentReplay({ruleset:8,fighters:equipped,seed:21,grade:'A',limit:45,terrain:'underpit'},undefined,createArcade);
  const squad=createSquadReplay({ruleset:7,teams:squads,seed:316954,round:1,limit:45,terrain:'underpit'},createArcade);
  assert.deepEqual(run(solo,stepArcade),[1,2323,[0,1],[1,0],'elimination']);
  assert.deepEqual(run(squad,stepArcade),[0,5400,[1,1],[1,1],'timeout']);
});

test('only new tournament descriptors activate the new weapon choreography rules',async()=>{
  const legacySolo={ruleset:9,fighters,seed:21,grade:'SSS+V',limit:45,terrain:'underpit'};
  const legacySquad={ruleset:8,teams,seed:316954,round:1,limit:45,terrain:'underpit'};
  const oldSolo=createTournamentReplay(legacySolo);
  const newSolo=createTournamentReplay({...legacySolo,ruleset:undefined});
  const oldSquad=createSquadReplay(legacySquad);
  const newSquad=createSquadReplay({...legacySquad,ruleset:undefined});
  assert.ok(oldSolo.fighters.every(f=>!f.weaponFlow));
  assert.ok(oldSquad.fighters.every(f=>!f.weaponFlow));
  assert.ok(newSolo.fighters.every(f=>f.weaponFlow));
  assert.ok(newSquad.fighters.every(f=>f.weaponFlow));
});

test('2.46 final solo and squad rules remain eligible for 3.00 playback',async()=>{
  const {supportsArcadeReplay}=await import('../dist/arcade-replay-rules.js');
  assert.equal(supportsArcadeReplay(20,2,TOURNAMENT_REPLAY_RULESET),true);
  assert.equal(supportsArcadeReplay(19,1,SQUAD_REPLAY_RULESET),true);
  assert.equal(supportsArcadeReplay(1,2,TOURNAMENT_REPLAY_RULESET),false);
  assert.equal(supportsArcadeReplay(TOURNAMENT_REPLAY_RULESET+1,2,TOURNAMENT_REPLAY_RULESET),false);
  assert.equal(supportsArcadeReplay('20',2,TOURNAMENT_REPLAY_RULESET),false);
});

test('3.00 exchange choices are limited to new recordings',()=>{
  const readyFighters=fighters.map((f,i)=>({...f,chessStyle:i?'bishop':'king'}));
  const readyTeams=teams.map((t,i)=>({...t,fighters:Array.from({length:5},(_,j)=>({...readyFighters[(i+j)%2],id:t.id+j}))}));
  const solo={fighters:readyFighters,seed:21,grade:'SSS+V',limit:45,terrain:'underpit'};
  const squad={teams:readyTeams,seed:316954,round:1,limit:45,terrain:'underpit'};
  assert.equal(createTournamentReplay({...solo,ruleset:21}).config.exchangeVariety,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:20}).config.exchangeVariety,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:22}).config.exchangeVariety,true);
  assert.equal(createSquadReplay({...squad,ruleset:21}).config.exchangeVariety,true);
  assert.equal(createTournamentReplay({...solo,ruleset:22}).config.fluidFootwork,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:21}).config.fluidFootwork,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:23}).config.fluidFootwork,true);
  assert.equal(createSquadReplay({...squad,ruleset:22}).config.fluidFootwork,true);
  assert.equal(createTournamentReplay({...solo,ruleset:22}).config.eloReads,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:23}).config.eloReads,true);
  assert.equal(createSquadReplay({...squad,ruleset:21}).config.eloReads,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:22}).config.eloReads,true);
  assert.equal(createTournamentReplay({...solo,ruleset:23}).config.stanceFlow,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:24}).config.stanceFlow,true);
  assert.equal(createSquadReplay({...squad,ruleset:22}).config.stanceFlow,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:23}).config.stanceFlow,true);
  assert.equal(createTournamentReplay({...solo,ruleset:24}).config.liveEntry,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:25}).config.liveEntry,true);
  assert.equal(createSquadReplay({...squad,ruleset:23}).config.liveEntry,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:24}).config.liveEntry,true);
  assert.equal(createTournamentReplay({...solo,ruleset:25}).config.impactPhysics,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:26}).config.impactPhysics,true);
  assert.equal(createSquadReplay({...squad,ruleset:24}).config.impactPhysics,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:25}).config.impactPhysics,true);
  assert.equal(createTournamentReplay({...solo,ruleset:26}).config.recoveryFlow,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:27}).config.recoveryFlow,true);
  assert.equal(createSquadReplay({...squad,ruleset:25}).config.recoveryFlow,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:26}).config.recoveryFlow,true);
  assert.equal(createTournamentReplay({...solo,ruleset:27}).config.balancePass,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:28}).config.balancePass,true);
  assert.equal(createSquadReplay({...squad,ruleset:26}).config.balancePass,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:27}).config.balancePass,true);
  assert.equal(createTournamentReplay({...solo,ruleset:28}).config.closeChoice,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:29}).config.closeChoice,true);
  assert.equal(createSquadReplay({...squad,ruleset:27}).config.closeChoice,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:28}).config.closeChoice,true);
  assert.equal(createTournamentReplay({...solo,ruleset:29}).config.guardCounterplay,undefined);
  assert.equal(createTournamentReplay({...solo,ruleset:30}).config.guardCounterplay,true);
  assert.equal(createSquadReplay({...squad,ruleset:28}).config.guardCounterplay,undefined);
  assert.equal(createSquadReplay({...squad,ruleset:29}).config.guardCounterplay,true);
});

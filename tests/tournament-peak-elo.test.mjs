import test from 'node:test';
import assert from 'node:assert/strict';
import * as duel from '../dist/arcade-tournament.js';
import * as squad from '../dist/squad-tournament.js';
const storage=()=>{const db=new Map();return {getItem:key=>db.get(key),setItem:(key,v)=>db.set(key,v)};};
const decision={winnerIndex:0,reason:'elimination',kills:[1,0],deaths:[0,1],time:14};
const draw={winnerIndex:null,reason:'timeout',kills:[0,0],deaths:[0,0],time:45};
const fixtures=[
  {name:'duel',key:duel.TOURNAMENT_KEY,load:duel.loadTournament,save:duel.saveTournament,start:duel.startTournament,
    next:duel.nextTournamentBout,run:duel.runTournamentStep,board:duel.tournamentPeakLeaderboard,reset:duel.resetTournament,records:'records',ids:'fighterIds'},
  {name:'squad',key:squad.SQUAD_TOURNAMENT_KEY,load:squad.loadSquadTournament,save:squad.saveSquadTournament,start:squad.startSquadTournament,
    next:squad.nextSquadBout,run:squad.runSquadStep,board:squad.squadPeakLeaderboard,reset:squad.resetSquadTournament,records:'teams',ids:'teamIds'},
];
for(const api of fixtures)test(api.name+' stores real peaks across losses and saves without contaminating current Elo',()=>{
  const disk=storage(),state=api.start(api.load(disk),{seed:62,limit:45});
  assert.deepEqual(api.board(state),[]);
  const [winnerId,loserId]=api.next(state)[api.ids], loser=state[api.records][loserId], winner=state[api.records][winnerId];
  const floor=winner.elo;
  api.run(state,()=>decision);
  const attained=api.board(state).find(p=>p.id===winnerId);
  assert.equal(attained.peakSeason,1);assert.ok(attained.peakElo>floor);
  assert.equal(api.board(state).find(p=>p.id===loserId),undefined);
  const oldCurrent=winner.elo;winner.elo=floor;
  assert.equal(api.board(state).find(p=>p.id===winnerId).peakElo,oldCurrent);
  api.save(state,disk);
  const restored=api.load(disk);
  assert.equal(restored[api.records][winnerId].elo,floor);
  assert.deepEqual(api.board(restored),api.board(state));
  delete restored[api.records][winnerId]; // exact archive survives ordinary roster pruning
  assert.ok(api.board(restored).some(p=>p.id===winnerId));
  const raw=JSON.parse(disk.getItem(api.key));
  delete raw.peaks;raw[api.records][winnerId].elo=oldCurrent;
  disk.setItem(api.key,JSON.stringify(raw));const legacy=api.load(disk);
  const fallback=api.board(legacy).find(p=>p.id===winnerId);
  assert.equal(fallback.peakElo,oldCurrent);assert.equal(fallback.peakSeason,null);
  assert.deepEqual(api.board(api.reset(restored)),[]);
});
for(const api of fixtures)test(api.name+' records a new peak when a lower-rated actor earns a draw',()=>{
  const state=api.start(api.load(storage()),{seed:51,limit:45});
  const [less,more]=api.next(state)[api.ids];
  state[api.records][more].elo+=200;
  const before=state[api.records][less].elo;
  api.run(state,()=>draw);
  const peak=api.board(state).find(row=>row.id===less);
  assert.ok(peak.peakElo>before);
  assert.equal(peak.peakSeason,1);
  assert.equal(api.board(state).find(row=>row.id===more).peakSeason,null);
});
test('editing a saved Hero rating cannot create or alter a tournament peak',()=>{
  const state=duel.startTournament(duel.loadTournament(storage()),{seed:17});
  const winner=duel.nextTournamentBout(state).fighterIds[0];
  duel.runTournamentStep(state,()=>decision);
  duel.saveTournamentHero(state,winner);
  const before=duel.tournamentPeakLeaderboard(state);
  duel.setTournamentHeroElo(state,winner,5000,'F');
  assert.deepEqual(duel.tournamentPeakLeaderboard(state),before);
});

test('remove Hero deletes only the saved snapshot, leaving fighter, peak, and quest saves intact',()=>{
  const disk=storage(), state=duel.startTournament(duel.loadTournament(disk),{seed:18});
  const winner=duel.nextTournamentBout(state).fighterIds[0];
  duel.runTournamentStep(state,()=>decision);duel.saveTournamentHero(state,winner);
  disk.setItem('saber-pit:quests:1','quest data');
  const before=duel.tournamentPeakLeaderboard(state), original=structuredClone(state.records[winner]);
  assert.equal(duel.removeTournamentHero(state,winner),true);
  assert.equal(duel.removeTournamentHero(state,winner),false);
  assert.deepEqual(state.records[winner],original);
  assert.deepEqual(duel.tournamentPeakLeaderboard(state),before);
  duel.saveTournament(state,disk);
  assert.equal(duel.loadTournament(disk).heroes[winner],undefined);
  assert.equal(disk.getItem('saber-pit:quests:1'),'quest data');
});

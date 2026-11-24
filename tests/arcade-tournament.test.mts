import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTournament,saveTournament,startTournament,resetTournament,nextTournamentBout,runTournamentStep,
  tournamentLeaderboard,tournamentHeroes,saveTournamentHero,setTournamentHeroElo,TOURNAMENT_KEY} from '../dist/arcade-tournament.js';
import {playTournamentBout} from '../dist/arcade-tournament-sim.js';
const makeStorage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
const win=(opts={})=>({winnerIndex:0,time:5,reason:'elimination',kills:[1,0],deaths:[0,1],...opts});
const adapted=(bouts=1)=>({bouts,wins:1,lastDoctrine:'defensive',variants:{defensive:{bouts,wins:1,score:.6}},
  observed:{accuracy:.45,pressure:.31,forceRate:.29}});
test('twenty-four named seeded players advance through eight play-ins plus exact 8/4/2/1 single elimination, reloadable after every match',()=>{
  const store=makeStorage();
  let state=loadTournament(store);
  startTournament(state,{seed:105});
  const copy=startTournament(loadTournament(makeStorage()),{seed:105});
  assert.deepEqual(copy.active.entrants,state.active.entrants);
  assert.equal(new Set(state.active.entrants.map(id=>state.records[id].name)).size,24);
  assert.equal(state.active.directEntrants.length,8);assert.equal(state.active.qualifiers.length,8);
  assert.deepEqual(state.active.rounds.map(x=>x.length),[8,4,2,1]);
  assert.deepEqual(tournamentLeaderboard(state),[]);
  assert.equal(saveTournamentHero(state,state.active.entrants[0]),null);
  for(let i=0;i<23;i++){
    const fixture=nextTournamentBout(state);
    assert.ok(fixture?.left?.id&&fixture?.right?.id);
    assert.equal(fixture.stage,i<8?'qualifier':'main');
    const r=runTournamentStep(state,()=>win());
    assert.equal(r.id,fixture.id);assert.equal(r.status,'settled');
    assert.equal(r.winnerId,fixture.left.id);
    if(i<8){
      assert.equal(state.active.rounds[0][i].fighterIds[1],r.winnerId);
      assert.equal(state.records[r.loserId].losses,1);
      assert.equal(state.records[r.loserId].deaths,1);
    }
    assert.equal(saveTournament(state,store),true);
    state=loadTournament(store);
  }
  assert.equal(nextTournamentBout(state),null);assert.equal(runTournamentStep(state,()=>win()),null);
  assert.equal(state.active.status,'completed');assert.equal(state.history.length,1);
  assert.equal(tournamentLeaderboard(state)[0].wins,4);assert.equal(tournamentLeaderboard(state)[0].titles,1);
  assert.equal(tournamentLeaderboard(state).length,10);
  assert.equal(Object.values(state.records).reduce((n,f)=>n+f.kills,0),23);
});
test('actual K/D separate from wins, champions return unchanged, Hero is an independent adapted snapshot',()=>{
  const store=makeStorage();let state=loadTournament(store);
  startTournament(state,{seed:'named season'});
  const initial=state.active.directEntrants[0];
  let n=0;
  while(nextTournamentBout(state))runTournamentStep(state,input=>{
    n++;
    return {...win({reason:'decision',kills:[0,0],deaths:[0,0]}),profiles:[adapted(input.left.profile.bouts+1),adapted(input.right.profile.bouts+1)]};
  });
  assert.equal(n,23);assert.equal(state.championId,initial);
  const champ=state.records[state.championId], prior=structuredClone(champ.profile);
  assert.equal(prior.bouts,4);assert.deepEqual([champ.kills,champ.deaths],[0,0]);
  const snapshot=saveTournamentHero(state,champ.id);
  snapshot.profile.observed.accuracy=0;
  assert.equal(tournamentHeroes(state)[0].profile.observed.accuracy,.45);
  saveTournament(state,store);state=loadTournament(store);
  const expectedReturning=new Set([...state.active.rounds[0].map(p=>p.winnerId),...tournamentLeaderboard(state,10).map(row=>row.id)]);
  const priorRoster=state.active.entrants;
  startTournament(state,{seed:'next season',grade:'SS'});
  assert.ok(state.active.directEntrants.includes(champ.id));
  assert.ok([...expectedReturning].every(id=>state.active.entrants.includes(id)));
  assert.equal(state.active.entrants.filter(x=>priorRoster.includes(x)).length,20);
  assert.deepEqual(state.records[champ.id].profile,prior);assert.equal(state.records[champ.id].name,champ.name);
  state.records[champ.id].profile.observed.accuracy=.91;
  assert.equal(tournamentHeroes(state)[0].profile.observed.accuracy,.45);
});
test('tied bouts reverse colors and survive reload without recording wins, losses, or kills from advancement',()=>{
  const store=makeStorage();
  let state=startTournament(loadTournament(store),{seed:6,limit:90});
  const p=nextTournamentBout(state);
  const settle=outcome=>runTournamentStep(state,()=>outcome);
  const a=settle({winnerIndex:null,time:90,reason:'draw',stats:[{saberHits:4},{saberHits:5}]});
  assert.equal(a.status,'runoff');assert.equal(a.winnerId,null);assert.equal(state.records[p.left.id].wins,0);
  saveTournament(state,store);state=loadTournament(store);
  assert.equal(nextTournamentBout(state).left.id,p.right.id);
  assert.equal(settle({winnerIndex:null,time:90,reason:'draw',score:[1,11]}).status,'runoff');
  saveTournament(state,store);state=loadTournament(store);
  const r=settle({winnerIndex:null,time:90,reason:'draw',score:[0,1]});
  assert.equal(r.result.reason,'draw-advance');assert.ok(p.fighterIds.includes(r.winnerId));
  assert.deepEqual(r.attempts.map(m=>m.pressure),[[4,5],[11,1],[0,1]]);
  for(const key of p.fighterIds)assert.deepEqual([state.records[key].wins,state.records[key].draws,state.records[key].losses,state.records[key].kills],[0,3,0,0]);
  assert.notEqual(nextTournamentBout(state).id,p.id);
});
test('storage failures and malformed state are harmless, stalled async callbacks cannot settle twice',()=>{
  assert.equal(saveTournament(loadTournament(null),null),false);
  const store=makeStorage();
  store.setItem(TOURNAMENT_KEY,'{"version":1,"active":{"entrants":[]}}');
  const state=loadTournament(store);
  assert.equal(state.active,null);
  startTournament(state,{seed:1});
  const before=nextTournamentBout(state);
  assert.throws(()=>runTournamentStep(state,async()=>win()),/synchronous/);
  assert.equal(nextTournamentBout(state).id,before.id);
  const r=runTournamentStep(state,()=>{assert.equal(runTournamentStep(state,()=>win()),null);return win();});
  assert.equal(r.winnerId,before.left.id);assert.equal(state.records[r.winnerId].wins,1);
});
test('live Arcade engine result feeds names, separate K/D, and learned profile into the bracket',()=>{
  const state=startTournament(loadTournament(null),{seed:20,limit:45});
  const p=nextTournamentBout(state);
  const r=runTournamentStep(state,playTournamentBout);
  assert.ok(r.attempts[0].time>1);
  for(const id of p.fighterIds){
    assert.equal(state.records[id].profile.bouts,1);
    assert.ok(state.records[id].profile.observed.accuracy>=0);
  }
});

test('only the latest valid actual fixture replay remains available after reload',()=>{
  const store=makeStorage();
  let state=startTournament(loadTournament(store),{seed:9,limit:90});
  const fromInput=b=>({seed:b.seed,round:b.round,limit:b.limit,grade:b.grade,terrain:b.terrain,
    fighters:b.fighters.map((f,i)=>({...f,gear:{...f.gear,forceFamily:i?'force_pulse':'force_push'}})),
    plans:[{doctrine:'defensive'},{doctrine:'aggressive'}]});
  runTournamentStep(state,b=>({...win(),replay:fromInput(b)}));
  const saved=structuredClone(state.active.lastReplay);
  assert.ok(saved?.fighters?.[0].name);assert.equal(saved.limit,90);
  assert.deepEqual(saved.plans,[{doctrine:'defensive'},{doctrine:'aggressive'}]);
  assert.equal(Object.hasOwn(saved.fighters[0],'profile'),false);
  runTournamentStep(state,b=>({...win(),replay:{...fromInput(b),seed:10}}));
  assert.deepEqual(state.active.lastReplay,saved);
  saveTournament(state,store);state=loadTournament(store);
  assert.deepEqual(state.active.lastReplay,saved);
  const raw=JSON.parse(store.getItem(TOURNAMENT_KEY));
  raw.active.lastReplay.fighters[0].id='non-entrant';
  store.setItem(TOURNAMENT_KEY,JSON.stringify(raw));
  assert.equal(loadTournament(store).active.lastReplay,null);
});

test('elite seasons default to SSS+V, actual settled results update Elo and only elite entrants save as Heroes',()=>{
  const store=makeStorage(), state=startTournament(loadTournament(store),{seed:11});
  assert.equal(state.active.grade,'SSS+V');
  const first=nextTournamentBout(state), floor=first.left.elo;
  runTournamentStep(state,()=>win({kills:[0,0],deaths:[0,0],reason:'decision'}));
  assert.equal(state.records[first.left.id].elo,floor+8);
  assert.equal(state.records[first.right.id].elo,floor);
  assert.equal(tournamentLeaderboard(state)[0].id,first.left.id);
  const hero=saveTournamentHero(state,first.left.id);assert.equal(hero.rank,'SSS+V');
  saveTournament(state,store);assert.equal(loadTournament(store).records[first.left.id].elo,floor+8);
  const legacy=startTournament(loadTournament(makeStorage()),{seed:9,grade:'A'});
  const low=nextTournamentBout(legacy).left.id;
  runTournamentStep(legacy,()=>win());
  legacy.active.grade='A';
  legacy.records[low].rank=legacy.records[low].grade='A';
  legacy.records[low].elo=2003;
  assert.equal(saveTournamentHero(legacy,low),null);
  legacy.heroes[low]={...legacy.records[low],profile:adapted(2),eloFloorGrade:'C',elo:2200};
  const priorOutcome=legacy.active.qualifiers[0].result;
  delete legacy.eloScale;
  store.setItem(TOURNAMENT_KEY,JSON.stringify(legacy));
  const restored=loadTournament(store);
  assert.equal(restored.active.grade,'SSS+V');
  assert.deepEqual(restored.active.qualifiers[0].result,priorOutcome);
  assert.equal(restored.heroes[low].rank,'SSS+V');
  assert.equal(restored.heroes[low].name,legacy.records[low].name);
  assert.equal(restored.heroes[low].profile.bouts,2);
  assert.equal(restored.records[low].rank,'SSS+V');
  assert.equal(restored.heroes[low].elo,700);
  assert.equal(restored.heroes[low].eloFloorGrade,'C');
  assert.ok(restored.records[low].elo>=1500);
  assert.ok(nextTournamentBout(restored).fighters.every(f=>f.rank==='SSS+V'));
  const before=restored.records[low].elo;
  const updated=setTournamentHeroElo(restored,low,1340,'E');
  assert.equal(updated.elo,1340);assert.equal(updated.rank,'SSS+V');assert.equal(updated.eloFloorGrade,'E');
  assert.equal(restored.records[low].elo,before);
  assert.equal(setTournamentHeroElo(restored,low,100,'F').elo,100);
  saveTournament(restored,store);
  assert.equal(loadTournament(store).heroes[low].elo,100);
});

test('made-up names replace legacy display names without replacing fighter identities or results',()=>{
  const store=makeStorage(),state=loadTournament(store);
  startTournament(state,{seed:105});
  for(let i=0;i<23;i++)runTournamentStep(state,()=>win({adaptations:[adapted(),adapted()]}));
  const key=state.championId,name=state.records[key].name,hero=saveTournamentHero(state,key);
  const legacy=key.split('-').slice(1).map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
  assert.notEqual(name,legacy);
  state.records[key].name=state.heroes[key].name=state.history[0].championName=legacy;
  saveTournament(state,store);
  const restored=loadTournament(store);
  assert.equal(restored.championId,key);
  const migratedName='Tairen Rinkha'; // v2.34's original visible name for this legacy identity
  assert.equal(restored.records[key].name,migratedName);
  assert.equal(restored.history[0].championName,migratedName);
  assert.deepEqual(restored.heroes[key],{...hero,name:migratedName});
  assert.deepEqual(restored.active.rounds,state.active.rounds);
  assert.deepEqual(restored.active.entrants,state.active.entrants);
});


test('an old 16-entry bracket resumes main stage and keeps a valid replay after normalization',()=>{
  const store=makeStorage(), raw=startTournament(loadTournament(store),{seed:909,limit:90});
  raw.active.entrants=raw.active.entrants.slice(0,16);
  delete raw.active.directEntrants;delete raw.active.qualifiers;delete raw.active.fieldSize;
  for(const fixture of raw.active.rounds[0])fixture.fighterIds=raw.active.entrants.slice(fixture.index*2,fixture.index*2+2);
  for(const row of raw.active.rounds)for(const fixture of row)delete fixture.stage;
  saveTournament(raw,store);let state=loadTournament(store);
  assert.equal(state.active.qualifiers.length,0);assert.equal(state.active.entrants.length,16);
  const input=nextTournamentBout(state);assert.equal(input.stage,'main');
  runTournamentStep(state,b=>({...win(),replay:{seed:b.seed,round:b.round,limit:b.limit,terrain:b.terrain,grade:b.grade,
    fighters:b.fighters,plans:[{doctrine:'balanced'},{doctrine:'defensive'}]}}));
  assert.ok(state.active.lastReplay);
  const names=state.active.lastReplay.fighters.map(f=>f.name);
  saveTournament(state,store);state=loadTournament(store);
  assert.deepEqual(state.active.lastReplay.fighters.map(f=>f.name),names);
  assert.equal(state.active.rounds[0][0].winnerId,input.left.id);
  let left=0;while(nextTournamentBout(state)){runTournamentStep(state,()=>win());left++;}
  assert.equal(left,14);assert.equal(state.active.status,'completed');
});

test('reset clears only 1v1 progress, and the same new seed does not recycle a saved Hero',()=>{
  const store=makeStorage(),state=startTournament(loadTournament(store),{seed:422});
  const stepResult=runTournamentStep(state,()=>win());
  const key=stepResult.winnerId;
  assert.ok(saveTournamentHero(state,key));
  setTournamentHeroElo(state,key,100,'F');
  const heroes=tournamentHeroes(state);
  assert.equal(resetTournament(state),state);
  assert.equal(state.season,0);assert.equal(state.active,null);assert.equal(state.championId,null);
  assert.deepEqual(state.records,{});assert.deepEqual(state.history,[]);assert.deepEqual(tournamentHeroes(state),heroes);
  saveTournament(state,store);
  const restored=loadTournament(store);
  startTournament(restored,{seed:422});
  assert.equal(restored.active.entrants.length,24);
  assert.ok(!restored.active.entrants.includes(key));
  assert.deepEqual(tournamentHeroes(restored),heroes);
});

test('previous quarterfinalists and career top eight get deduplicated main berths, #9/#10 only play LCQ when outside that union',()=>{
  const store=makeStorage();let state=startTournament(loadTournament(store),{seed:'seeding'});
  while(nextTournamentBout(state))runTournamentStep(state,()=>win());
  const champion=state.championId,oldRoster=state.active.entrants;
  state.records[champion].elo=0;
  const ranked=tournamentLeaderboard(state,10).map(f=>f.id);
  assert(!ranked.includes(champion));
  const quarterfinalists=state.active.rounds[0].map(b=>b.winnerId);
  const main=[...new Set([...ranked.slice(0,8),...quarterfinalists])];
  const lcq=ranked.slice(8).filter(id=>!main.includes(id));
  startTournament(state,{seed:'top eight'});
  assert.deepEqual(state.active.directEntrants.slice(0,main.length),main);
  assert(state.active.directEntrants.includes(champion));
  assert(state.active.opening.length>0);
  assert.equal(new Set(state.active.entrants).size,24);
  assert(lcq.every(id=>state.active.qualifiers.some(b=>b.fighterIds.includes(id))));
  assert.equal(state.active.entrants.filter(id=>oldRoster.includes(id)).length,20);
  const bracket=structuredClone(state.active);
  saveTournament(state,store);
  assert.deepEqual(loadTournament(store).active,bracket);
  assert.deepEqual(startTournament(state,{seed:'do not overwrite'}).active,bracket);
  let count=0;
  while(nextTournamentBout(state)){
    const result=runTournamentStep(state,fixture=>win({replay:{
      ruleset:2,seed:fixture.seed,round:fixture.round,limit:fixture.limit,terrain:fixture.terrain,grade:fixture.grade,
      fighters:fixture.fighters,plans:[{doctrine:'balanced'},{doctrine:'balanced'}],
    }}));
    const expectedReplay=state.active.lastReplay;
    assert(expectedReplay);
    if(result.stage==='opening')assert.equal(state.active.opening[result.index].winnerId,result.winnerId);
    saveTournament(state,store);
    const restored=loadTournament(store);
    assert.deepEqual(restored.active,state.active);
    assert.deepEqual(restored.active.lastReplay,expectedReplay);
    state=restored;count++;
  }
  assert.equal(count,23);assert.equal(state.active.status,'completed');
});

test('underfilled career top eight adds freshly recruited direct seeds',()=>{
  const state=startTournament(loadTournament(null),{seed:'first season'});
  const oldRoster=new Set(state.active.entrants),{left,right}=nextTournamentBout(state);
  runTournamentStep(state,()=>win());
  state.active.status='completed';
  startTournament(state,{seed:'second season'});
  assert.deepEqual(state.active.directEntrants.slice(0,2),[left.id,right.id]);
  assert(state.active.directEntrants.slice(2).every(id=>!oldRoster.has(id)));
  assert.equal(state.active.qualifiers.length,8);
});

test('timeout rates a draw immediately even with a supplied winner or real KO; a drawn final awards no title',()=>{
  const store=makeStorage();let state=startTournament(loadTournament(store),{seed:689});
  const first=nextTournamentBout(state);
  const higher=state.records[first.left.id],lower=state.records[first.right.id];
  higher.elo=lower.elo*2;
  const startElo=higher.elo,lowElo=lower.elo;
  const timeout=()=>win({reason:'timeout',time:75});
  const pending=runTournamentStep(state,timeout);
  assert.equal(pending.winnerId,null);
  assert.equal(higher.draws,1);assert.equal(lower.draws,1);
  assert.equal(higher.wins,0);assert.equal(lower.losses,0);
  assert.equal(higher.kills,1);assert.equal(lower.deaths,1);
  assert(higher.elo<startElo);assert(lower.elo>lowElo);
  while(nextTournamentBout(state)?.round!==4)runTournamentStep(state,()=>win());
  const final=nextTournamentBout(state),titles=Object.values(state.records).map(f=>f.titles);
  for(let i=0;i<3;i++)runTournamentStep(state,()=>win({reason:'timeout',kills:[0,0],deaths:[0,0]}));
  assert.equal(state.active.status,'completed');
  assert.equal(state.active.titleByDraw,true);
  assert.equal(state.active.rounds[3][0].result.reason,'draw-advance');
  assert.equal(state.history[0].titleByDraw,true);
  assert.deepEqual(Object.values(state.records).map(f=>f.titles),titles);
  for(const key of final.fighterIds)assert(state.records[key].draws>=3);
  saveTournament(state,store);state=loadTournament(store);
  assert.equal(state.active.titleByDraw,true);
  assert.equal(state.history[0].titleByDraw,true);
});

test('32-player veteran bracket has 31 decisions, 360s replay snapshots, and keeps qualification routes after reload',()=>{
  const store=makeStorage();let state=startTournament(loadTournament(store),{fieldSize:32,limit:360,seed:2951,terrain:'underpit'});
  assert.equal(state.active.fieldSize,32);assert.equal(state.active.qualifiers.length,16);
  assert.equal(state.active.qualifiers.filter(b=>b.qualifierPrelim).length,8);
  assert.equal(state.active.opening.length,0);
  for(let season=1;season<=2;season++){
    const field=state.active.entrants;
    assert.equal(new Set(field).size,32);
    const direct=new Set(state.active.directEntrants.slice(0,8));
    let decisions=0;
    while(nextTournamentBout(state)){
      const game=nextTournamentBout(state);
      assert.equal(game.limit,360);
      if(game.stage==='main'&&game.round===1)assert.equal(game.fighterIds.filter(id=>direct.has(id)).length,1);
      const result=runTournamentStep(state,input=>win({replay:{
        ruleset:12,seed:input.seed,round:input.round,limit:input.limit,terrain:input.terrain,grade:input.grade,
        fighters:input.fighters,plans:[{doctrine:'balanced'},{doctrine:'balanced'}],
      }}));
      assert.equal(result.status,'settled');
      decisions++;
      saveTournament(state,store);
      const restored=loadTournament(store);
      assert.deepEqual(restored.active,state.active);
      assert.equal(restored.active.lastReplay.limit,360);
      state=restored;
    }
    assert.equal(decisions,31);
    if(season===2)break;
    const previousQuarterfinalists=state.active.rounds[0].map(b=>b.winnerId);
    const career=tournamentLeaderboard(state,10).map(f=>f.id);
    const oldField=new Set(field);
    startTournament(state,{fieldSize:32,limit:360,seed:98133});
    assert.deepEqual(state.active.directEntrants.slice(0,8),career.slice(0,8));
    assert(previousQuarterfinalists.every(id=>state.active.directEntrants.includes(id)));
    assert(career.slice(8).every(id=>state.active.entrants.includes(id)));
    assert.equal(state.active.entrants.filter(id=>oldField.has(id)).length,28);
    const inProgress=state.active;
    assert.equal(startTournament(state,{fieldSize:24,limit:45}).active,inProgress);
  }
});

test('24 field remains 23 fixtures and uses original opt-out clock and format',()=>{
  const state=startTournament(loadTournament(null),{fieldSize:24,limit:75,seed:11});
  assert.equal(state.active.fieldSize,24);
  assert.equal(state.active.qualifiers.length,8);
  assert(!state.active.qualifiers.some(f=>f.qualifierPrelim));
  let n=0;while(nextTournamentBout(state)){runTournamentStep(state,()=>win());n++;}
  assert.equal(n,23);
});

test('rated fighters below the top ten return through qualifiers without changing ratings',()=>{
 for(const size of [24,32]){
  const state=startTournament(loadTournament(null),{fieldSize:size,seed:6732});
  while(nextTournamentBout(state))runTournamentStep(state,()=>win());
  const ranked=state.active.entrants.map(id=>state.records[id]);
  ranked.forEach((f,i)=>{f.elo=1660-i*3;});
  const oldElo=new Map(ranked.map(f=>[f.id,f.elo]));
  startTournament(state,{fieldSize:size,seed:2244});
  for(const f of ranked.slice(10,17)){
   assert.ok(state.active.entrants.includes(f.id));
   if(!state.active.directEntrants.includes(f.id))
     assert.ok(state.active.qualifiers.some(b=>b.fighterIds.includes(f.id)));
   assert.equal(state.records[f.id].elo,oldElo.get(f.id));
  }
  const recruits=state.active.entrants.filter(id=>!oldElo.has(id));
  assert.equal(recruits.length,4);
  assert.ok(recruits.every(id=>state.records[id].elo===1500));
 }
});

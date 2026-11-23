import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/squad-tournament.js';
const store=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
const start=(seed=42)=>api.startSquadTournament(api.resetSquadTournament(),{seed,limit:90});
const win=(s)=>({winnerIndex:0,time:11,kills:[4,2],deaths:[2,4],reason:'elimination',
  replay:{ruleset:1,seed:s.seed,round:s.round,limit:s.limit,terrain:s.terrain,teams:s.teams}});
test('24 five-member teams qualify into 16 slots and exactly 23 matches produce a champion',()=>{
 const disk=store();let a=start(),b=start();
 assert.deepEqual(a.active.entrants,b.active.entrants);assert.equal(a.active.entrants.length,24);
 assert.equal(a.active.directSeeds.length,8);assert.equal(a.active.qualifiers.length,8);
 assert.deepEqual(a.active.rounds.map(x=>x.length),[8,4,2,1]);
 assert.equal(new Set(Object.values(a.teams).flatMap(t=>t.fighters.map(f=>f.name))).size,120);
 assert.ok(Object.values(a.teams).every(t=>t.fighters.every(f=>f.rank==='SSS+V')));
 const ids=new Set();
 while(api.nextSquadBout(a)){
   const spec=api.nextSquadBout(a);assert.equal(spec.teams[0].fighters.length,5);ids.add(spec.id);
   api.runSquadStep(a,win);const replay=structuredClone(a.active.lastReplay);assert.ok(replay);
   assert.equal(api.saveSquadTournament(a,disk),true);a=api.loadSquadTournament(disk);
   assert.deepEqual(a.active.lastReplay,replay);
 }
 assert.equal(ids.size,23);assert.equal(a.active.status,'completed');
 const champ=a.championId;assert.equal(a.active.championId,champ);assert.equal(api.squadLeaderboard(a)[0].id,champ);
 assert.equal(Object.values(a.teams).reduce((n,t)=>n+t.wins,0),23);
 api.startSquadTournament(a,{seed:55});assert.ok(a.active.directSeeds.includes(champ));
 assert.ok(!ids.has(api.nextSquadBout(a).id));
});
test('timeout draws survive side swaps and cannot decide a win by stats',()=>{
 const s=start(), disk=store(), first=api.nextSquadBout(s);
 const [a,b]=first.teamIds; s.teams[a].elo=1800;s.teams[b].elo=1600;
 // Deliberately inject a nominal winner at the horn; the reducer must ignore it.
 const draw={winnerIndex:0,time:90,reason:'timeout',kills:[2,1],deaths:[1,2],damage:[900,1]};
 assert.equal(api.runSquadStep(s,()=>draw).status,'runoff');
 assert.deepEqual(api.nextSquadBout(s).teamIds,[b,a]);
 assert.equal(api.runSquadStep(s,()=>draw).status,'runoff');
 const final=api.runSquadStep(s,()=>draw);
 assert.equal(final.result.reason,'draw-advance');assert.ok([a,b].includes(final.winnerId));
 assert.deepEqual(final.result.kills,[5,4]);
 for(const id of [a,b])assert.deepEqual([s.teams[id].wins,s.teams[id].draws,s.teams[id].losses],[0,3,0]);
 assert.ok(s.teams[a].elo<1800&&s.teams[b].elo>1600);
 assert.equal(s.teams[a].elo+s.teams[b].elo,3400);
 api.saveSquadTournament(s,disk);assert.deepEqual(api.loadSquadTournament(disk),s);
});

test('decisive loss to lower Elo costs more and timeout final never grants a title',()=>{
 const loss=opponent=>{
   const s=start();const [a,b]=api.nextSquadBout(s).teamIds;s.teams[a].elo=1800;s.teams[b].elo=opponent;
   api.runSquadStep(s,()=>({winnerIndex:1,reason:'elimination'}));
   assert.equal(s.teams[a].losses,1);return 1800-s.teams[a].elo;
 };
 assert.ok(loss(1550)>loss(2050));
 const s=start(439), disk=store();
 while(api.nextSquadBout(s)?.round!==4)api.runSquadStep(s,win);
 const before=Object.values(s.teams).reduce((n,t)=>n+t.wins,0);
 while(api.nextSquadBout(s))api.runSquadStep(s,()=>({reason:'timeout',winnerIndex:0}));
 assert.equal(s.active.status,'completed');assert.equal(s.active.titleByDraw,true);
 assert.equal(s.history.at(-1).titleByDraw,true);assert.equal(s.championId,null);
 assert.equal(Object.values(s.teams).reduce((n,t)=>n+t.wins,0),before);
 assert.equal(Object.values(s.teams).reduce((n,t)=>n+t.titles,0),0);
 api.saveSquadTournament(s,disk);assert.deepEqual(api.loadSquadTournament(disk),s);
});
test('storage independent, rejects invalid bracket and validates replay descriptor',()=>{
 const disk=store(),s=start();disk.setItem('saber-pit:tournament:1','original');
 api.runSquadStep(s,input=>({...win(input),replay:{...win(input).replay,seed:0}}));
 assert.equal(s.active.lastReplay,null);
 api.saveSquadTournament(s,disk);assert.equal(disk.getItem('saber-pit:tournament:1'),'original');
 const raw=JSON.parse(disk.getItem(api.SQUAD_TOURNAMENT_KEY));raw.active.directSeeds[1]=raw.active.directSeeds[0];
 disk.setItem(api.SQUAD_TOURNAMENT_KEY,JSON.stringify(raw));
 assert.equal(api.loadSquadTournament(disk).active,null);
 assert.equal(api.resetSquadTournament(s).active,null);assert.deepEqual(s.teams,{});
});

test('squad composition is an exact, read-only label derived from the five fighters',()=>{
 const row=(...genders)=>Object.freeze({fighters:Object.freeze(genders.map(gender=>Object.freeze({gender})))});
 assert.equal(api.squadGenderLabel(row(...Array(5).fill('female'))),'All Female');
 assert.equal(api.squadGenderLabel(row(...Array(5).fill('male'))),'All Male');
 assert.equal(api.squadGenderLabel(row('female','female','female','female','male')),'Mixed');
 assert.equal(api.squadGenderLabel(row('male','male','male','male','nonbinary')),'Mixed');
 assert.equal(api.squadGenderLabel(row('female')),'');
 const disk=store(),s=start();
 const before=Object.values(s.teams).map(t=>[t.id,api.squadGenderLabel(t)]);
 api.saveSquadTournament(s,disk);
 assert.deepEqual(Object.values(api.loadSquadTournament(disk).teams).map(t=>[t.id,api.squadGenderLabel(t)]),before);
});

test('squad and fighter labels use the shared fictional language palette and migrate in place',()=>{
 const fresh=start(123), disk=store(), fixture=api.nextSquadBout(fresh);
 const squadNames=Object.values(fresh.teams).map(team=>team.name);
 assert.equal(new Set(squadNames).size,24);
 assert.ok(squadNames.every(name=>/^[A-Za-z]+-[A-Za-z]+$/.test(name)));
 const target=fresh.teams[fixture.teamIds[0]];
 const beforeId=target.id,beforeGender=target.fighters[0].gender;
 api.runSquadStep(fresh,win);
 target.name='Clan Moon Thorns';target.fighters[0].name='Alden Ashbell';
 const original=structuredClone(fresh.active.qualifiers[0].result);
 api.saveSquadTournament(fresh,disk);
 const migrated=api.loadSquadTournament(disk), after=migrated.teams[beforeId];
 assert.notEqual(after.name,'Clan Moon Thorns');
 assert.notEqual(after.fighters[0].name,'Alden Ashbell');
 assert.equal(after.fighters[0].gender,beforeGender);
 assert.equal(after.wins,1);assert.equal(after.kills,4);
 assert.deepEqual(migrated.active.qualifiers[0].result,original);
 assert.equal(migrated.active.lastReplay.teams[0].name,after.name);
 assert.equal(migrated.active.lastReplay.teams[0].fighters[0].name,after.fighters[0].name);
 api.saveSquadTournament(migrated,disk);
 assert.deepEqual(api.loadSquadTournament(disk),migrated);
});

test('new draws have eight of each gender composition and retain champion roster into a second season',()=>{
  const breakdown=(a,ids)=>ids.reduce((t,id)=>(t[a.teams[id].composition]++,t),
    {mixed:0,'all-female':0,'all-male':0});
  for(const seed of [2,77,411,82591]){
    const a=start(seed);
    assert.deepEqual(breakdown(a,a.active.entrants),{mixed:8,'all-female':8,'all-male':8});
    assert.deepEqual(Object.values(breakdown(a,a.active.directSeeds)).sort(),[2,3,3]);
    assert.ok(a.active.entrants.filter(id=>a.teams[id].composition==='mixed').every(id=>
      ['female','male'].every(g=>a.teams[id].fighters.some(f=>f.gender===g))));
    while(api.nextSquadBout(a))api.runSquadStep(a,win);
    const {championId}=a, fighters=structuredClone(a.teams[championId].fighters), before=a.teams[championId].elo;
    assert.ok(before>api.SQUAD_ELO_START);
    const expected=api.squadLeaderboard(a,8).map(t=>t.id);
    const priorWinners=a.active.rounds[0].map(m=>m.winnerId);
    api.startSquadTournament(a,{seed:seed+600});
    assert.ok(a.active.directSeeds.includes(championId));
    assert.deepEqual(a.teams[championId].fighters,fighters);
    assert.equal(a.teams[championId].elo,before);
    assert.deepEqual(breakdown(a,a.active.entrants),{mixed:8,'all-female':8,'all-male':8});
    assert.deepEqual(a.active.directSeeds.slice(0,8),expected);
    assert.ok(priorWinners.every(id=>a.active.directSeeds.includes(id)));
  }
});
test('legacy 10-fixture season backfills team Elo once with no changes to rosters, W/L or K/D',()=>{
  const disk=store(), original=start(981);
  for(let i=0;i<10;i++)api.runSquadStep(original,win);
  const played=original.active.entrants.map(k=>original.teams[k]);
  const legacy=structuredClone(original);
  delete legacy.ratingVersion;
  delete legacy.active.opening;
  for(const team of Object.values(legacy.teams)){delete team.elo;delete team.composition;}
  api.saveSquadTournament(legacy,disk);
  const restored=api.loadSquadTournament(disk);
  for(const entry of played){
    const current=restored.teams[entry.id];
    assert.deepEqual(current.fighters,entry.fighters);
    assert.equal(current.elo,entry.elo);
    assert.deepEqual([current.wins,current.losses,current.kills,current.deaths],[entry.wins,entry.losses,entry.kills,entry.deaths]);
    assert.ok(current.elo>=1500);
  }
  api.saveSquadTournament(restored,disk);
  assert.deepEqual(api.loadSquadTournament(disk),restored);
  const board=api.squadLeaderboard(restored);
  assert.ok(board.every((t,i)=>!i||t.elo<=board[i-1].elo));
});

test('out-of-top-eight titleholder returns direct as a quarterfinalist and carried teams stay intact',()=>{
  const disk=store(),state=start(918);
  while(api.nextSquadBout(state))api.runSquadStep(state,win);
  const champ=state.championId;
  state.teams[champ].elo=api.SQUAD_ELO_START-1;
  const ranked=api.squadLeaderboard(state,10).map(t=>t.id), expected=ranked.slice(0,8);
  assert(!ranked.includes(champ));
  const lineup=[...expected,champ].map(id=>{
    const team=state.teams[id];team.composition='all-female';
    for(const fighter of team.fighters)fighter.gender='female';
    return structuredClone(team);
  });
  const priorWinners=state.active.rounds[0].map(m=>m.winnerId);
  api.startSquadTournament(state,{seed:'reseed'});
  assert.deepEqual(state.active.directSeeds.slice(0,8),expected);
  assert.ok(priorWinners.every(id=>state.active.directSeeds.includes(id)));
  assert.ok(state.active.directSeeds.includes(champ));
  assert.ok(ranked.slice(8).filter(id=>!priorWinners.includes(id)).every(id=>state.active.playIn.includes(id)));
  assert.equal(state.active.playIn.length,24-state.active.directSeeds.length);
  assert.equal(new Set(state.active.entrants).size,24);
  for(const team of lineup)assert.deepEqual(state.teams[team.id],team);
  const groups=state.active.entrants.map(id=>state.teams[id].composition);
  assert.deepEqual(['all-female','all-male','mixed'].map(g=>groups.filter(k=>k===g).length).sort((a,b)=>a-b),[6,8,10]);
  api.saveSquadTournament(state,disk);
  assert.deepEqual(api.loadSquadTournament(disk).active,state.active);
  assert.deepEqual(api.startSquadTournament(state,{seed:'do not rewrite'}).active,state.active);
});


test('separate Top 8 and prior eight guarantee main, then qualifier and opening save/resume keep all 23 results',()=>{
  const disk=store(),state=start(23);
  while(api.nextSquadBout(state))api.runSquadStep(state,win);
  const quarterfinalists=state.active.rounds[0].map(m=>m.winnerId);
  const other=state.active.entrants.filter(id=>!quarterfinalists.includes(id));
  for(const [i,id] of other.entries())state.teams[id].elo=3800-i;
  const legacy=structuredClone(state);
  delete legacy.active.opening;delete legacy.history.at(-1).quarterfinalistIds;
  api.saveSquadTournament(legacy,disk);
  const fresh=api.loadSquadTournament(disk);
  assert.deepEqual(fresh.history.at(-1).quarterfinalistIds,quarterfinalists);
  api.startSquadTournament(fresh,{seed:41});
  assert.deepEqual(fresh.active.directSeeds,[...other.slice(0,8),...quarterfinalists]);
  assert.ok(other.slice(8,10).every(id=>fresh.active.playIn.includes(id)));
  assert.equal(fresh.active.qualifiers.length,4);
  assert.equal(fresh.active.opening.length,4);
  const lossesBefore=Object.values(fresh.teams).reduce((n,t)=>n+t.losses,0);
  const next=()=>api.nextSquadBout(fresh);
  while(next()?.stage==='qualifier')api.runSquadStep(fresh,win);
  assert.equal(next()?.stage,'opening');
  const spec=next();
  api.runSquadStep(fresh,b=>({...win(b),replay:{ruleset:1,...b}}));
  api.saveSquadTournament(fresh,disk);
  assert.deepEqual(api.loadSquadTournament(disk),fresh);
  assert.equal(fresh.active.lastReplay.stage,'opening');
  assert.equal(fresh.active.lastReplay.id,spec.id);
  while(next())api.runSquadStep(fresh,win);
  assert.equal(fresh.active.status,'completed');
  assert.equal(fresh.active.quarterfinalistIds.length,8);
  assert.equal(Object.values(fresh.teams).reduce((n,t)=>n+t.losses,0)-lossesBefore,23);
});

test('odd protected union uses one fresh seed, never diverts #9/#10 from LCQ',()=>{
  const state=start(93);
  while(api.nextSquadBout(state))api.runSquadStep(state,win);
  const prior=state.active.quarterfinalistIds;
  const others=state.active.entrants.filter(id=>!prior.includes(id));
  for(const [i,id] of [...prior.slice(0,5),...others].entries())state.teams[id].elo=3500-i;
  const ranked=api.squadLeaderboard(state,10).map(t=>t.id), oldIds=new Set(state.active.entrants);
  const required=new Set([...ranked.slice(0,8),...prior]);
  assert.equal(required.size,11);
  api.startSquadTournament(state,{seed:19});
  assert.equal(state.active.directSeeds.length,12);
  assert.equal(state.active.directSeeds.filter(id=>!oldIds.has(id)).length,1);
  assert.ok([...required].every(id=>state.active.directSeeds.includes(id)));
  assert.ok(ranked.slice(8).every(id=>state.active.playIn.includes(id)));
});

test('old recorded time decisions remain historical and are not rated again',()=>{
  const disk=store(),s=start(),{teamIds:[a,b]}=api.nextSquadBout(s);
  api.runSquadStep(s,win);
  const old=structuredClone(s),first=old.active.qualifiers[0];
  first.attempts[0].reason='timeout';first.result.reason='timeout';
  delete old.teams[a].draws;delete old.teams[b].draws;
  api.saveSquadTournament(old,disk);
  const loaded=api.loadSquadTournament(disk);
  assert.equal(loaded.active.qualifiers[0].winnerId,a);
  assert.deepEqual([loaded.teams[a].wins,loaded.teams[a].draws,loaded.teams[b].losses],[1,0,1]);
  assert.deepEqual([loaded.teams[a].elo,loaded.teams[b].elo],[s.teams[a].elo,s.teams[b].elo]);
});

test('rules 12 replay persists exact concrete fighter styles and rules 11 strips them without changing roster',()=>{
  const disk=store(),state=start(3302);
  const fixture=api.nextSquadBout(state);
  assert(fixture.teams.every(t=>t.fighters.every(f=>['king','queen','rook','bishop','knight','pawn'].includes(f.chessStyle))));
  const savedStyles=[['king','queen','rook','bishop','knight'],['pawn','rook','queen','pawn','bishop']];
  api.runSquadStep(state,s=>{
    const old=win(s);
    return {...old,replay:{...old.replay,ruleset:12,teams:s.teams.map((t,i)=>({...t,
      fighters:t.fighters.map((f,j)=>({...f,chessStyle:savedStyles[i][j]})),
    }))}};
  });
  const exact=state.active.lastReplay;
  assert.deepEqual(exact.teams.map(t=>t.fighters.map(f=>f.chessStyle)),savedStyles);
  api.saveSquadTournament(state,disk);
  const reloaded=api.loadSquadTournament(disk);
  assert.deepEqual(reloaded.active.lastReplay,exact);
  assert.deepEqual(reloaded.teams,state.teams);
  api.runSquadStep(reloaded,s=>{const r=win(s);return {...r,replay:{...r.replay,ruleset:11}};});
  assert(reloaded.active.lastReplay.teams.every(t=>t.fighters.every(f=>!Object.hasOwn(f,'chessStyle'))));
});

test('rules 12 replay rejects an ambiguous or invalid fighter style rather than silently replacing it',()=>{
  const state=start(3109);
  api.runSquadStep(state,s=>{
    const r=win(s);
    r.replay.ruleset=12;
    r.replay.teams[0].fighters[0].chessStyle='mixed';
    return r;
  });
  assert.equal(state.active.lastReplay,null);
});

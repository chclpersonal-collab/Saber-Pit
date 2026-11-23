import test from 'node:test';
import assert from 'node:assert/strict';
import {learnTournamentLoadout,selectTournamentLoadout,validTournamentMove} from '../dist/arcade-tournament-adaptation.js';
import {playTournamentBout,createTournamentReplay} from '../dist/arcade-tournament-sim.js';
import {loadTournament,saveTournament,startTournament,nextTournamentBout,runTournamentStep,saveTournamentHero,setTournamentHeroGender,setTournamentHeroElo} from '../dist/arcade-tournament.js';

const fighter={id:'hero',name:'Hero',form:'makashi',grade:'SSS+V',gear:{weapon:'single',grip:'forward'}};
const opponent={id:'opponent',name:'Rival',form:'juyo',grade:'SSS+V',gear:{weapon:'single',grip:'forward'}};
function sample(){
  const loser={damage:10,saberSwings:25,saberLanded:1},winner={damage:190,saberSwings:25,saberLanded:17};
  let loadouts=learnTournamentLoadout({},fighter,loser,winner,0,opponent,{mk_measured_point:9,mk_stop_hit:4,jy_open_edge:50},{mk_stop_hit:3,jy_open_edge:10});
  loadouts=learnTournamentLoadout({loadouts},{...fighter,gear:{weapon:'staff'}},winner,loser,1,opponent,
    {mk_measured_point:12,mk_stop_hit:7},{mk_stop_hit:5});
  return { ...fighter, profile:{bouts:2,loadouts} };
}

test('learned evidence can switch a real kit and favor accurate moves without switching Form',()=>{
  const start=selectTournamentLoadout(fighter,opponent,21);
  assert.equal(start.weapon,'single');
  assert.equal(start.move,null);
  const learned=sample(), a=selectTournamentLoadout(learned,opponent,21);
  assert.equal(a.weapon,'staff');
  assert.equal(a.form,fighter.form);
  assert.equal(a.move,'mk_stop_hit');
  assert.deepEqual(a,selectTournamentLoadout(learned,opponent,21));
  assert.equal(validTournamentMove(a.move,a.form,'F'),null);
  assert.equal(validTournamentMove('jy_open_edge',a.form,'SSS+V'),null);
  const lower=selectTournamentLoadout({...learned,grade:'F'},opponent,21);
  assert.ok(validTournamentMove(lower.move,fighter.form,'F'));
});
test('actual bout locks its learned kit and move in replay, and does not add special Hero powers',()=>{
  const bout=playTournamentBout({seed:23,round:1,limit:45,grade:'SSS+V',fighters:[sample(),opponent]});
  const desc=JSON.parse(JSON.stringify(bout.replay));
  assert.equal(desc.fighters[0].form,'makashi');
  assert.equal(desc.fighters[0].gear.weapon,'staff');
  assert.equal(desc.plans[0].move,'mk_stop_hit');
  const state=createTournamentReplay(desc);
  assert.equal(state.fighters[0].tournamentMove,desc.plans[0].move);
  assert.equal(state.fighters[0].gear.weapon,'staff');
  assert.equal(state.fighters[0].heroId,undefined);
  assert.equal(bout.profiles[0].loadouts.last.move,'mk_stop_hit');
  const exact=playTournamentBout(desc);
  assert.deepEqual(exact.stats,bout.stats);
  assert.deepEqual(exact.replay,desc);
});
test('saved Hero learns actually applied weapon without overwriting custom gender, rank floor or Elo',()=>{
  const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const state=startTournament(loadTournament(storage),{seed:41,limit:45});
  const next=nextTournamentBout(state), hero=state.records[next.fighters[0].id];
  hero.wins=1;
  saveTournamentHero(state,hero.id);
  setTournamentHeroElo(state,hero.id,815,'C');
  setTournamentHeroGender(state,hero.id,'nonbinary');
  runTournamentStep(state,input=>{
    const [self,rival]=input.fighters;
    const mapped={...self,weapon:'dual',grip:'backhand',dualPhase:true,gear:{weapon:'dual',grip:'backhand',dualPhase:true}};
    const kit=learnTournamentLoadout({},mapped,{damage:140},{damage:40},1,rival);
    return {winnerIndex:0,time:8,kills:[1,0],deaths:[0,1],profiles:[{bouts:1,wins:1,loadouts:kit},{}],
      replay:{ruleset:9,seed:input.seed,round:input.round,limit:input.limit,terrain:input.terrain,grade:input.grade,
        fighters:[mapped,rival],plans:[{doctrine:'balanced'},{doctrine:'defensive'}]}};
  });
  saveTournament(state,storage);
  const after=loadTournament(storage).heroes[hero.id];
  assert.equal(after.name,hero.name);assert.equal(after.gender,'nonbinary');
  assert.equal(after.form,hero.form);assert.equal(after.elo,815);assert.equal(after.eloFloorGrade,'C');
  assert.equal(after.weapon,'dual');assert.equal(after.grip,'backhand');
  assert.equal(after.profile.loadouts.last.kit,'reverseDual');
});

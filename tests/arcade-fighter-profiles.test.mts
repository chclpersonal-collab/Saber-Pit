import test from 'node:test';
import assert from 'node:assert/strict';
import {FIGHTER_GENDERS,fighterGender,fighterGenderLabel,appearanceSeedFor} from '../dist/arcade-fighter-profiles.js';
import {createArcade} from '../dist/arcade-engine.js';
import {battleHeroLineup} from '../dist/arcade-heroes.js';
import {loadTournament,saveTournament,saveTournamentHero,setTournamentHeroElo,setTournamentHeroGender,
  startTournament,runTournamentStep,nextTournamentBout,TOURNAMENT_KEY} from '../dist/arcade-tournament.js';
import {playTournamentBout,tournamentHeroLoadout,createTournamentReplay} from '../dist/arcade-tournament-sim.js';
const memory=()=>{const m=new Map();return {getItem:id=>m.get(id),setItem:(id,value)=>m.set(id,value)};};

test('legacy records get editable labels and stable appearances independent of name, rank, or chosen team',()=>{
  assert.deepEqual(FIGHTER_GENDERS.map(fighterGenderLabel),['Female','Male','Nonbinary']);
  assert.equal(fighterGender('broken','woman','f-luna'),'female');
  assert.equal(fighterGender(undefined,'femboy','f-luna'),'male');
  assert.ok(FIGHTER_GENDERS.includes(fighterGender(undefined,'rabbit','f-luna')));
  const s=memory();
  const old={id:'f-luna',name:'Silver Veil',rank:'SSS+V',form:'makashi',body:'woman',elo:3850,wins:4,losses:2,kills:2};
  s.setItem(TOURNAMENT_KEY,JSON.stringify({version:1,season:2,records:{[old.id]:old},heroes:{[old.id]:old}}));
  const state=loadTournament(s), inherited=state.heroes[old.id];
  assert.equal(inherited.gender,'female');
  assert.equal(inherited.appearanceSeed,appearanceSeedFor(old.id));
  assert.equal(inherited.elo,1525);
  const withElo=setTournamentHeroElo(state,old.id,630.5,'A');
  const changed=setTournamentHeroGender(state,old.id,'nonbinary');
  assert.deepEqual(changed,{...withElo,gender:'nonbinary'});
  assert.equal(setTournamentHeroGender(state,old.id,'invalid'),null);
  assert.equal(state.records[old.id].gender,'female');
  assert.equal(saveTournamentHero(state,old.id).gender,'nonbinary');
  assert.ok(saveTournament(state,s));
  const restored=loadTournament(s).heroes[old.id];
  assert.deepEqual(restored,{...changed,savedSeason:2});
  for(const side of [0,1]){
    const picks=Array.from({length:2},(_,i)=>i===side?{id:old.id,slot:1}:{});
    const heroLineup=battleHeroLineup(picks,[restored],tournamentHeroLoadout);
    const battle=createArcade({mode:'watch',form:'makashi',teamSizes:[2,2],heroLineup});
    const fighter=battle.fighters.find(f=>f.heroId===old.id);
    assert.deepEqual([fighter.team,fighter.slot,fighter.gender,fighter.appearanceSeed,fighter.body,fighter.career.grade],[
      side,1,'nonbinary',inherited.appearanceSeed,'woman','SSS+V']);
  }
});

test('labels and appearance metadata persist through real tournament replays without affecting combat',()=>{
  const s=memory(),state=startTournament(loadTournament(s),{seed:105});
  const before=nextTournamentBout(state);
  const base=playTournamentBout(before);
  const changed=playTournamentBout({...before,fighters:before.fighters.map(f=>({...f,gender:'nonbinary'}))});
  const observed=({replay,...simulated})=>simulated;
  assert.deepEqual(observed(base),observed(changed));
  runTournamentStep(state,()=>base);
  assert.ok(saveTournament(state,s));
  const resp=loadTournament(s).active.lastReplay;
  const replay=createTournamentReplay(resp);
  for(let i=0;i<2;i++){
    assert.equal(replay.fighters[i].gender,resp.fighters[i].gender);
    assert.equal(replay.fighters[i].appearanceSeed,appearanceSeedFor(resp.fighters[i].id));
  }
});

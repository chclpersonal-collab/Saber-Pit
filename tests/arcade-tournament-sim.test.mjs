import test from 'node:test';
import assert from 'node:assert/strict';
import {playTournamentBout,selectTournamentPlan,tournamentHeroLoadout} from '../dist/arcade-tournament-sim.js';

test('seeded tournament runs real identical bouts, collecting verified kills and training observations',()=>{
  const fighters=[{id:'a',form:'ataru',body:'rabbit'},{id:'b',form:'soresu'}];
  const bout={fighters,seed:21,grade:'A',limit:45,terrain:'open'};
  const first=playTournamentBout(bout), again=playTournamentBout(bout);
  assert.deepEqual(first,again);
  assert.ok(first.time>0&&first.time<=45.01);
  assert.deepEqual(first.kills,first.stats.map(s=>s.kills));
  assert.deepEqual(first.deaths,first.stats.map(s=>s.deaths));
  assert.ok(first.stats.every(s=>s.saberSwings>0));
  for(const [i,a] of first.adaptations.entries()){
    assert.equal(a.bouts,1);assert.equal(a.wins,Number(i===first.winnerIndex));
    assert.ok(a.observed.pressure>0);assert.equal(a.variants[first.plans[i].doctrine].bouts,1);
  }
  const second=playTournamentBout({...bout,seed:22,fighters:fighters.map((f,i)=>({...f,adaptation:first.adaptations[i]}))});
  assert.ok(second.adaptations.every(p=>p.bouts===2&&Object.values(p.variants).reduce((sum,v)=>sum+v.bouts,0)===2));
});
test('a real clock expiration is a draw without made-up kills',()=>{
  const bout=playTournamentBout({fighters:[{id:'a',form:'soresu'},{id:'b',form:'soresu'}],seed:2,grade:'SSS+V',limit:45});
  assert.equal(bout.reason,'timeout');assert.equal(bout.winnerIndex,null);assert.deepEqual(bout.kills,[0,0]);assert.deepEqual(bout.deaths,[0,0]);
});
test('measured opponent activity actually changes the strategic plan',()=>{
  const fighter={id:'hero',form:'makashi'};
  const slow={id:'opponent',form:'niman',adaptation:{bouts:13,observed:{guardRate:.9,pressure:.03,whiffRate:.8,counterRate:.05}}};
  const press={...slow,adaptation:{bouts:13,observed:{pressure:.97,accuracy:.89,forceRate:.75,counterRate:.15}}};
  assert.equal(selectTournamentPlan(fighter,slow,77).doctrine,'aggressive');
  assert.equal(selectTournamentPlan(fighter,press,77).doctrine,'defensive');
  const loadout=tournamentHeroLoadout({...fighter,body:'rabbit',rank:'SS',weapon:'dual',grip:'backhand',dualPhase:true});
  assert.equal(loadout.body,'rabbit');assert.equal(loadout.grade,'SS');assert.equal(loadout.weapon,'dual');
  assert.equal(loadout.grip,'backhand');assert.equal(loadout.dualPhase,true);
});

test('replay keeps the configured time and exact applied plans without adaptive history',async()=>{
  const {createTournamentReplay}=await import('../dist/arcade-tournament-sim.js');
  const {stepArcade}=await import('../dist/arcade-engine.js');
  const original=playTournamentBout({seed:21,round:2,grade:'A',limit:90,
    fighters:[{id:'a',name:'A',form:'ataru',adaptation:{bouts:8}},{id:'b',name:'B',form:'soresu',body:'rabbit'}]});
  const replay=JSON.parse(JSON.stringify(original.replay));
  assert.equal(replay.limit,90);assert.equal(replay.fighters[0].gear.forceFamily,'force_push');
  assert.equal('adaptation' in replay.fighters[0],false);
  const game=createTournamentReplay(replay);
  assert.equal(game.limit,90);assert.equal(createTournamentReplay({...replay,limit:150}).limit,150);
  for(let i=0;i<905&&game.phase==='playing';i++)stepArcade(game,.1);
  assert.equal(game.time,original.time);
  assert.deepEqual(game.fighters.map(f=>f.stats),original.stats);
});

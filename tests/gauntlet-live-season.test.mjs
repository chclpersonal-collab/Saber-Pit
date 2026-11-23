import test from 'node:test';
import assert from 'node:assert/strict';
import {startGauntlet,nextGauntletBout,recordGauntletBout,loadGauntlet,saveGauntlet} from '../dist/gauntlet-tournament.js';
import {simulateGauntlet} from '../dist/gauntlet-sim.js';

test('real 1v3 combat settles a whole season and persisted learning reaches later fixtures',()=>{
  const storage={raw:null,getItem(){return this.raw},setItem(key,value){this.raw=value;}};
  let state=startGauntlet(loadGauntlet(storage),{seed:1492,limit:15});
  const outcomes=[0,0,0];let learnedDuringMatch=false;
  for(let index=0;index<20;index++){
    const fixture=nextGauntletBout(state);
    assert.equal(fixture.fighters.length,4);
    learnedDuringMatch||=fixture.fighters.some(row=>row.profile.bouts>0);
    const result=simulateGauntlet(fixture);
    assert.deepEqual(result.fighters.map(f=>f.id),fixture.fighters.map(f=>f.id));
    assert.ok(result.time<=fixture.limit+.01);
    if(result.reason==='timeout')assert.equal(result.winnerIndex,null);
    outcomes[result.winnerIndex??2]++;
    const committed=recordGauntletBout(state,fixture.id,result);
    assert.notEqual(committed,state);
    state=committed;
    if(index===8){
      assert.equal(saveGauntlet(state,storage),true);
      state=loadGauntlet(storage);
      assert.equal(state.active.cursor,9);
    }
  }
  assert.equal(state.active.status,'complete');assert.equal(nextGauntletBout(state),null);
  assert.equal(state.active.final.length,4);assert.equal(outcomes.reduce((sum,x)=>sum+x,0),20);
  assert.equal(learnedDuringMatch,true);
  for(const f of state.fighters){
    assert.ok(f.adaptation.solo.bouts>=1);
    assert.ok(f.adaptation.trio.bouts>=3);
    assert.ok(f.elo>=1500);
  }
  assert.equal(saveGauntlet(state,storage),true);
  const carried=startGauntlet(loadGauntlet(storage),{seed:777,limit:45});
  assert.equal(carried.season,2);
  assert.ok(nextGauntletBout(carried).fighters.every(f=>f.profile.bouts>0));
});

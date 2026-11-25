import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startGauntlet,nextGauntletBout,recordGauntletBout,loadGauntlet,saveGauntlet} from '../dist/gauntlet-tournament.js';
import {simulateGauntlet} from '../dist/gauntlet-sim.js';
import {startHumanBout,commitHumanBout,readHumanLog,humanLogMatches,humanReplay} from '../dist/gauntlet-play.js';

const store=()=>({raw:null,getItem(){return this.raw;},setItem(_k,v){this.raw=v;},removeItem(){this.raw=null;}});
const season=(seed=31,limit=15)=>startGauntlet(loadGauntlet(store()),{seed,limit});
/** A small seeded "player": moves, swings and guards in bursts so the log has many control changes. */
function player(seed){
  let s=seed>>>0;const r=()=>((s=Math.imul(s^s>>>15,2246822507)+0x9e3779b9>>>0)/4294967296);
  let hold=0,c={};
  return ()=>{
    if(hold--<=0){hold=Math.floor(r()*40);c={x:r()*2-1,y:r()*2-1,strike:r()<.35,guard:r()<.25,dash:r()<.08,heavy:r()<.06,walk:r()<.1};}
    return c;
  };
}
function fight(state,controls=player(7)){
  const bout=startHumanBout(state);
  while(!bout.over)bout.step(controls());
  return bout;
}

test('simulated Gauntlet bouts are unchanged by the human-play split',()=>{
  let state=startGauntlet(loadGauntlet(store()),{seed:2024,limit:45});
  const h=createHash('sha256');
  for(let i=0;i<6;i++){const f=nextGauntletBout(state);const r=simulateGauntlet(f);h.update(JSON.stringify(r));state=recordGauntletBout(state,f.id,r);}
  assert.equal(h.digest('hex'),'267b74823b3bfadbeb7f412281baea1b5148c11446a80d1a4183dac6958e133b');
});

test('a fought bout settles exactly one fixture with the same Elo and record rules as a simulated one',()=>{
  const state=season();
  const fixture=nextGauntletBout(state);
  const bout=fight(state);
  const done=commitHumanBout(state,bout);
  assert.equal(done.ok,true);
  const next=done.state;
  assert.equal(next.active.cursor,state.active.cursor+1);
  assert.equal(next.active.bouts.length,state.active.bouts.length+1);
  assert.equal(next.active.bouts.at(-1).id,fixture.id);
  const viaRecord=recordGauntletBout(state,fixture.id,bout.result());
  assert.deepEqual(next,viaRecord,'same write as handing the result to the season');
  const solo=f=>f.fighters.find(x=>x.id===fixture.fighters[0].id).solo;
  const before=solo(state),after=solo(next);
  assert.equal(after.wins+after.draws+after.losses,before.wins+before.draws+before.losses+1);
});

test('a bout cannot count twice: a second commit, or a rematch of the old fixture, is refused',()=>{
  const state=season();
  const bout=fight(state);
  const first=commitHumanBout(state,bout);
  assert.equal(first.ok,true);
  assert.deepEqual(commitHumanBout(first.state,bout),{ok:false,reason:'stale'});
  const rematch=startHumanBout(first.state);
  assert.notEqual(rematch.fixture.id,bout.fixture.id,'the next fight is the next fixture');
  assert.equal(rematch.cursor,first.state.active.cursor);
});

test('leaving mid-bout writes nothing, and an unfinished bout is refused',()=>{
  const storage=store();
  let state=startGauntlet(loadGauntlet(storage),{seed:31,limit:15});
  assert.equal(saveGauntlet(state,storage),true);
  const saved=storage.raw;
  const bout=startHumanBout(loadGauntlet(storage));
  const p=player(3);for(let i=0;i<240;i++)bout.step(p());
  assert.equal(bout.over,false);
  assert.deepEqual(commitHumanBout(loadGauntlet(storage),bout),{ok:false,reason:'unfinished'});
  assert.equal(storage.raw,saved,'abandoning the fight leaves the save byte for byte');
});

test('a season that moved on in another tab is never overwritten by a stale fight',()=>{
  const state=season();
  const bout=fight(state);
  const fixture=nextGauntletBout(state);
  const elsewhere=recordGauntletBout(state,fixture.id,simulateGauntlet(fixture));
  assert.deepEqual(commitHumanBout(elsewhere,bout),{ok:false,reason:'stale'});
  const fresh=startGauntlet(loadGauntlet(store()),{seed:99,limit:15});
  assert.deepEqual(commitHumanBout(fresh,bout),{ok:false,reason:'stale'},'a different season is refused too');
});

test('the save round-trips and Watch last bout replays the fight that was fought',()=>{
  const storage=store();
  const state=startGauntlet(loadGauntlet(storage),{seed:58,limit:15});
  const bout=fight(state,player(11));
  const live=bout.result();
  const done=commitHumanBout(state,bout);
  assert.equal(done.ok,true);
  assert.equal(saveGauntlet(done.state,storage),true);
  const loaded=loadGauntlet(storage);
  assert.equal(loaded.active.cursor,done.state.active.cursor);
  const log=readHumanLog(JSON.stringify(bout.log(loaded.active.cursor)));
  assert.ok(log);
  assert.equal(humanLogMatches(log,loaded),true);
  const {game,step}=humanReplay(loaded.active.lastFixture,log);
  while(game.phase==='playing')step(game);
  assert.equal(game.phase,bout.game.phase);
  assert.equal(game.time,bout.game.time);
  assert.deepEqual(game.fighters.map(f=>[f.alive,f.stats]),bout.game.fighters.map(f=>[f.alive,f.stats]));
  assert.equal(live.winnerIndex,(game.endReason==='timeout'?null:game.phase==='won'?0:game.phase==='lost'?1:null));
  // The log belongs to that bout only.
  const later=recordGauntletBout(loaded,nextGauntletBout(loaded).id,simulateGauntlet(nextGauntletBout(loaded)));
  assert.equal(humanLogMatches(log,later),false,'after the next bout, the replay is the simulated one again');
});

test('a damaged human log is ignored, never replayed',()=>{
  const ok={v:1,season:1,fixtureId:'x',cursor:1,ticks:10,runs:[[0,0,0,0,''],[4,100,-100,3,'lunge']]};
  assert.ok(readHumanLog(JSON.stringify(ok)));
  for(const bad of [null,'{',{...ok,v:2},{...ok,runs:[]},{...ok,runs:[[1,0,0,0,'']]},{...ok,runs:[[0,0,0,0,''],[0,1,1,1,'']]},
    {...ok,runs:[[0,101,0,0,'']]},{...ok,runs:[[0,0,0,1<<9,'']]},{...ok,runs:[[0,0,0,0,'<b>']]},{...ok,runs:[[0,0,0,0,''],[10,0,0,0,'']]}])
    assert.equal(readHumanLog(typeof bad==='string'?bad:JSON.stringify(bad)),null,JSON.stringify(bad));
});

test('the person controls the solo fighter: with no input it never guards, parries or dodges on its own',()=>{
  const bout=fight(season(77,15),()=>({}));
  const solo=bout.game.fighters[0];
  assert.equal(solo.control,true);
  assert.equal(bout.game.fighters.slice(1).some(f=>f.control),false);
  assert.equal(solo.stats.blocks??0,0);
  assert.equal(solo.stats.parries??0,0);
  assert.equal(solo.stats.saberSwings??0,0);
});

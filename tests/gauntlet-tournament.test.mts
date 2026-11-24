import test from 'node:test';
import assert from 'node:assert/strict';
import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,resetGauntlet,startGauntlet,nextGauntletBout,recordGauntletBout,
  gauntletLeaderboard,gauntletEloTransfer,normalizeGauntlet} from '../dist/gauntlet-tournament.js';

const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const start=()=>startGauntlet(loadGauntlet(store()),{seed:12,limit:45,terrain:'crossroads'});
const finish=(state,fn)=>{while(nextGauntletBout(state)){const f=nextGauntletBout(state);
  state=recordGauntletBout(state,f.id,{winnerIndex:fn(f),reason:'elimination'});}return state;};

test('20 stable fixtures, each finalist fights both roles; unique solo winner advances',()=>{
  const first=start();
  assert.deepEqual(start(),first);
  assert.equal(first.fighters.length,16);
  assert.equal(new Set(first.fighters.map(f=>f.name.split(' ').at(-1))).size,16);
  assert.ok(first.fighters.every(f=>f.elo===1500&&f.rank==='SSS+V'));
  assert.equal(startGauntlet(first,{seed:99}),first);
  const groupWinner=first.active.groups[0][0];
  const s=finish(first,f=>f.soloId===groupWinner?0:1);
  assert.equal(s.active.bouts.length,20);
  assert.equal(new Set(s.active.bouts.map(b=>b.id)).size,20);
  assert.equal(s.active.final.length,4);
  assert.equal(s.lastChampion.id,groupWinner);
  for(const f of s.fighters) {
    const multiplier=s.active.final.includes(f.id)?2:1;
    assert.equal(f.adaptation.solo.bouts,multiplier);
    assert.equal(f.adaptation.trio.bouts,multiplier*3);
  }
  assert.equal(first.active.bouts.length,0);
  assert.equal(gauntletLeaderboard(s)[0].elo,Math.max(...s.fighters.map(f=>f.elo)));
});

test('timeout is a draw; all-draw final preserves counts and awards no championship',()=>{
  const s=finish(start(),()=>null);
  assert.equal(s.lastChampion,null);
  assert.deepEqual(s.history,[{id:null,name:null,season:1,draw:true}]);
  assert.ok(s.fighters.every(f=>f.titles===0&&f.solo.wins===0&&f.trio.wins===0));
  const base=start(), first=nextGauntletBout(base);
  const timed=recordGauntletBout(base,first.id,{winnerIndex:0,reason:'timeout'});
  assert.equal(timed.active.bouts[0].winner,null);
  assert.equal(timed.fighters.find(f=>f.id===first.soloId).solo.draws,1);
  assert.equal(recordGauntletBout(timed,first.id,{winnerIndex:0}),timed);
});

test('combined trio logistic and conserved pre-floor split with floor protection',()=>{
  const x=gauntletEloTransfer(1500,[1500,1500,1500],1);
  assert.ok(Math.abs(x.combined-(1500+100*Math.log2(3)))<1e-8);
  assert.ok(Math.abs(x.expected-.25)<1e-12);
  assert.deepEqual(x.requested,[12,-4,-4,-4]);
  assert.deepEqual(x.actual,[12,0,0,0]);
  assert.ok(gauntletEloTransfer(1700,[1500,1500,1500],.5).actual[0]<0);
  const y=gauntletEloTransfer(1800,[1800,1800,1800],0,1);
  assert.equal(y.actual.reduce((sum,n)=>sum+n,0),0);
});

test('profile learning isolated per player and role, preserves last fixture through persistence',()=>{
  const db=store(), base=start(), f=nextGauntletBout(base);
  const obs=f.fighters.map((x,i)=>({id:x.id,guard:i/4,pressure:i>0?.2:.7,mobility:.6,doctrine:'aggressive',preferredMove:'slash2'}));
  assert.equal(recordGauntletBout(base,f.id,{winnerIndex:1,fighters:obs.toReversed()}),base);
  const s=recordGauntletBout(base,f.id,{winnerIndex:1,fighters:obs,time:30});
  const after=s.fighters.find(x=>x.id===f.soloId);
  assert.equal(after.adaptation.solo.guard,0);
  assert.equal(after.adaptation.solo.preferredMove,'slash2');
  assert.equal(after.adaptation.trio.bouts,0);
  assert.ok(saveGauntlet(s,db));
  assert.deepEqual(loadGauntlet(db),s);
  assert.deepEqual(loadGauntlet(db).active.lastFixture,f);
  assert.equal(db.getItem('saber-pit:tournament:1'),null);
  assert.equal(normalizeGauntlet({...s,active:{...s.active,groups:[...s.active.groups.slice(0,3),s.active.groups[0]]}}),null);
  assert.equal(resetGauntlet(db).season,0);
  assert.equal(db.getItem(GAUNTLET_KEY),null);
});

test('new seasons retain identity, peaks, profiles and completed history',()=>{
  const a=finish(start(),()=>0), b=startGauntlet(a,{seed:72});
  assert.equal(b.season,2);
  assert.deepEqual(b.fighters,a.fighters);
  assert.deepEqual(b.history,a.history);
  assert.equal(b.active.bouts.length,0);
  assert.deepEqual(normalizeGauntlet(b),b);
});

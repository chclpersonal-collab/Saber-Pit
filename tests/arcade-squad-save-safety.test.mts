import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {arenaLobbyRating} from '../dist/arcade-arena-rating-ui.js';
import {saveArcadeCareer,settleArcadeCareer} from '../dist/arcade-career.js';
import {safeArenaNormalRatings} from '../dist/arcade-normal-elo.js';

// Squads are an experiment for unrated Arena fights. These checks pin that turning
// them on can never touch rated progress: no squad state in a rated setup, the same
// rated flag and Elo ledger at settlement, and the same saved bytes.
type Opts=NonNullable<Parameters<typeof createArcade>[0]>;
const play=(opts:Opts)=>{
  const g=createArcade({mode:'watch',seed:41,limit:16,...opts});
  for(let i=0;i<60*240&&g.phase==='playing';i++)stepArcade(g,1/60,{});
  return g;
};
const memory=()=>{const m=new Map<string,string>();return {setItem:(k:string,v:string)=>void m.set(k,v),getItem:(k:string)=>m.get(k)??null,m};};
const prior={'0-0':1080,'0-1':940,'1-0':1012};
const savedBytes=(g:ReturnType<typeof play>)=>{
  const s=settleArcadeCareer(g,prior)!;
  const store=memory();
  saveArcadeCareer({arenaRatings:s.arenaRatings,mode:'watch',round:2,seed:7,careers:s.careers},store);
  return {s,bytes:[...store.m.values()].join('')};
};

test('a rated Arena setup never runs squads, even if the flag is passed',()=>{
  const sizes=[10,10];
  assert.equal(arenaLobbyRating('watch','elimination',sizes,{}).rated,true);
  const on=play({teamSizes:sizes,arenaRatingSkill:true,squadTactics:true});
  const off=play({teamSizes:sizes,arenaRatingSkill:true});
  assert.equal('squadTactics' in on,false);
  assert.notEqual(on.phase,'playing');
  const a=savedBytes(on),b=savedBytes(off);
  assert.equal(a.s.rated,true);
  assert.equal(a.bytes,b.bytes);
});

test('an unrated squad fight leaves the Elo ledger exactly as it was',()=>{
  const sizes=[16,16];
  assert.equal(arenaLobbyRating('watch','elimination',sizes,{}).rated,false);
  const g=play({teamSizes:sizes,squadTactics:true});
  assert.ok('squadTactics' in g);
  assert.notEqual(g.phase,'playing');
  const {s,bytes}=savedBytes(g);
  assert.equal(s.rated,false);
  assert.deepEqual(s.arenaRatings,safeArenaNormalRatings(prior));
  assert.deepEqual(JSON.parse(bytes).arenaRatings,safeArenaNormalRatings(prior));
  for(const row of s.report)assert.equal(row.ratingDelta,0);
});

test('squads never change whether a fight is rated',()=>{
  for(const sizes of [[3,3],[10,10],[15,15],[16,16],[10,12]]){
    const on=play({teamSizes:sizes,squadTactics:true}), off=play({teamSizes:sizes});
    assert.equal(settleArcadeCareer(on,prior)!.rated,settleArcadeCareer(off,prior)!.rated,sizes.join('v'));
  }
});

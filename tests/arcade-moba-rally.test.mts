import test from 'node:test';
import assert from 'node:assert/strict';
import {BELL_RALLY_RULES as rules,createBellRally,stepBellRally,consumeBellRally,bellRallyBonus} from '../dist/arcade-moba-rally.js';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';
test('no early or contested progress; empty/side switch resets; option awards once',()=>{
 for(const winner of [0,1]){
  const r=createBellRally(), own=[winner===0,winner===1], other=own.map(x=>!x);
  stepBellRally(r,rules.firstTick-1,own);assert.equal(r.heldTicks,0);assert.equal(r.phase,'waiting');
  stepBellRally(r,rules.firstTick,own);assert.equal(r.heldTicks,1);
  stepBellRally(r,rules.firstTick+1,[true,true]);assert.equal(r.holder,null);assert.equal(r.heldTicks,0);
  stepBellRally(r,rules.firstTick+2,own);
  stepBellRally(r,rules.firstTick+3,other);assert.equal(r.heldTicks,1);assert.equal(r.holder,1-winner);
  stepBellRally(r,rules.firstTick+4,[false,false]);assert.equal(r.heldTicks,0);
  for(let i=0;i<rules.holdTicks-1;i++)stepBellRally(r,rules.firstTick+5+i,own);
  assert.equal(r.reward,null);
  stepBellRally(r,rules.firstTick+5+rules.holdTicks-1,own);assert.deepEqual(r.wins,winner===0?[1,0]:[0,1]);
  assert.equal(consumeBellRally(r),winner);assert.equal(consumeBellRally(r),null);
 }
});
test('Bell expires without a claim and does not affect unconfigured games',()=>{
 const r=createBellRally();
 stepBellRally(r,rules.firstTick,[true,true]);
 stepBellRally(r,r.untilTick,[true,false]);
 assert.equal(r.phase,'waiting');assert.equal(r.reward,null);
 const a=createMoba(11),b=createMoba(11,1,'shii_cho',{bellRally:false});
 for(let n=0;n<240;n++){stepMoba(a,.25);stepMoba(b,.25);}
 assert.deepEqual(a,b);
});
test('earned rally reinforces only the next Bellway front minion; no balance alteration to heroes or structures',()=>{
 for(const winner of [0,1]){
  const g=createMoba(14,0,'shii_cho',{bellRally:true});
  assert.ok(g.bellRally);
  g.tick=g.nextWaveAt*60-1;
  // Use actual earned state machine, rather than injecting a team reward directly.
  for(let i=0;i<rules.holdTicks;i++)stepBellRally(g.bellRally,rules.firstTick+i,[winner===0,winner===1]);
  const core=g.cores.map(c=>c.hp),towers=g.towers.map(t=>t.hp), money=g.heroes.map(h=>h.credits);
  stepMoba(g,1/60);
  const boosted=g.minions.filter(m=>!m.ranged&&m.maxHp>52);
  assert.equal(boosted.length,1);
  assert.ok(boosted.every(m=>m.team===winner&&m.lane===1&&m.rallied===true&&m.maxHp===52+bellRallyBonus(52)));
  assert.deepEqual(g.cores.map(c=>c.hp),core);assert.deepEqual(g.towers.map(t=>t.hp),towers);assert.deepEqual(g.heroes.map(h=>h.credits),money);
  g.minions=[];g.tick=Math.round(g.nextWaveAt*60)-1;
  stepMoba(g,1/60);
  assert.ok(g.minions.every(m=>m.maxHp===(m.ranged?34:52)));
 }
});

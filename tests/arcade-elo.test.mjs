import test from 'node:test';
import assert from 'node:assert/strict';
import {ELO_FLOORS,eloFloor,clampElo,eloExpected,updateEloPair,migrateLegacyElo} from '../dist/arcade-elo.js';
test('fifteen canonical grades rise from F 100 to SSS+V 1500',()=>{
  assert.deepEqual(Object.values(ELO_FLOORS),Array.from({length:15},(_,i)=>100+100*i));
  assert.equal(eloFloor(' sss+ v '),1500);
  assert.equal(eloFloor('constructor'),100);
  assert.equal(clampElo(NaN,'A'),600);
  assert.equal(clampElo(1620.34,'SSS+V'),1620.5);
});

test('odds double for each 100 Elo gap; mirrored expectations sum to one',()=>{
  for(const [gap,odds] of [[-200,.25],[-100,.5],[0,1],[100,2],[200,4]]){
    const p=eloExpected(2000+gap,2000);
    assert(Math.abs(p-(odds/(1+odds)))<1e-12);
    assert(Math.abs(p+eloExpected(2000,2000+gap)-1)<1e-12);
  }
});

test('paired K16 wins and draws award the expected rounded transfer',()=>{
  const profile=(rating)=>({rating,grade:'F'});
  assert.deepEqual(updateEloPair(profile(1800),profile(1800),1),{ratingA:1808,ratingB:1792,deltaA:8,deltaB:-8});
  assert.deepEqual(updateEloPair(profile(1800),profile(2000),.5),{ratingA:1805,ratingB:1995,deltaA:5,deltaB:-5});
  assert.deepEqual(updateEloPair(profile(2000),profile(1800),.5),{ratingA:1995,ratingB:1805,deltaA:-5,deltaB:5});
  assert.throws(()=>updateEloPair(profile(1800),profile(2000),null),RangeError);
});

test('each grade floor protects the loss without capping the other rating gain',()=>{
  const a={rating:1450,grade:'SSS+ V'}, b={rating:1400,grade:'SSS+IV'};
  assert.deepEqual(updateEloPair(a,b,0),{ratingA:1500,ratingB:1410.5,deltaA:0,deltaB:10.5});
  assert.deepEqual(updateEloPair(a,b,1),{ratingA:1505.5,ratingB:1400,deltaA:5.5,deltaB:0});
});

test('public labels with spaces still resolve the exact same grade floor',()=>{
  assert.equal(eloFloor('SSS+ (entry)'),1000);
  assert.equal(eloFloor('SSS+ V'),1500);
});

test('old ratings preserve the position within a tier and exact relative odds',()=>{
  assert.deepEqual(Array.from({length:15},(_,i)=>migrateLegacyElo(1000+i*200)),Object.values(ELO_FLOORS));
  assert.equal(migrateLegacyElo(3914),1557);
  assert.equal(migrateLegacyElo(3915),1557.5);
  assert.equal(migrateLegacyElo(2050),625);
  assert.equal(clampElo(migrateLegacyElo(3915),'SSS+V'),1557.5);
  assert.equal(eloExpected(migrateLegacyElo(3915),migrateLegacyElo(3800)),1/(1+2**((3800-3915)/200)));
});

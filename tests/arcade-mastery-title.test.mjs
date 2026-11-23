import test from 'node:test';
import assert from 'node:assert/strict';
import {masteryTitle,earnedMasteryTitle} from '../dist/arcade-mastery-title.js';

test('earned Elo uses only the four confirmed title abbreviations',()=>{
  assert.deepEqual([1499.5,1500,1599.5,1600,1700,1800,3000].map(n=>masteryTitle(n)),['','GM','GM','HGM','SGM','AGM','AGM']);
  assert.equal(masteryTitle(1800,false),'');
});
test('titles survive rating drops but are not earned by roster seeds or custom Hero ratings',()=>{
  const state={records:{earned:{wins:1,elo:1520},seed:{elo:1500,wins:0},retired:{wins:2,elo:1590}},
    heroes:{custom:{elo:2000},earned:{elo:1850}},peaks:{earned:{peakElo:1710},squad:{peakElo:1644}}};
  assert.equal(earnedMasteryTitle(state,'earned'),'SGM');
  assert.equal(earnedMasteryTitle(state,'retired'),'GM');
  assert.equal(earnedMasteryTitle(state,'squad'),'HGM');
  assert.equal(earnedMasteryTitle(state,'custom'),'');
  assert.equal(earnedMasteryTitle(state,'seed'),'');
});

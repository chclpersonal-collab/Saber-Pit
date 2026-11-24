import test from 'node:test';
import assert from 'node:assert/strict';
import {tournamentBoutRates} from '../dist/arcade-bout-rates.js';
test('the two percentages count real decisions and all draws, and add to 100',()=>{
  assert.deepEqual(tournamentBoutRates({wins:4,draws:3,losses:2,titles:1}),{lossPercent:22.2,winDrawPercent:77.8,total:9});
  assert.deepEqual(tournamentBoutRates({wins:0,draws:3,losses:0}),{lossPercent:0,winDrawPercent:100,total:3});
  assert.deepEqual(tournamentBoutRates({wins:0,draws:0,losses:1}),{lossPercent:100,winDrawPercent:0,total:1});
  assert.equal(tournamentBoutRates({wins:0,draws:0,losses:0}),null);
});

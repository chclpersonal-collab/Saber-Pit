import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseArenaMatchGoal as goal} from '../dist/arcade-match-goal.js';
const normal={time:45,limit:75,elo:1500,opponentElo:1500,selfAlive:1,enemyAlive:1,injuryEdge:0,pressure:.2,form:'makashi'};
test('normal and early fights seek wins; Elo alone cannot force a draw',()=>{
  assert.equal(goal(), 'win');assert.equal(goal(normal),'win');
  assert.equal(goal({...normal,opponentElo:2400,time:74}),'win');
  assert.equal(goal({...normal,time:12,pressure:1,injuryEdge:-1,opponentElo:2500}),'win');
});
test('credible bad late matchups can play for the clock',()=>{
  assert.equal(goal({...normal,time:65,injuryEdge:-.65,pressure:.83}),'draw');
  assert.equal(goal({...normal,time:65,selfAlive:2,enemyAlive:5,pressure:.77}),'draw');
  assert.equal(goal({...normal,time:65,selfAlive:4,enemyAlive:2,pressure:.4}),'win');
});
test('good openings override defensive intent and the narrow transition band has hysteresis',()=>{
  const borderline={...normal,time:56,injuryEdge:-.31,pressure:.5};
  assert.equal(goal(borderline),'win');
  assert.equal(goal({...borderline,currentGoal:'draw'}),'draw');
  assert.equal(goal({...borderline,currentGoal:'draw',opening:true}),'win');
  assert.equal(goal({...borderline,currentGoal:'draw',injuryEdge:.65,pressure:.2}),'win');
});
test('form temperament nudges a marginal case but does not change timing or results',()=>{
  const edge={...normal,time:69,injuryEdge:-.30,pressure:.37};
  assert.equal(goal({...edge,form:'soresu'}),'draw');
  assert.equal(goal({...edge,form:'juyo'}),'win');
  assert.equal(goal({...edge,limit:Infinity,time:NaN,form:'constructor'}),'win');
});

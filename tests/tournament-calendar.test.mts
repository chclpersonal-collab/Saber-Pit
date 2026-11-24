import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonWeek} from '../dist/tournament-calendar.js';
import {loadTournament, startTournament} from '../dist/arcade-tournament.js';
import {loadSquadTournament, startSquadTournament} from '../dist/squad-tournament.js';

test('season numbers are one-based fictional week numbers, including old milestones', () => {
  for(const [season, week] of [[1,1],[52,52],[142,142],[143,143],[0,null],[-1,null],[1.5,null],[null,null],['142',null]]) {
    assert.equal(seasonWeek(season), week);
  }
});

test('both formats begin at week one and keep their requested bout clock', () => {
  for (const [load,start] of [[loadTournament,startTournament],[loadSquadTournament,startSquadTournament]]) {
    const state=load({getItem:()=>null});
    assert.equal(seasonWeek(state.season),null);
    start(state,{seed:12,limit:90});
    assert.equal(seasonWeek(state.active.season),1);
    assert.equal(state.active.limit,90);
  }
});

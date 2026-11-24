import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatchReport,appendMatchReportEvents,finishMatchReport,sanitizeMatchReport} from '../dist/arcade-match-report.js';
const source={fighters:[{id:'slug',name:'Slug'},{id:'moth',name:'Moth'}],
  plans:[{goal:'win',doctrine:'aggressive'},{goal:'draw',intentReason:'defend lead'}],seed:23,round:1,stage:'main',
  limit:30,clock:{source:'fighter vote',reason:'both selected 30'}};
test('goal transitions are real, unique and independent of result and clock choice',()=>{
 const r=createMatchReport(source);
 const events=[
   {id:1,kind:'slash',team:0,goal:'draw',time:1.2},
   {id:2,kind:'match_goal',team:0,previous:'win',goal:'draw',time:3.8,reason:'survive-clock'},
   {id:3,kind:'match_goal',team:0,previous:'draw',goal:'draw',time:6},
   {id:4,kind:'match_goal',fighterId:'moth',previous:'draw',goal:'win',time:12.13,reason:'press-opening'},
 ];
 appendMatchReportEvents(r,events);appendMatchReportEvents(r,events);
 const result=finishMatchReport(r,{time:19.333,winnerIndex:0,reason:'elimination'});
 assert.equal(result.sides[0].initialIntent,'win');assert.equal(result.sides[1].initialIntent,'draw');
 assert.deepEqual(result.sides[0].changes,[{time:3.8,previous:'win',intention:'draw',reason:'survive-clock'}]);
 assert.deepEqual(result.sides[1].changes,[{time:12.13,previous:'draw',intention:'win',reason:'press-opening'}]);
 assert.deepEqual(result.result,{winnerIndex:0,reason:'elimination'});
 assert.equal(result.clock.seconds,30);assert.equal(result.elapsed,19.333);
 assert.equal(result.lastEventId,undefined);
 assert.deepEqual(sanitizeMatchReport(JSON.parse(JSON.stringify(result))),result);
});
test('missing intent remains unknown, a late sighting is not a fabricated plan change',()=>{
 const data=createMatchReport({...source,plans:[]});
 appendMatchReportEvents(data,[
  {id:1,kind:'match_goal',team:0,time:3,goal:'draw'},
  {id:2,kind:'match_goal',team:1,time:3,goal:'win',previous:'draw'},
 ]);
 const report=finishMatchReport(data,{elapsed:12,winnerIndex:null,reason:'timeout'});
 assert.equal(report.sides[0].initialIntent,null);assert.deepEqual(report.sides[0].changes,[]);
 assert.equal(report.sides[1].initialIntent,null);assert.equal(report.sides[1].changes[0].time,3);
 assert.equal(report.result.winnerIndex,null);
 assert.equal(finishMatchReport(data,{time:1,reason:'timeout'}),null);
});
test('long event feeds preserve first and most recent changes and remain bounded',()=>{
 const data=createMatchReport(source);
 const events=Array.from({length:29},(_,i)=>({id:i+1,kind:'match_goal',team:0,time:i+1,goal:i%2?'win':'draw',previous:i%2?'draw':'win'}));
 appendMatchReportEvents(data,events);
 const report=finishMatchReport(data,{elapsed:30,winnerIndex:1,reason:'timeout'});
 assert.equal(report.sides[0].changes.length,18);
 assert.equal(report.sides[0].truncated,11);
 assert.equal(report.sides[0].changes[0].time,1);
 assert.equal(report.sides[0].changes.at(-1).time,29);
 report.sides[0].changes.at(-1).time=99;
 assert.equal(sanitizeMatchReport(report),null);
});
test('squad reports do not attribute separate member switches to the whole team',()=>{
 const fighters=[{id:'0-0',name:'A',team:0},{id:'0-1',name:'B',team:0},{id:'1-0',name:'C',team:1},{id:'1-1',name:'D',team:1}];
 const report=createMatchReport({fighters,limit:45,plans:fighters.map(()=>({goal:'win'}))});
 appendMatchReportEvents(report,[
   {id:1,kind:'match_goal',team:0,fighterId:'0-1',previous:'win',goal:'draw',time:22,reason:'outnumbered'},
   {id:2,kind:'match_goal',team:1,fighterId:'1-0',previous:'win',goal:'draw',time:23,reason:'injury-risk'},
   {id:3,kind:'match_goal',team:0,fighterId:'unknown',previous:'win',goal:'draw',time:24},
 ]);
 const saved=finishMatchReport(report,{time:41,winnerIndex:1,reason:'elimination'});
 assert.deepEqual(saved.sides.map(f=>f.changes.length),[0,1,1,0]);
 assert.deepEqual(sanitizeMatchReport(JSON.parse(JSON.stringify(saved))),saved);
});

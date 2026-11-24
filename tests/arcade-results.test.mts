import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoundResult,resultElo,resultModeTag} from '../dist/arcade-results.js';
import type {RoundElo,RoundResultInput} from '../dist/arcade-results.js';

const elo:RoundElo={rank:'E',ratingBefore:236,ratingAfter:245,delta:9,floor:200,cap:299.5};
const base:RoundResultInput={mode:'duel',teamSizes:[1,1],round:2,seconds:161.7,rated:true,save:'saved',who:null,
  line:{kills:3,deaths:1,damage:412.6,parries:7,saberHits:14,saberSwings:22},elo};

test('a saved rated round shows the Elo change, the saved tick data and the gap to the current Elo cap',()=>{
  const m=buildRoundResult(base);
  assert.equal(m.eyebrow,'Round 2 · Duel · 1v1 · 2:41');
  assert.equal(m.badge,'RATED');
  assert.deepEqual(m.tiles.map(t=>t.value),['3','1','412','7']);
  assert.equal(m.hits,'Saber hits 14 · Swings 22');
  assert.deepEqual(m.elo,{kind:'saved',who:null,rank:'E',rating:'245',delta:'+9',up:true,toCap:'54.5 to current Elo cap',bar:true,pct:.45/.995,gainPct:.09/.995});
});
test('a failed save never shows a delta or a saved tick',()=>{
  for(const save of ['conflict','session-only','unavailable','untracked'] as const){
    const m=buildRoundResult({...base,save});
    assert.deepEqual(m.elo,{kind:'unrecorded',text:'Elo not recorded.'},save);
    assert.equal(JSON.stringify(m).includes('+9'),false,save);
  }
  assert.equal(resultElo({rated:true,save:'saved',elo:null}).kind,'unrecorded');
});
test('unrated rounds say so and change nothing',()=>{
  const m=buildRoundResult({...base,rated:false,mode:'squad',teamSizes:[15,15]});
  assert.equal(m.badge,'UNRATED');
  assert.equal(m.eyebrow,'Round 2 · Squads · 15v15 · 2:41');
  assert.deepEqual(m.elo,{kind:'unrated',text:'Unrated round. Elo unchanged.'});
});
test('losses and Elo caps read plainly; Elo never claims a rank-up',()=>{
  const loss=resultElo({rated:true,save:'saved',elo:{...elo,ratingBefore:245,ratingAfter:236,delta:-9}});
  assert.equal(loss.kind==='saved'&&loss.delta,'−9');assert.equal(loss.kind==='saved'&&loss.gainPct,0);
  const cap=resultElo({rated:true,save:'saved',elo:{...elo,ratingAfter:299.5,delta:3}});
  assert.equal(cap.kind==='saved'&&cap.toCap,'At current Elo cap');
  for(const none of [null,Number.POSITIVE_INFINITY,'x']){
    const top=resultElo({rated:true,save:'saved',elo:{...elo,cap:none}});
    assert.equal(top.kind==='saved'&&top.toCap,'No Elo cap');assert.equal(top.kind==='saved'&&top.bar,false);
  }
});
test('mode tags are plain categories',()=>{
  assert.equal(resultModeTag('duel',[1,1]),'Duel · 1v1');
  assert.equal(resultModeTag('watch',[5,5]),'Watch · 5v5');
  assert.equal(resultModeTag('command',[3,3]),'Commander · 3v3');
  assert.equal(resultModeTag('anything',[]),'1v1');
});
test('bad numbers never reach the card',()=>{
  const m=buildRoundResult({...base,seconds:Number.NaN,round:0,line:{kills:-1,deaths:'x',damage:Number.POSITIVE_INFINITY,parries:null,saberHits:undefined,saberSwings:2.9}});
  assert.deepEqual(m.tiles.map(t=>t.value),['0','0','0','0']);
  assert.equal(m.hits,'Saber hits 0 · Swings 2');
  assert.equal(m.eyebrow,'Round 1 · Duel · 1v1 · 0:00');
});
test('a rating below its rank floor still fills the bar from where it is',()=>{
  const low=resultElo({rated:true,save:'saved',elo:{...elo,who:'Blue fighter 1',ratingBefore:100,ratingAfter:102,delta:2}});
  assert.equal(low.kind==='saved'&&low.who,'Blue fighter 1');
  assert.equal(low.kind==='saved'&&low.toCap,'197.5 to current Elo cap');
  assert.ok(low.kind==='saved'&&low.pct>0&&low.pct<.05);
});
test('no Elo line mentions a rank-up',()=>{
  for(const after of [100,150,245,299.5]){
    const v=resultElo({rated:true,save:'saved',elo:{...elo,ratingAfter:after}});
    assert.equal(/rank up| to [A-Z]$/.test(v.kind==='saved'?v.toCap:''),false);
  }
});

test('missing or nonfinite settled Elo numbers cannot show a saved amount or delta',()=>{
  for(const broken of [{ratingBefore:null},{ratingAfter:0},{ratingAfter:Infinity},{delta:null},{delta:NaN}]){
    assert.deepEqual(resultElo({rated:true,save:'saved',elo:{...elo,...broken}}),{kind:'unrecorded',text:'Elo not recorded.'});
  }
});

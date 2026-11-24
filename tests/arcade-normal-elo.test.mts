import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARCADE_CAREER_KEY,readArcadeCareer,saveArcadeCareer,settleArcadeCareer} from '../dist/arcade-career.js';
import {arenaNormalCap,arenaNormalRanked,arenaNormalRating,safeArenaNormalRatings,updateArenaNormalRatings} from '../dist/arcade-normal-elo.js';

const slots=(count:number,gradeIndex=14)=>[0,1].flatMap(team=>Array.from({length:count},(_,slot)=>({id:`${team}-${slot}`,team:team as 0|1,gradeIndex})));
const game=(count:number,phase='won')=>({phase,mode:'watch',config:{rule:'elimination',teamSizes:[count,count]},
  fighters:slots(count).map((f)=>({...f,alive:f.team===0,career:{merit:0}}))});

test('regular ranks start at 100, next-grade ceiling is half a point below its band and top is open',()=>{
  assert.equal(arenaNormalRating(undefined),100);
  assert.equal(arenaNormalCap(0),199.5);
  assert.equal(arenaNormalCap(1),299.5);
  assert.equal(arenaNormalCap(13),1499.5);
  assert.equal(arenaNormalCap(14),null);
  const grandmaster=settleArcadeCareer({...game(1),fighters:game(1).fighters.map(f=>({...f,career:{merit:6000}}))})!;
  assert.deepEqual(grandmaster.arenaRatings,{'0-0':108,'1-0':100});
});
test('each fighter gets the same transfer by team average (100 Elo difference is 2:1), with a 100 floor',()=>{
  const prior={'0-0':250,'0-1':350,'1-0':200,'1-1':200};
  const expectedWin=updateArenaNormalRatings(prior,slots(2),0,true);
  assert.deepEqual(expectedWin.arenaRatings,{'0-0':255.5,'0-1':355.5,'1-0':194.5,'1-1':194.5});
  assert.deepEqual(updateArenaNormalRatings(prior,slots(2),1,true).arenaRatings,{'0-0':239.5,'0-1':339.5,'1-0':210.5,'1-1':210.5});
  assert.deepEqual(updateArenaNormalRatings(prior,slots(2),null,true).arenaRatings,{'0-0':247.5,'0-1':347.5,'1-0':202.5,'1-1':202.5});
  assert.equal(prior['0-0'],250);
});
test('a capped fighter banks nothing; a genuine promotion can unlock the next band on this round',()=>{
  const first=game(2);
  first.fighters[0].alive=false; // Blue won, but this slot was KO'd and ends as F.
  const result=settleArcadeCareer(first,{'0-0':199,'0-1':199})!;
  assert.equal(result.report[0].after.grade,'F');
  assert.equal(result.report[0].ratingAfter,199.5);
  assert.equal(result.report[0].ratingDelta,.5);
  assert.equal(result.report[1].after.grade,'E');
  assert.ok(result.report[1].ratingAfter>199.5);
  assert.strictEqual(settleArcadeCareer(first,{'0-0':1200}),result);
  const next=game(2);
  next.fighters[0].career=result.careers['0-0'];
  const promoted=settleArcadeCareer(next,result.arenaRatings)!;
  const baseline=updateArenaNormalRatings(result.arenaRatings,slots(2),0,true);
  assert.equal(promoted.report[0].after.grade,'E');
  assert.equal(promoted.report[0].ratingAfter,baseline.arenaRatings['0-0']);
});
test('eligibility requires canonical even regular elimination rosters from 1 through 15',()=>{
  for(const n of [1,2,5,10,15])assert.equal(arenaNormalRanked(game(n)),true);
  const g=game(2), cases=[
    {...g,mode:'command'},game(16),{...g,config:{...g.config,rule:'control'}},{...g,config:{...g.config,rule:'relic'}},
    {...g,config:{...g.config,teamSizes:[1,2]}},{...g,config:{...g.config,matchGoalPlanning:true}},
    {...g,fighters:[{...g.fighters[0],heroId:'saved'},...g.fighters.slice(1)]},
    {...g,fighters:[g.fighters[0],g.fighters[0],...g.fighters.slice(2)]},
  ];
  const prior={'0-0':170,'1-0':140,'0-14':135};
  for(const excluded of cases){
    assert.equal(arenaNormalRanked(excluded),false);
    const result=settleArcadeCareer(excluded,prior)!;
    assert.equal(result.rated,false);
    assert.deepEqual(result.arenaRatings,prior);
  }
  assert.equal(settleArcadeCareer(game(2,'playing'),prior),null);
});
test('legacy saves have implicit 100 ratings; malformed data is ignored and nonparticipants are retained',()=>{
  const old={version:1,mode:'duel',round:1,seed:1};
  let disk=JSON.stringify(old);
  const store={getItem:(key:string)=>key===ARCADE_CAREER_KEY?disk:null,setItem:(_:string,value:string)=>{disk=value;}};
  assert.deepEqual(readArcadeCareer(store)?.arenaRatings,{});
  assert.deepEqual(safeArenaNormalRatings({'0-0':99,'1-3':200.24,'1-4':200.25,'1-14':401.5,'1-15':400,'1-5':Infinity,'0-20':100,'weird':100}),{'0-0':100,'1-3':200,'1-4':200.5,'1-14':401.5});
  const result=settleArcadeCareer(game(1),{'0-14':208.5})!;
  assert.ok(saveArcadeCareer({...old,round:2,arenaRatings:result.arenaRatings},store));
  assert.deepEqual(readArcadeCareer(store)?.arenaRatings,result.arenaRatings);
  assert.equal(result.arenaRatings['0-14'],208.5);
});
test('a finished actual Arena simulation earns Elo once without mutating the fight',()=>{
  const match=createArcade({mode:'watch',teamSizes:[1,1],startingRanks:['SSS+V','F'],seed:31,terrain:'underpit',limit:45});
  assert.equal(settleArcadeCareer(match),null);
  while(match.phase==='playing')stepArcade(match,1/120);
  assert.equal(match.phase,'won');
  const frozen=structuredClone(match);
  const result=settleArcadeCareer(match)!;
  assert.equal(result.rated,true);
  assert.deepEqual(result.arenaRatings,{'0-0':108,'1-0':100});
  assert.deepEqual(match,frozen);
});

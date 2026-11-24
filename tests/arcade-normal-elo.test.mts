import test from 'node:test';
import assert from 'node:assert/strict';
import {recordDamage,recordKnockout} from '../dist/arcade-engine-stats.js';
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
});
const ko=(victimId:string,killerId:string|null,assists:string[]=[])=>
  ({victimId,killerId,assists});
test('only credited fighters gain from a KO; a lower Elo killer costs the victim more',()=>{
  const prior={'0-0':200,'0-1':300,'0-2':250,'1-0':300,'1-1':220,'1-2':245};
  const upset=updateArenaNormalRatings(prior,slots(3),[ko('1-0','0-0',['0-1'])],true);
  assert.deepEqual(upset.arenaRatings,{'0-0':208,'0-1':302.5,'0-2':250,'1-0':289.5,'1-1':220,'1-2':245});
  const expected=updateArenaNormalRatings(prior,slots(3),[ko('0-0','1-0')],true);
  assert.equal(expected.changes['0-0'].ratingDelta,-5.5);
  assert.equal(expected.changes['1-0'].ratingDelta,5.5);
  assert.equal(prior['0-0'],200);
});
test('simultaneous KO transfers use the same starting ratings regardless of order',()=>{
  const prior={'0-0':200,'1-0':300};
  const kos=[ko('1-0','0-0'),ko('0-0','1-0')];
  const actual=updateArenaNormalRatings(prior,slots(1),kos,true);
  assert.deepEqual(actual.arenaRatings,{'0-0':205,'1-0':295});
  assert.deepEqual(updateArenaNormalRatings(prior,slots(1),kos.reverse(),true),actual);
});
test('ceilings, floor, duplicate attribution, uncredited and invalid KOs cannot award extra Elo',()=>{
  const prior={'0-0':199,'0-1':199,'0-2':198,'1-0':100,'1-1':180,'1-2':190};
  const credited=ko('1-0','0-0',['0-1','0-2','0-2','1-1','0-0','x']);
  const events=[credited,credited,ko('1-1',null),ko('1-2','1-1')];
  const result=updateArenaNormalRatings(prior,slots(3,0),events,true);
  assert.deepEqual(result.arenaRatings,{'0-0':199.5,'0-1':199.5,'0-2':198.5,'1-0':100,'1-1':180,'1-2':190});
  assert.equal(updateArenaNormalRatings(prior,slots(3,1),[credited],true).changes['0-0'].ratingAfter,203);
});
test('won, lost, or drawn rounds with no verified knockout do not move Elo',()=>{
  for(const phase of ['won','lost','draw']){
    const prior={'0-0':130,'1-0':140};
    const settled=settleArcadeCareer(game(1,phase),prior)!;
    assert.deepEqual(settled.arenaRatings,prior);
    assert.strictEqual(settleArcadeCareer(game(1,'playing'),prior),null);
  }
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

test('authoritative attribution survives HUD event trimming and credits only recent real damage',()=>{
  const g=createArcade({mode:'watch',teamSizes:[3,3],startingRanks:['SSS+V','SSS+V'],seed:91,limit:45});
  const [a,b,old,victim]=g.fighters;
  assert.equal(victim.team,1);
  const stats=g as Parameters<typeof recordDamage>[0];
  const [aF,bF,oldF,victimF]=stats.fighters;
  stats.time=1;recordDamage(stats,oldF,victimF,70);
  stats.time=7.25;recordDamage(stats,aF,victimF,15);recordDamage(stats,bF,victimF,5);
  recordKnockout(stats,victimF);
  assert.deepEqual(victimF.stats.deaths,1);
  assert.deepEqual(oldF.stats.assists,0);
  g.events.length=0;
  g.phase='draw';
  const row=Object.fromEntries(settleArcadeCareer(g)!.report.map(r=>[r.id,r.ratingDelta]));
  assert.deepEqual(row,{[a.id]:6,[b.id]:2,[old.id]:0,[victim.id]:0,'1-1':0,'1-2':0});
});

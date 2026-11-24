import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoDuel} from '../dist/arcade-auto-duel.js';
import {arenaLobbyRating} from '../dist/arcade-arena-rating-ui.js';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {saveArcadeCareer,readArcadeCareer,settleArcadeCareer} from '../dist/arcade-career.js';

test('visible countdown starts only on a saved result and dispatches once',()=>{
  const auto=createAutoDuel();auto.start();
  assert.equal(auto.advance(30,true),false);
  auto.completeRound(true);
  assert.equal(auto.seconds,3);
  assert.equal(auto.advance(10,false),false);
  assert.equal(auto.seconds,3);
  assert.equal(auto.advance(2.99,true),false);
  assert.equal(auto.seconds,1);
  assert.equal(auto.advance(.01,true),true);
  assert.equal(auto.advance(30,true),false);
  auto.completeRound(true);
  auto.clearRound();
  assert.equal(auto.advance(30,true),false);
  auto.completeRound(true);auto.stop();
  assert.equal(auto.advance(30,true),false);
  auto.start();auto.completeRound(false);
  assert.equal(auto.active,false);
  assert.equal(auto.advance(30,true),false);
});

test('auto eligibility shares ordinary ranked rules, including 15v15 but not heroes or objectives',()=>{
  for(const count of [1,2,15])assert.equal(arenaLobbyRating('watch','elimination',[count,count],{}).rated,true);
  for(const [mode,rule,sizes,heroes] of [
    ['watch','elimination',[16,16],{}],['watch','elimination',[1,2],{}],['watch','control',[3,3],{}],
    ['command','elimination',[3,3],{}],['duel','elimination',[1,1],{'0-0':{id:'hero'}}],
  ] as const)assert.equal(arenaLobbyRating(mode,rule,sizes,heroes).rated,false);
});

test('two automatic handoffs retain individual career and Elo through the normal saved-round path',()=>{
  let raw='';
  const storage={setItem(_key:string,value:string){raw=value;},getItem(){return raw||null;}};
  const auto=createAutoDuel();auto.start();
  let prior=readArcadeCareer(storage);
  for(let round=1;round<=2;round++){
    const game=createArcade({mode:'watch',seed:42+round,round,terrain:'open',teamSizes:[1,1],startingRanks:['A','A'],careers:prior?.careers});
    assert.ok(game.fighters.every(f=>!f.control));
    for(let i=0;i<150*120&&game.phase==='playing';i++)stepArcade(game,1/120);
    assert.notEqual(game.phase,'playing');
    const result=settleArcadeCareer(game,prior?.arenaRatings)!;
    assert.equal(result.rated,true);
    assert.strictEqual(settleArcadeCareer(game,{}),result);
    if(prior)for(const row of result.report)assert.equal(row.ratingBefore,prior.arenaRatings[row.id]??100);
    auto.completeRound(saveArcadeCareer({mode:'duel',seed:44+round,round:round+1,careers:result.careers,arenaRatings:result.arenaRatings},storage));
    assert.equal(auto.advance(3,true),true);
    prior=readArcadeCareer(storage);
    assert.equal(prior?.round,round+1);
    assert.deepEqual(prior?.arenaRatings,result.arenaRatings);
  }
});

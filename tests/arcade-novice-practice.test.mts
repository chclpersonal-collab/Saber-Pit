import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSetup,canArenaNovicePractice,engineForcePools} from '../dist/arcade-setup.js';
import {createArcade,stepArcade} from '../dist/arcade-engine-api.js';
import {arenaNormalRanked} from '../dist/arcade-normal-elo.js';
import {arenaLobbyRating} from '../dist/arcade-arena-rating-ui.js';

test('practice is explicit, low-rank played 1v1 only, and does not turn on by default',()=>{
  const raw={participation:'play',teamSizes:[1,1],rule:'elimination',startingRanks:['F','E']};
  const defaults=normalizeSetup(raw);
  assert.equal(defaults.novicePractice,false);
  const eligible=normalizeSetup({...raw,novicePractice:true});
  assert.equal(eligible.novicePractice,true);
  assert.equal(canArenaNovicePractice(eligible,{}),true);
  for(const exclude of [{teamSizes:[2,2]},{startingRanks:['F','D']},{participation:'watch'},{rule:'control'}])
    assert.equal(canArenaNovicePractice(normalizeSetup({...eligible,...exclude}),{}),false);
  assert.equal(canArenaNovicePractice(eligible,{'1-0':{id:'saved-hero'}}),false);
  assert.match(arenaLobbyRating('duel','elimination',[1,1],{},engineForcePools(eligible),true).label,/Unrated.*0.75/);
});

test('practice metadata changes Elo eligibility without modifying deterministic duel physics',()=>{
  const options={mode:'duel',teamSizes:[1,1],seed:17,startingRanks:['F','E']};
  const normal=createArcade(options),practice=createArcade(options);
  practice.config.novicePractice=true;
  assert.equal(arenaNormalRanked(normal),true);
  assert.equal(arenaNormalRanked(practice),false);
  for(let i=0;i<300;i++){
    const input={x:i<50?1:0,strike:i%20===0,guard:i%13<4};
    stepArcade(normal,1/120,input);stepArcade(practice,1/120,input);
  }
  delete practice.config.novicePractice;
  assert.deepEqual(practice,normal);
});

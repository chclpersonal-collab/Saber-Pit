import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

// Baselines captured from the shipped JS engine, not from generated TypeScript.
// Hash complete authoritative state (including PRNG, stats and retained event order).
const verdict=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0,12);
test('terrain, packed movement and injury states keep exact 5v5 parity',()=>{
  const state=createArcade({mode:'watch',seed:804,terrain:'crossroads',teamSizes:[5,5],startingRanks:['SSS+V','SSS+V'],
    impactPhysics:true,peasantMotion:true,activeFootwork:true,liveEntry:true});
  for(let i=0;i<1000;i++)stepArcade(state,1/120,{});
  assert.equal(state.tick,1000);
  assert.equal(verdict(state),'614d1d9f4ee5');
});
test('manual movement plus jump/strike/guard preserves exact Arcade parity',()=>{
  const state=createArcade({mode:'duel',seed:43,terrain:'underpit',form:'ataru',teamForms:[['ataru'],['djem_so']],
    startingRanks:['SSS+V','SSS+V'],peasantMotion:true,impactPhysics:true,activeFootwork:true});
  for(let i=0;i<1000;i++){
    stepArcade(state,1/120,{x:i<90?1:.1,y:.12,jump:i%116===0,strike:i%23===0,guard:i%74<9,
      aimX:state.fighters[1].x,aimY:state.fighters[1].y});
  }
  assert.equal(state.tick,1000);
  assert.equal(verdict(state),'00ae549f3857');
});

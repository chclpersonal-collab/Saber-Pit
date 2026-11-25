import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

// Local versus: two people on one device. Each side moves only on its own player's input.
const make=(extra={})=>createArcade({mode:'duel',seed:3,teamSizes:[1,1],startingRanks:['A','A'],form:'shii_cho',terrain:'underpit',localVersus:true,smartAI:true,...extra});

test('both fighters are player controlled in local versus', () => {
  const s=make();
  assert.deepEqual(s.fighters.map(f=>f.control),[true,true]);
  assert.equal(createArcade({mode:'duel',teamSizes:[1,1]}).fighters[1].control,false);
  assert.equal(createArcade({mode:'watch',teamSizes:[1,1],localVersus:true}).fighters.some(f=>f.control),false);
});

test('each player moves only their own fighter', () => {
  const s=make(),[blue,pink]=s.fighters,start=[blue.x,pink.x];
  for(let i=0;i<30;i++)stepArcade(s,1/60,{x:-1,y:0,p2:{}});
  assert.ok(blue.x<start[0]-10,'Blue walks left on player one');
  assert.ok(Math.abs(pink.x-start[1])<1,'Pink stays put without player two');
  const p=pink.x;
  for(let i=0;i<30;i++)stepArcade(s,1/60,{p2:{x:1,y:0}});
  assert.ok(pink.x>p+10,'Pink walks right on player two');
});

test('a held button swings once per press for each player on its own', () => {
  const s=make(),[blue,pink]=s.fighters;
  Object.assign(blue,{x:400,y:300});Object.assign(pink,{x:470,y:300});
  for(let i=0;i<40;i++)stepArcade(s,1/60,{strike:true,aimX:pink.x,aimY:pink.y,p2:{strike:i<20,aimX:blue.x,aimY:blue.y}});
  assert.equal(blue.stats.saberSwings,1);assert.equal(pink.stats.saberSwings,1);
});

test('a pink player who presses nothing never defends', () => {
  const s=make({startingRanks:['SSS+V','SSS+V']}),[blue,pink]=s.fighters;let defence=0;const seen=new Set();
  let n=0;
  while(s.phase==='playing'&&s.time<40){
    stepArcade(s,1/60,{strike:(n++%9)===0,x:Math.sign(pink.x-blue.x)*(Math.abs(pink.x-blue.x)>70?1:0),aimX:pink.x,aimY:pink.y,p2:{}});
    for(const e of s.events){if(seen.has(e.id))continue;seen.add(e.id);if(e.fighterId===pink.id&&['parry','block','rank_deflect'].includes(e.kind))defence++;}
  }
  assert.equal(defence,0);
});

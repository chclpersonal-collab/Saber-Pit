import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaWorldSize,normalizeSetup,SIZE} from '../dist/arcade-setup.js';
import {resolveArcadeMap,createArcadeTerrain} from '../dist/arcade-stage.js';
import {openAt,blockedBetween} from '../dist/arcade-engine-geometry.js';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

test('High Bastion is wider than Large, opt-in only and offers three genuinely clear through routes',()=>{
  const cfg=normalizeSetup({mapId:'high_bastion',mapSize:'small'});
  assert.equal(cfg.mapId,'high_bastion');assert.equal(arenaWorldSize(cfg.mapId,'small')[0],1920);
  assert.ok(arenaWorldSize(cfg.mapId,'medium')[0]>SIZE.large[0]);
  assert.deepEqual(arenaWorldSize('crossroads','large'),SIZE.large);
  for(let round=1;round<=12;round++)assert.notEqual(resolveArcadeMap('rotation',round),'high_bastion');
  const terrain=createArcadeTerrain(cfg.mapId,1920,1080);assert.equal(terrain.solids.length,12);
  assert.equal(terrain.zones.filter(z=>z.kind==='hazard').length,2);
  for(const y of [264,610,960])assert.equal(blockedBetween({terrain},100,y,1820,y,17),undefined,y+' world y');
  assert.ok(blockedBetween({terrain},100,422,1820,422,17));
  const game=createArcade({mode:'watch',seed:29,teamSizes:[24,24],width:1920,height:1080,terrain});
  assert.ok(game.fighters.every(f=>openAt(game,f.x,f.y,f.radius)));
});
test('an actual Ataru jump takes the optional vent shortcut without phantom wall crossing',()=>{
  const terrain=createArcadeTerrain('high_bastion',1920,1080);
  const craft=()=>createArcade({mode:'duel',seed:45,form:'ataru',width:1920,height:1080,teamSizes:[1,1],terrain});
  const jump=craft(),ground=craft(),p=jump.fighters[0],q=ground.fighters[0];
  Object.assign(p,{x:919,y:398,face:0});Object.assign(q,{x:961,y:398,face:0});
  let minCrossingHeight=Infinity, crossingTicks=0;
  for(let i=0;i<85;i++){
    stepArcade(jump,1/120,{x:1,jump:i===0,aimX:1050,aimY:398});
    stepArcade(ground,1/120);
    if(p.x>=947&&p.x<=973){minCrossingHeight=Math.min(minCrossingHeight,p.airHeight);crossingTicks++;}
  }
  assert.ok(p.x>975&&crossingTicks>3);assert.ok(minCrossingHeight>18,minCrossingHeight.toFixed(2));
  assert.ok((q.injuries.leftLeg?.front??0)>0);
  assert.equal(p.injuries.leftLeg?.front,0);
});

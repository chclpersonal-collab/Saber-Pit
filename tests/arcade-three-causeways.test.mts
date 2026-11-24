import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaWorldSize,normalizeSetup,SIZE} from '../dist/arcade-setup.js';
import {resolveArcadeMap,createArcadeTerrain} from '../dist/arcade-stage.js';
import {openAt,blockedBetween} from '../dist/arcade-engine-geometry.js';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

test('Three Causeways stays explicitly selected and respects fixed dimensions and current engine limits',()=>{
 const config=normalizeSetup({mapId:'three_causeways',mapSize:'small'});
 assert.equal(config.mapId,'three_causeways');
 for(const size of ['small','medium','large'] as const)assert.deepEqual(arenaWorldSize(config.mapId,size),[2400,1350]);
 assert.deepEqual(arenaWorldSize('high_bastion','large'),[1920,1080]);
 assert.deepEqual(arenaWorldSize('crossroads','large'),SIZE.large);
 for(let i=1;i<=12;i++)assert.notEqual(resolveArcadeMap('rotation',i),config.mapId);
 const terrain=createArcadeTerrain(config.mapId,2400,1350);
 const g=createArcade({mode:'watch',seed:29,teamSizes:[24,24],width:2400,height:1350,terrain});
 assert.equal(g.width,2400);assert.equal(g.height,1350);
 assert.ok(g.fighters.every(f=>openAt(g,f.x,f.y,f.radius)));
});

test('a large group starts with mirrored front ranks in all three clear lanes',()=>{
 const t=createArcadeTerrain('three_causeways',2400,1350);
 for(const formation of ['line','spread','wedge']){
  const g=createArcade({mode:'watch',seed:29,teamSizes:[15,15],width:2400,height:1350,terrain:t,formations:[formation,formation]});
  for(let i=0;i<15;i++){
   const [a,b]=[g.fighters[i],g.fighters[i+15]];
   assert.equal(a.y,b.y);assert.equal(a.x+b.x,2400);
   assert.equal(blockedBetween({terrain:t},a.x,a.y,b.x,b.y,17),undefined);
  }
  assert.deepEqual([375,765,1135].map(y=>g.fighters.slice(0,15).filter(f=>Math.abs(f.y-y)<=51).length),[5,5,5]);
 }
 const duel=createArcade({mode:'duel',teamSizes:[1,1],width:2400,height:1350,terrain:t});
 assert.ok(duel.fighters.every(f=>Math.abs(f.y-675)<100));
});

test('all three through lanes and staggered crossovers are real, with mirrored line-of-sight cover',()=>{
 const terrain=createArcadeTerrain('three_causeways',2400,1350);
 for(const y of [375,765,1135])for(const offset of [-73,0,73]){
  assert.equal(blockedBetween({terrain},110,y+offset,2290,y+offset,17),undefined,'lane at '+(y+offset));
 }
 for(const x of [650,1030,1370,1750])assert.equal(blockedBetween({terrain},x,410,x,1125,17),undefined,'crossover at '+x);
 for(const y of [545,950])assert.ok(blockedBetween({terrain},675,y,1725,y,17));
 for(const solid of terrain.solids)assert.ok(terrain.solids.some(p=>p.x===2400-solid.x-solid.width&&p.y===solid.y&&p.width===solid.width&&p.height===solid.height));
 assert.equal(terrain.zones.length,0);
});

test('a real controlled fighter cannot cross a wall but can walk around it',()=>{
 const terrain=createArcadeTerrain('three_causeways',2400,1350);
 const g=createArcade({mode:'duel',seed:41,teamSizes:[1,1],width:2400,height:1350,terrain});
 const [f,rival]=g.fighters;Object.assign(f,{x:681,y:548,face:0});Object.assign(rival,{x:2180,y:1125});
 const move=(x:number,y:number,steps:number)=>{for(let tick=0;tick<steps;tick++)stepArcade(g,1/120,{x,y});};
 move(1,0,54);assert.ok(f.x<730&&f.x>=681);
 move(0,-1,78);assert.ok(f.y<492);
 move(1,0,195);assert.ok(f.x>995&&f.y<492);
});

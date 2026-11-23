import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_RADIUS, getBounds, canOccupy, lineOfSight, traceAttack, coverMultiplier, terrainAt, moveSwept, findPath, nextWaypoint, moveToward, nearestWalkablePoint } from '../dist/terrain.js';
const board = extra => ({ width: 400, height: 300, solids: [], zones: [], ...extra });
const wall = { id: 'wall', kind: 'wall', x: 180, y: 60, width: 30, height: 180 };
const close = (a,b) => assert.ok(Math.abs(a-b)<.001, `${a} ~= ${b}`);

test('terrain actor clearance and dynamic outer bounds share one footprint', () => {
  assert.equal(UNIT_RADIUS,9);
  const terrain=board({width:1600,height:900,playBounds:{minX:20,minY:30,maxX:1580,maxY:870},solids:[wall]});
  assert.deepEqual(getBounds(terrain),{minX:29,minY:39,maxX:1571,maxY:861});
  assert.equal(canOccupy(terrain,{x:171,y:150}),true);
  assert.equal(canOccupy(terrain,{x:172,y:150}),false);
  assert.equal(canOccupy(terrain,{x:10,y:100}),false);
  assert.equal(canOccupy(terrain,{x:NaN,y:100}),false);
});

test('walls obstruct sight, Force and saber; low cover obstructs saber only', () => {
  const terrain=board({solids:[wall]}),a={x:120,y:150},b={x:260,y:150};
  for(const kind of ['force','saber','sight']) assert.equal(lineOfSight(terrain,a,b,kind),false);
  assert.equal(traceAttack(terrain,a,b).blocker,'wall');
  close(traceAttack(terrain,a,b).point.x,180);
  assert.equal(lineOfSight(terrain,a,{x:130,y:150}),true);
  terrain.solids=[{...wall,kind:'barricade'}];
  assert.equal(lineOfSight(terrain,a,b,'force'),true);
  assert.equal(lineOfSight(terrain,a,b,'sight'),true);
  assert.equal(lineOfSight(terrain,a,b,'saber'),false);
});

test('cover protection is directional, nearby and never stacks', () => {
  const terrain=board({solids:[{...wall,kind:'barricade'},{...wall,id:'second',kind:'barricade'}]});
  assert.equal(coverMultiplier(terrain,{x:120,y:150},{x:225,y:150}),.86);
  assert.equal(coverMultiplier(terrain,{x:270,y:150},{x:225,y:150}),1);
  assert.equal(coverMultiplier(terrain,{x:120,y:150},{x:270,y:150}),1);
});

test('swept movement prevents walking, dash and knockback tunneling and allows sliding', () => {
  const terrain=board({solids:[wall]}), start={x:100,y:150};
  for(const goal of [{x:260,y:150},{x:1000,y:150}]) {
    const hit=moveSwept(terrain,start,goal);
    assert.equal(hit.blocked,true);assert.equal(hit.collisionId,'wall');assert.ok(hit.x<=171);assert.ok(canOccupy(terrain,hit));
  }
  const slide=moveSwept(terrain,start,{x:260,y:200});
  assert.ok(slide.x<=171);close(slide.y,200);assert.ok(canOccupy(terrain,slide));
  const away=moveSwept(terrain,{x:171,y:150},{x:160,y:150});
  assert.equal(away.blocked,false);close(away.x,160);
  const invalid=moveSwept(terrain,{x:190,y:150},{x:280,y:150});assert.equal(invalid.collisionId,'invalid-start');
});

test('movement can touch corners without entering solids and caps world bounds', () => {
  const terrain=board({solids:[wall]});
  for(const a of [{x:50,y:40},{x:100,y:250},{x:300,y:20}]) for(const b of [{x:350,y:260},{x:200,y:150},{x:-100,y:800}]) {
    const moved=moveSwept(terrain,a,b);assert.ok(canOccupy(terrain,moved));
  }
});

test('pathfinding takes an actual route around a wall and converges', () => {
  const terrain=board({solids:[wall]}), start={x:100,y:150}, goal={x:300,y:150};
  const path=findPath(terrain,start,goal);assert.ok(path.length>1);
  let previous=start;
  for(const p of path){assert.ok(canOccupy(terrain,p));const moved=moveSwept(terrain,previous,p);close(moved.x,p.x);close(moved.y,p.y);previous=p;}
  let p=start;
  for(let tick=0;tick<1000 && Math.hypot(p.x-goal.x,p.y-goal.y)>1;tick++)p=moveToward(terrain,p,goal,2);
  assert.ok(Math.hypot(p.x-goal.x,p.y-goal.y)<=1,JSON.stringify(p));
  assert.deepEqual(findPath(terrain,start,goal),path);
});

test('diagonal corner cutting and unreachable destinations fail safely', () => {
  const terrain=board({solids:[{id:'barrier',kind:'wall',x:190,y:0,width:20,height:300}]});
  assert.deepEqual(findPath(terrain,{x:100,y:150},{x:300,y:150}),[]);
  assert.equal(nextWaypoint(terrain,{x:100,y:150},{x:300,y:150}),null);
  assert.equal(moveToward(terrain,{x:100,y:150},{x:300,y:150},3).reachable,false);
  assert.deepEqual(findPath(terrain,{x:100,y:150},{x:200,y:150}),[]);
  const projected=nearestWalkablePoint(terrain,{x:200,y:150});assert.ok(canOccupy(terrain,projected));
  const corner=board({solids:[{id:'a',kind:'wall',x:100,y:0,width:40,height:150},{id:'b',kind:'wall',x:140,y:150,width:40,height:150}]});
  assert.deepEqual(findPath(corner,{x:50,y:250},{x:300,y:50}),[]);
});

test('rough and dangerous zones affect routing and actual movement, without stacking', () => {
  const zone={id:'mud',kind:'rough',x:80,y:100,width:240,height:100,moveCost:2,damagePerSecond:0};
  const terrain=board({zones:[zone,{...zone,id:'lava',kind:'hazard',moveCost:1.5,damagePerSecond:10}]});
  assert.deepEqual(terrainAt(terrain,{x:100,y:150}),{moveCost:2,moveMultiplier:.5,damagePerSecond:10,zoneIds:['mud','lava']});
  assert.equal(terrainAt(terrain,{x:40,y:50}).moveMultiplier,1);
  const path=findPath(terrain,{x:40,y:150},{x:360,y:150});assert.ok(path.some(p=>p.y<=100||p.y>=200));
  const mud=board({zones:[{...zone,x:0,y:0,width:400,height:300}]});
  const moved=moveToward(mud,{x:100,y:150},{x:200,y:150},10);close(moved.x,105);
  const knockback=moveSwept(mud,{x:100,y:150},{x:110,y:150});close(knockback.x,110);
});

test('movement cost integrates crossing a zone edge rather than skipping slow ground', () => {
  const terrain=board({zones:[{id:'mud',kind:'rough',x:100,y:0,width:100,height:300,moveCost:2}]});
  const moved=moveToward(terrain,{x:95,y:150},{x:115,y:150},15);
  close(moved.x,105);
});

test('navigation cache is deterministic and invalidates when geometry changes', () => {
  const terrain=board(),start={x:50,y:150},goal={x:350,y:150};
  assert.deepEqual(findPath(terrain,start,goal),[goal]);
  terrain.solids.push({...wall,y:0,height:300});
  assert.deepEqual(findPath(terrain,start,goal),[]);
  terrain.solids=[];assert.deepEqual(findPath(terrain,start,goal),[goal]);
  terrain.solids=[wall];const path=findPath(terrain,start,goal);
  assert.deepEqual(findPath(structuredClone(terrain),start,goal),path);
  assert.deepEqual(findPath(terrain,start,goal,{maxNodes:1}),[]);
});

test('legacy terrain with no solids or zones retains direct open-ground movement', () => {
  const terrain={width:960,height:540,coverNodes:[]};
  assert.equal(lineOfSight(terrain,{x:100,y:150},{x:800,y:150}),true);
  assert.deepEqual(findPath(terrain,{x:100,y:150},{x:800,y:150}),[{x:800,y:150}]);
  close(moveToward(terrain,{x:100,y:150},{x:800,y:150},10).x,110);
});

test('near-parallel wall sliding cannot accumulate sub-pixel penetration', () => {
  const terrain=board({width:960,height:540,solids:[{id:'edge',kind:'wall',x:462,y:135,width:36,height:75.6}]});
  let p={x:472.09379736428724,y:219.59999990281443};
  for(let i=0;i<200;i++){p=moveSwept(terrain,p,{x:p.x+.716666,y:p.y-4.4e-8});assert.ok(canOccupy(terrain,p));}
});

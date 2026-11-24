import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';
import {MOBA_BATTLEFIELD as field,mobaClearPath,mobaNavPoint,mobaWalk} from '../dist/arcade-moba-map.js';

const dt=1/60;
test('authored lane bends, towers and connections agree with collision data',()=>{
  assert.equal(field.lanes.length,3);assert.equal(field.crossings.length,3);
  for(const road of [...field.lanes,...field.crossings]){
    assert.ok(new Set(road.points.map(p=>p.y)).size>=3);
    for(let i=1;i<road.points.length;i++)assert.ok(mobaClearPath(road.points[i-1],road.points[i],15),String(road.id));
  }
  const game=createMoba(5), nodes=game.towers.map(({x,y})=>({x,y}));
  for(const lane of field.lanes)for(const team of [0,1] as const)assert.deepEqual(nodes[team*3+lane.id],lane.towerNodes[team]);
  assert.ok(mobaClearPath({x:field.forum.center.x,y:field.forum.center.y-50},{x:field.forum.center.x,y:field.forum.center.y+50},15));
});
test('terrain stops walking and dashing, blocks combat sight, but AI navigation can route around it',()=>{
  const a={x:428,y:270}, b={x:579,y:270};
  assert.equal(mobaClearPath(a,b,15),false);
  const waypoint=mobaNavPoint(a,b,15);
  assert.notDeepEqual(waypoint,a);assert.notDeepEqual(waypoint,b);
  assert.equal(mobaClearPath(a,waypoint,15),true);
  assert.ok(mobaWalk(a,13,15,15).x<437);
  const game=createMoba(5,1,'ataru'), player=game.player, enemy=game.heroes[7];
  Object.assign(player,a);Object.assign(enemy,b);
  stepMoba(game,dt,{lunge:true,aimX:b.x,aimY:b.y});
  for(let i=0;i<18;i++)stepMoba(game,dt,{moveX:1});
  assert.ok(player.x<437, String(player.x));
  assert.equal(game.events.some(e=>e.actorId===player.id&&e.type==='hit'),false);
});
test('a full seeded match has real tower loss and core completion; every actor remains outside walls',()=>{
  const s=createMoba(1);
  for(let i=0;i<7200&&s.phase==='playing';i++){
    stepMoba(s,1/30);
    if(i%8===0)for(const entity of [...s.heroes,...s.minions])assert.ok(mobaClearPath(entity,entity,entity.radius),entity.id+' @ '+s.time+', '+entity.x+','+entity.y);
  }
  assert.ok(s.towers.some(t=>!t.alive));
  assert.equal(s.endReason,'core');
  assert.equal(s.cores.some(c=>c.hp===0),true);
});

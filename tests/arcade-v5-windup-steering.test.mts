import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARENA_MOTION_FLOW} from '../dist/arcade-motion-flow.js';

const DT=1/120;
function fixture(steer:boolean,x:number,y:number){
  const game=createArcade({mode:'duel',seed:956,terrain:'open',form:'shii_cho',
    startingRanks:['A','A'],weaponFlow:true,motionFlow:{...ARENA_MOTION_FLOW,windupSteering:steer?.22:0}});
  const [player,enemy]=game.fighters;
  Object.assign(player,{x:425,y:320,face:0});
  Object.assign(enemy,{x:500,y:320,face:Math.PI,action:'stagger',actionDuration:10,think:10});
  stepArcade(game,DT,{strike:true,aimX:enemy.x,aimY:enemy.y});
  const spec=player.attackSpec!;
  while(!player.contact&&game.phase==='playing')stepArcade(game,DT,{x,y,aimX:enemy.x,aimY:enemy.y});
  return {x:player.x,y:player.y,energy:player.energy,face:player.face,time:game.time,spec,
    first:game.events.find(e=>e.kind==='hit'&&e.fighterId===player.id)};
}
test('a grounded manual windup can take a small lateral step in either direction while timing, face and cost stay fixed',()=>{
  const old=fixture(false,0,1), neutral=fixture(true,0,0);
  assert.deepEqual(neutral,old);
  const up=fixture(true,0,-1),down=fixture(true,0,1),forward=fixture(true,1,0);
  assert.deepEqual(forward,old);
  assert.ok(up.y<old.y-2&&up.y>old.y-12);
  assert.ok(down.y>old.y+2&&down.y<old.y+12);
  for(const next of [up,down]){
    assert.equal(next.x,old.x);
    assert.equal(next.face,old.face);
    assert.equal(next.energy,old.energy);
    assert.equal(next.time,old.time);
    assert.deepEqual(next.spec,old.spec);
    assert.ok(next.first&&old.first);
    assert.equal(next.first.time,old.first.time);
  }
});

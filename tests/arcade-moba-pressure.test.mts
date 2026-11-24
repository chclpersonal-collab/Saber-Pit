import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba,mobaPressure} from '../dist/arcade-moba.js';

function setup(){
  const s=createMoba(1,1), p=s.player;
  while(s.wave<1)stepMoba(s,1/60);
  const enemyMinion=s.minions.find(m=>m.id==='wave-1-1-1-0')!;
  const allyMinion=s.minions.find(m=>m.id==='wave-1-0-1-0')!;
  const enemyHero=s.heroes.find(h=>h.team===1&&h.lane===1)!;
  Object.assign(enemyMinion,{x:420,y:360,cooldown:0});
  Object.assign(allyMinion,{x:438,y:360,cooldown:3});
  Object.assign(enemyHero,{x:455,y:360,cooldown:3,lungeCooldown:3});
  Object.assign(p,{x:401,y:360,cooldown:0});
  return {s,p,enemyHero,enemyMinion,allyMinion};
}
test('the warning tracks the actual tower and whether it already prefers allied minions',()=>{
  const {s,p,allyMinion}=setup();
  const t=s.towers.find(x=>x.team===1&&x.lane===1)!;
  Object.assign(p,{x:t.x-87,y:t.y});
  let cue=mobaPressure(s);
  assert.equal(cue.structureId,t.id);assert.equal(cue.underFire,true);assert.equal(cue.waveBehind,true);
  Object.assign(allyMinion,{x:t.x-45,y:t.y});
  cue=mobaPressure(s);
  assert.equal(cue.underFire,false);assert.equal(cue.waveAhead,true);
  stepMoba(s,1/60);
  assert.ok(allyMinion.hp<allyMinion.maxHp);
  assert.equal(p.hp,p.maxHp);
});

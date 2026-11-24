import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';
const dt=1/60;
function setup(seed=1){
  const s=createMoba(seed,1,'shii_cho'),p=s.player,e=s.heroes[7];
  s.nextWaveAt=99;
  for(const h of s.heroes)if(h!==p&&h!==e){h.alive=false;h.hp=0;h.respawnAt=99;}
  for(const st of [...s.towers,...s.cores])st.cooldown=99;
  Object.assign(p,{x:610,y:360,face:Math.PI});
  Object.assign(e,{x:653,y:360,cooldown:10});
  return {s,p,e};
}
test('fresh no-aim keyboard/touch guard acquires a nearby rival once, then actually defends the held side',()=>{
  for(const source of ['keyboard-backstep','touch-idle']){
    const {s,p,e}=setup(1);
    stepMoba(s,dt,{guard:true,moveX:source==='keyboard-backstep'?-.35:0});
    assert.equal(p.face,0);
    Object.assign(e,{x:p.x-43,y:p.y,cooldown:0});
    const before=p.hp;
    stepMoba(s,dt,{guard:true,moveX:-.35});
    assert.equal(p.face,0,'does not auto-pivot to crossup');
    assert.equal(before-p.hp,23,'rear full damage');
    stepMoba(s,dt);
    stepMoba(s,dt,{guard:true});
    assert.ok(Math.abs(Math.abs(p.face)-Math.PI)<.05,'new edge may turn to the rival that crossed');
  }
});
test('explicit aim, walls, distance and sentries never supply fake guard targeting',()=>{
  {
    const {s,p}=setup();
    stepMoba(s,dt,{guard:true,aimX:p.x,aimY:p.y+100});
    assert.equal(p.face,Math.PI/2);
  }
  for(const [x,y,toX,toY] of [[610,360,700,360],[430,270,506,270],[830,360,725,360]]){
    const {s,p,e}=setup();
    Object.assign(p,{x,y,face:1.57});
    Object.assign(e,{x:toX,y:toY});
    stepMoba(s,dt,{guard:true});
    assert.equal(p.face,1.57);
  }
});
test('guard release plus aimed Slash is legal without a forced counter or stagger',()=>{
  const {s,p,e}=setup();
  stepMoba(s,dt,{guard:true});
  assert.equal(p.action,'guard');
  const before=e.hp;
  stepMoba(s,dt,{attack:true,aimX:e.x,aimY:e.y});
  assert.equal(p.action,'slash');
  assert.ok(e.hp<before);
});

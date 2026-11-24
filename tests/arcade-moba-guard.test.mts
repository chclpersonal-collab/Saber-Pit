import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';
const dt=1/60;
function duel(){
  const s=createMoba(1,1,'shii_cho'),p=s.player,e=s.heroes[7];
  s.nextWaveAt=99;
  for(const h of s.heroes)if(h!==p&&h!==e){h.alive=false;h.hp=0;h.respawnAt=99;}
  for(const st of [...s.towers,...s.cores])st.cooldown=99;
  Object.assign(p,{x:610,y:360});
  Object.assign(e,{x:653,y:360});
  return {s,p,e};
}
test('keyboard retreat with guard keeps front coverage; explicit side and rear aim do not block',()=>{
  for(const [angle,guard,raw] of [[undefined,true,8.51],[0,true,8.51],[Math.PI/2,true,23],[Math.PI,true,23],[0,false,23]] as const){
    const {s,p}=duel(), start=p.x;
    const aim=angle===undefined?{}:{aimX:p.x+Math.cos(angle)*100,aimY:p.y+Math.sin(angle)*100};
    for(let i=0;i<2;i++)stepMoba(s,dt,{guard,moveX:-.36,...aim});
    assert.ok(p.x<start);
    assert.ok(Math.abs((p.maxHp-p.hp)-raw)<.001);
    if(guard&&angle===undefined)assert.equal(p.face,0);
  }
});
test('continuous front guard is still exhausted and a real blade can eventually knock out the defender',()=>{
  const {s,p,e}=duel();
  for(let i=0;i<360&&p.alive;i++)stepMoba(s,dt,{guard:true,aimX:e.x,aimY:e.y});
  assert.equal(p.alive,false);assert.equal(p.deaths,1);assert.ok(p.energy<5);
  const hits=s.events.filter(x=>x.actorId===e.id&&x.targetId===p.id&&x.type==='hit');
  assert.ok(hits[0].value!<10&&hits.some(x=>x.value===23));
});

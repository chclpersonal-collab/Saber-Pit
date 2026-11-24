import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba,type MobaForm,type MobaMinion,type MobaState} from '../dist/arcade-moba.js';

const tick=1/60;
function scenario(form:MobaForm='shii_cho',bellRally=false, {x=570,y=360}={}){
  const g=createMoba(9,1,form,{bellRally});
  Object.assign(g.player,{x,y,face:0,level:2,upgrade:1});
  g.nextWaveAt=100;
  for(const h of g.heroes)if(!h.control)Object.assign(h,{alive:false,respawnAt:100});
  for(const t of g.towers)t.cooldown=100;
  for(const c of g.cores)c.cooldown=100;
  return g;
}
function minion(s:MobaState,id:string,x:number,y:number,team:0|1=1):MobaMinion{
  const unit:MobaMinion={id,x,y,team,lane:1,hp:100,maxHp:100,alive:true,radius:8,kind:'minion',face:0,cooldown:100,ranged:false};
  s.minions.push(unit);return unit;
}
function hits(s:MobaState){
  return s.events.filter(e=>e.type==='hit'&&e.actorId===s.player.id).map(e=>[e.targetId,e.value]);
}
test('the same Shii-Cho Slash input uses its aimed primary and cleaves only two nearest clustered minions',()=>{
  for(const bellRally of [false,true]){
    const s=scenario('shii_cho',bellRally);
    const third=minion(s,'third',609,340);
    const nearest=minion(s,'nearest',618,369);
    const friendly=minion(s,'friend',622,357,0);
    const second=minion(s,'second',611,370);
    const primary=minion(s,'primary',622,360);
    const rear=minion(s,'rear',562,359);
    const outside=minion(s,'out-of-reach',634,360);
    const hero=s.heroes[7];
    Object.assign(hero,{alive:true,hp:100,maxHp:100,x:613,y:376,cooldown:100});
    stepMoba(s,tick,{attack:true,aimX:primary.x,aimY:primary.y});
    assert.deepEqual(hits(s),[['primary',34],['nearest',17],['second',17]]);
    assert.equal(s.events.find(e=>e.type==='attack')?.targetId,primary.id);
    assert.deepEqual([hero.hp,third.hp,friendly.hp,rear.hp,outside.hp],[100,100,100,100,100]);
    assert.ok(s.player.energy>92&&s.player.energy<93);
  }
});
test('Shii-Cho cleave never goes through a wall even if the secondary is in radius and within the swing arc',()=>{
  const s=scenario('shii_cho',false,{x:435,y:312});
  const primary=minion(s,'primary',467,312);
  const screened=minion(s,'behind-west-arch',470,283);
  const outsideCluster=minion(s,'too-far-from-primary',445,260);
  const visible=minion(s,'visible',467,324);
  stepMoba(s,tick,{attack:true,aimX:primary.x,aimY:primary.y});
  assert.deepEqual(hits(s),[['primary',34],['visible',17]]);
  assert.deepEqual([screened.hp,outsideCluster.hp,visible.hp],[100,100,83]);
});
test('other forms, hero/tower primary, and Shii-Cho Lunge remain single target',()=>{
  const strict=scenario('makashi'), main=minion(strict,'primary',622,360);
  minion(strict,'second',615,362);
  stepMoba(strict,tick,{attack:true,aimX:main.x,aimY:main.y});
  assert.deepEqual(hits(strict),[['primary',39]]);
  const duel=scenario(), foe=duel.heroes[7];
  Object.assign(foe,{x:609,y:360,alive:true,hp:100,maxHp:100,cooldown:100});
  minion(duel,'second',611,373);
  stepMoba(duel,tick,{attack:true,aimX:foe.x,aimY:foe.y});
  assert.deepEqual(hits(duel),[[foe.id,34]]);
  const siege=scenario('shii_cho',false,{x:872,y:360}),tower=siege.towers[4];
  minion(siege,'second',905,370);
  stepMoba(siege,tick,{attack:true,aimX:tower.x,aimY:tower.y});
  assert.deepEqual(hits(siege),[[tower.id,34*.55]]);
  const dash=scenario(), target=minion(dash,'primary',620,360);
  minion(dash,'second',623,371);
  stepMoba(dash,tick,{lunge:true,aimX:target.x,aimY:target.y});
  for(let i=0;i<20;i++)stepMoba(dash,tick);
  assert.deepEqual(hits(dash),[['primary',44]]);
});

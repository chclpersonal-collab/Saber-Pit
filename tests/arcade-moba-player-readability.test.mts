import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';
import {paintMobaField} from '../dist/arcade-moba-field.js';
import {frameMobaCamera} from '../dist/arcade-moba-camera.js';

const viewports=[{width:1200,height:650},{width:378,height:507}];
function render(state,own=state.player,fx=false){
  const events=[];
  const c=new Proxy({},{
    set(_ctx,key,value){events.push([key,value]);return true;},
    get(_ctx,key){return (...args)=>events.push([key,...args.map(a=>typeof a==='object'?null:a)]);},
  });
  for(const viewport of viewports){
    const view=frameMobaCamera(state.player,true,viewport);
    paintMobaField(c,{},state,own,new Set(state.heroes),view,fx);
  }
  return events;
}
const masks=events=>events.filter(e=>e[0]==='globalAlpha'&&typeof e[1]==='number'&&e[1]<1);
const markerGold=events=>events.filter(e=>e[0]==='fillStyle'&&e[1]==='#fbe2a2');
const freeze=o=>{
  if(o&&typeof o==='object'&&!Object.isFrozen(o)){
    Object.freeze(o);for(const child of Object.values(o))freeze(child);
  }
  return o;
};
test('deployed hero stays visible behind foreground allied keep and tower; views never mutate battle state',()=>{
  const spawn=createMoba(2,1,'makashi');
  const towerApproach=createMoba(2,1,'makashi');
  for(let i=0;i<89;i++)stepMoba(towerApproach,1/60,{moveX:1,moveY:-.036,aimX:800,aimY:360});
  assert.ok(towerApproach.minions.length>=24);
  for(const fight of [spawn,towerApproach]){
    const before=structuredClone(fight);freeze(fight);
    const logs=render(fight);
    assert.deepEqual(fight,before);
    assert.equal(masks(logs).length,2,'exactly one friendly structure each view');
    assert.equal(markerGold(logs).length,2,'personal chevron appears once per view');
    assert.equal(logs.filter(e=>e[0]==='translate'&&e[1]===fight.player.x&&e[2]===fight.player.y).length,2,
      'sprite is drawn once per view, in normal depth order');
  }
});
test('foreground enemies and unrelated allied structures stay opaque, with no player marking in observation mode',()=>{
  const fight=createMoba(2,1,'makashi');
  const enemy=fight.cores[1], away=fight.towers[1];
  const watcher={...fight,heroes:[...fight.heroes]};
  Object.assign(fight.player,{x:enemy.x-3,y:enemy.y-3});
  assert.equal(masks(render(fight)).length,0);
  Object.assign(fight.player,{x:away.x,y:away.y+8});
  assert.equal(masks(render(fight)).length,0,'local is in front of allied tower');
  const observer=render({...watcher,player:fight.player},null);
  assert.equal(masks(observer).length,0);
  assert.equal(markerGold(observer).length,0);
});
test('shield cohort and bow cohort have distinct larger sculpted silhouettes without HD effects',()=>{
  const fight=createMoba(4,1);
  const piece={team:0,id:'wave',hp:5,maxHp:5,alive:true,face:0,x:435,y:335};
  const renderMinion=ranged=>render({...fight,minions:[{...piece,ranged}],heroes:[],towers:[],cores:[]},null)
    .filter(e=>['moveTo','lineTo'].includes(e[0]));
  const shield=renderMinion(false), bow=renderMinion(true);
  assert.notDeepEqual(shield,bow);
  assert.ok(shield.some(e=>e[2]===-17)&&bow.some(e=>e[2]===-17));
  assert.ok(shield.some(e=>e[1]===10&&e[2]===-9));
  assert.ok(bow.some(e=>e[1]===10&&e[2]===-10));
});

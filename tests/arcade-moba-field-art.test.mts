import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';
import {paintMobaTerrain,paintMobaField} from '../dist/arcade-moba-field.js';
import {MOBA_BATTLEFIELD,mobaWalk} from '../dist/arcade-moba-map.js';

function recorder(){
  const events=[];
  const c=new Proxy({},{
    set(_ctx,key,value){events.push([key,value]);return true;},
    get(_ctx,key){
      if(key==='createLinearGradient')return ()=>({addColorStop:()=>{}});
      return (...args)=>events.push([key,...args.map(x=>typeof x==='object'?null:x)]);
    },
  });
  return {c,events};
}
function scene(game,fx=true,zoom=1,background={}){
  const {c,events}=recorder();
  paintMobaField(c,background,game,game.player,new Set(game.heroes),{x:32,y:95,zoom},fx);
  return events;
}
function freeze(o){
  if(o&&typeof o==='object'&&!Object.isFrozen(o)){
    Object.freeze(o);
    for(const v of Object.values(o))freeze(v);
  }
  return o;
}

test('three authored landforms render with unchanged lane and actor coordinates in both cameras',()=>{
  const {c,events:terrainEvents}=recorder();
  const saved=globalThis.document;
  try{
    globalThis.document={createElement:()=>({getContext:()=>c})};
    const bg=paintMobaTerrain();
    assert.equal(bg.width,1280);assert.equal(bg.height,720);
    assert.equal(terrainEvents.filter(e=>e[0]==='clip').length,6);
    assert.equal(terrainEvents.filter(e=>e[0]==='fillText').length,0);
    const replayPath=w=>[['moveTo',w.points[0].x,w.points[0].y],...w.points.slice(1).map(p=>['lineTo',p.x,p.y])];
    for(const w of MOBA_BATTLEFIELD.blockers){
      const i=terrainEvents.findIndex(e=>JSON.stringify(e)===JSON.stringify(replayPath(w)[0]));
      assert.ok(i>=0,w.id);
      const seal=terrainEvents.slice(i,i+4);
      assert.deepEqual(seal,replayPath(w));
      const from={x:w.x-19,y:(w.y+w.y2)/2};
      assert.deepEqual(mobaWalk(from,29,0,15),from,'painted blocker and physical stop align');
    }
    const actual=createMoba(21,1,'soresu');
    for(let i=0;i<260;i++)stepMoba(actual,1/60,{moveX:i<150?1:0,attack:i%45===0,aimX:925,aimY:360});
    const before=structuredClone(actual);
    freeze(actual);
    const overview=scene(actual,true,1,bg), follow=scene(actual,true,2.1,bg);
    assert.deepEqual(actual,before);
    assert.deepEqual(overview.find(e=>e[0]==='scale'),['scale',1,1]);
    assert.deepEqual(follow.find(e=>e[0]==='scale'),['scale',2.1,2.1]);
    const points=overview.filter(e=>e[0]==='translate');
    for(const lane of MOBA_BATTLEFIELD.lanes){
      const mark=lane.points[2];
      assert.ok(overview.some(e=>e[0]==='lineTo'&&e[1]===mark.x/1280*170&&e[2]===mark.y/720*66),
        'tactical minimap depicts exact bent lane waypoint');
    }
    for(const u of [...actual.towers,...actual.cores,...actual.heroes.filter(h=>h.alive)])
      assert.ok(points.some(e=>e[1]===u.x&&e[2]===u.y),u.id);
  }finally {globalThis.document=saved;}
});

test('the field shows distinct heroes, tower/core forms and melee/ranged troops while preserving reduced motion',()=>{
  const actual=createMoba(33,1,'soresu');
  const stationary={...actual,heroes:[actual.player],towers:[],cores:[],minions:[]};
  const signatures=(form,action,time=.08)=>{
    const actor={...actual.player,form,action,actionTime:time};
    return scene({...stationary,heroes:[actor],player:actor},false);
  };
  assert.notDeepEqual(signatures('soresu','guard'),signatures('ataru','guard'));
  assert.notDeepEqual(signatures('soresu','guard'),signatures('soresu','rush'));
  assert.deepEqual(signatures('soresu','slash',.06),signatures('soresu','slash',.21));
  const tape=(props)=>scene({...stationary,heroes:[],...props},false);
  const tower={...actual.towers[0],x:300,y:250}, core={...actual.cores[0],x:300,y:250,shielded:false};
  assert.notDeepEqual(tape({towers:[tower]}),tape({cores:[core]}));
  const troop={team:0,id:'troop',alive:true,hp:15,maxHp:15,x:300,y:250,face:0};
  assert.notDeepEqual(tape({minions:[{...troop,ranged:true}]}),tape({minions:[{...troop,ranged:false}]}));
});

test('motion phase derives from achieved movement instead of elapsed time from unrelated actors',()=>{
  const match=createMoba(6,0);
  const sceneAt=(player,time,extraEffects=true)=>scene({...match,heroes:[player],towers:[],cores:[],minions:[],time,player},extraEffects);
  const actor={...match.player,action:'run',vx:90};
  sceneAt(actor,1);
  const standing=sceneAt(actor,1.02), noMove=sceneAt(actor,1.04);
  assert.deepEqual(standing,noMove);
  actor.x+=10;
  const moved=sceneAt(actor,1.057);
  assert.notDeepEqual(moved.filter(e=>e[0]==='lineTo'),standing.filter(e=>e[0]==='lineTo'));
  const paused=sceneAt(actor,1.057);
  assert.deepEqual(moved,paused);
});

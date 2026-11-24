import test from 'node:test';
import assert from 'node:assert/strict';
import {paintMobaField} from '../dist/arcade-moba-field.js';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';

function drawOne(actor,time,effects=true,moving=false){
  const actorTape=[],tape=[];let pass=false,phase:unknown[]=[];
  const c=new Proxy({},{
    set(_,key,value){tape.push([key,value]);if(pass&&key==='fillStyle'&&['#ac9176','#776351'].includes(value))actorTape.push(phase);return true;},
    get(_,key){return (...args)=>{
      tape.push([key,...args.map(v=>typeof v==='object'?null:v)]);
      if(key==='translate'&&args[0]===actor.x&&args[1]===actor.y)pass=true;
      if(key==='beginPath')phase=[];
      if(key==='moveTo'||key==='lineTo')phase.push([...args]);
    }}
  });
  paintMobaField(c,{}, {heroes:[actor],towers:[],cores:[],minions:[],events:[],time},actor,moving?new Set([actor]):new Set(),undefined,effects);
  return {tape,boots:actorTape.map(p=>p[0]),arc:tape.some(e=>e[0]==='fillStyle'&&e[1]==='#75e5d564')};
}
const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('actual movement keeps at least one shaped heel stationary instead of skating every simulation tick',()=>{
  const state=createMoba(317,1,'shii_cho'), f=state.player;
  // Shape y and depth remain invariant for a straight run; facing is kept
  // toward the route. Observe only a single sprite through the real painter.
  let prev,holds=0,swings=0;
  for(let i=0;i<60;i++){
    stepMoba(state,1/60,{moveX:1,aimX:550,aimY:348});
    const {boots}=drawOne(f,state.time,true,true);
    const anchors=boots.map(([x,y])=>[x+f.x,y+f.y]);
    if(prev){
      const changes=anchors.map((a,j)=>len(a,prev[j]));
      if(changes.some(d=>d<1e-7))holds++;
      if(changes.some(d=>d>.4))swings++;
    }
    prev=anchors;
  }
  assert.ok(holds>45&&swings>17,JSON.stringify({holds,swings}));
});
test('a short visible crescent belongs only to the already committed saber action',()=>{
  const f=createMoba(317,1,'shii_cho').player;
  Object.assign(f,{action:'slash',actionTime:.05});
  const active=drawOne(f,1);
  assert.equal(active.arc,true);
  assert.equal(drawOne(f,1,false).arc,false);
  Object.assign(f,{actionTime:.18});
  assert.equal(drawOne(f,1.18).arc,false);
  Object.assign(f,{action:'guard',actionTime:.05});
  const guard=drawOne(f,2);
  assert.equal(guard.arc,false);
  assert.notDeepEqual(active.tape,guard.tape);
});
test('optional Bell art is absent from default live canvas and present on opt-in',()=>{
  const colorsFor=(enabled)=>{
    const g=createMoba(317,1,'shii_cho',{bellRally:enabled}), colors=[];
    const c=new Proxy({},{
      set(_,key,value){if(key==='fillStyle')colors.push(value);return true;},
      get(){return ()=>{};}
    });
    paintMobaField(c,{},g,g.player);
    return colors;
  };
  assert.equal(colorsFor(false).includes('#a99464'),false);
  assert.equal(colorsFor(true).includes('#a99464'),true);
});

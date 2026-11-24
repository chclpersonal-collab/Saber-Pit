import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoba } from '../dist/arcade-moba.js';
import { MOBA_BATTLEFIELD } from '../dist/arcade-moba-map.js';
import { paintMobaField, paintMobaTerrain } from '../dist/arcade-moba-field.js';
const makeCtx=()=>{
  let lighting=0, polyCount=0;
  const draw=[], c=new Proxy({},{
    set(){return true;},
    get(_,k){
      if(k==='createRadialGradient')return ()=>{lighting++;return {addColorStop(){}};};
      if(k==='createLinearGradient')return ()=>({addColorStop(){}});
      if(k==='drawImage')return (...args)=>draw.push(args);
      if(k==='lineTo')return ()=>polyCount++;
      return ()=>{};
    },
  });
  return {c,draw,get lighting(){return lighting;},get polyCount(){return polyCount;}};
};
test('foundry statics and depth roofs are rasterized once; frame drawing reuses exact world anchors',()=>{
  const previous=globalThis.document, layers=[];
  try{
    globalThis.document={createElement:()=>{
      const render=makeCtx(), canvas={getContext:()=>render.c};
      layers.push({canvas,render});return canvas;
    }};
    const terrain=paintMobaTerrain(), field=makeCtx(), state=createMoba(317);
    const stateBefore=structuredClone(state);
    assert.equal(layers.length,5);
    assert.equal(layers[0].render.lighting,9);
    const detail=layers.map(x=>x.render.polyCount);
    const frame={x:250,y:90,zoom:2.2,width:520,height:720};
    for(let i=0;i<4;i++)paintMobaField(field.c,terrain,state,state.player,new Set(),frame,false);
    assert.deepEqual(state,stateBefore);
    assert.deepEqual(layers.map(x=>x.render.polyCount),detail);
    assert.equal(layers.length,5);
    for(let i=0;i<4;i++){
      const frameCalls=field.draw.slice(i*5,i*5+5);
      assert.equal(frameCalls[0][0],terrain);
      for(const [j,w] of MOBA_BATTLEFIELD.blockers.entries())
        assert.ok(frameCalls.some(args=>args[0]===layers[j+1].canvas&&args[1]===w.x-4&&args[2]===w.y-34));
    }
    const external=makeCtx();
    paintMobaField(external.c,{},state,state.player,new Set(),frame,false);
    assert.equal(external.draw.length,1);
    assert.ok(external.polyCount>field.polyCount/4,'external floor falls back to drawing the same roofs');
  }finally{globalThis.document=previous;}
});

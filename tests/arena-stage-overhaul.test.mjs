import assert from 'node:assert/strict';
import test from 'node:test';
import { arenaPalette, drawArenaCurrent, drawArenaStage } from '../dist/arena-stage.js';

function recordedContext(){
  let saved=0;
  const ops=[];
  const ctx=new Proxy({}, {
    get(_,key){ return (...args)=>{
      ops.push([key,...args]);
      if(key==='save') saved++;
      if(key==='restore') saved--;
      for (const arg of args) if(typeof arg==='number') assert.ok(Number.isFinite(arg));
      if(key==='createRadialGradient'||key==='createLinearGradient') return {
        addColorStop: (...stop)=>ops.push(['stop',...stop])
      };
    }; },
    set(_,key,value){ ops.push([key,value]); return true; },
  });
  return {ctx,ops,saved:()=>saved};
}
const setup={width:1280,height:720,bounds:{minX:40,maxX:1240,minY:50,maxY:670}};

test('each map gets its own bounded arena dressing without canvas-state leaks',()=>{
  const palettes=['crossroads','zigzag','craterfield'].map(id=>arenaPalette(id).outer);
  assert.equal(new Set(palettes).size,3);
  assert.equal(arenaPalette('toString'),arenaPalette('crossroads'));
  for(const mapId of ['crossroads','zigzag','craterfield']){
    const rec=recordedContext();
    drawArenaStage(rec.ctx,{...setup,mapId});
    assert.equal(rec.saved(),0);
    assert.ok(rec.ops.some(entry=>entry[0]==='rect'&&entry.slice(1).join(',')==='40,50,1200,620'));
    assert.ok(rec.ops.some(entry=>entry[0]==='fillStyle'&&entry[1]===arenaPalette(mapId).outer));
    assert.ok(rec.ops.length<420,'ground dressing remains cheap even when rebuilt');
  }
});
test('live layer is deterministic, animated, bounded, and disabled by accessibility settings',()=>{
  const sample = (time, settings={})=>{
    const rec=recordedContext();
    drawArenaCurrent(rec.ctx,{...setup,mapId:'zigzag',time,...settings});
    assert.equal(rec.saved(),0);
    return rec.ops;
  };
  assert.deepEqual(sample(2),sample(2));
  assert.notDeepEqual(sample(2),sample(2.2));
  assert.equal(sample(2).filter(e=>e[0]==='fillRect').length,12);
  assert.equal(sample(2,{reducedMotion:true}).length,0);
  assert.equal(sample(2,{fullEffects:false}).length,0);
  assert.equal(sample(NaN).length,0);
});

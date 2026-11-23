import test from 'node:test';
import assert from 'node:assert/strict';
import {drawArcadeFighter,drawArcadeFighterPreview,sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';

function paper(){
  const trace=[], p={globalAlpha:1,canvas:{width:240,height:240}},ctx=new Proxy(p,{
    get(host,prop){return prop in host?host[prop]:(...args)=>trace.push([prop,...args,host.fillStyle??null,host.strokeStyle??null]);},
  });
  return {ctx,trace};
}
test('seed and gender style the same combat body, never changing blade or motion geometry',()=>{
  const baseline={x:430,y:360,face:.2,form:'makashi',body:'woman',action:'guard',actionTime:.3,actionDuration:.5};
  const a={...baseline,gender:'female',appearanceSeed:0};
  const b={...baseline,gender:'female',appearanceSeed:2};
  const c={...baseline,gender:'nonbinary',appearanceSeed:12};
  const shape=arcadeBladeWorld(baseline,sampleArcadeFighter(baseline));
  const frames=[a,b,c,a].map(f=>{
    const {ctx,trace}=paper(), rig=drawArcadeFighter(ctx,f,0);
    assert.deepEqual(arcadeBladeWorld(f,rig),shape);
    return JSON.stringify(trace);
  });
  assert.equal(frames[0],frames[3]);assert.equal(new Set(frames).size,3);
});
test('lobby preview renders the provided body and form with the same blade painter',()=>{
  const {ctx,trace}=paper();
  const rig=drawArcadeFighterPreview(ctx,{body:'rabbit',form:'soresu',gear:{weapon:'staff'}});
  assert.equal(rig.type.id,'rabbit');assert.equal(rig.form,'soresu');
  assert.ok(trace.some(op=>op[0]==='scale'));assert.ok(rig.offEmitter);
});

test('real Trakata extinguishes every emitter but leaves hilts and canonical geometry fixed',()=>{
  for(const weapon of ['single','dual','staff']){
    const f={x:430,y:360,face:.2,form:'makashi',body:'woman',action:'feint',
      actionTime:.25,actionDuration:.56,gear:{weapon}};
    const visible=paper(), disabled=paper(), ignited=paper();
    const once=drawArcadeFighter(visible.ctx,f,1);
    const off=drawArcadeFighter(disabled.ctx,{...f,saberOff:true},1);
    const hot=drawArcadeFighter(ignited.ctx,{...f,saberOff:false,trakataIgnitedAt:.98},1);
    assert.deepEqual(arcadeBladeWorld(f,once),arcadeBladeWorld(f,off));
    assert.deepEqual(arcadeBladeWorld(f,once),arcadeBladeWorld(f,hot));
    const strokes=(a,color)=>a.trace.filter(op=>op[0]==='stroke'&&op.at(-1)===color).length;
    assert.equal(strokes(visible,'#ebffff'),weapon==='single'?1:2);
    assert.equal(strokes(disabled,'#ebffff'),0);
    assert.ok(strokes(disabled,'#74747a')>0);
    assert.equal(strokes(ignited,'#ebffff'),strokes(visible,'#ebffff'));
    assert.ok(ignited.trace.some(op=>op[0]==='fill'&&op.at(-2)==='#f5ffff'));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeTouchVector,arcadeTouchThumb,createArcadeTouchOwner} from '../dist/arcade-touch.js';

const near=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);
test('small drift and exact radial dead-zone edge are neutral while the thumb follows',()=>{
  for (const [x,y] of [[0,0],[8,-2],[9,12],[-15,0]]) {
    assert.deepEqual(arcadeTouchVector(x,y,100),{x:0,y:0});
    near(arcadeTouchThumb(x,y,100).x,x);near(arcadeTouchThumb(x,y,100).y,y);
  }
  const after=arcadeTouchVector(16,0,100);
  near(after.x,.01/.85); near(after.y,0);
});

test('diagonal response remains normalized without changing direction or clamped thumb radius',()=>{
  const diag=arcadeTouchVector(60,-80,50);
  near(diag.x,.6);near(diag.y,-.8);near(Math.hypot(diag.x,diag.y),1);
  const thumb=arcadeTouchThumb(60,-80,50);near(thumb.x,30);near(thumb.y,-40);
  const partial=arcadeTouchVector(30,40,100);
  near(Math.hypot(partial.x,partial.y),.35/.85);
  near(partial.x/partial.y,.75);
});

test('nonfinite point, invalid radius and pathological finite coordinates fail safely',()=>{
  for(const args of [[Infinity,0,100],[0,NaN,100],[4,4,0],[1,1,-1],[1,1,Infinity]]) {
    assert.deepEqual(arcadeTouchVector(...args),{x:0,y:0});
    assert.deepEqual(arcadeTouchThumb(...args),{x:0,y:0});
  }
  const extreme=arcadeTouchVector(Number.MAX_VALUE,Number.MAX_VALUE,20);
  near(extreme.x,Math.SQRT1_2);near(extreme.y,Math.SQRT1_2);
  near(arcadeTouchVector(20,0,100,NaN).x,.05/.85);
});

test('secondary touch cannot steal the stick; confirmed cancellation releases and neutralizes',()=>{
  const owner=createArcadeTouchOwner();
  assert.equal(owner.begin(NaN,40,50,100),false);
  assert.equal(owner.begin(0,40,50,100),true);
  assert.equal(owner.begin(7,300,400,100),false);
  assert.equal(owner.move(7,300,400),false);
  assert.equal(owner.end(7),false);
  assert.equal(owner.move(0,70,90),true);
  assert.equal(owner.snapshot().pointerId,0);near(owner.snapshot().thumbX,30);
  assert.equal(owner.cancel(),true);
  assert.deepEqual(owner.snapshot(),{pointerId:null,x:0,y:0,thumbX:0,thumbY:0});
  assert.equal(owner.move(0,300,400),false);
  assert.equal(owner.begin(7,300,400,100),true);
  assert.equal(owner.end(7),true);
});

test('tap aim picks an airborne opponent by its silhouette; repeat tap unlocks',async()=>{
  const {arcadeTapAim}=await import('../dist/arcade-touch.js');
  const fighters=[
    {id:'ally',alive:true,team:0,x:407,y:48},
    {id:'fallen',alive:false,team:1,x:413,y:51},
    {id:'rabbit',alive:true,team:1,x:416,y:134,airHeight:45}
  ];
  const sample={point:{x:415,y:54},fighters,team:0,width:960,height:540,time:4};
  assert.deepEqual(arcadeTapAim(sample),{id:'rabbit'});
  assert.equal(arcadeTapAim({...sample,current:{id:'rabbit'}}),null);
});

test('tapping the playfield sets temporary point aim, letterbox taps preserve the aim',async()=>{
  const {arcadeTapAim}=await import('../dist/arcade-touch.js');
  const data={fighters:[],team:0,width:960,height:540,time:4};
  assert.deepEqual(arcadeTapAim({...data,point:{x:300,y:100}}),{x:300,y:100,until:6.6});
  assert.deepEqual(arcadeTapAim({...data,point:{x:301,y:-4},current:{id:'rabbit'}}),{id:'rabbit'});
});

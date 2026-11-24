import test from 'node:test';
import assert from 'node:assert/strict';
import {actionFrame,stepActionFrame,screenToArena,portraitActionFrame,composeArcadeFrame} from '../dist/arcade-camera.js';

const f=(x,y,airHeight=0)=>({x,y,airHeight});
const W=1280,H=720,world={width:W,height:H};
const wide={x:640,y:360,zoom:1};

test('nearby duels close in, airborne or wide fights leave extra room',()=>{
  const frame=(...fighters)=>actionFrame({...world,fighters});
  assert.equal(frame(f(575,370),f(650,390)).zoom,1.66);
  assert.ok(frame(f(575,370),f(650,390,210)).zoom<1.66);
  assert.equal(frame(f(80,75),f(1200,630)).zoom,1);
});

test('wide option, spectators with many fighters, and end states keep the full frame',()=>{
  for(const n of [0,1,7,30])assert.deepEqual(actionFrame({...world,fighters:Array(n).fill(f(600,360))}),wide);
  assert.deepEqual(actionFrame({...world,enabled:false,fighters:[f(600,350),f(640,355)]}),wide);
  assert.ok(actionFrame({...world,fighters:[f(600,350),f(640,355),f(570,320)]}).zoom<=1.42);
});

test('framing is bounded to the arena and reduced motion can snap to wide',()=>{
  const target={x:-25,y:850,zoom:1.66};
  let view=wide;
  for(const dt of [0,1/144,1/60,.25,1]){
    view=stepActionFrame(view,target,W,H,dt);
    assert.ok(view.x>=W/(2*view.zoom)&&view.x<=W-W/(2*view.zoom));
    assert.ok(view.y>=H/(2*view.zoom)&&view.y<=H-H/(2*view.zoom));
  }
  assert.deepEqual(stepActionFrame(view,wide,W,H,0,true),wide);
});

test('pointer maps through unequal canvas factors and camera zoom',()=>{
  const box={left:60,top:30,width:400,height:220},t={scale:2.5,x:-130,y:42};
  assert.deepEqual(screenToArena(180,140,box,1200,660,t),{x:196,y:115.2});
});

test('side-profile projection keeps screen aim aligned with the entire scene',async()=>{
  const {composeArcadeFrame}=await import('../dist/arcade-camera.js');
  const box={left:12,top:25,width:840,height:460};
  const world={x:610,y:372};
  const projection=composeArcadeFrame(1680,920,1280,720,{x:640,y:360,zoom:1.4},{profile:true});
  assert.ok(projection.scaleY<projection.scale);
  const px=box.left+(projection.x+world.x*projection.scale)/2;
  const py=box.top+(projection.y+world.y*projection.scaleY)/2;
  const point=screenToArena(px,py,box,1680,920,projection);
  assert.ok(Math.abs(world.x-point.x)<1e-8&&Math.abs(world.y-point.y)<1e-8);
  const wide=composeArcadeFrame(1680,920,1280,720,{x:640,y:360,zoom:1});
  assert.equal(wide.scale,wide.scaleY);
});


test('portrait view fills a taller phone canvas without sacrificing edge framing or accurate aim',()=>{
  const ww=1920,hh=1080,box={left:8,top:120,width:374,height:360};
  for(const anchor of [f(200,180),f(900,460,110),f(1700,900)]){
    const shot=portraitActionFrame(ww,hh,box.width,box.height,anchor,f(anchor.x+70,anchor.y+30));
    const t=composeArcadeFrame(box.width,box.height,ww,hh,shot);
    assert.ok(t.scale>2*box.width/ww);
    assert.ok(t.x<=1e-8&&t.y<=1e-8&&t.x+t.scale*ww>=box.width-1e-8&&t.y+t.scaleY*hh>=box.height-1e-8);
    const px=box.left+t.x+anchor.x*t.scale,py=box.top+t.y+anchor.y*t.scaleY;
    assert.ok(px>=box.left&&px<=box.left+box.width&&py>=box.top&&py<=box.top+box.height);
    const point=screenToArena(px,py,box,box.width,box.height,t);
    assert.ok(Math.hypot(point.x-anchor.x,point.y-anchor.y)<1e-8);
  }
});

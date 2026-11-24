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

test('Causeways large-match focus is opt-in locally and retains the selected living fighter',async()=>{
 const {canFocusCauseways,selectArenaFocus}=await import('../dist/arcade-camera.js');
 assert.equal(canFocusCauseways('three_causeways',30),true);
 assert.equal(canFocusCauseways('three_causeways',6),false);
 assert.equal(canFocusCauseways('high_bastion',30),false);
 const a={...f(510,375),id:'a',team:0,alive:true};
 const b={...f(680,765),id:'b',team:0,alive:true};
 const c={...f(700,790),id:'c',team:1,alive:true};
 const d={...f(680,1000),id:'d',team:1,alive:true};
 assert.deepEqual(selectArenaFocus(2400,1350,[a,b,c,d],{preferred:'b',previous:'a'}),{anchor:b,rival:c});
 assert.equal(selectArenaFocus(2400,1350,[a,{...b,alive:false},c,d],{preferred:'b',previous:'a'}).anchor,a);
 assert.equal(selectArenaFocus(2400,1350,[{...a,control:true},b,c,d],{preferred:'b'}).anchor?.id,'a');
});

test('Causeways desktop and short landscape focus can return to full framing and both project pointer aim exactly',async()=>{
 for(const box of [{left:36,top:101,width:1178,height:663},{left:12,top:63,width:790,height:355}]){
  const anchor=f(650,470,48),rival=f(740,498);
  const wide={x:1200,y:675,zoom:1};
  const target=portraitActionFrame(2400,1350,box.width,box.height,anchor,rival,1.64);
  const close=stepActionFrame(wide,target,2400,1350,0,true);
  assert.ok(close.zoom>=1.64);
  assert.deepEqual(stepActionFrame(close,wide,2400,1350,0,true),wide);
  for(const focus of [wide,close]){
   const t=composeArcadeFrame(box.width*2,box.height*2,2400,1350,focus);
   const px=box.left+(t.x+anchor.x*t.scale)/2,py=box.top+(t.y+anchor.y*t.scaleY)/2;
   const mapped=screenToArena(px,py,box,box.width*2,box.height*2,t);
   assert.ok(Math.hypot(mapped.x-anchor.x,mapped.y-anchor.y)<1e-8);
  }
 }
});

test('portrait duel grows nearby fighters, backs out for separation and includes both fighters and aim',async()=>{
 const {portraitDuelActionFrame}=await import('../dist/arcade-camera.js');
 const box={left:8,top:110,width:374,height:354};
 for(const width of [960,1280,1600,1920,2400]){
  const height=width*9/16,ax=width*.6,ay=height*.66;
  const a=f(ax-51,ay,36),b=f(ax+51,ay-12,9);
  const prior=portraitActionFrame(width,height,box.width,box.height,a,b);
  const current=portraitDuelActionFrame(width,height,box.width,box.height,a,b);
  assert.ok(current.zoom>=prior.zoom*1.15);assert.ok(current.zoom<=2.66);
  const spaced=portraitDuelActionFrame(width,height,box.width,box.height,f(width*.21,ay),f(width*.79,ay));
  const sp=composeArcadeFrame(box.width,box.height,width,height,spaced);
  assert.ok(spaced.zoom<current.zoom);
  assert.ok(sp.x+(width*.21-28)*sp.scale>0);
  assert.ok(sp.x+(width*.79+28)*sp.scale<box.width);
  const t=composeArcadeFrame(box.width,box.height,width,height,current);
  for(const p of [a,b]){
   const px=box.left+t.x+p.x*t.scale,py=box.top+t.y+p.y*t.scaleY;
   const head=py-(82+p.airHeight)*t.scaleY;
   assert.ok(px>=box.left+17&&px<=box.left+box.width-17);
   assert.ok(head>=box.top&&py<box.top+box.height);
   const h=screenToArena(px,py,box,box.width,box.height,t);
   assert.ok(Math.hypot(h.x-p.x,h.y-p.y)<1e-8);
  }
 }
});

test('duel framing moves continuously across rival distance thresholds and does not crop an ordinary leap',async()=>{
 const {portraitDuelActionFrame}=await import('../dist/arcade-camera.js');
 const w=1600,h=900,vw=374,vh=354;
 const solve=(gap:number,air=0)=>portraitDuelActionFrame(w,h,vw,vh,f(800,510,air),f(800+gap,496,58));
 for(const threshold of [202,260,338]){
   const a=solve(threshold-.01),b=solve(threshold+.01);
   assert.ok(Math.abs(a.x-b.x)<.2&&Math.abs(a.y-b.y)<.2&&Math.abs(a.zoom-b.zoom)<.01);
 }
 const view=composeArcadeFrame(vw,vh,w,h,solve(114,147));
 for(const [x,y,z] of [[800,510,147],[914,496,58]]){
   assert.ok(view.x+(x-31)*view.scale>0&&view.x+(x+31)*view.scale<vw);
   assert.ok(view.y+(y-z-92)*view.scaleY>54&&view.y+y*view.scaleY<vh);
 }
});

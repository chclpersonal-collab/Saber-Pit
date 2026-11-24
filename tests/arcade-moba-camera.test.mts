import test from 'node:test';
import assert from 'node:assert/strict';
import {frameMobaCamera,mobaCanvasAim} from '../dist/arcade-moba-camera.js';
import {MOBA_WIDTH,MOBA_HEIGHT} from '../dist/arcade-moba.js';
test('mobile follow makes the painted hero readable and keeps the viewport physically inside the map',()=>{
  for (const width of [300,352,390,500]){
    const box={width,height:230}, fit=Math.min(width/MOBA_WIDTH,230/MOBA_HEIGHT);
    for(const p of [{x:36,y:75},{x:640,y:360},{x:1235,y:660}]){
      const v=frameMobaCamera(p,true,box),css=44*v.zoom*fit;
      assert.ok(css>=32&&css<=38,JSON.stringify({width,css}));
      assert.ok(v.x>=0&&v.y>=0&&v.x+v.width/v.zoom<=MOBA_WIDTH+.00001&&v.y+v.height/v.zoom<=MOBA_HEIGHT+.00001);
      assert.ok(v.x<=p.x&&v.y<=p.y&&v.x+v.width/v.zoom>=p.x&&v.y+v.height/v.zoom>=p.y);
    }
  }
  const portrait=frameMobaCamera({x:640,y:360},true,{width:390,height:500});
  assert.ok(portrait.width/portrait.height<1);
  const fitPortrait=Math.min(390/portrait.width,500/portrait.height);
  assert.ok(44*fitPortrait*portrait.zoom>=32&&44*fitPortrait*portrait.zoom<=38);
  assert.ok(portrait.height*fitPortrait>490);
  const desktop=frameMobaCamera({x:640,y:360},true,{width:1000,height:650});
  assert.ok(desktop.zoom>1);
  assert.deepEqual(frameMobaCamera({x:640,y:360},false,{width:1000,height:650}),{x:0,y:0,zoom:1,width:MOBA_WIDTH,height:MOBA_HEIGHT});
});
test('follow and overview both invert real CSS content coordinates, and reject letterbox taps',()=>{
  const box={left:15,top:100,width:350,height:290};
  const fit=350/MOBA_WIDTH,marginY=(290-MOBA_HEIGHT*fit)/2;
  const aim={x:640,y:360};
  for(const follow of [false,true]){
    const v=frameMobaCamera(aim,follow,box);
    const client={x:box.left+(aim.x-v.x)*v.zoom*fit,y:box.top+marginY+(aim.y-v.y)*v.zoom*fit};
    const actual=mobaCanvasAim(v,box,client);
    assert.ok(actual&&Math.abs(actual.x-640)<.0001&&Math.abs(actual.y-360)<.0001);
    assert.equal(mobaCanvasAim(v,box,{x:25,y:box.top+5}),null);
    assert.equal(mobaCanvasAim(v,{...box,height:0},client),null);
  }
});

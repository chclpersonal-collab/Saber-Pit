import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCADE_MAPS, ARCADE_MAP_SIZES, createArcadeStage, createArcadeTerrain, drawArcadeStage, resolveArcadeMap } from '../dist/arcade-stage.js';
import { createBattlefield } from '../dist/maps.js';
import { canOccupy, lineOfSight, terrainAt } from '../dist/terrain.js';

const ids=['crossroads','zigzag','craterfield'];
test('map catalog restores all three classic maps alongside the open rotating rings',()=>{
  assert.deepEqual(Object.keys(ARCADE_MAPS),['three_causeways','high_bastion',...ids,'underpit','foundry','ember_ring']);
  assert.deepEqual([1,2,3,4].map(round=>resolveArcadeMap('rotation',round)),['underpit','foundry','ember_ring','underpit']);
  const ring=createArcadeTerrain('foundry',1280,720);
  assert.equal(ring.solids.length,0);
  assert(ring.bounds.minY>100);
  assert(ring.bounds.maxY<720);
});

test('shared classic geometry scales exactly from canonical terrain and respects real colliders',()=>{
  for (const id of ids) {
    const source=createBattlefield(1,{terrain:id,mapSize:'medium'});
    for (const {width,height} of Object.values(ARCADE_MAP_SIZES)) {
      const terrain=createArcadeTerrain(id,width,height);
      const sx=width/source.width,sy=height/source.height;
      assert.deepEqual(terrain.solids,source.solids.map(r=>({...r,x:r.x*sx,y:r.y*sy,width:r.width*sx,height:r.height*sy})));
      assert(terrain.playBounds.minX>=0&&terrain.playBounds.maxX<=width);
      const wall=terrain.solids.find(s=>s.kind==='wall');
      const y=wall.y+wall.height/2;
      assert.equal(canOccupy(terrain,{x:wall.x+wall.width/2,y},17),false);
      assert.equal(lineOfSight(terrain,{x:wall.x-30,y},{x:wall.x+wall.width+30,y},'saber'),false);
      const rough=terrain.zones.find(z=>z.kind==='rough');
      assert(terrainAt(terrain,{x:rough.x+2,y:rough.y+2}).moveMultiplier<1);
      if (id==='craterfield') {
        const vents=terrain.zones.filter(z=>z.kind==='hazard');
        assert.equal(vents.length,4);
        for(const v of vents)assert(terrainAt(terrain,{x:v.x+v.width/2,y:v.y+v.height/2}).damagePerSecond>0);
      } else assert.equal(terrain.zones.some(z=>z.kind==='hazard'),false);
    }
  }
});

function drawingContext() {
  const calls=[];
  const ctx=new Proxy({}, {
    get(target,prop) {
      if(Object.hasOwn(target,prop))return target[prop];
      if(String(prop).endsWith('Gradient'))return ()=>({addColorStop(){}});
      return (...args)=>{calls.push({prop,args,fill:target.fillStyle});
        for(const v of args)if(typeof v==='number')assert(Number.isFinite(v),String(prop));
      };
    },
  });
  return {ctx,calls};
}
test('stage uses exact shared rectangles, including static danger warnings in reduced motion',()=>{
  const prior=globalThis.document;
  const base=drawingContext();
  try {
    globalThis.document={createElement:()=>({getContext:()=>base.ctx})};
    const shared=createArcadeTerrain('craterfield',960,540);
    const stage=createArcadeStage(960,540,2,{mapId:'craterfield',terrain:shared,environment:'sandstorm'});
    assert.equal(stage.terrain,shared);
    assert.equal(stage.obstacles.length,shared.solids.length);
    assert.equal(stage.image.width,960);
    assert(stage.obstacles.every((a,i,list)=>!i||list[i-1].y+list[i-1].height<=a.y+a.height));
    for(const v of shared.zones.filter(z=>z.kind==='hazard')){
      assert(base.calls.some(c=>c.prop==='fillRect'&&c.fill==='#441a21'&&
        String(c.args)===String([v.x,v.y,v.width,v.height])));
    }
    const display=drawingContext();
    drawArcadeStage(display.ctx,stage,960,540,2,true);
    assert.deepEqual(display.calls.map(c=>c.prop),['drawImage']);
    drawArcadeStage(display.ctx,stage,960,540,2,false);
    assert(display.calls.some(c=>c.prop==='fillRect'));
    const ring=createArcadeStage(1280,720,3);
    assert.equal(ring.id,'ember_ring');
  } finally {if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

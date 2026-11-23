import assert from 'node:assert/strict';
import test from 'node:test';
import {drawArcadePeasantFighter,drawArcadePeasantFighterPreview} from '../dist/arcade-peasant-art.js';
import {drawArcadeFighter as drawArenaFighter} from '../dist/arcade-painter.js';
import {sampleArcadeFighter,arcadeBladeWorld} from '../dist/arcade-fighters.js';
function paint(){
 const records=[];
 let cursor=[],depth=0,shift=null,angle=null;
 const ctx={canvas:{width:144,height:144},globalAlpha:1,
   save(){depth++;},restore(){depth--;},translate(...v){shift=v;},scale(){},rotate(v){angle=v;},closePath(){},
   beginPath(){cursor=[];},ellipse(...v){cursor.push(['ellipse',...v]);},
   moveTo(...v){cursor.push(['move',...v]);},lineTo(...v){cursor.push(['line',...v]);},
   quadraticCurveTo(){},bezierCurveTo(){},
   stroke(){records.push([this.strokeStyle,this.lineWidth,cursor,{shift,angle}]);},
   fill(){records.push([this.fillStyle,'fill',cursor]);}};
 return {ctx,records,depth:()=>depth};
}
const f={id:'peasant-test',x:240,y:296,face:0,appearanceSeed:24816,alive:true,team:0,
 form:'shii_cho',body:'rabbit',action:'idle',gear:{weapon:'staff',grip:'forward'}};
test('painter keeps the exact shared physical rig and preserves each real staff emitter',()=>{
 const r=sampleArcadeFighter(f,0);
 const old=arcadeBladeWorld(f,r),snap=structuredClone(r),c=paint();
 assert.equal(drawArcadePeasantFighter(c.ctx,f,0,{rig:r}),r);
 assert.equal(c.depth(),0);
 assert.deepEqual(r,snap);
 assert.deepEqual(arcadeBladeWorld(f,r),old);
 const glowing=c.records.filter(([style,width])=>style==='#6ac7bf'&&width===8);
 assert.equal(glowing.length,2);
 const spans=[Math.hypot(r.blade.x-r.emitter.x,r.blade.y-r.emitter.y),
  Math.hypot(r.offBlade.x-r.offEmitter.x,r.offBlade.y-r.offEmitter.y)].sort();
 assert.deepEqual(glowing.map(p=>p[2].at(-1)[1]).sort(),spans);
});
test('blade-off and portrait keep art without illuminating a blade; ghost has no live stroke',()=>{
 for(const options of [{hideSabers:true},{ghost:true}]){
  const c=paint();drawArcadePeasantFighter(c.ctx,f,0,options);
  assert.ok(!c.records.some(([style,width])=>style==='#6ac7bf'&&width===8));
  assert.equal(c.depth(),0);
 }
 const c=paint();drawArcadePeasantFighter(c.ctx,{...f,saberOff:true});
 assert.ok(!c.records.some(([style,width])=>style==='#6ac7bf'&&width===8));
 assert.ok(c.records.some(([style,width])=>style==='#786455'&&width===3.2));
 const p=paint();drawArcadePeasantFighterPreview(p.ctx,f,{framing:'portrait'});
 assert.ok(!p.records.some(([style,width])=>style==='#6ac7bf'&&width===8));
});
test('boot orientation tracks all actual foot-to-toe headings without a facing flip',async()=>{
 const {peasantBootBearing}=await import('../dist/arcade-peasant-art.js');
 for(const a of [0,.2,1.47,Math.PI,-.6,-1.7]){
  const leg={side:1,foot:{x:-2,y:9},toes:{x:-2+10*Math.cos(a),y:9+10*Math.sin(a)}};
  const turn=peasantBootBearing(leg);
  assert.ok(Math.abs(Math.atan2(Math.sin(turn-a),Math.cos(turn-a)))<1e-9);
  assert.equal(peasantBootBearing({...leg,side:0}),turn);
 }
});
test('isolated angular ink eyes follow heading with no facial cross and no rear marks',()=>{
 const player={...f,body:'femboy',appearanceSeed:6};
 const marks=bearing=>{
  const c=paint();drawArcadePeasantFighter(c.ctx,{...player,face:bearing},0,{hideSabers:true});
  assert.ok(!c.records.some(([style])=>style==='#676569'));
  return c.records.filter(([style])=>style==='#282125');
 };
 const right=marks(0), front=marks(Math.PI/2), left=marks(Math.PI);
 assert.equal(right.length,2);
 assert.equal(front.length,2);
 assert.equal(left.length,2);
 assert.ok(right[0][2][0][1]>front[0][2][0][1]+5);
 assert.ok(left[0][2][0][1]<front[0][2][0][1]-5);
 assert.deepEqual(marks(-Math.PI/2),[]);
 assert.ok(Math.abs(marks(1.499)[0][2][0][1]-marks(1.501)[0][2][0][1])<.024);
});
test('new mantle, boot shafts and pale mitts render on the shared rig',()=>{
 const r=sampleArcadeFighter(f,0),c=paint();
 drawArcadePeasantFighter(c.ctx,f,0,{rig:r,hideSabers:true});
 const inked=c.records.filter(([,type])=>type==='fill').map(([colour])=>colour);
 assert.ok(inked.includes('#67564c')&&inked.includes('#4a3e3b'));
 assert.ok(inked.includes('#f1ddd4')&&inked.includes('#d5c5bf'));
 assert.ok(c.records.some(([style,width])=>style==='#211a19'&&width===3.5));
 assert.equal(c.depth(),0);
});

test('live Arena Peasant route draws interrupted blade continuity, yet returns the exact physical rig',()=>{
 const actor={...f,peasantMotion:true,recoveryFlow:true,body:'femboy',gear:{weapon:'dual'},
   action:'slash',attack:'open_cut',actionTime:.22,actionDuration:.4,attackSpec:{contact:.17}};
 const draw=(target,t)=>{
   const c=paint(),rig=sampleArcadeFighter(target,t);
   assert.equal(drawArenaFighter(c.ctx,target,t,{rig}),rig);
   return c.records.filter(([style,width])=>['#6ac7bf','#97cfe8'].includes(style)&&width===8)
     .map(([, , ,trace])=>trace);
 };
 const swing=draw(actor,1);
 Object.assign(actor,{action:'guard',attack:null,face:.85,actionTime:.008});
 const transition=draw(actor,1.008);
 const flagOff=draw({...actor,recoveryFlow:false},1.008);
 assert.equal(transition.length,2);
 const dist=(a,b)=>Math.hypot(a.shift[0]-b.shift[0],a.shift[1]-b.shift[1]);
 assert.ok(transition.every((part,i)=>dist(part,swing[i])<1e-7));
 assert.ok(flagOff.some((part,i)=>dist(part,swing[i])>8));
 const later=draw(actor,1.120);
 const settledBaseline=draw({...actor,recoveryFlow:false},1.120);
 assert.ok(later.every((part,i)=>dist(part,settledBaseline[i])<1e-7));
});

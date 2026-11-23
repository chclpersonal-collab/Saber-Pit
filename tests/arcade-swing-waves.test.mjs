import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeSwingWaves} from '../dist/arcade-swing-waves.js';

const blade=(id,x,y,dx,dy)=>({id,hand:{x,y},tip:{x:x+dx,y:y+dy}});
const fighter={id:'actor',attack:'slash',technique:'open_cut',attackSerial:1,team:0,
  attackSpec:{contact:.20,offhand:{contact:.24}}};
function ctx(){
  const out={paths:[],save(){},restore(){},beginPath(){this.path=[];},closePath(){},
    lineTo(...v){this.path.push(v);},moveTo(...v){this.path.push(v);},quadraticCurveTo(...v){this.path.push(v);},
    fill(){this.paths.push({v:this.path.flat(),curved:this.path.some(p=>p.length===4),a:this.globalAlpha});},stroke(){}};
  return out;
}
function samples(w,f,a,b,t=.20,base=1,phase='short'){
  w.sample({...f,actionTime:t-.02},{blades:a,phase},base-.02);
  w.sample({...f,actionTime:t},{blades:b,phase},base);
}
test('release arc follows actual blade tips; short decay; no idle ribbon',()=>{
  const w=createArcadeSwingWaves();
  const a=[blade('main',10,15,42,0)],b=[blade('main',11,16,37,20)];
  samples(w,fighter,a,b,.06,.5);
  let out=ctx();w.draw(out,.50);assert.equal(out.paths.length,0);
  samples(w,fighter,a,b);
  out=ctx();w.draw(out,1);assert.equal(out.paths.length,1);
  assert.equal(out.paths[0].curved,true);
  assert.ok(out.paths[0].v.includes(b[0].tip.x));
  assert.ok(out.paths[0].v.includes(b[0].tip.y));
  const later=ctx();w.draw(later,1.05);assert.ok(later.paths[0].a<out.paths[0].a);
  const settled=ctx();w.draw(settled,1.1);assert.equal(settled.paths.length,0);
});
test('thrust uses a slim straight taper, not a fake broad sweep',()=>{
  const w=createArcadeSwingWaves(), f={...fighter,technique:'piercing_lunge'};
  samples(w,f,[blade('main',50,50,45,0)],[blade('main',63,50,45,0)]);
  const out=ctx();w.draw(out,1);
  assert.equal(out.paths.length,1);
  assert.equal(out.paths[0].curved,false);
  const y=out.paths[0].v.filter((_,i)=>i%2===1);
  assert.ok(Math.max(...y)-Math.min(...y)<=5);
});
test('staff rear and both dual emitters stay independent on overlapping releases',()=>{
  for(const other of ['rear','off']){
    const w=createArcadeSwingWaves(),f={...fighter,attackSpec:{contact:.2,offhand:{contact:.2},leadBlade:other==='rear'?'rear':'main'}};
    samples(w,f,[blade('main',60,80,45,0),blade(other,60,80,-45,0)],
      [blade('main',60,80,41,19),blade(other,60,80,-41,-19)]);
    const out=ctx();w.draw(out,1);assert.equal(out.paths.length,2);
    const xs=out.paths.map(p=>p.v.filter((_,i)=>i%2===0));
    assert.ok(xs[0].every(x=>x>60));
    assert.ok(xs[1].every(x=>x<60));
  }
});
test('does not bridge attack serial, saber phase, low-FPS gap, or teleport; reduced clears',()=>{
  for(const interruption of ['serial','phase','gap','teleport']){
    const w=createArcadeSwingWaves();
    w.sample({...fighter,actionTime:.18},{phase:'short',blades:[blade('main',10,15,42,0)]},.98);
    const time=interruption==='gap'?1.06:1;
    w.sample({...fighter,attackSerial:interruption==='serial'?2:1,actionTime:.2},
      {phase:interruption==='phase'?'long':'short',
        blades:[blade('main',interruption==='teleport'?101:11,16,37,20)]},time);
    const out=ctx();w.draw(out,time);assert.equal(out.paths.length,0,interruption);
  }
  const w=createArcadeSwingWaves(),out=ctx();
  samples(w,fighter,[blade('main',10,15,42,0)],[blade('main',11,16,37,20)]);
  w.draw(out,1,{reducedMotion:true});w.draw(out,1);
  assert.equal(out.paths.length,0);
});

test('a combo carries existing ink without drawing a blade-shaped bridge',()=>{
  const w=createArcadeSwingWaves();
  samples(w,fighter,[blade('main',10,15,42,0)],[blade('main',11,16,37,20)]);
  const old=ctx();w.draw(old,1);
  w.sample({...fighter,attackSerial:2,actionTime:.01},{phase:'short',blades:[blade('main',160,160,35,24)]},1.01);
  const joined=ctx();w.draw(joined,1.01);
  assert.equal(joined.paths.length,1);
  assert.ok(joined.paths[0].a>old.paths[0].a*.8);
  assert.ok(joined.paths[0].v.every(coord=>coord<100));
  const faded=ctx();w.draw(faded,1.09);
  assert.equal(faded.paths.length,0);
});
test('fast post-contact motion leaves a lighter follow-through; free-hand cannot make ink',()=>{
  const from=[blade('main',10,15,42,0)],to=[blade('main',11,16,37,20)];
  const release=createArcadeSwingWaves(),carry=createArcadeSwingWaves(),unarmed=createArcadeSwingWaves();
  samples(release,fighter,from,to,.2);samples(carry,fighter,from,to,.285);
  samples(unarmed,{...fighter,action:'free_hand'},from,to,.2);
  const a=ctx(),b=ctx(),c=ctx();release.draw(a,1);carry.draw(b,1);unarmed.draw(c,1);
  assert.equal(b.paths.length,1);
  assert.ok(b.paths[0].a<a.paths[0].a*.6);
  assert.equal(c.paths.length,0);
});

test('ribbons reject torso-crossing chords even when both sampled tips clear the torso',()=>{
 const w=createArcadeSwingWaves();
 const past=blade('main',10,-10,40,-12),now=blade('main',10,10,40,12);
 w.sample({...fighter,actionTime:.18},{blades:[past],body:{x:50,y:0}},.98);
 w.sample({...fighter,actionTime:.20},{blades:[now],body:{x:50,y:0}},1);
 const covered=ctx();w.draw(covered,1);assert.equal(covered.paths.length,0);
 const open=createArcadeSwingWaves();
 samples(open,fighter,[past],[now]);const visible=ctx();open.draw(visible,1);
 assert.equal(visible.paths.length,1);
});

test('240 Hz samples retain a fading tail rather than replacing it with only fresh slices',()=>{
 const w=createArcadeSwingWaves();
 for(let i=0;i<24;i++){
   const t=i/240, a=t*9;
   w.sample({...fighter,actionTime:.145+t},{blades:[blade('main',45,40,43*Math.cos(a),43*Math.sin(a))]},1+t);
 }
 const rich=ctx(),expired=ctx();
 w.draw(rich,1+23/240);w.draw(expired,1.19);
 assert.ok(rich.paths.length>=4&&rich.paths.length<=6);
 const alphas=rich.paths.map(p=>p.a);
 assert.ok(alphas[0]<Math.max(...alphas.slice(1))*.52);
 assert.equal(expired.paths.length,0);
});

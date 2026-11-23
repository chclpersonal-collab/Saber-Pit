import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_TRAKATA_ID,createArcade,stepArcade,ARCADE_ATTACKS} from '../dist/arcade-engine.js';
import {activeClashEmitters} from '../dist/arcade-clashes.js';
const dt=1/120, move={technique:ARCADE_TRAKATA_ID,aimX:525,aimY:305};
const hero=(weapon='single')=>({id:'hero-test',name:'Test Hero',form:'makashi',weapon});
function setup(h=null){
  const s=createArcade({form:'makashi',seed:71,startingRanks:['SSS+V','SSS+V'],heroLineup:h?{'0-0':h}:undefined});
  const [p,e]=s.fighters;
  Object.assign(p,{x:450,y:305,face:0});Object.assign(e,{x:525,y:305,face:Math.PI,action:'stagger',actionDuration:60,think:300});
  return {s,p,e};
}
const ticks=(s,n,input={})=>{for(let i=0;i<n;i++)stepArcade(s,dt,input);};
test('ordinary max-rank cannot extinguish, deployed Hero can with all gear and cooldown',()=>{
  const ordinary=setup();ticks(ordinary.s,60,move);
  assert.equal(ordinary.s.events.filter(e=>e.kind.startsWith('trakata_')).length,0);
  for(const weapon of ['single','dual','staff']){
    const {s,p}=setup(hero(weapon));
    ticks(s,1,move);assert.equal(p.saberOff,true);assert.ok(p.energy<80);
    for(let i=0;i<21;i++){
      ticks(s,1,{...move,strike:true,guard:true,dash:true});
      assert.deepEqual(activeClashEmitters(p,s.time),[]);
      assert.equal(p.stats.saberSwings,0);
      assert.equal(p.saberOff,true);
    }
    ticks(s,33);
    const off=s.events.find(e=>e.kind==='trakata_off');
    const on=s.events.find(e=>e.kind==='trakata_on');
    const swing=s.events.find(e=>e.kind==='slash');
    assert.ok(off&&on&&swing);
    assert.equal(off.blades.length,weapon==='single'?1:2);
    assert.ok(on.time-off.time>=.19&&swing.time-on.time>=.05);
    assert.ok(s.events.filter(e=>e.fighterId===p.id&&e.kind==='hit').every(e=>e.time>swing.time));
    ticks(s,75);ticks(s,1,move);
    assert.equal(s.events.filter(e=>e.kind==='trakata_off').length,1);
  }
});
test('an actual enemy strike interrupts the extinguished Hero and cancels its follow-up',()=>{
  const {s,p,e}=setup(hero('staff'));
  ticks(s,1,move);
  Object.assign(e,{face:Math.PI,action:'slash',attack:'slash',attackSpec:ARCADE_ATTACKS.slash,
    actionDuration:ARCADE_ATTACKS.slash.duration,actionTime:ARCADE_ATTACKS.slash.contact-.003,contact:false});
  ticks(s,1);
  assert.equal(p.saberOff,false);
  assert.equal(p.action,'stagger');
  assert.ok(s.events.some(e=>e.kind==='hit'&&e.targetId===p.id));
  assert.ok(s.events.some(e=>e.kind==='trakata_on'&&e.interrupted));
  ticks(s,72);assert.equal(p.stats.saberSwings,0);
});

test('only a deployed AI Hero chooses the maneuver against a real held guard',()=>{
  for(const deployed of [false,true]){
    const h={...hero('staff'),doctrine:'aggressive'};
    const s=createArcade({form:'soresu',seed:2,startingRanks:['SSS+V','SSS+V'],
      heroLineup:deployed?{'1-0':h}:undefined});
    const [p,e]=s.fighters;
    Object.assign(p,{x:450,y:305,face:0});Object.assign(e,{x:530,y:305,face:Math.PI});
    for(let i=0;i<240;i++)stepArcade(s,dt,{guard:true,aimX:e.x,aimY:e.y});
    const starts=s.events.filter(event=>event.kind==='trakata_off'&&event.fighterId===e.id);
    assert.equal(starts.length,deployed?1:0);
    if(deployed)assert.ok(p.stats.blocks>0&&e.stats.saberHits===0,'normal guard can still defend the follow-up');
  }
});

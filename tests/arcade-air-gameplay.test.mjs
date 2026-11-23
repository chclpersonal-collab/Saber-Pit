import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,ARCADE_AIR_STRIKES,ARCADE_FORM_IDS} from '../dist/arcade-engine.js';
const dt=1/120;
const frame=(s,n,commands={})=>{for(let i=0;i<n;i++)stepArcade(s,dt,commands)};
function setup(form){
  const s=createArcade({form,teamForms:[form,'shii_cho'],seed:39,saberOnly:true}),[p,e]=s.fighters;
  Object.assign(p,{x:450,y:300,face:0});
  Object.assign(e,{x:519,y:300,face:Math.PI,action:'stagger',actionDuration:60,think:300});
  return {s,p,e};
}
test('all seven form jumps have unique labels and physically different ground displacement',()=>{
  const profiles=[];
  for(const form of ARCADE_FORM_IDS){
    const {s,p,e}=setup(form);e.x=710;
    frame(s,1,{jump:true,x:1});
    const kind=p.jumpKind;
    let peak=0,apex=0,distance=0;
    for(let i=1;i<110;i++){
      if(p.airHeight>peak){peak=p.airHeight;apex=i;}
      if(p.airPhase!=='grounded')distance=p.x-450;
      assert.equal(p.invuln,0);
      frame(s,1);
      if(p.airPhase==='grounded')break;
    }
    profiles.push({kind,peak:Math.round(peak),apex,distance:Math.round(distance)});
    assert.ok(distance>30&&distance<145);
  }
  assert.equal(new Set(profiles.map(x=>x.kind)).size,7);
  assert.equal(new Set(profiles.map(x=>x.peak)).size,7);
  assert.ok(new Set(profiles.map(x=>x.apex)).size>=5);
  assert.ok(new Set(profiles.map(x=>x.distance)).size>=5);
});

test('lateral Ataru crossflip retains real side displacement, differs from forward corkscrew',()=>{
  const a=setup('ataru'),b=setup('ataru');a.e.x=b.e.x=750;
  frame(a.s,1,{jump:true,x:1});frame(b.s,1,{jump:true,y:1});
  assert.equal(a.p.jumpKind,'corkscrew');assert.equal(b.p.jumpKind,'crossflip');
  assert.ok(a.p.airArc.peak>b.p.airArc.peak);
  frame(a.s,38);frame(b.s,38);
  assert.ok(a.p.x-450>Math.abs(a.p.y-300)+22);
  assert.ok(b.p.y-300>Math.abs(b.p.x-450)+22);
});

test('one legal airborne Slash per jump has each form’s real technique and contact',()=>{
  for(const form of ARCADE_FORM_IDS){
    const {s,p,e}=setup(form),def=ARCADE_AIR_STRIKES[form];
    frame(s,1,{jump:true,strike:true,aimX:e.x,aimY:e.y});
    let seen=false,hit=false,id=0;
    for(let i=0;i<85;i++){
      frame(s,1,{strike:i%3===0,aimX:e.x,aimY:e.y});
      for(const event of s.events)if(event.id>id){
        id=event.id;
        if(event.airStrike===def.id){seen=true;assert.equal(p.airPhase,'airborne');assert.equal(p.contact,false);assert.ok(event.contact>0);}
        if(event.kind==='hit'&&event.technique===def.id){hit=true;assert.equal(p.airPhase,'airborne');assert.ok(event.damage>0);}
      }
      if(hit)break;
    }
    assert.equal(seen,true,form);assert.equal(hit,true,form);assert.equal(p.moves[def.id],1);
  }
});

test('too late in flight does not start an airborne attack and does not queue a phantom ground strike',()=>{
  const {s,p,e}=setup('soresu');frame(s,1,{jump:true});
  while(p.airPhase!=='airborne'||p.airProgress<.83)frame(s,1);
  frame(s,1,{strike:true,aimX:e.x,aimY:e.y});
  frame(s,50);
  assert.equal(p.airPhase,'grounded');assert.equal(p.moves.air_guard,undefined);assert.equal(p.stats.saberSwings,0);
});

test('watch bots can choose a safe aerial entry and land an actual slash in a squad',()=>{
  let saw=false,hit=false;
  for(const seed of [1,4,8,14,16,19]){
    const s=createArcade({mode:'watch',seed,teamForms:[['makashi','ataru','juyo'],['shii_cho','djem_so','niman']],
      teamSizes:[3,3],startingRanks:['SSS','SSS'],limit:45,terrain:'underpit'});
    let id=0;
    while(s.phase==='playing'){
      stepArcade(s,1/30);
      for(const e of s.events)if(e.id>id){
        id=e.id;
        if(e.airStrike)saw=true;
        if(e.kind==='hit'&&e.technique?.startsWith('air_'))hit=true;
      }
    }
    if(hit)break;
  }
  assert.ok(saw&&hit);
});

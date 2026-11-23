import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
function fixture(sizes=[1,4],ranks=['SSS+V','SSS+V'],extra={}){
  return createArcade({mode:'watch',width:1280,height:720,terrain:'underpit',form:'makashi',
    teamForms:sizes.map(n=>Array(n).fill('makashi')),teamSizes:sizes,startingRanks:ranks,seed:3,limit:90,
    startingForceFamily:['force_push','force_push'],startingForceQuality:['standard','standard'],...extra});
}
test('crossfire tactics apply only to solo maximum-grade Watch exhibitions against three or more peers',()=>{
  assert.equal(fixture().eliteCrossfire,true);
  assert.equal(fixture([3,1]).eliteCrossfire,true);
  assert.equal(fixture([1,1]).eliteCrossfire,false);
  assert.equal(fixture([1,2]).eliteCrossfire,false);
  assert.equal(fixture([1,15],['SSS+V','F']).eliteCrossfire,false);
  assert.equal(fixture([1,4],['SSS+V','SSS+V'],{rule:'relic'}).eliteCrossfire,false);
  const controlled=fixture([1,4],['SSS+V','SSS+V'],{mode:'duel'});
  assert.equal(controlled.eliteCrossfire,true);
  assert.equal(controlled.fighters[0].control,true);
  for(let n=0;n<600;n++)stepArcade(controlled,1/120);
  assert.equal(controlled.fighters[0].moves.jump,undefined);
  assert.equal(controlled.fighters[0].moves.pressure_recover,undefined);
  assert.equal(fixture([1,4],['SSS+V','SSS+V'],{mode:'command'}).eliteCrossfire,false);
});
test('a solo master gets active exchanges against four with no clock-floor or guaranteed survival',()=>{
  const game=fixture([4,1]), solo=game.fighters.find(f=>f.team===1);
  for(let n=0;game.phase==='playing'&&n<2701;n++)stepArcade(game,1/30);
  assert.equal(game.endReason,'elimination');
  assert.equal(game.phase,'won');assert.equal(solo.alive,false);
  assert.ok(game.time>6&&game.time<game.limit*.85);
  assert.ok(solo.stats.saberHits>1&&solo.stats.blocks>1);
});

test('all seven forms execute real Q jumps with distinct measured heights and traffic-safe landing',()=>{
  const rises=[];
  for(const form of ['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo']){
    const s=createArcade({form,teamForms:[form,form],terrain:'underpit'}),[p,e]=s.fighters;
    Object.assign(p,{x:390,y:300});Object.assign(e,{x:543,y:300,think:999,action:'stagger',actionDuration:90});
    stepArcade(s,1/120,{jump:true,x:1});
    const cost=100-p.energy;
    assert.ok(cost>=12);assert.equal(p.action,'jump');assert.equal(p.airPhase,'takeoff');assert.equal(p.invuln,0);
    assert.ok(p.jumpKind);assert.ok(s.events.some(ev=>ev.kind==='jump'));
    let max=0,min=Infinity,maxX=p.x;
    for(let n=0;n<144;n++){
      stepArcade(s,1/120,{jump:true,x:n<78?1:0}); // held Q must never chain
      max=Math.max(max,p.airHeight);maxX=Math.max(maxX,p.x);min=Math.min(min,Math.hypot(p.x-e.x,p.y-e.y));
    }
    rises.push(Math.round(max));assert.equal(p.moves.jump,1);
    assert.ok(maxX>430&&min>=33.9999);
    assert.equal(p.airPhase,'grounded');assert.equal(p.jumpKind,null);
  }
  assert.deepEqual(rises,[32,22,19,49,35,39,28]);
});
test('a neutral jump costs stamina but has no unwanted forward drift or airborne chain',()=>{
  const s=createArcade({form:'niman'}),[p,e]=s.fighters;Object.assign(e,{think:9999,action:'stagger',actionDuration:90});
  const x=p.x,y=p.y;
  stepArcade(s,1/120,{jump:true});
  for(let i=0;i<110;i++)stepArcade(s,1/120,{jump:i%5===0});
  assert.deepEqual([p.x,p.y],[x,y]);
  assert.equal(p.moves.jump,1);assert.equal(p.airPhase,'grounded');
});

test('a mixed Watch squad can turn a real planned dodge into one rare paid jump per fighter',()=>{
  const s=createArcade({mode:'watch',seed:9,teamForms:[['makashi','soresu','juyo'],['shii_cho','djem_so','juyo']],
    teamSizes:[3,3],startingRanks:['SSS+V','SSS+V'],rule:'control',limit:45,terrain:'underpit'});
  let saw=false;
  for(let n=0;n<Math.ceil(s.limit*30)&&s.phase==='playing';n++){
    stepArcade(s,1/30);
    for(const f of s.fighters)if(f.action==='jump'){saw=true;assert.equal(f.invuln,0);}
  }
  assert.equal(saw,true);
  assert.equal(s.fighters.reduce((m,f)=>m+(f.moves.jump??0),0),1);
});

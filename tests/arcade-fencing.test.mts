import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,arcadeMovesFor,ARCADE_ATTACKS} from '../dist/arcade-engine.js';
const dt=1/120;
const advance=(s,time,input={})=>{for(let i=0;i<Math.round(time/dt);i++)stepArcade(s,dt,input);};
function fixture(rank='SSS'){
  const s=createArcade({seed:117,form:'makashi',teamForms:['makashi','makashi'],startingRanks:[rank,rank],rule:'control'});
  const [p,e]=s.fighters;
  Object.assign(p,{x:450,y:300,face:0});
  Object.assign(e,{x:523,y:300,face:Math.PI,think:999,action:'stagger',actionDuration:30});
  return {s,p,e};
}
test('manual feint stops an unreleased physical slash, then permits a real redirected attack',()=>{
  const {s,p,e}=fixture('F');
  stepArcade(s,dt,{strike:true,aimX:525,aimY:363});
  assert.equal(p.action,'slash');
  advance(s,.08);
  stepArcade(s,dt,{feint:true,aimX:521,aimY:356});
  assert.equal(p.action,'feint');assert.equal(p.attack,null);
  assert.equal(p.stats.feints,1);assert.equal(e.stats.damageTaken,0);
  assert.ok(s.events.some(ev=>ev.kind==='feint'&&ev.feintBearing>.45));
  advance(s,.10);stepArcade(s,dt,{strike:true,aimX:e.x,aimY:e.y});
  advance(s,.58,{aimX:e.x,aimY:e.y});
  assert.ok(e.stats.damageTaken>0);
  assert.equal(p.stats.saberSwings,2);
  assert.equal(s.stats.feints[0],1);
});
test('opposite pointed guards alter actual contact; correct read enables a landed riposte',()=>{
  const run=correct=>{
    const {s,p,e}=fixture();
    Object.assign(e,{x:p.x+Math.cos(.68)*75,y:p.y+Math.sin(.68)*75,face:Math.PI+.68});
    Object.assign(e,{action:'slash',attack:'slash',attackSpec:ARCADE_ATTACKS.slash,attackSerial:777,actionDuration:.44,actionTime:.105});
    const aim=correct?1.02:-.54;
    stepArcade(s,dt,{guard:true,aimX:p.x+100*Math.cos(aim),aimY:p.y+100*Math.sin(aim)});
    assert.equal(p.guardLane,correct?'right':'left');
    return {s,p,e};
  };
  const good=run(true),bad=run(false);
  assert.equal(good.p.stats.damageTaken,0);assert.equal(good.p.stats.guardReads,1);
  assert.ok(bad.p.stats.damageTaken>0);assert.equal(bad.p.stats.guardReads,0);
  assert.ok(good.s.events.find(e=>e.kind==='read'&&e.guardLane==='right'&&e.readKind==='parry'));
  stepArcade(good.s,dt,{strike:true,aimX:good.e.x,aimY:good.e.y});
  assert.equal(good.p.technique,'riposte');
  advance(good.s,.51);
  assert.equal(good.p.stats.ripostes,1);
  assert.ok(good.s.events.find(e=>e.kind==='riposte'&&e.targetId===good.e.id&&e.damage>0));
});
test('ranked feint-redirection is a separate fake windup before one actual committed move',()=>{
  const {s,p,e}=fixture('SSS+V');
  const selected=arcadeMovesFor('makashi',14,{tactical:true}).find(m=>m.tactical==='feint_redirect');
  assert.ok(selected);
  stepArcade(s,dt,{technique:selected.id,aimX:e.x,aimY:e.y});
  assert.equal(p.action,'feint');assert.equal(p.stats.saberSwings,0);
  advance(s,.72);
  assert.ok(s.events.some(e=>e.kind==='feint'));assert.equal(p.moves[selected.id],1);
  assert.ok(e.stats.damageTaken>0);
});

test('a committed vault cannot be feinted away during takeoff',()=>{
  const s=createArcade({form:'ataru'}), [p]=s.fighters;
  stepArcade(s,dt,{heavy:true});
  assert.equal(p.airPhase,'takeoff');
  stepArcade(s,dt,{feint:true});
  assert.equal(p.attack,'vault');assert.equal(p.stats.feints,0);
});

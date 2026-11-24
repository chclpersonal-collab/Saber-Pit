import test from 'node:test';
import assert from 'node:assert/strict';
import { createArcadeObjective, advanceArcadeObjective, objectiveOutcome,
  isArcadeCarrier, carrierSpeedScale, arcadeObjectiveMove } from '../dist/arcade-objectives.js';

const dt=1/120, bounds={minX:42,maxX:1078,minY:140,maxY:585};
const fighter=(id,team,x,y,over={})=>({id,team,x,y,airPhase:'grounded',action:'idle',hp:100,...over});
const scenario=(rule,fighters=[])=>({time:0,bounds,objective:createArcadeObjective(rule,1120,640,bounds),fighters});
const tick=(s,seconds=dt)=>{
  let result=null;
  for(let i=0,n=Math.round(seconds/dt);i<n;i++){s.time+=dt;result=advanceArcadeObjective(s,dt);}
  return result;
};
const standAt=(f,p)=>Object.assign(f,{x:p.x,y:p.y});
test('elimination leaves legacy outcome untouched',()=>{
  const s=scenario('elimination',[fighter('0',0,560,320)]);
  assert.equal(tick(s,80),null);
  assert.equal(objectiveOutcome(s,{timedOut:true}),null);
  assert.equal(arcadeObjectiveMove(s,s.fighters[0]),null);
  assert.equal(carrierSpeedScale(s,s.fighters[0]),1);
});
test('control charges from neutral, scores only while occupied, and wins exactly at 30',()=>{
  const s=scenario('control'), p=s.objective;
  const f=fighter('0',0,p.center.x,p.center.y);
  s.fighters.push(f,fighter('1',1,800,p.center.y));
  tick(s,6);
  assert.equal(p.owner,null);assert.deepEqual(p.score,[0,0]);
  tick(s,1);
  assert.equal(p.owner,0);assert.equal(p.capture,100);
  assert.ok(Math.abs(p.score[0]-1/3)<1e-6);
  f.x=260; tick(s,1);
  assert.ok(Math.abs(p.score[0]-1/3)<1e-6);
  standAt(f,p.center);
  assert.equal(tick(s,29),null);
  assert.equal(tick(s,1),0);
  assert.deepEqual(p.score,[30,0]);
});
test('contesting halts control; only grounded active bodies count; timeout breaks by objective then returns null when tied',()=>{
  const s=scenario('control'), p=s.objective;
  const b=fighter('0',0,p.center.x,p.center.y);
  const r=fighter('1',1,p.center.x,p.center.y);
  const ghost=fighter('2',1,p.center.x,p.center.y,{hp:0});
  s.fighters.push(b,r,ghost);
  tick(s,12);
  assert.deepEqual(p.presence,[1,1]);assert.equal(p.contested,true);assert.equal(p.capture,0);
  r.airPhase='airborne';tick(s,7);
  assert.deepEqual(p.presence,[1,0]);assert.equal(p.owner,0);assert.equal(p.contested,false);
  assert.equal(objectiveOutcome(s,{timedOut:true}),0);assert.equal(objectiveOutcome(s),null);
  p.score[1]=p.score[0];assert.equal(objectiveOutcome(s,{timedOut:true}),null);
});
test('control ownership survives partial opposing pressure and resumes when its holder returns',()=>{
  const s=scenario('control',[fighter('0',0,560,320),fighter('1',1,835,320)]);
  const [blue,red]=s.fighters;
  tick(s,8);const full=s.objective.score[0];
  blue.x=210;red.x=560;tick(s,3);
  assert.equal(s.objective.owner,0);assert.equal(s.objective.score[0],full);
  red.x=835;blue.x=560;tick(s,1);
  assert.ok(s.objective.score[0]>full+.99);
});
test('contest denies relic pickup; successful pickup slows bearer; death drops in the last location and locks pickup',()=>{
  const blue=fighter('blue',0,555,320),red=fighter('red',1,565,320);
  const s=scenario('relic',[blue,red]), r=s.objective.relic;
  assert.equal(tick(s),null);assert.equal(s.objective.contested,true);assert.equal(r.carrierId,null);
  red.x=700;blue.action='dash';tick(s);assert.equal(r.carrierId,null);
  blue.action='idle';tick(s);
  assert.equal(r.state,'carried');assert.equal(r.carrierId,'blue');
  assert.equal(isArcadeCarrier(s,blue),true);assert.equal(carrierSpeedScale(s,blue),.72);
  assert.equal(carrierSpeedScale(s,red),1);
  blue.x=640;tick(s);assert.equal(r.x,640);
  blue.hp=0;red.x=640;tick(s);
  assert.equal(r.state,'available');assert.equal(r.x,640);assert.equal(r.carrierId,null);
  assert.ok(r.unlockAt>s.time);
  tick(s,.45);assert.equal(r.carrierId,null);
  tick(s,.06);assert.equal(r.carrierId,'red');
});
test('relic deliveries rotate through the actual home circle, reset two seconds, then win on the third',()=>{
  const blue=fighter('blue',0,560,320), red=fighter('red',1,990,320);
  const s=scenario('relic',[blue,red]), o=s.objective,r=o.relic;
  for(let i=0;i<3;i++){
    standAt(blue,o.center);tick(s);
    assert.equal(r.carrierId,blue.id);
    standAt(blue,r.homes[1]);tick(s);
    assert.equal(o.score[0],i);
    standAt(blue,r.homes[0]);
    assert.equal(tick(s),i===2?0:null);
    assert.equal(r.state,'resetting');assert.equal(r.resetAt,r.unlockAt);
    assert.equal(o.score[0],i+1);
    if(i<2){tick(s,1.95);assert.equal(r.state,'resetting');tick(s,.06);assert.equal(r.state,'available');}
  }
  assert.equal(objectiveOutcome(s),0);
});
test('AI objectives select retrieval, escape, intercept and escort without mutating simulation',()=>{
  const blue=fighter('blue',0,530,325),red=fighter('red',1,710,322), helper=fighter('wing',0,370,330,{slot:1});
  const s=scenario('relic',[blue,red,helper]), r=s.objective.relic;
  const before=JSON.stringify(s);
  assert.equal(arcadeObjectiveMove(s,blue).role,'retrieve');
  assert.equal(arcadeObjectiveMove(s,helper).role,'screen');
  assert.equal(JSON.stringify(s),before);
  tick(s);
  assert.deepEqual(arcadeObjectiveMove(s,blue),{x:r.homes[0].x,y:r.homes[0].y,role:'escape'});
  assert.equal(arcadeObjectiveMove(s,red).role,'intercept');
  assert.equal(arcadeObjectiveMove(s,helper).role,'escort');
});

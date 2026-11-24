import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  ARCADE_BODY_REGIONS,ARCADE_INJURY_REFERENCE,
  arcadeFatalChance,arcadeInjuryBurden,arcadeInjuryEffects,arcadeInjuryLabel,arcadeInjuryReport,
  applyArcadeInjury,compareArcadeDanger,createArcadeInjuries,
} from '../dist/arcade-injuries.js';

const defaults={amount:18,quality:.74,attackerRank:4,defenderRank:4,roll:.999};
const hit=(state,region,options)=>applyArcadeInjury(state,{...defaults,region,...options});
const frozen=value=>{
  for(const field of Object.values(value))if(field&&typeof field==='object')frozen(field);
  return Object.freeze(value);
};

test('injuries are independent and a hit changes only one side of one body region',()=>{
  const clean=frozen(createArcadeInjuries()),another=createArcadeInjuries();
  assert.deepEqual(Object.keys(clean),ARCADE_BODY_REGIONS.map(r=>r.id));
  assert.notEqual(clean.head,another.head);
  const out=hit(clean,'rightArm',{direction:'rear'});
  assert.equal(out.changed,true);
  assert.equal(out.fatal,false);
  assert.equal(out.outcome,'injury');
  assert.ok(out.impact>0);
  assert.equal(out.impact,out.delta);
  assert.equal(out.injuries.rightArm.rear,out.impact);
  assert.equal(out.injuries.rightArm.front,0);
  assert.equal(out.injuries.leftArm,clean.leftArm);
  assert.equal(clean.rightArm.rear,0);
});

test('guards, minimal contact and invalid input cannot cause a fatal injury',()=>{
  const clean=createArcadeInjuries();
  for(const {id:region} of ARCADE_BODY_REGIONS){
    const guard=hit(clean,region,{direction:'rear',amount:120,quality:1,attackerRank:14,defenderRank:0,blocked:true,roll:0});
    assert.equal(guard.fatal,false);
    assert.equal(guard.changed,false);
    assert.equal(guard.outcome,'blocked');
    assert.equal(guard.impact,0);
    assert.equal(guard.injuries,clean);
    const glance=hit(clean,region,{amount:4,roll:0});
    assert.equal(glance.fatalChance,0);
    assert.equal(glance.fatal,false);
    assert.equal(glance.outcome,'glance');
    assert.ok(glance.impact>0);
  }
  for(const region of [null,'constructor','hand','__proto__']){
    const miss=hit(clean,region,{amount:120,roll:0});
    assert.equal(miss.injuries,clean);
    assert.equal(miss.fatal,false);
  }
  assert.equal(hit(clean,'head',{amount:99,roll:-1}).fatal,false);
  assert.equal(hit(clean,'head',{amount:99,roll:NaN}).fatal,false);
});

test('fatal risk varies by region, previous local injury, direction, quality, and relative rank',()=>{
  const clean=createArcadeInjuries();
  const risk=(region,changes,state=clean)=>arcadeFatalChance(state,{...defaults,region,...changes});
  assert.ok(risk('head')>risk('torso')&&risk('torso')>risk('rightLeg')&&risk('rightLeg')>risk('rightArm'));
  assert.equal(risk('rightArm'),risk('leftArm'));
  assert.equal(risk('rightLeg'),risk('leftLeg'));
  assert.ok(risk('torso',{quality:1})>risk('torso',{quality:.2}));
  assert.ok(risk('head',{direction:'rear'})>risk('head',{direction:'front'}));
  assert.ok(risk('head',{attackerRank:14,defenderRank:0})>risk('head',{attackerRank:0,defenderRank:14}));
  const wounded=hit(clean,'leftLeg',{amount:55}).injuries;
  assert.ok(risk('leftLeg',{},wounded)>risk('leftLeg'));
  assert.equal(risk('rightLeg',{},wounded),risk('rightLeg'));
  for(const {id:region} of ARCADE_BODY_REGIONS){
    const chance=risk(region,{amount:140,quality:1,attackerRank:14,defenderRank:0});
    assert.ok(chance>0&&chance<1);
  }
});

test('fatality uses only the supplied seed roll, even at a capped local condition',()=>{
  const clean=createArcadeInjuries();
  const checked={region:'head',amount:55,quality:1,attackerRank:14,defenderRank:0};
  const chance=arcadeFatalChance(clean,checked);
  assert.equal(applyArcadeInjury(clean,{...checked,roll:chance}).fatal,false);
  assert.equal(applyArcadeInjury(clean,{...checked,roll:chance-1e-6}).fatal,true);
  let damaged=clean;
  for(let i=0;i<8;i++){
    const out=applyArcadeInjury(damaged,{...checked,roll:.999});
    assert.equal(out.fatal,false);
    damaged=out.injuries;
  }
  assert.equal(damaged.head.front,100);
  assert.equal(arcadeInjuryLabel(damaged,'head','front'),'Disabled');
  const capped=applyArcadeInjury(damaged,{...checked,roll:0});
  assert.equal(capped.changed,false);
  assert.equal(capped.fatal,true);
  assert.equal(capped.outcome,'fatal');
  // Even everything disabled is a state of play, not an automatic death flag.
  for(const id of ARCADE_BODY_REGIONS.map(r=>r.id)){
    damaged=hit(damaged,id,{amount:140,roll:.999}).injuries;
    damaged=hit(damaged,id,{amount:140,roll:.999,direction:'rear'}).injuries;
  }
  assert.equal(hit(damaged,'head',{amount:4,roll:0}).fatal,false);
  assert.ok(arcadeInjuryEffects(damaged).moveScale>0);
});

test('left/right leg and weapon/offhand affect local gameplay resources differently',()=>{
  const clean=createArcadeInjuries();
  const base=arcadeInjuryEffects(clean);
  assert.equal(base.moveScale,1);
  assert.equal(base.attackScale,1);
  assert.equal(base.guardScale,1);
  const road=arcadeInjuryEffects(hit(clean,'leftLeg',{amount:80}).injuries);
  assert.ok(road.moveScale<base.moveScale&&road.turnSpeed<base.turnSpeed);
  assert.equal(road.attackScale,1);
  const wounded=hit(clean,'rightArm',{amount:80}).injuries;
  const primary=arcadeInjuryEffects(wounded,{weaponHand:'right'});
  const alternate=arcadeInjuryEffects(wounded,{weaponHand:'left'});
  const dual=arcadeInjuryEffects(wounded,{weaponHand:'left',dual:true});
  assert.ok(primary.attackScale<dual.attackScale&&dual.attackScale<alternate.attackScale);
  assert.ok(primary.guardScale<1);
  assert.equal(primary.moveScale,1);
  const head=arcadeInjuryEffects(hit(clean,'head',{amount:120}).injuries);
  assert.ok(head.forcePower<1&&head.turnSpeed<1);
});

test('timeout comparison is lexicographic functional danger and never an HP total',()=>{
  const clean=createArcadeInjuries();
  const wounded=hit(clean,'head',{amount:54}).injuries;
  let strained=clean;
  for(const region of ['leftArm','rightArm','leftLeg','rightLeg'])strained=hit(strained,region,{amount:140}).injuries;
  assert.equal(compareArcadeDanger(wounded,strained),1);
  assert.equal(compareArcadeDanger(arcadeInjuryBurden(strained),arcadeInjuryBurden(wounded)),-1);
  assert.equal(compareArcadeDanger(clean,createArcadeInjuries()),0);
});

test('UI reports reference probabilities and exact local front/rear labels',()=>{
  const clean=createArcadeInjuries();
  const injured=hit(clean,'torso',{amount:73,direction:'rear'}).injuries;
  const front=arcadeInjuryReport(injured,{direction:'front',attackerRank:12});
  const rear=arcadeInjuryReport(injured,{direction:'rear',attackerRank:12});
  assert.equal(front.length,6);
  assert.equal(front.find(e=>e.id==='torso').severityLabel,'Ready');
  const item=rear.find(e=>e.id==='torso');
  assert.equal(item.severityLabel,'Disabled');
  const risk=arcadeFatalChance(injured,{...ARCADE_INJURY_REFERENCE,region:item.id,direction:'rear',attackerRank:12,defenderRank:12});
  assert.equal(risk,item.fatalChance);
  assert.equal(item.fatalPct,Number((100*risk).toFixed(1)));
  assert.ok(item.fatalChance>front.find(e=>e.id==='torso').fatalChance);
  assert.match(ARCADE_INJURY_REFERENCE.description,/Fictional/);
});

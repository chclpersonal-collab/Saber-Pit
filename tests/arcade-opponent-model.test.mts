import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeOpponentModel,observeArcadeOpponent,reportArcadeTactic,chooseArcadeTactic,arcadeKnownTactics,
  arcadeMistakeRate,arcadeAdapts,arcadeFavouredSide} from '../dist/arcade-opponent-model.js';

const seq=(values:number[])=>{let i=0;return ()=>values[i++%values.length];};
const ctx=(over={})=>({gradeIndex:0,selfEnergy:80,foeEnergy:80,distance:120,reach:88,foeWhiffing:false,rng:seq([.9,.5]),...over});

test('rank adds knowledge, F knows only pressure and space',()=>{
  assert.deepEqual(arcadeKnownTactics(0),['pressure','space']);
  assert.ok(arcadeKnownTactics(14).length===7);
  for(let g=1;g<=14;g++)assert.ok(arcadeKnownTactics(g).length>=arcadeKnownTactics(g-1).length);
});

test('mistake rate falls with rank and adapting starts at C',()=>{
  assert.equal(arcadeMistakeRate(0),.35);
  assert.equal(arcadeMistakeRate(14),.02);
  assert.equal(arcadeAdapts(2),false);
  assert.equal(arcadeAdapts(3),true);
  assert.equal(arcadeMistakeRate(Number.NaN),.35);
});

test('observing never mutates and learns swing cadence and guard delay',()=>{
  const start=createArcadeOpponentModel();
  let m=start;
  for(const t of [1,1.5,2,2.5])m=observeArcadeOpponent(m,{kind:'swing',t});
  m=observeArcadeOpponent(m,{kind:'guard',t:3,delay:.3});
  assert.equal(start.swings,0);
  assert.equal(m.swings,4);
  assert.ok(Math.abs(m.swingInterval!-.5)<1e-9);
  assert.equal(m.guardDelay,.3);
  assert.ok(Object.isFrozen(m));
});

test('favoured side needs evidence',()=>{
  let m=createArcadeOpponentModel();
  for(let i=0;i<3;i++)m=observeArcadeOpponent(m,{kind:'swing',t:i,side:1});
  assert.equal(arcadeFavouredSide(m),null);
  m=observeArcadeOpponent(m,{kind:'swing',t:4,side:1});
  assert.equal(arcadeFavouredSide(m),1);
});

test('whiff punish only when known, picked when the foe whiffs',()=>{
  const m=createArcadeOpponentModel();
  assert.notEqual(chooseArcadeTactic(m,ctx({foeWhiffing:true})).tactic,'whiff_punish');
  assert.equal(chooseArcadeTactic(m,ctx({gradeIndex:6,foeWhiffing:true,distance:80})).tactic,'whiff_punish');
});

test('low stamina makes a trained fighter recover',()=>{
  assert.equal(chooseArcadeTactic(createArcadeOpponentModel(),ctx({gradeIndex:4,selfEnergy:20})).tactic,'recover');
});

test('adapting ranks drop a failing tactic, novices do not',()=>{
  let m=createArcadeOpponentModel();
  for(let i=0;i<4;i++)m=reportArcadeTactic(m,'pressure',false);
  const near={distance:80};
  assert.equal(chooseArcadeTactic(m,ctx({gradeIndex:0,...near})).tactic,'pressure');
  assert.notEqual(chooseArcadeTactic(m,ctx({gradeIndex:8,...near})).tactic,'pressure');
});

test('novice mistakes come from the seeded rng and are labelled',()=>{
  const choice=chooseArcadeTactic(createArcadeOpponentModel(),ctx({distance:80,rng:seq([.1,0])}));
  assert.equal(choice.mistake,true);
  assert.equal(choice.tactic,'space');
  const again=chooseArcadeTactic(createArcadeOpponentModel(),ctx({distance:80,rng:seq([.1,0])}));
  assert.deepEqual(again,choice);
});

test('bait shows a feint tell',()=>{
  let m=createArcadeOpponentModel();
  for(let i=0;i<4;i++)m=observeArcadeOpponent(m,{kind:'guard',t:i});
  const choice=chooseArcadeTactic(m,ctx({gradeIndex:6,distance:150}));
  assert.equal(choice.tactic,'bait');
  assert.equal(choice.tell,'feint_step');
});

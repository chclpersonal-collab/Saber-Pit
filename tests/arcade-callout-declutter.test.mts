import test from 'node:test';
import assert from 'node:assert/strict';
import {declutterArcadeCallouts,arcadeCalloutBudget,arcadeCalloutText} from '../dist/arcade-callout-declutter.js';

const c=(actor:string,label:string,x:number,y:number,priority=2,focus=false)=>({actor,label,x,y,priority,focus});

test('the same label close together merges into one with a count',()=>{
  const shown=declutterArcadeCallouts([c('a','BLADE CLASH',200,120),c('b','BLADE CLASH',230,128),c('c','BLADE CLASH',600,120)]);
  assert.equal(shown.length,2);
  assert.equal(shown[0].count,2);
  assert.equal(arcadeCalloutText(shown[0]),'BLADE CLASH ×2');
  assert.equal(arcadeCalloutText(shown[1]),'BLADE CLASH');
});

test('overlapping different labels keep the higher priority',()=>{
  const shown=declutterArcadeCallouts([c('a','PARRY',200,120,2),c('b','KO - TORSO',210,125,4)]);
  assert.deepEqual(shown.map(s=>s.label),['KO - TORSO']);
});

test('the player\'s own label always shows',()=>{
  const shown=declutterArcadeCallouts([c('a','KO - TORSO',200,120,4),c('me','PARRY',205,122,1,true)]);
  assert.ok(shown.some(s=>s.actor==='me'));
});

test('big fights get a smaller budget',()=>{
  assert.equal(arcadeCalloutBudget(2),6);
  assert.equal(arcadeCalloutBudget(20),3);
  const many=Array.from({length:12},(_,i)=>c('f'+i,'HIT '+i,i*200,100));
  assert.equal(declutterArcadeCallouts(many,{budget:arcadeCalloutBudget(20)}).length,3);
});

test('deterministic and ignores bad points',()=>{
  const list=[c('a','HIT',1,1),c('b','HIT',NaN,1),c('c','',5,5)];
  assert.deepEqual(declutterArcadeCallouts(list),declutterArcadeCallouts(list));
  assert.equal(declutterArcadeCallouts(list).length,1);
});

import {arcadeCalloutFamily} from '../dist/arcade-callout-declutter.js';

// Stress cases from review: focus vs a full budget, focus vs a same-label lead, KO and parry bursts.
test('stress: a low-priority focus label survives a full budget',()=>{
  const busy=[c('a','KO · TORSO',100,100,5),c('b','KO · HEAD',400,100,5),c('d','GUARD BREAK',700,100,4),c('e','BLADE CLASH',1000,100,4)];
  const shown=declutterArcadeCallouts([...busy,c('me','PARRY',1300,100,1,true)],{budget:3});
  assert.ok(shown.some(s=>s.actor==='me'&&s.focus));
  assert.ok(shown.length<=3);
});

test('stress: a focus label never merges behind another fighter\'s same label',()=>{
  const shown=declutterArcadeCallouts([c('a','BLADE CLASH',200,120,4),c('me','BLADE CLASH',220,124,4,true)]);
  const mine=shown.find(s=>s.actors.includes('me'))!;
  assert.equal(mine.actor,'me');
  assert.deepEqual(mine.actors,['me']);
});

test('stress: six KOs and six parries at once over a 3-label budget all stay represented',()=>{
  const regions=['TORSO','HEAD','L ARM','R ARM','L LEG','R LEG'];
  const burst=[...regions.map((r,i)=>c('k'+i,'KO · '+r,i*180,100,5)),...regions.map((_,i)=>c('p'+i,i%2?'PARRY':'PERFECT PARRY',i*180+60,300,4))];
  const shown=declutterArcadeCallouts(burst,{budget:3});
  assert.ok(shown.length<=3);
  const actors=new Set(shown.flatMap(s=>s.actors));
  for(const x of burst)assert.ok(actors.has(x.actor),x.actor+' dropped');
  assert.deepEqual(shown.map(s=>arcadeCalloutText(s)),['KO ×6','PARRY ×6']);
});

test('stress: a KO burst keeps the player\'s own label and still shows every KO',()=>{
  const burst=Array.from({length:8},(_,i)=>c('k'+i,'KO · TORSO',i*200,100,5));
  const shown=declutterArcadeCallouts([...burst,c('me','RIPOSTE',50,90,3,true)],{budget:3});
  assert.ok(shown.some(s=>s.actor==='me'));
  assert.equal(shown.filter(s=>!s.focus).reduce((t,s)=>t+s.count,0),8);
});

test('families group KO regions and parry kinds',()=>{
  assert.equal(arcadeCalloutFamily('KO · TORSO'),'KO');
  assert.equal(arcadeCalloutFamily('PERFECT PARRY · +4 STAMINA'),'PARRY');
  assert.equal(arcadeCalloutFamily('BLADE CLASH'),'BLADE CLASH');
});

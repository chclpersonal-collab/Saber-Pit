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

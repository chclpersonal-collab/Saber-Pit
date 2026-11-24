import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENA_RECORD_KEY,addArenaRound,arenaRecordView,emptyArenaRecord,parseArenaRecord,readArenaRecord,recordArenaRound} from '../dist/arcade-record.js';
const memory=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},m};};
test('arena record starts empty and shows blanks, not made-up numbers',()=>{
  assert.deepEqual(parseArenaRecord(null),emptyArenaRecord());
  assert.deepEqual(parseArenaRecord('{bad'),emptyArenaRecord());
  assert.deepEqual(arenaRecordView(emptyArenaRecord()),{kd:'—',win:'—',wl:''});
});
test('arena record counts kills, deaths, wins and losses per round',()=>{
  let r=addArenaRound(emptyArenaRecord(),{kills:3,deaths:1},'won');
  r=addArenaRound(r,{kills:1,deaths:2},'lost');
  r=addArenaRound(r,{kills:0,deaths:0},'draw');
  assert.deepEqual(r,{v:1,rounds:3,wins:1,losses:1,draws:1,kills:4,deaths:3});
  assert.deepEqual(arenaRecordView(r),{kd:'1.33',win:'50%',wl:'1W · 1L'});
  assert.equal(arenaRecordView(addArenaRound(emptyArenaRecord(),{kills:2,deaths:0},'won')).kd,'2.00');
});
test('arena record lives in its own key and ignores bad values',()=>{
  const s=memory();recordArenaRound({kills:2,deaths:-4},'won',s);recordArenaRound({kills:Number.NaN,deaths:1},'lost',s);
  assert.deepEqual([...s.m.keys()],[ARENA_RECORD_KEY]);
  assert.deepEqual(readArenaRecord(s),{v:1,rounds:2,wins:1,losses:1,draws:0,kills:2,deaths:1});
  assert.doesNotThrow(()=>recordArenaRound({kills:1},'won',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('full');}}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba} from '../dist/arcade-moba.js';

// v6 Three Fronts AI: the same brain on Blue and Pink, headless and seeded.
function match(seed,teams){
  const s=createMoba(seed,1,'shii_cho',{smartAI:true});
  s.player.control=false;s.smartTeams=teams;
  while(s.phase==='playing')stepMoba(s,1/20,{});
  return s;
}

test('the v6 Three Fronts AI beats the old AI from either side', () => {
  let smart=0;
  for(const seed of [1,2])for(const side of [0,1]){
    const s=match(seed,side===0?[true,false]:[false,true]);
    if(s.winner===side)smart++;
  }
  assert.ok(smart>=3,`smart side won ${smart}/4`);
});

test('the v6 AI is off unless asked for, so 5.x replays and tests keep their history', () => {
  const a=createMoba(5),b=createMoba(5,1,'shii_cho',{smartAI:false});
  assert.equal(a.smartAI,undefined);
  for(let i=0;i<600;i++){stepMoba(a,1/60,{});stepMoba(b,1/60,{});}
  assert.deepEqual(a.heroes.map(h=>[h.x,h.y,h.hp]),b.heroes.map(h=>[h.x,h.y,h.hp]));
});

test('the same seed plays out the same with the v6 AI on', () => {
  const run=()=>{const s=createMoba(9,1,'makashi',{smartAI:true});for(let i=0;i<1800;i++)stepMoba(s,1/60,{});return s.heroes.map(h=>[Math.round(h.x),Math.round(h.y),h.hp,h.kills]);};
  assert.deepEqual(run(),run());
});

test('a player hero gets no help from the v6 AI', () => {
  const s=createMoba(3,1,'shii_cho',{smartAI:true});
  const start={x:s.player.x,y:s.player.y};
  for(let i=0;i<120;i++)stepMoba(s,1/60,{});
  assert.deepEqual({x:s.player.x,y:s.player.y},start);
  assert.equal(s.player.smart,undefined);
});

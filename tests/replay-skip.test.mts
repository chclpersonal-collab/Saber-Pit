import test from 'node:test';
import assert from 'node:assert/strict';
import {startArcadeTournamentPlayback} from '../dist/tournament-replay.js';
import {createSquadReplay,SQUAD_REPLAY_RULESET} from '../dist/squad-tournament-sim.js';
import {stepArcade} from '../dist/arcade-engine.js';
import {REPLAY_TICK} from '../dist/replay-stepper.js';

function harness(){
  const q=new Map();let next=0,t=0;
  globalThis.document=new EventTarget();document.hidden=false;globalThis.devicePixelRatio=1;
  globalThis.requestAnimationFrame=fn=>{q.set(++next,fn);return next;};
  globalThis.cancelAnimationFrame=id=>q.delete(id);
  const gradient={addColorStop(){}};
  const ctx=new Proxy({measureText:()=>({width:12})},{get:(o,k)=>o[k]??(()=>gradient)});
  const canvas={width:960,height:540,getContext:()=>ctx,getBoundingClientRect:()=>({width:960,height:540})};
  document.createElement=()=>({...canvas});
  return {canvas,frame(dt=8){const p=[...q.values()];q.clear();t+=dt;p.forEach(f=>f(t));},q};
}
test('5v5 Skip is incremental, read-only and exactly preserves normal fixed-tick outcome',()=>{
  const {canvas,frame,q}=harness();
  const teams=['a','b'].map((id,i)=>({id,name:id,fighters:Array.from({length:5},(_,j)=>({id:id+j,name:id+j,form:i?'ataru':'makashi',chessStyle:i?'knight':'queen'}))}));
  const fixture={ruleset:SQUAD_REPLAY_RULESET,teams,seed:316954,round:1,limit:75,terrain:'underpit'};
  const game=createSquadReplay(fixture), watched=createSquadReplay(fixture);
  const rules={stepArcade,sampleArcadeFighter(){},arcadeBladeWorld(){return []},drawArcadeFighter(){}};
  const ends=[];
  const playback=startArcadeTournamentPlayback(canvas,game,fixture.terrain,rules,{drawOnTimeout:true,onEnd:w=>ends.push(w)});
  frame();frame(30);playback.pause();
  const before=game.time;assert.equal(playback.skip(),true);assert.equal(playback.skip(),false);
  assert.equal(game.time,before,'Skip click itself must not burn simulation work');
  frame();assert.ok(game.time>before);assert.ok(game.time-before<=96*REPLAY_TICK+1e-8);assert.equal(ends.length,0);
  while(q.size&&game.phase==='playing')frame();
  assert.equal(ends.length,1);
  while(watched.phase==='playing')stepArcade(watched,REPLAY_TICK);
  for(const key of ['phase','time','endReason','rng','stats','events']) assert.deepEqual(game[key],watched[key],key);
  assert.deepEqual(game.fighters.map(f=>f.moves),watched.fighters.map(f=>f.moves));
  frame();assert.equal(ends.length,1);
  playback.destroy();
});
test('closing a skip cancels it, and an exhausted safety deadline does not fabricate a result',()=>{
  const {canvas,frame,q}=harness();
  const make=()=>({width:960,height:540,round:1,phase:'playing',limit:1,time:0,events:[],fighters:[]});
  const rules={stepArcade(game){game.time+=REPLAY_TICK;},sampleArcadeFighter(){},arcadeBladeWorld(){return []},drawArcadeFighter(){}};
  const a=make(),b=make();let fallback=0,ends=0;
  const p=startArcadeTournamentPlayback(canvas,a,undefined,rules,{onEnd:()=>ends++});
  assert.equal(p.skip(),true);frame();const remaining=a.time;p.destroy();frame();
  assert.equal(a.time,remaining);assert.equal(q.size,0);
  const p2=startArcadeTournamentPlayback(canvas,b,undefined,rules,{onSkipError:()=>fallback++,onEnd:()=>ends++});
  assert.equal(p2.skip(),true);
  for(let i=0;i<400&&fallback===0;i++)frame();
  assert.equal(fallback,1);assert.equal(ends,0);assert.equal(b.phase,'playing');
  const before=b.time;frame(16);assert.ok(b.time>before);p2.destroy();
});

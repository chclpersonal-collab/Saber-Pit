import test from 'node:test';
import assert from 'node:assert/strict';
import {captureHeroWatch,heroWatchFrame} from '../dist/arcade-hero-watch.js';
const hero={id:'a',heroId:'savedA',alive:true,team:0,x:100,y:250};
const foe={id:'b',alive:true,team:1,x:160,y:250};
test('the follow camera selects live nearby rivals and never takes control',()=>{
  const far={...foe,id:'d',x:600}, near={...foe,id:'c',x:90}, ally={...foe,id:'x',team:0,x:101};
  assert.deepEqual(heroWatchFrame([hero,foe,far,ally,near],'a').map(f=>f.id),['a','c','b']);
  assert.deepEqual(heroWatchFrame([{...hero,control:true},foe],'a'),[]);
  assert.deepEqual(heroWatchFrame([{...hero,alive:false},foe],'a'),[]);
  assert.deepEqual(heroWatchFrame([hero,far],'a').map(f=>f.id),['a','d']);
});
test('Hero Watch reads real events and excludes interrupted relights from the count',()=>{
  const at=(kind,extra)=>({kind,fighterId:'a',time:1,...extra});
  const start=captureHeroWatch([at('trakata_off'),at('trakata_on',{interrupted:true})],[hero,foe]);
  assert.deepEqual(start.a,{relights:0,last:'Tràkata interrupted',time:1});
  const next=captureHeroWatch([at('trakata_on',{interrupted:false}),at('advanced_route',{route:'travel',time:2})],[hero,foe],start);
  assert.equal(next.a.relights,1);assert.equal(next.a.last,'Footwork follow-up');
  const ko=captureHeroWatch([{kind:'ko',fighterId:'b',targetId:'a',time:3}],[hero,{...foe,heroId:'savedB'}],next);
  assert.equal(ko.a.last,'Knocked out');assert.equal(ko.b.last,'Scored a knockout');
  assert.equal(start.a.relights,0);
});

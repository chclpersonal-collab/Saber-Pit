import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const emitted=basename(fileURLToPath(new URL('..',import.meta.url)))==='build';
import {readPad,createPadReader,createPadSeats,createPadLatch,padHeld,padStick,padAim} from '../dist/arcade-gamepad.js';

const pad=(index:number,pressed:number[]=[],axes=[0,0,0,0])=>({index,connected:true,mapping:'standard',axes,
  buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))});

test('controls held through Resume stay neutral until released or recentred, then a fresh input works',()=>{
  const latch=createPadLatch();
  let raw=[readPad(pad(0,[0,6],[1,0,0,1]))]; // Strike + Guard held, stick right, aiming down
  latch.hold(raw);latch.update(raw);
  let seen=latch.filter(raw);
  assert.equal(padHeld(seen,'strike'),false);assert.equal(padHeld(seen,'guard'),false);
  assert.equal(padStick(seen),null);assert.equal(padAim(seen,{x:0,y:0}),null);
  // A new button pressed after Resume is live straight away.
  raw=[readPad(pad(0,[0,6,3],[1,0,0,1]))];latch.update(raw);seen=latch.filter(raw);
  assert.equal(padHeld(seen,'jump'),true);assert.equal(padHeld(seen,'strike'),false);
  // Release Strike and recentre the sticks; Guard is still held.
  raw=[readPad(pad(0,[6]))];latch.update(raw);
  raw=[readPad(pad(0,[0,6],[0,-1,1,0]))];latch.update(raw);seen=latch.filter(raw);
  assert.equal(padHeld(seen,'strike'),true,'a fresh Strike press works');
  assert.equal(padHeld(seen,'guard'),false,'Guard held since before Resume stays neutral');
  assert.ok(padStick(seen)!.y<-.9,'a fresh stick push works');
  assert.ok(padAim(seen,{x:0,y:0})!.x>0,'a fresh aim works');
  raw=[readPad(pad(0))];latch.update(raw);
  raw=[readPad(pad(0,[6]))];latch.update(raw);
  assert.equal(padHeld(latch.filter(raw),'guard'),true);
  assert.equal(latch.active,false);
});

test('both local-versus seats keep their pads through the latch, and each seat is guarded on its own',()=>{
  const seats=createPadSeats(),latch=createPadLatch();
  let raw=[readPad(pad(0,[0],[-1,0,0,0])),readPad(pad(1,[1],[1,0,0,0]))];
  const first=seats.assign(raw,true);
  assert.deepEqual([first.p1[0]!.index,first.p2[0]!.index],[0,1]);
  latch.hold(raw);latch.update(raw);
  const held=seats.assign(raw,true);
  assert.deepEqual([held.p1[0]!.index,held.p2[0]!.index],[0,1],'seats unchanged while inputs are latched');
  assert.equal(padHeld(latch.filter(held.p1),'strike'),false);assert.equal(padHeld(latch.filter(held.p2),'dash'),false);
  raw=[readPad(pad(0)),readPad(pad(1,[1]))];latch.update(raw);
  raw=[readPad(pad(0,[0])),readPad(pad(1,[1]))];latch.update(raw);
  const after=seats.assign(raw,true);
  assert.equal(padHeld(latch.filter(after.p1),'strike'),true,'player one pressed again');
  assert.equal(padHeld(latch.filter(after.p2),'dash'),false,'player two is still holding the old Dash');
});

test('ordinary Menu still toggles once per press',()=>{
  let frame=[pad(0,[9])];const r=createPadReader(()=>frame);
  assert.equal(r.read()[0]!.pausePressed,true);
  assert.equal(r.read()[0]!.pausePressed,false);
  frame=[pad(0)];r.read();frame=[pad(0,[9])];
  assert.equal(r.read()[0]!.pausePressed,true);
});

test('the Arena consumes Menu and the scoreboard peek while a dialog is open, and latches pads on Resume',()=>{
  const src=readFileSync(new URL(emitted?'../../src/arcade.ts':'../src/arcade.ts',import.meta.url),'utf8');
  const poll=src.slice(src.indexOf('function pollPads(){'),src.indexOf('function setScene('));
  assert.match(poll,/const dialogOpen=Boolean\(settingsDialog\?\.open\|\|savedStatsDialog\?\.open\|\|\$\('keysDialog'\)\.open/);
  assert.match(poll,/if\(!dialogOpen&&view==='game'[^\n]*pausePressed\)\)pause\(!paused\)/);
  assert.match(poll,/const peek=!dialogOpen&&/);
  assert.ok(poll.indexOf('padLatch.update(pads)')<poll.indexOf('pause(!paused)'));
  const pause=src.slice(src.indexOf('function pause(value:boolean'),src.indexOf("$('pause').addEventListener"));
  assert.match(pause,/if\(!paused\)padLatch\.hold\(pads\)/);
  const inputs=src.slice(src.indexOf('function inputs(){'),src.indexOf('function pollPads(){'));
  assert.match(inputs,/p1=padLatch\.filter\(seats\.p1\),p2=padLatch\.filter\(seats\.p2\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readPad,createPadReader,assignPads,deadZone,padAim,padHeld,padStick} from '../dist/arcade-gamepad.js';

const pad=(index:number,pressed:number[]=[],axes=[0,0,0,0],values:Record<number,number>={})=>({index,connected:true,mapping:'standard',axes,
  buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:values[i]??(pressed.includes(i)?1:0)}))});

test('face buttons, bumpers and triggers map to Arena actions', () => {
  const s=readPad(pad(0,[0,2,4],[0,0,0,0],{6:.8}));
  assert.deepEqual([...s.held].sort(),['feint','guard','heavy','strike']);
  assert.equal(readPad(pad(0,[],[0,0,0,0],{6:.2})).held.has('guard'),false,'a light trigger brush is not a guard');
});

test('sticks have a dead zone and still reach full speed', () => {
  assert.deepEqual(deadZone(.1,.1),{x:0,y:0});
  const full=deadZone(1,0);assert.ok(Math.abs(full.x-1)<1e-9);
  const s=readPad(pad(0,[],[0,-1,.9,0]));
  assert.ok(s.stick.y<-.99);assert.ok(s.look&&s.look.x>.8);
  assert.deepEqual(padAim([s],{x:100,y:100},100)!.y,100);
});

test('Menu toggles pause once per press, not every frame it is held', () => {
  let frame=[pad(0,[9])];const r=createPadReader(()=>frame);
  assert.equal(r.read()[0]!.pausePressed,true);
  assert.equal(r.read()[0]!.pausePressed,false);
  frame=[pad(0)];r.read();frame=[pad(0,[9])];
  assert.equal(r.read()[0]!.pausePressed,true);
});

test('pads split between players in local versus', () => {
  const a=readPad(pad(0,[0])),b=readPad(pad(1,[1],[1,0,0,0]));
  assert.deepEqual(assignPads([a,b],false).p1.length,2);
  const two=assignPads([a,b],true);assert.ok(padHeld(two.p1,'strike')&&!padHeld(two.p1,'dash'));
  assert.ok(padHeld(two.p2,'dash'));assert.ok(padStick(two.p2)!.x>.9);
  const one=assignPads([a],true);assert.equal(one.p1.length,0);assert.equal(one.p2.length,1);
});

test('no gamepad support at all is fine', () => {
  assert.deepEqual(createPadReader(()=>{throw new Error('blocked');}).read(),[]);
  assert.deepEqual(createPadReader(()=>[null,null]).read(),[]);
});

test('two players on one device is never rated and never saved', async () => {
  const {arenaNormalRanked}=await import('../dist/arcade-normal-elo.js');
  const {isArenaSessionOnly}=await import('../dist/arcade-career.js');
  const match={mode:'duel',config:{rule:'elimination',teamSizes:[1,1]},fighters:[{id:'0-0',team:0},{id:'1-0',team:1}]};
  assert.equal(arenaNormalRanked(match),true,'an ordinary 1v1 still rates');
  assert.equal(arenaNormalRanked({...match,config:{...match.config,localVersus:true}}),false);
  assert.equal(isArenaSessionOnly({...match.config,localVersus:true}),true);
  assert.equal(isArenaSessionOnly(match.config),false);
});

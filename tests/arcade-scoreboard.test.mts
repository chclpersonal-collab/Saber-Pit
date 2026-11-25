import test from 'node:test';
import assert from 'node:assert/strict';
import {buildArenaScoreboard,scoreboardClock,scoreboardElo} from '../dist/arcade-scoreboard.js';
import type {ScoreboardFighter} from '../dist/arcade-scoreboard.js';

const fighter=(team:0|1,slot:number,extra:Partial<ScoreboardFighter>={}):ScoreboardFighter=>({
  id:team+'-'+slot,team,slot,control:false,alive:true,name:'Makashi',rank:'E',kills:0,deaths:0,damage:0,...extra,
});

test('rated rounds show every slot at its rated Elo, starting at 100',()=>{
  assert.equal(scoreboardElo(true,236,undefined),236);
  assert.equal(scoreboardElo(true,undefined,undefined),100);
  assert.equal(scoreboardElo(true,'tampered',undefined),100);
});
test('unrated rounds show a saved rating only where one exists',()=>{
  assert.equal(scoreboardElo(false,236,undefined),236);
  assert.equal(scoreboardElo(false,undefined,1210),1210);
  assert.equal(scoreboardElo(false,undefined,undefined),null);
  assert.equal(scoreboardElo(false,Number.NaN,Number.POSITIVE_INFINITY),null);
});
test('Control is unrated and scores by objective; unsaved fighters read as a dash',()=>{
  const m=buildArenaScoreboard({fighters:[fighter(0,0,{control:true,kills:4,deaths:1,damage:612.4,slotRating:236}),fighter(1,0,{kills:3,deaths:3,damage:570})],
    rule:'control',mapSize:'medium',round:2,secondsLeft:101.2,rated:false,objective:[7.0000001,4]});
  assert.deepEqual(m.score,[7,4]);
  assert.deepEqual(m.meta,['Control','Medium','1:42']);
  assert.equal(m.round,'Round 2');
  assert.equal(m.badge,'UNRATED');
  assert.deepEqual(m.teams[0].rows[0],{id:'0-0',name:'Makashi',rank:'E',k:4,d:1,dmg:612,elo:'236',me:true,ko:false});
  assert.equal(m.teams[1].rows[0]!.elo,'—');
  assert.equal(m.note,'');
});
test('Elimination scores by kills, sorts by K then D then damage, and keeps slot order on ties',()=>{
  const m=buildArenaScoreboard({fighters:[
    fighter(0,0,{name:'A',kills:1,deaths:1}),fighter(0,1,{name:'B',kills:2,deaths:1,alive:false}),fighter(0,2,{name:'C',kills:2,deaths:0}),
    fighter(0,3,{name:'D'}),fighter(0,4,{name:'E'}),fighter(1,0,{name:'F',kills:1}),
  ],rule:'elimination',mapSize:'large',round:1,secondsLeft:45,rated:true});
  assert.deepEqual(m.teams[0].rows.map(r=>r.name),['C','B','A','D','E']);
  assert.deepEqual(m.score,[5,1]);
  assert.equal(m.teams[0].alive,4);assert.equal(m.teams[0].total,5);
  assert.equal(m.teams[0].rows[1]!.ko,true);
  assert.equal(m.badge,'RATED');
  assert.ok(m.teams.flatMap(t=>t.rows).every(r=>r.elo==='100'));
});
test('15v15 keeps every fighter, each on their own side',()=>{
  const fighters=[0,1].flatMap(team=>Array.from({length:15},(_,slot)=>fighter(team as 0|1,slot)));
  const m=buildArenaScoreboard({fighters,rule:'elimination',mapSize:'large',round:1,secondsLeft:150,rated:true});
  assert.equal(m.teams[0].rows.length,15);assert.equal(m.teams[1].rows.length,15);
  assert.ok(m.teams[1].rows.every(r=>r.id.startsWith('1-')));
});
test('bad live numbers never reach the board',()=>{
  const m=buildArenaScoreboard({fighters:[fighter(0,0,{kills:-2,deaths:Number.NaN,damage:'9'})],rule:'relic',mapSize:'tiny',round:0,secondsLeft:-5,rated:false,objective:null});
  assert.deepEqual(m.teams[0].rows[0]!.k+m.teams[0].rows[0]!.d+m.teams[0].rows[0]!.dmg,0);
  assert.deepEqual(m.meta,['Relic','0:00']);
  assert.equal(m.round,'Round 1');
  assert.equal(scoreboardClock(59.01),'1:00');
});

test('a saved Hero shows their own Elo rather than the unrelated casual Arena slot rating',()=>{
  assert.equal(scoreboardElo(false,236,1661),1661);
  assert.equal(scoreboardElo(false,0,undefined),null);
  assert.equal(scoreboardElo(false,-1,-1),null);
});

test('key peek leaves focus alone; pinned Stats is a real modal with Escape, focus restore and details',async()=>{
  class NodeStub extends EventTarget{
    hidden=true;dataset:Record<string,string>={};attrs=new Map<string,string>();open=false;modal=false;isConnected=true;
    setAttribute(k:string,v:string){this.attrs.set(k,v);if(k==='open')this.open=true;}
    removeAttribute(k:string){this.attrs.delete(k);if(k==='open')this.open=false;}
    showModal(){assert.equal(this.open,false);this.modal=this.open=true;}
    close(){this.modal=this.open=false;}
    focus(){doc.activeElement=this;}
    querySelector(){return null;}
  }
  const root=new NodeStub(),toggle=new NodeStub(),close=new NodeStub(),detail=new NodeStub(),body=new NodeStub();
  const doc={body,activeElement:toggle};
  const keys=['document','HTMLElement'],previous=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
  Object.defineProperty(globalThis,'HTMLElement',{value:NodeStub,configurable:true});
  try{
    let pins=0,details=0,fallbacks=0,canOpen=true;
    const {mountArenaScoreboard}=await import('../dist/arcade-scoreboard-view.js');
    const board=mountArenaScoreboard({
      root:root as unknown as HTMLDialogElement,toggle:toggle as unknown as HTMLButtonElement,details:detail as unknown as HTMLButtonElement,close:close as unknown as HTMLButtonElement,
      canOpen:()=>canOpen,onUnavailable:()=>{fallbacks++;},onPin:()=>{pins++;},onDetails:()=>{assert.equal(root.modal,false);details++;},
      model:()=>buildArenaScoreboard({fighters:[fighter(0,0)],rule:'elimination',mapSize:'small',round:1,secondsLeft:25,rated:false}),
    });
    board.hold(true);
    assert.equal(root.modal,false);assert.equal(root.open,true);assert.equal(doc.activeElement,toggle);
    board.hold(false);assert.equal(root.open,false);
    board.hold(true);board.toggle();
    assert.equal(root.modal,true);assert.equal(pins,1);assert.equal(doc.activeElement,close);
    board.hold(false);assert.equal(root.modal,true);
    const esc=new Event('cancel',{cancelable:true});root.dispatchEvent(esc);assert.equal(esc.defaultPrevented,true);
    assert.equal(root.modal,false);assert.equal(doc.activeElement,toggle);
    board.toggle();detail.dispatchEvent(new Event('click'));assert.equal(details,1);assert.equal(root.modal,false);
    canOpen=false;board.hold(true);assert.equal(root.open,false);
    toggle.dispatchEvent(new Event('click'));assert.equal(fallbacks,1);assert.equal(root.modal,false);
  }finally{keys.forEach((key,i)=>{const p=previous[i];if(p)Object.defineProperty(globalThis,key,p);else Reflect.deleteProperty(globalThis,key);});}
});

test('fixed arena geometry displays the authored name before the clock',()=>{
  const m=buildArenaScoreboard({fighters:[],rule:'control',mapSize:'small',mapLabel:'Three Causeways',round:1,secondsLeft:43,rated:false});
  assert.deepEqual(m.meta,['Control','Three Causeways','0:43']);
});

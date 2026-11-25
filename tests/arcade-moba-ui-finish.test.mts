import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the real controller announces a natural core finish once and retry does not replay it',async t=>{
  const html=await readFile(new URL('../dist/moba.html',import.meta.url),'utf8');
  let frame,focus;
  const announcements=[];
  const ctx=new Proxy({}, {get:(o,k)=>o[k]??(['createLinearGradient','createRadialGradient'].includes(k)?()=>({addColorStop(){}}):()=>{})});
  class Element{
    constructor(id,dataset={}){this.id=id;this.dataset=dataset;this.hidden=false;this.disabled=false;this.content='';this.handlers={};this.attributes={};this.style={setProperty(){}};}
    get textContent(){return this.content;}
    set textContent(value){this.content=value;if(this.id==='announce')announcements.push(value);}
    addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
    dispatch(name,props={}){for(const fn of this.handlers[name]??[])fn({target:this,preventDefault(){},...props});}
    setAttribute(key,value){this.attributes[key]=value;}
    focus(){focus=this.id;}
    append(child){if(child.id)ids[child.id]=child;child.parentElement=this;}
    replaceChildren(...children){this.children=children;}
  }
  const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element(id)]));
  const lanes=[...html.matchAll(/data-lane="([^"]+)"/g)].map(([,lane])=>new Element('lane'+lane,{lane}));
  const buttons=[...html.matchAll(/data-control="([^"]+)"/g)].map(([,control])=>new Element(control,{control}));
  Object.assign(ids.field,{clientWidth:390,clientHeight:538,getContext:()=>ctx,parentElement:new Element('viewport')});
  const doc=Object.assign(new Element('document'),{
    getElementById:id=>ids[id],
    querySelectorAll:s=>s==='[data-lane]'?lanes:s==='[data-control]'?buttons:[],
    querySelector:s=>s.includes('data-lane')?lanes[1]:null,
    createElement:()=>Object.assign(new Element(''),{getContext:()=>ctx})
  });
  const mock={document:doc,window:new Element('window'),HTMLButtonElement:class extends Element{},HTMLAnchorElement:class extends Element{},
    matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>{frame=fn;return 1;}};
  for(const [key,value] of Object.entries(mock)){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else Reflect.deleteProperty(globalThis,key);});
  }
  t.mock.method(Date,'now',()=>1);
  t.mock.method(performance,'now',()=>0);
  await import('../dist/arcade-moba-ui.js');
  lanes[1].dispatch('click');assert.equal(focus,'field');
  assert.deepEqual([ids.blueStatus.attributes['data-towers'],ids.redStatus.attributes['data-core'],ids.blueKills.textContent],['3','shield','0']);
  let time=1000;
  const tick=()=>frame(time+=1000/20);
  // v6 AI: an idle player's four smart teammates hold about 250 s instead of 100 s, so allow up to 480 s.
  for(let i=0;i<9600&&ids.finished.hidden;i++)tick();
  assert.ok(!ids.finished.hidden,'match ended naturally');
  const fallen=[ids.blueStatus,ids.redStatus].find(x=>x.textContent.includes('0% Core'));
  assert.ok(fallen,'a core fell, rather than timeout');
  assert.equal(fallen.attributes['data-core'],'0');
  assert.match(fallen.attributes['data-towers'],/^[0-2]$/);
  assert.ok(parseInt(ids.blueKills.textContent,10)+parseInt(ids.redKills.textContent,10)>0);
  assert.equal(ids.redKills.attributes['aria-label'],'Pink knockouts: '+ids.redKills.textContent);
  assert.match(ids.result.textContent,/^(Defeat|Victory)$/);
  assert.equal(ids.announce.textContent,ids.result.textContent);
  assert.equal(announcements.filter(x=>x===ids.result.textContent).length,1);
  for(let i=0;i<30;i++)tick();
  assert.equal(ids.announce.textContent,ids.result.textContent);
  assert.equal(focus,'restart');
  ids.restart.dispatch('click');assert.equal(ids.announce.textContent,'');assert.equal(ids.clock.textContent,'10:00');
  assert.ok(ids.finished.hidden&&!ids.brief.hidden);
  lanes[1].dispatch('click');tick();
  assert.equal(ids.announce.textContent,'Deployed to Center');
  assert.equal(focus,'field');
  assert.match(ids.tacticalHint.textContent,/Wait for your first wave/);
  for(let i=0;i<12;i++)tick();
  assert.match(ids.tacticalHint.textContent,/Follow your first center wave/);
  assert.equal(ids.firstTowerPing.hidden,false);
  assert.ok(parseFloat(ids.firstTowerPing.style.left)>195,'tower direction from ally spawn points right');
  mock.window.dispatch('keydown',{target:ids.field,key:'m'});tick();
  assert.equal(ids.firstTowerPing.hidden,true,'overview shows the tower directly');
  mock.window.dispatch('keydown',{target:ids.field,key:'m'});tick();
  assert.equal(ids.firstTowerPing.hidden,false);
  mock.window.dispatch('keydown',{target:ids.field,key:'d'});
  for(let i=0;i<500&&ids.respawnOverlay.hidden;i++)tick();
  mock.window.dispatch('keyup',{target:ids.field,key:'d'});
  assert.equal(ids.respawnOverlay.hidden,false,'an unsupported sprint was knocked out by the real match');
  assert.ok(parseInt(ids.redKills.textContent,10)>=1,'real player knockout appears in the team KO count');
  assert.match(ids.respawnSource.textContent,/Knocked out by /);
  assert.match(ids.announce.textContent,/^Knocked out by /);
  assert.equal(ids.tacticalHint.hidden,true);
  assert.ok(buttons.every(x=>x.disabled));
  const before=ids.respawnClock.textContent;
  ids.pause.dispatch('click');
  assert.equal(ids.respawnPaused.hidden,false);
  for(let i=0;i<35;i++)tick();
  assert.equal(ids.respawnClock.textContent,before);
  ids.pause.dispatch('click');
  assert.equal(ids.respawnPaused.hidden,true);
  for(let i=0;i<370&&!ids.respawnOverlay.hidden;i++)tick();
  assert.equal(ids.respawnOverlay.hidden,true);
  assert.equal(ids.announce.textContent,'Respawned');
  assert.ok(buttons.every(x=>!x.disabled));
  assert.equal(ids.tacticalHint.hidden,false);
});

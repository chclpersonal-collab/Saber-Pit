import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the real controller announces a natural core finish once and retry does not replay it',async t=>{
  const html=await readFile(new URL('../dist/moba.html',import.meta.url),'utf8');
  let frame,focus;
  const announcements=[];
  const ctx=new Proxy({}, {get:(o,k)=>o[k]??(k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{})});
  class Element{
    constructor(id,dataset={}){this.id=id;this.dataset=dataset;this.hidden=false;this.disabled=false;this.content='';this.handlers={};}
    get textContent(){return this.content;}
    set textContent(value){this.content=value;if(this.id==='announce')announcements.push(value);}
    addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
    dispatch(name){for(const fn of this.handlers[name]??[])fn({target:this,preventDefault(){}});}
    setAttribute(){}
    focus(){focus=this.id;}
    append(){}
  }
  const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element(id)]));
  const lanes=[...html.matchAll(/data-lane="([^"]+)"/g)].map(([,lane])=>new Element('lane'+lane,{lane}));
  Object.assign(ids.field,{clientWidth:390,clientHeight:538,getContext:()=>ctx});
  const doc=Object.assign(new Element('document'),{
    getElementById:id=>ids[id],
    querySelectorAll:s=>s==='[data-lane]'?lanes:[],
    querySelector:s=>s.includes('data-lane')?lanes[1]:null,
    createElement:()=>({getContext:()=>ctx})
  });
  const mock={document:doc,window:new Element('window'),HTMLButtonElement:Element,HTMLAnchorElement:class{},
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
  let time=1000;
  const tick=()=>frame(time+=1000/20);
  for(let i=0;i<4800&&ids.finished.hidden;i++)tick();
  assert.ok(!ids.finished.hidden,'match ended naturally');
  assert.ok(ids.blueStatus.textContent.includes('0% Core')||ids.redStatus.textContent.includes('0% Core'),'a core fell, rather than timeout');
  assert.match(ids.result.textContent,/^(Citadel lost|Siege won)$/);
  assert.equal(ids.announce.textContent,ids.result.textContent);
  assert.equal(announcements.filter(x=>x===ids.result.textContent).length,1);
  for(let i=0;i<30;i++)tick();
  assert.equal(ids.announce.textContent,ids.result.textContent);
  assert.equal(focus,'restart');
  ids.restart.dispatch('click');assert.equal(ids.announce.textContent,'');assert.equal(ids.clock.textContent,'10:00');
  assert.ok(ids.finished.hidden&&!ids.brief.hidden);
  lanes[1].dispatch('click');tick();
  assert.equal(ids.announce.textContent,'Center front deployed.');
  assert.equal(focus,'field');
});

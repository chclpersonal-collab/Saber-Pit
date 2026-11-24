import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const shipped = new URL('../dist/',import.meta.url);
const frozen = new URL('../baseline/dist/',import.meta.url);
function fixture(){
  const entries=new Map<string, ReturnType<typeof element>>(), frames: FrameRequestCallback[]=[];
  const draw=new Proxy({} as Record<PropertyKey, unknown>, {get:(ctx,key)=>ctx[key]??(()=>{})});
  function element(id=''){
    const events: Record<string, () => unknown>={};
    const e={id,clientWidth:480,width:360,height:420,checked:id==='trails',
      value:id==='facing'?'1':id==='speed'?'1':'0',children:[] as unknown[],hidden:id==='error',
      classList:{toggle(){}},setAttribute(){},
      append(...items: unknown[]){this.children.push(...items);},
      replaceChildren(...items: unknown[]){this.children=items;},
      addEventListener(name: string,fn: () => unknown){events[name]=fn;},
      emit(name: string){return events[name]?.();},
      getContext(){return draw;}};
    return e;
  }
  const node=(id: string)=>{if(!entries.has(id))entries.set(id,element(id));return entries.get(id)!;};
  Object.assign(globalThis,{
    document:{getElementById:node,createElement:()=>element()},window:{},
    requestAnimationFrame:(fn: FrameRequestCallback)=>frames.push(fn),matchMedia:()=>({matches:false}),
  });
  return {node,frames};
}

test('built Animation Lab runs a checked external controller and matches the legacy browser hook',async()=>{
 const generated=await readFile(new URL('animation-lab.html',shipped),'utf8');
 assert.match(generated,/<script type="module" src="\.\/animation-lab\.js"><\/script>/);
 assert.doesNotMatch(generated,/<script type="module">/);
 const legacy=await readFile(new URL('animation-lab.html',frozen),'utf8');
 const script=legacy.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/from '\.\/([^']+)'/g,(_,path)=>`from '${new URL(path,frozen)}'`);
 const descriptors=Object.fromEntries(['document','window','requestAnimationFrame','matchMedia'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
   const old=fixture();
   await import('data:text/javascript;base64,'+Buffer.from(script).toString('base64'));
   const original=window.animationLab;
   assert.ok(original);
   const expected=original.definitions.map((_,i)=>[11,60,76].map(t=>original.sample(i,t)));
   old.node('reducePreview').checked=true;
   const expectedReduced=original.sample(6,18);
   const now=fixture();
   await import(new URL('animation-lab.js',shipped));
   const migrated=window.animationLab;
   assert.equal(now.node('error').hidden,true);
   assert.deepEqual(migrated.definitions,original.definitions);
   assert.deepEqual(migrated.definitions.map((_,i)=>[11,60,76].map(t=>migrated.sample(i,t))),expected);
   migrated.select(6);
   assert.match(now.node('strip-title').textContent,/corkscrew · keyframes/i);
   now.node('scrub').value='66';
   now.node('scrub').emit('input');
   assert.equal(now.node('clock').value,'Tick 66 / 95');
   assert.match(now.node('pairStatus').textContent,/Fixture tick 66/);
   now.node('reducePreview').checked=true;
   assert.deepEqual(migrated.sample(6,18),expectedReduced);
   assert.equal(now.frames.length,1,'controller queues one browser render loop');
 } finally {
   for(const [key,descriptor] of Object.entries(descriptors)){
     if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
   }
 }
});

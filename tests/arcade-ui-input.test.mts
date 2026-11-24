import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const emitted=basename(fileURLToPath(new URL('..',import.meta.url)))==='build';
const {arenaInputFrame,readTouchPrefs,touchPrefsKey} = await import(emitted?'../dist/arcade-ui-input.js':'../src/arcade-ui-input.ts');

test('keyboard overrides analog motion; tap-only actions retain their edge semantics',()=>{
  const active=new Set(['left','up','guard','phase','feint','jump','technique']);
  let reads=0;
  const options={held:action=>active.has(action),pulse:new Set(['strike','jump']),
    fromStick:{x:.65,y:-.35},aim:{x:37,y:73},touchWalk:true,technique:()=>{reads++;return 'air_cut';}};
  assert.deepEqual(arenaInputFrame(options,'hold'),{phase:false,feint:false,jump:true,x:-1,y:-1,
    walk:true,technique:'air_cut',force:false,order:'hold',strike:true,heavy:false,dash:false,guard:true,aimX:37,aimY:73});
  active.clear();options.pulse.clear();options.aim=null;
  const next=arenaInputFrame(options,null);
  assert.equal(reads,1,'selected technique is read only on actual input');
  assert.deepEqual([next.x,next.y,next.technique,next.order,next.aimX,next.aimY],[.65,-.35,null,null,undefined,undefined]);
});

test('touch preferences validate storage fields independently and tolerate blocked storage',()=>{
 const desc=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{
   let data='{"layout":"arrows","side":"invalid"}';
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(key){assert.equal(key,touchPrefsKey);return data;}}});
   assert.deepEqual(readTouchPrefs(),{layout:'arrows',side:'right'});
   data='{"side":"left"}';
   assert.deepEqual(readTouchPrefs(),{layout:'stick',side:'left'});
   data='{';
   assert.deepEqual(readTouchPrefs(),{layout:'stick',side:'right'});
   Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked');}});
   assert.deepEqual(readTouchPrefs(),{layout:'stick',side:'right'});
 }finally{
   if(desc)Object.defineProperty(globalThis,'localStorage',desc);else delete globalThis.localStorage;
 }
});

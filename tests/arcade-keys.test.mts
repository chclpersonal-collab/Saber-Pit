import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KEY_BINDINGS,KEY_BINDINGS_KEY,canBind,createHeldArenaKeys,isEditableTarget,keyLabel,keyMapFrom,loadKeyBindings,rebindKey,saveKeyBindings} from '../dist/arcade-keys.js';
const store=(seed:Record<string,string>={})=>{const map=new Map(Object.entries(seed));return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>void map.set(k,v),removeItem:(k:string)=>void map.delete(k),map};};
// The fixed map the Arena shipped with (arcade.ts before rebinding).
const ORIGINAL={q:'jump',x:'feint',v:'phase',r:'technique',c:'walk',f:'force',j:'strike',k:'heavy',shift:'dash',' ':'guard',w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};

test('defaults give exactly the original key map',()=>{
  assert.deepEqual(keyMapFrom(loadKeyBindings(store())),ORIGINAL);
  assert.deepEqual(keyMapFrom(loadKeyBindings(null)),ORIGINAL);
});
test('rebinding swaps with the old holder, so every action keeps one key',()=>{
  const next=rebindKey({...DEFAULT_KEY_BINDINGS},'strike','k')!;
  assert.equal(next.strike,'k');assert.equal(next.heavy,'j');
  assert.equal(new Set(Object.values(next)).size,Object.keys(next).length);
});
test('reserved keys cannot be bound',()=>{
  for(const k of ['Escape','p','P','Tab','Enter','F5','Meta'])assert.equal(canBind(k),false,k);
  assert.equal(rebindKey({...DEFAULT_KEY_BINDINGS},'strike','Escape'),null);
  assert.equal(canBind('l'),true);
});
test('save, load and reset round-trip; defaults leave nothing stored',()=>{
  const s=store();
  const next=rebindKey({...DEFAULT_KEY_BINDINGS},'strike','l')!;
  assert.ok(saveKeyBindings(next,s));
  assert.deepEqual(JSON.parse(s.map.get(KEY_BINDINGS_KEY)!),{strike:'l'});
  const map=keyMapFrom(loadKeyBindings(s));
  assert.equal(map.l,'strike');assert.equal(map.j,undefined);
  assert.ok(saveKeyBindings({...DEFAULT_KEY_BINDINGS},s));
  assert.equal(s.map.has(KEY_BINDINGS_KEY),false);
  assert.deepEqual(keyMapFrom(loadKeyBindings(s)),ORIGINAL);
});
test('taking an arrow for an action drops that arrow from movement only',()=>{
  const next=rebindKey({...DEFAULT_KEY_BINDINGS},'guard','ArrowDown')!;
  const map=keyMapFrom(next);
  assert.equal(map.arrowdown,'guard');assert.equal(map.s,'down');assert.equal(map.arrowup,'up');
});
test('bad or tampered saves fall back to defaults',()=>{
  for(const raw of ['not json','[]','{"strike":"escape"}','{"strike":"k"}','{"nope":"l"}','{"strike":5}']){
    const map=keyMapFrom(loadKeyBindings(store({[KEY_BINDINGS_KEY]:raw})));
    assert.deepEqual(map,ORIGINAL,raw);
  }
});
test('labels and editable targets',()=>{
  assert.equal(keyLabel(' '),'Space');assert.equal(keyLabel('shift'),'Shift');assert.equal(keyLabel('j'),'J');assert.equal(keyLabel('arrowleft'),'←');
  for(const tagName of ['INPUT','TEXTAREA','SELECT'])assert.equal(isEditableTarget({tagName} as unknown as EventTarget),true);
  assert.equal(isEditableTarget({tagName:'DIV',isContentEditable:true} as unknown as EventTarget),true);
  assert.equal(isEditableTarget({tagName:'CANVAS'} as unknown as EventTarget),false);
  assert.equal(isEditableTarget(null),false);
});

test('physical release clears modified symbols, while a held movement alias remains active',()=>{
  const keys=new Set<string>(), held=createHeldArenaKeys(keys);
  held.press({code:'KeyW',key:'w'},'up');
  held.press({code:'ArrowUp',key:'ArrowUp'},'up');
  held.release({code:'KeyW',key:'W'});assert.deepEqual([...keys],['up']);
  held.press({code:'Slash',key:'?'},'strike');
  held.release({code:'Slash',key:'/'});assert.deepEqual([...keys],['up']);
  held.release({code:'ArrowUp',key:'ArrowUp'});assert.deepEqual([...keys],[]);
  held.press({code:'Space',key:' '},'guard');held.clear();assert.deepEqual([...keys],[]);
});
test('device bindings do not arrive in a second storage profile',()=>{
  const a=store(),b=store();
  saveKeyBindings(rebindKey(loadKeyBindings(a),'strike',' ')!,a);
  assert.equal(keyMapFrom(loadKeyBindings(a))[' '],'strike');
  assert.equal(keyMapFrom(loadKeyBindings(b))[' '],'guard');
  for(const key of ['Process','Compose','Unidentified','constructor','__proto__','a'.repeat(33)])assert.equal(canBind(key),false);
});

test('panel cancels a capture on Escape or Tab; Space can be bound and saves on this profile',async()=>{
  class NodeStub extends EventTarget {
    dataset: Record<string,string>={}; children:NodeStub[]=[]; textContent=''; disabled=false; open=false; focused=false; type='';
    append(...nodes:NodeStub[]){this.children.push(...nodes);}
    replaceChildren(...nodes:NodeStub[]){this.children=nodes;}
    setAttribute(){}
    focus(){this.focused=true;}
    showModal(){this.open=true;}
    querySelector(q:string){return this.children.flatMap(n=>n.children).find(n=>q===`[data-bind="${n.dataset.bind}"]`);}
  }
  const panel=new NodeStub(),list=new NodeStub(),status=new NodeStub(),reset=new NodeStub();
  const nodes:Record<string,NodeStub>={keysDialog:panel,keysList:list,keysStatus:status,keysReset:reset};
  const s=store();
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const set=(name:string,value:unknown)=>Object.defineProperty(globalThis,name,{value,configurable:true});
  const restore=(name:string,prior?:PropertyDescriptor)=>prior?Object.defineProperty(globalThis,name,prior):Reflect.deleteProperty(globalThis,name);
  set('document',{getElementById:(name:string)=>nodes[name],createElement:()=>new NodeStub()});
  set('localStorage',s);
  try{
    const {mountKeysPanel}=await import('../dist/arcade-keys-panel.js');
    const updates:unknown[]=[];
    const api=mountKeysPanel(map=>updates.push(map));api.open();assert.equal(panel.open,true);
    const capture=()=>{
      const click=new Event('click',{cancelable:true});
      Object.defineProperty(click,'target',{value:{closest:()=>({dataset:{bind:'strike'}})}});
      list.dispatchEvent(click);assert.match(status.textContent,/Press a key/);
    };
    const press=(key:string)=>{
      const event=new Event('keydown',{cancelable:true});
      Object.assign(event,{key,repeat:false});panel.dispatchEvent(event);return event.defaultPrevented;
    };
    capture();assert.equal(press('Escape'),true);assert.equal(updates.length,0);assert.match(status.textContent,/Kept/);
    capture();assert.equal(press('Tab'),false);assert.equal(updates.length,0);
    capture();assert.equal(press(' '),true);assert.equal(updates.length,1);assert.equal(api.bindings().strike,' ');
    assert.equal(loadKeyBindings(s).guard,'j');
    panel.dispatchEvent(new Event('close'));assert.equal(status.textContent,'');
  }finally{restore('document',originalDocument);restore('localStorage',originalStorage);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KEY_BINDINGS,KEY_BINDINGS_KEY,canBind,isEditableTarget,keyLabel,keyMapFrom,loadKeyBindings,rebindKey,saveKeyBindings} from '../dist/arcade-keys.js';
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

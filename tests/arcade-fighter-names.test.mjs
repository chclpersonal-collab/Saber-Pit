import test from 'node:test';
import assert from 'node:assert/strict';
import {fighterDisplayName,fighterNameParts,fighterNameKeysGiven as names,fighterNameKeysFamily as families} from '../dist/arcade-fighter-names.js';

test('all generated identities are distinct and the pool spans 2–7 authored syllables',()=>{
  const recorded=new Set(),counts=new Map();
  for(const [i,a] of names.entries())for(const [j,b] of families.entries()){
    const id='f-'+a.toLowerCase()+'-'+b.toLowerCase(), legacy=a+' '+b;
    const parts=fighterNameParts(i,j), n=parts.flat().length;
    const name=parts.map(p=>p.join('')).join(' ');
    counts.set(n,(counts.get(n)??0)+1);
    assert.equal(fighterDisplayName(id,legacy),name);
    assert.equal(fighterDisplayName(id,name),name);
    assert.ok(!recorded.has(name));
    recorded.add(name);
  }
  assert.deepEqual([...counts.keys()].sort(),[2,3,4,5,6,7]);
  assert.ok(counts.get(3)>counts.get(2)+counts.get(7));
});
test('both previously generated styles migrate, but a personal name does not',()=>{
  const key='f-briallen-coldwater';
  assert.equal(fighterDisplayName(key,'Briallen Coldwater'),'Tseokaishi Seok');
  assert.equal(fighterDisplayName(key,'Tseokai Qoriseon'),'Tseokaishi Seok');
  assert.equal(fighterDisplayName(key,'Moon in Glass'),'Moon in Glass');
  assert.equal(fighterDisplayName('f-standalone','Tseokai Qoriseon'),'Tseokai Qoriseon');
});

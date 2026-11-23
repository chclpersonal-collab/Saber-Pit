import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseRecruitFamily, recruitFighterFamilies, fighterFamilyName, fighterDisplayName,
  fighterNameParts, fighterNameKeysGiven, fighterNameKeysFamily
} from '../dist/arcade-fighter-names.js';

test('expanded recruitment pool has 448 clean, distinct surnames outside the old generated catalog',()=>{
  const pool=new Set(recruitFighterFamilies.map(name=>name.toLowerCase()));
  assert.equal(pool.size,448);
  assert.equal(recruitFighterFamilies.length,pool.size);
  assert.ok(recruitFighterFamilies.every(name=>/^[A-Z][a-z]{2,15}$/.test(name)));
  for(const i of fighterNameKeysGiven.keys())for(const j of fighterNameKeysFamily.keys()){
    const family=fighterNameParts(i,j)[1].join('').toLowerCase();
    assert.ok(!pool.has(family),family);
    assert.ok(!pool.has(fighterNameKeysFamily[j].toLowerCase()));
  }
});

test('recruits skip occupied surnames case-insensitively until the pool is exhausted',()=>{
  const seed=7173;
  const occupied=new Set();
  const initial=chooseRecruitFamily(seed);
  for(let i=0;i<recruitFighterFamilies.length;i++){
    const candidate=chooseRecruitFamily(seed,occupied);
    assert.ok(!occupied.has(' '+candidate.toUpperCase()+' '));
    occupied.add(' '+candidate.toUpperCase()+' ');
  }
  assert.equal(chooseRecruitFamily(seed,occupied),initial);
  assert.equal(chooseRecruitFamily(seed),initial);
});

test('same-surname veterans, new display names, and custom Hero names remain intact',()=>{
  assert.equal(fighterFamilyName('  Mirehan  Qiondae  '),'Qiondae');
  assert.equal(fighterFamilyName('Mirehan Qiondae 7-X'),'Qiondae');
  assert.equal(fighterDisplayName('f-standalone','Mirehan Qiondae'),'Mirehan Qiondae');
  assert.equal(fighterDisplayName('f-briallen-coldwater','Tseokaishi '+chooseRecruitFamily(24)),
    'Tseokaishi '+chooseRecruitFamily(24));
  assert.equal(fighterDisplayName('f-briallen-coldwater','Moon in Glass'),'Moon in Glass');
  assert.equal(fighterDisplayName('f-7-x','Briallen Coldwater 7-X'),'Tseokaishi Seok 7-X');
});

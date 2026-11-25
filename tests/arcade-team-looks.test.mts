import {arenaFighterAppearance} from "../dist/arcade-team-looks.js";
import assert from 'node:assert/strict';
import test from 'node:test';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {normalizeSetup,saveSetup,loadSetup} from '../dist/arcade-setup.js';
import {appearanceSeedFor} from '../dist/arcade-fighter-profiles.js';

test('legacy defaults and explicit default values introduce no additional saved setup or simulation options',()=>{
  const a=normalizeSetup(), b=normalizeSetup({teamGenders:['default','nonsense'],teamAppearances:['default']});
  assert.deepEqual(a,b);
  assert.equal(Object.hasOwn(a,'teamGenders'),false);assert.equal(Object.hasOwn(a,'teamAppearances'),false);
  const x=createArcade({mode:'watch',seed:90}), y=createArcade({mode:'watch',seed:90,teamGenders:['default'],teamAppearances:[null]});
  for(let n=0;n<300;n++){stepArcade(x,1/60);stepArcade(y,1/60);}
  assert.deepEqual(x,y);
});
test('team gender and appearance are independent seeded selections; real Heroes retain identity and appearance',()=>{
  const setup=normalizeSetup({teamGenders:['mixed','female'],teamAppearances:['rabbit','mixed'],teamSizes:[6,6]});
  let raw=''; const disk={setItem(_:string,data:string){raw=data;},getItem(){return raw;}};
  assert.ok(saveSetup(setup,disk));assert.deepEqual(loadSetup(disk),setup);
  const options={...setup,mode:'watch',seed:467,heroLineup:{'1-0':{id:'signed',name:'Named Hero',body:'femboy',gender:'nonbinary',appearanceSeed:279,form:'ataru'}}};
  const a=createArcade(options), b=createArcade(options);
  const profile=(g:typeof a)=>g.fighters.map(f=>[f.id,f.body,f.gender,f.appearanceSeed,f.displayName]);
  assert.deepEqual(profile(a),profile(b));
  assert.deepEqual(new Set(a.fighters.filter(f=>f.team===0).map(f=>f.gender)),new Set(['female','male','nonbinary']));
  assert.ok(a.fighters.filter(f=>f.team===0).every(f=>f.body==='rabbit'));
  const enemy=a.fighters.filter(f=>f.team===1);
  assert.deepEqual(new Set(enemy.slice(1).map(f=>f.body)),new Set(['rabbit','woman','femboy']));
  assert.ok(enemy.slice(1).every(f=>f.gender==='female'));
  assert.deepEqual(profile(a).find(row=>row[0]==='1-0'),['1-0','femboy','nonbinary',appearanceSeedFor('signed'),'Named Hero']);
  const firstSeats=new Set(Array.from({length:12},(_,seed)=>createArcade({...options,seed:seed+1}).fighters[0].gender));
  assert.equal(firstSeats.size,3);
});

test('two-seat Mixed inspections show the resolved distinct fighters, and Hero looks take precedence',()=>{
  const options={mode:'watch',seed:51,teamSizes:[2,2],teamGenders:['mixed','mixed'],teamAppearances:['mixed','mixed']};
  const first=createArcade(options), same=createArcade(options);
  const card=(game:typeof first)=>game.fighters.map(arenaFighterAppearance);
  assert.deepEqual(card(first),card(same));
  for(const team of [0,1]){
    const [a,b]=first.fighters.filter(f=>f.team===team).map(arenaFighterAppearance);
    assert.notEqual(a.gender,b.gender);
    assert.notEqual(a.appearance,b.appearance);
    assert.equal(a.source,'Roster');
    assert.equal(b.source,'Roster');
    assert.notEqual(a.gender,'Mixed');assert.notEqual(a.appearance,'Mixed');
  }
  const saved=createArcade({...options,heroLineup:{'0-1':{id:'signed',name:'Named Hero',body:'rabbit',gender:'nonbinary',form:'ataru'}}});
  assert.deepEqual(arenaFighterAppearance(saved.fighters.find(x=>x.id==='0-1')!),
    {gender:'Nonbinary',appearance:'Rabbit',source:'Saved Hero'});
});

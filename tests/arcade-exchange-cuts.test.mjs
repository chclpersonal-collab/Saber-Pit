import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_EXCHANGE_CUT_ROWS} from '../dist/arcade-exchange-cuts.js';

test('two new physically distinct choreographies are defined for every saber form',()=>{
 const kits=Object.entries(ARCADE_EXCHANGE_CUT_ROWS),ids=new Set(),motion=new Set(),release=new Set();
 assert.equal(kits.length,7);
 for(const [form,kit] of kits){
   assert.equal(kit.length,2,form);
   for(const [id,name,grade,role,action,,spec,extra] of kit){
     assert.ok(id.startsWith('ex_')&&ids.add(id)&&name,form);
     assert.ok(Number.isInteger(grade)&&grade>=1&&grade<=14,id);
     assert.ok(['light','heavy','counter','crowd'].includes(role),id);
     assert.ok(['slash','sweep','rush','uppercut'].includes(action),id);
     const [contact,duration,reach,arc,damage,cost,lunge]=spec;
     assert.ok(contact>0&&duration>contact&&reach>0&&arc>0&&damage>0&&cost>0&&lunge>0,id);
     const trajectory=JSON.stringify(extra.motion), silhouette=[contact,reach,arc,lunge].join(',');
     assert.ok(!motion.has(trajectory)&&!release.has(silhouette),id);
     motion.add(trajectory);release.add(silhouette);
     assert.ok(Object.isFrozen(spec)&&Object.isFrozen(extra)&&Object.isFrozen(extra.motion),id);
   }
 }
 assert.equal(ids.size,14);
});
test('new exchanges include different actual game paths and tactical mechanics',()=>{
 const specs=Object.values(ARCADE_EXCHANGE_CUT_ROWS).flat().map(row=>row[7]);
 for(const air of ['crossVault','highVault'])assert.ok(specs.some(s=>s.air===air));
 for(const route of ['moving_guard','feint_redirect','slip_counter'])assert.ok(specs.some(s=>s.tactical===route));
 assert.ok(specs.some(s=>s.launch===true));
 assert.ok(specs.some(s=>s.deflect===true));
 assert.ok(specs.some(s=>s.cap===3));
});

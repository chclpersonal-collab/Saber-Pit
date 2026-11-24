import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const asset=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('the published build label matches the package patch on the main screens',()=>{
 const parts=JSON.parse(asset('package.json')).version.split('.');
 const label=[parts[0],parts[1].padStart(2,'0'),parts[2]].join('.');
 for(const name of ['index','style-lab','tournament','gauntlet','idle-rpg']){
   assert.ok(asset('dist/'+name+'.html').includes(label),name+' must visibly show '+label);
 }
});

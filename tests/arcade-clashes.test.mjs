import test from 'node:test';
import assert from 'node:assert/strict';
import {activeClashBlade,bladeIntersection,findArcadeBladeContact} from '../dist/arcade-clashes.js';
const line=(a,b)=>({hand:{x:a[0],y:a[1]},tip:{x:b[0],y:b[1]}});
test('an intersection sits exactly on the two blades, not at their wielder positions',()=>{
  const p=bladeIntersection(line([0,0],[34,34]),line([0,34],[34,0]));
  assert.equal(p.x,17);assert.equal(p.y,17);
});
test('collinear clashes work, parallel blades apart and hilt-only contact do not',()=>{
  assert.ok(bladeIntersection(line([0,0],[26,0]),line([30,0],[4,0])));
  assert.equal(bladeIntersection(line([0,0],[25,0]),line([0,6],[25,6])),null);
  assert.equal(bladeIntersection(line([0,0],[40,0]),line([-15,-10],[-1,3])),null);
});
test('requires real release phase; startup, completed attacks and Force cannot clash',()=>{
  const a={hp:100,actionTime:.16,attack:'slash',attackSpec:{contact:.2}};
  assert.equal(activeClashBlade(a),true);
  assert.equal(activeClashBlade({...a,contact:true}),false);
  assert.equal(activeClashBlade({...a,attack:'force'}),false);
  assert.equal(activeClashBlade({...a,actionTime:.05}),false);
  assert.equal(activeClashBlade({...a,actionTime:.4}),false);
});
test('never clashes separated layers or two allies',()=>{
  const a={team:0,x:400,y:300,attack:'slash',hp:90,actionTime:.20,attackSpec:{contact:.24}};
  for(const b of [{...a,x:440,team:1,y:340},{...a,x:440,airHeight:45,team:1},{...a,x:440,team:0}]){
    assert.equal(findArcadeBladeContact({fighters:[a,b],time:1}),null);
  }
});
test('offhand can clash during its own release after the first blade already resolved',()=>{
  const a={hp:100,actionTime:.27,attack:'slash',contact:true,attackSpec:{contact:.2,offhand:{contact:.31}},gear:{dualSabers:true}};
  assert.equal(activeClashBlade(a),true);
  assert.equal(activeClashBlade({...a,offhandContact:true}),false);
  assert.equal(activeClashBlade({...a,gear:{dualSabers:false}}),false);
});

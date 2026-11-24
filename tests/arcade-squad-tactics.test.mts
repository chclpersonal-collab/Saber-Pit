import test from 'node:test';
import assert from 'node:assert/strict';
import {planArcadeSquad,assignArcadeSquadRoles,arcadeSquadFocus,arcadeSquadCoordination,arcadeSquadSkills} from '../dist/arcade-squad-tactics.js';

type U={id:string;x:number;y:number;hp:number;energy:number;gradeIndex:number;alive:boolean};
const unit=(id:string,x:number,y:number,over:Partial<U>={}):U=>({id,x,y,hp:100,energy:100,gradeIndex:0,alive:true,...over});
const squad=(grade:number,x:number,over:Partial<U>[]=[])=>['a','b','c'].map((id,i)=>unit(id,x,300+i*58,{gradeIndex:grade,...over[i]}));
const foes=(x:number,over:Partial<U>[]=[])=>['x','y','z'].map((id,i)=>unit(id,x,300+i*58,over[i]));

test('coordination follows rank and unlocks skills in order',()=>{
  assert.equal(arcadeSquadCoordination(squad(0,100)),0);
  assert.equal(arcadeSquadCoordination(squad(14,100)),1);
  const f=arcadeSquadSkills(0),a=arcadeSquadSkills(5/14);
  assert.equal(f.focus,false);assert.equal(f.peel,false);assert.equal(f.staggeredEngage,false);
  assert.equal(a.focus,true);assert.equal(a.peel,true);assert.equal(a.staggeredEngage,true);
});

test('roles: strongest hold the front, most hurt supports',()=>{
  const roles=assignArcadeSquadRoles(squad(5,100,[{hp:90},{hp:100},{hp:40}]));
  assert.equal(roles.b,'frontline');
  assert.equal(roles.c,'support');
  assert.equal(Object.keys(roles).length,3);
});

test('focus picks the hurt foe two allies can reach',()=>{
  const id=arcadeSquadFocus(squad(5,300),foes(420,[{hp:80},{hp:30},{hp:90}]));
  assert.equal(id,'y');
});

test('an F squad charges at once and never peels',()=>{
  const plan=planArcadeSquad({allies:squad(0,100,[{hp:20}]),foes:foes(160),formation:'line',doctrine:'balanced'});
  assert.equal(plan.phase,'engage');
  assert.equal(plan.focusId,null);
  assert.ok(Object.values(plan.orders).every(o=>o.kind==='engage'));
});

test('a trained squad forms up before engaging from range',()=>{
  const allies=[unit('a',100,100,{gradeIndex:8}),unit('b',100,420,{gradeIndex:8}),unit('c',260,260,{gradeIndex:8})];
  const plan=planArcadeSquad({allies,foes:foes(900),formation:'line',doctrine:'balanced'});
  assert.ok(plan.phase==='form'||plan.phase==='regroup');
  assert.ok(Object.values(plan.orders).every(o=>o.kind==='slot'||o.kind==='regroup'));
});

test('a trained squad peels for a hurt ally under threat',()=>{
  const allies=squad(8,300,[{hp:90},{hp:20},{hp:90}]);
  const plan=planArcadeSquad({allies,foes:foes(360),formation:'line',doctrine:'balanced',previous:'engage'});
  assert.equal(plan.orders.b.kind,'retreat');
  assert.ok(Object.values(plan.orders).some(o=>o.kind==='peel'));
});

test('a losing trained squad retreats, an F squad does not',()=>{
  const hurt=[{hp:20},{hp:25},{hp:30}];
  assert.equal(planArcadeSquad({allies:squad(8,300,hurt),foes:foes(500),formation:'line',doctrine:'balanced'}).phase,'retreat');
  assert.notEqual(planArcadeSquad({allies:squad(0,300,hurt),foes:foes(500),formation:'line',doctrine:'balanced'}).phase,'retreat');
});

test('defensive squads hold until contact',()=>{
  const plan=planArcadeSquad({allies:squad(8,100),foes:foes(900),formation:'line',doctrine:'defensive'});
  assert.equal(plan.phase,'hold');
});

test('plans are deterministic, frozen and ignore dead units',()=>{
  const allies=squad(8,300,[{},{alive:false},{}]);
  const s={allies,foes:foes(380),formation:'wedge' as const,doctrine:'balanced' as const};
  assert.deepEqual(planArcadeSquad(s),planArcadeSquad(s));
  const plan=planArcadeSquad(s);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.orders));
  assert.equal(plan.orders.b,undefined);
});

import {assignArcadeSquadTargets,arcadeSquadSpacing,ARCADE_SQUAD_MIN_GAP} from '../dist/arcade-squad-tactics.js';

// The reported team fight: about twenty fighters in one column.
const blob=(team:string,n:number,x:number,grade:number)=>Array.from({length:n},(_,i)=>unit(team+i,x+(i%2)*6,200+i*9,{gradeIndex:grade}));

test('no foe is ganged by more than the cap in a big fight',()=>{
  for(const grade of [0,8]){
    const allies=blob('a',10,300,grade),enemies=blob('e',10,330,0);
    const plan=planArcadeSquad({allies,foes:enemies,formation:'line',doctrine:'aggressive',previous:'engage'});
    const per:Record<string,number>={};
    for(const o of Object.values(plan.orders))if(o.targetId&&o.kind!=='peel')per[o.targetId]=(per[o.targetId]??0)+1;
    const cap=arcadeSquadSkills(arcadeSquadCoordination(allies)).maxPerTarget;
    assert.ok(Math.max(...Object.values(per))<=cap,`grade ${grade}: ${JSON.stringify(per)}`);
    assert.ok(Object.keys(per).length>=4,'the fight spreads over several foes');
  }
});

test('targets fill the focus first, then spread',()=>{
  const allies=squad(8,300).concat([unit('d',300,474,{gradeIndex:8}),unit('e',300,532,{gradeIndex:8})]);
  const out=assignArcadeSquadTargets(allies,foes(380),'y',3);
  assert.equal(Object.values(out).filter(t=>t==='y').length,3);
  assert.equal(Object.keys(out).length,5);
});

test('two attackers on one foe come from different sides',()=>{
  const allies=[unit('a',300,300,{gradeIndex:8}),unit('b',300,320,{gradeIndex:8})];
  const plan=planArcadeSquad({allies,foes:[unit('x',380,310)],formation:'line',doctrine:'aggressive',previous:'engage'});
  const a=plan.orders.a,b=plan.orders.b;
  assert.equal(a.targetId,'x');assert.equal(b.targetId,'x');
  assert.ok(Math.hypot(a.x!-b.x!,a.y!-b.y!)>=40);
});

test('spacing pushes stacked allies apart and leaves spread ones alone',()=>{
  const stacked=[unit('a',300,300),unit('b',300,300),unit('c',310,300)];
  const push=arcadeSquadSpacing(stacked);
  assert.ok(push.a&&push.b&&push.c);
  assert.ok(Math.hypot(push.a.x-push.b.x,push.a.y-push.b.y)>0);
  assert.deepEqual(arcadeSquadSpacing(stacked),push);
  assert.deepEqual(arcadeSquadSpacing([unit('a',0,0),unit('b',ARCADE_SQUAD_MIN_GAP+1,0)]),{});
});

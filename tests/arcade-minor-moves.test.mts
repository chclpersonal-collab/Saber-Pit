import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_MINOR_MOVES,MINOR_MOVE_HINTS} from '../dist/arcade-minor-moves.js';
import {ARCADE_TECHNIQUES,ARCADE_REPERTOIRE,arcadeMovesFor} from '../dist/arcade-repertoire.js';

test('v3.01 has seven unique physical saber phrases, one per form',()=>{
  assert.equal(ARCADE_MINOR_MOVES.length,7);
  assert.deepEqual(new Set(ARCADE_MINOR_MOVES.map(m=>m.form)),new Set(Object.keys(ARCADE_REPERTOIRE)));
  const known=new Set(), motions=new Set();
  for(const m of ARCADE_MINOR_MOVES){
    assert.ok(m.minorMove&&!m.forceAbility);assert.deepEqual(ARCADE_TECHNIQUES[m.id],m);
    assert.ok(m.contact>0&&m.duration>m.contact&&m.reach>0&&m.cost>0&&m.cap>=1);
    assert.ok(m.minRank>0&&m.minRank<=14);
    assert.ok(m.motion&&Object.isFrozen(m.motion)&&Object.isFrozen(m));
    assert.match(MINOR_MOVE_HINTS[m.id],/\w/);
    assert.ok(!known.has(m.id)&&!motions.has(JSON.stringify(m.motion)));
    known.add(m.id);motions.add(JSON.stringify(m.motion));
  }
  assert.equal(ARCADE_MINOR_MOVES.find(m=>m.form==='ataru').air,'crossVault');
  assert.equal(ARCADE_MINOR_MOVES.find(m=>m.form==='djem_so').launch,true);
  assert.equal(ARCADE_MINOR_MOVES.find(m=>m.form==='soresu').deflect,true);
});

test('v3.01 options never leak into default/older pools or lower ranks',()=>{
  const switches=['tactical','rankCuts','circuitCuts','arenaCuts','exchangeVariety'];
  for(let bits=0;bits<32;bits++){
    const options=Object.fromEntries(switches.map((name,i)=>[name,Boolean(bits&(1<<i))]));
    for(const m of ARCADE_MINOR_MOVES){
      for(let rank=0;rank<=14;rank++){
        const legacy=arcadeMovesFor(m.form,rank,options);
        const newer=arcadeMovesFor(m.form,rank,{...options,minorMoves:true});
        assert.equal(legacy.some(word=>word.minorMove),false);
        assert.deepEqual(newer.filter(word=>!word.minorMove),legacy);
        assert.deepEqual(newer.filter(word=>word.minorMove),rank>=m.minRank?[m]:[]);
      }
    }
  }
});

test('every unlocked phrase makes real contact with all five saber rigs',async()=>{
  const {createArcade,stepArcade}=await import('../dist/arcade-engine.js');
  const {SOLDIER_GRADES}=await import('../dist/progression.js');
  const grade=i=>SOLDIER_GRADES[i].label;
  const setups=[['single','forward'],['single','backhand'],['dual','forward'],['dual','backhand'],['staff','forward']];
  function attempt(move,[weapon,grip],minorMoves,rank){
    const s=createArcade({mode:'duel',form:move.form,minorMoves,weaponFlow:true,seed:123,
      startingRanks:[rank,rank],startingSaberWeapon:[weapon,'single'],startingSaberGrip:[grip,'forward']});
    const [a,b]=s.fighters;
    Object.assign(a,{x:500,y:340,face:0});
    Object.assign(b,{x:566,y:340,face:Math.PI,action:'stagger',actionDuration:50,think:99});
    stepArcade(s,1/120,{technique:move.id,aimX:b.x,aimY:b.y});
    const committed=s.events.some(e=>e.technique===move.id&&e.contact>0);
    if(!committed)return {committed,hit:false};
    for(let i=0;i<105;i++)stepArcade(s,1/120);
    const hit=s.events.some(e=>e.technique===move.id&&['hit','launch'].includes(e.kind)&&e.fighterId===a.id&&e.targetId===b.id);
    return {committed,hit};
  }
  for(const move of ARCADE_MINOR_MOVES){
    assert.equal(attempt(move,setups[0],true,grade(move.minRank-1)).committed,false,move.id+' rank locked');
    assert.equal(attempt(move,setups[0],false,grade(14)).committed,false,move.id+' off by default');
    for(const kit of setups)assert.deepEqual(attempt(move,kit,true,grade(move.minRank)),{committed:true,hit:true},move.id+' '+kit.join('/'));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const dt=1/120, config={mode:'watch',limit:45,seed:117931,terrain:'underpit',
  teamSizes:[1,1],teamForms:['shii_cho','ataru'],chessStyles:['king','bishop'],
  startingRanks:['SSS+V','SSS+V'],continuousCombat:true,weaponFlow:true};
test('anticipation is opt-in and leaves legacy arena and replay trajectory untouched',()=>{
  const a=createArcade(config),b=createArcade({...config,anticipatingCombat:false});
  for(let n=0;n<1100;n++){stepArcade(a,dt);stepArcade(b,dt);}
  assert.deepEqual(a,b);
  assert.ok(a.fighters.every(f=>!('nextExchange' in f)));
});
test('AI prepares the next exchange during the current moving recovery',()=>{
  const g=createArcade({...config,anticipatingCombat:true});
  let one;
  for(let n=0;n<1800&&!one;n++){
    stepArcade(g,dt);
    one=g.fighters.find(f=>f.nextExchange?.serial===f.attackSerial&&f.attack&&f.contact&&f.groundSpeed>8);
  }
  assert.ok(one,'the bot should visibly be moving between release and recovery, already planning');
  assert.ok(one.nextExchange.expires>g.time);
  assert.ok(one.actionDuration-one.actionTime<=.27);
  assert.ok(g.fighters.some(f=>f.id===one.nextExchange.target&&f.team!==one.team));
});
test('manual attack keeps the same geometry, price and timing with anticipation enabled',()=>{
  for(const style of ['rook','bishop','knight']){
    const setup=anticipatingCombat=>createArcade({...config,mode:'duel',chessStyles:[style,'pawn'],anticipatingCombat});
    const a=setup(false),b=setup(true);
    for(const g of [a,b])stepArcade(g,dt,{strike:true});
    const {chessStyle,...spec}=b.fighters[0].attackSpec;
    assert.equal(chessStyle,style);
    assert.deepEqual(a.fighters[0].attackSpec,spec);
  }
});

test('bots switch at decision cuts and attacks retain the style stamped at commit',()=>{
  const g=createArcade({...config,anticipatingCombat:true});
  const observed=new Set(), switches=[], committed=new Map();
  for(let n=0;n<2400&&g.phase==='playing';n++){
    stepArcade(g,dt);
    for(const e of g.events){
      if(observed.has(e.id))continue;
      observed.add(e.id);
      if(e.kind==='chess_style'){
        const f=g.fighters.find(f=>f.id===e.fighterId);
        const prior=switches.filter(s=>s.fighterId===e.fighterId).at(-1);
        if(prior)assert.ok(e.time-prior.time>=.9);
        assert.equal(f.chessStyle,e.chessStyle);
        assert.notEqual(e.previousChessStyle,e.chessStyle);
        switches.push(e);
      }
    }
    for(const f of g.fighters){
      if(!f.attackSpec?.chessStyle||!f.attack)continue;
      const key=f.id+':'+f.attackSerial,last=committed.get(key);
      if(last)assert.equal(f.attackSpec.chessStyle,last);
      else committed.set(key,f.attackSpec.chessStyle);
      assert.equal(f.attackSpec.chessStyle,f.chessStyle);
    }
  }
  assert.ok(switches.length>0);
  assert.ok(committed.size>0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARENA_MOTION_FLOW} from '../dist/arcade-motion-flow.js';

const TICK=1/120;
type Grade='A'|'SSS+V';
function fixture(grade:Grade,enabled:boolean){
  const game=createArcade({mode:'duel',terrain:'open',seed:1,form:'shii_cho',startingRanks:[grade,grade],
    teamForms:[['shii_cho'],['shii_cho']],motionFlow:{...ARENA_MOTION_FLOW,clashStrikeBuffer:enabled},
    weaponFlow:true,impactPhysics:true});
  const [player,enemy]=game.fighters;
  Object.assign(player,{x:425,y:320,face:0});
  Object.assign(enemy,{x:503,y:320,face:Math.PI});
  const tick=(input={})=>stepArcade(game,TICK,{aimX:enemy.x,aimY:enemy.y,...input});
  for(let i=0;i<55&&player.action!=='clash';i++)tick({strike:i===(grade==='A'?13:16)});
  const clash=game.events.find(e=>e.kind==='clash');
  assert.ok(clash);
  assert.equal(player.action,'clash');
  assert.equal(enemy.action,'clash');
  assert.equal(player.actionTime,0);
  assert.equal(player.actionDuration,.42);
  return {tick,game,player,clash};
}
function play(grade:Grade,enabled:boolean,pressed:boolean,override?:'guard'|'energy',tapFrame?:number){
  const {tick,game,player,clash}=fixture(grade,enabled);
  let readyAt=0, cost=0, lockFrames=0;
  const moves=()=>game.events.filter(e=>e.fighterId===player.id&&e.technique==='slash'&&e.duration&&e.id>clash.id);
  for(let i=0;i<70;i++){
    const locked=player.action==='clash';
    const heldGuard=!locked&&override==='guard';
    if(!locked&&override==='energy')player.energy=0;
    const energy=player.energy;
    tick({strike:pressed&&(tapFrame===undefined?i>=1:i===tapFrame),guard:heldGuard});
    if(locked){
      assert.equal(moves().length,0,'input must not cancel the actual blade lock');
      lockFrames++;
      if(player.action!=='clash')readyAt=game.time;
    }else if(!cost&&moves().length){cost=energy-player.energy;}
  }
  return {moves:moves(),readyAt,cost,lockFrames,clash,player};
}
test('one held Strike edge during a real clash acts on the first legal tick, not during the lock',()=>{
  for(const grade of ['A','SSS+V'] as const){
    const queued=play(grade,true,true), noPress=play(grade,true,false), legacy=play(grade,false,true);
    assert.equal(queued.moves.length,1);
    assert.ok(queued.cost>0);
    assert.ok(Math.abs(queued.moves[0].time-queued.readyAt-TICK)<1e-9);
    assert.ok(queued.readyAt-queued.clash.time>=.42);
    assert.equal(noPress.moves.length,0);
    assert.equal(legacy.moves.length,0);
    assert.equal(queued.lockFrames,noPress.lockFrames);
    assert.equal(legacy.lockFrames,noPress.lockFrames);
    assert.deepEqual(queued.clash,legacy.clash);
  }
});
test('buffered Slash respects newly held guard, stamina and one-shot expiry',()=>{
  for(const override of ['guard','energy'] as const){
    const q=play('A',true,true,override);
    assert.equal(q.moves.length,0);
    assert.equal(q.player.buffer,null);
  }
});

test('a single tick tap at the very first clash tick or at 30% survives through normal unlock',()=>{
  for(const grade of ['A','SSS+V'] as const){
    for(const tapFrame of [0,Math.round(.42*.30/TICK)]){
      const queued=play(grade,true,true,undefined,tapFrame);
      const unbuffered=play(grade,false,true,undefined,tapFrame);
      assert.equal(queued.moves.length,1);
      assert.equal(unbuffered.moves.length,0);
      assert.equal(queued.lockFrames,unbuffered.lockFrames);
      assert.deepEqual(queued.clash,unbuffered.clash);
      assert.ok(Math.abs(queued.moves[0].time-queued.readyAt-TICK)<1e-9);
      assert.ok(queued.cost>0);
      assert.equal(queued.player.buffer,null);
    }
  }
});

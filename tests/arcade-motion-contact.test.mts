import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARENA_MOTION_FLOW,PREVIEW_MOTION_FLOW,contactChainOpen,normalizeArcadeMotionFlow} from '../dist/arcade-motion-flow.js';

const TICK=1/120;
const fixture=(grade:string,options:{dual?:boolean;miss?:boolean;prevHeavy?:boolean;nextHeavy?:boolean;force?:boolean;legacy?:boolean;delay?:number}={})=>{
  const game=createArcade({mode:'duel',seed:12345,form:'shii_cho',startingRanks:[grade,grade],terrain:'open',
    weaponFlow:true,startingSaberWeapon:[options.dual?'dual':'single','single'],
    ...(options.legacy?{stanceFlow:true,peasantMotion:true,liveEntry:true,styleChoreo:true}:{motionFlow:options.delay===undefined?ARENA_MOTION_FLOW:{chain:{standardDelay:options.delay}}}),
  });
  const [player,enemy]=game.fighters;
  Object.assign(player,{x:425,y:320,face:0});
  Object.assign(enemy,{x:options.miss?770:508,y:320,face:Math.PI,action:'stagger',actionDuration:10,think:10});
  stepArcade(game,TICK,{[options.prevHeavy?'heavy':'strike']:true,aimX:enemy.x,aimY:enemy.y});
  const first=game.events.find(e=>e.fighterId===player.id&&e.duration&&e.technique)!;
  const spec=player.attackSpec!;
  const firstId=first.id;
  for(let i=0;i<95&&game.phase==='playing';i++){
    const second=i===2?options.force?'force':options.nextHeavy?'heavy':'strike':null;
    stepArcade(game,TICK,{...(second?{[second]:true}:{}),aimX:enemy.x,aimY:enemy.y});
    const link=game.events.find(e=>e.id>firstId&&e.fighterId===player.id&&e.duration&&e.technique);
    if(link)return {game,player,first,spec,link,elapsed:link.time-first.time};
  }
  throw new Error('No buffered follow-up committed');
};
function onFirstTick(result:ReturnType<typeof fixture>,delay:number){
  const {elapsed,spec}=result;
  const final=Math.max(spec.contact,spec.offhand?.contact??0);
  const expected=Math.ceil((final+delay-1e-9)/TICK)*TICK;
  assert.ok(Math.abs(elapsed-expected)<1e-8,`expected ${expected}, got ${elapsed}`);
}
test('a real buffered hit opens on first available tick: standard +50ms, SSS+V +25ms',()=>{
  const standard=fixture('A'), nearElite=fixture('SSS+IV'), elite=fixture('SSS+V');
  for(const result of [standard,nearElite,elite]){
    assert.ok(result.game.events.some(e=>e.kind==='hit'&&e.fighterId===result.player.id));
    assert.equal(result.link.technique,'slash2');
    assert.equal(result.player.chainDepth,2);
  }
  onFirstTick(standard,.050);
  onFirstTick(nearElite,.050);
  onFirstTick(elite,.025);
});
test('manual heavy after slash and slash after a non-slash posture share the real hit window',()=>{
  const heavy=fixture('A',{nextHeavy:true});
  assert.equal(heavy.link.technique,'wide_cut');
  onFirstTick(heavy,.050);
  const fromHeavy=fixture('A',{prevHeavy:true});
  assert.equal(fromHeavy.first.technique,'wide_cut');
  assert.equal(fromHeavy.link.technique,'slash');
  onFirstTick(fromHeavy,.050);
});
test('dual emits its scheduled second blade before the post-hit timer; tunable timings use same engine path',()=>{
  const dual=fixture('SSS+V',{dual:true});
  assert.ok(dual.spec.offhand);
  assert.ok(dual.game.events.some(e=>e.offhand&&e.fighterId===dual.player.id&&e.time<dual.link.time));
  onFirstTick(dual,.025);
  onFirstTick(fixture('A',{delay:.095}),.095);
  // The old duration percentage would win this race if still allowed after a hit.
  const delayed=fixture('A',{dual:true,delay:.22});
  onFirstTick(delayed,.22);
  assert.ok(delayed.elapsed>fixture('A',{dual:true,legacy:true}).elapsed);
});
test('whiffs and Force retain previous manual timing instead of earning a hit cancel',()=>{
  const missed=fixture('A',{miss:true});
  const oldMiss=fixture('A',{miss:true,legacy:true});
  assert.equal(missed.elapsed,oldMiss.elapsed);
  assert.ok(missed.elapsed>missed.spec.contact+.1);
  assert.equal(missed.game.events.some(e=>e.kind==='hit'&&e.fighterId===missed.player.id),false);
  const force=fixture('A',{force:true}), oldForce=fixture('A',{force:true,legacy:true});
  assert.equal(force.link.technique,'force');
  assert.equal(force.elapsed,oldForce.elapsed);
});
test('profile unifies live effects while retaining legacy flags and pose legality',()=>{
  const options={motionFlow:PREVIEW_MOTION_FLOW,impactPhysics:true,styleChoreo:false,peasantMotion:false,liveEntry:true};
  const preview=createArcade(options);
  assert.ok(preview.config.motionFlow);
  assert.equal(preview.config.peasantMotion,undefined);
  assert.equal(preview.config.liveEntry,undefined);
  assert.equal(preview.fighters[0].peasantMotion,true);
  assert.equal(preview.fighters[0].styleChoreo,true);
  assert.equal(preview.fighters[0].liveEntry,undefined);
  const profile=normalizeArcadeMotionFlow(ARENA_MOTION_FLOW,true);
  const actor={action:'slash',airPhase:'airborne',actionTime:.21,contact:true,offhandContact:true,motionLinkedHit:true,career:{gradeIndex:14}};
  assert.equal(contactChainOpen(profile,actor,{contact:.16}),false);
  assert.equal(contactChainOpen(profile,{...actor,airPhase:'landing'},{contact:.16,airStrike:true}),false);
  assert.equal(contactChainOpen(profile,{...actor,airPhase:'landing'},{contact:.16}),true);
  assert.equal(contactChainOpen(profile,{...actor,action:'force',airPhase:'grounded'},{contact:.16}),false);
});

test('a real airborne Scissor Cut links to a normal hit without generating another jump',()=>{
  const game=createArcade({mode:'duel',terrain:'open',seed:12345,form:'ataru',startingRanks:['SSS+V','SSS+V'],motionFlow:ARENA_MOTION_FLOW});
  const [player,enemy]=game.fighters;
  Object.assign(player,{x:425,y:320,face:0});
  Object.assign(enemy,{x:540,y:320,face:Math.PI,action:'stagger',actionDuration:10,think:10});
  let originalArc;
  let previousAirTime=-1;
  let airborneFollow=false;
  for(let frame=0;frame<70&&game.phase==='playing';frame++){
    stepArcade(game,TICK,{x:frame===0?1:0,jump:frame===0,strike:frame===22||frame===26,aimX:enemy.x,aimY:enemy.y});
    if(frame===0)originalArc=player.airArc;
    if(player.airArc){
      assert.strictEqual(player.airArc,originalArc);
      assert.ok(player.airTime>=previousAirTime);
      previousAirTime=player.airTime;
    }
    if(player.attack==='slash'&&player.airPhase==='airborne'){
      airborneFollow=true;
      assert.equal(player.airStrikeSpent,true);
      assert.ok(player.vx>0);
    }
  }
  assert.equal(airborneFollow,true);
  const events=game.events.filter(e=>e.fighterId===player.id);
  const first=events.find(e=>e.kind==='hit'&&e.technique==='air_scissor');
  const link=events.find(e=>e.chainDepth===2&&e.technique==='slash');
  assert.ok(first&&link);
  assert.ok(link.time-first.time>=.025-1e-8&&link.time-first.time<.042);
  assert.ok(events.some(e=>e.kind==='hit'&&e.technique==='slash'));
  assert.equal(events.filter(e=>e.kind==='jump').length,1);
});

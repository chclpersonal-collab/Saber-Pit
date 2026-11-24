import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARENA_MOTION_FLOW,contactChainOpen,normalizeArcadeMotionFlow} from '../dist/arcade-motion-flow.js';

const DT=1/120;
type Defense='block'|'parry'|'blockThenHit'|'hitThenBlock'|'hitThenParry'|'blockThenParry'|'ward';
const run=(grade:string,weapon:'single'|'dual'|'staff',defense:Defense,legacy=false)=>{
  const {blockRebound,...oldMotion}=ARENA_MOTION_FLOW;
  const g=createArcade({mode:'duel',terrain:'open',seed:12345,form:'shii_cho',startingRanks:[grade,grade],
    motionFlow:legacy?oldMotion:ARENA_MOTION_FLOW,weaponFlow:true,startingSaberWeapon:[weapon,'single'],perfectParryStamina:true});
  const [p,e]=g.fighters;
  Object.assign(p,{x:425,y:320,face:0});
  let spec=p.attackSpec;
  for(let i=0;i<66;i++){
    // Fix the opponent's pose through during(), without replacing contact or injury.
    const guard=defense==='blockThenHit'?!p.contact:
      defense==='hitThenBlock'||defense==='hitThenParry'?p.contact:defense!=='ward';
    const parry=defense==='parry'&&!p.contact||(defense==='hitThenParry'||defense==='blockThenParry')&&p.contact&&!p.offhandContact;
    Object.assign(e,{x:503,y:320,face:Math.PI,guardBearing:Math.PI,action:guard?'guard':'idle',actionDuration:1,
      actionTime:parry?.02:.2,parryTime:parry?.09:0,think:10});
    if(defense==='ward')Object.assign(e,{wardUntil:10,wardCharges:1});
    stepArcade(g,DT,{strike:i===0||i===2,aimX:e.x,aimY:e.y});
    if(i===0)spec=p.attackSpec;
    const link=g.events.find(a=>a.fighterId===p.id&&a.chainDepth===2&&a.duration);
    if(link)return {p,g,link,spec:spec!};
    if(p.action==='stagger')return {p,g,link:null,spec:spec!};
  }
  return {p,g,link:null,spec:spec!};
};
function at(r:ReturnType<typeof run>,delay:number){
  const release=Math.max(r.spec.contact,r.spec.offhand?.contact??0);
  const remaining=Math.ceil((release+delay-1e-9)/DT)*DT;
  const initial=r.g.events.find(e=>e.fighterId===r.p.id&&e.duration&&e.technique==='slash')!;
  assert.ok(r.link, 'expected a linked action');
  assert.equal(r.link.technique,'slash2');
  assert.ok(Math.abs(r.link.time-initial.time-remaining)<1e-8);
}
const results=(r:ReturnType<typeof run>)=>r.g.events.filter(e=>['block','parry','hit'].includes(e.kind));
test('ordinary guard opens 90ms for standard and 60ms for elite, including dual/staff scheduling',()=>{
  for(const [grade,delay] of [['A',.09],['SSS+V',.06]] as const)
    for(const weapon of ['single','dual','staff'] as const){
      const r=run(grade,weapon,'block');
      at(r,delay);
      assert.equal(results(r).filter(e=>e.kind==='block').length,weapon==='dual'?2:1);
      assert.ok(!r.g.events.some(e=>e.kind==='hit'));
      if(weapon==='dual')assert.ok(results(r).some(e=>e.kind==='block'&&e.offhand));
      if(weapon==='staff')assert.ok(r.g.events.some(e=>e.kind==='slash'&&e.offhand&&e.time<r.link!.time));
    }
});
test('a confirmed hit by either blade takes precedence over the ordinary block window',()=>{
  for(const [grade,delay] of [['A',.05],['SSS+V',.025]] as const)
    for(const defense of ['blockThenHit','hitThenBlock'] as const){
      const r=run(grade,'dual',defense);
      at(r,delay);
      assert.deepEqual(results(r).map(e=>e.kind),defense==='blockThenHit'?['block','hit']:['hit','block']);
    }
});
test('perfect parry interrupts immediately, even when the earlier blade hit',()=>{
  for(const defense of ['parry','hitThenParry','blockThenParry'] as const){
    const r=run('A','dual',defense);
    assert.equal(r.link,null);
    assert.equal(r.p.action,'stagger');
    assert.ok(results(r).some(e=>e.kind==='parry'&&e.perfect));
    if(defense==='hitThenParry')assert.deepEqual(results(r).map(e=>e.kind),['hit','parry']);
    if(defense==='blockThenParry')assert.deepEqual(results(r).map(e=>e.kind),['block','parry']);
  }
});
test('ward absorption does not count as ordinary guard and old motion profiles retain their guard timing',()=>{
  const live=run('A','single','ward'),old=run('A','single','ward',true);
  assert.ok(live.g.events.some(e=>e.kind==='force_ward'));
  assert.equal(live.link?.time,old.link?.time);
  assert.ok((run('A','dual','block',true).link?.time??Infinity)>run('A','dual','block').link!.time);
});
test('a block cannot open an airborne, free-hand, or Force chain',()=>{
  const profile=normalizeArcadeMotionFlow(ARENA_MOTION_FLOW,true);
  const actor={action:'slash',airPhase:'grounded',actionTime:.35,contact:true,offhandContact:true,motionLinkedBlock:true,career:{gradeIndex:14}};
  const move={contact:.19};
  assert.equal(contactChainOpen(profile,actor,move),true);
  assert.equal(contactChainOpen(profile,{...actor,action:'force'},move),false);
  assert.equal(contactChainOpen(profile,{...actor,airPhase:'airborne',airArc:{kind:'jump'}},move),false);
  assert.equal(contactChainOpen(profile,actor,{...move,airStrike:true}),false);
  assert.equal(contactChainOpen(profile,actor,{...move,freeHand:true}),false);
});

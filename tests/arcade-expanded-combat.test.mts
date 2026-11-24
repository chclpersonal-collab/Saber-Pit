import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_EXPANDED_MOVES,ARCADE_FORCE_VARIANTS,arcadeExpandedMoveById,arcadeExpandedMovesFor} from '../dist/arcade-expanded-combat.js';

test('expanded arena catalog has six mechanically distinct Force effects and four genuine free-hand options',()=>{
  const moves=Object.values(ARCADE_EXPANDED_MOVES);
  const force=moves.filter(m=>m.kind==='force'), hand=moves.filter(m=>m.kind==='free_hand');
  assert.equal(force.length,6);assert.equal(hand.length,4);
  assert.equal(new Set(force.map(m=>m.effect)).size,6);
  assert.deepEqual(force.filter(m=>m.damage>0).map(m=>m.id),['force_arc_wave']);
  assert(hand.every(m=>m.mapAction==='free_hand'&&m.reach<70&&m.damage>0));
  assert.equal(hand.find(m=>m.effect==='spin').cap,2);
  for(const move of moves){
    assert(move.cost>0&&move.contact>0&&move.contact<move.duration);
    assert(Object.isFrozen(move)&&move.manual&&move.description.length>35);
  }
  assert(Object.isFrozen(ARCADE_EXPANDED_MOVES));
});

test('rank gates are cumulative, starter rank has only Palm Check, and Sabers only suppresses all extras',()=>{
  assert.deepEqual(arcadeExpandedMovesFor().map(m=>m.id),['unarmed_palm']);
  for(let rank=0;rank<=14;rank++){
    const available=arcadeExpandedMovesFor(rank);
    assert(available.every(m=>m.minRank<=rank));
    assert.deepEqual(arcadeExpandedMovesFor(rank,{weapon:'staff'}),available);
    assert.deepEqual(arcadeExpandedMovesFor(rank,{weapon:'dual'}),available.filter(m=>m.kind==='force'));
    assert.equal(arcadeExpandedMovesFor(rank,{saberOnly:true}).length,0);
  }
  assert.equal(arcadeExpandedMovesFor(14).length,10);
  assert.equal(arcadeExpandedMovesFor(13).some(m=>m.id==='force_siphon'),true);
  assert.equal(arcadeExpandedMovesFor(12).some(m=>m.id==='force_siphon'),false);
});

test('Close Repulse and Tether are opt-in, retain existing effects, and provide different timing and space',()=>{
  const [pulse,line]=Object.values(ARCADE_FORCE_VARIANTS);
  const wave=ARCADE_EXPANDED_MOVES.force_arc_wave, anchor=ARCADE_EXPANDED_MOVES.force_anchor;
  assert.equal(arcadeExpandedMoveById(pulse.id),null);
  assert.equal(arcadeExpandedMoveById(line.id),null);
  assert.equal(arcadeExpandedMoveById(wave.id,{forceVariants:true}),wave);
  assert.equal(arcadeExpandedMoveById('constructor',{forceVariants:true}),null);
  assert.equal(pulse.effect,wave.effect);assert.equal(line.effect,anchor.effect);
  assert.ok(pulse.contact<wave.contact*.65&&pulse.reach<wave.reach*.65&&pulse.cost>wave.cost&&pulse.cap<wave.cap);
  assert.ok(line.contact>anchor.contact&&line.reach>anchor.reach*1.5&&line.arc<anchor.arc*.5&&line.cost>anchor.cost);
  for(const move of [pulse,line]){
    assert.equal(arcadeExpandedMoveById(move.id,{forceVariants:true}),move);
    assert.ok(arcadeExpandedMovesFor(move.minRank,{weapon:'dual',forceVariants:true}).includes(move));
    assert.ok(!arcadeExpandedMovesFor(move.minRank-1,{forceVariants:true}).includes(move));
    assert.ok(!arcadeExpandedMovesFor(14,{forceVariants:true,saberOnly:true}).includes(move));
  }
});

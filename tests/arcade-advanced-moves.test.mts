import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeMovesFor,ARCADE_TECHNIQUES} from '../dist/arcade-repertoire.js';
import {advancedAttackScore,chooseAdvancedFollowup,ADVANCED_FOLLOWUP_RANKS} from '../dist/arcade-advanced-moves.js';
import {chooseFormCommit} from '../dist/arcade-move-choice.js';

const context={advancedArena:true,rank:14,form:'makashi',distance:80,line:.1,side:-.3,guarded:false,open:false,wind:0,energy:58,crowd:0};
const moves=(form,rank)=>arcadeMovesFor(form,rank,{tactical:true,rankCuts:true});
const follow=(trigger,c={})=>{const cfg={...context,trigger,...c};return chooseAdvancedFollowup(moves(cfg.form,cfg.rank),cfg);};
test('opt-in rank ladder is strict, preserving F and unflagged tournament behavior',()=>{
  assert.deepEqual(ADVANCED_FOLLOWUP_RANKS,{parry:5,whiff:7,travel:10});
  for(const [trigger,gate] of Object.entries(ADVANCED_FOLLOWUP_RANKS)){
    assert.equal(follow(trigger,{rank:gate-1,previousId:'mk_measured_point'}),null);
    assert.equal(follow(trigger,{advancedArena:false,previousId:'mk_measured_point'}),null);
  }
  assert.equal(follow('constructor'),null);
});
test('an actual parry has a real, legal quick reply; tight window or misalignment means no attack',()=>{
  const move=ARCADE_TECHNIQUES[follow('parry',{window:.21})];
  assert(move.contact<=.21);
  assert(move.role==='counter'||move.opening==='intercept');
  assert.equal(follow('parry',{window:.04}),null);
  assert.equal(follow('parry',{line:2.4}),null);
});
test('a whiff changes chamber or path and never repeats a lost line out of reach',()=>{
  const previous=ARCADE_TECHNIQUES.mk_measured_point;
  const pick=ARCADE_TECHNIQUES[follow('whiff',{previousId:previous.id,previous})];
  assert.notEqual(pick.id,previous.id);
  assert(pick.motion.path!==previous.motion.path||Math.sign(pick.motion.chamber)!==Math.sign(previous.motion.chamber));
  assert.equal(follow('whiff',{previousId:previous.id,distance:260}),null);
  assert.equal(follow('whiff',{previousId:previous.id,energy:1}),null);
});
test('travel entry stays grounded; a crowd changes Shii-Cho choice to broad coverage',()=>{
  const crowd=ARCADE_TECHNIQUES[follow('travel',{form:'shii_cho',crowd:3})];
  const duel=ARCADE_TECHNIQUES[follow('travel',{form:'shii_cho',crowd:0})];
  assert.notEqual(crowd.id,duel.id);
  assert.equal(crowd.motion.path,'arc');
  assert(crowd.cap>=2);assert.notEqual(duel.role,'crowd');
  assert.equal(follow('travel',{distance:10,crowd:3}),null);
  assert.equal(Boolean(ARCADE_TECHNIQUES[follow('travel',{form:'ataru'})]?.air),false);
});
test('bonus is inert without opt-in and scores actual guard angle and geometry',()=>{
  const inside=ARCADE_TECHNIQUES.mk_trained_shallow_disengage;
  assert(advancedAttackScore(inside,{...context,guarded:true})>0);
  assert(advancedAttackScore(inside,{...context,guarded:true,side:.30})<0);
  assert.equal(advancedAttackScore(inside,{...context,guarded:true,line:1.1}),0);
  assert.equal(advancedAttackScore(inside,{...context,guarded:true,advancedArena:false}),0);
  const pool=moves('makashi',14).map(move=>({id:move.id,move,action:move.mapAction,intentMatch:move.role==='light'}));
  const {advancedArena:_,...ordinary}=context;
  assert.equal(chooseFormCommit(pool,ordinary),chooseFormCommit(pool,{...ordinary,advancedArena:false}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeAttackPresentation,chooseFormCommit} from '../dist/arcade-move-choice.js';
import {createArcade,stepArcade,arcadeMovesFor} from '../dist/arcade-engine.js';
const base={motion:{path:'diagonal',chamber:-1},reach:90,arc:1.2,contact:.26,duration:.55,cost:12};
const option=(id,action,move,intentMatch=true)=>({id,action,move:{...base,...move},intentMatch});
const ctx={form:'shii_cho',distance:75,line:.12,side:0,guarded:false,open:false,wind:0,crowd:0,counter:false,history:[],energy:70};
test('geometry and form doctrine change the selected real family before commitment',()=>{
  const choices=[option('diagonal','slash',{}),option('sweeping','sweep',{motion:{path:'arc',chamber:1}},true)];
  assert.equal(chooseFormCommit(choices,ctx),'diagonal');
  assert.equal(chooseFormCommit(choices,{...ctx,crowd:2,side:.75}),'sweeping');
  const tip=option('point','rush',{reach:140,arc:.54,motion:{path:'point',chamber:-1}});
  assert.equal(chooseFormCommit([choices[0],tip],{...ctx,form:'makashi',distance:127}),'point');
  assert.equal(chooseFormCommit([choices[0],tip],{...ctx,form:'makashi',distance:75,line:1.06}),'diagonal');
  assert.equal(chooseFormCommit([choices[0],tip],{...ctx,energy:4}),null);
});

test('recent repetition encourages distinction but does not choose an unfit alternative',()=>{
  const options=[option('near-slash','slash',{}),option('line','rush',{arc:.52,reach:107,motion:{path:'point',chamber:1}})];
  const history=Array.from({length:4},()=>({id:'near-slash',family:'cut'}));
  assert.equal(chooseFormCommit(options,{...ctx,history}),'line');
  assert.equal(chooseFormCommit(options,{...ctx,history,line:1.07}),'near-slash');
});

test('mechanical commitments expose stable family/variant hints without changing authored timing',()=>{
  const s=createArcade({form:'makashi',startingRanks:['SSS','SSS'],seed:32}),[a]=s.fighters;
  const chosen=arcadeMovesFor(a.form,a.career.gradeIndex).find(x=>x.motion.path==='point');
  assert.ok(chosen);
  stepArcade(s,1/120,{technique:chosen.id});
  const display=arcadeAttackPresentation(chosen.id,chosen,chosen.mapAction);
  const event=s.events.find(e=>e.technique===chosen.id&&e.contact>0);
  assert.deepEqual([a.attackFamily,a.attackVariant],[display.family,display.variant]);
  assert.deepEqual([event.attackFamily,event.attackVariant],[display.family,display.variant]);
  assert.equal(event.contact,a.attackSpec.contact);
  assert.equal(event.duration,a.attackSpec.duration);
});

test('trained attack choice reads the open lane or a genuine intercept window without reaching off line',()=>{
  const inside=option('inside','slash',{opening:'inside',motion:{path:'diagonal',chamber:-1}});
  const outside=option('outside','slash',{opening:'outside',motion:{path:'diagonal',chamber:1}});
  const instant=option('intercept','slash',{opening:'intercept',contact:.185,arc:.8});
  assert.equal(chooseFormCommit([outside,inside],{...ctx,guarded:true,side:-.26}),'inside');
  assert.equal(chooseFormCommit([inside,outside],{...ctx,guarded:true,side:.26}),'outside');
  assert.equal(chooseFormCommit([inside,instant],{...ctx,wind:.23}),'intercept');
  assert.equal(chooseFormCommit([inside,instant],{...ctx,wind:.23,line:1.18}),'inside');
});

test('live direct saber attack honors the trained move rank at commit, with no Hero requirement',()=>{
  const technique='mk_trained_half_time_point';
  for(const grade of ['F','SSS+V']){
    const game=createArcade({form:'makashi',startingRanks:[grade,grade],seed:4});
    const fighter=game.fighters[0];
    stepArcade(game,1/120,{technique});
    assert.equal(fighter.technique===technique,grade==='SSS+V');
    assert(!fighter.heroId);
  }
});

test('learned preference changes a viable decision without bypassing reach, timing, or repetition',()=>{
  const standard=option('standard','slash',{});
  const learned=option('learned','slash',{arc:.65,contact:.30,reach:72});
  assert.equal(chooseFormCommit([standard,learned],ctx),'standard');
  const preference={...ctx,preferred:'learned'};
  assert.equal(chooseFormCommit([standard,learned],preference),'learned');
  assert.equal(chooseFormCommit([standard,learned],{...preference,line:.9}),'standard');
  assert.equal(chooseFormCommit([standard,learned],{...preference,distance:91}),'standard');
  assert.equal(chooseFormCommit([standard,learned],{...preference,wind:.2}),'standard');
  assert.equal(chooseFormCommit([standard,learned],{...preference,history:[{id:'learned',family:'cut'}]}),'standard');
});

test('a deployed saved Hero carries its legal learned move without changing the Hero grade',()=>{
  const lineup={'0-0':{id:'saved-hero',name:'Aerin Qiu',form:'makashi',grade:'F',preferredMove:'mk_trained_half_time_point'}};
  const make=heroLineup=>createArcade({form:'makashi',heroLineup,startingRanks:['F','F']}).fighters[0];
  const f=make(lineup);
  assert.equal(f.tournamentMove,'mk_trained_half_time_point');
  assert.equal(f.career.gradeIndex,14);
  assert.equal(make({'0-0':{...lineup['0-0'],preferredMove:'jy_open_edge'}}).tournamentMove,undefined);
});

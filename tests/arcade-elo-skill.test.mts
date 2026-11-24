import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeEloSkill,ELO_SKILL_BASE} from '../dist/arcade-elo-skill.js';

test('Elo tactical effects are neutral when disabled or at the default rating',()=>{
  const normal=arcadeEloSkill(ELO_SKILL_BASE,true);
  assert.deepEqual(normal,{level:0,readLead:0,readRecovery:0,decisionClock:1});
  for(const rating of [100,1499,1684,2000,Number.MAX_SAFE_INTEGER,Infinity,NaN,null,'1684']){
    assert.equal(arcadeEloSkill(rating),normal);
  }
  for(const rating of [Infinity,NaN,null,undefined,'1684'])
    assert.equal(arcadeEloSkill(rating,true),normal);
});
test('1684 reads sooner and recognizes a tighter surviving opening than 1500',()=>{
  const base=arcadeEloSkill(1500,true), practiced=arcadeEloSkill(1684,true);
  assert.ok(practiced.readLead-base.readLead>.025);
  assert.ok(practiced.readRecovery-base.readRecovery>.04);
  assert.ok(practiced.decisionClock<base.decisionClock*.92);
  const novice=arcadeEloSkill(1350,true);
  assert.ok(novice.readLead<0&&novice.readRecovery<0&&novice.decisionClock>1);
});
test('ratings stay monotone through the normal range and bounded at extremes',()=>{
  const scores=[100,800,1300,1499,1500,1501,1684,2000,5000].map(r=>arcadeEloSkill(r,true));
  assert.ok(scores.every((s,i)=>!i||s.readLead>scores[i-1].readLead&&s.readRecovery>scores[i-1].readRecovery&&s.decisionClock<scores[i-1].decisionClock));
  for(const rating of [-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]){
    const s=arcadeEloSkill(rating,true);
    assert.ok(Math.abs(s.readLead)<=.044&&Math.abs(s.readRecovery)<=.072);
    assert.ok(s.decisionClock>=.85&&s.decisionClock<=1.15);
  }
});

test('the higher rated AI reacts to a visible committed blade earlier without changing the move',async()=>{
  const {createArcade,stepArcade}=await import('../dist/arcade-engine.js');
  const dt=1/120;
  function react(rating,ratingSkill,screened=false){
    const s=createArcade({ratingSkill,fighterRatings:[[1500],[rating]],mode:'duel',teamSizes:[1,1],seed:5,
      teamForms:[['makashi'],['soresu']],startingRanks:['SSS+V','SSS+V'],terrain:'open'});
    const [actor,ai]=s.fighters;
    Object.assign(actor,{x:490,y:320,face:0});
    Object.assign(ai,{x:584,y:320,face:Math.PI,think:100,eliteReady:100});
    if(screened)s.terrain.solids.push({kind:'wall',x:530,y:275,width:12,height:90});
    stepArcade(s,dt,{strike:true,aimX:ai.x,aimY:ai.y});
    const move=[actor.attackSpec.contact,actor.attackSpec.duration,actor.attackSpec.damage];
    let reaction=null;
    for(let i=0;i<16;i++){
      stepArcade(s,dt);
      if(['guard','dash'].includes(ai.action)){reaction={frame:i,action:ai.action};break;}
    }
    return {reaction,move,grade:ai.career.grade};
  }
  const neutral=react(1500,true),practiced=react(1684,true);
  assert.equal(practiced.reaction.action,'guard');
  assert.ok(neutral.reaction.frame-practiced.reaction.frame>=3);
  assert.deepEqual(practiced.move,neutral.move);
  assert.equal(practiced.grade,neutral.grade);
  assert.deepEqual(react(1684,false),neutral);
  assert.deepEqual(react(1684,true,true).reaction,react(1500,true,true).reaction);
});

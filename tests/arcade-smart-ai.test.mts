import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

// v6 AI audit: a scripted player against the live Arena AI, headless and seeded.
const ARENA={perfectParryStamina:true,continuousCombat:true,anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,
  repertoireSupport:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,impactPhysics:true,balancePass:true,closeChoice:true,
  guardCounterplay:true,minorMoves:true,forceVariants:true,weaponFlow:true,expandedCombat:true,circuitCuts:true,ratingSkill:true,
  customHeroTactics:true,advancedArena:true};

function duel(policy,ranks,seed,smartAI=true){
  const s=createArcade({mode:'duel',seed,teamSizes:[1,1],limit:90,startingRanks:ranks,form:'shii_cho',terrain:'underpit',smartAI,...ARENA});
  const me=s.fighters.find(f=>f.control),ai=s.fighters.find(f=>f.team===1);
  let tick=0,autoDefence=0;const seen=new Set();
  while(s.phase==='playing'&&s.time<95){
    const a=Math.atan2(ai.y-me.y,ai.x-me.x),d=Math.hypot(ai.x-me.x,ai.y-me.y);
    stepArcade(s,1/60,policy==='spam'?{x:d>70?Math.cos(a):0,y:d>70?Math.sin(a):0,strike:(tick++%2)===0,aimX:ai.x,aimY:ai.y}:{});
    for(const e of s.events){if(seen.has(e.id))continue;seen.add(e.id);
      if(e.fighterId===me.id&&['rank_deflect','parry','block','rank_composure'].includes(e.kind))autoDefence++;}
  }
  return {playerWon:!ai.alive&&me.alive,playerLost:!me.alive,autoDefence};
}

test('a player fighter that gets no input never defends itself', () => {
  for(const seed of [1,2,3]){
    const r=duel('idle',['SSS+V','SSS+'],seed);
    assert.equal(r.autoDefence,0,`seed ${seed}: idle player defended on its own`);
    assert.equal(r.playerLost,true,`seed ${seed}: an idle player should go down`);
  }
});

test('the no-auto-defence rule holds with the v6 AI switched off too', () => {
  // 5.3.0 gave this exact setup 1296 free rank deflects over 12 rounds.
  assert.equal(duel('idle',['SSS+V','SSS+'],1,false).autoDefence,0);
});

test('mashing one button loses to an equal-rank SSS+ AI', () => {
  let wins=0;for(let seed=1;seed<=12;seed++)if(duel('spam',['SSS+','SSS+'],seed).playerWon)wins++;
  assert.ok(wins<=2,`spammer won ${wins}/12`);
});

test('mashing one button loses at every rank', () => {
  for(const rank of ['F','A','SSS+V']){
    let wins=0;for(let seed=1;seed<=8;seed++)if(duel('spam',[rank,rank],seed).playerWon)wins++;
    assert.ok(wins<=2,`${rank}: spammer won ${wins}/8`);
  }
});

test('the new AI beats the old AI as squadmates on either side', () => {
  let smart=0,old=0;
  for(let seed=1;seed<=4;seed++)for(const team of [0,1]){
    const s=createArcade({mode:'watch',seed,teamSizes:[3,3],limit:90,startingRanks:['SSS+','SSS+'],terrain:'underpit',smartAI:true,...ARENA});
    s.smartTeams=team===0?[true,false]:[false,true];
    while(s.phase==='playing'&&s.time<95)stepArcade(s,1/60,{});
    const alive=[0,1].map(t=>s.fighters.filter(f=>f.team===t&&f.alive).length);
    if(alive[team]>alive[1-team])smart++;else if(alive[team]<alive[1-team])old++;
  }
  assert.ok(smart>=6&&old<=1,`smart ${smart}, old ${old}`);
});

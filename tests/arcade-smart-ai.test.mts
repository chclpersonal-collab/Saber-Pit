import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

// v6 AI audit: a scripted player against the live Arena AI, headless and seeded.
const ARENA={perfectParryStamina:true,continuousCombat:true,anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,
  repertoireSupport:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,impactPhysics:true,balancePass:true,closeChoice:true,
  guardCounterplay:true,minorMoves:true,forceVariants:true,weaponFlow:true,expandedCombat:true,circuitCuts:true,ratingSkill:true,
  customHeroTactics:true,advancedArena:true};

const angle=(a,b)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
/** Frames until the AI's committed swing lands on the player, or null when nothing is coming. */
function threat(me,ai){
  const sp=ai.attackSpec;if(!ai.alive||!ai.attack||!sp||ai.contact)return null;
  const until=(sp.contact??.2)-ai.actionTime;if(until<=0)return null;
  if(Math.hypot(me.x-ai.x,me.y-ai.y)>(sp.reach??80)+me.radius+30)return null;
  return Math.abs(angle(ai.face,Math.atan2(me.y-ai.y,me.x-ai.x)))>(sp.arc??1)+.45?null:until;
}
function open(ai){
  const sp=ai.attackSpec,left=ai.actionDuration-ai.actionTime;
  if(ai.action==='stagger')return left>.12;if(ai.guardLock>.12)return true;
  return Boolean(ai.attack&&sp&&ai.actionTime>(sp.contact??.2)+.03&&left>.18);
}
/** A scripted human who waits at range, guards just before contact and only swings into an opening. */
function skilled(s,me,ai,memo){
  const a=Math.atan2(ai.y-me.y,ai.x-me.x),d=Math.hypot(ai.x-me.x,ai.y-me.y),t=threat(me,ai);
  if(t!=null&&t<=.11&&me.energy>=6)memo.guardUntil=s.time+t+.08;
  if(memo.guardUntil>s.time)return {guard:true,x:0,y:0,aimX:ai.x,aimY:ai.y};
  if((open(ai)||(me.counterUntil??0)>s.time)&&d<105&&me.energy>=8)
    return {strike:true,x:Math.cos(a)*(d>70?1:.2),y:Math.sin(a)*(d>70?1:.2),aimX:ai.x,aimY:ai.y};
  const step=d<105?-1:d>130?1:0,c=a+Math.PI/2;
  return {x:Math.cos(a)*step*.8+Math.cos(c)*.3,y:Math.sin(a)*step*.8+Math.sin(c)*.3,aimX:ai.x,aimY:ai.y};
}

function duel(policy,ranks,seed,smartAI=true){
  const s=createArcade({mode:'duel',seed,teamSizes:[1,1],limit:90,startingRanks:ranks,form:'shii_cho',terrain:'underpit',smartAI,...ARENA});
  const me=s.fighters.find(f=>f.control),ai=s.fighters.find(f=>f.team===1);
  let tick=0,autoDefence=0,playerParries=0,aiDefence=0;const seen=new Set(),memo={guardUntil:0};
  while(s.phase==='playing'&&s.time<95){
    const a=Math.atan2(ai.y-me.y,ai.x-me.x),d=Math.hypot(ai.x-me.x,ai.y-me.y);
    stepArcade(s,1/60,policy==='spam'?{x:d>70?Math.cos(a):0,y:d>70?Math.sin(a):0,strike:(tick++%2)===0,aimX:ai.x,aimY:ai.y}:policy==='skill'?skilled(s,me,ai,memo):{});
    for(const e of s.events){if(seen.has(e.id))continue;seen.add(e.id);
      if(e.fighterId===me.id&&['rank_deflect','parry','block','rank_composure'].includes(e.kind))autoDefence++;
      if(e.fighterId===me.id&&e.kind==='parry')playerParries++;
      if(e.fighterId===ai.id&&['rank_deflect','parry','block'].includes(e.kind))aiDefence++;}
  }
  return {playerWon:!ai.alive&&me.alive,playerLost:!me.alive,autoDefence,playerParries,aiDefence};
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

test('timing beats mashing on identical seeds at every rank', () => {
  // Same seeds, same ranks: only the player's inputs differ. Skill must pay, mashing must not.
  for(const [rank,seeds] of [['A',6],['SSS+',8]]){
    let skillWins=0,skillLosses=0,spamWins=0,spamLosses=0,parries=0,aiDefence=0;
    for(let seed=1;seed<=seeds;seed++){
      const k=duel('skill',[rank,rank],seed),m=duel('spam',[rank,rank],seed);
      skillWins+=Number(k.playerWon);skillLosses+=Number(k.playerLost);spamWins+=Number(m.playerWon);spamLosses+=Number(m.playerLost);
      parries+=k.playerParries;aiDefence+=k.aiDefence;
    }
    assert.ok(skillWins>spamWins&&skillLosses<spamLosses,`${rank}: skill ${skillWins}-${skillLosses}, mash ${spamWins}-${spamLosses}`);
    assert.ok(parries>0,`${rank}: a deliberate guard should parry`);
    assert.ok(aiDefence>0,`${rank}: the AI should still defend`);
  }
});

test('an ally standing in the line holds the punish', () => {
  const s=createArcade({mode:'watch',teamSizes:[2,1],startingRanks:['F','F'],terrain:'underpit',smartAI:true});
  const [rear,screen,enemy]=s.fighters;
  Object.assign(rear,{x:410,y:300,face:0,think:0});Object.assign(screen,{x:460,y:300});Object.assign(enemy,{x:510,y:300});
  for(const f of [screen,enemy])Object.assign(f,{action:'stagger',actionDuration:20});
  for(let i=0;i<6;i++)stepArcade(s,1/60,{});
  assert.equal(rear.stats.saberSwings,0);
});

test('the decisive end of an elite match hits as hard as any other v6 match', () => {
  const setup={form:'makashi',startingRanks:['SSS+V','SSS+V'],teamForms:['makashi','makashi'],limit:75,smartAI:true};
  function sample(time,rule='elimination'){
    const s=createArcade({...setup,rule}),[p,e]=s.fighters;
    s.time=time;p.x=460;e.x=520;p.y=e.y=300;e.think=999;e.action='stagger';e.actionDuration=30;
    for(let i=0;i<21;i++)stepArcade(s,1/60,{strike:true,aimX:520,aimY:300});
    return s.stats.damage[0];
  }
  const early=sample(1),late=sample(70),plain=sample(70,'control');
  assert.ok(early>0&&early<late);assert.equal(late,plain);
});

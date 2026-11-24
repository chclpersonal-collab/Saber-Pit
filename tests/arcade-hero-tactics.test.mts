import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,ARCADE_ATTACKS} from '../dist/arcade-engine.js';
import {normalizeHeroTactics,chooseHeroPlan,observeHeroPlan} from '../dist/arcade-hero-tactics.js';

const saved={bouts:9,wins:7,lastDoctrine:'defensive',variants:{defensive:{bouts:6,wins:5,score:3.8}},
  observed:{accuracy:.48,pressure:.53,guardRate:.32}};
const hero={id:'seeded-hero',name:'Elian Gray',form:'makashi',body:'femboy',grade:'F',doctrine:'defensive',
  weapon:'single',elo:2600,eloFloorGrade:'S',heroAdaptation:saved};
test('prior plans matter without dominating fresh guard and commitment evidence',()=>{
  const p=normalizeHeroTactics(saved),neutral={pressure:.35,guard:.09,force:0,whiff:.04,exposure:.09};
  const learned=chooseHeroPlan(p,neutral),untrained=chooseHeroPlan(normalizeHeroTactics(),neutral);
  assert.ok(learned.scores.defensive>untrained.scores.defensive);
  assert.equal(chooseHeroPlan(p,{...neutral,guard:.87,pressure:.05}).plan,'aggressive');
  assert.equal(chooseHeroPlan(p,{...neutral,pressure:.91,force:.21}).plan,'defensive');
});
test('Hero combat grade cannot be overridden by a weak career or Elo floor',()=>{
  const s=createArcade({mode:'duel',heroLineup:{'1-0':hero},startingRanks:['F','F'],careers:{'1-0':{merit:0}}});
  const h=s.fighters[1];
  assert.equal(h.career.grade,'SSS+V');assert.equal(h.heroPlan,'defensive');
  assert.equal(h.heroElo,2600);assert.equal(h.heroEloFloorGrade,'S');
  assert.deepEqual(h.heroAdaptation,normalizeHeroTactics(saved));
  assert.equal(s.fighters[0].career.grade,'F');
});
test('Hero watches a real guarding opponent and changes active strategy, while ordinary fighter does not',()=>{
  const seed=13, options={mode:'duel',teamForms:['soresu','makashi'],startingRanks:['SSS+V','SSS+V'],seed};
  const withHero=createArcade({...options,heroLineup:{'1-0':hero}}),plain=createArcade(options);
  for(const s of [withHero,plain]){
    const [user,bot]=s.fighters;
    Object.assign(user,{x:480,y:305,face:0});
    Object.assign(bot,{x:591,y:305,face:Math.PI,think:200});
    for(let i=0;i<200;i++)stepArcade(s,1/120,{guard:true,aimX:bot.x,aimY:bot.y});
  }
  assert.equal(withHero.fighters[1].heroPlan,'aggressive');
  assert.ok(withHero.events.some(e=>e.kind==='hero_plan'&&e.previous==='defensive'&&e.plan==='aggressive'));
  assert.equal(plain.fighters[1].heroPlan,undefined);
  const [user,bot]=withHero.fighters;
  Object.assign(user,{x:480,y:305,action:'guard'});
  Object.assign(bot,{x:575,y:305,face:Math.PI,think:0,action:'idle',actionDuration:0,eliteReady:0});
  stepArcade(withHero,1/120,{guard:true,aimX:bot.x,aimY:bot.y});
  assert.equal(bot.action,'feint','aggressive plan uses the unlocked legal bait against observed guard');
});
test('the same live reader changes from guard-bait to defense after observing attacks, not invisible actors',()=>{
  const f={heroPlan:'balanced',heroAdaptation:normalizeHeroTactics(saved),energy:100},enemy={id:'red',action:'guard',stats:{},attackSerial:3};
  for(let i=1;i<=175;i++)observeHeroPlan(f,enemy,i/120,1/120,false,true);
  assert.equal(f.heroPlan,'balanced');
  for(let i=176;i<=355;i++)observeHeroPlan(f,enemy,i/120,1/120,true,true);
  assert.equal(f.heroPlan,'aggressive');
  Object.assign(enemy,{action:'slash',attack:'slash',attackSpec:ARCADE_ATTACKS.slash});
  for(let i=356;i<=550;i++){if(i%45===0)enemy.attackSerial++;observeHeroPlan(f,enemy,i/120,1/120,true,true);}
  assert.equal(f.heroPlan,'defensive');
});

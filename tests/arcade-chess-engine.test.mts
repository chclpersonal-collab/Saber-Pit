import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARCADE_CHESS_STYLES} from '../dist/arcade-chess-styles.js';
const dt=1/120;
const setup=(options={})=>createArcade({mode:'duel',seed:8,terrain:'open',form:'shii_cho',
  teamForms:['shii_cho','shii_cho'],startingRanks:['F','F'],...options});
test('classic/invalid styles leave identical core state and seed trajectory',()=>{
  const a=setup(), b=setup({chessStyles:['none','invalid']});
  for(let i=0;i<260;i++){const controls={x:i<100?1:0,strike:i===120};stepArcade(a,dt,controls);stepArcade(b,dt,controls);}
  assert.deepEqual(a,b);
});
test('committed saber timing is unchanged even as every emitter receives reach exactly once',()=>{
  for (const weapon of ['single','dual','staff']){
    const a=setup({startingSaberWeapon:[weapon,'single']}),b=setup({startingSaberWeapon:[weapon,'single'],chessStyles:['queen','none']});
    for(const g of [a,b])stepArcade(g,dt,{strike:true});
    const old=a.fighters[0].attackSpec,newer=b.fighters[0].attackSpec;
    assert.equal(newer.contact,old.contact);assert.equal(newer.duration,old.duration);
    assert.equal(newer.reach,old.reach*ARCADE_CHESS_STYLES.queen.reach);assert.equal(newer.cost,old.cost);
    for(const invariant of ["damage","lunge","knock","recoil"])assert.equal(newer[invariant],old[invariant]);
    if(old.offhand){
      assert.equal(newer.offhand.contact,old.offhand.contact);assert.equal(newer.offhand.reach,old.offhand.reach*ARCADE_CHESS_STYLES.queen.reach);
      assert.equal(newer.offhand.blade,old.offhand.blade);
    }
  }
});
const stage=(style,bearing,form='shii_cho')=>{
  const g=setup({chessStyles:[style,'none'],form,teamForms:[form,form]});
  const [a,b]=g.fighters; a.x=500;a.y=320;b.x=500+75*Math.cos(bearing);b.y=320+75*Math.sin(bearing);
  a.face=bearing; b.face=bearing+Math.PI;b.action='stagger';b.actionDuration=4;
  stepArcade(g,dt,{strike:true,aimX:b.x,aimY:b.y});
  const start=a.attackSpec.contact;
  a.actionTime=start-dt*.3;
  stepArcade(g,dt,{aimX:b.x,aimY:b.y});
  return a.stats.saberLanded;
};
test('actual releases distinguish cardinal and diagonal world lanes',()=>{
  assert.deepEqual(['rook','bishop'].map(s=>stage(s,0)),[1,0]);
  assert.deepEqual(['rook','bishop'].map(s=>stage(s,Math.PI/4)),[0,1]);
});
const defend=(config={},energy=40,guardAge=0,flags={})=>{
  const g=setup(config);const [victim,attacker]=g.fighters;
  victim.energy=energy;victim.x=500;victim.y=320;victim.face=0;
  attacker.x=560;attacker.y=320;attacker.face=Math.PI;
  attacker.action=flags.action??'slash';attacker.attack='slash';attacker.attackSerial=5;
  attacker.actionDuration=.55;attacker.actionTime=.19;
  attacker.attackSpec={duration:.55,contact:.196,reach:100,arc:1.1,damage:flags.damage??16,cost:0,lunge:0,knock:100,recoil:.2};
  if(guardAge){
    victim.action='guard';victim.actionTime=guardAge;victim.guardBearing=0;victim.guardHeld=true;
    victim.parryTime=flags.parryTime??.1;
  }
  if(flags.cooling)victim.perfectParryReadyAt=1;
  stepArcade(g,dt,{guard:true,aimX:attacker.x,aimY:attacker.y});
  return {victim,events:g.events};
};
test('only real early blade parries earn capped stamina, ordinary/late/cooling do not',()=>{
  const enabled={perfectParryStamina:true};
  const base=defend(), fresh=defend(enabled);
  assert.equal(fresh.events.find(e=>e.kind==='parry').staminaRestored,9);
  assert.equal(fresh.victim.moves.perfect_parry,1);
  assert.equal(fresh.victim.energy,base.victim.energy+9);
  assert.equal(defend(enabled,93).victim.energy,100);
  assert.equal(defend(enabled,40,.12).events.find(e=>e.kind==='parry')?.perfect,undefined);
  assert.equal(defend(enabled,40,0,{cooling:true}).events.find(e=>e.kind==='parry')?.perfect,undefined);
  assert.equal(defend(enabled,40,0,{action:'force'}).events.some(e=>e.perfect),false);
});
test('low stamina strains a held saber guard but timely parry still succeeds',()=>{
  const enabled={perfectParryStamina:true},flags={parryTime:0,damage:30};
  const normal=defend({},23,.3,flags), tired=defend(enabled,23,.3,flags);
  assert.ok(normal.events.some(e=>e.kind==='block'));
  assert.ok(tired.events.some(e=>e.kind==='break'));
  assert.equal(defend(enabled,23,0,flags).events.find(e=>e.kind==='parry')?.perfect,true);
});
test('a clean body hit awards actual stamina only once across dual emitters and targets',()=>{
  const g=setup({mode:'squad',teamSizes:[1,2],startingSaberWeapon:['dual','single'],perfectParryStamina:true});
  const [a,...targets]=g.fighters;
  a.x=500;a.y=320;a.face=0;a.energy=55;
  for(let i=0;i<targets.length;i++){const b=targets[i];b.x=566;b.y=320+(i===0?-19:19);
    b.face=Math.PI;b.action='stagger';b.actionDuration=4;}
  stepArcade(g,dt,{strike:true,aimX:566,aimY:320});
  assert.ok(a.attackSpec.offhand);
  for(let i=0;i<80&&a.attack;i++)stepArcade(g,dt,{aimX:566,aimY:320});
  const rewards=g.events.filter(e=>e.kind==='stamina_hit');
  assert.ok(a.stats.saberHits>=2);
  assert.ok(a.moves.offhand>=1);
  assert.equal(rewards.length,1);
  const reward=rewards[0];
  assert.equal(reward.staminaGain,{head:6,torso:4,leftArm:3,rightArm:3,leftLeg:5,rightLeg:5}[reward.region]);
  assert.ok(targets.some(t=>t.id===reward.targetId));
  assert.equal(a.moves.stamina_hit,1);
  assert.equal(defend({perfectParryStamina:true}).events.some(e=>e.kind==='stamina_hit'),false);
  assert.equal(defend({perfectParryStamina:true},1000,.3,{parryTime:0}).events.some(e=>e.kind==='stamina_hit'),false);
});

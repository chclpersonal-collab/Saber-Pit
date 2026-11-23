import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,ARCADE_ATTACKS,arcadeContactHeight} from '../dist/arcade-engine.js';
const dt=1/120;
const step=(s,n,input={})=>{for(let i=0;i<n;i++)stepArcade(s,dt,input);};
const angular=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
test('a real rear hit is remembered after reaction delay, turns without snapping, and can draw retaliation',()=>{
  const s=createArcade({foe:'makashi',form:'makashi',mode:'squad',teamForms:['makashi','makashi'],teamSizes:[2,1],seed:17});
  const [rear,front,bot]=s.fighters;
  Object.assign(rear,{x:510,y:300,face:0});
  Object.assign(front,{x:632,y:300,face:Math.PI,think:999,action:'stagger',actionDuration:50});
  Object.assign(bot,{x:577,y:300,face:0,think:999,targetId:front.id,targetUntil:10});
  step(s,1,{strike:true,aimX:bot.x,aimY:bot.y});
  for(let i=0;i<90&&!bot.rearHit;i++)step(s,1);
  assert.ok(bot.stats.damageTaken>0&&bot.rearHit?.id===rear.id);
  assert.equal(bot.targetId,front.id);assert.ok(bot.rearHit.readyAt-s.time>.12);
  const facing=bot.face;step(s,8);
  assert.ok(angular(bot.face,facing)<.02,'rear hit does not snap turn or block in hit stun');
  let chose=false,max=0;
  for(let i=0;i<105&&!chose;i++){
    const before=bot.face;step(s,1);max=Math.max(max,angular(before,bot.face));
    chose=angular(bot.face,Math.atan2(rear.y-bot.y,rear.x-bot.x))<.50&&bot.targetId===rear.id;
  }
  assert.ok(chose);assert.ok(max<.29);
});
test('an imminent front release can delay switching to a remembered rear attacker',()=>{
  const s=createArcade({mode:'squad',teamSizes:[2,1],form:'makashi',teamForms:['makashi','makashi'],seed:19});
  const [rear,front,bot]=s.fighters;
  Object.assign(rear,{x:510,y:300,face:0});
  Object.assign(front,{x:634,y:300,face:Math.PI,think:999,action:'slash',attack:'slash',attackSpec:ARCADE_ATTACKS.slash,actionDuration:.3,actionTime:.04});
  Object.assign(bot,{x:573,y:300,face:0,think:999,rearHit:{id:rear.id,readyAt:0,expires:1.5}});
  step(s,1);
  assert.equal(bot.awarenessFacing,false);assert.ok(angular(bot.face,0)<.05);
  step(s,30);
  assert.equal(bot.targetId,rear.id);
});
test('real jump can lift above a low swing but cannot evade a valid high strike',()=>{
  function result(name){
    const s=createArcade({form:'ataru',teamForms:['ataru','djem_so'],seed:101}),[p,e]=s.fighters;
    Object.assign(p,{x:450,y:300});Object.assign(e,{x:514,y:300,think:999,action:'stagger',actionDuration:30});
    step(s,1,{jump:true});
    for(let n=0;n<70&&p.airHeight<42;n++)step(s,1);
    assert.equal(p.airPhase,'airborne');assert.ok(p.airHeight>=42);assert.equal(p.invuln,0);
    const spec=ARCADE_ATTACKS[name];
    Object.assign(e,{face:Math.PI,action:name,attack:name,attackSpec:spec,actionTime:spec.contact-dt*.55,actionDuration:spec.duration});
    assert.equal(arcadeContactHeight(e,p,spec),name==='uppercut');
    step(s,1);
    return p.stats.damageTaken;
  }
  assert.equal(result('sweep'),0);assert.ok(result('uppercut')>0);
});
test('Ataru vault-dodge is hittable while the short grounded dash window still works',()=>{
  function result(form){
    const s=createArcade({form,teamForms:[form,'djem_so'],seed:19}),[p,e]=s.fighters;
    Object.assign(p,{x:450,y:300});Object.assign(e,{x:515,y:300,think:999,action:'stagger',actionDuration:30});
    step(s,1,{dash:true,aimX:510,aimY:300});
    const inv=p.invuln;
    Object.assign(e,{face:Math.PI,action:'uppercut',attack:'uppercut',attackSpec:ARCADE_ATTACKS.uppercut,actionTime:.210,actionDuration:.435});
    step(s,1);
    return {inv,damage:p.stats.damageTaken};
  }
  const ataru=result('ataru'), makashi=result('makashi');
  assert.equal(ataru.inv,0);assert.ok(ataru.damage>0);
  assert.ok(makashi.inv>0);assert.equal(makashi.damage,0);
});

test('interrupted airborne fighter cannot begin grounded attacks or snap-turn before landing',()=>{
  const s=createArcade({form:'ataru',seed:72}),[p,e]=s.fighters;
  Object.assign(e,{think:999,action:'stagger',actionDuration:50});
  step(s,1,{jump:true,x:1});
  step(s,25);assert.equal(p.airPhase,'airborne');assert.ok(p.airArc);
  p.action='stagger';p.actionTime=0;p.actionDuration=.025;
  const prior=p.face;
  step(s,6);
  assert.equal(p.action,'idle');assert.equal(p.airPhase,'airborne');
  step(s,1,{strike:true,aimX:p.x-100,aimY:p.y});
  assert.equal(p.attack,null);assert.equal(p.face,prior);
});

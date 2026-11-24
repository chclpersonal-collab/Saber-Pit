/** Reproducible v2.10 saber grip/weapon checks. Headless, no DOM or modifications.
 * node build/scripts/audit-arcade-sabers-v210.mjs [engine path] [--progress]
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const path=process.argv.slice(2).find(a=>!a.startsWith('--'));
const urls=path?pathToFileURL(resolve(path)):new URL('../dist/arcade-engine.js',import.meta.url);
const {createArcade,stepArcade}=await import(urls);
const {arcadeBladeWorld,sampleArcadeFighter}=await import(new URL('./arcade-fighters.js',urls));
const {bladeIntersection}=await import(new URL('./arcade-clashes.js',urls));
const dt=1/120,progress=process.argv.includes('--progress');
const options={
  standard:['single','forward'],
  reverse:['single','backhand'],
  reverseDual:['dual','backhand'],
  staff:['staff','forward'],
};
const kit=(one,two=options.standard)=>({
  startingSaberWeapon:[one[0],two[0]],startingSaberGrip:[one[1],two[1]],
});
const outcomeKinds=new Set(['hit','launch']);
const actorHits=(log,f)=>log.filter(e=>e.fighterId===f.id&&outcomeKinds.has(e.kind)&&e.damage>0);
const happened=(log,fn)=>log.find(fn);
function tickLog(s,time,inputs){
  const events=[];
  for(let i=0;i<Math.ceil(time/dt)&&s.phase==='playing';i++){
    const before=s.eventId;
    stepArcade(s,dt,inputs?.(i)??{});
    if(s.eventId===before)continue;
    assert.ok(s.events[0].id<=before+1,'event ring overrun');
    events.push(...s.events.filter(e=>e.id>before));
  }
  return events;
}
function setUp(optionsA,{front=[66],rear=[],allies=[],form='makashi',seed=4,dualPhase=false}={}){
  const size=[1+allies.length,front.length+rear.length];
  const makeFighters=Array(size[1]).fill('soresu');
  const s=createArcade({mode:'squad',form,teamSizes:size,teamForms:[Array(size[0]).fill(form),makeFighters],
    seed,terrain:'underpit',limit:45,startingDualPhase:[dualPhase,false],...kit(optionsA)});
  const p=s.fighters[0],friends=s.fighters.slice(1,size[0]),foes=s.fighters.slice(size[0]);
  Object.assign(p,{x:540,y:320,face:0});
  const fixture=(f,d)=>Object.assign(f,{x:p.x+d,y:p.y,face:d>0?Math.PI:0,think:999,action:'stagger',actionDuration:30});
  friends.forEach((f,i)=>fixture(f,allies[i]));
  foes.forEach((f,i)=>fixture(f,i<front.length?front[i]:-rear[i-front.length]));
  return {s,p,friends,foes,aim:{aimX:640,aimY:320}};
}
function swing(fixture,mutate){
  const {s,p,aim}=fixture;
  const start=tickLog(s,dt,()=>({...aim,strike:true}));
  assert.ok(p.attackSpec,'could not commit the actual attack');
  const spec=structuredClone(p.attackSpec);
  mutate?.(p);
  const l=start.concat(tickLog(s,1.15,()=>aim));
  return {l,spec,hits:actorHits(l,p),spent:p.stats.saberSwings,landed:p.stats.saberLanded};
}
function rigFor(name){
  const [weapon,grip]=options[name];
  const {s,p}=setUp(options[name]);
  assert.equal(p.gear.weapon,weapon);
  assert.equal(p.gear.grip,grip);
  const {blades}=arcadeBladeWorld(p,sampleArcadeFighter(p,s.time));
  assert.deepEqual(blades.map(b=>b.id),name==='staff'?['main','rear']:name==='reverseDual'?['main','off']:['main']);
  for(const b of blades)assert.ok(Number.isFinite(b.tip.x)&&Number.isFinite(b.tip.y)&&
    Math.hypot(b.tip.x-b.hand.x,b.tip.y-b.hand.y)>8);
  if(name==='staff'){
    const [front,rear]=blades, v=b=>[b.tip.x-b.hand.x,b.tip.y-b.hand.y];
    const a=v(front),b=v(rear);
    const cos=(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b));
    assert.ok(cos<-.999,'staff ends do not share an opposing rigid axis');
  }
  return blades.length;
}
function checkFriendly(gear,where){
  const side=where==='rear'?-1:1;
  const cfg={front:side>0?[74]:[],rear:side<0?[74]:[]};
  const open=setUp(gear,cfg),protectedEnemy=setUp(gear,{...cfg,allies:[side*37]});
  const alone=swing(open),screened=swing(protectedEnemy);
  assert.ok(alone.hits.length,'fixture needs a real unscreened contact');
  const e=happened(screened.l,e=>e.kind==='ally_blocked'&&e.fighterId===protectedEnemy.p.id&&e.targetId===protectedEnemy.friends[0].id);
  assert.ok(e&&screened.hits.length===0,'ally did not screen the real release');
  assert.ok(protectedEnemy.friends[0].alive&&protectedEnemy.friends[0].stats.damageTaken===0);
  for(const region of Object.values(protectedEnemy.friends[0].injuries))assert.deepEqual(region,{front:0,rear:0});
  return {where,blade:e.blade,screened:screened.l.filter(e=>e.kind==='ally_blocked').length};
}
function clash(name,expectedBlade){
  const option=options[name];
  const size=expectedBlade?3:1,line=Array(size).fill('makashi');
  for(let seed=1;seed<=8;seed++){
    const s=createArcade({mode:'watch',form:'makashi',teamForms:[line,line],teamSizes:[size,size],
      startingRanks:['F','F'],terrain:'underpit',limit:45,seed,...kit(option,option)});
    for(let i=0;i<12/dt&&s.phase==='playing';i++){
      const before=s.eventId,injuries=Object.fromEntries(s.fighters.map(f=>[f.id,f.injuries]));
      stepArcade(s,dt);
      const e=happened(s.events,e=>e.id>before&&e.kind==='clash'&&(!expectedBlade||[e.bladeA,e.bladeB].includes(expectedBlade)));
      if(!e)continue;
      const fighters=[e.aId,e.bId].map(id=>s.fighters.find(f=>f.id===id));
      assert.notEqual(fighters[0].team,fighters[1].team);
      assert.deepEqual(fighters.map(f=>f.injuries),fighters.map(f=>injuries[f.id]),'clash caused injury');
      assert.deepEqual(fighters.map(f=>f.action),['clash','clash']);
      assert.ok(fighters.every(f=>!f.attack&&f.clashFrom?.hand&&f.clashFrom?.tip));
      const [a,b]=fighters.map(f=>f.clashFrom);
      const intersect=bladeIntersection(a,b);
      assert.ok(intersect&&Math.hypot(e.x-intersect.x,e.y-intersect.y)<.1,'reported bind not at real intersection');
      assert.equal(e.damage,0);
      return {seed,time:e.time,bladeA:e.bladeA??(e.offhandA?'offhand':'primary'),bladeB:e.bladeB??(e.offhandB?'offhand':'primary')};
    }
  }
  throw Error(`No genuine clash for ${name} in audit seed set`);
}
const report={};
for(const name of ['reverse','reverseDual','staff']){
  const key=options[name],count=rigFor(name);
  const f=setUp(key,{front:name==='staff'?[54]:[51],rear:name==='staff'?[62]:[]});
  const {hits,spent,landed,spec,l}=swing(f);
  const blades=hits.map(e=>e.blade);
  assert.ok(blades.includes('primary'),`${name} failed primary real contact`);
  const inputs={blades,spent,landed,hitTargets:hits.map(e=>e.targetId)};
  for(const e of hits)assert.equal(e.weapon??f.p.gear.weapon,key[0]);
  for(const e of hits)assert.equal(e.grip??f.p.gear.grip,key[1]);
  if(name==='reverse'){
    assert.equal(hits.length,1);assert.equal(spent,1);
  }else if(name==='reverseDual'){
    assert.ok(blades.includes('offhand'),'delayed reverse offhand did not deal real injury');
    assert.equal(spent,2);
    assert.ok(hits.find(e=>e.blade==='offhand').time>hits.find(e=>e.blade==='primary').time);
  }else{
    assert.ok(blades.includes('rear'),'rear staff blade did not deal real injury');
    assert.equal(spent,1,'staff must not inflate committed strikes');
    assert.equal(landed,1,'staff must not inflate landed accuracy');
    assert.equal(spec.contact,spec.offhand.contact,'staff must release both ends on one timing');
    assert.equal(hits.find(e=>e.blade==='rear').time,hits.find(e=>e.blade==='primary').time);
    assert.equal(new Set(inputs.hitTargets).size,hits.length,'staff hit a target twice on one action');
    assert.ok(l.some(e=>e.fighterId===f.p.id&&e.blade==='rear'&&e.offhand),'no rear release event');
  }
  const secondary=name==='staff'?'rear':name==='reverseDual'?'offhand':null;
  report[name]={count,...inputs,screen:checkFriendly(key,name==='staff'?'rear':'front'),clash:clash(name),
    ...(secondary?{secondaryClash:clash(name,secondary)}:{})};
  if(progress)console.error(JSON.stringify({name,...report[name]}));
}
const reversed=swing(setUp(options.reverse)),standard=swing(setUp(options.standard));
assert.ok(reversed.spec.reach<standard.spec.reach&&reversed.spec.duration<standard.spec.duration,
  'backhand moves are a cosmetic-only option');
const rearControl=swing(setUp(options.standard,{front:[],rear:[62]}));
assert.deepEqual(rearControl.hits,[],'default forward single reaches into staff rear lane');

// Deliberately widen the already committed release arcs to overlap for a
// fault-injection check: the same target may not be charged twice even when
// both emitters claim it. This does not modify any production move/tuning.
const collision=swing(setUp(options.staff,{front:[51]}),p=>{
  p.attackSpec={...p.attackSpec,arc:Math.PI,reach:185,
    offhand:{...p.attackSpec.offhand,arc:Math.PI,reach:185}};
});
assert.equal(collision.hits.length,1,'one target charged damage twice in the same staff action');
assert.equal(collision.landed,1);
assert.equal(collision.spent,1);
report.staffSameTarget={hits:collision.hits.length,spent:collision.spent,landed:collision.landed};

const phaseEvents=log=>log.filter(e=>e.kind==='saber_phase');
const bladeSpans=(s,p)=>arcadeBladeWorld(p,sampleArcadeFighter(p,s.time)).blades
  .map(b=>Math.hypot(b.tip.x-b.hand.x,b.tip.y-b.hand.y));
function checkPhase(){
  const no=setUp(options.standard);
  assert.equal(phaseEvents(tickLog(no.s,.05,()=>({phase:true}))).length,0);
  assert.notEqual(no.p.saberPhase,'long');
  const ctrl=setUp(options.staff,{dualPhase:true});
  const short=bladeSpans(ctrl.s,ctrl.p),energy=ctrl.p.energy;
  const activated=phaseEvents(tickLog(ctrl.s,dt,()=>({phase:true})));
  assert.deepEqual(activated.map(e=>e.phase),['long']);
  assert.equal(ctrl.p.saberPhase,'long');
  const spentLong=energy-ctrl.p.energy;
  assert.ok(spentLong>4&&spentLong<=5,'long phase did not pay stamina');
  const long=bladeSpans(ctrl.s,ctrl.p);
  assert.ok(long.every((n,i)=>n>short[i]*1.23&&n<short[i]*1.29),'blade phase only changed label or one staff emitter');
  // An early re-press is rejected, not queued while the key remains held.
  tickLog(ctrl.s,dt,()=>({}));
  assert.equal(phaseEvents(tickLog(ctrl.s,1.25,()=>({phase:true}))).length,0);
  assert.equal(ctrl.p.saberPhase,'long');
  tickLog(ctrl.s,dt,()=>({}));
  const deactivated=phaseEvents(tickLog(ctrl.s,dt,()=>({phase:true})));
  assert.deepEqual(deactivated.map(e=>e.phase),['short']);
  assert.equal(ctrl.p.saberPhase,'short');
  const guarding=setUp(options.standard,{dualPhase:true});
  assert.equal(phaseEvents(tickLog(guarding.s,.05,()=>({phase:true,guard:true}))).length,0);
  assert.equal(guarding.p.saberPhase,'short');
  const busy=setUp(options.standard,{dualPhase:true});
  tickLog(busy.s,dt,()=>({...busy.aim,strike:true}));
  assert.ok(busy.p.attackSpec);
  assert.equal(phaseEvents(tickLog(busy.s,.75,()=>({phase:true}))).length,0);
  assert.equal(busy.p.saberPhase,'short');
  const empty=setUp(options.standard,{dualPhase:true});
  empty.p.energy=0;
  assert.equal(phaseEvents(tickLog(empty.s,.05,()=>({phase:true}))).length,0);
  assert.equal(empty.p.saberPhase,'short');

  // Range bracket: same declared start, target, input and seed, only phase differs.
  let bracket=null;
  for(let d=121;d<=157&&!bracket;d+=2){
    const a=setUp(options.standard,{dualPhase:true,front:[d]});
    const b=setUp(options.standard,{dualPhase:true,front:[d]});
    tickLog(a.s,dt,()=>({}));tickLog(b.s,dt,()=>({phase:true}));
    const near=swing(a),far=swing(b);
    if(near.hits.length===0&&far.hits.length>0){
      assert.ok(far.spec.reach>near.spec.reach&&far.spec.cost>near.spec.cost&&far.spec.duration>near.spec.duration);
      const targetGuard=setUp(options.standard,{dualPhase:true,front:[d]});
      tickLog(targetGuard.s,dt,()=>({phase:true}));
      const foe=targetGuard.foes[0],before=structuredClone(foe.injuries);
      Object.assign(foe,{action:'guard',actionDuration:0,decision:'guard',guardUntil:30});
      const guarded=swing(targetGuard);
      if(guarded.l.some(e=>e.kind==='block'&&e.fighterId===foe.id)){
        assert.deepEqual(foe.injuries,before);
        bracket={startGap:d,shortReach:near.spec.reach,longReach:far.spec.reach,
          shortHits:0,longHits:far.hits.length,guardedInjuries:0};
      }
    }
  }
  assert.ok(bracket,'no repeatable short-miss, long-hit and long-block fixture found');
  return {optOutRejected:true,guardRejected:true,busyRejected:true,emptyRejected:true,cooldownRejected:true,
    shortSpans:short,longSpans:long,spentLong,...bracket};
}
report.phase=checkPhase();
if(progress)console.error(JSON.stringify({name:'phase',...report.phase}));

function parity(raw){
  const s=createArcade({mode:'watch',form:'makashi',teamForms:[['makashi'],['makashi']],
    startingRanks:['SSS+V','SSS+V'],limit:45,seed:4,terrain:'underpit',...raw});
  const events=tickLog(s,45.04);
  return {time:s.time,phase:s.phase,events,stats:s.stats,injuries:s.fighters.map(f=>f.injuries)};
}
const omitted=parity({}),explicit=parity({...kit(options.standard),startingDualPhase:[false,false]});
assert.deepEqual(omitted,explicit,'explicit forward-single does not preserve the legacy default');
report.forwardDefaultParity={time:omitted.time,phase:omitted.phase,events:omitted.events.length};
console.log(JSON.stringify(report,null,2));

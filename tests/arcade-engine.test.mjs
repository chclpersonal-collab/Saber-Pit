import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_ATTACKS,ARCADE_FORM_IDS,createArcade,stepArcade} from '../dist/arcade-engine.js';
const frame=1/120;
const advance=(s,time,input={})=>{for(let i=0;i<Math.round(time/frame);i++)stepArcade(s,frame,input);};
function positionDuel(archetype='vanguard',gap=72){
  const s=createArcade({archetype});const [p,e]=s.fighters;
  p.x=450;e.x=p.x+gap;p.y=e.y=300;
  e.think=1000; // no newly chosen swings, although its footwork remains active
  return {s,p,e};
}
test('arcade modes, ranks, styles and seed remain deterministic',()=>{
  const commands=[{strike:true},{},{x:1},{guard:true},{dash:true},{heavy:true}];
  const run=mode=>{const s=createArcade({mode,seed:'fixture',round:15,archetype:'warden'});for(let i=0;i<540;i++)stepArcade(s,1/60,commands[i%commands.length]);return s;};
  assert.deepEqual(run('squad'),run('squad'));
  assert.equal(createArcade({mode:'duel'}).fighters.length,2);
  assert.equal(createArcade({mode:'watch'}).fighters.filter(f=>f.control).length,0);
  assert.equal(createArcade({mode:'squad'}).fighters.filter(f=>f.team===0).length,3);
  assert.equal(run('squad').round,15);assert.equal(run('squad').pressure,1);
  assert.equal(run('squad').fighters.find(x=>x.control).archetype,'warden');
});
test('movement and a directional dash travel through arena space without exiting',()=>{
  const {s,p,e}=positionDuel();
  e.action='stagger';e.actionDuration=10;
  const start=p.x;
  advance(s,.25,{x:-1});assert.ok(p.x<start-20&&p.groundDistance>20);
  const before=p.y;
  advance(s,.25,{x:0,y:1,dash:true});
  assert.ok(p.y>before+55&&p.energy<100);
  assert.equal(s.events.filter(e=>e.kind==='dash').length,1);
  advance(s,2,{x:-1});assert.ok(p.x>=s.bounds.minX&&p.x<=s.bounds.maxX);
  advance(s,4,{y:-1});assert.equal(p.y,s.bounds.minY);
});
test('slash has a telegraphed contact, buffered continuation and bounded event stream',()=>{
  const {s,p,e}=positionDuel('vanguard',80);
  const x=p.x;
  advance(s,.06,{strike:true});assert.equal(p.action,'slash');assert.equal(e.stats.damageTaken,0);assert.ok(p.x>x);
  advance(s,.07);assert.ok(e.stats.damageTaken>0);
  advance(s,.02,{strike:true});advance(s,.08);
  assert.equal(p.combo,2);
  assert.ok(s.events.some(e=>e.kind==='slash'&&e.combo===2));
});
test('archetype specials use unique action timings and launch on a confirmed uppercut',()=>{
  for(const [archetype,action] of Object.entries({warden:'uppercut',duelist:'rush',vanguard:'sweep'})){
    const {s,p,e}=positionDuel(archetype,105);
    e.action='stagger';e.actionDuration=.6;
    advance(s,.08,{heavy:true});assert.equal(p.action,action);assert.equal(p.actionDuration,ARCADE_ATTACKS[action].duration);
    advance(s,.24);assert.ok(e.stats.damageTaken>0);
    assert.ok(s.events.some(e=>e.kind===action));
    if(archetype==='warden'){assert.ok(e.airborne>0);assert.ok(s.events.some(e=>e.kind==='launch'));}
  }
});
test('fresh guard parries, held guard blocks, and an empty guard breaks',()=>{
  for(const [caseName,expected] of Object.entries({fresh:'parry',old:'block',empty:'break'})){
    const {s,p,e}=positionDuel('warden',67);
    if(caseName!=='fresh')advance(s,.31,{guard:true,aimX:e.x,aimY:e.y});
    p.x=450;p.y=300;e.x=515;e.y=300;e.face=Math.PI;
    if(caseName==='empty')p.energy=4.5;
    e.action='slash';e.attack='slash';e.actionDuration=ARCADE_ATTACKS.slash.duration;e.actionTime=.102;
    advance(s,.025,{guard:true,aimX:e.x,aimY:e.y});
    assert.ok(s.events.some(e=>e.kind===expected),caseName);
    if(caseName==='fresh'){assert.equal(p.stats.damageTaken,0);assert.equal(e.action,'stagger');}
    else if(caseName==='old')assert.equal(p.stats.damageTaken,0);
    else assert.ok(p.stats.damageTaken>0);
  }
});
test('watch squads finish, take damage and advance without external inputs',()=>{
  const counts={won:0,lost:0,draw:0};
  for(let seed=1;seed<=12;seed++){
    const s=createArcade({mode:'watch',seed});
    advance(s,45);
    assert.ok(s.time>4&&s.time<=45);
    assert.ok(s.stats.damageTaken.some(n=>n>0));assert.equal(s.events.at(-1)?.kind,'round');
    assert.ok(s.events.length<=48);
    for(const f of s.fighters)assert.ok(f.groundDistance>0&&typeof f.alive==='boolean'&&f.energy>=0&&f.energy<=100);
    counts[s.phase]++;
  }
  assert.ok(counts.won>0&&counts.lost>0);
});
test('a slash pressed during a dash is buffered into an actual attack',()=>{
  const {s,p,e}=positionDuel('duelist',140);
  e.action='stagger';e.actionDuration=1;
  advance(s,.04,{x:1,dash:true});
  assert.equal(p.action,'dash');
  advance(s,.025,{strike:true,aimX:e.x,aimY:e.y});
  advance(s,.15);
  assert.equal(p.action,'slash');
  assert.deepEqual(s.events.filter(x=>x.fighterId===p.id).slice(0,2).map(x=>x.kind),['dash','slash']);
});

test('all seven real form loadouts expose distinct authored heavy timing and show chosen appearance in watch',async()=>{
  const {ARCADE_FORMS,ARCADE_FORM_IDS}=await import('../dist/arcade-engine.js');
  const seen=new Set();
  for(const form of ARCADE_FORM_IDS){
    const s=createArcade({form,body:'woman',seed:'forms'});
    const fighter=s.fighters[0];
    stepArcade(s,frame,{heavy:true});
    assert.equal(fighter.form,form);assert.equal(fighter.body,'woman');
    assert.equal(fighter.technique,ARCADE_FORMS[form].heavy);
    assert.equal(s.events.at(-1).technique,fighter.technique);
    assert.ok(s.events.at(-1).contact>0);
    assert.ok(fighter.actionDuration>s.events.at(-1).contact);
    seen.add(fighter.technique);
    const watch=createArcade({form,body:'woman',mode:'watch'});
    assert.equal(watch.fighters[0].form,form);assert.equal(watch.fighters[0].body,'woman');
    assert.equal(watch.fighters[0].control,false);
    assert.ok(new Set(watch.fighters.map(f=>f.form)).size>=4);
  }
  assert.equal(seen.size,7);
  assert.deepEqual(new Set(Array.from({length:7},(_,r)=>createArcade({form:'shii_cho',round:r+1}).fighters[1].form)),new Set(ARCADE_FORM_IDS));
});
test('Ataru vaults under its own momentum and Niman force push physically displaces targets',()=>{
  const ataru=createArcade({form:'ataru'});
  const x=ataru.fighters[0].x;
  advance(ataru,.29,{heavy:true});
  assert.ok(ataru.fighters[0].airborne>0);assert.ok(ataru.fighters[0].x>x+30);
  const niman=createArcade({form:'niman'}),[p,e]=niman.fighters;
  p.x=400;e.x=550;p.y=e.y=300;e.action='stagger';e.actionDuration=2;
  advance(niman,.58,{heavy:true,aimX:550,aimY:300});
  assert.equal(p.x,400);assert.ok(e.x>580);assert.ok(e.stats.damageTaken>0);
  assert.ok(niman.events.some(e=>e.kind==='push'));
});
test('Soresu spends less on guard and Djem So unlocks faster counter after parry',()=>{
  function guardDuel(form){
    const s=createArcade({form}),[p,e]=s.fighters;p.x=450;e.x=530;p.y=e.y=300;e.think=10;
    return {s,p,e};
  }
  const soresu=guardDuel('soresu'), juyo=guardDuel('juyo');
  advance(soresu.s,.45,{guard:true});advance(juyo.s,.45,{guard:true});
  assert.ok(soresu.p.energy>juyo.p.energy);
  const {s,p,e}=guardDuel('djem_so');
  e.action='slash';e.attack='slash';e.face=Math.PI;e.actionTime=.105;e.actionDuration=.285;
  advance(s,.02,{guard:true});assert.ok(p.counterUntil>s.time);
  stepArcade(s,frame,{heavy:true});
  assert.equal(p.technique,'riposte');const fresh=createArcade({form:'djem_so'});stepArcade(fresh,frame,{heavy:true});
  assert.ok(p.actionDuration<fresh.fighters[0].actionDuration);
  assert.ok(s.events.at(-1).counter);
});
test('Juyo can physically chain four strikes, while other forms stop at three',()=>{
  function sequence(form){
    const s=createArcade({form});
    s.fighters[1].think=999;s.fighters[1].action='stagger';s.fighters[1].actionDuration=999;
    for(let i=0;i<220;i++)stepArcade(s,frame,{strike:i%11===0});
    return s.events.filter(e=>e.kind==='slash'&&e.team===0).map(e=>e.combo);
  }
  assert.ok(sequence('juyo').includes(4));
  assert.ok(!sequence('shii_cho').includes(4));
});

test('actual regional injury awards recent KO contributions and carries records forward',()=>{
  let s,p,ally,victim;
  for(let seed=1;seed<=50;seed++){
    s=createArcade({mode:'squad',form:'shii_cho',seed,startingRanks:['SSS+V','F']});
    let other,rest;
    [p,ally,other,victim,...rest]=s.fighters;
    for(const f of s.fighters){f.think=999;f.action='stagger';f.actionDuration=30;}
    victim.x=550;victim.y=300;victim.face=Math.PI;
    ally.x=470;ally.y=300;ally.face=0;ally.action='slash';ally.attack='slash';ally.actionTime=.106;ally.actionDuration=.5;
    // A smaller first hit provides assist credit without requiring fixed lethality.
    ally.attackSpec={...ARCADE_ATTACKS.slash,damage:3};
    p.x=630;p.y=301;p.action='idle';p.actionDuration=0;
    other.x=80;other.y=180;for(const f of rest){f.x=950;f.y=200+100*f.slot;}
    stepArcade(s,frame,{});
    assert.ok(victim.alive&&ally.stats.damage>0);
    advance(s,.95,{heavy:true,aimX:victim.x,aimY:victim.y});
    if(!victim.alive)break;
  }
  assert.equal(victim.alive,false);
  assert.equal(ally.stats.assists,1);assert.equal(p.stats.kills,1);assert.equal(victim.stats.deaths,1);
  assert.equal(s.stats.damage[0],s.stats.damageTaken[1]);
  const ko=s.events.find(ev=>ev.kind==='ko');
  assert.equal(ko.killerId,p.id);assert.equal(ko.fatal,true);assert.ok(ko.region);
  const next=createArcade({mode:'squad',form:'shii_cho',round:2,records:s.records});
  assert.deepEqual(next.stats.kills,[0,0]);assert.equal(next.records.teams[0].kills,1);
  assert.equal(next.records.soldiers.find(f=>f.id===ally.id).assists,1);
  next.records.teams[0].kills++; assert.equal(s.records.teams[0].kills,1);
});
test('one broad stroke can hit more than one target but counts as one successful strike for accuracy',()=>{
  const s=createArcade({mode:'squad',form:'shii_cho'}),[p,a,b,e1,e2,e3]=s.fighters;
  for (const f of s.fighters){f.think=999;f.action='stagger';f.actionDuration=30;}
  p.x=500;p.y=300;p.action='idle';p.actionDuration=0;
  a.x=80;a.y=180;b.x=80;b.y=400;e1.x=580;e1.y=270;e2.x=590;e2.y=335;e3.x=920;e3.y=360;
  advance(s,.32,{strike:true,aimX:590,aimY:300});
  assert.equal(p.stats.saberSwings,1);assert.equal(p.stats.saberHits,2);
  assert.equal(p.stats.saberLanded,1);assert.equal(p.stats.forceCasts,0);
});
test('several forms fight inside their intended range and do not hit indefinitely without moving',()=>{
  const s=createArcade({mode:'watch',form:'makashi',seed:19});
  const x0=s.fighters.map(f=>f.x);
  advance(s,2);
  assert.ok(s.fighters.some((f,i)=>Math.abs(f.x-x0[i])>90));
  assert.ok(s.stats.saberSwings.some(n=>n>0));
  assert.ok(new Set(s.events.filter(e=>e.contact>0).map(e=>e.technique)).size>=3);
  for (const f of s.fighters) assert.ok(f.y>=s.bounds.minY&&f.y<=s.bounds.maxY);
});

test('classic starting grades and imported slots affect regional readiness, contact, recovery and energy',()=>{
  const novice=createArcade({form:'makashi',startingRanks:['F','E']});
  const elite=createArcade({form:'makashi',startingRanks:['SSS+ (entry)','E'],careers:{'0-0':{merit:6500}}});
  const low=novice.fighters[0],high=elite.fighters[0];
  assert.equal(low.career.grade,'F');assert.equal(high.career.grade,'SSS+V');assert.equal(high.career.merit,6000);
  assert.equal(elite.fighters[1].career.grade,'E');
  assert.equal(createArcade({startingRanks:['SSS+ (entry)','SSS+ III']}).fighters[1].career.grade,'SSS+III');
  assert.deepEqual(high.injuries,low.injuries);assert.equal(Object.hasOwn(high,'hp'),false);
  stepArcade(novice,frame,{heavy:true});stepArcade(elite,frame,{heavy:true});
  assert.equal(high.technique,low.technique);
  assert.ok(high.attackSpec.contact<low.attackSpec.contact&&high.actionDuration<low.actionDuration&&high.energy>low.energy);
  assert.equal(high.career.modifiers.reloadMultiplier,.82);
});

test('walk is real slower ground movement and stopping burns off speed rather than sliding',()=>{
  const run=createArcade({form:'ataru'}),walk=createArcade({form:'ataru'}),analog=createArcade({form:'ataru'});
  advance(run,.4,{x:1}); advance(walk,.4,{x:1,walk:true});advance(analog,.4,{x:.4});
  assert.equal(run.fighters[0].action,'run');
  assert.equal(walk.fighters[0].action,'walk');assert.equal(analog.fighters[0].action,'walk');
  assert.ok(walk.fighters[0].groundSpeed>0&&walk.fighters[0].groundSpeed<run.fighters[0].groundSpeed*.55);
  const initial=run.fighters[0].groundSpeed; advance(run,.22);
  assert.ok(run.fighters[0].groundSpeed<initial*.025);
});
test('Ataru commits to a planted takeoff, crosses distance at height, and lands without midair foot stride',()=>{
  const s=createArcade({form:'ataru',startingRanks:['SSS+V','F']});const [p,e]=s.fighters;
  e.think=100;e.action='stagger';e.actionDuration=10;
  stepArcade(s,frame,{heavy:true});
  assert.equal(p.airPhase,'takeoff');assert.equal(p.airHeight,0);
  const contact=s.events.at(-1).contact,duration=s.events.at(-1).duration;
  assert.ok(contact>.38&&duration>.78);
  advance(s,.30);
  assert.equal(p.airPhase,'airborne');assert.ok(p.airHeight>35);
  const ground=p.groundDistance,x=p.x; advance(s,.13);
  assert.ok(p.x>x+20);assert.equal(p.groundDistance,ground);
  advance(s,.28);assert.equal(p.airPhase,'landing');assert.equal(p.airHeight,0);
  advance(s,.25);assert.equal(p.airPhase,'grounded');assert.equal(p.airborne,0);
});
test('each elite form has a readable basic attack, actual delayed contact, and planted follow-through',()=>{
  for(const form of ['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo']){
    const s=createArcade({form,startingRanks:['SSS+V','F']}),[p,e]=s.fighters;
    e.think=999;e.action='stagger';e.actionDuration=99;p.x=450;e.x=512;p.y=e.y=300;
    stepArcade(s,frame,{strike:true});
    assert.ok(p.attackSpec.contact>=.16,form);
    const contact=p.attackSpec.contact;
    advance(s,contact-.03);assert.equal(e.stats.damageTaken,0,form);
    advance(s,.08);assert.ok(e.stats.damageTaken>0,form);
    assert.ok(p.actionDuration-contact>.19,form);
  }
});

test('asymmetric teams support 1–15 clean stable slots, side presets, controlled slot and classic round lengths',()=>{
  const s=createArcade({mode:'squad',teamSizes:[15,4],terrain:'zigzag',limit:150,playerSlot:14,
    form:'soresu',teamForms:[['makashi','juyo'],'djem_so'],formations:['spread','wedge'],startingRanks:['A','B']});
  assert.equal(s.fighters.length,19);assert.equal(s.limit,150);
  assert.equal(s.fighters.find(f=>f.control).id,'0-14');assert.equal(s.fighters.find(f=>f.control).form,'soresu');
  assert.equal(s.fighters[1].form,'juyo');assert.equal(s.fighters[15].form,'djem_so');
  assert.equal(s.fighters.at(-1).id,'1-3');
  assert.equal(new Set(s.fighters.map(f=>`${f.x},${f.y}`)).size,19);
  const walls=s.terrain.solids;
  for(const f of s.fighters)assert.ok(!walls.some(r=>f.x>r.x-17&&f.x<r.x+r.width+17&&f.y>r.y-17&&f.y<r.y+r.height+17));
  const next=createArcade({mode:'squad',teamSizes:[15,1],limit:90,round:2,records:s.records});
  assert.equal(next.limit,90);assert.ok(next.records.soldiers.some(entry=>entry.id==='0-14'));
});
test('cover blocks saber attacks and body travel while rough land and rain genuinely slow movement',()=>{
  const terrain={id:'fixture',solids:[{x:507,y:250,width:14,height:100,kind:'wall'}]};
  const s=createArcade({form:'makashi',terrain}),[p,e]=s.fighters;
  e.think=999;e.action='stagger';e.actionDuration=99;p.x=460;e.x=555;p.y=e.y=300;
  advance(s,.75,{heavy:true,aimX:555,aimY:300});
  assert.equal(e.stats.damageTaken,0);assert.ok(p.x<=490);
  advance(s,.45,{x:1});assert.ok(p.x<=490.01);
  const rough={id:'slow',zones:[{x:300,y:250,width:270,height:100,kind:'rough',moveCost:1.5}]};
  const slowed=createArcade({form:'makashi',terrain:rough,weather:'rain'}),dry=createArcade({form:'makashi'});
  advance(slowed,.32,{x:1});advance(dry,.32,{x:1});
  assert.ok(slowed.fighters[0].groundDistance<dry.fighters[0].groundDistance*.66);
});
test('Command has no direct pilot, can hold a position and then advance',()=>{
  const s=createArcade({mode:'command',teamSizes:[2,1],form:'ataru',weather:'fog'});
  const p=s.fighters[0],before=p.x;
  assert.ok(s.fighters.every(f=>!f.control));
  advance(s,.6,{order:'hold',x:1,strike:true});assert.equal(s.order,'hold');assert.ok(Math.abs(p.x-before)<15);
  advance(s,.5,{order:'advance'});assert.equal(s.order,'push');assert.ok(p.x>before+24);
});
test('dedicated Force casts honor family and saber-only; offhand damage is independent and delayed',()=>{
  const s=createArcade({form:'makashi',startingForceFamily:['force_pulse','force_burst'],startingDualSabers:[true,false]});
  const [p,e]=s.fighters;
  e.action='stagger';e.actionDuration=99;e.think=999;p.x=450;e.x=501;p.y=e.y=300;
  stepArcade(s,frame,{strike:true});
  const timing=p.attackSpec;assert.ok(timing.offhand.contact>timing.contact+.09);
  advance(s,timing.contact+.025);
  assert.equal(p.stats.saberHits,1);assert.equal(p.stats.saberSwings,1);
  advance(s,.12);
  assert.equal(p.stats.saberHits,2);assert.equal(p.stats.saberSwings,2);
  advance(s,.55);stepArcade(s,frame,{force:true});
  assert.equal(p.action,'force');assert.equal(p.attackSpec.forceAbility,'force_pulse');assert.equal(p.stats.forceCasts,1);
  const locked=createArcade({form:'niman',saberOnly:true});
  stepArcade(locked,frame,{force:true});assert.equal(locked.fighters[0].action,'idle');
  stepArcade(locked,frame,{heavy:true});assert.equal(locked.fighters[0].action,'sweep');
  assert.deepEqual(locked.stats.forceCasts,[0,0]);
});

test('an elite whiff creates a real punish window consumed by a confirmed hit',()=>{
  const s=createArcade({form:'makashi',teamForms:['makashi','makashi'],startingRanks:['SSS+V','SSS+V']});
  const [p,e]=s.fighters;
  p.x=450;p.y=300;e.x=520;e.y=300;e.think=999;e.face=0;
  e.action='slash';e.attack='slash';e.attackSerial=1;e.actionTime=.107;e.actionDuration=.58;
  stepArcade(s,frame,{});
  assert.ok(e.exposedUntil>s.time);
  assert.equal(e.exposedBy,'whiff');assert.equal(e.stats.whiffs,1);
  advance(s,.20,{strike:true,aimX:e.x,aimY:e.y});
  const hit=s.events.find(evt=>evt.kind==='hit'&&evt.targetId===e.id);
  assert.ok(hit?.damage>0);
  assert.equal(hit.punish,true);assert.equal(hit.punishReason,'whiff');
  assert.equal(p.stats.punishes,1);assert.equal(s.stats.punishes[0],1);assert.equal(e.exposedUntil,0);
});

test('matched elites get active reads in a mirrored match without adding health or changing mismatches',()=>{
  const fights=grade=>{
    const rows=[];
    for(const form of ['makashi','ataru','niman','juyo']){
      const s=createArcade({mode:'watch',form,teamSizes:[1,1],teamForms:[form,form],startingRanks:grade,seed:303,terrain:'underpit',limit:45});
      const start=structuredClone(s.fighters[0].injuries);
      advance(s,45);
      rows.push({s,start});
    }
    return rows;
  };
  const novice=fights(['F','F']), elite=fights(['SSS+V','SSS+V']), mismatch=fights(['SSS+V','F']);
  for(const [i,{s,start}] of elite.entries()){assert.deepEqual(start,novice[i].start);assert.notEqual(s.phase,'playing');}
  assert.ok(elite.every(({s})=>s.time>=s.limit*.85));
  assert.ok(elite.reduce((total,r)=>total+r.s.time,0)>=novice.reduce((total,r)=>total+r.s.time,0));
  assert.ok(elite.reduce((n,{s})=>n+s.stats.parries[0]+s.stats.parries[1],0)>10);
  assert.ok(elite.reduce((n,{s})=>n+s.stats.punishes[0]+s.stats.punishes[1],0)>10);
  assert.equal(mismatch.reduce((n,{s})=>n+s.stats.punishes[0]+s.stats.punishes[1],0),0);
});

test('blade intersections interrupt both real engines before injury contact and preserve the bind point',()=>{
  let detail;
  for(let seed=1;seed<=5&&!detail;seed++){
    const s=createArcade({mode:'watch',form:'makashi',teamSizes:[1,1],teamForms:['makashi','makashi'],terrain:'underpit',seed});
    for(let i=0;i<45/frame&&s.phase==='playing'&&!detail;i++){
      const before=s.fighters.map(f=>f.injuries),previous=s.eventId;
      stepArcade(s,frame);
      const e=s.events.find(ev=>ev.id>previous&&ev.kind==='clash');
      if(e)detail={s,before,e};
    }
  }
  assert.ok(detail);
  const {s,before,e}=detail;
  assert.deepEqual(s.fighters.map(f=>f.injuries),before);
  assert.deepEqual(s.stats.clashes,[1,1]);
  for(const f of s.fighters){
    assert.equal(f.action,'clash');
    assert.equal(f.attack,null);assert.equal(f.clashX,e.x);assert.equal(f.clashY,e.y);
    assert.ok(f.clashFrom.hand&&f.clashFrom.tip);
  }
  assert.equal(e.damage,0);assert.notEqual(e.aId,e.bId);
});

test('elite clock pacing is restricted to equal all-max elimination; early damage is real and late is full',()=>{
  const setup={form:'makashi',startingRanks:['SSS+V','SSS+V'],teamForms:['makashi','makashi'],limit:75};
  assert.equal(createArcade({...setup,rule:'relic'}).elitePacing,null);
  assert.equal(createArcade({...setup,teamSizes:[1,2]}).elitePacing,null);
  assert.equal(createArcade({...setup,startingRanks:['SSS+V','SSS+IV']}).elitePacing,null);
  function sample(time,rule='elimination'){
    const s=createArcade({...setup,rule}),[p,e]=s.fighters;
    s.time=time;p.x=460;e.x=520;p.y=e.y=300;
    e.think=999;e.action='stagger';e.actionDuration=30;
    advance(s,.35,{strike:true,aimX:520,aimY:300});
    return s;
  }
  const early=sample(1),late=sample(70),plain=sample(70,'control');
  assert.equal(early.elitePacing.stage,'measured'); assert.equal(late.elitePacing.stage,'decisive');
  assert.ok(early.stats.damage[0]>0&&early.stats.damage[0]<late.stats.damage[0]);
  assert.equal(late.stats.damage[0],plain.stats.damage[0]);
  assert.equal(early.fighters[1].alive,true);
});

test('all 15 immutable Classic grade IDs derive monotonic live training and legal move access',async()=>{
  const [{SOLDIER_GRADES},{ARCADE_TECHNIQUES}]=await Promise.all([import('../dist/progression.js'),import('../dist/arcade-repertoire.js')]);
  const fighters=SOLDIER_GRADES.map(g=>createArcade({form:'makashi',startingRanks:[g.label,'F']}).fighters[0]);
  for(let i=1;i<fighters.length;i++){
    const a=fighters[i-1],b=fighters[i];
    assert.ok(b.rankCombat.reads>a.rankCombat.reads&&b.rankCombat.awareness>a.rankCombat.awareness);
    assert.ok(b.rankCombat.initiative>a.rankCombat.initiative&&b.rankCombat.staminaRecovery>a.rankCombat.staminaRecovery);
    assert.ok(b.rankCombat.holdEfficiency<a.rankCombat.holdEfficiency&&b.rankCombat.stability>a.rankCombat.stability);
    assert.equal(b.career.grade,SOLDIER_GRADES[i].label);
  }
  const locked=createArcade({form:'makashi',startingRanks:['D','F']});
  stepArcade(locked,frame,{technique:'mk_needle_lunge'});
  assert.equal(locked.fighters[0].attack,null);
  const unlocked=createArcade({form:'makashi',startingRanks:['SSS','F']});
  stepArcade(unlocked,frame,{technique:'mk_needle_lunge'});
  assert.equal(unlocked.fighters[0].moves.mk_needle_lunge,1);
  assert.equal(unlocked.fighters[0].stats.rankMoves,1);
  assert.equal(unlocked.fighters[0].attackSpec.reach,ARCADE_TECHNIQUES.mk_needle_lunge.reach);
  assert.equal(unlocked.events.at(-1).rankMove,true);
});
test('24 slots per side spawn legally without changing old sizes or control IDs',()=>{
  const s=createArcade({mode:'squad',form:'djem_so',width:960,height:540,teamSizes:[30,24],terrain:'zigzag',playerSlot:23});
  assert.deepEqual(s.config.teamSizes,[24,24]);assert.equal(s.fighters.length,48);
  for(const [i,a] of s.fighters.entries()){
    assert.ok(s.fighters.slice(0,i).every(b=>Math.hypot(a.x-b.x,a.y-b.y)>=36));
    assert.ok(!s.terrain.solids.some(r=>a.x>r.x-17&&a.x<r.x+r.width+17&&a.y>r.y-17&&a.y<r.y+r.height+17));
  }
  assert.equal(s.fighters.find(f=>f.control).id,'0-23');
  assert.equal(createArcade().fighters.length,2);
});
test('max-rank Watch master wins actual 1v15 and 1v24 wipes on both sides with stamina intact',()=>{
  for(const [team,count,form,terrain] of [[0,15,'makashi','crossroads'],[1,15,'ataru','craterfield'],[1,24,'djem_so','underpit']]){
    const s=createArcade({mode:'watch',seed:701,limit:45,form,terrain,teamSizes:team===0?[1,count]:[count,1],
      startingRanks:team===0?['SSS+V','F']:['F','SSS+V'],teamForms:team===0?[form,'mixed']:['mixed',form],
      startingForceQuality:['standard','standard'],startingForceFamily:['force_push','force_push'],startingSaberQuality:['standard','standard']});
    advance(s,45);
    const solo=s.fighters.find(f=>f.team===team);
    assert.equal(s.endReason,'elimination');assert.equal(solo.stats.kills,count);assert.ok(solo.alive&&solo.injuryEffects.moveSpeed>.65);
    assert.ok(solo.energy>=80);
    assert.ok(solo.stats.rankMoves>0&&(solo.stats.rankDeflections+solo.stats.rankComposure)>0);
    assert.ok(Object.keys(solo.moves).length>=4);
  }
});

test('a committed saber cannot hurt a teammate or the enemy screened behind them',()=>{
  const s=createArcade({mode:'squad',teamSizes:[2,1],archetype:'vanguard',terrain:'underpit'});
  const [p,a,e]=s.fighters;Object.assign(p,{x:400,y:300});Object.assign(a,{x:450,y:300});
  Object.assign(e,{x:493,y:300});
  for(const f of [a,e])Object.assign(f,{action:'stagger',actionDuration:20});
  advance(s,.16,{strike:true,aimX:e.x,aimY:e.y});
  assert.equal(a.stats.damageTaken,0);assert.equal(e.stats.damageTaken,0);
  assert.equal(p.stats.allyBlocks,1);assert.equal(s.stats.allyBlocks[0],1);
  assert.equal(s.events.find(ev=>ev.kind==='ally_blocked')?.targetId,a.id);
  a.y=370; advance(s,.5);advance(s,.18,{strike:true,aimX:e.x,aimY:e.y});
  assert.ok(e.stats.damageTaken>0,'moving ally out of the lane restores the attack');
});

test('stacked teammates resolve into individual bodies against arena edge',()=>{
  const s=createArcade({mode:'watch',teamSizes:[8,1],terrain:'underpit'});
  const allies=s.fighters.filter(f=>f.team===0);
  for(const [i,f] of allies.entries())Object.assign(f,
    {x:s.bounds.minX,y:s.bounds.minY+i*.01,action:'stagger',actionDuration:20});
  advance(s,.2);
  for(const a of allies)for(const b of allies)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>40);
  for(const a of allies)assert.ok(a.x>=s.bounds.minX&&a.y>=s.bounds.minY);
});

test('blocked supporting AI finds an open attack lane instead of swinging through its ally',()=>{
  const s=createArcade({mode:'watch',teamSizes:[2,1],startingRanks:['F','F'],terrain:'underpit'});
  const [rear,screen,enemy]=s.fighters;
  Object.assign(rear,{x:410,y:300,face:0,think:0});Object.assign(screen,{x:460,y:300});
  Object.assign(enemy,{x:510,y:300});
  for(const f of [screen,enemy])Object.assign(f,{action:'stagger',actionDuration:20});
  advance(s,.1);
  assert.equal(rear.stats.saberSwings,0);
  advance(s,2.3);
  assert.ok(Math.abs(rear.y-300)>32);
  assert.ok(rear.stats.saberHits>=1);
});

test('hard body sweep prevents organic frontline overlap around solid cover',()=>{
  const s=createArcade({mode:'watch',teamSizes:[15,15],terrain:'craterfield',seed:'covered-body-sweep',startingRanks:['F','F'],limit:45});
  let closest=Infinity;
  for(let i=0;i<720&&s.phase==='playing';i++){
    stepArcade(s,frame);
    for(let j=0;j<s.fighters.length;j++)for(let k=j+1;k<s.fighters.length;k++){
      const a=s.fighters[j],b=s.fighters[k];
      if(a.alive&&b.alive)closest=Math.min(closest,Math.hypot(a.x-b.x,a.y-b.y));
    }
  }
  assert.ok(closest>=33.9999&&closest<42,`physical clearance ${closest}`);
  assert.ok(s.stats.saberHits[0]+s.stats.saberHits[1]>10,'crowd still conducts real exchanges');
});

test('solo top-rank routes around cover before a 24-fighter group thins out',()=>{
  const sizes=[1,24],seed=1;
  const s=createArcade({mode:'watch',terrain:'craterfield',seed,teamSizes:sizes,startingRanks:['SSS+V','F'],limit:45,
    teamForms:sizes.map((n,t)=>Array.from({length:n},(_,i)=>ARCADE_FORM_IDS[(seed+i+t*2)%ARCADE_FORM_IDS.length]))});
  for(let i=0;i<30/frame&&s.phase==='playing';i++)stepArcade(s,frame);
  assert.equal(s.phase,'won');assert.equal(s.endReason,'elimination');
  assert.equal(s.stats.kills[0],24);
});

test('unlocked controlled Force forms apply named pulls and consume ward on real contact',async()=>{
  const {arcadeMovesFor}=await import('../dist/arcade-engine.js');
  const force=id=>arcadeMovesFor('makashi',14).find(x=>x.forceAbility===id).id;
  const arrangement=(s,ax=405,bx=525)=>{
    const [p,e]=s.fighters;Object.assign(p,{x:ax,y:300,face:0});
    Object.assign(e,{x:bx,y:300,face:Math.PI,think:999,action:'stagger',actionDuration:20});
    return [p,e];
  };
  const make=(saberOnly=false)=>createArcade({form:'makashi',startingRanks:['SSS+V','SSS+V'],saberOnly,rule:'control'});
  const s=make(),[p,e]=arrangement(s);
  advance(s,.6,{technique:force('pull'),aimX:e.x,aimY:e.y});
  assert.ok(e.x<525&&p.stats.forceCasts===1&&p.stats.saberSwings===0);
  assert.ok(s.events.some(x=>x.kind==='force_pull'&&x.technique===force('pull')));
  const disabled=make(true);arrangement(disabled);
  advance(disabled,.1,{technique:force('pull')});assert.equal(disabled.fighters[0].stats.forceCasts,0);
  const protectedMatch=make(),[guard,foe]=arrangement(protectedMatch,450,520);
  advance(protectedMatch,.6,{technique:force('ward')});
  assert.equal(guard.wardCharges,1);
  Object.assign(foe,{attack:'slash',action:'slash',actionDuration:.28,actionTime:.105,face:Math.PI});
  advance(protectedMatch,.025);
  assert.equal(guard.wardCharges,0);assert.equal(guard.stats.damageTaken,0);assert.equal(guard.moves.force_ward_block,1);
});

test('timeout uses surviving local condition rather than damage telemetry totals',()=>{
  const s=createArcade({mode:'watch',teamSizes:[1,1],limit:45}),[a,b]=s.fighters;
  s.time=45-frame;
  a.stats.damageTaken=10000;s.stats.damageTaken[0]=10000;
  b.injuries.rightLeg.front=73;
  for(const f of [a,b])Object.assign(f,{think:99,action:'stagger',actionDuration:20});
  stepArcade(s,frame);
  assert.equal(s.phase,'won');assert.equal(s.endReason,'timeout');
  assert.equal(Object.hasOwn(a,'hp'),false);assert.equal(Object.hasOwn(a,'maxHp'),false);
  assert.ok(a.alive&&b.alive);
});

test('v2.10 saber grip choices change reach and a reverse dual has a real second strike',()=>{
  const fixture=(weapon,grip,gap=52)=>{
    const s=createArcade({form:'makashi',startingSaberWeapon:[weapon,'single'],startingSaberGrip:[grip,'forward'],rule:'control'});
    const [a,b]=s.fighters;Object.assign(a,{x:470,y:300,face:0});
    Object.assign(b,{x:470+gap,y:300,face:Math.PI,think:999,action:'stagger',actionDuration:20});
    return {s,a,b};
  };
  const forward=fixture('single','forward'),reverse=fixture('single','backhand'),dual=fixture('dual','backhand');
  for(const {s,b} of [forward,reverse,dual])stepArcade(s,frame,{strike:true,aimX:b.x,aimY:b.y});
  assert.ok(reverse.a.attackSpec.reach<forward.a.attackSpec.reach&&reverse.a.attackSpec.arc>forward.a.attackSpec.arc);
  assert.equal(reverse.a.gear.bladeCount,1);assert.equal(dual.a.gear.bladeCount,2);
  assert.ok(dual.a.attackSpec.offhand.contact>dual.a.attackSpec.contact);
  for(const {s} of [forward,reverse,dual])advance(s,.36);
  const release=dual.s.events.find(e=>e.blade==='offhand'&&e.kind==='slash');
  const hit=dual.s.events.find(e=>e.blade==='offhand'&&e.kind==='hit');
  assert.equal(release.grip,'backhand');assert.equal(hit?.targetId,dual.b.id);
  assert.equal(dual.a.stats.saberSwings,2);
});

test('double-bladed saber releases front and rear against different targets, one commitment',()=>{
  for(const face of [0,Math.PI]){
    const s=createArcade({mode:'squad',teamSizes:[1,2],form:'shii_cho',startingSaberWeapon:['staff','single'],rule:'control',seed:43});
    const [a,front,rear]=s.fighters;Object.assign(a,{x:550,y:300,face});
    for(const [i,f] of [front,rear].entries())Object.assign(f,{x:550+60*Math.cos(face)*(i===0?1:-1),y:300,face:face+(i===0?Math.PI:0),think:999,action:'stagger',actionDuration:20});
    stepArcade(s,frame,{strike:true,aimX:front.x,aimY:front.y});
    assert.equal(a.attackSpec.contact,a.attackSpec.offhand.contact);
    advance(s,.39);
    const events=s.events.filter(e=>e.kind==='hit'&&e.fighterId===a.id);
    assert.deepEqual(events.map(e=>[e.blade,e.targetId]),[['primary',front.id],['rear',rear.id]]);
    assert.equal(events[0].time,events[1].time);
    assert.equal(a.stats.saberSwings,1);assert.equal(a.stats.saberLanded,1);assert.equal(a.stats.saberHits,2);
  }
});

test('dual-phase changes real reach at a stamina cost and cannot toggle during a swing',()=>{
  const fixture=dualPhase=>{
    const s=createArcade({form:'makashi',startingDualPhase:[dualPhase,false],rule:'control'});
    const [a,b]=s.fighters;Object.assign(a,{x:450,y:300});
    Object.assign(b,{x:585,y:300,think:999,action:'stagger',actionDuration:20});
    return {s,a,b};
  };
  const short=fixture(false),long=fixture(true);
  for(const {s} of [short,long])stepArcade(s,frame,{phase:true});
  assert.equal(short.a.saberPhase,'short');assert.equal(long.a.saberPhase,'long');
  assert.ok(long.a.energy<96&&long.a.saberPhaseReadyAt>saberTime(long.s));
  assert.equal(long.s.events[0].kind,'saber_phase');assert.ok(long.s.events[0].blades[0].tip);
  for(const {s,b} of [short,long])stepArcade(s,frame,{strike:true,aimX:b.x,aimY:b.y});
  assert.ok(long.a.attackSpec.reach>short.a.attackSpec.reach+10);
  assert.ok(long.a.attackSpec.duration>short.a.attackSpec.duration);
  stepArcade(long.s,frame,{phase:true});assert.equal(long.a.saberPhase,'long');
  for(const {s} of [short,long])advance(s,.5);
  assert.equal(short.a.stats.saberHits,0);assert.equal(long.a.stats.saberHits,1);
  advance(long.s,1);
  stepArcade(long.s,frame,{phase:true,guard:true});assert.equal(long.a.saberPhase,'long');
  stepArcade(long.s,frame,{});stepArcade(long.s,frame,{phase:true});
  assert.equal(long.a.saberPhase,'short');
});

test('long phase expands both staff emitters without giving a second attack commitment',()=>{
  const poses=[];
  for(const startLong of [false,true]){
    const s=createArcade({form:'shii_cho',startingSaberWeapon:['staff','single'],startingDualPhase:[true,false]});
    const [a]=s.fighters;
    stepArcade(s,frame,{phase:startLong});
    stepArcade(s,frame,{heavy:true});
    poses.push(a.attackSpec);
    assert.equal(a.attackSpec.contact,a.attackSpec.offhand.contact);
    assert.equal(a.stats.saberSwings,1);
  }
  assert.ok(poses[1].reach>poses[0].reach&&poses[1].offhand.reach>poses[0].offhand.reach);
});

function saberTime(s){return s.time+1;}

test('isolated elite reacts to both committed rivals without a survival floor',()=>{
  const s=createArcade({mode:'watch',terrain:'underpit',teamForms:['ataru','ataru'],teamSizes:[2,1],
    startingRanks:['SSS+V','SSS+V'],seed:2,limit:45});
  const solo=s.fighters.find(f=>f.team===1);
  while(s.phase==='playing')stepArcade(s,1/60);
  assert.ok(s.time>3.5,'previous clean opening ended this seed before one second');
  assert.ok(solo.stats.blocks+solo.stats.saberHits>2,'solo really defends and fights');
  assert.equal(s.phase,'won');assert.equal(solo.alive,false,'two masters still win this seed by elimination');
});

test('uneven peers contain ordinary contact but an earned punish keeps full strength',()=>{
  function sample(size,punish){
    const s=createArcade({mode:'squad',terrain:'underpit',teamForms:['makashi','makashi'],teamSizes:[1,size],
      startingRanks:['SSS+V','SSS+V'],rule:'control'});
    const [p,e,extra]=s.fighters;
    Object.assign(p,{x:450,y:300,face:0});
    for(const f of [e,extra].filter(Boolean))Object.assign(f,{x:f===e?519:920,y:300,face:Math.PI,think:999,action:'stagger',actionDuration:20});
    if(punish)Object.assign(p,{exposedUntil:1,exposedBy:'whiff'});
    Object.assign(e,{attack:'slash',attackSpec:ARCADE_ATTACKS.slash,action:'slash',actionTime:.106,actionDuration:.50});
    stepArcade(s,frame);
    return {s,d:p.stats.damageTaken,event:s.events.find(ev=>ev.kind==='hit')};
  }
  const even=sample(1,false),uneven=sample(2,false),punish=sample(1,true),punishUneven=sample(2,true);
  assert.ok(uneven.d>0&&uneven.d<even.d);
  assert.ok(punishUneven.event?.punish&&punishUneven.d===punish.d);
});

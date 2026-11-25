import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {CROWD_ENGAGE_CAP,CROWD_PERSONAS,crowdGapFear,crowdPersonaFor,crowdSteer} from '../dist/arcade-crowd-ai.js';

// v6 crowd AI: fear, morale, an engage cap, elite escapes and personalities, headless and seeded.
const ARENA={perfectParryStamina:true,continuousCombat:true,anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,
  repertoireSupport:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,impactPhysics:true,balancePass:true,closeChoice:true,
  guardCounterplay:true,minorMoves:true,forceVariants:true,weaponFlow:true,expandedCombat:true,circuitCuts:true,ratingSkill:true,
  customHeroTactics:true,advancedArena:true,smartAI:true,regionalInjuries:true};
const DT=1/120;
const run=(s,seconds,input=()=>({}),each=()=>{})=>{const end=s.time+seconds;while(s.phase==='playing'&&s.time<end){stepArcade(s,DT,input(s));each(s);}};
const trial=(seed,extra={})=>createArcade({mode:'watch',seed,teamSizes:[1,15],startingRanks:['SSS+V','F'],limit:150,form:'shii_cho',terrain:'underpit',...ARENA,crowdAI:true,...extra});
const pinkFear=s=>{const pink=s.fighters.filter(f=>f.team===1&&f.alive);return pink.reduce((n,f)=>n+f.crowd.fear,0)/pink.length;};

test('fear grows with the rank gap and is zero between near-equal ranks', () => {
  for(const gap of [0,1,2])assert.equal(crowdGapFear(gap),0,`gap ${gap}`);
  let last=0;
  for(let gap=3;gap<=12;gap++){const f=crowdGapFear(gap);assert.ok(f>last,`gap ${gap} should be scarier than ${gap-1}`);last=f;}
  assert.equal(crowdGapFear(12),1);assert.equal(crowdGapFear(14),1);
  // In a running crowd: F facing an SSS+ V is far more frightened than F facing a C, and F facing F is calm.
  const measured=ranks=>{const s=createArcade({mode:'watch',seed:5,teamSizes:[1,6],startingRanks:ranks,limit:90,form:'shii_cho',terrain:'underpit',...ARENA,crowdAI:true});run(s,4);return pinkFear(s);};
  const master=measured(['SSS+V','F']),middling=measured(['B','F']),peer=measured(['F','F']);
  assert.ok(master>.6,`F against SSS+ V: fear ${master}`);
  assert.ok(master>middling+.3,`fear should rise with the gap: ${middling} -> ${master}`);
  assert.equal(peer,0);
});

test('no more than three fighters swing at one target; the rest wait off it', () => {
  const s=trial(3);let samples=0,maxEngaged=0,waiting=0;
  run(s,40,undefined,g=>{
    if(Math.round(g.time*120)%12)return;
    const by=new Map();
    for(const f of g.fighters)if(f.team===1&&f.alive&&f.crowd.role==='engage'){const t=f.crowd.targetId;by.set(t,(by.get(t)??0)+1);}
    for(const n of by.values())maxEngaged=Math.max(maxEngaged,n);
    waiting+=g.fighters.filter(f=>f.team===1&&f.alive&&(f.crowd.role==='ring'||f.crowd.role==='hold'||f.crowd.state==='flee')).length;samples++;
  });
  assert.ok(samples>100);
  assert.ok(maxEngaged<=CROWD_ENGAGE_CAP,`engaged on one target: ${maxEngaged}`);
  assert.ok(waiting/samples>4,`most of the crowd should be waiting, circling or running: ${waiting/samples}`);
});

test('a frightened crowd breaks and runs while the master cuts it down', () => {
  const kinds={};
  for(const seed of [1,2]){
    const s=trial(seed);const seen=new Set();
    run(s,60,undefined,g=>{for(const e of g.events){if(seen.has(e.id))continue;seen.add(e.id);kinds[e.kind]=(kinds[e.kind]??0)+1;}});
  }
  assert.ok((kinds.crowd_flee??0)>=4,`flee events: ${kinds.crowd_flee}`);
  assert.ok((kinds.ko??0)>=10,`the master should be cutting the crowd down: ${kinds.ko} KOs in two minutes`);
  assert.ok((kinds.crowd_bark??0)<=24,`barks must stay rare: ${kinds.crowd_bark}`);
});

test('personalities are seeded, deterministic and mirrored between Blue and Pink', () => {
  for(const seed of [1,7,99,123456]){
    const block=Array.from({length:7},(_,slot)=>crowdPersonaFor(seed,slot));
    assert.deepEqual([...block].sort(),[...CROWD_PERSONAS].sort(),`seed ${seed}: every run of seven slots holds all seven`);
    assert.deepEqual(block,Array.from({length:7},(_,slot)=>crowdPersonaFor(seed,slot)),'same seed, same personalities');
  }
  const orders=new Set([1,2,3,4,5,6].map(seed=>Array.from({length:7},(_,slot)=>crowdPersonaFor(seed,slot)).join()));
  assert.ok(orders.size>1,'different seeds should deal different personalities');
  const s=createArcade({mode:'watch',seed:42,teamSizes:[5,5],limit:90,...ARENA,crowdAI:true});
  const again=createArcade({mode:'watch',seed:42,teamSizes:[5,5],limit:90,...ARENA,crowdAI:true});
  for(let slot=0;slot<5;slot++){
    const blue=s.fighters.find(f=>f.team===0&&f.slot===slot),pink=s.fighters.find(f=>f.team===1&&f.slot===slot);
    assert.equal(blue.crowd.persona,pink.crowd.persona,`slot ${slot} is mirrored`);
    assert.equal(again.fighters.find(f=>f.team===0&&f.slot===slot).crowd.persona,blue.crowd.persona);
  }
  run(s,20);run(again,20);
  assert.deepEqual(JSON.parse(JSON.stringify(s.fighters.map(f=>[f.x,f.y,f.alive,f.crowd]))),
    JSON.parse(JSON.stringify(again.fighters.map(f=>[f.x,f.y,f.alive,f.crowd]))),'the same seed plays the same crowd');
});

test('the crowd AI never steers the player-controlled fighter', () => {
  const s=createArcade({mode:'squad',seed:4,teamSizes:[1,15],startingRanks:['SSS+V','F'],limit:150,playerSlot:0,form:'shii_cho',terrain:'underpit',...ARENA,crowdAI:true});
  const me=s.fighters.find(f=>f.control);assert.ok(me);
  const command={x:.3,y:-.2,strike:true,aim:1};
  assert.equal(crowdSteer(s,me,s.fighters.find(f=>f.team===1),command),command,'the player command passes through untouched');
  let defended=0,moves=0;const seen=new Set();
  run(s,25,()=>({}),g=>{
    for(const e of g.events){if(seen.has(e.id))continue;seen.add(e.id);
      if(e.fighterId===me.id&&['parry','block','rank_deflect','dash','crowd_escape','crowd_bark','crowd_flee'].includes(e.kind))defended++;}
    if(me.attack||me.action==='guard'||me.action==='dash')moves++;
  });
  assert.equal(defended,0,'an idle player fighter never guards, dodges, escapes or barks on its own');
  assert.equal(moves,0,'an idle player fighter never swings, guards or dashes on its own');
  assert.notEqual(me.crowd.role,'engage');
});

test('a personality never turns a large rank gap around', () => {
  // Pick a seed for each personality in slot 0, then let it fight a far stronger and a far weaker fighter on both sides.
  const seeds=new Map();
  for(let seed=1;seeds.size<CROWD_PERSONAS.length;seed++)if(!seeds.has(crowdPersonaFor(seed,0)))seeds.set(crowdPersonaFor(seed,0),seed);
  for(const [persona,seed] of seeds){
    for(const [ranks,strong] of [[['SSS','F'],0],[['F','SSS'],1]]){
      const s=createArcade({mode:'watch',seed,teamSizes:[1,1],startingRanks:ranks,limit:90,teamForms:[['shii_cho'],['shii_cho']],terrain:'underpit',...ARENA,crowdAI:true});
      assert.equal(s.fighters[0].crowd.persona,persona);
      run(s,95);
      assert.equal(s.phase,strong===0?'won':'lost',`${persona} (seed ${seed}) ${ranks.join(' vs ')}: the stronger side must win`);
    }
  }
});

test('with the flag off nothing changes: classic games stay byte-identical', () => {
  const base={mode:'watch',seed:9,teamSizes:[3,3],limit:60,...ARENA};
  const a=createArcade(base),b=createArcade({...base,crowdAI:false});
  assert.equal('crowdAI' in a.config,false);assert.equal('crowd' in a,false);
  run(a,15);run(b,15);
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  // The crowd needs the smart layer and stays out of command mode and squad drills.
  assert.equal('crowdAI' in createArcade({...base,smartAI:false,crowdAI:true}).config,false);
  assert.equal('crowdAI' in createArcade({...base,mode:'command',crowdAI:true}).config,false);
  assert.equal(createArcade({...base,crowdAI:true}).config.crowdAI,true);
});

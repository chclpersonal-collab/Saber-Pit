/** Seeded grandmaster pressure + unchanged controls, headless.
 * node build/scripts/audit-arcade-pressure.mjs [engine JS] [seeds per form]
 * Options: --suite=uneven|pileups|controls --progress
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const args=process.argv.slice(2);
const [path,n]=args.filter(value=>!value.startsWith('--'));
const engine=path?pathToFileURL(resolve(path)):new URL('../dist/arcade-engine.js',import.meta.url);
const {createArcade,stepArcade,ARCADE_FORM_IDS}=await import(engine);
const seeds=Math.max(1,Math.min(24,Math.trunc(Number(n))||4)),dt=1/30;
const suite=args.find(value=>value.startsWith('--suite='))?.slice(8);
assert.ok(!suite||['uneven','pileups','controls'].includes(suite),'Unknown suite');
const TOP='SSS+V',F='F',clocks=[45,75,90,150],progress=args.includes('--progress');
const contactKinds=new Set(['hit','launch','block','parry','clash','rank_deflect','force_ward']);
const r=n=>Number(n.toFixed(2));
const mean=(xs)=>r(xs.reduce((a,b)=>a+b,0)/xs.length);
const pct=(a,b)=>r(100*a/b);
const quantile=(xs,p=.5)=>{
  const x=xs.filter(Number.isFinite).sort((a,b)=>a-b);
  return x.length?r(x[Math.floor((x.length-1)*p)]):null;
};
function fixture({side,form,count,seed,clock,pileup=false,late=false,rankA=TOP,rankB=TOP,map='underpit'}){
  const sizes=pileup?[15,15]:side?[count,1]:[1,count];
  const s=createArcade({mode:'watch',seed,limit:clock,teamSizes:sizes,terrain:map,rule:'elimination',
    teamForms:sizes.map(n=>Array(n).fill(form)),startingRanks:side?[rankB,rankA]:[rankA,rankB]});
  assert.equal(s.fighters.length,sizes[0]+sizes[1]);
  assert.equal(s.limit,clock);
  const focal=s.fighters.find(f=>f.team===side&&f.slot===0);
  let localOpponents=s.fighters.filter(f=>f.team!==side);
  if(pileup){
    // An isolated hotspot in a live-roster 15v15. Reserve units are physically
    // distant and held for this fixture; this measures local, not team pressure.
    // Mirror positions to ensure team orientation is not the explanation.
    const sign=side?-1:1,x=560,y=355;
    localOpponents=localOpponents.slice(0,count);
    const active=new Set([focal.id,...localOpponents.map(f=>f.id)]);
    Object.assign(focal,{x,y,face:side?Math.PI:0});
    const formation=count===2?[[74,-34],[71,34]]:[[66,0],[41,-64],[30,65]];
    for(const [i,f] of localOpponents.entries()){
      const [dx,dy]=formation[i];Object.assign(f,{x:x+sign*dx,y:y+dy,face:Math.atan2(-dy,-sign*dx)});
    }
    const reserve=[0,0];
    for(const f of s.fighters)if(!active.has(f.id)){
      const i=reserve[f.team]++,col=Math.floor(i/5),row=i%5;
      Object.assign(f,{x:f.team?1050-col*55:70+col*55,y:175+row*71,
        action:'stagger',actionDuration:clock+5,control:true,think:clock+5});
    }
    // Separate opening-state and late-decisive evidence. At the latter,
    // local KOs can occur in a legitimately clock-paced equal 15v15.
    if(late){s.time=clock*.80;s.tick=Math.round(s.time*120);}
  }
  return {s,focal,localOpponents};
}
function run(config){
  const {s,focal,localOpponents}=fixture(config);
  const local=new Set(localOpponents.map(f=>f.id));
  let first=null,last=0,contacts=0,hitOut=0,hitIn=0,pressureEvents=0,peakNearby=0,pressureSeconds=0;
  for(let i=0;i<Math.ceil((config.clock+.08)/dt)&&focal.alive&&s.phase==='playing';i++){
    stepArcade(s,dt);
    const nearby=localOpponents.filter(f=>f.alive&&Math.hypot(f.x-focal.x,f.y-focal.y)<=155).length;
    peakNearby=Math.max(nearby,peakNearby);
    if(nearby>=2)pressureSeconds+=dt;
    assert.ok(!s.eventId||s.events[0].id<=last+1,'event ring overflow');
    for(const e of s.events.slice(Math.max(0,s.events.length-(s.eventId-last)))){
      if(e.id<=last)continue;
      const focalAction=e.fighterId===focal.id&&local.has(e.targetId);
      const localAction=e.targetId===focal.id&&local.has(e.fighterId);
      if((focalAction||localAction)&&contactKinds.has(e.kind)){
        first??=e.time;contacts++;
        if(e.kind==='hit'||e.kind==='launch'){
          if(focalAction)hitOut++;else hitIn++;
        }
      }
      if(e.fighterId===focal.id&&(e.pressure||e.kind.startsWith('pressure')||e.kind.startsWith('outnumbered')))pressureEvents++;
      if(e.targetId===focal.id&&e.pressureGraze)pressureEvents++;
    }
    last=s.eventId;
    if(config.pileup&&(localOpponents.every(f=>!f.alive)||(first!==null&&s.time-first>=30)))break;
  }
  const localWipe=focal.alive&&localOpponents.every(f=>!f.alive);
  return {...config,first,elapsed:s.time,engaged:first===null?null:Math.max(0,s.time-first),alive:focal.alive,
    timeout:s.endReason==='timeout',localWipe,contacts,hitOut,hitIn,peakNearby,pressureSeconds,pressureEvents,
    damageOut:focal.stats.damage,damageIn:focal.stats.damageTaken,clashes:focal.stats.clashes,
    blocks:focal.stats.blocks,parries:focal.stats.parries,kills:focal.stats.kills,
    recoveries:focal.moves?.pressure_recover??0,grazes:focal.moves?.pressure_graze??0};
}
function summarize(runs){
  const n=runs.length,sum=k=>runs.reduce((a,b)=>a+b[k],0), count=fn=>runs.filter(fn).length;
  const q=(k,p)=>quantile(runs.map(x=>x[k]),p);
  return {
    n,firstContactP50:q('first'),elapsedP50:q('elapsed'),engagedP10:q('engaged',.1),engagedP50:q('engaged'),engagedP90:q('engaged',.9),
    deathEngagedP50:quantile(runs.filter(x=>!x.alive).map(x=>x.engaged)),
    deaths:count(x=>!x.alive),survived:count(x=>x.alive),
    survived5Pct:pct(count(x=>x.alive||x.engaged>=5),n),
    survived10Pct:pct(count(x=>x.alive||x.engaged>=10),n),
    survived20Pct:pct(count(x=>x.alive||x.engaged>=20),n),
    noContact:count(x=>x.first===null),wipes:count(x=>x.localWipe),timeouts:count(x=>x.timeout),
    near85Pct:pct(count(x=>x.elapsed+1e-7>=x.clock*.85),n),
    contactsAvg:mean(runs.map(x=>x.contacts)),hitInAvg:mean(runs.map(x=>x.hitIn)),hitOutAvg:mean(runs.map(x=>x.hitOut)),
    damageInAvg:mean(runs.map(x=>x.damageIn)),damageOutAvg:mean(runs.map(x=>x.damageOut)),
    blocksAvg:r(sum('blocks')/n),parriesAvg:r(sum('parries')/n),clashesAvg:r(sum('clashes')/n),
    reachedMultiplePct:pct(count(x=>x.peakNearby>=2),n),pressureSecondsP50:q('pressureSeconds'),pressureEvents:sum('pressureEvents'),
    recoveries:sum('recoveries'),grazes:sum('grazes'),
  };
}
function grid(config){
  const runs=[];
  for(const form of ARCADE_FORM_IDS)for(let seed=1;seed<=seeds;seed++)for(const side of [0,1]){
    runs.push(run({...config,form,seed,side}));
  }
  return {...config,...summarize(runs),
    bySide:Object.fromEntries([0,1].map(side=>[side,summarize(runs.filter(x=>x.side===side))])),
    byForm:Object.fromEntries(ARCADE_FORM_IDS.map(form=>[form,summarize(runs.filter(x=>x.form===form))]))};
}
const report=[];
function add(label,config){
  const row={label,...grid(config)};
  report.push(row);
  if(progress)console.error(`${label} ${config.clock}s: engaged median ${row.engagedP50}s, alive ${row.survived}/${row.n}; contacts ${row.contactsAvg}; near-clock ${row.near85Pct}%`);
}
if(!suite||suite==='uneven')for(const count of [2,3])for(const clock of [45,90,150])
  add(`elite 1v${count}`,{count,clock});
if(!suite||suite==='pileups')for(const count of [2,3]){
  add(`15v15 opening local 1v${count}`,{count,clock:90,pileup:true});
  add(`15v15 late local 1v${count}`,{count,clock:150,pileup:true,late:true});
}
if(!suite||suite==='controls'){
  for(const clock of clocks)add('elite 1v1',{count:1,clock});
  for(const count of [1,2,3])add(`F 1v${count}`,{count,clock:90,rankA:F,rankB:F});
  for(const map of ['underpit','crossroads'])add(`mastery 1v15 vs F (${map})`,{count:15,clock:90,rankA:TOP,rankB:F,map});
}
console.log(JSON.stringify({seeds,measure:'Focal duration after first resolved opponent contact; active at local horizon is right-censored.',report},null,2));

/** Shared-body and ally-safety audit. Usage: node build/scripts/audit-arcade-crowds-v28.mjs
 * [engine path] [seeds] [--maps=underpit,crossroads] [--fixtures-only]
 * [--json] [--progress]. A 120 Hz sample checks every tick.
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const args=process.argv.slice(2);
const [enginePath, seedText]=args.filter(s=>!s.startsWith('--'));
const engineUrl=enginePath?pathToFileURL(resolve(enginePath)):new URL('../dist/arcade-engine.js',import.meta.url);
const {createArcade,stepArcade,ARCADE_FORM_IDS}=await import(engineUrl);
const dt=1/120, seeds=Math.max(1,Math.min(16,Math.trunc(Number(seedText))||2)), tolerance=.25;
const defaults=['underpit','crossroads','zigzag','craterfield'];
const maps=args.find(s=>s.startsWith('--maps='))?.slice(7).split(',')??defaults;
if(maps.some(map=>!defaults.includes(map)))throw Error('Unknown --maps arena');
const scenarios=[
  {label:'F 3v3',sizes:[3,3],rank:['F','F'],clock:45},
  {label:'F 15v15',sizes:[15,15],rank:['F','F'],clock:45},
  {label:'SSS+V 1v15 F',sizes:[1,15],rank:['SSS+V','F'],clock:45},
  {label:'SSS+V 1v24 F',sizes:[1,24],rank:['SSS+V','F'],clock:45},
];
const eventPairs=new Set(['hit','launch','block','parry','break','clash','rank_deflect','rank_composure','push','ko']);
const contactKinds=new Set(['hit','launch','block','parry','break','clash','rank_deflect']);
type AuditBody = {hp?: number;alive?: boolean;stats?: {damageTaken?:number}};
const isAlive=(fighter:AuditBody): boolean=>fighter.alive??((fighter.hp??0)>0);
/** Legacy engines exposed a total HP pool; current Arcade exposes injury telemetry. */
const damageMeter=(fighter:AuditBody): number=>Number.isFinite(fighter.hp)?-fighter.hp!:(fighter.stats?.damageTaken??0);
const round=(n,p=2)=>Number.isFinite(n)?Number(n.toFixed(p)):null;
const pairEvidence=(s,a,b,vertical)=>({time:round(s.time),pair:[a.id,b.id],vertical:round(vertical),
  positions:[[round(a.x),round(a.y)],[round(b.x),round(b.y)]]});
function wallGap(f,w){
  const dx=Math.max(w.x-f.x,0,f.x-(w.x+w.width));
  const dy=Math.max(w.y-f.y,0,f.y-(w.y+w.height));
  return dx||dy?Math.hypot(dx,dy):-Math.min(f.x-w.x,w.x+w.width-f.x,f.y-w.y,w.y+w.height-f.y);
}
function simulate(opts){
  const {sizes,rank,clock,map,seed}=opts;
  const s=createArcade({mode:'watch',terrain:map,seed,teamSizes:sizes,startingRanks:rank,limit:clock,rule:'elimination',
    teamForms:sizes.map((n,t)=>Array.from({length:n},(_,i)=>ARCADE_FORM_IDS[(seed+i+t*2)%ARCADE_FORM_IDS.length]))});
  if(s.fighters.length!==sizes[0]+sizes[1]||s.limit!==clock||s.terrain.id!==map)throw Error('Invalid audit scenario config');
  return track(s,seed,null,opts);
}
function track(s,seed,input,opts={}){
  const roster=new Map(s.fighters.map(f=>[f.id,f]));
  const previous=new Map(s.fighters.map(f=>[f.id,[f.x,f.y]]));
  let minAny=Infinity,minAllies=Infinity,minOpponents=Infinity,minNearWall=Infinity,minGround=Infinity,minWallClearance=Infinity;
  let samples=0,overlapTicks=0,alliedOverlapTicks=0,boundChecks=0,maxPairs=0,quiet=0,lastContact=0,firstContact=null,lastId=0;
  let aliveSeconds=0,movement=0,guardSeconds=0,friendlyDamage=0,friendlyContact=0,hostileContact=0,firstKo=null,belowTargetTicks=0,allAltitudeOverlapTicks=0;
  const events={}, friendlyExamples=[];
  const pairStreaks=new Map();
  const edge=s.bounds, solids=s.terrain.solids;
  let worstPair=null,worstGroundPair=null,overlapStreak=0,streakPair=null;
  const sample=()=>{
    const live=s.fighters.filter(isAlive);
    const cached=live.map(f=>{
      let wall=Infinity;
      for(const w of solids) wall=Math.min(wall,wallGap(f,w));
      const bound=Math.min(f.x-edge.minX,edge.maxX-f.x,f.y-edge.minY,edge.maxY-f.y);
      minWallClearance=Math.min(minWallClearance,wall-f.radius);
      if(bound<-.001)boundChecks++;
      return {f,wall,bound};
    });
    let overlap=false,allAltitudeOverlap=false,allyOverlap=false,belowTarget=false,pairs=0;
    for(let i=0;i<live.length;i++)for(let j=0;j<i;j++){
      const a=cached[i],b=cached[j], dx=a.f.x-b.f.x,dy=a.f.y-b.f.y;
      const d=Math.hypot(dx,dy), team=a.f.team===b.f.team;
      const vertical=Math.abs((a.f.airHeight??0)-(b.f.airHeight??0));
      if(d<a.f.radius+b.f.radius-tolerance)allAltitudeOverlap=true;
      if(d<minAny){
        minAny=d;worstPair=pairEvidence(s,a.f,b.f,vertical);
      }
      if(vertical<=42){
        if(team)minAllies=Math.min(minAllies,d);else minOpponents=Math.min(minOpponents,d);
        if(Math.min(a.wall-a.f.radius,b.wall-b.f.radius,a.bound,b.bound)<12)minNearWall=Math.min(minNearWall,d);
        if(d<minGround){minGround=d;worstGroundPair=pairEvidence(s,a.f,b.f,vertical);}
        if(d<(team?42:36)-1)belowTarget=true;
        if(d<a.f.radius+b.f.radius-tolerance){
          overlap=true;allyOverlap||=team;pairs++;
          const key=`${a.f.id}|${b.f.id}`;
          const prev=pairStreaks.get(key);
          const ticks=prev?.sample===samples-1?prev.ticks+1:1;
          pairStreaks.set(key,{sample:samples,ticks});
          if(ticks>overlapStreak){overlapStreak=ticks;streakPair=pairEvidence(s,a.f,b.f,vertical);}
        }
      }
    }
    samples++;
    if(overlap)overlapTicks++;
    if(allAltitudeOverlap)allAltitudeOverlapTicks++;
    if(allyOverlap)alliedOverlapTicks++;
    if(belowTarget)belowTargetTicks++;
    maxPairs=Math.max(maxPairs,pairs);
    for(const f of live){
      const [x,y]=previous.get(f.id);
      movement+=Math.hypot(f.x-x,f.y-y);
      aliveSeconds+=dt;
      if(f.action==='guard'||f.guardHeld)guardSeconds+=dt;
      previous.set(f.id,[f.x,f.y]);
    }
  };
  sample(); // Includes actual initial deployments, before any solver correction.
  const maxTicks=Math.ceil((opts.maxTime??s.limit)/dt)+3;
  for(let i=0;i<maxTicks&&s.phase==='playing';i++){
    stepArcade(s,dt,input?.(s,i)??{});
    sample();
    if(s.eventId===lastId)continue;
    if(s.events[0]?.id>lastId+1)throw Error('Overflowed engine event buffer');
    const start=Math.max(0,s.events.length-(s.eventId-lastId));
    for(const e of s.events.slice(start)){
      events[e.kind]=(events[e.kind]??0)+1;
      const a=roster.get(e.fighterId),b=roster.get(e.targetId);
      if(a&&b&&eventPairs.has(e.kind)&&!e.environmental){
        if(a.team===b.team){
          friendlyContact++;
          friendlyDamage+=Math.max(0,e.damage??0);
          if(friendlyExamples.length<3)friendlyExamples.push(e);
        }else if(contactKinds.has(e.kind)){
          firstContact??=e.time;
          quiet=Math.max(quiet,e.time-lastContact);
          lastContact=e.time;
          hostileContact++;
        }
      }
      if(e.kind==='ko')firstKo??=e.time;
    }
    lastId=s.eventId;
  }
  return {seed,end:s.endReason??null,time:round(s.time),winner:s.phase==='won'?0:s.phase==='lost'?1:null,
    minAny:round(minAny),minGround:round(minGround),minAllies:round(minAllies),minOpponents:round(minOpponents),
    minNearWall:round(minNearWall),minWallClearance:round(minWallClearance),boundChecks,
    samples,overlapTicks,allAltitudeOverlapTicks,alliedOverlapTicks,belowTargetTicks,maxPairs,worstPair,worstGroundPair,overlapStreak,streakPair,
    pxPerAliveSecond:round(movement/aliveSeconds),guardSeconds:round(guardSeconds),
    firstContact:round(firstContact),quiet:round(Math.max(quiet,s.time-lastContact)),firstKo:round(firstKo),hostileContact,
    friendlyDamage,friendlyContact,friendlyExamples,events};
}
function laneFixture({name,screen,action,guard=false,extra=false}){
  const size=extra?2:1;
  const s=createArcade({mode:'squad',teamSizes:[2,size],limit:45,terrain:'underpit',
    teamForms:[['shii_cho','shii_cho'],Array(size).fill('soresu')]});
  const [p,ally,foe,sideFoe]=s.fighters;
  function place(f,x,y){Object.assign(f,{x,y,think:9999,action:'stagger',actionDuration:30,face:Math.PI});}
  place(ally,475,screen?320:220);place(foe,532,320);
  Object.assign(p,{x:415,y:320,face:0});
  if(guard)Object.assign(foe,{action:'guard',actionDuration:0,decision:'guard',guardUntil:30});
  if(sideFoe)place(sideFoe,510,395);
  const start=s.fighters.map(damageMeter);
  const evidence=track(s,1,(_s,i)=>({[action]:i===0,aimX:560,aimY:320}),{maxTime:1});
  return {name,
    allyDamage:damageMeter(ally)-start[1],screenedFoeDamage:damageMeter(foe)-start[2],
    exposedFoeDamage:sideFoe?damageMeter(sideFoe)-start[3]:null,allyBlocks:p.stats.allyBlocks??0,
    blocks:evidence.events.block??0,parries:evidence.events.parry??0,guardSeconds:evidence.guardSeconds
  };
}
function wallFixture(){
  const terrain={id:'audit-wall',bounds:{minX:42,maxX:1078,minY:140,maxY:585},
    solids:[{x:490,y:180,width:40,height:130,kind:'wall'}],zones:[]};
  const s=createArcade({mode:'squad',teamSizes:[2,1],terrain,limit:45,
    teamForms:[['ataru','soresu'],['makashi']]});
  const [p,ally,foe]=s.fighters;
  Object.assign(p,{x:430,y:260,face:0});
  Object.assign(ally,{x:472,y:260,action:'stagger',actionDuration:30});
  Object.assign(foe,{x:750,y:425,action:'stagger',actionDuration:30});
  const evidence=track(s,1,()=>({x:1,y:0}),{maxTime:2});
  return {minAllies:evidence.minAllies,overlapTicks:evidence.overlapTicks,
    belowTargetTicks:evidence.belowTargetTicks,wallClearance:evidence.minWallClearance,
    movement:evidence.pxPerAliveSecond,noOutsideBounds:evidence.boundChecks===0};
}
function flankFixture(){
  const s=createArcade({mode:'watch',teamSizes:[2,1],limit:45,terrain:'underpit',
    teamForms:[['makashi','soresu'],['soresu']]});
  const [p,ally,foe]=s.fighters;
  Object.assign(p,{x:415,y:320,face:0});
  Object.assign(ally,{x:475,y:320,action:'stagger',actionDuration:30});
  Object.assign(foe,{x:533,y:320,action:'stagger',actionDuration:30});
  let flank=0;
  const start=[damageMeter(ally),damageMeter(foe)];
  const evidence=track(s,1,()=>{
    if(damageMeter(foe)===start[1])flank=Math.max(flank,Math.abs(p.y-320));
    return {};
  },{maxTime:4});
  return {lateralBeforeFirstHit:round(flank),firstContact:evidence.firstContact,
    allyDamage:damageMeter(ally)-start[0],foeDamage:damageMeter(foe)-start[1],allyBlockedReleases:p.stats.allyBlocks??0};
}
const minimum=(rows,key)=>{
  const values=rows.map(x=>x[key]).filter(Number.isFinite);
  return values.length?Math.min(...values):null;
};
const sum=(rows,key)=>rows.reduce((n,x)=>n+x[key],0);
const rows=[];
for(const opts of (args.includes('--fixtures-only')?[]:scenarios))for(const map of maps){
  const runs=Array.from({length:seeds},(_,i)=>simulate({...opts,map,seed:i+1}));
  const overlapTicks=sum(runs,'overlapTicks'), samples=sum(runs,'samples');
  const row={case:opts.label,map,runs:runs.length,minGround:minimum(runs,'minGround'),minAny:minimum(runs,'minAny'),
    minAllies:minimum(runs,'minAllies'),minOpponents:minimum(runs,'minOpponents'),
    minNearWall:minimum(runs,'minNearWall'),minWallClearance:minimum(runs,'minWallClearance'),
    overlapTickPct:round(100*overlapTicks/samples),allyOverlapTickPct:round(100*sum(runs,'alliedOverlapTicks')/samples),
    allAltitudeOverlapTickPct:round(100*sum(runs,'allAltitudeOverlapTicks')/samples),
    longestOverlapSeconds:round(Math.max(...runs.map(r=>r.overlapStreak))*dt),
    belowTargetTickPct:round(100*sum(runs,'belowTargetTicks')/samples),
    movementAvg:round(sum(runs,'pxPerAliveSecond')/runs.length),guardSeconds:round(sum(runs,'guardSeconds')),
    hostileContacts:sum(runs,'hostileContact'),friendlyContact:sum(runs,'friendlyContact'),friendlyDamage:sum(runs,'friendlyDamage'),
    allyBlockedReleases:runs.reduce((sum,r)=>sum+(r.events.ally_blocked??0),0),
    timeouts:runs.filter(r=>r.end==='timeout').length,blueWins:runs.filter(r=>r.winner===0).length,
    ...(!args.includes('--json')?{}:{samples:runs})};
  rows.push(row);
  if(args.includes('--progress'))console.error(JSON.stringify({...row,samples:undefined}));
}
const fixtures=[
  laneFixture({name:'screened saber',screen:true,action:'heavy'}),
  laneFixture({name:'open saber',screen:false,action:'heavy'}),
  laneFixture({name:'screened Force',screen:true,action:'force'}),
  laneFixture({name:'open Force',screen:false,action:'force'}),
  laneFixture({name:'guarded saber',screen:false,action:'heavy',guard:true}),
  laneFixture({name:'screened plus exposed enemy',screen:true,action:'heavy',extra:true}),
];
const wall=wallFixture(),flank=flankFixture();
if (args.includes('--json'))console.log(JSON.stringify({rows,fixtures,wall,flank},null,2));
else {console.table(rows);console.table(fixtures);console.table(wall);console.table(flank);}

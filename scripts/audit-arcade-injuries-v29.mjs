/** Fictional v2.9 engine integration audit, no DOM.
 * node scripts/audit-arcade-injuries-v29.mjs [engine path] [seeds/form]
 * [--suite=fixtures|mastery|mirrors] [--maps=underpit,crossroads,...] [--progress]
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);
const [path,n]=args.filter(arg=>!arg.startsWith('--'));
const url=path?pathToFileURL(resolve(path)):new URL('../dist/arcade-engine.js',import.meta.url);
const {createArcade,stepArcade,ARCADE_FORM_IDS,arcadeMovesFor}=await import(url);
const {SOLDIER_GRADES}=await import(new URL('./progression.js',url));
const {ARCADE_BODY_REGIONS,arcadeInjuryEffects}=await import(new URL('./arcade-injuries.js',url));
const ids=ARCADE_BODY_REGIONS.map(region=>region.id);
const ranks=SOLDIER_GRADES.map(x=>x.label),top=ranks.at(-1);
const seedCount=Math.max(1,Math.min(16,Math.trunc(Number(n))||2));
const opt=prefix=>args.find(arg=>arg.startsWith(prefix))?.slice(prefix.length);
const suite=opt('--suite='),maps=opt('--maps=')?.split(',')??['underpit','crossroads','zigzag','craterfield'];
assert.ok(!suite||['fixtures','mastery','mirrors'].includes(suite),'Invalid --suite value');
const report={}, progress=args.includes('--progress');
const dt=1/30, pct=(a,b)=>r(100*a/b);
const r=x=>Number(x.toFixed(2));
const med=xs=>xs.length?r([...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)/2)]):null;
const add=(obj,k)=>{obj[k]=(obj[k]??0)+1;};
const merge=(dst,src)=>{for(const [key,n] of Object.entries(src))dst[key]=(dst[key]??0)+n;};
const resolutionKinds=new Set(['hit','launch','block']);
function checkSpawn(s){
  for(const f of s.fighters){
    assert.equal(f.alive,true);assert.ok(!Object.hasOwn(f,'hp')&&!Object.hasOwn(f,'maxHp'),'fighter has legacy HP');
    assert.deepEqual(Object.keys(f.injuries),ids);
    for(const id of ids)assert.deepEqual(f.injuries[id],{front:0,rear:0});
  }
}
function watch(s,duration=s.limit,input,summaryOnly=true){
  const byId=new Map(s.fighters.map(f=>[f.id,f]));
  let last=0,firstKo=null,contacts=0,eventCount=0;
  const regions={},surfaces={},outcomes={},fatalRegions={},fatalByTeam=[0,0],events=[];
  for(let i=0;i<Math.ceil((duration+.04)/dt)&&s.phase==='playing';i++){
    stepArcade(s,dt,input?.(i)??{});
    if(last===s.eventId)continue;
    assert.ok(s.events[0].id<=last+1,'overflowed engine event ring');
    for(const e of s.events.slice(Math.max(0,s.events.length-(s.eventId-last)))){
      eventCount++;
      if(!summaryOnly)events.push(e);
      // Guard-break and KO entries repeat the metadata of a contact for FX.
      // Count its primary resolution only, except a standalone hazard KO.
      const resolution=resolutionKinds.has(e.kind)||e.environmental===true;
      if(e.region){
        assert.ok(ids.includes(e.region));
        if(resolution){add(regions,e.region);add(surfaces,e.direction??'unspecified');}
      }
      if(e.injuryOutcome){
        if(resolution)add(outcomes,e.injuryOutcome);
        if(e.injuryOutcome==='blocked')assert.ok(e.fatal===false&&e.damage===0,'guard caused a penetrating injury');
      }
      if(['hit','launch','block','parry','rank_deflect','clash'].includes(e.kind))contacts++;
      if(e.kind==='ko'){
        const victim=byId.get(e.targetId);
        assert.equal(victim.alive,false,'KO event must remove living participation');
        assert.ok(e.fatal&&ids.includes(e.region),'KO must be a fatal local outcome');
        assert.equal(victim.fatalRegion,e.region);
        firstKo??=e.time;
        add(fatalRegions,e.region);fatalByTeam[victim.team]++;
      }
    }
    last=s.eventId;
  }
  return {time:s.time,end:s.endReason??null,phase:s.phase,alive:[0,1].map(t=>s.fighters.filter(f=>f.team===t&&f.alive).length),
    firstKo,regions,surfaces,outcomes,fatalRegions,fatalByTeam,contacts,eventCount,events};
}
function stationary(form='shii_cho',rank='F',enemyRank='F',seed=1){
  const s=createArcade({mode:'duel',teamSizes:[1,1],startingRanks:[rank,enemyRank],form,seed,
    teamForms:[[form],['soresu']],limit:45,terrain:'underpit'});
  checkSpawn(s);
  const [p,e]=s.fighters;
  Object.assign(p,{x:450,y:310,face:0});
  Object.assign(e,{x:518,y:310,face:Math.PI,think:999,action:'stagger',actionDuration:40});
  return {s,p,e};
}
function fixtures(){
  let legal=0,physical=0,defensive=0,blockedTier=0;
  const noContactMoves=[];
  for(const form of ARCADE_FORM_IDS)for(const [index,rank] of ranks.entries()){
    const moves=arcadeMovesFor(form,index);
    if(index)assert.equal(moves.length,arcadeMovesFor(form,index-1).length+1,`${form} ${rank} adds one move`);
    const options=moves.filter(move=>move.minRank===index);
    assert.equal(options.length,index===0?2:1);
    for(const move of options){
      const {s,p}=stationary(form,rank,rank);
      const committed=watch(s,1.25,i=>i===0?{technique:move.id,aimX:518,aimY:310}:{},false);
      assert.ok(committed.events.some(e=>e.fighterId===p.id&&e.technique===move.id&&e.rankMove&&e.contact>0),
        `${form} ${rank} did not commit ${move.id}`);
      legal++;
      if(committed.events.some(e=>e.fighterId===p.id&&e.region&&['hit','launch','break'].includes(e.kind)))physical++;
      else if(committed.events.some(e=>e.fighterId===p.id&&e.kind==='force_ward'&&e.forceAbility==='ward')&&p.wardCharges===1)defensive++;
      else noContactMoves.push({id:move.id,role:move.role,action:move.mapAction});
      if(index){
        const previous=stationary(form,ranks[index-1],ranks[index-1]);
        stepArcade(previous.s,dt,{technique:move.id,aimX:518,aimY:310});
        assert.notEqual(previous.p.attack,move.id,`Locked move committed: ${move.id}`);
        blockedTier++;
      }
    }
  }
  const guarded=stationary();
  Object.assign(guarded.e,{action:'guard',actionDuration:0,decision:'guard',guardUntil:30});
  const before=JSON.stringify(guarded.e.injuries);
  const guard=watch(guarded.s,1,i=>({heavy:i===0,aimX:518,aimY:310}),false);
  assert.ok(guard.outcomes.blocked>0&&guarded.e.alive);
  assert.equal(JSON.stringify(guarded.e.injuries),before);
  let fatal=null;
  const finishSeed=seed=>{
    const {s,e}=stationary('djem_so',top,'F',seed);
    const finish=watch(s,1.5,i=>({heavy:i===0,aimX:518,aimY:310}),false);
    return e.alive?null:{seed,region:e.fatalRegion,kind:finish.end,outcomes:finish.outcomes};
  };
  for(let seed=1;seed<=24&&!fatal;seed++){
    fatal=finishSeed(seed);
  }
  assert.ok(fatal&&fatal.kind==='elimination','expected deterministic local fatal strike');
  assert.deepEqual(finishSeed(fatal.seed),fatal,'same seed must reproduce the same local outcome');
  const saturated=stationary();
  for(const id of ids)Object.assign(saturated.e.injuries[id],{front:100,rear:100});
  saturated.e.injuryEffects=arcadeInjuryEffects(saturated.e.injuries);
  watch(saturated.s,1);
  assert.ok(saturated.e.alive,'saturated conditions must not cause automatic knockout');
  assert.equal(physical+defensive,legal,'committed move without either regional contact or a defensive effect');
  return {legal,physical,defensive,noContactMoves,blockedTier,guarded:guard.outcomes.blocked,fatal,noAutomaticKO:true};
}
function run({sizes,rank,forms,map,seed,clock=90}){
  const s=createArcade({mode:'watch',seed,startingRanks:rank,teamForms:forms,teamSizes:sizes,limit:clock,terrain:map});
  checkSpawn(s);
  assert.equal(s.limit,clock);assert.equal(s.terrain.id,map);
  assert.equal(s.fighters.length,sizes[0]+sizes[1]);
  for(const f of s.fighters){assert.equal(f.form,forms[f.team][f.slot]);assert.equal(f.career.grade,rank[f.team]);}
  const result=watch(s);
  assert.ok(result.end,'round never resolved');
  return {...result,seed,map};
}
function summarize(runs){
  const {length:n}=runs;const sum=field=>runs.reduce((total,run)=>total+run[field],0);
  const aggregate=field=>runs.reduce((acc,run)=>(merge(acc,run[field]),acc),{});
  return {n,medianSeconds:med(runs.map(r=>r.time)),medianFirstKO:med(runs.map(r=>r.firstKo).filter(x=>x!==null)),
    medianContacts:med(runs.map(r=>r.contacts)),timeouts:runs.filter(r=>r.end==='timeout').length,
    regions:aggregate('regions'),surfaces:aggregate('surfaces'),outcomes:aggregate('outcomes'),fatalRegions:aggregate('fatalRegions'),
    contacts:sum('contacts')};
}
if(!suite||suite==='fixtures')report.fixtures=fixtures();
if(!suite||suite==='mastery'){
  report.mastery=[];
  for(const count of [15,24]){
    const runs=[];
    for(const map of maps){
      const from=runs.length;
      for(const [i,form] of ARCADE_FORM_IDS.entries())for(let seed=1;seed<=seedCount;seed++)for(const side of [0,1]){
        const crowd=Array.from({length:count},(_,j)=>ARCADE_FORM_IDS[(i+seed-1+j*3)%ARCADE_FORM_IDS.length]);
        const result=run({sizes:side?[count,1]:[1,count],rank:side?['F',top]:[top,'F'],forms:side?[crowd,[form]]:[[form],crowd],map,seed});
        runs.push({...result,side,form,win:result.phase===(side?'lost':'won'),
          wipe:result.alive[side]===1&&result.alive[1-side]===0});
      }
      if(progress){
        const cell=runs.slice(from);
        console.error(`1v${count} ${map}: ${cell.filter(r=>r.wipe).length}/${cell.length} wipes`);
      }
    }
    report.mastery.push({opponents:count,...summarize(runs),wins:runs.filter(r=>r.win).length,
      wipes:runs.filter(r=>r.wipe).length,failed:runs.filter(r=>!r.wipe).map(({map,seed,side,form,time,end,alive})=>({map,seed,side,form,time,end,alive}))});
  }
}
if(!suite||suite==='mirrors'){
  report.mirrors=[];
  for(const count of [1,3])for(const clock of [45,75,90,150]){
    const runs=[];
    for(const form of ARCADE_FORM_IDS)for(let seed=1;seed<=seedCount;seed++){
      const row=Array(count).fill(form);
      runs.push(run({sizes:[count,count],rank:[top,top],forms:[row,row],map:'underpit',seed,clock}));
    }
    const row={size:count,clock,...summarize(runs),near85Pct:pct(runs.filter(run=>run.time>=clock*.85-1e-7).length,runs.length)};
    report.mirrors.push(row);
    if(progress)console.error(`${count}v${count} ${clock}s: ${row.near85Pct}% near, ${row.timeouts} timeouts, ${row.medianContacts} contacts median`);
  }
}
console.log(JSON.stringify(report,null,2));

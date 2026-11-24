/** Deterministic Arcade elimination audit (no DOM). Alternative engine must
 * reside next to its own dist dependencies; git archive HEAD dist package.json.
 *
 * Usage: node build/scripts/audit-arcade-ranks-v27.mjs [engine] [seeds] [options]
 * --maps=underpit,crossroads,... --suite=challenges|ladder|mirrors
 * --opponents=5,15,24 (default 5,15)
 * --dual --progress --json
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';

const args=process.argv.slice(2);
const [path,seedsArg]=args.filter(arg=>!arg.startsWith('--'));
const engine=path?pathToFileURL(resolve(path)):new URL('../dist/arcade-engine.js',import.meta.url);
const {createArcade,stepArcade,ARCADE_FORM_IDS,ARCADE_RANK_COMBAT}=await import(engine);
const {SOLDIER_GRADES}=await import(new URL('./progression.js',engine));
const {ARCADE_MAPS}=await import(new URL('./arcade-stage.js',engine));
const repertoirePath=new URL('./arcade-repertoire.js',engine);
const repertoire=existsSync(repertoirePath)?(await import(repertoirePath)).ARCADE_TECHNIQUES:null;
const ranks=SOLDIER_GRADES.map(grade=>grade.label), top=ranks.at(-1);
const option=name=>args.find(arg=>arg.startsWith(`--${name}=`))?.split('=')[1];
const suite=option('suite'), dual=args.includes('--dual'), progress=args.includes('--progress');
const maps=option('maps')?.split(',')??Object.keys(ARCADE_MAPS);
const opponentCounts=option('opponents')?.split(',').map(Number)??[5,15];
const seeds=Math.max(1,Math.min(32,Math.trunc(Number(seedsArg))||4));
if(maps.some(map=>!Object.hasOwn(ARCADE_MAPS,map))) throw Error('Unknown arena in --maps');
if(opponentCounts.some(count=>!Number.isInteger(count)||count<1||count>24)) throw Error('Invalid --opponents count');
if(suite&&!['challenges','ladder','mirrors'].includes(suite)) throw Error('Unknown --suite');

const round1=n=>Number(n.toFixed(1));
const pct=(n,d)=>d?round1(100*n/d):null;
const avg=(samples,key)=>samples.length?round1(samples.reduce((sum,run)=>sum+run[key],0)/samples.length):null;
const quantile=(samples,p=.5)=>{
  const ordered=samples.filter(Number.isFinite).sort((a,b)=>a-b);
  return ordered.length?round1(ordered[Math.floor((ordered.length-1)*p)]):null;
};
const range=n=>Array.from({length:n},(_,i)=>i);
const add=(obj,key)=>{obj[key]=(obj[key]??0)+1;};
function merge(target,source){
  for(const [key,n] of Object.entries(source)) target[key]=(target[key]??0)+n;
}
const contacts=new Set(['hit','launch','block','parry','break','clash','rank_deflect']);
function readEvent(e, fighters){
  const f=fighters.get(e.fighterId);
  if(!f)return;
  // Commitment events carry a real contact timestamp. Exclude the delayed
  // second blade here to avoid counting one chosen attack as two choices.
  if(e.contact>0&&typeof e.technique==='string'&&!e.offhand) add(f.attacks,e.technique);
  if(e.rankMove===true&&e.contact>0&&typeof e.technique==='string'&&!e.offhand){
    const move=repertoire?.[e.technique];
    if(repertoire&&(!move||move.form!==f.form||move.minRank>f.gradeIndex)){
      throw Error(`Illegal committed technique: ${e.technique} for ${f.form} at rank index ${f.gradeIndex}`);
    }
    add(f.rankAttacks,e.technique);
  }
  if(e.kind==='dash')add(f.defenses,e.technique??'dash');
  if(e.kind==='parry'||e.kind==='block')add(f.defenses,e.kind);
  if(e.kind==='rank_deflect'||e.kind==='rank_composure')add(f.defenses,e.kind);
  if(e.kind==='clash'){
    add(f.defenses,'clash');
    if(e.targetId!==e.fighterId&&fighters.has(e.targetId))add(fighters.get(e.targetId).defenses,'clash');
  }
  if(e.punish)add(f.punishes,e.punishReason??'opening');
}
function run({sizes,rank,form,map,seed,clock=90}){
  const s=createArcade({
    mode:'watch',seed,form:form[0][0],teamForms:form,round:1,
    teamSizes:sizes,startingRanks:rank,startingDualSabers:[dual,dual],
    limit:clock,terrain:map,rule:'elimination',
  });
  if(s.limit!==clock||s.terrain.id!==map||s.fighters.length!==sizes[0]+sizes[1]||s.fighters.some(f=>
    f.career.grade!==rank[f.team]||f.form!==form[f.team][f.slot]||Boolean(f.gear?.dualSabers)!==dual)){
    throw Error('Engine did not honor requested clock, map, rank, form, size, or gear');
  }
  const records=new Map(s.fighters.map(f=>[f.id,{
    form:f.form,gradeIndex:f.career.gradeIndex,attacks:{},rankAttacks:{},defenses:{},punishes:{},
  }]));
  let last=0,firstKo=null,firstContact=null,lastContact=0,longestQuiet=0;
  const firstTeamKo=[null,null];
  // Watch has no input edges; the engine subdivides 1/60 to its same 120 Hz
  // physics ticks. The event-ring guard below ensures no commitments are lost.
  const step=1/60,n=Math.ceil((clock+.04)/step);
  for(let i=0;i<n&&s.phase==='playing';i++){
    stepArcade(s,step);
    if(s.eventId===last)continue;
    if(s.events[0]?.id>last+1)throw Error('Event ring overflow; reduce audit timestep');
    const start=Math.max(0,s.events.length-(s.eventId-last));
    for(const event of s.events.slice(start)){
      readEvent(event,records);
      if(event.kind==='ko'){
        firstKo??=event.time;
        const victim=s.fighters.find(f=>f.id===event.targetId);
        if(victim)firstTeamKo[victim.team]??=event.time;
      }
      if(contacts.has(event.kind)){
        firstContact??=event.time;
        longestQuiet=Math.max(longestQuiet,event.time-lastContact);
        lastContact=event.time;
      }
    }
    last=s.eventId;
  }
  if(s.phase==='playing')throw Error('Round failed to end at provided clock');
  const fighters=s.fighters.map(f=>{
    const observed=records.get(f.id);
    const attributed=Object.values(observed.rankAttacks).reduce((sum,n)=>sum+n,0);
    if(Number.isFinite(f.stats.rankMoves)&&f.stats.rankMoves!==attributed){
      throw Error(`Rank attacks observed for ${f.id}: ${attributed}; committed: ${f.stats.rankMoves}`);
    }
    return {
      team:f.team,rank:f.career.grade,form:f.form,alive:f.alive??(f.hp>0),hp:f.hp,maxHp:f.maxHp,
      ...observed,stats:f.stats,
    };
  });
  return {
    time:s.time,near85:s.time+1e-7>=clock*.85,timeout:s.endReason==='timeout',
    winner:s.phase==='won'?0:s.phase==='lost'?1:null,
    firstKo,firstTeamKo,firstContact,longestQuiet:Math.max(longestQuiet,s.time-lastContact),fighters,
  };
}
function challengeSummary(runs){
  const solo=run=>run.fighters.find(f=>f.team===run.side);
  const wins=runs.filter(run=>run.winner===run.side);
  const wipes=wins.filter(run=>!run.fighters.some(f=>f.team!==run.side&&f.alive));
  return {
    n:runs.length, wins:wins.length, winPct:pct(wins.length,runs.length), wipes:wipes.length,
    timedWins:wins.filter(run=>run.timeout).length, draws:runs.filter(run=>run.winner===null).length,
    soloDeaths:runs.filter(run=>!solo(run).alive).length, timeP50:quantile(runs.map(r=>r.time)),
    firstKoP50:quantile(runs.map(r=>r.firstKo)),firstNoviceKoP50:quantile(runs.map(r=>r.firstTeamKo[1-r.side])),
    winHpP10:quantile(wins.map(r=>100*solo(r).hp/solo(r).maxHp).filter(Number.isFinite),.1),
    winHpP50:quantile(wins.map(r=>100*solo(r).hp/solo(r).maxHp).filter(Number.isFinite)),
    killsAvg:runs.length?round1(runs.reduce((n,r)=>n+(solo(r).stats.kills??0),0)/runs.length):null,
    soloAttacks:runs.reduce((acc,r)=>(merge(acc,solo(r).attacks),acc),{}),
    soloRankAttacks:runs.reduce((acc,r)=>(merge(acc,solo(r).rankAttacks),acc),{}),
    soloDefenses:runs.reduce((acc,r)=>(merge(acc,solo(r).defenses),acc),{}),
  };
}
function challenge(){
  const rows=[];
  for(const size of opponentCounts){
    const runs=[];
    for(const map of maps){
      for(const [idx,soloForm] of ARCADE_FORM_IDS.entries())for(const i of range(seeds)){
        // Same mixed novice roster when reversing teams; solo form is controlled.
        const mob=range(size).map(j=>ARCADE_FORM_IDS[(idx+i+j*3)%ARCADE_FORM_IDS.length]);
        for(const side of [0,1]){
          const sizes=side?[size,1]:[1,size], rank=side?['F',top]:[top,'F'];
          const form=side?[mob,[soloForm]]:[[soloForm],mob];
          runs.push({...run({sizes,rank,form,map,seed:i+1}),side,form:soloForm,map});
        }
      }
      if(progress){
        const r=challengeSummary(runs.filter(r=>r.map===map));
        console.error(`1v${size} ${map}: ${r.wins}/${r.n} wins, ${r.wipes} wipes, ${r.winHpP50??'n/a'}% median winner HP, ${r.firstKoP50??'n/a'}s first KO`);
      }
    }
    const by=key=>Object.fromEntries([...new Set(runs.map(r=>r[key]))].map(value=>[
      value,challengeSummary(runs.filter(r=>r[key]===value)),
    ]));
    rows.push({opponents:size,...challengeSummary(runs),byMap:by('map'),byForm:by('form'),bySide:by('side')});
  }
  return rows;
}
function ladder(){
  const pairs=[], all=ranks.map(rank=>({rank,attacks:{},rankAttacks:{},defenses:{},punishes:{},n:0,combatSeconds:0,wins:0}));
  // Neighbors give all 15 grades an honest comparable test. Alternate maps
  // across forms/seeds, pin form and gear, and reverse the teams each seed.
  for(const [idx,lower] of ranks.slice(0,-1).entries()){
    const higher=ranks[idx+1];
    const samples=[];
    for(const [j,id] of ARCADE_FORM_IDS.entries())for(const i of range(seeds))for(const side of [0,1]){
      const map=maps[(idx+j+i)%maps.length], rank=side?[lower,higher]:[higher,lower];
      const result=run({sizes:[1,1],rank,form:[[id],[id]],map,seed:i+1});
      samples.push({...result,side});
      for(const f of result.fighters){
        const stats=all[ranks.indexOf(f.rank)];
        stats.n++;stats.combatSeconds+=result.time;
        stats.wins+=Number(result.winner===f.team);
        merge(stats.attacks,f.attacks);merge(stats.defenses,f.defenses);
        merge(stats.rankAttacks,f.rankAttacks);merge(stats.punishes,f.punishes);
      }
    }
    pairs.push({lower,higher,n:samples.length,higherWins:pct(samples.filter(r=>r.winner===r.side).length,samples.length),
      draws:samples.filter(r=>r.winner===null).length,timeP50:quantile(samples.map(r=>r.time)),
      firstKoP50:quantile(samples.map(r=>r.firstKo))});
    if(progress)console.error(`${higher} vs ${lower}: ${JSON.stringify(pairs.at(-1))}`);
  }
  return {pairs,repertoire:all.map((r,index)=>{
    const perMin=entries=>Object.fromEntries(Object.entries(entries).map(([key,n])=>[key,round1(60*n/r.combatSeconds)]));
    return {...r,rankCombat:ARCADE_RANK_COMBAT?.[index]??null,
      combatSeconds:round1(r.combatSeconds),attackEventsPerMinute:perMin(r.attacks),
      rankAttackEventsPerMinute:perMin(r.rankAttacks),defenseEventsPerMinute:perMin(r.defenses)};
  })};
}
function mirrors(){
  const rows=[];
  for(const size of [1,3])for(const clock of [45,75,90,150]){
    const samples=[];
    for(const id of ARCADE_FORM_IDS)for(const i of range(seeds)){
      samples.push(run({sizes:[size,size],rank:[top,top],form:[Array(size).fill(id),Array(size).fill(id)],
        map:'underpit',seed:i+1,clock}));
    }
    const rankAttacks={};
    for(const sample of samples)for(const f of sample.fighters)merge(rankAttacks,f.rankAttacks);
    rows.push({size,clock,n:samples.length,near85Pct:pct(samples.filter(r=>r.near85).length,samples.length),
      timeouts:samples.filter(r=>r.timeout).length,timeP50:quantile(samples.map(r=>r.time)),
      firstContactP50:quantile(samples.map(r=>r.firstContact)),quietP90:quantile(samples.map(r=>r.longestQuiet),.9),
      hitsAvg:avg(samples.map(r=>({hits:r.fighters.reduce((sum,f)=>sum+(f.stats.saberHits??0),0)})),'hits'),
      rankAttackTypes:Object.keys(rankAttacks).length,rankAttackEvents:Object.values(rankAttacks).reduce((sum,n)=>sum+n,0)});
    if(progress)console.error(`Top mirror: ${JSON.stringify(rows.at(-1))}`);
  }
  return rows;
}

const result={maps,seeds,dual};
if(!suite||suite==='challenges')result.challenges=challenge();
if(!suite||suite==='ladder')result.ladder=ladder();
if(!suite||suite==='mirrors')result.mirrors=mirrors();
if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
else{
  if(result.challenges)console.table(result.challenges.map(({byMap,byForm,bySide,soloAttacks,soloRankAttacks,soloDefenses,...r})=>r));
  if(result.ladder){
    console.table(result.ladder.pairs);
    console.table(result.ladder.repertoire.map(({rank,n,attacks,defenses})=>({
      rank,n,attackTypes:Object.keys(attacks).length,defenseTypes:Object.keys(defenses).length,
    })));
  }
  if(result.mirrors)console.table(result.mirrors);
}

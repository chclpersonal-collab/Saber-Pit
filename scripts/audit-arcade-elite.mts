/** Reproducible AI-only pacing check. Optional argument: alternate engine file. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engine=process.argv[2]?pathToFileURL(resolve(process.argv[2])):new URL('../dist/arcade-engine.js',import.meta.url);
const {createArcade,stepArcade,ARCADE_FORM_IDS}=await import(engine);
const n=Math.max(2,Math.min(64,Number(process.argv[3])||12));
const TOP='SSS+V';
const trials=[
  ['F duel',1,1,'F','F','elimination','underpit'],
  ['Elite duel',1,1,TOP,TOP,'elimination','underpit'],
  ['F squads',3,3,'F','F','elimination','underpit'],
  ['Elite squads',3,3,TOP,TOP,'elimination','underpit'],
  ['Master vs Novice',1,1,TOP,'F','elimination','underpit'],
  ['Master trial',1,5,TOP,'F','elimination','underpit'],
  ['Elite Control',3,3,TOP,TOP,'control','crossroads'],
  ['Elite Relic',3,3,TOP,TOP,'relic','zigzag'],
];
const posQuantile=(sample,p)=>[...sample].sort((a,b)=>a-b)[Math.floor((sample.length-1)*p)];
const stat=(s,key)=>(s.stats[key]??[0,0]).reduce((a,b)=>a+b,0);
const pct=(num,den)=>Math.round(100*num/Math.max(1,den));
const num=n=>Number(n.toFixed(1));
const report=[];
for(const [group,a,b,rankA,rankB,rule,terrain] of trials){
  const runs=[];
  for(const form of ARCADE_FORM_IDS)for(let seed=1;seed<=n;seed++){
    const s=createArcade({mode:'watch',teamSizes:[a,b],seed,limit:90,form,
      teamForms:[Array(a).fill(form),Array(b).fill(form)],startingRanks:[rankA,rankB],rule,terrain});
    let firstKo=null,lastEvent=0,firstPunish=null;
    for(let i=0;i<2702&&s.phase==='playing';i++){
      stepArcade(s,1/30);
      for(const e of s.events){
        if(e.id<=lastEvent)continue;
        lastEvent=e.id;
        if(e.kind==='ko')firstKo??=e.time;
        if(e.punish)firstPunish??=e.time;
      }
    }
    runs.push({time:s.time,timeout:s.time>=s.limit-.02,firstKo:firstKo??s.time,draw:s.phase==='draw',blue:s.phase==='won',
      parries:stat(s,'parries'),strikes:stat(s,'saberSwings'),punishes:stat(s,'punishes'),firstPunish});
  }
  const select=k=>runs.map(r=>r[k]), mean=k=>num(select(k).reduce((a,b)=>a+b,0)/runs.length);
  report.push({trial:group,n:runs.length,'p10 s':num(posQuantile(select('time'),.1)),'p50 s':num(posQuantile(select('time'),.5)),
    'p90 s':num(posQuantile(select('time'),.9)),'first KO p50':num(posQuantile(select('firstKo'),.5)),
    'time %':pct(runs.filter(r=>r.timeout).length,runs.length),'draw %':pct(runs.filter(r=>r.draw).length,runs.length),'blue %':pct(runs.filter(r=>r.blue).length,runs.length),
    'swings avg':mean('strikes'),'parries avg':mean('parries'),'punishes avg':mean('punishes')});
}
console.table(report);

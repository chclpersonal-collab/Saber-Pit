import {runtimeDir} from './tool-runtime.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const dir=resolve(process.argv[2]??runtimeDir);
const load=(name: string)=>import(pathToFileURL(resolve(dir,name+'.js')));
const {createArcade,stepArcade}=await load('arcade-engine');
const {displayFighters,fighterSamples}=await load('arcade-display');
const {sampleArcadeFighter,drawArcadeFighter,arcadeBladeWorld}=await load('arcade-fighters');
const {drawArcadeObstacle,drawArcadeStage,createArcadeStage}=await load('arcade-stage');
const flags=Object.fromEntries('perfectParryStamina continuousCombat anticipatingCombat arenaCuts activeFootwork styleTravel repertoireSupport styleChoreo peasantMotion exchangeVariety fluidFootwork eloReads stanceFlow liveEntry impactPhysics recoveryFlow balancePass closeChoice guardCounterplay minorMoves forceVariants weaponFlow expandedCombat circuitCuts ratingSkill customHeroTactics advancedArena'.split(' ').map(k=>[k,true]));
let commands=0;
const noop=()=>{commands++},gradient={addColorStop:noop};
const ctx=new Proxy({globalAlpha:1,createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:(t: unknown)=>({width:String(t).length*8})},{get:(o,k)=>k in o?o[k]:noop});
globalThis.document={createElement:()=>({getContext:()=>ctx})};
type BenchRow={step:number;snapshot:number;prep:number;paint:number;frame:number;calls:number};
function trial(n: number,map: string,lod: boolean,reduced: boolean,seed: number): BenchRow[] {
 const s=createArcade({mode:'watch',teamSizes:[n,n],seed,terrain:map,limit:90,startingRanks:['SSS+V','SSS+V'],...flags});
 const stage=createArcadeStage(s.width,s.height,1,{mapId:map,terrain:s.terrain});
 const rows=[];
 for(let i=0;i<720&&s.phase==='playing';i++){
  let t=performance.now(), previous, snapshot=0, step=0;
  for(let j=0;j<2;j++){
    const start=performance.now();
    previous=fighterSamples(s.fighters);
    const sampled=performance.now();
    stepArcade(s,1/120);
    const stepped=performance.now();
    snapshot+=sampled-start;
    step+=stepped-sampled;
  }
  let a=performance.now();
  const byDepth=displayFighters(s.fighters,previous,.004).sort((x,y)=>x.y-y.y);
  const poses=byDepth.filter(f=>f.alive||f.actionTime<1.48).map(f=>({f,rig:sampleArcadeFighter(f,s.time,{reducedMotion:reduced})}));
  if(!lod&&!reduced) for(const {f,rig} of poses) if(f.alive)arcadeBladeWorld(f,rig);
  let b=performance.now(),before=commands;
  drawArcadeStage(ctx,stage,s.width,s.height,s.time,reduced);
  for(const o of stage.obstacles)drawArcadeObstacle(ctx,stage,o);
  for(const {f,rig} of poses)drawArcadeFighter(ctx,f,s.time,{rig,lowDetail:lod,reducedMotion:reduced});
  let c=performance.now();
  if(i>=120)rows.push({step,snapshot,prep:b-a,paint:c-b,frame:c-t,calls:commands-before});
 }
 return rows;
}
function metric(rows: readonly BenchRow[],key: keyof BenchRow){const a=rows.map(r=>r[key]).sort((a,b)=>a-b);return {p50:+a[Math.floor(a.length*.5)].toFixed(3),p95:+a[Math.floor(a.length*.95)].toFixed(3),p99:+a[Math.floor(a.length*.99)].toFixed(3)}}
trial(1,'crossroads',false,false,5);
for(const [n,lod,reduced] of [[1,false,false],[5,false,false],[12,false,false],[12,true,false],[24,false,false],[24,true,false],[24,true,true]]){
 const rows=[9,29].flatMap(seed=>trial(n,'crossroads',lod,reduced,seed));
 console.log(JSON.stringify({fighters:n*2,lod,reduced,n:rows.length,...Object.fromEntries(['step','snapshot','prep','paint','frame','calls'].map(k=>[k,metric(rows,k)]))}));
}

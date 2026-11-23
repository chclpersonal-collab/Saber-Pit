// Fixed-tick paired tournament-like arena fixtures. No accounts or saves.
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const styles=['king','queen','rook','bishop','knight','pawn'];
const maps=['underpit','crossroads','foundry'];
const kits=['single','dual','staff'];
const seeds=[139,351,693,807];
const counts=new Map();
function summarize(active){
 let starts=0, repeats=0, pairs=0, hits=0, familyRepeats=0;
 const perMove=new Map(),perForm=new Map(),scene=[];
 for(const [j,seed] of seeds.entries())for(const [i,form] of forms.entries()){
  const n=j%2?3:1, other=forms[(i+1+j)%forms.length];
  const teamForms=[Array.from({length:n},(_,k)=>forms[(i+k*3)%forms.length]),
   Array.from({length:n},(_,k)=>forms[(i+1+j+k*3)%forms.length])];
  const grade=j<2?'SSS+V':'SSS+II';
  const g=createArcade({mode:'watch',seed:seed+i*13,terrain:maps[(i+j)%3],limit:45,teamSizes:[n,n],teamForms,
   chessStyles:[styles[(i+j)%6],styles[(i+j+3)%6]],startingSaberWeapon:[kits[(i+j)%3],kits[(i+j+1)%3]],
   startingRanks:[grade,grade],styleChoreo:true,peasantMotion:true,activeFootwork:true,styleTravel:true,
   repertoireSupport:true,anticipatingCombat:true,continuousCombat:true,weaponFlow:true,arenaCuts:true,circuitCuts:true,
   ratingSkill:true,matchGoalPlanning:true,exchangeVariety:active});
  const lastMoves=new Map();let cursor=0;
  for(let k=0;k<g.limit*120+2&&g.phase==='playing';k++){
   stepArcade(g,1/120);
   if(g.eventId===cursor)continue;
   for(const e of g.events){
    if(e.id<=cursor)continue;cursor=e.id;
    if(!e.fighterId||e.offhand||e.forceAbility)continue;
    const move=e.technique??([e.kind,e.combo||''].join('/'));
    if(e.contact>0){
     const prior=lastMoves.get(e.fighterId);
     const family=e.attackFamily??e.kind;
     if(prior!==undefined){pairs++;if(prior.move===move)repeats++;if(prior.family===family)familyRepeats++;}
     lastMoves.set(e.fighterId,{move,family});
     starts++;
     const row=perMove.get(move)??{uses:0,positiveContacts:0};
     row.uses++;perMove.set(move,row);
     const line=perForm.get(e.form)??new Map();line.set(move,(line.get(move)??0)+1);perForm.set(e.form,line);
    }else if(['hit','launch','ko'].includes(e.kind)&&e.damage>0){
     hits++;
     if(e.technique&&perMove.has(e.technique))perMove.get(e.technique).positiveContacts++;
    }
   }
  }
  scene.push({size:n,form,other,time:g.time,reason:g.endReason});
 }
 return {matches:scene.length,starts,distinctMoves:perMove.size,repeats,pairs,repeatRate:pairs?+(repeats*100/pairs).toFixed(1):null,familyRepeatRate:pairs?+(familyRepeats*100/pairs).toFixed(1):null,hits,
  moveCounts:Object.fromEntries([...perMove].sort((a,b)=>b[1].uses-a[1].uses)),forms:Object.fromEntries([...perForm].map(([id,row])=>[id,{distinct:row.size,uses:[...row.values()].reduce((a,b)=>a+b,0),favorite:[...row].sort((a,b)=>b[1]-a[1])[0]}]))};
}
for(const a of process.argv.includes('--baseline')?[false]:[false,true])counts.set(a?'v3Exchange':'v3Baseline',summarize(a));
console.log(JSON.stringify(Object.fromEntries(counts),null,2));

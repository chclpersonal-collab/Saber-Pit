import {normalizeHeroTactics,observeHeroPlan} from '../arcade-hero-tactics.js?v=2.18.0';
import {fighterGender,appearanceSeedFor} from '../arcade-fighter-profiles.js?v=2.18.3';
import {normalizeHeroLineup} from '../arcade-heroes.js?v=2.18.5';
/** The real-time Saber Pit arcade rules. No DOM, browser clocks, or external state. */
import {findArcadeBladeContact} from './arcade-clashes.js';
import {sampleArcadeFighter,arcadeBladeWorld} from './arcade-fighters.js';
import {ARCADE_TECHNIQUES,arcadeMovesFor} from '../arcade-rules-v226/arcade-repertoire.js';
import {createArcadeInjuries,applyArcadeInjury,arcadeInjuryModifiers,compareArcadeDanger} from '../arcade-injuries.js?v=2.9.0';
export {arcadeMovesFor};
import {createArcadeTerrain} from '../arcade-stage.js';
import {advanceArcadeObjective,arcadeObjectiveMove,carrierSpeedScale,createArcadeObjective,isArcadeCarrier,objectiveOutcome} from '../arcade-objectives.js';
import {arcadeFighterGear,arcadeGearMove,normalizeArcadeGear} from '../arcade-loadouts.js?v=2.10.0';
import {ENVIRONMENTS,environmentAt} from '../environment.js?v=1.4.0';
import {combatSkillProfile, progressionSummary, SOLDIER_GRADES} from "../progression.js?v=1.4.0";
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const angleDelta = (a, b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const ARCADE_MAX_TEAM_SIZE=24;
export const ARCADE_RANK_COMBAT=Object.freeze(Array.from({length:15},(_,index)=>Object.freeze({
  index, reads:1+index, awareness:1+index*.21, initiative:index*.012,
  staminaRecovery:1+index*.046, holdEfficiency:1-index*.024,
  stability:index*.043, crowdCap:Math.min(8,1+Math.floor(index*.51)),
})));
const countMove=(f,name)=>{f.moves[name]=(f.moves[name]??0)+1;};
const rankGap=(a,b)=>a.career.gradeIndex-b.career.gradeIndex;
const masteryRatio=(rank)=>clamp(rank/14,0,1);
const rankStrikeScale=(source,target)=>{
  const gap=rankGap(source,target);
  if(gap===0)return 1;
  return gap>0?1+.055+4.145*masteryRatio(gap)**1.53:1-.975*masteryRatio(-gap)**.83;
};
const archetypes = {
  vanguard:{speed:192, heavy:'sweep', pressure:102, wind:.10},
  duelist:{speed:225, heavy:'rush', pressure:79, wind:.07},
  warden:{speed:175, heavy:'uppercut', pressure:86, wind:.14},
};
const fitted = (name, description, heavy, stats) => Object.freeze({name,label:name,description,heavy,...stats});
export const ARCADE_FORMS = Object.freeze({
  shii_cho:fitted('Shii-Cho','Wide cuts catch multiple enemies; broad, steady and good for crowds.', 'wide_cut', {speed:189,pressure:105,wind:.104,orbit:.42,guardAI:.44,parry:.155,arc:1.33,reach:1,tempo:1.04,guardCost:1,comboCap:3}),
  makashi:fitted('Makashi','A narrow lunge for precise duels, quick footwork and measured distance.', 'thrust', {speed:224,pressure:115,wind:.077,orbit:.72,guardAI:.48,parry:.14,arc:.61,reach:1.14,tempo:.92,guardCost:1.04,comboCap:3}),
  soresu:fitted('Soresu','Compact cuts, efficient guard, and a wide window to deflect incoming blades.', 'deflect', {speed:177,pressure:72,wind:.091,orbit:.60,guardAI:.78,parry:.236,arc:.90,reach:.87,tempo:1.08,guardCost:.60,comboCap:2}),
  ataru:fitted('Ataru','An acrobatic vault and quick sidesteps close gaps; defense is less efficient.', 'vault', {speed:238,pressure:112,wind:.055,orbit:1.18,guardAI:.23,parry:.112,arc:.97,reach:.98,tempo:.88,guardCost:1.28,comboCap:3}),
  djem_so:fitted('Djem So','Heavy countercuts deal more damage after a successful block or parry.', 'riposte', {speed:174,pressure:84,wind:.114,orbit:.32,guardAI:.70,parry:.172,arc:1.05,reach:.98,tempo:1.13,guardCost:.81,comboCap:3}),
  niman:fitted('Niman','Steady saber work and a short cone-shaped Force push that creates space.', 'force', {speed:197,pressure:126,wind:.11,orbit:.56,guardAI:.50,parry:.16,arc:1,reach:1,tempo:1,guardCost:.92,comboCap:3}),
  juyo:fitted('Juyo','Relentless four-hit sequences and fast pressure, at the cost of a weaker guard.', 'frenzy', {speed:216,pressure:89,wind:.049,orbit:.35,guardAI:.23,parry:.098,arc:1.12,reach:1.02,tempo:.81,guardCost:1.37,comboCap:4}),
});
export const ARCADE_FORM_IDS = Object.freeze(Object.keys(ARCADE_FORMS));
const legacyForm = {vanguard:'shii_cho',duelist:'makashi',warden:'djem_so'};
const profile = f => f.formRules ? ARCADE_FORMS[f.form] : archetypes[f.archetype];
export const ARCADE_ATTACKS = Object.freeze({
  slash:Object.freeze({duration:.285,contact:.108,reach:88,arc:1.12,damage:16,cost:7,lunge:300,knock:120,recoil:.18}),
  slash2:Object.freeze({duration:.265,contact:.100,reach:92,arc:1.40,damage:18,cost:8,lunge:320,knock:148,recoil:.19}),
  slash3:Object.freeze({duration:.365,contact:.145,reach:107,arc:1.22,damage:23,cost:11,lunge:391,knock:221,recoil:.27}),
  rush:Object.freeze({duration:.435,contact:.223,reach:88,arc:.69,damage:31,cost:25,lunge:790,knock:310,recoil:.33}),
  sweep:Object.freeze({duration:.545,contact:.293,reach:126,arc:2.12,damage:28,cost:24,lunge:294,knock:257,recoil:.35}),
  slash4:Object.freeze({duration:.405,contact:.134,reach:104,arc:1.20,damage:26,cost:13,lunge:410,knock:225,recoil:.27}),
  thrust:Object.freeze({duration:.41,contact:.187,reach:143,arc:.40,damage:31,cost:22,lunge:565,knock:182,recoil:.28}),
  wide_cut:Object.freeze({duration:.57,contact:.303,reach:123,arc:2.46,damage:28,cost:24,lunge:280,knock:249,recoil:.31}),
  deflect:Object.freeze({duration:.37,contact:.248,reach:79,arc:.87,damage:19,cost:13,lunge:164,knock:149,recoil:.19}),
  vault:Object.freeze({duration:.50,contact:.247,reach:107,arc:1.29,damage:27,cost:24,lunge:633,knock:267,recoil:.29}),
  riposte:Object.freeze({duration:.53,contact:.274,reach:106,arc:1.29,damage:29,cost:24,lunge:381,knock:288,recoil:.29}),
  force:Object.freeze({duration:.59,contact:.279,reach:173,arc:.83,damage:13,cost:31,lunge:0,knock:700,recoil:.36}),
  frenzy:Object.freeze({duration:.42,contact:.194,reach:116,arc:1.54,damage:29,cost:25,lunge:532,knock:236,recoil:.28}),
  uppercut:Object.freeze({duration:.435,contact:.213,reach:85,arc:1.04,damage:26,cost:23,lunge:480,knock:238,recoil:.55}),
});
// Arcade timings keep a recognisable windup, release and return even at elite
// grades. The lunge component is a planted step, not persistent locomotion.
const styleTimings=Object.freeze({
  slash:[.57,.218,152],slash2:[.60,.245,146],slash3:[.71,.282,173],slash4:[.69,.267,171],
  thrust:[.69,.284,223],wide_cut:[.92,.405,118],deflect:[.72,.315,82],
  vault:[.92,.428,290],riposte:[.88,.363,154],force:[.84,.379,0],frenzy:[.71,.302,188],
});
const quickCounter=[.70,.270,171];
const vaultArc={takeoff:.145,flight:.495,landing:.185,peak:53};
const aerialArcs={vault:vaultArc,crossVault:{takeoff:.115,flight:.493,landing:.18,peak:45},highVault:{takeoff:.17,flight:.532,landing:.13,peak:66}};
const evadeArc={takeoff:.075,flight:.215,landing:.115,peak:25};
const launchArc={takeoff:0,flight:.39,landing:.14,peak:37};
const jumps=Object.freeze({
  shii_cho:{kind:'bound',takeoff:.145,flight:.30,landing:.13,peak:32,drive:243,cost:15},
  makashi:{kind:'line',takeoff:.12,flight:.26,landing:.11,peak:22,drive:272,cost:13},
  soresu:{kind:'compact',takeoff:.10,flight:.225,landing:.10,peak:19,drive:177,cost:12},
  ataru:{kind:'corkscrew',takeoff:.145,flight:.42,landing:.155,peak:49,drive:278,cost:19},
  djem_so:{kind:'bound',takeoff:.19,flight:.29,landing:.16,peak:35,drive:198,cost:17},
  niman:{kind:'drift',takeoff:.13,flight:.38,landing:.115,peak:39,drive:211,cost:16},
  juyo:{kind:'pounce',takeoff:.10,flight:.285,landing:.13,peak:28,drive:307,cost:18},
});
function startAir(f,arc,trick=null) {
  if(!arc.kind)f.jumpKind=null;
  f.airFacing=f.face;f.airTrick=trick;f.airArc=arc;f.airTime=0;f.airDuration=arc.takeoff+arc.flight+arc.landing;
  updateAir(f,0);
}
function updateAir(f,dt) {
  const arc=f.airArc;
  if(!arc)return;
  f.airTime=Math.min(f.airDuration,f.airTime+dt);
  const t=f.airTime;
  f.airborne=Math.max(0,f.airDuration-t);
  if(t<arc.takeoff){
    f.airPhase='takeoff';f.airProgress=t/arc.takeoff;f.airHeight=0;
  }else if(t<arc.takeoff+arc.flight){
    const u=(t-arc.takeoff)/arc.flight;f.airPhase='airborne';f.airProgress=u;f.airHeight=4*arc.peak*u*(1-u);
  }else if(t<f.airDuration){
    f.airPhase='landing';f.airProgress=(t-arc.takeoff-arc.flight)/arc.landing;f.airHeight=0;
  }else{
    f.airArc=null;f.airFacing=null;f.airTrick=null;f.jumpKind=null;f.airPhase='grounded';f.airProgress=0;f.airHeight=0;
  }
}
const art = (name) => name.startsWith('slash')?'slash':({thrust:'rush',vault:'rush',riposte:'uppercut',deflect:'slash',frenzy:'sweep',wide_cut:'sweep'}[name]??name);
function rng(state) { state.rng ^= state.rng<<13; state.rng ^= state.rng>>>17; state.rng ^= state.rng<<5; return (state.rng>>>0)/4294967296; }
function blendAngle(a,b,amount){return a+angleDelta(b,a)*amount;}
const bodyGap=36, dashDuration=.205;
const atk = f=>f.attack ? (f.attackSpec??ARCADE_ATTACKS[f.attack]) : null;
function event(s,kind,f,x=f.x,y=f.y,extra={}){
  s.events.push({id:++s.eventId,kind,x,y,face:f.face,team:f.team,fighterId:f.id,time:s.time,form:f.form,technique:f.technique,weapon:f.gear?.weapon,grip:f.gear?.grip,saberPhase:f.saberPhase,...extra});
  if(s.events.length>48) s.events.splice(0,s.events.length-48);
}
function setAction(f,action,duration=0){
  if(f.action!==action || duration){
    f.action=action; f.actionTime=0; f.actionDuration=duration;
  }
}
function spend(f,n){if(f.energy+1e-7<n)return false;f.energy=Math.max(0,f.energy-n);return true;}

export const ARCADE_STAT_KEYS=Object.freeze(['saberSwings','saberHits','damage','damageTaken','blocks','counters','parries','forceCasts','forceHits','kills','deaths','assists','environmentDeaths','saberLanded','forceLanded','punishes','whiffs','clashes','rankDeflections','rankComposure','rankMoves','allyBlocks','feints','guardReads','ripostes']);
const recordKeys=['kills','deaths','assists','environmentDeaths'];
const record = prior => Object.fromEntries(recordKeys.map(k=>[k,Number.isSafeInteger(prior?.[k])&&prior[k]>=0?Math.min(prior[k],1e9):0]));
const roundStats = () => Object.fromEntries(ARCADE_STAT_KEYS.map(k=>[k,0]));
const credit=(s,f,key,amount=1)=>{
  f.stats[key]+=amount;s.stats[key][f.team]+=amount;
  if(recordKeys.includes(key)){
    const side=s.records.teams[f.team], slot=s.records.soldiers.find(r=>r.id===f.id);
    side[key]=Math.min(1e9,side[key]+amount);slot[key]=Math.min(1e9,slot[key]+amount);
  }
};
function recordDamage(s,attacker,victim,amount) {
  if(amount<=0)return;
  credit(s,attacker,'damage',amount);credit(s,victim,'damageTaken',amount);
  victim.contributors=victim.contributors.filter(entry=>entry.time>=s.time-6).slice(-95);
  victim.contributors.push({id:attacker.id,time:s.time,damage:amount});
}
function recordKnockout(s,victim){
  credit(s,victim,'deaths');
  const dealt=new Map();
  for(const {id,time,damage} of victim.contributors) if(time>=s.time-6) dealt.set(id,(dealt.get(id)??0)+damage);
  const contributors=[...dealt].sort(([a,av],[b,bv])=>bv-av||(a<b?-1:a>b?1:0)).map(([id])=>s.fighters.find(f=>f.id===id)).filter(Boolean);
  const [killer,...assists]=contributors;
  if(killer){credit(s,killer,'kills');for(const helper of assists)credit(s,helper,'assists');}
  else credit(s,victim,'environmentDeaths');
  return {killerId:killer?.id??null,assists:assists.map(f=>f.id)};
}

const teamSize=(n,fallback)=>Number.isFinite(Number(n))&&n!==null&&n!==''?clamp(Math.floor(Number(n)),1,ARCADE_MAX_TEAM_SIZE):fallback;
const optionSet=(value,choices,fallback)=>choices.includes(value)?value:fallback;
const terrainParts=(parts, kind) => (Array.isArray(parts)?parts:[]).slice(0,40).filter(rect=>
  Number.isFinite(rect?.x)&&Number.isFinite(rect?.y)&&Number.isFinite(rect?.width)&&Number.isFinite(rect?.height)&&rect.width>0&&rect.height>0
).map(rect=>({...rect,kind:rect.kind??kind}));
function terrainFor(value,w,h) {
  const defaultBounds={minX:42,maxX:w-42,minY:h*.21875,maxY:h*(585/640)};
  const source=value&&typeof value==='object'?value:{id:typeof value==='string'?value:'open'};
  const bounds=Object.fromEntries(Object.entries(defaultBounds).map(([key,fallback])=>{
    const value=source.bounds?.[key];return [key,Number.isFinite(value)?clamp(value,0,key.endsWith('X')?w:h):fallback];
  }));
  return {id:source.id??'open',bounds:bounds.maxX-bounds.minX>80&&bounds.maxY-bounds.minY>80?bounds:defaultBounds,
    solids:terrainParts(source.solids,'wall'),zones:terrainParts(source.zones,'rough')};
}
const inside=(x,y,rect,pad=0)=>x>rect.x-pad&&x<rect.x+rect.width+pad&&y>rect.y-pad&&y<rect.y+rect.height+pad;
const openAt=(s,x,y,pad)=>!s.terrain.solids.some(r=>inside(x,y,r,pad));
function crossed(x,y,tx,ty,rect,pad=0){
  const x0=rect.x-pad,x1=rect.x+rect.width+pad,y0=rect.y-pad,y1=rect.y+rect.height+pad;
  if((x<x0&&tx<x0)||(x>x1&&tx>x1)||(y<y0&&ty<y0)||(y>y1&&ty>y1))return false;
  const dx=tx-x,dy=ty-y;
  let near=0,far=1;
  if(Math.abs(dx)>1e-7){const a=(x0-x)/dx,b=(x1-x)/dx;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
  if(Math.abs(dy)>1e-7){const a=(y0-y)/dy,b=(y1-y)/dy;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
  return near<=far;
}
const blockedBetween=(s,x,y,tx,ty,pad=0)=>s.terrain.solids.find(r=>crossed(x,y,tx,ty,r,pad));
function masterPath(s,f,enemy){
  const old=f.masterRoute;
  if(old&&old.until>s.time&&Math.hypot(old.tx-enemy.x,old.ty-enemy.y)<58){
    if(old.blocked)return null;
    while(old.points.length&&Math.hypot(old.points[0].x-f.x,old.points[0].y-f.y)<17)old.points.shift();
    if(old.points.length&&!blockedBetween(s,f.x,f.y,old.points[0].x,old.points[0].y,f.radius-.2))return old.points[0];
  }
  const pad=f.radius+7, b=s.bounds;
  const nodes=[{x:f.x,y:f.y},{x:enemy.x,y:enemy.y}];
  for(const block of s.terrain.solids){
    for(const x of [block.x-pad,block.x+block.width+pad])for(const y of [block.y-pad,block.y+block.height+pad]){
      if(x>b.minX&&x<b.maxX&&y>b.minY&&y<b.maxY&&openAt(s,x,y,f.radius+1))nodes.push({x,y});
    }
  }
  const scores=Array(nodes.length).fill(Infinity), parents=Array(nodes.length).fill(-1), closed=new Set();
  const distance=(i,j)=>Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
  scores[0]=0;
  for(let tries=0;tries<nodes.length;tries++){
    let best=-1,estimate=Infinity;
    for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&scores[i]+distance(i,1)<estimate){
      best=i;estimate=scores[i]+distance(i,1);
    }
    if(best<0)break;
    if(best===1){
      const points=[];let i=parents[best];
      while(i>0){points.unshift(nodes[i]);i=parents[i];}
      f.masterRoute={tx:enemy.x,ty:enemy.y,until:s.time+1.12,points};
      return points[0]??enemy;
    }
    closed.add(best);const a=nodes[best];
    for(let i=1;i<nodes.length;i++){
      const score=scores[best]+distance(best,i);
      if(closed.has(i)||score>=scores[i])continue;
      const n=nodes[i];
      if(!blockedBetween(s,a.x,a.y,n.x,n.y,f.radius-.2)){scores[i]=score;parents[i]=best;}
    }
  }
  f.masterRoute={tx:enemy.x,ty:enemy.y,until:s.time+.6,points:[],blocked:true};
  return null;
}
function chooseRoute(s,f,enemy){
  if(!s.terrain.solids.length)return enemy;
  const block=blockedBetween(s,f.x,f.y,enemy.x,enemy.y,f.radius+1);
  if(!block){f.route=null;return enemy;}
  if(f.rankDominance>=10&&(s.liveByTeam?.[1-f.team]<=5||s.liveByTeam?.[f.team]===1)){const route=masterPath(s,f,enemy);if(route)return route;}
  if(f.route&&f.route.until>s.time&&Math.hypot(f.route.x-f.x,f.route.y-f.y)>24)return f.route;
  const p=f.radius+10, {minX,maxX,minY,maxY}=s.bounds;
  const points=[{x:block.x-p,y:block.y-p},{x:block.x+block.width+p,y:block.y-p},
    {x:block.x-p,y:block.y+block.height+p},{x:block.x+block.width+p,y:block.y+block.height+p}];
  const valid=points.filter(({x,y})=>x>=minX&&x<=maxX&&y>=minY&&y<=maxY&&openAt(s,x,y,f.radius)&&!blockedBetween(s,f.x,f.y,x,y,f.radius));
  const distance=point=>Math.hypot(point.x-f.x,point.y-f.y)+Math.hypot(enemy.x-point.x,enemy.y-point.y);
  valid.sort((a,b)=>distance(a)-distance(b));
  if(valid.length){f.route={...valid[0],until:s.time+.55};return f.route;}
  return enemy;
}
function spawnPosition(s,team,slot,count){
  const {bounds:b}=s, mid=(b.minY+b.maxY)/2, xSpan=b.maxX-b.minX;
  const dir=team===0?1:-1, edge=team===0?b.minX:b.maxX, formation=s.config.formations[team];
  let x,y;
  if(count<=3&&formation==='line'){
    x=s.width*(team===0?(slot>0?.23:.31):(slot>0?.77:.69));
    y=clamp(s.height*.5+(slot>0?(slot%2?1:-1)*Math.min(110,s.height*.18):0),b.minY,b.maxY);
  }else{
    const row=slot%5;const col=Math.floor(slot/5);const order=[0,1,-1,2,-2];
    const gap=Math.min(75,(b.maxY-b.minY-40)/4);
    y=mid+order[row]*gap;
    x=edge+dir*(xSpan*(formation==='spread'?.33:.30)-col*48-(formation==='wedge'?Math.abs(order[row])*26:0));
    if(formation==='spread')y=mid+order[row]*gap+([0,1,-1][col]??0)*Math.min(gap*.34,23);
  }
  x+=dir*(s.config.deployments[team]==='forward'?56:s.config.deployments[team]==='reserve'?-56:0);
  const trim=(xx,yy)=>[clamp(xx,b.minX+5,b.maxX-5),clamp(yy,b.minY+5,b.maxY-5)];
  for(let i=0;i<8;i++) for(const dy of [0,30,-30,60,-60]){
    const [xx,yy]=trim(x-dir*i*36,y+dy);
    if(openAt(s,xx,yy,17)&&!s.fighters.some(other=>Math.hypot(other.x-xx,other.y-yy)<bodyGap))return [xx,yy];
  }
  // Very dense or blocked starts use a nearest legal same-side grid cell.
  const alternatives=[];
  for(let px=b.minX+19;px<b.maxX-19;px+=37){
    if(team===0?px>s.width*.46:px<s.width*.54)continue;
    for(let py=b.minY+19;py<b.maxY-19;py+=37){
      if(openAt(s,px,py,17)&&s.fighters.every(other=>Math.hypot(other.x-px,other.y-py)>=bodyGap))
        alternatives.push({x:px,y:py,d:Math.hypot(px-x,py-y)});
    }
  }
  alternatives.sort((a,b)=>a.d-b.d);
  return alternatives.length?[alternatives[0].x,alternatives[0].y]:trim(x,y);
}
function startingMerit(value) {
  const label=typeof value==='string' ? value.trim().toUpperCase().replace(/\s+/g,'').replace('(ENTRY)','') : 'F';
  return SOLDIER_GRADES.find(g=>g.label===label)?.threshold??0;
}
function makeFighter(s,team,slot,count,control,careers,startingRanks){
  const id=`${team}-${slot}`;
  const hero=s.heroLineup[id]??null;
  const supplied=careers?.[id]??careers?.[team]?.[slot];
  const side=startingRanks?.[team]??startingRanks?.[team===0?'blue':'red'];
  const career=progressionSummary(hero?startingMerit('SSS+V'):supplied??startingMerit(Array.isArray(side)?side[slot]:side));
  const skill=combatSkillProfile(career);
  const archetype = control ? s.playerArchetype : count===1 ? (team===0?'vanguard':'duelist') : ['vanguard','duelist','warden'][slot%3];
  const preset=s.config.teamForms[team];
  const explicit=typeof preset==='string'?preset:preset?.[slot]??null;
  const picked=Object.hasOwn(ARCADE_FORMS,explicit)?explicit:null;
  const lead=team===0&&slot===((s.mode==='watch'||s.mode==='command')?0:s.config.playerSlot);
  const form=hero?.form??(s.formRules?(picked??(lead&&explicit!=='mixed'?s.playerForm:ARCADE_FORM_IDS[(s.round-1+team*3+slot+(team===1&&count===1?1:0))%ARCADE_FORM_IDS.length])):legacyForm[archetype]);
  const injuries=createArcadeInjuries();
  const injuryEffects=arcadeInjuryModifiers(injuries);
  const body=hero?.body??(lead?s.playerBody:(team+slot+s.round)%2===0?'woman':'femboy');
  const visualKey=hero?.id??`roster:${s.weatherSeed}:${id}`;
  const gender=fighterGender(hero?.gender,body,visualKey),appearanceSeed=hero?.appearanceSeed??appearanceSeedFor(visualKey);
  const gear=hero?arcadeFighterGear({
    startingSaberWeapon:[hero.weapon],startingSaberGrip:[hero.grip],startingDualPhase:[hero.dualPhase],
    startingForceFamily:[hero.forceFamily]
  },0):arcadeFighterGear(s.config,team);
  const [x,y]=spawnPosition(s,team,slot,count);
  return {id,team,control,slot,archetype,form,body,gender,appearanceSeed,career,skill,rankCombat:ARCADE_RANK_COMBAT[career.gradeIndex],moves:{},gear,heroId:hero?.id,displayName:hero?.name,heroDoctrine:hero?.doctrine,
    ...(hero?{heroPlan:hero.doctrine,heroAdaptation:normalizeHeroTactics(hero.heroAdaptation??hero.adaptation),
      heroElo:Number.isFinite(hero.elo)?hero.elo:undefined,heroEloFloorGrade:hero.eloFloorGrade??hero.heroEloFloorGrade}:{}),formRules:s.formRules||Boolean(hero),x,y,face:team===0?0:Math.PI,
    vx:0,vy:0,kx:0,ky:0,radius:17,groundDistance:0,groundSpeed:0,alive:true,injuries,injuryEffects,saberPhase:'short',
    energy:100,action:'idle',actionTime:0,actionDuration:0,attack:null,attackSpec:null,contact:false,offhandContact:false,technique:null,counterUntil:0,guardLane:'center',guardBearing:null,combo:0,
    parryTime:0,invuln:0,guardLock:0,airborne:0,airArc:null,airPhase:'grounded',airHeight:0,airProgress:0,airTime:0,airDuration:0,think:.09+slot*.11,decision:null,buffer:null,guardHeld:false,stats:roundStats(),contributors:[],targetId:null,targetUntil:0,counterMove:false};
}
export function createArcade({mode='duel',seed=1,width=1120,height=640,archetype='vanguard',form,body='femboy',round=1,records,careers,startingRanks,teamSizes,limit,playerSlot,teamForms,saberOnly=false,terrain,doctrines,targeting,formations,rule,weather,environment,deployments,startingSaberQuality,startingDualSabers,startingSaberWeapon,startingSaberGrip,startingDualPhase,startingForceFamily,startingForceQuality,heroLineup}={}){
  mode=['duel','squad','watch','command'].includes(mode)?mode:'duel';
  width=clamp(Number.isFinite(width)?width:1120,480,2400);height=clamp(Number.isFinite(height)?height:640,360,1440);
  const stringSeed=typeof seed==='string'?Array.from(seed).reduce((n,c)=>Math.imul(n^c.codePointAt(0),16777619),-2128831035):Number(seed);
  const hasForm=Object.hasOwn(ARCADE_FORMS,form);
  const formRules=hasForm||Array.isArray(teamForms);
  const fallback=mode==='duel'?1:3;
  const sizes=[teamSize(teamSizes?.[0],fallback),teamSize(teamSizes?.[1],fallback)];
  const map=terrainFor(typeof terrain==='string'&&terrain!=='open'?createArcadeTerrain(terrain,width,height,round):terrain,width,height);
  const config={...normalizeArcadeGear({startingSaberQuality,startingDualSabers,startingSaberWeapon,startingSaberGrip,startingDualPhase,startingForceFamily,startingForceQuality}),teamSizes:sizes,limit:[45,75,90,150].includes(Number(limit))?Number(limit):75,
    playerSlot:Number.isInteger(Number(playerSlot))?clamp(Number(playerSlot),0,sizes[0]-1):0,
    teamForms:[teamForms?.[0]??null,teamForms?.[1]??null],saberOnly:Boolean(saberOnly),
    doctrines:[0,1].map(i=>optionSet(({assault:'aggressive',guard:'defensive'})[doctrines?.[i]]??doctrines?.[i],['balanced','aggressive','defensive'],'balanced')),
    targeting:[0,1].map(i=>optionSet(targeting?.[i],['balanced','nearest','weakest','objective'],'balanced')),
    formations:[0,1].map(i=>optionSet(formations?.[i],['line','wedge','spread'],'line')),
    rule:optionSet(rule,['elimination','control','relic'],'elimination'),
    weather:optionSet(weather??environment,Object.keys(ENVIRONMENTS),'clear'),
    deployments:[0,1].map(i=>optionSet(deployments?.[i],['standard','forward','reserve'],'standard'))};
  const s={mode,width,height,formRules,config,heroLineup:normalizeHeroLineup(heroLineup),terrain:map,playerForm:hasForm?form:legacyForm[archetype]??'shii_cho',playerBody:['woman','rabbit'].includes(body)?body:'femboy',time:0,round:Number.isInteger(round)&&round>0?round:1,phase:'playing',fighters:[],events:[],eventId:0,
    bounds:map.bounds,objective:createArcadeObjective(config.rule,width,height,map.bounds),order:'push',weather:null,weatherSeed:stringSeed>>>0,
    rng:(stringSeed>>>0)||1, playerArchetype:Object.hasOwn(archetypes,archetype)?archetype:'vanguard',edges:{},limit:config.limit,tick:0,
    stats:Object.fromEntries(ARCADE_STAT_KEYS.map(k=>[k,[0,0]])),records:{teams:[record(records?.teams?.[0]),record(records?.teams?.[1])],soldiers:[]},
    pressure:mode==='watch'||!Number.isInteger(round)?0:clamp((round-1)/9,0,1)};
  for(let team=0;team<2;team++)for(let i=0;i<sizes[team];i++)s.fighters.push(makeFighter(s,team,i,sizes[team],team===0&&i===config.playerSlot&&mode!=='watch'&&mode!=='command',careers,startingRanks));
  s.weather=environmentAt(config.weather,s.weatherSeed,0);
  for (const f of s.fighters) {
    f.spawn={x:f.x,y:f.y};
    f.loadoutChosen=Boolean(f.heroId)||Array.isArray(startingForceFamily)||Array.isArray(startingForceQuality);
    const prior=Array.isArray(records?.soldiers)?records.soldiers.find(r=>r?.id===f.id&&r.team===f.team&&r.slot===f.slot):null;
    s.records.soldiers.push({id:f.id,team:f.team,slot:f.slot,lane:f.slot,...record(prior)});
  }
  // Solo against at least three equally ranked masters. Only bots use the
  // coordination; a controlled fighter keeps all of their normal inputs.
  s.eliteCrossfire=mode!=='command'&&config.rule==='elimination'&&Math.min(...sizes)===1&&
    Math.max(...sizes)>=3&&s.fighters.every(f=>f.career.gradeIndex===14);
  s.elitePacing=config.rule==='elimination'&&sizes[0]===sizes[1]&&s.fighters.every(f=>f.career.grade==='SSS+V') ?
    {active:true,stage:'measured',fullAt:.91,measuredUntil:.81} : null;
  return s;
}

function releaseThreat(attacker,victim,now,frontOnly=false){
  const move=atk(attacker);
  if(!move)return false;
  const dx=victim.x-attacker.x,dy=victim.y-attacker.y,angle=Math.atan2(dy,dx);
  if(frontOnly&&Math.abs(angleDelta(angle+Math.PI,victim.face))>1.27)return false;
  const isThreat=(blade,released,turn=0)=>{
    if(!blade||released)return false;
    const time=blade.contact-attacker.actionTime;
    return time>0&&time<now&&dx*dx+dy*dy<=(blade.reach+27)**2&&Math.abs(angleDelta(angle,attacker.face+turn))<blade.arc+.17;
  };
  return isThreat(move,attacker.contact)||
    isThreat(move.offhand,attacker.offhandContact,move.offhand?.blade==='rear'?Math.PI:0);
}
function rememberAttacker(s,f,hostile,from){
  if(f.control||!f.alive||Math.abs(angleDelta(from,f.face))<1.12)return;
  // Don't reset the reaction clock under a flurry from the same source.
  const prior=f.rearHit;
  const delay=.27-f.career.gradeIndex*.0075;
  f.rearHit={id:hostile.id,readyAt:prior?.id===hostile.id&&prior.expires>s.time?prior.readyAt:s.time+delay,expires:s.time+1.48};
}
function nearest(s,f){
  let best=null,score=Infinity;
  const policy=f.control?'nearest':s.config.targeting[f.team];
  for(const o of s.fighters)if(o.team!==f.team&&o.alive){
    const d=Math.hypot(o.x-f.x,o.y-f.y);
    if(!f.control&&d>s.weather.sightRange)continue;
    const injury=policy==='weakest'?o.injuryEffects.moveSpeed*45+o.injuryEffects.guardEfficiency*65:0;
    const value=d+(policy==='weakest'?injury:policy==='objective'?Math.hypot(o.x-s.width*.5,o.y-s.height*.5)*.29:0);
    if(value<score){score=value;best=o;}
  }
  f.awarenessFacing=false;
  if(f.control||!best)return best;
  const memory=f.rearHit;
  if(memory&&s.time>=memory.readyAt&&s.time<memory.expires&&!atk(f)){
    const remembered=s.fighters.find(o=>o.id===memory.id&&o.alive&&o.team!==f.team);
    if(remembered&&Math.hypot(remembered.x-f.x,remembered.y-f.y)<Math.min(253,s.weather.sightRange)&&
       !blockedBetween(s,f.x,f.y,remembered.x,remembered.y)){
      const front=s.fighters.find(o=>o.alive&&o.team!==f.team&&o.id!==remembered.id&&releaseThreat(o,f,.21,true)&&
        !blockedBetween(s,f.x,f.y,o.x,o.y));
      if(front)return front;
      f.targetId=remembered.id;f.targetUntil=s.time+.22;f.awarenessFacing=true;return remembered;
    }
  }
  const old=s.fighters.find(o=>o.id===f.targetId&&o.alive);
  if(old&&s.time<f.targetUntil&&Math.hypot(old.x-f.x,old.y-f.y)<=Math.min(s.weather.sightRange,score*1.55+25))return old;
  f.targetId=best.id;f.targetUntil=s.time+.48;
  return best;
}
function turnForAttack(f,to){if(Number.isFinite(to))f.face=to;}
const elitePair=(a,b)=>a.career.gradeIndex>=12&&b.career.gradeIndex>=12&&Math.abs(a.career.gradeIndex-b.career.gradeIndex)<=2;
function pacingLift(s) {
  if(!s.elitePacing)return 1;
  const u=clamp((s.time/s.limit-s.elitePacing.measuredUntil)/(s.elitePacing.fullAt-s.elitePacing.measuredUntil),0,1);
  return u*u*(3-2*u);
}
function pacedDamage(s,victim,damage,punish,blocked){
  if(!s.elitePacing)return damage;
  const lift=pacingLift(s);
  if(lift>=1)return damage;
  const recent=victim.recentMistakes?.filter(t=>t>s.time-7)??[];
  const wideOpen=punish&&recent.length>=5&&victim.energy<=8&&(victim.control||victim.exposedBy==='guard_break');
  const clockWeight=Math.min(.68,45/s.limit);
  const early=wideOpen?.87:blocked?.25*clockWeight:punish?.33*clockWeight:.20*clockWeight;
  const scaled=Math.max(1,Math.round(damage*(early+(1-early)*lift)));
  // Measured exchanges can still impair a region, but only a fully exposed
  // sequence or decisive late release risks an early knockout.
  const elapsedFraction=s.time/s.limit;
  return !wideOpen&&elapsedFraction<.85?Math.min(scaled,elapsedFraction<.81?4:6):scaled;
}
function expose(s,f,reason,seconds){
  f.exposedBy=reason;f.exposedUntil=s.time+seconds;
  if(s.elitePacing){
    f.recentMistakes=(f.recentMistakes??[]).filter(t=>t>s.time-7).slice(-5);
    f.recentMistakes.push(s.time);
  }
}
const saberReachInLongPhase=reach=>26+Math.max(0,reach-26)*1.26;
function changeSaberPhase(s,f,desired){
  if(!f.gear.dualPhase||!f.alive||f.saberPhase===desired||f.saberPhaseReadyAt>s.time||
      f.actionDuration>0||!['idle','walk','run'].includes(f.action)||f.energy<11)return false;
  f.energy=Math.max(0,f.energy-(desired==='long'?5:2));
  f.saberPhase=desired;
  f.saberPhaseChangedAt=s.time;
  f.saberPhaseReadyAt=s.time+1.15;
  countMove(f,'phase_'+desired);
  const geometry=arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
  event(s,'saber_phase',f,undefined,undefined,{phase:desired,
    contactX:geometry.hand?.x,contactY:geometry.hand?.y,blades:geometry.blades??[{id:'main',hand:geometry.hand,tip:geometry.tip}]});
  return true;
}
function isFeintable(f){
  const move=atk(f);
  return move&&f.action!=='force'&&!f.contact&&f.actionTime<move.contact*.56&&!f.airArc&&f.airPhase==='grounded';
}
function beginFeint(s,f,bearing,followup=null,redirect=null){
  if(!f.alive||f.energy<12||f.guardLock>0||f.feintReadyAt>s.time||
    (f.actionDuration>0&&!isFeintable(f))||!spend(f,6))return false;
  f.attack=null;f.attackSpec=null;f.combo=0;f.technique='feint';f.buffer=null;
  f.feintBearing=bearing;f.feintRedirect=redirect;f.feintFollowup=followup;f.feintReadyAt=s.time+2.8;
  f.feintSerial=(f.feintSerial??0)+1;turnForAttack(f,bearing);
  setAction(f,'feint',.34);countMove(f,'feint');credit(s,f,'feints');
  event(s,'feint',f,undefined,undefined,{feintBearing:bearing});return true;
}
function guardSource(victim,from,spec){
  const left=angleDelta(from,victim.guardBearing??victim.face);
  // Actual grip and emitter can subtly move the attacking line. This never
  // swings a blade through an ally or overrides world contact geometry.
  const bladeOffset=spec.blade==='rear'?-.11:spec.isOffhand?-.18:(spec.bladeTurn??0)*.6;
  return left+bladeOffset;
}
function confirmGuardRead(s,victim,attacker,x,y,kind){
  const serial=attacker.id+':'+(attacker.attackSerial??s.tick);
  if(!victim.guardDirected||victim.lastReadSerial===serial)return;
  victim.lastReadSerial=serial;
  credit(s,victim,'guardReads');countMove(victim,'guard_read');
  event(s,'read',victim,x,y,{targetId:attacker.id,guardLane:victim.guardLane,
    guardBearing:victim.guardBearing,readKind:kind,contactY:y-38-victim.airHeight});
}
const authoringLateral=move=>move?.tactical==='slip_counter'||move?.tactical==='moving_guard';
function attack(s,f,name,to,{redirected=false}={}){
  if(name==='force'&&s.config.saberOnly)name='wide_cut';
  const authored=ARCADE_TECHNIQUES[name];
  const base=authored??ARCADE_ATTACKS[name];
  if((authored&&(authored.form!==f.form||authored.minRank>f.career.gradeIndex))||!base||f.guardLock>.005)return false;
  if(authored?.tactical==='feint_redirect'&&!redirected){
    const dir=Number.isFinite(to)?to:f.face,shift=(f.slot%2===0?1:-1)*.48;
    return beginFeint(s,f,dir+shift,name,dir);
  }
  const forceMove=name==='force'||authored?.mapAction==='force';
  if(forceMove&&s.config.saberOnly)return false;
  const def=profile(f);
  const counter=(name==='riposte'||authored?.role==='counter')&&f.counterUntil>s.time;
  const riposteSource=counter?f.counterTarget:null;
  let move=f.formRules&&name.startsWith('slash')?{...base,duration:base.duration*def.tempo,contact:base.contact*def.tempo,
    arc:base.arc*def.arc,reach:base.reach*def.reach,damage:base.damage+(f.form==='juyo'?2:0)}
    :counter&&!authored?{...base,duration:.39,contact:.165,cost:19,damage:40,lunge:475,recoil:.37}:base;
  if(f.formRules&&styleTimings[name]) {
    const [duration,contact,lunge]=counter?quickCounter:styleTimings[name];
    const pace=name.startsWith('slash')?def.tempo:1;
    move={...move,duration:duration*pace,contact:contact*pace,lunge};
  }
  if(f.career.gradeIndex>0) {
    // Keep the form's clear telegraph while letting stronger careers recover
    // sooner and use less energy. No random hit bonus: geometry remains decisive.
    const contact=move.contact*(1-(f.formRules?.08:.15)*f.skill.skill);
    move={...move, contact, duration:contact+(move.duration-move.contact)*f.career.modifiers.reloadMultiplier,
      cost:move.cost*(1-.22*f.skill.skill)};
  }
  const train=f.rankCombat;
  if(train.index>=9&&!forceMove){
    const weak=s.fighters.filter(e=>e.alive&&e.team!==f.team&&rankGap(f,e)>=6&&Math.hypot(e.x-f.x,e.y-f.y)<185).length;
    if(weak>=2){
      const sweeping=authored?.role==='crowd'||name==='wide_cut'||name==='frenzy'||name==='sweep';
      move={...move,arc:Math.min(2.89,move.arc+(sweeping?.99:.48)*train.index/14),
        reach:move.reach+(sweeping?33:19)*train.index/14,rankSweep:sweeping||train.index>=13&&name.startsWith('slash')};
    }
  }
  move=arcadeGearMove(f.gear,forceMove?'force':name,move);
  if(authored?.forceAbility)move={...move,forceAbility:authored.forceAbility};
  if(!forceMove&&f.gear.grip==='backhand'){
    // The tip trails the wrist. Commit nearer, recover sooner and cover
    // more of the wrist-side arc instead of gaining phantom forward reach.
    move={...move,reach:move.reach*.88,arc:Math.min(2.75,move.arc+.20),
      duration:move.contact+(move.duration-move.contact)*.91,
      damage:move.damage*.96,offhand:move.offhand?{...move.offhand,reach:move.offhand.reach*.88,arc:Math.min(2.75,move.offhand.arc+.18)}:undefined};
  }
  if(!forceMove&&f.gear.weapon==='staff'){
    // Both live emitters share one hilt and one release, not two cost-bearing swings.
    const rear={contact:move.contact,damage:move.damage*.74,reach:Math.min(101,move.reach*.79),
      arc:Math.min(1.47,Math.max(.94,move.arc*.74)),knock:move.knock*.68,recoil:move.recoil*.80,blade:'rear'};
    move={...move,reach:move.reach*.95,damage:move.damage*.94,arc:Math.min(1.57,move.arc),
      cost:move.cost*1.12,offhand:rear};
  }
  if(!forceMove&&f.gear.dualPhase&&f.saberPhase==='long'){
    move={...move,reach:saberReachInLongPhase(move.reach),cost:move.cost*1.16,
      duration:move.contact+(move.duration-move.contact)*1.12,
      offhand:move.offhand?{...move.offhand,reach:saberReachInLongPhase(move.offhand.reach)}:undefined};
  }
  const strength=forceMove?f.injuryEffects.forcePower:f.injuryEffects.saberPower;
  move={...move,damage:move.damage*strength,offhand:move.offhand?{...move.offhand,damage:move.offhand.damage*strength}:undefined};
  if(f.rankDominance>=8)move={...move,cost:move.cost*(1-.39*masteryRatio(f.rankDominance))};
  if(!spend(f,move.cost))return false;
  if(counter){f.counterUntil=0;f.parryCounterUntil=0;}
  f.riposteTarget=riposteSource;
  if(authoringLateral(authored)){
    const turn=(f.slot%2===0?1:-1)*(authored.tactical==='slip_counter'?.62:.78);
    const direction=(Number.isFinite(to)?to:f.face)+turn;
    f.stepBearing=direction;f.stepUntil=s.time+(authored.tactical==='slip_counter'?.21:.34);
    if(authored.tactical==='moving_guard'){
      f.guardBearing=Number.isFinite(to)?to:f.face;f.guardLane=turn>0?'right':'left';f.guardDirected=true;
    }
  }else f.stepUntil=0;
  f.counterMove=counter;f.lastOpponentMove=name;
  credit(s,f,forceMove?'forceCasts':'saberSwings');countMove(f,name);
  if(forceMove)f.lastForceAt=s.time;
  turnForAttack(f,to); f.attack=name;f.attackSpec=move;f.technique=name;f.contact=false;f.offhandContact=false;f.buffer=null;f.attackSerial=s.eventId+1;f.staffTouched=null;f.staffLanded=false;
  if(f.eliteEngaged&&!f.control){
    const tactical=s.elitePacing?(1-pacingLift(s))*(.30+(s.limit-45)*.0045):-(f.eliteRankEdge??0)*.075;
    f.eliteReady=s.time+move.duration+.16+rng(s)*.28+tactical;
  }
  f.combo=name==='slash4'?4:name==='slash3'?3:name==='slash2'?2:name==='slash'?1:0;
  if(name==='vault'||authored?.air)startAir(f,aerialArcs[authored?.air]??vaultArc);
  if(authored)credit(s,f,'rankMoves');
  const action=authored?.mapAction??art(name);
  setAction(f,action,move.duration); event(s,action,f,undefined,undefined,{rankMove:Boolean(authored),combo:f.combo,contact:move.contact,duration:move.duration,counter,blade:forceMove?undefined:'primary',forceAbility:move.forceAbility});
  return true;
}
function dash(s,f,dir,evasion){
  if(isArcadeCarrier(s,f))return false;
  const acrobat=f.formRules&&f.form==='ataru';
  if(!spend(f,acrobat?15:19))return false;
  const evade=acrobat?'vault_step':evasion==='sidestep'||evasion==='backstep'?evasion:'dash';
  countMove(f,evade);
  f.face=dir;f.contact=false;f.attack=null;f.combo=0;f.buffer=null;f.invuln=acrobat?0:.115;f.technique=evade==='dash'?null:evade;
  if(acrobat)startAir(f,evadeArc,Number.isFinite(f.lastParryAt)&&s.time-f.lastParryAt<1?'parry_flip':null);
  setAction(f,'dash',f.formRules?acrobat?.405:.26:dashDuration);event(s,'dash',f);return true;
}
function jump(s,f,bearing,traversing){
  if(!f.alive||f.airArc||f.airPhase!=='grounded'||f.actionDuration>0||
    !['idle','walk','run'].includes(f.action)||f.jumpReadyAt>s.time||isArcadeCarrier(s,f))return false;
  const arc=jumps[f.form]??jumps.shii_cho;
  if(!spend(f,arc.cost))return false;
  f.jumpKind=arc.kind;f.jumpBearing=bearing;f.jumpDrive=traversing?arc.drive:0;
  f.jumpReadyAt=s.time+arc.takeoff+arc.flight+arc.landing+.34;
  f.attack=null;f.attackSpec=null;f.buffer=null;f.combo=0;f.technique=null;
  countMove(f,'jump');turnForAttack(f,bearing);startAir(f,arc);
  setAction(f,'jump',f.airDuration);
  event(s,'jump',f,undefined,undefined,{jumpKind:f.jumpKind,jumpBearing:bearing});return true;
}
function stagger(f,seconds){
  f.attack=null;f.buffer=null;f.combo=0;setAction(f,'stagger',seconds);
}
function injuryRoll(s,attacker,victim){
  // Separate deterministic channel so contacts do not perturb AI choice timing.
  const code=Math.imul(s.tick+1,0x27d4eb2d)^(s.eventId+1)^Math.imul(attacker.slot+1+attacker.team*31,0x9e3779b9)^Math.imul(victim.slot+1+victim.team*37,0x85ebca6b);
  let h=code^s.weatherSeed;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/4294967296;
}
function updateInjury(f,result){
  if(result.changed){
    f.injuries=result.injuries;
    f.injuryEffects=arcadeInjuryModifiers(f.injuries,{dual:f.gear?.dualSabers});
  }
  if(result.fatal){
    f.alive=false;f.fatalRegion=result.region;f.fatalDirection=result.direction;
  }
}
function injure(s,attacker,victim,spec,amount,blocked,punish,from){
  const incoming=angleDelta(from,victim.face), travel=angleDelta(Math.atan2(victim.y-attacker.y,victim.x-attacker.x),attacker.face);
  const direction=Math.abs(incoming)>2.26?'rear':Math.abs(incoming)>.86?'side':'front';
  const left=(Math.sin(incoming)+(spec.isOffhand?-.55:.28)*(attacker.gear.grip==='backhand'?-1:1))<0;
  const arm=left?'leftArm':'rightArm',leg=left?'leftLeg':'rightLeg';
  const path=ARCADE_TECHNIQUES[attacker.technique]?.role;
  const action=attacker.action;
  const stableLine=Math.abs(angleDelta(travel,spec.blade==='rear'?Math.PI:spec.bladeTurn??0))<(action==='rush'?.36:.52);
  const quality=clamp((stableLine?.67:.43)+(punish?.22:0)+(victim.action==='stagger'?.08:0)+(direction==='rear'?.08:0),0,1);
  let region='torso';
  if(action==='force')region=stableLine?'torso':leg;
  else if(action==='sweep'||path==='crowd')region=stableLine&&punish?'torso':leg;
  else if(action==='uppercut'||attacker.airHeight>23)region=stableLine?'head':arm;
  else if(action==='rush')region=stableLine?'torso':arm;
  else if(action==='slash')region=stableLine?(attacker.combo>=3||punish?'head':'torso'):arm;
  const result=applyArcadeInjury(victim.injuries,{region,amount,quality,attackerRank:attacker.career.gradeIndex,
    defenderRank:victim.career.gradeIndex,blocked,roll:injuryRoll(s,attacker,victim),direction});
  updateInjury(victim,result);
  const zoneY=region==='head'?57:region==='torso'?40:region.endsWith('Arm')?33:15;
  return {delta:result.impact??result.delta,meta:{region,direction,injuryTier:result.tier,
    injuryOutcome:result.outcome,contactY:victim.y-zoneY-victim.airHeight,fatal:result.fatal}};
}
function applyDamage(s,attacker,victim,spec){
  const angle=Math.atan2(victim.y-attacker.y,victim.x-attacker.x);
  const from=Math.atan2(attacker.y-victim.y,attacker.x-victim.x);
  const def=profile(victim);
  const superiority=rankGap(victim,attacker), mastery=masteryRatio(superiority);
  const moveIsForce=attacker.action==='force';
  const deflecting=(victim.attack==='deflect'||victim.attackSpec?.deflect)&&victim.actionTime>=.04&&victim.actionTime<=(victim.attackSpec?.contact??.245);
  const guarding=victim.action==='guard', movingGuard=deflecting&&ARCADE_TECHNIQUES[victim.technique]?.tactical==='moving_guard';
  const directed=guarding||movingGuard;
  const coverage=victim.crossfire&&guarding&&victim.energy>18?1.53:movingGuard?1.00:deflecting?1.77:victim.guardDirected?victim.guardLane==='center'?1.04:.81:1.33;
  const closeGuard=(guarding||deflecting)&&Math.abs(directed?guardSource(victim,from,spec):angleDelta(from,victim.face))<coverage;
  const origin={sx:attacker.x,sy:attacker.y,forceAbility:spec.forceAbility,offhand:Boolean(spec.isOffhand),blade:moveIsForce?undefined:spec.blade??(spec.isOffhand?'offhand':'primary')};
  const impactX=victim.x-Math.cos(angle)*8,impactY=victim.y-Math.sin(angle)*8;
  if(victim.invuln>0&&victim.action==='dash'&&victim.airPhase==='grounded')return 'evade';
  if(victim.wardUntil>s.time&&victim.wardCharges>0){
    victim.wardCharges--;credit(s,victim,'blocks');countMove(victim,'force_ward_block');
    event(s,'force_ward',victim,impactX,impactY,{targetId:attacker.id,...origin});return 'block';
  }
  if(closeGuard&&!moveIsForce&&(victim.parryTime>0||deflecting)&&victim.energy>=5&&(superiority>=-5||s.time-(victim.lastParryAt??-Infinity)>.45+Math.abs(superiority)*.043)){
    victim.energy=Math.min(100,victim.energy+13);victim.parryTime=0;victim.counterUntil=s.time+1.04;victim.counterTarget=attacker.id;victim.parryCounterUntil=s.time+.83;
    attacker.energy=Math.max(0,attacker.energy-11);stagger(attacker,.44);
    if(elitePair(attacker,victim))expose(s,attacker,'parried',.62);
    attacker.kx-=Math.cos(angle)*210;attacker.ky-=Math.sin(angle)*210;
    victim.lastParryAt=s.time;countMove(victim,'parry');credit(s,victim,'blocks');credit(s,victim,'parries');
    event(s,'parry',victim,impactX,impactY,{targetId:attacker.id,...origin});confirmGuardRead(s,victim,attacker,impactX,impactY,'parry');return 'parry';
  }
  // A master can read a novice blade on a real front/side line, provided
  // they are not stunned or already in an exposed release and can pay for it.
  const releasing=victim.attack&&Math.abs((victim.attackSpec?.contact??0)-victim.actionTime)<(superiority>=12?.033:.073);
  if(s.time-(victim.rankDeflectAt??-Infinity)>.16)victim.rankReadCount=0;
  const canDeflect=superiority>=4&&!moveIsForce&&!closeGuard&&!releasing&&victim.action!=='stagger'&&victim.action!=='clash'&&
    victim.energy>=3&&(superiority>=10?(victim.rankReadCount??0)<2+Math.min(Math.floor(victim.rankCombat.reads*.28),Math.floor(mastery*4)):s.time-(victim.rankDeflectAt??-Infinity)>=.25-mastery*.16)&&
    Math.abs(angleDelta(from,victim.face))<=1.02+mastery*1.92;
  if(canDeflect){
    victim.rankDeflectAt=s.time;victim.rankReadCount=(victim.rankReadCount??0)+1;victim.energy=Math.max(0,victim.energy-(4-mastery*3.3));
    attacker.energy=Math.max(0,attacker.energy-4-mastery*6);
    if(superiority>=8)stagger(attacker,.12+mastery*.15);
    credit(s,victim,'blocks');credit(s,victim,'rankDeflections');countMove(victim,'rank_deflect');
    event(s,'rank_deflect',victim,impactX,impactY,{targetId:attacker.id,damage:0,...origin});
    return 'block';
  }
  const rawDamage=Math.max(1,Math.round(spec.damage*(s.mode==='watch'?.65:attacker.control?1:attacker.team===1?.72+.14*s.pressure:.8)*rankStrikeScale(attacker,victim)));
  let damage=rawDamage, blocked=false, breakGuard=false;
  if(spec.forceAbility==='stasis'){
    victim.stasisUntil=Math.max(victim.stasisUntil??0,s.time+.85);
    event(s,'force_stasis',attacker,impactX,impactY,{targetId:victim.id,...origin});
  }
  if(closeGuard){
    const guardCost=rawDamage*.89/Math.max(.35,victim.injuryEffects.guardEfficiency)*(def.guardCost??1)*(moveIsForce?1.45:1)*(1-.26*victim.skill.skill);
    if(victim.energy>=guardCost){
      victim.energy-=guardCost;victim.counterUntil=s.time+.83;victim.counterTarget=attacker.id;blocked=true;credit(s,victim,'blocks');countMove(victim,'block');damage=Math.max(1, Math.round(rawDamage*.12));
      victim.kx+=Math.cos(angle)*spec.knock*.28;victim.ky+=Math.sin(angle)*spec.knock*.28;

    }else{
      victim.energy=0;victim.guardLock=.55;stagger(victim,.57);breakGuard=true;countMove(attacker,'guard_break');damage=Math.round(rawDamage*.84);

    }
  }
  const punish=!blocked&&damage>0&&victim.exposedUntil>s.time;
  // A ready grandmaster caught while sliding a real outside angle turns a
  // marginal hit into a graze, not an automatic block. A clean rear, committed
  // windup, air hit, exhausted guard or an earned punish stays full strength.
  const bodyLine=Math.abs(angleDelta(from,victim.face));
  const strikeLine=Math.abs(angleDelta(from+Math.PI,attacker.face+(spec.blade==='rear'?Math.PI:spec.bladeTurn??0)));
  const sliding=Math.abs(Math.cos(from)*victim.vy-Math.sin(from)*victim.vx)>28;
  const braced=!moveIsForce&&!blocked&&!punish&&!breakGuard&&victim.localRead&&elitePair(attacker,victim)&&victim.energy>=15&&
    victim.airPhase!=='airborne'&&bodyLine<2.22&&
    (victim.action==='guard'||(['run','walk','dash','idle'].includes(victim.action)&&(sliding||bodyLine>.73||strikeLine>.22)));
  if(!punish&&!blocked&&!breakGuard&&!s.elitePacing&&elitePair(attacker,victim)&&
      s.liveByTeam[0]!==s.liveByTeam[1]&&s.config.teamSizes[0]!==s.config.teamSizes[1]&&victim.energy>=12){
    // Equally trained opponents can contain ordinary contact even in an
    // uneven roster. This attenuates injury, never removes contact and
    // applies to both sides; an earned opening always hits at full force.
    damage=Math.max(1,Math.round(damage*(s.liveByTeam[victim.team]<s.liveByTeam[attacker.team]?(bodyLine<2.22?0.33:0.56):(bodyLine<2.22?.64:.82))));
  }
  if(braced){
    victim.energy-=4;
    countMove(victim,'pressure_graze');
    damage=Math.max(1,Math.round(damage*.63));
  }
  damage=pacedDamage(s,victim,damage,punish,blocked);
  const punishReason=punish?victim.exposedBy:undefined;
  if(punish){credit(s,attacker,'punishes');victim.exposedUntil=0;victim.exposedBy=null;}
  if(breakGuard&&elitePair(attacker,victim))expose(s,victim,'guard_break',.66);
  const impact=injure(s,attacker,victim,spec,damage,blocked,punish,from);
  damage=impact.delta;
  recordDamage(s,attacker,victim,damage);
  if(!victim.alive&&damage===0)victim.contributors.push({id:attacker.id,time:s.time,damage:0});
  if(superiority<=-8&&!blocked&&damage>0)attacker.energy=Math.min(100,attacker.energy+Math.min(11,damage*.16));
  if(blocked){
    event(s,'block',victim,impactX,impactY,{targetId:attacker.id,damage,...origin,...impact.meta});
    confirmGuardRead(s,victim,attacker,impactX,impactY,'block');
  }
  else if(breakGuard)event(s,'break',attacker,impactX,impactY,{targetId:victim.id,damage,...origin,...impact.meta});
  if (!blocked) {
    rememberAttacker(s,victim,attacker,from);
    credit(s,attacker,moveIsForce?'forceHits':'saberHits');
    if(attacker.counterMove){
      credit(s,attacker,'counters');
      if((attacker.control||s.config.teamSizes[0]===s.config.teamSizes[1])&&attacker.riposteSerial!==attacker.attackSerial&&attacker.riposteTarget===victim.id){
        attacker.riposteSerial=attacker.attackSerial;credit(s,attacker,'ripostes');countMove(attacker,'landed_riposte');
        event(s,'riposte',attacker,impactX,impactY,{targetId:victim.id,damage,...origin,...impact.meta});
      }
    }
  }
  if(!closeGuard||victim.action==='stagger'){
    const composed=superiority>=6&&victim.energy>=2&&victim.action!=='stagger'&&!breakGuard;
    const launched=(attacker.attack==='uppercut'||spec.launch)&&!spec.isOffhand&&victim.alive&&!composed;
    const recoil=spec.recoil*(1-(.65+victim.rankCombat.stability*.10)*mastery);
    const knock=spec.knock*(1-.78*mastery)*(spec.forceAbility==='pull'?-.83:spec.forceAbility==='stasis'?.28:1);
    victim.kx+=Math.cos(angle)*knock;victim.ky+=Math.sin(angle)*knock;
    if(composed){
      victim.energy=Math.max(0,victim.energy-(2.4-mastery*1.3));
      credit(s,victim,'rankComposure');countMove(victim,'rank_composure');
      if(s.time-(victim.composureAt??-Infinity)>.30){
        victim.composureAt=s.time;event(s,'rank_composure',victim,impactX,impactY,{targetId:attacker.id,...origin});
      }
    }
    // Direct hits cancel telegraphs, not their residual knockback or display.
    if(victim.alive&&!composed){stagger(victim, Math.max(victim.action==='stagger'?victim.actionDuration-victim.actionTime:0, recoil));if(launched)startAir(victim,launchArc);}
    event(s,launched?'launch':'hit',attacker,impactX,impactY,{targetId:victim.id,damage,...origin,...impact.meta,...(braced?{pressureGraze:true}:{}),...(punish?{punish:true,punishReason}:{})});
    if(moveIsForce)event(s,spec.forceAbility==='pull'?'force_pull':'push',attacker,impactX,impactY,{targetId:victim.id,...origin});
  }
  if(!blocked&&elitePair(attacker,victim)){victim.lastEliteTouchAt=s.time;victim.lastEliteTouchBy=attacker.id;
    victim.lastEliteTouchFrom=from;}
  if(!victim.alive){setAction(victim,'ko',1);victim.attack=null;victim.combo=0;victim.buffer=null;const attribution=recordKnockout(s,victim);event(s,'ko',attacker,victim.x,victim.y,{targetId:victim.id,...origin,...impact.meta,...attribution});}
  return blocked?'block':'hit';
}
// Trace the attack line to each target separately: a wide cut can still
// reach an exposed opponent to one side. A raised vault can clear a grounded ally.
function allyInLane(s,f,x,y){
  const dx=x-f.x,dy=y-f.y,length=Math.hypot(dx,dy);
  if(length<1||(s.liveByTeam?.[f.team]??2)<2)return null;
  const nx=dx/length,ny=dy/length;
  let nearest=null,depth=length;
  for(const a of s.fighters){
    if(a===f||!a.alive||a.team!==f.team||Math.abs((a.airHeight??0)-(f.airHeight??0))>38)continue;
    const ax=a.x-f.x,ay=a.y-f.y,along=ax*nx+ay*ny;
    if(along<=4||along>=depth||Math.abs(ax*ny-ay*nx)>a.radius+3)continue;
    nearest=a;depth=along;
  }
  return nearest;
}
function alternateLane(s,f,enemy,blocker){
  const base=Math.atan2(blocker.y-enemy.y,blocker.x-enemy.x), preferred=f.slot%2===0?1:-1;
  const radius=91, {minX,maxX,minY,maxY}=s.bounds;
  let best=null,cost=Infinity;
  for(const n of [1,-1,2,-2,3,-3]){
    const angle=base+n*preferred*.69,x=enemy.x+radius*Math.cos(angle),y=enemy.y+radius*Math.sin(angle);
    if(x<minX||x>maxX||y<minY||y>maxY||!openAt(s,x,y,f.radius)||blockedBetween(s,x,y,enemy.x,enemy.y))continue;
    let score=Math.hypot(x-f.x,y-f.y)+(Math.abs(n)-1)*15+(n<0?13:0);
    if(blockedBetween(s,f.x,f.y,x,y,f.radius))score+=45;
    for(const ally of s.fighters)if(ally!==f&&ally.alive&&ally.team===f.team)
      score+=Math.max(0,55-Math.hypot(x-ally.x,y-ally.y))*1.8;
    if(score<cost){cost=score;best={x,y};}
  }
  return best;
}
function contactBlade(s,f,spec){
  if(f.action==='force')return spec;
  const rear=spec.blade==='rear';
  const reverse=f.gear.grip==='backhand';
  if(!rear&&!reverse&&f.gear.weapon!=='staff')return spec;
  const world=arcadeBladeWorld(f,sampleArcadeFighter(f,s.time));
  const bladeId=rear?'rear':spec.isOffhand?'off':'main';
  const segment=world.blades?.find(b=>b.id===bladeId)??(bladeId==='main'?world:world.offhand);
  if(!segment)return {...spec,unavailable:true};
  const dx=segment.tip.x-segment.hand.x,dy=segment.tip.y-segment.hand.y;
  const length=Math.hypot(dx,dy);
  if(length<8)return {...spec,unavailable:true};
  // The two-dimensional rig already foreshortens edge-on silhouettes. Use
  // wrist side as an arc bias rather than misreading screen height as depth.
  const turn=reverse?(spec.isOffhand?-1:1)*Math.min(.26,.12+Math.abs(dy)/length*.15):0;
  return {...spec,bladeTurn:turn,bladePointX:segment.tip.x,bladePointY:segment.tip.y};
}
// Gameplay depth envelope, not screen-space sprite overlap. Only a real
// difference in physical height can clear a low blade; Force and rising
// strikes still reach a visible flip when their horizontal line is valid.
export function arcadeContactHeight(attacker,target,spec={}){
  const difference=(target.airHeight??0)-(attacker.airHeight??0);
  if(attacker.action==='force')return Math.abs(difference)<=88;
  const blade=spec.blade;
  const travel=attacker.action;
  const airMove=ARCADE_TECHNIQUES[attacker.technique]?.air||attacker.attack==='vault';
  const raised=travel==='uppercut'||spec.launch===true;
  const low=travel==='sweep'&&!raised;
  const above=raised?71:airMove?62:low?31:travel==='rush'?46:49;
  const below=airMove?72:low?51:58;
  return difference<=(blade==='rear'?above-3:above)&&difference>=-below;
}
function contact(s,f,spec){
  if(spec.forceAbility==='ward'){
    f.wardUntil=s.time+1.15;f.wardCharges=1;
    event(s,'force_ward',f,undefined,undefined,{forceAbility:'ward'});
    return;
  }
  spec=contactBlade(s,f,spec);
  if(spec.unavailable)return;
  const rear=spec.blade==='rear',bladeAngle=f.face+(rear?Math.PI:spec.bladeTurn??0);
  // Resolve in spatial order to keep near bodies first and avoid an artificial stab through a crowd.
  const candidates=s.fighters.filter(o=>o.team!==f.team&&o.alive).map(o=>({o,dx:o.x-f.x,dy:o.y-f.y,d:Math.hypot(o.x-f.x,o.y-f.y)}))
    .filter(t=>t.d<=spec.reach+t.o.radius&&arcadeContactHeight(f,t.o,spec)&&!s.terrain.solids.some(r=>(f.action!=='force'||r.kind!=='barricade')&&crossed(f.x,f.y,t.o.x,t.o.y,r))&&Math.abs(angleDelta(Math.atan2(t.dy,t.dx),bladeAngle))<=spec.arc)
    .sort((a,b)=>a.d-b.d);
  const cap=rear?Math.min(3,spec.cap??2):Math.max(spec.cap??0,['sweep','wide_cut','force'].includes(f.attack)?3:f.attack==='slash3'||f.attack==='frenzy'||(f.formRules&&f.form==='shii_cho')?2:1,
    spec.rankSweep?f.rankCombat.crowdCap:1);
  let used=0, landed=false,parried=false,screened=null;
  const force=f.action==='force';
  const staff=f.gear.weapon==='staff'&&!force;
  if(staff)f.staffTouched??=new Set();
  for(const target of candidates){
    if(staff&&f.staffTouched.has(target.o.id))continue;
    const ally=allyInLane(s,f,target.o.x,target.o.y);
    if(ally){screened??=ally;continue;}
    const result=applyDamage(s,f,target.o,spec);
    if(staff&&result!=='evade')f.staffTouched.add(target.o.id);
    if(result==='hit')landed=true;
    if(result==='parry'){parried=true;break;}
    if(result!=='evade'&&++used===cap)break;
  }
  if(!used&&!landed&&!parried&&screened){
    credit(s,f,'allyBlocks');
    event(s,'ally_blocked',f,screened.x,screened.y,{targetId:screened.id,offhand:Boolean(spec.isOffhand),blade:spec.blade??(spec.isOffhand?'offhand':'primary')});
  }
  if(landed){
    if(!staff||!f.staffLanded)credit(s,f,force?'forceLanded':'saberLanded');
    if(staff)f.staffLanded=true;
    f.exposedUntil=0;f.exposedBy=null;
  }
  else if(!used&&!parried&&!spec.isOffhand&&s.fighters.some(e=>e.team!==f.team&&e.alive&&elitePair(f,e)&&Math.hypot(e.x-f.x,e.y-f.y)<=spec.reach+109)){
    const left=Math.max(0,f.actionDuration-f.actionTime);
    expose(s,f,'whiff',Math.min(.61,left+.18));credit(s,f,'whiffs');
  }
}
function rankTechnique(s,f,enemy,intent,crowd){
  if(!f.formRules)return null;
  const mirror=s.config.teamSizes[0]===s.config.teamSizes[1];
  const moves=arcadeMovesFor(f.form,f.career.gradeIndex,{tactical:mirror});
  const attempt=f.stats.saberSwings+f.stats.forceCasts+f.slot*3+f.team*2;
  const d=enemy?Math.hypot(enemy.x-f.x,enemy.y-f.y):0;
  const role=intent==='force'?'force':crowd>=2&&f.rankCombat.index>=11?'crowd':
    f.counterUntil>s.time&&f.rankCombat.index>=6?'counter':intent;
  let pool=moves.filter(m=>(role==='force'||m.role===role)&&(intent==='force'?m.mapAction==='force':m.mapAction!=='force')&&d<m.reach+(m.air?100:31)&&m.cost*.75<=f.energy&&(!m.tactical||f.rankDominance<5));
  if(!mirror){
    pool.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||b.minRank-a.minRank);
    return pool[0]?.id??null;
  }
  if(intent!=='force'&&pool.length<2&&role!=='counter'&&role!=='crowd')
    pool=[...pool,...moves.filter(m=>m.mapAction!=='force'&&m.role==='light'&&m.role!==role&&d<m.reach+26&&m.cost<=f.energy)];
  if(enemy&&f.rankCombat.index>=4&&pool.length>1){
    const line=Math.abs(angleDelta(Math.atan2(enemy.y-f.y,enemy.x-f.x),f.face));
    const bearing=Math.atan2(f.y-enemy.y,f.x-enemy.x);
    const side=angleDelta(bearing,enemy.guardBearing??enemy.face);
    const opposing=enemy.action==='guard',open=enemy.exposedUntil>s.time;
    const score=m=>{
      const margin=m.reach+(m.air?42:13)-d;
      if(margin< -25||line>m.arc+.28)return -100;
      const cutSide=Math.sign((m.motion?.finish??0)-(m.motion?.chamber??0));
      return (m.id===f.lastOpponentMove?-53:0)-(f.moves[m.id]??0)*.52+
        (margin<0?margin*.19:Math.min(30,margin)*.05)
        +(opposing?Math.sign(side)*cutSide*1.6+(m.tactical==='feint_redirect'?8:0):0)
        +(open&&m.contact<.28?3:0)+(m.air&&d<80?-5:0)+(m.tactical==='moving_guard'&&atk(enemy)?5:0);
    };
    pool=pool.map(m=>({m,score:score(m)})).filter(r=>r.score>-90).sort((a,b)=>b.score-a.score||b.m.minRank-a.m.minRank).map(r=>r.m);
  }else pool.sort((a,b)=>(f.moves[a.id]??0)-(f.moves[b.id]??0)||b.minRank-a.minRank);
  // Mix in a form's base strike if it's a real alternative, never just
  // repeat the same fallback slash indefinitely on the measured clock.
  if(s.elitePacing&&attempt%7===4&&f.lastOpponentMove!==(intent==='heavy'?profile(f).heavy:'slash'))return null;
  return pool[0]?.id??null;
}
function eliteLocalPressure(s,f){
  if(f.career.gradeIndex<12||(s.liveByTeam?.[1-f.team]??0)<2)return null;
  const threats=[];
  let support=0;
  for(const o of s.fighters){
    if(o===f||!o.alive)continue;
    const dx=o.x-f.x,dy=o.y-f.y,d2=dx*dx+dy*dy;
    if(o.team===f.team){
      if(d2<208**2&&o.action!=='stagger'&&!blockedBetween(s,f.x,f.y,o.x,o.y))support++;
      continue;
    }
    if(d2>268**2||!elitePair(f,o)||blockedBetween(s,f.x,f.y,o.x,o.y))continue;
    const d=Math.sqrt(d2),angle=Math.atan2(dy,dx),spec=atk(o);
    let time=Infinity;
    if(spec){
      for(const [hit,done,bearing] of [[spec,o.contact,o.face],[spec.offhand,o.offhandContact,o.face+(spec.offhand?.blade==='rear'?Math.PI:0)]]){
        if(!hit||done)continue;
        const release=hit.contact-o.actionTime;
        if(release<=0||release>.40||d>hit.reach+32||Math.abs(angleDelta(angle+Math.PI,bearing))>hit.arc+.22)continue;
        time=Math.min(time,release);
      }
    }
    threats.push({o,d,angle,time});
  }
  if(threats.length<2||threats.length<=support+1)return null;
  threats.sort((a,b)=>a.time-b.time||a.d-b.d);
  return {threats,imminent:threats.filter(t=>t.time<.24),closest:Math.min(...threats.map(t=>t.d))};
}
function pressureFootwork(s,f,info,heading){
  let best=null,high=-Infinity;
  for(const delta of [-1.15,1.15,-1.88,1.88,-2.47,2.47]){
    const direction=heading+delta,x=f.x+Math.cos(direction)*74,y=f.y+Math.sin(direction)*74;
    const b=s.bounds;
    if(x<b.minX+4||x>b.maxX-4||y<b.minY+4||y>b.maxY-4||blockedBetween(s,f.x,f.y,x,y,f.radius))continue;
    let score=-Math.abs(delta)*12,near=Infinity,inside=0;
    for(const t of info.threats){
      const distance=Math.hypot(x-t.o.x,y-t.o.y);near=Math.min(near,distance);
      inside+=distance<102?1:0;
      if(t.time<.28)score+=Math.min(137,distance)*.48;
      score+=Math.min(156,distance)*.18;
    }
    if(near<45)score-=95;else score-=inside*17;
    if(score>high){high=score;best=direction;}
  }
  return best;
}
function ai(s,f,enemy,dt){
  const objectiveMove=arcadeObjectiveMove(s,f);
  const commanded=s.mode==='command'&&f.team===0;
  const order=commanded?s.order:'push';
  const ordered=order==='hold'?(f.orderAnchor??f.spawn):order==='regroup'?f.spawn:order==='flank'?{
    x:s.width*.56,y:s.bounds.minY+42+Math.floor(f.slot/5)*32}:null;
  const hazard=f.rankDominance>=9&&!atk(f)?s.terrain.zones.find(z=>z.damagePerSecond>0&&inside(f.x,f.y,z)):null;
  let escape=null;
  if(hazard){
    const p=24, b=s.bounds;
    const options=[{x:hazard.x-p,y:f.y},{x:hazard.x+hazard.width+p,y:f.y},{x:f.x,y:hazard.y-p},{x:f.x,y:hazard.y+hazard.height+p}];
    escape=options.filter(pt=>pt.x>b.minX&&pt.x<b.maxX&&pt.y>b.minY&&pt.y<b.maxY&&openAt(s,pt.x,pt.y,f.radius)).sort((a,b)=>
      Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0]??null;
  }
  const destination=isArcadeCarrier(s,f)?objectiveMove:escape?{...escape,role:'escape'}:ordered??objectiveMove;
  if(!enemy){
    const goal=destination??{x:s.width*(f.team===0?.56:.44),y:s.height*.5+((f.slot%5)-2)*39};
    const near=Math.hypot(goal.x-f.x,goal.y-f.y), route=chooseRoute(s,f,goal);
    const angle=Math.atan2(route.y-f.y,route.x-f.x), speed=near<16?0:1;
    return {x:Math.cos(angle)*speed,y:Math.sin(angle)*speed,aim:angle};
  }
  const d=Math.hypot(enemy.x-f.x,enemy.y-f.y), aim=Math.atan2(enemy.y-f.y,enemy.x-f.x), def=profile(f);
  const rankAdvantage=rankGap(f,enemy);
  const scan=rankAdvantage!==0?(f.rankCombat.awareness-1)*2.5:0;
  const incoming=atk(enemy), threatened=incoming&&enemy.actionTime<incoming.contact&&d<incoming.reach+42+scan&&Math.abs(angleDelta(enemy.face,aim+Math.PI))<incoming.arc+.16;
  const difficulty=f.team===1?s.pressure:0;
  const distanceToGoal=destination?Math.hypot(destination.x-f.x,destination.y-f.y):Infinity;
  const follow=destination&&(destination.role==='escape'||order==='regroup'||order==='hold'||(!((d<145)&&order==='push')&&distanceToGoal>16));
  const allyScreen=!follow&&d<300?allyInLane(s,f,enemy.x,enemy.y):null;
  const lane=allyScreen&&!atk(f)?alternateLane(s,f,enemy,allyScreen):null;
  const path=chooseRoute(s,f,follow?destination:lane??enemy), obstructed=Boolean(blockedBetween(s,f.x,f.y,enemy.x,enemy.y));
  const detour=path!==enemy&&!follow;
  const travelAim=path===enemy?aim:Math.atan2(path.y-f.y,path.x-f.x);
  const settledForRead=!f.attack&&f.actionDuration===0&&f.airPhase==='grounded';
  if(f.heroId){
    const change=observeHeroPlan(f,enemy,s.time,dt,d<222&&!obstructed&&!follow,settledForRead);
    if(change){countMove(f,'hero_plan_'+change.plan);event(s,'hero_plan',f,undefined,undefined,change);}
  }
  const doctrine=f.heroPlan??f.heroDoctrine??s.config.doctrines[f.team];
  const aligned=Math.abs(angleDelta(aim,f.face))<.72;
  const turningToHit=f.awarenessFacing&&Math.abs(angleDelta(aim,f.face))>.82;
  const untilContact=threatened?incoming.contact-enemy.actionTime:Infinity;
  const urgent=untilContact<.16&&untilContact>0;
  const elite=elitePair(f,enemy)&&!follow&&!obstructed&&order==='push';
  f.eliteEngaged=elite;
  f.eliteRankEdge=elite&&!s.elitePacing?clamp(rankAdvantage,-2,2):0;
  const ready=!atk(f)&&f.action!=='dash'&&f.action!=='stagger'&&f.action!=='clash';
  const crowd=rankAdvantage>=5&&f.rankCombat.index>=8?s.fighters.reduce((n,x)=>n+(x.alive&&x.team!==f.team&&
    rankGap(f,x)>=5&&Math.hypot(x.x-f.x,x.y-f.y)<180),0):0;
  const local=elite&&!isArcadeCarrier(s,f)?eliteLocalPressure(s,f):null;
  const crossingElite=s.eliteCrossfire&&elite;
  const isolated=crossingElite&&s.config.teamSizes[f.team]===1&&(local?.threats.length??0)>=2;
  const attackerGroup=crossingElite&&s.config.teamSizes[f.team]>=3&&s.liveByTeam[f.team]>=2;
  f.crossfire=Boolean(isolated);
  const danger=local?.imminent[0];
  f.localRead=Boolean(local&&local.closest<169);
  const opening=elite&&!danger&&!allyScreen&&ready&&aligned&&enemy.exposedUntil>s.time+.18&&d<106&&f.energy>=13;
  let plannedBlock=false, plannedDodge=false;
  if(elite&&ready&&!danger&&urgent&&f.action!=='guard'&&f.energy>=12&&f.reactedTo!==enemy.attackSerial){
    const favorGuard=def.guardAI??.45;
    const canDash=f.energy>27&&!isArcadeCarrier(s,f);
    // A read can be wrong; current direction, gas and one reaction per committed move matter.
    if(untilContact<=.10||(!canDash&&untilContact<=.15)){
      f.reactedTo=enemy.attackSerial;
      const read=rng(s);
      const heroParryBias=f.heroPlan==='defensive'?.09:f.heroPlan==='aggressive'?-.06:0;
      const blockGate=.28+.40*favorGuard+f.eliteRankEdge*.08+heroParryBias;
      if(enemy.action!=='force'&&read<blockGate){
        f.decision='guard';f.guardUntil=s.time+.26;plannedBlock=true;
      }else if(canDash&&read<.73){
        plannedDodge=true;
      }
    }
  }
  f.think-=dt;
  const peerSwarm=elite&&!s.elitePacing&&s.config.teamSizes[f.team]>s.config.teamSizes[enemy.team]&&
    s.liveByTeam[f.team]>s.liveByTeam[enemy.team];
  // Nearby teammates read the actual committed release. Those sharing its
  // lane circle into available space instead of stepping into the same hit.
  const partnerRelease=attackerGroup?s.fighters.find(a=>{
    const move=atk(a);
    if(a===f||!a.alive||a.team!==f.team||!move||a.contact)return false;
    const x=enemy.x-a.x,y=enemy.y-a.y;
    const t=move.contact-a.actionTime;
    return t>0&&t<0.41&&x*x+y*y<(move.reach+48)**2&&Math.abs(angleDelta(Math.atan2(y,x),a.face))<move.arc+.18;
  }):null;
  const laneSeparation=partnerRelease?Math.abs(angleDelta(Math.atan2(partnerRelease.y-enemy.y,partnerRelease.x-enemy.x),aim+Math.PI)):Math.PI;
  const forming=Boolean(partnerRelease&&laneSeparation<2.8);
  const partnerLanding=attackerGroup&&enemy.action==='stagger'&&enemy.actionTime<.115&&d>70;
  // A follow-up from the same side should not cross the previous attacker's
  // recovery path. The opening remains available from a distinct flank.
  const coveringAfter=attackerGroup&&enemy.lastEliteTouchBy!==f.id&&s.time-(enemy.lastEliteTouchAt??-Infinity)<1.25&&
    Math.abs(angleDelta(enemy.lastEliteTouchFrom,aim+Math.PI))<3.14;
  const peerForceClear=!peerSwarm||s.fighters.every(ally=>ally===f||!ally.alive||ally.team!==f.team||
    Math.abs(ally.x-enemy.x)>230||Math.abs(ally.y-enemy.y)>230||s.time-(ally.lastForceAt??-Infinity)>2.7);
  const measuredForceReady=peerForceClear&&(!s.elitePacing||s.time-(f.lastForceAt??-Infinity)>4);
  let strike=false,heavy=false,roll=false,force=false,feint=false,guardAim=null;
  const tacticalRoster=f.formRules&&s.config.teamSizes[0]===s.config.teamSizes[1];
  const matchedPeer=tacticalRoster&&Math.abs(rankAdvantage)<=3;
  const peerTactics=(tacticalRoster||Boolean(f.heroId))&&f.career.gradeIndex>=4&&rankAdvantage<5&&!follow&&!obstructed;
  const defensiveReading=peerTactics&&ready&&threatened&&incoming&&untilContact<.16&&d<132;
  if(defensiveReading&&f.action==='guard')guardAim=aim+Math.sign(angleDelta(enemy.face,aim+Math.PI))*.25;
  if(peerTactics&&ready&&enemy.action==='feint'&&d<137&&enemy.actionTime>=.105&&f.readFeint!==enemy.id+'/'+enemy.feintSerial){
    f.readFeint=enemy.id+'/'+enemy.feintSerial;
    // Less trained fighters cover the presented strike more readily. A
    // patient foe can wait it out; no forced stagger or false block.
    if((f.career.gradeIndex<9||f.energy<30)&&f.energy>11){
      f.decision='guard';f.guardUntil=s.time+.32;guardAim=aim+Math.sign(angleDelta(enemy.feintBearing??enemy.face,aim+Math.PI))*.44;
      f.baitBearing=guardAim;f.baitUntil=f.guardUntil;
    }
  }
  if(f.baitUntil>s.time&&f.decision==='guard'&&!urgent)guardAim=f.baitBearing;
  if(f.think<=0){
    f.think=(def.wind+.048+rng(s)*.15-difficulty*.047)*(1-.28*f.skill.skill)*(1-(rankAdvantage!==0?f.rankCombat.initiative*.40:0));
    if(!elite&&rankAdvantage<5&&urgent&&f.energy>13&&f.action!=='dash'&&f.action!=='guard'){
      const rating=rng(s), preference=(def.guardAI??(f.archetype==='warden'?.69:f.archetype==='duelist'?.34:.47))+difficulty*.11+f.skill.skill*.076+(doctrine==='defensive'?.18:doctrine==='aggressive'?-.14:0);
      if(rating<preference){ f.decision='guard'; f.guardUntil=s.time+.23+rng(s)*.14; }
      else if(rating<preference+.26 && f.energy>27)roll=true;
    }
    if(f.guardUntil<=s.time||!f.guardUntil) f.decision=null;
    const current=atk(f);
    // Less trained peers no longer queue a fresh strike on every think tick.
    // Keep Juyo's clean combo, and let genuinely exposed targets invite a follow-up.
    const canChain=current&&f.contact&&f.actionTime>current.contact+.11&&
      ((f.form==='juyo'&&f.combo>0&&f.combo<3)||enemy.exposedUntil>s.time+.19)&&f.energy>27;
    const canCommit=elite||!matchedPeer||!current||canChain;
    if(canCommit&&!obstructed&&!allyScreen&&order!=='regroup'&&destination?.role!=='escape'&&f.decision!=='guard'&&!roll&&f.guardLock<=0&&(aligned||atk(f))&&(!elite||(ready&&!urgent&&(f.eliteReady??0)<=s.time))){
      const nearby=s.fighters.filter(e=>e.team!==f.team&&e.alive&&Math.hypot(e.x-f.x,e.y-f.y)<146).length;
      if(!s.config.saberOnly&&measuredForceReady&&f.loadoutChosen&&d>120&&d<180&&f.energy>67&&rng(s)<.34)force=true;
      else if((f.formRules?['makashi','ataru','niman'].includes(f.form):f.archetype==='duelist')&&d>130&&d<(f.form==='niman'?182:230)&&(f.form!=='niman'||measuredForceReady)&&f.energy>34&&rng(s)<.68)heavy=true;
      else if(d<=def.pressure+12+(f.saberPhase==='long'?16:0)){
        const roleChance={vanguard:nearby>1?.86:.57,warden:enemy.action==='stagger'?.86:.52,duelist:.22};
        const byForm={shii_cho:nearby>1?.91:.42, makashi:.31, soresu:urgent?.75:.14, ataru:.50, djem_so:f.counterUntil>s.time?.93:.40, niman:measuredForceReady?.44:0, juyo:.32};
        const heavyChance=f.formRules?byForm[f.form]:roleChance[f.archetype];
        heavy=f.energy>32&&rng(s)<heavyChance;
        strike=!heavy;
      }
    }
  }
  if(elite){
    if(plannedDodge){roll=true;strike=false;heavy=false;force=false;}
    else if(opening&&!plannedBlock&&!urgent){
      f.decision=null;strike=true;heavy=false;force=false;
    }
  }
  if(!elite&&crowd>=2&&ready&&!obstructed&&!allyScreen&&!follow&&aligned&&f.energy>=24&&d<144){
    f.decision=null;strike=false;heavy=true;roll=false;force=false;
  }
  if(f.rankDominance>=10&&ready&&!obstructed&&!allyScreen&&!follow&&aligned&&d<112&&f.energy>=15&&f.decision!=='guard'){
    strike=!heavy;force=false;
  }
  if((forming||partnerLanding||coveringAfter)&&ready){strike=false;heavy=false;force=false;}
  // Cadence comes from reading the opponent, not cycling animation names:
  // a shielded rival invites a bait or another angle; exposed targets invite
  // a timed counter; unsafe committed attacks discourage an immediate swing.
  if(!elite&&matchedPeer&&ready&&threatened&&untilContact<.22&&f.energy>15&&enemy.action!=='force'){
    // Facing a real moving blade takes priority over a fresh attack. This
    // isn't a guaranteed parry; holding too early still drains stamina.
    if((def.guardAI??.4)>=.44&&f.reactedTo!==enemy.attackSerial){
      f.reactedTo=enemy.attackSerial;f.decision='guard';f.guardUntil=s.time+.25;
      strike=false;heavy=false;force=false;
      if(peerTactics)guardAim=aim+Math.sign(angleDelta(enemy.face,aim+Math.PI))*.28;
    }
  }
  if(f.heroPlan==='defensive'&&rankAdvantage<5&&ready&&urgent&&aligned&&f.energy>12&&enemy.action!=='force'&&
     f.guardLock<=0){
    strike=false;heavy=false;force=false;f.decision='guard';f.guardUntil=s.time+.24;guardAim=aim;
  }
  if(peerTactics&&ready&&(strike||heavy)&&!force&&f.energy>26&&enemy.action==='guard'&&d>=63&&d<139&&
     (f.feintReadyAt??0)<=s.time&&(f.heroPlan==='aggressive'||(f.stats.saberSwings+f.slot+f.team)%3===1)){
    strike=false;heavy=false;feint=true;
  }
  let defensiveAim=null, guardingLane=null, slip=null, pressureGuard=false, pressureRecover=false;
  if(local){
    // Reading the attack in front is insufficient when a second live blade is
    // near release. Face the earlier commitment or leave the crossing arcs.
    if(danger&&ready&&danger.time<.22&&danger.d<160){strike=false;heavy=false;force=false;}
    const bearing=danger?.angle??aim;
    const split=local.imminent.some(t=>Math.abs(angleDelta(t.angle,bearing))>1.28);
    const soon=danger&&danger.time<.19;
    const readyToRecover=f.action==='stagger'&&f.actionDuration-f.actionTime<.15&&f.actionTime>.13&&f.airPhase!=='airborne'&&f.energy>=24&&(f.pressureRecoverAt??0)<s.time;
    const receding=atk(f),canSlipAfterRelease=receding&&f.contact&&f.actionTime>=receding.duration*.72&&
      f.actionTime>Math.max(receding.contact+(f.formRules?.115:.065),(receding.offhand?.contact??0)+.038)&&f.airPhase!=='airborne';
    const canRespond=ready&&f.actionDuration===0||readyToRecover||canSlipAfterRelease;
    if(soon&&canRespond&&f.guardLock===0){
      defensiveAim=bearing;
      const separated=local.threats.some(t=>Math.abs(angleDelta(t.angle,bearing))>1.50&&t.d<167);
      if((!isolated||danger.time<0.095)&&(canSlipAfterRelease||split||danger.o.action==='force'||separated&&f.energy>(isolated?30:45))&&f.energy>(isolated?25:32))
        slip=pressureFootwork(s,f,local,bearing);
      if(slip===null&&!canSlipAfterRelease&&f.energy>=11&&danger.o.action!=='force'){
        pressureGuard=true;
        if(isolated&&f.energy>14&&f.airPhase!=='airborne')guardingLane=pressureFootwork(s,f,local,bearing);
        f.decision=null;
      }
      if(slip!==null||pressureGuard){
        if(readyToRecover)pressureRecover=true;
        strike=false;heavy=false;force=false;roll=slip!==null;
      }
    }else if(ready&&local.closest<145&&!opening&&local.threats.some(t=>Math.abs(angleDelta(t.angle,aim))>1.15&&t.d<169)){
      // In a crossfire, don't throw a blind long heavy and hand both rivals a
      // free hit. Take the open lane or bank a quick strike if already close.
      if(d<95&&f.energy>20&&heavy&&local.imminent.length===0){strike=true;heavy=false;}
      if(!strike&&!force){
        const lane=pressureFootwork(s,f,local,aim);
        if(lane!==null){defensiveAim=lane;heavy=false;}
      }
    }
  }
  const technique=(strike||heavy||force)&&ready?rankTechnique(s,f,enemy,force?'force':heavy?'heavy':'light',crowd):null;
  let strikeAim=aim;
  if(technique&&ARCADE_TECHNIQUES[technique]?.role==='crowd'){
    let dx=0,dy=0;
    for(const e of s.fighters)if(e.alive&&e.team!==f.team){
      const d=Math.hypot(e.x-f.x,e.y-f.y), toward=Math.atan2(e.y-f.y,e.x-f.x);
      if(d<158&&Math.abs(angleDelta(toward,aim))<1.1){dx+=Math.cos(toward);dy+=Math.sin(toward);}
    }
    if(dx||dy)strikeAim=Math.atan2(dy,dx);
  }
  const orbit=(def.orbit??(f.archetype==='duelist'?1:f.archetype==='warden'?.74:.39))*(f.slot%2===0?1:-1);
  const pocket=f.formRules?(f.form==='makashi'?91:f.form==='niman'?s.elitePacing?87:108:f.form==='soresu'?64:f.form==='juyo'?60:74):74;
  const ideal=pocket+(doctrine==='defensive'?f.heroId?23:17:doctrine==='aggressive'?-15:0)+(elite?9:crowd>=2?-15:0);
  const advance=guardingLane!==null?.55:forming&&d<153?-.1:local&&local.closest<125&&!strike&&!force&&!heavy&&!follow&&!obstructed?-.18:allyScreen&&!lane&&!follow&&!obstructed?.04:follow?(distanceToGoal<18?0:1):detour||obstructed?1:urgent&&rankAdvantage<6&&!strike&&!heavy?-.42:d>def.pressure+10?1:d<ideal-22?-.33:clamp((d-ideal)/34,-.28,.56);
  if(turningToHit&&!danger){
    // Awareness can turn or step, but cannot snap into a new rear guard
    // or a counter before the feet and weapon catch up.
    strike=false;heavy=false;force=false;feint=false;roll=false;pressureGuard=false;
    f.decision=null;guardAim=null;
  }
  if(feint&&(pressureGuard||roll||danger))feint=false;
  if((plannedBlock||pressureGuard)&&guardAim===null&&(peerTactics||isolated))
    guardAim=defensiveAim??aim;
  const evade=roll&&!s.elitePacing&&f.rankCombat.index>=3?
    (f.form==='makashi'||f.form==='soresu'||f.form==='djem_so'?'backstep':'sidestep'):null;
  const angle=guardingLane??slip??(travelAim+(roll?Math.sign(orbit)*(elite?2.0:evade==='backstep'?2.67:1.52):0));
  const strafe=guardingLane!==null?0:obstructed||follow||detour?0:forming?Math.sign(orbit)*.68:d>185?.10:orbit*(urgent?.70:d>ideal+22?.14:.24);
  // Rare lateral vault in squad Watch: replace an already selected dodge,
  // never generate a free evade or perturb duel/tournament RNG.
  const wantsVault=roll&&ready&&f.actionDuration===0&&f.action!=='guard'&&f.decision!=='guard'&&
    s.mode==='watch'&&!s.elitePacing&&!s.eliteCrossfire&&s.config.teamSizes.every(n=>n>=2)&&
    f.formRules&&f.form!=='ataru'&&f.rankCombat.index>=4&&f.energy>=33&&!f.aiVaultUsed&&s.time>(f.jumpReadyAt??0)&&
    !obstructed&&!allyScreen&&!follow&&incoming&&incoming.arc>=1.08&&d>=incoming.reach*.63&&
    (enemy.attackSerial+f.slot*31+f.team*7)%4===0;
  let vaultExit=false;
  if(wantsVault){
    const tx=f.x+Math.cos(angle)*61,ty=f.y+Math.sin(angle)*61;
    const clear=tx>=s.bounds.minX&&tx<=s.bounds.maxX&&ty>=s.bounds.minY&&ty<=s.bounds.maxY&&
      !blockedBetween(s,f.x,f.y,tx,ty,f.radius)&&!allyInLane(s,f,tx,ty);
    vaultExit=Boolean(clear);
  }
  if(defensiveAim!==null&&slip===null&&!pressureGuard&&!obstructed&&!follow)
    return {x:Math.cos(defensiveAim)*.73,y:Math.sin(defensiveAim)*.73,aim};
  return {x:Math.cos(angle)*advance-Math.sin(angle)*strafe,
    y:Math.sin(angle)*advance+Math.cos(angle)*strafe,strike,heavy,force,feint,technique,guardAim,evasion:evade,jump:vaultExit,dash:!vaultExit&&roll&&(!obstructed&&!allyScreen&&!follow||slip!==null),pressureRecover,guard:pressureGuard||f.decision==='guard'&&(order!=='regroup'&&destination?.role!=='escape'),rollFace:angle,aim:defensiveAim??(obstructed||follow||detour?travelAim:strikeAim)};
}
function actionStep(s,f,dt,commands,enemy){
  f.invuln=Math.max(0,f.invuln-dt);f.parryTime=Math.max(0,f.parryTime-dt);
  f.guardLock=Math.max(0,f.guardLock-dt);
  if(f.buffer&&s.time>f.buffer.until) f.buffer=null;
  const vecX=clamp(Number.isFinite(commands.x)?commands.x:0,-1,1),vecY=clamp(Number.isFinite(commands.y)?commands.y:0,-1,1);
  const mag=Math.hypot(vecX,vecY), moveX=vecX/Math.max(1,mag),moveY=vecY/Math.max(1,mag);
  const manualAim=Number.isFinite(commands.aimX)&&Number.isFinite(commands.aimY)&&Math.hypot(commands.aimX-f.x,commands.aimY-f.y)>.1;
  const force=commands.force&&!s.config.saberOnly;
  const selected=f.control&&commands.technique?ARCADE_TECHNIQUES[commands.technique]:null;
  const explicit=selected?.form===f.form&&selected.minRank<=f.career.gradeIndex?selected.id:null;
  const request=explicit?(selected.mapAction==='force'&&s.config.saberOnly?null:explicit):force?'force':commands.heavy?'heavy':commands.strike?'strike':null;
  const offense=request||commands.guard;
  const aim=manualAim?Math.atan2(commands.aimY-f.y,commands.aimX-f.x)
    : Number.isFinite(commands.aim)?commands.aim
    : enemy&&offense?Math.atan2(enemy.y-f.y,enemy.x-f.x)
    : mag>.07?Math.atan2(moveY,moveX)
    : enemy?Math.atan2(enemy.y-f.y,enemy.x-f.x):f.face;
  if(!f.alive){
    f.actionTime=Math.min(f.actionDuration,f.actionTime+dt);f.vx=0;f.vy=0;return;
  }
  const def=profile(f);
  if(commands.phase&&!commands.guard){
    changeSaberPhase(s,f,f.saberPhase==='long'?'short':'long');
  }else if(!f.control&&enemy&&f.gear.dualPhase&&!commands.guard&&!request&&!commands.dash){
    const distance=Math.hypot(enemy.x-f.x,enemy.y-f.y),pressure=profile(f).pressure;
    if(f.saberPhase==='short'&&f.energy>=43&&distance>pressure+11&&distance<pressure+111&&!blockedBetween(s,f.x,f.y,enemy.x,enemy.y))
      changeSaberPhase(s,f,'long');
    else if(f.saberPhase==='long'&&(distance<pressure*.66||f.energy<31))changeSaberPhase(s,f,'short');
  }
  const moving=mag>.08;
  const walking=f.formRules&&moving&&(commands.walk||mag<.67);
  if(commands.pressureRecover&&!f.control&&f.action==='stagger'){
    f.energy-=8;f.pressureRecoverAt=s.time+.90;
    countMove(f,'pressure_recover');setAction(f,'idle');
  }
  if(commands.feint){
    const combat=Number.isFinite(commands.aim)?commands.aim:aim;
    const fake=f.control?combat:combat+(f.slot%2===0?.34:-.34);
    if(beginFeint(s,f,fake,f.control?null:'slash',f.control?null:combat)){
      f.vx*=.4;f.vy*=.4;
    }
  }
  let attacking=atk(f);
  const dashAngle=Number.isFinite(commands.rollFace)?commands.rollFace:mag>.07?Math.atan2(moveY,moveX):aim;
  if(f.action==='feint'){
    if(request)f.buffer={type:request,until:s.time+.39};
    if(f.actionTime>=f.actionDuration*.66){
      const queued=f.buffer?.type;
      const follow=queued?(ARCADE_TECHNIQUES[queued]?queued:queued==='heavy'?def.heavy:queued==='force'?'force':'slash'):f.feintFollowup;
      if(follow){
        if(attack(s,f,follow,queued?aim:f.feintRedirect??aim,{redirected:true})){
          f.feintFollowup=null;f.feintRedirect=null;
        }
      }
    }
  }else if(f.action==='dash'){
    // Let an input during the dash queue a real attack as its invulnerability ends.
    if(request) f.buffer={type:request,until:s.time+.32};
    if(f.actionTime>=(f.formRules?f.actionDuration*.78:.132)&&f.airPhase!=='airborne'&&f.buffer){
      const followup=ARCADE_TECHNIQUES[f.buffer.type]?f.buffer.type:f.buffer.type==='force'?'force':f.buffer.type==='heavy'?def.heavy:'slash';
      attack(s,f,followup,aim);
    }
  } else if(attacking){
    if(request) f.buffer={type:request,until:s.time+(f.formRules?.59:.39)};
    const canCancel=f.actionTime>Math.max(attacking.contact+(f.formRules?.115:.065),(attacking.offhand?.contact??0)+.038)&&f.airPhase!=='airborne';
    if(canCancel&&commands.dash) dash(s,f,dashAngle,commands.evasion);
    else if(canCancel&&f.buffer?.type==='strike'&&f.combo>0&&f.combo<(def.comboCap??3)&&f.actionTime>=attacking.duration*(f.formRules?(f.form==='juyo'?.72:.82):.68)){
      attack(s,f,'slash'+(f.combo+1),aim);
    } else if(canCancel&&(['heavy','force'].includes(f.buffer?.type)||ARCADE_TECHNIQUES[f.buffer?.type])&&f.actionTime>=attacking.duration*(f.formRules?.85:.76)&&f.combo>0){
      attack(s,f,ARCADE_TECHNIQUES[f.buffer.type]?f.buffer.type:f.buffer.type==='force'?'force':def.heavy,aim);
    }
  } else if(f.actionDuration===0&&f.action!=='stagger'&&f.airPhase!=='airborne'){
    if(commands.jump&&!commands.guard&&jump(s,f,dashAngle,!f.control||mag>.08)&&!f.control)f.aiVaultUsed=true;
    if(f.actionDuration===0&&commands.dash)dash(s,f,dashAngle,commands.evasion);
    if(f.actionDuration===0&&(explicit||ARCADE_TECHNIQUES[f.buffer?.type]))attack(s,f,explicit??f.buffer.type,aim);
    if(f.actionDuration===0&&(force||f.buffer?.type==='force'))attack(s,f,commands.technique??'force',aim);
    const nearbyLower=f.control&&f.rankDominance>=8?s.fighters.filter(e=>e.team!==f.team&&e.alive&&Math.hypot(e.x-f.x,e.y-f.y)<166).length:0;
    if(f.actionDuration===0&&(commands.heavy||f.buffer?.type==='heavy'))attack(s,f,commands.technique??
      (nearbyLower>=2?rankTechnique(s,f,enemy,'heavy',nearbyLower):null)??def.heavy,aim);
    if(f.actionDuration===0&&(commands.strike||f.buffer?.type==='strike')){
      const parryFollow=f.parryCounterUntil>s.time&&enemy?.id===f.counterTarget&&
        Math.hypot(enemy.x-f.x,enemy.y-f.y)<130&&(f.control||f.career.gradeIndex>=6&&s.config.teamSizes[0]===s.config.teamSizes[1]);
      attack(s,f,commands.technique??(parryFollow?'riposte':'slash'),aim);
    }
    if(f.actionDuration===0){
      if(commands.guard&&f.guardLock===0&&f.energy>.1){
        const bearing=Number.isFinite(commands.guardAim)?commands.guardAim:aim;
        const relative=enemy?angleDelta(bearing,Math.atan2(enemy.y-f.y,enemy.x-f.x)):0;
        f.guardLane=relative<-.24?'left':relative>.24?'right':'center';
        f.guardDirected=Boolean(manualAim||Number.isFinite(commands.guardAim));
        if(f.action!=='guard'&&!f.guardHeld){
          countMove(f,'guard');f.parryTime=(def.parry??(f.archetype==='warden'?.205:.155))+f.skill.skill*.055;f.face=bearing;f.guardBearing=bearing;
        }else f.guardBearing=blendAngle(f.guardBearing??f.face,bearing,Math.min(1,dt*16*f.injuryEffects.turnSpeed));
        f.guardRead=f.parryTime>0?'ready':'held';
        setAction(f,'guard');
        f.energy=Math.max(0,f.energy-dt*7*(def.guardCost??1)*(1-.26*f.skill.skill)*(f.rankDominance!==0?f.rankCombat.holdEfficiency:1));
      }else {f.guardRead=null;setAction(f,moving?(walking?'walk':'run'):'idle');}
      f.face=blendAngle(f.face,f.action==='guard'?f.guardBearing:aim,Math.min(1,dt*(f.awarenessFacing?10:16)*f.injuryEffects.turnSpeed));
    }
  } else if(f.action==='stagger'&&request){
    f.buffer={type:request,until:s.time+.22};
  }
  if(f.rankDominance>=9&&f.action!=='ko')f.energy=Math.min(100,f.energy+dt*(12+masteryRatio(f.rankDominance)*17));
  f.guardHeld=Boolean(commands.guard);
  f.actionTime+=dt;
  attacking=atk(f);
  if(f.action==='jump'){
    const arc=f.airArc;
    const drive=f.jumpDrive??0;
    let speed=0;
    if(arc&&f.airPhase==='takeoff')speed=drive*(.10+.30*f.airProgress);
    else if(arc&&f.airPhase==='airborne')speed=drive*(.64+.36*Math.sin(Math.PI*f.airProgress));
    else if(arc&&f.airPhase==='landing')speed=drive*.34*(1-f.airProgress);
    f.vx=Math.cos(f.jumpBearing)*speed;f.vy=Math.sin(f.jumpBearing)*speed;
  } else if(f.action==='dash'){
    const p=clamp(f.actionTime/f.actionDuration,0,1);
    const burst=f.formRules?(f.technique==='vault_step'?
      f.airPhase==='airborne'?337:f.airPhase==='takeoff'?75:54:
      448*Math.sin(Math.PI*(.13+.87*p))) : 585*(1-.52*p);
    f.vx=Math.cos(f.face)*burst;f.vy=Math.sin(f.face)*burst;
  } else if(attacking){
    const elapsed=f.actionTime;
    const phase=clamp((elapsed-.028)/Math.max(.045,attacking.contact-.028),0,1);
    let burst=elapsed<=attacking.contact?attacking.lunge*Math.sin(phase*Math.PI*.83):attacking.lunge*.46*Math.max(0,1-(elapsed-attacking.contact)/.10);
    if(f.formRules){
      const plant=clamp((elapsed-(attacking.contact-.12))/.25,0,1);
      burst=f.technique==='vault'||ARCADE_TECHNIQUES[f.technique]?.air?(f.airPhase==='airborne'?attacking.lunge:f.airPhase==='takeoff'?61:36)
        :attacking.lunge*Math.sin(Math.PI*plant)**2;
    }
    f.vx=Math.cos(f.face)*burst;f.vy=Math.sin(f.face)*burst;
    if(f.stepUntil>s.time){
      f.vx+=Math.cos(f.stepBearing)*71;f.vy+=Math.sin(f.stepBearing)*71;
    }
  } else if(f.action==='stagger'||f.action==='clash'||f.action==='feint'||f.airPhase==='airborne'){f.vx=0;f.vy=0;}
  else{
    const speed=def.speed*(f.action==='guard'?(f.crossfire?.54:.30):walking?.49:1);
    const cx=walking?moveX/mag:moveX,cy=walking?moveY/mag:moveY;
    const acceleration=f.formRules?(moving?10:18):17;
    f.vx+= (cx*speed-f.vx)*Math.min(1,dt*acceleration);
    f.vy+= (cy*speed-f.vy)*Math.min(1,dt*acceleration);
    if(f.action!=='guard'){
      const foesNeedMore=f.rankDominance>=4;
      f.energy=Math.min(100,f.energy+dt*(f.action==='idle'?26:20)*(foesNeedMore?f.rankCombat.staminaRecovery:f.crossfire&&moving?1.28:1));
    }
  }
}
const canSlide=(s,f,x,y,tx,ty)=>{
  if(openAt(s,tx,ty,f.radius) && !blockedBetween(s,x,y,tx,ty,f.radius-.1))return true;
  // If externally placed inside cover, permit an exit only to a clear point.
  return !openAt(s,x,y,f.radius-.1)&&openAt(s,tx,ty,f.radius);
};
// Sweep the ground-plane body disk through the entire step. Feet keep
// a landing footprint during vaults; short jumps cannot merge silhouettes.
function bodyMotionFraction(s,f,x,y,tx,ty){
  if(!f.alive)return 1;
  const dx=tx-x,dy=ty-y,len2=dx*dx+dy*dy;
  if(len2<1e-12)return 1;
  let portion=1;
  for(const o of s.fighters){
    if(o===f||!o.alive)continue;
    const ax=x-o.x,ay=y-o.y,r=f.radius+o.radius;
    if(Math.abs(ax)>r+Math.abs(dx)||Math.abs(ay)>r+Math.abs(dy))continue;
    const dot=ax*dx+ay*dy;
    if(dot>=0)continue;
    const c=ax*ax+ay*ay-r*r;
    if(c<=0)return 0;
    const discr=dot*dot-len2*c;
    if(discr<=0)continue;
    const entry=(-dot-Math.sqrt(discr))/len2;
    if(entry<portion)portion=Math.max(0,entry-1e-5);
  }
  return portion;
}
const during = (s,f,dt)=>{
  const ox=f.x,oy=f.y;
  const {minX,maxX,minY,maxY}=s.bounds;
  const zone=s.terrain.zones.find(r=>inside(f.x,f.y,r));
  const raw=zone?.moveCost, speedScale=Number.isFinite(raw)?raw>.99?1/clamp(raw,1,5):clamp(raw,.2,1):1;
  const ease=f.injuryEffects.moveSpeed*(f.stasisUntil>s.time?.42:1)*carrierSpeedScale(s,f)*(f.action==='dash'?s.weather.dashMultiplier:s.weather.walkMultiplier);
  const tx=clamp(ox+(f.vx*speedScale*ease+f.kx)*dt,minX,maxX);
  const ty=clamp(oy+(f.vy*speedScale*ease+f.ky)*dt,minY,maxY);
  if(canSlide(s,f,f.x,f.y,tx,f.y)){
    const move=bodyMotionFraction(s,f,f.x,f.y,tx,f.y);
    f.x+=(tx-f.x)*move;if(move<1)f.kx=0;
  }else f.kx=0;
  if(canSlide(s,f,f.x,f.y,f.x,ty)){
    const move=bodyMotionFraction(s,f,f.x,f.y,f.x,ty);
    f.y+=(ty-f.y)*move;if(move<1)f.ky=0;
  }else f.ky=0;
  f.kx*=Math.max(0,1-dt*12);f.ky*=Math.max(0,1-dt*12);
  const travel=Math.hypot(f.x-ox,f.y-oy);
  f.groundSpeed=f.airPhase==='airborne'?0:travel/dt;
  if(f.airPhase!=='airborne')f.groundDistance+=travel;
  if(f.alive && f.airHeight<18 && Number.isFinite(zone?.damagePerSecond) && zone.damagePerSecond>0) {
    f.hazardDamage=(f.hazardDamage??0)+zone.damagePerSecond*dt;
    if(f.hazardDamage>=7) {
      const damage=Math.floor(f.hazardDamage);f.hazardDamage-=damage;
      const region=f.slot%2===0?'leftLeg':'rightLeg';
      const applied=applyArcadeInjury(f.injuries,{region,amount:damage,quality:.32,roll:injuryRoll(s,f,f),direction:'front'});
      updateInjury(f,applied);
      credit(s,f,'damageTaken',applied.impact??applied.delta);
      if(!f.alive) {
        f.contributors=[];setAction(f,'ko',1);f.attack=null;f.combo=0;f.buffer=null;
        event(s,'ko',f,f.x,f.y,{targetId:f.id,region,injuryTier:applied.tier,injuryOutcome:applied.outcome,fatal:true,environmental:true,...recordKnockout(s,f)});
      }
    }
  } else if(!zone||!zone.damagePerSecond)f.hazardDamage=0;
};
function separate(s){
  const {minX,maxX,minY,maxY}=s.bounds;
  const runners=s.fighters.filter(f=>f.alive);
  // Repeated constrained projection solves rows and corner jams, where
  // assigning each fighter half the correction let wall-side stacks persist.
  const passes=runners.length>4?5:3;
  for(let pass=0;pass<passes;pass++){
    let unresolved=false;
    for(let i=0;i<runners.length;i++)for(let j=i+1;j<runners.length;j++){
      const a=runners[i],b=runners[j];

      const dx=b.x-a.x,dy=b.y-a.y;
      const gap=bodyGap+(a.team===b.team?6:0);
      if(Math.abs(dx)>=gap||Math.abs(dy)>=gap)continue;
      const d=Math.hypot(dx,dy);
      if(d>=gap-.2)continue;
      unresolved=true;
      const bearing=(a.slot*2.39996+b.slot*1.61803+(a.team===b.team?.9:0))%(Math.PI*2);
      const nx=d>.001?dx/d:Math.cos(bearing),ny=d>.001?dy/d:Math.sin(bearing);
      const m=gap-d;
      const shift=(f,sign,target)=>{
        const tx=clamp(f.x+nx*target*sign,minX,maxX),ty=clamp(f.y+ny*target*sign,minY,maxY);
        if(!canSlide(s,f,f.x,f.y,tx,ty))return 0;
        const fraction=bodyMotionFraction(s,f,f.x,f.y,tx,ty);
        const moved=((tx-f.x)*nx+(ty-f.y)*ny)*sign*fraction;
        f.x+=(tx-f.x)*fraction;f.y+=(ty-f.y)*fraction;return moved;
      };
      const half=shift(a,-1,m*.5);
      const second=shift(b,1,m-half);
      if(half+second<m-.15)shift(a,-1,m-half-second);
      // A wall can pin both along the normal, particularly as a vault lands.
      // Give the pair a tangent escape rather than leaving them on one spot.
      const adx=b.x-a.x,ady=b.y-a.y;
      if(adx*adx+ady*ady<gap*gap*.69){
        const options=[a,b],orig=Math.hypot(adx,ady);
        let best=null,bestD=orig+1;
        for(const f of options)for(const sign of [-1,1]){
          const distance=(gap-orig)*.65;
          let tx=clamp(f.x-ny*distance*sign,minX,maxX),ty=clamp(f.y+nx*distance*sign,minY,maxY);
          const fraction=bodyMotionFraction(s,f,f.x,f.y,tx,ty);
          tx=f.x+(tx-f.x)*fraction;ty=f.y+(ty-f.y)*fraction;
          const other=f===a?b:a,candidate=Math.hypot(tx-other.x,ty-other.y);
          if(candidate>bestD&&canSlide(s,f,f.x,f.y,tx,ty)){
            best={f,tx,ty};bestD=candidate;
          }
        }
        if(best){best.f.x=best.tx;best.f.y=best.ty;}
      }
    }
    if(!unresolved)break;
  }
}
function resolveArcadeBladeClashes(s) {
  // Each successful pair removes both attacks from this tick. Other independent
  // pairs may still collide; body damage only resolves after all blade stops.
  for(let i=0;i<Math.floor(s.fighters.length/2);i++){
    const contact=findArcadeBladeContact(s);
    if(!contact)break;
    const {a,b,x,y,groundY,bladeA,bladeB,offhandA,offhandB,bladeIdA,bladeIdB}=contact;
    if(!atk(a)||!atk(b)||!a.alive||!b.alive||a.team===b.team)break;
    for(const [f,blade,offhand] of [[a,bladeA,offhandA],[b,bladeB,offhandB]]){
      f.clashX=x;f.clashY=y;f.clashFrom={...blade,offhand};f.clashBlade=blade.bladeId;f.clashOffhand=offhand;f.clashRole=f===a?'attacker':'defender';
      f.attack=null;f.attackSpec=null;f.technique='blade_clash';f.contact=true;f.offhandContact=true;f.counterMove=false;
      f.combo=0;f.buffer=null;f.vx=0;f.vy=0;f.energy=Math.max(0,f.energy-5);
      const other=f===a?b:a;
      const gradeGap=rankGap(f,other);
      const clashTime=gradeGap===0?.42:gradeGap>0?.42-.25*masteryRatio(gradeGap):.42+.17*masteryRatio(-gradeGap);
      setAction(f,'clash',clashTime);countMove(f,'clash');
      if(f.eliteEngaged&&!f.control)f.eliteReady=Math.max(f.eliteReady??0,s.time+.49);
      credit(s,f,'clashes');
    }
    event(s,'clash',a,x,y,{groundY,targetId:b.id,aId:a.id,bId:b.id,offhandA,offhandB,bladeA:bladeIdA,bladeB:bladeIdB,damage:0});
  }
}

function outcome(s,objectiveWinner){
  const alive=[0,0];
  for(const f of s.fighters)if(f.alive)alive[f.team]++;
  const timeUp=s.time+1e-8>=s.limit;
  if(!alive[0]||!alive[1]||timeUp||objectiveWinner!==null){
    let comparative=0;
    if(alive[0]===alive[1]&&timeUp){
      const regional=[[],[]];
      for(const f of s.fighters)if(f.alive)regional[f.team].push(f.injuries);
      // Compare the worst actual regional condition first, then remaining bodies.
      for(const side of regional)side.sort((a,b)=>compareArcadeDanger(b,a));
      for(let i=0;i<alive[0]&&!comparative;i++)comparative=compareArcadeDanger(regional[0][i],regional[1][i]);
    }
    const winner=!alive[0]&&!alive[1]?null:!alive[0]?1:!alive[1]?0:objectiveWinner??
      objectiveOutcome(s,{timedOut:true})??(alive[0]!==alive[1]?Number(alive[1]>alive[0]):comparative===0?null:Number(comparative>0));
    s.phase=winner===0?'won':winner===1?'lost':'draw';
    s.endReason=!alive[0]||!alive[1]?'elimination':objectiveWinner!==null?s.config.rule:'timeout';
    const lead=s.fighters.find(f=>f.alive&&f.team===(winner??0))??s.fighters[0];
    event(s,'round',lead,s.width/2,s.height/2,{phase:s.phase,reason:s.endReason});
  }
}
function tick(s,dt,input){
  s.time+=dt;
  if(s.elitePacing){const lift=pacingLift(s);s.elitePacing.stage=lift===0?'measured':lift===1?'decisive':'opening';}
  s.weather=environmentAt(s.config.weather,s.weatherSeed,s.time*60);
  const top=[-1,-1];s.liveByTeam=[0,0];
  for(const f of s.fighters)if(f.alive){top[f.team]=Math.max(top[f.team],f.career.gradeIndex);s.liveByTeam[f.team]++;}
  for(const f of s.fighters)f.rankDominance=top[1-f.team]<0?0:f.career.gradeIndex-top[1-f.team];
  const order=(++s.tick%2?s.fighters:[...s.fighters].reverse());
  for(const f of order){
    const enemy=nearest(s,f);
    const commands=f.control?input:f.alive?ai(s,f,enemy,dt):{};
    updateAir(f,dt);
    actionStep(s,f,dt,commands,enemy);
  }
  for(const f of order) during(s,f,dt);
  separate(s);
  resolveArcadeBladeClashes(s);
  for(const f of order){
    const attackSpec=atk(f);
    if(f.alive&&attackSpec&&!f.contact&&f.actionTime>=attackSpec.contact){f.contact=true;contact(s,f,attackSpec);}
    if(f.alive&&f.attack&&attackSpec?.offhand&&!f.offhandContact&&f.actionTime>=attackSpec.offhand.contact){
      f.offhandContact=true;
      const blade=attackSpec.offhand.blade??'offhand';
      if(blade!=='rear')credit(s,f,'saberSwings');countMove(f,blade);
      event(s,'slash',f,undefined,undefined,{combo:f.combo,contact:0,offhand:true,blade});
      contact(s,f,{...attackSpec,...attackSpec.offhand,isOffhand:true});
    }
  }
  for(const f of s.fighters){
    if(f.action!=='ko'&&f.actionDuration>0&&f.actionTime>=f.actionDuration){
      f.attack=null;f.technique=null;f.combo=0;setAction(f,'idle');
    }
  }
  outcome(s,advanceArcadeObjective(s,dt));
}
/** Mutates and returns state. dt in seconds; attack/dash inputs are rising-edge actions; guard is held. */
export function stepArcade(s,dt,input={}){
  if(!s||s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return s;
  const command=input.order==='advance'?'push':input.order==='retreat'?'regroup':input.order;
  if(s.mode==='command'&&['push','hold','regroup','flank'].includes(command)&&command!==s.order){
    s.order=command;
    for(const f of s.fighters)if(f.team===0)f.orderAnchor={x:f.x,y:f.y};
  }
  const edge={};
  if(typeof input.technique==='string'&&input.technique!==s.edges.technique)edge.technique=input.technique;
  s.edges.technique=input.technique??null;
  for(const name of ['strike','heavy','dash','force','phase','feint','jump']){
    edge[name]=Boolean(input[name]&&!s.edges[name]);
    s.edges[name]=Boolean(input[name]);
  }
  const count=Math.ceil(Math.min(dt,.12)*120), step=Math.min(dt,.12)/count;
  for(let index=0;index<count&&s.phase==='playing';index++){
    const controls={x:input.x,y:input.y,aimX:input.aimX,aimY:input.aimY,guard:input.guard,walk:input.walk,...(index===0?edge:{})};
    tick(s,step,controls);
  }
  return s;
}

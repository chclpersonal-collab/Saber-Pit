import {GAUNTLET_SIM_VERSION,gauntletReplayVersion} from './gauntlet-rules.js';
import {recruitFighterName} from './arcade-fighter-names.js';
import {appearanceSeedFor,FIGHTER_GENDERS} from './arcade-fighter-profiles.js';
import {arcadeChessStyleForId} from './arcade-chess-styles.js';
import {tournamentTerrainOption,tournamentFixtureTerrain} from './arcade-map-rotation.js';
import {ELO_K,eloExpected} from './arcade-elo.js';

export const GAUNTLET_KEY='saber-pit-gauntlet-v1';
export const GAUNTLET_MAX_SAVE_CHARS=160000;
const FLOOR=1500, RANK='SSS+V', SIZE=16, MAX_HISTORY=32;
const FORMS=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const WEAPONS=['single','dual','staff'];
const DOCTRINES=['balanced','aggressive','defensive'];
const ROLES=['solo','trio'];
const count=(n,max=1e7)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.trunc(n))):0;
const rate=(n,fallback=.5)=>Number.isFinite(n)?Math.min(1,Math.max(0,n)):fallback;
const elo=n=>Number.isFinite(n)?Math.min(1e6,Math.max(FLOOR,Math.round(n*2)/2)):FLOOR;
const text=(n,max=60)=>typeof n==='string'?n.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim().slice(0,max):'';
const blank=()=>({version:1,season:0,fighters:[],active:null,history:[],lastChampion:null});
const storageFor=s=>s??globalThis.localStorage;
const roleRecord=r=>({wins:count(r?.wins),draws:count(r?.draws),losses:count(r?.losses)});
const move=v=>typeof v==='string'&&/^[a-z][a-z0-9_:-]{0,72}$/.test(v)?v:null;
const roleProfile=p=>{
  const doctrine=DOCTRINES.includes(p?.doctrine??p?.lastDoctrine)?(p.doctrine??p.lastDoctrine):'balanced';
  return {bouts:count(p?.bouts),guard:rate(p?.guard),pressure:rate(p?.pressure),mobility:rate(p?.mobility),
    doctrine,lastDoctrine:doctrine,preferredMove:move(p?.preferredMove)};
};
const hash=s=>appearanceSeedFor(s);
const seeds=s=>Number.isSafeInteger(s)?s>>>0:hash(text(String(s??'gauntlet')));
const limitFor=n=>Number.isFinite(n)?Math.max(15,Math.min(600,Math.round(n))):90;
const side=v=>v===0||v===1||v===null;
const validId=id=>typeof id==='string'&&/^g[0-9a-z]{1,7}-f(?:[1-9]|1[0-6])$/.test(id);
const numberSeed=id=>Number(id.slice(id.lastIndexOf('-f')+2));
const profileFor=(f,role)=>roleProfile(f?.adaptation?.[role]);

function fighter(raw,season){
  if(!validId(raw?.id)||!text(raw.name,48)||!FORMS.includes(raw.form))return null;
  const id=raw.id,body=['woman','rabbit'].includes(raw.body)?raw.body:'femboy';
  const weapon=WEAPONS.includes(raw.weapon)?raw.weapon:'single';
  const grip=weapon!=='staff'&&raw.grip==='backhand'?'backhand':'forward',dualPhase=raw.dualPhase===true;
  const rating=elo(raw.elo);
  return {id,name:text(raw.name,48),gender:FIGHTER_GENDERS.includes(raw.gender)?raw.gender:'nonbinary',
    body,appearanceSeed:hash(id),chessStyle:arcadeChessStyleForId(id),form:raw.form,weapon,grip,dualPhase,
    gear:{weapon,grip,dualPhase},rank:RANK,grade:RANK,elo:rating,peakElo:Math.max(rating,elo(raw.peakElo)),
    peakSeason:count(raw.peakSeason,season),lastSeason:count(raw.lastSeason,season),titles:count(raw.titles,season),
    solo:roleRecord(raw.solo),trio:roleRecord(raw.trio),adaptation:{solo:profileFor(raw,'solo'),trio:profileFor(raw,'trio')}};
}

function recruits(seed){
  const avoid=[];
  return Array.from({length:SIZE},(_,i)=>{
    const id='g'+seed.toString(36)+'-f'+(i+1), h=hash(id+':kit')>>>0;
    const {name,family}=recruitFighterName({givenIndex:hash(id+':first'),familySeed:hash(id+':family'),avoidFamilies:avoid});
    avoid.push(family);
    const gender=FIGHTER_GENDERS[(h>>>8)%4===3?1:(h>>>8)%4];
    return fighter({id,name,gender,body:gender==='female'?'woman':'femboy',form:FORMS[i%FORMS.length],
      weapon:WEAPONS[h%3],grip:(h&8)?'backhand':'forward',dualPhase:(h&256)!==0},1);
  });
}

const ordered=state=>[...state.fighters].sort((a,b)=>b.elo-a.elo||numberSeed(a.id)-numberSeed(b.id));
export const gauntletLeaderboard=state=>ordered(state??blank());

function groupSeeds(active){
  const seeds=new Map();
  active.groups.forEach((group,i)=>group.forEach((id,j)=>seeds.set(id,1+4*j+(j%2?3-i:i))));
  return seeds;
}

function table(ids,bouts,seeds){
  const rows=ids.map(id=>({id,seed:seeds.get(id),soloPoints:0,points:0,solo:roleRecord(),trio:roleRecord()}));
  const byId=new Map(rows.map(r=>[r.id,r]));
  for(const b of bouts)for(const id of [b.soloId,...b.trioIds]){
    const r=byId.get(id);if(!r)continue;
    const role=id===b.soloId?'solo':'trio';
    const key=b.winner===null?'draws':(b.winner===0)===(role==='solo')?'wins':'losses';
    r[role][key]++;
    const points=key==='wins'?1:key==='draws'?.5:0;
    r.points+=points;if(role==='solo')r.soloPoints+=points;
  }
  // Plain W/D/L points alone perversely choose a solo loser when exactly
  // one fighter wins solo (they also hand three points to their opponents).
  // Compare success in the harder role first, then use all four outings.
  return rows.sort((a,b)=>b.soloPoints-a.soloPoints||b.points-a.points||a.seed-b.seed);
}

function standings(active){
  const seeds=groupSeeds(active);
  active.standings=active.groups.map((g,i)=>table(g,active.bouts.filter(b=>b.phase==='groups'&&b.group===i),seeds));
  active.final=active.cursor>=16?active.standings.map(g=>g[0].id):[];
  active.finalStandings=table(active.final,active.bouts.filter(b=>b.phase==='final'),seeds);
  active.status=active.stage=active.cursor>=20?'complete':active.cursor>=16?'final':'groups';
  return active;
}

export function startGauntlet(state=blank(),{seed,limit,terrain}={}){
  if(state.active&&state.active.status!=='complete')return state;
  const season=Math.min(1e7,state.season+1), n=seeds(seed??hash('gauntlet-season:'+season));
  const fighters=state.fighters.length===SIZE?state.fighters:recruits(n);
  const groups=Array.from({length:4},()=>[]);
  ordered({fighters}).forEach((f,i)=>groups[Math.floor(i/4)%2?3-i%4:i%4].push(f.id));
  const active=standings({seed:n,limit:limitFor(limit),terrain:tournamentTerrainOption(terrain),groups,bouts:[],cursor:0,lastFixture:null});
  return {...state,season,fighters,active};
}

function slot(state,index){
  const a=state.active;
  if(!a||index>=20)return null;
  const phase=index<16?'groups':'final',group=index<16?Math.floor(index/4):null;
  const ids=phase==='groups'?a.groups[group]:a.final;
  if(ids.length!==4)return null;
  const soloIndex=index%4,soloId=ids[soloIndex],trioIds=ids.filter(id=>id!==soloId);
  const id='gs'+state.season.toString(36)+'-b'+(index+1).toString(36);
  const fixture={id,phase,group,soloId,trioIds,seed:hash(a.seed+':'+id),limit:a.limit};
  return {...fixture,terrain:tournamentFixtureTerrain(a,fixture)};
}
export function nextGauntletBout(state){
  const f=slot(state,state.active?.cursor??0);if(!f)return null;
  const roster=new Map(state.fighters.map(x=>[x.id,x]));
  return {...f,simulationVersion:GAUNTLET_SIM_VERSION,fighters:[f.soloId,...f.trioIds].map((id,i)=>{
    const x=roster.get(id),role=i===0?'solo':'trio';
    return {...x,role,profile:profileFor(x,role)};
  })};
}

export function gauntletEloTransfer(solo,trio,score,splitOffset=0){
  if(!Array.isArray(trio)||trio.length!==3||![0,.5,1].includes(score))throw new RangeError('Invalid Gauntlet Elo fixture');
  const baseline=elo(solo), teammates=trio.map(elo), max=Math.max(...teammates);
  const combined=max+100*Math.log2(teammates.reduce((n,r)=>n+2**((r-max)/100),0));
  const expected=eloExpected(baseline,combined);
  const raw=ELO_K*(score-expected);
  const units=Math.sign(raw)*Math.round(Math.abs(raw)*2);
  const shares=teammates.map((_,i)=>-Math.sign(units)*(Math.floor(Math.abs(units)/3)+(((i-count(splitOffset)%3+3)%3)<Math.abs(units)%3?1:0))/2);
  const requested=[units/2,...shares];
  // Like the main ladder, protect each rank floor independently. A strict
  // zero-sum cap would freeze a freshly seeded all-1500 division forever.
  const before=[baseline,...teammates],after=before.map((n,i)=>elo(n+requested[i]));
  return {expected,combined,requested,after,actual:after.map((n,i)=>n-before[i])};
}

function learn(previous,observation){
  const p=roleProfile(previous), o=observation??{};
  const alpha=1/Math.min(6,p.bouts+1);
  const blend=k=>p[k]+(rate(o[k],p[k])-p[k])*alpha;
  return roleProfile({bouts:p.bouts+1,guard:blend('guard'),pressure:blend('pressure'),mobility:blend('mobility'),
    doctrine:DOCTRINES.includes(o.doctrine)?o.doctrine:p.doctrine,preferredMove:move(o.preferredMove)??p.preferredMove});
}
function recorded(f,result){
  const {fighters,simulationVersion,...metadata}=f;
  return {...metadata,winner:result.winnerIndex,winnerIndex:result.winnerIndex,
    time:Number.isFinite(result.time)?Math.min(f.limit,Math.max(0,result.time)):null,reason:text(result.reason,48)};
}
export function recordGauntletBout(state,fixtureId,result){
  const f=nextGauntletBout(state);
  if(!f||fixtureId!==f.id||!side(result?.winnerIndex)||
    (result.simulationVersion!=null&&result.simulationVersion!==f.simulationVersion))return state;
  if(result.fighters!=null&&(!Array.isArray(result.fighters)||result.fighters.length!==4))return state;
  const observations=result.fighters??[];
  if(observations.some((o,i)=>(o?.fighterId??o?.id)!=null&&
    (o.fighterId??o.id)!==f.fighters[i].id))return state;
  const timeout=/^(time(?:[-_ ]?(?:out|limit|cap))?|clock|limit)$/i.test(text(result.reason,48));
  const winner=timeout?null:result.winnerIndex, score=winner===null?.5:winner===0?1:0;
  const rating=gauntletEloTransfer(f.fighters[0].elo,f.fighters.slice(1).map(x=>x.elo),score,f.seed);
  const fighters=state.fighters.map(x=>{
    const i=f.fighters.findIndex(ff=>ff.id===x.id);if(i<0)return x;
    const role=i===0?'solo':'trio', key=winner===null?'draws':(winner===0)===(role==='solo')?'wins':'losses';
    const o=observations[i];
    const next=rating.after[i];
    return {...x,elo:next,lastSeason:state.season,[role]:{...x[role],[key]:x[role][key]+1},
      ...(next>x.peakElo?{peakElo:next,peakSeason:state.season}:{}),
      adaptation:{...x.adaptation,[role]:learn(x.adaptation[role],o)}};
  });
  const bout=recorded(f,{...result,winnerIndex:winner});
  const active=standings({...state.active,cursor:state.active.cursor+1,
    bouts:[...state.active.bouts,{...bout,eloDelta:rating.actual,requestedEloDelta:rating.requested}],lastFixture:f});
  if(active.status!=='complete')return {...state,active,fighters};
  const drawn=active.bouts.slice(16).every(b=>b.winner===null);
  const championId=drawn?null:active.finalStandings[0].id, champion=fighters.find(x=>x.id===championId);
  const lastChampion=champion?{id:champion.id,name:champion.name,season:state.season}:null;
  return {...state,active,fighters:fighters.map(x=>x.id===championId?{...x,titles:x.titles+1}:x),
    lastChampion,history:[lastChampion??{id:null,name:null,season:state.season,draw:true},...state.history].slice(0,MAX_HISTORY)};
}

export function normalizeGauntlet(raw){
  if(raw?.version!==1||!Array.isArray(raw.fighters)||!Array.isArray(raw.history)||
    !Number.isSafeInteger(raw.season)||raw.season<0||raw.season>1e7)return null;
  if(raw.season===0)return raw.fighters.length===0&&raw.active==null&&raw.history.length===0&&!raw.lastChampion?blank():null;
  if(raw.fighters.length!==SIZE||raw.history.length>MAX_HISTORY)return null;
  const fighters=raw.fighters.map(f=>fighter(f,raw.season));
  if(fighters.some(f=>!f)||new Set(fighters.map(f=>f.id)).size!==SIZE)return null;
  const roster=new Set(fighters.map(f=>f.id));
  const a=raw.active;
  if(!a||!Number.isSafeInteger(a.seed)||!Array.isArray(a.groups)||a.groups.length!==4||
    a.groups.some(g=>!Array.isArray(g)||g.length!==4)||!Array.isArray(a.bouts)||a.bouts.length>20)return null;
  const grouped=a.groups.flat();
  if(new Set(grouped).size!==SIZE||grouped.some(id=>!roster.has(id)))return null;
  const active=standings({seed:a.seed>>>0,limit:limitFor(a.limit),terrain:tournamentTerrainOption(a.terrain),
    groups:a.groups.map(g=>[...g]),bouts:[],cursor:0,lastFixture:null});
  const state={version:1,season:raw.season,fighters,active,history:[],lastChampion:null};
  const deltas=ds=>Array.isArray(ds)&&ds.length===4&&ds.every(v=>Number.isFinite(v)&&Math.abs(v)<=ELO_K)?[...ds]:null;
  for(const b of a.bouts){
    const expected=slot(state,active.cursor);
    const actual=deltas(b?.eloDelta), requested=deltas(b?.requestedEloDelta);
    if(b?.id!==expected.id||!side(b.winner)||!actual||!requested)return null;
    active.bouts.push({...recorded(expected,{...b,winnerIndex:b.winner}),eloDelta:actual,requestedEloDelta:requested});
    active.cursor++;
    if(active.cursor===16)standings(active);
  }
  standings(active);
  if(a.lastFixture&&active.cursor){
    const f=slot(state,active.cursor-1);
    const prev=Array.isArray(a.lastFixture.fighters)&&a.lastFixture.fighters.length===4?
      a.lastFixture.fighters.map(x=>fighter(x,raw.season)):null;
    const version=gauntletReplayVersion(a.lastFixture);
    if(version&&prev&&prev.every((x,i)=>x?.id===[f.soloId,...f.trioIds][i])){
      active.lastFixture={...f,simulationVersion:version,fighters:prev.map((x,i)=>{
        const role=i===0?'solo':'trio';
        return {...x,role,profile:profileFor(x,role)};
      })};
    }
  }
  for(const h of raw.history){
    const drawn=h?.draw===true&&h?.id===null;
    if((!drawn&&!roster.has(h?.id))||!Number.isSafeInteger(h.season)||h.season<1||h.season>raw.season||
        (state.history.length&&h.season>=state.history.at(-1).season))return null;
    state.history.push(drawn?{id:null,name:null,season:h.season,draw:true}:
      {id:h.id,name:fighters.find(f=>f.id===h.id).name,season:h.season});
  }
  const latest=state.history[0], completed=active.status==='complete';
  if(completed){
    const drawn=active.bouts.slice(16).every(b=>b.winner===null);
    if(!latest||latest.season!==state.season||(drawn?!latest.draw:latest.id!==active.finalStandings[0].id))return null;
  }else if(latest?.season===state.season)return null;
  state.lastChampion=latest&&!latest.draw?latest:null;
  return state;
}
export function loadGauntlet(storage){
  try{
    const raw=storageFor(storage)?.getItem(GAUNTLET_KEY);
    return raw&&raw.length<=GAUNTLET_MAX_SAVE_CHARS?(normalizeGauntlet(JSON.parse(raw))??blank()):blank();
  }catch{return blank();}
}
export function saveGauntlet(state,storage){
  try{
    const target=storageFor(storage),valid=normalizeGauntlet(state);
    if(!target||!valid)return false;
    const value=JSON.stringify(valid);
    if(value.length>GAUNTLET_MAX_SAVE_CHARS)return false;
    target.setItem(GAUNTLET_KEY,value);return true;
  }catch{return false;}
}
export function resetGauntlet(storage){
  try{storageFor(storage)?.removeItem(GAUNTLET_KEY);}catch{}
  return blank();
}

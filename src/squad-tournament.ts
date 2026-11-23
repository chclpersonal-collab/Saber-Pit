import type {StorageReader,StorageWriter} from './arcade-save-types.js';
type Stage = 'qualifier'|'opening'|'main';
type Composition = ''|'all-female'|'all-male'|'mixed';
type SquadFighter = NonNullable<ReturnType<typeof fighter>>;
type Team = {id:string;name:string;fighters:SquadFighter[];rank:string;grade:string;elo:number;composition:Composition;wins:number;draws:number;losses:number;kills:number;deaths:number;titles:number;lastSeason:number};
type Attempt = {winnerId:string|null;kills:number[];deaths:number[];damage:number[];time:number;reason:string};
type Result = {winnerId:string;loserId:string;reason:string;time:number;kills:number[];deaths:number[]};
type Fixture = {id:string;stage:Stage;round:number;index:number;teamIds:(string|null)[];attempts:Attempt[];winnerId:string|null;loserId:string|null;result:Result|null};
type Bracket = {qualifiers:Fixture[];opening:Fixture[];rounds:Fixture[][]};
type Season = Bracket & {id:string;season:number;seed:number;limit:number;terrain:string;rank:string;grade:string;lastReplay:ReturnType<typeof replayFrom>;entrants:string[];directSeeds:string[];playIn:string[];championId:string|null;status:'running'|'completed';quarterfinalistIds?:string[];titleByDraw?:boolean};
type State = {version:number;ratingVersion:number;season:number;championId:string|null;active:Season|null;teams:Record<string,Team>;peaks:ReturnType<typeof readEloPeaks>;history:{season:number;championId:string;runnerUpId:string;quarterfinalistIds?:string[];titleByDraw?:boolean}[]};
type FighterWire = {name?:unknown;form?:string;body?:string;gender?:string;appearanceSeed?:unknown;chessStyle?:string;id?:string;gear?:{weapon?:string;grip?:string;dualPhase?:unknown}};
type TeamWire = {id?:unknown;name?:unknown;fighters?:FighterWire[];elo?:unknown;combatElo?:number;wins?:unknown;draws?:unknown;losses?:unknown;kills?:unknown;deaths?:unknown;titles?:unknown;lastSeason?:unknown};
type ReplayWire = {ruleset:number;seed:number;limit:number;terrain:string;round:number;stage?:Stage;attempt?:number;id?:string;teams:(TeamWire&{fighters:FighterWire[]})[];matchReport?:unknown};
type AttemptWire = {deaths?:unknown[];kills?:unknown[];damage?:unknown[];stats?:{deaths?:unknown;kills?:unknown;damage?:unknown}[];winnerId?:string|null;winnerIndex?:number|null;reason?:unknown;time?:unknown;elapsed?:unknown;replay?:ReplayWire|null;then?:unknown};
type Bout = {id:string;stage:Stage;round:number;index:number;attempt:number;teamIds:string[];teams:Team[];seed:number;limit:number;terrain:string;rank:string;grade:string};
type HistoryWire={season?:number;championId?:string;runnerUpId?:string;titleByDraw?:boolean;quarterfinalistIds?:string[]};
type SavedFixture={id:string;teamIds?:string[];attempts?:AttemptWire[];winnerId:string;result?:{reason?:string}};
type ActiveWire={season:number;seed?:number;limit?:number;terrain?:string;directSeeds?:string[];playIn?:string[];qualifiers?:SavedFixture[];opening?:SavedFixture[];rounds?:SavedFixture[][];lastReplay?:ReplayWire&{attempt:number}};
type SaveWire={version:number;ratingVersion?:number;season:number;peaks?:unknown;teams?:Record<string,TeamWire>;championId?:string;history?:HistoryWire[];active?:ActiveWire};
import {arcadeChessStyleForId,normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {tournamentFixtureTerrain,tournamentTerrainOption} from './arcade-map-rotation.js';
import {sanitizeMatchReport} from './arcade-match-report.js?v=2.33.0';
import {peakLeaderboard,readEloPeaks,recordRatedEloPeak,seedKnownEloPeak} from './arcade-peak-elo.js?v=2.28.0';
import {ARCADE_FORM_IDS} from './arcade-engine.js?v=3.0.0';
import {fighterNameParts,fighterNameKeysGiven,fighterNameKeysFamily} from './arcade-fighter-names.js?v=2.18.2';

import {clampElo,eloFloor,updateEloPair} from './arcade-elo.js';
export const SQUAD_ELO_START=eloFloor('SSS+V');
export const SQUAD_ELO_FLOOR=SQUAD_ELO_START;
const RATING_VERSION=1, MAX_TEAM_RECORDS=120;
export const SQUAD_TOURNAMENT_KEY='saber-pit:squad-tournament:1';
const rank='SSS+V', legacyPrefixes=['The','House','Order of','Clan'], legacyClans=['Ash Ravens','Black Bells','Cinder Banners','Dawn Wolves','Ember Choir','Flint Roses','Gloam Hounds','Hollow Shields','Iron Willows','Jade Watch','Keel Owls','Lantern Foxes','Moon Thorns','Night Reeds','Oath Crows','Pearl Knives','Quartz Lions','Rime Stags','Salt Falcons','Thorn Guard','Umber Vines','Vale Spears','Wold Ghosts','Yew Blades'];
const legacyGiven=['Alden','Anwen','Arden','Bea','Cadan','Carys','Dara','Eira','Fenn','Gwen','Hale','Ione','Ivor','Jory','Kell','Lin','Mael','Mara','Niall','Oriel','Perrin','Quill','Renn','Rhian','Rook','Rowan','Sable','Tamsin','Vesper','Wren'];
const legacyFamily=['Ashbell','Blackfen','Briarvale','Claymere','Crowford','Graywick','Highmere','Larkfall','Moonford','Pinewold','Reedfall','Stonecut','Thornwick','Valehart','Yewcroft'];
const bodies=['femboy','woman','rabbit'], genders=['female','male','nonbinary'], kits=[['single','forward'],['dual','forward'],['staff','forward'],['single','backhand'],['dual','backhand']];
const count=(v:unknown,max=1e8)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
const range=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const safeKey=(v:unknown)=>typeof v==='string'&&/^q[0-9a-z]+-t[0-9a-z]+$/.test(v)?v:null;
const text=(v:unknown,max=70)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,max):'';
const obj=<T extends object>(v:T|null|undefined):Partial<T>=>v&&typeof v==='object'?v:{};
const list=<T>(v:T[]|null|undefined):T[]=>Array.isArray(v)?v:[];
const clock=(v:unknown)=>[45,75,90,150].includes(Number(v))?Number(v):75;
const terrainName=tournamentTerrainOption;
function hash(value:unknown,seed=2166136261){let h=seed>>>0;for(const c of String(value))h=Math.imul(h^c.codePointAt(0)!,16777619);return h>>>0;}
function shuffle<T>(input:readonly T[],seed:number){
  const items=[...input];let x=seed>>>0||1;
  for(let i=items.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;const j=(x>>>0)%(i+1);[items[i],items[j]]=[items[j],items[i]];}
  return items;
}
const blank=():State=>({version:1,ratingVersion:RATING_VERSION,season:0,championId:null,active:null,teams:{},peaks:{},history:[]});
function storeFor<T extends StorageReader>(storage?:T|null){return storage??(typeof localStorage!=='undefined'?localStorage:null);}
const nameWidth=fighterNameKeysGiven.length,nameHeight=fighterNameKeysFamily.length,namePool=nameWidth*nameHeight;
function displayName(code:number,joiner:string){
  return fighterNameParts(code%nameWidth,Math.floor(code/nameWidth)).map(parts=>parts.join('')).join(joiner);
}
function freshName(start:number,used:Set<string>,joiner:string){
  for(let n=0;n<namePool;n++){
    const name=displayName((start+n*29)%namePool,joiner);
    if(!used.has(name)){used.add(name);return name;}
  }
  throw new Error('No unique squad tournament names available.');
}
// Rename only exact strings generated by the original squad roster.
function migrateMemberName(name:string){
  const [g,f,...rest]=name.split(' '),i=legacyGiven.indexOf(g),j=legacyFamily.indexOf(f);
  return i>=0&&j>=0&&!rest.length?displayName(j*nameWidth+i,' '):name;
}
function migrateClanName(name:string){
  for(const [prefix,legacy] of legacyPrefixes.entries()){
    if(!name.startsWith(legacy+' '))continue;
    const i=legacyClans.indexOf(name.slice(legacy.length+1));
    if(i>=0)return displayName(((prefix*legacyClans.length+i)*29+41)%namePool,'-');
  }
  return name;
}
function fighter(raw:FighterWire|null|undefined,id:string){
  if(!raw||!text(raw.name,50))return null;
  const g=obj(raw.gear), weapon=kits.some(k=>k[0]===g.weapon)?g.weapon!:'single';
  const grip=weapon!=='staff'&&g.grip==='backhand'?'backhand':'forward';
  return {id,chessStyle:arcadeChessStyleForId(id),name:migrateMemberName(text(raw.name,50)),form:ARCADE_FORM_IDS.includes(raw.form!)?raw.form!:ARCADE_FORM_IDS[0],
    body:bodies.includes(raw.body!)?raw.body!:'femboy',gender:genders.includes(raw.gender!)?raw.gender!:'nonbinary',
    appearanceSeed:count(raw.appearanceSeed,0xffffffff),rank,grade:rank,gear:{weapon,grip,dualPhase:g.dualPhase===true,forceFamily:'force_push'}};
}
function team(raw:TeamWire|null|undefined):Team|null{
  const id=safeKey(raw?.id),name=migrateClanName(text(raw?.name));
  if(!raw||!id||!name||list(raw.fighters).length!==5)return null;
  const fighters=raw.fighters!.map((f,i)=>fighter(f,id+'-f'+(i+1)));
  if(!fighters.every((f):f is SquadFighter=>Boolean(f))||new Set(fighters.map(f=>f.name)).size!==5)return null;
  return {id,name,fighters,rank,grade:rank,elo:clampElo(raw.elo,rank),composition:rosterComposition(fighters),wins:count(raw.wins),draws:count(raw.draws),losses:count(raw.losses),kills:count(raw.kills),
    deaths:count(raw.deaths),titles:count(raw.titles),lastSeason:count(raw.lastSeason)};
}
function rosterComposition(fighters:readonly ({gender?:string}|null|undefined)[]):Composition{
  if(fighters.length!==5)return '';
  if(fighters.every(f=>f?.gender==='female'))return 'all-female';
  if(fighters.every(f=>f?.gender==='male'))return 'all-male';
  return 'mixed';
}
export function squadGenderLabel(team?:{fighters?:{gender?:string}[]}|null){
  return ({'':'','all-female':'All Female','all-male':'All Male',mixed:'Mixed'})[rosterComposition(list(team?.fighters))]??'';
}
function fixture(season:number,stage:Stage,round:number,index:number,teamIds:(string|null)[]=[null,null]):Fixture{
  return {id:'q'+season.toString(36)+'-'+(stage==='qualifier'?'qual':stage==='opening'?'open':'main')+'-r'+round+'-b'+(index+1),
    stage,round,index,teamIds,attempts:[],winnerId:null,loserId:null,result:null};
}
// The first eight main seeds occupy distinct R16 fixtures. Additional
// direct seeds and qualifiers fill the other seats in seed order. The last
// 2k main entrants contest k opening fixtures; everyone else has a main bye.
const mainSeat=(i:number)=>i<8?[i,0]:[i-8,1];
const openingSize=(directCount:number,playInCount:number)=>directCount+playInCount/2-16;
function routeMain(a:Bracket,index:number,id:string){
  const byeCount=16-a.opening.length;
  if(index>=byeCount){
    const slot=index-byeCount;
    a.opening[Math.floor(slot/2)].teamIds[slot%2]=id;
  }else{
    const [match,side]=mainSeat(index);a.rounds[0][match].teamIds[side]=id;
  }
}
function schedule(season:number,direct:string[],playIn:string[]):Bracket{
  const a={
    qualifiers:Array.from({length:playIn.length/2},(_,i)=>fixture(season,'qualifier',0,i,playIn.slice(i*2,i*2+2))),
    opening:Array.from({length:openingSize(direct.length,playIn.length)},(_,i)=>fixture(season,'opening',0,i)),
    rounds:[8,4,2,1].map((size,round)=>Array.from({length:size},(_,i)=>fixture(season,'main',round+1,i)))
  };
  direct.forEach((id,i)=>routeMain(a,i,id));
  return a;
}
const allFixtures=(a:Bracket)=>[...a.qualifiers,...(a.opening??[]),...a.rounds.flat()];
function quarterfinalists(a:Bracket|null|undefined){
  return a?.rounds?.[0]?.map(m=>m.winnerId).filter((id):id is string=>Boolean(id))??[];
}
function previousQuarterfinalists(state:State){
  const recent=state.history.at(-1);
  const active=state.active?.status==='completed'?quarterfinalists(state.active):[];
  return (active.length===8?active:recent?.quarterfinalistIds??[]).filter(id=>Object.hasOwn(state.teams,id));
}
function recruit(state:State,seed:number,index:number,clan:string,usedNames:Set<string>,composition:string){
  const id='q'+state.season.toString(36)+'-t'+(index+1).toString(36);
  const roster:string[]=composition==='all-female'?Array(5).fill('female'):composition==='all-male'?Array(5).fill('male'):
    shuffle(['female','female','male','male','nonbinary'],hash(id+':composition',seed));
  const fighters=Array.from({length:5},(_,slot)=>{
    const trait=hash(id+':'+slot,seed),name=freshName(trait%namePool,usedNames,' ');
    const [weapon,grip]=kits[(trait>>>11)%kits.length];
    return {name,form:ARCADE_FORM_IDS[(trait>>>3)%ARCADE_FORM_IDS.length],body:bodies[(trait>>>9)%bodies.length],
      gender:roster[slot],appearanceSeed:trait,gear:{weapon,grip,dualPhase:(trait>>>20)%5===0}};
  });
  return team({id,name:clan,fighters,lastSeason:state.season})!;
}
export function startSquadTournament(state:State,{seed=state.season+1,limit=75,terrain='underpit'}:{seed?:number;limit?:number;terrain?:string}={}){
  if(state.active?.status==='running')return state;
  const returning=previousQuarterfinalists(state);
  state.season++;
  seed=Number.isSafeInteger(seed)?seed>>>0:hash(seed);
  const ranked=squadLeaderboard(state,10).map(t=>t.id);
  const directSeeds=[...new Set([...ranked.slice(0,8),...returning])];
  const directTarget=Math.max(8,directSeeds.length+directSeeds.length%2);
  const oldChampion=state.teams[state.championId!]?.id;
  const entrants=[...new Set([...directSeeds,...ranked,...(oldChampion?[oldChampion]:[])])];
  const usedNames=new Set(entrants.flatMap(id=>state.teams[id].fighters.map(f=>f.name)));
  const squadNames=new Set(Object.values(state.teams).map(team=>team.name));
  const groups=shuffle(['mixed','all-female','all-male'],hash('direct-compositions',seed));
  const carried=(key:string)=>entrants.filter(id=>state.teams[id].composition===key).length;
  const need=groups.map(key=>Math.max(0,8-carried(key)));
  // More than eight returning teams of one composition may make 8/8/8
  // impossible; trim the largest vacancy without changing existing rosters.
  for(let excess=need.reduce((a,b)=>a+b,0)-(24-entrants.length);excess>0;excess--){
    const i=need.indexOf(Math.max(...need));need[i]--;
  }
  const compositions=shuffle(groups.flatMap((key,i)=>Array(need[i]).fill(key)),hash('compositions:'+state.season,seed));
  const fresh:string[]=[];
  for(let i=entrants.length,j=0;i<24;i++,j++){
    const label=freshName(hash(`squad:${state.season}:${i}`,seed)%namePool,squadNames,'-');
    const t=recruit(state,seed,i,label,usedNames,compositions[j]);
    state.teams[t.id]=t;entrants.push(t.id);fresh.push(t.id);
  }
  // Keep the first-season 3/3/2 composition spread when there is room;
  // Elo-qualified returning teams always outrank that preference.
  const selected:string[]=[];
  for(const [i,key] of groups.entries()){
    const slots=Math.max(0,(i<2?3:2)-directSeeds.filter(id=>state.teams[id].composition===key).length);
    const available=shuffle(fresh.filter(id=>state.teams[id].composition===key),hash('direct:'+key,seed));
    selected.push(...available.slice(0,Math.min(slots,directTarget-directSeeds.length-selected.length)));
  }
  const remaining=shuffle(fresh.filter(id=>!selected.includes(id)),hash('direct-fill',seed));
  directSeeds.push(...shuffle(selected,hash('direct-order',seed)),...remaining.slice(0,directTarget-directSeeds.length-selected.length));
  const direct=directSeeds;
  const playIn=shuffle(entrants.filter(id=>!direct.includes(id)),hash('qualifiers',seed));
  const seeded=[...directSeeds,...playIn], matches=schedule(state.season,directSeeds,playIn);
  state.active={id:'q'+state.season.toString(36),season:state.season,seed,limit:clock(limit),terrain:terrainName(terrain)!,rank,grade:rank,lastReplay:null,
    entrants:[...seeded],directSeeds,playIn,...matches,championId:null,status:'running'};
  const retain=new Set([...seeded,...state.history.map(s=>s.championId),...state.history.map(s=>s.runnerUpId)]);
  for(const t of Object.values(state.teams).sort((a,b)=>b.elo-a.elo||b.lastSeason-a.lastSeason||a.id.localeCompare(b.id))){
    if(retain.size>=MAX_TEAM_RECORDS)break;
    retain.add(t.id);
  }
  state.teams=Object.fromEntries(Object.entries(state.teams).filter(([key])=>retain.has(key)));
  return state;
}
function pending(s:State|null|undefined){return s?.active?.status==='running'?allFixtures(s.active).find(b=>!b.result&&b.teamIds.every(Boolean)):null;}
export function nextSquadBout(state:State):Bout|null{
  const p=pending(state);if(!p)return null;
  const a=state.active!, attempt=p.attempts.length, teamIds=(attempt%2?[...p.teamIds].reverse():[...p.teamIds]) as string[];
  return {id:p.id,stage:p.stage,round:p.round,index:p.index,attempt,
    teamIds,teams:teamIds.map(key=>team(state.teams[key]!)!),seed:hash(p.id+'/'+attempt,a.seed),limit:a.limit,terrain:tournamentFixtureTerrain(a,p)!,rank,grade:rank};
}
function cleanAttempt(raw:AttemptWire,teamIds:(string|null)[],limit:number,{enforceClockDraw=false}={}){
  const deaths=[0,1].map(i=>count(raw.deaths?.[i]??raw.stats?.[i]?.deaths,5));
  const kills=[0,1].map(i=>count(raw.kills?.[i]??raw.stats?.[i]?.kills,deaths[1-i]));
  const reason=text(raw.reason,40)||'match';
  const clockDraw=enforceClockDraw&&['timeout','simulation-limit'].includes(reason);
  const winnerId=clockDraw?null:teamIds.includes(raw.winnerId!)?raw.winnerId!:[0,1].includes(raw.winnerIndex!)?teamIds[raw.winnerIndex!]:null;
  const damage=[0,1].map(i=>range(raw.damage?.[i]??raw.stats?.[i]?.damage,10000));
  return {winnerId,kills,deaths,damage,time:range(raw.time??raw.elapsed,limit),reason};
}
function advance(a:Season,p:Fixture,winnerId:string){
  if(p.stage==='qualifier'){routeMain(a,a.directSeeds.length+p.index,winnerId);return;}
  if(p.stage==='opening'){
    const [match,side]=mainSeat(16-a.opening.length+p.index);
    a.rounds[0][match].teamIds[side]=winnerId;return;
  }
  if(a.rounds[p.round]){a.rounds[p.round][Math.floor(p.index/2)].teamIds[p.index%2]=winnerId;return;}
  a.championId=winnerId;a.status='completed';a.quarterfinalistIds=quarterfinalists(a);
}
function seal(a:Season,p:Fixture,winnerId:string,reason:string){
  p.winnerId=winnerId;p.loserId=p.teamIds.find(key=>key!==winnerId)!;
  const sum=(key:'kills'|'deaths')=>[0,1].map(i=>p.attempts.reduce((n,r)=>n+r[key][i],0));
  p.result={winnerId,loserId:p.loserId!,reason,time:p.attempts.at(-1)?.time??0,kills:sum('kills'),deaths:sum('deaths')};
  advance(a,p,winnerId);
  if(a.status==='completed'&&reason==='draw-advance')a.titleByDraw=true;
}
function rateDraw(state:State,p:Fixture){
  const [a,b]=p.teamIds.map(id=>state.teams[id!]), beforeA=a.elo,beforeB=b.elo;
  const result=updateEloPair({rating:a.elo,grade:rank},{rating:b.elo,grade:rank},.5);
  a.elo=result.ratingA;b.elo=result.ratingB;
  recordRatedEloPeak(state,a,beforeA);recordRatedEloPeak(state,b,beforeB);
}
function rateFixture(state:State,p:Fixture,track=true){
  const winner=state.teams[p.winnerId!], loser=state.teams[p.loserId!];
  if(!winner||!loser)return;
  const beforeA=winner.elo,beforeB=loser.elo;
  const change=updateEloPair({rating:winner.elo,grade:rank},{rating:loser.elo,grade:rank},
    p.result!.reason==='runoff-seed'?.5:1);
  winner.elo=change.ratingA;loser.elo=change.ratingB;
  if(track){recordRatedEloPeak(state,winner,beforeA);recordRatedEloPeak(state,loser,beforeB);}
}
export const squadPeakLeaderboard=peakLeaderboard;
export function squadLeaderboard(state:State|null|undefined,limit=10){
  return Object.values(state?.teams??{}).filter(t=>t.wins+t.draws+t.losses+t.kills+t.deaths>0)
    .sort((a,b)=>b.elo-a.elo||b.titles-a.titles||b.wins-a.wins||b.kills/Math.max(1,b.deaths)-a.kills/Math.max(1,a.deaths)
      ||b.kills-a.kills||a.deaths-b.deaths||a.id.localeCompare(b.id))
    .slice(0,count(limit,120)).map((t,i)=>({...team(t)!,place:i+1,kdLabel:t.kills+'/'+t.deaths}));
}
function replayFrom(raw:ReplayWire|null|undefined,expected:Omit<Bout,'grade'|'rank'>){
  if(!raw||!Number.isInteger(raw.ruleset)||raw.ruleset<1||raw.seed!==expected.seed||raw.limit!==expected.limit||
    raw.terrain!==expected.terrain||raw.round!==expected.round||list(raw.teams).length!==2)return null;
  const teams=raw.teams.map(team);
  if(teams.some((t,i)=>!t||t.id!==expected.teamIds[i]||t.fighters.some((f,j)=>f.id!==expected.teams[i].fighters[j].id)))return null;
  // The vetted fixture supplies the actual roster; optional replay-only
  // metadata from the result cannot overwrite a fighter or gear.
  const ratings=raw.teams.map(t=>Number.isFinite(t?.combatElo)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,t.combatElo!)):1500);
  const recorded=raw.ruleset>=12?raw.teams.map((side,i)=>side.fighters.map((f,j)=>{
    const style=normalizeArcadeChessStyle(f.chessStyle);
    return f.id===expected.teams[i].fighters[j].id&&style!=='none'&&style!=='mixed'?style:null;
  })):null;
  if(recorded?.some(side=>side.some(style=>!style)))return null;
  const report=sanitizeMatchReport(raw.matchReport);
  const matchReport=raw.ruleset>=11&&report?.limit===expected.limit&&report.seed===expected.seed&&report.sides.length===10?{matchReport:report}:{};
  return {...matchReport,ruleset:raw.ruleset,seed:expected.seed,limit:expected.limit,terrain:expected.terrain,round:expected.round,
    stage:expected.stage,attempt:expected.attempt,id:expected.id,teams:expected.teams.map(({id,name,fighters,rank,grade},i)=>({...((raw.ruleset>=10)?{combatElo:ratings[i]}:{}),id,name,
      fighters:fighters.map(({chessStyle,...f},j)=>({...f,...(recorded?{chessStyle:recorded[i][j]}:{})})),
      rank,grade}))};
}
const running=new WeakSet<State>();
export function runSquadStep(state:State,simulate:(spec:Bout)=>AttemptWire|null|undefined){
  if(typeof simulate!=='function'||running.has(state))return null;
  const p=pending(state), spec=nextSquadBout(state);if(!p||!spec)return null;
  running.add(state);
  try{
    const answer=simulate(spec);
    if(!answer||typeof answer!=='object'||typeof answer.then==='function')throw new TypeError('Squad simulator must return a synchronous result');
    const attempt=cleanAttempt(answer,spec.teamIds,spec.limit,{enforceClockDraw:true});
    if(spec.attempt%2)for(const k of ['kills','deaths','damage'] as const)attempt[k].reverse();
    p.attempts.push(attempt);
    const replay=replayFrom(answer.replay,spec);
    if(replay)state.active!.lastReplay=replay;
    for(const [i,key] of p.teamIds.entries()){
      const t=state.teams[key!];t.kills+=attempt.kills[i];t.deaths+=attempt.deaths[i];
    }
    let winnerId=attempt.winnerId,reason=attempt.reason;
    const a=state.active!;
    if(!winnerId){
      for(const id of p.teamIds)state.teams[id!].draws++;
      rateDraw(state,p);
      if(p.attempts.length<3)return {id:p.id,status:'runoff',winnerId:null,attempt};
      // Fixed cap makes the bracket finish. Seed is administrative progress,
      // never a victory inferred from time, survivors, damage, or kills.
      winnerId=[...p.teamIds].sort((x,y)=>hash(x,spec.seed)-hash(y,spec.seed)||x!.localeCompare(y!))[0]!;
      reason='draw-advance';
    }
    seal(a,p,winnerId,reason);
    if(reason!=='draw-advance'){
      rateFixture(state,p);
      state.teams[winnerId].wins++;state.teams[p.loserId!].losses++;
    }
    if(a.status==='completed'){
      if(!a.titleByDraw){state.championId=winnerId;state.teams[winnerId].titles++;}
      state.history.push({season:a.season,championId:winnerId,runnerUpId:p.loserId!,quarterfinalistIds:[...a.quarterfinalistIds!],
        ...(a.titleByDraw?{titleByDraw:true}:{})});
      state.history=state.history.slice(-30);
    }
    return {id:p.id,status:'settled',winnerId,loserId:p.loserId,result:p.result,attempt};
  }finally{running.delete(state);}
}
export function loadSquadTournament(storage?:StorageReader|null){
  const state=blank();
  try{
    const serialized=storeFor(storage)?.getItem(SQUAD_TOURNAMENT_KEY);
    if(!serialized||serialized.length>1e6)return state;
    const raw=JSON.parse(serialized) as SaveWire;if(raw?.version!==1)return state;
    state.season=count(raw.season);
    state.peaks=readEloPeaks(raw.peaks,state.season,safeKey);
    for(const row of Object.values(obj(raw.teams)).slice(0,MAX_TEAM_RECORDS)){
      const t=team(row);if(t)state.teams[t.id]=t;
    }
    const baseline=()=>{if(!raw.peaks)for(const t of Object.values(state.teams))if(t.wins+t.losses+t.draws+t.kills+t.deaths>0)seedKnownEloPeak(state,t);};
    const has=(key:unknown):key is string=>Boolean(safeKey(key)&&Object.hasOwn(state.teams,key as string));
    state.championId=has(raw.championId)?raw.championId:null;
    state.history=list(raw.history).slice(-30).filter(r=>r?.season&&has(r.championId)&&has(r.runnerUpId))
      .map(r=>{
        const ids=[...new Set(list(r.quarterfinalistIds).slice(0,8))].filter((id):id is string=>Boolean(safeKey(id)));
        return {season:count(r.season),championId:r.championId!,runnerUpId:r.runnerUpId!,
          ...(r.titleByDraw===true?{titleByDraw:true}:{}),
          ...(ids.length===8&&ids.includes(r.championId!)&&ids.includes(r.runnerUpId!)?{quarterfinalistIds:ids}:{})};
      });
    const saved=raw.active, direct=list(saved?.directSeeds),playIn=list(saved?.playIn), entrants=[...direct,...playIn];
    if(saved?.season!==state.season||direct.length<8||direct.length>16||direct.length%2||playIn.length!==24-direct.length||new Set(entrants).size!==24||!entrants.every(has)){baseline();return state;}
    const a:Season={id:'q'+state.season.toString(36),season:state.season,seed:count(saved.seed,0xffffffff),limit:clock(saved.limit),
      terrain:terrainName(saved.terrain)!,rank,grade:rank,lastReplay:null,entrants,directSeeds:direct,playIn,...schedule(state.season,direct,playIn),championId:null,status:'running'};
    const savedMatches=[...list(saved.qualifiers),...list(saved.opening),...list(saved.rounds).flatMap(list)];
    const matches=allFixtures(a);
    for(let i=0;i<matches.length;i++){
      const p=matches[i], ref=savedMatches[i];
      if(!ref||p.id!==ref.id||p.teamIds.some((id,i)=>!id||id!==ref.teamIds?.[i]))break;
      p.attempts=list(ref.attempts).filter(r=>r&&typeof r==='object').slice(0,3).map(r=>cleanAttempt(r,p.teamIds,a.limit));
      if(p.teamIds.includes(ref.winnerId)&&p.attempts.length){
        seal(a,p,ref.winnerId,text(ref.result?.reason,40)||'match');
        // Old saves have only the currently retained fixture history.
        // Replay ratings in scheduled order once; do not alter real K/D.
        if(raw.ratingVersion!==RATING_VERSION&&p.result!.reason!=='draw-advance')rateFixture(state,p,false);
      }
      else{p.attempts=p.attempts.filter(r=>!r.winnerId).slice(0,2);break;}
    }
    const choice=matches.find(m=>m.id===saved.lastReplay?.id);
    if(choice&&Number.isInteger(saved.lastReplay?.attempt)&&saved.lastReplay!.attempt>=0&&saved.lastReplay!.attempt<choice.attempts.length){
      const attempt=saved.lastReplay!.attempt, teamIds=(attempt%2?[...choice.teamIds].reverse():[...choice.teamIds]) as string[];
      const expected={...choice,attempt,teamIds,teams:teamIds.map(key=>team(state.teams[key]!)!),
        seed:hash(choice.id+'/'+attempt,a.seed),limit:a.limit,terrain:tournamentFixtureTerrain(a,choice)!};
      a.lastReplay=replayFrom(saved.lastReplay,expected);
    }
    state.active=a;baseline();
    if(a.championId){
      if(!a.titleByDraw)state.championId=a.championId;
      const latest=state.history.at(-1);
      if(latest?.season===a.season)latest.quarterfinalistIds=[...a.quarterfinalistIds!];
    }
    return state;
  }catch{return blank();}
}
export function saveSquadTournament(state:State,storage?:StorageWriter|null){
  try{const target=storeFor(storage);if(!target)return false;target.setItem(SQUAD_TOURNAMENT_KEY,JSON.stringify(state));return true;}
  catch{return false;}
}
export function resetSquadTournament(state?:State|null){return state?Object.assign(state,blank()):blank();}

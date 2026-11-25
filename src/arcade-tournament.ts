import {notifyCloudSaveCommitted} from './cloud-save-commit.js';
import {arcadeChessStyleForId,normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {tournamentFixtureTerrain,tournamentTerrainOption} from './arcade-map-rotation.js?v=6.0.2';
import {sanitizeMatchReport} from './arcade-match-report.js?v=2.33.0';
import {peakLeaderboard,readEloPeaks,recordRatedEloPeak,seedKnownEloPeak} from './arcade-peak-elo.js?v=2.28.0';
import {sanitizeTournamentLoadout,validTournamentMove} from './arcade-tournament-adaptation.js?v=2.42.0';
import {fighterDisplayName,fighterNameKeysGiven as first,fighterNameKeysFamily as last,fighterNameParts,chooseRecruitFamily,fighterFamilyName} from './arcade-fighter-names.js?v=2.35.0';
/** Seeded 24- or 32-player ladder with a 16-slot main draw. Storage and combat are injected. */
import {ARCADE_FORM_IDS} from './arcade-engine.js?v=6.0.2';
import {SOLDIER_GRADES} from './progression.js?v=1.4.0';
import {ARCADE_MAPS} from './arcade-stage.js?v=6.0.2';
import {fighterGender,validFighterGender,appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';
import {clampElo,updateEloPair,ELO_SCALE,migrateLegacyElo} from './arcade-elo.js?v=2.18.5';
type Doctrine='balanced'|'aggressive'|'defensive';
type Body='woman'|'rabbit'|'femboy';
type Form='shii_cho'|'makashi'|'soresu'|'ataru'|'djem_so'|'niman'|'juyo';
type Weapon='single'|'dual'|'staff';
type Gear={weapon?:string;grip?:string;dualPhase?:boolean;forceFamily?:string;saberQuality?:string;forceQuality?:string};
type RawProfile={bouts?:number;wins?:number;variants?:Record<string,{bouts?:number;wins?:number;score?:number}>;observed?:Record<string,number>;loadouts?:unknown;lastDoctrine?:string};
type FighterInput=Gear&{id?:string;name?:string;form?:string;rank?:string;grade?:string;gear?:Gear;body?:string;gender?:string;elo?:number;appearanceSeed?:number;chessStyle?:string;
  profile?:RawProfile;adaptation?:RawProfile;wins?:number;draws?:number;losses?:number;kills?:number;deaths?:number;titles?:number;appearances?:number;lastSeason?:number};
type HeroInput=FighterInput&{eloFloorGrade?:string;eloCustomized?:boolean;sourceKind?:string;sourceTeamId?:string;sourceId?:string;savedSeason?:number};
type Fighter=NonNullable<ReturnType<typeof fighter>>;
type Hero=NonNullable<ReturnType<typeof hero>>;
type Peak=ReturnType<typeof readEloPeaks>[string];
type Stage='qualifier'|'opening'|'main';
type Attempt={winnerId:string|null;reason:string;time:number;kills:number[];deaths:number[];pressure:number[]};
type BracketResult=Omit<Attempt,'pressure'>&{loserId?:string|null;elapsed:number};
type Fixture={id:string;stage:Stage;round:number;index:number;fighterIds:(string|null)[];qualifierPath?:number;qualifierPrelim?:boolean;
  winnerId:string|null;loserId?:string|null;result:BracketResult|null;attempts:Attempt[]};
type Replay=NonNullable<ReturnType<typeof replaySnapshot>>;
type Active={id:string;season:number;seed:number;limit:number;terrain?:string;grade:string;status:'running'|'completed';titleByDraw:boolean;
  fieldSize:number;entrants:string[];directEntrants:string[];qualifiers:Fixture[];opening:Fixture[];rounds:Fixture[][];championId:string|null;lastReplay:Replay|null};
type State={version:number;eloScale:number;season:number;championId:string|null;active:Active|null;records:Record<string,Fighter>;heroes:Record<string,Hero>;peaks:Record<string,Peak>;history:Season[]};
type Season={titleByDraw:boolean;season:number;championId:string|null;championName:string;runnerUpId?:string|null;seed:number};
type SquadSource={season:number;teams?:Record<string,{id:string;wins?:number;draws?:number;losses?:number;fighters?:FighterInput[]}>};
type Update=RawProfile&{profile?:RawProfile};
type AttemptInput={winnerId?:string|null;winner?:string|null;winnerIndex?:number;kills?:number[];deaths?:number[];pressure?:number[];score?:number[];stats?:{kills?:number;deaths?:number;saberHits?:number}[];
  reason?:string;time?:number;elapsed?:number;then?:unknown;profiles?:Update[];adaptations?:Update[];replay?:ReplayInput|null};
type ReplayInput={fought?:unknown;seed:number;round:number;limit:number;terrain:string;grade:string;ruleset:number;fighters:(FighterInput&{combatElo?:number})[];
  plans:{doctrine:string;move?:string}[];matchReport?:unknown};
type SavedActive=Omit<Partial<Active>,'lastReplay'>&{lastReplay?:ReplayInput|null};
type Save={version?:number;season?:number;peaks?:unknown;eloScale?:number;records?:Record<string,FighterInput>;heroes?:Record<string,HeroInput>;
  championId?:string;history?:Season[];active?:SavedActive|null};
type StorageReader={getItem(key:string):string|null|undefined};
type StorageWriter=Pick<Storage,'setItem'>;
export const TOURNAMENT_HERO_GRADE='SSS+V';
export const TOURNAMENT_KEY='saber-pit:tournament:1';
const VERSION=1, MAX_RECORDS=240,MAX_HEROES=30,MAX_HISTORY=40,MAX_ATTEMPTS=3;
const SOLO_RECRUIT_SLOTS=4;
const grades=new Set(SOLDIER_GRADES.map(g=>g.label));
const forms=ARCADE_FORM_IDS;
const doctrine:Doctrine[]=['balanced','aggressive','defensive'];
const measures=['accuracy','pressure','guardRate','forceRate','whiffRate','counterRate'];
const count=(v:unknown,max=1e6)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(0,Math.trunc(v))):0;
const decimal=(v:unknown,a:number,b:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(a,Math.min(b,Math.round(v*1e5)/1e5)):0;
const arr=<T>(v:T[]|undefined|null):T[]=>Array.isArray(v)?v:[];
const text=(v:unknown,max=60)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,max):'';
const id=(v:unknown)=>typeof v==='string'&&/^[a-z][a-z0-9-]{1,39}$/.test(v)?v:null;
const terrainName=tournamentTerrainOption;
const gradeName=(v:unknown)=>grades.has(v as string)?v as string:'A';
const clock=(v:unknown)=>[45,75,90,150,360].includes(v as number)?v as number:75;
function hash(value:unknown,initial=2166136261){let n=initial;for(const c of String(value))n=Math.imul(n^c.codePointAt(0)!,16777619);return n>>>0;}
function seedValue(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)?value>>>0:hash(text(value)||'saber-pit');}
function random(value:number){let u=value>>>0;return()=>{u+=0x6D2B79F5;let t=u;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function profile(value?:RawProfile|null){
  const bouts=count(value?.bouts),wins=count(value?.wins,bouts);
  const variants=Object.fromEntries(doctrine.map(name=>{
    const row=value?.variants?.[name],n=count(row?.bouts,bouts);
    return [name,{bouts:n,wins:count(row?.wins,n),score:decimal(row?.score,-n,n)}];
  }));
  const loadouts=sanitizeTournamentLoadout(value?.loadouts);
  return {bouts,wins,...(loadouts?{loadouts}:{}),lastDoctrine:doctrine.includes(value?.lastDoctrine as Doctrine)?value!.lastDoctrine as Doctrine:'balanced',variants,
    observed:Object.fromEntries(measures.map(key=>[key,decimal(value?.observed?.[key],0,1)]))};
}
function fighter(raw?:FighterInput|null){
  const key=id(raw?.id),name=text(raw?.name,48);
  if(!raw||!key||!name||!forms.includes(raw.form!))return null;
  const weapon=['single','dual','staff'].includes((raw.weapon??raw.gear?.weapon)!)?(raw.weapon??raw.gear?.weapon) as Weapon:'single';
  const grip=weapon!=='staff'&&(raw.grip??raw.gear?.grip)==='backhand'?'backhand':'forward';
  const dualPhase=(raw.dualPhase??raw.gear?.dualPhase)===true;
  const rank=gradeName(raw.rank??raw.grade), p=profile(raw.profile??raw.adaptation);
  const forceFamily=['force_push','force_burst','force_pulse'].includes(raw.gear?.forceFamily!)?raw.gear!.forceFamily!:'force_push';
  const body:Body=['woman','rabbit'].includes(raw.body!)?raw.body as Body:'femboy';
  return {id:key,name:fighterDisplayName(key,name),chessStyle:arcadeChessStyleForId(key),form:raw.form as Form,rank,grade:rank,body,gender:fighterGender(raw.gender,body,key),appearanceSeed:appearanceSeedFor(key),
    weapon,grip,dualPhase,gear:{weapon,grip,dualPhase,forceFamily},profile:p,adaptation:p,elo:clampElo(raw.elo,rank),
    wins:count(raw.wins),draws:count(raw.draws),losses:count(raw.losses),kills:count(raw.kills),deaths:count(raw.deaths),
    titles:count(raw.titles),appearances:count(raw.appearances),lastSeason:count(raw.lastSeason)};
}
const blank=():State=>({version:VERSION,eloScale:ELO_SCALE,season:0,championId:null,active:null,records:{},heroes:{},peaks:{},history:[]});
/** Squad IDs are already canonical, stable across seasons and disjoint
 * from solo's f-* namespace. Never derive identity from editable names. */
export function squadTournamentHeroId(teamId:unknown,fighterId:unknown){
  return typeof teamId==='string'&&/^q[0-9a-z]+-t[0-9a-z]+$/.test(teamId)&&
    typeof fighterId==='string'&&fighterId.slice(0,-3)===teamId&&
    /^-f[1-5]$/.test(fighterId.slice(-3))?id(fighterId):null;
}
function hero(raw:HeroInput){
  const result=fighter({...raw,rank:TOURNAMENT_HERO_GRADE,grade:TOURNAMENT_HERO_GRADE});
  const eloFloorGrade=grades.has(raw?.eloFloorGrade!)?raw.eloFloorGrade!:TOURNAMENT_HERO_GRADE;
  if(!result)return null;
  const fromSquad=raw.sourceKind==='squad'&&squadTournamentHeroId(raw.sourceTeamId,result.id)===result.id;
  const style=normalizeArcadeChessStyle(raw.chessStyle);
  const appearance=Number.isSafeInteger(raw.appearanceSeed)&&raw.appearanceSeed!>=0&&raw.appearanceSeed!<=0xffffffff?
    raw.appearanceSeed:result.appearanceSeed;
  if(fromSquad)Object.assign(result,{sourceKind:'squad',sourceTeamId:raw.sourceTeamId,appearanceSeed:appearance,
    chessStyle:style==='none'||style==='mixed'?result.chessStyle:style});
  return {...result as typeof result & {sourceKind?:'squad';sourceTeamId?:string},elo:clampElo(raw.elo,eloFloorGrade),eloFloorGrade,eloCustomized:raw.eloCustomized===true,
    sourceId:fromSquad?result.id:id(raw.sourceId)??result.id,savedSeason:count(raw.savedSeason)};
}
function rankCompare(a:Fighter,b:Fighter){
  const kd=(f:Fighter)=>f.deaths===0&&f.kills>0?Infinity:f.kills/Math.max(1,f.deaths);
  return b.elo-a.elo||b.titles-a.titles||b.wins-a.wins||kd(b)-kd(a)||b.kills-a.kills||a.deaths-b.deaths||a.losses-b.losses||a.id.localeCompare(b.id);
}
type EligibleRecord={rank?:string;wins?:number;draws?:number;losses?:number;kills?:number;deaths?:number;profile?:{bouts?:number}};
const hasFought=(f:EligibleRecord)=>f.wins!+(f.draws??0)+f.losses!+f.profile?.bouts!+f.kills!+f.deaths!>0;
export const tournamentPeakLeaderboard=peakLeaderboard;
export function tournamentLeaderboard(state:State|null|undefined,limit=10){
  return Object.values(state?.records??{}).filter(hasFought).sort(rankCompare).slice(0,Math.min(10,count(limit,10)))
    .map((f,i)=>({...fighter(f)!,place:i+1,kd:f.deaths?f.kills/f.deaths:null,kdLabel:`${f.kills}/${f.deaths}`}));
}
export function tournamentHeroes(state?:State|null){return Object.values(state?.heroes??{}).map(hero).filter((entry):entry is Hero=>Boolean(entry)).sort((a,b)=>b.savedSeason-a.savedSeason||a.id.localeCompare(b.id));}
export const tournamentHeroEligible=<T extends EligibleRecord>(record:T|null|undefined):record is T=>Boolean(record&&record.rank===TOURNAMENT_HERO_GRADE&&hasFought(record));
export function saveTournamentHero(state:State,fighterId:unknown){
  const key=id(fighterId),source=key&&Object.hasOwn(state.records,key)?state.records[key]:null;
  if(!tournamentHeroEligible(source))return null;
  if(!state.heroes[source.id]&&Object.keys(state.heroes).length>=MAX_HEROES)return null;
  const prior=state.heroes[source.id];
  const customization=prior?.eloCustomized?{elo:prior.elo,eloFloorGrade:prior.eloFloorGrade,eloCustomized:true}:{};
  const snapshot=hero({...source,...customization,gender:prior?.gender??source.gender,sourceId:source.id,savedSeason:state.season});
  state.heroes[source.id]=snapshot!;
  return hero(snapshot!);
}
function squadHeroSource(squadState:SquadSource|null|undefined,teamId:string,fighterId:unknown){
  const key=squadTournamentHeroId(teamId,fighterId), teams=squadState?.teams;
  if(!key||!teams||!Object.hasOwn(teams,teamId))return null;
  const team=teams[teamId];
  if(team?.id!==teamId||count(team.wins)+count(team.draws)+count(team.losses)===0||!Array.isArray(team.fighters))return null;
  const members=team.fighters.filter(member=>member?.id===key);
  const member=members[0];
  return members.length===1&&member.rank===TOURNAMENT_HERO_GRADE&&forms.includes(member.form!)&&text(member.name,48)?member:null;
}
export function squadTournamentHeroEligible(squadState:SquadSource|null|undefined,teamId:string,fighterId:unknown){
  return Boolean(squadHeroSource(squadState,teamId,fighterId));
}
export function saveSquadTournamentHero(soloState:State,squadState:SquadSource,teamId:string,fighterId:unknown){
  const member=squadHeroSource(squadState,teamId,fighterId);
  if(!member||!member.id||!soloState?.heroes||!soloState.records||Object.hasOwn(soloState.records,member.id))return null;
  const prior=Object.hasOwn(soloState.heroes,member.id)?soloState.heroes[member.id]:null;
  if((prior&&prior.sourceKind!=='squad')||(!prior&&Object.keys(soloState.heroes).length>=MAX_HEROES))return null;
  const customization=prior?.eloCustomized?{elo:prior.elo,eloFloorGrade:prior.eloFloorGrade,eloCustomized:true}:{};
  // Team Elo, team totals and match wins cannot be attributed to a member.
  // The Hero is a snapshot of this fighter, with only their rank's Elo floor.
  const snapshot=hero({id:member.id,name:member.name,form:member.form,body:member.body,
    gender:prior?.gender??member.gender,appearanceSeed:member.appearanceSeed,chessStyle:member.chessStyle,
    gear:member.gear,...customization,sourceKind:'squad',sourceTeamId:teamId,
    sourceId:member.id,savedSeason:squadState.season});
  if(!snapshot)return null;
  soloState.heroes[member.id]=snapshot;
  return hero(snapshot!);
}
export function removeTournamentHero(state:State|null|undefined,fighterId:unknown){
  const key=id(fighterId);
  if(!key||!state?.heroes||!Object.hasOwn(state.heroes,key))return false;
  return delete state.heroes[key!];
}
export function setTournamentHeroElo(state:State,fighterId:unknown,rating:number,floorGrade:unknown){
  const key=id(fighterId), row=key&&state?.heroes?.[key];
  const floor=typeof floorGrade==='string'?floorGrade.toUpperCase().replace(/\s+/g,'').replace(/\(ENTRY\)$/,''):'';
  if(!key||!row||!grades.has(floor)||!(Number.isSafeInteger(rating)||Number.isSafeInteger(rating*2))||rating<0)return null;
  const updated=hero({...row,elo:rating,eloFloorGrade:floor,eloCustomized:true});
  state.heroes[key]=updated!;return hero(updated!);
}
export function setTournamentHeroGender(state:State,fighterId:unknown,gender:unknown){
  const key=id(fighterId),row=key&&state?.heroes?.[key];
  if(!key||!row||!validFighterGender(gender))return null;
  const updated=hero({...row,gender});
  state.heroes[key]=updated!;return hero(updated!);
}
export function resetTournament(state:State|null|undefined){
  if(!state||settling.has(state))return state;
  const heroes=Object.fromEntries(tournamentHeroes(state).map(h=>[h.id,h]));
  return Object.assign(state,blank(),{heroes});
}
function makeQualifiers(season:number,entrants:string[],direct:number):Fixture[]{
  if(entrants.length===32){
    const prelims:Fixture[]=[],finals:Fixture[]=[],extras=32-direct-16;
    const build=(key:string,index:number,fighterIds:(string|null)[],qualifierPath:number,qualifierPrelim=false):Fixture=>({
      id:`s${season}-q-${key}`,stage:'qualifier',round:1,index,fighterIds,qualifierPath,qualifierPrelim,
      winnerId:null,loserId:null,result:null,attempts:[]
    });
    for(let path=0,cursor=direct;path<8;path++){
      if(path<extras){
        prelims.push(build('p-b'+(path+1),prelims.length,[entrants[cursor++],entrants[cursor++]],path,true));
        finals.push(build('b'+(path+1),extras+path,[entrants[cursor++],null],path));
      }else finals.push(build('b'+(path+1),extras+path,[entrants[cursor++],entrants[cursor++]],path));
    }
    return [...prelims,...finals];
  }
  return entrants.length===24?Array.from({length:(24-direct)/2},(_,i)=>({
    id:`s${season}-q-b${i+1}`,stage:'qualifier',round:1,index:i,fighterIds:entrants.slice(direct+i*2,direct+2+i*2),
    winnerId:null,loserId:null,result:null,attempts:[]
  })):[];
}
function schedule(season:number,entrants:string[],direct:number){
  const qualifiers=makeQualifiers(season,entrants,direct);
  const wide=entrants.length===32;
  const extras=Math.max(0,direct+(wide?8:qualifiers.length)-16);
  const opening:Fixture[]=Array.from({length:extras},(_,i)=>({
    id:`s${season}-o-b${i+1}`,stage:'opening',round:1,index:i,fighterIds:[entrants[direct-extras+i],null],
    winnerId:null,loserId:null,result:null,attempts:[]
  }));
  const seeds=entrants.length===16?entrants:wide||extras===0?entrants.slice(0,8).flatMap(key=>[key,null]):
    [...entrants.slice(0,direct-extras),...Array(16-direct+extras).fill(null)];
  const rounds:Fixture[][]=[8,4,2,1].map((n,r)=>Array.from({length:n},(_,i)=>({
    id:`s${season}-r${r+1}-b${i+1}`,stage:"main",round:r+1,index:i,fighterIds:r===0?seeds.slice(i*2,i*2+2):[null,null],
    winnerId:null,loserId:null,result:null,attempts:[]
  })));
  return {qualifiers,opening,rounds};
}
function advanceFixture(a:Active,p:Fixture,winnerId:string){
  const extra=a.opening?.length??0;
  const direct=a.directEntrants.length;
  const put=(slot:number)=>{a.rounds[0][Math.floor(slot/2)].fighterIds[slot%2]=winnerId;};
  if(a.entrants.length===32){
    if(p.stage==='qualifier'){
      if(p.qualifierPrelim)a.qualifiers[a.qualifiers.length-8+p.qualifierPath!].fighterIds[1]=winnerId;
      else if(p.qualifierPath!<extra)a.opening[p.qualifierPath!].fighterIds[1]=winnerId;
      else put(p.qualifierPath!*2+1);
      return true;
    }
    if(p.stage==='opening'){put(p.index*2+1);return true;}
  }
  if(p.stage==='qualifier'){
    if(!extra)put(p.index*2+1);
    else if(p.index<extra)a.opening[p.index].fighterIds[1]=winnerId;
    else put(direct+p.index-extra);
    return true;
  }
  if(p.stage==='opening'){put(direct-extra+p.index);return true;}
  const following=a.rounds[p.round];
  if(following){following[Math.floor(p.index/2)].fighterIds[p.index%2]=winnerId;return true;}
  return false;
}
function keepRecords(state:State){
  const retained=new Set([state.championId,...Object.keys(state.heroes).filter(key=>state.heroes[key]?.sourceKind!=='squad'),...arr(state.active?.entrants),
    ...Object.values(state.records).filter(hasFought).sort(rankCompare).slice(0,32-SOLO_RECRUIT_SLOTS).map(f=>f.id)]);
  const items=Object.values(state.records).sort((a,b)=>b.lastSeason-a.lastSeason||rankCompare(a,b));
  for(const f of items)if(retained.size<MAX_RECORDS)retained.add(f.id);
  state.records=Object.fromEntries(items.filter(f=>retained.has(f.id)).map(f=>[f.id,f]));
}
function recruit(state:State,seed:number,index:number,rank:string,used:Set<string>,usedFamilies:Set<string>):Fighter{
  const r=random(hash(`${seed}/${state.season}/${index}`));let n=hash(`fighter:${seed}:${state.season}:${index}`);
  let given:string, family:string,key:string;
  for(let tryIndex=0;tryIndex<first.length*last.length;tryIndex++,n+=29){
    given=first[n%first.length];family=last[Math.floor(n/first.length)%last.length];
    key=`f-${given.toLowerCase()}-${family.toLowerCase()}`;
    if(!used.has(key)&&!state.records[key]&&!state.heroes[key])break;
  }
  if(used.has(key!)||state.records[key!]||state.heroes[key!]){
    const base=`${state.season.toString(36)}-${index.toString(36)}`;
    let bump=0,unique=base;
    do{
      unique=bump?`${base}-${bump.toString(36)}`:base;
      key=`f-${unique}`;bump++;
    }while(used.has(key)||state.records[key]||state.heroes[key]);
    family!+=` ${unique.toUpperCase()}`;
  }
  const kit=[['single','forward'],['single','forward'],['dual','forward'],['single','backhand'],['dual','backhand'],['staff','forward']][Math.floor(r()*6)];
  const firstParts=fighterNameParts(first.indexOf(given!),last.indexOf(family!.split(' ')[0]))[0];
  const newFamily=chooseRecruitFamily(hash('display-name:'+key!,seed),usedFamilies);
  usedFamilies.add(newFamily);
  return fighter({id:key!,name:(firstParts?.join('')||given!)+' '+newFamily,form:forms[Math.floor(r()*forms.length)],rank,
    body:['femboy','woman','rabbit'][Math.floor(r()*3)],weapon:kit[0],grip:kit[1],dualPhase:r()<.26,lastSeason:state.season})!;
}
/** Calling Start while a bracket is active resumes it rather than losing results. */
export function startTournament(state:State,{seed=state.season+1,limit=75,terrain='underpit',fieldSize=24}={}){
  if(state.active?.status==='running'){raiseActiveRank(state);return state;}
  const prior=state.active?.status==='completed'?state.active.rounds?.[0]??[]:[];
  const quarterfinalists=prior.map(p=>p.winnerId).filter((key):key is string=>Boolean(key&&Object.hasOwn(state.records,key)));
  state.season++;
  seed=seedValue(seed);const season=state.season,rank=TOURNAMENT_HERO_GRADE;
  const ranked=tournamentLeaderboard(state,10).map(row=>row.id);
  const returning=[...new Set([...ranked.slice(0,8),...quarterfinalists])];
  const protectedLCQ=[...new Set([...ranked.slice(8),state.championId])]
    .filter((key):key is string=>Boolean(key&&Object.hasOwn(state.records,key)&&!returning.includes(key)));
  const size=Number(fieldSize)===32?32:24;
  const pool:string[]=[], used=new Set([...returning,...protectedLCQ]);
  // Fill qualifier places with real rated competitors before using
  // new recruits. Keep the direct-seed rules and at least four new seats.
  const veterans=Object.values(state.records).filter(row=>hasFought(row)&&!used.has(row.id)).sort(rankCompare);
  const extraSlots=Math.max(0,size-SOLO_RECRUIT_SLOTS-used.size);
  for(const veteran of veterans.slice(0,extraSlots)){protectedLCQ.push(veteran.id);used.add(veteran.id);}
  const usedFamilies=new Set([...Object.values(state.records),...Object.values(state.heroes).filter(hero=>hero?.sourceKind!=='squad'),...Object.values(state.peaks??{})]
    .map(row=>fighterFamilyName(row.name)).filter(Boolean));
  for(let i=used.size;i<size;i++){
    const recruitRecord=recruit(state,seed,i,rank,used,usedFamilies);
    state.records[recruitRecord.id]=recruitRecord;pool.push(recruitRecord.id);used.add(recruitRecord.id);
  }
  const r=random(hash(`bracket:${season}`,seed));
  const shuffle=(list:string[])=>{for(let i=list.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
  shuffle(pool);
  const direct=Math.max(8,returning.length+(returning.length%2));
  const fill=pool.splice(0,direct-returning.length);
  const entrants=[...returning,...fill,...(protectedLCQ.length?shuffle([...protectedLCQ,...pool]):pool)];
  for(const key of entrants){state.records[key].appearances++;state.records[key].lastSeason=season;}
  state.active={id:`s${season}`,season,seed,limit:clock(limit),terrain:terrainName(terrain),grade:rank,
    status:'running',titleByDraw:false,fieldSize:entrants.length,entrants,directEntrants:entrants.slice(0,direct),...schedule(season,entrants,direct),championId:null,lastReplay:null};
  raiseActiveRank(state);keepRecords(state);
  return state;
}
function raiseActiveRank(state:State){
  const a=state.active;
  if(a?.status!=='running')return;
  a.grade=TOURNAMENT_HERO_GRADE;
  for(const key of a.entrants){
    const f=state.records[key];
    if(f){f.rank=f.grade=TOURNAMENT_HERO_GRADE;f.elo=clampElo(f.elo,f.rank);}
  }
}
function pending(state:State|null|undefined){
  if(state?.active?.status!=='running')return null;
  return [...(state.active.qualifiers??[]),...(state.active.opening??[]),...state.active.rounds.flat()].find(b=>!b.result&&b.fighterIds.every(Boolean))??null;
}
export function nextTournamentBout(state:State){
  const p=pending(state);if(!p)return null;
  const a=state.active!, attempt=p.attempts.length;
  // Swap colors on a tie while keeping normalized stats indexed by fixture slot.
  const fighterIds=attempt%2?[p.fighterIds[1],p.fighterIds[0]]:[...p.fighterIds];
  const fighters=fighterIds.map(key=>fighter(state.records[key!])!);
  const [left,right]=fighters;
  return {id:p.id,stage:p.stage??'main',round:p.round,index:p.index,attempt,fighterIds,fighters,left,right,grade:a.grade,
    seed:hash(p.id+'/'+attempt,a.seed),limit:a.limit,terrain:tournamentFixtureTerrain(a,p)};
}
function cleanAttempt(raw:AttemptInput,slots:(string|null)[],limit:number):Attempt{
  const inputKills=raw.kills??arr(raw.stats).map(b=>b?.kills);
  const inputDeaths=raw.deaths??arr(raw.stats).map(b=>b?.deaths);
  const deaths=[count(inputDeaths?.[0],1),count(inputDeaths?.[1],1)];
  const kills=[count(inputKills?.[0],deaths[1]),count(inputKills?.[1],deaths[0])];
  const winnerId=slots.includes(raw.winnerId!)?raw.winnerId!:slots.includes(raw.winner!)?raw.winner!:
    [0,1].includes(raw.winnerIndex!)?slots[raw.winnerIndex!]:null;
  const reason=text(raw.reason,32)||'match';
  const pressure=[0,1].map(i=>count(raw.pressure?.[i]??raw.score?.[i]??raw.stats?.[i]?.saberHits??0,10000));
  return {winnerId,reason,time:decimal(raw.time??raw.elapsed,0,limit),kills,deaths,pressure};
}
function replaySnapshot(value:ReplayInput|null|undefined){
  if(!value||!Number.isSafeInteger(value.seed)||!Number.isInteger(value.round)||value.round<1||value.round>4||
     ![45,75,90,150,360].includes(value.limit)||!Object.hasOwn(ARCADE_MAPS,value.terrain)||!grades.has(value.grade))return null;
  const sides=value.fighters,plans=value.plans;
  if(!Array.isArray(sides)||sides.length!==2||!Array.isArray(plans)||plans.length!==2||plans.some(p=>!doctrine.includes(p?.doctrine as Doctrine)))return null;
  const qualities=['worn','standard','improved'];
  const safeFighters=sides.map(raw=>{
    const f=fighter(raw);
    if(!f)return null;
    const gear=raw.gear??{};
    const family=['force_push','force_burst','force_pulse'].includes(gear.forceFamily!)?gear.forceFamily!:'force_push';
    const rating=raw.combatElo;
    const chessStyle=normalizeArcadeChessStyle(raw.chessStyle);
    if(value.ruleset>=13&&(chessStyle==='none'||chessStyle==='mixed'))return null;
    return {...(value.ruleset>=13?{chessStyle}:{}),...(value.ruleset>=11?{combatElo:Number.isFinite(rating)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,rating!)):1500}:{}),id:f.id,name:f.name,form:f.form,body:f.body,gender:f.gender,appearanceSeed:f.appearanceSeed,grade:f.grade,rank:f.rank,
      gear:{...f.gear,forceFamily:family,saberQuality:qualities.includes(gear.saberQuality!)?gear.saberQuality!:'standard',
        forceQuality:qualities.includes(gear.forceQuality!)?gear.forceQuality!:'standard'}};
  });
  if(safeFighters.some(f=>!f)||safeFighters[0]!.id===safeFighters[1]!.id)return null;
  const report=sanitizeMatchReport(value.matchReport);
  const matchReport=value.ruleset>=12&&report?.limit===value.limit&&report.seed===(value.seed>>>0)&&report.sides.length===2?{matchReport:report}:{};
  // A bout the person fought keeps that mark in the bracket, so a restore without its controls never shows an AI replay.
  return {...matchReport,...(value.fought===true?{fought:true as const}:{}),ruleset:Number.isSafeInteger(value.ruleset)&&value.ruleset>=1?value.ruleset:1,seed:value.seed>>>0,round:value.round,limit:value.limit,terrain:value.terrain,grade:value.grade,
    fighters:safeFighters as NonNullable<typeof safeFighters[number]>[],plans:plans.map((p,i)=>({doctrine:p.doctrine,...(validTournamentMove(p.move,safeFighters[i]!.form,value.grade)?{move:p.move}:{})}))};
}
function alignedAttempt(attempt:Attempt,original:(string|null)[],simOrder:(string|null)[]){
  if(original[0]===simOrder[0])return attempt;
  return {...attempt,kills:[...attempt.kills].reverse(),deaths:[...attempt.deaths].reverse(),pressure:[...attempt.pressure].reverse()};
}
function settle(state:State,p:Fixture,winnerId:string,reason:string,attempt:Attempt){
  const active=state.active!;
  const loserId=p.fighterIds.find(x=>x!==winnerId);
  p.winnerId=winnerId;p.loserId=loserId;
  const sum=(k:'kills'|'deaths')=>[0,1].map(i=>p.attempts.reduce((n,r)=>n+r[k][i],0));
  p.result={winnerId,loserId,reason,time:attempt.time,elapsed:attempt.time,kills:sum('kills'),deaths:sum('deaths')};
  const winner=state.records[winnerId], loser=state.records[loserId!];
  const rankOrder=[...grades], playedIndex=rankOrder.indexOf(active.grade);
  for(const f of [winner,loser]){
    if(playedIndex>rankOrder.indexOf(f.rank))f.rank=f.grade=active.grade;
    f.elo=clampElo(f.elo,f.rank);
  }
  const drawAdvance=reason==='draw-advance';
  if(!drawAdvance){
    rateAttempt(state,winner,loser,1);
    winner.wins++;
    loser.losses++;
  }
  if(!advanceFixture(active,p,winnerId)){
    active.status='completed';active.championId=winnerId;state.championId=winnerId;
    active.titleByDraw=drawAdvance;
    if(!drawAdvance)state.records[winnerId].titles++;
    state.history.push({titleByDraw:drawAdvance,season:active.season,championId:winnerId,championName:state.records[winnerId].name,runnerUpId:loserId,seed:active.seed});
    state.history=state.history.slice(-MAX_HISTORY);keepRecords(state);
  }
}
function rateAttempt(state:State,a:Fighter,b:Fighter,scoreA:0|.5|1){
  const beforeA=a.elo,beforeB=b.elo;
  const {ratingA,ratingB}=updateEloPair({rating:a.elo,grade:a.rank},{rating:b.elo,grade:b.rank},scoreA);
  a.elo=ratingA;b.elo=ratingB;
  recordRatedEloPeak(state,a,beforeA);recordRatedEloPeak(state,b,beforeB);
}
const settling=new WeakSet<State>();
export function runTournamentStep(state:State,simulate:(fixture:NonNullable<ReturnType<typeof nextTournamentBout>>)=>AttemptInput){
  const p=pending(state);if(!p||typeof simulate!=='function'||settling.has(state))return null;
  const input=nextTournamentBout(state)!;
  settling.add(state);
  try{
    const result=simulate(input);
    if(!result||typeof result!=='object'||typeof result.then==='function')throw new TypeError('Tournament simulator must return a synchronous bout result');
    if(p!==pending(state)||p.attempts.length!==input.attempt)return null;
    const attempt=alignedAttempt(cleanAttempt(result,input.fighterIds,input.limit),p.fighterIds,input.fighterIds);
    if(attempt.reason==='timeout'||attempt.reason==='draw')attempt.winnerId=null;
    const draw=!attempt.winnerId;
    const updates=result.profiles??result.adaptations;
    const replay=replaySnapshot(result.replay);
    const verified=replay&&replay.seed===input.seed&&replay.round===input.round&&replay.limit===input.limit&&replay.terrain===input.terrain&&
       replay.grade===input.grade&&replay.fighters.every((f,i)=>f.id===input.fighterIds[i])?replay:null;
    for(const [i,key] of p.fighterIds.entries()){
      const f=state.records[key!],update=updates?.[input.fighterIds.indexOf(key)];
      f.kills+=attempt.kills[i];f.deaths+=attempt.deaths[i];
      if(draw)f.draws=(f.draws??0)+1;
      if(update){f.profile=profile(update.profile??update);f.adaptation=f.profile;}
      const used=verified?.fighters[input.fighterIds.indexOf(key)];
      if(used&&used.form===f.form&&f.profile.loadouts){
        const {weapon,grip,dualPhase}=used.gear;
        Object.assign(f,{weapon,grip,dualPhase,gear:{...f.gear,...used.gear}});
        const snapshot=state.heroes[key!];
        if(snapshot)state.heroes[key!]=hero({...snapshot,weapon,grip,dualPhase,gear:used.gear,profile:f.profile})!;
      }
    }
    if(draw)rateAttempt(state,...p.fighterIds.map(id=>state.records[id!]) as [Fighter,Fighter],.5);
    p.attempts.push(attempt);
    if(verified)state.active!.lastReplay=verified;
    let winnerId=attempt.winnerId,reason=attempt.reason;
    if(!winnerId&&p.attempts.length>=MAX_ATTEMPTS){
      winnerId=[...p.fighterIds].sort((a,b)=>hash(a,state.active!.seed)-hash(b,state.active!.seed)||a!.localeCompare(b!))[0];
      reason='draw-advance';
    }
    if(winnerId)settle(state,p,winnerId,reason,attempt);
    return {...p,status:p.result?'settled':'runoff'};
  }finally{settling.delete(state);}
}
function validatedActive(raw:SavedActive|null|undefined,state:State){
  if(!raw||count(raw?.season)!==state.season||!state.season)return null;
  const entrants=arr(raw.entrants).map(id) as string[];
  if(![16,24,32].includes(entrants.length)||new Set(entrants).size!==entrants.length||entrants.some(key=>!key||!Object.hasOwn(state.records,key)))return null;
  if(raw.fieldSize!=null&&raw.fieldSize!==entrants.length)return null;
  const direct=entrants.length===16?16:raw.directEntrants?.length??8;
  if(![8,10,12,14,16].includes(direct)||((entrants.length===32||direct!==8&&entrants.length===24)&&
     (!Array.isArray(raw.directEntrants)||raw.directEntrants.some((key,i)=>key!==entrants[i]))))return null;
  const a:Active={id:`s${state.season}`,season:state.season,seed:seedValue(raw.seed),limit:clock(raw.limit),terrain:terrainName(raw.terrain),
    grade:gradeName(raw.grade),status:'running',titleByDraw:false,fieldSize:entrants.length,entrants,directEntrants:entrants.slice(0,direct),...schedule(state.season,entrants,direct),championId:null,lastReplay:null};
  let open=false;
  for(const row of [a.qualifiers,a.opening,...a.rounds])for(const p of row){
    const saved=p.stage==='qualifier'?raw.qualifiers?.[p.index]:p.stage==='opening'?raw.opening?.[p.index]:raw.rounds?.[p.round-1]?.[p.index];
    if(open||!p.fighterIds.every(Boolean)||!saved||saved.id!==p.id){open=true;continue;}
    p.attempts=arr(saved.attempts).slice(0,MAX_ATTEMPTS).map(attempt=>cleanAttempt(attempt??{},p.fighterIds,a.limit));
    const winnerId=saved.result&&p.fighterIds.includes(saved.winnerId)?saved.winnerId:null;
    if(!winnerId){p.attempts=p.attempts.filter(x=>!x.winnerId).slice(0,MAX_ATTEMPTS-1);open=true;continue;}
    if(!p.attempts.length){open=true;continue;}
    const loserId=p.fighterIds.find(x=>x!==winnerId), final=p.attempts.at(-1)!;
    const sum=(k:'kills'|'deaths')=>[0,1].map(i=>p.attempts.reduce((n,r)=>n+r[k][i],0));
    p.winnerId=winnerId;p.loserId=loserId;
    p.result={winnerId,loserId,reason:text(saved.result!.reason,32)||'match',time:final.time,elapsed:final.time,kills:sum('kills'),deaths:sum('deaths')};
    if(!advanceFixture(a,p,winnerId)){a.championId=winnerId;a.status='completed';a.titleByDraw=p.result.reason==='draw-advance';}
  }
  const replay=replaySnapshot(raw.lastReplay);
  if(replay&&replay.limit===a.limit&&
    [...(replay.round===1?[...a.qualifiers,...a.opening]:[]),...a.rounds[replay.round-1]].some(b=>
    replay.terrain===tournamentFixtureTerrain(a,b)&&b.attempts.some((_,i)=>replay.seed===hash(b.id+'/'+i,a.seed)&&replay.fighters.every((f,j)=>f.id===b.fighterIds[i%2?1-j:j]))))
    a.lastReplay=replay;
  return a;
}
function storageFor<T>(storage?:T|null){
  if(storage!==undefined)return storage;
  try{return globalThis.localStorage;}catch{return null;}
}
export function loadTournament(storage?:StorageReader|null){
  try{
    const serialized=storageFor(storage)?.getItem(TOURNAMENT_KEY);
    if(!serialized||serialized.length>1e6)return blank();
    const raw=JSON.parse(serialized) as Save;if(raw?.version!==VERSION)return blank();
    const state=blank();
    state.season=count(raw.season);
    state.peaks=readEloPeaks(raw.peaks,state.season,id);
    const onCurrentScale=raw.eloScale===ELO_SCALE;
    const rating=(row:FighterInput)=>onCurrentScale?row?.elo:migrateLegacyElo(row?.elo);
    for(const rawF of Object.values(raw.records??{}).slice(0,MAX_RECORDS)){
      // Move old roster members to today's eligible grade without
      // changing their historical results, titles, or learned records.
      const f=fighter({...rawF,elo:rating(rawF),rank:TOURNAMENT_HERO_GRADE,grade:TOURNAMENT_HERO_GRADE});if(f)state.records[f.id]=f;
    }
    if(!raw.peaks)for(const f of Object.values(state.records))if(hasFought(f))seedKnownEloPeak(state,f);
    for(const rawH of Object.values(raw.heroes??{}).slice(0,MAX_HEROES)){
      const h=hero({...rawH,elo:rating(rawH)});if(h)state.heroes[h.id]=h;
    }
    const champion=id(raw.championId);
    state.championId=champion&&Object.hasOwn(state.records,champion)?champion:null;
    state.history=arr(raw.history).slice(-MAX_HISTORY).map(h=>({titleByDraw:h?.titleByDraw===true,season:count(h?.season),championId:id(h?.championId),
      championName:fighterDisplayName(id(h?.championId),text(h?.championName,48)),runnerUpId:id(h?.runnerUpId),seed:seedValue(h?.seed)})).filter(h=>h.season&&h.championId&&h.championName);
    state.active=validatedActive(raw.active,state);
    raiseActiveRank(state);
    if(state.active?.championId)state.championId=state.active.championId;
    return state;
  }catch{return blank();}
}
export function saveTournament(state:State,storage?:StorageWriter|null){
  try{
    const target=storageFor(storage);if(!target)return false;
    target.setItem(TOURNAMENT_KEY,JSON.stringify(state));notifyCloudSaveCommitted(target);return true;
  }catch{return false;}
}

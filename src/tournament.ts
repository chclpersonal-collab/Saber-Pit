import {supportsArcadeReplay} from './arcade-replay-rules.js?v=3.0.0';
import {ARCADE_CHESS_STYLES} from './arcade-chess-styles.js?v=2.44.0';
import {tournamentBoutRates} from './arcade-bout-rates.js?v=2.34.0';
import {tournamentFixtureTerrain} from './arcade-map-rotation.js?v=2.34.0';
import {masteryTitle,earnedMasteryTitle} from './arcade-mastery-title.js?v=2.33.0';
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=2.42.0';
import {TOURNAMENT_KEY,loadTournament,saveTournament,startTournament,nextTournamentBout,runTournamentStep,
  tournamentLeaderboard,tournamentPeakLeaderboard,saveTournamentHero,removeTournamentHero,tournamentHeroes,tournamentHeroEligible,setTournamentHeroElo,setTournamentHeroGender,resetTournament,saveSquadTournamentHero,squadTournamentHeroId,squadTournamentHeroEligible} from './arcade-tournament.js?v=4.01.1';
import {FIGHTER_GENDERS,fighterGenderLabel} from './arcade-fighter-profiles.js?v=2.18.3';
import {drawArcadeFighterPreview} from './arcade-painter.js?v=5.0.0';
import {ELO_FLOORS} from './arcade-elo.js?v=2.18.5';
import {playTournamentBout,TOURNAMENT_REPLAY_RULESET} from './arcade-tournament-sim.js?v=3.0.0';
import {SQUAD_TOURNAMENT_KEY,loadSquadTournament,saveSquadTournament,startSquadTournament,nextSquadBout,runSquadStep,resetSquadTournament,squadLeaderboard,squadPeakLeaderboard,squadGenderLabel,SQUAD_ELO_START,SQUAD_ELO_FLOOR} from './squad-tournament.js?v=4.01.1';
import {SQUAD_REPLAY_RULESET} from './squad-tournament-sim.js?v=3.2.4';

import {seasonWeek} from './tournament-calendar.js?v=3.1.1';

import type {FighterBody, FighterGender, HeroAdaptation, StorageReader, StorageWriter} from './arcade-save-types.js';
type TournamentFormat = 'solo' | 'squad';
type Source = 'saved' | 'live';
type Winner = 0 | 1 | null;
type SaveKey = typeof TOURNAMENT_KEY | typeof SQUAD_TOURNAMENT_KEY;
type Stats = {wins?: number; draws?: number; losses?: number; kills?: number; deaths?: number; titles?: number};
interface TournamentProfile extends Omit<HeroAdaptation,'loadouts'> {
  profile?: TournamentProfile;
  loadouts?: {last?: {kit?: string; move?: string | null; reason?: string}};
}
interface Fighter extends Stats {
  id: string; name: string; fighterId?: string; fighter?: Fighter;
  form?: string; body?: FighterBody; gender?: FighterGender; chessStyle?: string; appearanceSeed?: number;
  elo: number; rank?: string; grade?: string; title?: string; profile?: TournamentProfile; adaptation?: TournamentProfile;
  eloCustomized?: boolean; eloFloorGrade?: string; sourceKind?: string;
}
interface Squad extends Stats { id: string; name: string; fighters: Fighter[]; elo: number; title?: string }
type CareerEntry = Fighter | Squad;
interface BoutEnd { winnerId?: string | null; reason?: string; kills?: number[] }
interface Fixture {
  id: string; winnerId?: string | null; result?: BoutEnd | null; attempts?: unknown[];
  teamIds?: (string | null)[]; fighterIds?: (string | null)[]; left?: Fighter; right?: Fighter;
  teams?: Squad[]; fighters?: Fighter[];
  stage?: string; round: number; attempt: number; limit: number; terrain?: string;
}
interface ReportChange { time: number; previous: string; intention: string; reason: string }
interface MatchReport {
  elapsed: number; limit: number; result: {winnerIndex: Winner; reason: string};
  sides: {name: string; initialIntent: string; changes: ReportChange[]; truncated?: number}[];
}
interface ReplaySpec { ruleset: number; matchReport?: MatchReport; teams?: Squad[]; fighters?: Fighter[] }
interface Bracket {
  season: number; seed: number; status: string; terrain: string; limit: number; fieldSize?: number;
  championId?: string | null; titleByDraw?: boolean; rounds: Fixture[][]; qualifiers?: Fixture[]; opening?: Fixture[];
  directEntrants?: string[]; directSeeds?: string[]; lastReplay?: ReplaySpec | null;
}
interface CareerHistory { season: number; titleByDraw?: boolean; championId?: string | null; championName?: string }
interface CareerSave {
  active: Bracket | null; season: number; history: CareerHistory[];
  peaks?: Record<string,{peakElo?: number} | null>;
}
/** Storage adapters preserve each mode’s own career, bracket and roster. */
interface SoloSave extends CareerSave { records: Record<string,Fighter>; heroes?: Record<string,Fighter>; teams?: never }
interface SquadSave extends CareerSave { teams: Record<string,Squad>; records?: never }
type TournamentSave = SoloSave | SquadSave;
interface PeakRow { name: string; place?: number; peakElo: number; peakSeason: number | null }
interface SeasonOptions { limit: number; terrain: string; fieldSize?: number; seed?: number }
interface SeasonSetup { seed: number | null; options: SeasonOptions; draws?: number }
interface ResumeSetup extends SeasonSetup { v: number; format: TournamentFormat; season: number; stamp: string; owner: string; draws: number }
interface AutoRun { seed: number | null; options: SeasonOptions; stopping: boolean; draws: number; owner: string }
interface PendingBout { worker: Worker; cancel: () => void }
interface Settlement { result?: BoutEnd | null; reason?: string; attempt?: {reason?: string} }
interface WorkerResult { winnerIndex?: Winner; time?: number; reason?: string }
interface WorkerData { error?: string; result?: WorkerResult }
interface ReplayDisplay { config?: {matchGoalPlanning?: boolean}; fighters: {alive: boolean; team: number; matchGoal?: string}[] }
interface ReplayControl { destroy?: () => void; stop?: () => void; pause?: () => void; resume?: () => void; skip?: () => boolean; setSpeed?: (speed: string) => void }
type StartReplay = (canvas: HTMLCanvasElement, data: ReplaySpec, handlers: {onFrame: (seconds: number, game?: ReplayDisplay) => void; onEnd: (winner?: Winner) => void; onSkipError?: () => void}) => Promise<ReplayControl | ((() => void) & ReplayControl)>;

type Loader<T extends TournamentSave> = (storage?: StorageReader | null) => T;
type Save = (state: TournamentSave, storage?: Pick<StorageWriter,'setItem'>) => boolean;
type Open = (state: TournamentSave, options: SeasonOptions) => unknown;
type Next = (state: TournamentSave) => Fixture | null;
type Settle = (state: TournamentSave, play: (fixture: Fixture) => WorkerResult | null) => Settlement | false | null | undefined;
type SettleSquad = (state: TournamentSave, play: (fixture: Fixture) => WorkerResult | null) => Promise<Settlement | false | null | undefined>;
type HeroLibrary = (state: TournamentSave) => Fighter[] | Record<string,Fighter>;
type HeroCurrentField = keyof Pick<Stats,'wins'|'draws'|'losses'|'kills'|'deaths'|'titles'>;

interface DomMap {
  soloFormat: HTMLButtonElement;
  squadFormat: HTMLButtonElement;
  showCareer: HTMLButtonElement;
  leadersTitle: HTMLHeadingElement;
  showPeaks: HTMLButtonElement;
  copyActiveSeed: HTMLButtonElement;
  boutProgress: HTMLProgressElement;
  nextButton: HTMLButtonElement;
  runButton: HTMLButtonElement;
  autoSeasons: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  watchLast: HTMLButtonElement;
  newButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  newSetup: HTMLFormElement;
  seedInput: HTMLInputElement;
  fieldInput: HTMLSelectElement;
  limitInput: HTMLSelectElement;
  longClock: HTMLOptionElement;
  terrainInput: HTMLSelectElement;
  closeSetup: HTMLButtonElement;
  careerSearch: HTMLInputElement;
  heroPortrait: HTMLCanvasElement;
  saveHero: HTMLButtonElement;
  removeHero: HTMLButtonElement;
  heroGenderEditor: HTMLFormElement;
  heroGender: HTMLSelectElement;
  applyHeroGender: HTMLButtonElement;
  heroEloEditor: HTMLFormElement;
  heroEloRating: HTMLInputElement;
  heroEloFloor: HTMLSelectElement;
  applyHeroElo: HTMLButtonElement;
  resetDialog: HTMLDialogElement;
  confirmReset: HTMLButtonElement;
  removeHeroDialog: HTMLDialogElement;
  replayDialog: HTMLDialogElement;
  closeReplay: HTMLButtonElement;
  replayArena: HTMLCanvasElement;
  replaySpeed: HTMLSelectElement;
  replayPause: HTMLButtonElement;
  replaySkip: HTMLButtonElement;
}

const $=<Id extends string>(id: Id)=>document.getElementById(id) as Id extends keyof DomMap ? DomMap[Id] : HTMLElement;
const wrap=<Tag extends keyof HTMLElementTagNameMap>(tag: Tag,style?: string | null,text?: unknown)=>{
  const el=document.createElement(tag);
  if(style)el.className=style;
  if(text!=null)el.textContent=String(text);
  return el;
};
let state=(loadTournament as unknown as Loader<SoloSave>)(),squadState=(loadSquadTournament as unknown as Loader<SquadSave>)();
let format: TournamentFormat=location.hash==='#squads'?'squad':'solo',selectedTeamId: string | null | undefined=null;
const isSquad=()=>format==='squad';
const currentState=()=>isSquad()?squadState:state;
const nextBout=()=>isSquad()?(nextSquadBout as unknown as Next)(squadState):(nextTournamentBout as unknown as Next)(state);
const supportsReplay=(rules: number)=>isSquad()?supportsArcadeReplay(rules,1,SQUAD_REPLAY_RULESET):supportsArcadeReplay(rules,2,TOURNAMENT_REPLAY_RULESET);
let runEpoch=0,boutJob: PendingBout | null=null,autoRun: AutoRun | null=null,processingBout=false,claiming=false,releaseRunLock: (()=>void) | null=null;
let selectedId: string | null | undefined=null,selectedSource: Source='live',busy=false,timer: ReturnType<typeof setTimeout> | null=null,steps=0,replayEpoch=0,stopPlayback: (()=>void) | null=null,setPlaybackSpeed: ReplayControl['setSpeed'] | null=null,pausePlayback: ((paused: boolean)=>void) | null=null,playbackPaused=false;
const nextButton=$('nextButton'),runButton=$('runButton'),cancelButton=$('cancelButton'),newButton=$('newButton'),autoButton=$('autoSeasons');
const watchLast=$('watchLast'),replayDialog=$('replayDialog');
const newSetup=$('newSetup'),bracketRows=$('bracketRows'),leaderRows=$('leaderRows'),heroRows=$('heroRows');
const count=(v: unknown,fallback=0)=>Number.isFinite(v)?Math.max(0,Math.trunc(v as number)):fallback;
const rateFormat=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
function rateCells(entry: Stats){
  const value=tournamentBoutRates(entry);
  if(!value)return [wrap('td','loss-rate','N/A'),wrap('td','survival-rate','N/A')];
  return [wrap('td','loss-rate',rateFormat.format(value.lossPercent)+'%'),wrap('td','survival-rate',rateFormat.format(value.winDrawPercent)+'%')];
}
const boutClock=(sec: number)=>sec>=60?Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'):sec+' sec';
const wdl=(entry: Stats)=>[entry.wins,entry.draws,entry.losses].map(value=>count(value)).join('–');
const friendly=(value: unknown)=>String(value??'').replace(/[_-]/g,' ').replace(/\b[a-z]/g,ch=>ch.toUpperCase());
const chessName=(f?: Pick<Fighter,'chessStyle'> | null)=>ARCADE_CHESS_STYLES[f?.chessStyle!]?.label;
const formName=(id?: string)=>(({shii_cho:'Shii-Cho',makashi:'Makashi',soresu:'Soresu',ataru:'Ataru',djem_so:'Djem So',niman:'Niman',juyo:'Juyo'} as Record<string,string>)[id!]??friendly(id));
const arenaName=(id?: string)=>(({underpit:'The Underpit',foundry:'The Foundry',ember_ring:'Ember Ring'} as Record<string,string>)[id!]??friendly(id));
const roundNames=['Opening round','Quarterfinals','Semifinals','Final'];
const chooseName=(id?: string | null)=>(isSquad()?squadState.teams?.[id!]?.name:getRecord(id)?.name)??'Undecided';
const bracket=()=>currentState().active;
const heroes=()=>flatten((tournamentHeroes as unknown as HeroLibrary)(state));

function flatten<T>(input: T[] | Record<string,T> | null | undefined): T[]{
  return Array.isArray(input)?input:input&&typeof input==='object'?Object.values(input):[];
}
function getRecord(id?: string | null){
  if(id==null)return null;
  const records=state.records as Record<string,Fighter> | Fighter[];
  return (Array.isArray(records)?records.find(row=>row.id===id):records?.[id]) ??
    heroes().find(row=>row.id===id||row.fighterId===id)??null;
}
function getHero(id?: string | null){return heroes().find(row=>(row.fighterId??row.id)===id);}
function played(record: Fighter){
  return count(record.profile?.bouts)+count(record.wins)+count(record.draws)+count(record.losses)+count(record.kills)+count(record.deaths)>0;
}
type HeroFreshness = Stats & {profile?: {bouts?: number}; elo?: number; eloCustomized?: boolean};
function heroCurrent(current: HeroFreshness,saved?: HeroFreshness | null){
  return saved&&['wins','draws','losses','kills','deaths','titles'].every(key=>count(saved[key as HeroCurrentField])===count(current[key as HeroCurrentField]))&&
    count(saved.profile?.bouts)===count(current.profile?.bouts)&&
    (saved.eloCustomized||saved.elo===current.elo);
}
function status(message: string){$('tourStatus').textContent=message;}
const tournamentKeys: SaveKey[]=[TOURNAMENT_KEY,SQUAD_TOURNAMENT_KEY];
const saveKey=(): SaveKey=>isSquad()?SQUAD_TOURNAMENT_KEY:TOURNAMENT_KEY;
const resumeKey=(key: string)=>'saber-pit:auto-seasons:resume:1:'+(key===SQUAD_TOURNAMENT_KEY?'squad':'solo');
const resumeKeys=tournamentKeys.map(resumeKey);
const resumeTerrains=new Set(['underpit','rotation','foundry','ember_ring','crossroads','zigzag','craterfield']);
const lastStamp: Partial<Record<SaveKey,{raw: string; stamp: string}>>={};
function savedRaw(key: string){try{return localStorage.getItem(key);}catch{return undefined;}}
const knownRaw=Object.fromEntries(tournamentKeys.map(key=>[key,savedRaw(key)]));
function saveStamp(key: SaveKey){
  const raw=knownRaw[key];
  if(typeof raw!=='string'||!raw)return null;
  if(lastStamp[key]?.raw===raw)return lastStamp[key]!.stamp;
  // Two bounded fingerprints bind a hint, never the data used for progression.
  // Only the normal tournament save supplies the actual next fixture.
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<raw.length;i++){const c=raw.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519);}
  const stamp=[raw.length,(a>>>0).toString(36),(b>>>0).toString(36)].join(':');
  lastStamp[key]={raw,stamp};return stamp;
}
function storedResume(key: SaveKey): ResumeSetup | null{
  const raw=savedRaw(resumeKey(key));
  try{return typeof raw==='string'&&raw.length<=640?JSON.parse(raw):null;}catch{return null;}
}
function resumableRun(){
  const key=saveKey(),data=storedResume(key),stamp=saveStamp(key);
  const squad=key===SQUAD_TOURNAMENT_KEY, options=data?.options;
  if(!stamp||data?.v!==1||data.format!==format||data.stamp!==stamp||
     data.season!==currentState().season||!bracket()||bracket()!.season!==data.season||
     typeof data.owner!=='string'||!/^[a-z0-9-]{1,80}$/.test(data.owner)||
     data.seed!==null&&(!Number.isInteger(data.seed)||data.seed!<1||data.seed!>4294967295)||
     !Number.isSafeInteger(data.draws)||data.draws<0||data.draws>=4294967295||
     !resumeTerrains.has(options?.terrain!)||!(squad?[45,75,90,150]:[45,75,90,150,360]).includes(options!.limit)||
     !squad&&(![24,32].includes(options!.fieldSize!)||options!.limit===360&&options!.fieldSize!==32))return null;
  return data;
}
function rememberAuto(){
  const run=autoRun;
  if(!run||run.stopping||!bracket())return;
  const key=saveKey(),stamp=saveStamp(key);
  if(!stamp)return;
  try{localStorage.setItem(resumeKey(key),JSON.stringify({v:1,format,season:currentState().season,stamp,
    owner:run.owner,seed:run.seed,draws:run.draws,options:run.options}));}catch{/* Progress does not depend on the optional hint. */}
}
function discardResume(key: SaveKey,owner?: string){
  if(owner&&storedResume(key)?.owner!==owner)return;
  try{localStorage.removeItem(resumeKey(key));}catch{/* Read-only storage remains safe. */}
}
function restorePersistedTournament(key: SaveKey){
  knownRaw[key]=savedRaw(key);
  if(key===TOURNAMENT_KEY)state=(loadTournament as unknown as Loader<SoloSave>)();
  else if(key===SQUAD_TOURNAMENT_KEY)squadState=(loadSquadTournament as unknown as Loader<SquadSave>)();
}
function syncTournamentSave(key: SaveKey){
  const raw=savedRaw(key);
  if(raw===knownRaw[key])return false;
  knownRaw[key]=raw;
  if(key===TOURNAMENT_KEY)state=(loadTournament as unknown as Loader<SoloSave>)();
  else if(key===SQUAD_TOURNAMENT_KEY)squadState=(loadSquadTournament as unknown as Loader<SquadSave>)();
  return true;
}
function persist(message: string,key: SaveKey=saveKey()){
  if(syncTournamentSave(key)){
    stop('Reloaded the latest save from another tab. This action was not saved.');return false;
  }
  let written: string | undefined;
  const storage={setItem(name: string,value: string){localStorage.setItem(name,value);written=value;}};
  const result=key===SQUAD_TOURNAMENT_KEY?(saveSquadTournament as unknown as Save)(squadState,storage):(saveTournament as unknown as Save)(state,storage);
  if(result!==false){
    // Bind recovery to this successful write, never to whatever another tab
    // might have replaced it with before the following localStorage read.
    knownRaw[key]=written;
    if(syncTournamentSave(key)){
      stop('Loaded tournament progress from another tab or device.');return false;
    }
  }
  status(result===false?message+' This browser blocked storage. Changes last until you leave this page.':message);
  return result!==false;
}
function phaseText(result?: BoutEnd | null){
  if(!result?.reason)return '';
  return (({'timeout':'Time decision (legacy)','draw-advance':'Draw · seed advances',decision:'Decision',ko:'Knockout',elimination:'Knockout',draw:'Draw',tiebreak:'Bracket tiebreak','runoff-score':'Tiebreak on bout activity','runoff-seed':'Seeded tiebreak','score-tiebreak':'Tiebreak on bout activity','seed-tiebreak':'Seeded tiebreak','survivors':'Survivors decision','aggregate':'Aggregate tiebreak'} as Record<string,string>))[result.reason]??friendly(result.reason);
}
function same(id?: string | null,winner?: string | null){return id!=null&&id===winner;}
function profileButton(record: Fighter,detail: string | null = null,source: Source='live'){
  const control=wrap('button','fighter-button');control.type='button';control.dataset.fighterId=record.id;control.dataset.source=source;
  control.setAttribute('aria-pressed',String(selectedId===record.id&&selectedSource===source));
  const name=wrap('b',null,record.name);
  appendMastery(name,earnedMasteryTitle(state,record.id));
  control.append(name);
  if(detail)control.append(wrap('small','result',detail));
  return control;
}
function appendMastery(node: HTMLElement,tag?: string | null){
  if(tag){const badge=wrap('span','mastery-title',tag);badge.setAttribute('aria-label','Mastery title '+tag);node.append(' ',badge);}
}
function boardId(entry: Fighter){return entry.fighterId??entry.id??entry.fighter?.id;}
function headlineTitle(row?: Pick<CareerEntry,'title'|'titles'> | null){
  const raw=row?.title;
  if(typeof raw==='string'&&raw)return raw;
  const titles=count(row?.titles);
  return titles===1?'1 title':titles>1?`${titles} titles`:'';
}
function formatter(kills: number,deaths: number) {
  if(!deaths)return kills?'∞':'0.00';
  return (kills/deaths).toFixed(2);
}
function entryFor(entry: Fighter){
  const record=getRecord(boardId(entry))??entry.fighter??entry;
  return {...record,...entry,id:boardId(entry)??record.id,name:record.name??entry.name};
}
function renderLeaderForms(leaders: Fighter[]){
  const summary=$('leaderForms'), counts=new Map<string,number>();
  for(const entry of leaders){
    const label=formName(entry.form);
    if(label)counts.set(label,(counts.get(label)??0)+1);
  }
  const sorted=[...counts].sort(([a,n],[b,m])=>m-n||a.localeCompare(b));
  summary.hidden=!sorted.length;
  summary.textContent=sorted.length?'Top 10 forms: '+sorted.map(([label,n])=>label+' '+n).join(' · '):'';
}
function renderLeaders(){
  const leaders=flatten((tournamentLeaderboard as unknown as (state: TournamentSave, limit: number)=>Fighter[])(state,10)).slice(0,10).map(entryFor);
  renderLeaderForms(leaders);
  leaderRows.replaceChildren();
  if(!leaders.length){
    const row=wrap('tr'),cell=wrap('td','empty','No bouts recorded.');cell.colSpan=9;row.append(cell);leaderRows.append(row);return;
  }
  leaders.forEach((entry,index)=>{
    const kills=count(entry.kills),deaths=count(entry.deaths),row=wrap('tr');
    const place=wrap('td',null,index+1),name=wrap('td');
    name.append(profileButton(entry,[fighterGenderLabel(entry.gender),chessName(entry),headlineTitle(entry)].filter(Boolean).join(' · ')));
    if(entry.id===selectedId&&selectedSource==='live')row.classList.add('selected');
    row.append(place,name,wrap('td',null,entry.elo.toLocaleString()),wrap('td',null,kills),wrap('td',null,deaths),
      wrap('td',null,formatter(kills,deaths)),wrap('td','wdl',wdl(entry)),...rateCells(entry));
    leaderRows.append(row);
  });
}
const squadElo=(team?: Pick<Squad,'elo'> | null)=>Number.isFinite(team?.elo)?team!.elo:SQUAD_ELO_START;
const eloText=(team: Squad)=>squadElo(team).toLocaleString()+' Elo';
const squadIdentity=(team: Squad)=>[squadGenderLabel(team),eloText(team)].filter(Boolean).join(' · ');
function teamButton(team: Squad,detail?: string | null,showElo=true){
  const button=wrap('button','fighter-button');button.type='button';button.dataset.teamId=team.id;
  button.setAttribute('aria-pressed',String(team.id===selectedTeamId));
  const identity=wrap('span','squad-identity');
  const name=wrap('b',null,team.name);
  appendMastery(name,earnedMasteryTitle(squadState,team.id));
  identity.append(name,wrap('span','squad-composition',showElo?squadIdentity(team):squadGenderLabel(team)));
  button.append(identity);
  if(detail)button.append(wrap('small','result',detail));
  return button;
}
function renderSquadLeaders(){
  const rows=(squadLeaderboard as unknown as (state: TournamentSave) => Squad[])(squadState);
  renderLeaderForms([]);
  leaderRows.replaceChildren();
  if(!rows.length){
    const row=wrap('tr'),cell=wrap('td','empty','No bouts recorded.');cell.colSpan=9;row.append(cell);leaderRows.append(row);return;
  }
  for(const [index,team] of rows.entries()){
    const row=wrap('tr'),name=wrap('td'),kills=count(team.kills),deaths=count(team.deaths);
    name.append(teamButton(team,headlineTitle(team),false));
    if(team.id===selectedTeamId)row.classList.add('selected');
    row.append(wrap('td',null,index+1),name,wrap('td',null,squadElo(team).toLocaleString()),wrap('td',null,kills),wrap('td',null,deaths),
      wrap('td',null,formatter(kills,deaths)),wrap('td','wdl',wdl(team)),...rateCells(team));leaderRows.append(row);
  }
}
function renderCareerSearch(){
  const squad=isSquad(), input=$('careerSearch'), results=$('careerSearchRows');
  $('careerSearchTitle').textContent=squad?'Find a squad':'Find a fighter';
  $('careerSearchLabel').textContent=squad?'Search squad or member name':'Search fighter name';
  const q=String(input.value??'').trim().toLocaleLowerCase();
  results.replaceChildren();
  if(q.length<2){$('careerSearchNote').textContent='Type at least two letters.';return;}
  const roster=Object.values(squad?squadState.teams:state.records);
  const matches=roster.filter(row=>row.name.toLocaleLowerCase().includes(q)||
    (squad&&(row as Squad).fighters.some(member=>member.name.toLocaleLowerCase().includes(q))))
    .sort((a,b)=>b.elo-a.elo||a.name.localeCompare(b.name));
  $('careerSearchNote').textContent=matches.length===0?'No matches in retained records.':
    matches.length>12?'Showing 12 of '+matches.length+' matches.':matches.length+' '+(matches.length===1?'match':'matches')+'.';
  for(const row of matches.slice(0,12)){
    const item=wrap('li');
    const detail=squad?(row as Squad).fighters.filter(member=>member.name.toLocaleLowerCase().includes(q)).map(m=>m.name).join(', '):formName((row as Fighter).form);
    item.append(squad?teamButton(row as Squad,detail):profileButton(row as Fighter,detail));results.append(item);
  }
}
$('careerSearch').addEventListener('input',renderCareerSearch);
function renderSeasonArchive(){
  const squad=isSquad(), current=currentState(), rows=$('seasonArchiveRows');
  rows.replaceChildren();
  for(const entry of current.history.slice(-10).reverse()){
    const champion=entry.titleByDraw?'Drawn final · No champion':
      (squad?current.teams![entry.championId!]?.name:entry.championName??current.records![entry.championId!]?.name)??'Champion record unavailable';
    const row=wrap('li');row.append(wrap('strong',null,champion),wrap('small','muted',`Week ${entry.season}`));rows.append(row);
  }
  if(!rows.children.length)rows.append(wrap('li','muted','No completed seasons yet.'));
}
$('copyActiveSeed').addEventListener('click',async()=>{
  const seed=bracket()?.seed;
  if(!Number.isSafeInteger(seed))return;
  try{await navigator.clipboard.writeText(String(seed));status('Copied bracket seed '+seed+'.');}
  catch{status('Bracket seed: '+seed+'.');}
});
function renderPeaks(){
  const squad=isSquad(), rows=(squad?squadPeakLeaderboard:tournamentPeakLeaderboard) as unknown as (state: TournamentSave)=>PeakRow[];
  const peaks=rows(squad?squadState:state);
  const body=$('peakRows');body.replaceChildren();
  $('peakSubject').textContent=squad?'Squad':'Fighter';
  $('peakDetail').textContent=squad?'Highest recorded team Elo. Later rating drops do not erase a peak.':'Highest recorded fighter Elo. Later rating drops do not erase a peak.';
  $('peakHistory').hidden=!peaks.some(entry=>entry.peakSeason===null);
  if(!peaks.length){
    const row=wrap('tr'),cell=wrap('td','empty','No peak ratings recorded yet.');
    cell.colSpan=4;row.append(cell);body.append(row);return;
  }
  for(const [i,entry] of peaks.entries()){
    const row=wrap('tr');
    const name=wrap('td','peak-name',entry.name);appendMastery(name,masteryTitle(entry.peakElo));
    const week=seasonWeek(entry.peakSeason);
    row.append(wrap('td',null,entry.place??i+1),name,
      wrap('td','peak-score',entry.peakElo.toLocaleString()),wrap('td',null,week===null?'Unknown':`${entry.peakSeason} / ${week}`));
    body.append(row);
  }
}
for(const [control, target] of [['showCareer','leadersTitle'],['showPeaks','peaksTitle']] as const){
  $(control).addEventListener('click',()=>{
    const heading=$(target);heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});
  });
}
function renderTeam(){
  const team=isSquad()?squadState.teams?.[selectedTeamId!]:null;
  $('teamProfile').hidden=!team;
  if(!team)return;
  $('teamName').textContent=team.name;appendMastery($('teamName'),earnedMasteryTitle(squadState,team.id));
  $('teamMeta').textContent=`${squadIdentity(team)} · SSS+ V · ${wdl(team)} W–D–L · ${count(team.kills)}/${count(team.deaths)} K/D`;
  $('teamMembers').replaceChildren(...team.fighters.map(f=>{
    const el=wrap('li'),identity=wrap('div','squad-member-identity');
    identity.append(wrap('strong',null,f.name),wrap('small',null,[fighterGenderLabel(f.gender),formName(f.form),chessName(f)].filter(Boolean).join(' · ')));
    const heroId=squadTournamentHeroId(team.id,f.id), saved=getHero(heroId);
    const action=wrap('button',null,saved?'View Hero':'Save Hero');
    action.type='button';
    if(saved){action.dataset.fighterId=heroId!;action.dataset.source='saved';}
    else action.dataset.squadMember=f.id;
    action.setAttribute('aria-label',action.textContent+' '+f.name);
    action.disabled=busy||(!saved&&!squadTournamentHeroEligible(squadState,team.id,f.id));
    el.append(identity,action);return el;
  }));
}
function renderBracket(active: Bracket | null,next: Fixture | null){
  bracketRows.replaceChildren();
  const rounds=Array.isArray(active?.rounds)?active.rounds:[];
  if(!rounds.length){$('bracketCount').textContent='';bracketRows.append(wrap('p','empty','No draw yet.'));return [0,0];}
  let done=0,total=0;
  const qualifiers=active?.qualifiers??[],opening=active?.opening??[];
  const direct=new Set(active?.directEntrants??active?.directSeeds??[]);
  function phase(fixtures: Fixture[],label: string,isQualifier: boolean,roundIndex: number){
    const group=wrap('section',isQualifier?'round-block qualifier-phase':'round-block'),list=wrap('ul','fixtures');
    group.append(wrap('h3','round-title',label));
    if(isQualifier)group.append(wrap('p','muted phase-note',active!.fieldSize===32?'Eight qualifier paths. '+direct.size+' fighters skip qualifiers.':qualifiers.length+' advance. '+direct.size+' direct seeds start in the main draw.'));
    group.append(list);bracketRows.append(group);
    for(const fixture of fixtures){
      total++;const result=fixture.result,winner=fixture.winnerId??result?.winnerId,move=fixture.id===next?.id;
      if(winner)done++;
      const li=wrap('li',`fixture${move?' is-next':''}`);
      for(const id of (isSquad()?fixture.teamIds:fixture.fighterIds)??[null,null]){
        const record=id?(isSquad()?squadState.teams?.[id!]:getRecord(id)):null;
        if(!record){li.append(wrap('small','muted',roundIndex===-2||qualifiers.length&&roundIndex===0&&!isQualifier?'Advancer pending':'Winner advances'));continue;}
        const note=same(id,winner)?(result?.reason==='draw-advance'?'Seed advanced':'Won'):(roundIndex===0||roundIndex===-2)&&!isQualifier&&direct.has(id!)?'Direct seed':null;
        li.append(isSquad()?teamButton(record as Squad,note):profileButton(record as Fighter,[note,chessName(record as Fighter)].filter(Boolean).join(' · ')));
      }
      const rematches=Array.isArray(fixture.attempts)?fixture.attempts.length:0;
      const score=isSquad()&&result?.kills?.length===2?` · ${result.kills.join('–')} KOs`:'';
      const note=winner?(phaseText(result)||'Complete')+score:move?(rematches?'Rematch pending':'Up next'):'Pending';
      li.append(wrap('small',null,active?.terrain==='rotation'?note+' · '+arenaName(tournamentFixtureTerrain(active,fixture)):note));list.append(li);
    }
  }
  if(qualifiers.length)phase(qualifiers,'Last-chance qualifiers',true,-1);
  if(opening.length)phase(opening,'Main draw play-in',false,-2);
  rounds.forEach((fixtures,ix)=>{if(Array.isArray(fixtures))phase(fixtures,roundNames[ix]??`Round ${ix+1}`,false,ix);});
  $('bracketCount').textContent=`${done} / ${total} settled`;
  return [done,total];
}
function renderHeroes(){
  const list=heroes();heroRows.replaceChildren();
  if(!list.length){heroRows.append(wrap('li','empty','Save a fighter from either tournament format.'));return;}
  for(const hero of list){
    const id=hero.fighterId??hero.id,li=wrap('li');
    const source=getRecord(id)??hero;
    const recruit=wrap('a','deploy-hero','Watch in Arena');
    recruit.href='./index.html?hero='+encodeURIComponent(id);
    recruit.setAttribute('aria-label','Watch '+(hero.name??source.name??'this Hero')+' in Arena');
    li.append(profileButton({...source,id,name:hero.name??source.name??'Hero'},[fighterGenderLabel(hero.gender),formName(hero.form??source.form)].filter(Boolean).join(' · '),'saved'),recruit);
    heroRows.append(li);
  }
}
function metric(label: string,value: unknown){const li=wrap('li');li.append(wrap('strong',null,label),wrap('span',null,value));return li;}
function pct(value?: number | null){return Number.isFinite(value)?`${Math.round(Math.max(0,Math.min(1,value!))*100)}%`:'—';}
function renderProfile(){
  const live=getRecord(selectedId), saved=getHero(selectedId);
  const record=selectedSource==='saved'?saved:live;
  $('profile').hidden=!record;
  if(!record)return;
  const savedSelected=selectedSource==='saved'&&Boolean(saved);
  $('removeHero').hidden=!savedSelected;$('removeHero').disabled=busy;
  const genderEditor=$('heroGenderEditor'),portrait=$('heroPortrait');
  genderEditor.hidden=!savedSelected;
  portrait.hidden=false;
  if(savedSelected){
    $('heroGender').value=saved!.gender!;$('heroGender').disabled=busy;
    $('applyHeroGender').disabled=busy;
  }
  const ctx=portrait.getContext('2d');
  if(ctx){
    ctx.clearRect(0,0,portrait.width,portrait.height);
    drawArcadeFighterPreview(ctx,{...record,appearanceSeed:(record.appearanceSeed??record.id) as number},{reducedMotion:true,framing:'portrait'});
  }
  const editor=$('heroEloEditor');
  editor.hidden=!savedSelected;
  if(!editor.hidden){
    $('heroEloRating').value=String(saved!.elo);$('heroEloRating').disabled=busy;
    $('heroEloFloor').value=saved!.eloFloorGrade!;$('heroEloFloor').disabled=busy;
    $('applyHeroElo').disabled=busy;
  }
  const player: TournamentProfile=record.profile??record.adaptation?.profile??record.adaptation??{};
  const title=headlineTitle(record);
  $('profileSource').textContent=selectedSource==='saved'?'SAVED HERO SNAPSHOT':'FIGHTER FILE';
  $('fighterName').textContent=record.name;appendMastery($('fighterName'),earnedMasteryTitle(state,record.id));
  const form=formName(record.form),rank=String(record.rank??record.grade??'');
  $('fighterTitle').textContent=[rank,form,chessName(record),fighterGenderLabel(record.gender),title].filter(Boolean).join(' · ');
  const squadHero=record.sourceKind==='squad';
  const save=$('saveHero'),current=heroCurrent(live??record,saved),canSave=!squadHero&&tournamentHeroEligible(live??record);
  save.hidden=squadHero;
  save.disabled=busy||!canSave||Boolean(current);
  save.textContent=!canSave?(played(live??record)?'SSS+ V required':'Bout required'):current?'Saved':saved?'Update Hero':'Save Hero';
  const learned=$('learnedList');learned.replaceChildren();
  const matches=count(player.bouts,count(record.wins)+count(record.losses));
  if(squadHero){
    learned.append(metric('Arena Elo',record.elo.toLocaleString()),metric('Source','5v5 squad · Team Elo stays separate'));
    return;
  }
  learned.append(metric('Elo',record.elo.toLocaleString()));
  learned.append(metric('Win–Draw–Loss',wdl(record)));
  learned.append(metric('Bouts studied',matches));
  learned.append(metric('Last plan',player.lastDoctrine?friendly(player.lastDoctrine):'Balanced'));
  const adaptive=player.loadouts;
  if(adaptive?.last){
    const kit={single:'Single saber',reverse:'Reverse-grip single',dual:'Dual sabers',reverseDual:'Reverse-grip dual',staff:'Double-bladed saber'};
    const reason={starter:'Starting kit',matchup:'Opponent matchup',results:'Past results',practice:'Testing an option'};
    learned.append(metric('Last weapon',(kit as Record<string,string>)[adaptive.last.kit!]??'Single saber'));
    if(ARCADE_TECHNIQUES[adaptive.last.move!])learned.append(metric('Prioritized move',ARCADE_TECHNIQUES[adaptive.last.move!].name));
    if((reason as Record<string,string>)[adaptive.last.reason!])learned.append(metric('Loadout choice',(reason as Record<string,string>)[adaptive.last.reason!]));
  }
  const observed=player.observed??{};
  if(matches>0){
    if(Number.isFinite(observed.accuracy))learned.append(metric('Accuracy',pct(observed.accuracy)));
    if(Number.isFinite(observed.guardRate))learned.append(metric('Guard reads',pct(observed.guardRate)));
    if(Number.isFinite(observed.whiffRate))learned.append(metric('Miss rate',pct(observed.whiffRate)));
    if(Number.isFinite(observed.counterRate))learned.append(metric('Counter rate',pct(observed.counterRate)));
    for(const [plan,data] of Object.entries(player.variants??{})){
      if(count(data?.bouts))learned.append(metric(friendly(plan),`${count(data.wins)} / ${count(data.bouts)} wins`));
    }
  }else learned.append(metric('Learning','Starts after first bout'));
}
function markSelected(){
  document.querySelectorAll<HTMLElement>('[data-fighter-id]').forEach(button=>{
    const active=button.dataset.fighterId===selectedId&&((button.dataset.source||'live') as Source)===selectedSource;
    button.setAttribute('aria-pressed',String(active));
    button.closest('tr')?.classList.toggle('selected',active);
  });
}
const matchPlanReasons: Readonly<Record<string,string>>={
  'outnumbered':'Outnumbered','injury-risk':'Injury pressure','rating-risk':'Risky matchup',
  'clock-risk':'Preserve the draw','counter-opening':'Saw a counter opening','seek-decisive':'Pushed for a decisive result'
};
const goalName=(key?: unknown)=>key==='win'?'Win':key==='draw'?'Draw':'Unknown';
let displayedMatchReport: MatchReport | undefined;
function renderMatchReport(replay?: ReplaySpec | null){
  const panel=$('lastMatchPlan'),report=replay?.matchReport;
  panel.hidden=!report;
  if(!report){displayedMatchReport=undefined;return;}
  if(report===displayedMatchReport)return;
  displayedMatchReport=report;
  const winner=(replay!.teams??replay!.fighters)?.[report.result.winnerIndex!]?.name;
  const result=winner?winner+' won':report.result.reason==='timeout'?'Draw at the time limit':'Draw';
  $('planOutcome').textContent='Result: '+result+' · '+Math.round(report.elapsed)+'s of '+report.limit+'s. Plans never decide the result.';
  $('planParticipants').replaceChildren(...report.sides.map(side=>{
    const item=wrap('section','plan-fighter');
    item.append(wrap('h3',null,side.name),wrap('p','muted','Started: '+goalName(side.initialIntent)));
    if(side.changes.length){
      const list=wrap('ol','plan-changes');
      list.append(...side.changes.map(change=>wrap('li',null,Math.floor(change.time)+'s · '+goalName(change.previous)+' → '+goalName(change.intention)+(matchPlanReasons[change.reason]?' · '+matchPlanReasons[change.reason]:''))));
      item.append(list);
      if(side.truncated)item.append(wrap('p','muted',side.truncated+' earlier changes omitted'));
    }else item.append(wrap('p','muted','No plan change recorded.'));
    return item;
  }));
}
function render(){
  const active=bracket(),next=nextBout(),squad=isSquad();
  $('soloFormat').setAttribute('aria-pressed',String(!squad));
  $('squadFormat').setAttribute('aria-pressed',String(squad));
  $('soloFormat').disabled=$('squadFormat').disabled=busy;
  $('formatDescription').textContent=squad?'Five fighters per side, each with a chess style and a saber form.':'Every duelist uses a chess style alongside their saber form. Save fighters as Heroes for custom matches.';
  $('soloGuide').hidden=squad;
  $('squadGuide').hidden=!squad;
  $('leaderSubject').textContent=squad?'Squad':'Fighter';
  $('leaderRating').textContent='Elo';
  $('leaderTag').textContent=squad?'TEAM ELO':'ELO';
  $('leaderDetail').textContent=(squad?'Career team Elo. ':'Career fighter Elo. ')+'Rates count wins, draws, and losses across seasons.';
  renderSetup();
  $('squadRatingRule').textContent=`Team Elo starts at ${SQUAD_ELO_START.toLocaleString()} and cannot fall below ${SQUAD_ELO_FLOOR.toLocaleString()}. Losing to a lower-rated opponent costs more Elo unless the floor stops the loss.`;
  $('resetButton').disabled=busy||!currentState().season;
  $('seasonBadge').textContent=active?`Season ${active.season??currentState().season}`+(!squad&&active!.fieldSize===32?' · 32 fighters':''):'No season';
  const week=seasonWeek(currentState().season);
  $('seasonWeek').textContent=week===null?'One season is one in-game week.':`In-game Week ${week} · One week per season`;
  const seed=active?.seed;
  $('activeSeed').hidden=!Number.isSafeInteger(seed);
  $('activeSeedValue').textContent=Number.isSafeInteger(seed)?String(seed):'';
  $('nextBout').dataset.tone=next?'active':active?.championId?'win':'empty';
  $('nextLabel').textContent=next?(next.stage==='qualifier'?'Last-chance qualifier':next.stage==='opening'?'Main draw play-in':(roundNames[next.round-1]??`Round ${next.round}`)):active?.titleByDraw?'SEASON COMPLETE':active?.championId?'CHAMPION':'FIRST BOUT';
  if(next){
    const fighters=squad?next.teams!:next.fighters??[next.left,next.right];
    $('matchup').textContent=fighters.map(f=>f?(squad?`${f.name} (${squadGenderLabel(f as Squad)})`:f.name):'Undecided').join(' vs ');
    $('matchMeta').textContent=[arenaName(next.terrain??active!.terrain),boutClock(count(next.limit??active!.limit)),active?.terrain==='rotation'?'Arena rotation':null,next.attempt>0?`Rematch ${next.attempt}`:null].filter(Boolean).join(' · ');
  }else if(active?.titleByDraw){
    $('matchup').textContent='Final drawn';
    $('matchMeta').textContent='No title awarded. The draw is on both records.';
  }else if(active?.championId){
    $('matchup').textContent=chooseName(active.championId);
    const composition=squad?squadIdentity(squadState.teams[active.championId]):'';
    $('matchMeta').textContent=(composition?composition+' · ':'')+'Title secured. The champion is invited to the next main draw.';
  }else{
    $('matchup').textContent='The ring is empty';
    $('matchMeta').textContent='Start a season to draw the bracket.';
  }
  const [done,total]=renderBracket(active,next);
  $('progressBar').hidden=!total;
  $('boutProgress').max=total||1;$('boutProgress').value=done;
  $('progressLabel').textContent=`${done} of ${total} matchups settled`;
  nextButton.disabled=busy||!next;
  runButton.disabled=busy||!next;
  cancelButton.hidden=!busy||Boolean(autoRun);
  renderAutoControl();
  const replay=active?.lastReplay;renderMatchReport(replay);
  const previousRules=Boolean(replay&&!supportsReplay(replay.ruleset));
  watchLast.hidden=!replay||previousRules;watchLast.disabled=busy;
  $('replayNotice').hidden=!previousRules;
  newButton.disabled=busy||active?.status==='running';
  newButton.title=active?.status==='running'?'Finish this bracket first.':'';
  renderPeaks();renderCareerSearch();renderSeasonArchive();
  if(squad){renderSquadLeaders();renderTeam();}
  else {renderLeaders();$('teamProfile').hidden=true;}
  renderHeroes();
  if(!squad||selectedSource==='saved')renderProfile();
  else $('profile').hidden=true;
}
function renderAutoControl(){
  const resume=!busy&&resumableRun(), hint=$('autoResumeHint');
  autoButton.disabled=Boolean(autoRun?.stopping)||busy&&!autoRun;
  autoButton.textContent=autoRun?.stopping?'Stopping after bout…':autoRun?'Stop Auto Seasons':resume?'Resume Auto Seasons':'Auto Seasons';
  autoButton.setAttribute('aria-pressed',String(Boolean(autoRun)));
  autoButton.title=autoRun?'Finish the current bout, then stop.':'Finish this bracket and draw the next one. Keep this tab open.';
  hint.hidden=!resume;
  hint.textContent=resume?`Saved Auto Seasons progress for Season ${resume.season}. This tab won’t run bouts until you choose Resume.`:'';
}
function simulateInWorker(fixture: Fixture,workerPath: string): Promise<WorkerResult | null | undefined>{
  return new Promise<WorkerResult | null | undefined>((resolve,reject)=>{
    const worker=new Worker(new URL(workerPath,import.meta.url),{type:'module'});
    const finish=(error?: unknown,result?: WorkerResult | null)=>{
      if(boutJob?.worker!==worker)return;
      boutJob=null;worker.terminate();
      if(error)reject(error);else resolve(result);
    };
    boutJob={worker,cancel:()=>finish(null,null)};
    worker.onmessage=({data}: MessageEvent<WorkerData>)=>data?.error?finish(new Error(data.error)):finish(null,data?.result);
    worker.onerror=event=>{event.preventDefault();finish(new Error(event.message||'Bout simulator failed.'));};
    try{worker.postMessage(fixture);}catch(error){finish(error);}
  });
}
async function settle(epoch: number){
  const key=saveKey();
  if(syncTournamentSave(key)){stop('Loaded tournament progress from another tab or device.');return false;}
  const before=nextBout();
  if(!before)return false;
  const squad=isSquad();
  let result: Settlement | false | null | undefined;
  const ratingsBefore=isSquad()?before.teams!.map(squadElo):null;
  if(squad){
    const bout=await simulateInWorker(before,'./squad-tournament-worker.js?v=3.2.4');
    if(epoch!==runEpoch)return false;
    if(syncTournamentSave(key)){stop('Loaded tournament progress from another tab or device.');return false;}
    if(!bout)throw new Error('No squad fight result returned.');
    result=await (runSquadStep as unknown as SettleSquad)(squadState,()=>bout);
  }else if(before.limit===360||autoRun){
    const bout=await simulateInWorker(before,'./solo-tournament-worker.js?v=3.0.0');
    if(epoch!==runEpoch)return false;
    if(syncTournamentSave(key)){stop('Loaded tournament progress from another tab or device.');return false;}
    if(!bout)throw new Error('No duel result returned.');
    result=(runTournamentStep as unknown as Settle)(state,()=>bout);
  }else result=(runTournamentStep as unknown as Settle)(state,playTournamentBout as unknown as (fixture: Fixture)=>WorkerResult);
  if(epoch!==runEpoch)return false;
  const after=nextBout(),finished=bracket()?.status==='completed';
  if(result==null||result===false)throw new Error('No result returned.');
  const name=finished?chooseName(bracket()?.championId):null;
  const advance=result.result?.reason==='draw-advance'||result.reason==='draw-advance';
  const message=finished?(bracket()?.titleByDraw?'Final drawn. No title awarded.':`${name} won the season.`):
    before.id===after?.id?(squad&&result.attempt?.reason==='timeout'?'Clock expired. Draw recorded; rematch queued.':'Draw recorded. Rematch queued.'):
    advance?'Draw recorded. The seed advances without a win.':
    before.stage==='qualifier'&&after?.stage!=='qualifier'?'Qualifiers complete. The main bracket is ready.':'Bout recorded.';
  const change=ratingsBefore?before.teams!.map((team,i)=>{
    const afterRating=squadElo(squadState.teams[team.id]),delta=afterRating-ratingsBefore[i];
    return `${team.name} ${afterRating.toLocaleString()} (${delta>0?'+':''}${delta})`;
  }).join(' · '):'';
  const saved=persist(change?`${message} Elo: ${change}.`:message);
  if(epoch!==runEpoch)return false;
  if(autoRun&&!saved){autoSaveFailed('latest bout');return false;}
  rememberAuto();
  render();
  return Boolean(after);
}
function autoSaveFailed(what: string){
  restorePersistedTournament(saveKey());
  stop(`Auto Seasons stopped because this browser could not save the ${what}. Saved progress was kept.`,{keepResume:true});
}
function stop(message?: string | null,{paint=true,keepResume=false}={}){
  if(autoRun&&!keepResume)discardResume(saveKey(),autoRun.owner);
  ++runEpoch;busy=false;autoRun=null;processingBout=false;boutJob?.cancel();
  if(timer!==null){clearTimeout(timer);timer=null;}
  releaseRunLock?.();releaseRunLock=null;
  if(paint){render();if(message)status(message);}
}
function startProgress(begin: () => void | Promise<void>,{requireLock=false}={}){
  if(busy||claiming||replayDialog.open)return;
  const key=saveKey(), intent=runEpoch;
  function ready(){
    if(runEpoch!==intent||saveKey()!==key||replayDialog.open)return;
    if(syncTournamentSave(key)){stop('Loaded tournament progress from another tab or device. Try again to continue.');return;}
    begin();
  }
  if(requireLock&&(typeof navigator.locks?.request!=='function'||typeof Worker!=='function')){
    status('Auto Seasons needs browser support for workers and tab locking. You can still run one bracket at a time.');return;
  }
  if(typeof navigator.locks?.request!=='function'){ready();return;}
  claiming=true;
  try{
    navigator.locks.request('saber-pit:progress:'+key,{ifAvailable:true},lock=>{
      claiming=false;
      if(runEpoch!==intent||saveKey()!==key)return;
      if(!lock){status('This tournament is already running in another tab. Stop it there or wait for it to finish.');return;}
      const retained=new Promise<void>(resolve=>{releaseRunLock=resolve;});
      ready();
      if(!busy){releaseRunLock?.();releaseRunLock=null;}
      return retained;
    }).catch(error=>{
      claiming=false;
      console.error('Tournament lock failed',error);
      stop('Couldn’t secure this tournament tab. Existing progress was kept.');
    });
  }catch(error){
    claiming=false;
    console.error('Tournament lock failed',error);
    stop('Couldn’t secure this tournament tab. Existing progress was kept.');
  }
}
const autoStatus=()=>`Auto Seasons · Season ${currentState().season} · Keep this tab open.`;
function scheduleTick(epoch: number,delay: number){timer=setTimeout(()=>tick(epoch),delay);}
function drawSeason(options: SeasonOptions){
  if(isSquad())return (startSquadTournament as unknown as Open)(squadState,options);
  return (startTournament as unknown as Open)(state,options);
}
function nextAutoSeed(run: AutoRun){
  if(run.seed===null)return randomSeasonSeed();
  const seed=(run.seed-1+run.draws)%4294967295+1;
  run.draws=(run.draws+1)%4294967295;
  return seed;
}
async function tick(epoch: number){
  timer=null;
  if(!busy||epoch!==runEpoch)return;
  try{
    if(autoRun&&(!nextBout())){
      if(autoRun.stopping){stop('Auto Seasons stopped. Completed bouts were kept.');return;}
      if(syncTournamentSave(saveKey())){stop('Loaded tournament progress from another tab or device.');return;}
      if(bracket()?.status==='running')throw new Error('Running bracket has no available matchup');
      const config=autoRun, number=currentState().season;
      drawSeason({...config.options,seed:nextAutoSeed(config)});
      if(currentState().season<=number||!nextBout())throw new Error('No next season was drawn');
      steps=0;
      if(!persist(autoStatus())){if(epoch===runEpoch)autoSaveFailed('new bracket');return;}
      rememberAuto();
      render();
    }
    if(steps++>=100){stop('Simulation limit reached. Finished bouts are saved.',{keepResume:true});return;}
    processingBout=true;
    const more=await settle(epoch);
    if(epoch!==runEpoch)return;
    processingBout=false;
    if(autoRun?.stopping){stop('Auto Seasons stopped. The last bout was saved.');return;}
    if(!more&&!autoRun){stop();return;}
    if(autoRun)status(autoStatus());
    scheduleTick(epoch,autoRun?(more?60:300):24);
  }catch(error){
    if(epoch!==runEpoch)return;
    console.error('Tournament simulation stopped',error);
    stop('Couldn’t continue the tournament. Completed results were kept.',{keepResume:true});
  }
}
nextButton.addEventListener('click',()=>{
  if(!nextBout())return;
  startProgress(async()=>{
    if(!nextBout())return;
    discardResume(saveKey());
    const epoch=++runEpoch;
    busy=true;render();status(isSquad()?'Simulating this squad bout…':'Simulating this bout…');
    try{
      await settle(epoch);
      if(epoch!==runEpoch)return;
      stop();
      if(!nextButton.disabled)nextButton.focus();
    }catch(error){
      if(epoch!==runEpoch)return;
      console.error('Tournament bout failed',error);
      stop('Couldn’t simulate this bout. Completed results were kept.');
    }
  });
});
runButton.addEventListener('click',()=>{
  if(!nextBout())return;
  startProgress(()=>{
    if(!nextBout())return;
    discardResume(saveKey());
    const epoch=++runEpoch;
    busy=true;steps=0;newSetup.hidden=true;render();cancelButton.focus();status('Running bracket…');
    scheduleTick(epoch,24);
  });
});
cancelButton.addEventListener('click',()=>{
  stop('Stopped. Completed bouts were kept.');if(!runButton.disabled)runButton.focus();
});
const soloField=$('fieldInput'),clockSelect=$('limitInput'),longClock=$('longClock');
const clocks: {solo: Record<string,string>; squad: string}={solo:{32:'360',24:'75'},squad:'150'};
function renderSetup(){
  const squad=isSquad(),veteran=!squad&&soloField.value==='32';
  $('fieldSetting').hidden=squad;soloField.disabled=squad;
  $('squadClockHelp').hidden=!squad;
  longClock.hidden=longClock.disabled=!veteran;
  clockSelect.value=squad?clocks.squad:clocks.solo[soloField.value];
  $('newNote').textContent=veteran?
    '32 fighters. Career #1–8 and last season’s quarterfinalists skip qualifiers. Rated veterans fill qualifiers first, with at least 4 recruit places.':
    squad?'24 squads. Last season’s quarterfinalists and career #1–8 skip qualifiers. Career #9–10 get a qualifier spot if needed.':
    '24 fighters. Last season’s quarterfinalists and career #1–8 skip qualifiers. #9–10 and other rated veterans fill qualifiers first; at least 4 places go to recruits.';
}
soloField.addEventListener('change',renderSetup);
clockSelect.addEventListener('change',()=>{
  if(isSquad())clocks.squad=clockSelect.value;
  else clocks.solo[soloField.value]=clockSelect.value;
});
$('terrainInput').addEventListener('change',()=>{$('terrainHelp').hidden=$('terrainInput').value!=='rotation';});
function randomSeasonSeed(){return Math.floor(Math.random()*4294967294)+1;}
function readSeasonSetup(): SeasonSetup | null{
  const input=$('seedInput'), seed=input.value?Number(input.value):null;
  if(input.validity?.badInput||seed!==null&&(!Number.isSafeInteger(seed)||seed<1||seed>4294967295)){
    status('Use a seed from 1 to 4,294,967,295.');input.focus();return null;
  }
  return {seed,options:{limit:Number(clockSelect.value),terrain:$('terrainInput').value,
    ...(isSquad()?{}:{fieldSize:Number(soloField.value)})}};
}
autoButton.addEventListener('click',()=>{
  if(autoRun){
    if(!processingBout){stop('Auto Seasons stopped. Completed bouts were kept.');return;}
    autoRun.stopping=true;discardResume(saveKey(),autoRun.owner);
    render();status('Stopping Auto Seasons after this bout. Keep this tab open.');
    return;
  }
  if(busy||claiming)return;
  // An unfinished bracket always plays under its saved settings. A visible
  // setup form is an explicit choice for the first new season, not a reset.
  const resume=resumableRun(),active=bracket(),useSaved=active&&(active.status==='running'||newSetup.hidden);
  const config: SeasonSetup | null=resume??(useSaved?{seed:null,options:{limit:active.limit,terrain:active.terrain,
    ...(isSquad()?{}:{fieldSize:active.fieldSize??24})}}:readSeasonSetup());
  if(!config)return;
  startProgress(()=>{
    if(resume&&resumableRun()?.owner!==resume.owner){
      renderAutoControl();status('That resume point changed. Check the latest bracket before continuing.');return;
    }
    const owner=globalThis.crypto?.randomUUID?.()??`auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    autoRun={seed:config.seed,options:config.options,stopping:false,draws:config.draws??0,owner};
    rememberAuto();
    const epoch=++runEpoch;
    busy=true;steps=0;newSetup.hidden=true;render();
    status(nextBout()?autoStatus():'Auto Seasons · Preparing the next season. Keep this tab open.');
    scheduleTick(epoch,40);
  },{requireLock:true});
});
newButton.addEventListener('click',()=>{
  if(busy||claiming)return;
  newSetup.hidden=!newSetup.hidden;
  if(!newSetup.hidden)$('seedInput').focus();
});
$('closeSetup').addEventListener('click',()=>{newSetup.hidden=true;newButton.focus();});
newSetup.addEventListener('submit',event=>{
  event.preventDefault();
  if(busy||claiming)return;
  const config=readSeasonSetup();
  if(!config)return;
  startProgress(()=>{
    try{
      discardResume(saveKey());
      drawSeason({...config.options,seed:config.seed??randomSeasonSeed()});
      newSetup.hidden=true;persist('Season drawn. Choose Next bout, Run bracket, or Auto Seasons.');render();nextButton.focus();
    }catch(error){console.error('Tournament setup failed',error);status('Couldn’t draw the bracket.');}
  });
});
$('tournamentApp').addEventListener('click',event=>{
  const team=(event.target as Element).closest<HTMLElement>('[data-team-id]');
  if(team&&isSquad()){
    selectedTeamId=team.dataset.teamId;
    document.querySelectorAll<HTMLElement>('[data-team-id]').forEach(b=>{
      const active=b.dataset.teamId===selectedTeamId;
      b.setAttribute('aria-pressed',String(active));b.closest('tr')?.classList.toggle('selected',active);
    });
    renderTeam();
    $('teamName').focus({preventScroll:true});$('teamName').scrollIntoView({block:'nearest'});return;
  }
  const member=(event.target as Element).closest<HTMLButtonElement>('[data-squad-member]');
  if(member&&isSquad()){
    if(busy||claiming||member.disabled)return;
    if(syncTournamentSave(SQUAD_TOURNAMENT_KEY)){render();status('Squad progress changed. Select the fighter again.');return;}
    syncTournamentSave(TOURNAMENT_KEY);
    const result=(saveSquadTournamentHero as unknown as (solo: TournamentSave,squads: TournamentSave,team?: string | null,member?: string) => Fighter | null)(state,squadState,selectedTeamId,member.dataset.squadMember);
    if(!result){status('Couldn’t save this fighter as a Hero.');return;}
    if(!persist(result.name+' added to Saved Heroes.',TOURNAMENT_KEY)){
      restorePersistedTournament(TOURNAMENT_KEY);render();return;
    }
    selectedId=result.id;selectedSource='saved';render();
    $('fighterName').focus({preventScroll:true});$('fighterName').scrollIntoView({block:'nearest'});return;
  }
  const button=(event.target as Element).closest<HTMLElement>('[data-fighter-id]');
  if(!button||(isSquad()&&button.dataset.source!=='saved'))return;
  selectedId=button.dataset.fighterId;selectedSource=(button.dataset.source||'live') as Source;markSelected();renderProfile();
  const heading=$('fighterName');
  if(!heading)return;
  heading.focus({preventScroll:true});heading.scrollIntoView({block:'nearest'});
});
$('saveHero').addEventListener('click',()=>{
  const row=getRecord(selectedId);
  if(!row||busy||!tournamentHeroEligible(row)||heroCurrent(row,getHero(selectedId)))return;
  const result=(saveTournamentHero as unknown as (state: TournamentSave,id?: string | null) => Fighter | false | null)(state,selectedId);
  if(result==null||result===false){status('Couldn’t save this fighter as a Hero.');return;}
  selectedSource='saved';
  persist(`${row.name} added to Saved Heroes.`);renderHeroes();markSelected();renderProfile();
});
const removeHeroDialog=$('removeHeroDialog');
let heroToRemove: Fighter | null=null;
$('removeHero').addEventListener('click',()=>{
  const hero=getHero(selectedId);
  if(busy||selectedSource!=='saved'||!hero)return;
  heroToRemove=hero;
  removeHeroDialog.returnValue='';
  $('removeHeroTitle').textContent='Remove '+hero.name+'?';
  $('removeHeroHelp').textContent='This removes the saved copy from your Hero roster. The fighter’s tournament record and Peak Elo stay.';
  removeHeroDialog.showModal();
});
removeHeroDialog.addEventListener('close',()=>{
  const hero=heroToRemove;
  heroToRemove=null;
  if(removeHeroDialog.returnValue!=='remove'||!hero||busy){$('removeHero').focus();return;}
  if(!(removeTournamentHero as unknown as (state: TournamentSave,id: string) => boolean)(state,hero.id)){status('That Hero is no longer saved.');return;}
  selectedId=state.records?.[hero.id]?hero.id:null;
  selectedSource='live';
  persist(hero.name+' removed from Saved Heroes. Tournament records are unchanged.',TOURNAMENT_KEY);
  render();
  if(selectedId)$('fighterName').focus({preventScroll:true});
  else $('heroesTitle').focus({preventScroll:true});
});
$('heroGender').replaceChildren(...FIGHTER_GENDERS.map(gender=>{
  const choice=wrap('option',null,fighterGenderLabel(gender));choice.value=gender;return choice;
}));
$('heroGenderEditor').addEventListener('submit',e=>{
  e.preventDefault();
  if(selectedSource!=='saved'||busy)return;
  const result=(setTournamentHeroGender as unknown as (state: TournamentSave,id: string | null | undefined,gender: string) => Fighter | null)(state,selectedId,$('heroGender').value);
  if(!result){status('Couldn’t save this Hero’s gender.');return;}
  persist(result.name+' · '+fighterGenderLabel(result.gender)+' saved.',TOURNAMENT_KEY);
  renderHeroes();
  // Update the profile and portrait without discarding any unsaved Elo edits.
  const rating=$('heroEloRating').value,floor=$('heroEloFloor').value;
  renderProfile();
  $('heroEloRating').value=rating;$('heroEloFloor').value=floor;
});
$('heroEloFloor').replaceChildren(...Object.entries(ELO_FLOORS).map(([grade,floor])=>{
  const choice=wrap('option',null,grade+' · '+floor.toLocaleString());
  choice.value=grade;return choice;
}));
$('heroEloEditor').addEventListener('submit',e=>{
  e.preventDefault();
  if(selectedSource!=='saved'||busy)return;
  const rating=$('heroEloRating').valueAsNumber;
  const result=(setTournamentHeroElo as unknown as (state: TournamentSave,id: string | null | undefined,elo: number,floor: string) => Fighter | null)(state,selectedId,rating,$('heroEloFloor').value);
  if(!result){status('Enter a valid Elo in half-point steps.');return;}
  persist('Saved Hero Elo: '+result.elo.toLocaleString()+'. Tournament Elo is unchanged.',TOURNAMENT_KEY);
  const pendingGender=$('heroGender').value;
  renderProfile();
  $('heroGender').value=pendingGender;
});
function showFormat(value: TournamentFormat){
  if(busy||claiming||replayDialog.open)return;
  format=value;
  history.replaceState(null,'',isSquad()?'#squads':location.pathname+location.search);
  newSetup.hidden=true;status('');render();
}
$('soloFormat').addEventListener('click',()=>showFormat('solo'));
$('squadFormat').addEventListener('click',()=>showFormat('squad'));
const resetDialog=$('resetDialog');
$('resetButton').addEventListener('click',()=>{
  if(busy||!currentState().season)return;
  resetDialog.returnValue='';
  $('resetHeading').textContent=isSquad()?'Reset 5v5 tournament?':'Reset 1v1 tournament?';
  $('resetDescription').textContent=isSquad()?'This clears squad brackets, team Elo, peak records and replays from this browser. The 1v1 tournament and Saved Heroes stay.':'This clears 1v1 brackets, Elo, peak records and bout results from this browser. Saved Heroes and the 5v5 tournament stay.';
  resetDialog.showModal();
});
resetDialog.addEventListener('close',()=>{
  if(resetDialog.returnValue!=='reset'){$('resetButton').focus();return;}
  discardResume(saveKey());
  if(isSquad()){squadState=(resetSquadTournament as unknown as (state: SquadSave) => SquadSave)(squadState);selectedTeamId=null;}
  else{state=(resetTournament as unknown as (state: SoloSave) => SoloSave)(state);selectedId=null;selectedSource='live';}
  newSetup.hidden=true;
  persist(isSquad()?'5v5 tournament reset.':'1v1 tournament reset. Saved Heroes were kept.');
  render();newButton.focus();
});
const replaySpeed=$('replaySpeed'),replayPause=$('replayPause'),replaySkip=$('replaySkip');
let skipPlayback: (()=>boolean) | null=null;
function resetReplayPause(){playbackPaused=false;pausePlayback=null;replayPause.disabled=true;replayPause.textContent='Pause';skipPlayback=null;replaySkip.disabled=true;}
replaySkip.addEventListener('click',()=>{if(skipPlayback?.()){replaySkip.disabled=true;replayPause.disabled=true;replaySpeed.disabled=true;$('replayStatus').textContent='Skipping to result…';}});
replayPause.addEventListener('click',()=>{
  if(!pausePlayback)return;
  playbackPaused=!playbackPaused;
  pausePlayback(playbackPaused);
  replayPause.textContent=playbackPaused?'Resume':'Pause';
});
replaySpeed.addEventListener('change',()=>setPlaybackSpeed?.(replaySpeed.value));
watchLast.addEventListener('click',async()=>{
  const replay=bracket()?.lastReplay;
  if(!replay||!supportsReplay(replay.ruleset)||busy||replayDialog.open)return;
  const version=++replayEpoch,replayStatus=$('replayStatus'),canvas=$('replayArena');
  canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
  replayStatus.textContent='Opening replay…';
  replaySpeed.value='1';replaySpeed.disabled=true;resetReplayPause();
  const livePlans=$('replayPlans');livePlans.hidden=true;livePlans.textContent='';
  replayDialog.showModal();
  try{
    const squad=isSquad();
    const play=squad?(await import('./squad-tournament-replay.js?v=5.0.1')).startSquadTournamentPlayback:
      (await import('./tournament-replay.js?v=5.0.1')).startTournamentPlayback;
    if(version!==replayEpoch||!replayDialog.open)return;
    const live=()=>version===replayEpoch&&replayDialog.open;
    const result=await (play as unknown as StartReplay)(canvas,replay,{
      onFrame(secondsLeft,game){
        if(!live())return;
        const n=Math.max(0,Math.ceil(secondsLeft)),stamp=`${Math.trunc(n/60)}:${String(n%60).padStart(2,'0')}`;
        const line=`Replay · ${stamp} remaining`;
        if(replayStatus.textContent!==line)replayStatus.textContent=line;
        if(game?.config?.matchGoalPlanning){
          const plans=[0,1].map((team,i)=>{
            const side=game.fighters.filter(f=>f.alive&&f.team===team);
            const name=(squad?replay.teams:replay.fighters)?.[i]?.name??(team?'Pink':'Blue');
            const win=side.filter(f=>f.matchGoal==='win').length,draw=side.filter(f=>f.matchGoal==='draw').length;
            return name+': '+(side.length?squad?[win?win+' Win':null,draw?draw+' Draw':null].filter(Boolean).join(' / '):goalName(side[0]?.matchGoal):'Out');
          }).join('  ·  ');
          livePlans.hidden=false;
          if(livePlans.textContent!==plans)livePlans.textContent=plans;
        }
      },
      onSkipError(){if(live()){replayPause.disabled=!pausePlayback;replayPause.textContent='Pause';playbackPaused=false;replaySpeed.disabled=!setPlaybackSpeed;replayStatus.textContent='Skip could not finish. Replay resumed.';}},
      onEnd(winnerIndex){
        if(!live())return;
        replaySpeed.disabled=true;setPlaybackSpeed=null;resetReplayPause();
        const winner=(squad?replay.teams:replay.fighters)?.[winnerIndex!]?.name;
        replayStatus.textContent=winner?`${winner} won. Replay only.`:'Bout ended in a draw. Replay only.';
      }
    });
    const end=typeof result==='function'?result:typeof result?.destroy==='function'?()=>result.destroy!():typeof result?.stop==='function'?()=>result.stop!():null;
    if(!live()){end?.();return;}
    stopPlayback=end;setPlaybackSpeed=result?.setSpeed;replaySpeed.disabled=!setPlaybackSpeed;
    if(result?.pause&&result?.resume){pausePlayback=paused=>paused?result.pause!():result.resume!();replayPause.disabled=false;}
    if(result?.skip){skipPlayback=()=>result.skip!();replaySkip.disabled=false;}
    if(replayStatus.textContent==='Opening replay…')replayStatus.textContent='Replay only. It does not change the bracket.';
  }catch(error){if(version===replayEpoch&&replayDialog.open){
    console.error('Could not open replay',error);replayStatus.textContent='Couldn’t open this replay.';
  }}
});
replayDialog.addEventListener('close',()=>{
  replayEpoch++;stopPlayback?.();stopPlayback=null;setPlaybackSpeed=null;replaySpeed.disabled=true;resetReplayPause();if(!watchLast.hidden)watchLast.focus();
});
render();

window.addEventListener('storage',({key})=>{
  if(resumeKeys.includes(key!)){if(key===resumeKey(saveKey()))renderAutoControl();return;}
  const keys=key===null?tournamentKeys:tournamentKeys.includes(key as SaveKey)?[key as SaveKey]:[];
  const changed=keys.filter(syncTournamentSave);
  if(!changed.length)return;
  if(changed.includes(saveKey()))stop('Loaded tournament progress from another tab or device.');
  else render();
});
window.addEventListener('pagehide',()=>{
  if(busy||claiming)stop(null,{paint:false,keepResume:true});
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  tournamentKeys.forEach(syncTournamentSave);render();
  if(!resumableRun())status('Auto Seasons do not continue when this page is closed or left.');
  else status('This tab stopped running Auto Seasons when you left.');
});

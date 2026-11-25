import {createArcadeCombatAudio} from './arcade-combat-audio.js?v=6.0.2';
import {arenaSeatKind,openArenaSeat,type ArenaSeat} from './arena-seat.js?v=6.0.2';
import {arenaFighterAppearance,ARENA_TEAM_GENDERS,ARENA_TEAM_APPEARANCES} from './arcade-team-looks.js?v=6.0.2';
import {createAutoDuel} from './arcade-auto-duel.js';
import {ARENA_MOTION_FLOW,PREVIEW_MOTION_FLOW} from './arcade-motion-flow.js?v=6.0.2';
import {MINOR_MOVE_HINTS} from './arcade-minor-moves.js?v=3.1.0';
import {createArcadeSwingWaves} from './arcade-swing-waves.js?v=6.0.2';
import {ARCADE_MOTION_KEY,readArcadeReducedMotion,saveArcadeReducedMotion} from './arcade-motion-preference.js?v=2.43.0';
import {combatMoveLabel} from './arcade-callouts.js?v=6.0.2';
import {createArcadeFloatingText} from './arcade-floating-text.js?v=6.0.2';
import {CIRCUIT_CUT_HINTS} from './arcade-circuit-cuts.js?v=2.33.0';
import {arcadeExpandedMoveById,arcadeExpandedMovesFor} from './arcade-expanded-combat.js?v=3.1.0';
import {ARCADE_ATTACKS,ARCADE_AIR_STRIKES,ARCADE_TRAKATA_ID,ARCADE_FORMS,ARCADE_FORM_IDS,createArcade,stepArcade,arcadeMovesFor} from "./arcade-engine-api.js?v=6.0.2";
import type {ArcadeGame,ArcadeFighter,ArcadeEvent,ArcadeMode,ArcadeOptions,ArcadeInput} from "./arcade-engine-api.js?v=6.0.2";
import {drawArcadeFighter} from './arcade-painter.js?v=6.0.2';
import {sampleArcadeFighter,arcadeBladeWorld,arcadeHeroLabelWorld} from './arcade-fighters.js?v=6.0.2';
import {createArcadeFX} from './arcade-fx.js?v=6.0.2';
import {paintArcadeStageMatte} from './arcade-stage-matte.js';
import {createArcadeStage,drawArcadeStage,createArcadeTerrain,drawArcadeObstacle,resolveArcadeMap} from './arcade-stage.js?v=6.0.2';
import {FRAME_STEP,advanceSim,displayDelta,displayFighters,fighterSamples,newDisplayClock,resetDisplayClock} from './arcade-display.js?v=2.44.0';
import {ARCADE_CAREER_KEY,classicCareers,readArcadeCareer,arenaCareerBytes,commitArenaRound,settleArcadeCareer} from './arcade-career.js?v=6.0.2';
import {ARCADE_BODY_REGIONS,arcadeInjuryReport,arcadeRegionalCondition,ARCADE_LIMB_DISABLE_PCT} from './arcade-injuries.js?v=6.0.2';
import {crowdedFighters,sharesSilhouette} from './arcade-layout.js?v=2.9.0';
import {ARCADE_RANK_FOOTWORK,arcadeRankFootworkFor} from './arcade-rank-footwork.js?v=2.27.0';
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=3.1.0';
import {gradeDisplayLabel,SOLDIER_GRADES} from './progression.js?v=1.4.0';
import {ARCADE_MAPS,SIZE,arenaWorldSize,arenaFixedMapSize,presets,normalizeSetup,setupPlayAs,playAsSetup,watchHeroSetup,lobbyHeroControl,setupMode,engineLineups,engineChessStyleOverrides,engineForcePools,canArenaNovicePractice,canArenaSquadTraining,canArenaLaneDrill,canArenaAdaptiveSparring,loadSetup,saveSetup} from './arcade-setup.js?v=6.0.2';
import {ARCADE_CHESS_STYLES} from './arcade-chess-styles.js?v=2.44.0';
import {arcadeForcePoolEntry} from './arcade-force-pool.js?v=6.0.2';
import {createArenaForcePicker} from './arcade-force-picker.js?v=6.0.2';
import {ARCADE_GEAR_QUALITIES,ARCADE_FORCE_FAMILIES,ARCADE_SABER_OPTIONS,arcadeFighterGear,arcadeSaberOption} from './arcade-loadouts.js?v=6.0.2';
import {actionFrame,stepActionFrame,screenToArena,composeArcadeFrame,portraitActionFrame,portraitDuelActionFrame,canFocusCauseways,selectArenaFocus} from './arcade-camera.js?v=6.0.2';
import {battleHeroLineup,normalizeHeroLineup} from './arcade-heroes.js?v=6.0.2';
import {fighterGenderLabel} from './arcade-fighter-profiles.js?v=2.18.3';
import {eloFloor} from './arcade-elo.js?v=2.18.5';
import {arenaLobbyRating} from './arcade-arena-rating-ui.js?v=6.0.2';
import {arenaNormalRanked,arenaNormalRating,arenaNormalCap} from './arcade-normal-elo.js?v=6.0.2';
import type {ArenaNormalRatings as ArenaRatings} from './arcade-normal-elo.js?v=6.0.2';
import {loadTournament,tournamentHeroes} from './arcade-tournament.js?v=6.0.2';
import {tournamentHeroLoadout} from './arcade-tournament-sim.js?v=6.0.2';
import {arcadeTapAim,createArcadeTouchOwner} from './arcade-touch.js?v=2.14.0';
import {heroWatchFrame,captureHeroWatch} from './arcade-hero-watch.js?v=2.33.0';
import {arcadeHeroMarkers,drawArcadeHeroMarkers} from './arcade-hero-markers.js?v=6.0.2';
import {arenaNode as $,readTouchPrefs,touchPrefsKey,arenaInputFrame} from './arcade-ui-input.js';
import {createHeldArenaKeys,isEditableTarget,keyLabel,keyMapFrom,loadKeyBindings} from './arcade-keys.js?v=6.0.2';
import {buildArenaScoreboard} from './arcade-scoreboard.js?v=6.0.2';
import {crowdPersonaOf,CROWD_PERSONA_LABELS} from './arcade-crowd-ai.js?v=6.0.2';
import {createArcadeBarks} from './arcade-crowd-barks.js?v=6.0.2';
import {mountArenaScoreboard} from './arcade-scoreboard-view.js?v=6.0.2';
import {buildRoundResult} from './arcade-results.js?v=6.0.2';
import {renderRoundResult,renderResultMeta} from './arcade-results-view.js?v=6.0.2';
import {recordArenaRound} from './arcade-record.js?v=6.0.2';
import {activeArenaPreset,arenaSetupSummaryParts} from './arcade-setup-summary.js?v=6.0.2';
import {createSettingsSession} from './arcade-settings-session.js';
import {mountStatsPage} from './arcade-stats-page.js?v=6.0.2';
import {mountKeysPanel} from './arcade-keys-panel.js?v=6.0.2';
import {mountVersusTouch} from './arcade-vs-touch.js?v=6.0.2';
import {createPadReader,createPadSeats,createPadLatch,padHeld,padStick,padAim,P2_KEYS,type PadState} from './arcade-gamepad.js?v=6.0.2';
/** Home's Continue run: same action as Match setup's, shown only with a saved run. */
const homeContinue=document.getElementById('homeContinue');
interface Point{x:number;y:number}
type ArenaMode=ArcadeMode; type Scene='menu'|'game';
type TouchAim={id:string}|(Point&{id?:never;until:number});
type SavedHero=ReturnType<typeof tournamentHeroes>[number];
type Career={mode:ArcadeMode;seed:number;round:number;arenaRatings?:ArenaRatings;careers:NonNullable<ArcadeOptions['careers']>;
  records?:ArcadeOptions['records'];setup?:ReturnType<typeof loadSetup>;form?:string;body?:string;heroLineup?:ArcadeOptions['heroLineup'];};
type TechniqueRow={name:string;id:string;tactical?:string;opening?:string;circuitCut?:boolean;arenaCut?:boolean;minorMove?:boolean};
const field = <T extends object>(obj:T,key:PropertyKey|undefined):T[keyof T]|undefined => obj[key as keyof T];
const readCareerForUI=readArcadeCareer as unknown as ()=>Career|null;
type HeroLineup=ReturnType<typeof battleHeroLineup>;
type SceneOptions=Pick<ArcadeOptions,'records'|'careers'|'heroLineup'>&{setup?:ReturnType<typeof loadSetup>;arenaRatings?:ArenaRatings;seat?:ArenaSeat};
// A bout another page owns (Gauntlet): this screen runs it with its own HUD and controls, and the seat settles it.
let seat:ArenaSeat|null=null;
type AimEvent=Pick<PointerEvent,'clientX'|'clientY'>;
const canvas=$('arena'), ctx=canvas.getContext('2d',{alpha:false})!;
let W=1120,H=640;
let setup=loadSetup(), matchSetup=setup, pendingOrder:ArcadeInput["order"]|null=null,matchHeroes:HeroLineup={},heroRoster:SavedHero[]=[];
const clock=newDisplayClock(), sim={remainder:0,previous:null as ReturnType<typeof fighterSamples>|null};
const clamp=(v:number,l:number,h:number)=>Math.min(h,Math.max(l,v));
const chessReadout=(f:ArcadeFighter|undefined)=>f?.chessPawn?.promoted?'Pawn → Queen':f?.chessStyle&&f.chessStyle!=='none'?ARCADE_CHESS_STYLES[f.chessStyle]?.label??'':'';

const mobileUI=matchMedia('(max-width:740px), (pointer:coarse) and (max-width:1100px), (orientation:landscape) and (max-height:520px) and (max-width:1100px)');
const portraitUI=matchMedia('(max-width:740px) and (orientation:portrait)');
const touchPrefs=readTouchPrefs(), stick=createArcadeTouchOwner(), stickButton=$('touchStick');
const lore={
  shii_cho:{name:'Shii-Cho',roman:'I',tag:'Crowd Control',signature:'Wide Sweep'},
  makashi:{name:'Makashi',roman:'II',tag:'Precision',signature:'Linear Thrust'},
  soresu:{name:'Soresu',roman:'III',tag:'Defense',signature:'Guard Riposte'},
  ataru:{name:'Ataru',roman:'IV',tag:'Acrobatic',signature:'Acrobatic Vault'},
  djem_so:{name:'Djem So',roman:'V',tag:'Counter Power',signature:'Power Counter'},
  niman:{name:'Niman',roman:'VI',tag:'Force Hybrid',signature:'Force Strike'},
  juyo:{name:'Juyo',roman:'VII',tag:'Relentless',signature:'Ferocity Chain'}
};
const ratingText=(value:number)=>value.toLocaleString('en-US');
const formName=(id:string)=>field(lore,id)?.name||field(ARCADE_FORMS,id)?.name||'Saber';
const titleCase=(value:string)=>value[0].toUpperCase()+value.slice(1);
const autoDuel=createAutoDuel();
let roundSaveBaseline:string|null|undefined;
let autoCareerMode:ArenaMode|undefined;
function rawArenaSave(){try{return localStorage.getItem(ARCADE_CAREER_KEY);}catch{return undefined;}}
const fx=createArcadeFX({contactLabels:false}), swingWaves=createArcadeSwingWaves();
let roundRatings:ArenaRatings={}, roundRated=false, ratingUnrecorded=false, ratingReport:NonNullable<ReturnType<typeof settleArcadeCareer>>['report']=[];
let view:Scene='menu', mode:ArenaMode='duel', paused=false, game:ArcadeGame, stage:ReturnType<typeof createArcadeStage>, round=1, seed=0, seedCounter=0;
let heroWatchEvents:ReturnType<typeof captureHeroWatch>={},heroWatchFocus=false,watchedHeroIdentity='',heroWatchKey='';
let moveSeen:Record<string,number>={}, echoes=new Map<string,{pose:ArcadeFighter;time:number;at:number}[]>(), watchedPhases:Record<string,boolean>={}, maxHeight=0;
let career:Career|null=null, imported:ReturnType<typeof classicCareers>|null=null, savedCareer=readCareerForUI();
let crowdedLOD=false;
let displayTime=0, hudAt=-1, endDelay=0, lastEvent=0, hitDelay=0;
const combatAudio=createArcadeCombatAudio();
let reduced=readArcadeReducedMotion(), touchWalk=false, followAction=true;
let transform:Omit<ReturnType<typeof composeArcadeFrame>,"scaleY">&{scaleY?:number}={scale:1,x:0,y:0},canvasPixelScale=1;
let portraitFocusId='', portraitWasActive=false;
let causewayFocus=false,causewayFocusWasActive=false,preferredArenaFocusId='';
let focus={x:W/2,y:H/2,zoom:1}, aim:Point|null=null,touchAim:TouchAim|null=null,touchDown:(Point&{id:number})|null=null;
const keys=new Set<string>(), pointers=new Map<number,string>(), pulse=new Set<string>();
const HUD_TEXT_KEY='saber-pit-arena-hud-text';
const hudText=$('arenaHudText');
function applyHudText(value:unknown){
  const setting=value==='125'||value==='150'?value:'100';
  hudText.value=setting;
  document.body.dataset.hudText=setting;
  return setting;
}
try{applyHudText(localStorage.getItem(HUD_TEXT_KEY));}catch{applyHudText(null);}
hudText.addEventListener('change',()=>{
  const setting=applyHudText(hudText.value);
  try{localStorage.setItem(HUD_TEXT_KEY,setting);}catch{}
});

let arenaBindings=loadKeyBindings(),keyMap=keyMapFrom(arenaBindings);
const heldArenaKeys=createHeldArenaKeys(keys);
// Controllers and local versus. Nothing here is saved: Two players is chosen per visit.
const padReader=createPadReader(), padSeats=createPadSeats(), padLatch=createPadLatch();
let pads:PadState[]=[], padStatsHeld=false, localVersus=false;
const p2keys=new Set<string>(), p2pulse=new Set<string>(), heldP2Keys=createHeldArenaKeys(p2keys);
const versusLive=()=>view==='game'&&game?.config.localVersus===true;
// Two people on one phone: each gets a compact pad. Same query as the Arena's own touch layout.
const vsTouch=mountVersusTouch(document.body);
const touchLayout=matchMedia('(max-width:740px), (pointer:coarse) and (max-width:1100px), (orientation:landscape) and (max-height:520px) and (max-width:1100px)');
const portraitView=matchMedia('(orientation:portrait)');
let vsTouchKey='', p2Technique:string|null=null;
function syncVersusTouch(){
  const on=versusLive()&&touchLayout.matches&&!paused&&game.phase==='playing';
  const {p1,p2}=padSeats.assign(pads,versusLive());
  const show:[boolean,boolean]=[on&&!p1.length,on&&!p2.length];
  const key=show.join()+portraitView.matches;
  if(key===vsTouchKey)return;
  vsTouchKey=key;vsTouch.sync(show,portraitView.matches);
  document.body.dataset.vsTouch=String(show[0]||show[1]);
}
let scoreboardKey:string|null=null;
const scoreboard=mountArenaScoreboard({
  root:document.getElementById('scoreboard') as HTMLDialogElement|null,toggle:document.getElementById('statsButton') as HTMLButtonElement|null,
  details:document.getElementById('scoreboardDetails') as HTMLButtonElement|null,close:document.getElementById('scoreboardClose') as HTMLButtonElement|null,
  model:()=>view==='game'&&game?buildArenaScoreboard({
    fighters:game.fighters.map(f=>({id:f.id,team:f.team,slot:f.slot,control:f.control,alive:f.alive,
      name:f.displayName??formName(f.form),rank:gradeDisplayLabel(f.career?.grade??'F'),
      kills:f.stats?.kills,deaths:f.stats?.deaths,damage:f.stats?.damage,slotRating:roundRatings[f.id],heroElo:f.heroElo,
      persona:crowdPersonaLabel(f)})),
    rule:game.config.rule,mapSize:String(matchSetup.mapSize??''),mapLabel:arenaFixedMapSize(matchSetup.mapId)?field(ARCADE_MAPS,matchSetup.mapId)?.[0]:undefined,round,secondsLeft:game.limit-game.time,rated:roundRated,
    objective:game.objective?.target?[game.objective.score[0]??0,game.objective.score[1]??0]:null,
  }):null,
  onDetails:()=>openStats(),onPin:()=>clearInput(false),
  onUnavailable:()=>{if(view==='game'&&game&&(paused||game.phase!=='playing')&&!document.querySelector('dialog[open]'))openStats();},
  canOpen:()=>view==='game'&&!paused&&game?.phase==='playing'&&!document.querySelector('dialog[open]:not(#scoreboard)'),
});
const punishLabels:Record<string,string>={whiff:'Whiff',parried:'Parry',guard_break:'Guard Break',terror:'Terror'};
const callouts=createArcadeFloatingText(), barks=createArcadeBarks();
const crowdPersonaLabel=(f:unknown)=>{const p=crowdPersonaOf(f);return p?CROWD_PERSONA_LABELS[p]:null;};
const announce=(text:string)=>{$('announce').textContent=text;};
/** Short labels as separate .v6-meta pills instead of a "·" chain. Empty parts are dropped. */
function setPills(target:HTMLElement,parts:readonly (string|null|undefined|false)[]){
  const list=parts.filter((t):t is string=>!!t),key=list.join('|');if(target.dataset.pills===key)return;target.dataset.pills=key;
  target.replaceChildren(...list.flatMap((t,i)=>{const n=document.createElement('span');n.className='v6-meta';n.textContent=t;return i?[' ',n]:[n];}));
}
function resize(){
  const {width,height}=canvas.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,2,Math.sqrt((crowdedLOD?530000:2300000)/Math.max(1,width*height)));
  canvas.width=Math.max(1,Math.floor(width*dpr));canvas.height=Math.max(1,Math.floor(height*dpr));
  canvasPixelScale=width>0?canvas.width/width:1;
}
new ResizeObserver(resize).observe(canvas);resize();
function canPortraitFollow(){return portraitUI.matches&&view==='game';}
function canDesktopCausewayFocus(){return view==='game'&&!canPortraitFollow()&&canFocusCauseways(matchSetup.mapId,game?.fighters.length??0);}
// Fight view: Camera and Full screen live in Pause; the top cluster keeps Camera only where it fits.
const pauseView=document.createElement('div');pauseView.className='dialog-actions pause-view';
const pauseCamera=document.createElement('button');pauseCamera.type='button';pauseCamera.id='pauseCamera';
pauseCamera.addEventListener('click',()=>{$('cameraView').click();pauseCamera.focus({preventScroll:true});});
pauseView.append(pauseCamera,$('gameFullscreen'));
$('pauseOverlay').querySelector('.dialog')?.append(pauseView);
function syncPauseCamera(){
  const button=$('cameraView');
  pauseCamera.textContent=button.textContent;pauseCamera.hidden=button.hidden;pauseCamera.disabled=button.disabled;pauseCamera.title=button.title;
  const pressed=button.getAttribute('aria-pressed');
  if(pressed===null)pauseCamera.removeAttribute('aria-pressed');else pauseCamera.setAttribute('aria-pressed',pressed);
  pauseCamera.setAttribute('aria-label',button.getAttribute('aria-label')??'Camera');
}
function syncCamera(){
  const button=$('cameraView'), portrait=canPortraitFollow(), causeways=canDesktopCausewayFocus();
  button.disabled=view!=='game'||(portrait||causeways?reduced:!game||game.config.rule!=='elimination'||game.fighters.length>6);
  const action=(causeways?causewayFocus:followAction)&&!reduced&&!button.disabled;
  document.body.dataset.portraitAction=String(portrait&&action);
  button.textContent=portrait?(action?'Full Arena':'Close View'):causeways?(action?'Overview':'Focus Fighter'):(action?'Action Cam':'Wide Cam');
  button.setAttribute('aria-label',portrait||causeways?button.textContent:'Action Cam');
  if(portrait)button.removeAttribute('aria-pressed');else button.setAttribute('aria-pressed',String(action));
  button.title=reduced?'Reduced Motion':button.disabled?'Fixed View':'';
  syncPauseCamera();
}
portraitUI.addEventListener('change',()=>{syncCamera();resize();if(game)draw(0);});
function setReduced(value:boolean){
  reduced=value;document.body.dataset.reduced=String(value);$('motion').setAttribute('aria-pressed',String(value));syncCamera();
  if(game){resize();updateHeroWatch();draw(0);}
}
$('cameraView').addEventListener('click',()=>{if(reduced||$('cameraView').disabled)return;if(canDesktopCausewayFocus())causewayFocus=!causewayFocus;else followAction=!followAction;syncCamera();resize();draw(0);if(!paused)canvas.focus({preventScroll:true});});
setReduced(reduced);
window.addEventListener('storage',event=>{
  if(event.key===ARCADE_MOTION_KEY||event.key===null)setReduced(readArcadeReducedMotion());
});
$('motion').addEventListener('click',()=>{
  const next=!reduced;saveArcadeReducedMotion(next);setReduced(next);
});
let soundRequested=false, soundRequest=0;
$('sound').addEventListener('click',async()=>{
  const request=++soundRequest,requested=soundRequested=!soundRequested;
  const running=await combatAudio.setEnabled(requested);
  if(request!==soundRequest)return;
  soundRequested=running;
  $('sound').textContent=running?'On':'Off';$('sound').setAttribute('aria-pressed',String(running));
});
function syncTouchPrefs(){
  document.body.dataset.touch=touchPrefs.layout;
  document.body.dataset.touchSide=touchPrefs.side;
  $('touchLayout').textContent=touchPrefs.layout==='arrows'?'Move: Arrows':'Move: Stick';
  $('touchSide').textContent=touchPrefs.side==='left'?'Hand: Left':'Hand: Right';
}
function syncTouchAim(){
  const button=$('resetAim'), next=touchAim?(touchAim.id?'Aim: Locked':'Aim: Point'):'Aim: Auto';
  if(button.textContent!==next)button.textContent=next;
  const pressed=String(Boolean(touchAim));
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
}
function paintStick(){
  const {thumbX,thumbY,pointerId}=stick.snapshot();
  stickButton.style.setProperty('--stick-x',thumbX+'px');
  stickButton.style.setProperty('--stick-y',thumbY+'px');
  stickButton.dataset.held=String(pointerId!==null);
}
function cancelStick(){
  const {pointerId}=stick.snapshot();
  stick.cancel();
  if(pointerId!==null&&stickButton.hasPointerCapture(pointerId))stickButton.releasePointerCapture(pointerId);
  paintStick();
}
function clearInput(clearAim=true){
  touchDown=null;heldArenaKeys.clear();heldP2Keys.clear();p2pulse.clear();vsTouch.clear();pointers.clear();pulse.clear();aim=null;cancelStick();scoreboardKey=null;scoreboard.hold(false);
  if(clearAim){touchAim=null;syncTouchAim();}
  document.querySelectorAll<HTMLElement>('[data-held=true]').forEach(b=>b.dataset.held='false');
}
function active(name:string){return keys.has(name)||[...pointers.values()].some(x=>x===name);}
function currentTouchAim(){
  const current=touchAim;
  if(!current)return null;
  if(current.id){
    const target=game.fighters.find(f=>f.id===touchAim?.id&&f.alive);
    if(target)return target;
  }else if(game.time<(current as Point&{until:number}).until)return current as Point;
  touchAim=null;syncTouchAim();return null;
}
function inputs(){
  const seats=padSeats.assign(pads,versusLive()),p1=padLatch.filter(seats.p1),p2=padLatch.filter(seats.p2);
  const me=game.fighters.find(f=>f.control&&f.team===0);
  const p=padAim(p1,me)??currentTouchAim()??(aim&&screenToArena(aim.x,aim.y,{left:0,top:0,width:1,height:1},canvas.width,canvas.height,transform));
  const none={held:new Set<string>(),pulse:new Set<string>(),stick:{x:0,y:0}};
  const t1=vsTouch.shown(0)?vsTouch.players[0]:none,t2=vsTouch.shown(1)?vsTouch.players[1]:none,moved=(v:{x:number;y:number})=>v.x||v.y?v:null;
  const data=arenaInputFrame({held:name=>active(name)||padHeld(p1,name)||t1.held.has(name),pulse:new Set([...pulse,...t1.pulse]),
    fromStick:padStick(p1)??moved(t1.stick)??stick.snapshot(),aim:p,touchWalk,
    technique:()=>$('chosenTechnique').value},pendingOrder) as ArcadeInput;
  if(versusLive()){
    const pink=game.fighters.find(f=>f.control&&f.team===1);
    const second=arenaInputFrame({held:name=>p2keys.has(name)||padHeld(p2,name)||t2.held.has(name),pulse:new Set([...p2pulse,...t2.pulse]),
      fromStick:padStick(p2)??moved(t2.stick)??{x:0,y:0},aim:padAim(p2,pink),touchWalk:false,technique:()=>p2Technique??''},null);
    data.p2={...second,technique:second.technique||null,order:undefined};
  }
  pulse.clear();p2pulse.clear();for(const t of vsTouch.players)t.pulse.clear();pendingOrder=null;return data;
}
/** Once a frame: read controllers, and let Menu pause and View peek at the scoreboard like the keyboard does. */
function pollPads(){
  pads=padReader.read();
  syncVersusTouch();
  if(!pads.length&&!padStatsHeld)return;
  if(pads.length)document.documentElement.dataset.arenaPad='true';
  padLatch.update(pads);
  // A dialog over the match (Settings, Controls, stats, guide) owns the pad: Menu is consumed, pause and the scoreboard stay as they are.
  const dialogOpen=Boolean(settingsDialog?.open||savedStatsDialog?.open||$('keysDialog').open||$('statsDialog').open||$('rankDialog').open||$('guide').open);
  if(!dialogOpen&&view==='game'&&mode!=='watch'&&mode!=='command'&&game.phase==='playing'&&pads.some(p=>p.pausePressed))pause(!paused);
  const peek=!dialogOpen&&view==='game'&&!paused&&game.phase==='playing'&&pads.some(p=>p.stats);
  if(peek!==padStatsHeld){padStatsHeld=peek;scoreboard.hold(peek);}
}
function setScene(nextView:Scene,nextMode:ArenaMode='duel',nextRound=1,options:SceneOptions={}){
  if(nextView==='menu'){autoDuel.stop();roundSaveBaseline=undefined;autoCareerMode=undefined;}
  else autoDuel.clearRound();
  if(seat&&seat!==options.seat)seat.leave();
  seat=nextView==='game'?options.seat??null:null;
  document.body.dataset.seat=seat?seat.kind:'';document.body.dataset.seatLabel=seat?seat.label:'';
  career=null;roundRatings=options.arenaRatings??{};roundRated=false;ratingUnrecorded=false;ratingReport=[];crowdedLOD=false;pendingOrder=null;touchWalk=false;padSeats.reset();$('walkTouch').setAttribute('aria-pressed','false');
  combatAudio.stopEvents();
  view=nextView; mode=nextMode; round=nextRound; paused=false; endDelay=0;lastEvent=0;moveSeen={};watchedPhases={};maxHeight=0;echoes.clear();displayTime=0;sim.remainder=0;sim.previous=null;hudAt=-1;hitDelay=0;callouts.reset();barks.reset();
  clearInput();fx.reset();swingWaves.reset();
  const config=nextView==='menu'?setup:normalizeSetup(seat?{...matchSetup,mapId:seat.mapId,teamSizes:seat.teamSizes,heroPicks:[],participation:'play',playerSlot:0}:options.setup??matchSetup);
  if(nextView==='game')matchSetup=config;
  const {records}=options;
  const useHeroes=options.heroLineup?
    normalizeHeroLineup(options.heroLineup):battleHeroLineup(config.heroPicks,heroRoster,tournamentHeroLoadout);
  if(nextView==='game')matchHeroes=useHeroes;
  let {careers}=options;
  if(careers&&nextRound===1&&nextView==='game'){
    careers={...careers};
    for(const slot of Object.keys(useHeroes))delete (careers as Record<string,unknown>)[slot];
  }
  [W,H]=arenaWorldSize(config.mapId,config.mapSize as keyof typeof SIZE);
  const terrain=createArcadeTerrain(config.mapId,W,H,round);
  const isMenu=view==='menu';
  const lineups=engineLineups(config);
  const sideSizes=isMenu?[1,1]:config.teamSizes;
  const sideHeroes=isMenu?previewHeroes(useHeroes):useHeroes;
  const forcePools=isMenu?undefined:engineForcePools(config);
  const novicePractice=!isMenu&&mode==='duel'&&config.novicePractice&&canArenaNovicePractice(config,sideHeroes);
  const squadTactics=!isMenu&&config.squadTactics&&canArenaSquadTraining(config,sideHeroes);
  const laneDrill=!isMenu&&mode==='watch'&&config.laneDrill&&canArenaLaneDrill(config,sideHeroes);
  const opponentReads=!isMenu&&config.opponentReads&&canArenaAdaptiveSparring(config,sideHeroes);
  const useArenaElo=!isMenu&&!(localVersus&&mode==='duel')&&arenaLobbyRating(mode,config.rule,sideSizes,sideHeroes,forcePools,novicePractice,squadTactics,opponentReads).rated;
  const fighterRatings=useArenaElo?sideSizes.map((size,team)=>Array.from({length:size},(_,slot)=>
    arenaNormalRating(roundRatings[team+'-'+slot]))):undefined;
  const fighterChessStyles=engineChessStyleOverrides({...config,teamSizes:sideSizes},sideHeroes);
  const demoBlue=config.participation==='play'?config.playerSlot:0;
  if(seat){const g=seat.game as ArcadeGame;[W,H]=[g.width,g.height];}
  game=seat?seat.game as ArcadeGame:createArcade({...config,mode:isMenu?'watch':mode,seed:isMenu?451:seed,width:W,height:H,
    round,terrain,limit:config.duration,motionFlow:isMenu?PREVIEW_MOTION_FLOW:ARENA_MOTION_FLOW,smartAI:!isMenu,regionalInjuries:!isMenu,localVersus:!isMenu&&localVersus&&mode==='duel',perfectParryStamina:!isMenu,continuousCombat:!isMenu,anticipatingCombat:!isMenu,arenaCuts:!isMenu,activeFootwork:!isMenu,styleTravel:!isMenu,repertoireSupport:!isMenu,exchangeVariety:!isMenu,fluidFootwork:!isMenu,eloReads:!isMenu,impactPhysics:!isMenu,balancePass:!isMenu,closeChoice:!isMenu,guardCounterplay:!isMenu,minorMoves:!isMenu,forceVariants:!isMenu,weaponFlow:true,expandedCombat:!isMenu,circuitCuts:!isMenu,ratingSkill:!isMenu,crowdAI:!isMenu,arenaRatingSkill:useArenaElo,fighterRatings,customHeroTactics:!isMenu,advancedArena:!isMenu,teamForms:isMenu?[[lineups[0][demoBlue]],[lineups[1][0]]]:lineups,careers,records,
    teamSizes:sideSizes,forcePools,squadTactics,laneDrill,opponentReads,environment:config.environment,heroLineup:sideHeroes,fighterChessStyles:fighterChessStyles as ArcadeOptions["fighterChessStyles"]});
  if(novicePractice)game.config.novicePractice=true;
  const spreadDeployed=game.config.laneDrill===true;
  if(laneDrill)game.config.laneDrill=true; // even a placement fallback is a session-only drill
  roundRated=!isMenu&&!seat&&arenaNormalRanked(game);
  stage=createArcadeStage(W,H,round,{mapId:config.mapId,terrain:game.terrain,environment:config.environment});
  const shownMap=resolveArcadeMap(config.mapId,round);
  $('mapCaptionName').textContent=field(ARCADE_MAPS,shownMap)?.[0]??'Arena';
  // Map blurbs stay off screen; the caption is the map name only.
  $('mapCaptionDesc').textContent='';
  $('mapCaption').hidden=!isMenu;
  $('objectiveHUD').hidden=isMenu||!game.objective||game.objective.rule==='elimination';
  $('commandBar').hidden=isMenu||mode!=='command';
  prepareHeroWatch(isMenu||mode!=='watch',nextRound===1);
  for(const b of document.querySelectorAll<HTMLElement>('[data-order]'))b.setAttribute('aria-pressed',String(b.dataset.order===(game.order??'push')));
  $('forceAction').hidden=config.saberOnly;
  $('continueRun').hidden=!savedCareer;if(homeContinue)homeContinue.hidden=!savedCareer;
  $('autoDuelSaved').hidden=!savedCareer||!canAutoSaved(savedCareer);
  $('again').hidden=false;
  focus={x:W/2,y:H/2,zoom:1};
  canvas.tabIndex=isMenu?-1:0;
  $('cameraView').hidden=isMenu;
  portraitFocusId='';portraitWasActive=false;causewayFocus=false;causewayFocusWasActive=false;preferredArenaFocusId='';
  syncCamera();
  document.body.dataset.view=view;
  document.body.dataset.watch=String(view==='game'&&mode==='watch');
  document.body.dataset.command=String(view==='game'&&mode==='command');
  document.body.dataset.largeBattle=String(view==='game'&&game.fighters.length>=12);
  resize();
  $('entry').hidden=view!=='menu';$('hud').hidden=view!=='game';$('floorUI').hidden=view!=='game';$('pause').hidden=view!=='game';$('statsButton').hidden=view!=='game';
  for(const id of ['touchLayout','touchSide','resetAim'] as const)$(id).hidden=isMenu||mode==='watch'||mode==='command';
  syncFullscreen();
  $('pauseOverlay').hidden=true;$('result').hidden=true;$('pause').textContent='Pause';syncAutoDuel();scoreboard.close();
  for(const b of document.querySelectorAll<HTMLElement>('#help [data-home]'))b.hidden=view==='menu';
  for(const [where,plain] of [['#pauseOverlay','Leave'],['#result','Leave'],['#help','Setup']] as const)
    for(const b of document.querySelectorAll<HTMLElement>(where+' [data-home]')){b.textContent=!seat?plain:where==='#result'?'Back':'Leave';
      if(seat&&where==='#result')b.setAttribute('aria-label','Back to '+seat.label);else b.removeAttribute('aria-label');}
  syncHelp();
  setupTechnique(game.fighters.find(f=>f.control),config.saberOnly&&!isMenu);
  $('modeLabel').textContent=matchLabel();
  const primary=game.fighters.find(f=>f.control)||game.fighters.find(f=>f.team===0), rival=game.fighters.find(f=>f.team===1);
  const deployedHeroes=view==='game'?game.fighters.filter(f=>f.heroId).map(f=>`${f.team?'Pink':'Blue'} Hero: ${f.displayName}`):[];
  canvas.setAttribute('aria-label',['Loomen Arena',...deployedHeroes].join(', '));
  setPills($('profileText'),[isMenu?'':roundRated?'Rated':game.config.novicePractice?'Practice 0.75×':laneDrill?(spreadDeployed?'Spread Deploy':'Standard Starts'):'Unrated',mode==='watch'?'AI vs AI':arcadeSaberOption(primary!.gear).label]);
  $('forceHint').textContent=ARCADE_FORCE_FAMILIES.find(x=>x.id===config.startingForceFamily?.[0])?.label??'Force';
  $('airControlHint').textContent=FORM_AIR_NAMES[primary!.form]??'Form Footwork';
  $('signatureHint').textContent=lore[primary!.form]?.signature||'Heavy Attack';
  $('blueName').textContent='Blue';
  $('rivalName').textContent='Pink';
  // Player 2 has no technique menu: their button uses their form's strongest technique, as Player 1's starts on.
  const pink=view==='game'&&game.config.localVersus?game.fighters.find(f=>f.control&&f.team===1):undefined;
  p2Technique=pink?arcadeMovesFor(pink.form,pink.career.gradeIndex).filter(m=>!config.saberOnly||m.mapAction!=='force').at(-1)?.id??null:null;
  if(view==='game'&&game.config.localVersus){$('modeLabel').textContent='Two Players';}
  if(seat){setPills($('profileText'),[seat.label,arcadeSaberOption(primary!.gear).label]);}
  updateHUD();
  if(view==='game'){window.scrollTo({top:0});canvas.focus({preventScroll:true});announce(mode==='watch'?'Showdown started':titleCase(mode)+' round '+round);}
}

const FORM_AIR_NAMES={
  shii_cho:'Wheel Hop',
  makashi:'Line Vault',
  soresu:'Guard Tuck',
  ataru:'Corkscrew / Crossflip',
  djem_so:'Hammer Bound',
  niman:'Drift Turn',
  juyo:'Scissor Pounce',
};
function syncHelp(){
  setPills($('helpText'),mode==='watch'?['Stats: Inspect']:mode==='command'?['Pick an Order']:mobileUI.matches?['Jump + Slash: Air Strike']:arenaKeyboardHint());
}
mobileUI.addEventListener('change',syncHelp);

const tacticalHint={slip_counter:'Slip Counter',feint_redirect:'Feint Redirect',moving_guard:'Moving Guard'};
const footworkHelp={check:'Retreat',side:'Side Step',slip:'Slip',arc:'Arc',switch:'Lane Switch',wheel:'Wheel',return:'Draw Back'};
const footworkByTechnique=Object.fromEntries(ARCADE_RANK_FOOTWORK.map(m=>['footwork:'+m.id,m]));
const heroTechnique={id:ARCADE_TRAKATA_ID,name:"Tràkata"};
const techniqueHint={counter:'Counter',crowd:'Crowd',force:'Force',acrobatics:'Aerial',defense:'Defense'};
function setupTechnique(f:ArcadeFighter|undefined,saberOnly:boolean){
  document.getElementById('techFold')?.removeAttribute('open');
  const select=$('chosenTechnique'), previous=select.value;
  const list:TechniqueRow[]=f&&view==='game'?arcadeMovesFor(f.form,f.career.gradeIndex,{tactical:true,rankCuts:true,circuitCuts:f.circuitCuts===true,arenaCuts:game.config.arenaCuts===true,exchangeVariety:game.config.exchangeVariety===true,minorMoves:game.config.minorMoves===true}).filter(m=>!saberOnly||m.mapAction!=='force'):[];
  const steps=f&&view==='game'?arcadeRankFootworkFor(f.career.gradeIndex).map(m=>({name:m.label,id:'footwork:'+m.id})):[];
  const expanded=f&&view==='game'&&f.expandedCombat?arcadeExpandedMovesFor(f.career.gradeIndex,{saberOnly,weapon:f.gear.weapon,forceVariants:game.config.forceVariants===true}):[];
  list.push(...steps,...expanded);
  if(f?.heroId&&view==='game')list.push(heroTechnique);
  $('techniqueBar').hidden=!list.length;
  $('quickTechnique').hidden=!list.length;
  if(!list.length)return;
  const original=new Set(arcadeMovesFor(f!.form,f!.career.gradeIndex).map(m=>m.id));
  const core=list.filter(m=>original.has(m.id)), tactical=list.filter(m=>m.tactical), cuts=list.filter(m=>m.opening&&!m.circuitCut&&!m.arenaCut&&!m.minorMove),circuit=list.filter(m=>m.circuitCut),newCuts=list.filter(m=>m.arenaCut&&!m.tactical),minorCuts=list.filter(m=>m.minorMove&&!m.tactical);
  const groups=([['Form',core],['Tactical',tactical],['Ranked Cuts',cuts],['Circuit Cuts',circuit],['Arena Cuts',newCuts],['Form Moves',minorCuts],['Footwork',steps],['Force',expanded.filter(m=>m.kind==='force')],['Free Hand',expanded.filter(m=>m.kind==='free_hand')],['Hero',list.filter(m=>m.id===ARCADE_TRAKATA_ID)]] satisfies [string,readonly TechniqueRow[]][]).filter(([,items])=>items.length).map(([label,items])=>{
    const group=document.createElement('optgroup');group.label=label;
    group.append(...items.map(m=>new Option(m.name,m.id)));return group;
  });
  select.replaceChildren(...groups);
  select.value=list.some(m=>m.id===previous)?previous:(core.at(-1)??list[0]).id;
  setTechniqueHint();
}
function setTechniqueHint(){
  const pick=$('chosenTechnique').selectedOptions[0],foldName=document.getElementById('techFoldName');
  if(foldName)foldName.textContent=pick?.text??'Technique';
  if($('chosenTechnique').value===ARCADE_TRAKATA_ID){
    $('quickTechnique').title=heroTechnique.name;
    setPills($('techniqueHelp'),['Relight Strike','No Guard']);
    return;
  }
  const selected=$('chosenTechnique').value, step=footworkByTechnique[selected];
  if(step){
    $('quickTechnique').title=step.label;
    setPills($('techniqueHelp'),[field(footworkHelp,step.path)??'Footwork',step.cost+' STA']);
    return;
  }
  const expanded=arcadeExpandedMoveById(selected,{forceVariants:game.config.forceVariants===true});
  if(expanded){$('quickTechnique').title=expanded.label;setPills($('techniqueHelp'),[expanded.kind==='force'?'Force':'Free Hand',expanded.cost+' STA']);return;}
  const m=ARCADE_TECHNIQUES[selected];
  $('quickTechnique').title=m?.name??'Technique';
  // Tags and cost only; the long move hints stay out of the fight screen.
  const tag=field(MINOR_MOVE_HINTS,selected)?'Form Move':field(CIRCUIT_CUT_HINTS,selected)?'Circuit Cut':m?.air?'Aerial':field(tacticalHint,m?.tactical)??field(techniqueHint,m?.role)??'';
  setPills($('techniqueHelp'),[tag,m?.cost?m.cost+' STA':'']);
}
$('chosenTechnique').addEventListener('change',()=>{setTechniqueHint();document.getElementById('techFold')?.removeAttribute('open');canvas.focus({preventScroll:true});});

function syncAutoDuel(){
  const enabled=view==='game'&&autoDuel.active;
  $('stopAutoDuel').hidden=!enabled||!$('result').hidden;
  $('stopAutoDuelResult').hidden=!enabled;
  const countdown=$('autoDuelCountdown'), seconds=autoDuel.seconds;
  countdown.hidden=!enabled||seconds===null;
  const text=seconds===null?'':'Next round in '+seconds+'s';
  if(countdown.textContent!==text)countdown.textContent=text;
}
function stopAutoDuel(){
  autoDuel.stop();syncAutoDuel();
  $('modeLabel').textContent='Showdown';
  if($('result').hidden)canvas.focus({preventScroll:true});else $('again').focus({preventScroll:true});
  announce('Auto battle stopped');
}
for(const id of ['stopAutoDuel','stopAutoDuelResult'] as const)$(id).addEventListener('click',stopAutoDuel);
function launch(automatic=false){
  roundSaveBaseline=rawArenaSave();
  if(automatic){autoDuel.start();autoCareerMode=setupMode(setup);}
  else {autoDuel.stop();autoCareerMode=undefined;}
  const preset=setup.seed??Number(new URLSearchParams(location.search).get('seed'));
  seed=preset>0?preset>>>0:Math.floor(1+Math.random()*4294967295);
  seedCounter=0;
  setScene('game',automatic?'watch':setupMode(setup),1,{careers:imported,setup});
}
$('lobby').addEventListener('submit',e=>{e.preventDefault();readLobby();launch();});
$('autoDuelStart').addEventListener('click',()=>{
  if(!$('lobby').reportValidity())return;
  readLobby();
  if(!$('autoDuelStart').disabled)launch(true);
});
function goHome(){
  if(seat){const left=seat;left.leave();seat=null;location.assign(left.back);return;}
  setScene('menu');$('startMatch').focus({preventScroll:true});window.scrollTo({top:0});}
for(const b of document.querySelectorAll<HTMLElement>('[data-home]'))b.addEventListener('click',goHome);
function nextCareerRound(){
  if(!career||$('again').hidden)return;
  seed=career.seed;setScene('game',mode,career.round,{careers:career.careers,records:career.records,setup:career.setup,heroLineup:career.heroLineup,arenaRatings:career.arenaRatings});
}
$('again').addEventListener('click',()=>{if(seat)void nextSeat(seat.kind);else nextCareerRound();});
async function nextSeat(kind:ArenaSeat['kind']){
  $('again').disabled=true;
  const opened=await openArenaSeat(kind).catch(()=>({ok:false as const,text:'Could not open the next bout. Your save was unchanged.',back:seat?.back??'./index.html'}));
  $('again').disabled=false;
  if(opened.ok){seed=0;setScene('game',opened.seat.mode,1,{seat:opened.seat});return;}
  $('rankResult').textContent=opened.text;$('again').hidden=true;
}
for(const button of document.querySelectorAll<HTMLElement>('[data-order]')){
  button.addEventListener('click',()=>{
    if(mode!=='command'||game.phase!=='playing')return;
    pendingOrder=button.dataset.order as ArcadeInput["order"];
    for(const b of document.querySelectorAll<HTMLElement>('[data-order]'))b.setAttribute('aria-pressed',String(b===button));
    canvas.focus({preventScroll:true});
  });
}
function pause(value:boolean,{focus=true}={}){
  if(view!=='game'||game.phase!=='playing')return;
  paused=value;clearInput();scoreboard.close();
  // Anything a pad holds through Resume stays neutral until it is released or recentred.
  if(!paused)padLatch.hold(pads);sim.remainder=0;sim.previous=null;$('pauseOverlay').hidden=!paused;
  $('pause').textContent=paused?'Resume':'Pause';
  if(focus){if(paused)$('resume').focus({preventScroll:true});else canvas.focus({preventScroll:true});}
}
$('pause').addEventListener('click',()=>pause(!paused));$('resume').addEventListener('click',()=>pause(false));
function arenaKeyboardHint(){return [keyLabel(arenaBindings.jump)+' Jump',keyLabel(arenaBindings.strike)+' Air Strike',keyLabel(arenaBindings.guard)+' Parry'];}
function syncKeyLabels(bindings=arenaBindings){
  for(const [action,key] of Object.entries(bindings))document.querySelectorAll<HTMLElement>(`[data-action="${action}"] kbd,[data-key-action="${action}"] kbd`).forEach(k=>{k.textContent=keyLabel(key);});
}
const keysPanel=mountKeysPanel((map,bindings)=>{keyMap=map;arenaBindings=bindings;clearInput(false);syncKeyLabels(bindings);if(view==='game'&&mode!=='watch'&&mode!=='command'&&!mobileUI.matches)setPills($('helpText'),arenaKeyboardHint());});
syncKeyLabels(keysPanel.bindings());
$('keysOpen').addEventListener('click',()=>{if(paused){clearInput(false);keysPanel.open();}});
$('keysDialog').addEventListener('close',()=>{clearInput(false);if(paused&&!settingsDialog?.open)$('keysOpen').focus({preventScroll:true});});
// Settings: one dialog for the device settings that already exist. Same storage, same handlers.
const settingsDialog=document.getElementById('settingsDialog') as HTMLDialogElement|null;
let settingsReturn:HTMLElement|null=null, keysFromSettings=false;
const settingsSession=createSettingsSession<typeof game>();
function syncSettings(){
  if(!settingsDialog)return;
  const pick=(attr:string,value:string)=>settingsDialog.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute(attr)===value)));
  pick('data-touch-layout',touchPrefs.layout);pick('data-touch-side',touchPrefs.side);pick('data-hud-text',hudText.value);
}
function openSettings(from:HTMLElement|null){
  if(!settingsDialog||settingsDialog.open)return;
  if(settingsSession.begin(view==='game'&&game?.phase==='playing'?game:null,paused))pause(true,{focus:false});
  settingsReturn=from;clearInput(false);syncSettings();settingsDialog.showModal();
}
if(settingsDialog){
  const tabs=[...settingsDialog.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const select=(tab:HTMLButtonElement,focus=false)=>{
    for(const t of tabs){const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('aria-controls')!)!.hidden=!on;}
    if(focus)tab.focus();
  };
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',e=>{
      const step=['ArrowDown','ArrowRight'].includes(e.key)?1:['ArrowUp','ArrowLeft'].includes(e.key)?-1:0;
      const to=e.key==='Home'?0:e.key==='End'?tabs.length-1:step?(i+step+tabs.length)%tabs.length:-1;
      if(to<0)return;e.preventDefault();select(tabs[to]!,true);
    });
  });
  settingsDialog.addEventListener('click',e=>{
    if(e.target===settingsDialog){settingsDialog.close();return;}
    const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
    const layout=b.dataset.touchLayout,side=b.dataset.touchSide,size=b.dataset.hudText;
    if(layout==='stick'||layout==='arrows')onTouchPref('layout',layout);
    else if(side==='left'||side==='right')onTouchPref('side',side);
    else if(size==='100'||size==='125'||size==='150'){hudText.value=size;hudText.dispatchEvent(new Event('change'));}
    else if(b.id==='settingsKeys'&&!keysFromSettings){
      keysFromSettings=true;keysPanel.open();
      if(!$('keysDialog').open)keysFromSettings=false;
      return;
    }
    syncSettings();
  });
  settingsDialog.addEventListener('close',()=>{
    clearInput(false);
    const resume=settingsSession.close(view==='game'&&game?.phase==='playing'?game:null,paused,document.hidden);
    const origin=settingsReturn;settingsReturn=null;
    if(resume)pause(false);else origin?.focus({preventScroll:true});
  });
  $('keysDialog').addEventListener('close',()=>{
    if(!keysFromSettings)return;
    keysFromSettings=false;
    if(settingsDialog.open){syncSettings();document.getElementById('settingsKeys')?.focus({preventScroll:true});}
  });
  document.getElementById('settingsOpen')?.addEventListener('click',e=>openSettings(e.currentTarget as HTMLElement));
  document.getElementById('pauseSettings')?.addEventListener('click',e=>openSettings(e.currentTarget as HTMLElement));
  document.getElementById('resultSettings')?.addEventListener('click',e=>openSettings(e.currentTarget as HTMLElement));
}
const savedStatsDialog=mountStatsPage([...document.querySelectorAll<HTMLElement>('[data-open-stats]')]);
window.addEventListener('keydown',e=>{
  if(e.isTrusted&&!e.isComposing&&e.key&&e.key!=='Unidentified'&&e.key!=='Process')document.documentElement.dataset.arenaKeyboard='true';
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||view!=='game'||document.querySelector('dialog[open]:not(#scoreboard), #scoreboard[data-opened=toggle]')||isEditableTarget(e.target)||['BUTTON','SELECT','INPUT','A'].includes((e.target as HTMLElement).tagName)&&!paused)return;
  const key=e.key.toLowerCase();
  if(key==='escape'||key==='p'){if(!e.repeat){e.preventDefault();pause(!paused);}return;}
  const action=Object.hasOwn(keyMap,key)?keyMap[key]:null;
  // Scoreboard is a peek, not a move: it works for spectators and commanders too, and never enters the input set.
  if(action==='stats'){if(!paused&&game.phase==='playing'){e.preventDefault();if(!e.repeat){scoreboardKey=e.code||key;scoreboard.hold(true);}}return;}
  // Local versus: the second keyboard player gets the arrows and the keys around them, unless player one bound them.
  const second=versusLive()&&Object.hasOwn(P2_KEYS,key)&&!Object.values(arenaBindings).includes(key)?P2_KEYS[key]!:null;
  if(second&&!paused&&game.phase==='playing'){
    e.preventDefault();if(e.repeat)return;heldP2Keys.press(e,second);
    if(['strike','heavy','dash','guard','force','technique','phase','feint','jump'].includes(second))p2pulse.add(second);
    return;
  }
  if(!action||paused||mode==='watch'||mode==='command'||game.phase!=='playing')return;
  e.preventDefault();if(e.repeat)return;heldArenaKeys.press(e,action);if(['strike','heavy','dash','guard','force','technique','phase','feint','jump'].includes(action))pulse.add(action);
});
window.addEventListener('keyup',e=>{heldArenaKeys.release(e);heldP2Keys.release(e);if(scoreboardKey&&(e.code||e.key.toLowerCase())===scoreboardKey){scoreboardKey=null;scoreboard.hold(false);}});
document.addEventListener('focusin',e=>{if(isEditableTarget(e.target)||document.querySelector('dialog[open]:not(#scoreboard), #scoreboard[data-opened=toggle]'))clearInput(false);});
window.addEventListener('blur',()=>clearInput(false));
window.addEventListener('orientationchange',()=>clearInput(false));
document.addEventListener('visibilitychange',()=>{
  resetDisplayClock(clock);sim.remainder=0;sim.previous=null;clearInput(false);$('frameRate').textContent='FPS';
  if(document.hidden){scoreboard.close();settingsSession.background();}
  if(document.hidden&&view==='game'&&mode!=='watch'&&game?.phase==='playing'&&!paused)pause(true,{focus:false});
});
function onTouchPref<K extends keyof typeof touchPrefs>(key:K,next:(typeof touchPrefs)[K]){
  touchPrefs[key]=next;clearInput(false);syncTouchPrefs();
  try{localStorage.setItem(touchPrefsKey,JSON.stringify(touchPrefs));}catch{}
}
syncTouchPrefs();
$('touchLayout').addEventListener('click',()=>onTouchPref('layout',touchPrefs.layout==='stick'?'arrows':'stick'));
$('touchSide').addEventListener('click',()=>onTouchPref('side',touchPrefs.side==='right'?'left':'right'));
$('resetAim').addEventListener('click',()=>{aim=null;touchAim=null;syncTouchAim();});
function syncFullscreen(){
  const button=$('gameFullscreen'), fullscreen=Boolean(document.fullscreenElement);
  document.body.dataset.fullscreen=String(fullscreen);
  button.hidden=view!=='game'||!document.fullscreenEnabled||typeof $('app').requestFullscreen!=='function';
  $('mobileTools').hidden=view!=='game'||button.hidden&&(mode==='watch'||mode==='command');
  button.textContent=fullscreen?'Exit Full Screen':'Full Screen';
  button.setAttribute('aria-pressed',String(fullscreen));
}
document.addEventListener('fullscreenchange',()=>{clearInput(false);syncFullscreen();});
$('gameFullscreen').addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await $('app').requestFullscreen();
  }catch{
    const button=$('gameFullscreen');
    button.textContent='Unavailable';announce('Full screen unavailable');
  }
});
stickButton.addEventListener('pointerdown',e=>{
  if(e.button!==0||paused||view!=='game'||mode==='watch'||mode==='command'||game.phase!=='playing')return;
  const b=stickButton.getBoundingClientRect();
  if(!stick.begin(e.pointerId,b.left+b.width*.5,b.top+b.height*.5,Math.min(b.width,b.height)*.31))return;
  e.preventDefault();stickButton.setPointerCapture(e.pointerId);
  stick.move(e.pointerId,e.clientX,e.clientY);paintStick();
});
stickButton.addEventListener('pointermove',e=>{if(stick.move(e.pointerId,e.clientX,e.clientY))paintStick();});
for(const type of ['pointerup','pointercancel','lostpointercapture'] as const){
  stickButton.addEventListener(type,e=>{if(stick.end(e.pointerId))paintStick();});
}
stickButton.addEventListener('click',e=>{if(e.detail===0){onTouchPref('layout','arrows');$('touchLayout').focus();}});
$('walkTouch').addEventListener('click',()=>{touchWalk=!touchWalk;$('walkTouch').setAttribute('aria-pressed',String(touchWalk));canvas.focus({preventScroll:true});});
for(const button of document.querySelectorAll<HTMLElement>('[data-move],[data-action]')){
  const a=(button.dataset.move||button.dataset.action)!;
  function release(e:PointerEvent){pointers.delete(e.pointerId);button.dataset.held=String([...pointers.values()].includes(a));}
  button.addEventListener('pointerdown',e=>{
    if(e.button!==0||paused||mode==='watch'||mode==='command'||game.phase!=='playing')return;
    e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,a);button.dataset.held='true';
    if(button.dataset.action)pulse.add(a);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)button.addEventListener(name,release);
  button.addEventListener('click', e=>{if(e.detail===0 && button.dataset.action && !paused && game.phase==='playing'){pulse.add(a);canvas.focus({preventScroll:true});}});
}
function updateAim(e:AimEvent){
  const b=canvas.getBoundingClientRect();
  if(!b.width||!b.height)return;
  if(touchAim){touchAim=null;syncTouchAim();}
  aim={x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};
}
canvas.addEventListener('pointermove',e=>{
  if(view!=='game'||(mode==='watch'||mode==='command')||paused||e.pointerType==='touch')return;
  updateAim(e);
});
canvas.addEventListener('pointerleave',()=>{aim=null;});
function setTouchAim(e:AimEvent){
  const b=canvas.getBoundingClientRect();
  if(!b.width||!b.height)return;
  const p=screenToArena(e.clientX,e.clientY,b,canvas.width,canvas.height,transform);
  const controlled=game.fighters.find(f=>f.control&&f.alive);
  if(!controlled)return;
  aim=null;touchAim=arcadeTapAim({point:p,fighters:game.fighters,team:controlled.team,current:touchAim,time:game.time,width:W,height:H});
  syncTouchAim();
}
canvas.addEventListener('pointerdown',e=>{
  if(view!=='game'||(mode==='watch'||mode==='command')||paused||game.phase!=='playing')return;
  if(e.pointerType==='touch')return;
  else if(e.button===0){updateAim(e);pulse.add('strike');}
  canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'&&view==='game'&&!paused&&mode!=='watch'&&mode!=='command'&&game.phase==='playing')
    touchDown={id:e.pointerId,x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointercancel',e=>{if(touchDown?.id===e.pointerId)touchDown=null;});
canvas.addEventListener('pointerup',e=>{
  if(touchDown?.id!==e.pointerId)return;
  const {x,y}=touchDown;touchDown=null;
  if(view==='game'&&!paused&&game.phase==='playing'&&Math.hypot(e.clientX-x,e.clientY-y)<17)setTouchAim(e);
});
function showEnd(){
  if(!$('result').hidden)return;
  if(seat){showSeatEnd(seat);return;}
  (document.getElementById('resultElo') as HTMLElement).hidden=false;
  const versus=game.config.localVersus===true;
  const text=game.phase==='draw'?'Draw':mode==='watch'||versus?(game.phase==='won'?'Blue Wins':'Pink Wins'):game.phase==='won'?'Victory':'Defeat';
  $('resultTitle').textContent=text;
  const winningPlayer=game.phase==='won'&&mode!=='watch'&&!versus?game.fighters.find(f=>f.team===0&&f.control&&f.alive):undefined;
  $('result').dataset.winnerBody=winningPlayer?.body??'';
  $('result').dataset.winnerForm=winningPlayer?.form??'';$('result').dataset.winnerKit=winningPlayer?`${winningPlayer.gear?.weapon??''}/${winningPlayer.gear?.grip??''}`:'';
  const obj=game.objective;
  const timedOut=game.endReason==='timeout'||game.time+1e-8>=game.limit;
  const decidedByObjective=game.endReason==='control'||game.endReason==='relic'||(timedOut&&obj?.target&&Math.abs(obj.score[0]-obj.score[1])>=.001);
  const survivors=[0,1].map(team=>game.fighters.filter(f=>f.team===team&&f.alive).length);
  $('resultText').textContent=game.phase==='draw'?(timedOut?'Time Up · Even':'Even')
    :decidedByObjective?(timedOut?'Time Up · ':'')+(obj.rule==='control'?'Signal Points':'Relic Deliveries')
    :timedOut?'Time Up · '+(survivors[0]!==survivors[1]?'Survivors':'Injuries')
    :'Knockout';
  const lastPunish=game.events.findLast(e=>e.punish&&(e.damage as number)>0);
  const relevant=lastPunish&&game.phase!=='draw'&&lastPunish.team===(game.phase==='won'?0:1)&&game.time-lastPunish.time<=3;
  $('turningPoint').hidden=!relevant;
  if(relevant){
    const reason=field(punishLabels,lastPunish.punishReason);
    $('turningPoint').textContent=(lastPunish.team?'Pink':'Blue')+' Punish · '+(reason??(lastPunish.region?regionName(lastPunish.region):'Opening'));
  }
  const settled=settleArcadeCareer(game,roundRatings)!, selected=settled.report.find(r=>r.id===game.fighters.find(f=>f.control)?.id)??settled.report[0];
  career={arenaRatings:settled.arenaRatings,mode:autoCareerMode??mode,round:round+1,seed:(seed+Math.imul(++seedCounter,2654435761))>>>0,careers:settled.careers,records:game.records,form:matchSetup.form,body:matchSetup.body,setup:matchSetup,heroLineup:matchHeroes};
  const tracked=settled.rated||autoDuel.active;
  const expected=tracked&&roundSaveBaseline!==undefined?{bytes:roundSaveBaseline}:undefined;
  const saveResult=tracked&&!expected?'unavailable':commitArenaRound(career,game.config,settled.rated,undefined,expected);
  const conflict=saveResult==='conflict';
  const sessionOnly=saveResult==='session-only', persisted=saveResult==='saved';
  ratingUnrecorded=settled.rated&&!persisted;
  ratingReport=persisted?settled.report:[];
  if(persisted){
    savedCareer=career;
    roundSaveBaseline=arenaCareerBytes(career);
  }else if(conflict||sessionOnly)savedCareer=readCareerForUI();
  const promoted=settled.report.filter(f=>f.promoted);
  const promotions=promoted.length>1?' '+promoted.length+' Promotions':selected.promoted?' Promoted':'';
  // A save problem is a badge on the card, never a sentence (an unsaved rated round shows it in the Elo block). Conflict also hides Next Round below.
  const saveBadge=versus?'Not Saved':conflict?'Save Conflict':ratingUnrecorded?'':sessionOnly||!persisted?'Not Saved':'';
  const progress=(mode==='watch'?'Blue 1 ':'')+gradeDisplayLabel(selected.after.grade)+' +'+selected.reward+' XP'+promotions;
  $('rankResult').textContent=progress;$('rankResult').dataset.saveBadge=saveBadge;
  const me=game.fighters.find(f=>f.control), lineKeys=['kills','deaths','damage','parries','saberHits','saberSwings'] as const;
  renderRoundResult($('result'),buildRoundResult({
    mode,teamSizes:game.config.teamSizes??[],round,seconds:game.time,rated:settled.rated,save:tracked?saveResult:'untracked',
    who:versus?'Blue':me?null:'Blue Total',
    line:me?me.stats:Object.fromEntries(lineKeys.map(k=>[k,game.stats?.[k]?.[0]])) as Record<typeof lineKeys[number],number>,
    elo:persisted&&settled.rated?{who:me?null:'Blue 1',rank:gradeDisplayLabel(selected.after.grade),ratingBefore:selected.ratingBefore,ratingAfter:selected.ratingAfter,delta:selected.ratingDelta,
      floor:eloFloor(selected.after.grade),cap:selected.ratingCap}:null,
  }));
  // Player's own K/D and wins, kept apart from the career save.
  if(me&&(mode==='duel'||mode==='squad')&&!autoDuel.active)recordArenaRound(me.stats??{},game.phase);
  $('again').textContent='Next Round';
  updateHUD();
  scoreboard.close();$('result').hidden=false;$('pause').hidden=true;$('again').hidden=conflict;clearInput();
  $(conflict?'resultStats':'again').focus({preventScroll:true});
  autoDuel.completeRound(persisted&&career.round<=100000);syncAutoDuel();
  announce(autoDuel.active?text+'. Next round in 3 seconds.':text);
}
function showSeatEnd(owner:ArenaSeat){
  const head=game.phase==='draw'?'Draw':game.phase==='won'?'Blue Wins':'Pink Wins';
  const timedOut=game.endReason==='timeout'||game.time+1e-8>=game.limit;
  $('resultTitle').textContent=head;
  const seatWinner=game.phase==='won'?game.fighters.find(f=>f.control):undefined;
  $('result').dataset.winnerBody=seatWinner?.body??'';$('result').dataset.winnerForm=seatWinner?.form??'';$('result').dataset.winnerKit=seatWinner?`${seatWinner.gear?.weapon??''}/${seatWinner.gear?.grip??''}`:'';
  $('turningPoint').hidden=true;
  const me=game.fighters.find(f=>f.control);
  renderRoundResult($('result'),buildRoundResult({mode,teamSizes:game.config.teamSizes??[],round,seconds:game.time,rated:false,save:'untracked',who:null,
    line:(me?.stats??{}) as Parameters<typeof buildRoundResult>[0]['line'],elo:null}));
  $('resultTitle').textContent=head;
  // Gauntlet Elo is settled by the Gauntlet itself, so the Arena's Elo block and rated badge do not apply here.
  (document.getElementById('resultElo') as HTMLElement).hidden=true;(document.getElementById('resultBadge') as HTMLElement).textContent=owner.label.toUpperCase();
  const clockText=Math.floor(game.time/60)+':'+String(Math.floor(game.time%60)).padStart(2,'0');
  renderResultMeta($('resultRound'),[owner.teamSizes.join('v'),clockText]);
  $('resultText').textContent=(timedOut?'Time Up · ':'')+(game.phase==='draw'?'Even':'Knockout');
  $('rankResult').textContent='Saving…';delete $('rankResult').dataset.saveBadge;
  $('again').textContent='Next Bout';$('again').hidden=true;
  updateHUD();
  scoreboard.close();$('result').hidden=false;$('pause').hidden=true;clearInput();
  $('resultStats').focus({preventScroll:true});
  announce(head);
  void owner.finish().then(end=>{
    if(seat!==owner)return;
    $('rankResult').textContent=end.text;$('rankResult').hidden=false;
    $('result').dataset.seatSaved=String(end.saved);
    $('again').hidden=!end.next;
    if(end.next)$('again').focus({preventScroll:true});
  });
}
const regionName=(id:string)=>ARCADE_BODY_REGIONS.find(x=>x.id===id)?.label??'Body';
const shortRegion={head:'Head',torso:'Torso',leftArm:'L Arm',rightArm:'R Arm',leftLeg:'L Leg',rightLeg:'R Leg'};
const compactRegion={head:'H',torso:'T',leftArm:'LA',rightArm:'RA',leftLeg:'LL',rightLeg:'RL'};
const severityLevel=(label:unknown)=>{
  const text=String(label??'').toLowerCase();
  return /fatal/.test(text)?'fatal':/severe|critical|disabled|incapacitat|impaired/.test(text)?'severe':/hurt|injur|wound|light|moderate|strained/.test(text)?'hurt':'clear';
};
function renderRibbon(id:"blueInjuries"|"redInjuries",f:ArcadeFighter){
  const parent=$(id);
  const rows=arcadeRegionalCondition(f.injuries);
  const key=f.id+'|'+f.fatalRegion+'|'+rows.map(part=>part.pct).join('/');
  if(parent.dataset.key===key)return;
  parent.dataset.key=key;
  parent.dataset.fighter=f.id;
  const name=(f.team?'Pink ':'Blue ')+(f.slot+1);
  parent.setAttribute('aria-label',name+' Injuries');
  parent.title=rows.filter(part=>part.pct>0).map(part=>part.label+' '+part.pct+'%').join(', ')||name+': No Injuries';
  parent.replaceChildren(...rows.map(part=>{
    const label=f.fatalRegion===part.id?'Fatal':part.labelCondition;
    const el=reportCell('span',shortRegion[part.id]??part.label);
    el.dataset.level=severityLevel(label);el.dataset.compact=compactRegion[part.id]??'·';
    el.title=part.label+' '+part.pct+'%: '+label;
    el.setAttribute('aria-hidden','true');return el;
  }));
}
for(const id of ['blueInjuries','redInjuries'] as const)$(id).addEventListener('click',()=>{
  const fighter=$(id).dataset.fighter;
  if(view!=='game'||!fighter||$('statsDialog').open)return;
  openStats();
  $('moveFighter').value=fighter;showMoveStats();
  $('moveFighter').focus({preventScroll:true});
});
const habitName=(f:ArcadeFighter|undefined)=>field({opening_reader:'Looks for openings',lane_builder:'Sets up angles',tempo_keeper:'Keeps up the tempo'},f?.combatHabit)??'';
const watchChoice=$('heroWatchChoice');
const activeWatchHero=()=>game?.fighters.find(f=>f.id===watchChoice.value&&f.heroId&&!f.control);
function prepareHeroWatch(hide:boolean,resetFocus:boolean){
  heroWatchEvents={};heroWatchKey='';
  if(resetFocus||hide)heroWatchFocus=false;
  const roster=hide?[]:game.fighters.filter(f=>f.heroId&&!f.control);
  $('heroWatch').hidden=!roster.length;
  watchChoice.replaceChildren(...roster.map(f=>new Option(f.displayName,f.id)));
  const chosen=roster.find(f=>f.heroId===watchedHeroIdentity)??roster[0];
  if(chosen){watchChoice.value=chosen.id;watchedHeroIdentity=chosen.heroId!;}
  updateHeroWatch();
}
function updateHeroWatch(){
  if($('heroWatch').hidden)return;
  const hero=activeWatchHero();
  if(!hero)return;
  const events=heroWatchEvents[hero.id];
  const style=chessReadout(hero),habit=habitName(hero);
  const stamp=JSON.stringify([hero.id,style,habit,hero.heroPlan,hero.alive,events?.last,events?.time,hero.moves?.trakata,events?.relights,reduced,heroWatchFocus]);
  if(stamp===heroWatchKey)return;
  heroWatchKey=stamp;
  setPills($('heroWatchPlan'),hero.alive?['AI',titleCase(hero.heroPlan??hero.heroDoctrine??'balanced'),style,habit]:['Knocked Out']);
  $('heroWatchMove').textContent=events?.last??'No Moves Yet';
  setPills($('heroWatchTrakata'),['Tràkata '+(hero.moves?.trakata??0),'Relights '+(events?.relights??0)]);
  const toggle=$('heroWatchFocus');
  const follow=hero.alive&&heroWatchFocus&&!reduced;
  toggle.disabled=!hero.alive||reduced;
  toggle.textContent=follow?'Unfollow':'Follow Hero';
  toggle.setAttribute('aria-pressed',String(follow));
  toggle.title=reduced?'Reduced Motion':'';
}
watchChoice.addEventListener('change',()=>{watchedHeroIdentity=activeWatchHero()?.heroId??'';updateHeroWatch();});
$('heroWatchFocus').addEventListener('click',()=>{heroWatchFocus=!heroWatchFocus;updateHeroWatch();});
$('heroWatchStats').addEventListener('click',()=>{
  const hero=activeWatchHero();if(!hero)return;
  openStats();$('moveFighter').value=hero.id;showMoveStats();
});
function arenaRatingDetail(id:string, gradeIndex:number, compact=false){
  if(!roundRated)return 'Unrated';
  if(ratingUnrecorded)return 'Not Saved';
  const result=ratingReport.find(r=>r.id===id);
  const rating=result?.ratingAfter??arenaNormalRating(roundRatings[id]);
  const cap=result?.ratingCap===null?null:result?.ratingCap??arenaNormalCap(gradeIndex);
  const head=ratingText(rating)+' Elo';
  if(compact)return head;
  const delta=result?.ratingDelta;
  return head+(typeof delta==='number'?' ('+(delta>0?'+':'')+delta+')':'')+
    (cap===null?'':rating>=cap?', Cap '+ratingText(cap)+' Reached':', Cap '+ratingText(cap));
}
/** One bar per fighter on each side (up to 8): full when unhurt, shrinking with the worst injured region, empty when out. */
function renderTeamHealth(side:'blue'|'red',roster:ArcadeFighter[]){
  const panel=document.querySelector<HTMLElement>(`.hud .health.${side==='blue'?'blue':'pink'}`);if(!panel)return;
  let bars=panel.querySelector<HTMLElement>('.team-hp');
  if(!bars){bars=document.createElement('div');bars.className='team-hp';bars.setAttribute('role','img');panel.querySelector('.energy')?.before(bars)??panel.append(bars);}
  const shown=view==='game'&&roster.length<=8;bars.hidden=!shown;if(!shown)return;
  const values=roster.map(f=>f.alive?Math.max(.04,1-Math.max(0,...arcadeRegionalCondition(f.injuries).map(r=>r.pct))/100):0);
  const key=values.map(v=>v.toFixed(2)).join('/');if(bars.dataset.key===key)return;bars.dataset.key=key;
  while(bars.children.length>values.length)bars.lastElementChild!.remove();
  while(bars.children.length<values.length)bars.append(document.createElement('i'));
  values.forEach((v,i)=>{const bar=bars!.children[i] as HTMLElement;bar.style.setProperty('--hp',String(v));bar.dataset.out=String(v===0);});
  bars.setAttribute('aria-label',(side==='blue'?'Blue':'Pink')+' '+values.filter(v=>v>0).length+' of '+values.length+' standing');
}
function updateHUD(){
  updateHeroWatch();
  for(const [team,side] of [[0,'blue'],[1,'red']] as const){
    const roster=game.fighters.filter(f=>f.team===team);
    const lead=roster.find(f=>f.control)??roster.find(f=>f.alive)??roster[0];
    const final=career?.careers?.[lead?.id as `${number}-${number}`];
    const rank=gradeDisplayLabel(final?SOLDIER_GRADES.findLast(g=>g.threshold<=(final as {merit:number}).merit)?.label??'F':lead?.career?.grade??'F');
    const own=side==='blue'&&lead?.control&&view==='game';
    const elo=lead&&roundRated?arenaRatingDetail(lead.id,lead.career.gradeIndex,true):'';
    if(side==='blue'){const name=$('blueName'), badge=own&&!ratingUnrecorded?elo:'';if(name.dataset.ownElo!==badge)name.dataset.ownElo=badge;}
    $(`${side}Rank`).textContent=rank+(elo&&(!own||ratingUnrecorded)?' · '+elo:'');
    $(`${side}Rank`).title=lead?arenaRatingDetail(lead.id,lead.career.gradeIndex):'Rank';
    $(`${side}Count`).textContent=roster.filter(f=>f.alive).length+'/'+roster.length;
    renderTeamHealth(side,roster);
    if(lead)renderRibbon(`${side}Injuries`,lead);
  }
  const second=game.config.localVersus?game.fighters.find(f=>f.control&&f.team===1):undefined,stamina2=document.getElementById('energy2') as HTMLProgressElement|null;
  if(stamina2){stamina2.hidden=!second;if(second)stamina2.value=clamp(second.energy/100,0,1);}
  const player=game.fighters.find(f=>f.control);$('quickTechnique').disabled=$('useTechnique').disabled=player?.alive===false;$('energy').hidden=!player;$('energy').value=clamp((player?.energy??0)/100,0,1);
  const low=Boolean(player?.alive&&player.energy<=30);
  const guardHint=low?'Low STA':'Tap to Parry';
  if($('guardHint').textContent!==guardHint){
    $('guardHint').textContent=guardHint;
    $('energy').setAttribute('aria-label',low?'Stamina Low':'Stamina');
  }
  const phaseButton=$('phaseAction'), extended=player?.saberPhase==='long';
  $('feintAction').disabled=!player?.alive;
  phaseButton.hidden=!player?.gear.dualPhase;
  phaseButton.disabled=!player?.alive;
  if(!phaseButton.hidden&&phaseButton.getAttribute('aria-pressed')!==String(extended)){
    phaseButton.setAttribute('aria-pressed',String(extended));
    phaseButton.setAttribute('aria-label',extended?'Retract Blade':'Extend Blade');
    $('phaseLabel').textContent=extended?'Retract':'Extend';
    $('phaseHint').textContent=extended?'Long Reach':'Short Reach';
  }
  const obj=game.objective;
  if(!$('objectiveHUD').hidden&&obj){
    $('objectiveBlue').textContent=Math.floor(obj.score[0]+1e-8) as unknown as string;
    $('objectivePink').textContent=Math.floor(obj.score[1]+1e-8) as unknown as string;
    $('objectiveLabel').textContent=obj.rule==='control'?(obj.contested?'Contested':'Signal · '+obj.target)
      :obj.relic?.carrierId?(obj.relic.carrierTeam?'Pink Carries':'Blue Carries'):'Relic · '+obj.target;
  }
  const remaining=Math.max(0,Math.ceil(game.limit-game.time));
  $('clock').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  $('round').textContent='Round '+round;
  scoreboard.refresh();
}
function events(dt:number){
  fx.observe(game.events);fx.update(dt,reduced||crowdedLOD);
  if(view==='game')callouts.update(dt,game.events,game.fighters,{focusId:activeWatchHero()?.id});
  if(view==='game')barks.update(dt,game.events,game.fighters);
  if(!$('heroWatch').hidden&&game.eventId>lastEvent){const fresh=game.events.filter(e=>e.id>lastEvent);heroWatchEvents=captureHeroWatch(fresh,game.fighters,heroWatchEvents);}
  const audible:ArcadeEvent[]=[];
  for(const e of game.events){
    if(e.id<=lastEvent)continue;lastEvent=e.id;
    if(view==='menu')continue;
    if(debug)moveSeen[e.kind]=(moveSeen[e.kind]||0)+1;
    audible.push(e);
    // No constant whole-screen freezes in squad fights. Save one small beat for
    // big moments in a duel; the slash's own follow-through carries impact.
    if(!reduced&&mode==='duel'&&['ko','break','launch'].includes(e.kind))
      hitDelay=Math.max(hitDelay,e.kind==='ko'?.034:.012);

  }
  const scale=transform?.scale;
  const halfWidth=scale>0?canvas.width/(2*scale):game.width*.5;
  combatAudio.playEvents(audible,{center:scale>0?halfWidth-transform.x/scale:game.width*.5,halfWidth});
}
function drawAttackReads(alive:readonly ArcadeFighter[]){
  for(const f of alive){
    if(!f.technique||f.technique.startsWith('slash')||f.technique==='vault_step'||!f.attack)continue;
    const spec=f.attackSpec||field(ARCADE_ATTACKS,f.attack??undefined);
    if(!spec||f.actionTime>=spec.contact)continue;
    const t=clamp(f.actionTime/spec.contact,0,1), color=f.team?'#ff83ae':'#75ecff';
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.face);
    ctx.globalAlpha=reduced?.6:.12+.28*t;
    ctx.strokeStyle=color;ctx.lineWidth=reduced?2:1.3+1.1*t;
    const cuesOnly=reduced||['force','thrust'].includes(f.technique as string);
    if(!cuesOnly){ctx.restore();continue;}
    if(f.technique==='thrust'){
      const n=spec.reach+30;
      ctx.beginPath();ctx.moveTo(5,-11);ctx.lineTo(n-16,-11);ctx.lineTo(n,0);ctx.lineTo(n-16,11);ctx.lineTo(5,11);ctx.closePath();ctx.stroke();
    }else{
      const a=Math.min(2.46,spec.arc);
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,spec.reach,-a,a);ctx.closePath();ctx.stroke();
    }
    ctx.restore();
  }
}
// Solid afterimages are sampled from earlier positions, not drawn as skeletal lines.
function drawEchoes(f:ArcadeFighter,neighbors:readonly ArcadeFighter[],crowded:boolean){
  if(reduced||crowded||crowdedLOD){echoes.delete(f.id);return;}
  const history=echoes.get(f.id)||[];
  while(history.length&&displayTime-history[0].at>.15)history.shift();
  const active=f.alive&&Math.hypot(f.vx,f.vy)>300&&(f.action==='dash'||['vault','frenzy','thrust'].includes(f.technique as string));
  if(active&&(!history.length||displayTime-history.at(-1)!.at>=.044)){
    history.push({pose:{...f},time:displayTime,at:displayTime});
    if(history.length>2)history.shift();
    echoes.set(f.id,history);
  }
  for(const g of history){
    if(Math.hypot(f.x-g.pose.x,f.y-g.pose.y)<16||neighbors.some(other=>sharesSilhouette(g.pose,other)))continue;
    ctx.save();ctx.globalAlpha=.33*(1-(displayTime-g.at)/.15);
    drawArcadeFighter(ctx,g.pose,g.time,{ghost:true,reducedMotion:true});
    ctx.restore();
  }
}
function renderObjective(){
  const o=game.objective;
  if(!o||o.rule==='elimination'||view==='menu')return;
  ctx.save();
  const ring=(p:Point&{radius:number},color:string,dashed:boolean)=>{
    ctx.strokeStyle=color;ctx.fillStyle=color+'17';ctx.lineWidth=2.5;
    if(dashed)ctx.setLineDash([9,6]);else ctx.setLineDash([]);
    ctx.beginPath();ctx.ellipse(p.x,p.y,p.radius,p.radius,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  };
  if(o.rule==='control')ring(o.center,o.contested?'#ffe5a8':o.owner===0?'#7cecff':o.owner===1?'#ff91b8':'#d5c5a3',o.contested);
  else if(o.relic){
    o.relic.homes.forEach((h,i)=>ring(h,i?'#ff91b8':'#7cecff',true));
    const {x,y,state}=o.relic;
    if(state!=='resetting'){
      const lift=state==='carried'?92:13;
      ctx.translate(x,y-lift);ctx.fillStyle='#fff1bb';ctx.strokeStyle='#251d18';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(8,0);ctx.lineTo(0,10);ctx.lineTo(-8,0);ctx.closePath();ctx.fill();ctx.stroke();
    }
  }
  ctx.restore();
}
function draw(dt:number){
  const cw=canvas.width,ch=canvas.height;
  const sample=displayFighters(game.fighters,sim.previous,sim.remainder);
  const alive=sample.filter(f=>f.alive);
  const watched=heroWatchFocus&&!reduced&&!$('heroWatch').hidden?heroWatchFrame(alive,watchChoice.value):[];
  const causeways=canDesktopCausewayFocus();
  const causewayShotActive=causeways&&causewayFocus&&!reduced;
  const enabled=view==='game'&&!reduced&&(watched.length>0||((causeways?causewayFocus:followAction)&&!$('cameraView').disabled));
  const portrait=canPortraitFollow()&&followAction&&!reduced;
  let closeShot;
  if(portrait||causewayShotActive){
    const {anchor,rival}=selectArenaFocus(W,H,alive,{hero:watched[0],preferred:canFocusCauseways(matchSetup.mapId,game.fighters.length)?preferredArenaFocusId:undefined,previous:portraitFocusId});
    if(anchor){
      portraitFocusId=anchor.id;
      closeShot=portrait&&game.config.rule==='elimination'&&game.fighters.length===2
        ?portraitDuelActionFrame(W,H,cw,ch,anchor,rival):portraitActionFrame(W,H,cw,ch,anchor,rival,portrait?2.05:1.64);
    }
  }
  const shot=closeShot??actionFrame({width:W,height:H,fighters:watched.length?watched:alive,enabled:enabled&&!causeways});
  const profile=!portrait&&!causeways&&enabled&&view!=='menu',shake=reduced?null:fx.shake();
  // Keep a little more of the cutaway set behind the fight, without
  // giving up vertical room for the feet or jumping blade.
  const frame=profile&&shot.zoom>1?{...shot,y:shot.y-30}:shot;
  focus=stepActionFrame(focus,frame,W,H,dt,(!enabled&&!closeShot)||portrait!==portraitWasActive||causewayShotActive!==causewayFocusWasActive);
  if(closeShot){
    const base=Math.min(cw/W,ch/H);
    const halfHeight=Math.min(H/2,ch/(2*base*focus.zoom));
    focus.y=clamp(focus.y,halfHeight,H-halfHeight);
  }
  portraitWasActive=portrait;causewayFocusWasActive=causewayShotActive;
  transform=composeArcadeFrame(cw,ch,W,H,focus,{profile,shake:shake as Point|undefined});
  const {scale,scaleY}=transform;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=canPortraitFollow()&&!portrait?'#15171b':'#181613';ctx.fillRect(0,0,cw,ch);
  if(canPortraitFollow())paintArcadeStageMatte(ctx,stage.id,cw,ch,transform.y,H*scaleY!);
  ctx.setTransform(scale,0,0,scaleY!,transform.x,transform.y);
  drawArcadeStage(ctx,stage,W,H,displayTime,reduced);
  renderObjective();
  fx.drawGround(ctx);
  drawAttackReads(alive);
  const byDepth=sample.slice().sort((a,b)=>a.y-b.y);
  const crowd=crowdedFighters(alive);
  for(const f of byDepth)drawEchoes(f,alive,crowd.has(f.id));
  const poses=byDepth.flatMap(f=>{
    const pose=endDelay>0&&f.action==='ko'?{...f,actionTime:f.actionTime+endDelay}:f;
    // Knocked-out silhouettes fade after the fall instead of piling up
    // beneath live fighters for the rest of a large round.
    const opacity=pose.action==='ko'?1-clamp((pose.actionTime-.63)/.85,0,1):1;
    if(opacity<=0)return [];
    const rig=sampleArcadeFighter(pose,displayTime,{reducedMotion:reduced});
    if(!reduced&&!crowdedLOD&&pose.alive&&!pose.saberOff){
      const blade=arcadeBladeWorld(pose,rig);
      fx.sampleBlade(pose as Parameters<typeof fx.sampleBlade>[0],blade);
      if(view==='game')swingWaves.sample(pose,blade,displayTime);
    }else if(view==='game'&&!reduced&&!crowdedLOD)swingWaves.sample(pose,null as unknown as undefined,displayTime);
    return [{pose,rig,opacity}];
  });
  fx.drawBladeTrails(ctx);
  swingWaves.draw(ctx,displayTime,{reducedMotion:reduced||crowdedLOD});
  const paint=[...poses.map(p=>({p,depth:p.pose.y})),...(stage.obstacles??[]).map(o=>({o,depth:o.y+o.height}))].sort((a,b)=>a.depth-b.depth);
  for(const item of paint){
    if("o" in item)drawArcadeObstacle(ctx,stage,item.o);
    else {
      const {p}=item;
      ctx.globalAlpha=p.opacity;
      drawArcadeFighter(ctx,p.pose,displayTime,{rig:p.rig,reducedMotion:reduced,selected:p.pose.control,
        outline:p.pose.alive,lowDetail:crowdedLOD,crowded:crowd.has(p.pose.id)});
      ctx.globalAlpha=1;
    }
  }
  fx.drawAir(ctx);
  if(view==='game')barks.draw(ctx,{reducedMotion:reduced});
  if(view==='game')callouts.draw(ctx,{reducedMotion:reduced});
  if(touchAim?.id){
    const target=alive.find(f=>f.id===touchAim?.id);
    if(target){
      const y=target.y-39-(target.airHeight??0), x=target.x;
      ctx.save();ctx.strokeStyle='#ffe5ad';ctx.lineWidth=2.4;
      for(const dx of [-1,1])for(const dy of [-1,1]){
        ctx.beginPath();ctx.moveTo(x+dx*24,y+dy*16);ctx.lineTo(x+dx*24,y+dy*25);ctx.lineTo(x+dx*15,y+dy*25);ctx.stroke();
      }
      ctx.restore();
    }
  }
  if(view==='game'){
    const heroes=poses.filter(({pose})=>pose.alive&&pose.heroId);
    if(heroes.length)drawArcadeHeroMarkers(ctx,arcadeHeroMarkers(heroes.map(({pose,rig})=>({pose,anchor:arcadeHeroLabelWorld(pose,rig)})),
      transform,cw/canvasPixelScale,ch/canvasPixelScale,canvasPixelScale),canvasPixelScale);
  }
}
function frame(now:number){
  const dt=displayDelta(clock,now);
  pollPads();
  const fps=clock.fps?clock.fps+' FPS':'FPS';
  // On heavy battles shed decorative effects rather than frames. Fighter
  // silhouettes, timing, collision and the HUD do not change.
  if(view==='game'&&!crowdedLOD&&game.fighters.length>=12&&displayTime>1.6&&clock.fps>0&&clock.fps<38){
    crowdedLOD=true;resize();
  }
  const simVisible=!paused&&!settingsDialog?.open&&!savedStatsDialog?.open&&!$('keysDialog').open&&!$('statsDialog').open&&!$('rankDialog').open&&!$('guide').open;
  if(simVisible&&$('frameRate').textContent!==fps)$('frameRate').textContent=fps;
  if(!document.hidden){
    if(simVisible){
      displayTime+=dt;
      hitDelay=Math.max(0,hitDelay-dt);
      if(view==='game'&&game.phase==='playing'){
        advanceSim(sim,dt*(mode==='watch'||mode==='command'?matchSetup.pace:game.config.novicePractice ? .75 : 1),{blocked:hitDelay>0,playing:()=>game.phase==='playing',step:()=>{
          sim.previous=fighterSamples(game.fighters);
          if(view==='game'){if(seat)seat.step(inputs() as Record<string,unknown>);else stepArcade(game,FRAME_STEP,inputs() as ArcadeInput);}
        }});
      }else{
        sim.previous=null;
        endDelay+=dt;

        if(view==='game'&&endDelay>.80){
          if($('result').hidden)showEnd();
          else if(autoDuel.active){
            if(autoDuel.advance(dt,true))nextCareerRound();
            else syncAutoDuel();
          }
        }
      }
      events(dt);
      if(view==='game'&&displayTime-hudAt>.075){updateHUD();hudAt=displayTime;}
    }
    if(simVisible)draw(dt);
    if(debug){
      const f=game.fighters.find(v=>v.control)||game.fighters[0];
      if(view==='game'){
        watchedPhases[f.airPhase||'grounded']=true;watchedPhases[f.action]=true;
        maxHeight=Math.max(maxHeight,f.airHeight||0);
      }
      debug.textContent=fps+' · tick '+game.tick+' · '+game.time.toFixed(1)+'/'+game.limit+'s · '+mode+' · '+game.phase+' · '+f.action+' · '+Math.round(f.x)+','+Math.round(f.y)+' · '+Math.round(f.groundDistance)+' traveled · '+(f.airPhase||'grounded')+' '+Math.round(f.airHeight||0)+' height · '+f.form+' / '+f.body+' · '+Object.entries(moveSeen).map(([name,n])=>name+':'+n).join(' ')+(view==='game'?' · motion '+Object.keys(watchedPhases).join('/')+' peak:'+Math.round(maxHeight):'');
    }
  }
  requestAnimationFrame(frame);
}
let debug:HTMLOutputElement|null=null;
if(new URLSearchParams(location.search).has('qa')){
  debug=document.createElement('output');debug.style.cssText='position:fixed;bottom:0;left:0;background:#170c27;color:white;font:12px monospace;z-index:10;padding:4px';debug.id='arcadeQA';document.body.append(debug);
}
/** Forms codex: numeral badge, name, style tag, 1–5 stat meters from the engine's own form numbers, signature move. */
type FormRow=(typeof ARCADE_FORMS)[keyof typeof ARCADE_FORMS];
const CODEX_STATS:[string,(f:FormRow)=>number][]=[['Speed',f=>f.speed],['Reach',f=>f.reach],['Guard',f=>f.guardAI],['Tempo',f=>1/f.tempo]];
const codexRows=ARCADE_FORM_IDS.map(id=>field(ARCADE_FORMS,id)).filter((f):f is FormRow=>!!f);
function codexPips(read:(f:FormRow)=>number,f:FormRow){
  const all=codexRows.map(read),lo=Math.min(...all),hi=Math.max(...all);
  return hi>lo?Math.round(1+4*(read(f)-lo)/(hi-lo)):3;
}
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,cls?:string,text?:string)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
for(const id of ARCADE_FORM_IDS){
  const form=field(lore,id),stats=field(ARCADE_FORMS,id);if(!form)continue;
  const option=document.createElement('option');option.value=id;option.textContent=form.name;option.dataset.roman=form.roman;$('style').append(option);
  const card=make('section','codex-card');card.dataset.form=id;
  const head=make('div','codex-head'),badge=make('span','v6-tag codex-num',form.roman);badge.setAttribute('aria-label','Form '+form.roman);
  head.append(badge,make('h3',undefined,form.name),make('span','v6-meta codex-style',form.tag));
  const list=make('dl','codex-stats');
  if(stats)for(const [label,read] of CODEX_STATS){
    const pips=codexPips(read,stats),row=make('div','codex-stat'),meter=make('meter','codex-meter');
    meter.min=0;meter.max=5;meter.value=pips;meter.textContent=pips+'/5';meter.setAttribute('aria-label',label+' '+pips+' of 5');
    const dd=make('dd');dd.append(meter);row.append(make('dt',undefined,label),dd);list.append(row);
  }
  const sig=make('div','codex-stat codex-sig');sig.append(make('dt',undefined,'Signature'),make('dd',undefined,form.signature));list.append(sig);
  card.append(head,list);$('guideForms').append(card);
}
$('style').value='makashi';

function refreshSavedRunUI(){
  $('continueRun').hidden=!savedCareer;if(homeContinue)homeContinue.hidden=!savedCareer;
  $('autoDuelSaved').hidden=!savedCareer||!canAutoSaved(savedCareer);
  $('resumeCareer').disabled=!savedCareer;
  $('careerStatus').textContent=imported?'Imported ranks selected':savedCareer?titleCase(savedCareer.mode)+' round '+savedCareer.round+' saved':'No saved run';
 }
function openRanks(){
  savedCareer=readCareerForUI();refreshSavedRunUI();$('rankDialog').showModal();
}
$('rankSetup').addEventListener('click',openRanks);
$('useClassic').addEventListener('click',async()=>{
  const button=$('useClassic');button.disabled=true;
  try{
    const {loadCampaign}=await import('./persistence.js?v=6.0.2');
    const result=loadCampaign();
    if(!result.game){$('careerStatus').textContent=result.error;return;}
    imported=classicCareers(result.game);
    $('careerStatus').textContent='Ranks imported';
  }catch{$('careerStatus').textContent='Old save unreadable';}
  finally{button.disabled=false;}
});
const savedSetup=(next:Career)=>normalizeSetup(next.setup??{...field(presets,next.mode),teamSizes:next.mode==='duel'?[1,1]:[3,3],duration:75,form:next.form,body:next.body});
function canAutoSaved(next:Career){
  const options=savedSetup(next);
  const heroes=next.heroLineup?normalizeHeroLineup(next.heroLineup):battleHeroLineup(options.heroPicks,heroRoster,tournamentHeroLoadout);
  return arenaLobbyRating(next.mode,options.rule,options.teamSizes,heroes,engineForcePools(options),options.novicePractice&&canArenaNovicePractice(options,heroes),options.squadTactics&&canArenaSquadTraining(options,heroes),options.opponentReads&&canArenaAdaptiveSparring(options,heroes)).rated;
}
function resumeRun(automatic=false){
  const raw=rawArenaSave();
  // Decode and remember the same exact bytes, rather than pairing stale
  // cached progress with a freshly captured comparison value.
  savedCareer=(raw===undefined?null:readArcadeCareer({getItem:()=>raw})) as Career|null;
  refreshSavedRunUI();
  if(!savedCareer||automatic&&!canAutoSaved(savedCareer))return;
  roundSaveBaseline=raw;
  if($('rankDialog').open)$('rankDialog').close();
  if(automatic){autoDuel.start();autoCareerMode=savedCareer.mode;}
  else {autoDuel.stop();autoCareerMode=undefined;}
  const next=savedCareer;seed=next.seed;seedCounter=0;
  setScene('game',automatic?'watch':next.mode,next.round,{careers:next.careers,records:next.records,setup:savedSetup(next),heroLineup:next.heroLineup,arenaRatings:next.arenaRatings});
}
homeContinue?.addEventListener('click',()=>resumeRun());$('resumeCareer').addEventListener('click',()=>resumeRun());$('continueRun').addEventListener('click',()=>resumeRun());
$('autoDuelSaved').addEventListener('click',()=>resumeRun(true));
window.addEventListener('storage',e=>{
  if(e.storageArea!==localStorage||(e.key!==null&&e.key!==ARCADE_CAREER_KEY))return;
  savedCareer=readCareerForUI();
  if(view==='menu')refreshSavedRunUI();
});
window.addEventListener('pagehide',()=>{seat?.leave();if(autoDuel.active){autoDuel.stop();syncAutoDuel();$('modeLabel').textContent='Showdown';}});
const reportRows=[['Swings','saberSwings'],['Saber Hits','saberHits'],
  ['Blocks','blocks'],['Parries','parries'],['Reads','guardReads'],['Feints','feints'],['Ripostes','ripostes'],['Clashes','clashes'],['Ally Blocks','allyBlocks'],['Punishes','punishes'],['Counters','counters'],['Force Casts','forceCasts'],
  ['Force Hits','forceHits'],['Knockouts','kills'],['Deaths','deaths'],['Assists','assists'],['Hazard Deaths','environmentDeaths']] as const;
function reportCell<K extends keyof HTMLElementTagNameMap>(tag:K,value:unknown,cl?:string){
  const el=document.createElement(tag);el.textContent=value as string;if(cl)el.className=cl;return el;
}
const defenseNames:Record<string,string>={perfect_parry:'Perfect Parry',...Object.fromEntries(ARCADE_RANK_FOOTWORK.map(m=>[m.id,m.label])),trakata:'Tràkata',hero_reposition:'Crossfire Exit',advanced_parry:'Parry Follow-Up',advanced_whiff:'Line Change',advanced_travel:'Footwork Follow-Up',jump:'Jump',wheel:'Wheel Hop',crossflip:'Crossflip',compact:'Compact Hop',line:'Line Jump',bound:'Bounding Jump',drift:'Drift Step',pounce:'Pounce',corkscrew:'Corkscrew Jump',feint:'Feint',read:'Read',guard_read:'Read',directional_parry:'Directional Parry',force_ward_block:'Lattice Block',guard:'Guard',block:'Block',parry:'Parry',dash:'Dash Evade',vault_step:'Vault Evade',evade:'Evade',sidestep:'Sidestep',backstep:'Backstep',clash:'Blade Bind',rank_deflect:'Deflection',rank_composure:'Composure',rankDeflect:'Deflection',rankComposure:'Composure',pressure_graze:'Glancing Defense',pressure_recover:'Stagger Recovery'};
$('bodyRows').addEventListener('click',event=>{
  const fold=(event.target as Element|null)?.closest?.('.injury-fold');
  if(!fold)return;
  const open=fold.getAttribute('aria-expanded')!=='true';
  fold.setAttribute('aria-expanded',String(open));fold.closest('tr')?.toggleAttribute('data-open',open);
});
function showInjuryReport(f:ArcadeFighter|undefined){
  const rank=f?.career?.gradeIndex??0;
  const opts={attackerRank:rank,defenderRank:rank,freshTorso:f?.regionalInjuries===true};
  const front=arcadeInjuryReport(f?.injuries,{...opts,direction:'front'}), rear=arcadeInjuryReport(f?.injuries,{...opts,direction:'rear'});
  const local=arcadeRegionalCondition(f?.injuries);
  $('bodyRows').replaceChildren(...front.map((a,i)=>{
    const b=rear[i], row=document.createElement('tr'), h=reportCell('th',a.label);
    h.scope='row';const fatal=f?.fatalRegion===a.id;
    const ac=reportCell('td',fatal&&f.fatalDirection!=='rear'?'Fatal':a.severityLabel), bc=reportCell('td',fatal&&f.fatalDirection==='rear'?'Fatal':b?.severityLabel??'Ready');
    ac.dataset.level=severityLevel(ac.textContent);bc.dataset.level=severityLevel(bc.textContent);
    const condition=local[i]!;
    const value=reportCell('td',condition.pct+'% · '+(fatal?'Fatal':condition.labelCondition),'injury-condition');
    value.dataset.level=severityLevel(fatal?'Fatal':condition.labelCondition);
    // Phone folds Front, Rear and Fatal risk under the region: the region name is the toggle.
    const fold=document.createElement('button');fold.type='button';fold.className='injury-fold';fold.textContent=a.label;fold.setAttribute('aria-expanded','false');
    h.replaceChildren(fold);
    const risk=reportCell('td',f?.alive===false?'—':a.fatalPct+'% / '+(b?.fatalPct??0)+'%');
    ac.dataset.label='Front';bc.dataset.label='Rear';risk.dataset.label='Fatal Risk';
    row.append(h,value,ac,bc,risk);return row;
  }));
  // Thresholds as short pills; the rules essay stays out of the stats dialog.
  setPills($('injuryReference'),['18% Strain','43% Impair',ARCADE_LIMB_DISABLE_PCT+'% Disabled',...(String(f?.gear.weapon)==='orbit'?['Orbit: No Grip']:['R Arm Blade','L Arm Offhand'])]);
  document.getElementById('fatalReference')!.textContent='Guarded Hits Never Fatal';
}
const baseAttackNames:Record<string,string>={stamina_hit:'STA Gain',...Object.fromEntries(Object.values(ARCADE_AIR_STRIKES).map(move=>[move.id,move.label])),chain_follow:'Linked Follow-Up',staff_primary_hit:'Front Tip Hits',staff_rear_hit:'Rear Tip Hits',landed_riposte:'Riposte Hit',slash:'Opening Cut',slash2:'Reverse Cut',slash3:'Finishing Cut',slash4:'Fourth Cut',thrust:'Linear Thrust',wide_cut:'Wide Sweep',deflect:'Guard Riposte',vault:'Acrobatic Vault',riposte:'Power Counter',force:'Force Cast',force_push:'Push',force_burst:'Burst',force_pulse:'Pulse',frenzy:'Ferocity Chain',sweep:'Sweep',rush:'Rush',uppercut:'Rising Cut',offhand:'Offhand Cut',guard_break:'Guard Break'};
const words=(id:string)=>id.replaceAll('_',' ').replace(/(^| )([a-z])/g,(_,space,c)=>space+c.toUpperCase());
function showMoveStats(){
  const f=game?.fighters.find(x=>x.id===$('moveFighter').value);
  showInjuryReport(f);
  const damage=(n:number|undefined)=>Number.isFinite(n)?Math.max(0,n as number).toLocaleString(undefined,{maximumFractionDigits:1}):'0';
  $('fighterDamageDealt').textContent=damage(f?.stats?.damage);
  $('fighterDamageTaken').textContent=damage(f?.stats?.damageTaken);
  const grade=f?.career?.grade??'F';
  const rating=f&&roundRated?arenaRatingDetail(f.id,f.career.gradeIndex):f?.heroId&&Number.isFinite(f.heroElo)?ratingText(f.heroElo as number)+' Elo':'Unrated';
  const chess=chessReadout(f);
  setPills($('moveRank'),f?[gradeDisplayLabel(grade),formName(f.form),chess,f.heroId?fighterGenderLabel(f.gender):'',rating,
    f.heroId&&Number.isFinite(f.heroElo)?'Floor '+ratingText(eloFloor(f.heroEloFloorGrade)):'',f.heroId?(f.control?'You':titleCase(f.heroPlan??'balanced')):'',habitName(f)]:[]);
  const appearance=f?arenaFighterAppearance(f):null;
  $('fighterAppearance').hidden=!appearance;
  setPills($('fighterAppearanceDetails'),appearance?[appearance.gender,appearance.appearance,appearance.source]:[]);
  const moves=Object.entries(f?.moves??{}).filter(([id,n])=>n>0&&typeof id==='string').sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const movesUsed=document.getElementById('movesUsed');if(movesUsed)movesUsed.hidden=!moves.length;
  for(const [id,defense] of [['attackMoves',false],['defenseMoves',true]] as const){
    const rows=moves.filter(([key])=>defense===Boolean(defenseNames[key]||ARCADE_TECHNIQUES[key]?.tactical==='moving_guard')).map(([key,n])=>{
      const row=document.createElement('div');
      row.append(reportCell('dt',defenseNames[key]??combatMoveLabel(key)??baseAttackNames[key]??arcadeForcePoolEntry(key)?.label??words(key)),reportCell('dd',n));return row;
    });
    if(!rows.length){const row=document.createElement('div');row.append(reportCell('dt','None'),reportCell('dd','0'));rows.push(row);}
    $(id).replaceChildren(...rows);
  }
}
$('moveFighter').addEventListener('change',()=>{
  if(view==='game'&&canFocusCauseways(matchSetup.mapId,game?.fighters.length??0))preferredArenaFocusId=$('moveFighter').value;
  showMoveStats();
});
function openStats(){
  if(view!=='game')return;
  clearInput();sim.remainder=0;sim.previous=null;
  setPills($('statsRound'),['Round '+round,game.phase==='playing'?'Paused':'Complete',roundRated?'Rated':'Unrated']);
  $('roundStats').replaceChildren(...reportRows.map(([label,key])=>{
    const row=document.createElement('tr'), head=reportCell('th',label);head.scope='row';
    row.append(head,reportCell('td',game.stats?.[key]?.[0]??0,'blue'),reportCell('td',game.stats?.[key]?.[1]??0,'pink'));return row;
  }));
  const obj=game.objective;
  if(obj?.target){
    const row=document.createElement('tr'),h=reportCell('th',obj.rule==='control'?'Signal Points':'Relic Deliveries');
    h.scope='row';row.append(h,...obj.score.map((n,i)=>reportCell('td',Math.floor(n+1e-8),i?'pink':'blue')));$('roundStats').append(row);
  }
  $('reportSeed').textContent='Seed '+seed;$('copySeed').textContent='Copy Seed';
  const eventsBy:Record<string,string>={stamina_hit:'STA Gain',expanded_release:'Technique',force_pool_release:'AI Force',hero_plan:'Hero Tactic',advanced_route:'Follow-Up',hero_reposition:'Crossfire Exit',trakata_off:'Tràkata Off',trakata_on:'Tràkata Relit',feint:'Feint',read:'Read',riposte:'Riposte',ally_blocked:'Ally Blocked',clash:'Clash',parry:'Parry',break:'Guard Break',ko:'Knockout',hazard:'Hazard Hit',capture:'Point Captured',deliver:'Relic Delivered',pickup:'Relic Pickup',drop:'Relic Dropped',crowd_escape:'Breakout',crowd_scatter:'Scatter',crowd_flee:'Fled'};
  const namedCommit=(e:ArcadeEvent)=>(e.contact as number)>0&&!e.offhand&&combatMoveLabel(e.moveId??e.technique,e);
  const visible=game.events.filter(e=>e.punish||e.region||eventsBy[e.kind]||namedCommit(e)).slice(-8).reverse();
  const eventLabel=(e:ArcadeEvent)=>{
    if(e.kind==='stamina_hit')return '+'+Math.round((e.staminaGain as number)*10)/10+' STA '+regionName(e.region as string);
    if(e.kind==='parry'&&e.perfect)return 'Perfect Parry';
    if(e.kind==='force_pool_release')return (arcadeForcePoolEntry(typeof e.poolAbility==='string'?e.poolAbility:undefined)?.label??'Force');
    const expanded=e.kind==='expanded_release'&&arcadeExpandedMoveById(e.moveId as string,{forceVariants:true});
    if(expanded)return expanded.label;
    if(e.region)return (e.fatal||e.kind==='ko'?'Fatal Hit':e.punish?'Punish':'Injury')+' '+regionName(e.region)+(e.direction==='rear'?' (Rear)':'');
    return namedCommit(e)||eventsBy[e.kind]||'Punish';
  };
  $('recentEvents').replaceChildren(...(visible.length?visible.map(e=>reportCell('li',Math.floor(e.time??0)+'s '+eventLabel(e))):[reportCell('li','No Events')]));
  const prior=$('moveFighter').value;
  fillOptions($('moveFighter'),game.fighters.map(f=>[f.id,(f.displayName??((f.team?'Pink ':'Blue ')+(f.slot+1)))+' · '+formName(f.form)]));
  $('moveFighter').value=game.fighters.some(f=>f.id===prior)?prior:game.fighters.find(f=>f.control)?.id??game.fighters[0].id;
  showMoveStats();
  const awards=settleArcadeCareer(game,roundRatings);
  $('fighterStats').replaceChildren(...game.fighters.map(f=>{
    const side=f.team?'Pink':'Blue', row=document.createElement('tr'), label=reportCell('th',f.displayName??side+' '+(f.slot+1),f.team?'pink':'blue');
    label.scope='row';if(f.displayName)label.append(reportCell('small',side+' '+(f.slot+1)),reportCell('small','Hero'));label.append(reportCell('small',formName(f.form)),reportCell('small',arcadeSaberOption(f.gear).label));
    const chess=chessReadout(f),habit=habitName(f);if(chess)label.append(reportCell('small',chess));
    if(habit)label.append(reportCell('small',habit));
    const temper=f.control?null:crowdPersonaLabel(f);if(temper)label.append(reportCell('small',temper,'persona'));
    if(f.gear?.dualPhase)label.append(reportCell('small',f.saberPhase==='long'?'Long Blade':'Short Blade'));
    const earned=awards?.report.find(a=>a.id===f.id), summary=earned?.after??f.career;
    const rank=reportCell('td',''), record=game.records?.soldiers.find(r=>r.id===f.id);
    rank.append(reportCell('b',gradeDisplayLabel(summary?.grade??'F')),reportCell('small',(summary?.merit??0).toLocaleString()+' XP'+(earned?.reward?' +'+earned.reward:'')+(earned?.promoted?' Up':'')));
    if(roundRated)rank.append(reportCell('small',arenaRatingDetail(f.id,f.career.gradeIndex)));
    row.append(label,rank,reportCell('td',[record?.kills??0,record?.deaths??0,record?.assists??0].join('/')));return row;
  }));
  $('statsDialog').showModal();
}
$('copySeed').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(String(seed));$('copySeed').textContent='Copied';}
  catch{$('copySeed').textContent='Copy Failed';}
});
$('resultStats').addEventListener('click',openStats);
$('statsDialog').addEventListener('close',()=>{if(!paused&&game.phase==='playing')canvas.focus({preventScroll:true});});


$('formsGuide').addEventListener('click',()=>$('guide').showModal());

const forcePickers:ReturnType<typeof createArenaForcePicker>[]=[];
function showForcePools(){
  for(const team of [0,1]){
    const inactive=team===0&&setup.participation==='play'&&setup.teamSizes[0]===1;
    forcePickers[team].render(setup.forcePools[team],inactive);
  }
}
const pairs:Record<string,[string,string][]>= {
  teamGenders:ARENA_TEAM_GENDERS.map(id=>[id,titleCase(id)]),
  teamAppearances:ARENA_TEAM_APPEARANCES.map(id=>[id,titleCase(id)]),
  startingRanks:SOLDIER_GRADES.map(g=>[g.label,g.displayLabel.replace(/\s*\(entry\)$/,'')]),
  groupForms:[['mixed','Mixed'],...ARCADE_FORM_IDS.map(id=>[id,formName(id)] as [string,string])],
  chessStyles:Object.entries(ARCADE_CHESS_STYLES).filter(([id])=>id!=='none').map(([id,style])=>[id,style.label]),
  doctrines:[['balanced','Balanced'],['aggressive','Aggressive'],['defensive','Defensive']],
  formations:[['line','Line'],['wedge','Wedge'],['spread','Spread']],
  targeting:[['balanced','Balanced'],['nearest','Nearest'],['weakest','Weakest'],['objective','Objective']],
  deployments:[['standard','Standard'],['forward','Forward'],['reserve','Reserve']],
  startingSaberQuality:ARCADE_GEAR_QUALITIES.map(x=>[x.id,x.label]),
  startingForceQuality:ARCADE_GEAR_QUALITIES.map(x=>[x.id,x.label]),
  startingForceFamily:ARCADE_FORCE_FAMILIES.map(x=>[x.id,x.label])
};
const teamLabels:Record<string,string>={teamGenders:'Team Gender',teamAppearances:'Team Look',startingRanks:'Starting Rank',groupForms:'Team Forms',doctrines:'AI Style',formations:'Formation',targeting:'Target',deployments:'Deployment',startingSaberQuality:'Saber Grade',startingForceQuality:'Force Grade',startingForceFamily:'Primary Force'};
function fillOptions(select:HTMLSelectElement,options:readonly (readonly [string|number,string])[]){select.replaceChildren(...options.map(([value,label])=>new Option(label,value as string)));}
function createLabel(name:string,field:HTMLElement){
  const label=document.createElement('label');label.append(document.createTextNode(name),field);return label;
}
function buildLobby(){
  fillOptions($('mapPick'),Object.entries(ARCADE_MAPS).map(([id,[label]])=>[id,label]));
  for(const [i,name] of [[0,'Blue'],[1,'Pink']] as const){
    fillOptions($(`saberKit${i}`),ARCADE_SABER_OPTIONS.map(o=>[o.id,o.label]));
    fillOptions($(`groupForms${i}`),pairs.groupForms);
    fillOptions($(`chessStyles${i}`),pairs.chessStyles);
    const card=document.createElement('section');
    card.append(reportCell('h2',name,i?'pink':'blue'));
    const advanced=document.createElement('details');
    advanced.className='arena-team-advanced';
    advanced.append(reportCell('summary','Advanced AI'));
    const advancedKeys=new Set(['doctrines','formations','targeting','deployments']);
    for(const [key,opts] of Object.entries(pairs)){
      if(key==='groupForms'||key==='chessStyles')continue;
      const select=document.createElement('select');select.id=key+i;
      select.setAttribute('aria-label',name+' '+teamLabels[key]);fillOptions(select,opts);
      const label=createLabel(teamLabels[key],select);
      if(key.startsWith('startingForce'))label.dataset.forceSetting='';
      (advancedKeys.has(key)?advanced:card).append(label);
    }
    const picker=createArenaForcePicker(name,pool=>readLobby(setup.forcePools.map((current,side)=>side===i?pool:current)));
    forcePickers[i]=picker;
    card.append(picker.element,advanced);
    $('teamControls').append(card);
  }
  const floors=$('rankFloorList');
  for(const grade of SOLDIER_GRADES){
    const row=document.createElement('div');
    row.append(reportCell('dt',grade.displayLabel),reportCell('dd',ratingText(eloFloor(grade.label))));floors.append(row);
  }
}
const scalar={rule:'rule',mapId:'mapPick',mapSize:'mapSize',body:'bodyStyle',playerSlot:'playerSlot',duration:'duration',pace:'pace',seed:'matchSeed',environment:'weatherPick'} as const;
function rosterFromSetup(){
  const field=$('playerSlot');fillOptions(field,Array.from({length:setup.teamSizes[0]},(_,j)=>[j,'Blue '+(j+1)]));
  field.value=String(setup.playerSlot);
  for(const [i,name] of [[0,'Blue'],[1,'Pink']] as const){
    const place=$(`roster${i}`);
    const length=setup.teamSizes[i];place.replaceChildren();
    for(let j=0;j<length;j++){
      if(i===0&&j===setup.playerSlot&&setup.participation==='play'){const note=reportCell('p',name+' '+(j+1)+' ','player-form-note');note.append(reportCell('span',setup.form==='mixed'?'Mixed':'You','v6-tag'));place.append(note);continue;}
      const sel=document.createElement('select');sel.id='slotForm'+i+'-'+j;
      fillOptions(sel,[['','Team Default'],...pairs.groupForms]);sel.value=setup.teamForms[i][j]??'';
      place.append(createLabel(name+' '+(j+1),sel));
    }
  }
}
function previewHeroes(selection:HeroLineup){
  const first:HeroLineup={};
  for(const [slot,value] of Object.entries(selection))first[slot[0]+'-0']=value;
  return first;
}
function heroSelects(){
  const empty=heroRoster.length===0;
  $('heroEmpty').hidden=!empty;$('heroHelp').hidden=empty;
  $('watchHero').disabled=empty;
  $('watchHeroHelp').textContent=empty?'No saved Heroes':'Saved Hero vs 3 SSS+ V';
  document.querySelector<HTMLElement>('.hero-options')!.hidden=empty;
  for(const i of [0,1] as const){
    const p=setup.heroPicks[i], other=setup.heroPicks[1-i]?.id??'';
    const choices=heroRoster.filter(x=>x.id!==other||x.id===p.id);
    fillOptions($(`heroChoice${i}`),[['','No Hero'],...choices.map(x=>[x.id,x.name] as const)]);
    $(`heroChoice${i}`).value=choices.some(x=>x.id===p.id)?p.id:'';
    const selected=choices.find(x=>x.id===$(`heroChoice${i}`).value), info=$(`heroEloHint${i}`);
    info.hidden=!selected;
    const actor=lobbyHeroControl(setup,i)==='manual'?'You':'AI';
    info.replaceChildren(...(selected?[actor,fighterGenderLabel(selected.gender),'SSS+ V',ratingText(selected.elo)+' Elo','Floor '+ratingText(eloFloor(selected.eloFloorGrade))]:[]).flatMap((t,i)=>i?[' ',reportCell('span',t,'v6-meta')]:[reportCell('span',t,'v6-meta')]));
    fillOptions($(`heroPos${i}`),Array.from({length:setup.teamSizes[i]},(_,j)=>[j,'Slot '+(j+1)]));
    $(`heroPos${i}`).value=String(p.slot);
    $(`heroPosLabel${i}`).hidden=!$(`heroChoice${i}`).value||setup.teamSizes[i]===1;
  }
}
/** The name the player picked (Showdown, Master Trial, Hero), not just the engine mode. */
function matchLabel(){
  if(seat)return seat.label;
  if(game.config.localVersus)return 'Two Players';
  if(autoDuel.active)return 'Auto Battle';
  if(mode==='watch')return 'Showdown';
  if(mode!=='duel'){
    if(setup.heroPicks[0]?.id&&setup.teamSizes.join()==='1,3')return 'Hero';
    if(activeArenaPreset(setup,'master'))return 'Master Trial';
    if(activeArenaPreset(setup,'watch'))return 'Showdown';
  }
  return titleCase(mode);
}
function prepareWatchHero(heroId?:string){
  const next=watchHeroSetup(setup,heroRoster,heroId);
  if(!next)return false;
  if(setup.startingRanks.join()!==next.startingRanks.join())imported=null;
  setup=next;
  $('heroOptions').open=true;
  return true;
}
function refreshHeroRoster(){
  heroRoster=tournamentHeroes(loadTournament());
  heroSelects();
  updateLobbyRating(setup.teamSizes);
}
/** Screen-reader descriptions for the saber selects, 8 words or fewer. */
const kitHints:Record<string,string>={
  single:'Direct cuts, quick guard',
  dual:'Two blades, staggered swings',
  backhand:'Compact close cuts',
  'backhand-dual':'Close alternating cuts',
  staff:'Two tips, one hilt',
  orbit:'Three Force-held blades, slow recovery',
  shoto:'Short reach, fast swings',
  greatsaber:'Long reach, heavy slow swings',
};
function updateLobbyRating(teamSizes:readonly number[]){
  const chosen=battleHeroLineup(setup.heroPicks,heroRoster,tournamentHeroLoadout);
  const snapshot={...setup,teamSizes:[...teamSizes]};
  const practiceAvailable=canArenaNovicePractice(snapshot,chosen);
  const practice=$('novicePractice');
  practice.disabled=!practiceAvailable;
  $('novicePracticeHint').textContent=practiceAvailable?'Unrated, 0.75× speed':'Played 1v1 F/E duel only';
  const squadAvailable=canArenaSquadTraining(snapshot,chosen);
  $('squadTactics').disabled=!squadAvailable;
  $('squadTacticsHint').textContent=squadAvailable?'Unrated squad formations':'Elimination, 2+ per side only';
  const laneAvailable=canArenaLaneDrill(snapshot,chosen);
  $('laneDrill').disabled=!laneAvailable;
  $('laneDrillHint').textContent=laneAvailable?'Unrated, five fronts':'16v16 Watch Elimination only';
  const adaptiveAvailable=canArenaAdaptiveSparring(snapshot,chosen);
  $('opponentReads').disabled=!adaptiveAvailable;
  $('opponentReadsHint').textContent=adaptiveAvailable?'Unrated, AI reads your guard':'Played 1v1 duel only';
  const {rated,label}=arenaLobbyRating(setupMode(snapshot),setup.rule,teamSizes,chosen,engineForcePools(snapshot),setup.novicePractice&&practiceAvailable,setup.squadTactics&&squadAvailable,setup.opponentReads&&adaptiveAvailable);
  const output=$('arenaRatingStatus');
  const summary=setup.laneDrill&&laneAvailable?'Unrated · Spread Deploy':label;
  if(output.textContent!==summary)output.textContent=summary;
  output.dataset.rated=String(rated);
  $('autoDuelStart').disabled=!rated;
}
for(const count of [$('count0'),$('count1')])count.addEventListener('input',()=>
  updateLobbyRating([$('count0').valueAsNumber,$('count1').valueAsNumber]));
function updateSetupHints(){
  const fixedSize=arenaFixedMapSize(setup.mapId);
  $('mapSize').disabled=Boolean(fixedSize);
  $('mapSize').title=fixedSize?'Fixed '+fixedSize.join('×'):'';

  showForcePools();
  updateLobbyRating(setup.teamSizes);
  for(const i of [0,1] as const){
    $(`kitHint${i}`).textContent=kitHints[$(`saberKit${i}`).value]??kitHints.single;
    const isOrbit=$(`saberKit${i}`).value==='orbit';
    $(`dualPhase${i}`).disabled=isOrbit;
    if(isOrbit)$(`dualPhase${i}`).checked=false;
    $(`chessStyleHint${i}`).textContent=ARCADE_CHESS_STYLES[setup.chessStyles[i]].hint;
  }
  const play=setup.participation==='play';
  const mixed=play&&setup.form==='mixed';
  $('yourFormRow').hidden=!play||(mixed&&setup.teamSizes[0]===1);
  $('styleLabel').hidden=mixed;
  $('playerSlotLabel').hidden=!play||setup.teamSizes[0]===1;
  $('blueDefaultLabel').hidden=play&&setup.teamSizes[0]===1;
  const pick=setup.heroPicks[0];
  const hero=play&&pick.slot===setup.playerSlot?heroRoster.find(h=>h.id===pick.id):null;
  $('style').disabled=Boolean(hero);
  const usesTeamLook=Boolean(setup.teamAppearances?.[0]&&setup.teamAppearances[0]!=='default');
  const look=$('bodyStyle');
  look.disabled=Boolean(hero)||usesTeamLook;
  $('bodyStyleHelp').textContent=hero?'Saved Hero look':usesTeamLook?'Team look active':'';
  $('pace').disabled=play;document.getElementById('paceHelp')!.textContent=play?'Watch and Commander only':'';
  for(const el of document.querySelectorAll<HTMLElement>('[data-force-setting]'))el.hidden=setup.saberOnly;
  for(const b of document.querySelectorAll<HTMLElement>('[data-preset]')){
    b.setAttribute('aria-pressed',String(activeArenaPreset(setup,b.dataset.preset??'')));
  }
  const summary=document.getElementById('setupSummary');
  const parts=arenaSetupSummaryParts(setup);
  if(summary&&summary.dataset.parts!==parts.join('|')){summary.dataset.parts=parts.join('|');summary.replaceChildren(...parts.flatMap((t,i)=>i?[' ',reportCell('span',t,'v6-meta')]:[reportCell('span',t,'v6-meta')]));}
  $('formDetail').textContent=play&&!mixed&&!hero?field(lore,setup.form)?.tag??'':'';
  $('airFormDetail').textContent=!play?'':hero?formName(hero.form):mixed?'Rotates Each Round':field(FORM_AIR_NAMES,setup.form)??'';
}
function applyLobby(){
  $('participation').value=localVersus&&setup.participation==='play'?'versus':setupPlayAs(setup);
  $('style').value=setup.fixedForm;
  for(const [key,id] of Object.entries(scalar))if(key!=='playerSlot')$(id).value=setup[key as keyof typeof setup]===null?'':String(setup[key as keyof typeof setup]);
  for(const key of Object.keys(pairs))for(const i of [0,1] as const)(document.getElementById(key+i) as HTMLSelectElement).value=((setup as unknown as Record<string,string[]>)[key])?.[i]??'default';
  for(const i of [0,1] as const){$(`count${i}`).value=setup.teamSizes[i] as unknown as string;$(`saberKit${i}`).value=arcadeSaberOption(arcadeFighterGear(setup,i)).id;$(`dualPhase${i}`).checked=setup.startingDualPhase[i];}
  $('saberOnly').checked=setup.saberOnly;
  $('novicePractice').checked=setup.novicePractice;
  $('squadTactics').checked=setup.squadTactics;
  $('laneDrill').checked=setup.laneDrill;
  $('opponentReads').checked=setup.opponentReads;
  rosterFromSetup();heroSelects();updateSetupHints();
}
function readLobby(forcePools=setup.forcePools){
  const playAs=$('participation').value;localVersus=playAs==='versus';
  const old=setup, input:Record<string,unknown>={...old,...playAsSetup((localVersus?'play':playAs) as Parameters<typeof playAsSetup>[0],$('style').value,old)};
  for(const [key,id] of Object.entries(scalar))input[key]=$(id).value;
  for(const key of Object.keys(pairs))input[key]=([0,1] as const).map(i=>(document.getElementById(key+i) as HTMLSelectElement).value);
  input.teamSizes=localVersus?[1,1]:([0,1] as const).map(i=>$(`count${i}`).value);
  const kits=([0,1] as const).map(i=>ARCADE_SABER_OPTIONS.find(o=>o.id===$(`saberKit${i}`).value)??ARCADE_SABER_OPTIONS[0]);
  input.startingSaberWeapon=kits.map(o=>o.weapon);
  input.startingSaberGrip=kits.map(o=>o.grip);
  input.startingDualPhase=([0,1] as const).map(i=>$(`dualPhase${i}`).checked);
  input.saberOnly=$('saberOnly').checked;
  input.novicePractice=$('novicePractice').checked;
  input.squadTactics=$('squadTactics').checked;
  input.laneDrill=$('laneDrill').checked;
  input.opponentReads=$('opponentReads').checked;
  input.forcePools=forcePools;
  input.heroPicks=([0,1] as const).map(i=>({id:$(`heroChoice${i}`).value,slot:$(`heroPos${i}`).value}));
  input.teamForms=([0,1] as const).map(i=>setup.teamForms[i].map((prior,j)=>$(`slotForm${i}-${j}`)?.value??prior));
  setup=normalizeSetup(input);
  if(setup.startingRanks.join()!==old.startingRanks.join())imported=null;
  const needsRoster=setup.playerSlot!==old.playerSlot||setup.participation!==old.participation||(setup.form==='mixed')!==(old.form==='mixed')||setup.teamSizes.join()!==old.teamSizes.join();
  if(needsRoster)rosterFromSetup();
  heroSelects();updateSetupHints();saveSetup(setup);
  const rePreview=(['mapId','mapSize','environment','form','body','participation','playerSlot'] as const).some(k=>old[k]!==setup[k])||
    engineLineups(old).flat().join()!==engineLineups(setup).flat().join()||
    (['startingSaberWeapon','startingSaberGrip','startingDualPhase','chessStyles'] as const).some(k=>old[k].join()!==setup[k].join())||
    old.teamGenders?.join()!==setup.teamGenders?.join()||old.teamAppearances?.join()!==setup.teamAppearances?.join()||
    old.heroPicks.some((p,i)=>p.id!==setup.heroPicks[i].id||p.slot!==setup.heroPicks[i].slot);
  if(rePreview&&view==='menu')setScene('menu');
}
$('watchHero').addEventListener('click',()=>{
  if(!prepareWatchHero())return;
  applyLobby();saveSetup(setup);setScene('menu');
  const name=heroRoster.find(h=>h.id===setup.heroPicks[0].id)?.name??'Saved Hero';
  $('setupStatus').textContent='Playing as '+name;
});
$('lobby').addEventListener('change',()=>readLobby());
for(const button of document.querySelectorAll<HTMLElement>('[data-preset]')){
  button.addEventListener('click',()=>{
    const key=button.dataset.preset;
    const p=field(presets,key);
    if(!p)return;
    if(key==='master')imported=null;
    setup=normalizeSetup({...setup,...p,...(key==='master'?{heroPicks:[]}:{}),playerSlot:0});applyLobby();saveSetup(setup);setScene('menu');
    $('setupStatus').textContent=(button.querySelector('b')?.textContent??button.textContent)+' selected';
  });
}
$('resetSetup').addEventListener('click',()=>{setup=normalizeSetup();imported=null;applyLobby();saveSetup(setup);setScene('menu');$('setupStatus').textContent='Setup reset.';});

buildLobby();
refreshHeroRoster();
const queuedHero=new URLSearchParams(location.search).get('hero');
if(queuedHero&&prepareWatchHero(queuedHero))saveSetup(setup);
window.addEventListener('pageshow',()=>{if(view==='menu')refreshHeroRoster();});
window.addEventListener('storage',()=>{if(view==='menu')refreshHeroRoster();});
applyLobby(); setScene('menu'); requestAnimationFrame(frame);
const seatKind=arenaSeatKind();
if(seatKind){
  document.body.dataset.seatOpening=seatKind;
  void openArenaSeat(seatKind).catch(()=>({ok:false as const,text:'Could not open bout: save unchanged',back:'./index.html'})).then(opened=>{
    delete document.body.dataset.seatOpening;
    if(opened.ok){seed=0;setScene('game',opened.seat.mode,1,{seat:opened.seat});return;}
    if('redirect' in opened&&opened.redirect){location.replace(opened.back);return;}
    $('setupStatus').textContent=opened.text;
    showSeatProblem(opened.text,opened.back);
  });
}

/** A seat link that cannot open (no bout waiting, storage blocked) says so on the v6 screen, with the way back. */
function showSeatProblem(text:string,back:string){
  document.getElementById('seatProblem')?.remove();
  const box=document.createElement('section');box.id='seatProblem';box.className='v6-notice';box.setAttribute('role','alert');
  const msg=document.createElement('p');msg.textContent=text;
  const link=document.createElement('a');link.className='v6-cta';link.href=back;link.textContent='Back';
  const close=document.createElement('button');close.type='button';close.className='v6-notice-close';close.setAttribute('aria-label','Dismiss');close.textContent='✕';
  close.addEventListener('click',()=>box.remove());
  box.append(msg,link,close);
  (document.getElementById('v6Home')??document.getElementById('app'))?.prepend(box);
}

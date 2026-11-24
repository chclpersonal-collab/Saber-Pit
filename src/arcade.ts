import {createAutoDuel} from './arcade-auto-duel.js';
import {ARENA_MOTION_FLOW,PREVIEW_MOTION_FLOW} from './arcade-motion-flow.js?v=5.0.0';
import {MINOR_MOVE_HINTS} from './arcade-minor-moves.js?v=3.1.0';
import {createArcadeSwingWaves} from './arcade-swing-waves.js?v=3.2.0';
import {ARCADE_MOTION_KEY,readArcadeReducedMotion,saveArcadeReducedMotion} from './arcade-motion-preference.js?v=2.43.0';
import {combatMoveLabel} from './arcade-callouts.js?v=3.1.0';
import {createArcadeFloatingText} from './arcade-floating-text.js?v=5.1.0';
import {CIRCUIT_CUT_HINTS} from './arcade-circuit-cuts.js?v=2.33.0';
import {arcadeExpandedMoveById,arcadeExpandedMovesFor} from './arcade-expanded-combat.js?v=3.1.0';
import {ARCADE_ATTACKS,ARCADE_AIR_STRIKES,ARCADE_TRAKATA_ID,ARCADE_FORMS,ARCADE_FORM_IDS,createArcade,stepArcade,arcadeMovesFor} from "./arcade-engine-api.js?v=5.0.0";
import type {ArcadeGame,ArcadeFighter,ArcadeEvent,ArcadeMode,ArcadeOptions,ArcadeInput} from "./arcade-engine-api.js?v=5.0.0";
import {drawArcadeFighter} from './arcade-painter.js?v=5.0.0';
import {sampleArcadeFighter,arcadeBladeWorld,arcadeHeroLabelWorld} from './arcade-fighters.js?v=5.0.0';
import {createArcadeFX} from './arcade-fx.js?v=4.0.0';
import {createArcadeStage,drawArcadeStage,createArcadeTerrain,drawArcadeObstacle,resolveArcadeMap} from './arcade-stage.js?v=4.0.0';
import {FRAME_STEP,advanceSim,displayDelta,displayFighters,fighterSamples,newDisplayClock,resetDisplayClock} from './arcade-display.js?v=2.44.0';
import {ARCADE_CAREER_KEY,classicCareers,readArcadeCareer,saveArcadeCareer,settleArcadeCareer} from './arcade-career.js?v=4.01.1';
import {ARCADE_BODY_REGIONS,arcadeInjuryReport,ARCADE_INJURY_REFERENCE} from './arcade-injuries.js?v=2.9.0';
import {crowdedFighters,sharesSilhouette} from './arcade-layout.js?v=2.9.0';
import {ARCADE_RANK_FOOTWORK,arcadeRankFootworkFor} from './arcade-rank-footwork.js?v=2.27.0';
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=3.1.0';
import {gradeDisplayLabel,SOLDIER_GRADES} from './progression.js?v=1.4.0';
import {ARCADE_MAPS,SIZE,presets,normalizeSetup,setupPlayAs,playAsSetup,watchHeroSetup,lobbyHeroControl,setupMode,engineLineups,engineChessStyleOverrides,loadSetup,saveSetup} from './arcade-setup.js?v=2.38.0';
import {ARCADE_CHESS_STYLES} from './arcade-chess-styles.js?v=2.44.0';
import {ARCADE_GEAR_QUALITIES,ARCADE_FORCE_FAMILIES,ARCADE_SABER_OPTIONS,arcadeFighterGear,arcadeSaberOption} from './arcade-loadouts.js?v=3.1.0';
import {actionFrame,stepActionFrame,screenToArena,composeArcadeFrame} from './arcade-camera.js?v=2.16.0';
import {battleHeroLineup,normalizeHeroLineup} from './arcade-heroes.js?v=2.42.0';
import {fighterGenderLabel} from './arcade-fighter-profiles.js?v=2.18.3';
import {eloFloor} from './arcade-elo.js?v=2.18.5';
import {arenaLobbyRating} from './arcade-arena-rating-ui.js';
import {arenaNormalRanked,arenaNormalRating,arenaNormalCap} from './arcade-normal-elo.js';
import type {ArenaNormalRatings as ArenaRatings} from './arcade-normal-elo.js';
import {loadTournament,tournamentHeroes} from './arcade-tournament.js?v=4.01.1';
import {tournamentHeroLoadout} from './arcade-tournament-sim.js?v=3.0.0';
import {arcadeTapAim,createArcadeTouchOwner} from './arcade-touch.js?v=2.14.0';
import {heroWatchFrame,captureHeroWatch} from './arcade-hero-watch.js?v=2.33.0';
import {arcadeHeroMarkers,drawArcadeHeroMarkers} from './arcade-hero-markers.js?v=2.25.3';
import {arenaNode as $,readTouchPrefs,touchPrefsKey,arenaInputFrame} from './arcade-ui-input.js';
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
type SceneOptions=Pick<ArcadeOptions,'records'|'careers'|'heroLineup'>&{setup?:ReturnType<typeof loadSetup>;arenaRatings?:ArenaRatings};
type AimEvent=Pick<PointerEvent,'clientX'|'clientY'>;
const canvas=$('arena'), ctx=canvas.getContext('2d',{alpha:false})!;
let W=1120,H=640;
let setup=loadSetup(), matchSetup=setup, pendingOrder:ArcadeInput["order"]|null=null,matchHeroes:HeroLineup={},heroRoster:SavedHero[]=[];
const clock=newDisplayClock(), sim={remainder:0,previous:null as ReturnType<typeof fighterSamples>|null};
const clamp=(v:number,l:number,h:number)=>Math.min(h,Math.max(l,v));
const chessReadout=(f:ArcadeFighter|undefined)=>f?.chessPawn?.promoted?'Pawn → Queen':f?.chessStyle&&f.chessStyle!=='none'?ARCADE_CHESS_STYLES[f.chessStyle]?.label??'':'';

const mobileUI=matchMedia('(max-width:740px), (pointer:coarse) and (max-width:1100px), (orientation:landscape) and (max-height:520px) and (max-width:1100px)');
const touchPrefs=readTouchPrefs(), stick=createArcadeTouchOwner(), stickButton=$('touchStick');
const lore={
  shii_cho:{name:'Shii-Cho',roman:'I',read:'Wide, flowing cuts and broad footwork. Useful against multiple rivals.',signature:'Wide sweep'},
  makashi:{name:'Makashi',roman:'II',read:'One-handed precision and direct footwork. Built for saber duels.',signature:'Linear thrust'},
  soresu:{name:'Soresu',roman:'III',read:'Close guard and compact deflections. Let the rival commit first.',signature:'Guard riposte'},
  ataru:{name:'Ataru',roman:'IV',read:'Acrobatic bursts and fast entries. The attack comes from above.',signature:'Acrobatic vault'},
  djem_so:{name:'Djem So',roman:'V',read:'Powerful two-handed cuts. Turn a block or parry into a counter.',signature:'Power counter'},
  niman:{name:'Niman',roman:'VI',read:'Balanced blade work with space for a Force-assisted attack.',signature:'Force-assisted strike'},
  juyo:{name:'Juyo',roman:'VII',read:'Aggressive, irregular chains. Pressure the rival before they can reset.',signature:'Ferocity chain'}
};
const ratingText=(value:number)=>value.toLocaleString('en-US');
const formName=(id:string)=>field(lore,id)?.name||field(ARCADE_FORMS,id)?.name||'Saber';
const titleCase=(value:string)=>value[0].toUpperCase()+value.slice(1);
const autoDuel=createAutoDuel();
let autoSaveBaseline:string|null|undefined;
let autoCareerMode:ArenaMode|undefined;
function rawArenaSave(){try{return localStorage.getItem(ARCADE_CAREER_KEY);}catch{return undefined;}}
const fx=createArcadeFX({contactLabels:false}), swingWaves=createArcadeSwingWaves();
let roundRatings:ArenaRatings={}, roundRated=false, ratingReport:NonNullable<ReturnType<typeof settleArcadeCareer>>['report']=[];
let view:Scene='menu', mode:ArenaMode='duel', paused=false, game:ArcadeGame, stage:ReturnType<typeof createArcadeStage>, round=1, seed=0, seedCounter=0;
let heroWatchEvents:ReturnType<typeof captureHeroWatch>={},heroWatchFocus=false,watchedHeroIdentity='',heroWatchKey='';
let moveSeen:Record<string,number>={}, echoes=new Map<string,{pose:ArcadeFighter;time:number;at:number}[]>(), watchedPhases:Record<string,boolean>={}, maxHeight=0;
let career:Career|null=null, imported:ReturnType<typeof classicCareers>|null=null, savedCareer=readCareerForUI();
let crowdedLOD=false;
let displayTime=0, hudAt=-1, endDelay=0, lastEvent=0, hitDelay=0;
let audio:AudioContext|undefined, sound=false, reduced=readArcadeReducedMotion(), touchWalk=false, followAction=true;
let lastAudioAt=-1,audioEventsAtTime=0;
let transform:Omit<ReturnType<typeof composeArcadeFrame>,"scaleY">&{scaleY?:number}={scale:1,x:0,y:0},canvasPixelScale=1;
let focus={x:W/2,y:H/2,zoom:1}, aim:Point|null=null,touchAim:TouchAim|null=null,touchDown:(Point&{id:number})|null=null;
const keys=new Set<string>(), pointers=new Map<number,string>(), pulse=new Set<string>();
const keyMap:Record<string,string>={q:'jump',x:'feint',v:'phase',r:'technique',c:'walk',f:'force',j:'strike',k:'heavy',shift:'dash',' ':'guard',w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
const punishLabels:Record<string,string>={whiff:'missed swing',parried:'parried strike',guard_break:'broken guard'};
const callouts=createArcadeFloatingText();
const announce=(text:string)=>{$('announce').textContent=text;};
function resize(){
  const {width,height}=canvas.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,2,Math.sqrt((crowdedLOD?530000:2300000)/Math.max(1,width*height)));
  canvas.width=Math.max(1,Math.floor(width*dpr));canvas.height=Math.max(1,Math.floor(height*dpr));
  canvasPixelScale=width>0?canvas.width/width:1;
}
new ResizeObserver(resize).observe(canvas);resize();
function syncCamera(){
  const button=$('cameraView'), action=followAction&&!reduced&&!button.disabled;
  button.textContent='Camera: '+(action?'Action':'Wide');
  button.setAttribute('aria-pressed',String(action));
  button.title=reduced?'Reduced motion uses the wide frame':button.disabled?'The full arena stays visible in this match':'Follow nearby fighters, or switch to a fixed wide view';
}
function setReduced(value:boolean){
  reduced=value;document.body.dataset.reduced=String(value);$('motion').setAttribute('aria-pressed',String(value));syncCamera();
  if(game){updateHeroWatch();draw(0);}
}
$('cameraView').addEventListener('click',()=>{if(reduced||$('cameraView').disabled)return;followAction=!followAction;syncCamera();draw(0);if(!paused)canvas.focus({preventScroll:true});});
setReduced(reduced);
window.addEventListener('storage',event=>{
  if(event.key===ARCADE_MOTION_KEY||event.key===null)setReduced(readArcadeReducedMotion());
});
$('motion').addEventListener('click',()=>{
  const next=!reduced;saveArcadeReducedMotion(next);setReduced(next);
});
$('sound').addEventListener('click',async()=>{
  if(sound){sound=false;}else {
    try { const Engine=window.AudioContext||(window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Engine)return;audio ||= new Engine();await audio.resume();sound=audio.state==='running'; }
    catch {sound=false;}
  }
  $('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));
});
function soundEvent(kind:string){
  if(!sound||!audio||!['hit','parry','ko','dash','sweep','rush','break','launch','clash'].includes(kind))return;
  const cues:Record<string,readonly [number,number,number,number,OscillatorType][]>={
    hit:[[146,59,.095,.078,'triangle'],[350,125,.024,.029,'triangle']],
    parry:[[1170,430,.096,.027,'triangle'],[1730,940,.070,.014,'sine']],
    clash:[[795,300,.115,.036,'triangle'],[1320,725,.079,.018,'triangle']],
    ko:[[110,47,.17,.12,'triangle'],[216,64,.045,.037,'triangle']],
    dash:[[102,47,.071,.029,'sine']],
    sweep:[[192,67,.10,.034,'triangle']],
    rush:[[182,68,.107,.043,'triangle']],
    break:[[184,54,.164,.072,'triangle'],[970,370,.062,.022,'triangle']],
    launch:[[107,177,.144,.052,'sine']]
  };
  const t=audio.currentTime;
  // Bound synthesizer voices when many fighters land hits in the same frame.
  if(lastAudioAt===t){if(audioEventsAtTime>=3)return;audioEventsAtTime++;}
  else {lastAudioAt=t;audioEventsAtTime=1;}
  for(const [start,end,len,amp,shape] of cues[kind]){
    const o=audio.createOscillator(),g=audio.createGain();
    o.type=shape;o.frequency.setValueAtTime(start,t);
    o.frequency.exponentialRampToValueAtTime(end,t+len*.77);
    g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(amp,t+.006);
    g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(audio.destination);
    o.start(t);o.stop(t+len+.015);
  }
}
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
  touchDown=null;keys.clear();pointers.clear();pulse.clear();aim=null;cancelStick();
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
  const p=currentTouchAim()??(aim&&screenToArena(aim.x,aim.y,{left:0,top:0,width:1,height:1},canvas.width,canvas.height,transform));
  const data=arenaInputFrame({held:active,pulse,fromStick:stick.snapshot(),aim:p,touchWalk,
    technique:()=>$('chosenTechnique').value},pendingOrder);
  pulse.clear();pendingOrder=null;return data;
}
function setScene(nextView:Scene,nextMode:ArenaMode='duel',nextRound=1,options:SceneOptions={}){
  if(nextView==='menu'){autoDuel.stop();autoSaveBaseline=undefined;autoCareerMode=undefined;}
  else autoDuel.clearRound();
  career=null;roundRatings=options.arenaRatings??{};roundRated=false;ratingReport=[];crowdedLOD=false;pendingOrder=null;touchWalk=false;$('walkTouch').setAttribute('aria-pressed','false');
  view=nextView; mode=nextMode; round=nextRound; paused=false; endDelay=0;lastEvent=0;moveSeen={};watchedPhases={};maxHeight=0;echoes.clear();displayTime=0;sim.remainder=0;sim.previous=null;hudAt=-1;hitDelay=0;callouts.reset();
  clearInput();fx.reset();swingWaves.reset();
  const config=nextView==='menu'?setup:normalizeSetup(options.setup??matchSetup);
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
  [W,H]=SIZE[config.mapSize as keyof typeof SIZE];
  const terrain=createArcadeTerrain(config.mapId,W,H,round);
  const isMenu=view==='menu';
  const lineups=engineLineups(config);
  const sideSizes=isMenu?[1,1]:config.teamSizes;
  const sideHeroes=isMenu?previewHeroes(useHeroes):useHeroes;
  const useArenaElo=!isMenu&&arenaLobbyRating(mode,config.rule,sideSizes,sideHeroes).rated;
  const fighterRatings=useArenaElo?sideSizes.map((size,team)=>Array.from({length:size},(_,slot)=>
    arenaNormalRating(roundRatings[team+'-'+slot]))):undefined;
  const fighterChessStyles=engineChessStyleOverrides({...config,teamSizes:sideSizes},sideHeroes);
  const demoBlue=config.participation==='play'?config.playerSlot:0;
  game=createArcade({...config,mode:isMenu?'watch':mode,seed:isMenu?451:seed,width:W,height:H,
    round,terrain,limit:config.duration,motionFlow:isMenu?PREVIEW_MOTION_FLOW:ARENA_MOTION_FLOW,perfectParryStamina:!isMenu,continuousCombat:!isMenu,anticipatingCombat:!isMenu,arenaCuts:!isMenu,activeFootwork:!isMenu,styleTravel:!isMenu,repertoireSupport:!isMenu,exchangeVariety:!isMenu,fluidFootwork:!isMenu,eloReads:!isMenu,impactPhysics:!isMenu,balancePass:!isMenu,closeChoice:!isMenu,guardCounterplay:!isMenu,minorMoves:!isMenu,forceVariants:!isMenu,weaponFlow:true,expandedCombat:!isMenu,circuitCuts:!isMenu,ratingSkill:!isMenu,arenaRatingSkill:useArenaElo,fighterRatings,customHeroTactics:!isMenu,advancedArena:!isMenu,teamForms:isMenu?[[lineups[0][demoBlue]],[lineups[1][0]]]:lineups,careers,records,
    teamSizes:sideSizes,environment:config.environment,heroLineup:sideHeroes,fighterChessStyles:fighterChessStyles as ArcadeOptions["fighterChessStyles"]});
  roundRated=!isMenu&&arenaNormalRanked(game);
  stage=createArcadeStage(W,H,round,{mapId:config.mapId,terrain:game.terrain,environment:config.environment});
  const shownMap=resolveArcadeMap(config.mapId,round);
  $('mapCaptionName').textContent=field(ARCADE_MAPS,shownMap)?.[0]??'Arena';
  $('mapCaptionDesc').textContent=field(ARCADE_MAPS,config.mapId)?.[1]??field(ARCADE_MAPS,shownMap)?.[1]??'';
  $('mapCaption').hidden=!isMenu;
  $('objectiveHUD').hidden=isMenu||!game.objective||game.objective.rule==='elimination';
  $('commandBar').hidden=isMenu||mode!=='command';
  prepareHeroWatch(isMenu||mode!=='watch',nextRound===1);
  for(const b of document.querySelectorAll<HTMLElement>('[data-order]'))b.setAttribute('aria-pressed',String(b.dataset.order===(game.order??'push')));
  $('forceAction').hidden=config.saberOnly;
  $('continueRun').hidden=!savedCareer;
  $('autoDuelSaved').hidden=!savedCareer||!canAutoSaved(savedCareer);
  $('again').hidden=false;
  focus={x:W/2,y:H/2,zoom:1};
  canvas.tabIndex=isMenu?-1:0;
  $('cameraView').hidden=isMenu;
  $('cameraView').disabled=isMenu||config.rule!=='elimination'||game.fighters.length>6;
  syncCamera();
  document.body.dataset.view=view;
  document.body.dataset.watch=String(view==='game'&&mode==='watch');
  document.body.dataset.command=String(view==='game'&&mode==='command');
  document.body.dataset.largeBattle=String(view==='game'&&game.fighters.length>=12);
  resize();
  $('entry').hidden=view!=='menu';$('hud').hidden=view!=='game';$('floorUI').hidden=view!=='game';$('pause').hidden=view!=='game';$('statsButton').hidden=view!=='game';
  for(const id of ['touchLayout','touchSide','resetAim'] as const)$(id).hidden=isMenu||mode==='watch'||mode==='command';
  syncFullscreen();
  $('pauseOverlay').hidden=true;$('result').hidden=true;$('pause').textContent='Pause';syncAutoDuel();
  for(const b of document.querySelectorAll<HTMLElement>('#help [data-home]'))b.hidden=view==='menu';
  syncHelp();
  setupTechnique(game.fighters.find(f=>f.control),config.saberOnly&&!isMenu);
  $('modeLabel').textContent=autoDuel.active?'Auto battle':mode==='watch'?'Showdown':titleCase(mode);
  const primary=game.fighters.find(f=>f.control)||game.fighters.find(f=>f.team===0), rival=game.fighters.find(f=>f.team===1);
  const deployedHeroes=view==='game'?game.fighters.filter(f=>f.heroId).map(f=>`${f.team?'Pink':'Blue'} Hero: ${f.displayName}`):[];
  canvas.setAttribute('aria-label',['Saber Pit arena',...deployedHeroes].join('. '));
  $('profileText').textContent=(isMenu?'':roundRated?'Rated · ':'Unrated · ')+(mode==='watch'?(deployedHeroes.length?'AI fights for both sides':'Both sides use AI'):arcadeSaberOption(primary!.gear).label);
  $('forceHint').textContent=ARCADE_FORCE_FAMILIES.find(x=>x.id===config.startingForceFamily?.[0])?.label??'Force';
  $('airControlHint').textContent=FORM_AIR_NAMES[primary!.form]??'Form footwork';
  $('signatureHint').textContent=lore[primary!.form]?.signature||'Heavy attack';
  $('blueName').textContent=primary!.displayName??(mode==='duel'?formName(primary!.form):mode==='watch'?'Blue side':'Your side');
  $('rivalName').textContent=rival!.displayName??(mode==='duel'?formName(rival!.form):'Rival side');
  updateHUD();
  if(view==='game'){window.scrollTo({top:0});canvas.focus({preventScroll:true});announce(mode==='watch'?'Showdown started. Both teams use AI.':titleCase(mode)+' started. Round '+round+'.');}
}

const FORM_AIR_NAMES={
  shii_cho:'Wheel hop',
  makashi:'Line vault',
  soresu:'Guard tuck',
  ataru:'Corkscrew / crossflip',
  djem_so:'Hammer bound',
  niman:'Drift turn',
  juyo:'Scissor pounce',
};
function syncHelp(){
  $('helpText').textContent=mode==='watch'?'Open Stats to inspect any fighter.':mode==='command'?'Choose an order for Blue. The team fights automatically.':
    mobileUI.matches?'Jump, then tap Slash in the air. Move while jumping for directional footwork.':'Q to jump · J in the air to strike · Space to parry';
}
mobileUI.addEventListener('change',syncHelp);

const tacticalHint={slip_counter:'Step off their line and answer. Strongest after a parry.',feint_redirect:'Fake one line, then commit on another.',moving_guard:'Move while covering an incoming blade.'};
const footworkHelp={
  check:'Short retreat to reset distance.',side:'Step outside the incoming line.',slip:'Slip diagonally off the attack line.',
  arc:'Curve around the attack line.',switch:'Change lanes in two steps.',wheel:'Wheel around the opponent’s lead.',
  return:'Draw back, then curve into a new angle.'
};
const footworkByTechnique=Object.fromEntries(ARCADE_RANK_FOOTWORK.map(m=>['footwork:'+m.id,m]));
const heroTechnique={id:ARCADE_TRAKATA_ID,name:"Tràkata"};
const techniqueHint={counter:'Best after a parry or block.',crowd:'Broad attack for multiple opponents.',force:'Uses Force.',acrobatics:'Uses aerial movement.',defense:'Uses defensive footwork.'};
function setupTechnique(f:ArcadeFighter|undefined,saberOnly:boolean){
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
  const groups=([['Form techniques',core],['Tactical techniques',tactical],['Ranked cuts',cuts],['Circuit cuts',circuit],['Arena cuts',newCuts],['New form moves',minorCuts],['Footwork',steps],['Force powers',expanded.filter(m=>m.kind==='force')],['Free hand',expanded.filter(m=>m.kind==='free_hand')],['Hero technique',list.filter(m=>m.id===ARCADE_TRAKATA_ID)]] satisfies [string,readonly TechniqueRow[]][]).filter(([,items])=>items.length).map(([label,items])=>{
    const group=document.createElement('optgroup');group.label=label;
    group.append(...items.map(m=>new Option(m.name,m.id)));return group;
  });
  select.replaceChildren(...groups);
  select.value=list.some(m=>m.id===previous)?previous:(core.at(-1)??list[0]).id;
  setTechniqueHint();
}
function setTechniqueHint(){
  if($('chosenTechnique').value===ARCADE_TRAKATA_ID){
    $('quickTechnique').title=heroTechnique.name;
    $('techniqueHelp').textContent='Douse the saber, then reignite into a strike. No guard while dark.';
    return;
  }
  const selected=$('chosenTechnique').value, step=footworkByTechnique[selected];
  if(step){
    $('quickTechnique').title=step.label;
    $('techniqueHelp').textContent=field(footworkHelp,step.path)+' Costs '+step.cost+' stamina.';
    return;
  }
  const expanded=arcadeExpandedMoveById(selected,{forceVariants:game.config.forceVariants===true});
  if(expanded){$('quickTechnique').title=expanded.label;$('techniqueHelp').textContent=expanded.description+' Costs '+expanded.cost+' stamina.';return;}
  const m=ARCADE_TECHNIQUES[selected];
  $('quickTechnique').title=m?.name??'Selected technique';
  $('techniqueHelp').textContent=field(MINOR_MOVE_HINTS,selected)??field(CIRCUIT_CUT_HINTS,selected)??(m?.air?'Aerial technique.':field(tacticalHint,m?.tactical)??field(techniqueHint,m?.role)??'');
}
$('chosenTechnique').addEventListener('change',()=>{setTechniqueHint();canvas.focus({preventScroll:true});});

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
  announce('Auto battle stopped.');
}
for(const id of ['stopAutoDuel','stopAutoDuelResult'] as const)$(id).addEventListener('click',stopAutoDuel);
function launch(automatic=false){
  if(automatic){autoDuel.start();autoSaveBaseline=rawArenaSave();autoCareerMode=setupMode(setup);}
  else {autoDuel.stop();autoSaveBaseline=undefined;autoCareerMode=undefined;}
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
function goHome(){setScene('menu');$('startMatch').focus({preventScroll:true});window.scrollTo({top:0});}
for(const b of document.querySelectorAll<HTMLElement>('[data-home]'))b.addEventListener('click',goHome);
function nextCareerRound(){
  if(!career||$('again').hidden)return;
  seed=career.seed;setScene('game',mode,career.round,{careers:career.careers,records:career.records,setup:career.setup,heroLineup:career.heroLineup,arenaRatings:career.arenaRatings});
}
$('again').addEventListener('click',nextCareerRound);
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
  paused=value;clearInput();sim.remainder=0;sim.previous=null;$('pauseOverlay').hidden=!paused;
  $('pause').textContent=paused?'Resume':'Pause';
  if(focus){if(paused)$('resume').focus({preventScroll:true});else canvas.focus({preventScroll:true});}
}
$('pause').addEventListener('click',()=>pause(!paused));$('resume').addEventListener('click',()=>pause(false));
window.addEventListener('keydown',e=>{
  if(view!=='game'||$('statsDialog').open||['BUTTON','SELECT','INPUT','A'].includes((e.target as HTMLElement).tagName)&&!paused)return;
  const key=e.key.toLowerCase();
  if(key==='escape'||key==='p'){if(!e.repeat){e.preventDefault();pause(!paused);}return;}
  const action=keyMap[key];if(!action||paused||mode==='watch'||mode==='command'||game.phase!=='playing')return;
  e.preventDefault();if(e.repeat)return;keys.add(action);if(['strike','heavy','dash','guard','force','technique','phase','feint','jump'].includes(action))pulse.add(action);
});
window.addEventListener('keyup',e=>{const a=keyMap[e.key.toLowerCase()];if(a)keys.delete(a);});
window.addEventListener('blur',()=>clearInput(false));
window.addEventListener('orientationchange',()=>clearInput(false));
document.addEventListener('visibilitychange',()=>{
  resetDisplayClock(clock);sim.remainder=0;sim.previous=null;clearInput(false);$('frameRate').textContent='FPS';
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
  button.textContent=fullscreen?'Exit full screen':'Full screen';
  button.setAttribute('aria-pressed',String(fullscreen));
}
document.addEventListener('fullscreenchange',()=>{clearInput(false);syncFullscreen();});
$('gameFullscreen').addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await $('app').requestFullscreen();
  }catch{
    const button=$('gameFullscreen');
    button.textContent='Full screen unavailable';announce('Full screen is not available in this browser.');
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
  const text=game.phase==='draw'?'Draw':mode==='watch'?(game.phase==='won'?'Blue wins':'Pink wins'):game.phase==='won'?'Round won':'Round lost';
  $('resultRound').textContent='ROUND '+round+' COMPLETE';$('resultTitle').textContent=text;
  const obj=game.objective;
  const timedOut=game.endReason==='timeout'||game.time+1e-8>=game.limit;
  const decidedByObjective=game.endReason==='control'||game.endReason==='relic'||(timedOut&&obj?.target&&Math.abs(obj.score[0]-obj.score[1])>=.001);
  const survivors=[0,1].map(team=>game.fighters.filter(f=>f.team===team&&f.alive).length);
  $('resultText').textContent=game.phase==='draw'?(timedOut?'Time limit · Both sides finished even.':'Both sides finished even.')
    :decidedByObjective?(timedOut?'Time limit · ':'')+(obj.rule==='control'?'Decided by signal points.':'Decided by relic deliveries.')
    :timedOut?'Time limit · '+(survivors[0]!==survivors[1]?'Decided by survivors.':'Decided by regional injuries.')
    :mode==='watch'?'One side knocked out the other.':game.phase==='won'?'All rivals knocked out.':'Your side was knocked out.';
  const lastPunish=game.events.findLast(e=>e.punish&&(e.damage as number)>0);
  const relevant=lastPunish&&game.phase!=='draw'&&lastPunish.team===(game.phase==='won'?0:1)&&game.time-lastPunish.time<=3;
  $('turningPoint').hidden=!relevant;
  if(relevant){
    const reason=field(punishLabels,lastPunish.punishReason);
    $('turningPoint').textContent=(lastPunish.team?'Pink':'Blue')+' punished '+(reason?'a '+reason:'an opening')+(lastPunish.region?' with a hit to '+regionName(lastPunish.region).toLowerCase():'')+' late in the round.';
  }
  const settled=settleArcadeCareer(game,roundRatings)!, selected=settled.report.find(r=>r.id===game.fighters.find(f=>f.control)?.id)??settled.report[0];
  ratingReport=settled.report;
  career={arenaRatings:settled.arenaRatings,mode:autoCareerMode??mode,round:round+1,seed:(seed+Math.imul(++seedCounter,2654435761))>>>0,careers:settled.careers,records:game.records,form:matchSetup.form,body:matchSetup.body,setup:matchSetup,heroLineup:matchHeroes};
  const conflict=autoSaveBaseline!==undefined&&rawArenaSave()!==autoSaveBaseline;
  const persisted=!conflict&&saveArcadeCareer(career);
  if(persisted){
    savedCareer=career;
    if(autoSaveBaseline!==undefined)autoSaveBaseline=rawArenaSave();
  }else if(conflict)savedCareer=readCareerForUI();
  const promoted=settled.report.filter(f=>f.promoted);
  const promotions=promoted.length>1?' · '+promoted.length+' promotions':selected.promoted?' · Promoted':'';
  $('rankResult').textContent=(mode==='watch'?'Blue lead: ':'')+gradeDisplayLabel(selected.after.grade)+' · +'+selected.reward+' training pts'+promotions+(persisted?'':conflict?' · Save changed in another tab. Return to Setup to continue that save.':' · Save unavailable');
  $('rankResult').textContent+=(settled.rated?' · '+arenaRatingDetail(selected.id,selected.after.gradeIndex):' · Unrated');
  $('again').textContent='Next round';
  updateHUD();
  $('result').hidden=false;$('pause').hidden=true;$('again').hidden=conflict;clearInput();
  $(conflict?'resultStats':'again').focus({preventScroll:true});
  autoDuel.completeRound(persisted&&career.round<=100000);syncAutoDuel();
  announce(autoDuel.active?text+'. Next round in 3 seconds.':text);
}
const regionName=(id:string)=>ARCADE_BODY_REGIONS.find(x=>x.id===id)?.label??'Body';
const shortRegion={head:'Head',torso:'Torso',leftArm:'L arm',rightArm:'R arm',leftLeg:'L leg',rightLeg:'R leg'};
const compactRegion={head:'H',torso:'T',leftArm:'LA',rightArm:'RA',leftLeg:'LL',rightLeg:'RL'};
const severityLevel=(label:unknown)=>{
  const text=String(label??'').toLowerCase();
  return /fatal/.test(text)?'fatal':/severe|critical|disabled|incapacitat|impaired/.test(text)?'severe':/hurt|injur|wound|light|moderate|strained/.test(text)?'hurt':'clear';
};
function renderRibbon(id:"blueInjuries"|"redInjuries",f:ArcadeFighter){
  const parent=$(id);
  const opts={attackerRank:f.career?.gradeIndex??0,defenderRank:f.career?.gradeIndex??0};
  const front=arcadeInjuryReport(f.injuries,{...opts,direction:'front'});
  const rear=arcadeInjuryReport(f.injuries,{...opts,direction:'rear'});
  const priority={clear:0,hurt:1,severe:2,fatal:3};
  const rows=front.map((part,i)=>{
    const a=severityLevel(part.severityLabel),b=severityLevel(rear[i]?.severityLabel);
    return {part,level:f.fatalRegion===part.id?'fatal':priority[a]>=priority[b]?a:b,rear:rear[i]};
  });
  const key=f.id+'|'+rows.map(({part,rear,level})=>[part.severityLabel,rear?.severityLabel,level].join('/')).join('|');
  if(parent.dataset.key===key)return;
  parent.dataset.key=key;
  parent.setAttribute('aria-label',(f.team?'Pink ':'Blue ')+(f.slot+1)+' regional injuries');
  parent.replaceChildren(...rows.map(({part,rear,level})=>{
    const el=reportCell('span',shortRegion[part.id]??part.label);
    el.dataset.level=level;el.dataset.compact=compactRegion[part.id]??'·';el.title=part.label+': '+(level==='fatal'?'Fatal · ':'')+part.severityLabel+' front, '+(rear?.severityLabel??'clear')+' rear';
    el.setAttribute('aria-label',el.title);return el;
  }));
}
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
  $('heroWatchPlan').textContent=hero.alive?'AI · '+titleCase(hero.heroPlan??hero.heroDoctrine??'balanced')+' plan'+(style?' · '+style:'')+(habit?' · '+habit:''):'Knocked out';
  $('heroWatchMove').textContent=events?.last??'No major moves yet';
  $('heroWatchTrakata').textContent='Tràkata: '+(hero.moves?.trakata??0)+' attempts · '+(events?.relights??0)+' relights';
  const toggle=$('heroWatchFocus');
  const follow=hero.alive&&heroWatchFocus&&!reduced;
  toggle.disabled=!hero.alive||reduced;
  toggle.textContent=follow?'Stop following':'Follow Hero';
  toggle.setAttribute('aria-pressed',String(follow));
  toggle.title=reduced?'Reduced motion keeps a fixed camera':'Keep this Hero and nearby rivals in frame';
}
watchChoice.addEventListener('change',()=>{watchedHeroIdentity=activeWatchHero()?.heroId??'';updateHeroWatch();});
$('heroWatchFocus').addEventListener('click',()=>{heroWatchFocus=!heroWatchFocus;updateHeroWatch();});
$('heroWatchStats').addEventListener('click',()=>{
  const hero=activeWatchHero();if(!hero)return;
  openStats();$('moveFighter').value=hero.id;showMoveStats();
});
function arenaRatingDetail(id:string, gradeIndex:number, compact=false){
  if(!roundRated)return 'Unrated';
  const result=ratingReport.find(r=>r.id===id);
  const rating=result?.ratingAfter??arenaNormalRating(roundRatings[id]);
  const cap=result?.ratingCap===null?null:result?.ratingCap??arenaNormalCap(gradeIndex);
  const head=ratingText(rating)+' Elo';
  if(compact)return head;
  const delta=result?.ratingDelta;
  return head+(typeof delta==='number'?' ('+(delta>0?'+':'')+delta+')':'')+
    (cap===null?' · no rank cap':rating>=cap?' · '+ratingText(cap)+' cap · rank up':' · rank cap '+ratingText(cap));
}
function updateHUD(){
  updateHeroWatch();
  for(const [team,side] of [[0,'blue'],[1,'red']] as const){
    const roster=game.fighters.filter(f=>f.team===team);
    const lead=roster.find(f=>f.control)??roster.find(f=>f.alive)??roster[0];
    const final=career?.careers?.[lead?.id as `${number}-${number}`];
    const rank=gradeDisplayLabel(final?SOLDIER_GRADES.findLast(g=>g.threshold<=(final as {merit:number}).merit)?.label??'F':lead?.career?.grade??'F');
    $(`${side}Rank`).textContent=rank+(lead&&roundRated?' · '+arenaRatingDetail(lead.id,lead.career.gradeIndex,true):'');
    $(`${side}Rank`).title=lead?arenaRatingDetail(lead.id,lead.career.gradeIndex):'Displayed fighter rank';
    $(`${side}Count`).textContent=roster.filter(f=>f.alive).length+'/'+roster.length;
    if(lead)renderRibbon(`${side}Injuries`,lead);
  }
  const player=game.fighters.find(f=>f.control);$('quickTechnique').disabled=$('useTechnique').disabled=player?.alive===false;$('energy').hidden=!player;$('energy').value=clamp((player?.energy??0)/100,0,1);
  const low=Boolean(player?.alive&&player.energy<=30);
  const guardHint=low?'Low stamina · weak guard':'Aim · tap to parry';
  if($('guardHint').textContent!==guardHint){
    $('guardHint').textContent=guardHint;
    $('energy').setAttribute('aria-label',low?'Stamina. Low stamina weakens held guard.':'Stamina');
  }
  const phaseButton=$('phaseAction'), extended=player?.saberPhase==='long';
  $('feintAction').disabled=!player?.alive;
  phaseButton.hidden=!player?.gear.dualPhase;
  phaseButton.disabled=!player?.alive;
  if(!phaseButton.hidden&&phaseButton.getAttribute('aria-pressed')!==String(extended)){
    phaseButton.setAttribute('aria-pressed',String(extended));
    phaseButton.setAttribute('aria-label',extended?'Retract blade':'Extend blade');
    $('phaseLabel').textContent=extended?'Retract':'Extend';
    $('phaseHint').textContent=extended?'Extended reach':'Short reach';
  }
  const obj=game.objective;
  if(!$('objectiveHUD').hidden&&obj){
    $('objectiveBlue').textContent=Math.floor(obj.score[0]+1e-8) as unknown as string;
    $('objectivePink').textContent=Math.floor(obj.score[1]+1e-8) as unknown as string;
    $('objectiveLabel').textContent=obj.rule==='control'?(obj.contested?'Contested':'Signal · '+obj.target)
      :obj.relic?.carrierId?(obj.relic.carrierTeam?'Pink carries':'Blue carries'):'Relic · '+obj.target;
  }
  const remaining=Math.max(0,Math.ceil(game.limit-game.time));
  $('clock').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  $('round').textContent='Round '+round;
}
function events(dt:number){
  fx.observe(game.events);fx.update(dt,reduced||crowdedLOD);
  if(view==='game')callouts.update(dt,game.events,game.fighters,{focusId:activeWatchHero()?.id});
  if(!$('heroWatch').hidden&&game.eventId>lastEvent){const fresh=game.events.filter(e=>e.id>lastEvent);heroWatchEvents=captureHeroWatch(fresh,game.fighters,heroWatchEvents);}
  for(const e of game.events){
    if(e.id<=lastEvent)continue;lastEvent=e.id;
    if(view==='menu')continue;
    if(debug)moveSeen[e.kind]=(moveSeen[e.kind]||0)+1;
    soundEvent(e.kind);
    // No constant whole-screen freezes in squad fights. Save one small beat for
    // big moments in a duel; the slash's own follow-through carries impact.
    if(!reduced&&mode==='duel'&&['ko','break','launch'].includes(e.kind))
      hitDelay=Math.max(hitDelay,e.kind==='ko'?.034:.012);

  }
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
  const enabled=view==='game'&&!reduced&&(watched.length>0||followAction&&!$('cameraView').disabled);
  const shot=actionFrame({width:W,height:H,fighters:watched.length?watched:alive,enabled});
  const profile=enabled&&view!=='menu',shake=reduced?null:fx.shake();
  // Keep a little more of the cutaway set behind the fight, without
  // giving up vertical room for the feet or jumping blade.
  const frame=profile&&shot.zoom>1?{...shot,y:shot.y-30}:shot;
  focus=stepActionFrame(focus,frame,W,H,dt,!enabled);
  transform=composeArcadeFrame(cw,ch,W,H,focus,{profile,shake:shake as Point|undefined});
  const {scale,scaleY}=transform;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#181613';ctx.fillRect(0,0,cw,ch);
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
  const fps=clock.fps?clock.fps+' FPS':'FPS';
  // On heavy battles shed decorative effects rather than frames. Fighter
  // silhouettes, timing, collision and the HUD do not change.
  if(view==='game'&&!crowdedLOD&&game.fighters.length>=12&&displayTime>1.6&&clock.fps>0&&clock.fps<38){
    crowdedLOD=true;resize();
  }
  const simVisible=!paused&&!$('statsDialog').open&&!$('rankDialog').open&&!$('guide').open;
  if(simVisible&&$('frameRate').textContent!==fps)$('frameRate').textContent=fps;
  if(!document.hidden){
    if(simVisible){
      displayTime+=dt;
      hitDelay=Math.max(0,hitDelay-dt);
      if(view==='game'&&game.phase==='playing'){
        advanceSim(sim,dt*(mode==='watch'||mode==='command'?matchSetup.pace:1),{blocked:hitDelay>0,playing:()=>game.phase==='playing',step:()=>{
          sim.previous=fighterSamples(game.fighters);
          if(view==='game')stepArcade(game,FRAME_STEP,inputs() as ArcadeInput);
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
for(const id of ARCADE_FORM_IDS){
  const form=field(lore,id);if(!form)continue;
  const option=document.createElement('option');option.value=id;option.textContent=form.roman+' · '+form.name;$('style').append(option);
  const card=document.createElement('section'),title=document.createElement('h3'),desc=document.createElement('p');
  title.textContent=option.textContent;desc.textContent=form.read;card.append(title,desc);$('guideForms').append(card);
}
$('style').value='makashi';

function openRanks(){
  $('resumeCareer').disabled=!savedCareer;
  $('careerStatus').textContent=imported?'Classic ranks selected for new runs. The original save is unchanged.':savedCareer?'Saved run: '+titleCase(savedCareer.mode)+', round '+savedCareer.round+'.':'Completed rounds save on this device. Existing Classic saves stay separate.';
  $('rankDialog').showModal();
}
$('rankSetup').addEventListener('click',openRanks);
$('useClassic').addEventListener('click',async()=>{
  const button=$('useClassic');button.disabled=true;
  try{
    const {loadCampaign}=await import('./persistence.js?v=1.5.0');
    const result=loadCampaign();
    if(!result.game){$('careerStatus').textContent=result.error;return;}
    imported=classicCareers(result.game);
    $('careerStatus').textContent='Classic ranks copied for matching slots in new runs. Your Classic save is unchanged.';
  }catch{$('careerStatus').textContent='Could not read the Classic save.';}
  finally{button.disabled=false;}
});
const savedSetup=(next:Career)=>normalizeSetup(next.setup??{...field(presets,next.mode),teamSizes:next.mode==='duel'?[1,1]:[3,3],duration:75,form:next.form,body:next.body});
function canAutoSaved(next:Career){
  const options=savedSetup(next);
  const heroes=next.heroLineup?normalizeHeroLineup(next.heroLineup):battleHeroLineup(options.heroPicks,heroRoster,tournamentHeroLoadout);
  return arenaLobbyRating(next.mode,options.rule,options.teamSizes,heroes).rated;
}
function resumeRun(automatic=false){
  if(!savedCareer||automatic&&!canAutoSaved(savedCareer))return;
  if($('rankDialog').open)$('rankDialog').close();
  if(automatic){autoDuel.start();autoSaveBaseline=rawArenaSave();autoCareerMode=savedCareer.mode;}
  else {autoDuel.stop();autoSaveBaseline=undefined;autoCareerMode=undefined;}
  const next=savedCareer;seed=next.seed;seedCounter=0;
  setScene('game',automatic?'watch':next.mode,next.round,{careers:next.careers,records:next.records,setup:savedSetup(next),heroLineup:next.heroLineup,arenaRatings:next.arenaRatings});
}
$('resumeCareer').addEventListener('click',()=>resumeRun());$('continueRun').addEventListener('click',()=>resumeRun());
$('autoDuelSaved').addEventListener('click',()=>{savedCareer=readCareerForUI();resumeRun(true);});
window.addEventListener('pagehide',()=>{if(autoDuel.active){autoDuel.stop();syncAutoDuel();$('modeLabel').textContent='Showdown';}});
const reportRows=[['Saber swings','saberSwings'],['Saber hits','saberHits'],
  ['Blocks','blocks'],['Parries','parries'],['Directional reads','guardReads'],['Feints','feints'],['Ripostes','ripostes'],['Blade clashes','clashes'],['Ally-blocked swings','allyBlocks'],['Punishes','punishes'],['Counter hits','counters'],['Force casts','forceCasts'],
  ['Force hits','forceHits'],['Knockouts','kills'],['Deaths','deaths'],['Assists','assists'],['Hazard deaths','environmentDeaths']] as const;
function reportCell<K extends keyof HTMLElementTagNameMap>(tag:K,value:unknown,cl?:string){
  const el=document.createElement(tag);el.textContent=value as string;if(cl)el.className=cl;return el;
}
const defenseNames:Record<string,string>={perfect_parry:'Perfect parry',...Object.fromEntries(ARCADE_RANK_FOOTWORK.map(m=>[m.id,m.label])),trakata:'Tràkata',hero_reposition:'Hero crossfire exit',advanced_parry:'Parry follow-up',advanced_whiff:'Changed attack line',advanced_travel:'Footwork follow-up',jump:'Jump',wheel:'Wheel hop',crossflip:'Crossflip',compact:'Compact hop',line:'Line jump',bound:'Bounding jump',drift:'Drift step',pounce:'Pounce',corkscrew:'Corkscrew jump',feint:'Feint',read:'Directional read',guard_read:'Directional read',directional_parry:'Directional parry',force_ward_block:'Force ward block',guard:'Guard',block:'Block',parry:'Parry',dash:'Dash evade',vault_step:'Vault evade',evade:'Evade',sidestep:'Sidestep',backstep:'Backstep',clash:'Blade bind',rank_deflect:'Deflection',rank_composure:'Composure',rankDeflect:'Deflection',rankComposure:'Composure',pressure_graze:'Glancing defense',pressure_recover:'Stagger recovery'};
function showInjuryReport(f:ArcadeFighter|undefined){
  const rank=f?.career?.gradeIndex??0;
  const opts={attackerRank:rank,defenderRank:rank};
  const front=arcadeInjuryReport(f?.injuries,{...opts,direction:'front'}), rear=arcadeInjuryReport(f?.injuries,{...opts,direction:'rear'});
  $('bodyRows').replaceChildren(...front.map((a,i)=>{
    const b=rear[i], row=document.createElement('tr'), h=reportCell('th',a.label);
    h.scope='row';const fatal=f?.fatalRegion===a.id;
    const ac=reportCell('td',fatal&&f.fatalDirection!=='rear'?'Fatal':a.severityLabel), bc=reportCell('td',fatal&&f.fatalDirection==='rear'?'Fatal':b?.severityLabel??'Ready');
    ac.dataset.level=severityLevel(ac.textContent);bc.dataset.level=severityLevel(bc.textContent);
    row.append(h,ac,bc,reportCell('td',f?.alive===false?'—':a.fatalPct+'% / '+(b?.fatalPct??0)+'%'));return row;
  }));
  $('injuryReference').textContent=ARCADE_INJURY_REFERENCE.description+' Timing and technique can shift the odds.';
}
const baseAttackNames:Record<string,string>={stamina_hit:'Stamina from clean hits',...Object.fromEntries(Object.values(ARCADE_AIR_STRIKES).map(move=>[move.id,move.label])),chain_follow:'Linked follow-up',staff_primary_hit:'Staff primary-tip hits',staff_rear_hit:'Staff reverse-tip hits',landed_riposte:'Confirmed riposte',slash:'Opening cut',slash2:'Reverse cut',slash3:'Finishing cut',slash4:'Fourth cut',thrust:'Linear thrust',wide_cut:'Wide sweep',deflect:'Guard riposte',vault:'Acrobatic vault',riposte:'Power counter',force:'Force cast',force_push:'Force push',force_burst:'Force burst',force_pulse:'Force pulse',frenzy:'Ferocity chain',sweep:'Sweep',rush:'Rush',uppercut:'Rising cut',offhand:'Offhand cut',guard_break:'Guard break'};
const words=(id:string)=>id.replaceAll('_',' ').replace(/(^| )([a-z])/g,(_,space,c)=>space+c.toUpperCase());
function showMoveStats(){
  const f=game?.fighters.find(x=>x.id===$('moveFighter').value);
  showInjuryReport(f);
  const damage=(n:number|undefined)=>Number.isFinite(n)?Math.max(0,n as number).toLocaleString(undefined,{maximumFractionDigits:1}):'0';
  $('fighterDamageDealt').textContent=damage(f?.stats?.damage);
  $('fighterDamageTaken').textContent=damage(f?.stats?.damageTaken);
  const grade=f?.career?.grade??'F';
  const rating=f&&roundRated?arenaRatingDetail(f.id,f.career.gradeIndex):f?.heroId&&Number.isFinite(f.heroElo)?ratingText(f.heroElo as number)+' Elo · floor '+ratingText(eloFloor(f.heroEloFloorGrade))+' · '+(f.control?'Your control':titleCase(f.heroPlan??'balanced')):'Unrated';
  const chess=chessReadout(f);
  $('moveRank').textContent=f?gradeDisplayLabel(grade)+' · '+formName(f.form)+(chess?' · '+chess+' style':'')+(f.heroId?' · '+fighterGenderLabel(f.gender):'')+' · '+rating+(habitName(f)?' · '+habitName(f):''):'';
  const moves=Object.entries(f?.moves??{}).filter(([id,n])=>n>0&&typeof id==='string').sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  for(const [id,defense] of [['attackMoves',false],['defenseMoves',true]] as const){
    const rows=moves.filter(([key])=>defense===Boolean(defenseNames[key]||ARCADE_TECHNIQUES[key]?.tactical==='moving_guard')).map(([key,n])=>{
      const row=document.createElement('div');
      row.append(reportCell('dt',defenseNames[key]??combatMoveLabel(key)??baseAttackNames[key]??words(key)),reportCell('dd',n));return row;
    });
    if(!rows.length){const row=document.createElement('div');row.append(reportCell('dt','None yet'),reportCell('dd','0'));rows.push(row);}
    $(id).replaceChildren(...rows);
  }
}
$('moveFighter').addEventListener('change',showMoveStats);
function openStats(){
  if(view!=='game')return;
  clearInput();sim.remainder=0;sim.previous=null;
  $('statsRound').textContent='ROUND '+round+(game.phase==='playing'?' · PAUSED':' · COMPLETE')+(roundRated?' · RATED':' · UNRATED');
  $('roundStats').replaceChildren(...reportRows.map(([label,key])=>{
    const row=document.createElement('tr'), head=reportCell('th',label);head.scope='row';
    row.append(head,reportCell('td',game.stats?.[key]?.[0]??0,'blue'),reportCell('td',game.stats?.[key]?.[1]??0,'pink'));return row;
  }));
  const obj=game.objective;
  if(obj?.target){
    const row=document.createElement('tr'),h=reportCell('th',obj.rule==='control'?'Signal points':'Relic deliveries');
    h.scope='row';row.append(h,...obj.score.map((n,i)=>reportCell('td',Math.floor(n+1e-8),i?'pink':'blue')));$('roundStats').append(row);
  }
  $('reportSeed').textContent='Seed '+seed;$('copySeed').textContent='Copy seed';
  const eventsBy:Record<string,string>={stamina_hit:'Stamina earned',expanded_release:'Technique released',hero_plan:'Hero changed tactics',advanced_route:'Tactical follow-up',hero_reposition:'Hero escaped a crossfire',trakata_off:'Tràkata: blade doused',trakata_on:'Tràkata: blade relit',feint:'Feint',read:'Directional read',riposte:'Riposte',ally_blocked:'Ally blocked strike lane',clash:'Blade clash',parry:'Parry',break:'Guard break',ko:'Knockout',hazard:'Hazard hit',capture:'Point captured',deliver:'Relic delivered',pickup:'Relic picked up',drop:'Relic dropped'};
  const namedCommit=(e:ArcadeEvent)=>(e.contact as number)>0&&!e.offhand&&combatMoveLabel(e.moveId??e.technique,e);
  const visible=game.events.filter(e=>e.punish||e.region||eventsBy[e.kind]||namedCommit(e)).slice(-8).reverse();
  const eventLabel=(e:ArcadeEvent)=>{
    if(e.kind==='stamina_hit')return 'Stamina +'+Math.round((e.staminaGain as number)*10)/10+' · '+regionName(e.region as string);
    if(e.kind==='parry'&&e.perfect)return 'Perfect parry';
    const expanded=e.kind==='expanded_release'&&arcadeExpandedMoveById(e.moveId as string,{forceVariants:true});
    if(expanded)return expanded.label;
    if(e.region)return (e.fatal||e.kind==='ko'?'Fatal hit':e.punish?'Punish':'Injury')+' · '+regionName(e.region)+(e.direction==='rear'?' (rear)':'');
    return namedCommit(e)||eventsBy[e.kind]||'Punish';
  };
  $('recentEvents').replaceChildren(...(visible.length?visible.map(e=>reportCell('li',Math.floor(e.time??0)+'s · '+eventLabel(e))):[reportCell('li','No major events yet')]));
  const prior=$('moveFighter').value;
  fillOptions($('moveFighter'),game.fighters.map(f=>[f.id,(f.displayName??((f.team?'Pink ':'Blue ')+(f.slot+1)))+' · '+formName(f.form)]));
  $('moveFighter').value=game.fighters.some(f=>f.id===prior)?prior:game.fighters.find(f=>f.control)?.id??game.fighters[0].id;
  showMoveStats();
  const awards=settleArcadeCareer(game,roundRatings);
  $('fighterStats').replaceChildren(...game.fighters.map(f=>{
    const side=f.team?'Pink':'Blue', row=document.createElement('tr'), label=reportCell('th',f.displayName??side+' '+(f.slot+1),f.team?'pink':'blue');
    label.scope='row';if(f.displayName)label.append(reportCell('small',side+' '+(f.slot+1)+' · Hero'));label.append(reportCell('small',formName(f.form)),reportCell('small',arcadeSaberOption(f.gear).label));
    const chess=chessReadout(f),habit=habitName(f);if(chess)label.append(reportCell('small',chess+' style'));
    if(habit)label.append(reportCell('small',habit));
    if(f.gear?.dualPhase)label.append(reportCell('small',f.saberPhase==='long'?'Extended phase':'Short phase'));
    const earned=awards?.report.find(a=>a.id===f.id), summary=earned?.after??f.career;
    const rank=reportCell('td',''), record=game.records?.soldiers.find(r=>r.id===f.id);
    rank.append(reportCell('b',gradeDisplayLabel(summary?.grade??'F')),reportCell('small',(summary?.merit??0).toLocaleString()+' pts'+(earned?.reward?' / +'+earned.reward:'')+(earned?.promoted?' · Up':'')));
    if(roundRated)rank.append(reportCell('small',arenaRatingDetail(f.id,f.career.gradeIndex)));
    row.append(label,rank,reportCell('td',[record?.kills??0,record?.deaths??0,record?.assists??0].join(' / ')));return row;
  }));
  $('statsDialog').showModal();
}
$('copySeed').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(String(seed));$('copySeed').textContent='Copied';}
  catch{$('copySeed').textContent='Copy unavailable';}
});
$('resultStats').addEventListener('click',openStats);
$('statsButton').addEventListener('click',openStats);
$('statsDialog').addEventListener('close',()=>{if(!paused&&game.phase==='playing')canvas.focus({preventScroll:true});});


$('formsGuide').addEventListener('click',()=>$('guide').showModal());

const pairs:Record<string,[string,string][]>= {
  startingRanks:SOLDIER_GRADES.map(g=>[g.label,g.displayLabel]),
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
const teamLabels:Record<string,string>={startingRanks:'Starting rank',groupForms:'Team forms',doctrines:'AI style',formations:'Formation',targeting:'Target priority',deployments:'Deployment',startingSaberQuality:'Saber grade',startingForceQuality:'Force grade',startingForceFamily:'Force ability'};
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
    for(const [key,opts] of Object.entries(pairs)){
      if(key==='groupForms'||key==='chessStyles')continue;
      const select=document.createElement('select');select.id=key+i;
      select.setAttribute('aria-label',name+' '+teamLabels[key].toLowerCase());fillOptions(select,opts);
      const label=createLabel(teamLabels[key],select);
      if(key.startsWith('startingForce'))label.dataset.forceSetting='';
      card.append(label);
    }
    $('teamControls').append(card);
  }
  const floors=$('rankFloorList');
  const note=reportCell('p','Arena Elo starts at 100. Kills and assists earn Elo. Knockouts cost more when credited to a lower-rated fighter. Equal-size Elimination matches from 1v1 through 15v15 count, unless a saved Hero joins. Raise training rank to unlock a higher Elo cap. In rated matches, higher Elo sharpens AI decisions. Tournament Hero floors are listed below.');
  floors.before(note);
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
      if(i===0&&j===setup.playerSlot&&setup.participation==='play'){place.append(reportCell('p',name+' '+(j+1)+(setup.form==='mixed'?' · Mixed form':' · Your form'),'player-form-note'));continue;}
      const sel=document.createElement('select');sel.id='slotForm'+i+'-'+j;
      fillOptions(sel,[['','Use team default'],...pairs.groupForms]);sel.value=setup.teamForms[i][j]??'';
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
  $('watchHeroHelp').textContent=empty?'Save a Hero in Tournament to use Watch a Hero.':'Sets up one saved Hero vs three SSS+ V fighters. Start when ready.';
  document.querySelector<HTMLElement>('.hero-options')!.hidden=empty;
  for(const i of [0,1] as const){
    const p=setup.heroPicks[i], other=setup.heroPicks[1-i]?.id??'';
    const choices=heroRoster.filter(x=>x.id!==other||x.id===p.id);
    fillOptions($(`heroChoice${i}`),[['','No Hero'],...choices.map(x=>[x.id,x.name] as const)]);
    $(`heroChoice${i}`).value=choices.some(x=>x.id===p.id)?p.id:'';
    const selected=choices.find(x=>x.id===$(`heroChoice${i}`).value), info=$(`heroEloHint${i}`);
    info.hidden=!selected;
    const actor=lobbyHeroControl(setup,i)==='manual'?'You control this Hero':'AI-controlled';
    info.textContent=selected?actor+' · '+fighterGenderLabel(selected.gender)+' · SSS+ V · '+ratingText(selected.elo)+' Elo · floor '+ratingText(eloFloor(selected.eloFloorGrade)):'';
    fillOptions($(`heroPos${i}`),Array.from({length:setup.teamSizes[i]},(_,j)=>[j,'Slot '+(j+1)]));
    $(`heroPos${i}`).value=String(p.slot);
    $(`heroPosLabel${i}`).hidden=!$(`heroChoice${i}`).value||setup.teamSizes[i]===1;
  }
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
const kitHints:Record<string,string>={
  single:'Direct cuts and a quick return to guard.',
  dual:'Two independently timed swings; the second blade follows the first.',
  backhand:'Compact close-range cuts with a quick wrist return.',
  'backhand-dual':'Close-range alternating cuts, with a quick second swing.',
  staff:'One rigid hilt, two opposing tips. The lead tip can change between swings.',
  shoto:'Shorter reach, faster swings and lower stamina cost.',
  greatsaber:'Longer reach and harder hits, with slower and costlier swings.',
};
function updateLobbyRating(teamSizes:readonly number[]){
  const chosen=battleHeroLineup(setup.heroPicks,heroRoster,tournamentHeroLoadout);
  const {rated,label}=arenaLobbyRating(setupMode(setup),setup.rule,teamSizes,chosen);
  const output=$('arenaRatingStatus');
  if(output.textContent!==label)output.textContent=label;
  output.dataset.rated=String(rated);
  $('autoDuelStart').disabled=!rated;
}
for(const count of [$('count0'),$('count1')])count.addEventListener('input',()=>
  updateLobbyRating([$('count0').valueAsNumber,$('count1').valueAsNumber]));
function updateSetupHints(){
  updateLobbyRating(setup.teamSizes);
  for(const i of [0,1] as const){
    $(`kitHint${i}`).textContent=kitHints[$(`saberKit${i}`).value]??kitHints.single;
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
  $('pace').disabled=play;$('pace').title=play?'Available for Spectator and Commander':'';
  for(const el of document.querySelectorAll<HTMLElement>('[data-force-setting]'))el.hidden=setup.saberOnly;
  for(const b of document.querySelectorAll<HTMLElement>('[data-preset]')){
    const kind=b.dataset.preset,p=field(presets,kind);
    const same=kind==='master'?setup.teamSizes.join()==='1,15'&&setup.startingRanks.join()==='SSS+V,F'&&setup.participation==='watch'&&setup.rule==='elimination'
      :p&&setup.participation===p.participation&&setup.rule===p.rule&&setup.teamSizes.join()===p.teamSizes.join();
    b.setAttribute('aria-pressed',String(Boolean(same)));
  }
  $('formDetail').textContent=play&&!mixed&&!hero?field(lore,setup.form)?.read??'':'';
  $('airFormDetail').textContent=!play?'':hero?`${hero.name} uses ${formName(hero.form)}${mixed?' instead of rotating':''}.`:mixed?'Mixed rotates your form each round.':setup.form==='ataru'?'Corkscrew or sideways crossflip.':field(FORM_AIR_NAMES,setup.form)??'';
}
function applyLobby(){
  $('participation').value=setupPlayAs(setup);
  $('style').value=setup.fixedForm;
  for(const [key,id] of Object.entries(scalar))if(key!=='playerSlot')$(id).value=setup[key as keyof typeof setup]===null?'':String(setup[key as keyof typeof setup]);
  for(const key of Object.keys(pairs))for(const i of [0,1] as const)(document.getElementById(key+i) as HTMLSelectElement).value=((setup as unknown as Record<string,string[]>)[key])[i];
  for(const i of [0,1] as const){$(`count${i}`).value=setup.teamSizes[i] as unknown as string;$(`saberKit${i}`).value=arcadeSaberOption(arcadeFighterGear(setup,i)).id;$(`dualPhase${i}`).checked=setup.startingDualPhase[i];}
  $('saberOnly').checked=setup.saberOnly;
  rosterFromSetup();heroSelects();updateSetupHints();
}
function readLobby(){
  const old=setup, input:Record<string,unknown>={...old,...playAsSetup($('participation').value as Parameters<typeof playAsSetup>[0],$('style').value,old)};
  for(const [key,id] of Object.entries(scalar))input[key]=$(id).value;
  for(const key of Object.keys(pairs))input[key]=([0,1] as const).map(i=>(document.getElementById(key+i) as HTMLSelectElement).value);
  input.teamSizes=([0,1] as const).map(i=>$(`count${i}`).value);
  const kits=([0,1] as const).map(i=>ARCADE_SABER_OPTIONS.find(o=>o.id===$(`saberKit${i}`).value)??ARCADE_SABER_OPTIONS[0]);
  input.startingSaberWeapon=kits.map(o=>o.weapon);
  input.startingSaberGrip=kits.map(o=>o.grip);
  input.startingDualPhase=([0,1] as const).map(i=>$(`dualPhase${i}`).checked);
  input.saberOnly=$('saberOnly').checked;
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
    old.heroPicks.some((p,i)=>p.id!==setup.heroPicks[i].id||p.slot!==setup.heroPicks[i].slot);
  if(rePreview&&view==='menu')setScene('menu');
}
$('watchHero').addEventListener('click',()=>{
  if(!prepareWatchHero())return;
  applyLobby();saveSetup(setup);setScene('menu');
  const name=heroRoster.find(h=>h.id===setup.heroPicks[0].id)?.name??'Saved Hero';
  $('setupStatus').textContent=name+' will fight under AI control. Press Start match when ready.';
});
$('lobby').addEventListener('change',readLobby);
for(const button of document.querySelectorAll<HTMLElement>('[data-preset]')){
  button.addEventListener('click',()=>{
    const key=button.dataset.preset;
    const p=field(presets,key);
    if(!p)return;
    if(key==='master')imported=null;
    setup=normalizeSetup({...setup,...p,...(key==='master'?{heroPicks:[]}:{}),playerSlot:0});applyLobby();saveSetup(setup);setScene('menu');
    $('setupStatus').textContent=button.textContent+' preset selected.';
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

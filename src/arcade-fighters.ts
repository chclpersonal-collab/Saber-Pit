import type {Point} from './arcade-rig-projection.js';
type Canvas=CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
type Figure={id:string;head:number;shoulder:number;waist:number;hip:number;thigh:number;calf:number;scale:number;legLength:number;skin:string;skinShadow:string;hair:string;hairLight:string};
type Palette={shade:string;mid:string;steel:string;top:string;flare:string;slash:string;split:string};
type LegWorld={side:number;foot:Point;toes:Point;k:Point;planted:boolean};
type Vel=Point & {angle:number};
type BladeSource={hand:Point;tip:Point};
type Entry=Partial<BladeSource> & {offhand?:BladeSource|null;freeHand?:Point;origin?:Point;facing?:number;kind?:string;
 body?:{lean:number;bend:number;wide:number;torsoTurn:number;rhythm?:number;roll?:number;airPhase?:string};
 legs?:LegWorld[];stride?:{vx?:number;vy?:number;bearing?:number;kind?:string};
 momentum?:{main?:Vel|null;offhand?:Vel|null}};
type Impact={at:number;bearing:number;strength:number;kind:string};
type Recovery=Impact & {duration:number;impactAt:number};
type Fighter={
 id?:number|string;team?:number;action?:string|{type?:string;kind?:string};x?:number;y?:number;face?:number;vx?:number;vy?:number;
 body?:string;gender?:string;form?:string;technique?:string|null;attack?:unknown;attackFamily?:string|null;attackSerial?:number|null;
 attackSpec?:{contact?:number;offhand?:{contact?:number};leadBlade?:string;forceAbility?:string;freeHand?:boolean;duration?:number;motion?:{path?:string;finish?:number;chamber?:number};chessStyle?:string;chessPromoted?:boolean}|null;
 gear?:{weapon?:string;grip?:string;staff?:boolean;dualSabers?:boolean;reverseGrip?:boolean;dualPhase?:boolean};
 poseFrom?:Entry|null;clashFrom?:{hand?:Point;tip?:Point;body?:Entry['body'];offhand?:boolean}|null;clashRole?:string|null;
 alive?:boolean;hp?:number;actionTime?:number;actionDuration?:number;airFacing?:number|null;airHeight?:number;airPhase?:string;
 airProgress?:number;airborne?:number;airStrike?:string|null;appearanceSeed?:number;attackVariant?:string|null;career?:{gradeIndex?:number};
 chainFrom?:string|null;chainDepth?:number;chessStyle?:string;clashX?:number;clashY?:number;combo?:number;feintBearing?:number;
 groundBearing?:number;groundDistance?:number;groundPace?:number;groundSpeed?:number;guardBearing?:number|null;guardLane?:string;guardRead?:string|null;
 impactPhysics?:boolean;impactReaction?:Impact;impactRecovery?:Recovery;injuryEffects?:{moveSpeed?:number;moveScale?:number;guardEfficiency?:number;guardScale?:number};
 jumpBearing?:number;jumpKind?:string|null;liveEntry?:boolean;parryTime?:number;peasantMotion?:boolean;poseEntryDuration?:number;poseEntryOffset?:number;
 rankFootwork?:{path?:string;bearing?:number}|null;recoveryFlow?:boolean;saberOff?:boolean;saberPhase?:string;saberPhaseChangedAt?:number;staffLead?:string|null;
 stanceFlow?:boolean;styleChoreo?:boolean;styleTravel?:boolean;trakataIgnitedAt?:number;weaponFlow?:boolean;
 [WALK_SOURCE]?:{actor?:object;dx?:number;dy?:number;speed?:number};
};
type Rig=ReturnType<typeof sampleArcadeFighter>;
type Leg=Rig['legs'][number];
type StyleSpin={style:string;amplitude:number;yaw:number;face:number;torsoScale:number;cloth:number;clothSide:number};
type Appearance={ink:string;shade:string;gleam:string;coat:string;trim:string;femme:boolean;androgynous:boolean;softBoy:boolean;hair:string};
type PaintRig=Rig & {appearance?:Appearance;styleSpin?:StyleSpin;bodySettle?:number;saberOff?:boolean;trakataFlash?:number};
type ChestKey='head'|'shoulder'|'pelvis'|'frontElbow'|'backElbow';
type GroundHandoff={at:number;root:Point;prior:LegWorld[];support?:number;quickStep?:boolean};
type GroundPose={kind:string;time:number;root:Point;handoff:GroundHandoff|null;feet:LegWorld[]};
type FacePose={kind:string;root:Point;time:number;shoulder:Point;head:Point;carry:({at:number;shoulder:Point;head:Point})|null};
type AirBridge={at:number;x:number;y:number;hop:number;feet:LegWorld[];body:Record<ChestKey,Point>;phase:string;span:number;support?:number};
type AirPose={phase:string|undefined;x:number;y:number;hop:number;time:number;bridge:AirBridge|null;paint:PaintRig};
type RecoveryPose={impactAt:number;time:number;x:number;y:number;body:Record<ChestKey,Point>;feet:LegWorld[]};
type Emitter=ReturnType<typeof arcadeBladeWorld>['blades'][number];
type Interruption={time:number;x:number;y:number;blades:Emitter[];target:Emitter[];span:number};
type InterruptionPose={kind:string;time:number;x:number;y:number;phase:string;blades:Emitter[];bridge:Interruption|null};
type SupportFoot={anchor?:Point;toe?:Point;planted?:boolean;cycle?:number;cycleRun?:number;resume?:boolean;swing?:{forcedAt?:number;fromSwing?:number;anchor:Point;toe:Point;target:Point;targetToe?:Point}|null};
type PlantMemory={legs:SupportFoot[];x?:number;y?:number;time?:number;distance?:number;idleSince?:number|null;axis?:Point;
  lastFeet?:Leg[];lastWorld?:LegWorld[];stopFeet?:LegWorld[];stopGoal?:LegWorld[];stopRoot?:Point;stopReach?:number;stopSupport?:number;replant?:number};
type DrawOptions={ghost?:boolean|string;reducedMotion?:boolean;rig?:Rig;selected?:boolean;outline?:boolean;
  lowDetail?:boolean;pathFactory?:()=>Path2D|null;crowded?:boolean;hideSabers?:boolean;width?:number;height?:number;time?:number;framing?:string};

import {polygon,line,flatEllipse,celPath,unit,at} from './arcade-rig-canvas.js';
import {JUMP_STYLE,aerialLowerBody,ataruAerialTrick} from './arcade-rig-aerial.js';
import {ATTACK_BEATS,visualFamily,contactEnvelope,staffSweep} from './arcade-rig-swing.js';
import {arcadeFoot,arcadeGait,GAIT_STRIDE,DISPLAY_STEP,displayStep} from './arcade-rig-gait.js?v=5.0.0';
import {clashBind} from './arcade-rig-bind.js';
export {arcadeFoot,arcadeGait};
import {arcadeRigRotation,arcadeBasis,arcadeHeroLabelWorld,arcadeFeetWorld,arcadeBladeWorld} from './arcade-rig-projection.js';
export {arcadeHeroLabelWorld,arcadeFeetWorld,arcadeBladeWorld};
import {arcadeSaberVariant} from './arcade-loadouts.js?v=3.1.0';
import {samplePeasantPhrase,peasantHandoff} from './arcade-peasant-motion.js?v=3.0.0';
import {sampleChessSwing} from './arcade-style-choreo.js?v=3.0.0';
import {sampleWeaponFlow} from './arcade-weapon-flow.js?v=2.31.0';
import { ARCADE_TECHNIQUES } from './arcade-repertoire.js?v=3.1.0';
/* Shared art and blade geometry for the arcade arena. */
export const ARCADE_LONG_BLADE_SCALE=1.26;
const TAU=Math.PI*2;
const isFinite=(n:unknown):n is number=>Number.isFinite(n);
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const val=(n:unknown,fallback=0):number=>isFinite(n)?n as number:fallback;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>{ t=clamp(t); return t*t*(3-2*t); };
const phase=(n:number)=>((n%1)+1)%1;
const P=(x:number,y:number):Point=>({x,y});
const PALETTES=[
  {shade:'#073444',mid:'#116678',steel:'#45aeb0',top:'#87f9ed',flare:'#8cfff6',slash:'#2fffd9',split:'#d7ff76'},
  {shade:'#4b183d',mid:'#85244c',steel:'#c2526b',top:'#ff9475',flare:'#ffbc98',slash:'#ff537b',split:'#ffd08c'}
];
const FIGURES:Record<string,Figure>={
  femboy:{id:'femboy',head:1.04,shoulder:11.2,waist:6.35,hip:8.8,thigh:4.9,calf:2.75,scale:1.04,
    legLength:3,skin:'#ffd2b0',skinShadow:'#d7867e',hair:'#5b536b',hairLight:'#ddccec'},
  woman:{id:'woman',head:.98,shoulder:9.9,waist:5.5,hip:12.1,thigh:6.0,calf:2.9,scale:1.035,
    legLength:5,skin:'#ce895f',skinShadow:'#98513f',hair:'#261932',hairLight:'#ba6883'}
};
// The third look shares the original body rig; ears and mantle are cosmetic.
FIGURES.rabbit={...FIGURES.femboy,id:'rabbit'};
const FORMS:Record<string,{angle:number;hand:number;height:number;off:number;feet:number;lean:number;bend:number;arc:number;under:boolean;two:boolean}>={
  shii_cho:{angle:-.86,hand:16,height:-42,off:9,feet:4,lean:1,bend:1,arc:2.3,under:false,two:true},
  makashi:{angle:-.21,hand:24,height:-52,off:-11,feet:1,lean:5,bend:-2,arc:.42,under:false,two:false},
  soresu:{angle:-1.63,hand:18,height:-50,off:10,feet:-2,lean:-3,bend:7,arc:1.13,under:false,two:true},
  ataru:{angle:-2.20,hand:10,height:-53,off:-11,feet:3,lean:5,bend:5,arc:2.8,under:true,two:false},
  djem_so:{angle:-1.27,hand:18,height:-58,off:15,feet:8,lean:-2,bend:3,arc:2.48,under:false,two:true},
  niman:{angle:-.72,hand:11,height:-39,off:22,feet:1,lean:0,bend:0,arc:1.51,under:true,two:false},
  juyo:{angle:.14,hand:27,height:-44,off:-13,feet:6,lean:8,bend:9,arc:2.95,under:true,two:false}
};
const formId=(f:Fighter)=>String(f.form||'').toLowerCase().replace(/[’']/g,'').replace(/[ -]+/g,'_');
function figure(f:Fighter) {
  const body = String(f.body || '').toLowerCase();
  if(body==='femboy'||body==='woman'||body==='rabbit')return FIGURES[body];
  return FIGURES[f.team===1?'woman':'femboy'];
}
function moveName(f:Fighter){
  const s=String((typeof f.action==='object'&&(f.action?.type || f.action?.kind)) || f.action || '').replace(/[^a-z]/gi,'').toLowerCase();
  if(/^(ko|dead|down|defeated|knockout|fallen)$/.test(s)||(f.alive===false||(f.alive==null&&f.hp!<=0)))return 'ko';
  if(/clash|bind/.test(s))return 'clash';
  if(/parry|counter/.test(s))return 'parry';
  if(s==='force')return 'force';
  if(s==='freehand'&&f.attackSpec?.freeHand===true)return 'freehand';
  if(s==='feint')return 'feint';
  if(s==='jump')return 'jump';
  if((f.technique==='vault'||ARCADE_TECHNIQUES[f.technique!]?.air)&&s==='rush')return 'leap';
  if(/block|guard|brace/.test(s))return 'guard';
  if(/hit|stagger|recoil|hurt/.test(s))return 'hit';
  if(/leap|upper|jump|aerial|vault/.test(s))return 'leap';
  if(/sweep|heavy|cleave|spin|special|finisher/.test(s))return 'sweep';
  if(s==='sidestep'||f.technique==='sidestep'&&s==='dash')return 'sidestep';
  if(s==='backstep'||f.technique==='backstep'&&s==='dash')return 'backstep';
  if(s==='dash')return 'dash';
  if(/rush|thrust|lunge|charge/.test(s))return 'rush';
  if(/slash|strike|saber|attack|light|cut/.test(s))return 'slash';
  return 'ready';
}

export function sampleArcadeFighter(f:Fighter={},time=0,{reducedMotion=false}={}) {
  const facing=val(f.face,(f.team===1?Math.PI:0)), dx=Math.cos(facing),dy=Math.sin(facing);
  const hdx=Math.abs(dx)>.08?Math.sign(dx):Math.sign(val(f.vx)) || (f.team===1?-1:1);
  const takeoffBearing=isFinite(f.airFacing)?f.airFacing:f.action==='jump'?f.jumpBearing:null;
  const flightSide=isFinite(takeoffBearing)?(Math.cos(takeoffBearing)<0?-1:1):hdx;
  // End-on poses collapse smoothly in the horizontal axis. The old signed
  // minimum width made a saber jump ~80 screen units at a north/south turn.
  const forward=Math.sin(dx*Math.PI*.5);
  const vel=Math.hypot(val(f.vx),val(f.vy));
  const groundSpeed=Math.min(vel,Math.max(0,val(f.groundSpeed,vel))),moving=groundSpeed>8;
  const travel=P(moving?val(f.vx)/vel:dx,moving?val(f.vy)/vel:dy);
  const action=moveName(f), type=figure(f), form=formId(f), stance=FORMS[form];
  const t=clamp(val(f.actionTime,0)/Math.max(.001,val(f.actionDuration,.32)));
  const idPhase=typeof f.id==='string'?Array.from(f.id).reduce((hash,ch)=>(hash*31+ch.charCodeAt(0))>>>0,0)%113/23:val(f.id)*.35;
  const age=val(time)+idPhase;
  const confirmedAir=isFinite(f.airHeight)&&f.airPhase!=null;
  const phaseAir=confirmedAir?f.airPhase:'grounded', airProgress=clamp(val(f.airProgress));
  const run=smooth((groundSpeed-111)/46);
  const gait=moving&&phaseAir==='grounded'&&(action==='ready'||action==='guard')&&!reducedMotion;
  const gaitWeight=gait?smooth((groundSpeed-8)/44):0;
  const distance=val(f.groundDistance), walkPhase=phase(distance/GAIT_STRIDE);
  const gaitFeet=gait?[arcadeGait(distance,0,run),arcadeGait(distance,1,run)]:null;
  const swingCounter=Math.sin(walkPhase*TAU);
  const idleBreath=reducedMotion?0:Math.sin(age*3.5)*.52;
  let lean=mix(2.4,10.5,run)*gaitWeight, bend=mix(-.6,3.3,run)*gaitWeight, hop=0, angle=moving ? -.83 : -1.05,
    extend=moving?11:13, handY=moving?-37:-45, offHand=7, offY=-40, legShift=0, wide=0, roll=0;
  let trail=0, outline=0, torsoTurn=0;
  const steam= Math.sin(Math.PI*t);
  const punch=(a:number,b:number)=>smooth((t-a)/(b-a));
  const moveFallback=f.technique==='deflect'?.248/.37:f.combo===4?.134/.405:f.combo===3?.145/.365:f.combo===2?.1/.265:.108/.285;
  const liveContact=f.attackSpec?.contact && f.actionDuration!>0 ? clamp(f.attackSpec.contact/f.actionDuration!,.18,.84):null;
  const authored=ARCADE_TECHNIQUES[f.technique!];
  const slashContact=liveContact??(authored?authored.contact/authored.duration:moveFallback);
  let stanceShift=0;
  if(action==='slash'){
    const cut=punch(slashContact*.44,slashContact), out=punch(Math.max(.65,slashContact+.10),1), chamber=punch(0,slashContact*.54);
    const send=punch(slashContact*.25,slashContact*.88);
    lean=-10*chamber+24*send-14*out; bend=7*chamber-4*send-3*out;
    torsoTurn=(-.19*chamber+.34*send-.15*out)*(f.combo===2?-1:1);
    angle=-1.04-1.55*chamber+3.4*cut-.81*out;
    extend=12-14*chamber+39*cut-25*out; handY=-45-12*chamber+28*cut-16*out;
    offHand=-7-8*steam;offY=-39+9*steam;wide=10*steam;legShift=11*steam;
    trail=punch(slashContact*.80,slashContact)*(1-punch(slashContact+.03,Math.min(1,slashContact+.24)));
    // Slash two comes back across the torso; slash three starts high and
    // drops into a low, longer finish. Keep all three near horizontal at hit.
    if(f.combo===2){angle=-.27+2.37*chamber-3.37*cut+.31*out;offY-=8*steam;handY+=8*chamber;}
    if(f.combo!>=3){angle-=.4*chamber;angle+=.45*punch(.41,.65);lean+=7*steam;extend+=7*steam;handY+=11*cut-11*out;wide+=4*steam;}

  } else if(action==='rush'){
    const contact=liveContact??.223/.435;
    const surge=punch(.075,contact), recover=punch(Math.max(.58,contact+.08),1);
    lean=-10*steam+32*surge-25*recover; bend=2+11*surge-13*recover;
    torsoTurn=.21*surge*(1-recover);
    angle=-1.22+1.24*surge-.92*recover; extend=13+30*surge-30*recover;
    handY=-43-6*surge+6*recover; offHand=-12-9*steam;offY=-32;
    wide=15*steam;legShift=22*steam;trail=steam*.86;outline=steam*.2;
  } else if(action==='sidestep'||action==='backstep'){
    const transfer=punch(0,.26)*(1-punch(.58,1)), away=action==='backstep';
    lean=away?-16*transfer:5*transfer;bend=(away?8:11)*transfer;
    angle=away?-1.66:-.52;extend=away?19:8;handY=away?-48:-53;
    offHand=away?4:-13;offY=-45;wide=(away?2:11)*transfer;
    torsoTurn=(away?-.13:.31)*transfer;stanceShift=transfer;
  } else if(action==='dash'){
    const drop=1-punch(.64,1);
    lean=21*drop; bend=12*drop; angle=-2.55+1.55*punch(.67,1); extend=-14*drop;
    handY=-35;offHand=16*drop;offY=-38;wide=6*steam;legShift=-7*steam;trail=0;
  } else if(action==='sweep'||action==='leap'){
    const contact=liveContact??(action==='leap'?.49:.53);
    const launch=punch(contact*.31,contact), settle=punch(Math.max(.68,contact+.13),1), charge=punch(0,contact*.54);
    lean=-18*charge+28*launch-10*settle;bend=18*charge-14*launch-4*settle;
    hop=!confirmedAir&&action==='leap'?Math.sin(Math.PI*clamp((t-.12)/.81))**1.45*46:0;
    const through=punch(contact,Math.max(contact+.14,.72));
    angle=-1.05-1.75*charge+2.7*launch+1.1*through-2.15*settle;
    if(action==='leap')angle=-.95+2.1*charge-1.32*launch-2.03*through+1.25*settle;
    extend=13-13*charge+29*launch-29*settle;
    handY=-43+15*charge-38*launch+23*settle;
    offHand=-14;offY=-33;wide=15*steam;legShift=10*steam;
    torsoTurn=(-.23*charge+.39*launch-.16*settle);
    roll=!confirmedAir?steam*(action==='leap'?-.35:.15):(form==='ataru'&&phaseAir==='airborne'?-.17*steam:0);
    trail=steam;outline=steam*.16;
  } else if(action==='force'){
    const mode=authored?.forceAbility??f.attackSpec?.forceAbility??'push';
    const contact=liveContact??.46, settle=punch(Math.max(.70,contact+.12),1);
    const travel=punch(.10,contact), chamber=punch(0,contact*.45)*(1-travel), thrust=travel*(1-settle);
    const [lead, hand, height, hip, grip, twist]=({
      push:[11,45,-6,8,-2.23,.21], pull:[-10,-19,8,11,-1.88,-.26],
      stasis:[3,25,-22,3,-2.42,.11],ward:[-5,15,-32,13,-1.41,-.09],
    })[mode]??[11,45,-6,8,-2.23,.21];
    const style=({shii_cho:-.8,makashi:1.45,soresu:-1.55,ataru:2.3,djem_so:-2.3,niman:.3,juyo:3.1})[form]??0;
    lean=-5*chamber+(lead+style*.65)*thrust;bend=(mode==='ward'?11:5)*thrust;
    angle=mix(stance?.angle??-.92,grip,thrust);extend=mix(stance?.hand??13,-9,thrust);
    handY=mix(stance?.height??-45,-49,thrust);torsoTurn=-.13*chamber+twist*thrust;
    offHand=13+style*thrust+(mode==='pull'?34:-8)*chamber+hand*thrust;
    offY=-43+height*thrust;wide=hip*thrust;legShift=lead*.75*thrust;outline=.7*thrust;
  } else if(action==='guard'||action==='parry'){
    const parry=action==='parry' || f.parryTime!>.045;
    lean=parry?-12*steam:-7;bend=parry?3+8*steam:10;angle=-1.55+(parry?.92*steam:0);
    extend=parry?19+14*steam:24;handY=-45;offHand=8;offY=-45;wide=6;legShift=2;outline=parry?steam*.28:.09;
  } else if(action==='clash'){
    // The saber itself is subsequently constrained to the real world contact
    // point. Below are the body beats around that exact pin: compress, absorb,
    // peel away, and reset into the current form's guard.
    const body=f.clashFrom?.body, receiver=f.clashRole==='defender';
    const entry=punch(0,.16), yieldBack=punch(.33,.62)*(1-punch(.69,1)), reset=punch(.66,1);
    const set=form==='soresu'?{lean:-2,bend:13,spread:8,turn:.16}
      :form==='makashi'?{lean:-7,bend:4,spread:3,turn:-.15}
      :form==='djem_so'?{lean:7,bend:10,spread:13,turn:.27}
      :{lean:3,bend:8,spread:8,turn:.18};
    lean=mix(mix(val(body?.lean,stance?.lean??0),set.lean,entry)-(receiver?17:12)*yieldBack,stance?.lean??0,reset);
    bend=mix(mix(val(body?.bend,stance?.bend??0),set.bend,entry)+5*yieldBack,stance?.bend??0,reset);
    wide=mix(mix(val(body?.wide,stance?.feet??0),set.spread,entry)+4*yieldBack,stance?.feet??0,reset);
    torsoTurn=mix(val(body?.torsoTurn,0),set.turn,entry)*(1-reset)-yieldBack*.14;
    angle=mix((stance?.angle??-1.05)-.72*yieldBack,stance?.angle??-1.05,reset);
    extend=mix(stance?.hand??13,(stance?.hand??13)-8,yieldBack);
    handY=stance?.height??-45;offHand=stance?.two?extend-6:stance?.off??7;
    offY=stance?.two?handY+4:-40;
  } else if(action==='hit'){
    const recoil=1-smooth(t);lean=-23*recoil;bend=9*recoil;angle=.48-1.48*smooth(t);
    extend=7;handY=-29-15*smooth(t);offHand=-22*recoil;offY=-37;wide=8*recoil;roll=.23*recoil;outline=.27*recoil;
  } else if(action==='ko'){
    lean=-14;angle=.21;extend=11;handY=-29;offHand=-13;offY=-28;
  }
  if(stance) {
    if(action==='ready'){
      angle=stance.angle; extend=stance.hand; handY=stance.height; offHand=stance.off;
      lean+=stance.lean; bend+=stance.bend; wide+=stance.feet;
      if(stance.two){offHand=extend-6;offY=handY+4;}
    } else if(action==='guard'||action==='parry'){
      angle=mix(angle,stance.angle,.37);wide+=stance.feet*.5; bend+=stance.bend*.32;
      if(form==='soresu'){angle=-1.79;extend=16;handY=-54;offHand=12;offY=-47;}
    } else if(action==='slash'){
      const contact=slashContact;
      const windEnd=contact*.52, followEnd=Math.max(.69,contact+.16);
      const chamber=punch(0,windEnd)*(1-punch(windEnd,contact));
      const ending=punch(contact,followEnd)*(1-punch(followEnd,1));
      const sign=(f.combo===2||f.combo===4?-1:1)*(stance.under?-1:1);
      const windAngle=stance.angle-Math.min(1.49,stance.arc*.71)*sign;
      const followAngle=Math.min(1.15,stance.arc*.47)*sign;
      angle=t<windEnd?mix(stance.angle,windAngle,punch(0,windEnd)):
        t<contact?mix(windAngle,0,punch(windEnd,contact)):
        t<followEnd?mix(0,followAngle,punch(contact,followEnd)):
        mix(followAngle,stance.angle,punch(followEnd,1));
      lean+=stance.lean*.53+(form==='makashi'?8:0)*steam;
      bend+=stance.bend*.54; wide+=stance.feet*.85;
      if(form==='makashi'){extend+=14*steam;handY=mix(handY,-51,steam*.73);offHand=-15;trail*=.45;}
      if(form==='soresu'){extend-=8*steam;handY-=8*steam;trail*=.68;}
      if(form==='ataru'&&!confirmedAir){hop=7*steam*steam;roll=.22*steam*sign;}
      if(form==='djem_so'){handY-=17*chamber;extend+=5*steam;}
      if(f.technique==='deflect'){lean-=8*steam;angle-=.40*chamber;trail*=.8;}
      if(form==='niman'){offHand=26;offY=-44-8*steam;}
      if(form==='juyo'){extend+=6*steam;handY+=9*ending;roll=-.22*steam*sign;}
      if(stance.two){offHand=extend-5;offY=handY+4;}
    } else if(action==='sweep'||action==='rush'||action==='leap'){
      const phaseWeight=1-steam;
      angle=mix(angle,stance.angle,phaseWeight*.69);
      lean+=stance.lean*.59;wide+=stance.feet*.68;
      if(form==='ataru'&&action==='leap'){hop*=1.19;roll*=1.65;}
      if(form==='djem_so'){handY-=15*punch(0,.22)*(1-punch(.33,.52));}
      if(f.technique==='riposte'){hop*=.55;roll*=.3;extend+=11*steam;}
      if(f.technique==='frenzy'){roll-=.28*steam;angle+=.54*Math.sin(t*TAU)*steam;}
      if(form==='soresu'){lean-=4;offHand=extend-5;offY=handY+3;}
      if(stance.two){offHand=extend-5;offY=handY+4;}
    }
  }
  if(authored&&['slash','rush','sweep','leap'].includes(action)){
    // Chamber → launch at the authoritative attack contact → settle. Distinct
    // grips and shoulder turns follow the authored path without moving the
    // engine contact tick or generating an extra hit during a feint.
    const m=authored.motion, contact=liveContact??authored.contact/authored.duration;
    const windAt=contact*m.wind, launch=punch(windAt,contact), finishAt=contact+(1-contact)*.45;
    const drawBack=punch(0,windAt), recover=punch(finishAt,1);
    const wind=drawBack*(1-launch), cut=launch*(1-recover), carry=punch(contact,finishAt)*(1-recover);
    const idle=stance?.angle??-.92, chamber=idle+m.chamber;
    const finish=m.finish, contactPitch=m.path==='point'||m.path==='feint'?0:
      m.path==='screen'?-.12:m.path==='aerial'?.17:m.path==='diagonal'?-.12:.03;
    angle=t<windAt?mix(idle,chamber,drawBack):t<contact?mix(chamber,contactPitch,launch):
      t<finishAt?mix(contactPitch,finish,punch(contact,finishAt)):mix(finish,idle,recover);
    const setback=m.path==='point'||m.path==='feint'?8:6;
    extend=(stance?.hand??13)-setback*wind+m.reach*cut+(m.path==='point'?8:0)*cut;
    handY=(stance?.height??-45)+m.cut*wind + m.lift*cut + (m.path==='arc'?-4:2)*carry;
    lean=(stance?.lean??0)-5*wind+m.lean*cut;
    bend=(stance?.bend??0)+5.2*wind+(m.path==='point'?3.7:2.2)*cut;
    wide=(stance?.feet??0)+m.brace*cut;
    torsoTurn=-m.twist*wind+m.twist*cut;
    legShift=m.lead*cut;
    if(m.path==='feint'){
      const show=punch(0,contact*.21)*(1-punch(contact*.24,contact*.50));
      angle=mix(angle,-.13,show*.78);extend+=8.5*show;lean+=4*show;
      handY+=4*show;
    }
    if(stance?.two){offHand=extend-5.4;offY=handY+3.5;}
    else{offHand=(stance?.off??-5)-5.7*cut;offY=-41+3*cut;}
    if(form==='niman'&&!f.gear?.dualSabers){offHand+=5.3*wind;offY-=m.path==='diagonal'?4*cut:0;}
    trail=punch(contact*.81,contact)*(1-punch(contact+.045,Math.min(.96,contact+.21)));
    if(m.path==='point'||m.path==='feint')trail*=.62;
    if(m.path==='screen')trail*=.44;
  }
  if(action!=='ready'&&action!=='guard'&&action!=='parry'&&action!=='clash'&&action!=='ko'){
    // Blend entry and follow-through to the actual chosen guard. Prevent the
    // rapid pose pops that otherwise make chained moves look like teleporting.
    const first=action==='hit'?1:smooth(t/.125);
    const hold=first*(1-smooth((t-.79)/.21));
    const idle={angle:stance?.angle??-1.05,extend:stance?.hand??13,handY:stance?.height??-45,
      offHand:stance?.two?stance.hand-6:stance?.off??7,offY:stance?.two?stance.height+4:-40,
      lean:stance?.lean??0,bend:stance?.bend??0,wide:stance?.feet??0};
    angle=mix(idle.angle,angle,hold);extend=mix(idle.extend,extend,hold);handY=mix(idle.handY,handY,hold);
    offHand=mix(idle.offHand,offHand,hold);offY=mix(idle.offY,offY,hold);
    lean=mix(idle.lean,lean,hold);bend=mix(idle.bend,bend,hold);wide=mix(idle.wide,wide,hold);legShift*=hold;torsoTurn*=hold;
  }
  let airGather=0, plantedWidth=0;
  const naturalJump=action==='jump'||f.airStrike||Boolean(f.jumpKind);
  const jump=naturalJump?JUMP_STYLE[form as keyof typeof JUMP_STYLE]:null;
  const compression=(row:number[],amount:number)=>{
    const [knee,shift,span]=row;
    bend+=amount*knee;lean+=amount*shift;wide+=amount*span;plantedWidth=amount*span;
  };
  const trick=ataruAerialTrick(f as Parameters<typeof ataruAerialTrick>[0],form,phaseAir!,airProgress,reducedMotion);
  if(confirmedAir) {
    hop=Math.max(0,val(f.airHeight));
    if(phaseAir==='takeoff') {
      const load=Math.sin(Math.PI*airProgress);
      compression(jump?.load??[9,4,3],load);
    }else if(phaseAir==='airborne'){
      airGather=Math.sin(Math.PI*airProgress);
      bend+=airGather*(form==='ataru'?4:2.5);lean+=airGather*3;wide-=airGather*5;
      if(trick.kind){
        // Pull the arms and lead knee into the turn, then unfold into reach.
        // The sword's entire world transform still comes from the same rig.
        roll=0;bend+=trick.tuck*5.5;
        extend=mix(extend,11,trick.tuck*.57);offHand=mix(offHand,-6,trick.tuck*.73);
        handY=mix(handY,-44,trick.tuck*.77);offY=mix(offY,-38,trick.tuck*.69);
        angle=mix(angle,.52,trick.tuck*.21);
      }else if(form==='ataru'&&action==='leap')roll-=airGather*.16;
      else if(action!=='dash')roll=0;
      if(jump&&(action==='jump'||(f.stanceFlow===true&&f.airStrike))&&!reducedMotion&&!trick.kind){
        const swing=Math.sin(airProgress*TAU)*.51;
        roll=airGather*(jump.turn[0]*swing+jump.turn[1]);
        torsoTurn+=airGather*jump.post[0];lean+=airGather*jump.post[1]*9;
      }
    }else if(phaseAir==='landing'){
      const absorb=Math.sin(Math.PI* Math.min(1,airProgress**.68));
      compression(jump?.land??[9.5,3,3.4],absorb);
      roll*=1-smooth(airProgress);
    }
  } else if(val(f.airborne)>0 && action!=='leap'){
    const remaining=clamp(f.airborne!/.48);
    hop=Math.max(hop,Math.sin(Math.PI*(1-remaining))*.93*54);
    roll=Math.max(roll,.72*Math.sin(Math.PI*(1-remaining)));
  }
  if(gait&&action==='ready'){
    const counter=swingCounter*gaitWeight, pump=mix(4,8,run);
    angle+=counter*.12;extend+=counter*pump*.57;
    offHand+=counter*(stance?.two?pump*.48:-pump);
    offY+=counter*(stance?.two?1.35:mix(2.6,5.8,run));
    torsoTurn+=counter*mix(.055,.091,run);
  }
  const injury=f.injuryEffects;
  const limp=injury?clamp(1-(injury.moveSpeed??injury.moveScale??1)):0;
  const guardLag=injury?clamp(1-(injury.guardEfficiency??injury.guardScale??1)):0;
  if(gait&&action==='ready'&&!reducedMotion&&limp>0){
    lean+=limp*2.2; bend+=limp*(1.6+Math.max(0,swingCounter)*3.6)*gaitWeight;
    // Drag only the recovering foot. Keep the world anchor of planted soles.
    if(!gaitFeet![1].planted)gaitFeet![1].lift*=1-limp*.66;
  }
  if((action==='guard'||action==='parry')&&guardLag>0){
    bend+=guardLag*2.6; handY+=guardLag*5.2; offY+=guardLag*4; extend-=guardLag*3;
  }
  if(reducedMotion){if(!confirmedAir)hop*=.4;airGather*=.36;roll=0;trail=0;outline=0;torsoTurn=0;}
  const flightStep=gait&&run>.05&&gaitFeet!.every(foot=>!foot.planted) ? Math.min(...gaitFeet!.map(foot=>foot.lift))*.75 : 0;
  let rhythm=mix(idleBreath,Math.cos(walkPhase*TAU*2)*mix(-1.38,2.05,run)-flightStep,gaitWeight);
  const staff=f.gear?.weapon==='staff'||f.gear?.staff===true;
  const dual=!staff&&(f.gear?.weapon==='dual'||f.gear?.dualSabers===true);
  const reverse=!staff&&(f.gear?.grip==='backhand'||f.gear?.reverseGrip===true);
  const swings=['slash','rush','sweep','leap','rise','uppercut'].includes(action);
  const primaryContact=liveContact??slashContact, rearTiming=val(f.attackSpec?.offhand?.contact);
  const phasePulse=(at:number,before:number,after:number)=>punch(Math.max(0,at-before),at)*(1-punch(at,Math.min(1,at+after)));
  if(reverse&&action!=='clash'&&action!=='force'){
    // Chamber elbow-first with saber trailing the forearm. Cut arrives tip
    // first at actual contact; recovery tucks the blade along the back hip.
    const held=(action==='guard'||action==='parry')?1.92:2.56;
    const release=swings?phasePulse(primaryContact,.26,.33):0;
    angle=mix(held-.40*steam,angle-.13,release);
    extend+=(dual?5:1)-10*(1-release);
    handY+=7*(1-release); offHand-=dual?7:2; offY+=dual?4:0;
  }
  let offPitch=-2.36,offTrail=0,offActive=0;
  if(dual){
    const normalizedRear=rearTiming&&f.actionDuration!>0?clamp(rearTiming/f.actionDuration!,.2,.92):null;
    const restMain=reverse?2.54:(stance?.angle??-1.02)-.09;
    const restOff=reverse?2.70:-2.26;
    const protect=action==='guard'||action==='parry';
    const gaitArm=gait?swingCounter*gaitWeight:0;
    const motion=authored?.motion;
    const thrust=motion?.path==='point'||motion?.path==='feint'||action==='rush'||form==='makashi';
    const screen=motion?.path==='screen'||form==='soresu';
    const signature=thrust?[.40,.35,-3]:screen?[.48,.60,-5]:
      form==='juyo'?[1.31,1.16,2]:action==='sweep'||form==='shii_cho'?[1.25,1.18,2]:[1,1,0];
    const [coilScale,sweepScale,coilDrop]=signature;
    const direction=(Math.sign(motion?.twist??1)||1)*(reverse?-1:1);
    const primaryWind=swings?punch(0,primaryContact*.54)*(1-punch(primaryContact*.54,primaryContact)):0;
    const primaryCut=swings?phasePulse(primaryContact,primaryContact*.65,Math.min(.38,1-primaryContact)):0;
    angle=restMain+direction*(-.83*coilScale*primaryWind+.28*Math.sin(t*TAU)*primaryCut);
    if(swings)angle=mix(angle,0,primaryCut);
    const secondaryBeat=normalizedRear??1;
    const accent=swings?Math.sin(Math.PI*t)*Math.min(1,Math.abs(t-primaryContact)*7,Math.abs(t-secondaryBeat)*7):0;
    const flourish=accent*(t>primaryContact?1:-1);
    angle+=direction*flourish*(thrust?.08:screen?.20:form==='juyo'?.34*Math.sin(t*TAU*1.35):.39);
    if(protect)angle=reverse?2.02:-1.30;
    extend=(stance?.hand??13)*.74+5+18*primaryCut-7*primaryWind+gaitArm*2.2;
    handY=(stance?.height??-45)+4-7*primaryWind+4*primaryCut;
    const wing=normalizedRear??Math.min(.83,primaryContact+.20);
    const prep=normalizedRear&&swings?punch(primaryContact*.18,wing*.71)*(1-punch(wing*.71,wing)):0;
    const relay=normalizedRear&&swings?punch(primaryContact,wing)*(1-punch(wing,1)):0;
    const cut=normalizedRear&&swings?phasePulse(wing,wing*.41,Math.min(.33,1-wing)):0;
    const cover=swings?primaryCut*(1-cut):0;
    offPitch=mix(restOff-direction*(reverse?1.14:.91)*prep+.34*cover,0,cut);
    if(protect)offPitch=reverse?2.61:-2.48;
    offHand=(protect?9:2)-13*prep+29*cut+3.6*cover-2.9*gaitArm;
    offY=(protect?-39:-37)-(reverse?4:13)*prep-5*cut+4*cover+gaitArm*1.15;
    extend+=accent*(thrust?5:screen?-3:2);
    handY+=accent*coilDrop;offY-=accent*(screen?5:1);
    torsoTurn+=direction*flourish*.18*sweepScale;wide+=accent*(thrust?-2:screen?0:5);
    offActive=smooth((cut-.18)/.82);offTrail=reducedMotion?0:cut*.7;
    lean+=9*primaryCut+7*cut-3.5*prep;torsoTurn+=direction*(.16*primaryCut-.27*cut);
    bend+=2*primaryWind+3*cut;wide+=2*primaryCut+4*cut;
    extend-=relay*(reverse?9:6);handY+=relay*(reverse?5:-7);
    torsoTurn+=direction*.18*relay;legShift+=7*relay;
  }
  if(staff){
    const followAt=rearTiming&&f.actionDuration!>0?clamp(rearTiming/f.actionDuration!,.20,.94):null;
    const rearLeads=f.staffLead==='rear'||f.attackSpec?.leadBlade==='rear';
    const setupKey=rearLeads?-1:1;
    const readyAngle=-.75+((stance?.angle??-1.05)+1.05)*.17;
    const drive=swings?phasePulse(primaryContact,primaryContact*.60,Math.min(1-primaryContact,.33)):0;
    const load=swings?punch(0,primaryContact*.53)*(1-punch(primaryContact*.53,primaryContact)):0;
    let transfer=0, tail=0;
    if(swings){
      const intended=Math.sign(authored?.motion?.twist??1)||1;
      // The rear end has to travel past the hip and enter on the opposite
      // axis; the shaft never changes IDs or detaches from the second hand.
      const turn=rearLeads?-1:intended;
      const cut=rearLeads?-Math.PI:0;
      const through=followAt&&followAt>primaryContact+.015;
      const thrust=authored?.motion?.path==='point'||authored?.motion?.path==='feint'||action==='rush'||form==='makashi';
      const screen=authored?.motion?.path==='screen'||form==='soresu';
      const full=through||(!thrust&&!screen&&(action==='sweep'||form==='shii_cho'||form==='juyo'||action==='leap'));
      const crossing=through?followAt:primaryContact+(1-primaryContact)*(form==='juyo'?.35:.46);
      const wind=thrust?.23:screen?.37:.64;
      const chamber=rearLeads?readyAngle-wind-.28:turn===1?readyAngle-wind:wind+.24;
      const swing=through||full?Math.PI:thrust?.36:screen?.78:1.29;
      const follow=cut+turn*swing;
      const rest=full||rearLeads&&through?turn*TAU+readyAngle:rearLeads?-TAU+readyAngle:readyAngle;
      const keys:[number,number][]=[[0,readyAngle],[primaryContact*(form==='juyo'?.29:.40),chamber],[primaryContact,cut],
        [crossing,follow],[1,rest]];
      angle=staffSweep(keys,t);
      if(through)transfer=phasePulse(followAt,.18,Math.min(.23,1-followAt));
      tail=punch(primaryContact,crossing)*(1-punch(Math.max(crossing,.84),1));
      offActive=rearLeads?Math.max(drive,.42*load):transfer;
      trail*=.84;
    }else if(action==='guard'||action==='parry')angle=-1.06;
    else angle=readyAngle+(gait?.12*swingCounter*gaitWeight:0);
    const brace=action==='guard'||action==='parry'?3:0;
    extend=16+brace+(rearLeads?15:11)*drive+7*transfer-6*load;
    handY=-44-(rearLeads?2:9)*load-(rearLeads?9:5)*drive+5*transfer+5*tail;
    lean+=drive*(rearLeads?12:8)+transfer*8-load*3.6;
    wide+=3+drive*4+transfer*7;legShift+=setupKey*(drive*6-transfer*5);
    bend+=load*(rearLeads?9:5)+tail*3.8;
    torsoTurn+=setupKey*(drive*.31-transfer*.41-load*.24+tail*.14);
    const glint=rearLeads?Math.max(drive*.92,trail*.6):Math.max(tail*.58,transfer*.93);
    offTrail=reducedMotion?0:glint;
    if(rearLeads)trail*=.55;
  }
  if(swings&&!staff&&!dual){
    // Preserve the form's authored blade at real contact. Behind it, wind
    // the body against the cut, then carry the shoulder and hip past the hit.
    const m=authored?.motion, sign=Math.sign(m?.twist??(f.combo===2?-1:1))||1;
    const windAt=primaryContact*.48, carryAt=primaryContact+(1-primaryContact)*.34;
    const coil=punch(0,windAt)*(1-punch(windAt,primaryContact));
    const follow=punch(primaryContact,carryAt)*(1-punch(carryAt,1));
    const heavy=action==='sweep'||action==='leap';
    const weight=heavy?1.22:action==='rush'?.79:1;
    const motionGain=reducedMotion?.62:1;
    const turn=sign*weight*motionGain;
    torsoTurn+=turn*(-.22*coil+.29*follow);
    lean+=weight*(-4.5*coil+8.6*follow);
    bend+=weight*(5.2*coil+2.4*follow);
    wide+=weight*(2.8*coil+6.1*follow);
    legShift+=weight*4.2*follow;
    angle+=turn*(-.18*coil+.29*follow);
    if(!stance?.two){ offHand-=weight*(4.6*coil+7.2*follow);offY+=weight*5.5*follow; }
  }
  if(action==='jump'&&!f.attack&&jump&&phaseAir!=='grounded'){
    const phaseWeight=phaseAir==='airborne'?1:phaseAir==='takeoff'?.38:.26;
    const hold=Math.sin(Math.PI*airProgress)**1.32*phaseWeight*(reducedMotion?.63:1);
    const [,tipReach,height,off,second]=({
      shii_cho:[-.57,7,-4,3,1.10],makashi:[-.12,10,-5,-4,.64],
      soresu:[-1.68,-9,-8,1,-1.36],ataru:[1.02,-8,4,-5,1.47],
      djem_so:[-2.37,2,-15,2,-2.70],niman:[.88,-1,10,5,.95],juyo:[2.73,-7,-4,-8,-.43],
    })[form]??[-1.04,0,0,0,-1.62];
    const arc=jump?.saber??[-1.04,-1.04];
    const pitch=phaseAir==='takeoff'?arc[0]:phaseAir==='landing'?arc[1]:mix(arc[0],arc[1],smooth((airProgress-.39)/.44));
    const apparent=reverse&&pitch<-.9?pitch+TAU:pitch;
    const turnTo=(from:number,to:number)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*hold;
    angle=turnTo(angle,apparent);
    extend+=tipReach*hold;handY+=height*hold;
    if(dual){offPitch=turnTo(offPitch,second);offHand+=off*hold;}
    else if(!staff){offHand+=off*hold;offY+=height*.32*hold;}
    trail=0;offTrail=0;
  }
  const lookDelta=(angle:number)=>Math.atan2(Math.sin(angle-val(f.face)),Math.cos(angle-val(f.face)));
  const guarding=action==='guard'||action==='parry';
  if(guarding&&(f.guardLane||isFinite(f.guardBearing))){
    const lane=f.guardLane==='left'?-1:f.guardLane==='right'?1:0;
    const cross=isFinite(f.guardBearing)?clamp(lookDelta(f.guardBearing)/.85,-1,1):lane;
    const ward=lane===0?cross:lane*.64+cross*.36;
    // Shoulder and blade cover the same lane without breaking the two
    // emitters of the staff out of alignment.
    angle+=ward*(staff?.43:reverse?-.38:.58);
    if(dual)offPitch+=ward*(reverse?-.35:.43);
    handY+=ward*5;offY-=ward*3;lean+=ward*2.8;torsoTurn+=ward*.19;
  }
  if(action==='feint'){
    const bearing=isFinite(f.feintBearing)?lookDelta(f.feintBearing):.45;
    const lane=clamp(bearing/.9,-1,1);
    const show=punch(0,.28)*(1-punch(.39,.67));
    const pull=punch(.37,.65)*(1-punch(.70,1));
    const rest=staff?-.75:reverse?2.56:stance?.angle??-.92;
    angle=rest+lane*.65*show+(reverse?.82:-.83)*pull;
    extend=(staff?16:stance?.hand??13)+14*show-7*pull;
    handY=(staff?-44:stance?.height??-45)+lane*7*show-5*pull;
    if(dual){offPitch+=(reverse?-.23:.28)*pull;offHand-=7*show;offY-=7*pull;}
    lean+=9*show-7*pull;torsoTurn+=lane*(.31*show-.23*pull);bend+=5*pull;
    trail=0;offTrail=0;
  }
  if(swings&&authored?.tactical){
    const before=primaryContact*.48;
    const slip=punch(0,before)*(1-punch(before,primaryContact));
    const cover=punch(primaryContact,Math.min(.84,primaryContact+.22))*(1-punch(.87,1));
    if(authored.tactical==='slip_counter'){
      lean-=7*slip;bend+=8*slip;wide+=6*slip;angle-=.18*slip;
    }else if(authored.tactical==='moving_guard'){
      lean-=4*slip;wide+=7*slip+cover*3;bend+=3.7*slip;angle-=.53*slip;
      if(dual)offPitch+=.57*slip;
    }else{
      handY-=8*slip;lean-=4*slip;angle+=.42*slip;torsoTurn-=.19*slip;
    }
  }
  if(f.airStrike&&swings){
    const moves={
      air_cut:[-1.04,.82,-8,5,3],air_point:[-.16,.24,4,3,1],
      air_guard:[-.58,.39,-5,2,3],air_scissor:[.74,-.63,6,8,2],
      air_drop:[-1.38,1.02,-15,11,6],air_weave:[.45,-.77,1,6,2],
      air_rake:[.84,-.46,9,9,3],
    };
    const [turn,finish,height,reach,tuck]=moves[f.airStrike as keyof typeof moves]??moves.air_cut;
    const loaded=punch(0,primaryContact*.55)*(1-punch(primaryContact*.55,primaryContact));
    const released=punch(primaryContact,primaryContact+(1-primaryContact)*.36)*(1-punch(.81,1));
    const motion=reducedMotion?.63:1;
    angle+=motion*(turn*loaded+finish*released);
    handY+=height*loaded+height*.38*released;
    extend+=reach*released;offY-=tuck*loaded;
    lean-=tuck*loaded;torsoTurn+=motion*(turn*.28*loaded+finish*.17*released);
  }
  const family:string|null=(swings||action==='force')&&(f.attack||f.attackFamily)
    ?visualFamily(f as Parameters<typeof visualFamily>[0],action,authored):null;
  if(family){
    const row=ATTACK_BEATS[family as keyof typeof ATTACK_BEATS], after=t>primaryContact;
    const actualSecond=rearTiming>0&&f.actionDuration!>0?rearTiming/f.actionDuration!:0;
    const beats=actualSecond>primaryContact&&actualSecond<1?[primaryContact,actualSecond]:[primaryContact];
    const motion=(after&&actualSecond>primaryContact&&t<actualSecond?0:contactEnvelope(t,beats,row.bias[Number(after)]))*(reducedMotion?.60:1);
    const [tip,reach,height,shift,knees,rotate,cover,base]=after?row.out:row.load;
    const chamber=f.attackVariant==='outside'?-1:1;
    const sign=(reverse?-1:1)*chamber;
    const kitScale=staff?.52:dual?.76:1;
    if(!staff&&!dual&&!reverse)angle=mix(angle,stance?.angle??-.92,motion*.45);
    angle+=tip*motion*kitScale*sign*(staff?.85:.70);
    extend+=reach*motion*kitScale;handY+=height*motion;
    lean+=shift*motion; bend+=knees*motion;wide+=base*motion;
    torsoTurn+=rotate*motion*sign;
    if(!staff){
      offY+=cover*motion;
      if(dual)offPitch-=tip*motion*.28*sign;
      else if(!stance?.two)offHand-=reach*motion*.38;
    }
  }
  if(f.weaponFlow===true&&family&&swings&&f.attack){
    const kit=staff?'staff':dual?(reverse?'reverseDual':'dual'):reverse?'reverse':'single';
    const secondary=rearTiming>0&&f.actionDuration!>0?rearTiming/f.actionDuration!:0;
    const flow=sampleWeaponFlow({kit,family,t,first:primaryContact,second:secondary,
      rear:f.staffLead==='rear'||f.attackSpec?.leadBlade==='rear',
      side:f.attackVariant==='outside'?-1:1,reduced:reducedMotion});
    angle+=flow.pitch;extend+=flow.reach;handY+=flow.height;
    lean+=flow.lean;bend+=flow.bend;torsoTurn+=flow.twist;
    if(dual){offPitch+=flow.offPitch;offHand+=flow.offReach;offY+=flow.offHeight;}
  }
  const committedStyle=f.attackSpec?.chessStyle==='pawn'&&f.attackSpec.chessPromoted===true?'queen':f.attackSpec?.chessStyle;
  const styleArm=f.styleChoreo===true&&swings&&f.attack&&!f.saberOff&&
    !f.attackSpec?.forceAbility&&!f.attackSpec?.freeHand&&phaseAir==='grounded'
    ?sampleChessSwing(committedStyle!,{elapsed:f.actionTime,duration:f.actionDuration,contact:f.attackSpec?.contact,
      offContact:rearTiming,kit:staff?'staff':dual?'dual':'single',
      handedness:(Math.sign(val(authored?.motion?.finish)-val(authored?.motion?.chamber))||1)*hdx*(reverse?-1:1)})
    :null;
  if(styleArm){
    extend+=styleArm.reach;handY+=styleArm.height;lean+=styleArm.lean;bend+=styleArm.bend;torsoTurn+=styleArm.twist;
    if(dual){offHand+=styleArm.offReach;offY+=styleArm.offHeight;}
    else if(!staff&&stance?.two){offHand+=styleArm.reach*.75;offY+=styleArm.height*.74;}
  }
  const phrase=f.peasantMotion===true&&f.attack&&swings&&!f.saberOff&&!f.attackSpec?.forceAbility&&
    !f.attackSpec?.freeHand?samplePeasantPhrase({family:family!,time:f.actionTime,duration:f.actionDuration,contact:f.attackSpec?.contact,
      offContact:rearTiming,kit:staff?'staff':dual?'dual':'single',linked:!!f.chainFrom,
      side:hdx*(f.attackVariant==='outside'?-1:1)*(reverse?-1:1)}):null;
  if(phrase){
    extend+=phrase.reach;handY+=phrase.height;lean+=phrase.lean;torsoTurn+=phrase.twist;
    if(dual){offHand+=phrase.offReach;offY+=phrase.offHeight;}
    else if(!staff&&stance?.two){offHand+=phrase.reach*.69;offY+=phrase.height*.69;}
  }
  const freeHandAction=action==='freehand'&&!dual&&f.attackSpec?.freeHand===true;
  let freeHandExtension=0, freeHandReleased=0;
  if(freeHandAction){
    const type=({
      unarmed_palm:[14,38,-40,-4,2,-.8],
      unarmed_hook:[19,31,-50,-12,3,-.64],
      unarmed_low_check:[8,28,-31,-2,13,-.91],
      unarmed_spin:[15,38,-44,-8,4,-1.39],
    } as Record<string,number[]>)[f.technique!]??[12,32,-42,-6,4,-.94];
    const [draw,reach,targetY,height,drop,pitch]=type;
    const contact=liveContact??.43, chamberAt=contact*.52;
    const chamber=punch(0,chamberAt)*(1-punch(chamberAt,contact));
    const release=punch(chamberAt,contact)*(1-punch(contact,Math.min(.94,contact+.43)));
    const settle=punch(contact,Math.min(.82,contact+.24))*(1-punch(.89,1));
    const restPitch=staff?-.75:reverse?2.56:stance?.angle??-.92;
    // Pull the still-live saber in tight and away from the palm's line.
    angle=restPitch+pitch*release-.29*chamber;
    extend=(staff?16:stance?.hand??13)-4.7*chamber-12.2*release;
    handY=(staff?-44:stance?.height??-45)-6*release;
    offHand-=draw*chamber;offHand=mix(offHand,reach,release);
    offY=mix(offY+height*chamber,targetY,release);
    lean+=release*10-chamber*4.7; bend+=drop*release+chamber*5;
    torsoTurn+=release*.23-chamber*.24-settle*.11;
    wide+=6.4*release;freeHandExtension=release;freeHandReleased=Math.max(chamber,release,settle*.48);
    trail=0;offTrail=0;
  }
  const entry=f.poseFrom;
  const stanceFlow=f.stanceFlow===true;
  const flowingCut=stanceFlow&&swings&&f.attack&&!f.saberOff&&!f.attackSpec?.forceAbility&&!f.attackSpec?.freeHand;
  const stanceBeat=f.attackSpec?.contact;
  if(flowingCut&&isFinite(stanceBeat)&&stanceBeat!>0){
    const elapsed=val(f.actionTime), after=Math.max(.06,val(f.actionDuration,.3)-stanceBeat!);
    const load=smooth(elapsed/(stanceBeat!*.88))*(1-smooth((elapsed-stanceBeat!)/(after*.88)));
    if(phaseAir==='airborne'){
      // The existing flight rotates and tucks on its own clock, even while
      // an aerial cut plays. The strike unfolds from that moving chassis.
      const linear=family==='thrust'||family==='lunge';
      lean=mix(lean,Math.min(lean,linear?10:6),load*.69);
      bend=mix(bend,Math.min(bend,4),load*.42);
      torsoTurn+=load*(f.attackVariant==='outside'?-.13:.13);
    }else if(phaseAir==='grounded'&&(f.chainFrom||val(f.chainDepth)>1)){
      const wasForward=val(entry?.body?.lean)>8;
      const even=(val(f.chainDepth,2)%2)===0;
      const direction=(f.attackVariant==='outside'?-1:1)*(even?-1:1);
      // A follow-up can pivot around the hips or recoil then cut, rather
      // than repeating the lead cut's forward waist fold on every beat.
      const target=wasForward?1.5:even?3:8;
      lean=mix(lean,target,load*(wasForward?.91:even?.84:.72));
      bend=mix(bend,even?-1:3,load*.72);
      torsoTurn=mix(torsoTurn,direction*(even?.72:.54),load*.90);
      wide+=load*(even?2.3:.7);
    }
  }
  const liveEntry=f.liveEntry===true&&entry?.body&&f.attack&&swings&&!f.saberOff&&
    phaseAir==='grounded'&&!f.chainFrom&&!(f.chainDepth!>1)&&
    !f.attackSpec?.forceAbility&&!f.attackSpec?.freeHand&&isFinite(entry.facing);
  const entryLimit=f.attack&&isFinite(stanceBeat)?stanceBeat!*((flowingCut||liveEntry)?.79:.70):Infinity;
  const entryDuration=Math.min(val(f.poseEntryDuration),entryLimit);
  const feed=entry&&entryDuration>0&&action!=='clash'&&action!=='ko'
    ?1-smooth((val(f.actionTime)+val(f.poseEntryOffset))/entryDuration):0;
  let bodyForward=forward;
  if(liveEntry&&feed>0){
    // Project the captured orientation on the screen through the true
    // circular turn, never a binary left/right stance flip.
    const delta=Math.atan2(Math.sin(entry.facing!-facing),Math.cos(entry.facing!-facing));
    const heading=facing+delta*feed;
    bodyForward=Math.sin(Math.cos(heading)*Math.PI*.5);
    rhythm=mix(rhythm,val(entry.body!.rhythm,rhythm),feed);
    if(!reducedMotion){
      const oldScreenRoll=val(entry.body!.roll)*(Math.cos(entry.facing!)<0?-1:1);
      roll=mix(roll,oldScreenRoll/flightSide,feed);
    }
  }
  if(feed>0&&entry!.body){
    lean=mix(lean,val(entry!.body.lean,lean),feed);
    bend=mix(bend,val(entry!.body.bend,bend),feed);
    wide=mix(wide,val(entry!.body.wide,wide),feed);
    torsoTurn=mix(torsoTurn,val(entry!.body.torsoTurn,torsoTurn),feed);
    if(liveEntry&&!reducedMotion&&isFinite(entry.stride?.bearing)){
      // Let the last real stride load the waist during the turn. Zero at
      // both ends so it cannot introduce a fresh entry or release pop.
      const kick=4*feed*(1-feed),travel=entry.stride;
      const relative=travel!.bearing!-facing;
      const pace=clamp(Math.hypot(val(travel!.vx),val(travel!.vy))/145);
      lean+=Math.cos(relative)*pace*3.8*kick;
      bend+=(travel!.kind==='guard'?2.2:pace*1.5)*kick;
      torsoTurn+=Math.sin(relative)*pace*.26*kick;
    }
    if(flowingCut&&!reducedMotion&&phaseAir==='airborne'&&entry!.body.airPhase==='airborne'){
      // Blend about the measured waist; the sword/world transforms share
      // the same new pivot below, including the captured old emitter.
      roll=mix(roll,val(entry!.body.roll,roll),feed*.92);
    }
  }
  const waist=P(bodyForward*lean*.55+torsoTurn*.9,-39+bend*.58+rhythm-type.legLength);
  const pelvis=P(waist.x-bodyForward*1.25,waist.y+10);
  const shoulder=P(bodyForward*lean+torsoTurn*7,-57+bend+rhythm-type.legLength);
  const head=P(shoulder.x+bodyForward*2.6,-75+bend+rhythm-type.legLength);
  const helmet=head; // legacy pose inspection alias, never renders a helmet

  let hand=P(shoulder.x+forward*extend,handY+bend*.45+rhythm+dy*5);
  let backHand=P(shoulder.x+forward*offHand,offY+bend*.45+rhythm-dy*3+dy*27*freeHandExtension);
  const airStyle=confirmedAir?aerialLowerBody(form,phaseAir!,airProgress,reducedMotion,trick.kind):null;
  const legs=[0,1].map(side=>{
    const sign=side?1:-1;
    const driving=action==='dash'||action==='rush'||action==='sidestep'||action==='backstep';
    const drivePhase=reducedMotion?0:Math.sin(Math.PI*t);
    const flight=confirmedAir?phaseAir==='airborne':hop>1.2;
    const toeLift=driving&&!flight?drivePhase*(side?8:1.4) : flight?(side?airGather*9:airGather*4):0;
    const footArc=gait?gaitFeet![side]:{reach:(side?12:-12)+sign*(wide-plantedWidth+
      (action==='dash'?drivePhase*8:0))+legShift+airGather*(side?13:-5),lift:toeLift,sole:driving?(side?-.31:.29)*drivePhase:0,
      planted:toeLift<.6&&!flight};
    const basis=gait?travel:P(dx,dy);
    const lateral=gait?7:9;
    const pickup=trick.kind==='cross-vault'?(side?19:6):trick.kind==='high-vault'?(side?17:19):(side?12:17);
    const tuck=flight?(confirmedAir?airGather*(form==='ataru'?11:6)+trick.tuck*pickup:hop*.26):0;
    const travelReach=footArc.reach/(gait?type.scale:1);
    const foot=P(travelReach*basis.x-sign*basis.y*lateral,-1+travelReach*basis.y+sign*basis.x*lateral*.65-footArc.lift-tuck);
    if(action==='sidestep'){
      foot.x-=dy*stanceShift*(side?18:5);foot.y+=dx*stanceShift*(side?17:3);
    }else if(action==='backstep'){
      foot.x-=dx*stanceShift*(side?4:13);foot.y-=dy*stanceShift*(side?4:13);
    }
    if(gaitWeight>0&&gaitWeight<1){
      const reach=sign*(12+wide);
      foot.x=mix(reach*dx-sign*dy*9,foot.x,gaitWeight);
      foot.y=mix(-1+reach*dy+sign*dx*9*.65,foot.y,gaitWeight);
    }
    const legShape=side?airStyle?.lead:airStyle?.trail;
    if(legShape&&flight){
      const compact=airStyle!.flight*(form==='soresu'?.68:form==='niman'?.29:0);
      foot.x=mix(foot.x,pelvis.x,compact)+legShape[0]*dx;
      foot.y+=legShape[0]*dy*.47-legShape[1];
    }
    const hip=P(pelvis.x+sign*type.hip*.49,pelvis.y+sign*1.5+(airStyle?.hip??0));
    const kneeLoad=(airStyle?.knee??0)*(side?1:.55);
    const k=P(mix(hip.x,foot.x,.55)+forward*((gait?4.2:6.2)+trick.tuck*(side?9:5.0)+kneeLoad*.55),mix(hip.y,foot.y,.50)-footArc.lift*.19-trick.tuck*(side?6.7:3.4)-kneeLoad*.35);
    const toes=P(foot.x+forward*11,foot.y+1+footArc.sole*7);
    return {side,foot,hip,k,toes,planted:footArc.planted};
  }).sort((a,b)=>a.foot.y-b.foot.y);
  if(feed>0&&Array.isArray(entry!.legs)&&(['dash','dash_recover','force_recover','weapon_recover','pivot'].includes(entry!.kind!)||
      (flowingCut&&phaseAir==='airborne'&&entry!.body?.airPhase==='airborne')||liveEntry)){
    const {local}=arcadeBasis(f,{type,roll,trick,hdx,flightSide,waist,hop});
    const originX=val(entry!.origin?.x,val(f.x)), originY=val(entry!.origin?.y,val(f.y));
    const shift=P(val(f.x)-originX,val(f.y)-originY);
    const good=(p?:Point):p is Point=>isFinite(p?.x)&&isFinite(p?.y);
    for(const leg of legs){
      const prior=entry!.legs.find(l=>l.side===leg.side);
      if(!good(prior?.foot)||!good(prior?.toes)||!good(prior?.k))continue;
      // A grounded sole stays in world space while the hips pass over it.
      // Airborne or traveling limbs follow the actor. A very fast dash
      // gradually releases the hold before a robe-length leg can stretch.
      const drift=smooth((Math.hypot(shift.x,shift.y)-8)/23);
      const lock=prior.planted&&!airGather?1-drift:0;
      const carry=(p:Point,amount:number)=>local(P(p.x+shift.x*amount,p.y+shift.y*amount));
      const source=carry(prior.foot,1-lock), toe=carry(prior.toes,1-lock);
      const knee=carry(prior.k,1-lock*.55);
      const blend=(p:Point,q:Point,w:number)=>P(mix(p.x,q.x,w),mix(p.y,q.y,w));
      leg.foot=blend(leg.foot,source,feed);
      leg.toes=blend(leg.toes,toe,feed);
      leg.k=blend(leg.k,knee,feed*.94);
      if(feed>.72&&lock>.7)leg.planted=true;
    }
    legs.sort((a,b)=>a.foot.y-b.foot.y);
  }
  const bladeLength=(action==='rush'?55:form==='makashi'?47:form==='shii_cho'?53:49)*(arcadeSaberVariant(f.gear?.weapon)?.blade??1);
  // All kits use a polar screen projection: at a depth turn neither
  // component can cancel the other and make a solid saber disappear.
  const axis=Math.atan2(dy,dx), pitchScale=dx+dy*.35;
  const aim=(h:Point,p:number,len:number)=>P(h.x+Math.cos(p)*len,h.y+Math.sin(p)*len);
  let blade=aim(hand,axis+angle*(staff?1:pitchScale)+(styleArm?.yaw??0)+(phrase?.yaw??0),bladeLength);
  let offBlade=dual?aim(backHand,axis+offPitch*pitchScale+(styleArm?.offYaw??0)+(phrase?.offYaw??0),35):null;
  // Both staff emitters are derived from the exact same axis, even when its
  // rear blade binds at a measured world point.
  const shaftEnd=(h:Point,b:Point,d:number)=>{const n=Math.hypot(b.x-h.x,b.y-h.y)||1;return P(h.x+(b.x-h.x)*d/n,h.y+(b.y-h.y)*d/n);};
  const saberPhase=f.gear?.dualPhase===true&&f.saberPhase==='long'?'long':'short';
  const phaseScale=saberPhase==='long'?ARCADE_LONG_BLADE_SCALE:1;
  const phaseAge=time-val(f.saberPhaseChangedAt,-Infinity);
  const ignition=!reducedMotion&&f.gear?.dualPhase===true&&phaseAge>=0&&phaseAge<.18?1-smooth(phaseAge/.18):0;
  if(!staff&&phaseScale!==1){
    blade=P(hand.x+(blade.x-hand.x)*phaseScale,hand.y+(blade.y-hand.y)*phaseScale);
    if(offBlade)offBlade=P(backHand.x+(offBlade.x-backHand.x)*phaseScale,backHand.y+(offBlade.y-backHand.y)*phaseScale);
  }
  const staffLength=42*phaseScale,halfGrip=12;
  if(staff){blade=shaftEnd(hand,blade,halfGrip+staffLength);offBlade=shaftEnd(hand,blade,-halfGrip-staffLength);}
  if(feed>0){
    const basis={type,roll,trick,hdx,flightSide,waist,hop};
    const {local}=arcadeBasis(f,basis);
    const has=(p?:Point):p is Point=>isFinite(p?.x)&&isFinite(p?.y);
    const follow=has(entry!.origin)?P(val(f.x)-entry!.origin.x,val(f.y)-entry!.origin.y):P(0,0);
    const actor=(p:Point)=>local(P(p.x+follow.x,p.y+follow.y));
    const shift=(a:Point,b:Point)=>P(mix(a.x,b.x,feed),mix(a.y,b.y,feed));
    const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
    const recovery=entry!.kind==='dash_recover'||entry!.kind==='force_recover'||entry!.kind==='weapon_recover';
    const momentum=f.styleChoreo===true||f.peasantMotion===true?entry!.momentum:null;
    const elapsed=clamp(val(f.actionTime)+val(f.poseEntryOffset),0,entryDuration);
    // Unit initial derivative; decays to zero at the target, like taking a
    // wrist through the end of the cut rather than freezing one grip sample.
    const carryTime=momentum?elapsed*(1-elapsed/entryDuration)**2:0;
    function carry(h:Point,b:Point,source:Partial<BladeSource>|null|undefined,secondary=false):[Point,Point]{
      if(!has(source?.hand)||!has(source?.tip))return [h,b];
      const oldH=actor(source.hand),oldB=actor(source.tip);
      const delta=Math.atan2(b.y-h.y,b.x-h.x);
      const was=Math.atan2(oldB.y-oldH.y,oldB.x-oldH.x);
      let arc=wrap(was-delta);
      if(recovery||momentum){
        // Select the angular branch relative to the old facing, not the
        // changing target each frame. Looking back across a recovery can
        // cross the antipode without flipping the arc mid-interpolation.
        const captured=isFinite(entry!.facing)?entry!.facing:null;
        const worldRotation=arcadeRigRotation(basis);
        const wasWorld=Math.atan2(source.tip.y-source.hand.y,source.tip.x-source.hand.x);
        const offRest=secondary?(reverse?2.70:-2.26):null;
        const neutral=offRest??(staff?-.75+((stance?.angle??-1.05)+1.05)*.17:reverse?2.54:stance?.angle??-.92);
        const anchor=captured??wasWorld;
        const reference=anchor+neutral*(staff?1:Math.cos(anchor)+Math.sin(anchor)*.35);
        const stableFacing=captured??wasWorld;
        const localPitch=secondary?offPitch:angle;
        const referencePitch=neutral*(staff?1:Math.cos(stableFacing)+Math.sin(stableFacing)*.35);
        // Compose facing travel and the authored joint pitch separately;
        // neither depends on the mutable shortest blade-to-blade angle.
        const liveStyle=momentum?(secondary?(styleArm?.offYaw??0)+(phrase?.offYaw??0):(styleArm?.yaw??0)+(phrase?.yaw??0)):0;
        const swing=wrap(facing-stableFacing)+localPitch*(staff?1:pitchScale)-referencePitch+worldRotation+liveStyle;
        arc=wrap(wasWorld-reference)-swing;
      }
      const velocity=secondary?momentum?.offhand:momentum?.main;
      const phraseEntry=f.peasantMotion===true&&momentum?peasantHandoff(elapsed,entryDuration,secondary):null;
      const w=phraseEntry?.feed??feed, tangent=phraseEntry?.tangent??carryTime;
      const pitch=delta+arc*w+val(velocity?.angle)*tangent;
      const oldSpan=Math.hypot(oldB.x-oldH.x,oldB.y-oldH.y);
      const span=mix(Math.hypot(b.x-h.x,b.y-h.y),oldSpan,w), grip=phraseEntry?P(mix(h.x,oldH.x,w),mix(h.y,oldH.y,w)):shift(h,oldH);
      const vx=val(velocity?.x)*tangent,vy=val(velocity?.y)*tangent;
      const stay=velocity?actor(P(source.hand.x+vx,source.hand.y+vy)):oldH;
      const carried=P(grip.x+stay.x-oldH.x,grip.y+stay.y-oldH.y);
      return [carried,aim(carried,pitch,span)];
    }
    if(staff&&has(entry!.hand)&&has(entry!.tip)){
      const [grip,tip]=carry(shaftEnd(hand,blade,halfGrip),blade,entry);
      hand=shaftEnd(grip,tip,-halfGrip);
      blade=tip;offBlade=shaftEnd(hand,blade,-Math.hypot(tip.x-hand.x,tip.y-hand.y));
    }else if(!staff){
      [hand,blade]=carry(hand,blade,entry);
      if(dual)[backHand,offBlade]=carry(backHand,offBlade!,entry!.offhand,true);
      else if(has(entry!.freeHand))backHand=shift(backHand,actor(entry!.freeHand));
    }
    if(staff&&freeHandAction&&has(entry!.freeHand))backHand=shift(backHand,actor(entry!.freeHand));
  }
  let clash=null;
  if(action==='clash'&&isFinite(f.clashX)&&isFinite(f.clashY)) {
    const basis={type,roll,trick,hdx,flightSide,waist,hop};
    const useOffhand=Boolean(offBlade&&f.clashFrom?.offhand===true);
    const oldTip=useOffhand?offBlade!:blade;
    const oldHand=staff?shaftEnd(hand,oldTip,halfGrip):useOffhand?backHand:hand;
    clash=clashBind(f as Parameters<typeof clashBind>[0],basis,oldHand,oldTip,t,reducedMotion);
    if(staff){
      hand=shaftEnd(clash.hand,clash.tip,-halfGrip);
      if(useOffhand){offBlade=clash.tip;blade=shaftEnd(hand,offBlade!,-halfGrip-staffLength);}
      else{blade=clash.tip;offBlade=shaftEnd(hand,blade,-halfGrip-staffLength);}
    }else if(useOffhand){ backHand=clash.hand;offBlade=clash.tip;offActive=clash.bound?1:offActive; }
    else{
      if(stance?.two&&!offBlade){
        const oldBack=backHand;
        backHand=P(mix(oldBack.x,clash.hand.x-forward*5,clash.bindWeight),mix(oldBack.y,clash.hand.y+3,clash.bindWeight));
      }
      hand=clash.hand;blade=clash.tip;
    }
  }
  const emitter=staff?shaftEnd(hand,blade,halfGrip):hand;
  const offEmitter=staff?shaftEnd(hand,offBlade!,halfGrip):backHand;
  if(staff){
    const held=shaftEnd(hand,offBlade!,7.5);
    if(!freeHandAction)backHand=held;
    else backHand=P(mix(held.x,backHand.x,freeHandReleased),mix(held.y,backHand.y,freeHandReleased));
  }
  let frontElbow=staff||dual
    ?P(mix(shoulder.x+forward*type.shoulder*.56,hand.x,.49)+forward*(reverse?-4:1.5),mix(shoulder.y,hand.y,.51)+(staff?9:7))
    :P(mix(shoulder.x,hand.x,.51)+forward*(reverse?-5:.5),mix(shoulder.y,hand.y,.58)+(reverse?3:7));
  let backElbow=staff||dual
    ?P(mix(shoulder.x-forward*type.shoulder*.69,backHand.x,.52)-forward*(staff?3.9:4.8),mix(shoulder.y,backHand.y,.48)+(staff?10:6))
    :P(mix(shoulder.x,backHand.x,.52)-forward*7,mix(shoulder.y,backHand.y,.55)+6);
  if(phrase){
    frontElbow=P(frontElbow.x+phrase.elbow*2.5,frontElbow.y+Math.abs(phrase.elbow)*2.1);
    backElbow=P(backElbow.x+phrase.offElbow*2.2,backElbow.y+Math.abs(phrase.offElbow)*1.7);
  }
  return {type,form,action,t,dy,forward,hdx,flightSide,lean,bend,wide,torsoTurn,hop,roll,trick,legs,waist,pelvis,shoulder,head,helmet,hand,backHand,frontElbow,backElbow,blade,offBlade,staff,reverse,saberPhase,ignition,emitter,offEmitter,offTrail,offActive,trail,outline,clash,
    phase:age,...(f.liveEntry===true?{rhythm,bodyForward}:{}),gait:gait?(run>.55?'run':'walk'):'none',attackFamily:family,...(phrase?{peasantPhrase:phrase}:{}),...(styleArm?{chessChoreo:styleArm}:{}),freeHandAction,freeHandExtension,poseEntryActive:feed>0,poseEntryBlend:feed,airPhase:phaseAir,airStyle:airStyle?.name??null,airSilhouette:airStyle?.flight??0,palette:PALETTES[f.team===1?1:0],reducedMotion};
}

const INK='#181619';
// Detached pads are silhouettes in their own right. Nothing is drawn from
// the ankle to a knee or hip, or from the rounded mitt back to the shoulder.
function footArt(ctx:Canvas, leg:Leg, fwd:number, c:Palette, type:Figure, near:boolean, color:string|null=null){
  const {foot,toes}=leg, dir=fwd||.001, press=leg.planted?1:0;
  const scale=type.id==='rabbit'?1.04:1;
  const toe=clamp((toes.x-foot.x)*.44,-5,5), shape=(x:number,y:number):[number,number]=>[foot.x+x*scale+toe,foot.y+y];
  const tilt=clamp((toes.y-foot.y)*.35,-2.1,2.1)-press*.2;
  celPath(ctx,[['M',...shape(-8,0)],['Q',...shape(-8.6,-5.8),...shape(-2,-6.8)],
    ['Q',...shape(4,-6.9+tilt),...shape(8,-3.2+tilt)],['Q',...shape(11.2,1+tilt),...shape(6.5,3.35)],
    ['Q',...shape(-1,4),...shape(-6.1,2.45)],['Q',...shape(-8,1.45),...shape(-8,0)],['Z']],
    color??(near?'#38393d':'#252629'),color?null:INK,1.85);
  if(color)return;
  line(ctx,[P(...shape(-5.6,1.6)),P(...shape(5.6,1.5))],near?'#8b8d8e':'#4c4e51',1.18);
  if(near)line(ctx,[P(...shape(-1*dir,-4.4)),P(...shape(2.6*dir,-3.7))],c.steel,.85);
}
function handArt(ctx:Canvas, p:Point, elbow:Point, d:number, type:Figure, near:boolean, c:Palette, color:string|null=null){
  const u=unit(elbow,p), h=(x:number,y:number):[number,number]=>at(p,u,x,y);
  // A circular leather mitt with a curled thumb, not a cylindrical cuff.
  celPath(ctx,[['M',...h(-5.8,0)],['C',...h(-6,-4.1),...h(-3.2,-6.1),...h(.4,-6)],
    ['Q',...h(4.7,-6.1),...h(6,-2.9)],['Q',...h(9.1,-1.4),...h(6.6,1.7)],
    ['Q',...h(5.4,6),...h(1.7,6.1)],['C',...h(-3.4,6.35),...h(-6.4,3.6),...h(-5.8,0)],['Z']],
    color??(near?'#e4d6c6':'#bda99a'),color?null:INK,1.72);
  if(color)return;
  line(ctx,[P(...h(2.1,-3.5)),P(...h(4.1,-1.72)),P(...h(3.8,.2))],near?'#88756a':'#6f5b53',1.13);
  if(near)line(ctx,[P(...h(-2.8,-2.3)),P(...h(-1.8,-3.9)),P(...h(.0,-4.4))],'#f6ebdd',.92);
}
function openPalmArt(ctx:Canvas, r:PaintRig, c:Palette){
  const h=r.backHand, u=unit(r.backElbow,h), A=(x:number,y:number):[number,number]=>at(h,u,x,y);
  celPath(ctx,[['M',...A(-5.1,-2.3)],['Q',...A(-2,-5.5),...A(1,-4.4)],
    ['L',...A(7.4,-4.35)],['Q',...A(10,-3.8),...A(9.1,-2.0)],['L',...A(6.9,-.9)],
    ['Q',...A(11.2,-1.1),...A(10.6,.9)],['L',...A(6.5,2.5)],['Q',...A(8.3,3.2),...A(5.4,4.1)],
    ['L',...A(.3,5.3)],['Q',...A(-3,5.4),...A(-5.3,2)],['Z']],'#dec9b4',INK,1.54);
  line(ctx,[P(...A(2.3,-1.8)),P(...A(5.6,-.8)),P(...A(3.4,1.8))],'#96786d',.88);
}
function rabbitEars(ctx:Canvas, r:PaintRig, color:string|null=null){
  const {head,hdx:d}=r;
  const air=r.trick?.tuck??0;
  const lag=r.reducedMotion?0:clamp(Math.abs(r.lean)*.14+air*5+(r.styleSpin?.cloth??0)*.24+
    (['dash','hit','leap','ko'].includes(r.action)?Math.sin(Math.PI*r.t)*7:0),0,13);
  const A=(x:number,y:number):[number,number]=>[head.x+x,head.y+y];
  for(const side of [0,1]){
    const b=side?4.8:-4.8, k=side?-1:1;
    const tip=b+(side?8:-9)-lag*(side?.69:1.02)*r.forward;
    const y=-(side?42:38)+lag*(side?.61:.42);
    celPath(ctx,[['M',...A(b-3.5,-9)],['Q',...A(b-4+k*1.1,-22),...A(tip-3,y+7)],
      ['Q',...A(tip-5,y-1),...A(tip,y)],['Q',...A(tip+5,y+.5),...A(tip+5,y+7)],
      ['Q',...A(b+4-lag*.23,-22),...A(b+4,-8)],['Z']],color??(side?'#ded6cd':'#a8a1a0'),color?null:INK,1.9);
    if(!color)celPath(ctx,[['M',...A(b-1.1,-12)],['Q',...A(b-1.25-lag*.24,-23),...A(tip-.75,y+5.4)],
      ['Q',...A(tip+1.9,y+3.7),...A(tip+2.1,y+8)],['Q',...A(b+1.2-lag*.32,-22),...A(b+1.55,-12)],['Z']],side?'#aa7f82':'#827074');
  }
}
function rabbitHead(ctx:Canvas, r:PaintRig, c:Palette, lowDetail:boolean){
  rabbitEars(ctx,r);
  const turn=r.styleSpin, profile=turn?mix(1,.60,turn.amplitude):1;
  const A=(x:number,y:number):[number,number]=>[r.head.x+r.hdx*x*profile,r.head.y+y];
  const M=(x:number,y:number):['M',number,number]=>['M',...A(x,y)],L=(x:number,y:number):['L',number,number]=>['L',...A(x,y)],Q=(x:number,y:number,u:number,v:number): ['Q',number,number,number,number]=>['Q',...A(x,y),...A(u,v)];
  const focused=['guard','parry','clash','slash','sweep','rush','leap','feint','force'].includes(r.action);
  celPath(ctx,[M(-11,-6),Q(-10,-14,-2,-14),Q(6,-15,12,-8),Q(13,-3,11,.5),
    Q(12,4,8,8),Q(1,13,-8,8),Q(-14,3,-11,-6),['Z']],'#ede2d4',INK,2.1);
  celPath(ctx,[M(-11,-5),Q(-11,2,-6,6),Q(1,10,9,5),Q(6,12,-2,11),Q(-13,8,-11,-5),['Z']],'#b4a397');
  const eye='#342724';
  if((turn?Math.sin(turn.face):r.dy)<-.58){
    celPath(ctx,[M(-10,-7),Q(-11,-14,1,-14),Q(11,-13,12,-3),Q(12,7,6,9),Q(-1,13,-7,8),Q(-12,3,-10,-7),['Z']],'#d2c5bb',INK,1.5);
    line(ctx,[P(...A(-1,-9)),P(...A(-1,-2))],'#988b84',1.05);
    return;
  }
  if(r.action==='hit'||r.action==='ko'){
    for(const x of [-3,6]){
      line(ctx,[P(...A(x-2,-3)),P(...A(x+1.4,0))],eye,1.3);
      if(r.action==='hit')line(ctx,[P(...A(x+1.4,-3)),P(...A(x-2,0))],eye,1.25);
    }
  }else{
    celPath(ctx,[M(-5,focused?-4:-2.7),L(.5,-2.7),Q(-.5,1,-3.7,-.2),['Z']],eye);
    celPath(ctx,[M(4,-2.8),L(9,focused?-4:-2.8),Q(8.6,.4,5,.3),['Z']],eye);
  }
  celPath(ctx,[M(6.2,3.0),L(9.4,2.5),Q(9.9,4.3,8.5,5),['Z']],'#8f696d');
  if(!lowDetail)line(ctx,[P(...A(8.5,5)),P(...A(6,6.2)),P(...A(4.4,5.9))],eye,.96);
}
// Redraw the upper silhouette around the physical grip only. The same
// world emitter and planted foot remain authoritative during every frame.
function inkAirSilhouette(r:PaintRig){
  if(!(r.airSilhouette>0))return r;
  const shapes={
    'lateral-fan':[5,-1,-3, 6, 2], 'needle-line':[13,-4,4, 5,-4],
    'sheltered-tuck':[-4,10,-3,-9, 6], 'vault-fold':[-7,5,0, -7,2],
    'hammer-step':[-13,1,5, -11,-5], 'balanced-float':[-6,-5,-4, 1,5],
    'scissor-strike':[14,8,1, 12,-3],
  };
  const [sx,sy,wx,headX,headY]=shapes[r.airStyle as keyof typeof shapes]??[0,0,0,0,0];
  const w=r.airSilhouette, d=r.forward;
  const translate=(p:Point,x:number,y:number)=>P(p.x+x*w*d,p.y+y*w);
  return {...r,shoulder:translate(r.shoulder,sx,sy),head:translate(r.head,headX,sy*.65+headY),
    waist:translate(r.waist,wx,sy*.24),
    frontElbow:translate(r.frontElbow,sx*.46,sy*.43),backElbow:translate(r.backElbow,sx*.38,sy*.50)};
}
const APPEARANCE_HAIR=[
  {ink:'#211f24',shade:'#3c3641',gleam:'#6b5f6e',coat:'#50515b',trim:'#a598a5'},
  {ink:'#352421',shade:'#513730',gleam:'#906b5d',coat:'#4e4946',trim:'#b1a28b'},
  {ink:'#393338',shade:'#575056',gleam:'#867b80',coat:'#505655',trim:'#a19d8b'},
  {ink:'#2e242d',shade:'#483544',gleam:'#785b70',coat:'#564a54',trim:'#ae96a6'},
];
const appearanceCache=new WeakMap<Fighter,{gender:string|null|undefined;seed:number|null;type:string;look:Appearance}>();
function fighterAppearance(f:Fighter, r:PaintRig):Appearance{
  const gender=['female','male','nonbinary'].includes(f.gender!)?f.gender:null;
  const seed=f.appearanceSeed??null;
  const saved=appearanceCache.get(f);
  if(saved&&saved.gender===gender&&saved.seed===seed&&saved.type===r.type.id)return saved.look;
  let number=0;
  if(seed!==null){
    number=2166136261;
    for(const char of String(seed))number=Math.imul(number^char.codePointAt(0)!,16777619)>>>0;
  }
  const femme=gender==='female'||(gender==null&&r.type.id==='woman');
  const androgynous=gender==='nonbinary';
  const softBoy=gender==='male'||(gender==null&&r.type.id==='femboy');
  const hair=femme?['bob','ribbon','braid','waves'][number%4]:
    androgynous?['waves','hood','braid','bob'][number%4]:
    softBoy?(seed===null?'hood':['softCrop','waves','hood','softCrop'][number%4]):seed===null||number%4===0?'hood':'crop';
  const shade=APPEARANCE_HAIR[(number>>>6)%APPEARANCE_HAIR.length];
  const look={...shade,femme,androgynous,softBoy,hair};
  appearanceCache.set(f,{gender,seed,type:r.type.id,look});
  return look;
}
function headArt(ctx:Canvas, r:PaintRig, c:Palette, lowDetail=false) {
  if(r.type.id==='rabbit'){rabbitHead(ctx,r,c,lowDetail);return;}
  const {head,hdx:d,type}=r, look=r.appearance, woman=look?.femme??type.id==='woman';
  const hair=look?.hair??(woman?'bob':'hood'), hood=hair==='hood', softBoy=look?.softBoy===true;
  const ink=look?.ink??'#29262c', shade=look?.shade??'#45404a', shine=look?.gleam??'#695c63';
  const turn=r.styleSpin;
  const away=smooth((-(turn?Math.sin(turn.face):r.dy)-.18)/.68);
  const profile=smooth(Math.abs(turn?Math.cos(turn.face):r.forward)/.87);
  const scale=1.24;
  const A=(x:number,y:number):[number,number]=>[head.x+d*x*scale*(.79+profile*.21),head.y+y*scale];
  const Q=(x:number,y:number,u:number,v:number): ['Q',number,number,number,number]=>['Q',...A(x,y),...A(u,v)];
  const C=(x:number,y:number,u:number,v:number,k:number,l:number): ['C',number,number,number,number,number,number]=>['C',...A(x,y),...A(u,v),...A(k,l)];
  const L=(x:number,y:number):['L',number,number]=>['L',...A(x,y)];
  const M=(x:number,y:number):['M',number,number]=>['M',...A(x,y)];
  const U=(...v:[number,number])=>P(...A(...v));
  const focused=['guard','parry','clash','slash','sweep','rush','leap','force','feint'].includes(r.action);
  const hurt=r.action==='hit', fallen=r.action==='ko';
  const tension=r.reducedMotion?0:Math.min(1,(Math.abs(r.torsoTurn)*1.33+Math.abs(r.lean)*.017)*(r.action==='ready'?.48:1));
  const stream=r.reducedMotion?0:tension*5+Math.sin(r.t*Math.PI)*(r.action==='dash'?4.2:r.action==='hit'?3.3:1.2);
  if(hair==='ribbon'){
    celPath(ctx,[M(-7,-10),C(-11,-20,-23,-19,-25,-9-stream),C(-27,-1,-23,7,-30,7+stream*.45),
      Q(-20,13,-14,3),Q(-11,-1,-8,0),['Z']],ink,INK,1.8);
    if(!lowDetail)line(ctx,[U(-13,-12),U(-18,-11),U(-21,2),U(-24,8)],shine,1.05);
    celPath(ctx,[M(-12,-9),Q(-19,-5,-16,-2),L(-15,2),Q(-13,-1,-13,-4),L(-10,-4),['Z']],c.steel,INK,.66);
  }else if(hair==='braid'){
    celPath(ctx,[M(-8,-8),C(-18,-11,-19,-1,-17,6),Q(-22,12,-20-stream*.40,18),
      Q(-17,21,-14,18),Q(-10,14,-11,8),Q(-8,5,-9,0),['Z']],ink,INK,1.75);
    for(let i=0;i<(lowDetail?2:4);i++)line(ctx,[U(-16.8-i*.64,4.1+i*3.5),U(-12.2-i*.86,5.7+i*3.5)],shine,.88);
  }else if(hair==='waves'||hair==='bob'){
    const y=hair==='waves'?17:11.5;
    celPath(ctx,[M(-9,-13),Q(-18,-9,-16,2),C(-18,8,-18-stream*.45,y,-10-stream*.48,y),
      Q(-5,y+1,-4,y-3),Q(-9,3,-6,-8),['Z']],ink,INK,1.75);
    if(!lowDetail)line(ctx,[U(-14,-2),U(-15,4),U(-12-stream*.22,y-3)],shade,1.1);
  }
  const skin=woman?'#f1dfd8':'#ebded1', chin=woman?9.8:softBoy?8.85:10;
  const nose=.65+profile*(woman?1.00:softBoy?1.12:1.8);
  celPath(ctx,[M(-10,-5),Q(-9,-11,-2,-12),Q(7,-13,10,-6),Q(10,-2,11.5,-1),
    L(9.9+nose,.35),Q(11.5,1.5,10.0,2.3),Q(10,6.7,woman?6.8:5.9,8.1),Q(woman?4.4:2.5,chin,1,chin+.45),
    Q(-5,9.8,-9,6.0),Q(-12,1.5,-10,-5),['Z']],skin,INK,1.85);
  celPath(ctx,[M(-10,-1),Q(-6,5,0,6.5),Q(5,7.3,8.6,5.8),Q(6,8.6,1,chin+.05),
    Q(-7,9.5,-10,4),['Z']],woman?'#c6a09c':'#c5aaa1');
  const eye='#312628';
  if(away>.35){
    celPath(ctx,[M(-10,-6),Q(-10,-13,0,-14),Q(10,-13,11,-4),Q(10,8,4,10),Q(0,11,-5,10),Q(-11,7,-10,-6),['Z']],
      hood?'#91867b':ink,INK,1.7);
    if(!lowDetail)line(ctx,[U(0,-10),U(0,-1),U(-2,6)],hood?'#b1a597':shade,1.02);
    return;
  }
  if(fallen){
    line(ctx,[U(-3,-1),U(.5,.1)],eye,1.18);line(ctx,[U(4,.15),U(7.8,-.75)],eye,1.15);
  }else if(hurt){
    line(ctx,[U(3.7,-2.6),U(6.2,-.9),U(4,.2)],eye,1.45);
    if(profile<.82)line(ctx,[U(-3.2,-2.6),U(-.5,-1.2),U(-2.9,.3)],eye,1.17);
    celPath(ctx,[M(4.2,4.2),Q(6,3.1,7.1,4.4),Q(6.5,6.2,4.8,5.8),['Z']],eye);
  }else{
    const brow=focused?(woman||softBoy?-.26:-.48):0, gaze=focused?.20:0;
    if(profile<.8)line(ctx,[U(-4.1,-1.65),U(-2,-1.97-brow),U(-.25,-1.32)],eye,1.05);
    celPath(ctx,[M(3.5,-1.55),Q(5,-2.45-brow,7.05,-2.0),Q(7.9,-2.08,8.35,woman?-2.21:-2.53),
      Q(7.8,-.40,6.0,-.37),Q(4.62,-.23,3.5,-1.55),['Z']],eye);
    if(!lowDetail){
      line(ctx,[U(6.08+gaze,-1.27),U(6.68+gaze,-1.42)],'#f9eded',.60);
      if(woman||softBoy||look?.androgynous)line(ctx,[U(7.45,-2.03),U(8.30,-2.56)],eye,.76);
      line(ctx,[U(4.08,-3.35-brow),U(5.60,-3.92-brow),U(7.72,-3.75)],eye,.74);
    }
    line(ctx,[U(4.9,4.66),U(6.25,4.97),U(7.35,4.57)],woman?'#a56670':softBoy?'#94676b':'#684e4c',.96);
  }
  if(hood){
    celPath(ctx,[M(-11,8),Q(-15,3,-14,-6),Q(-14,-12,-7,-14),Q(0,-16,8,-12),Q(11,-10,13,-6),
      L(9,-7),Q(5,-9,1,-10),Q(-5,-8,-7,-2),Q(-7,4,-5,10),Q(-9,11,-11,8),['Z']],'#8a8173',INK,1.7);
    if(!lowDetail)line(ctx,[U(-12,-3),U(-10,-9),U(-5,-12)],'#b1a99b',1.1);
  }else{
    const tail=hair==='crop'?2.4:hair==='softCrop'?6.7:hair==='bob'?6.2:hair==='waves'?7.9:5.3;
    celPath(ctx,[M(-12,1),C(-15,-7,-11,-15,-4,-15),C(1,-17,9,-14,12,-8),Q(7,-8,5,-7),
      Q(1,-4,0,hair==='softCrop'?-1:-3),Q(1,-4,1,-7),Q(-5,-5,-5,1),Q(-4,tail,-7-stream*.18,tail),
      Q(-9,tail+1,-12,1),['Z']],ink,INK,1.63);
    if(!lowDetail){
      celPath(ctx,[M(-11,-5),Q(-7,-15,1,-13.7),Q(5,-13.4,7,-11),Q(2,-12,-2,-10.1),
        Q(-5,-8,-9,-6),['Z']],shade);
      line(ctx,[U(-8,-9),U(-4,-12),U(.2,-12.7)],shine,.95);
      if(woman||softBoy||look?.androgynous)line(ctx,[U(-5.9,3.2),U(-6.1,5.1)],look?.trim??'#bca59e',1.16);
    }
  }
}
function bodyArt(ctx:Canvas, r:PaintRig, c:Palette, lowDetail=false) {
  const {shoulder:s,waist:w,pelvis:h,head,hdx:d,type,forward}=r, feminine=type.id==='woman';
  const rabbit=type.id==='rabbit', look=r.appearance;
  const sh=type.shoulder*(look?.softBoy?.85:1)*(r.styleSpin?.torsoScale??1), wa=type.waist*(look?.softBoy?.88:1), hip=type.hip;
  const clothSide=r.styleSpin?mix(forward*.68+d*.32*smooth(Math.abs(forward)/.48),r.styleSpin.clothSide,r.styleSpin.amplitude):forward*.68+d*.32*smooth(Math.abs(forward)/.48);
  const S=(x:number,y:number):[number,number]=>[s.x+x,s.y+y], W=(x:number,y:number):[number,number]=>[w.x+x,w.y+y], H=(x:number,y:number):[number,number]=>[h.x+x,h.y+y];
  const moving=['dash','sidestep','backstep','hit','ko'].includes(r.action);
  const sweep=['slash','sweep','rush','leap'].includes(r.action);
  const impulse=r.reducedMotion?0:Math.sin(Math.PI*r.t);
  const carried=sweep?Math.max(0,r.t-.27)*impulse:0;
  const flight=(r.airSilhouette??0)*.8;
  const cloth=(r.styleSpin?.cloth??0)+(r.reducedMotion?0:(r.peasantPhrase?.coat??0)*9)+Math.min(12,Math.abs(r.lean)*.20+flight*3.2+(r.bodySettle??0)*2.4+impulse*(moving?6:0)+carried*15);
  const lift=r.reducedMotion?0:impulse*(moving?1.35:0)+carried*8+(r.styleSpin?.cloth??0)*.29;
  handArt(ctx,r.backHand,r.backElbow,d,type,false,c);
  celPath(ctx,[['M',...W(-wa,-2)],['L',...W(wa,-2)],['Q',...H(hip,-2),...H(hip+1,3)],
    ['Q',...H(hip,9),...H(0,10)],['Q',...H(-hip,10),...H(-hip-1,3)],
    ['Q',...H(-hip,-2),...W(-wa,-2)],['Z']], '#36373a',INK,2);
  celPath(ctx,[['M',...W(-clothSide*4,2)],['Q',...H(-clothSide*9,3),...H(-clothSide*(feminine?9:12)-clothSide*cloth,(feminine?7.5:11)-lift)],
    ['L',...H(-clothSide*(feminine?4:6),(feminine?10:13)-lift*.6)],['Q',...H(clothSide*3,11),...W(clothSide*4,3)],['Z']],rabbit?'#414644':feminine?'#34363b':'#62534b',INK,1.7);
  celPath(ctx,[['M',head.x-4,head.y+4],['L',head.x+4,head.y+4],['L',s.x+5,s.y+1],
    ['L',s.x-5,s.y+1],['Z']],'#77797b',INK,1.7);
  celPath(ctx,[['M',...S(-sh-1,1)],['L',...S(-sh+1,-4)],['L',...S(-3,-5)],['L',...S(0,-2)],
    ['L',...S(4,-5)],['L',...S(sh-1,-4)],['L',...S(sh+1,2)],
    ['Q',...S(sh+1,10),...W(wa+.8,-.1)],['L',...W(wa+1,3)],['L',...W(-wa-1,3)],
    ['L',...W(-wa-.8,-.1)],['Q',...S(-sh-1,9),...S(-sh-1,1)],['Z']],
    rabbit?'#505752':look?.femme||look?.androgynous||look?.softBoy?look.coat:feminine?'#55595e':'#4b403a',INK,2.15);
  celPath(ctx,[['M',...S(-sh*.84,-1.2)],['Q',...S(-sh*.48,-3.3),...S(-2.8,-2.65)],
    ['Q',...S(1.8,5.7),...W(d*2.5,1.1)],['L',...W(-wa*.69,1.19)],
    ['Q',...S(-sh*.68,7.5),...S(-sh*.84,-1.2)],['Z']],rabbit?'#7b8274':feminine?'#737982':'#88786b');
  line(ctx,[P(...S(d*4,-2)),P(...S(d*1,3)),P(...W(d*2,1))],feminine?'#a0a1a1':'#a6a8a9',1.5);
  line(ctx,[P(...W(-wa,3.4)),P(...W(wa,3.4))],'#17181b',2.7);
  line(ctx,[P(...W(-d*1.4,3.3)),P(...W(d*2.8,3.3))],c.steel,2.1);
  handArt(ctx,r.hand,r.frontElbow,d,type,true,c);
  headArt(ctx,r,c,lowDetail);
}
function bladeArt(ctx:Canvas, r:PaintRig, c:Palette, offhand=false) {
  const {hand:h,blade:b,action,trail,hdx:side}=r;
  const weight=offhand?.8:1;
  const dx=b.x-h.x,dy=b.y-h.y;
  const n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n;
  const grip=P(h.x-ux*9,h.y-uy*9);
  if(!r.saberOff&&trail>.04) {
    const po=action==='leap'?-1:1, fan=trail*(action==='sweep'?34:23);
    if(action==='rush'){
      polygon(ctx,[[b.x,b.y],[h.x-side*28,b.y+9],[h.x-side*16,b.y+4],[h.x-side*10,b.y-5]],c.slash+Math.round(29*trail).toString(16).padStart(2,'0'));
    }else{
      ctx.save();ctx.globalAlpha=trail*.22;
      polygon(ctx,[[h.x,h.y],[b.x-uy*fan*.45*po-ux*fan*.4,b.y+ux*fan*.45*po-uy*fan*.4],
        [b.x-uy*fan*.85*po,b.y+ux*fan*.85*po],[b.x+ux*4,b.y+uy*4]],c.slash);
      ctx.restore();
    }
  }
  line(ctx,[grip,h],INK,12*weight);
  line(ctx,[grip,h],r.saberOff?'#74747a':c.steel,7*weight);
  line(ctx,[P(h.x-uy*5,h.y+ux*5),P(h.x+uy*5,h.y-ux*5)],r.saberOff?'#a39a8d':c.split,3.1);
  if(r.saberOff)return;
  if(!r.reducedMotion){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=.18; line(ctx,[h,b],c.slash,15*weight);
    ctx.globalAlpha=.34; line(ctx,[h,b],c.slash,9*weight);
    ctx.restore();
  }
  line(ctx,[h,b],c.slash,5.4*weight);
  line(ctx,[h,b],'#ebffff',2.7*weight);
  if(r.ignition>0||r.trakataFlash!>0) {
    // Light races along an already authoritative blade. Do not interpolate
    // either emitter or tip: the engine and screen agree on the switch frame.
    const ignition=Math.max(r.ignition,r.trakataFlash!);
    const flash=r.trakataFlash!>0?1-r.trakataFlash!:r.saberPhase==='long'?1-r.ignition:r.ignition;
    const pulse=P(mix(h.x,b.x,flash),mix(h.y,b.y,flash));
    const streak=P(mix(h.x,b.x,Math.max(0,flash-.2)),mix(h.y,b.y,Math.max(0,flash-.2)));
    ctx.save();ctx.globalAlpha*=.82*ignition;ctx.globalCompositeOperation='lighter';
    line(ctx,[streak,pulse],c.flare,10*weight);
    flatEllipse(ctx,pulse.x,pulse.y,4*weight,4*weight,'#f5ffff');
    ctx.restore();
  }
}
function silhouetteArt(ctx:Canvas, r:PaintRig, color:string) {
  const {type,shoulder:s,waist:w,pelvis:h,head,hdx:d,forward}=r;
  const sh=type.shoulder*(r.styleSpin?.torsoScale??1),wa=type.waist,hip=type.hip;
  for (const [i,leg] of r.legs.entries())footArt(ctx,leg,forward,r.palette,type,i===1,color);
  handArt(ctx,r.backHand,r.backElbow,d,type,false,r.palette,color);
  celPath(ctx,[['M',s.x-sh,s.y+1],['Q',s.x-sh,s.y-5,s.x,s.y-5],
    ['Q',s.x+sh,s.y-5,s.x+sh,s.y+2],['Q',w.x+wa,w.y-1,w.x+wa,w.y+2],
    ['Q',h.x+hip,h.y,h.x+hip,h.y+4],['Q',h.x+hip*.8,h.y+10,h.x,h.y+10],
    ['Q',h.x-hip*.9,h.y+11,h.x-hip,h.y+3],['Q',h.x-hip,h.y,w.x-wa,w.y+3],
    ['Q',w.x-wa,w.y-3,s.x-sh,s.y+1],['Z']],color);
  handArt(ctx,r.hand,r.frontElbow,d,type,true,r.palette,color);
  flatEllipse(ctx,head.x-d*1.1,head.y-2,14.2,15.1,color);
  if(type.id==='rabbit')rabbitEars(ctx,r,color);
  if(type.id==='woman'){
    celPath(ctx,[['M',head.x-d*6.2,head.y-5],['Q',head.x-d*13,head.y-12,head.x-d*24,head.y+.2],
      ['Q',head.x-d*28,head.y+3.9,head.x-d*27,head.y+5.9],
      ['Q',head.x-d*14,head.y+4,head.x-d*5.4,head.y+.1],['Z']],color);
  }
}
// Paint every contour behind the complete cel drawing. Individual parts
// share the same flat rim at this stage; painting all original parts on top
// masks those joins, including the eyes and wherever one limb crosses the body.
// Grouping reusable Path2D contours avoids a large pixel surface per fighter.
const defaultPath=()=>typeof Path2D==='function'?new Path2D():null;
function figureArt(ctx:Canvas, r:PaintRig, c:Palette) {
  footArt(ctx,r.legs[0],r.forward,c,r.type,false);
  footArt(ctx,r.legs[1],r.forward,c,r.type,true);
  bodyArt(ctx,r,c);
}
function figureLayers(r:PaintRig, c:Palette, pathFactory:()=>Path2D|null) {
  if(typeof pathFactory!=='function')return null;
  const probe=pathFactory();
  if(!probe||typeof probe.addPath!=='function')return null;
  type Command='moveTo'|'lineTo'|'quadraticCurveTo'|'bezierCurveTo'|'ellipse'|'closePath';
  type Draw={path:Path2D;commands:[Command,number[]][];fill:Canvas['fillStyle']|null;stroke:Canvas['strokeStyle']|null;width:number;cap:CanvasLineCap};
  const draws:Draw[]=[], groups=new Map<number,Path2D>();
  let path:Path2D|null=null, item:Draw|null=null, commands:[Command,number[]][]=[];
  const remember=()=>{
    if(!item){item={path:path!,commands,fill:null,stroke:null,width:0,cap:'round'};draws.push(item);}
    return item;
  };
  const tape={
    beginPath(){path=pathFactory();item=null;commands=[];},
    fill(this:Pick<Canvas,"fillStyle">){remember().fill=this.fillStyle;},
    stroke(this:Pick<Canvas,"strokeStyle"|"lineWidth"|"lineCap">){const step=remember();step.stroke=this.strokeStyle;step.width=this.lineWidth;step.cap=this.lineCap;},
    lineCap:'round',lineJoin:'round',lineWidth:1
  };
  for(const cmd of ['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','ellipse','closePath'] as const)
    Object.assign(tape,{[cmd]:(...args:number[])=>{Reflect.apply(path![cmd],path,args);commands.push([cmd,args]);}});
  figureArt(tape as unknown as Canvas,r,c);
  for(const step of draws) {
    const bucket=Math.round(step.width*2)*.5;
    if(!groups.has(bucket))groups.set(bucket,pathFactory()!);
    const group=groups.get(bucket)!;
    for(const [cmd,args] of step.commands){
      // Start each ellipse as its own subpath. Using addPath on a
      // renderer backend can stitch open subpaths into 'phantom limbs'.
      if(cmd==='ellipse'){group.moveTo(args[0]+args[2],args[1]);Reflect.apply(group.ellipse,group,args);group.closePath();}
      else Reflect.apply(group[cmd],group,args);
    }
  }
  return {draws,groups};
}
function paintFigureLayers(ctx:Canvas, r:PaintRig, c:Palette, layers:NonNullable<ReturnType<typeof figureLayers>>, crowded:boolean) {
  const {draws,groups}=layers;
  const paintRim=(color:string,width:number)=>{
    ctx.strokeStyle=color; ctx.lineCap='round';ctx.lineJoin='round';
    for(const [strokeWidth,shape] of groups){
      ctx.lineWidth=strokeWidth+width*2;ctx.stroke(shape);
    }
  };
  paintRim(crowded?(r.palette===PALETTES[0]?'#b5fcf5':'#ffd0b7'):'#b3a699',crowded?2.72:1.73);
  paintRim('#060914',crowded?1.46:1.04);
  for(const step of draws) {
    if(step.fill){ctx.fillStyle=step.fill;ctx.fill(step.path);}
    if(step.stroke){ctx.strokeStyle=step.stroke;ctx.lineWidth=step.width;ctx.lineCap=step.cap;ctx.stroke(step.path);}
  }
}
// In genuinely large, slow-rendering squads use one compact body path
// and draw the usual character art over it. No per-highlight Path2D replay.
function fastFigureRim(ctx:Canvas, r:PaintRig, c:Palette, crowded:boolean) {
  const path=defaultPath();
  if(!path)return;
  const tape={beginPath(){},fill(){},stroke(){},ellipse(x:number,y:number,rx:number,ry:number,a:number,b:number,e:number){
    path.moveTo(x+rx,y);path.ellipse(x,y,rx,ry,a,b,e);path.closePath();
  }};
  for(const cmd of ['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath'] as const)Object.assign(tape,{[cmd]:(...args:number[])=>Reflect.apply(path[cmd],path,args)});
  silhouetteArt(tape as unknown as Canvas,r,c.flare);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=crowded?6:5;ctx.strokeStyle=crowded?(r.palette===PALETTES[0]?'#b5fcf5':'#ffd0b7'):'#b3a699';ctx.stroke(path);
  ctx.lineWidth=crowded?3.6:2.7;ctx.strokeStyle='#060914';ctx.stroke(path);
}
function detachedMotion(r:PaintRig){
  const strength=r.reducedMotion?.40:1;
  const beat=Math.sin(r.t*Math.PI)*strength;
  const exaggerated=['dash','sidestep','backstep','slash','sweep','rush','leap','jump','hit'].includes(r.action);
  const worked=exaggerated?beat:0;
  const arm=r.offBlade||r.action==='force'||r.freeHandAction?r.backHand:P(
    r.backHand.x-r.forward*(5+12*worked),r.backHand.y-3+5*Math.sin(r.t*Math.PI*2)*worked);
  const legs=r.legs.map(l=>{
    if(l.planted)return l;
    const arc=(l.side===1?1:-1)*(4*worked+7*(r.airSilhouette??0)*strength);
    return {...l,foot:P(l.foot.x+r.forward*arc,l.foot.y-Math.abs(arc)*.23),
      toes:P(l.toes.x+r.forward*arc,l.toes.y-Math.abs(arc)*.23)};
  });
  return {...r,legs,backHand:arm};
}
const RANK_STEPS:Record<string,number[]>={
  check:[1.4,4,3,2],side:[5.2,2,6,3],slip:[-3.2,4.7,4,2.1],
  arc:[5.7,-1.5,8,2.7],switch:[-4.4,2.8,6.1,3.8],wheel:[8.4,-2.6,11.4,5.1],return:[-5.2,1.2,8.3,3.7]
};
// Read-only presentation: rank changes recovery discipline and silhouette
// while the simulator, sword sockets, direction and planted soles stay exact.
export function sampleArcadePresentation(f:Fighter, physicalRig:Rig){
  const r=detachedMotion(inkAirSilhouette(physicalRig));
  const rank=f.career?.gradeIndex;
  if(!isFinite(rank)||r.action==='ko'||r.action==='clash')return r;
  const mastery=clamp(rank!/14), novice=1-mastery, motion=(r.reducedMotion?.24:1)*(1-(r.poseEntryBlend??0));
  const focused=r.action==='guard'||r.action==='parry';
  const gait=r.gait==='walk'||r.gait==='run';
  const attack=r.attackFamily&&r.action!=='force';
  const load=smooth(r.t/.24)*(1-smooth((r.t-.24)/.76));
  const tail=smooth((r.t-.42)/.25)*(1-smooth((r.t-.75)/.25));
  const lift=r.airSilhouette??0;
  const dir=r.forward;
  const gaitBeat=gait?Math.cos((val(f.groundDistance)/GAIT_STRIDE)*TAU)*motion:0;
  // Experts let the tunic and hips settle under a level head. Novices spend
  // more visible effort recovering balance and carry a loose trailing glove.
  const pitch=(attack?(novice*load*4.8+novice*tail*5.2-mastery*tail*2.9):0)
     +(focused?(novice*2.7-mastery*.9):0);
  const footwork=f.rankFootwork, steps=Object.hasOwn(RANK_STEPS,footwork?.path as string)?RANK_STEPS[footwork!.path!]:null;
  const travelBearing=val(footwork?.bearing,val(f.face));
  const stepBeat=steps?Math.sin(Math.PI*r.t)**1.23*motion:0;
  const turnBeat=steps?Math.sin(r.t*TAU)*stepBeat:0;
  const sway=(steps?.[0]??0)*stepBeat;
  const balance=motion*(pitch+gaitBeat*(.54+novice*2.35));
  const drop=motion*(attack?(novice*load*3.4+novice*tail*5-mastery*load*2):0)
     +motion*(focused?novice*2.2:0)+(steps?.[1]??0)*stepBeat;
  const shoulder=P(r.shoulder.x+dir*balance+Math.cos(travelBearing)*sway,r.shoulder.y+drop+Math.sin(travelBearing)*sway*.43);
  const head=P(r.head.x+dir*(balance*.58-mastery*lift*3.3)+Math.cos(travelBearing)*sway*.35,r.head.y+drop*.62);
  const free=r.offBlade||r.action==='force'||r.poseEntryActive?r.backHand:P(
    r.backHand.x-dir*motion*(novice*(5.8*tail+3.8*load)-mastery*2.5*load),
    r.backHand.y+motion*(novice*3.6*tail-mastery*2.2*load));
  const feet=r.legs.map(l=>{
    if(l.planted||!gait&&!steps)return l;
    const swing=(steps?.[2]??0)*stepBeat*(l.side===1?1:-.4);
    const dx=Math.cos(travelBearing)*swing-Math.sin(travelBearing)*turnBeat*(steps?.[3]??0);
    const dy=Math.sin(travelBearing)*swing*.41;
    const hop=Math.abs(gaitBeat)*(novice*2.6-mastery*.8)+(steps?.[3]??0)*stepBeat;
    return {...l,foot:P(l.foot.x+dx,l.foot.y+dy-hop),toes:P(l.toes.x+dx,l.toes.y+dy-hop)};
  });
  return {...r,shoulder,head,legs:feet,backHand:free,bodySettle:novice*tail*motion,mastery};
}
/** Carry the human silhouette around an already released broad attack.
 * Only body presentation moves: feet, elbows, ignition, hands, and saber
 * project exactly as they did at the engine's real contact point. */
export function sampleArcadeStyleSpin(f:Fighter, rig:PaintRig){
  const move=f.attackSpec;
  const style=rig.chessChoreo?.style??move?.chessStyle??f.chessStyle;
  if(f.styleChoreo===true&&rig.chessChoreo&&!rig.reducedMotion&&(style==='king'||style==='queen')){
    const wide=style==='queen', yaw=rig.chessChoreo.yaw;
    const amplitude=clamp(Math.abs(yaw)/(wide?1.15:.60));
    return {...rig,styleSpin:{style,amplitude,yaw,face:val(f.face)+yaw,
      torsoScale:1-(wide?.33:.21)*amplitude,cloth:(wide?13:3.4)*amplitude,
      clothSide:Math.sign(yaw)||rig.hdx}};
  }
  if(f.styleChoreo===true||f.styleTravel!==true||(style!=='king'&&style!=='queen')||rig.reducedMotion||
     rig.airPhase!=='grounded'||f.saberOff||move?.forceAbility||move?.freeHand||
     !['sweep','slash'].includes(rig.action)||!isFinite(move?.contact)||
     (rig.action!=='sweep'&&rig.attackFamily!=='sweep'&&move!.motion?.path!=='arc'))return rig;
  const since=val(f.actionTime)-move!.contact!;
  const span=style==='king'?.19:.36;
  const available=Math.min(span,val(f.actionDuration,move!.duration)-move!.contact!);
  if(since<=0||available<=.09||since>=available)return rig;
  const p=clamp(since/available), wide=style==='queen';
  const turn=Math.sign(val(move!.motion?.finish)-val(move!.motion?.chamber))||rig.hdx||1;
  const a=wide?Math.sin(Math.PI*p)**1.12:Math.sin(Math.PI*smooth(p))**1.30;
  const payoff=wide?Math.sin(p*Math.PI*2)*.52+.57:Math.sin(p*Math.PI*2)*.22+.81;
  const spinYaw=turn*(wide?1.39:.86)*a;
  const cloth=wide?Math.sin(Math.PI*smooth((p-.06)/.94))**1.20:Math.sin(Math.PI*p)**2.2;
  const rootFace=val(f.face);
  return {...rig,styleSpin:{style,amplitude:a,yaw:spinYaw,face:rootFace+spinYaw,
      torsoScale:1-(wide?.37:.24)*a,cloth:(wide?15:4)*cloth,clothSide:turn},
    shoulder:P(rig.shoulder.x+turn*(wide?17:10)*a*payoff,
      rig.shoulder.y+(wide?-2.2:4.8)*a),
    head:P(rig.head.x+turn*(wide?12:5.2)*a*payoff,rig.head.y+(wide?-3.5:3.8)*a),
    torsoTurn:rig.torsoTurn+turn*(wide?1.16:.72)*a};
}
const WALK_SOURCE=Symbol.for('saber-pit.render-footwork');
const footPlants=new WeakMap<object,PlantMemory>();
/** Paint-only cadence. Uses achieved ground travel for AI circles, sidling and
 * walking around cover; never changes the sampled blade or combat pose. */
function sampleGroundStride(f:Fighter, r:PaintRig, time:number){
  const visual=f[WALK_SOURCE], actor=visual?.actor??f;
  if(r.reducedMotion||r.airPhase!=='grounded'||!['ready','guard'].includes(r.action)||r.poseEntryBlend>.36||
     !isFinite(f.groundDistance)||!isFinite(f.x)||!isFinite(f.y)||!isFinite(time)){
    footPlants.delete(actor);return r;
  }
  let memory:PlantMemory|null|undefined=footPlants.get(actor);
  const distance=f.groundDistance, root=P(f.x,f.y), poseScale=r.type.scale;
  const moved=memory?Math.hypot(root.x-memory.x!,root.y-memory.y!):0;
  if(memory&&(time<memory.time!||time-memory.time!>.22||distance!<memory.distance!||moved>45))memory=null;
  const elapsed=memory?time-memory.time!:0, priorFrame=elapsed>1e-4;
  const dx=priorFrame?root.x-memory!.x!:visual?.dx??val(f.vx);
  const dy=priorFrame?root.y-memory!.y!:visual?.dy??val(f.vy);
  const speed=priorFrame?moved/elapsed:visual?.speed??val(f.groundSpeed,Math.hypot(dx,dy));
  if(speed<5||Math.hypot(dx,dy)<1e-5){
    if(f.peasantMotion===true&&memory?.lastWorld){
      // Very slow actual travel can still carry the body away over many
      // frames. Re-evaluate near that point, rather than stretch a locked boot.
      if(memory.idleSince==null||!memory.stopRoot||
        Math.hypot(root.x-memory.stopRoot.x,root.y-memory.stopRoot.y)>12){
        memory.idleSince=time;memory.stopRoot=root;
        memory.stopFeet=memory.lastWorld;
        memory.stopGoal=arcadeFeetWorld(f,r);
        // Keep the closest already grounded sole. The free foot makes a
        // small deliberate closing step instead of both soles skating home.
        const existing=memory.stopFeet.filter(l=>l.planted);
        memory.stopSupport=existing.sort((a,b)=>
          Math.hypot(a.foot.x-root.x,a.foot.y-root.y)-Math.hypot(b.foot.x-root.x,b.foot.y-root.y))[0]?.side;
        const held=existing[0];
        memory.stopReach=held?Math.hypot(held.foot.x-root.x,held.foot.y-root.y):0;
      }
      memory.time=time;memory.x=root.x;memory.y=root.y;memory.distance=distance;
      const age=time-memory.idleSince;
      const {local}=arcadeBasis(f,r);
      const legs=r.legs.map(leg=>{
        const prior=memory!.stopFeet!.find(p=>p.side===leg.side);
        const goal=memory!.stopGoal!.find(p=>p.side===leg.side);
        if(!prior||!goal)return leg;
        const planted=leg.side===memory!.stopSupport;
        const settle=planted&&val(memory!.stopReach)<=29?0:planted?smooth((age-.12)/.13):smooth(age/.14);
        const lift=Math.sin(Math.PI*settle)*(planted?3:5);
        const close=(from:Point,to:Point,n:number)=>local(P(mix(from.x,to.x,settle),mix(from.y,to.y,settle)-n));
        return {...leg,foot:close(prior.foot,goal.foot,lift),toes:close(prior.toes,goal.toes,lift),
          k:close(prior.k,goal.k,lift*.25),planted:planted?settle===0||settle===1:settle===1||settle===0&&prior.planted};
      });
      const settled={...r,legs:legs.sort((a,b)=>a.foot.y-b.foot.y)};
      memory.lastWorld=arcadeFeetWorld(f,settled);
      return settled;
    }
    if(!memory?.lastFeet){footPlants.delete(actor);return r;}
    memory.idleSince??=time;
    memory.time=time;memory.x=root.x;memory.y=root.y;memory.distance=distance;
    const keep=1-smooth((time-memory.idleSince)/.12);
    if(keep<=0){footPlants.delete(actor);return r;}
    const toward=(p:Point,q:Point)=>P(mix(p.x,q.x,keep),mix(p.y,q.y,keep));
    return {...r,legs:r.legs.map(leg=>{
      const prior=memory!.lastFeet!.find(p=>p.side===leg.side)??leg;
      return {...leg,foot:toward(leg.foot,prior.foot),toes:toward(leg.toes,prior.toes),
        k:toward(leg.k,prior.k),planted:false};
    }).sort((a,b)=>a.foot.y-b.foot.y)};
  }
  if(!memory){memory={legs:[{},{}]};footPlants.set(actor,memory);}
  const responsiveness=memory.axis?Math.max(.08,Math.min(.62,moved*.085)):1;
  const length=Math.hypot(dx,dy), vx=dx/length, vy=dy/length;
  // Rotate the travel vector rather than lerping across zero on reversals.
  const goalAngle=Math.atan2(vy,vx), priorAngle=memory.axis?Math.atan2(memory.axis.y,memory.axis.x):goalAngle;
  const turnDelta=Math.atan2(Math.sin(goalAngle-priorAngle),Math.cos(goalAngle-priorAngle));
  const angle=priorAngle+turnDelta*responsiveness;
  const basis=P(Math.cos(angle),Math.sin(angle));
  if(f.peasantMotion===true&&memory.idleSince!=null&&memory.lastWorld){
    // A restart starts each heel from its last painted location, including
    // a partial closing step interrupted by a newly requested movement.
    for(const sole of memory.lastWorld){
      const prior=memory.legs[sole.side];
      prior.anchor=sole.foot;prior.toe=sole.toes;prior.swing=null;prior.planted=sole.planted;prior.resume=true;
    }
    memory.replant=0;
  }
  memory.idleSince=null;memory.axis=basis;memory.x=root.x;memory.y=root.y;memory.time=time;memory.distance=distance;
  const run=smooth((speed-100)/68), weight=smooth((speed-5)/15)*(1-r.poseEntryBlend);
  const turn=val(f.face), face=P(Math.cos(turn),Math.sin(turn));
  const lateral=Math.abs(face.x*basis.y-face.y*basis.x), cautious=r.action==='guard';
  const {project,local}=arcadeBasis(f,r);
  const feet=r.legs.map(leg=>{
    const side=leg.side, sign=side?1:-1;
    const prior=memory.legs[side];
    let stepRun=run;
    if(f.peasantMotion===true){
      const cycle=Math.floor(distance!/DISPLAY_STEP+side*.5);
      if(prior.cycle!==cycle){prior.cycle=cycle;prior.cycleRun=run;}
      stepRun=prior.cycleRun??run;
    }
    const step=displayStep(distance!,side,stepRun);
    const spread=mix(7,12,lateral)+(cautious?1.5:0);
    const worldToe=(ankle:Point)=>P(ankle.x+face.x*9,ankle.y+1+face.y*6);
    const oldFoot=project(leg.foot), oldToe=project(leg.toes);
    const destination=(forward:number)=>P(root.x+basis.x*forward-sign*basis.y*spread,
      root.y+basis.y*forward+sign*basis.x*spread*.65-1);
    const blend=(a:Point,b:Point,k:number)=>P(mix(a.x,b.x,k),mix(a.y,b.y,k));
    let footWorld,toeWorld,planted=step.planted,lift=0;
    if(planted&&prior.planted&&prior.anchor&&!prior.swing&&!memory.replant&&
      Math.hypot(prior.anchor.x-root.x,prior.anchor.y-root.y)>40){
      // Don't rebase a planted foot. Lift it and catch up with a short,
      // visible step if a tight turn would overextend the leg.
      memory.replant=side+1;
      prior.swing={forcedAt:time,anchor:prior.anchor,toe:prior.toe!,target:destination(step.reach+12)};
      prior.swing!.targetToe=worldToe(prior.swing!.target);
    }
    const forced=prior.swing?.forcedAt!=null;
    if(forced){
      const t=clamp((time-prior.swing!.forcedAt!)/.13), s=prior.swing, eased=smooth(t);
      planted=t>=1;
      lift=12*Math.sin(Math.PI*t);
      footWorld=blend(s!.anchor,s!.target,eased);toeWorld=blend(s!.toe,s!.targetToe!,eased);
      if(planted){
        prior.anchor=s!.target;prior.toe=s!.targetToe;prior.swing=null;memory.replant=0;
      }
    }else if(planted){
      if(!prior.anchor){
        prior.anchor=weight<.91?oldFoot:destination(step.reach);
        prior.toe=weight<.91?oldToe:worldToe(prior.anchor);
      }else if(prior.swing){
        prior.anchor=prior.swing.target;prior.toe=prior.swing.targetToe;prior.swing=null;
      }
      footWorld=prior.anchor;toeWorld=prior.toe!;
    }else{
      if(!prior.swing){
        // Predict a fixed touchdown from actual travel. Facing changes may
        // alter the next stride, but don't drag this foot across the floor.
        const target=destination(mix(30,43,run)*(1-.34*step.swing));
        prior.swing={anchor:prior.anchor??oldFoot,toe:prior.toe??oldToe,target,targetToe:worldToe(target),
          ...(prior.resume?{fromSwing:step.swing}:{})};
      }
      const s=prior.swing;
      const swing=s.fromSwing===undefined?step.swing:clamp((step.swing-s.fromSwing)/Math.max(.001,1-s.fromSwing));
      const u=smooth(swing);
      footWorld=blend(s.anchor,s.target,u);toeWorld=blend(s.toe,s.targetToe!,u);
      lift=step.lift*(cautious?.87:1)*(s.fromSwing===undefined?1:smooth(swing/.36));
    }
    prior.planted=planted;prior.resume=false;
    const foot=local(P(footWorld.x,footWorld.y-lift)), toes=local(P(toeWorld!.x,toeWorld!.y-lift));
    const groundedSole=planted||f.peasantMotion===true;
    const ankle=groundedSole?foot:blend(leg.foot,foot,weight),tip=groundedSole?toes:blend(leg.toes,toes,weight);
    const delta=P(ankle.x-leg.foot.x,ankle.y-leg.foot.y);
    return {...leg,foot:ankle,toes:tip,k:P(leg.k.x+delta.x*.54+sign*lateral*1.7*weight,
      leg.k.y+delta.y*.48-lateral*lift*.10/poseScale),planted};

  });
  memory.lastFeet=feet;
  const stride={...r,legs:feet.sort((a,b)=>a.foot.y-b.foot.y)};
  if(f.peasantMotion===true)memory.lastWorld=arcadeFeetWorld(f,stride);
  return stride;
}

// The motion rig remains untouched. Keep already-painted ground contact
// across action switches, not a newly calculated starting stance.
// Render-stage body timing: the upper body leads an actual committed action
// and the head follows through with a brief lag. Never feed back into arcs,
// emitters, simulation positions, or ground contact.
const bodyHandoffs=new WeakMap<object,FacePose>();
const bodyHandoffMoves=new Set(['ready','guard','slash','sweep','rush','parry','feint','freehand']);
// Artist-facing upper-body keys: chamber, contact, overshoot, robe torque.
// Coordinates are display pixels before fighter scale, not weapon movement.
const BODY_SWING_KEYS={
  cut:[[-5,4],[4,-1],[8,2],.46],
  thrust:[[-6,0],[9,-2],[7,-1],.12],
  sweep:[[-9,7],[6,3],[10,6],.85],
  rise:[[-4,8],[3,-7],[6,-9],-.56],
  screen:[[-3,-3],[-2,-6],[-5,-4],-.34],
  return:[[5,3],[-3,-3],[-7,-1],-.62],
  vault:[[-4,5],[6,-4],[7,-6],.57],
} as const;

function samplePeasantBodyCarry(f:Fighter, r:PaintRig, time:number){
  const actor=f[WALK_SOURCE]?.actor??f;
  if(f.peasantMotion!==true||r.reducedMotion||f.alive===false||r.airPhase!=='grounded'||
    !(bodyHandoffMoves.has(r.action)||(f.recoveryFlow===true&&softContactMoves.has(r.action)))||!isFinite(time)){
    bodyHandoffs.delete(actor);return r;
  }
  const kind=r.action+'/'+(f.attack?f.attackSerial??f.attack:'-');
  const root=P(val(f.x),val(f.y)), prior=bodyHandoffs.get(actor);
  const face=val(f.face),v=Math.hypot(val(f.vx),val(f.vy));
  const drive=val(f.groundBearing,Math.atan2(val(f.vy),val(f.vx)));
  let leadX=0,leadY=0,robeTurn=0,contactSpan=Infinity;
  if(r.action==='ready'||r.action==='guard'){
    const measured=v>1?val(f.groundPace,clamp(val(f.groundSpeed,v)/175)):0;
    leadX=Math.cos(drive)*measured*(r.action==='guard'?4:6);
    leadY=Math.sin(drive)*measured*1.75;
    if(r.action==='guard'&&f.guardRead==='ready')leadY+=1.75*Math.sin(Math.PI*clamp(val(f.actionTime)/.21));
  }else if(f.attack&&r.attackFamily&&!f.saberOff&&!f.attackSpec?.forceAbility&&!f.attackSpec?.freeHand&&isFinite(f.attackSpec?.contact)){
    const contact=Math.max(.01,f.attackSpec!.contact!);
    const age=val(f.actionTime);
    const wind=clamp(age/contact);
    const finish=clamp((age-contact)/Math.max(.05,val(f.actionDuration)-contact));
    const family=r.attackFamily as keyof typeof BODY_SWING_KEYS|null;
    const [back,touch,follow,torque]=family&&Object.hasOwn(BODY_SWING_KEYS,family)?BODY_SWING_KEYS[family]:BODY_SWING_KEYS.cut;
    let horizontal, lift;
    if(age<contact){
      // The silhouette explicitly chambers and then changes direction
      // before the authoritative contact; a player sees the wind-up.
      const cock=wind<.55?smooth(wind/.55):1-smooth((wind-.55)/.45);
      const go=smooth((wind-.55)/.45);
      horizontal=back[0]*cock+touch[0]*go;
      lift=back[1]*cock+touch[1]*go;
      robeTurn=torque*(-.43*cock+.47*go);
    }else{
      // Follow through sooner than a symmetric pulse, settle for longer.
      const swing=smooth(finish/.28), slack=1-smooth((finish-.28)/.72);
      horizontal=mix(touch[0],follow[0],swing)*slack;
      lift=mix(touch[1],follow[1],swing)*slack;
      robeTurn=torque*mix(.47,1,swing)*slack;
    }
    leadX=horizontal*Math.cos(face);
    leadY=lift+horizontal*Math.sin(face)*.28;
    robeTurn*=r.hdx;
    contactSpan=contact;
  }
  const target={shoulder:P(r.shoulder.x+leadX,r.shoulder.y+leadY),
    head:P(r.head.x+leadX*.54,r.head.y+leadY*.51)};
  const safe=prior&&time>=prior.time&&time-prior.time<.12&&Math.hypot(root.x-prior.root.x,root.y-prior.root.y)<17;
  const gap=safe?Math.max(Math.hypot(target.head.x-prior.head.x,target.head.y-prior.head.y),
    Math.hypot(target.shoulder.x-prior.shoulder.x,target.shoulder.y-prior.shoulder.y)):0;
  let carry=safe?prior.carry:null;
  if(safe&&(kind!==prior.kind||(!carry&&gap>11))){
    carry={at:time,shoulder:prior.shoulder,head:prior.head};
  }
  let {shoulder,head}=target;
  if(carry){
    const age=time-carry.at;
    if(age<.135){
      const bridge=(from:Point,to:Point,span:number)=>P(mix(from.x,to.x,smooth(age/span)),mix(from.y,to.y,smooth(age/span)));
      // Never give a short attack the same 135 ms handoff as a measured
      // recovery: the previous pose would swallow its whole chamber.
      shoulder=bridge(carry.shoulder,target.shoulder,Math.min(.104,Math.max(.025,contactSpan*.42)));
      head=bridge(carry.head,target.head,Math.min(.135,Math.max(.036,contactSpan*.62)));
    }else carry=null;
  }
  bodyHandoffs.set(actor,{kind,root,time,shoulder,head,carry});
  if(!leadX&&!leadY&&!robeTurn&&!carry)return r;
  return {...r,shoulder,head,torsoTurn:r.torsoTurn+robeTurn,
    frontElbow:P(r.frontElbow.x+(shoulder.x-r.shoulder.x)*.38,r.frontElbow.y+(shoulder.y-r.shoulder.y)*.38),
    backElbow:P(r.backElbow.x+(shoulder.x-r.shoulder.x)*.31,r.backElbow.y+(shoulder.y-r.shoulder.y)*.31)};
}

const groundHandoffs=new WeakMap<object,GroundPose>();
const groundHandoffMoves=new Set(['ready','guard','slash','sweep','rush','parry','feint','freehand']);
const softContactMoves=new Set(['dash','sidestep','backstep','clash','hit']);
export function sampleArcadeFootwork(f:Fighter, r:PaintRig, time:number){
  const stride=sampleGroundStride(f,r,time);
  const painted=f.peasantMotion===true?samplePeasantBodyCarry(f,stride,time):stride;
  if(f.peasantMotion!==true)return painted;
  const actor=f[WALK_SOURCE]?.actor??f;
  const flowing=f.recoveryFlow===true;
  const quickStep=flowing&&softContactMoves.has(r.action);
  if(r.reducedMotion||f.alive===false||r.airPhase!=='grounded'||!(groundHandoffMoves.has(r.action)||quickStep)||
    !isFinite(time)||!isFinite(f.x)||!isFinite(f.y)){
    groundHandoffs.delete(actor);return painted;
  }
  const projected=arcadeFeetWorld(f,painted);
  const kind=r.action+'/'+(f.attack?f.attackSerial??f.attack:'-');
  const root=P(f.x,f.y);
  const prev=groundHandoffs.get(actor);
  const contiguous=prev&&time>=prev.time&&time-prev.time<.14
    &&Math.hypot(root.x-prev.root.x,root.y-prev.root.y)<16;
  let handoff=contiguous?prev.handoff:null;
  const jump=contiguous&&flowing&&!handoff&&kind===prev.kind&&
    projected.some(l=>{const p=prev.feet.find(x=>x.side===l.side);
      return p&&Math.hypot(p.foot.x-l.foot.x,p.foot.y-l.foot.y)>12;
    });
  function capture(prior:LegWorld[]){
    const available=prior.filter(leg=>leg.planted);
    // Keep the easier support to carry; the free boot can lift immediately.
    const score=(leg:LegWorld)=>{
      const target=projected.find(n=>n.side===leg.side);
      return target?Math.hypot(target.foot.x-leg.foot.x,target.foot.y-leg.foot.y):Infinity;
    };
    const planted=available.reduce<LegWorld|null>((best,leg)=>!best||score(leg)<score(best)?leg:best,null);
    return {at:time,root,prior,support:planted?.side,...(flowing?{quickStep}:{})};
  }
  if(contiguous&&(kind!==prev.kind||jump))handoff=capture(prev.feet);
  let result=painted;
  if(handoff){
    const t=time-handoff.at;
    const shift=Math.hypot(root.x-handoff.root.x,root.y-handoff.root.y);
    if(t>=.155||shift>=32)handoff=null;
    else {
      const {local,project}=arcadeBasis(f,painted);
      const fast=handoff.quickStep===true;
      const release=Math.max(smooth((t-(fast?.013:.035))/(fast?.08:.12)),smooth((shift-(fast?5:10))/(fast?19:22)));
      const free=Math.max(smooth(t/(fast?.067:.11)),release);
      const mixWorld=(a:Point,b:Point,p:number,lift=0)=>local(P(mix(a.x,b.x,p),mix(a.y,b.y,p)-lift));
      const legs=painted.legs.map(leg=>{
        const old=handoff!.prior.find(sample=>sample.side===leg.side);
        if(!old)return leg;
        const hold=leg.side===handoff!.support,w=hold?release:free;
        // Once unlocked, visibly clear the sole instead of sliding across it.
        const lift=4.8*Math.sin(Math.PI*w)*(hold?1:.78);
        const foot=mixWorld(old.foot,project(leg.foot),w,lift), toes=mixWorld(old.toes,project(leg.toes),w,lift);
        const k=mixWorld(old.k,project(leg.k),Math.min(1,w*1.18),lift*.25);
        return {...leg,foot,toes,k,planted:hold&&release===0||w>=1&&leg.planted};
      });
      result={...painted,legs:legs.sort((a,b)=>a.foot.y-b.foot.y)};
    }
  }
  let feet=result===painted?projected:arcadeFeetWorld(f,result);
  // During a guard turn, the underlying gait may pick a different target
  // midway through a handoff. Rebase on what was actually drawn rather than
  // letting a nominal touchdown teleport the boot to the changed endpoint.
  if(contiguous&&flowing&&kind===prev.kind&&(r.action==='ready'||r.action==='guard')&&
      feet.some(l=>{const p=prev.feet.find(v=>v.side===l.side);
        return p&&Math.hypot(l.foot.x-p.foot.x,l.foot.y-p.foot.y)>11;})){
    handoff=capture(prev.feet);
    const {local}=arcadeBasis(f,painted);
    result={...painted,legs:painted.legs.map(l=>{
      const p=prev.feet.find(v=>v.side===l.side);
      return p?{...l,foot:local(p.foot),toes:local(p.toes),k:local(p.k),planted:handoff!.support===l.side}:l;
    }).sort((a,b)=>a.foot.y-b.foot.y)};
    feet=arcadeFeetWorld(f,result);
  }
  groundHandoffs.set(actor,{kind,time,root,handoff,feet});
  return result;
}

/** Directional impact acting on the painted body only. Blade sockets, bind
 * point, real travel, and support-foot anchors are authoritative elsewhere. */
const impactFrames:Readonly<Record<string,number[]>>=Object.freeze({hard:[.29,13.2,6.6,7.5],glance:[.165,4.1,2.4,2.4],
  guard:[.215,6,4.0,4.8],clash:[.23,5.1,3.9,3.1]});
export function sampleArcadeImpactPose(f:Fighter, r:PaintRig, time:number){
  const hit=f.impactReaction;
  if(f.impactPhysics!==true||!hit||f.alive===false||r.action==='ko'||!isFinite(time)||
      !isFinite(hit.at)||!isFinite(hit.bearing)||!isFinite(hit.strength))return r;
  const frames=Object.hasOwn(impactFrames,hit.kind)?impactFrames[hit.kind]:null;
  if(!frames)return r;
  const [duration,power,absorb,step]=frames, age=time-hit.at;
  if(age<0||age>=duration)return r;
  const load=smooth(age/.027)*(1-smooth((age-.047)/(duration*.78)));
  const catchBeat=smooth((age-.066)/.057)*(1-smooth((age-.125)/(duration-.125)));
  const weight=clamp(hit.strength,0,1)*(r.reducedMotion?.36:1);
  const movingBody=r.action==='hit'||r.action==='ready'||r.action==='guard'||r.action==='parry'||r.action==='clash';
  if(!movingBody||weight<=0)return r;
  const rotation=arcadeRigRotation(r), sc=r.type.scale, bearing=hit.bearing-rotation;
  const ux=Math.cos(bearing)/sc,uy=Math.sin(bearing)/sc;
  const push=load*power*weight, dip=(load*absorb+catchBeat*absorb*.68)*weight/sc;
  const p=(a:Point,x:number,y:number)=>P(a.x+x,a.y+y);
  const shoulder=p(r.shoulder,ux*push,uy*push*.65+dip);
  const head=p(r.head,ux*push*(hit.kind==='guard'?.63:1.21),uy*push*.73+dip*.80);
  const hipX=ux*push*.37,hipY=uy*push*.34+dip*.37;
  const pelvis=p(r.pelvis,hipX,hipY);
  const fly=r.airPhase==='airborne';
  // Catch on the foot leading the *actual* impulse. The other boot retains
  // the real painted support anchor, including during a sideways shove.
  const catchScale=r.reducedMotion||fly||hit.kind==='glance'?0:catchBeat*step*weight;
  const a=(r.legs[0].foot.x*ux+r.legs[0].foot.y*uy);
  const b=(r.legs[1].foot.x*ux+r.legs[1].foot.y*uy);
  const lead=a>=b?0:1;
  const legs=r.legs.map((leg,index)=>{
    const lift=index===lead?catchScale:0;
    const x=ux*lift*.61,y=uy*lift*.40-lift*.66/sc;
    return {...leg,hip:p(leg.hip,hipX,hipY),k:p(leg.k,hipX*.6+x*.5,hipY*.6+y*.55),
      foot:p(leg.foot,x,y),toes:p(leg.toes,x,y),planted:lift>.6?false:leg.planted};
  });
  return {...r,shoulder,head,helmet:head,pelvis,legs,
    frontElbow:p(r.frontElbow,ux*push*.38,uy*push*.31+dip*.38),
    backElbow:p(r.backElbow,ux*push*.47,uy*push*.37+dip*.52)};
}

const contactRecoveries=new WeakMap<object,RecoveryPose>();
const recoveryPoints:ChestKey[]=['head','shoulder','pelvis','frontElbow','backElbow'];
const recoveryKinds=new Set(['guard','lateral','backstep']);

/** Paint the catch into the actual next action without altering blade geometry. */
export function sampleArcadeRecoveryPose(f:Fighter, r:PaintRig, time:number){
  if(f.recoveryFlow!==true)return r;
  const actor=f[WALK_SOURCE]?.actor??f;
  if(r.reducedMotion||f.alive===false||r.airPhase!=='grounded'||!isFinite(time)||
      r.action==='ko'||f.attack){contactRecoveries.delete(actor);return r;}
  const hit=f.impactReaction, recover=f.impactRecovery;
  const prior=contactRecoveries.get(actor);
  if(!recover||!recoveryKinds.has(recover.kind)||!isFinite(recover.at)||
      !isFinite(recover.bearing)||!(recover.duration>0)||time<recover.at){
    if(hit&&time>=hit.at&&time-hit.at<.6){
      const {project}=arcadeBasis(f,r);
      contactRecoveries.set(actor,{
        impactAt:hit.at,time,x:val(f.x),y:val(f.y),
        body:Object.fromEntries(recoveryPoints.map(key=>[key,project(r[key])])) as Record<ChestKey,Point>,
        feet:arcadeFeetWorld(f,r)
      });
    }else contactRecoveries.delete(actor);
    return r;
  }
  const age=time-recover.at,duration=Math.min(.34,recover.duration);
  if(age>=duration){contactRecoveries.delete(actor);return r;}
  const has=prior&&prior.impactAt===recover.impactAt&&recover.at-prior.time<.145&&
    time>=prior.time&&Math.hypot(val(f.x)-prior.x,val(f.y)-prior.y)<32;
  const {local,project}=arcadeBasis(f,r), rotation=arcadeRigRotation(r);
  const dx=Math.cos(recover.bearing-rotation),dy=Math.sin(recover.bearing-rotation);
  const u=clamp(age/duration), settle=Math.sin(Math.PI*u)**2*clamp(val(recover.strength,.6));
  const guard=recover.kind==='guard', direction=guard?-.7:1;
  const dip=settle*(guard?5:3.4), drive=settle*(guard?2.8:5.7);
  const sx=has?val(f.x)-prior.x:0,sy=has?val(f.y)-prior.y:0;
  const weight=has?1-smooth(age/Math.min(.115,duration*.66)):0;
  const body={} as Record<ChestKey,Point>;
  for(const [i,key] of recoveryPoints.entries()){
    const old=has?local(P(prior.body[key].x+sx,prior.body[key].y+sy)):r[key];
    const gain=i===0?.78:i===2?.38:i>=3?.46:1;
    body[key]=P(mix(r[key].x,old.x,weight)+dx*drive*gain*direction,
      mix(r[key].y,old.y,weight)+(dy*drive*.55*direction+dip)*gain);
  }
  const current=arcadeFeetWorld(f,r), movement=Math.hypot(sx,sy);
  const anchors=has?prior.feet.filter(v=>v.planted):[];
  // Prefer the trailing support. If two feet were planted, keep one
  // planted and lift the other into the new measured step direction.
  const along=(v:LegWorld)=>v.foot.x*Math.cos(recover.bearing)+v.foot.y*Math.sin(recover.bearing);
  const support=anchors.reduce<LegWorld|null>((best,v)=>!best||along(v)<along(best)?v:best,null)?.side;
  const legs=r.legs.map((leg,i)=>{
    const old=has?prior.feet.find(v=>v.side===leg.side):null;
    const still=old&&support===leg.side;
    const free=old&&!still;
    const release=still?Math.max(smooth((age-.04)/.09),smooth((movement-8)/20)):1-weight;
    const move=!guard&&(free||!has&&i===0);
    const lift=(move?Math.sin(Math.PI*release)*4.8:0);
    const toward=(key:"foot"|"toes"|"k")=>{
      const p=current[i][key];
      const q=old?.[key]??project(leg[key]);
      return local(P(mix(q.x,p.x,release),mix(q.y,p.y,release)-lift*(key==='k'?.40:1)));
    };
    return {...leg,foot:toward('foot'),toes:toward('toes'),k:toward('k'),
      planted:Boolean(still&&release===0||release>=1&&leg.planted)};
  }).sort((a,b)=>a.foot.y-b.foot.y);
  return {...r,...body,helmet:body.head,legs};
}

const bladeInterruptions=new WeakMap<object,InterruptionPose>();
const passiveBladePoses=new Set(['dash','sidestep','backstep','hit','guard','parry','ready']);

/** During a cancel into a non-strike pose, carry the visible hilt and blade
 * into their new arrangement together. Live strikes and binds never lag. */
export function sampleArcadeBladeInterruption(f:Fighter, r:PaintRig, time:number){
  if(f.recoveryFlow!==true)return r;
  const actor=f[WALK_SOURCE]?.actor??f;
  if(r.reducedMotion||f.alive===false||f.saberOff||r.action==='ko'||!isFinite(time)){
    bladeInterruptions.delete(actor);return r;
  }
  const previous=bladeInterruptions.get(actor), base=arcadeBladeWorld(f,r);
  const kind=r.action+'/'+(f.attack?f.attackSerial??f.attack:'-');
  const x=val(f.x),y=val(f.y);
  const close=previous&&time>=previous.time&&time-previous.time<.080&&
    Math.hypot(x-previous.x,y-previous.y)<18&&previous.phase===base.phase&&
    previous.blades.length===base.blades.length&&previous.blades.every((b,i)=>b.id===base.blades[i].id);
  const eligible=passiveBladePoses.has(r.action)&&!f.attack&&!r.clash;
  let bridge=close&&eligible?previous.bridge:null;
  if(close&&eligible&&kind!==previous.kind){
    const gap=Math.max(...base.blades.map((b,i)=>Math.hypot(
      b.tip.x-previous.blades[i].tip.x-x+previous.x,b.tip.y-previous.blades[i].tip.y-y+previous.y)));
    if(gap>9)bridge={time,x:previous.x,y:previous.y,blades:previous.blades,target:base.blades,
      span:r.action==='parry'?.055:r.action==='guard'?.075:.098};
  }
  if(bridge&&time-bridge.time>=bridge.span)bridge=null;
  let paint=r;
  if(bridge){
    const w=1-Math.max(smooth((time-bridge.time)/bridge.span),smooth((Math.hypot(x-bridge.x,y-bridge.y)-20)/28)), {local}=arcadeBasis(f,r);
    const carry=(i:number)=>{
      const target=base.blades[i], old=bridge.blades[i];
      const a=Math.atan2(target.tip.y-target.hand.y,target.tip.x-target.hand.x);
      const b=Math.atan2(old.tip.y-old.hand.y,old.tip.x-old.hand.x);
      const initial=bridge.target[i], start=Math.atan2(initial.tip.y-initial.hand.y,initial.tip.x-initial.hand.x);
      const pitch=a+Math.atan2(Math.sin(b-start),Math.cos(b-start))*w;
      const span=Math.hypot(target.tip.x-target.hand.x,target.tip.y-target.hand.y);
      const h=P(mix(target.hand.x,old.hand.x+x-bridge.x,w),mix(target.hand.y,old.hand.y+y-bridge.y,w));
      return [local(h),local(P(h.x+Math.cos(pitch)*span,h.y+Math.sin(pitch)*span))];
    };
    const [emitter,blade]=carry(0);
    let hand=emitter,backHand=r.backHand,offEmitter=r.offEmitter,offBlade=r.offBlade;
    if(r.staff){
      const offset=(d:number)=>{const dx=blade.x-emitter.x,dy=blade.y-emitter.y,n=Math.hypot(dx,dy)||1;
        return P(emitter.x+dx*d/n,emitter.y+dy*d/n);};
      hand=offset(-Math.hypot(r.hand.x-r.emitter.x,r.hand.y-r.emitter.y));
      backHand=offset(-Math.hypot(r.backHand.x-r.emitter.x,r.backHand.y-r.emitter.y));
      offEmitter=offset(-Math.hypot(r.offEmitter.x-r.emitter.x,r.offEmitter.y-r.emitter.y));
      offBlade=offset(-Math.hypot(r.offBlade!.x-r.emitter.x,r.offBlade!.y-r.emitter.y));
    }else if(base.blades.length===2){
      [offEmitter,offBlade]=carry(1);backHand=offEmitter;
    }else{
      backHand=P(r.backHand.x+(hand.x-r.hand.x)*.30,r.backHand.y+(hand.y-r.hand.y)*.30);
    }
    const elbow=(a:Point,b:Point,old:Point)=>P(a.x+(b.x-old.x)*.46,a.y+(b.y-old.y)*.46);
    paint={...r,hand,backHand,blade,offBlade,emitter,offEmitter,
      frontElbow:elbow(r.frontElbow,hand,r.hand),backElbow:elbow(r.backElbow,backHand,r.backHand)};
  }
  const drawn=paint===r?base:arcadeBladeWorld(f,paint);
  bladeInterruptions.set(actor,{kind,time,x,y,phase:drawn.phase,blades:drawn.blades,bridge});
  return paint;
}

const airHandoffs=new WeakMap<object,AirPose>();
const airBodyKeys:ChestKey[]=['head','shoulder','pelvis','frontElbow','backElbow'];

/** Ground contact is handed from the painted stride to takeoff, and from
 * the actual descent into its catch. Altitude, bind and weapon stay exact. */
export function sampleArcadeAirHandoff(f:Fighter, r:PaintRig, time:number){
  if(f.peasantMotion!==true||f.recoveryFlow!==true)return r;
  const actor=f[WALK_SOURCE]?.actor??f, prior=airHandoffs.get(actor);
  if(r.reducedMotion||r.action==='ko'||r.action==='clash'||r.action==='hit'||f.alive===false||!isFinite(time)){
    airHandoffs.delete(actor);return r;
  }
  const phase=r.airPhase, x=val(f.x),y=val(f.y),hop=r.hop;
  const close=prior&&time>=prior.time&&time-prior.time<.10&&Math.hypot(x-prior.x,y-prior.y)<22;
  let bridge=close?prior.bridge:null;
  if(close&&phase!==prior.phase){
    const launch=phase==='takeoff'&&prior.phase==='grounded';
    const catchDown=phase==='landing'&&prior.phase==='airborne';
    const stepOut=phase==='grounded'&&prior.phase==='landing';
    bridge=null;
    if(launch||catchDown||stepOut){
      const origin={x:prior.x,y:prior.y}, feet=arcadeFeetWorld(origin,prior.paint);
      const basis=arcadeBasis(origin,prior.paint);
      bridge={at:time,x:prior.x,y:prior.y,hop:prior.hop,feet,
        body:Object.fromEntries(airBodyKeys.map(key=>[key,basis.project(prior.paint[key])])) as Record<ChestKey,Point>,
        phase,span:launch?.118:catchDown?.067:.089,support:feet.find(l=>l.planted)?.side};
    }
  }
  if(bridge&&time-bridge.at>=bridge.span)bridge=null;
  let paint=r;
  if(bridge){
    const {project,local}=arcadeBasis(f,r);
    const age=time-bridge.at,dx=x-bridge.x,dy=y-bridge.y,dh=hop-bridge.hop;
    const liftOff=bridge.phase==='takeoff', landed=bridge.phase==='landing';
    const p=smooth(age/bridge.span), cap=smooth((Math.hypot(dx,dy)-7)/22);
    const w=Math.max(p,cap), body={} as Record<ChestKey,Point>;
    for(const key of airBodyKeys){
      const a=project(r[key]),b=bridge.body[key];
      const u=key==='head'?w:Math.max(w,smooth(age/(bridge.span*.80)));
      body[key]=local(P(mix(b.x+dx,a.x,u),mix(b.y+dy-dh,a.y,u)));
    }
    const legs=r.legs.map(l=>{
      const old=bridge.feet.find(v=>v.side===l.side);
      if(!old)return l;
      const holds=(liftOff||bridge.phase==='grounded')&&bridge.support===l.side;
      const release=holds?Math.max(smooth((age-.024)/(bridge.span-.024)),cap):w;
      const lift=(liftOff&&!holds?4.6:bridge.phase==='grounded'&&!holds?3:0)*Math.sin(Math.PI*release);
      const follow=landed?1:0;
      const blend=(key:"foot"|"toes"|"k")=>{
        const a=project(l[key]), b=old[key];
        return local(P(mix(b.x+follow*dx,a.x,release),
          mix(b.y+follow*dy-(landed?dh:0),a.y,release)-lift*(key==='k'?.36:1)));
      };
      return {...l,foot:blend('foot'),toes:blend('toes'),k:blend('k'),
        planted:holds&&release===0||release>=1&&l.planted};
    }).sort((a,b)=>a.foot.y-b.foot.y);
    paint={...r,...body,helmet:body.head,legs};
  }
  airHandoffs.set(actor,{phase,x,y,hop,time,bridge,paint});
  return paint;
}

/** Shared live-art rig for both drawing styles. The engine never calls this. */
const soleTrajectories=new WeakMap<object,{time:number;root:Point;feet:LegWorld[]}>();
/** Follow the painted pose, with a short world-space boot lift at pose seams.
 * This is the final visual layer; the physical rig/weapon endpoints are never
 * interpolated here. Airborne steps, teleports and reduced motion opt out. */
function samplePeasantSoles(f:Fighter, r:PaintRig, time:number){
  const actor=f[WALK_SOURCE]?.actor??f;
  if(f.peasantMotion!==true||r.reducedMotion||f.alive===false||
    !['grounded','takeoff','landing'].includes(r.airPhase!)||!isFinite(time)){
    soleTrajectories.delete(actor);return r;
  }
  const root=P(val(f.x),val(f.y)), target=arcadeFeetWorld(f,r), prev=soleTrajectories.get(actor);
  const dt=prev?time-prev.time:0, rootStep=prev?Math.hypot(root.x-prev.root.x,root.y-prev.root.y):0;
  if(!prev||dt<0||dt>.105||rootStep>18){
    soleTrajectories.set(actor,{time,root,feet:target});return r;
  }
  const {local}=arcadeBasis(f,r), next:LegWorld[]=[];
  let changed=false;
  const legs=r.legs.map(leg=>{
    const prior=prev.feet.find(sole=>sole.side===leg.side), goal=target.find(sole=>sole.side===leg.side);
    if(!prior||!goal){if(goal)next.push(goal);return leg;}
    const reach=Math.hypot(goal.foot.x-prior.foot.x,goal.foot.y-prior.foot.y);
    const toeReach=Math.hypot(goal.toes.x-prior.toes.x,goal.toes.y-prior.toes.y);
    const settle=prior.planted&&goal.planted&&reach<.8&&toeReach<1.1&&rootStep<4.2;
    const seam=Math.max(reach,toeReach);
    const limit=clamp(dt*420+rootStep*.23,.35,12);
    if(!settle&&seam<=limit){next.push(goal);return leg;}
    if(settle&&seam<1e-6){next.push(goal);return leg;}
    changed=true;
    const ratio=settle?0:Math.min(1,limit/Math.max(.01,seam));
    const ease=(a:Point,b:Point,w=ratio)=>P(mix(a.x,b.x,w),mix(a.y,b.y,w));
    const groundedPlanted=settle||goal.planted&&ratio>=1;
    const catchLift=!settle&&goal.planted?Math.min(4.5,(seam-limit)*.18)*Math.min(1,dt*72):0;
    const point=(a:Point,b:Point)=>{const v=ease(a,b);return P(v.x,v.y-catchLift);};
    const foot=point(prior.foot,goal.foot),toes=point(prior.toes,goal.toes);
    const knee=ease(prior.k,goal.k,Math.max(.39,ratio));
    next.push({side:leg.side,foot,toes,k:knee,planted:groundedPlanted});
    return {...leg,foot:local(foot),toes:local(toes),k:local(knee),planted:groundedPlanted};
  });
  soleTrajectories.set(actor,{time,root,feet:next});
  return changed?{...r,legs:legs.sort((a,b)=>a.foot.y-b.foot.y)}:r;
}

export function sampleArcadeRenderRig(f:Fighter, physical:PaintRig, time:number, {ghost=false}:Pick<DrawOptions,"ghost">={}){
  const authored=sampleArcadePresentation(f,physical);
  if(ghost)return authored;
  const footwork=sampleArcadeFootwork(f,sampleArcadeStyleSpin(f,authored),time);
  const air=sampleArcadeAirHandoff(f,footwork,time);
  const impact=sampleArcadeImpactPose(f,air,time);
  const recovery=sampleArcadeRecoveryPose(f,impact,time);
  return samplePeasantSoles(f,sampleArcadeBladeInterruption(f,recovery,time),time);
}

export function drawArcadeFighter(ctx:Canvas, f:Fighter, time=0, options:DrawOptions={}) {
  const physicalRig=options.rig??sampleArcadeFighter(f,time,options);
  const trakataAge=time-val(f.trakataIgnitedAt,-Infinity);
  const saberOff=f.saberOff===true;
  const trakataFlash=!physicalRig.reducedMotion&&!saberOff&&trakataAge>=0&&trakataAge<.115?1-smooth(trakataAge/.115):0;
  const authored=sampleArcadeRenderRig(f,physicalRig,time,options);
  const r={...authored,appearance:fighterAppearance(f,physicalRig),saberOff,trakataFlash},c=r.palette;
  ctx.save();
  const x=val(f.x),y=val(f.y);
  ctx.translate(x,y);
  if (!options.ghost) flatEllipse(ctx,2,3,22+r.type.hip*.34+r.hop*.075,7+r.hop*.025,
    r.action==='ko'?'#0107122b':'#00081987');
  if(!options.ghost&&options.selected&&r.action!=='ko') {
    ctx.beginPath();ctx.ellipse(0,4,26,9,0,0,TAU);
    ctx.strokeStyle=c.flare;ctx.lineWidth=2.2;ctx.stroke();
  }
  ctx.translate(0,-r.hop);ctx.scale(r.type.scale,r.type.scale);
  const rotate=arcadeRigRotation(physicalRig), pivot=physicalRig.waist;
  if(rotate) {ctx.translate(pivot.x,pivot.y);ctx.rotate(rotate);ctx.translate(-pivot.x,-pivot.y);}
  if(r.action==='ko'){
    const fall=r.reducedMotion?1:smooth(r.t*3.3);
    ctx.globalAlpha*=.84-.28*fall;
    ctx.translate(-r.hdx*fall*14,1-fall*3);
    ctx.rotate(-r.hdx*fall*1.43);
  }
  ctx.lineJoin='round';
  if(options.ghost) {
    silhouetteArt(ctx,r,typeof options.ghost==='string'?options.ghost:c.steel);
    ctx.restore();return physicalRig;
  }
  const outline=options.outline!==false&&r.action!=='ko';
  const layers=outline&&!options.lowDetail?figureLayers(r,c,options.pathFactory??defaultPath):null;
  if(outline&&options.lowDetail)fastFigureRim(ctx,r,c,options.crowded!);
  const drawOffhand=()=>bladeArt(ctx,{...r,hand:r.offEmitter,blade:r.offBlade!,action:'slash',trail:r.offTrail},r.staff?c:{...c,slash:c.split},!r.staff);
  const bladesVisible=options.hideSabers!==true&&(r.action!=='ko'||r.t<.25);
  if(!layers){
    footArt(ctx,r.legs[0],r.forward,c,r.type,false);
    footArt(ctx,r.legs[1],r.forward,c,r.type,true);
  }
  if(!r.staff&&r.offBlade&&bladesVisible&&r.offActive<=.45)drawOffhand();
  if(layers)paintFigureLayers(ctx,r,c,layers,options.crowded!);
  else bodyArt(ctx,r,c,options.lowDetail===true);
  if(bladesVisible){
    if(r.staff){
      line(ctx,[r.offEmitter,r.emitter],INK,11);
      line(ctx,[r.offEmitter,r.emitter],r.saberOff?'#74747a':c.steel,6);
      if(!r.freeHandAction)line(ctx,[r.backHand,r.hand],r.saberOff?'#a39a8d':c.split,3);
    }
    bladeArt(ctx,{...r,hand:r.emitter},c);
  }
  if(r.offBlade&&bladesVisible&&(r.staff||r.offActive>.45))drawOffhand();
  if(bladesVisible){
    // Leave the fingers in front of the hilt, rather than drawing the
    // hilt's bright trim over the whole floating glove.
    if(!r.freeHandAction&&(r.staff||r.offBlade&&(r.offActive>.45||r.saberOff)))handArt(ctx,r.backHand,r.backElbow,r.hdx,r.type,false,c);
    handArt(ctx,r.hand,r.frontElbow,r.hdx,r.type,true,c);
  }
  if(r.freeHandAction&&r.freeHandExtension>.24)openPalmArt(ctx,r,c);
  if(r.action==='force'&&r.outline>.02&&!r.reducedMotion) {
    const {x,y}=r.backHand;
    ctx.save();ctx.globalAlpha=Math.min(.7,r.outline);
    ctx.beginPath();ctx.arc(x,y,9+12*r.outline,0,TAU);ctx.strokeStyle=c.flare;ctx.lineWidth=1.8;ctx.stroke();
    ctx.restore();
  }
  if((r.action==='guard'||r.action==='parry')&&(!r.reducedMotion||r.action==='guard')){
    ctx.save();ctx.globalAlpha=r.action==='parry'?.8:.48;
    ctx.beginPath(); const side=r.hdx;
    ctx.arc(r.shoulder.x+side*19,r.shoulder.y+6,31,side===1?-.98:Math.PI-.98,side===1?.98:Math.PI+.98);
    ctx.strokeStyle=c.flare;ctx.lineWidth=r.action==='parry'?3.3:1.8;ctx.stroke();ctx.restore();
  }
  ctx.restore();return physicalRig;
}

/** The lobby crop uses exactly the same field art and physical rig. */
export function drawArcadeFighterPreview(ctx:Canvas, f:Fighter={}, options:DrawOptions={}){
  const width=options.width??ctx.canvas.width,height=options.height??ctx.canvas.height;
  const time=options.time??0, portrait=options.framing==='portrait';
  const scale=Math.min(width/(portrait?83:160),height/(portrait?83:171));
  const preview={face:portrait?.48:-.04,action:portrait?'idle':'guard',actionTime:.28,actionDuration:.65,...f,
    x:width/(2*scale)-(portrait?2:7),y:height/(2*scale)+(portrait?80:48)};
  ctx.save();ctx.scale(scale,scale);
  const rig=drawArcadeFighter(ctx,preview,time,{reducedMotion:options.reducedMotion??false,hideSabers:portrait});
  ctx.restore();return rig;
}

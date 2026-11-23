import { ARCADE_TECHNIQUES } from './arcade-repertoire.js';
/* Shared art and blade geometry for the arcade arena. */
export const ARCADE_LONG_BLADE_SCALE=1.26;
const TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const val=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{ t=clamp(t); return t*t*(3-2*t); };
const phase=n=>((n%1)+1)%1;
const P=(x,y)=>({x,y});
const PALETTES=[
  {shade:'#073444',mid:'#116678',steel:'#45aeb0',top:'#87f9ed',flare:'#8cfff6',slash:'#2fffd9',split:'#d7ff76'},
  {shade:'#4b183d',mid:'#85244c',steel:'#c2526b',top:'#ff9475',flare:'#ffbc98',slash:'#ff537b',split:'#ffd08c'}
];
const FIGURES={
  femboy:{id:'femboy',head:1.04,shoulder:11.2,waist:6.35,hip:8.8,thigh:4.9,calf:2.75,scale:1.04,
    legLength:3,skin:'#ffd2b0',skinShadow:'#d7867e',hair:'#5b536b',hairLight:'#ddccec'},
  woman:{id:'woman',head:.98,shoulder:9.9,waist:5.5,hip:12.1,thigh:6.0,calf:2.9,scale:1.035,
    legLength:5,skin:'#ce895f',skinShadow:'#98513f',hair:'#261932',hairLight:'#ba6883'}
};
// The third look shares the original body rig; ears and mantle are cosmetic.
FIGURES.rabbit={...FIGURES.femboy,id:'rabbit'};
const FORMS={
  shii_cho:{angle:-.86,hand:16,height:-42,off:9,feet:4,lean:1,bend:1,arc:2.3,under:false,two:true},
  makashi:{angle:-.21,hand:24,height:-52,off:-11,feet:1,lean:5,bend:-2,arc:.42,under:false,two:false},
  soresu:{angle:-1.63,hand:18,height:-50,off:10,feet:-2,lean:-3,bend:7,arc:1.13,under:false,two:true},
  ataru:{angle:-2.20,hand:10,height:-53,off:-11,feet:3,lean:5,bend:5,arc:2.8,under:true,two:false},
  djem_so:{angle:-1.27,hand:18,height:-58,off:15,feet:8,lean:-2,bend:3,arc:2.48,under:false,two:true},
  niman:{angle:-.72,hand:11,height:-39,off:22,feet:1,lean:0,bend:0,arc:1.51,under:true,two:false},
  juyo:{angle:.14,hand:27,height:-44,off:-13,feet:6,lean:8,bend:9,arc:2.95,under:true,two:false}
};
// Form-specific lower-body poses, in local rig units. Positive lead
// lifts/sends the leading boot; negative trail drags or extends the rear one.
// These tracks affect visual joints only, never air height or emitter motion.
const AIR_FORM={
 shii_cho:{name:'lateral-fan',lead:[16,9],trail:[-19,11],hip:5,knee:3,absorb:7,launch:3,flare:1},
 makashi:{name:'needle-line',lead:[26,4],trail:[-15,-9],hip:2,knee:-2,absorb:2,launch:5,flare:-1},
 soresu:{name:'sheltered-tuck',lead:[3,25],trail:[-2,28],hip:4,knee:8,absorb:10,launch:7,flare:1},
 ataru:{name:'vault-fold',lead:[16,12],trail:[-9,15],hip:3,knee:5,absorb:6,launch:6,flare:1},
 djem_so:{name:'hammer-step',lead:[7,22],trail:[-13,-11],hip:5,knee:11,absorb:13,launch:9,flare:-1},
 niman:{name:'balanced-float',lead:[6,-5],trail:[-11,-2],hip:3,knee:1,absorb:5,launch:4,flare:0},
 juyo:{name:'scissor-strike',lead:[29,9],trail:[-21,5],hip:6,knee:7,absorb:8,launch:3,flare:-1},
};
// Load, suspend and plant beats are keyed to the physical phase. No fixed
// clip time is used: the same animation advances with each form's own arc.
const JUMP_STYLE={
 shii_cho:{load:[4,6,5],land:[6,4,6],turn:[-.23,.49],saber:[-.62,-.40],post:[.60,.44]},
 makashi:{load:[1,9,-1],land:[3,8,0],turn:[-.12,.25],saber:[-.24,.06],post:[.17,0]},
 soresu:{load:[11,-6,1],land:[12,-5,1],turn:[.11,-.17],saber:[-1.74,-1.86],post:[-.30,-.18]},
 ataru:{load:[8,7,2],land:[10,5,3],turn:[0,0],saber:[1.24,.50],post:[0,.24]},
 djem_so:{load:[14,-7,4],land:[17,7,7],turn:[.24,-.42],saber:[-2.56,-2.36],post:[-.16,.64]},
 niman:{load:[4,1,-2],land:[5,1,1],turn:[-.17,-.22],saber:[.82,1.10],post:[.26,.08]},
 juyo:{load:[5,12,2],land:[8,13,4],turn:[-.18,.64],saber:[2.35,1.93],post:[-.54,.51]},
};
function aerialLowerBody(form,phase,p,reduced,roll){
 const a=AIR_FORM[form]??AIR_FORM.shii_cho, tone=reduced?.55:1;
 const easing=Math.sin(Math.PI*p)*tone;
 if(phase==='takeoff')return {name:a.name,hip:easing*a.launch*.65,knee:easing*a.launch,lead:[0,0],trail:[0,0],flight:0};
 if(phase==='landing')return {name:a.name,hip:easing*a.absorb*.7,knee:easing*a.absorb*.81,lead:[0,0],trail:[0,0],flight:0};
 if(phase!=='airborne')return null;
 const power=(form==='juyo'?1.45:form==='soresu'?.73:1);
 const apex=easing**power;
 const unlock=smooth((p-.53)/.46);
 const accent=Math.sin(p*TAU)*apex*a.flare;
 const lead=[(a.lead[0]+accent*8)*apex*(1-unlock*.30),a.lead[1]*apex+accent*3];
 const trail=[(a.trail[0]-accent*5)*apex,a.trail[1]*apex-accent*2];
 if(form==='ataru'&&roll){lead[0]*=.72;trail[0]*=.66;}
 return {name:a.name,hip:apex*a.hip,knee:apex*a.knee,lead,trail,flight:apex};
}
const formId=f=>String(f.form||'').toLowerCase().replace(/[’']/g,'').replace(/[ -]+/g,'_');
function figure(f) {
  const body = String(f.body || '').toLowerCase();
  if(body==='femboy'||body==='woman'||body==='rabbit')return FIGURES[body];
  return FIGURES[f.team===1?'woman':'femboy'];
}
function moveName(f){
  const s=String(f.action?.type || f.action?.kind || f.action || '').replace(/[^a-z]/gi,'').toLowerCase();
  if(/^(ko|dead|down|defeated|knockout|fallen)$/.test(s)||(f.alive===false||(f.alive==null&&f.hp<=0)))return 'ko';
  if(/clash|bind/.test(s))return 'clash';
  if(/parry|counter/.test(s))return 'parry';
  if(s==='force')return 'force';
  if(s==='feint')return 'feint';
  if(s==='jump')return 'jump';
  if((f.technique==='vault'||ARCADE_TECHNIQUES[f.technique]?.air)&&s==='rush')return 'leap';
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

/* Far-to-near alternating gait. In the contact half, ankle travels backward at
   exactly -1px per 1px root travel, so the support foot holds in world space.
   In the swing half, it clears the ground and moves to the next heel strike. */
export function arcadeFoot(distance, offset=0, stride=58) {
  const p=phase(val(distance)/stride+offset);
  if(p<.5) {
    const q=p*2;
    return {reach:stride*(.25-p),lift:0,sole:mix(-.23,.31,smooth(q)),planted:true};
  }
  const q=(p-.5)*2;
  return {reach:mix(-stride*.25,stride*.25,smooth(q)),lift:Math.sin(Math.PI*q)**1.12*14,sole:mix(.31,-.23,smooth(q)),planted:false};
}
// One distance clock across both gaits, so accelerating from a walk can never
// re-start the step or teleport the feet. Stance length is > 50% in a walk
// (double support) and < 50% in a run (a brief suspension between contacts).
const GAIT_STRIDE=106;
export function arcadeGait(distance,step=0,running=0) {
  const run=clamp(running), support=mix(.65,.438,run);
  const p=phase(val(distance)/GAIT_STRIDE+step*.5), heel=GAIT_STRIDE*support*.5;
  if(p<support) {
    const t=p/support;
    return {reach:heel-GAIT_STRIDE*p,lift:0,sole:-.25*(1-smooth(t/.24))+.34*smooth((t-.69)/.31),
      planted:true,phase:p};
  }
  const t=(p-support)/(1-support), ease=smooth(t);
  const lift=mix(10.2,19.4,run)*Math.sin(Math.PI*t)**1.6;
  return {reach:mix(-heel,heel,ease),lift,sole:mix(.34,-.25,ease),planted:false,phase:p};
}
// Original Ataru aerial poses, sampled from the real world-height arc.
// Angle is unwrapped until landing so interpolation never reverses around π.
// A full turn and the unrotated stance have exactly the same landing geometry.
function ataruAerialTrick(f,form,airPhase,progress,reducedMotion) {
  if(reducedMotion||form!=='ataru'||airPhase!=='airborne'||!(f.airHeight>0)||(f.alive===false||(f.alive==null&&f.hp<=0)))return {kind:null,angle:0,tuck:0};
  const isParry=f.airTrick==='parry_flip'||f.technique==='parry_flip';
  const air=ARCADE_TECHNIQUES[f.technique]?.air??(f.technique==='vault'?'vault':null);
  const act=f.action==='jump'||f.airStrike;
  const cork=act&&f.jumpKind==='corkscrew', sideFlip=act&&f.jumpKind==='crossflip';
  if(!isParry&&!air&&!cork&&!sideFlip)return {kind:null,angle:0,tuck:0};
  const cross=air==='crossVault', high=air==='highVault';
  const a=sideFlip?.07:cork?.18:isParry?.06:cross?.086:high?.155:.105;
  const b=sideFlip?.84:cork?.94:isParry?.94:cross?.905:high?.92:.87;
  const time=clamp((progress-a)/(b-a));
  const turn=(sideFlip||isParry||cross?-1:1)*TAU*smooth(time);
  return {kind:sideFlip?'crossflip':cork?'corkscrew':isParry?'parry-flip':cross?'cross-vault':high?'high-vault':'vault-flip',
    angle: turn===0?0:turn,
    tuck:Math.sin(Math.PI*time)**(sideFlip?.68:high?.94:cross?1.30:1.12)};
}
// Chamber and extension accents measured relative to each real contact.
// Columns: pitch, wrist reach, wrist drop, lean, knee compression, turn,
// free-hand height, support width. Recoveries deliberately do not all end
// high or return through the same path.
const ATTACK_BEATS={
 cut:{load:[-1.05,-10,-17,-6,2,-.27,6,3],out:[.64,8,12,8,3,.23,-8,5],bias:[-.35,-.15]},
 sweep:{load:[-.61,-16,13,-10,16,-.40,-4,12],out:[1.27,11,17,13,15,.51,-11,10],bias:[.48,.80]},
 thrust:{load:[-.09,-12,1,-7,4,-.09,5,-3],out:[.05,15,-4,12,2,.09,5,-1],bias:[-.28,-.28]},
 screen:{load:[-.52,-6,-12,-4,7,-.18,-7,3],out:[-.43,-10,-13,-9,9,-.19,-8,4],bias:[.36,-.14]},
 rise:{load:[1.03,-7,18,-4,15,.25,-9,8],out:[-1.05,8,-23,11,-5,-.42,7,4],bias:[-.20,.14]},
 vault:{load:[.72,-13,8,-6,9,.26,3,7],out:[-.92,11,-16,11,3,-.35,-4,6],bias:[-.15,-.10]},
 return:{load:[.91,3,9,5,9,.32,-4,4],out:[-.83,-11,-14,-6,6,-.31,7,6],bias:[.16,.31]},
 cast:{load:[-.34,-4,6,-2,3,-.19,-9,0],out:[.24,-5,-2,5,2,.15,2,4],bias:[-.13,-.14]},
};
const visualFamily=(f, action, authored)=>{
  if(action==='force')return 'cast';
  if(f.combo===2||f.combo===4||/return|reversal/.test(f.technique??''))return 'return';
  if(Object.hasOwn(ATTACK_BEATS,f.attackFamily))return f.attackFamily;
  const path=authored?.motion?.path;
  if(path==='point'||path==='feint'||action==='rush')return 'thrust';
  if(path==='screen')return 'screen';
  if(action==='leap')return f.airStrike||authored?.air?'vault':'rise';
  if(action==='sweep'||path==='arc')return 'sweep';
  return 'cut';
};
function contactEnvelope(t,beats,bias){
  let start=0, end=1;
  for(const beat of beats){if(t<=beat){end=beat;break;}start=beat;}
  if(end-start<.0001)return 0;
  return Math.sin(Math.PI*clamp((t-start)/(end-start)))**(1.55+bias);
}
function staffSweep(keys,t){
  const slope=i=>i<0||i+1>=keys.length?0:(keys[i+1][1]-keys[i][1])/(keys[i+1][0]-keys[i][0]);
  const tangent=i=>{
    const a=slope(i-1), b=slope(i);
    return a*b>0?(2*a*b)/(a+b):0;
  };
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
  const [start,a]=keys[i], [end,b]=keys[i+1], d=end-start;
  const u=clamp((t-start)/d),u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a+(-2*u3+3*u2)*b+(u3-2*u2+u)*d*tangent(i)+(u3-u2)*d*tangent(i+1);
}

export function sampleArcadeFighter(f={},time=0,{reducedMotion=false}={}) {
  const facing=val(f.face,(f.team===1?Math.PI:0)), dx=Math.cos(facing),dy=Math.sin(facing);
  const hdx=Math.abs(dx)>.08?Math.sign(dx):Math.sign(val(f.vx)) || (f.team===1?-1:1);
  const takeoffBearing=Number.isFinite(f.airFacing)?f.airFacing:f.action==='jump'?f.jumpBearing:null;
  const flightSide=Number.isFinite(takeoffBearing)?(Math.cos(takeoffBearing)<0?-1:1):hdx;
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
  const confirmedAir=Number.isFinite(f.airHeight)&&f.airPhase!=null;
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
  const punch=(a,b)=>smooth((t-a)/(b-a));
  const moveFallback=f.technique==='deflect'?.248/.37:f.combo===4?.134/.405:f.combo===3?.145/.365:f.combo===2?.1/.265:.108/.285;
  const liveContact=f.attackSpec?.contact && f.actionDuration>0 ? clamp(f.attackSpec.contact/f.actionDuration,.18,.84):null;
  const authored=ARCADE_TECHNIQUES[f.technique];
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
    if(f.combo>=3){angle-=.4*chamber;angle+=.45*punch(.41,.65);lean+=7*steam;extend+=7*steam;handY+=11*cut-11*out;wide+=4*steam;}

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
    const parry=action==='parry' || f.parryTime>.045;
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
  const jump=naturalJump?JUMP_STYLE[form]:null;
  const compression=(row,amount)=>{
    const [knee,shift,span]=row;
    bend+=amount*knee;lean+=amount*shift;wide+=amount*span;plantedWidth=amount*span;
  };
  const trick=ataruAerialTrick(f,form,phaseAir,airProgress,reducedMotion);
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
      if(jump&&action==='jump'&&!reducedMotion&&!trick.kind){
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
    const remaining=clamp(f.airborne/.48);
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
    if(!gaitFeet[1].planted)gaitFeet[1].lift*=1-limp*.66;
  }
  if((action==='guard'||action==='parry')&&guardLag>0){
    bend+=guardLag*2.6; handY+=guardLag*5.2; offY+=guardLag*4; extend-=guardLag*3;
  }
  if(reducedMotion){if(!confirmedAir)hop*=.4;airGather*=.36;roll=0;trail=0;outline=0;torsoTurn=0;}
  const flightStep=gait&&run>.05&&gaitFeet.every(foot=>!foot.planted) ? Math.min(...gaitFeet.map(foot=>foot.lift))*.75 : 0;
  const rhythm=mix(idleBreath,Math.cos(walkPhase*TAU*2)*mix(-1.38,2.05,run)-flightStep,gaitWeight);
  const staff=f.gear?.weapon==='staff'||f.gear?.staff===true;
  const dual=!staff&&(f.gear?.weapon==='dual'||f.gear?.dualSabers===true);
  const reverse=!staff&&(f.gear?.grip==='backhand'||f.gear?.reverseGrip===true);
  const swings=['slash','rush','sweep','leap','rise','uppercut'].includes(action);
  const primaryContact=liveContact??slashContact, rearTiming=val(f.attackSpec?.offhand?.contact);
  const phasePulse=(at,before,after)=>punch(Math.max(0,at-before),at)*(1-punch(at,Math.min(1,at+after)));
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
    const normalizedRear=rearTiming&&f.actionDuration>0?clamp(rearTiming/f.actionDuration,.2,.92):null;
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
    const followAt=rearTiming&&f.actionDuration>0?clamp(rearTiming/f.actionDuration,.20,.94):null;
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
      const keys=[[0,readyAngle],[primaryContact*(form==='juyo'?.29:.40),chamber],[primaryContact,cut],
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
    const turnTo=(from,to)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*hold;
    angle=turnTo(angle,apparent);
    extend+=tipReach*hold;handY+=height*hold;
    if(dual){offPitch=turnTo(offPitch,second);offHand+=off*hold;}
    else if(!staff){offHand+=off*hold;offY+=height*.32*hold;}
    trail=0;offTrail=0;
  }
  const lookDelta=angle=>Math.atan2(Math.sin(angle-val(f.face)),Math.cos(angle-val(f.face)));
  const guarding=action==='guard'||action==='parry';
  if(guarding&&(f.guardLane||Number.isFinite(f.guardBearing))){
    const lane=f.guardLane==='left'?-1:f.guardLane==='right'?1:0;
    const cross=Number.isFinite(f.guardBearing)?clamp(lookDelta(f.guardBearing)/.85,-1,1):lane;
    const ward=lane===0?cross:lane*.64+cross*.36;
    // Shoulder and blade cover the same lane without breaking the two
    // emitters of the staff out of alignment.
    angle+=ward*(staff?.43:reverse?-.38:.58);
    if(dual)offPitch+=ward*(reverse?-.35:.43);
    handY+=ward*5;offY-=ward*3;lean+=ward*2.8;torsoTurn+=ward*.19;
  }
  if(action==='feint'){
    const bearing=Number.isFinite(f.feintBearing)?lookDelta(f.feintBearing):.45;
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
    const [turn,finish,height,reach,tuck]=moves[f.airStrike]??moves.air_cut;
    const loaded=punch(0,primaryContact*.55)*(1-punch(primaryContact*.55,primaryContact));
    const released=punch(primaryContact,primaryContact+(1-primaryContact)*.36)*(1-punch(.81,1));
    const motion=reducedMotion?.63:1;
    angle+=motion*(turn*loaded+finish*released);
    handY+=height*loaded+height*.38*released;
    extend+=reach*released;offY-=tuck*loaded;
    lean-=tuck*loaded;torsoTurn+=motion*(turn*.28*loaded+finish*.17*released);
  }
  const family=(swings||action==='force')&&(f.attack||f.attackFamily)
    ?visualFamily(f,action,authored):null;
  if(family){
    const row=ATTACK_BEATS[family], after=t>primaryContact;
    const actualSecond=rearTiming>0&&f.actionDuration>0?rearTiming/f.actionDuration:0;
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
  const entry=f.poseFrom;
  const entryLimit=f.attack&&Number.isFinite(f.attackSpec?.contact)?f.attackSpec.contact*.70:Infinity;
  const entryDuration=Math.min(val(f.poseEntryDuration),entryLimit);
  const feed=entry&&entryDuration>0&&action!=='clash'&&action!=='ko'
    ?1-smooth((val(f.actionTime)+val(f.poseEntryOffset))/entryDuration):0;
  if(feed>0&&entry.body){
    lean=mix(lean,val(entry.body.lean,lean),feed);
    bend=mix(bend,val(entry.body.bend,bend),feed);
    wide=mix(wide,val(entry.body.wide,wide),feed);
    torsoTurn=mix(torsoTurn,val(entry.body.torsoTurn,torsoTurn),feed);
  }
  const waist=P(forward*lean*.55+torsoTurn*.9,-39+bend*.58+rhythm-type.legLength);
  const pelvis=P(waist.x-forward*1.25,waist.y+10);
  const shoulder=P(forward*lean+torsoTurn*7,-57+bend+rhythm-type.legLength);
  const head=P(shoulder.x+forward*2.6,-75+bend+rhythm-type.legLength);
  const helmet=head; // legacy pose inspection alias, never renders a helmet

  let hand=P(shoulder.x+forward*extend,handY+bend*.45+rhythm+dy*5);
  let backHand=P(shoulder.x+forward*offHand,offY+bend*.45+rhythm-dy*3);
  const airStyle=confirmedAir?aerialLowerBody(form,phaseAir,airProgress,reducedMotion,trick.kind):null;
  const legs=[0,1].map(side=>{
    const sign=side?1:-1;
    const driving=action==='dash'||action==='rush'||action==='sidestep'||action==='backstep';
    const drivePhase=reducedMotion?0:Math.sin(Math.PI*t);
    const flight=confirmedAir?phaseAir==='airborne':hop>1.2;
    const toeLift=driving&&!flight?drivePhase*(side?8:1.4) : flight?(side?airGather*9:airGather*4):0;
    const footArc=gait?gaitFeet[side]:{reach:(side?12:-12)+sign*(wide-plantedWidth+
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
      const compact=airStyle.flight*(form==='soresu'?.68:form==='niman'?.29:0);
      foot.x=mix(foot.x,pelvis.x,compact)+legShape[0]*dx;
      foot.y+=legShape[0]*dy*.47-legShape[1];
    }
    const hip=P(pelvis.x+sign*type.hip*.49,pelvis.y+sign*1.5+(airStyle?.hip??0));
    const kneeLoad=(airStyle?.knee??0)*(side?1:.55);
    const k=P(mix(hip.x,foot.x,.55)+forward*((gait?4.2:6.2)+trick.tuck*(side?9:5.0)+kneeLoad*.55),mix(hip.y,foot.y,.50)-footArc.lift*.19-trick.tuck*(side?6.7:3.4)-kneeLoad*.35);
    const toes=P(foot.x+forward*11,foot.y+1+footArc.sole*7);
    return {side,foot,hip,k,toes,planted:footArc.planted};
  }).sort((a,b)=>a.foot.y-b.foot.y);
  if(feed>0&&Array.isArray(entry.legs)&&['dash','dash_recover','force_recover','pivot'].includes(entry.kind)){
    const {local}=arcadeBasis(f,{type,roll,trick,hdx,flightSide,waist,hop});
    const originX=val(entry.origin?.x,val(f.x)), originY=val(entry.origin?.y,val(f.y));
    const shift=P(val(f.x)-originX,val(f.y)-originY);
    const good=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
    for(const leg of legs){
      const prior=entry.legs.find(l=>l.side===leg.side);
      if(!good(prior?.foot)||!good(prior?.toes)||!good(prior?.k))continue;
      // A grounded sole stays in world space while the hips pass over it.
      // Airborne or traveling limbs follow the actor. A very fast dash
      // gradually releases the hold before a robe-length leg can stretch.
      const drift=smooth((Math.hypot(shift.x,shift.y)-8)/23);
      const lock=prior.planted&&!airGather?1-drift:0;
      const carry=(p,amount)=>local(P(p.x+shift.x*amount,p.y+shift.y*amount));
      const source=carry(prior.foot,1-lock), toe=carry(prior.toes,1-lock);
      const knee=carry(prior.k,1-lock*.55);
      const blend=(p,q,w)=>P(mix(p.x,q.x,w),mix(p.y,q.y,w));
      leg.foot=blend(leg.foot,source,feed);
      leg.toes=blend(leg.toes,toe,feed);
      leg.k=blend(leg.k,knee,feed*.94);
      if(feed>.72&&lock>.7)leg.planted=true;
    }
    legs.sort((a,b)=>a.foot.y-b.foot.y);
  }
  const bladeLength=action==='rush'?55:form==='makashi'?47:form==='shii_cho'?53:49;
  // All kits use a polar screen projection: at a depth turn neither
  // component can cancel the other and make a solid saber disappear.
  const axis=Math.atan2(dy,dx), pitchScale=dx+dy*.35;
  const aim=(h,p,len)=>P(h.x+Math.cos(p)*len,h.y+Math.sin(p)*len);
  let blade=aim(hand,axis+angle*(staff?1:pitchScale),bladeLength);
  let offBlade=dual?aim(backHand,axis+offPitch*pitchScale,35):null;
  // Both staff emitters are derived from the exact same axis, even when its
  // rear blade binds at a measured world point.
  const shaftEnd=(h,b,d)=>{const n=Math.hypot(b.x-h.x,b.y-h.y)||1;return P(h.x+(b.x-h.x)*d/n,h.y+(b.y-h.y)*d/n);};
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
    const has=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
    const follow=has(entry.origin)?P(val(f.x)-entry.origin.x,val(f.y)-entry.origin.y):P(0,0);
    const actor=p=>local(P(p.x+follow.x,p.y+follow.y));
    const shift=(a,b)=>P(mix(a.x,b.x,feed),mix(a.y,b.y,feed));
    const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
    const recovery=entry.kind==='dash_recover'||entry.kind==='force_recover';
    function carry(h,b,source,secondary=false){
      if(!has(source?.hand)||!has(source?.tip))return [h,b];
      const oldH=actor(source.hand),oldB=actor(source.tip);
      const delta=Math.atan2(b.y-h.y,b.x-h.x);
      const was=Math.atan2(oldB.y-oldH.y,oldB.x-oldH.x);
      let arc=wrap(was-delta);
      if(recovery){
        // Select the angular branch relative to the old facing, not the
        // changing target each frame. Looking back across a recovery can
        // cross the antipode without flipping the arc mid-interpolation.
        const captured=Number.isFinite(entry.facing)?entry.facing:null;
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
        const swing=wrap(facing-stableFacing)+localPitch*(staff?1:pitchScale)-referencePitch+worldRotation;
        arc=wrap(wasWorld-reference)-swing;
      }
      const pitch=delta+arc*feed;
      const oldSpan=Math.hypot(oldB.x-oldH.x,oldB.y-oldH.y);
      const span=mix(Math.hypot(b.x-h.x,b.y-h.y),oldSpan,feed), grip=shift(h,oldH);
      return [grip,aim(grip,pitch,span)];
    }
    if(staff&&has(entry.hand)&&has(entry.tip)){
      const [grip,tip]=carry(shaftEnd(hand,blade,halfGrip),blade,entry);
      hand=shaftEnd(grip,tip,-halfGrip);
      blade=tip;offBlade=shaftEnd(hand,blade,-Math.hypot(tip.x-hand.x,tip.y-hand.y));
    }else if(!staff){
      [hand,blade]=carry(hand,blade,entry);
      if(dual)[backHand,offBlade]=carry(backHand,offBlade,entry.offhand,true);
      else if(has(entry.freeHand))backHand=shift(backHand,actor(entry.freeHand));
    }
  }
  let clash=null;
  if(action==='clash'&&Number.isFinite(f.clashX)&&Number.isFinite(f.clashY)) {
    const basis={type,roll,trick,hdx,flightSide,waist,hop};
    const useOffhand=Boolean(offBlade&&f.clashFrom?.offhand===true);
    const oldTip=useOffhand?offBlade:blade;
    const oldHand=staff?shaftEnd(hand,oldTip,halfGrip):useOffhand?backHand:hand;
    clash=clashBind(f,basis,oldHand,oldTip,t,reducedMotion);
    if(staff){
      hand=shaftEnd(clash.hand,clash.tip,-halfGrip);
      if(useOffhand){offBlade=clash.tip;blade=shaftEnd(hand,offBlade,-halfGrip-staffLength);}
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
  const offEmitter=staff?shaftEnd(hand,offBlade,halfGrip):backHand;
  if(staff)backHand=shaftEnd(hand,offBlade,7.5);
  const frontElbow=staff||dual
    ?P(mix(shoulder.x+forward*type.shoulder*.56,hand.x,.49)+forward*(reverse?-4:1.5),mix(shoulder.y,hand.y,.51)+(staff?9:7))
    :P(mix(shoulder.x,hand.x,.51)+forward*(reverse?-5:.5),mix(shoulder.y,hand.y,.58)+(reverse?3:7));
  const backElbow=staff||dual
    ?P(mix(shoulder.x-forward*type.shoulder*.69,backHand.x,.52)-forward*(staff?3.9:4.8),mix(shoulder.y,backHand.y,.48)+(staff?10:6))
    :P(mix(shoulder.x,backHand.x,.52)-forward*7,mix(shoulder.y,backHand.y,.55)+6);
  return {type,form,action,t,dy,forward,hdx,flightSide,lean,bend,wide,torsoTurn,hop,roll,trick,legs,waist,pelvis,shoulder,head,helmet,hand,backHand,frontElbow,backElbow,blade,offBlade,staff,reverse,saberPhase,ignition,emitter,offEmitter,offTrail,offActive,trail,outline,clash,
    phase:age,gait:gait?(run>.55?'run':'walk'):'none',attackFamily:family,airPhase:phaseAir,airStyle:airStyle?.name??null,airSilhouette:airStyle?.flight??0,palette:PALETTES[f.team===1?1:0],reducedMotion};
}

const arcadeRigRotation=r=>(r.roll+val(r.trick?.angle))*(r.flightSide??r.hdx);
function arcadeBasis(f,r){
  const scale=r.type.scale, rotate=arcadeRigRotation(r), cos=Math.cos(rotate),sin=Math.sin(rotate);
  const x=val(f.x),y=val(f.y)-r.hop,px=r.waist.x,py=r.waist.y;
  return {
    project:p=>{
      const dx=p.x-px,dy=p.y-py;
      return P(x+(px+dx*cos-dy*sin)*scale,y+(py+dx*sin+dy*cos)*scale);
    },
    local:p=>{
      const dx=(p.x-x)/scale-px,dy=(p.y-y)/scale-py;
      return P(px+dx*cos+dy*sin,py+dy*cos-dx*sin);
    }
  };
}
export function arcadeHeroLabelWorld(f,r){
  const {project}=arcadeBasis(f,r);
  const head=project(r.head);
  const top=Math.min(head.y-(r.type.id==='rabbit'?40:23)*r.type.scale,
    project(r.waist).y-8,...r.legs.map(l=>project(l.foot).y-12));
  return {x:head.x,y:top};
}
export function arcadeFeetWorld(f,r){
  const {project}=arcadeBasis(f,r);
  return r.legs.map(l=>({side:l.side,foot:project(l.foot),toes:project(l.toes),k:project(l.k),planted:l.planted}));
}
export function arcadeBladeWorld(f,r) {
  const {project}=arcadeBasis(f,r);
  const primary={hand:project(r.emitter??r.hand),tip:project(r.blade)};
  const blades=[{id:'main',...primary}];
  const body=project(P(mix(r.waist.x,r.shoulder.x,.57),mix(r.waist.y,r.shoulder.y,.57)));
  const freeHand=project(r.backHand);
  if(!r.offBlade)return {...primary,phase:r.saberPhase,body,freeHand,blades};
  const offhand={hand:project(r.offEmitter??r.backHand),tip:project(r.offBlade)};
  blades.push({id:r.staff?'rear':'off',...offhand});
  return {...primary,offhand,phase:r.saberPhase,body,freeHand,blades};
}
function clashBind(f,r,neutralHand,neutralTip,t,reducedMotion){
  const {project,local}=arcadeBasis(f,r), point=P(f.clashX,f.clashY);
  const start=f.clashFrom;
  const good=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
  const h=good(start?.hand)?start.hand:project(neutralHand);
  const tip=good(start?.tip)?start.tip:project(neutralTip);
  const dx=tip.x-h.x,dy=tip.y-h.y;
  const length=Math.max(1,Math.hypot(dx,dy)), base=Math.atan2(dy,dx);
  const notch=clamp(((point.x-h.x)*dx+(point.y-h.y)*dy)/(length*length),.16,1);
  const shift=(f.clashRole==='defender'?-.20:.16)*r.hdx*(reducedMotion?.65:1);
  const wind=smooth(t/.13), release=smooth((t-.36)/.29), settle=smooth((t-.59)/.41);
  const angle=base+shift*wind-shift*2.85*release;
  const ux=Math.cos(angle),uy=Math.sin(angle);
  const backward=release*(f.clashRole==='defender'?18:13);
  const anchor=P(point.x-r.hdx*backward,point.y-release*5.8);
  const bh=P(anchor.x-ux*length*notch,anchor.y-uy*length*notch);
  const bt=P(anchor.x+ux*length*(1-notch),anchor.y+uy*length*(1-notch));
  const blend=(a,b,weight)=>P(mix(a.x,b.x,weight),mix(a.y,b.y,weight));
  // Interpolate orientation and projected length, not both tips linearly:
  // otherwise opposing end angles briefly collapse the physical blade.
  const palm=blend(blend(h,bh,wind),project(neutralHand),settle);
  const entryAngle=angle;
  const goal=project(neutralTip), natural=project(neutralHand);
  const naturalAngle=Math.atan2(goal.y-natural.y,goal.x-natural.x);
  const relative=Math.atan2(Math.sin(naturalAngle-entryAngle),Math.cos(naturalAngle-entryAngle));
  const blendedAngle=entryAngle+relative*settle;
  const blendedLength=mix(length,Math.hypot(goal.x-natural.x,goal.y-natural.y),settle);
  const end=P(palm.x+Math.cos(blendedAngle)*blendedLength,palm.y+Math.sin(blendedAngle)*blendedLength);
  return {hand:local(palm),tip:local(end),point,bindWeight:wind*(1-settle),
    bound:t>=.13&&t<=.36};
}

const INK='#181619';
function polygon(ctx,coords,fill,edge=null,width=2) {
  ctx.beginPath(); ctx.moveTo(coords[0][0],coords[0][1]);
  for(let j=1;j<coords.length;j++)ctx.lineTo(coords[j][0],coords[j][1]);
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  if(edge){ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
}
function line(ctx,points,stroke,width,cap='round'){
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap=cap;ctx.stroke();
}
function flatEllipse(ctx,x,y,rx,ry,color) {
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();
}
// Hand-drawn curves, flattened cel panels and a continuous skin/clothing
// silhouette. The skeleton places the shape; it is never visible as a stroke.
function celPath(ctx,commands,fill,edge=null,width=1.12) {
  ctx.beginPath();
  for(const [op,...a] of commands){
    if(op==='M')ctx.moveTo(...a);
    else if(op==='L')ctx.lineTo(...a);
    else if(op==='Q')ctx.quadraticCurveTo(...a);
    else if(op==='C')ctx.bezierCurveTo(...a);
    else ctx.closePath();
  }
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(edge){ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
}
const unit=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return P(dx/l,dy/l);};
const at=(p,d,x,y=0)=>[p.x+d.x*x-d.y*y,p.y+d.y*x+d.x*y];
// Detached pads are silhouettes in their own right. Nothing is drawn from
// the ankle to a knee or hip, or from the rounded mitt back to the shoulder.
function footArt(ctx,leg,fwd,c,type,near,color=null){
  const {foot,toes}=leg, dir=fwd||.001, press=leg.planted?1:0;
  const scale=type.id==='rabbit'?1.04:1;
  const toe=clamp((toes.x-foot.x)*.44,-5,5), shape=(x,y)=>[foot.x+x*scale+toe,foot.y+y];
  const tilt=clamp((toes.y-foot.y)*.35,-2.1,2.1)-press*.2;
  celPath(ctx,[['M',...shape(-8,0)],['Q',...shape(-8.6,-5.8),...shape(-2,-6.8)],
    ['Q',...shape(4,-6.9+tilt),...shape(8,-3.2+tilt)],['Q',...shape(11.2,1+tilt),...shape(6.5,3.35)],
    ['Q',...shape(-1,4),...shape(-6.1,2.45)],['Q',...shape(-8,1.45),...shape(-8,0)],['Z']],
    color??(near?'#38393d':'#252629'),color?null:INK,1.85);
  if(color)return;
  line(ctx,[P(...shape(-5.6,1.6)),P(...shape(5.6,1.5))],near?'#8b8d8e':'#4c4e51',1.18);
  if(near)line(ctx,[P(...shape(-1*dir,-4.4)),P(...shape(2.6*dir,-3.7))],c.steel,.85);
}
function handArt(ctx,p,elbow,d,type,near,c,color=null){
  const u=unit(elbow,p), h=(x,y)=>at(p,u,x,y);
  // A circular leather mitt with a curled thumb, not a cylindrical cuff.
  celPath(ctx,[['M',...h(-5.8,0)],['C',...h(-6,-4.1),...h(-3.2,-6.1),...h(.4,-6)],
    ['Q',...h(4.7,-6.1),...h(6,-2.9)],['Q',...h(9.1,-1.4),...h(6.6,1.7)],
    ['Q',...h(5.4,6),...h(1.7,6.1)],['C',...h(-3.4,6.35),...h(-6.4,3.6),...h(-5.8,0)],['Z']],
    color??(near?'#e4d6c6':'#bda99a'),color?null:INK,1.72);
  if(color)return;
  line(ctx,[P(...h(2.1,-3.5)),P(...h(4.1,-1.72)),P(...h(3.8,.2))],near?'#88756a':'#6f5b53',1.13);
  if(near)line(ctx,[P(...h(-2.8,-2.3)),P(...h(-1.8,-3.9)),P(...h(.0,-4.4))],'#f6ebdd',.92);
}
function rabbitEars(ctx,r,color=null){
  const {head,hdx:d}=r;
  const air=r.trick?.tuck??0;
  const lag=r.reducedMotion?0:clamp(Math.abs(r.lean)*.14+air*5+
    (['dash','hit','leap','ko'].includes(r.action)?Math.sin(Math.PI*r.t)*7:0),0,13);
  const A=(x,y)=>[head.x+x,head.y+y];
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
function rabbitHead(ctx,r,c,lowDetail){
  rabbitEars(ctx,r);
  const A=(x,y)=>[r.head.x+r.hdx*x,r.head.y+y];
  const M=(x,y)=>['M',...A(x,y)],L=(x,y)=>['L',...A(x,y)],Q=(x,y,u,v)=>['Q',...A(x,y),...A(u,v)];
  const focused=['guard','parry','clash','slash','sweep','rush','leap','feint','force'].includes(r.action);
  celPath(ctx,[M(-11,-6),Q(-10,-14,-2,-14),Q(6,-15,12,-8),Q(13,-3,11,.5),
    Q(12,4,8,8),Q(1,13,-8,8),Q(-14,3,-11,-6),['Z']],'#ede2d4',INK,2.1);
  celPath(ctx,[M(-11,-5),Q(-11,2,-6,6),Q(1,10,9,5),Q(6,12,-2,11),Q(-13,8,-11,-5),['Z']],'#b4a397');
  const eye='#342724';
  if(r.dy<-.58){
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
function inkAirSilhouette(r){
  if(!(r.airSilhouette>0))return r;
  const shapes={
    'lateral-fan':[5,-1,-3, 6, 2], 'needle-line':[13,-4,4, 5,-4],
    'sheltered-tuck':[-4,10,-3,-9, 6], 'vault-fold':[-7,5,0, -7,2],
    'hammer-step':[-13,1,5, -11,-5], 'balanced-float':[-6,-5,-4, 1,5],
    'scissor-strike':[14,8,1, 12,-3],
  };
  const [sx,sy,wx,headX,headY]=shapes[r.airStyle]??[0,0,0,0,0];
  const w=r.airSilhouette, d=r.forward;
  const translate=(p,x,y)=>P(p.x+x*w*d,p.y+y*w);
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
const appearanceCache=new WeakMap();
function fighterAppearance(f,r){
  const gender=['female','male','nonbinary'].includes(f.gender)?f.gender:null;
  const seed=f.appearanceSeed??null;
  const saved=appearanceCache.get(f);
  if(saved&&saved.gender===gender&&saved.seed===seed&&saved.type===r.type.id)return saved.look;
  let number=0;
  if(seed!==null){
    number=2166136261;
    for(const char of String(seed))number=Math.imul(number^char.codePointAt(0),16777619)>>>0;
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
function headArt(ctx,r,c,lowDetail=false) {
  if(r.type.id==='rabbit'){rabbitHead(ctx,r,c,lowDetail);return;}
  const {head,hdx:d,type}=r, look=r.appearance, woman=look?.femme??type.id==='woman';
  const hair=look?.hair??(woman?'bob':'hood'), hood=hair==='hood', softBoy=look?.softBoy===true;
  const ink=look?.ink??'#29262c', shade=look?.shade??'#45404a', shine=look?.gleam??'#695c63';
  const away=smooth((-r.dy-.18)/.68), profile=smooth(Math.abs(r.forward)/.87);
  const scale=1.24;
  const A=(x,y)=>[head.x+d*x*scale*(.79+profile*.21),head.y+y*scale];
  const Q=(x,y,u,v)=>['Q',...A(x,y),...A(u,v)];
  const C=(x,y,u,v,k,l)=>['C',...A(x,y),...A(u,v),...A(k,l)];
  const L=(x,y)=>['L',...A(x,y)];
  const M=(x,y)=>['M',...A(x,y)];
  const U=(...v)=>P(...A(...v));
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
function bodyArt(ctx,r,c,lowDetail=false) {
  const {shoulder:s,waist:w,pelvis:h,head,hdx:d,type,forward}=r, feminine=type.id==='woman';
  const rabbit=type.id==='rabbit', look=r.appearance;
  const sh=type.shoulder*(look?.softBoy?.85:1), wa=type.waist*(look?.softBoy?.88:1), hip=type.hip;
  const clothSide=forward*.68+d*.32*smooth(Math.abs(forward)/.48);
  const S=(x,y)=>[s.x+x,s.y+y], W=(x,y)=>[w.x+x,w.y+y], H=(x,y)=>[h.x+x,h.y+y];
  const moving=['dash','sidestep','backstep','hit','ko'].includes(r.action);
  const sweep=['slash','sweep','rush','leap'].includes(r.action);
  const impulse=r.reducedMotion?0:Math.sin(Math.PI*r.t);
  const carried=sweep?Math.max(0,r.t-.27)*impulse:0;
  const flight=(r.airSilhouette??0)*.8;
  const cloth=Math.min(12,Math.abs(r.lean)*.20+flight*3.2+impulse*(moving?6:0)+carried*15);
  const lift=r.reducedMotion?0:impulse*(moving?1.35:0)+carried*8;
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
function bladeArt(ctx,r,c,offhand=false) {
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
  if(r.ignition>0||r.trakataFlash>0) {
    // Light races along an already authoritative blade. Do not interpolate
    // either emitter or tip: the engine and screen agree on the switch frame.
    const ignition=Math.max(r.ignition,r.trakataFlash);
    const flash=r.trakataFlash>0?1-r.trakataFlash:r.saberPhase==='long'?1-r.ignition:r.ignition;
    const pulse=P(mix(h.x,b.x,flash),mix(h.y,b.y,flash));
    const streak=P(mix(h.x,b.x,Math.max(0,flash-.2)),mix(h.y,b.y,Math.max(0,flash-.2)));
    ctx.save();ctx.globalAlpha*=.82*ignition;ctx.globalCompositeOperation='lighter';
    line(ctx,[streak,pulse],c.flare,10*weight);
    flatEllipse(ctx,pulse.x,pulse.y,4*weight,4*weight,'#f5ffff');
    ctx.restore();
  }
}
function silhouetteArt(ctx,r,color) {
  const {type,shoulder:s,waist:w,pelvis:h,head,hdx:d,forward}=r;
  const sh=type.shoulder,wa=type.waist,hip=type.hip;
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
function figureArt(ctx,r,c) {
  footArt(ctx,r.legs[0],r.forward,c,r.type,false);
  footArt(ctx,r.legs[1],r.forward,c,r.type,true);
  bodyArt(ctx,r,c);
}
function figureLayers(r,c,pathFactory) {
  if(typeof pathFactory!=='function')return null;
  const probe=pathFactory();
  if(!probe||typeof probe.addPath!=='function')return null;
  const draws=[], groups=new Map();
  let path=null, item=null, commands=[];
  const remember=()=>{
    if(!item){item={path,commands,fill:null,stroke:null,width:0,cap:'round'};draws.push(item);}
    return item;
  };
  const tape={
    beginPath(){path=pathFactory();item=null;commands=[];},
    fill(){remember().fill=this.fillStyle;},
    stroke(){const step=remember();step.stroke=this.strokeStyle;step.width=this.lineWidth;step.cap=this.lineCap;},
    lineCap:'round',lineJoin:'round',lineWidth:1
  };
  for(const cmd of ['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','ellipse','closePath'])
    tape[cmd]=(...args)=>{path[cmd](...args);commands.push([cmd,args]);};
  figureArt(tape,r,c);
  for(const step of draws) {
    const bucket=Math.round(step.width*2)*.5;
    if(!groups.has(bucket))groups.set(bucket,pathFactory());
    const group=groups.get(bucket);
    for(const [cmd,args] of step.commands){
      // Start each ellipse as its own subpath. Using addPath on a
      // renderer backend can stitch open subpaths into 'phantom limbs'.
      if(cmd==='ellipse'){group.moveTo(args[0]+args[2],args[1]);group.ellipse(...args);group.closePath();}
      else group[cmd](...args);
    }
  }
  return {draws,groups};
}
function paintFigureLayers(ctx,r,c,layers,crowded) {
  const {draws,groups}=layers;
  const paintRim=(color,width)=>{
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
function fastFigureRim(ctx,r,c,crowded) {
  const path=defaultPath();
  if(!path)return;
  const tape={beginPath(){},fill(){},stroke(){},ellipse(x,y,rx,ry,a,b,e){
    path.moveTo(x+rx,y);path.ellipse(x,y,rx,ry,a,b,e);path.closePath();
  }};
  for(const cmd of ['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath'])tape[cmd]=(...args)=>path[cmd](...args);
  silhouetteArt(tape,r,c.flare);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=crowded?6:5;ctx.strokeStyle=crowded?(r.palette===PALETTES[0]?'#b5fcf5':'#ffd0b7'):'#b3a699';ctx.stroke(path);
  ctx.lineWidth=crowded?3.6:2.7;ctx.strokeStyle='#060914';ctx.stroke(path);
}
function detachedMotion(r){
  const strength=r.reducedMotion?.40:1;
  const beat=Math.sin(r.t*Math.PI)*strength;
  const exaggerated=['dash','sidestep','backstep','slash','sweep','rush','leap','jump','hit'].includes(r.action);
  const worked=exaggerated?beat:0;
  const arm=r.offBlade||r.action==='force'?r.backHand:P(
    r.backHand.x-r.forward*(5+12*worked),r.backHand.y-3+5*Math.sin(r.t*Math.PI*2)*worked);
  const legs=r.legs.map(l=>{
    if(l.planted)return l;
    const arc=(l.side===1?1:-1)*(4*worked+7*(r.airSilhouette??0)*strength);
    return {...l,foot:P(l.foot.x+r.forward*arc,l.foot.y-Math.abs(arc)*.23),
      toes:P(l.toes.x+r.forward*arc,l.toes.y-Math.abs(arc)*.23)};
  });
  return {...r,legs,backHand:arm};
}
export function drawArcadeFighter(ctx,f,time=0,options={}) {
  const physicalRig=options.rig??sampleArcadeFighter(f,time,options);
  const trakataAge=time-val(f.trakataIgnitedAt,-Infinity);
  const saberOff=f.saberOff===true;
  const trakataFlash=!physicalRig.reducedMotion&&!saberOff&&trakataAge>=0&&trakataAge<.115?1-smooth(trakataAge/.115):0;
  const r={...detachedMotion(inkAirSilhouette(physicalRig)),appearance:fighterAppearance(f,physicalRig),saberOff,trakataFlash},c=r.palette;
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
  if(outline&&options.lowDetail)fastFigureRim(ctx,r,c,options.crowded);
  const drawOffhand=()=>bladeArt(ctx,{...r,hand:r.offEmitter,blade:r.offBlade,action:'slash',trail:r.offTrail},r.staff?c:{...c,slash:c.split},!r.staff);
  const bladesVisible=options.hideSabers!==true&&(r.action!=='ko'||r.t<.25);
  if(!layers){
    footArt(ctx,r.legs[0],r.forward,c,r.type,false);
    footArt(ctx,r.legs[1],r.forward,c,r.type,true);
  }
  if(!r.staff&&r.offBlade&&bladesVisible&&r.offActive<=.45)drawOffhand();
  if(layers)paintFigureLayers(ctx,r,c,layers,options.crowded);
  else bodyArt(ctx,r,c,options.lowDetail===true);
  if(bladesVisible){
    if(r.staff){
      line(ctx,[r.offEmitter,r.emitter],INK,11);
      line(ctx,[r.offEmitter,r.emitter],r.saberOff?'#74747a':c.steel,6);
      line(ctx,[r.backHand,r.hand],r.saberOff?'#a39a8d':c.split,3);
    }
    bladeArt(ctx,{...r,hand:r.emitter},c);
  }
  if(r.offBlade&&bladesVisible&&(r.staff||r.offActive>.45))drawOffhand();
  if(bladesVisible){
    // Leave the fingers in front of the hilt, rather than drawing the
    // hilt's bright trim over the whole floating glove.
    if(r.staff||r.offBlade&&(r.offActive>.45||r.saberOff))handArt(ctx,r.backHand,r.backElbow,r.hdx,r.type,false,c);
    handArt(ctx,r.hand,r.frontElbow,r.hdx,r.type,true,c);
  }
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
export function drawArcadeFighterPreview(ctx,f={},options={}){
  const width=options.width??ctx.canvas.width,height=options.height??ctx.canvas.height;
  const time=options.time??0, portrait=options.framing==='portrait';
  const scale=Math.min(width/(portrait?83:160),height/(portrait?83:171));
  const preview={face:portrait?.48:-.04,action:portrait?'idle':'guard',actionTime:.28,actionDuration:.65,...f,
    x:width/(2*scale)-(portrait?2:7),y:height/(2*scale)+(portrait?80:48)};
  ctx.save();ctx.scale(scale,scale);
  const rig=drawArcadeFighter(ctx,preview,time,{reducedMotion:options.reducedMotion??false,hideSabers:portrait});
  ctx.restore();return rig;
}

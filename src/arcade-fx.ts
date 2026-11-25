type Ctx=CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
type Id=string|number;
type Point={x:number;y:number};
type Emitter='main'|'off'|'rear'|'orbit_third';
type Blade={id?:Emitter;hand?:Point;tip?:Point};
type BladeWorld={phase?:string;hand?:Point;tip?:Point;blade?:Point;offhand?:Blade;body?:Point;blades?:Blade[]};
type Fighter={id?:Id;alive?:boolean;hp?:number;gear?:{weapon?:string;grip?:string};saberPhase?:string;
 attackSpec?:{contact?:number;offhand?:{contact?:number};orbitThird?:{contact?:number};leadBlade?:Emitter};technique?:string;attack?:string;
 actionTime?:number;chainFrom?:string;chainDepth?:number;attackSerial?:number;staffLead?:string;weaponFlow?:boolean;
 form?:string;team?:number;airPhase?:string;airHeight?:number;x?:number;y?:number;vx?:number;vy?:number;face?:number;
 jumpKind?:string;jumpBearing?:number};
type FXEvent={id:number;kind:string;x?:number;y?:number;fighterId?:Id;targetId?:Id;aId?:Id;bId?:Id;
 effect?:string;region?:string;fatal?:boolean;injuryOutcome?:string;injuryTier?:string|number;pressureGraze?:boolean;
 contactX?:number;contactY?:number;contactSpace?:string;phase?:string;guardLane?:string;contact?:number;
 z?:number;groundY?:number;sx?:number;sy?:number;face?:number;angle?:number;feintBearing?:number;team?:number|string;blades?:Blade[]};
type InkPoint={hx:number;hy:number;tx:number;ty:number;at:number;cx:number|null;cy:number|null;release:number;
 link:number;staff:boolean;staffLead:Emitter|null;flowSpeed:number;airStyle:number};
type Form=readonly [string,string,number,number,number];
type Kit=readonly [number,number,number];
type History={points:InkPoint[];seen:number;gesture:InkPoint|null;held:boolean;form:Form;team:0|1};
type Actor={key:string;kit:Kit;serial?:number;action:string;seen:number;lastTime:number;multi?:boolean;emitters:Map<Emitter,History>};
type AirStyle=readonly [number,number,number,number];
type AirMark={kind:string;x:number;y:number;face:number;style:AirStyle;at:number};
type FXSlot={kind:keyof typeof FX|null;id:number;at:number;expandedEffect?:string|null;region:string;fatal:boolean;
 severe:boolean;graze:boolean;targetId?:Id;contactX:number|null;contactY:number|null;precise:boolean;
 ignition:ReturnType<typeof ignitionBlades>|null;phase?:string|null;lane?:string|null;delay:number;duration:number;
 x:number;y:number;z:number;groundY:number;angle:number;team:0|1};
/** Screen-space render accents from the arcade model's authoritative events.
 * Keep timing independent of simulation/hit stop. One effect per engine ID.
 * x/y are the event anchor; optional groundY overrides the dust plane and z
 * offsets air marks up from y. face and optional angle are radians, increasing toward screen-down.
 */
const LIMIT = 28, TAU = Math.PI * 2;
const AIR_CAP=8, AIR_AGE=.23;
const AIR_PHASES=new Set(['grounded','takeoff','airborne','landing']);
// [floor footprint length, vertical squash, line pattern, airborne edge gain].
const AIR_STYLE:Readonly<Record<string,AirStyle>>=Object.freeze({
  shii_cho:[20,4,0,.42], makashi:[29,2,1,.28], soresu:[13,2.5,2,.18],
  ataru:[20,7,3,.60], djem_so:[15,6,4,.50], niman:[22,3,5,.36], juyo:[25,5,6,.55]
});
const airStyle=(form:string|undefined)=>form&&Object.hasOwn(AIR_STYLE,form)?AIR_STYLE[form]:AIR_STYLE.shii_cho;
const TEAM = ['#ffca77', '#ff6a50'];
const EDGE = ['#d1ab78', '#c57961'];
const LINK_EDGE = ['#efca94', '#e9a080'];
const INK = '#171513';
const CHALK = '#e8ddd0';
// [ink width, highlight width, offset underprint]. Authored per kit;
// the blade world projection and game contact are still authoritative.
const KIT:Readonly<Record<string,Kit>>=Object.freeze({
  'single/forward':[1,1,1], 'single/backhand':[.92,1.13,1.55],
  'dual/forward':[.88,.99,.68], 'dual/backhand':[.78,1.10,1.13],
  'staff/forward':[1.04,.95,1.33],
});
const WHITE = '#fbf9ef';
// [team A saturated, team B saturated, inner start, fill gain, edge count]
// Geometry follows the real blade. Styles only control its ink weight and
// where on the blade to start; they never change the sweep path.
const FORM:Readonly<Record<string,Form>> = Object.freeze({
  shii_cho: ['#8e5b3c','#a64030',.41,.82,1],
  makashi: ['#9e795c','#a94b36',.8,.52,1],
  soresu: ['#885d4a','#954637',.62,.68,1],
  ataru: ['#94693e','#b64c2d',.48,1,2],
  djem_so: ['#693f2f','#983a2b',.32,1,1],
  niman: ['#946947','#a25340',.56,.69,2],
  juyo: ['#ad6742','#a54030',.38,.94,2],
});
const GROUND = new Set(['dash','launch','ko','break','push']);
const FORCE_GLYPHS = new Set(['arcWave','anchor','veil','echoStep','lattice','siphon']);
const CUES = new Set(['feint','read','riposte']);
const REGIONAL = new Set(['hit','launch','ko']);
const REGIONS = ['head','torso','body','left_arm','right_arm','left_leg','right_leg','arm','leg'];
const regionOf = (value:unknown) => {
  const key = typeof value==='string' ? value.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/[- ]/g,'_') : '';
  return REGIONS.includes(key) ? key : '';
};
const FX = Object.freeze({
  expanded_release:[.30,1,0],
  hit: [.27, 2, 4], clash: [.26, 3, 3], parry: [.42, 3, 6], ko: [.66, 4, 8],
  dash: [.27, 1, 0], block: [.23, 2, 2], break: [.49, 3, 7],
  launch: [.47, 3, 5], feint:[.18,1,0], read:[.23,1,0], riposte:[.21,1,0], saber_phase: [.22, 1, 0], force: [.44, 1, 0, .17], push: [.46, 3, 4],
});
const TRAIL_AGE = .126, TRAIL_SAMPLE = .012, TRAIL_CAP = 9;
const EMITTER_BIT = Object.freeze({main:1,off:2,rear:4,orbit_third:8});
const clamp = (value:number, min:number, max:number) => Math.min(max, Math.max(min, value));
const isFiniteNumber=(v:unknown):v is number=>Number.isFinite(v);
const finite = (value:unknown, fallback = 0):number => isFiniteNumber(value) ? value : fallback;
const random = (id:number, i:number) => ((Math.imul(id, 8191) + Math.imul(i, 613)) >>> 0) % 97 / 96;

function ellipse(ctx:Ctx, rx:number, ry:number, from = 0, to = TAU) {
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, from, to);
}
function outlinedStroke(ctx:Ctx, line:number, hue:string) {
  ctx.strokeStyle = INK; ctx.lineWidth = line + 5; ctx.stroke();
  ctx.strokeStyle = hue; ctx.lineWidth = line; ctx.stroke();
}
function star(ctx:Ctx, outer:number, inner:number, rays:number, phase = 0, stretch = 1) {
  ctx.beginPath();
  for (let i = 0; i < 2 * rays; i++) {
    const a = phase + i * Math.PI / rays, r = i % 2 ? inner : outer;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * stretch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// A hard push off the floor snaps into a short horizontal ink wake. Each
// piece squashes low as it peels backward; no elevated ghost or strike cue.
// Compact glyphs mark a verified ability release, not an invented hit.
function drawExpandedRelease(ctx:Ctx, e:FXSlot, p:number, still:boolean){
  const effect=e.expandedEffect;
  if(effect==null||!FORCE_GLYPHS.has(effect))return;
  const q=still?.40:1-(1-p)**2;
  const r=10+q*16;
  ctx.globalAlpha=still?.65:(1-p)*.79;
  ctx.beginPath();
  if(effect==='arcWave'){
    ctx.ellipse(0,3,r*1.32,r*.62,0,0,TAU);
  }else if(effect==='anchor'){
    ctx.moveTo(-r,-r*.32);ctx.lineTo(-r*.54,r*.45);ctx.lineTo(r*.54,r*.45);ctx.lineTo(r,-r*.32);
    ctx.moveTo(-r*.55,r*.70);ctx.lineTo(r*.55,r*.70);
  }else if(effect==='veil'){
    ctx.moveTo(-r,-r*.40);ctx.bezierCurveTo(-r*.25,-r,-r*.25,r,r*.85,r*.20);
    ctx.moveTo(-r*.76,r*.30);ctx.bezierCurveTo(-r*.05,-r*.30,r*.3,r*.85,r,r*.45);
  }else if(effect==='echoStep'){
    ctx.moveTo(-1.4*r,-6);ctx.lineTo(-r*.10,-6);ctx.lineTo(r*.25,0);ctx.lineTo(-r*.70,0);
    ctx.moveTo(-1.1*r,7);ctx.lineTo(-r*.48,7);
  }else if(effect==='lattice'){
    ctx.moveTo(0,-r);ctx.lineTo(r*.72,-r*.35);ctx.lineTo(r*.62,r*.4);
    ctx.lineTo(0,r*.78);ctx.lineTo(-r*.62,r*.4);ctx.lineTo(-r*.72,-r*.35);ctx.closePath();
  }else{
    ctx.moveTo(r,-r*.55);ctx.lineTo(0,0);ctx.lineTo(r,r*.55);
    ctx.moveTo(r*.37,-r*.4);ctx.lineTo(-r*.28,0);ctx.lineTo(r*.37,r*.4);
  }
  outlinedStroke(ctx,1.6,effect==='lattice'||effect==='anchor'?CHALK:'#d9bb92');
}

function drawDashWake(ctx:Ctx, e:FXSlot, p:number){
  const travel=1-(1-p)**2, snap=Math.max(0,1-p*2.3), fade=(1-p)**1.5;
  ctx.globalAlpha=.49*fade;
  ctx.beginPath();
  const tail=11+travel*23, front=3+8*travel;
  ctx.moveTo(-tail,-3);ctx.lineTo(-front-4,-3-snap*4);ctx.lineTo(-front,0);
  ctx.moveTo(-tail*.83,4);ctx.lineTo(-front-6,3+snap*3);
  ctx.strokeStyle=INK;ctx.lineWidth=1.8;ctx.stroke();
  for(let i=0;i<2;i++){
    const v=random(e.id,i);
    const x=-(5+i*11)-travel*(13+i*10), y=(i?1:-1)*(4+2*v);
    ctx.globalAlpha=.29*fade;
    ctx.fillStyle=i?'#958778':'#c4b3a0';
    ctx.beginPath();ctx.ellipse(x,y,5+snap*4+travel*4,2+snap*1.65,0,0,TAU);ctx.fill();
  }
}

function drawAirFootprint(ctx:Ctx, mark:AirMark, p:number) {
  const [length,rise,pattern]=mark.style;
  const fall=mark.kind==='land', travel=1-(1-p)**2, fade=(1-p)**1.32;
  const w=length+travel*(fall?10:15), h=rise*(1.15-.57*travel);
  ctx.save();
  try{
    ctx.translate(mark.x,mark.y+2);ctx.rotate(mark.face);
    ctx.globalAlpha=.42*fade;
    ctx.beginPath();
    switch(pattern){
      case 0: // Shii-Cho: broad low commas side by side
        ctx.moveTo(-w,-h);ctx.quadraticCurveTo(-w*.36,-h*1.45,3,-2);
        ctx.moveTo(-w*.66,h);ctx.quadraticCurveTo(-w*.31,h*1.5,5,h*.18);break;
      case 1: // Makashi: spare thin extension
        ctx.moveTo(-w,-h);ctx.lineTo(4,-h*.4);ctx.moveTo(-w*.57,h);ctx.lineTo(-4,h);break;
      case 2: // Soresu: small sheltered two-heel brace
        ctx.moveTo(-w*.7,-h);ctx.lineTo(-w*.27,-h);ctx.lineTo(0,0);
        ctx.moveTo(-w*.69,h);ctx.lineTo(-w*.22,h);ctx.lineTo(3,0);break;
      case 3: // Ataru: a crossed hop peels up from the same spot
        ctx.moveTo(-w,-h*.30);ctx.quadraticCurveTo(-w*.63,-h*.4,-2,-h);
        ctx.moveTo(-w*.68,h);ctx.quadraticCurveTo(-w*.3,h*.62,4,-h*.4);break;
      case 4: // Djem So: two hard angular compression ticks
        ctx.moveTo(-w,-h);ctx.lineTo(-w*.7,0);ctx.lineTo(-w,0);
        ctx.moveTo(-w*.46,h);ctx.lineTo(-w*.19,h*.15);ctx.lineTo(-w*.39,0);break;
      case 5: // Niman: balanced paired curl
        ctx.moveTo(-w,-h);ctx.quadraticCurveTo(-w*.31,-h*1.1,-2,-h*.2);
        ctx.moveTo(-w*.88,h);ctx.quadraticCurveTo(-w*.25,h*1.08,-2,h*.2);break;
      default: // Juyo: staggered broken skid
        ctx.moveTo(-w,-h);ctx.lineTo(-w*.8,-h*.42);ctx.lineTo(-w*.51,-h*.58);
        ctx.lineTo(-w*.18,0);ctx.moveTo(-w*.67,h);ctx.lineTo(-w*.37,h*.44);ctx.lineTo(4,h*.38);
    }
    ctx.strokeStyle=INK;ctx.lineWidth=fall?2.25:1.55;ctx.stroke();
    ctx.globalAlpha=.22*fade;ctx.fillStyle=fall?'#d0bba4':'#a29585';
    ctx.beginPath();ctx.ellipse(-w*.53,h*1.05,w*.3,Math.max(1.3,h*.41),0,0,TAU);ctx.fill();
  }finally{ctx.restore();}
}

// Off-register, angular silhouette at a verified impact point only.
function inkFlash(ctx:Ctx, r:number, width:number, x=0, y=0){
  ctx.beginPath();ctx.moveTo(x-r,y-r*.15);ctx.lineTo(x-r*.32,y-r*.35);
  ctx.lineTo(x-r*.12,y-r*.85);ctx.lineTo(x+r*.20,y-r*.37);ctx.lineTo(x+r,y-r*.28);
  ctx.lineTo(x+r*.58,y+r*.12);ctx.lineTo(x+r*.75,y+r*.64);ctx.lineTo(x+r*.14,y+r*.42);
  ctx.lineTo(x-r*.27,y+r*.80);ctx.lineTo(x-r*.42,y+r*.39);ctx.closePath();
  ctx.fillStyle='#f5e5cc';ctx.fill();
  ctx.strokeStyle=INK;ctx.lineWidth=width;ctx.stroke();
}

function drawCast(ctx:Ctx, color:string, p:number, still:boolean) {
  // The deliberately projected Niman wave, separate from saber motion and the
  // real follow-up impact. It appears only after the cast releases.
  const t = still ? .34 : p, fade = still ? .44 : .72 * (1 - p) ** 1.15;
  ctx.translate(15 + 43*t, 0);
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = fade * (1 - i * .23);
    ellipse(ctx, 20 + 16*t + i*9, 22 + 18*t + i*10, -1.04, 1.04);
    outlinedStroke(ctx, i ? 1.8 : 3.7, color);
  }
}

// A blade clash is already located on the world-space animated steel, not on
// a fighter's footplane. Keep its graphic small so the paused blades remain visible.
function drawClash(ctx:Ctx, p:number, still:boolean) {
  if (still) {
    ctx.globalAlpha=.75;
    star(ctx,9,5,4,Math.PI/4);
    outlinedStroke(ctx,1.8,CHALK);
    return;
  }
  const recoil=1-(1-p)**2, fade=(1-p)**1.5;
  const opening=Math.max(0,1-p*2.45);
  if(opening>0){
    ctx.globalAlpha=.90*opening;
    inkFlash(ctx,10+5*opening,1.7);
    ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(-6,0);
    ctx.moveTo(6,0);ctx.lineTo(14,0);
    ctx.strokeStyle=CHALK;ctx.lineWidth=1.65;ctx.stroke();
  }
  for (const side of [-1,1]) {
    ctx.globalAlpha=.91*fade;
    const heel=side*(3+recoil*7), end=side*(12+recoil*13);
    ctx.beginPath();
    const kink=side*(7+recoil*11);
    ctx.moveTo(heel,-2);ctx.lineTo(kink,-6-recoil*4);ctx.lineTo(end,-5-recoil*8);
    ctx.moveTo(heel,2);ctx.lineTo(end-side*(3+recoil*2),4+recoil*7);
    outlinedStroke(ctx,1.65,TEAM[side<0?0:1]);
  }
}

// Non-gory marks: narrow brackets on a clean touch, a stronger framed
// diamond for a disabling or decisive hit. Text is owned by the HUD.
// A confirmed graze gets a short off-angle scuff, not a full hit flash.
function drawGraze(ctx:Ctx, p:number, still:boolean){
  const travel=still?3:14*(1-(1-p)**2), fade=still?.75:(1-p)**1.38;
  ctx.globalAlpha=fade;
  ctx.beginPath();
  ctx.moveTo(-8+travel,-1);ctx.quadraticCurveTo(travel,-5,11+travel,-3);
  if(!still){ctx.moveTo(2+travel,3);ctx.lineTo(9+travel,1);}
  outlinedStroke(ctx,still?1.6:1.45,CHALK);
}
function drawRegional(ctx:Ctx, e:FXSlot, p:number, still:boolean) {
  const { region, fatal, severe } = e;
  const hue=fatal?'#ecd4ff':region==='head'?'#ffedba':
    region.endsWith('arm')?'#b6eaff':region.endsWith('leg')?'#b6f5dd':'#ffd29d';
  const expand=still?.25:1-(1-p)**2, r=(fatal?11:severe?9:6)+expand*(fatal?6:4);
  ctx.globalAlpha=still?.84:(1-p)**.88;
  if(fatal||severe){
    star(ctx,r,r*(fatal?.70:.52),4,Math.PI/4);
    outlinedStroke(ctx,fatal?2.1:1.55,hue);
  }else{
    ctx.beginPath();
    ctx.moveTo(-r,-r*.64);ctx.lineTo(-r,0);ctx.lineTo(-r,r*.64);
    ctx.moveTo(r,-r*.64);ctx.lineTo(r,0);ctx.lineTo(r,r*.64);
    outlinedStroke(ctx,1.35,hue);
  }
  if(!still&&p>.012&&p<.16){
    ctx.globalAlpha=(1-p/.16)*(fatal?.82:.62);
    // Leave the center clean afterward so the confirmed mark remains legible.
    inkFlash(ctx,fatal?15:10,1.3,1.5,-1);
  }
  if(!still&&p<.73){
    // Actual contact only: tight fork lines peel away from the registered
    // point. Nothing is drawn here merely because a saber was swung.
    const wake=1-(1-p/.73)**2, intensity=(1-p/.73)**1.25;
    const d=r*.67+4+wake*(fatal?12:8), tail=4+3*intensity;
    ctx.beginPath();
    for(const side of [-1,1]){
      // The two opposing strokes frame the point without ringing the
      // whole fighter. Reserve the full fork for the deciding contact.
      ctx.moveTo(side*(d-tail),-side*d*.33);ctx.lineTo(side*d,-side*d*.43);
      if(fatal){ctx.moveTo(side*(d-tail),side*d*.30);ctx.lineTo(side*d,side*d*.42);}
    }
    ctx.globalAlpha=.83*intensity;ctx.strokeStyle=hue;
    ctx.lineWidth=fatal?2.1:1.55;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-d*.31,0);ctx.lineTo(d*.31,0);
    ctx.globalAlpha=.88*intensity;ctx.strokeStyle=WHITE;ctx.lineWidth=1.35;ctx.stroke();
  }
  if(fatal){
    ctx.globalAlpha=still?.78:.86*(1-p)**.88;
    ctx.beginPath();
    ctx.moveTo(-r*.41,-r*.41);ctx.lineTo(r*.41,r*.41);
    ctx.moveTo(-r*.41,r*.41);ctx.lineTo(r*.41,-r*.41);
    outlinedStroke(ctx,1.6,'#fff6e5');
  }
}

// Rewards and tells sit beside the action. They deliberately omit the
// pale impact flash and never cue hit-stop or imply a second contact.
function drawDuelCue(ctx:Ctx, e:FXSlot, p:number, still:boolean){
  const kind=e.kind, phase=still?.35:p;
  const fade=still?.70:(1-p)**1.24;
  ctx.globalAlpha=fade;
  ctx.beginPath();
  if(kind==='feint'){
    // One hook unrolls back toward the wielder instead of flying at a target.
    const tip=21+phase*8;
    ctx.moveTo(tip-9,-2);ctx.quadraticCurveTo(tip+1,-10,tip+10,-3);
    ctx.lineTo(tip+5,2);ctx.moveTo(tip+10,-3);ctx.lineTo(tip+5,-6);
    ctx.strokeStyle=INK;ctx.lineWidth=3.4;ctx.stroke();
    ctx.strokeStyle=CHALK;ctx.lineWidth=1.25;ctx.stroke();
  }else if(kind==='read'){
    // Open guard bracket; leave the actual blades and the parry marker clear.
    const offset=14+phase*5, lane=e.lane==='left'?-1:e.lane==='right'?1:0;
    const side=lane===1?1:-1, margin=offset*side;
    ctx.moveTo(-9,margin-5*side);ctx.lineTo(-9,margin);ctx.lineTo(8,margin);
    if(lane===0){ctx.moveTo(3,margin-3*side);ctx.lineTo(3,margin+3*side);}
    else{ctx.moveTo(12,margin+3*side);ctx.lineTo(17,margin-2*side);}
    outlinedStroke(ctx,1.4,'#ead3a5');
  }else{
    // Two rising inked strokes outside the author's confirmed riposte hit.
    const slide=phase*8;
    ctx.moveTo(4+slide,-11);ctx.lineTo(19+slide,-19);
    ctx.moveTo(11+slide,-8);ctx.lineTo(21+slide,-13);
    outlinedStroke(ctx,1.55,'#ffba77');
  }
}

function ignitionBlades(event:FXEvent) {
  const result=[];
  for(const blade of Array.isArray(event.blades)?event.blades:[]){
    if(result.length>=2)break;
    const {hand,tip}=blade??{};
    if(hand&&tip&&[hand.x,hand.y,tip.x,tip.y].every(Number.isFinite)){
      result.push({hx:hand.x,hy:hand.y,tx:tip.x,ty:tip.y});
    }
  }
  return result;
}
function drawIgnition(ctx:Ctx, e:FXSlot, p:number, still:boolean, color:string){
  const ignition=e.ignition??[];
  ctx.save();
  try{
    const fade=still?.66:(1-p)**1.4;
    ctx.globalAlpha=fade;
    for(const blade of ignition){
      const {hx,hy,tx,ty}=blade,dx=tx-hx,dy=ty-hy;
      if(still){
        ctx.save();ctx.translate(hx,hy);star(ctx,7,3.5,4,Math.PI/4);
        outlinedStroke(ctx,1.4,color);ctx.restore();continue;
      }
      // This follows the emitter direction without implying an extra hit.
      const at=e.phase==='long'?.20+.80*p:.98-.78*p;
      const tail=at+(e.phase==='long'?-.11:.11);
      ctx.beginPath();ctx.moveTo(hx+dx*tail,hy+dy*tail);ctx.lineTo(hx+dx*at,hy+dy*at);
      outlinedStroke(ctx,2.5,color);
    }
    if(!ignition.length){
      ctx.translate(e.contactX??e.x,e.contactY??e.y-40);
      star(ctx,still?6:6+p*5,3,4,Math.PI/4);
      outlinedStroke(ctx,1.55,color);
    }
  }finally{ctx.restore();}
}

function drawContact(ctx:Ctx, e:FXSlot, p:number, still:boolean, color:string, impactY:number, labels:boolean) {
  const kind = e.kind, large = kind === 'ko' || kind === 'break' || kind === 'launch' || kind === 'push';
  const expansion = still ? .32 : 1 - (1 - p) ** 2.4;
  const reach = kind === 'ko' ? 88 : kind === 'break' ? 74 : kind === 'push' ? 78 : kind === 'launch' ? 67 : kind === 'parry' ? 62 : kind === 'block' ? 41 : 50;
  const fade = still ? .64 : (1 - p) ** 1.12;
  const hue = kind === 'parry' ? '#ffde85' : kind === 'block' ? '#afd5fc' : kind === 'break' ? '#ffac61' : color;
  if (large || kind === 'parry' || kind === 'block') {
    ctx.globalAlpha = fade * .9;
    const r = 12 + expansion * reach;
    ellipse(ctx, r, r * (kind === 'launch' ? 1.25 : kind === 'block' ? 1.04 : .7), (kind === 'block' || kind === 'push') ? -.95 : 0, (kind === 'block' || kind === 'push') ? .95 : TAU);
    outlinedStroke(ctx, large ? 3.8 : 3, hue);
    if (kind === 'parry' || large) {
      ctx.globalAlpha *= .67;
      ellipse(ctx, r * .79, r * .56, .16, 2.3); outlinedStroke(ctx, 2.1, WHITE);
    }
  }
  if (kind !== 'block' && kind !== 'push' && (p < .65 || still)) {
    const r = (kind === 'hit' ? 21 : 25) * (1 + expansion * .48);
    ctx.globalAlpha = fade * .91;
    star(ctx, r, r * .33, kind === 'parry' ? 4 : 6, kind === 'parry' ? 0 : -.27, large ? 1 : .86);
    ctx.fillStyle = WHITE; ctx.fill(); outlinedStroke(ctx, 2, hue);
  }
  if (!still && kind !== 'block') {
    ctx.globalAlpha = fade * .86; ctx.strokeStyle = hue; ctx.lineWidth = 2.5;
    ctx.beginPath();
    const total = large ? 10 : 6;
    for (let i = 0; i < total; i++) {
      const v = random(e.id, i), a = (large ? (i / total) * TAU : (i / (total - 1) - .5) * 2.3) + v * .5 - .25;
      const dx = Math.cos(a), dy = Math.sin(a);
      const far = 15 + reach * expansion * (.6 + v * .47), close = far - (7 + 13 * (1 - p));
      ctx.moveTo(dx * close, dy * close); ctx.lineTo(dx * far, dy * far);
    }
    ctx.stroke();
  }
  if (labels && (kind === 'parry' || kind === 'ko' || kind === 'break')) {
    // Graphic confirmation, upright even when facing left or moving diagonally.
    ctx.restore(); ctx.save(); ctx.translate(e.x, impactY);
    const label = kind === 'ko' ? 'KO' : kind === 'parry' ? 'PARRY' : 'BREAK';
    ctx.globalAlpha = fade; ctx.lineWidth = 5.5; ctx.lineJoin = 'round';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = (kind === 'ko' ? '900 29px' : '900 20px') + ' system-ui, sans-serif';
    ctx.strokeStyle = INK; ctx.fillStyle = hue;
    const y = -49 - expansion * 19;
    ctx.strokeText(label, 0, y); ctx.fillText(label, 0, y);
  }
}

// Multi-blade effects only trace the outer edge. Tangents follow each blade's
// actual grip angle, while large unobserved changes are dropped rather than
// guessing a cross-body chord. Single blade keeps the existing full brush.
function drawEmitterArc(ctx:Ctx, a:InkPoint, b:InkPoint, fade:number, form:Form, team:0|1, id:Emitter, kit:Kit){
  const ax=a.tx-a.hx,ay=a.ty-a.hy,bx=b.tx-b.hx,by=b.ty-b.hy;
  const ra=Math.hypot(ax,ay),rb=Math.hypot(bx,by);
  if(Math.min(ra,rb)<8||Math.abs(rb-ra)>Math.max(13,ra*.31)||b.at-a.at>.054)return;
  const delta=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
  if(Math.abs(delta)>1.17)return;
  const shiftX=(b.hx-a.hx)/3,shiftY=(b.hy-a.hy)/3;
  const k=4/3*Math.tan(delta/4);
  const x1=a.tx+shiftX-ay*k,y1=a.ty+shiftY+ax*k;
  const x2=b.tx-shiftX+by*k,y2=b.ty-shiftY-bx*k;
  if(a.cx!=null&&b.cx!=null&&a.cy!=null&&b.cy!=null){
    for(const t of [0,.25,.5,.75,1]){
      const n=1-t, n2=n*n,t2=t*t;
      const x=n*n2*a.tx+3*n2*t*x1+3*n*t2*x2+t2*t*b.tx;
      const y=n*n2*a.ty+3*n2*t*y1+3*n*t2*y2+t2*t*b.ty;
      if(Math.hypot(x-a.cx-(b.cx-a.cx)*t,y-a.cy-(b.cy-a.cy)*t)<13)return;
    }
  }
  // Staff is one rigid hilt. Either end can lead; the opposite end still
  // has momentum but its soft edge must not read as another contact.
  const staff=id==='rear'||b.staff;
  const activeEnd=staff&&b.staffLead===id;
  const gain=staff?(activeEnd?1.07:.68):id==='main'?1:.75;
  const bright=b.release??0, lift=b.airStyle*bright, linked=(b.link??0)*bright, speed=b.flowSpeed??0;
  // A small offset ink underprint follows the proven outside curve, never
  // projects a second blade, and uses the prior broad stroke's budget.
  const offset=kit[2]*fade*bright*(id==='rear'?-1:1);
  ctx.beginPath();ctx.moveTo(a.tx,a.ty+offset);ctx.bezierCurveTo(x1,y1+offset,x2,y2+offset,b.tx,b.ty+offset);
  ctx.globalAlpha=(.50+.11*bright-.14*speed)*fade*gain;ctx.strokeStyle=bright>.55||speed>.45?INK:form[team];
  ctx.lineWidth=(1.8+(4.3+1.2*bright+.72*lift-1.35*speed)*fade)*kit[0];
  ctx.stroke();
  // Repath only while a bright off-register edge is visible; one extra path,
  // still the same number of paint operations, and never a filled fan.
  if(offset>.15||offset<-.15){
    ctx.beginPath();ctx.moveTo(a.tx,a.ty);ctx.bezierCurveTo(x1,y1,x2,y2,b.tx,b.ty);
  }
  ctx.globalAlpha=(.69+.16*bright+.11*linked+.11*speed)*fade*gain;ctx.strokeStyle=bright>.81&&(!staff||activeEnd)?CHALK:linked>.20||speed>.45?LINK_EDGE[team]:EDGE[team];ctx.lineWidth=(.92+(1.08+bright*.38+lift*.42+linked*.56+(activeEnd?.72*bright:0))*fade)*kit[1];
  ctx.stroke();
}

export function createArcadeFX({contactLabels=true}={}) {
  const effects:FXSlot[] = Array.from({ length: LIMIT }, () => ({ kind:null } as FXSlot));
  let clock = 0, newest = 0, active = 0, reduced = false;
  let punch:{at:number;power:number;angle:number;id:number}|null=null;
  const blades = new Map<Id,Actor>(), airByFighter=new Map<Id,{phase:string;seen:number}>(), airMarks:AirMark[]=[];
  function reset() {
    for (const e of effects) e.kind = null;
    clock = 0; newest = 0; active = 0; punch = null; blades.clear(); airByFighter.clear();airMarks.length=0;
  }
  function observe(events:readonly FXEvent[]=[]) {
    for (const event of events ?? []) {
      const id = event?.id;
      if (!Number.isSafeInteger(id) || id <= newest) continue;
      newest = id;
      const kind = event.kind as keyof typeof FX;
      if((kind==='saber_phase'||kind==='feint')&&event.fighterId!=null)blades.delete(event.fighterId);
      if(kind==='clash') {
        // On verified contact the game binds both blades. Do not leave a
        // multi-weapon smear over a held bind pose or its recoil.
        for (const fighter of [event.aId??event.fighterId,event.bId??event.targetId]) {
          if(fighter!=null&&blades.get(fighter)?.multi)blades.delete(fighter);
        }
      }
      if(kind==='expanded_release'&&(event.effect==null||!FORCE_GLYPHS.has(event.effect)))continue;
      if (!Object.hasOwn(FX, kind) || !isFiniteNumber(event.x) || !isFiniteNumber(event.y)) continue;
      const region = REGIONAL.has(kind) ? regionOf(event.region) : '';
      const fatal = Boolean(region && (kind==='ko'||event.fatal===true||event.injuryOutcome==='fatal'));
      const severe = Boolean(region && (typeof event.injuryTier==='number'?event.injuryTier>=2:
        ['serious','heavy','severe','disabled','critical'].includes(event.injuryTier??'') ||
        ['disabled','critical'].includes(event.injuryOutcome??'')));
      if (region && event.targetId!=null) {
        // One decisive mark when the engine publishes a contact and its KO
        // together. Do not let a later light event overwrite the decisive one.
        const prior = effects.find(e=>e.kind&&e.region&&e.targetId===event.targetId&&clock-e.at<.037);
        if(prior?.fatal)continue;
        if(prior&&fatal){prior.kind=null;active--;}
      }
      const graze=kind==='hit'&&!fatal&&!severe&&(event.pressureGraze===true||event.injuryOutcome==='glance');
      if(kind==='hit'&&region&&event.targetId!=null&&!fatal){
        // A grazing scuff and a clean spark at the same spot in the same
        // beat read as two contradictory cue strengths. Keep the clean one,
        // but preserve contacts on other targets/regions or on later beats.
        const x=event.contactX??event.x, y=event.contactY??event.y;
        const overlap=(e:FXSlot)=>e.kind==='hit'&&e.targetId===event.targetId&&e.region===region&&
          clock-e.at<.026&&Math.hypot(x-(e.contactX??e.x),y-(e.contactY??e.y))<18;
        if(graze&&effects.some(e=>!e.graze&&overlap(e)))continue;
        if(!graze)for(const e of effects)if(e.graze&&overlap(e)){e.kind=null;active--;}
      }
      const priority = fatal ? 4 : FX[kind][1];
      let slot = null;
      for (const e of effects) {
        if (!e.kind) { slot = e; break; }
        const candidatePriority=e.fatal?4:FX[e.kind][1], slotPriority=slot?(slot.fatal?4:FX[slot.kind!][1]):Infinity;
        if (candidatePriority > priority) continue;
        if (!slot || candidatePriority < slotPriority || (candidatePriority === slotPriority && e.id < slot.id)) slot = e;
      }
      if (!slot) continue;
      if (!slot.kind) active++;
      slot.kind = kind; slot.id = id; slot.at = clock;
      slot.expandedEffect=kind==='expanded_release'?event.effect:null;
      slot.region=region;slot.fatal=fatal;slot.severe=severe;slot.targetId=event.targetId;
      slot.graze=graze;
      slot.contactX=isFiniteNumber(event.contactX)?event.contactX:null;
      slot.contactY=isFiniteNumber(event.contactY)?event.contactY:null;
      slot.precise=event.contactSpace==='world';
      slot.ignition=kind==='saber_phase'?ignitionBlades(event):null;
      slot.phase=kind==='saber_phase'?event.phase:null;
      slot.lane=kind==='read'?event.guardLane:null;
      slot.delay = kind === 'force' && isFiniteNumber(event.contact) ? clamp(event.contact, 0, .76) : FX[kind][3] || 0;
      slot.duration = kind === 'force' ? slot.delay + .27 : FX[kind][0];
      slot.x = event.x; slot.y = event.y; slot.z = clamp(finite(event.z), 0, 180);
      slot.groundY = finite(event.groundY, event.y);
      const dx = event.x - finite(event.sx, event.x), dy = event.y - finite(event.sy, event.y);
      let angle = kind==='feint'&&isFiniteNumber(event.feintBearing)?event.feintBearing:event.angle;
      if (!isFiniteNumber(angle) && slot.graze && Math.hypot(dx,dy)>3) angle=Math.atan2(dy,dx);
      if (!isFiniteNumber(angle) && isFiniteNumber(event.face)) angle = event.face;
      if (!isFiniteNumber(angle) && Math.hypot(dx, dy) > 3) angle = Math.atan2(dy, dx);
      if (!isFiniteNumber(angle)) angle = 0;
      slot.angle = angle;
      slot.team = event.team === 1 || event.team === 'enemy' ? 1 : 0;
      if (FX[slot.kind][2] && (!punch || clock - punch.at > .12 || punch.power <= FX[slot.kind][2])) {
        punch = { at: clock, power: FX[slot.kind][2], angle, id };
      }
    }
  }
  function update(dt:number, reducedMotion = false) {
    reduced = !!reducedMotion;
    clock += clamp(finite(dt), 0, .33);
    if (reduced){blades.clear();airByFighter.clear();airMarks.length=0;}
    while(airMarks.length&&clock-airMarks[0].at>=AIR_AGE)airMarks.shift();
    for(const [id,air] of airByFighter)if(clock-air.seen>1.8)airByFighter.delete(id);
    for (const e of effects) if (e.kind && clock - e.at >= e.duration) { e.kind = null; active--; }
    for (const [id, actor] of blades) {
      for (const [key, history] of actor.emitters) {
        const { points } = history;
        while (points.length && clock - points[0].at > TRAIL_AGE) points.shift();
        if (!points.length && clock - history.seen > TRAIL_AGE) actor.emitters.delete(key);
      }
      if (!actor.emitters.size && clock - actor.seen > TRAIL_AGE) blades.delete(id);
    }
  }
  function sampleAerial(f:Fighter){
    const phase=f.airPhase,id=f.id;
    if(id==null||phase==null||!AIR_PHASES.has(phase)||
       !isFiniteNumber(f.x)||!isFiniteNumber(f.y))return;
    let air=airByFighter.get(id);
    if(!air){
      if(airByFighter.size>=LIMIT)return;
      air={phase,seen:clock};
      airByFighter.set(id,air);return;
    }
    air.seen=clock;
    if(air.phase===phase)return;
    const old=air.phase;air.phase=phase;
    // Takeoff dust marks the actual foot push, touchdown marks the return to
    // the stage. None of these cues are simulated strikes or contact events.
    const kind=old==='takeoff'&&phase==='airborne'?'lift':old==='airborne'&&(phase==='landing'||phase==='grounded')?'land':null;
    if(!kind)return;
    const style=airStyle(f.form);
    const face=Math.hypot(finite(f.vx),finite(f.vy))>30?Math.atan2(finite(f.vy),finite(f.vx)):finite(f.face);
    if(airMarks.length>=AIR_CAP)airMarks.shift();
    airMarks.push({kind,x:f.x,y:f.y,face,style,at:clock});
  }
  /** World-space blade emitters keyed by physical identity, not array index.
   * Old one-blade pose wrappers are still valid until a new world rig loads. */
  function sampleBlade(f:Fighter, blade?:BladeWorld) {
    if (reduced || f?.id == null) return;
    if (f.alive === false || (!('alive' in f) && f.hp! <= 0)) { blades.delete(f.id);airByFighter.delete(f.id);return; }
    sampleAerial(f);
    const phase=f.saberPhase??blade?.phase??'short';
    const key=(f.gear?.weapon||'single')+'/'+(f.gear?.grip||'forward')+'/'+phase;
    let actor:Actor|undefined|null=blades.get(f.id);
    if(actor&&actor.key!==key){blades.delete(f.id);actor=null;}
    const contact = f.attackSpec?.contact, action = f.technique || f.attack;
    if (!f.attack || !action || action === 'force' || !isFiniteNumber(contact) || !isFiniteNumber(f.actionTime)) return;
    const t=f.actionTime, offContact=f.attackSpec?.offhand?.contact, flow=f.weaponFlow===true;
    // The engine encodes a genuine linked move independently of consecutive
    // inputs. Accent its sampled release, never connect across attack serials.
    const link=f.chainFrom&&isFiniteNumber(f.chainDepth)?clamp(f.chainDepth*.44,.44,1):0;
    if (actor && (actor.action!==action ||
        (f.attackSerial!=null&&actor.serial!==f.attackSerial) || t+.025<actor.lastTime)) {
      blades.delete(f.id);actor=null;
    }
    const entries:Blade[]=Array.isArray(blade?.blades)?blade.blades:
      blade?.offhand?[{id:'main',hand:blade.hand,tip:blade.tip??blade.blade},{id:f.gear?.weapon==='staff'?'rear':'off',...blade.offhand}]:
        [{id:'main',hand:blade?.hand,tip:blade?.tip??blade?.blade}];
    const multi=entries.length>1, staff=f.gear?.weapon==='staff'||entries.some(e=>e?.id==='rear');
    const staffLead=staff?(f.attackSpec?.leadBlade??(f.staffLead==='rear'?'rear':'main')):null;
    let seen=0,count=0;
    for (const entry of entries) {
      if(count>=(f.gear?.weapon==='orbit'?3:2))break;
      if(!entry?.id||!Object.hasOwn(EMITTER_BIT,entry.id))continue;
      const id=entry.id,bit=EMITTER_BIT[id];
      if(seen&bit)continue;
      seen|=bit;count++;
      const hand=entry.hand, tip=entry.tip;
      if(!isFiniteNumber(hand?.x)||!isFiniteNumber(hand?.y)||
          !isFiniteNumber(tip?.x)||!isFiniteNumber(tip?.y)) continue;
      const alternate=staff?id!==staffLead:id==='off';
      const orbit=f.gear?.weapon==='orbit', orbitBeat=id==='orbit_third'?f.attackSpec?.orbitThird?.contact:id==='off'?offContact:contact;
      if(orbit&&!isFiniteNumber(orbitBeat))continue;
      const beat=orbit?orbitBeat!:alternate&&isFiniteNumber(offContact)?offContact:contact;
      // Faster animation gets a slightly earlier and longer sampling
      // window, then the measured tip velocity controls visible weight.
      if(t<beat*(flow?.63:.74)||t>beat+(flow?.14:.115)) continue;
      if(!actor){
        if(blades.size>=LIMIT)return;
        const mode=(f.gear?.weapon||'single')+'/'+(f.gear?.grip||'forward');
        actor={key,kit:KIT[mode]??KIT['single/forward'],serial:f.attackSerial,action,seen:clock,lastTime:t,emitters:new Map()};
        blades.set(f.id,actor);
      }
      let history=actor.emitters.get(id);
      if(!history){history={points:[],seen:clock,gesture:null,held:false,form:FORM.shii_cho,team:0};actor.emitters.set(id,history);}
      history.seen=clock;actor.seen=clock;
      const last=history.points.at(-1);
      const deltaT=last?clock-last.at:0;
      const distance=last?Math.hypot(tip.x-last.tx,tip.y-last.ty):0;
      if(last&&(deltaT<(flow?.009:TRAIL_SAMPLE)||distance<1.55))continue;
      const flowSpeed=flow&&deltaT>0&&deltaT<.054?clamp((distance/deltaT-205)/480,0,1):0;
      if(last&&Math.hypot(hand.x-last.hx,hand.y-last.hy)>50)history.points.length=0;
      history.form=FORM[f.form&&Object.hasOwn(FORM,f.form)?f.form:'shii_cho'];
      history.team=f.team===1?1:0;
      const body=blade?.body;
      const hasBody=isFiniteNumber(body?.x)&&isFiniteNumber(body?.y);
      const cx=multi?(hasBody?body.x:isFiniteNumber(f.x)?f.x:null):null;
      const cy=multi?(hasBody?body.y:isFiniteNumber(f.y)?f.y-42-finite(f.airHeight):null):null;
      // Peak weight at the authored release, independently per emitter. It is
      // a blade-edge cue, not a world-space hit or an opponent reaction.
      const release=clamp(1-Math.abs(t-beat)/.055,0,1);
      // Sample the old release pose exactly once per emitter. Draw only a
      // short outer tip cut, not a ghost fighter or a second live blade.
      if(!history.held && last && t>=beat && t-beat<.045 && clock-last.at<.048 &&
          Math.hypot(tip.x-last.tx,tip.y-last.ty)>5){
        history.held=true;
        history.gesture=last;
      }
      history.points.push({hx:hand.x,hy:hand.y,tx:tip.x,ty:tip.y,at:clock,cx:cy!=null?cx:null,cy,release,link,staff,staffLead,flowSpeed,airStyle:f.airPhase==='airborne'&&f.airHeight!>8?airStyle(f.form)[3]/.42:0});
      actor.multi=multi;
    }
    if(actor){
      actor.lastTime=t;
      for(const [id,history] of actor.emitters){
        if(!(seen&EMITTER_BIT[id])){actor.emitters.delete(id);continue;}
        // A firm per-fighter budget, with one extra historical bend so
        // dual/staff tails lose radiance before their samples are cropped.
        const cap=multi?(id==='main'?6:5):TRAIL_CAP;
        while(history.points.length>cap)history.points.shift();
      }
    }
  }
  function drawBladeTrails(ctx:Ctx) {
    if (reduced || !blades.size) return;
    ctx.save();
    try {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const actor of blades.values()) for (const [id,{ points, form, team, gesture }] of actor.emitters) {
        if(gesture){
          const age=(clock-gesture.at)/TRAIL_AGE;
          if(age<.88){
            const x=gesture.tx-gesture.hx, y=gesture.ty-gesture.hy;
            // Old pose: two tapered, broken ink cuts behind the current
            // blade; built on old geometry, outside of the body.
            if(Math.hypot(x,y)>19 &&
                (gesture.cx==null||Math.hypot(gesture.tx-gesture.cx,gesture.ty-gesture.cy!)>22)){
              ctx.globalAlpha=.46*(1-age);ctx.strokeStyle=INK;ctx.lineWidth=1.8;
              ctx.beginPath();ctx.moveTo(gesture.tx-x*.24,gesture.ty-y*.24);
              ctx.lineTo(gesture.tx-x*.04,gesture.ty-y*.04);
              ctx.moveTo(gesture.tx-x*.18-y*.065,gesture.ty-y*.18+x*.065);
              ctx.lineTo(gesture.tx-x*.08-y*.065,gesture.ty-y*.08+x*.065);
              ctx.stroke();
            }
          }
        }
        for (let i = 1; i < points.length; i++) {
          const a=points[i-1], b=points[i];
          const life=clamp(1-(clock-a.at)/TRAIL_AGE,0,1);
          const tipAge=clamp(1-(clock-b.at)/TRAIL_AGE,0,1);
          // Roll off toward zero (zero slope at expiry) and taper the
          // oldest links. A strong release stays legible, its wake thins.
          const count=points.length-1;
          const tail=count<3?1:Math.min(1,.34+.74*((i-1)/Math.min(count-1,3)));
          const fade=life*life*(3-2*life)*tail;
          if(fade<=.005||tipAge===0)continue;
          if(actor.multi){drawEmitterArc(ctx,a,b,fade,form,team,id,actor.kit);continue;}
          const cut = form[2]+.15*(1-fade)+Math.min(.17,(b.flowSpeed??0)*.17*(1-form[2]));
          const ax=a.hx+(a.tx-a.hx)*cut, ay=a.hy+(a.ty-a.hy)*cut;
          const bx=b.hx+(b.tx-b.hx)*cut, by=b.hy+(b.ty-b.hy)*cut;
          const bright=b.release??0, lift=b.airStyle*bright, linked=(b.link??0)*bright, speed=b.flowSpeed??0;
          const offset=actor.kit[2]*fade*bright;
          ctx.globalAlpha=(.49+.12*bright-.17*speed)*fade*form[3]; ctx.fillStyle=bright>.67||speed>.45?INK:form[team];
          ctx.beginPath(); ctx.moveTo(ax,ay+offset); ctx.lineTo(a.tx,a.ty);
          ctx.lineTo(b.tx,b.ty); ctx.lineTo(bx,by+offset); ctx.closePath(); ctx.fill();
          ctx.globalAlpha=(.69+.18*bright+.1*linked+.12*speed)*fade*form[3]; ctx.lineWidth=(1.46+.62*bright+.45*lift+.62*linked)*actor.kit[1]; ctx.strokeStyle=bright>.81?CHALK:linked>.20||speed>.45?LINK_EDGE[team]:EDGE[team];
          ctx.beginPath(); ctx.moveTo(a.tx,a.ty); ctx.lineTo(b.tx,b.ty); ctx.stroke();
          if (form[4] > 1) {
            ctx.globalAlpha=.28*fade; ctx.lineWidth=1.1; ctx.strokeStyle=INK;
            ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
          }
        }
      }
    } finally { ctx.restore(); }
  }
  function shake() {
    if (reduced || !punch) return { x: 0, y: 0 };
    const t = (clock - punch.at) / .165;
    if (t >= 1) return { x: 0, y: 0 };
    const power = punch.power * (1 - t) ** 2;
    const drift = power * Math.cos(t * 13);
    const cross = power * .24 * Math.sin(t * 19 + punch.id);
    return { x: drift * Math.cos(punch.angle) - cross * Math.sin(punch.angle), y: drift * Math.sin(punch.angle) + cross * Math.cos(punch.angle) };
  }
  function drawGround(ctx:Ctx) {
    if ((!active&&!airMarks.length) || reduced) return;
    ctx.save();
    try {
      ctx.lineCap = 'round';
      for(const mark of airMarks)drawAirFootprint(ctx,mark,(clock-mark.at)/AIR_AGE);
      for (const e of effects) {
        if (!e.kind || !GROUND.has(e.kind) || e.region) continue;
        const p = (clock - e.at) / e.duration, eP = 1 - (1 - p) ** 2;
        ctx.save(); ctx.translate(e.x, e.groundY + 2); ctx.rotate(e.angle);
        if(e.kind==='dash'){drawDashWake(ctx,e,p);ctx.restore();continue;}
        ctx.globalAlpha = (1 - p) * .24;
        ctx.strokeStyle = TEAM[e.team]; ctx.lineWidth = 2;
        ellipse(ctx, 12 + eP * 45, 4 + eP * 11);
        ctx.stroke();
        ctx.fillStyle = '#a59d93';
        for (let i = 0; i < 5; i++) {
          const v = random(e.id, i), x = (i - 2) * (5 + eP * 15);
          const y = ((i % 2) * 2 - 1) * (5 + eP * (5 + v * 7));
          ctx.beginPath(); ctx.ellipse(x, y, 4 + v * 5 + eP * 6, 2 + eP * 4, 0, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    } finally { ctx.restore(); }
  }
  function drawAir(ctx:Ctx) {
    if (!active) return;
    ctx.save();
    try {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const e of effects) {
        if (!e.kind) continue;
        const { duration, delay } = e, age = clock - e.at;
        if (age < delay) continue;
        const p = (age - delay) / (duration - delay);
        if (e.kind === 'dash') continue; // no air streak detached from moving feet
        if (e.kind === 'saber_phase') {drawIgnition(ctx,e,p,reduced,TEAM[e.team]);continue;}
        if (CUES.has(e.kind)){
          const cueX=e.kind==='feint'?e.x:e.contactX??e.x;
          const cueY=e.kind==='feint'?e.y-e.z-39:e.precise?e.y:e.contactY??e.y-e.z-39;
          ctx.save();ctx.translate(cueX,cueY);ctx.rotate(e.angle);
          drawDuelCue(ctx,e,p,reduced);ctx.restore();continue;
        }
        const regionRise=e.region==='head'?72:e.region.endsWith('leg')?16:43;
        const impactY=e.kind==='clash'||e.precise?e.y:e.contactY??e.y-e.z-(e.region?regionRise:e.kind==='ko'?16:37);
        ctx.save(); ctx.translate(e.contactX??e.x, impactY); ctx.rotate(e.angle);
        const color = TEAM[e.team];
        if(e.kind==='expanded_release')drawExpandedRelease(ctx,e,p,reduced);
        else if (e.kind === 'force') drawCast(ctx, color, p, reduced);
        else if(e.kind==='clash') drawClash(ctx,p,reduced);
        else if(e.graze) drawGraze(ctx,p,reduced);
        else if(e.region) drawRegional(ctx,e,p,reduced);
        else drawContact(ctx, e, p, reduced, color, impactY, contactLabels);
        ctx.restore();
      }
    } finally { ctx.restore(); }
  }
  return { reset, observe, update, sampleBlade, drawBladeTrails, drawGround, drawAir, shake };
}

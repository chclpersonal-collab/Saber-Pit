// @ts-nocheck
import {sampleArcadeFighter,sampleArcadeRenderRig} from './arcade-fighters.js?v=4.0.0';
/** Original ink-cutout art for Saber Pit. Sampled rig is read-only: hands,
 * shoes and all blade tips come from the same motion/contact calculation. */
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const ink='#211c1a', deep='#160f11';
const coats=[
 ['#50515b','#72727b','#38393f','#b3a494'],
 ['#514b51','#75666c','#3c373d','#af9b8c'],
 ['#4d4f58','#706e7c','#373840','#b0a393'],
 ['#5e5450','#7e716a','#433a39','#b8a08e'],
 ['#4c5359','#707985','#303940','#ada092'],
 ['#504b58','#777080','#38343f','#afa18d'],
];
const hairInks=['#27272b','#393639','#34343a','#494345','#272b2c','#57565a'];
const faces=[['#f1dfd8','#d6b8b1'],['#e7d1c5','#c6a39a'],['#e4c0b4','#ba978f'],['#f0d4ca','#c9a59f']];
const pt=(v,x,y)=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?v:{x,y};
const cap=(c,x,y,w,h,a,fill,stroke=ink,lw=2)=>{
 c.beginPath();c.ellipse(x,y,w,h,a,0,TAU);c.fillStyle=fill;c.fill();
 if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke();}
};
const stroke=(c,clr,width,...xy)=>{
 c.beginPath();c.moveTo(xy[0],xy[1]);for(let i=2;i<xy.length;i+=2)c.lineTo(xy[i],xy[i+1]);
 c.strokeStyle=clr;c.lineWidth=width;c.stroke();
};
function path(c,fill,outline,fn,width=2){
 c.beginPath();fn(c);c.closePath();c.fillStyle=fill;c.fill();
 if(outline){c.strokeStyle=outline;c.lineWidth=width;c.stroke();}
}
function head(c,r,f,p,seed,roll){
 const rabbit=f.body==='rabbit', variant=seed%6;
 const [face,shade]=faces[(seed>>>10)%faces.length], hair=hairInks[(seed>>>4)%hairInks.length];
 const bearing=r.styleSpin?.face??f.face??0;
 const ax=Math.cos(bearing), seen=Math.sin(bearing), visible=clamp((seen+.77)/.45,0,1);
 const w=15.55+(1-Math.abs(ax))*1.15, h=16.1;
 const hit=f.action==='stagger'||f.action==='clash', active=Boolean(f.attack)&&f.action!=='force';
 const down=f.alive===false||f.action==='ko';
 c.save();c.translate(p.x,p.y);c.rotate(roll*.15+ax*(hit?-.095:active?.042:0));
 if(rabbit){
  const sway=clamp((r.torsoTurn??0)*.19+(f.vx??0)*.0007,-.27,.27);
  for(const [i,x] of [[0,-7.3],[1,6.5]]){
   c.save();c.translate(x+ax*1.5,-12);c.rotate((i?.22:-.24)+sway);
   cap(c,0,-10,i?4.3:4.7,i?13.5:15.5,0,face,ink,1.3);
   cap(c,0,-10.6,1.9,i?9:10.5,0,'#c89b9d',null);c.restore();
  }
 }else if(variant===2){
  const knot=-ax*6.9;cap(c,knot,-16,5.7,4.6,-.25,hair,ink,1.25);
 }
 cap(c,0,0,w,h,-.035,face,ink,1.7);
 path(c,shade,null,q=>{
  q.moveTo(-w+1.15,-.7);q.quadraticCurveTo(-w+3.6,10.45,.1,13.25);
  q.quadraticCurveTo(w-5,13.7,w-1.6,6.8);
  q.quadraticCurveTo(w-5.7,15.9,.2,15.28);q.quadraticCurveTo(-w+.8,15.35,-w+1.15,-.7);
 });
 if(visible>.002){
  c.save();c.globalAlpha*=visible*(down?.46:1);
  const edge='#282125', forward=ax*5.2, spread=4.12+Math.abs(ax)*.20;
  const outer=clamp(forward+spread,-w+3.1,w-2.9), inner=clamp(forward-spread,-w+3.1,w-2.9);
  const slope=ax*(active?.85:1.0);
  const eyes=hit?2.0:active?.45:0;
  // Two short ink angles, no pupils, anatomy, or facial construction seam.
  stroke(c,edge,1.28,inner-2.1,.8-ax*.42,inner+1.27,-.5+eyes,inner+2.48,.5+slope*.7);
  if(Math.abs(outer-inner)>4.75)
    stroke(c,edge,1.22,outer-2.05,-.95+slope*.5,outer+.54,.03+eyes*.61,outer+1.5,1.35+slope*.46);
  c.restore();
 }
 if(!rabbit&&variant!==0){
  const off=-ax*3.05, back=1-visible;
  const long=variant===1||variant===4?1:0, billow=active?ax*1.2:0;
  const cape=back*(17.5+long*2.7), lower=-8+cape;
  path(c,hair,ink,q=>{
   q.moveTo(-w*.96-1,-3.7);q.quadraticCurveTo(-w-3,-13.3,-9.5+off,-17.45);
   q.quadraticCurveTo(-1.4+off,-20.2,7.5+off,-17.05);
   q.lineTo(9.9+off,-17.8);q.lineTo(8.4+off,-15.9);
   q.quadraticCurveTo(w+2.65,-14,w+1.8,-5.3);
   q.lineTo(w-.6,lower-5.15);q.lineTo(w+1.9,lower-1.7);
   q.lineTo(w-3.6,lower-2.25);q.lineTo(w-2.3,lower+.91);
   q.lineTo(w-5.9,lower-.6);q.lineTo(w-6.85,lower+(long?6.5:2.3));
   q.quadraticCurveTo(5.6+off+billow,lower-1.45,4.1+off,lower-3.1);
   q.quadraticCurveTo(.25+off,lower+4,-5.25+off,lower+2.85);
   q.lineTo(-5.05+off,lower+4.6);q.quadraticCurveTo(-9.6+off,lower+5.1,-11,lower+3.95);
   q.lineTo(-w+1.5,lower+(long?11:7.6));q.lineTo(-w+.2,lower+3.9);
   q.lineTo(-w-2,lower+6.5);q.quadraticCurveTo(-w-3.1,lower+2.15,-w*.96-1,-3.7);
  },1.65);
  stroke(c,'#60555b',.83,-9+off,-13.4,-5.2+off,-15.6,1.7+off,-16.05);
  stroke(c,'#645860',.72,4.1+off,-14.5,7.1+off,-12.75,10.4+off,lower-1.5);
 }
 c.restore();
}
export function peasantBootBearing(leg){
 const p=leg.foot,t=leg.toes;
 return Math.hypot(t.x-p.x,t.y-p.y)>.01?Math.atan2(t.y-p.y,t.x-p.x):0;
}
function boot(c,leg,coat,tint){
 const p=leg.foot,front=leg.side===1,leather=front?'#67564c':'#4a3e3b';
 c.save();c.translate(p.x,p.y);
 const knee=leg.k??{x:p.x,y:p.y-16};
 const dx=knee.x-p.x,dy=knee.y-p.y, shaft=Math.hypot(dx,dy);
 const upright=shaft>2&&dy<3?Math.atan2(dx,-dy)*.67:clamp(dx*.033,-.56,.56);
 const cuff=clamp(shaft*.68+(front?9.6:8.1),15.4,23.6), width=front?5.7:5.05;
 c.save();c.rotate(upright);
 path(c,tint??leather,tint?null:ink,q=>{q.moveTo(-4.5,1);q.lineTo(-width,-cuff+2);
  q.lineTo(-width-.7,-cuff);q.quadraticCurveTo(-.8,-cuff-1.7,width+.7,-cuff+.1);
  q.lineTo(width,-cuff+3);q.lineTo(4.3,2.3);q.quadraticCurveTo(.6,3.8,-4.5,1);},1.65);
 if(!tint){
  stroke(c,front?'#927c66':'#74645a',1,-width+.32,-cuff+2.1,0,-cuff+1.4,width-.25,-cuff+2.2);
  stroke(c,'#352c2a',.79,0,-cuff+4,.68,-5,.5,-1);
  for(let i=0;i<4;i++){const y=-cuff+5.2+i*(cuff-9.5)/3;
   stroke(c,i<2?'#ad9276':'#96816b',.78,-1.9,y-.7,1.65,y+.48);}
 }
 c.restore();
 c.rotate(peasantBootBearing(leg));
 const length=clamp(Math.hypot(leg.toes.x-p.x,leg.toes.y-p.y)+4,10,16.5);
 path(c,tint??leather,tint?null:ink,q=>{q.moveTo(-5.4,-2.8);q.quadraticCurveTo(-1.4,-4.6,4,-3.0);
  q.quadraticCurveTo(length-3.4,-3.75,length-.6,-1);q.lineTo(length,2.6);
  q.quadraticCurveTo(length-1.55,4.7,5,4.3);q.lineTo(-5,3.9);q.lineTo(-6,1.4);},1.65);
 if(!tint)stroke(c,'#362b29',.87,-4.4,2.7,length-1.3,3.2);
 c.restore();
}
function glove(c,p,back,aim,coat,open=false){
 c.save();c.translate(p.x,p.y);c.rotate(aim);
 const pale=back?'#d5c5bf':'#f1ddd4';
 path(c,pale,ink,q=>{
  q.moveTo(-7.8,-2.5);q.quadraticCurveTo(-10,-4.7,-8.0,-7.3);
  q.quadraticCurveTo(-5.5,-8.5,-3.9,-5.9);q.quadraticCurveTo(-2.7,-8.7,-.25,-8.2);
  q.quadraticCurveTo(1.95,-8.6,2.8,-6.65);q.quadraticCurveTo(5.05,-8,6.6,-5.5);
  q.quadraticCurveTo(9.7,-5,9.1,-1.65);q.quadraticCurveTo(10.8,6,4.65,7.85);
  q.quadraticCurveTo(-3.5,9.7,-7.75,5.1);q.quadraticCurveTo(-9.9,3.1,-7.8,-2.5);
 },1.75);
 stroke(c,'#967d75',.82,-6.1,-4.7,-3.2,-2.6,-2.6,.82);
 if(open)for(const [i,y] of [-4,-1.7,.7,3.1].entries())stroke(c,pale,1.85,4.7,y,9.85+Math.sin(i)*1.8,y-.47);
 c.restore();
}
function robe(c,r,kit,seed,team,outlined,tint){
 const high=r.shoulder, belt=r.waist, pelvic=r.pelvis??{x:belt.x,y:belt.y+10};
 const spin=r.styleSpin, drift=clamp(r.torsoTurn??0,-1.45,1.45)*4.4+(spin?.cloth??0)*(spin?.clothSide??1)*.78;
 const shape=seed%3, bias=clamp((spin?Math.cos(spin.face):r.forward??0),-1,1);
 const shoulder=shape===1?13.6:14.5, cinch=8.8, flare=shape===0?20.2:shape===1?17.5:19;
 const footTop=r.legs.reduce((y,l)=>Math.min(y,l.foot.y-18),Infinity);
 const low=r.airPhase==='grounded'?Math.min(pelvic.y+(shape===0?12:10),Math.max(pelvic.y+6,footTop-3)):pelvic.y+(shape===0?12:9);
 const hem={x:pelvic.x-drift*.85,y:low};
 const edge=(tint?null:ink), tailored=shape===1;
 path(c,tint??kit[0],edge,q=>{
  q.moveTo(high.x-shoulder,high.y-1);q.quadraticCurveTo(high.x-6,high.y-8,high.x,high.y-7);
  q.quadraticCurveTo(high.x+8,high.y-8,high.x+shoulder,high.y-1);
  q.lineTo(high.x+shoulder-2,high.y+10);q.lineTo(belt.x+cinch,belt.y);
  q.quadraticCurveTo(hem.x+flare-4,hem.y-3,hem.x+flare,hem.y);
  q.quadraticCurveTo(hem.x+flare*.45,hem.y+3,hem.x+2,hem.y+4);
  if(shape===0)q.quadraticCurveTo(hem.x-1.45,hem.y+5.25,hem.x-4.2,hem.y+3.85);
  else{q.lineTo(hem.x+2.6*bias,belt.y+(tailored?6:10));q.lineTo(hem.x-4.2,hem.y+3.85);}
  q.quadraticCurveTo(hem.x-flare+5,hem.y+2,hem.x-flare,hem.y);
  q.quadraticCurveTo(belt.x-cinch-4,hem.y-8,belt.x-cinch,belt.y);
  q.lineTo(high.x-shoulder+1,high.y+10);
 },1.8);
 if(tint)return;
 // A distinct short hood-mantle over the lower tunic, like layered fabric,
 // never shoulder balls. Two planes and only a few hand-inked folds.
 path(c,kit[2],ink,q=>{
  q.moveTo(high.x-shoulder-2,high.y-1);q.quadraticCurveTo(high.x-10,high.y-8,high.x+.4,high.y-7);
  q.quadraticCurveTo(high.x+10,high.y-7,high.x+shoulder+2,high.y-1);
  q.quadraticCurveTo(high.x+shoulder,high.y+8,belt.x+cinch+3,belt.y-5);
  q.quadraticCurveTo(belt.x+2,belt.y+1.6,belt.x-cinch-4,belt.y-3);
  q.quadraticCurveTo(high.x-shoulder-2,high.y+5,high.x-shoulder-2,high.y-1);
 },1.55);
 stroke(c,kit[1],.88,high.x-9,high.y-3,high.x-3,high.y-4,high.x+5,high.y-3);
 stroke(c,kit[1],.85,high.x+4.2*bias,high.y+5,belt.x+3,belt.y-4);
 stroke(c,'#211a19',3.5,belt.x-10,belt.y+.5,belt.x+10,belt.y+.8);
 stroke(c,'#a69583',.94,belt.x-8,belt.y,belt.x+8,belt.y+.15);
 const clampX=belt.x+bias*4.8;
 path(c,kit[3],ink,q=>{q.moveTo(clampX-2.3,belt.y-1.5);q.lineTo(clampX+2.2,belt.y-1.6);
  q.lineTo(clampX+2.6,belt.y+1.6);q.lineTo(clampX-2,belt.y+1.6);},.86);
 stroke(c,kit[2],.83,belt.x-6.4,belt.y+4,hem.x-8.5,hem.y-2);
 if(!tailored)stroke(c,kit[1],.71,belt.x+5,belt.y+5,hem.x+10.1,hem.y-2);
 if(shape===0)stroke(c,kit[2],.72,hem.x-flare+5,hem.y-.15,hem.x,hem.y+2,hem.x+flare-3,hem.y);
 if(tailored)for(let i=0;i<2;i++){const y=high.y+7.9+i*3.8,x=belt.x+bias*.8;
  stroke(c,kit[3],.77,x-2.1,y,x+1.8,y+.4);
 }
 if(outlined)stroke(c,team,1.15,high.x-shoulder-1,high.y+.1,high.x-shoulder+2,high.y+4.2);
}
function blade(c,hand,tip,tint,alive,bloom){
 const angle=Math.atan2(tip.y-hand.y,tip.x-hand.x),len=Math.hypot(tip.x-hand.x,tip.y-hand.y);
 if(len<2)return;
 c.save();c.translate(hand.x,hand.y);c.rotate(angle);
 if(alive){
  if(bloom){c.shadowBlur=12;c.shadowColor=tint;}
  stroke(c,tint,8,8,0,len,0);
  c.shadowBlur=0;stroke(c,'#ffe9bc',3.4,9,0,len-1,0);
 }
 stroke(c,deep,7,-10,0,10,0);stroke(c,'#786455',3.2,-8,-.8,9,-.8);
 stroke(c,'#dfa869',2.5,6,-3.8,6,3.8);
 c.restore();
}
export function drawArcadePeasantFighter(c,f,time=0,options={}){
 const {ghost=false,reducedMotion=false,outline=true,selected=false,hideSabers=false,lowDetail=false}=options;
 const physical=options.rig??sampleArcadeFighter(f,time,options);
 const r=sampleArcadeRenderRig(f,physical,time,options);
 const seed=(Number(f.appearanceSeed)||0)>>>0, kit=coats[seed%coats.length], faced=Math.cos(f.face??0)<0?-1:1;
 const team=f.team===1?'#ed886b':'#6ac7bf', edge=f.team===1?'#e6ad84':'#a4d0bd';
 const hand=pt(r.hand,18,-42), rear=pt(r.backHand,-24,-30), tip=pt(r.blade,hand.x+50*faced,hand.y),tip2=r.offBlade;
 const headPt=pt(r.head,0,-66), rib=pt(r.chest??r.shoulder,0,-43);
 const boots=r.legs;
 const tilt=(r.roll+(r.trick?.angle??0))*(r.flightSide??r.hdx), live=f.alive!==false&&r.action!=='ko';
 const pivot=physical.waist;
 c.save();c.translate(f.x??0,f.y??0);c.lineJoin='round';c.lineCap='round';
 if(!ghost&&live){
  cap(c,0,2,23,6,0,'#130c0d65',null);
  if(selected)cap(c,0,3,27,9,0,'#130c0d27',team,1.8);
 }
 c.translate(0,-physical.hop);c.scale(physical.type.scale,physical.type.scale);
 if(tilt){c.translate(pivot.x,pivot.y);c.rotate(tilt);c.translate(-pivot.x,-pivot.y);}
 if(!live){
  const fall=reducedMotion?1:clamp(r.t*3.3,0,1);
  c.globalAlpha*=.81-.29*fall;c.translate(-r.hdx*fall*14,1-fall*3);c.rotate(-r.hdx*fall*1.43);
 }
 const b=rib;
 if(ghost){
  const tint=typeof ghost==='string'?ghost:team;
  for(const leg of boots)boot(c,leg,kit,tint);
  robe(c,r,kit,seed,team,false,tint);
  cap(c,headPt.x,headPt.y,16.2,16.1,0,tint,null);
  for(const p of [hand,rear])cap(c,p.x,p.y,8.5,7.7,0,tint,null);
  c.restore();return physical;
 }
 for(const leg of boots)boot(c,leg,kit);
 robe(c,r,kit,seed,edge,outline);
 head(c,r,f,headPt,seed,tilt);
 const liveBlade=f.saberOff!==true&&live;
 if(!hideSabers&&(live||r.t<.24)){
  const emitter=r.emitter??hand, off=r.offEmitter??rear;
  if(r.staff&&tip2){
   stroke(c,deep,9,emitter.x,emitter.y,off.x,off.y);
   stroke(c,'#86786b',4,emitter.x,emitter.y,off.x,off.y);
  }
  if(tip2)blade(c,off,tip2,r.staff?team:f.team===1?'#e6c073':'#97cfe8',liveBlade,!reducedMotion&&!lowDetail);
  blade(c,emitter,tip,team,liveBlade,!reducedMotion&&!lowDetail);
 }
 glove(c,rear,true,Math.atan2(rear.y-b.y,rear.x-b.x),kit,r.freeHandAction&&r.freeHandExtension>.20);
 glove(c,hand,false,Math.atan2(tip.y-hand.y,tip.x-hand.x),kit);
 c.restore();
 return physical;
}

export function drawArcadePeasantFighterPreview(ctx,f={},options={}){
 const width=options.width??ctx.canvas.width,height=options.height??ctx.canvas.height;
 const portrait=options.framing==='portrait', scale=Math.min(width/(portrait?83:160),height/(portrait?83:171));
 const preview={face:portrait?.43:-.04,action:portrait?'idle':'guard',actionTime:.28,actionDuration:.65,...f,
   x:width/(2*scale)-(portrait?2:7),y:height/(2*scale)+(portrait?78:48)};
 ctx.save();ctx.scale(scale,scale);
 const pose=drawArcadePeasantFighter(ctx,preview,options.time??0,{...options,hideSabers:portrait});
 ctx.restore();return pose;
}

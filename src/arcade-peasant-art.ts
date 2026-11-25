import {sampleArcadeFighter,sampleArcadeRenderRig} from './arcade-fighters.js?v=6.0.2';
import {arcadeBasis} from './arcade-rig-projection.js?v=6.0.2';
/** Original ink-cutout art for Saber Pit. Sampled rig is read-only: hands,
 * shoes and all blade tips come from the same motion/contact calculation. */
import type {FighterPaintIdentity,FighterPaintOptions,FighterPreviewOptions} from './arcade-painter.js?v=6.0.2';
interface PaintPoint{x:number;y:number}
interface PaintLeg{foot:PaintPoint;toes:PaintPoint;k?:PaintPoint;hip?:PaintPoint;side?:number}
interface InkActor extends FighterPaintIdentity{action?:string;attack?:unknown;vx?:number;vy?:number}
interface HairRig{reducedMotion?:boolean;styleSpin?:{face:number;cloth?:number;clothSide?:number};torsoTurn?:number}
interface RobeRig extends HairRig{shoulder:PaintPoint;waist:PaintPoint;pelvis?:PaintPoint;legs:readonly PaintLeg[];forward?:number;airPhase?:string}
interface PaintRig extends RobeRig{
 hand?:PaintPoint;backHand?:PaintPoint;blade?:PaintPoint;offBlade?:PaintPoint|null;head?:PaintPoint;
 chest?:PaintPoint;frontElbow?:PaintPoint;backElbow?:PaintPoint;roll:number;trick?:{angle?:number}|null;flightSide?:number;hdx:number;
 regionalFall?:{progress:number;side:number;angle:number};primaryUnusable?:boolean;offhandUnusable?:boolean;
 action?:string;t:number;emitter?:PaintPoint;offEmitter?:PaintPoint;staff?:boolean;freeHandAction:boolean;freeHandExtension:number;
}
const TAU=Math.PI*2, clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const ink='#170f1a', deep='#100b16';
const coats=[
 ['#60566f','#a096ae','#332941','#cdb4a3'],
 ['#655368','#988398','#372737','#cbb3a0'],
 ['#4c5b6d','#8c9cb0','#2e364a','#c2baa3'],
 ['#6c554f','#a88b7b','#392c35','#dfbd9e'],
 ['#52635f','#9ba99c','#292e3c','#cebda4'],
 ['#5b5270','#9c90aa','#33283e','#cdbb9d'],
];
const hairInks=['#27272b','#393639','#34343a','#494345','#272b2c','#57565a'];
const faces=[['#d9d2cc','#a9a0ab'],['#d6cdd0','#b1a1ad'],['#c8bcb8','#988a92'],['#e0d5cd','#b2a4a8']];
const pt=(v:PaintPoint|null|undefined,x:number,y:number)=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?v:{x,y};
const cap=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,a:number,fill:string,stroke:string|null=ink,lw=2)=>{
 c.beginPath();c.ellipse(x,y,w,h,a,0,TAU);c.fillStyle=fill;c.fill();
 if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke();}
};
const stroke=(c:CanvasRenderingContext2D,clr:string,width:number,...xy:number[])=>{
 c.beginPath();c.moveTo(xy[0],xy[1]);for(let i=2;i<xy.length;i+=2)c.lineTo(xy[i],xy[i+1]);
 c.strokeStyle=clr;c.lineWidth=width;c.stroke();
};
function path(c:CanvasRenderingContext2D,fill:string,outline:string|null,fn:(ctx:CanvasRenderingContext2D)=>void,width=2){
 c.beginPath();fn(c);c.closePath();c.fillStyle=fill;c.fill();
 if(outline){c.strokeStyle=outline;c.lineWidth=width;c.stroke();}
}
/** The knot follows head angle continuously; cloth and gait only sway the hanging end. */
function womanHair(c:CanvasRenderingContext2D,r:HairRig,ax:number,seen:number,seed:number,hair:string,team:string,vx:number){
 const side=(seed&1)?1:-1;
 // Preserve an asymmetric profile at front/rear without a binary face-dependent flip.
 const back=clamp(-ax+.47*side*(1-Math.abs(ax)),-1,1);
 const motion=r.reducedMotion?0:clamp((r.torsoTurn??0)*2.8-vx*.025,-8,8);
 const x=back*(10.1+Math.abs(seen)*.8),y=-9.8;
 const dx=back*19+motion,braided=(seed&1)===1, h=braided?40:35;
 if(braided){
  for(let j=0;j<5;j++){
   const t=(j+1)/5;
   cap(c,x+dx*t+(j%2?1:-1)*Math.abs(back),y+h*t,5.6-j*.62,5.9-j*.41,-back*.42,hair,ink,1.6);
  }
  stroke(c,team,1.5,x+dx-2,y+h-2,x+dx+2,y+h-2.5);
 }else{
  path(c,hair,ink,q=>{
   q.moveTo(x-3,y-3);q.quadraticCurveTo(x+dx*.73-10,y-5,x+dx*.9-5,y+13);
   q.quadraticCurveTo(x+dx-6,y+26,x+dx-3+back*4,y+h);
   q.quadraticCurveTo(x+dx+8,y+29,x+dx*.77+5,y+15);
   q.quadraticCurveTo(x+dx*.6+6,y+4,x+3,y+1);
  },1.75);
  stroke(c,'#7c6576',.85,x+dx*.28-4,y+6,x+dx*.70-4,y+13,x+dx*.96-3,y+26);
 }
 cap(c,x+dx*.14,y+.35,4.3,2.7,back*.35,team,ink,1.15);
}
function head(c:CanvasRenderingContext2D,r:HairRig,f:InkActor,p:PaintPoint,seed:number,roll:number,team:string){
 const rabbit=f.body==='rabbit', variant=seed%6;
 const [face,shade]=faces[(seed>>>10)%faces.length], hair=hairInks[(seed>>>4)%hairInks.length];
 const bearing=r.styleSpin?.face??f.face??0;
 const ax=Math.cos(bearing), seen=Math.sin(bearing), visible=clamp((seen+.77)/.45,0,1);
 const femme=f.body==='woman', w=(rabbit?15.55:femme?14.9:14.4)+(1-Math.abs(ax))*1.15, h=rabbit?16.1:16.7;
 const hit=f.action==='stagger'||f.action==='clash', active=Boolean(f.attack)&&f.action!=='force';
 const down=f.alive===false||f.action==='ko';
 c.save();c.translate(p.x,p.y);c.rotate(roll*.15+ax*(hit?-.095:active?.042:0));
 if(femme)womanHair(c,r,ax,seen,seed,hair,team,f.vx??0);
 if(rabbit){
  const sway=clamp((r.torsoTurn??0)*.19+(f.vx??0)*.0007,-.27,.27);
  for(const [i,x] of [[0,-7.3],[1,6.5]]){
   c.save();c.translate(x+ax*1.5,-12);c.rotate((i?.22:-.24)+sway);
   cap(c,0,-10,i?4.3:4.7,i?13.5:15.5,0,face,ink,1.3);
   cap(c,0,-10.6,2.2,i?9:10.5,0,'#765b76',null);c.restore();
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
  const sweep=3.7+Math.abs(ax)*1.4;
  // Low split cloth mask. Its small displaced closure keeps facing legible without adding human anatomy.
  path(c,'#443844',null,q=>{
   q.moveTo(-w+.65,5.3);q.quadraticCurveTo(-w+5.8,7.1,forward-2,6.35);
   q.lineTo(forward+sweep,4.55);q.lineTo(w-.95,6.5);
   q.quadraticCurveTo(w-4,16.15,.12,16);q.quadraticCurveTo(-w+5.2,15.8,-w+.65,5.3);
  });
  // Three coarse mask constructions survive at actual combat scale rather than granular scratches.
  if(rabbit)stroke(c,'#bfacbd',1.25,forward-2.05,9.4,forward+2.2,9.4);
  else if(femme)stroke(c,'#bfacbd',1.35,forward-4.0,8.15,forward-.5,10.25,forward+3.25,8.7);
  else stroke(c,'#bfacbd',1.25,forward-1.4,8,forward+.45,11.15);

  const outer=clamp(forward+spread,-w+3.1,w-2.9), inner=clamp(forward-spread,-w+3.1,w-2.9);
  const slope=ax*(active?.85:1.0);
  const eyes=hit?2.0:active?.45:0;
  // Two short ink angles, no pupils, anatomy, or facial construction seam.
  stroke(c,edge,1.48,inner-2.1,-1.2-ax*.42,inner+.95,.1+eyes,inner+2.48,.05+slope*.7);
  if(Math.abs(outer-inner)>4.75)
    stroke(c,edge,1.43,outer-1.8,.27+slope*.5,outer+.6,-.51+eyes*.61,outer+2.15,-1.16+slope*.46);
  c.restore();
 }
 if(!rabbit&&!femme&&variant===0){
  // Short segmented cap follows the unmodified outer head dimensions.
  const brow=ax*3.6;
  path(c,'#34303c',ink,q=>{
   q.moveTo(-w+.4,-5.2);q.quadraticCurveTo(-w+1.15,-14.35,-7,-15.5);
   q.quadraticCurveTo(brow-1,-18,9,-14.9);q.quadraticCurveTo(w-1,-12,w-.5,-6.7);
   q.lineTo(brow+4.4,-7.7);q.lineTo(brow-3,-6.4);q.lineTo(-w+.4,-5.2);
  },1.7);
  stroke(c,'#9a879a',1.45,brow-5.8,-11.1,brow+.7,-12.1,brow+5.85,-10.7);
 }
 if(!rabbit&&(femme||variant!==0)){
  const off=-ax*3.05, back=1-visible;
  const long=femme||variant===1||variant===4, billow=active?ax*1.2:0;
  const cape=back*(17.5+(long?2.7:0)), lower=-8+cape;
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
  // One confident highlight follows the actual fringe mass; omit sub-pixel secondary grooves.
  stroke(c,'#938194',femme?1.45:1.3,-9+off,-13.1,-5.2+off,-15.25,1.8+off,-16.05);
  if(femme)stroke(c,'#716073',1.24,2.6+off,-13.8,5.0+off,-11.1,8.9+off,lower-2.0);
 }
 c.restore();
}
export function peasantBootBearing(leg:PaintLeg){
 const p=leg.foot,t=leg.toes;
 return Math.hypot(t.x-p.x,t.y-p.y)>.01?Math.atan2(t.y-p.y,t.x-p.x):0;
}
function boot(c:CanvasRenderingContext2D,leg:PaintLeg,coat:readonly string[],tint?:string,cuffDepth=0){
 const p=leg.foot,front=leg.side===1,leather=front?'#67564c':'#4a3e3b';
 c.save();c.translate(p.x,p.y);
 const knee=leg.k??{x:p.x,y:p.y-16};
 const dx=knee.x-p.x,dy=knee.y-p.y, shaft=Math.hypot(dx,dy);
 const upright=shaft>2&&dy<3?Math.atan2(dx,-dy)*.67:clamp(dx*.033,-.56,.56);
 const cuff=clamp(shaft*.68+(front?9.6:8.1),15.4,23.6)+cuffDepth, width=front?5.7:5.05;
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
function glove(c:CanvasRenderingContext2D,p:PaintPoint,back:boolean,aim:number,coat:readonly string[],open=false){
 c.save();c.translate(p.x,p.y);c.rotate(aim);
 const pale=back?'#b6aab1':'#d9ceca';
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
// Ink the continuous garment underneath the glove and boot sprites. The
// endpoints are sampled joints, so this follows the same swing, idle and fall.
function clothLimb(c:CanvasRenderingContext2D,start:PaintPoint,bend:PaintPoint,end:PaintPoint,color:string,width:number,tint?:string){
 c.beginPath();c.moveTo(start.x,start.y);
 c.quadraticCurveTo(bend.x,bend.y,(bend.x+end.x)*.5,(bend.y+end.y)*.5);c.lineTo(end.x,end.y);
 if(!tint){c.strokeStyle=ink;c.lineWidth=width+2.8;c.stroke();}
 c.strokeStyle=tint??color;c.lineWidth=width;c.stroke();
}
function inkLeg(c:CanvasRenderingContext2D,leg:PaintLeg,pelvis:PaintPoint,kit:readonly string[],tint?:string){
 const start=pt(leg.hip,pelvis.x,pelvis.y),k=pt(leg.k,(start.x+leg.foot.x)*.5,(start.y+leg.foot.y)*.5);
 clothLimb(c,start,k,leg.foot,leg.side===1?kit[2]:'#24212d',leg.side===1?8.8:7.7,tint);
}
function inkSleeve(c:CanvasRenderingContext2D,r:PaintRig,end:PaintPoint,front:boolean,kit:readonly string[],tint?:string){
 const start={x:r.shoulder.x+(front?1:-1)*r.hdx*7.5,y:r.shoulder.y+5};
 const k=pt(front?r.frontElbow:r.backElbow,(start.x+end.x)*.5,(start.y+end.y)*.5+4);
 clothLimb(c,start,k,end,front?kit[0]:kit[2],front?9.4:8.2,tint);
}
function robe(c:CanvasRenderingContext2D,r:RobeRig,kit:readonly string[],seed:number,team:string,outlined:boolean,body?:string,tint?:string,opponent=false){
 const high=r.shoulder, belt=r.waist, pelvic=r.pelvis??{x:belt.x,y:belt.y+10};
 const spin=r.styleSpin, drift=clamp(r.torsoTurn??0,-1.45,1.45)*4.4+(spin?.cloth??0)*(spin?.clothSide??1)*.78;
 const shape=body==='rabbit'?2:body==='woman'?0:1, bias=clamp((spin?Math.cos(spin.face):r.forward??0),-1,1);
 const shoulder=shape===1?11.9:shape===2?15.4:13.6, cinch=shape===2?9.6:7.2, flare=shape===0?20.5:shape===1?14.1:18.6;
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
  if(shape===0)q.quadraticCurveTo(hem.x-1.45,hem.y+7,hem.x-4.2,hem.y+4.85);
  else{q.lineTo(hem.x+2.6*bias,belt.y+(tailored?6:10));q.lineTo(hem.x-4.2,hem.y+3.85);}
  q.quadraticCurveTo(hem.x-flare+5,hem.y+2,hem.x-flare,hem.y);
  q.quadraticCurveTo(belt.x-cinch-4,hem.y-8,belt.x-cinch,belt.y);
  q.lineTo(high.x-shoulder+1,high.y+10);
 },2.3);
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
 // Asymmetric cloth facing: subtle team marker stays readable without flooding clothing with team color.
 const rim=seed%2?1:-1,sx=high.x+rim*(shoulder-3),sy=high.y+1;
 const markerWidth=outlined?2.4:1.7;
 if(opponent){
  // Coral twin ticks versus Blue's connected chevron; also distinct in grayscale.
  stroke(c,team,markerWidth,sx,sy,sx-rim*3.9,sy+3);
  stroke(c,team,markerWidth,sx-rim*2.1,sy+3.8,sx-rim*6.1,sy+6.6);
 }else stroke(c,team,markerWidth,sx,sy,sx-rim*3.6,sy+5.1,sx-rim*6.5,sy+2);
 if(shape===2){
  stroke(c,kit[1],1.15,high.x-6,high.y+3,belt.x,belt.y-3,high.x+6,high.y+3);
 }else if(shape===1){
  stroke(c,kit[3],.9,belt.x-2,belt.y+4,hem.x-3.5,hem.y-.4);
 }

}
function blade(c:CanvasRenderingContext2D,hand:PaintPoint,tip:PaintPoint,tint:string,alive:boolean){
 const angle=Math.atan2(tip.y-hand.y,tip.x-hand.x),len=Math.hypot(tip.x-hand.x,tip.y-hand.y);
 if(len<2)return;
 c.save();c.translate(hand.x,hand.y);c.rotate(angle);
 if(alive&&len>8){
  // Layered vector strokes give a readable rim even with bloom disabled or in large squads.
  stroke(c,deep,8.4,8,0,len,0);
  stroke(c,tint,5.7,8,0,len,0);
  const coreEnd=Math.max(8,len-.7);
  stroke(c,'#fffefd',2.6,8,0,coreEnd,0);
 }
 stroke(c,deep,7,-10,0,10,0);stroke(c,'#786455',3.2,-8,-.8,9,-.8);
 stroke(c,'#dfa869',2.5,6,-3.8,6,3.8);
 c.restore();
}
export function drawArcadePeasantFighter(c:CanvasRenderingContext2D,f:InkActor,time=0,options:FighterPaintOptions={}){
 const {ghost=false,reducedMotion=false,outline=true,selected=false,hideSabers=false}=options;
 const physical=options.rig??sampleArcadeFighter(f,time,options);
 const r=sampleArcadeRenderRig(f,physical,time,options as FighterPaintOptions & {ghost?:boolean}) as unknown as PaintRig;
 const seed=(Number(f.appearanceSeed)||0)>>>0, kit=coats[seed%coats.length], faced=Math.cos(f.face??0)<0?-1:1;
 const team=f.team===1?'#ff978c':'#86eafe', edge=f.team===1?'#e3938c':'#97cfe3';
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
  const impact=r.regionalFall,fall=impact?.progress??(reducedMotion?1:clamp(r.t*3.3,0,1));
  c.globalAlpha*=.81-.29*fall;c.translate((impact?.side??-r.hdx)*fall*14,1-fall*3);c.rotate(impact?.angle??-r.hdx*fall*1.43);
 }
 const b=rib;
 const hip=r.pelvis??{x:r.waist.x,y:r.waist.y+10};
 if(ghost){
  const tint=typeof ghost==='string'?ghost:team;
  for(const leg of boots){inkLeg(c,leg,hip,kit,tint);boot(c,leg,kit,tint);}
  inkSleeve(c,r,rear,false,kit,tint);inkSleeve(c,r,hand,true,kit,tint);
  robe(c,r,kit,seed,team,false,f.body,tint);
  cap(c,headPt.x,headPt.y,16.2,16.1,0,tint,null);
  for(const p of [hand,rear])cap(c,p.x,p.y,8.5,7.7,0,tint,null);
  c.restore();return physical;
 }
 // At steep camera bearings the grounded near boot sits much lower than its mate.
 // Lengthen the cuff along the existing shin, leaving the sole and gait anchored.
 const restCuff=r.airPhase==='grounded'&&(r.action==='idle'||r.action==='guard')?
   clamp((32-Math.hypot(f.vx??0,f.vy??0))/16,0,1):0;
 for(const leg of boots){
  inkLeg(c,leg,hip,kit);
  const over=restCuff*clamp((leg.foot.y-hip.y-35)*.53,0,8);
  boot(c,leg,kit,undefined,over);
 }
 inkSleeve(c,r,rear,false,kit);
 robe(c,r,kit,seed,edge,outline,f.body,undefined,f.team===1);
 inkSleeve(c,r,hand,true,kit);
 head(c,r,f,headPt,seed,tilt,edge);
 const liveBlade=f.saberOff!==true&&live;
 const orbit=physical.orbitBlades;
 if(orbit&&!hideSabers&&(live||(r.regionalFall?.progress??r.t)<.24)){
  const {local}=arcadeBasis(f,physical);
  for(const arc of orbit){
   const h=local(arc.hand),tip=local(arc.tip);
   if(liveBlade&&arc.charge>.04&&!reducedMotion){
    c.save();c.globalAlpha=arc.charge*.70;c.setLineDash([3,4]);
    stroke(c,'#ffd397',2,h.x,h.y-5,tip.x,tip.y-5);c.restore();
   }
   if(liveBlade&&arc.trail>.02&&!reducedMotion){
    c.save();c.globalAlpha=.25*arc.trail;
    stroke(c,'#ca85ff',8,h.x,h.y,tip.x,tip.y);c.restore();
   }
   blade(c,h,tip,'#c88bff',liveBlade);
  }
 }
 if(!orbit&&!hideSabers&&(live||(r.regionalFall?.progress??r.t)<.24)){
  const emitter=r.emitter??hand, off=r.offEmitter??rear;
  if(r.staff&&tip2){
   stroke(c,deep,9,emitter.x,emitter.y,off.x,off.y);
   stroke(c,'#86786b',4,emitter.x,emitter.y,off.x,off.y);
  }
  if(tip2)blade(c,off,tip2,r.staff?team:f.team===1?'#ffe0a2':'#c2c6ff',liveBlade&&!r.primaryUnusable&&!r.offhandUnusable);
  blade(c,emitter,tip,team,liveBlade&&!r.primaryUnusable);
 }
 glove(c,rear,true,Math.atan2(rear.y-b.y,rear.x-b.x),kit,r.freeHandAction&&r.freeHandExtension>.20);
 glove(c,hand,false,orbit?Math.atan2(hand.y-b.y,hand.x-b.x):Math.atan2(tip.y-hand.y,tip.x-hand.x),kit,Boolean(orbit&&liveBlade));
 c.restore();
 return physical;
}

export function drawArcadePeasantFighterPreview(ctx:CanvasRenderingContext2D,f:InkActor={},options:FighterPreviewOptions={}){
 const width=options.width??ctx.canvas.width,height=options.height??ctx.canvas.height;
 const portrait=options.framing==='portrait', scale=Math.min(width/(portrait?83:160),height/(portrait?83:171));
 const preview={face:portrait?.43:-.04,action:'idle',actionTime:.28,actionDuration:.65,...f,
   x:width/(2*scale)-(portrait?2:7),y:height/(2*scale)+(portrait?78:48)};
 ctx.save();ctx.scale(scale,scale);
 const pose=drawArcadePeasantFighter(ctx,preview,options.time??0,{...options,hideSabers:portrait});
 ctx.restore();return pose;
}

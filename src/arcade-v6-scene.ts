/** Menu art for the v6 home and modes cards: the game's own fighters with the approved ink pass,
 *  on the sunset stage. Menu only. The match renderer is untouched. */
import {drawArcadeFighter} from './arcade-painter.js?v=5.0.0';
import {sampleArcadeFighter,sampleArcadeRenderRig} from './arcade-fighters.js?v=5.0.0';

type Ctx=CanvasRenderingContext2D;
type PaintFighter=NonNullable<Parameters<typeof sampleArcadeFighter>[0]>;
type Pt={x:number;y:number};
type Look={body:string;gender:string;seed:number;hair?:'pony'|'braid'};
export type V6Look='woman'|'woman2'|'femboy'|'femboy2'|'rabbit';
export type V6Pose={x:number;gy:number;h:number;look:V6Look;team:0|1;act?:string;t?:number;face?:1|-1;ring?:boolean};

export const INK='#100a1c';
const LOOKS:Record<V6Look,Look>={
  woman:{body:'woman',gender:'female',seed:52,hair:'pony'},
  woman2:{body:'woman',gender:'female',seed:85,hair:'braid'},
  femboy:{body:'femboy',gender:'male',seed:5},
  femboy2:{body:'femboy',gender:'male',seed:20},
  rabbit:{body:'rabbit',gender:'nonbinary',seed:3},
};
const HAIR_INKS=['#27272b','#393639','#34343a','#494345','#272b2c','#57565a'];
const TEAM_RING=['#6ac7bf','#ed886b'] as const;

export function rnd(seed:number){let s=seed;return()=>((s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909))>>>0)/4294967296;}

function sky(c:Ctx,w:number,h:number){
  const s=c.createLinearGradient(0,0,0,h);s.addColorStop(0,'#2a1466');s.addColorStop(.55,'#c2408a');s.addColorStop(.8,'#ffb347');s.addColorStop(1,'#ffd98a');c.fillStyle=s;c.fillRect(0,0,w,h);
  const sx=w*.62,sy=h*.6,r=Math.min(w,h)*.16,sg=c.createRadialGradient(sx,sy,0,sx,sy,r*3);
  sg.addColorStop(0,'#fff6d0');sg.addColorStop(.25,'#ffd27acc');sg.addColorStop(1,'#ff8a3d00');c.fillStyle=sg;c.fillRect(0,0,w,h);
  c.fillStyle='#fff3c4';c.beginPath();c.arc(sx,sy,r*.55,0,7);c.fill();
  const R=rnd(7);c.fillStyle='#ffffffaa';for(let i=0;i<70;i++){const x=R()*w,y=R()*h*.35;c.globalAlpha=.3+R()*.7;c.fillRect(x,y,1.6,1.6);}c.globalAlpha=1;
}
function ridge(c:Ctx,w:number,h:number,y:number,amp:number,col:string,seed:number,spikes=false){
  const R=rnd(seed);c.fillStyle=col;c.beginPath();c.moveTo(0,h);let x=0;c.lineTo(0,y);
  while(x<w){const nx=x+40+R()*90,ny=y-R()*amp;if(spikes&&R()>.7){c.lineTo(x+(nx-x)*.45,ny-amp*.9);c.lineTo(x+(nx-x)*.55,ny-amp*.9);}c.lineTo(nx,ny);x=nx;}
  c.lineTo(w,h);c.fill();
}
function temple(c:Ctx,x:number,base:number,s:number,col:string){
  c.fillStyle=col;c.fillRect(x-s*.5,base-s*.9,s,s*.9);
  c.beginPath();c.moveTo(x-s*.7,base-s*.9);c.lineTo(x,base-s*1.5);c.lineTo(x+s*.7,base-s*.9);c.fill();
  c.fillRect(x-s*.08,base-s*1.9,s*.16,s*.5);
  c.fillStyle='#ffcf6a';c.globalAlpha=.85;for(let i=-1;i<=1;i++)c.fillRect(x+i*s*.25-s*.05,base-s*.6,s*.1,s*.18);c.globalAlpha=1;
}
function glow(c:Ctx,x:number,y:number,r:number,col:string){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,col.slice(0,7)+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function platform(c:Ctx,w:number,h:number,py:number){
  const L=w*.08,Rr=w*.92,th=h*.11;
  c.save();c.fillStyle='#0d0722';c.beginPath();c.moveTo(L+30,py+th);c.lineTo(Rr-30,py+th);c.lineTo(Rr-90,py+th*2.4);c.lineTo(w*.56,py+th*3.2);c.lineTo(w*.44,py+th*3.1);c.lineTo(L+90,py+th*2.3);c.closePath();c.fill();
  const top=c.createLinearGradient(0,py,0,py+th);top.addColorStop(0,'#7c5fd6');top.addColorStop(.18,'#4d3a9e');top.addColorStop(1,'#2a1d63');
  c.fillStyle=top;c.beginPath();c.roundRect(L,py,Rr-L,th,14);c.fill();
  c.strokeStyle='#ffffff14';c.lineWidth=2;for(let x=L+60;x<Rr;x+=70){c.beginPath();c.moveTo(x,py+6);c.lineTo(x-10,py+th);c.stroke();}
  const rim=c.createLinearGradient(L,0,Rr,0);rim.addColorStop(0,'#ffb34700');rim.addColorStop(.62,'#ffe7a8');rim.addColorStop(1,'#ffb34700');c.fillStyle=rim;c.fillRect(L+10,py,Rr-L-20,4);
  c.globalAlpha=.25;c.strokeStyle='#ffd23f';c.lineWidth=3;c.beginPath();c.ellipse(w/2,py+th*.5,th*1.5,th*.32,0,0,7);c.stroke();c.globalAlpha=1;c.restore();
  for(const tx of [L+24,Rr-24]){c.fillStyle='#1a1040';c.fillRect(tx-5,py-70,10,70);glow(c,tx,py-78,70,'#ff9a3dcc');c.fillStyle='#ffe28a';c.beginPath();c.ellipse(tx,py-80,7,12,0,0,7);c.fill();}
}
function backHair(c:Ctx,L:Look,head:Pt,fd:number,team:number){
  if(!L.hair)return;
  const ink=HAIR_INKS[(L.seed>>>4)%6]??'#27272b',ribbon=TEAM_RING[team?1:0],rx=head.x-fd*11,ry=head.y-9;
  c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle='#211c1a';c.lineWidth=1.8;c.fillStyle=ink;
  if(L.hair==='pony'){
    c.beginPath();c.moveTo(rx,ry-4);c.bezierCurveTo(rx-fd*16,ry-10,rx-fd*30,ry+2,rx-fd*27,ry+22);
    c.quadraticCurveTo(rx-fd*25,ry+30,rx-fd*31,ry+38);c.quadraticCurveTo(rx-fd*16,ry+30,rx-fd*15,ry+14);
    c.quadraticCurveTo(rx-fd*12,ry+4,rx+fd*2,ry+4);c.closePath();c.fill();c.stroke();
  }else{
    for(let i=0;i<5;i++){c.beginPath();c.ellipse(rx-fd*(8+i*1.6),ry+4+i*7,5.2-i*.4,4.6,fd*.3,0,7);c.fillStyle=ink;c.fill();c.stroke();}
  }
  c.fillStyle=ribbon;c.lineWidth=1.1;c.beginPath();c.ellipse(rx-fd*3,ry,4.2,2.8,fd*.6,0,7);c.fill();c.stroke();c.restore();
}
let scratchA:HTMLCanvasElement|null=null,scratchB:HTMLCanvasElement|null=null;
/** One fighter with the ink pass. Returns blade hilt and tip in canvas space. */
export function inkFighter(c:Ctx,o:V6Pose,dpr:number){
  const L=LOOKS[o.look],k=o.h/92,fd=o.face===-1?-1:1,team=o.team,act=o.act??'guard',t=o.t??.3;
  const f={peasantMotion:true,body:L.body,gender:L.gender,appearanceSeed:L.seed,team,form:'djem_so',
    face:fd<0?Math.PI:0,action:act,actionTime:t,actionDuration:.65,
    attack:['slash','sweep','rush','leap'].includes(act)?{}:undefined,x:0,y:0} as unknown as PaintFighter;
  const rig=sampleArcadeFighter(f,t),rr=sampleArcadeRenderRig(f,rig as Parameters<typeof sampleArcadeRenderRig>[1],t) as unknown as {head:Pt;hand:Pt;emitter?:Pt;blade?:Pt};
  const ox=180*k,oy=150*k,W=Math.ceil(360*k*dpr),H=Math.ceil(200*k*dpr);
  scratchA??=document.createElement('canvas');scratchB??=document.createElement('canvas');
  scratchA.width=W;scratchA.height=H;scratchB.width=W;scratchB.height=H;
  const a=scratchA.getContext('2d'),b=scratchB.getContext('2d');
  const paint=f as unknown as {team:number;peasantMotion:boolean};
  if(a&&b){
    a.setTransform(dpr*k,0,0,dpr*k,ox*dpr,oy*dpr);backHair(a,L,rr.head,fd,team);drawArcadeFighter(a,paint,t,{rig,hideSabers:true});
    b.drawImage(scratchA,0,0);b.globalCompositeOperation='source-in';b.fillStyle=INK;b.fillRect(0,0,W,H);
    const R=Math.max(1.6,k*2.6);
    for(let i=0;i<16;i++){const an=i/16*Math.PI*2;c.drawImage(scratchB,o.x-ox+Math.cos(an)*R,o.gy-oy+Math.sin(an)*R,W/dpr,H/dpr);}
  }
  if(o.ring!==false){c.save();c.strokeStyle=TEAM_RING[team];c.globalAlpha=.85;c.lineWidth=Math.max(2,k*2.6);c.beginPath();c.ellipse(o.x,o.gy+2*k,27*k,7*k,0,0,7);c.stroke();c.restore();}
  c.save();c.translate(o.x,o.gy);c.scale(k,k);c.lineJoin='round';backHair(c,L,rr.head,fd,team);drawArcadeFighter(c,paint,t,{rig});c.restore();
  const hilt=rr.emitter??rr.hand,tip=rr.blade??hilt;
  return {hilt:[o.x+hilt.x*k,o.gy+hilt.y*k] as const,tip:[o.x+tip.x*k,o.gy+tip.y*k] as const};
}
function smear(c:Ctx,cx:number,cy:number,r:number,a0:number,a1:number,col:string){
  c.save();const off=r*.16,mid=(a0+a1)/2,ox=Math.cos(mid)*off,oy=Math.sin(mid)*off;
  c.beginPath();c.arc(cx,cy,r,a0,a1);c.arc(cx-ox,cy-oy,r*.93,a1,a0,true);c.closePath();
  const g=c.createLinearGradient(cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,cx+Math.cos(a1)*r,cy+Math.sin(a1)*r);g.addColorStop(0,'#ffffff00');g.addColorStop(.7,'#ffffffdd');g.addColorStop(1,'#ffffff');
  c.fillStyle=g;c.fill();c.strokeStyle=col;c.lineWidth=2;c.globalAlpha=.9;c.beginPath();c.arc(cx,cy,r+2,a0+(a1-a0)*.35,a1);c.stroke();c.restore();
}
function spark(c:Ctx,x:number,y:number,r:number){
  const R=rnd(Math.round(x*13+y));c.save();c.fillStyle='#2a0a1a';
  c.beginPath();for(let i=0;i<14;i++){const a=i/14*Math.PI*2,rr=r*(.35+R()*.5);c.lineTo(x+Math.cos(a)*rr*1.3,y+Math.sin(a)*rr);}c.closePath();c.fill();
  c.globalCompositeOperation='lighter';
  for(let i=0;i<11;i++){const a=R()*Math.PI*2,l=r*(.9+R()*1.6),w=r*(.06+R()*.08);c.fillStyle=i%3?'#ffd27a':'#ffffff';c.beginPath();c.moveTo(x+Math.cos(a+1.57)*w,y+Math.sin(a+1.57)*w);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.lineTo(x+Math.cos(a-1.57)*w,y+Math.sin(a-1.57)*w);c.fill();}
  c.fillStyle='#fff';c.beginPath();c.arc(x,y,r*.28,0,7);c.fill();c.restore();
}
export type V6Scene='duel'|'squad'|'fronts'|'solo'|'bracket'|'heroes';
/** Paint a menu card scene into a canvas sized to its box. */
export function paintV6Scene(canvas:HTMLCanvasElement,scene:V6Scene){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const w=Math.max(1,Math.round(box.width)),h=Math.max(1,Math.round(box.height));
  canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');if(!c)return;
  c.setTransform(dpr,0,0,dpr,0,0);
  sky(c,w,h);ridge(c,w,h,h*.62,h*.12,'#7a2f7e',11,true);
  temple(c,w*.18,h*.6,h*.12,'#5a2167');temple(c,w*.83,h*.62,h*.1,'#5a2167');
  ridge(c,w,h,h*.7,h*.1,'#4a1a5e',21);ridge(c,w,h,h*.8,h*.06,'#2d1048',31);
  const py=h*(h>380?.6:.74);platform(c,w,h,py);
  const s=Math.min(h*.28,w*.14),R=rnd(scene.length*31);
  if(scene==='duel'||scene==='solo'){
    const a=inkFighter(c,{x:w*.44,gy:py,h:s*1.25,look:'woman',team:0,act:'rush',t:.32,face:1},dpr);
    smear(c,a.hilt[0],a.hilt[1],s*1.05,-2.1,-.25,'#6ac7bf');
    if(scene==='duel'){inkFighter(c,{x:w*.64,gy:py,h:s*1.25,look:'femboy',team:1,act:'hit',t:.08,face:-1},dpr);spark(c,a.tip[0],a.tip[1],s*.22);}
    else for(let i=0;i<3;i++)inkFighter(c,{x:w*(.66+i*.09),gy:py,h:s*(1.05-i*.12),look:(['rabbit','femboy2','woman2'] as const)[i]??'rabbit',team:1,act:'guard',t:.2,face:-1},dpr);
  }else{
    const looks:V6Look[]=['woman','femboy','rabbit','woman2','femboy2'],acts:[string,number][]=[['rush',.32],['sweep',.32],['leap',.32],['dash',.32],['parry',.32],['guard',.2]];
    const n=scene==='heroes'?3:scene==='bracket'?4:5,list:{x:number;t:0|1;i:number}[]=[];
    for(let i=0;i<n;i++)list.push({x:w*(.16+R()*.3),t:0,i});for(let i=0;i<n;i++)list.push({x:w*(.54+R()*.3),t:1,i:i+2});
    list.sort((p,q)=>p.x-q.x);
    const fs=s*(n>4?.7:.95);
    for(const f of list){const pose=acts[f.i%acts.length]??['guard',.2];inkFighter(c,{x:f.x,gy:py+R()*fs*.15,h:fs*1.2,look:looks[f.i%looks.length]??'woman',team:f.t,act:pose[0],t:pose[1],face:f.t?-1:1},dpr);}
    spark(c,w*.5,py-fs*.9,fs*.3);
  }
}
const BODY_LOOK:Record<string,V6Look>={woman:'woman',femboy:'femboy',rabbit:'rabbit'};
/** A single fighter on the sunset backdrop, for the Loadout screen and look cards. */
export function paintV6Fighter(canvas:HTMLCanvasElement,body:string,{stage=true,team=0 as 0|1,bare=false}={}){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const w=Math.max(1,Math.round(box.width)),h=Math.max(1,Math.round(box.height));
  canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');if(!c)return;
  c.setTransform(dpr,0,0,dpr,0,0);
  let gy=h*.86,size=h*.62;
  if(stage){sky(c,w,h);ridge(c,w,h,h*.62,h*.12,'#7a2f7e',11,true);temple(c,w*.2,h*.6,h*.12,'#5a2167');ridge(c,w,h,h*.72,h*.1,'#4a1a5e',21);gy=h*.74;platform(c,w,h,gy);size=h*.42;}
  else if(!bare){const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#3d2d86');g.addColorStop(1,'#22164f');c.fillStyle=g;c.fillRect(0,0,w,h);}
  else{gy=h*.92;size=h*.78;}
  inkFighter(c,{x:stage?w*.42:w*.5,gy,h:size,look:BODY_LOOK[body]??'woman',team,act:'guard',t:.2,face:1,ring:stage},dpr);
}

/* ---------- home card art: one bright scene per card, as in the approved home mock ---------- */
export type V6Card='arena'|'fronts'|'tournament'|'gauntlet'|'heroes';
function grad(c:Ctx,w:number,h:number,stops:[number,string][],diag=false){
  const g=diag?c.createLinearGradient(0,0,w,h):c.createLinearGradient(0,0,0,h);for(const [o,col] of stops)g.addColorStop(o,col);c.fillStyle=g;c.fillRect(0,0,w,h);
}
function hill(c:Ctx,w:number,h:number,y:number,col:string,seed:number){
  const R=rnd(seed);c.fillStyle=col;c.beginPath();c.moveTo(0,h);c.lineTo(0,y+R()*h*.04);
  const n=4;for(let i=1;i<=n;i++){const x=w*i/n,cx=x-w/n/2;c.quadraticCurveTo(cx,y-h*(.02+R()*.07),x,y+R()*h*.05);}
  c.lineTo(w,h);c.closePath();c.fill();
}
function shadow(c:Ctx,x:number,y:number,r:number){c.save();c.fillStyle='#1a0a2a';c.globalAlpha=.55;c.beginPath();c.ellipse(x,y,r,r*.24,0,0,7);c.fill();c.restore();}
function dust(c:Ctx,w:number,h:number,seed:number){const R=rnd(seed);c.save();c.fillStyle='#fff';for(let i=0;i<40;i++){c.globalAlpha=.15+R()*.35;c.fillRect(R()*w,R()*h*.5,1.5,1.5);}c.restore();}
function trophy(c:Ctx,x:number,y:number,s:number){
  c.save();c.fillStyle='#ffd23f';c.beginPath();c.moveTo(x-s*.5,y);c.lineTo(x+s*.5,y);c.lineTo(x+s*.38,y+s*.62);c.quadraticCurveTo(x,y+s*.82,x-s*.38,y+s*.62);c.closePath();c.fill();
  c.fillRect(x-s*.09,y+s*.7,s*.18,s*.32);c.fillRect(x-s*.32,y+s*1.0,s*.64,s*.12);
  c.globalAlpha=.25;c.fillStyle='#fff';c.fillRect(x-s*.36,y+s*.06,s*.12,s*.45);c.restore();
}
function stairs(c:Ctx,w:number,h:number){
  c.save();const steps=6,x0=w*.5,base=h,sw=(w-x0)/steps,sh=h*.09;
  for(let i=0;i<steps;i++){const x=x0+i*sw,top=base-(i+1)*sh;const g=c.createLinearGradient(x,top,x,base);g.addColorStop(0,'#5a1f2a');g.addColorStop(1,'#1c0810');c.fillStyle=g;c.fillRect(x,top,w-x,sh*(i+1)+2);
    c.fillStyle='#ffffff10';c.fillRect(x,top,w-x,2);}
  c.restore();
}
/** Paint one home card. Bright gradient, one prop, the game's own fighters in ink. */
export function paintV6Card(canvas:HTMLCanvasElement,card:V6Card){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const w=Math.max(1,Math.round(box.width)),h=Math.max(1,Math.round(box.height));
  canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');if(!c)return;
  c.setTransform(dpr,0,0,dpr,0,0);
  const s=Math.min(h*.36,w*.2);
  if(card==='arena'){
    grad(c,w,h,[[0,'#4b2aa8'],[.45,'#d4579c'],[.75,'#f0806a'],[1,'#e8a05c']]);dust(c,w,h,3);
    hill(c,w,h,h*.78,'#b86a52',5);hill(c,w,h,h*.86,'#8f4b46',9);
    const gy=h*.62,fs=Math.min(h*.3,w*.26);
    shadow(c,w*.5,gy+4,fs*.32);shadow(c,w*.76,gy+4,fs*.32);
    const a=inkFighter(c,{x:w*.52,gy,h:fs,look:'woman',team:0,act:'rush',t:.32,face:1,ring:false},dpr);
    inkFighter(c,{x:w*.76,gy,h:fs,look:'rabbit',team:1,act:'hit',t:.08,face:-1,ring:false},dpr);
    spark(c,a.tip[0],a.tip[1],fs*.2);
  }else if(card==='fronts'){
    grad(c,w,h,[[0,'#1d7fb8'],[.5,'#3fc4c4'],[1,'#7fe3b8']],true);dust(c,w,h,4);
    hill(c,w,h,h*.8,'#4aa58c',6);
    c.save();c.strokeStyle='#ffffff';c.lineCap='round';for(let i=0;i<3;i++){c.globalAlpha=.35+i*.12;c.lineWidth=Math.max(3,h*.025);c.beginPath();c.moveTo(w*.12+i*w*.05,h*.95);c.quadraticCurveTo(w*.35+i*w*.06,h*.25,w*.82,h*.18);c.stroke();}c.restore();
    c.save();c.fillStyle='#ff4d6d';c.beginPath();c.moveTo(w*.82,h*.08);c.lineTo(w*.87,h*.18);c.lineTo(w*.82,h*.28);c.lineTo(w*.77,h*.18);c.closePath();c.fill();
    c.fillStyle='#3fb8ff';c.beginPath();c.moveTo(w*.1,h*.74);c.lineTo(w*.14,h*.84);c.lineTo(w*.1,h*.94);c.lineTo(w*.06,h*.84);c.closePath();c.fill();c.restore();
    const gy=h*.82;shadow(c,w*.78,gy+3,s*.28);inkFighter(c,{x:w*.78,gy,h:s,look:'femboy',team:0,act:'guard',t:.2,face:-1,ring:false},dpr);
  }else if(card==='tournament'){
    grad(c,w,h,[[0,'#6e2a8e'],[.45,'#d8508a'],[1,'#f2c84a']],true);dust(c,w,h,5);
    hill(c,w,h,h*.8,'#b8963a',7);
    trophy(c,w*.74,h*.2,Math.min(h*.5,w*.3));
  }else if(card==='gauntlet'){
    grad(c,w,h,[[0,'#3a0d24'],[.5,'#b23a52'],[1,'#e2765a']],true);dust(c,w,h,6);
    stairs(c,w,h);
    const gy=h*.72;inkFighter(c,{x:w*.66,gy,h:s,look:'woman2',team:0,act:'leap',t:.32,face:1,ring:false},dpr);
  }else{
    grad(c,w,h,[[0,'#3346b8'],[.55,'#7a6ae0'],[1,'#c9a8f0']],true);dust(c,w,h,8);
    hill(c,w,h,h*.86,'#8a74d0',9);
    const gy=h*.86,fs=s*.9,looks:V6Look[]=['woman','rabbit','femboy2'];
    looks.forEach((lk,i)=>{const x=w*(.52+i*.15);shadow(c,x,gy+3,fs*.26);inkFighter(c,{x,gy,h:fs,look:lk,team:i===1?1:0,act:'guard',t:.2+i*.05,face:i===2?-1:1,ring:false},dpr);});
  }
}

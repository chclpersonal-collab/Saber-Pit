// Shared scene painters for the v5 mockups (arena backdrop and the game's own fighters).
import {drawArcadeFighter as paintFighter} from '../../build/dist/arcade-painter.js';
import {sampleArcadeFighter,sampleArcadeRenderRig} from '../../build/dist/arcade-fighters.js';
export const dpr=Math.min(2,devicePixelRatio||1);
/* ---------- scene painters ---------- */
function rnd(seed){let s=seed;return()=>((s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909))>>>0)/4294967296;}
function sky(c,w,h,top='#2a1466',mid='#c2408a',low='#ffb347'){
  const s=c.createLinearGradient(0,0,0,h);s.addColorStop(0,top);s.addColorStop(.55,mid);s.addColorStop(.8,low);s.addColorStop(1,'#ffd98a');c.fillStyle=s;c.fillRect(0,0,w,h);
  // sun
  const sx=w*.62,sy=h*.6,r=Math.min(w,h)*.16;const sg=c.createRadialGradient(sx,sy,0,sx,sy,r*3);sg.addColorStop(0,'#fff6d0');sg.addColorStop(.25,'#ffd27acc');sg.addColorStop(1,'#ff8a3d00');c.fillStyle=sg;c.fillRect(0,0,w,h);
  c.fillStyle='#fff3c4';c.beginPath();c.arc(sx,sy,r*.55,0,7);c.fill();
  // stars
  const R=rnd(7);c.fillStyle='#ffffffaa';for(let i=0;i<70;i++){const x=R()*w,y=R()*h*.35;c.globalAlpha=.3+R()*.7;c.fillRect(x,y,1.6,1.6);}c.globalAlpha=1;
}
function ridge(c,w,h,y,amp,col,seed,spikes=false){
  const R=rnd(seed);c.fillStyle=col;c.beginPath();c.moveTo(0,h);let x=0;c.lineTo(0,y);
  while(x<w){const nx=x+40+R()*90;const ny=y-R()*amp;if(spikes&&R()>.7){c.lineTo(x+(nx-x)*.45,ny-amp*.9);c.lineTo(x+(nx-x)*.55,ny-amp*.9);} c.lineTo(nx,ny);x=nx;}
  c.lineTo(w,h);c.fill();
}
function temple(c,x,base,s,col){
  c.fillStyle=col;c.fillRect(x-s*.5,base-s*.9,s,s*.9);
  c.beginPath();c.moveTo(x-s*.7,base-s*.9);c.lineTo(x,base-s*1.5);c.lineTo(x+s*.7,base-s*.9);c.fill();
  c.fillRect(x-s*.08,base-s*1.9,s*.16,s*.5);
  c.fillStyle='#ffcf6a';for(let i=-1;i<=1;i++){c.globalAlpha=.85;c.fillRect(x+i*s*.25-s*.05,base-s*.6,s*.1,s*.18);}c.globalAlpha=1;
}
function glow(c,x,y,r,col){const gg=c.createRadialGradient(x,y,0,x,y,r);gg.addColorStop(0,col);gg.addColorStop(1,col.slice(0,7)+'00');c.fillStyle=gg;c.fillRect(x-r,y-r,r*2,r*2);}
function platform(c,w,h,py){
  // floating stone stage with lit rim
  const L=w*.08,Rr=w*.92,th=h*.11;
  c.save();
  c.fillStyle='#0d0722';c.beginPath();c.moveTo(L+30,py+th);c.lineTo(Rr-30,py+th);c.lineTo(Rr-90,py+th*2.4);c.lineTo(w*.56,py+th*3.2);c.lineTo(w*.44,py+th*3.1);c.lineTo(L+90,py+th*2.3);c.closePath();c.fill();
  const top=c.createLinearGradient(0,py,0,py+th);top.addColorStop(0,'#7c5fd6');top.addColorStop(.18,'#4d3a9e');top.addColorStop(1,'#2a1d63');
  c.fillStyle=top;c.beginPath();c.roundRect(L,py,Rr-L,th,14);c.fill();
  // tiles
  c.strokeStyle='#ffffff14';c.lineWidth=2;for(let x=L+60;x<Rr;x+=70){c.beginPath();c.moveTo(x,py+6);c.lineTo(x-10,py+th);c.stroke();}
  // rim light from sun
  const rim=c.createLinearGradient(L,0,Rr,0);rim.addColorStop(0,'#ffb34700');rim.addColorStop(.62,'#ffe7a8');rim.addColorStop(1,'#ffb34700');
  c.fillStyle=rim;c.fillRect(L+10,py,Rr-L-20,4);
  // emblem
  c.globalAlpha=.25;c.strokeStyle='#ffd23f';c.lineWidth=3;c.beginPath();c.ellipse(w/2,py+th*.5,th*1.5,th*.32,0,0,7);c.stroke();c.globalAlpha=1;
  c.restore();
  // torches
  for(const tx of [L+24,Rr-24]){c.fillStyle='#1a1040';c.fillRect(tx-5,py-70,10,70);glow(c,tx,py-78,70,'#ff9a3dcc');c.fillStyle='#ffe28a';c.beginPath();c.ellipse(tx,py-80,7,12,0,0,7);c.fill();}
}
/* Grim fighter: round faceless head, tapered body, floating hands and feet, thick ink outline.
   Team color lives on the accessory, the sash, the blade and the ring under the feet. */
const INK='#100a1c';
/* Fighters: the game's own ink-cutout painter (Saber Pit's live art), same rig, hair, robes,
   boots and gloves. Mockup adds a thick ink pass and the game's woman ponytail/braid. */
const LOOK={
  woman:{body:'woman',gender:'female',seed:52,hair:'pony'},
  woman2:{body:'woman',gender:'female',seed:85,hair:'braid'},
  femboy:{body:'femboy',gender:'male',seed:5},
  femboy2:{body:'femboy',gender:'male',seed:20},
  rabbit:{body:'rabbit',gender:'nonbinary',seed:3},
};
const HAIR_INKS=['#27272b','#393639','#34343a','#494345','#272b2c','#57565a'];
function backHair(c,L,rr,fd,team){
  if(!L.hair)return;
  const h=rr.head,ink=HAIR_INKS[(L.seed>>>4)%6],ribbon=team?'#ed886b':'#6ac7bf';
  const rx=h.x-fd*11,ry=h.y-9;
  c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle='#211c1a';c.lineWidth=1.8;c.fillStyle=ink;
  if(L.hair==='pony'){
    c.beginPath();c.moveTo(rx,ry-4);
    c.bezierCurveTo(rx-fd*16,ry-10,rx-fd*30,ry+2,rx-fd*27,ry+22);
    c.quadraticCurveTo(rx-fd*25,ry+30,rx-fd*31,ry+38);
    c.quadraticCurveTo(rx-fd*16,ry+30,rx-fd*15,ry+14);
    c.quadraticCurveTo(rx-fd*12,ry+4,rx+fd*2,ry+4);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#60555b';c.lineWidth=.9;c.beginPath();c.moveTo(rx-fd*10,ry-3);c.quadraticCurveTo(rx-fd*23,ry+4,rx-fd*23,ry+24);c.stroke();
  }else{
    for(let i=0;i<5;i++){const bx=rx-fd*(8+i*1.6),by=ry+4+i*7;c.beginPath();c.ellipse(bx,by,5.2-i*.4,4.6,fd*.3,0,7);c.fillStyle=ink;c.fill();c.strokeStyle='#211c1a';c.lineWidth=1.5;c.stroke();}
  }
  c.fillStyle=ribbon;c.strokeStyle='#211c1a';c.lineWidth=1.1;c.beginPath();c.ellipse(rx-fd*3,ry,4.2,2.8,fd*.6,0,7);c.fill();c.stroke();
  c.restore();
}
let SCRATCH=null,SCRATCH2=null;
function fighter(c,o){
  const L=LOOK[o.look]||LOOK.femboy,k=o.h/92,fd=o.face<0?-1:1,team=o.team|0;
  const f={peasantMotion:true,body:L.body,gender:L.gender,appearanceSeed:L.seed,team,form:o.form||'djem_so',
    face:fd<0?Math.PI:0,action:o.act||'guard',actionTime:o.t??.3,actionDuration:.65,
    attack:['slash','sweep','rush','leap'].includes(o.act)?{}:undefined,x:0,y:0};
  const rig=sampleArcadeFighter(f,f.actionTime),rr=sampleArcadeRenderRig(f,rig,f.actionTime);
  // thick ink pass: silhouette of body (no blades), dilated
  const ox=180*k,oy=150*k,W=Math.ceil(360*k*dpr),Hh=Math.ceil(200*k*dpr);
  SCRATCH=SCRATCH||document.createElement('canvas');SCRATCH2=SCRATCH2||document.createElement('canvas');
  SCRATCH.width=W;SCRATCH.height=Hh;SCRATCH2.width=W;SCRATCH2.height=Hh;
  const a=SCRATCH.getContext('2d');a.setTransform(dpr*k,0,0,dpr*k,ox*dpr,oy*dpr);
  backHair(a,L,rr,fd,team);paintFighter(a,f,f.actionTime,{rig,hideSabers:true});
  const b=SCRATCH2.getContext('2d');b.drawImage(SCRATCH,0,0);b.globalCompositeOperation='source-in';b.fillStyle=INK;b.fillRect(0,0,W,Hh);
  const R=Math.max(1.6,k*2.6);
  for(let i=0;i<16;i++){const an=i/16*Math.PI*2;c.drawImage(SCRATCH2,o.x-ox+Math.cos(an)*R,o.gy-oy+Math.sin(an)*R,W/dpr,Hh/dpr);}
  // team ring under the feet (game team colors)
  if(o.ring!==false){c.save();c.strokeStyle=team?'#ed886b':'#6ac7bf';c.globalAlpha=.85;c.lineWidth=Math.max(2,k*2.6);c.beginPath();c.ellipse(o.x,o.gy+2*k,27*k,7*k,0,0,7);c.stroke();c.restore();}
  c.save();c.translate(o.x,o.gy);c.scale(k,k);c.lineJoin='round';
  backHair(c,L,rr,fd,team);paintFighter(c,f,f.actionTime,{rig});c.restore();
  const W2=p=>[o.x+p.x*k,o.gy+p.y*k],hilt=rr.emitter||rr.hand,tip=rr.blade||hilt;
  return {tip:W2(tip),hilt:W2(hilt),col:team?'#ff4d6d':'#2ec4ff'};
}
/* Sharp slash: a thin crescent with a hard white edge and team-color rim. */
function smear(c,cx,cy,r,a0,a1,col){
  c.save();
  const off=r*.16,mid=(a0+a1)/2,ox=Math.cos(mid)*off,oy=Math.sin(mid)*off;
  c.beginPath();c.arc(cx,cy,r,a0,a1);c.arc(cx-ox,cy-oy,r*.93,a1,a0,true);c.closePath();
  const g=c.createLinearGradient(cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,cx+Math.cos(a1)*r,cy+Math.sin(a1)*r);g.addColorStop(0,'#ffffff00');g.addColorStop(.7,'#ffffffdd');g.addColorStop(1,'#ffffff');
  c.fillStyle=g;c.fill();c.strokeStyle=col;c.lineWidth=2;c.globalAlpha=.9;c.beginPath();c.arc(cx,cy,r+2,a0+(a1-a0)*.35,a1);c.stroke();
  c.globalAlpha=.5;c.strokeStyle='#fff';c.lineWidth=1.5;for(const k of [.8,.68]){c.beginPath();c.arc(cx,cy,r*k,a0+(a1-a0)*.5,a1);c.stroke();}
  c.restore();
}
/* Gritty impact: jagged shards, hot core, dark ink splats. */
function spark(c,x,y,r,col){
  const R=rnd(Math.round(x*13+y));
  c.save();
  c.fillStyle='#2a0a1a';for(let i=0;i<9;i++){const a=R()*7,d=r*(1.1+R()*1.6),sz=r*(.06+R()*.16);c.beginPath();c.ellipse(x+Math.cos(a)*d,y+Math.sin(a)*d,sz*1.6,sz,a,0,7);c.fill();}
  c.beginPath();for(let i=0;i<14;i++){const a=i/14*Math.PI*2,rr=r*(.35+R()*.5);c.lineTo(x+Math.cos(a)*rr*1.3,y+Math.sin(a)*rr);}c.closePath();c.fill();
  c.globalCompositeOperation='lighter';
  for(let i=0;i<11;i++){const a=R()*Math.PI*2,l=r*(.9+R()*1.6),w=r*(.06+R()*.08);c.fillStyle=i%3?'#ffd27a':'#ffffff';c.beginPath();c.moveTo(x+Math.cos(a+1.57)*w,y+Math.sin(a+1.57)*w);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.lineTo(x+Math.cos(a-1.57)*w,y+Math.sin(a-1.57)*w);c.fill();}
  c.fillStyle='#fff';c.beginPath();c.arc(x,y,r*.28,0,7);c.fill();
  c.restore();
}
function speedLines(c,w,h){c.save();c.globalAlpha=.10;c.strokeStyle='#fff';const R=rnd(3);for(let i=0;i<40;i++){const y=R()*h,x=R()*w;c.lineWidth=1+R()*3;c.beginPath();c.moveTo(x,y);c.lineTo(x+120+R()*200,y);c.stroke();}c.restore();}

function arenaScene(c,w,h,mode){
  sky(c,w,h);
  ridge(c,w,h,h*.62,h*.12,'#7a2f7e',11,true);
  temple(c,w*.18,h*.6,h*.12,'#5a2167');temple(c,w*.83,h*.62,h*.1,'#5a2167');
  ridge(c,w,h,h*.7,h*.1,'#4a1a5e',21);
  ridge(c,w,h,h*.8,h*.06,'#2d1048',31);
  // haze
  const hz=c.createLinearGradient(0,h*.55,0,h*.85);hz.addColorStop(0,'#ff9ad500');hz.addColorStop(1,'#ff9ad533');c.fillStyle=hz;c.fillRect(0,h*.55,w,h*.3);
  const py=h*(w<600?.66:.72);platform(c,w,h,py);
  // falling embers
  const R=rnd(99);for(let i=0;i<40;i++){c.globalAlpha=.4+R()*.6;c.fillStyle=R()>.5?'#ffd27a':'#ff8a5c';c.beginPath();c.arc(R()*w,R()*h*.9,1+R()*2.2,0,7);c.fill();}c.globalAlpha=1;
  if(mode==='duel'){
    const s=w<600?h*.11:h*.19;const ax=w*(w<600?.4:.43),bx=w*(w<600?.66:.6);
    speedLines(c,w,h);
    const a=fighter(c,{x:ax-s*.25,gy:py,h:s*1.2,look:'woman',team:0,act:'rush',t:.32,face:1});
    smear(c,a.hilt[0],a.hilt[1],s*1.05,-2.1,-0.25,'#6ac7bf');
    fighter(c,{x:bx+s*.35,gy:py,h:s*1.2,look:'femboy',team:1,act:'hit',t:.08,face:-1});
    spark(c,a.tip[0]-s*.08,a.tip[1],s*.24,'#ffffff');
    // knockback dust
    c.fillStyle='#ffffff55';for(let i=0;i<6;i++){c.beginPath();c.arc(bx+s*.3+i*s*.12,py-4-i*2,s*(.08-i*.008),0,7);c.fill();}
    const d=globalThis.document.getElementById('dmg'),cl=document.getElementById('call');
    if(d&&cl){d.style.left=(bx+s*.1)+'px';d.style.top=(py-s*2.15)+'px';cl.style.left=(ax-s*1.4)+'px';cl.style.top=(py-s*2.05)+"px";}
  }
  if(mode==='looks'){
    const s=w<600?h*.1:h*.2,row=[['woman','guard',.2],['woman2','rush',.32],['femboy','sweep',.32],['femboy2','parry',.32],['rabbit','leap',.32]];
    row.forEach(([lk,act,t],i)=>{const x=w*(.12+i*.19);fighter(c,{x,gy:py,h:s*1.15,look:lk,team:i%2,act,t,face:1});
      c.font=`800 ${Math.round(s*.13)}px Nunito,sans-serif`;c.textAlign='center';c.fillStyle='#fff';c.fillText(lk.replace(/2$/,''),x,py+s*.42);});
  }
  if(mode==='squad'){
    const s=w<600?h*.06:h*.1;const R2=rnd(5);
    // capture zones
    for(const [zx,col] of [[.22,'#2ec4ff'],[.5,'#ffffff'],[.78,'#ff4d6d']]){c.save();c.globalAlpha=.35;c.strokeStyle=col;c.lineWidth=4;c.setLineDash([12,10]);c.beginPath();c.ellipse(w*zx,py+h*.05,s*2.2,s*.45,0,0,7);c.stroke();c.restore();}
    const looks=['woman','femboy','rabbit','woman2','femboy2'],acts=[['rush',.32],['sweep',.32],['leap',.32],['dash',.32],['parry',.32],['guard',.2],['slash',.2],['hit',.08]];
    const list=[];for(let i=0;i<9;i++)list.push({x:w*(.1+R2()*.38),t:0,look:looks[i%5],a:acts[i%8]});for(let i=0;i<8;i++)list.push({x:w*(.52+R2()*.38),t:1,look:looks[(i+2)%5],a:acts[(i+3)%8]});
    list.sort((p,q)=>p.x-q.x);
    for(const f of list)fighter(c,{x:f.x,gy:py+R2()*s*.3,h:s*1.35,look:f.look,team:f.t,act:f.a[0],t:f.a[1],face:f.t?-1:1});
    spark(c,w*.5,py-s*.9,s*.35,'#ffffff');smear(c,w*.47,py-s*1.1,s,-2.2,-.4,'#6ac7bf');
  }
}

export {rnd,sky,ridge,temple,glow,platform,fighter,smear,spark,speedLines,arenaScene,LOOK,INK};

/** Presentation only: world positions, targeting, cooldowns and effects events
 * are owned by the MOBA simulation. Terrain never edits walkability. */
import {BELL_RALLY_RULES,bellRallyCue,type BellRally} from './arcade-moba-rally.js?v=6.0.2';
import {MOBA_BATTLEFIELD} from './arcade-moba-map.js';
const {width:W,height:H,lanes,crossings,blockers,cores,forum}=MOBA_BATTLEFIELD;
const colors=['#75e5d5','#ff8e76'] as const;
const ink='#171b23', paper='#f3ddba', gold='#fbe2a2', goldDeep='#9a623d';
type Side=0|1;
type Position={x:number;y:number};
type Fighters=Position&{team:Side;hp:number;maxHp:number;alive:boolean;face:number;action?:string;actionTime?:number;
  dashRemaining?:number;form?:string;id?:string;name?:string;vx?:number;vy?:number;energy?:number;upgradingUntil?:number;spawnProtectUntil?:number};
type Unit=Position&{team:Side;hp:number;maxHp:number;alive?:boolean;shielded?:boolean;ranged?:boolean;rallied?:true;id?:string;face?:number};
export interface MobaFieldData {heroes:readonly Fighters[];minions:readonly Unit[];towers:readonly Unit[];
  cores:readonly Unit[];time:number;tick?:number;bellRally?:BellRally;events?:readonly (Position&{type:string;time:number;team:Side})[]}
type C=CanvasRenderingContext2D;
type V=readonly [number,number];
const TAU=Math.PI*2, clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const hash=(n:number)=>{
  let k=Math.imul(n+13,0x45d9f3b);k=Math.imul(k^(k>>>16),0x45d9f3b);
  return ((k^(k>>>16))>>>0)/4294967296;
};
const idSeed=(s='')=>Array.from(s).reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,19);
function poly(c:C,points:readonly V[],color:string,edge?:string,weight=1){
  c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();
  c.fillStyle=color;c.fill();if(edge){c.lineWidth=weight;c.strokeStyle=edge;c.stroke();}
}
function line(c:C,color:string,width:number,...points:V[]){
  c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);
  c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function ellipse(c:C,x:number,y:number,rx:number,ry:number,color:string,edge?:string,w=1){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();
  if(edge){c.lineWidth=w;c.strokeStyle=edge;c.stroke();}
}
function rect(c:C,x:number,y:number,w:number,h:number,color:string){c.fillStyle=color;c.fillRect(x,y,w,h);}
const lanesArt=[
  {base:'#66545a',joint:'#423e4a',light:'#c0906a',border:'#363445'},
  {base:'#696676',joint:'#504c5e',light:'#a59bac',border:'#3a3649'},
  {base:'#4c6369',joint:'#33464f',light:'#8e9ca5',border:'#2e3e4a'},
] as const;
type Path={width:number;points:readonly Position[]};
const coords=(pts:readonly Position[])=>pts.map(({x,y})=>[x,y] as const);
function flank(path:Path,k:number) {
  const side=(sign:number)=>path.points.map((p,i)=>{
    const a=path.points[Math.max(0,i-1)],b=path.points[Math.min(i+1,path.points.length-1)];
    const dx=b.x-a.x,dy=b.y-a.y, span=k*(Math.hypot(dx,dy)||1),wd=path.width*.5;
    return [p.x-sign*dy/span*wd,p.y+sign*dx/span*wd] as const;
  });
  return [...side(1),...side(-1).reverse()];
}
function road(c:C,p:Path,j:number) {
  const style=lanesArt[j], edge=flank(p,1), inner=flank(p,1.14);
  poly(c,edge.map(([x,y])=>[x+4,y+9]),'#191e24aa');
  poly(c,edge,style.border,ink,2);
  poly(c,inner,style.base,'#bfac895c',1.4);
  c.save();c.clip();
  for(let i=0;i<p.points.length-1;i++){
    const a=p.points[i], b=p.points[i+1], dx=b.x-a.x,dy=b.y-a.y, len=Math.hypot(dx,dy);
    c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));
    const half=p.width*.48,rows=Math.ceil(p.width/17),block=j===0?31:j===1?44:36;
    for(let row=0;row<=rows;row++) {
      const y=-half+row*17;
      line(c,style.joint,1.1,[-5,y],[len+7,y]);
      for(let k=0;k<len/block+1;k++){
        const x=k*block+(row%2)*block*.5, q=hash(k+29*row+57*i+91*j);
        line(c,style.joint,1.18,[x,y],[x+1,y+18]);
        if(q>.32)poly(c,[[x+3,y+2],[x+block-3,y+2.6],[x+block-3,y+14.4],[x+4,y+15]],
          q>.71?'#e7cc9c26':'#271e2519');
        if(q<.12)line(c,'#191a226c',.75,[x+4,y+7],[x+7,y+8],[x+9,y+12]);
        if(j===1&&q>.62)line(c,'#b8a8bb31',1,[x+2,y+15],[x+block*.48,y+3],[x+block-3,y+15]);
        if(j===2&&q>.4)for(const stud of [4,block-4])ellipse(c,x+stud,y+4,1.55,1.2,'#adb7b857');
      }
    }
    // Faded repair stones along canonical bends read as terrain, not
    // collision rails. The authoritative route starts and ends at these nodes.
    line(c,style.light+'69',2,[3,half-3],[len-2,half-3]);
    if(j===2){
      line(c,'#263941',4,[0,-half+12],[len,-half+12]);
      line(c,'#80929b6a',1,[0,-half+11],[len,-half+11]);
    }else if(j===0&&i%2===0){
      for(let x=6;x<len-6;x+=15)line(c,'#d69b6f54',1.1,[x,-half+5],[x+9,-half+5]);
    }
    c.restore();
  }
  c.restore();
}
function crossing(c:C,p:Path,index:number){
  // Warm compressed stone for the major crossroads; narrow paths at flanks.
  const edge=flank(p,1), inner=flank(p,1.16);
  poly(c,edge,'#393b49','#4e495c',1.5);
  poly(c,inner,index===1?'#535365':'#494b59');
  c.save();c.clip();
  for(let i=0;i<p.points.length-1;i++){
    const a=p.points[i],b=p.points[i+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));
    for(let x=0;x<d;x+=22)line(c,'#242b3966',1,[x,-p.width*.45],[x+3,p.width*.45]);
    for(let x=14;x<d;x+=38){
      line(c,index===1?'#9a7a6950':'#7c829258',1.1,[x-5,-p.width*.31],[x,0],[x+5,-p.width*.31]);
      line(c,'#b1a59a40',.8,[x-5,p.width*.31],[x,0],[x+5,p.width*.31]);
    }
    c.restore();
  }
  c.restore();
}
function wall(c:C,w:typeof blockers[number],i:number){
  const rim=coords(w.points), h=[26,19,14,16][i];
  // The lower silhouette is the exact collision polygon; the only pieces
  // with height are these solids and the already-present target structures.
  poly(c,rim,'#1c1c25',ink,2);
  const x=w.x,z=w.x2,y=w.y-h,b=w.y2-h,m=(x+z)/2,zMid=(y+b)*.5;
  const palette=i<2?['#8a716c','#574854','#322f42']:['#627888','#465769','#293744'];
  poly(c,[[x,w.y],[x,y],[x,b],[x,w.y2]],palette[2],ink,1.5);
  poly(c,[[x,b],[z,b],[z,w.y2],[x,w.y2]],palette[1],ink,2);
  poly(c,[[x,y],[z,y],[z,b],[x,b]],palette[0],ink,1.7);
  for(let k=0;k<4;k++){
    const yy=b+2+k*5;if(yy>=w.y2)continue;
    line(c,'#282937',.8,[x+3,yy],[z-4,yy]);
    for(let j=0;j<5;j++){const xx=x+9+j*18+k%2*7;line(c,'#2e2e3e99',.7,[xx,yy],[xx,Math.min(w.y2,yy+5)]);}
  }
  if(i===0){
    // West furnace: two sealed hatches behind the buttresses. Their warm
    // coals are dimmer than a hit flash or an owned weapon.
    for(const u of [m-21,m+21]){
      const q:V[]=[[u-16,zMid-11],[u-8,y+6],[u+8,y+6],[u+16,zMid-11],[u+14,b-6],[u-14,b-6]];
      poly(c,q,'#313141','#c59d78',1.5);
      poly(c,[[u-11,zMid],[u-6,zMid-6],[u+7,zMid-6],[u+11,zMid],[u+11,b-9],[u-11,b-9]],'#9b5b4d','#472d41',1.4);
      for(let k=-1;k<=1;k++)line(c,'#352c39',2,[u+k*6,zMid-4],[u+k*6,b-8]);
      line(c,'#d2905e',1.2,[u-9,b-10],[u+9,b-10]);
    }
    for(const u of [x+7,m,z-7])line(c,'#3b394c',4,[u,y],[u,b]);
  }else if(i===1){
    // Enclosed north relay: stepped slate cap with a repaired jagged end.
    poly(c,[[x+4,y+18],[x+17,y+4],[z-21,y+5],[z-6,y+15],[z-13,b-10],[z-29,b-4],[x+14,b-6]],
      '#514658','#352f42',1.7);
    poly(c,[[x+16,y+16],[x+23,y+7],[z-23,y+8],[z-13,y+17],[m,y+23]],'#98776a');
    line(c,'#b09b8e',1.4,[x+13,y+18],[m,y+21],[z-16,y+16]);
    for(let k=0;k<6;k++)line(c,'#302f42',1.4,[x+18+k*11,y+24],[x+23+k*9,b-8]);
    for(const [u,v] of [[x+5,b-4],[z-6,b-8]])
      poly(c,[[u-3,v],[u+1,v-4],[u+6,v-3],[u+4,v+3]],'#b8a18d',ink,1);
  }else if(i===2){
    // Counterweight station. The pistons are inside the blocked square.
    for(const q of [m-21,m+19]){
      ellipse(c,q,zMid,18,13,'#303b49','#9eaaad',1.5);
      ellipse(c,q,zMid-1,11,8,'#636f7a','#1f2c39',1.6);
      ellipse(c,q,zMid-1,4.4,3.4,'#a9a599','#33424f',1.2);
      for(let ti=0;ti<6;ti++){
        const a=ti*TAU/6;line(c,'#8d929a',1.2,[q+Math.cos(a)*10,zMid+Math.sin(a)*7],[q+Math.cos(a)*15,zMid+Math.sin(a)*10]);
      }
    }
    line(c,'#3e4b57',4,[x+8,b-7],[z-7,b-7]);
  }else{
    // Collapsed canal bulkhead; offset oxide stains and three bent bars.
    poly(c,[[x+6,y+9],[x+28,y+6],[m+6,y+12],[z-11,y+5],[z-4,b-7],[m+14,b-2],[x+10,b-5]],
      '#344c5c','#778a98',1.6);
    for(let k=0;k<3;k++){
      const yy=y+11+k*9;line(c,'#748595',2.5,[x+9,yy],[m-10,yy+2],[m+11,yy-3],[z-8,yy+2]);
    }
    poly(c,[[z-25,y+8],[z-8,y+4],[z-5,y+23],[z-18,y+27],[z-30,y+15]],'#9a7c72','#4e4d5a',1);
  }
}
function flood(c:C,x:number,y:number,r:number,color:string){
  const paint=c.createRadialGradient(x,y,0,x,y,r);
  paint.addColorStop(0,color+'61');paint.addColorStop(.38,color+'26');paint.addColorStop(1,color+'00');
  c.fillStyle=paint;c.fillRect(x-r,y-r,r*2,r*2);
}
function terrace(c:C,edge:readonly V[],south:boolean){
  // Massive dark profiles at the physical scenery boundary. The pattern
  // projects away from playable space; no added blocking crate or pillar.
  const extend=(h:number)=>edge.map(([x,y])=>[x,y+(south?h:-h)] as const);
  poly(c,[...edge,...extend(90).reverse()],'#202330','#1a1924',3);
  poly(c,[...extend(15),...extend(90).reverse()],'#2d2b3a');
  line(c,south?'#6c7380':'#89716d',1.45,...extend(15));
  line(c,'#171b28',2.5,...edge);
  for(let k=0;k<edge.length-1;k++){
    const [x,y]=edge[k],[ix,iy]=edge[k+1], n=Math.ceil(Math.abs(x-ix)/27);
    for(let j=0;j<n;j++){
      const t=j/Math.max(1,n), px=mix(x,ix,t),py=mix(y,iy,t), h=(south?1:-1)*(18+hash(j+k*19)*20);
      line(c,'#15182599',1.1,[px,py],[px+hash(k+j*12)*5,py+h]);
      if(j%4===0)line(c,'#a28b963b',2,[px+2,py+h],[px+13,py+h-2]);
    }
  }
}
function landscape(c:C){
  const sky=c.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#2c2737');sky.addColorStop(.47,'#3e4050');sky.addColorStop(1,'#283e4b');
  c.fillStyle=sky;c.fillRect(0,0,W,H);
  // Flat stone courts within playable gaps. Cut seams, broken filler bricks
  // and rippled oxide all sit at ground height; they don't suggest blockers.
  for(let j=0;j<18;j++){
    const yy=j*43-22;
    for(let k=-1;k<28;k++){
      const xx=k*48+(j%2)*25, s=hash(j*91+k*23);
      const y=yy+(s-.5)*6;
      if(s>.24)poly(c,[[xx+1,y+4],[xx+41,y+1],[xx+46,y+31],[xx+39,y+39],[xx+5,y+38]],
        s>.72?'#6d667316':'#171a2b19','#181b2c31',1);
      if(s>.49)line(c,'#ada6b339',.85,[xx+2,y+10],[xx+16,y+8],[xx+31,y+10]);
      if(s<.17)line(c,'#1c23368e',1.15,[xx+9,y+8],[xx+21,y+17],[xx+16,y+25],[xx+27,y+31]);
    }
  }
  terrace(c,[[0,52],[130,45],[284,49],[454,43],[548,39],[674,49],[812,39],[993,43],[1191,53],[1280,44]],false);
  terrace(c,[[0,672],[147,681],[265,670],[431,680],[557,669],[742,682],[918,671],[1098,679],[1280,667]],true);
  // Cold slag deposits and drained spillways break the flat gaps without
  // drawing a hazard edge. They are matte stains, not liquid channels.
  for(const [x,y,w,h] of [[140,249,49,39],[339,298,57,37],[906,280,62,34],[1177,250,46,32],
      [124,462,53,26],[333,472,62,32],[952,468,68,36],[1170,453,45,44],
      [539,664,91,32],[817,635,90,35]]){
    poly(c,[[x-w,y-h*.58],[x-w*.58,y-h],[x+w*.55,y-h*.63],[x+w,y-h*.1],[x+w*.71,y+h*.69],[x-w*.41,y+h]],
      y<320?'#65504e4e':'#314e5a98');
    for(let j=0;j<18;j++){
      const a=x+(hash(j+x)-.5)*w*1.70,b=y+(hash(j+x+71)-.5)*h*1.56;
      line(c,y<320?'#b4866b57':'#9aaab457',.93,[a,b],[a+3+hash(j+23)*17,b+(hash(j+11)-.5)*3]);
    }
  }
  // Brass cooling channels have a hairline inset, never a raised collision
  // lip. They frame the furnace approach and connect the scene visually.
  const seams:readonly V[][]=[
    [[74,292],[178,287],[230,245],[353,240],[426,223],[545,221]],
    [[1203,278],[1110,278],[1041,238],[940,232],[865,211],[760,207]],
    [[103,493],[194,506],[288,482],[374,475],[424,500],[534,478]],
    [[1189,491],[1127,477],[1052,502],[968,480],[913,497],[767,495]],
  ];
  for(const [i,way] of seams.entries()){
    line(c,'#191c2a87',5,...way);
    line(c,i<2?'#af806b74':'#7b99a477',1.3,...way);
    for(const [x,y] of way.slice(1,-1))ellipse(c,x,y,3.1,2.2,i<2?'#9b7963':'#879aa3');
  }
  // Fixed lamp falls, all baked into one texture. Low light only; the
  // brightest colors in battle are the units, towers and controls.
  for(const [x,y,r,h] of [[118,71,81,0],[401,206,118,0],[858,199,118,0],[1168,69,86,0],
      [275,495,94,1],[1012,484,100,1],[547,651,87,1],[792,650,87,1],[638,416,119,2]]){
    flood(c,x,y,r,h===0?'#b76c52':h===1?'#517994':'#9a8075');
    const spot=h===0?'#d3a07480':h===1?'#8ca7b489':'#b89d9571';
    for(let j=0;j<7;j++){const a=hash(j+x)*TAU, d=7+hash(j+y)*22;ellipse(c,x+Math.cos(a)*d,y+Math.sin(a)*d,1.7,.85,spot);}
  }
}
function citadelGround(c:C){
  for(const [i,p] of cores.entries()){
    const tint=colors[i];
    const side=i===0?1:-1;
    // Decorative stone footings at the real castle and three route entries.
    const x=p.x, y=p.y;
    poly(c,[[x-38,y-99],[x-13,y-147],[x+44*side,y-125],[x+66*side,y-67],[x+74*side,y+67],
      [x+45*side,y+115],[x-12,y+144],[x-38,y+99]],'#544d46','#7c6e5d',2);
    ellipse(c,x,y,43,50,'#817360','#b1a287ad',2);
    ellipse(c,x,y,34,42,'#716352',tint+'8c',1);
    for(const sign of [-1,1])line(c,tint+'66',1.6,[x+12*side,y+sign*41],[x+14*side,y+sign*94]);
  }
}
function forumGround(c:C){
  const {x,y}=forum.center;
  ellipse(c,x,y,forum.radius+19,forum.radius*.79,'#4b4657','#817480',1.7);
  ellipse(c,x,y,forum.radius+7,forum.radius*.72,'#5d5362','#b2a0946b',2);
  for(let i=0;i<12;i++){
    const a=i*TAU/12;
    line(c,'#a3929c66',1.2,[x+Math.cos(a)*87,y+Math.sin(a)*58],[x+Math.cos(a)*99,y+Math.sin(a)*66]);
  }
}
function forumSeal(c:C){
  const {x,y}=forum.center;
  c.save();c.translate(x,y);
  poly(c,[[0,-38],[49,0],[0,38],[-49,0]],'#584c3924','#dfcf9e84',1.6);
  ellipse(c,0,0,29,21,'#00000000','#decda287',1.6);
  // Open bell engraved into the town square; distinct from a spawn or tower.
  poly(c,[[-15,9],[-10,5],[-8,-6],[-4,-11],[4,-11],[8,-6],[10,5],[15,9]],'#a99464','#e4d2a584',1.2);
  ellipse(c,0,12,3.4,2.4,'#d9c896');c.restore();
}
type WallSprite={canvas:HTMLCanvasElement;x:number;y:number};
const roofCache=new WeakMap<HTMLCanvasElement,WallSprite[]>();
function roof(w:typeof blockers[number],i:number):WallSprite{
  const pad=4,lift=30,x=w.x-pad,y=w.y-lift-pad;
  const canvas=document.createElement('canvas');
  canvas.width=w.x2-w.x+pad*2;canvas.height=w.y2-w.y+lift+pad*2;
  const c=canvas.getContext('2d')!;
  c.translate(-x,-y);wall(c,w,i);return {canvas,x,y};
}
export function paintMobaTerrain():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d')!;
  landscape(c);citadelGround(c);
  crossings.forEach((path,i)=>crossing(c,path,i));
  forumGround(c);lanes.forEach((lane,i)=>road(c,lane,i));
  for(const body of blockers){
    poly(c,coords(body.points).map(([x,y])=>[x+8,y+9]),'#14182664');
    poly(c,coords(body.points),'#222926','#1e2228',2);
  }
  const fade=c.createLinearGradient(0,0,0,H);
  fade.addColorStop(0,'#10131963');fade.addColorStop(.18,'#12162200');
  fade.addColorStop(.82,'#18182200');fade.addColorStop(1,'#1617204e');
  c.fillStyle=fade;c.fillRect(0,0,W,H);
  c.lineWidth=3;c.strokeStyle='#8d7d825f';c.strokeRect(4,4,W-8,H-8);
  // Do not allocate or redraw this detail in the match animation loop.
  roofCache.set(canvas,blockers.map(roof));
  return canvas;
}
function bar(c:C,p:Pick<Unit,'x'|'y'|'hp'|'maxHp'|'team'>,dy:number,w:number,selected=false){
  rect(c,p.x-w/2-1,p.y+dy-1,w+2,6,'#10151b');
  rect(c,p.x-w/2,p.y+dy,w*clamp(p.maxHp>0?p.hp/p.maxHp:0),4,selected?'#ffdc91':colors[p.team]);
}
function diamond(c:C,x:number,y:number,r:number,color:string,edge?:string){
  poly(c,[[x,y-r],[x+r*.82,y],[x,y+r],[x-r*.82,y]],color,edge,1);
}
function structure(c:C,p:Unit,core:boolean,opacity=1){
  const tint=colors[p.team], live=p.hp>0;
  c.save();if(opacity<1)c.globalAlpha=opacity;c.translate(p.x,p.y);
  const s=core?32:22;
  ellipse(c,3,9,s+10,s*.44,'#151b2073');
  poly(c,[[-s,-5],[-s*.67,-13],[s*.69,-13],[s,-1],[s*.66,11],[-s*.67,11]],'#6a655f',ink,2);
  line(c,'#c8b79b',1.2,[-s+3,-4],[-s*.62,-11],[s*.58,-11]);
  if(!live){
    poly(c,[[-s+4,-8],[-s*.66,-19],[-2,-12],[9,-20],[s-3,-10],[s-1,3],[-s+5,5]],'#343b3c',ink,2);
    for(const [x,y,r] of [[-s+7,0,5],[s-4,-1,4],[2,-10,4],[-1,4,3]])diamond(c,x,y,r,'#66736a');
  }else if(core){
    // Keep and tower have distinct outer silhouettes, even desaturated.
    poly(c,[[-28,3],[-28,-33],[-23,-39],[-18,-33],[-13,-39],[-10,-28],[10,-28],[13,-39],[18,-33],
      [23,-39],[28,-33],[28,3]],'#776655',ink,2.5);
    poly(c,[[-19,-2],[-19,-36],[0,-51],[19,-36],[19,1]],'#a49074',ink,2.3);
    poly(c,[[0,-50],[14,-35],[14,0],[2,7],[1,-22]],'#64595b');
    poly(c,[[-7,5],[-7,-13],[0,-21],[7,-13],[7,5]],'#2f333b',ink,1);
    diamond(c,0,-31,8,tint,ink);diamond(c,-20,-22,3,tint,ink);diamond(c,20,-22,3,tint,ink);
    if(p.shielded){
      c.setLineDash([5,6]);ellipse(c,0,-14,37,29,'#00000000',tint+'ac',1.6);c.setLineDash([]);
    }else{
      line(c,'#e0b9a9',1.4,[-11,-33],[-5,-26],[-10,-20],[-5,-14]);
      ellipse(c,0,-7,5,8,'#ecab6c60');
    }
  }else{
    poly(c,[[-15,4],[-13,-31],[12,-31],[15,3]],'#8b7665',ink,2.2);
    poly(c,[[12,-32],[5,-30],[5,5],[15,4]],'#49494b');
    poly(c,[[-18,-30],[-18,-43],[-13,-43],[-13,-36],[-7,-36],[-7,-43],[6,-43],[6,-36],
      [12,-36],[12,-43],[18,-43],[18,-30]],'#a28c71',ink,2.1);
    rect(c,-10,-26,9,18,tint);
    poly(c,[[-10,-8],[-1,-8],[-5.5,-4]],tint,ink,.8);
    line(c,'#e5c194',1,[-12,-24],[-12,-15]);diamond(c,8,-21,3,'#1f2229');
  }
  c.restore();if(live)bar(c,p,core?-58:-50,core?61:43);
}
type Boot={point:Position;planted:boolean;from:Position;to:Position};
type StepMemo={x:number;y:number;time:number;distance:number;phase:number;boots:[Boot,Boot];pace:number};
const strideMemos=new WeakMap<Fighters,StepMemo>();
const settlePoint=(a:Position,b:Position,w:number):Position=>({x:mix(a.x,b.x,w),y:mix(a.y,b.y,w)});
function gait(p:Fighters,time:number,moving:boolean,effects:boolean,guard:boolean,dash:boolean){
  const ready=(side:number,span=1):Position=>({x:p.x+side*(guard?6:4.2)*span,y:p.y+3+side*1.8});
  const prior=effects?strideMemos.get(p):null;
  const dx=prior?p.x-prior.x:0,dy=prior?p.y-prior.y:0,travel=Math.hypot(dx,dy);
  const valid=Boolean(prior&&time>=prior.time&&time-prior.time<.20&&travel<27);
  const distance=(valid?prior!.distance:0)+(moving?travel:0), phase=(distance/37)%1;
  const elapsed=valid?time-prior!.time:0;
  const pace=valid&&moving?(travel>.02?Math.min(1,travel/Math.max(.002,elapsed)/155):
    prior!.pace*Math.max(0,1-elapsed*18)):0;
  const ux=travel>.02?dx/travel:Math.cos(p.face),uy=travel>.02?dy/travel:Math.sin(p.face);
  const foot=(index:number):Boot=>{
    const sign=index===0?-1:1, base=ready(sign,dash?1.45:1);
    const old=valid?prior!.boots[index]:null;
    if(!effects||!old)return {point:base,planted:true,from:base,to:base};
    if(!moving){
      // A real stopped actor holds the support boot. Let the other heel
      // close only when simulation time advances, and never on pause redraw.
      if(old.planted||time===prior!.time)return old;
      const w=Math.min(1,(time-prior!.time)*16);
      const a=settlePoint(old.point,base,w);
      return {...old,point:a,planted:Math.hypot(a.x-base.x,a.y-base.y)<.6};
    }
    const k=(phase+index*.5)%1, hold=k<.54;
    if(hold){
      const next=old.planted?old.point:old.to;
      return {point:next,planted:true,from:next,to:next};
    }
    const t=(k-.54)/.46, landing=9+pace*7;
    const from=old.planted?old.point:old.from, to=old.planted?
      {x:base.x+ux*landing,y:base.y+uy*landing*.78}:old.to;
    const point=settlePoint(from,to,smooth(t));
    point.y-=Math.sin(t*Math.PI)*(dash?8:4.4+pace*2);
    return {point,planted:false,from,to};
  };
  const boots:[Boot,Boot]=[foot(0),foot(1)];
  if(effects)strideMemos.set(p,{x:p.x,y:p.y,time,distance,phase,boots,pace});else strideMemos.delete(p);
  return {phase,boots,pace};
}
function drawBoot(c:C,hip:V,knee:V,heel:V,front:boolean){
  // The knee, shin and shaped sole are independent inked volumes, keeping
  // the grounded contact visible against the stone background.
  line(c,ink,7.2,hip,knee,heel);
  line(c,front?'#9e8066':'#655754',4.1,knee,heel);
  line(c,front?'#b99a77':'#897667',1.4,[knee[0]-1,knee[1]+1],[heel[0]-1,heel[1]-1]);
  const [x,y]=heel;
  poly(c,[[x-2.8,y-2.4],[x+1.1,y-2.4],[x+5.5,y-.3],[x+5.1,y+1.8],[x-3,y+1.8]],
    front?'#ac9176':'#776351',ink,1.3);
}
function sweepWake(c:C,x:number,y:number,angle:number,length:number,width:number,tint:string){
  if(width<=.07)return;
  const at=(a:number,r:number)=>[x+Math.cos(a)*r,y+Math.sin(a)*r] as const;
  const points:V[]=[];
  for(let i=0;i<=6;i++)points.push(at(angle-width*(1-i/6),length*(.96+.04*i/6)));
  for(let i=6;i>=0;i--)points.push(at(angle-width*(1-i/6),length*(.95-(Math.sin(Math.PI*i/6))*.20)));
  poly(c,points,tint+'64');
  line(c,'#fff1d585',1.25,at(angle-width,length*.96),at(angle-width*.57,length*.987),at(angle,length));
}
const silhouettes:Readonly<Record<string,readonly [number,number,number,number]>>={
  shii_cho:[10,12,1,1.50], makashi:[8,12,-1,.78], soresu:[12,10,0,1.16], ataru:[8.9,13,-1,1.05],
  djem_so:[12,13,1,1.1], niman:[10,14,0,1.23], juyo:[9,11,1,1.01],
};
function hero(c:C,p:Fighters,own:boolean,time:number,moving:boolean,effects:boolean){
  if(!p.alive){strideMemos.delete(p);return;}
  const tint=colors[p.team], side=Math.cos(p.face)>=0?1:-1, ax=Math.cos(p.face), ay=Math.sin(p.face);
  const sign=Number.isFinite(p.face)?p.face:0;
  const [shoulder,hem,hood,arc]=silhouettes[p.form??'']??silhouettes.shii_cho;
  const rawTime=p.actionTime??0;
  const cut=p.action==='slash'||p.action==='attack', rush=p.action==='rush'||p.action==='lunge', guard=p.action==='guard';
  const dash=rush&&(p.dashRemaining??0)>0, t=effects?rawTime:0, settle=cut?1-smooth(t/.24):rush?1-smooth(t/.33):0;
  const stride=gait(p,time,moving,effects,guard,dash), phase=stride.phase;
  const recoil=cut?Math.sin(Math.PI*clamp(t/.20))*settle:0;
  const dip=guard?3.6:cut?2.5*settle+recoil*2:rush?2.2*settle:moving&&effects?Math.cos(phase*TAU*2)*1.5*stride.pace:0;
  const lead=guard?-2.7:cut?4.6*settle+recoil*2:rush?8.8*settle:moving?2.9*stride.pace:0;
  const seed=idSeed(p.id)%3;
  c.save();c.translate(p.x,p.y);
  ellipse(c,1,6,16,5.5,'#1a1a257a');
  if(own) {
    ellipse(c,0,6,17,8.3,'#382d2255',ink,4.25);
    ellipse(c,0,6,17,8.3,'#00000000',gold,2.1);
  }
  if(dash&&effects)for(const j of [-1,1]){
    const ox=-ay*j*7,oy=ax*j*7;
    line(c,tint+'a2',2,[ox-ax*16,oy-ay*16],[ox-ax*34,oy-ay*34]);}
  if((p.spawnProtectUntil??0)>time)ellipse(c,0,-9,18,16,'#00000000',tint+'8a',1.3);
  c.save();c.lineCap='round';c.lineJoin='round';c.scale(side,1);
  for(const [index,boot] of stride.boots.entries()){
    const sign=index===0?-1:1, hx=sign*4+lead*.37,hy=-9+dip;
    const fx=(boot.point.x-p.x)*side, fy=boot.point.y-p.y;
    drawBoot(c,[hx,hy],[mix(hx,fx,.55)+(guard?3.6:1.9),mix(hy,fy,.53)],[fx,fy],index===1);
  }
  const rib=lead, neck=dip-20, cloth=rib*.34+(dash?-7:0)+(cut?4*settle:0);
  const light=p.team===0?'#8eafa2':'#b78d76', dark=p.team===0?'#476866':'#774f4f';
  poly(c,[[rib-shoulder,neck],[rib-shoulder*.67,neck-3],[rib+shoulder*.7,neck-2],[rib+shoulder,neck+5],
    [rib+5,-9+dip],[cloth+hem,1+dip],[cloth,-1+dip],[cloth-hem,-.4+dip],[rib-5,-11+dip]],dark,ink,2.7);
  poly(c,[[rib-shoulder,neck],[rib-shoulder*.58,neck-3],[rib+shoulder*.68,neck-2],
    [rib+shoulder*.95,neck+4],[rib+1.7,-10+dip],[rib-5,-12+dip]],light,ink,1.1);
  if(own){
    // A pointed commander pauldron plus pale-gold lining reads as
    // silhouette rather than replacing the allied teal team colors.
    poly(c,[[rib-shoulder-2,neck-2],[rib-shoulder*.5,neck-7],[rib+2,neck-1],
      [rib-1,neck+4],[rib-shoulder-3,neck+7]],'#3a5357',ink,1.9);
    line(c,gold,2,[rib-shoulder-2,neck+4],[rib-shoulder*.58,neck-4],[rib,neck-1]);
    poly(c,[[rib-5,neck+4],[rib+1,neck+5],[cloth+8,-2+dip],[cloth+2,1+dip]],
      '#c19b61',ink,1.25);
  }
  const form=p.form??'shii_cho';
  if(form==='soresu'||form==='djem_so'){
    poly(c,[[rib-shoulder-1,neck],[rib-4,neck-4],[rib+2,neck],[rib-3,neck+5],[rib-shoulder,neck+5]],'#90908b',ink,1.5);
    line(c,tint,2,[rib-shoulder+1,neck+2],[rib-5,neck+2]);
  }else if(form==='ataru'||form==='juyo'){
    const tail=rib-(form==='ataru'?14:10)-Math.min(10,lead+4);
    poly(c,[[rib-4,neck-3],[rib+2,neck],[tail,neck+5+(rush?1:5)],[tail+3,neck+1]],tint,ink,1.2);
  }else if(form==='makashi') {
    poly(c,[[rib-5,neck+2],[rib-1,neck+4],[cloth-5,-1+dip],[cloth-8,-3+dip]],'#384351',ink,1.1);
    line(c,tint,2,[rib-3,-17+dip],[cloth+4,-10+dip]);
  }else{
    line(c,tint,2,[rib-3,-17+dip],[rib+4,-11+dip],[cloth+5,-5+dip]);
    if(form==='niman')line(c,'#c1a87d',2,[rib-6,-9+dip],[rib+4,-8+dip]);
  }
  const hx=rib+2, hy=neck-7;
  // Headgear silhouettes at gameplay zoom: armor plate, open hood, or scarf.
  if(hood>0)poly(c,[[hx-7,hy-4],[hx-4,hy-9],[hx+4,hy-9],[hx+8,hy-4],
    [hx+7,hy+4],[hx+1,hy+7],[hx-6,hy+5]],paper,ink,2);
  else ellipse(c,hx,hy,8,7.2,'#e9d5b7',ink,2);
  if(hood===0)poly(c,[[hx-8,hy+1],[hx-8,hy-5],[hx-1,hy-10],[hx+5,hy-8],[hx+8,hy-2],[hx+3,hy-3],[hx-1,hy+4]],dark,ink,1);
  if(hood<0)line(c,tint,2.2,[hx-6,hy-3],[hx+5,hy-5]);
  if(seed===1)line(c,'#9e7862',1,[hx-1,hy-7],[hx+1,hy-4]);
  line(c,ink,1.6,[hx+2,hy-1],[hx+5,hy-1]);
  c.restore();
  // One tracked hilt and tip. On frame zero simulation has already released
  // a slash. Extend then settle; don't imply a pre-contact hit indicator.
  const rest=guard?-1.02:.47;
  const release=cut?-arc*.32:rush?0:rest;
  const finish=cut?arc*.83:rush?.50:rest;
  const turn=cut?mix(release,finish,smooth(t/.09))*(1-smooth((t-.12)/.12))+rest*smooth((t-.12)/.12):
    rush?mix(0,finish,smooth(t/.20)):rest;
  const bladeAngle=sign+turn;
  const handX=side*lead*.55+ax*(guard?6:cut?12+settle*7:rush?14+settle*8:11);
  const handY=(guard?-19:-15)+dip+ay*(guard?5:9)-recoil*2, length=rush?30:guard?25:27+shoulder*.3;
  const tx=handX+Math.cos(bladeAngle)*length,ty=handY+Math.sin(bladeAngle)*length;
  const socket:V=[side*(lead+5.8),-20+dip], elbow:V=[mix(socket[0],handX,.50)-side*(guard?3.9:1),mix(socket[1],handY,.63)+(guard?5:6.6)];
  const grip:V=[handX,handY];
  line(c,ink,6.2,socket,elbow,grip);
  line(c,dark,3.8,socket,elbow);
  line(c,'#baa187',3.4,elbow,grip);
  if(effects&&cut&&t>.015&&t<.11)
    sweepWake(c,handX,handY,bladeAngle,length,arc*.4*Math.sin(Math.PI*t/.123),tint);
  const hiltEnd:V=[handX-Math.cos(bladeAngle)*5,handY-Math.sin(bladeAngle)*5];
  line(c,ink,6.4,hiltEnd,[tx,ty]);
  line(c,tint,3.9,[handX,handY],[tx,ty]);
  line(c,'#fff0c8',1.65,[handX,handY],[tx,ty]);
  ellipse(c,handX,handY,3.7,3.1,paper,ink,1.3);
  c.restore();bar(c,p,own?-43:-40,own?34:28,own);
}
function minion(c:C,p:Unit,effects:boolean){
  if(p.alive===false||p.hp<=0)return;
  const tint=colors[p.team], dir=Math.cos(p.face??(p.team===0?0:Math.PI))>=0?1:-1;
  const step=effects?Math.sin((p.x+p.y)*.115+idSeed(p.id)%100)*1.9:0;
  c.save();c.translate(p.x,p.y);c.scale(dir,1);
  c.lineJoin='round';c.lineCap='round';
  ellipse(c,1,4,10.6,4.1,'#10141bab');
  if(p.rallied)ellipse(c,1,3,13,5,'#0000',gold,2);
  line(c,ink,3.3,[-2,-2],[-4+step,4]);
  line(c,ink,3.3,[3,-2],[4-step,4]);
  if(p.ranged){
    poly(c,[[-8,2],[-5,-11],[2,-12],[7,-1],[4,2]],'#657577',ink,1.6);
    poly(c,[[-7,-11],[-3,-17],[2,-16],[5,-12],[3,-9],[-4,-9]],paper,ink,1.55);
    // Ranged cohorts use the distinct dark bow with a bright string.
    line(c,ink,2,[7,-15],[10,-10],[10,-3],[7,0]);
    line(c,tint,1.6,[7,-15],[7,0]);line(c,'#a4937f',1.6,[2,-8],[8,-8]);
    line(c,tint,2,[-6,-10],[-8,-4]);
  }else{
    poly(c,[[-6,0],[-5,-10],[4,-11],[6,-1]],'#9a8c77',ink,1.45);
    poly(c,[[-6,-12],[-4,-16],[3,-17],[6,-14],[5,-10],[-5,-10]],paper,ink,1.55);
    // A shield with readable shape and an inset stripe on both team colors.
    poly(c,[[3,-11],[10,-9],[10,-4],[6,2],[1,-4],[1,-9]],tint,ink,1.5);
    line(c,'#2d3c42',1.7,[6,-8],[6,-2]);
    line(c,'#f6d7aa9e',1.1,[3,-8],[3,-4],[5,-1]);
  }
  c.restore();
  if(p.hp<p.maxHp)bar(c,p,-21,15);
}
function playerMarker(c:C,p:Fighters,zoom:number){
  const scale=Math.max(.86,Math.min(1.28,2.5/zoom));
  c.save();c.translate(p.x,p.y-53);c.scale(scale,scale);
  // Thin outer ink and bold gold survive at thumb size. Paint this once
  // above depths so same-color allies and own architecture can't hide it.
  poly(c,[[-6,-5],[6,-5],[6,-1],[0,5],[-6,-1]],gold,ink,1.7);
  line(c,goldDeep,1.3,[-3,-2],[0,1],[3,-2]);
  c.restore();
}
function alliedStructureOpacity(place:Unit,core:boolean,own?:Fighters){
  // Only a foreground allied structure that overlaps the hero silhouette
  // fades. Feather the edge so moving past the outline does not blink it.
  // All actors keep the same normal depth order.
  if(!own?.alive||place.team!==own.team||place.hp<=0||own.y>place.y)return 1;
  const edge=(core?54:38)-Math.abs(own.x-place.x), back=place.y-own.y;
  const strength=smooth(edge/6)*smooth(((core?59:51)-back)/7)*smooth(back/5);
  return 1-strength*.67;
}
export function paintMobaField(c:C,terrain:HTMLCanvasElement,state:MobaFieldData,own?:Fighters,
  moving=new Set<Fighters>(),view:{x:number;y:number;zoom:number;width?:number;height?:number}={x:0,y:0,zoom:1},extraEffects=true){
  const viewWidth=view.width??W,viewHeight=view.height??H;
  c.clearRect(0,0,viewWidth,viewHeight);c.save();c.scale(view.zoom,view.zoom);c.translate(-view.x,-view.y);c.drawImage(terrain,0,0);
  const rally=state.bellRally, bell=bellRallyCue(rally,state.tick??0);
  if(rally)forumSeal(c);
  if(bell&&(bell.phase==='open'||bell.phase==='soon')){
    const {x,y}=forum.center, r=BELL_RALLY_RULES.radius;
    c.save(); c.beginPath(); c.arc(x,y,r,0,TAU);c.fillStyle='#e8b62715';c.fill();
    c.strokeStyle='#161719';c.lineWidth=6;c.stroke();
    c.strokeStyle=bell.phase==='open'?gold:'#cdb887';c.lineWidth=2;c.setLineDash([5,5]);c.stroke();
    c.setLineDash([]);
    if(rally?.holder!==null&&rally?.holder!==undefined&&bell.phase==='open'){
      c.beginPath();c.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*rally.heldTicks/BELL_RALLY_RULES.holdTicks);
      c.strokeStyle=colors[rally.holder];c.lineWidth=5;c.stroke();
    }
    c.restore();
  }
  const units=[
    ...state.towers.map((p)=>({p,kind:'tower' as const})),...state.cores.map((p)=>({p,kind:'core' as const})),
    ...state.minions.map((p)=>({p,kind:'minion' as const})),...state.heroes.map((p)=>({p,kind:'hero' as const})),
    ...blockers.map((body,i)=>({p:{x:body.x,y:body.y2},kind:'wall' as const,body,i})),
  ].sort((a,b)=>a.p.y-b.p.y);
  for(const q of units) {
    if(q.kind==='hero')hero(c,q.p,q.p===own,state.time,moving.has(q.p),extraEffects);
    else if(q.kind==='minion')minion(c,q.p,extraEffects);
    else if(q.kind==='wall'){
      const painted=roofCache.get(terrain)?.[q.i];
      if(painted)c.drawImage(painted.canvas,painted.x,painted.y);else wall(c,q.body,q.i);
    }
    else structure(c,q.p,q.kind==='core',alliedStructureOpacity(q.p,q.kind==='core',own));
  }
  if(extraEffects)for(const e of state.events??[]){
    const dt=state.time-e.time,strong=e.type==='tower'||e.type==='core',life=strong?.52:.15;
    if(dt<0||dt>=life||!(strong||e.type==='hit'))continue;
    const k=dt/life; c.save();
    c.globalAlpha=(1-k)*.85;
    const color=strong?'#ffda99':'#ffecd2';
    if(strong){
      for(let i=0;i<7;i++){const a=i*TAU/7+.1, r=mix(10,34,k),x=e.x+Math.cos(a)*r,y=e.y-5+Math.sin(a)*r*.42;
        diamond(c,x,y,2+Math.sin(Math.PI*k)*2,color);}
    }else {
      for(let i=0;i<3;i++)line(c,color,1.8,[e.x+(i-1)*5,e.y-11-7*k],[e.x+(i-1)*12,e.y-14-14*k]);
    }
    c.restore();
  }
  if(own?.alive)playerMarker(c,own,view.zoom);
  c.restore();
  c.save();c.translate(viewWidth-184,viewHeight-79);
  rect(c,0,0,174,69,'#131820e9');
  c.strokeStyle='#ae9773';c.lineWidth=1;c.strokeRect(0,0,174,69);
  const mapPath=(p:Position)=>[p.x/W*170,p.y/H*66] as const;
  for(const p of crossings)line(c,'#788e8674',1,...p.points.map(mapPath));
  for(const p of lanes)line(c,'#cdbb9699',1.1,...p.points.map(mapPath));
  for(const body of blockers){
    const lo=mapPath({x:body.x,y:body.y}), hi=mapPath({x:body.x2,y:body.y2});
    rect(c,lo[0],lo[1],hi[0]-lo[0],hi[1]-lo[1],'#73746a88');
  }
  for(const p of [...state.heroes,...state.towers,...state.cores]){
    if(p.hp<=0)continue;
    const u=p===own?5:3;rect(c,p.x/W*170,p.y/H*66,u,u,p===own?'#ffdc91':colors[p.team]);
  }
  if(bell){const [x,y]=mapPath(forum.center);ellipse(c,x,y,6,5,'#211900',gold,1.5);}
  if(view.zoom>1){c.strokeStyle='#f5db9a';c.strokeRect(view.x/W*174,view.y/H*69,(viewWidth/W)*174/view.zoom,(viewHeight/H)*69/view.zoom);}
  c.restore();
}

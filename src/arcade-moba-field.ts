/** Presentation only: world positions, targeting, cooldowns and effects events
 * are owned by the MOBA simulation. Terrain never edits walkability. */
import {MOBA_BATTLEFIELD} from './arcade-moba-map.js';
const {width:W,height:H,lanes,crossings,blockers,cores,forum}=MOBA_BATTLEFIELD;
const colors=['#75e5d5','#ff8e76'] as const;
const ink='#171b23', paper='#f3ddba', gold='#fbe2a2', goldDeep='#9a623d';
type Side=0|1;
type Position={x:number;y:number};
type Fighters=Position&{team:Side;hp:number;maxHp:number;alive:boolean;face:number;action?:string;actionTime?:number;
  dashRemaining?:number;form?:string;id?:string;name?:string;vx?:number;vy?:number;energy?:number;upgradingUntil?:number;spawnProtectUntil?:number};
type Unit=Position&{team:Side;hp:number;maxHp:number;alive?:boolean;shielded?:boolean;ranged?:boolean;id?:string;face?:number};
export interface MobaFieldData {heroes:readonly Fighters[];minions:readonly Unit[];towers:readonly Unit[];
  cores:readonly Unit[];time:number;events?:readonly (Position&{type:string;time:number;team:Side})[]}
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
  {base:'#675c51',joint:'#4f453e',light:'#bf9872',border:'#483c38'},
  {base:'#878477',joint:'#676257',light:'#c6b797',border:'#514e45'},
  {base:'#566f68',joint:'#354d4d',light:'#a5b8a0',border:'#334744'},
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
      }
    }
    // Faded repair stones along canonical bends read as terrain, not
    // collision rails. The authoritative route starts and ends at these nodes.
    line(c,style.light+'79',2,[3,half-3],[len-2,half-3]);
    c.restore();
  }
  c.restore();
}
function crossing(c:C,p:Path,index:number){
  // Warm compressed stone for the major crossroads; narrow paths at flanks.
  const edge=flank(p,1), inner=flank(p,1.16);
  poly(c,edge,'#43493c','#686958',1.5);
  poly(c,inner,index===1?'#64685b':'#515849');
  c.save();c.clip();
  for(let i=0;i<p.points.length-1;i++){
    const a=p.points[i],b=p.points[i+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));
    for(let x=0;x<d;x+=22)line(c,'#313a356c',1,[x,-p.width*.45],[x+3,p.width*.45]);
    c.restore();
  }
  c.restore();
}
function wall(c:C,w:typeof blockers[number],i:number){
  const rim=coords(w.points), h=i<2?15:10;
  // The bottom polygon is exactly the gameplay blocker, not an invisible
  // grid rectangle; roof perspective projects upward outside the sole.
  poly(c,rim,'#22292c','#1c2026',2);
  const face=(dx:number,dy:number)=>rim.map(([x,y])=>[x+dx,y+dy] as const);
  poly(c,[[w.x,w.y],[w.x,w.y-h],[w.x,w.y2-h],[w.x,w.y2]],'#716258',ink,1.5);
  poly(c,[[w.x,w.y2-h],[w.x2,w.y2-h],[w.x2,w.y2],[w.x,w.y2]],'#70655c',ink,1.7);
  poly(c,face(0,-h),i<2?'#ab8c6e':'#778984',ink,1.7);
  const x=w.x,z=w.x2,y=w.y-h,b=w.y2-h,m=(x+z)/2;
  poly(c,[[x+4,y+5],[z-4,y+5],[z-4,b-5],[x+4,b-5]],
    i<2?'#867465':'#61716b','#d8c0a548',1.15);
  for(let k=1;k<4;k++){
    const xx=mix(x,z,k/4);line(c,'#3a383d',1,[xx,b],[xx,w.y2]);}
  if(i<2){
    // A faceted roof on a block of masonry, not a clickable tower.
    poly(c,[[x+6,y+15],[x+21,y+5],[z-20,y+5],[z-6,y+15],
      [z-15,b-7],[x+15,b-7]],'#61534e','#4d4646',1.3);
    poly(c,[[x+9,y+15],[x+21,y+7],[z-21,y+7],[z-10,y+15],[m,y+20]],'#9a7a64');
    poly(c,[[x+10,y+16],[m,y+20],[z-10,y+16],[z-15,b-8],[x+15,b-8]],'#806d63');
    line(c,'#d2b68f',1.3,[x+9,y+15],[m,y+20],[z-9,y+15]);
    for(let k=0;k<5;k++)line(c,'#4d4344',1,[x+19+k*12,y+26],[x+22+k*11,b-8]);
    ellipse(c,m,b-2,6,1.8,'#392f35');
  }else{
    line(c,'#344c48',3.2,[x+4,b-9],[x+17,b-14],[z-16,b-13],[z-5,b-8]);
    const stone:V[]=[[x+8,y+12],[x+19,y+8],[m-10,y+14],[m+14,y+9],[z-12,y+12]];
    for(const [xx,yy] of stone){
      poly(c,[[xx-4,yy],[xx,yy-4],[xx+6,yy-2],[xx+7,yy+3],[xx-2,yy+5]],'#809081','#57675d',1.1);
      line(c,'#abc09b75',.9,[xx-2,yy-1],[xx+1,yy-3],[xx+5,yy-2]);
    }
    for(let k=0;k<9;k++){
      const tx=x+6+hash(k+i*19)*(z-x-13),ty=b-9+hash(k+99)*3;
      line(c,'#a0a36771',1,[tx,ty],[tx+2,ty-4]);
    }
  }
}
function landscape(c:C){
  const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#473e39');
  sky.addColorStop(.50,'#3a4741');sky.addColorStop(1,'#283e3e');
  c.fillStyle=sky;c.fillRect(0,0,W,H);
  const shelves:readonly (readonly [readonly V[],string])[]=[
    [[[0,0],[421,0],[496,44],[429,82],[343,102],[208,64],[74,92],[0,112]],'#514338'],
    [[[0,0],[268,0],[276,35],[193,37],[105,25],[46,52],[0,55]],'#5e4d3c'],
    [[[816,0],[1280,0],[1280,111],[1159,79],[1091,102],[1008,62],[883,85]],'#514338'],
    [[[832,0],[1163,0],[1217,38],[1160,55],[1130,42],[1095,68],[962,43],[886,63]],'#5a4a3b'],
    [[[0,540],[79,526],[171,616],[289,655],[407,635],[519,674],[736,670],[882,628],[1077,640],[1198,565],
       [1280,535],[1280,720],[0,720]],'#2e4d4b'],
    [[[290,676],[451,649],[582,691],[711,675],[916,643],[1041,658],[1165,622],[1280,651],
       [1280,720],[290,720]],'#355b57'],
  ];
  for(const [way,color] of shelves)poly(c,way,color,'#aba17828',2);
  for(let i=0;i<570;i++){
    const x=hash(i)*W,y=hash(i+557)*H,q=hash(i+101);
    ellipse(c,x,y,1+q*6,.4+q*1.2,i%3?'#d0bc9518':'#0b172033');
  }
  for(const [x,y,w,s] of [[67,250,62,1],[177,415,90,1],[1098,432,90,1],[1209,238,62,1],[356,285,75,1],
      [924,294,94,1],[333,461,58,.8],[930,462,66,.8],[470,642,51,.8],[806,645,61,.8]]){
    const p=(a:number,b:number)=>[x+a*s,y+b*s] as const;
    poly(c,[p(-w,-17),p(-w*.47,-35),p(w*.64,-34),p(w,-12),p(w*.74,21),p(-w*.56,29)],y<330?'#5c5849':'#465d4c','#a19b7328',2);
    for(let j=0;j<28;j++){
      const a=(hash(j+x)-.5)*w*1.45,b=(hash(j+x+90)-.5)*39;
      const z=1+hash(j+x+15)*3.3;
      ellipse(c,x+a,y+b,z,z*.42, j%4?'#8b8a5a':'#a47e59');
      if(j%7===0)line(c,'#404f44',1.2,p(a,b),p(a+3,b-8));
    }
  }
  for(let i=0;i<54;i++){
    const y=618+hash(i+40)*95,x=hash(i+19)*W;
    line(c,'#9dbab17b',.8,[x,y],[x+hash(i)*31+5,y+hash(i+3)*3]);
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
  ellipse(c,x,y,forum.radius+11,forum.radius*.73,'#464a43','#958874',2);
  ellipse(c,x,y,forum.radius,forum.radius*.66,'#81755f','#bdb196',2);
  ellipse(c,x,y,53,32,'#696754','#c5ae8030',1.6);
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
export function paintMobaTerrain():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d')!;
  landscape(c);citadelGround(c);
  crossings.forEach((path,i)=>crossing(c,path,i));
  forumGround(c);lanes.forEach((lane,i)=>road(c,lane,i));forumSeal(c);
  for(const body of blockers)poly(c,coords(body.points),'#222926','#1e2228',2);
  const fade=c.createLinearGradient(0,0,0,H);
  fade.addColorStop(0,'#10131963');fade.addColorStop(.18,'#12162200');
  fade.addColorStop(.82,'#18182200');fade.addColorStop(1,'#1617204e');
  c.fillStyle=fade;c.fillRect(0,0,W,H);
  c.lineWidth=3;c.strokeStyle='#b099765f';c.strokeRect(4,4,W-8,H-8);
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
type StepMemo={x:number;y:number;time:number;s:number};
const strideMemos=new WeakMap<Fighters,StepMemo>();
function gait(p:Fighters,time:number,moving:boolean,effects:boolean){
  if(!effects){strideMemos.delete(p);return 0;}
  const prior=strideMemos.get(p), distance=prior?Math.hypot(p.x-prior.x,p.y-prior.y):0;
  const s=prior&&time>=prior.time&&time-prior.time<.20&&distance<30?(prior.s+distance)%42:0;
  strideMemos.set(p,{x:p.x,y:p.y,time,s});
  return moving&&prior?s/42:0;
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
  const phase=gait(p,time,moving,effects), rawTime=p.actionTime??0;
  const cut=p.action==='slash'||p.action==='attack', rush=p.action==='rush'||p.action==='lunge', guard=p.action==='guard';
  const dash=rush&&(p.dashRemaining??0)>0, t=effects?rawTime:0, settle=cut?1-smooth(t/.24):rush?1-smooth(t/.33):0;
  const dip=guard?2:cut?2.8*settle:rush?2*settle:moving&&effects?Math.cos(phase*TAU*2)*.8:0;
  const lead=guard?-1.8:cut?3*settle:rush?6.5*settle:moving?2.4:0;
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
  // Tangent based stride clock: boots only cycle when screenshots/RAF
  // observe actual movement; contact portion moves heel-to-toe and lifts
  // the free boot. Actors never share a wall clock marching phase.
  for(const j of [-1,1]){
    const k=(phase+(j===1?.5:0))%1;
    const lift=moving&&k>.56?Math.sin(Math.PI*(k-.56)/.44)*5:0;
    const reach=moving?(k<.56?6-12*k/.56:mix(-6,6,smooth((k-.56)/.44))):0;
    const heel=j*4+reach+ax*lead*side*.4, y=4-lift+j*.8;
    line(c,ink,6,[j*4,-8+dip],[heel,y]);
    line(c,j===1?'#bba286':'#786b60',2.6,[heel,y-1],[heel+4,y-1]);
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
  const handX=side*lead*.60+ax*(guard?9:cut?11+settle*7:rush?12+settle*7:12);
  const handY=-15+dip+ay*(guard?7:9), length=rush?30:guard?25:27+shoulder*.3;
  const tx=handX+Math.cos(bladeAngle)*length,ty=handY+Math.sin(bladeAngle)*length;
  line(c,ink,5.5,[side*(lead+5),-18+dip],[handX,handY]);
  line(c,'#81705b',2,[side*(lead+5),-18+dip],[handX,handY]);
  line(c,ink,6,[handX,handY],[tx,ty]);
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
  const units=[
    ...state.towers.map((p)=>({p,kind:'tower' as const})),...state.cores.map((p)=>({p,kind:'core' as const})),
    ...state.minions.map((p)=>({p,kind:'minion' as const})),...state.heroes.map((p)=>({p,kind:'hero' as const})),
    ...blockers.map((body,i)=>({p:{x:body.x,y:body.y2},kind:'wall' as const,body,i})),
  ].sort((a,b)=>a.p.y-b.p.y);
  for(const q of units) {
    if(q.kind==='hero')hero(c,q.p,q.p===own,state.time,moving.has(q.p),extraEffects);
    else if(q.kind==='minion')minion(c,q.p,extraEffects);
    else if(q.kind==='wall')wall(c,q.body,q.i);
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
  if(view.zoom>1){c.strokeStyle='#f5db9a';c.strokeRect(view.x/W*174,view.y/H*69,(viewWidth/W)*174/view.zoom,(viewHeight/H)*69/view.zoom);}
  c.restore();
}

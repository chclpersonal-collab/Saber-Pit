type Ctx=CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
type Rect={x:number;y:number;width:number;height:number;kind:string};
type Stage={id:string;cavern?:HTMLImageElement|null;terrain:{bounds:{minX:number;minY:number;maxX:number;maxY:number};zones?:Rect[]};obstacles:Rect[]};
type Pal=readonly string[];
/** Original stone fortresses and cutaway chambers. Static world backdrop; the regions are passed
 * in by the simulation, never defined by artwork. */
const palettes:Record<string,Pal>={
  three_causeways:['#19292f','#677777','#4a5b5e','#829291','#2e424a','THREE CAUSEWAYS'],
  high_bastion:['#152022','#899080','#676c61','#9c9d82','#414e48','HIGH BASTION'],
  crossroads:['#252123','#827b78','#645d5e','#8b807a','#51494b','CROSSROADS'],
  zigzag:['#272426','#767374','#5b5558','#7d7977','#474246','ZIGZAG'],
  craterfield:['#332a28','#7c6b66','#615451','#82716c','#4f4040','CRATERFIELD'],
  underpit:['#121d22','#48575b','#38464c','#65767a','#29363b','THE UNDERPIT'],
  foundry:['#2c2424','#77706c','#605655','#7b6f68','#463936','THE FOUNDRY'],
  ember_ring:['#1d1c2c','#5c4c63','#4b435a','#8c787f','#332f46','EMBER RING'],
};
const shape=(c:Ctx,points:readonly (readonly number[])[],fill:string|null,stroke:string|null=null,n=1)=>{
  c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=n;c.stroke();}
};
const box=(c:Ctx,x:number,y:number,w:number,h:number,fill:string|CanvasGradient)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
const line=(c:Ctx,x:number,y:number,xx:number,yy:number,stroke:string,n=1)=>{c.strokeStyle=stroke;c.lineWidth=n;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();};
const stroke=(c:Ctx,x:number,y:number,w:number,h:number,color:string,n=1)=>{c.strokeStyle=color;c.lineWidth=n;c.strokeRect(x,y,w,h);};
const rng=(seed:number)=>()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
const hash=(id:string)=>[...id].reduce((v,k)=>Math.imul(v,31)+k.charCodeAt(0)|0,1);
const label=(c:Ctx,text:string,x:number,y:number,color='#a6a6a0',size=10,align:CanvasTextAlign='left')=>{
  c.fillStyle=color;c.font=`800 ${size}px ui-monospace, monospace`;c.textAlign=align;c.textBaseline='middle';c.fillText(text,x,y);
};
function lantern(c:Ctx,x:number,y:number,wide:boolean){
  if(wide){
    const shade=c.createRadialGradient(x,y,1,x,y,34);
    shade.addColorStop(0,'#e7a06b5e');shade.addColorStop(1,'#e7a06b00');
    box(c,x-34,y-34,68,68,shade);
  }
  line(c,x,y-12,x,y-6,'#231c1c',2);
  shape(c,[[x-7,y-6],[x+7,y-6],[x+5,y+6],[x-5,y+6]],'#aa7255','#292021',2);
  box(c,x-2,y-3,4,7,'#edb785');line(c,x-3,y-5,x-2,y+5,'#49372f',1.2);
}
function masonry(c:Ctx,wall:string,w:number,h:number,key:string){
  box(c,0,0,w,h,wall);
  const r=rng(hash(key));
  for(let y=3,i=0;y<h;y+=21,i++){
    line(c,0,y,w,y,'#26232784',1.6);
    for(let x=-(i%2)*32;x<w;x+=64){
      const j=x+Math.round(r()*7);
      line(c,j,y,j-1,y+19,'#27232778',1.45);
      if(r()>.47)line(c,j+8,y+2,j+37+r()*18,y+2,'#b3a69b25',1.8);
    }
  }
}
function arch(c:Ctx,x:number,base:number,w:number,h:number,block=true){
  const y=base-h;
  const points=[[x,base],[x,y+h*.36],[x+w*.13,y+h*.12],[x+w*.38,y],[x+w*.62,y],
    [x+w*.87,y+h*.12],[x+w,y+h*.36],[x+w,base]];
  shape(c,points,block?'#302a2b':'#211e23','#2b2527',2.8);
  for(const [i,[px,py]] of points.entries())if(i>0&&i<points.length-1){
    const dx=(x+w*.5-px)*.13,dy=i===1||i===6?0:5;
    line(c,px-dx,py-dy,px+dx,py+dy,'#94877e',2);
  }
  if(block){
    for(let i=9;i<w;i+=12)line(c,x+i,y+h*.33,x+i,base-1,'#65544d',2.1);
    line(c,x+4,y+h*.69,x+w-4,y+h*.69,'#8f7969',2.4);
  }
}
function architecture(c:Ctx,stage:Stage,w:number,h:number,minY:number){
  const {id}=stage, y=Math.max(24,minY), mid=w*.5;
  c.save();c.beginPath();c.rect(0,0,w,y);c.clip();
  if(id==='ember_ring'){
    // A city below, not an inside wall. Silhouettes stay above the real combat boundary.
    const sky=c.createLinearGradient(0,0,0,y);
    sky.addColorStop(0,'#1d2140');sky.addColorStop(.55,'#514060');sky.addColorStop(1,'#b47867');
    box(c,0,0,w,y,sky);
    const sunX=w*.69,sunY=y*.435,sunRadius=y*.22;
    const bloom=c.createRadialGradient(sunX,sunY,sunRadius*.15,sunX,sunY,sunRadius*2.75);
    bloom.addColorStop(0,'#ffdb9d73');bloom.addColorStop(1,'#ffab7000');
    box(c,sunX-sunRadius*3,0,sunRadius*6,y,bloom);
    c.beginPath();c.arc(sunX,sunY,sunRadius,0,Math.PI*2);c.fillStyle='#f1b788';c.fill();
    shape(c,[[0,y*.67],[w*.12,y*.47],[w*.25,y*.69],[w*.36,y*.53],[w*.49,y*.74],
      [w*.62,y*.60],[w*.74,y*.71],[w*.90,y*.43],[w,y*.57],[w,y],[0,y]],'#554255');
    const r=rng(413);
    for(const depth of [0,1]) {
      for(let x=-w*.02;x<w;){
        const bw=w*(.012+r()*.026), roof=y*(.052+r()*.10), top=y*(.47+depth*.17+r()*.22), cx=x+bw*.5;
        const fill=depth?'#262438':'#403448';
        shape(c,[[x-bw*.1,top],[cx-bw*.08,top-roof],[cx+bw*.08,top-roof],[x+bw*1.1,top],[x+bw,top],[x+bw,y],[x,y],[x,top]],fill);
        if(depth && r()>.25) box(c,cx-bw*.075,top+y*.055,bw*.15,y*.08,'#db9266');
        x+=bw*(.77+r()*.55);
      }
    }
    // Far citadel above the city roofline.
    const keep=w*.33, ky=y*.68;
    for(const [offset,scale] of [[-.047,.69],[.002,1],[.05,.60]]){
      const x=keep+offset*w, bw=w*.024, top=ky-y*.53*scale;
      shape(c,[[x-bw*.66,ky],[x-bw*.61,top+y*.10],[x,top],[x+bw*.61,top+y*.10],[x+bw*.62,ky]],'#29263d');
      line(c,x,top-y*.075,x,top,'#29263d',1.5);
      box(c,x-bw*.055,top+y*.19,bw*.11,y*.075,'#d08164');
    }
    const ledge=y*.93;
    box(c,0,ledge,w,y-ledge,'#1b1c2b');
    line(c,0,ledge,w,ledge,'#95706877',Math.max(1,y*.011));
    const battlement=w*.105;
    for(let x=-battlement*.13;x<w;x+=battlement){
      const q=x+battlement*.26, ramp=y*.057;
      shape(c,[[x,ledge],[x,ledge-ramp],[q,ledge-ramp],[q+y*.038,ledge],[q,ledge+y*.016],[x,ledge+y*.016]],'#333047');
      line(c,x,ledge-ramp,q,ledge-ramp,'#756175',Math.max(1,y*.01));
    }
  }else if(id==='foundry'){
    masonry(c,'#595053',w,y,id);
    for(let x=-33;x<w+84;x+=176){
      arch(c,x+36,y+2,105,y*.82,false);
      line(c,x,6,x+104,y*.80,'#332522',8);
      line(c,x,6,x+104,y*.80,'#83675b',2);
      lantern(c,x+155,y*.46,true);
    }
  }else if(id==='underpit'){
    box(c,0,0,w,y,'#14232a');
    if(stage.cavern){
      const art=stage.cavern, ih=Math.min(art.naturalHeight,art.naturalWidth*y/w);
      c.globalAlpha=.72;
      c.drawImage(art,0,0,art.naturalWidth,ih,0,0,w,y);
      c.globalAlpha=1;
    }
    const haze=c.createLinearGradient(0,0,0,y);
    haze.addColorStop(0,'#10222a1a');haze.addColorStop(1,'#131d26c0');
    box(c,0,0,w,y,haze);
    const panel=Math.max(190,w*.22);
    for(let x=-panel*.48,i=0;x<w;x+=panel,i++){
      const k=x+panel*.16;
      shape(c,[[k,0],[k+19,0],[k+26,y],[k-7,y]],'#162429','#496265',1.4);
      line(c,k+2,0,k-3,y,'#66838555',1.6);
      arch(c,x+panel*.28,y+3,panel*.57,y*.70,false);
    }
    line(c,0,y-5,w,y-5,'#78a7a8aa',1.5);
    arch(c,mid-59,y+4,118,y*.86,true);
    for(const [i,t] of [.18,.36,.64,.82].entries())lantern(c,w*t,y*(i%2?.47:.53),true);
  }else if(id==='craterfield'){
    box(c,0,0,w,y,'#75625c');
    for(let x=-9,i=0;x<w;x+=130,i++){
      const top=y*(.28+i%3*.14);
      shape(c,[[x,top+15],[x+8,top],[x+39,top],[x+43,top+9],[x+88,top+5],[x+107,top+17],[x+122,y],[x,y]],'#584b49','#372e30',2);
      line(c,x+10,top+20,x+101,top+22,'#97817750',2);
    }
  }else{
    masonry(c,id==='zigzag'?'#605c64':'#747071',w,y,id);
    const stride=id==='zigzag'?136:156;
    for(let x=3,i=0;x<w;x+=stride,i++){
      if(id==='crossroads'||i%2===0)arch(c,x,y,68,y*.76,id==='zigzag');
      else {
        box(c,x-7,y*.18,76,y*.82,'#69514b');
        for(let j=x;j<x+65;j+=13)line(c,j,y*.22,j-1,y,'#9a7360',2);
        line(c,x,y*.85,x+61,y*.26,'#332826',4);
      }
      lantern(c,x+stride*.73,y*.56,true);
    }
  }
  line(c,0,y-3,w,y-3,'#382e30',3);c.restore();
}
function floor(c:Ctx,stage:Stage,w:number,h:number,pal:Pal){
  const {minX:x,minY:y,maxX:xx,maxY:yy}=stage.terrain.bounds;
  const gx=xx-x,gy=yy-y, r=rng(hash(stage.id));
  const f=c.createLinearGradient(0,y,0,yy);f.addColorStop(0,pal[1]);f.addColorStop(.62,pal[2]);f.addColorStop(1,pal[4]);
  box(c,x,y,gx,gy,f);
  c.save();c.beginPath();c.rect(x,y,gx,gy);c.clip();
  // Long, offset rows read like a hand-ruled stone set. Each fixture or
  // hazard still comes from the actual terrain below, not from these marks.
  for(let py=y+42,row=0;py<yy;row++){
    const depth=(py-y)/gy, rise=34+depth*37, stride=157+depth*49;
    line(c,x,py,xx,py,'#22202046',1.35);
    if(row%2===0)line(c,x,py+2,xx,py+2,'#c2afa627',1);
    for(let q=x-(row%2)*65;q<xx;q+=stride){
      const joint=q+17+r()*17;
      line(c,joint,py+1,joint+(joint-w*.5)*.023,Math.min(yy,py+rise),'#24212129',1.25);
    }
    py+=rise;
  }
  const pool=c.createRadialGradient(w*.5,y+gy*.43,13,w*.5,y+gy*.43,Math.min(gx*.46,gy*.83));
  pool.addColorStop(0,'#e7baa128');pool.addColorStop(1,'#e7baa100');box(c,x,y,gx,gy,pool);
  for(let i=0;i<210;i++){
    const xx=x+r()*gx, yy=y+r()*gy;
    box(c,xx,yy,1+r()*4,1+r(),i%3?'#1014182b':'#c3c2b229');
  }
  if(stage.id==='three_causeways'){
    for(const [i,center] of [375,765,1135].entries()){
      const py=h*center/1350;
      box(c,x,py-23,gx,46,'#b0b9a22d');
      line(c,x,py-25,xx,py-25,'#203539a4',3);
      line(c,x,py+25,xx,py+25,'#cbd1aa58',2);
      for(let q=x+28;q<xx-20;q+=63)line(c,q,py,q+22,py,'#e2dab469',2);
      label(c,['NORTH','LOCK','SOUTH'][i],x+30,py-8,'#ded9b1aa',13);
      label(c,['NORTH','LOCK','SOUTH'][i],xx-30,py-8,'#ded9b1aa',13,'right');
    }
  }
  if(stage.id==='high_bastion'){
    // Mark the three true ground routes without painting any phantom cover.
    for(const t of [.075,.49,.94]){
      const py=y+gy*t;
      box(c,x,py-16,gx,32,'#c4b28e1f');
      line(c,x,py-17,xx,py-17,'#343f3677',2);
      line(c,x,py+17,xx,py+17,'#d0c9a649',2);
    }
  }
  if(stage.id==='crossroads'){
    for(const a of [.16,.50,.84]){
      const py=y+a*gy;
      line(c,x,py,xx,py,'#5f64653f',29);line(c,x,py-15,xx,py-15,'#9e9f9447',1.5);line(c,x,py+15,xx,py+15,'#12161664',2);
      for(let q=x+30;q<xx-20;q+=44)line(c,q,py,q+18,py,'#adb0a657',2);
    }
    for(const a of [.23,.76]){const px=x+gx*a;line(c,px,y,px,yy,'#a2a39a4a',2);}
  } else if(stage.id==='zigzag'){
    for(const [i,a] of [.12,.31,.53,.72,.89].entries()){
      const py=y+a*gy, k=x+gx*(.17+i*.027);
      const path:[number,number][]=[[x,py],[k,py],[k+gx*.19,py-gy*.106],[xx-gx*.19,py-gy*.106],[xx,py+gy*.025]];
      for(let n=1;n<path.length;n++){line(c,...path[n-1],...path[n],'#24242879',13);line(c,...path[n-1],...path[n],'#8c8a8758',1.35);}
    }
  } else if(stage.id==='craterfield'){
    for(let i=0;i<33;i++){const px=x+r()*gx,py=y+r()*gy,a=(r()-.55)*91,b=(r()-.48)*49;
      line(c,px,py,px+a,py+b,'#242023d0',1.5);line(c,px+a,py+b,px+a*1.28,py+b*1.85,'#2020248c',1);
    }
  } else {
    const cx=w*.5, cy=y+gy*.52;
    if(stage.id==='underpit'){
      const q=Math.min(gx/850,gy/460);
      for(const d of [101,135]){c.beginPath();c.ellipse(cx,cy,d*gx/850,d*.49,0,0,Math.PI*2);c.strokeStyle=d===101?'#bbb5a051':'#25202165';c.lineWidth=d===101?1.8:1.2;c.stroke();}
      const at=(points:number[][])=>points.map(([px,py])=>[cx+q*px,cy+q*py]);
      shape(c,at([[0,-28],[38,-18],[34,10],[0,30],[-34,10],[-38,-18]]),'#4f4b4b40','#c5b6914f',2);
      for(const d of [-1,1]){
        line(c,cx+d*17*q,cy+16*q,cx-d*22*q,cy-14*q,'#d7c1964c',2.6);
        line(c,cx+d*7*q,cy+13*q,cx+d*19*q,cy+4*q,'#d7c1964c',1.6);
        line(c,cx+d*121,cy,cx+d*gx*.48,cy,'#787d7d63',2);
      }
    }else if(stage.id==='foundry'){
      for(const p of [.20,.80]){
        const q=x+gx*p;box(c,q-9,y,18,gy,'#25282c80');line(c,q-12,y,q-12,yy,'#8b8c846c',2);line(c,q+12,y,q+12,yy,'#8b8c846c',2);
        for(let k=y+10;k<yy;k+=23)line(c,q-10,k,q+10,k,'#17191c74',2);
      }
      stroke(c,cx-gy*.16,cy-gy*.12,gy*.32,gy*.24,'#a5a3985d',3);
    }else if(stage.id==='ember_ring'){
      // Decorative stone inlay only, deliberately faint so it cannot read as an attack marker.
      const halo=c.createRadialGradient(cx,y,1,cx,y,gy*.74);
      halo.addColorStop(0,'#fcbb7835');halo.addColorStop(1,'#fcbb7800');
      box(c,x,y,gx,gy,halo);
      const inset=Math.min(gx*.021,gy*.052);
      line(c,x+inset,y+inset,xx-inset,y+inset,'#cf9b745c',2);
      line(c,x+inset,yy-inset,xx-inset,yy-inset,'#a6867f57',2);
      for(const edge of [x+inset,xx-inset])line(c,edge,y+inset,edge,yy-inset,'#9c808861',2);
      for(const p of [-1,1]){
        const ex=cx+p*gx*.43, ey=y+gy*.27, size=Math.min(gx*.022,gy*.058);
        shape(c,[[ex,ey-size],[ex+size,ey],[ex,ey+size],[ex-size,ey]],'#a0837520','#cb9a774c',1.5);
      }
    }else{
      line(c,x+15,y+23,xx-15,y+23,'#a6959373',2);line(c,x+15,yy-31,xx-15,yy-31,'#a6959373',2);
      for(const p of [-1,1]){const q=cx+p*gx*.30;stroke(c,q-46,cy-38,92,76,'#9c8b875d',2);line(c,q-25,cy,q+25,cy,'#9c8b8783',2);}
      shape(c,[[cx,cy-48],[cx+58,cy],[cx,cy+48],[cx-58,cy]],null,'#a58c8d70',2);
    }
  }
  c.restore();
  for(const z of stage.terrain.zones??[])drawZone(c,z,pal);
  for(const o of stage.obstacles){box(c,o.x-2,o.y,o.width+5,o.height+4,'#10101280');paintCompoundObstacle(c,stage,o);}
  stroke(c,x+.5,y+.5,gx-1,gy-1,'#85877a85',1.7);
  for(const py of [y+3,yy-7])for(const px of [x+4,xx-42])line(c,px,py,px+38,py,'#c4b7a179',2);
}
function drawZone(c:Ctx,z:Rect,pal:Pal){
  const {x,y,width:w,height:h}=z, vent=z.kind==='hazard';
  box(c,x,y,w,h,vent?'#441a21':'#20242948');
  stroke(c,x,y,w,h,vent?'#f38d84':'#a5a6a052',vent?2:1);
  if(vent){
    line(c,x,y+3,x+w,y+3,'#ea976b9f',2);
    line(c,x,y+h-3,x+w,y+h-3,'#ea976b9f',2);
    for(let i=x+6;i<x+w-4;i+=12)line(c,i,y+7,i,y+h-7,'#fb736a65',2);
    line(c,x+5,y+h*.52,x+w-5,y+h*.52,'#f9968a',1.6);
  }else{
    for(let yy=y+7;yy<y+h;yy+=10)for(let xx=x+5;xx<x+w-5;xx+=16)
      line(c,xx,yy,xx+4,yy-2,'#b5aea450',1);
  }
}
export function paintCompoundObstacle(c:Ctx,stage:Stage,rect:Rect){
  const {x,y,width:w,height:h}=rect, [,,,stone,stoneSide]=palettes[stage.id]??palettes.crossroads;
  const cap=rect.kind==='wall'?stone:'#846659',side=rect.kind==='wall'?stoneSide:'#514038';
  const raised=rect.kind==='wall'?Math.min(16,h*.58):Math.min(9,h*.47);
  c.save();
  shape(c,[[x,y],[x+3,y-raised],[x+w-1,y-raised],[x+w,y+h-raised],[x+1,y+h-raised]],cap,'#161719',2);
  box(c,x,y+h-raised,w,raised,side);stroke(c,x+.5,y+h-raised,w-1,raised,'#161719',1.6);
  line(c,x+2,y-raised+2,x+w-4,y-raised+2,'#9b9a9070',1.4);
  line(c,x+3,y+h-raised-1,x+w-4,y+h-raised-1,'#9999917f',1);
  if(rect.kind==='wall'){
    for(let d=9;d<w-6;d+=24){line(c,x+d,y-raised+4,x+d,y+h-raised-2,'#22252950',1);box(c,x+d-1,y+h-5,3,2,'#6c6f70');}
    if(w>38)line(c,x+w-20,y+h-5,x+w-12,y+h-5,'#9e9388',1.4);
  }else{
    for(let n=7;n<w-5;n+=14)line(c,x+n,y-raised+3,x+n,y+h-raised-3,'#5d473c',1.2);
    line(c,x+4,y+h-raised-2,x+w-4,y-raised+3,'#b18e72',2);
  }
  c.restore();
}
export function paintCompound(c:Ctx,stage:Stage,w:number,h:number){
  const pal=palettes[stage.id]??palettes.crossroads, {minX,minY,maxX}=stage.terrain.bounds;
  c.save();
  box(c,0,0,w,h,pal[0]);
  architecture(c,stage,w,h,minY);
  box(c,minX-10,minY-5,maxX-minX+20,8,'#0e1113');
  floor(c,stage,w,h,pal);
  if(stage.id==='ember_ring'){c.restore();return;}
  const pl=Math.max(8,minY*.47), ww=Math.min(198,w*.25);
  box(c,w*.5-ww*.5,pl-9,ww,18,'#151719');
  stroke(c,w*.5-ww*.5,pl-9,ww,18,'#86868477',1);
  lantern(c,w*.5-ww*.5+12,pl,false);lantern(c,w*.5+ww*.5-12,pl,false);
  label(c,pal[5],w*.5,pl,'#d4d1c7',11,'center');
  c.restore();
}
export function animateCompound(c:Ctx,stage:Stage,w:number,h:number,time:number){
  const {minX,minY,maxX,maxY}=stage.terrain.bounds;
  c.save(); c.fillStyle='#e9a16d';
  for(const [i,ax] of (stage.id==='ember_ring'?[]:[.12,.29,.71,.88]).entries()){
    c.globalAlpha=.20+.42*(.5+.5*Math.sin(time*2+i*.8));
    c.fillRect(w*ax,Math.max(6,minY*.63),4,2);
  }
  if(stage.id==='craterfield'){
    for(const z of stage.terrain.zones??[])if(z.kind==='hazard')for(let i=0;i<4;i++){
      const p=(time*.49+i*.23)%1;
      c.globalAlpha=.42*(1-p);c.fillRect(z.x+z.width*(.15+i*.23),z.y+z.height*.5-p*19,2,2);
    }
  } else if(['ember_ring','foundry'].includes(stage.id)){
    for(let i=0;i<9;i++){
      const xx=minX+((i*127.46+time*(4+i%3*2))%(maxX-minX));
      const yy=minY+(i*53.17)%Math.max(1,maxY-minY);
      c.globalAlpha=.13+.13*Math.sin(time+i)**2;c.fillRect(xx,yy,2,i%3===0?2:1);
    }
  }
  c.restore();
}

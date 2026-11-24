const W=1280,H=720;
const lanes=[165,360,555];
const colors=['#70e4d0','#fa8a71'] as const;
type Side=0|1;
type Position={x:number;y:number};
type Fighters=Position&{team:Side;hp:number;maxHp:number;alive:boolean;face:number;action?:string;actionTime?:number;dashRemaining?:number};
type Unit=Position&{team:Side;hp:number;maxHp:number;alive?:boolean;shielded?:boolean};
export interface MobaFieldData {heroes:readonly Fighters[];minions:readonly Unit[];towers:readonly Unit[];cores:readonly Unit[];time:number;events?:readonly (Position&{type:string;time:number;team:Side})[]}
export function paintMobaTerrain():HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d')!;
  const gradient=c.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#213833');gradient.addColorStop(.5,'#1a2b2b');gradient.addColorStop(1,'#101e21');
  c.fillStyle=gradient;c.fillRect(0,0,W,H);
  const grain=(i:number)=>(((Math.imul(i+1,2654435761)>>>0)%1009)/1009);
  for(let i=0;i<2000;i++){const x=grain(i)*W,y=grain(i+1221)*H;c.fillStyle=i%2?'#ffffff07':'#00000012';c.fillRect(x,y,2+grain(i+717)*5,1);}
  // Courtyards and vegetation sit between rather than obscuring movement lanes.
  for(let row=0;row<2;row++)for(let k=0;k<12;k++){
    const x=155+k*88,y=262+row*194+(grain(k+row*44)-.5)*38;
    c.fillStyle='#121d21';c.beginPath();c.ellipse(x+4,y+17,38,29,.3,0,Math.PI*2);c.fill();
    c.fillStyle=k%3===0?'#385044':'#283932';c.beginPath();c.ellipse(x,y,34,27,.3,0,Math.PI*2);c.fill();
    c.strokeStyle='#61776666';c.lineWidth=2;c.beginPath();c.ellipse(x,y,27,20,.3,3.35,5.3);c.stroke();
  }
  for(let i=0;i<lanes.length;i++){
    const y=lanes[i];
    c.strokeStyle='#0f171a';c.lineWidth=91;c.beginPath();c.moveTo(108,y);c.lineTo(1172,y);c.stroke();
    c.strokeStyle='#495956';c.lineWidth=75;c.stroke();c.strokeStyle='#374645';c.lineWidth=66;c.stroke();
    c.strokeStyle='#8da28d55';c.lineWidth=1;c.setLineDash([7,21]);c.stroke();c.setLineDash([]);
    for(let x=130;x<1160;x+=51){c.strokeStyle='#1c2729';c.beginPath();c.moveTo(x,y-30);c.lineTo(x+9,y+30);c.stroke();}
    c.fillStyle='#e1e8d394';c.font='700 13px monospace';c.textAlign='center';c.fillText(['I / NORTH','II / CENTER','III / SOUTH'][i],W/2,y-45);
  }
  for(const side of [0,1] as const){
    const x=side===0?72:1208; const color=colors[side];
    c.strokeStyle=color;c.globalAlpha=.36;c.lineWidth=2;c.beginPath();c.moveTo(x,82);c.lineTo(x,636);c.stroke();
    c.fillStyle=color;c.globalAlpha=.07;c.fillRect(x-46,86,92,546);c.globalAlpha=1;
  }
  c.lineWidth=3;c.strokeStyle='#81816b';c.strokeRect(4,4,W-8,H-8);
  return canvas;
}
function bar(c:CanvasRenderingContext2D,p:Unit,dy:number,w:number){
  c.fillStyle='#070d12';c.fillRect(p.x-w/2-1,p.y+dy-1,w+2,6);
  c.fillStyle=colors[p.team];c.fillRect(p.x-w/2,p.y+dy,w*Math.max(0,Math.min(1,p.hp/p.maxHp)),4);
}
function structure(c:CanvasRenderingContext2D,p:Unit,core:boolean){
  const color=colors[p.team],s=core?34:23;
  c.save();c.translate(p.x,p.y);
  c.fillStyle='#090e14a0';c.beginPath();c.ellipse(0,5,s+14,s*.58,0,0,Math.PI*2);c.fill();
  c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;c.lineTo(Math.cos(a)*s,Math.sin(a)*s*.66);}c.closePath();
  c.fillStyle=p.hp>0?'#253e40':'#172022';c.fill();c.strokeStyle=p.hp>0?color:'#56615e';c.lineWidth=2;c.stroke();
  if(p.hp>0){
    c.fillStyle=color;c.shadowColor=color;c.shadowBlur=core?17:9;
    c.beginPath();c.moveTo(0,-s-8);c.lineTo(s*.43,-13);c.lineTo(0,1);c.lineTo(-s*.43,-13);c.closePath();c.fill();
    c.shadowBlur=0;c.fillStyle='#17252a';c.fillRect(-4,-16,8,8);
  }
  if(core&&p.shielded&&p.hp>0){c.strokeStyle=color+'78';c.lineWidth=1.5;c.setLineDash([4,6]);c.beginPath();c.ellipse(0,-8,s+12,s+3,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  c.restore();if(p.hp>0)bar(c,p,-s-13,s*1.65);
}
function hero(c:CanvasRenderingContext2D,p:Fighters,own:boolean,time:number,moving:boolean,effects:boolean){
  if(!p.alive)return;
  const color=colors[p.team],ax=Math.cos(p.face),ay=Math.sin(p.face);
  const step=moving?Math.sin(time*18)*4:0;
  c.save();c.translate(p.x,p.y);
  c.fillStyle='#0008';c.beginPath();c.ellipse(1,9,22,10,0,0,Math.PI*2);c.fill();
  if(effects&&p.dashRemaining&&p.dashRemaining>0){
    c.strokeStyle=color+'9f';c.lineWidth=3;
    for(const j of [-1,1]){const ox=-ay*j*5,oy=ax*j*5+3;c.beginPath();c.moveTo(ox-ax*13,oy-ay*13);c.lineTo(ox-ax*31,oy-ay*31);c.stroke();}
  }
  if(own){c.strokeStyle='#fff2c9';c.lineWidth=2;c.beginPath();c.ellipse(0,8,20,9,0,0,Math.PI*2);c.stroke();}
  c.lineCap='round';c.strokeStyle='#0a131b';c.lineWidth=7;
  for(const s of [-1,1]){c.beginPath();c.moveTo(s*6,-4);c.lineTo(s*(7+step*.26),8+step*s);c.stroke();}
  c.fillStyle=color;c.beginPath();c.moveTo(-12,-5);c.lineTo(-8,-20);c.lineTo(9,-20);c.lineTo(12,-5);c.closePath();c.fill();
  c.fillStyle='#121e27';c.beginPath();c.arc(0,-23,9,0,Math.PI*2);c.fill();
  c.strokeStyle='#f9e8b7';c.lineWidth=2;c.beginPath();c.moveTo(-4+ax*3,-23+ay*2);c.lineTo(4+ax*3,-23+ay*2);c.stroke();
  const action=p.action??'',t=p.actionTime??0;
  const guard=action==='guard',attack=['slash','attack','lunge','rush','strike','dash'].includes(action);
  const bearing=p.face+(!attack?(guard?-.6:.35):1.25-2.50*Math.max(0,Math.min(1,t/.26)));
  const sx=ax*10,sy=-13+ay*7, length=action==='lunge'||action==='rush'?35:28;
  c.strokeStyle=color;c.lineWidth=8;c.globalAlpha=.45;c.shadowColor=color;c.shadowBlur=9;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+Math.cos(bearing)*length,sy+Math.sin(bearing)*length);c.stroke();
  c.globalAlpha=1;c.shadowBlur=0;c.strokeStyle='#f1fff9';c.lineWidth=2;c.stroke();
  c.restore();bar(c,p,-36,33);
}
export function paintMobaField(c:CanvasRenderingContext2D,terrain:HTMLCanvasElement,state:MobaFieldData,own?:Fighters,moving=new Set<Fighters>(),view={x:0,y:0,zoom:1},extraEffects=true){
  c.clearRect(0,0,W,H);c.save();c.scale(view.zoom,view.zoom);c.translate(-view.x,-view.y);c.drawImage(terrain,0,0);
  for(const p of state.towers)structure(c,p,false);for(const p of state.cores)structure(c,p,true);
  for(const p of state.minions){if(p.alive===false||p.hp<=0)continue;c.fillStyle='#091111';c.fillRect(p.x-6,p.y-6,12,12);c.fillStyle=colors[p.team];c.fillRect(p.x-4,p.y-4,8,8);}
  for(const p of [...state.heroes].sort((a,b)=>a.y-b.y))hero(c,p,p===own,state.time,moving.has(p),extraEffects);
  // Existing contact and break events drive the restrained feedback.
  if(extraEffects)for(const e of state.events??[]){
    const dt=state.time-e.time,strong=e.type==='tower'||e.type==='core',life=strong?.50:.17;
    if(dt<0||dt>=life||!(strong||e.type==='hit'))continue;
    const k=dt/life;c.globalAlpha=(1-k)*(strong?.82:.48);
    c.strokeStyle=strong?'#ffe198':colors[e.team];c.lineWidth=strong?3:2;
    c.beginPath();c.ellipse(e.x,e.y-7,6+k*(strong?39:18),5+k*(strong?22:11),0,0,Math.PI*2);c.stroke();
  }
  c.restore();
  // Keep the tactical locator outside the click logic; it is an orientation aid.
  c.save();c.translate(W-194,H-90);c.fillStyle='#081317ec';c.fillRect(0,0,174,73);c.strokeStyle='#557579';c.strokeRect(0,0,174,73);
  c.strokeStyle='#8a9d9466';for(const y of lanes){c.beginPath();c.moveTo(8,y/H*73);c.lineTo(166,y/H*73);c.stroke();}
  for(const p of [...state.heroes,...state.towers,...state.cores]){if(p.hp<=0)continue;c.fillStyle=p===own?'#fff2c9':colors[p.team];c.fillRect(p.x/W*170,p.y/H*70,p===own?5:3,p===own?5:3);}
  if(view.zoom>1){c.strokeStyle='#f7e8bd';c.strokeRect(view.x/W*174,view.y/H*73,174/view.zoom,73/view.zoom);}
  c.restore();
}

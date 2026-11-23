// @ts-nocheck
const bound=(n,min,max)=>Math.max(min,Math.min(max,n));
const overlaps=(a,b)=>Math.abs(a.x-b.x)<44&&Math.abs(a.y-b.y)<20;

// Pure screen-space placement. Only deployed, still-active Saved Heroes have
// the simulation's heroId; a name, Elo, or rank alone never earns a badge.
export function arcadeHeroMarkers(poses,tx,width,height,pixelScale=1){
  const points=[];
  if(width<54||height<48)return points;
  const floor=24,ceil=height-12,top=Math.min(66,height*.33);
  for(const {pose,anchor} of poses){
    if(!pose.alive||!pose.heroId||!Number.isFinite(anchor?.x)||!Number.isFinite(anchor?.y))continue;
    const x=(anchor.x*tx.scale+tx.x)/pixelScale;
    const y=(anchor.y*(tx.scaleY??tx.scale)+tx.y)/pixelScale;
    if(x< -18||x>width+18||y< -18||y>height+18)continue;
    const start={x:bound(x,floor,width-floor),y:bound(y-11,top,ceil)};
    const candidates=[start,...[[-45,0],[45,0],[0,-21],[0,21],[-45,-21],[45,-21]].map(([dx,dy])=>
      ({x:bound(start.x+dx,floor,width-floor),y:bound(start.y+dy,top,ceil)}))];
    const position=candidates.find(p=>!points.some(q=>overlaps(p,q)))??start;
    points.push({...position,team:pose.team,id:pose.id,anchorX:x,anchorY:y});
  }
  return points;
}

export function drawArcadeHeroMarkers(ctx,points,pixelScale){
  if(!points.length)return;
  ctx.save();ctx.setTransform(pixelScale,0,0,pixelScale,0,0);
  ctx.font='800 10px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const {x,y,team,anchorX,anchorY} of points){
    const color=team===1?'#ffc1cf':'#95f6ee';
    if(Math.abs(x-anchorX)>3||Math.abs(y-anchorY)>15){
      ctx.beginPath();ctx.moveTo(x,y+7);ctx.lineTo(anchorX,anchorY+1);
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
    }
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(x-20,y-8,40,16,4);
    else ctx.rect(x-20,y-8,40,16);
    ctx.fillStyle='#231a0e';ctx.fill();ctx.strokeStyle='#f3cb74';ctx.lineWidth=1.2;ctx.stroke();
    ctx.fillStyle=color;ctx.fillRect(x-15,y-1.5,3,3);
    ctx.fillStyle='#ffe5a3';ctx.fillText('HERO',x+2,y+.5);
  }
  ctx.restore();
}

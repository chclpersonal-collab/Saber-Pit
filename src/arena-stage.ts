// @ts-nocheck
// Saber Pit's arena dressing. All positions are presentation-only; no game RNG,
// terrain, hit geometry, or wall-clock state is read or mutated here.
const buildPalette = (outer, deck, core, grid, ice, warm, conduit) => Object.freeze({
  outer, deck, core, grid, player: ice, enemy: warm, conduit,
  wallFace:'#202e42', wallEdge:'#546985', wallCap:'#adc8e4',
  barricadeFace:'#293852', barricadeEdge:'#768bad', roughFill:'#52759824',
  roughStroke:'#759ab4a0', hazardFill:'#ff9b3428', hazardStroke:'#f8af61',
  hazardHatch:'#ff9d5244', terrainLabel:'#ceddef',
});
const themes = Object.freeze({
  crossroads: buildPalette('#080c18','#111d2d','#243651','#6a91ba','#63e5fc','#ff855d','#7ab0df'),
  zigzag: buildPalette('#0d0a1a','#1b162d','#36294c','#9e80bc','#76e3ef','#fca269','#bc9df6'),
  craterfield: buildPalette('#110a12','#251622','#44212c','#ad7c88','#7fe9ff','#ffa465','#ffa374'),
});
export function arenaPalette(mapId) { return Object.hasOwn(themes,mapId) ? themes[mapId] : themes.crossroads; }
const rgba = (hex, a) => hex + Math.round(Math.max(0, Math.min(1,a)) * 255).toString(16).padStart(2,'0');
const matchHex = (s, fallback) => typeof s === 'string' && /^#[a-f\d]{6}$/i.test(s) ? s : fallback;
const clamp = (x, low, high) => Math.min(high, Math.max(low,x));
const finite = (x, fallback) => Number.isFinite(x) ? x : fallback;
const line = (ctx, x1,y1,x2,y2) => { ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); };
function poly(ctx, points, close = false) {
  ctx.moveTo(...points[0]);
  for (let i=1;i<points.length;i++) ctx.lineTo(...points[i]);
  if (close) ctx.closePath();
}
function dimensions(width, height, bounds) {
  if (!(width >= 48 && width <= 5000 && height >= 48 && height <= 5000)) return null;
  const minX = clamp(finite(bounds?.minX,40),0,width-8), minY = clamp(finite(bounds?.minY,50),0,height-8);
  const maxX = clamp(finite(bounds?.maxX,width-40),minX+8,width), maxY = clamp(finite(bounds?.maxY,height-50),minY+8,height);
  return { minX, minY, maxX, maxY, spanX:maxX-minX, spanY:maxY-minY, centerX:width/2, centerY:height/2 };
}
function corners(ctx, x1,y1,x2,y2,inset) {
  const c = Math.min(inset,(x2-x1)/3,(y2-y1)/3);
  poly(ctx, [[x1,y1+c],[x1+c,y1],[x2-c,y1],[x2,y1+c],[x2,y2-c],[x2-c,y2],[x1+c,y2],[x1,y2-c]],true);
}
function track(ctx, start, end, xMid, y, offset, skew) {
  const shoulder=Math.abs(end-start)*.25;
  const direction=Math.sign(end-start);
  poly(ctx, [[start,y],[start+direction*shoulder,y],[xMid+direction*shoulder*.36,y+offset+skew],[end,y+offset+skew]]);
}
const rowsFor = d => [d.minY+d.spanY*.17,d.centerY,d.maxY-d.spanY*.17];
const skewFor = (mapId, index) => mapId === 'zigzag' ? (index-1)*21 : mapId === 'craterfield' ? (index-1)*-17 : 0;

export function drawArenaStage(ctx,{width,height,mapId,environment,bounds,colors}={}) {
  const d=dimensions(width,height,bounds);
  if (!d) return;
  const {minX,minY,maxX,maxY,spanX,spanY,centerX,centerY}=d;
  const p=arenaPalette(mapId);
  const left=matchHex(colors?.player,p.player), right=matchHex(colors?.enemy,p.enemy);
  ctx.save();
  ctx.fillStyle=p.outer;
  ctx.fillRect(0,0,width,height);
  const deck=ctx.createRadialGradient(centerX,centerY,0,centerX,centerY,width*.57);
  deck.addColorStop(0,p.core); deck.addColorStop(.58,p.deck); deck.addColorStop(1,p.outer);
  ctx.fillStyle=deck; ctx.fillRect(0,0,width,height);
  // Large dark plate, finely divided into offset floor cells and corner bolts.
  ctx.save(); ctx.beginPath(); corners(ctx,minX-10,minY-10,maxX+10,maxY+10,22); ctx.clip();
  ctx.strokeStyle=rgba(p.grid,.13); ctx.lineWidth=1;
  const pitch=width>=1280?48:40;
  ctx.beginPath();
  for(let x=minX-10;x<=maxX+10;x+=pitch) line(ctx,x+.5,minY-10,x+.5,maxY+10);
  for(let y=minY-10;y<=maxY+10;y+=pitch) line(ctx,minX-10,y+.5,maxX+10,y+.5);
  ctx.stroke();
  ctx.fillStyle=rgba(p.grid,.14);
  for(let x=minX+7;x<maxX;x+=pitch*2) for(let y=minY+7;y<maxY;y+=pitch*2) ctx.fillRect(x,y,2,2);
  ctx.restore();

  // Do not encode a gameplay zone with these markings; they sit behind the
  // authoritative rings. Negative space makes the silhouettes clearer.
  ctx.beginPath(); corners(ctx,minX-12,minY-12,maxX+12,maxY+12,25);
  ctx.strokeStyle=rgba(p.grid,.32); ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.rect(minX,minY,spanX,spanY);
  ctx.strokeStyle=rgba(p.grid,.40); ctx.stroke();
  ctx.beginPath();
  line(ctx,centerX,minY,centerX,maxY);
  ctx.strokeStyle=rgba(p.grid,.21); ctx.setLineDash([3,7]); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); corners(ctx,centerX-28,centerY-28,centerX+28,centerY+28,13);
  ctx.strokeStyle=rgba(p.conduit,.26); ctx.stroke();

  // Pair of opposite, clearly team-coded power rails. No expensive blur:
  // layered strokes act as glow and are cached by the main scene.
  for(const side of [0,1]){
    const dir=side===0?1:-1, x=side===0?minX:maxX, accent=side===0?left:right;
    const horizon = Math.max(0,Math.min(spanX*.36,centerX-minX-96,maxX-centerX-96));
    for (const [i,y] of rowsFor(d).entries()){
      const offset=(i-1)*-12, end=x+dir*horizon;
      ctx.beginPath(); track(ctx,x,end,(x+end)*.5,y,offset,skewFor(mapId,i));
      ctx.strokeStyle=rgba(accent,.065); ctx.lineWidth=9; ctx.stroke();
      ctx.strokeStyle=rgba(accent,.21); ctx.lineWidth=1.35; ctx.stroke();
    }
    ctx.beginPath();
    for(const y of [minY,maxY]){
      line(ctx,x,y,x+dir*Math.min(spanX*.21,176),y);
      line(ctx,x,y,x,y+(y===minY?1:-1)*Math.min(spanY*.20,96));
    }
    ctx.strokeStyle=rgba(accent,.16);ctx.lineWidth=12;ctx.stroke();
    ctx.strokeStyle=rgba(accent,.68);ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=rgba(accent,.58);
    for(let i=0;i<7;i++){
      const y=centerY+(i-3)*8;
      ctx.fillRect(x+(dir===1?8:-11),y,3,3);
    }
    const spawn=ctx.createLinearGradient(x,0,x+dir*180,0);
    spawn.addColorStop(0,rgba(accent,.14));spawn.addColorStop(1,rgba(accent,0));
    ctx.fillStyle=spawn;ctx.fillRect(side===0?x:x-180,minY,180,spanY);
  }
  if(environment==='fog' || environment==='sandstorm'){
    // Tone down the scenery first; serious weather cues are rendered elsewhere.
    ctx.fillStyle=environment==='fog'?'#8098b211':'#d2855310';
    ctx.fillRect(minX,minY,spanX,spanY);
  }
  ctx.restore();
}

export function drawArenaCurrent(ctx,{width,height,mapId,bounds,time,fullEffects=true,reducedMotion=false,colors}={}) {
  if(!fullEffects || reducedMotion || !Number.isFinite(time)) return;
  const d=dimensions(width,height,bounds);
  if(!d || d.spanX<280 || d.spanY<100) return;
  const p=arenaPalette(mapId);
  const left=matchHex(colors?.player,p.player), right=matchHex(colors?.enemy,p.enemy);
  const rows=rowsFor(d);
  const t=((time % 240)+240)%240;
  ctx.save();
  for(const side of [0,1]){
    const dir=side===0?1:-1, start=side===0?d.minX:d.maxX, accent=side===0?left:right;
    const span=Math.max(0,Math.min(d.spanX*.36,d.centerX-d.minX-96,d.maxX-d.centerX-96));
    for(let i=0;i<rows.length;i++){
      const age=(t*.225+i*.31+side*.52)%1;
      const envelope=Math.sin(Math.PI*age);
      const x=start+dir*age*span;
      const transition=clamp((age-.25)/.34,0,1);
      const y=rows[i]+((i-1)*-12+skewFor(mapId,i))*transition;
      ctx.fillStyle=rgba(accent,envelope*.14); ctx.fillRect(x-13,y-2,26,4);
      ctx.fillStyle=rgba(accent,envelope*.53); ctx.fillRect(x-5,y-.75,10,1.5);
    }
  }
  ctx.restore();
}

// @ts-nocheck
// World-space framing only. The combat simulation never sees these values.
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

export function actionFrame({width,height,fighters,enabled=true}) {
  const wide={x:width/2,y:height/2,zoom:1};
  if(!enabled||fighters.length<2||fighters.length>6)return wide;
  let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for(const f of fighters){
    l=Math.min(l,f.x);r=Math.max(r,f.x);
    t=Math.min(t,f.y-Math.max(0,f.airHeight||0));b=Math.max(b,f.y);
  }
  // Reserve room for both saber ends, airborne silhouettes, and a fixed HUD.
  const spanX=Math.max(r-l+330,1),spanY=Math.max(b-t+350,1);
  const zoom=Math.max(1,Math.min(fighters.length===2?1.66:1.42,width/spanX,height/spanY));
  return {x:(l+r)/2,y:(t+b)/2-42,zoom};
}

export function stepActionFrame(previous,target,width,height,dt,instant=false){
  const z=target.zoom;
  // Back out faster than closing in so that a quick dash does not disappear.
  const a=instant?1:1-Math.exp(-Math.max(0,dt)*(z<previous.zoom?12:4.5));
  const zoom=previous.zoom+(z-previous.zoom)*a;
  const minX=width/(2*zoom),minY=height/(2*zoom);
  const x=clamp(target.x,minX,width-minX),y=clamp(target.y,minY,height-minY);
  return {zoom,x:clamp(previous.x+(x-previous.x)*a,minX,width-minX),
    y:clamp(previous.y+(y-previous.y)*a,minY,height-minY)};
}

export function screenToArena(px,py,box,canvasWidth,canvasHeight,transform){
  return {
    x:((px-box.left)*canvasWidth/box.width-transform.x)/transform.scale,
    y:((py-box.top)*canvasHeight/box.height-transform.y)/(transform.scaleY??transform.scale)
  };
}

/** Small Action matches use a shallower frame; all geometry shares the projection. */
export function composeArcadeFrame(viewWidth,viewHeight,worldWidth,worldHeight,focus,{profile=false,shake}={}){
  const pitch=profile?.84:1;
  const base=Math.min(viewWidth/worldWidth,viewHeight/(worldHeight*pitch));
  const scale=base*focus.zoom,scaleY=scale*pitch;
  return {scale,scaleY,x:viewWidth*.5-focus.x*scale+(shake?.x||0)*base,
    y:viewHeight*.5-focus.y*scaleY+(shake?.y||0)*base};
}

// World-space framing only. The combat simulation never sees these values.
export interface CameraPoint{x:number;y:number}
export interface ActionFocus extends CameraPoint{zoom:number}
export interface CameraTransform extends CameraPoint{scale:number;scaleY?:number}
interface ActionFrameOptions{width:number;height:number;fighters:readonly (CameraPoint&{airHeight?:number})[];enabled?:boolean}
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

export function actionFrame({width,height,fighters,enabled=true}:ActionFrameOptions) {
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

export function stepActionFrame(previous:ActionFocus,target:ActionFocus,width:number,height:number,dt:number,instant=false){
  const z=target.zoom;
  // Back out faster than closing in so that a quick dash does not disappear.
  const a=instant?1:1-Math.exp(-Math.max(0,dt)*(z<previous.zoom?12:4.5));
  const zoom=previous.zoom+(z-previous.zoom)*a;
  const minX=width/(2*zoom),minY=height/(2*zoom);
  const x=clamp(target.x,minX,width-minX),y=clamp(target.y,minY,height-minY);
  return {zoom,x:clamp(previous.x+(x-previous.x)*a,minX,width-minX),
    y:clamp(previous.y+(y-previous.y)*a,minY,height-minY)};
}

export function screenToArena(px:number,py:number,box:Pick<DOMRectReadOnly,"left"|"top"|"width"|"height">,canvasWidth:number,canvasHeight:number,transform:CameraTransform){
  return {
    x:((px-box.left)*canvasWidth/box.width-transform.x)/transform.scale,
    y:((py-box.top)*canvasHeight/box.height-transform.y)/(transform.scaleY??transform.scale)
  };
}

/** Small Action matches use a shallower frame; all geometry shares the projection. */
export function composeArcadeFrame(viewWidth:number,viewHeight:number,worldWidth:number,worldHeight:number,focus:ActionFocus,{profile=false,shake}:{profile?:boolean;shake?:Partial<CameraPoint>}={}){
  const pitch=profile?.84:1;
  const base=Math.min(viewWidth/worldWidth,viewHeight/(worldHeight*pitch));
  const scale=base*focus.zoom,scaleY=scale*pitch;
  return {scale,scaleY,x:viewWidth*.5-focus.x*scale+(shake?.x||0)*base,
    y:viewHeight*.5-focus.y*scaleY+(shake?.y||0)*base};
}

/** Portrait camera: retain the fighter, include a nearby opponent, and allow a full-map toggle. */
export function portraitActionFrame(width:number,height:number,viewWidth:number,viewHeight:number,
  anchor:CameraPoint&{airHeight?:number},nearby?:CameraPoint&{airHeight?:number},minimumZoom=2.05):ActionFocus {
  if(!(viewWidth>0&&viewHeight>0))return {x:width/2,y:height/2,zoom:1};
  const rival=nearby&&Math.hypot(anchor.x-nearby.x,anchor.y-nearby.y)<260?nearby:anchor;
  const anchorTop=anchor.y-Math.max(0,anchor.airHeight??0);
  const rivalTop=rival.y-Math.max(0,rival.airHeight??0);
  const base=Math.min(viewWidth/width,viewHeight/height);
  const zoom=Math.max(viewWidth/(width*base),viewHeight/(height*base),minimumZoom);
  const halfWidth=Math.min(width/2,viewWidth/(2*base*zoom));
  const halfHeight=Math.min(height/2,viewHeight/(2*base*zoom));
  return {
    x:clamp(anchor.x+(rival.x-anchor.x)*.32,halfWidth,width-halfWidth),
    y:clamp((Math.max(anchor.y,rival.y)+Math.min(anchorTop,rivalTop))/2-32,halfHeight,height-halfHeight),zoom
  };
}


export function canFocusCauseways(mapId:string|undefined,fighters:number){
  return mapId==='three_causeways'&&fighters>6;
}
type ActiveFocusFighter=CameraPoint&{id:string;team:number;control?:boolean;airHeight?:number;alive:boolean};
/** Explicit Stats selection when watching; somebody else's pick never steals Play camera. */
export function selectArenaFocus<T extends ActiveFocusFighter>(width:number,height:number,fighters:readonly T[],settings:{preferred?:string;previous?:string;hero?:T}={}){
  const alive=fighters.filter(f=>f.alive);
  const anchor=settings.hero?.alive?settings.hero:alive.find(f=>f.control)??alive.find(f=>f.id===settings.preferred)??alive.find(f=>f.id===settings.previous)
    ??alive.reduce<T|undefined>((best,f)=>!best||(f.x-width/2)**2+(f.y-height/2)**2<(best.x-width/2)**2+(best.y-height/2)**2?f:best,undefined);
  const rival=anchor?alive.reduce<T|undefined>((best,f)=>f.team!==anchor.team&&
    (!best||(f.x-anchor.x)**2+(f.y-anchor.y)**2<(best.x-anchor.x)**2+(best.y-anchor.y)**2)?f:best,undefined):undefined;
  return {anchor,rival};
}

/** Portrait 1v1: frame the living pair even at the widest spawn, then
 * close in continuously. Solo focus is retained only when no rival remains. */
export function portraitDuelActionFrame(width:number,height:number,viewWidth:number,viewHeight:number,
  anchor:CameraPoint&{airHeight?:number},nearby?:CameraPoint&{airHeight?:number}):ActionFocus {
  if(!nearby||!(viewWidth>0&&viewHeight>0))return portraitActionFrame(width,height,viewWidth,viewHeight,anchor);
  const dx=nearby.x-anchor.x, dy=nearby.y-anchor.y, gap=Math.hypot(dx,dy);
  if(!Number.isFinite(gap))return portraitActionFrame(width,height,viewWidth,viewHeight,anchor);
  const n=clamp((338-gap)/136,0,1), pair=n*n*(3-2*n);
  const base=Math.min(viewWidth/width,viewHeight/height);
  const anchorTop=anchor.y-Math.max(0,anchor.airHeight??0), rivalTop=nearby.y-Math.max(0,nearby.airHeight??0);
  const feet=Math.max(anchor.y,nearby.y), head=Math.min(anchorTop,rivalTop)-96;
  const room=Math.min(viewWidth/(base*(Math.abs(dx)+218)),viewHeight/(base*(feet-head+119)));
  // Deliberately allow a wide opening instead of losing the rival offscreen.
  // At exchange distance the prior close-up limit and above-head bias remain.
  // Spend the extra magnification on an actual exchange, not on the
  // approach. The same horizontal blade/vertical leap room still caps it.
  const tight=clamp((198-gap)/96,0,1);
  const closeZoom=.52*tight*tight*(3-2*tight);
  const zoom=Math.max(1,Math.min(room,2.05+.59*pair+closeZoom));
  const xRoom=Math.min(width/2,viewWidth/(2*base*zoom)),yRoom=Math.min(height/2,viewHeight/(2*base*zoom));
  return {zoom,x:clamp((anchor.x+nearby.x)*.5,xRoom,width-xRoom),
    y:clamp((feet+head)*.5-32,yRoom,height-yRoom)};
}

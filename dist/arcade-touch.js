/** Buildless touch-stick math. Inputs and thumb outputs are CSS pixels, not
 * backing-canvas pixels. Gameplay vectors retain screen's y-down convention. */
const zero = () => ({x:0,y:0});
const validRadius = radius => Number.isFinite(radius) && radius > 0;
const validPoint = (x,y) => Number.isFinite(x) && Number.isFinite(y);
const validPointer = id => Number.isSafeInteger(id) && id >= 0;

function polar(dx,dy,radius) {
  if (!validPoint(dx,dy) || !validRadius(radius)) return null;
  const scale = Math.max(Math.abs(dx),Math.abs(dy));
  if (!scale) return null;
  // Normalize first so even finite, unusually large coordinates cannot
  // overflow a raw hypot() and turn a diagonal drag into zero.
  const sx = dx/scale, sy = dy/scale, length = Math.hypot(sx,sy);
  return {x:sx/length,y:sy/length, amount:Math.min(1,(scale/radius)*length)};
}

/** Circular dead zone with continuous gain above its edge. */
export function arcadeTouchVector(dx,dy,radius,deadZone=.15) {
  const p=polar(dx,dy,radius);
  if(!p) return zero();
  const dead=Number.isFinite(deadZone)?Math.max(0,Math.min(.95,deadZone)):.15;
  if(p.amount<=dead) return zero();
  const gain=(p.amount-dead)/(1-dead);
  return {x:p.x*gain,y:p.y*gain};
}

/** Thumb feedback follows the finger even inside the gameplay dead zone. */
export function arcadeTouchThumb(dx,dy,radius) {
  const p=polar(dx,dy,radius);
  if(!p) return zero();
  const length=radius*p.amount;
  return {x:p.x*length,y:p.y*length};
}

/** One pointer owns this stick while other fingers can hold action buttons. */
export function createArcadeTouchOwner({deadZone=.15}={}) {
  let pointerId=null, startX=0, startY=0, radius=0, dx=0, dy=0;
  function begin(id,x,y,r) {
    if(pointerId!==null||!validPointer(id)||!validPoint(x,y)||!validRadius(r)) return false;
    pointerId=id;startX=x;startY=y;radius=r;dx=dy=0;
    return true;
  }
  function move(id,x,y) {
    if(pointerId===null||pointerId!==id||!validPoint(x,y)) return false;
    dx=x-startX;dy=y-startY;
    return true;
  }
  function cancel() {
    if(pointerId===null)return false;
    pointerId=null;startX=startY=radius=dx=dy=0;
    return true;
  }
  function end(id) {
    return pointerId!==null&&pointerId===id&&cancel();
  }
  function snapshot() {
    const vector=arcadeTouchVector(dx,dy,radius,deadZone),thumb=arcadeTouchThumb(dx,dy,radius);
    return {pointerId,...vector,thumbX:thumb.x,thumbY:thumb.y};
  }
  return {begin,move,end,cancel,snapshot};
}

/** Pick a visible silhouette, or a short-lived directional aim on the floor. */
export function arcadeTapAim({point,fighters,team,current,time,width,height}){
  const p=point;
  if(!p||!validPoint(p.x,p.y)||p.x<0||p.y<0||p.x>width||p.y>height)return current??null;
  let target=null,distance=37;
  for(const f of fighters){
    if(!f.alive||f.team===team)continue;
    const silhouetteY=f.y-33-(f.airHeight??0);
    const d=Math.min(Math.hypot(f.x-p.x,silhouetteY-p.y),Math.hypot(f.x-p.x,f.y-p.y)+7);
    if(d<distance){distance=d;target=f;}
  }
  if(target)return current?.id===target.id?null:{id:target.id};
  return {x:p.x,y:p.y,until:time+2.6};
}

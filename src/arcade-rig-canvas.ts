/** Shared, typed Canvas primitives for the legacy cel painter. */
import type {Point} from './arcade-rig-projection.js?v=6.0.2-rc2';
type Pair=readonly [number,number];
type Canvas=CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
type PathCommand= ['M'|'L',number,number] | ['Q',number,number,number,number] |
  ['C',number,number,number,number,number,number] | ['Z'];
const TAU=Math.PI*2;
const P=(x:number,y:number):Point=>({x,y});
export function polygon(ctx:Canvas,coords:readonly Pair[],fill:string,edge:string|null=null,width=2) {
  ctx.beginPath(); ctx.moveTo(coords[0][0],coords[0][1]);
  for(let j=1;j<coords.length;j++)ctx.lineTo(coords[j][0],coords[j][1]);
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  if(edge){ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
}
export function line(ctx:Canvas,points:readonly Point[],stroke:string,width:number,cap:CanvasLineCap='round'){
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap=cap;ctx.stroke();
}
export function flatEllipse(ctx:Canvas,x:number,y:number,rx:number,ry:number,color:string) {
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();
}
// Hand-drawn curves, flattened cel panels and a continuous skin/clothing
// silhouette. The skeleton places the shape; it is never visible as a stroke.
export function celPath(ctx:Canvas,commands:readonly PathCommand[],fill:string|null,edge:string|null=null,width=1.12) {
  ctx.beginPath();
  for(const cmd of commands){
    if(cmd[0]==='M')ctx.moveTo(cmd[1],cmd[2]);
    else if(cmd[0]==='L')ctx.lineTo(cmd[1],cmd[2]);
    else if(cmd[0]==='Q')ctx.quadraticCurveTo(cmd[1],cmd[2],cmd[3],cmd[4]);
    else if(cmd[0]==='C')ctx.bezierCurveTo(cmd[1],cmd[2],cmd[3],cmd[4],cmd[5],cmd[6]);
    else ctx.closePath();
  }
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(edge){ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
}
export const unit=(a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return P(dx/l,dy/l);};
export const at=(p:Point,d:Point,x:number,y=0):[number,number]=>[p.x+d.x*x-d.y*y,p.y+d.y*x+d.x*y];

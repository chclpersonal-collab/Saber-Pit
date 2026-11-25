import {MOBA_WIDTH,MOBA_HEIGHT,type MobaPoint} from './arcade-moba.js?v=6.0.2';

export type MobaViewport={width:number;height:number};
export type MobaView=MobaPoint&MobaViewport&{zoom:number};
type CanvasBox=MobaViewport&{left:number;top:number};
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
// The painted head-to-boot silhouette is ~44 world units. Keep a readable
// 36 CSS px target on a phone without using a tall canvas or moving the page.
const HERO_ART_HEIGHT=44, MOBILE_HERO_HEIGHT=36, BASE_FOLLOW=1.80, MAX_FOLLOW=3.7;
const contain=(box:MobaViewport,size:MobaViewport)=>Math.min(box.width/size.width,box.height/size.height);
export function frameMobaCamera(target:MobaPoint, follow:boolean, viewport:MobaViewport):MobaView{
  const closePortrait=follow&&viewport.width>0&&viewport.width<=600&&viewport.height>viewport.width;
  const width=closePortrait?Math.round(clamp(MOBA_HEIGHT*viewport.width/viewport.height,300,MOBA_WIDTH)):MOBA_WIDTH;
  const height=MOBA_HEIGHT;
  if(!follow)return {x:0,y:0,zoom:1,width,height};
  const fit=contain(viewport,{width,height});
  const zoom=fit>0?clamp(MOBILE_HERO_HEIGHT/(HERO_ART_HEIGHT*fit),closePortrait?1.06:BASE_FOLLOW,MAX_FOLLOW):BASE_FOLLOW;
  const w=width/zoom,h=height/zoom;
  return {zoom,width,height,x:clamp(target.x-w*.50,0,MOBA_WIDTH-w),y:clamp(target.y-h*.53,0,MOBA_HEIGHT-h)};
}
export function mobaCanvasAim(view:MobaView,box:CanvasBox,client:MobaPoint):MobaPoint|null{
  const fit=contain(box,view);
  if(!Number.isFinite(fit)||fit<=0)return null;
  const x=(client.x-box.left-(box.width-view.width*fit)/2)/fit;
  const y=(client.y-box.top-(box.height-view.height*fit)/2)/fit;
  if(x<0||y<0||x>view.width||y>view.height)return null;
  return {x:view.x+x/view.zoom,y:view.y+y/view.zoom};
}

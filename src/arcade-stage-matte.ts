/** Presentation only: extend the light beyond the actual stage, not its collision plane. */
type MatteTone = readonly [sky: string, rim: string, ink: string];
const tones:Readonly<Record<string,MatteTone>>={
  ember_ring:['#1d2140','#1d1c2c','#11121b'],
  underpit:['#16262d','#121d22','#10161c'],
  foundry:['#595053','#2c2424','#171419'],
  high_bastion:['#747071','#152022','#15191d'],
  crossroads:['#747071','#252123','#15151c'],
  zigzag:['#605c64','#272426','#16161d'],
  craterfield:['#75625c','#332a28','#1a151a'],
  three_causeways:['#3d494e','#1c252b','#12171d'],
};
const defaultTone:MatteTone=['#333842','#25262c','#13151a'];
const texture=new Map<string,HTMLCanvasElement>();
const W=256,H=96;
function getMatte(id:string,bottom:boolean){
  const key=id+(bottom?'/base':'/sky');
  const cached=texture.get(key);
  if(cached)return cached;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const ctx=c.getContext('2d');
  if(!ctx)return null;
  const [sky,rim,ink]=tones[id]??defaultTone;
  const gradient=ctx.createLinearGradient(0,0,0,H);
  gradient.addColorStop(0,bottom?rim:ink);
  gradient.addColorStop(bottom?.77:.27,ink);
  gradient.addColorStop(1,bottom?ink:sky);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
  // Still grain in the margins only. Very quiet around buttons and HUD.
  let seed=451;
  const rng=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<128;i++){
    const x=rng()*W,y=9+rng()*(H-18);
    ctx.fillStyle=i%3===0?'#ffe4cd09':'#02030a14';
    ctx.fillRect(x,y,1+rng()*.65,1);
  }
  texture.set(key,c);return c;
}
export function arcadeStageMatteBands(canvasHeight:number,stageY:number,projectedHeight:number){
  if(!(canvasHeight>0&&projectedHeight>0)||!Number.isFinite(stageY+projectedHeight+canvasHeight))return null;
  const top=Math.max(0,Math.min(canvasHeight,stageY));
  const bottom=Math.max(0,Math.min(canvasHeight,stageY+projectedHeight));
  return top>.5||canvasHeight-bottom>.5?{top,bottom}:null;
}
/** At most two cached texture blits behind the scene. The stage is drawn afterward using its original transform. */
export function paintArcadeStageMatte(ctx:CanvasRenderingContext2D,id:string,width:number,height:number,y:number,projectedHeight:number){
  const bands=arcadeStageMatteBands(height,y,projectedHeight);
  if(!bands)return;
  if(bands.top>.5){
    const tile=getMatte(id,false);
    if(tile)ctx.drawImage(tile,0,0,width,Math.ceil(bands.top));
  }
  if(height-bands.bottom>.5){
    const base=Math.floor(bands.bottom), tile=getMatte(id,true);
    if(tile)ctx.drawImage(tile,0,base,width,height-base);
  }
}

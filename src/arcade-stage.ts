import {paintCompound,paintCompoundObstacle,animateCompound} from './arcade-maps.js?v=4.0.0';
import { createBattlefield, MAP_SIZES } from './maps.js?v=1.4.0';

interface StageBox{x:number;y:number;width:number;height:number;kind:string;moveCost?:number;damagePerSecond?:number}
interface StageBounds{minX:number;minY:number;maxX:number;maxY:number}
interface StageTerrain{id?:string;width?:number;height?:number;bounds:StageBounds;playBounds?:StageBounds;solids?:StageBox[];zones?:StageBox[]}
interface StageOptions{mapId?:string;terrain?:StageTerrain|null;environment?:string}
interface Stage{image:HTMLCanvasElement;terrain:StageTerrain;id:string;obstacles:StageBox[];environment:string;cavern?:HTMLImageElement}
export const ARCADE_MAP_SIZES = MAP_SIZES;
const RINGS = ['underpit','foundry','ember_ring'];
export const ARCADE_MAPS = Object.freeze(Object.fromEntries([
  ['high_bastion','High Bastion','Grand siege court: central gate, perimeter approaches, and vent crossings.'],
  ['crossroads','Crossroads','Three approach lanes divided by physical cover and short center walls.'],
  ['zigzag','Zigzag','Staggered cover breaks up straight approaches.'],
  ['craterfield','Craterfield','Rough approaches and four dangerous vent beds.'],
  ['underpit','The Underpit','Open limestone pit beneath a barred keep gate.'],
  ['foundry','The Foundry','Open forge hall with timber beams and iron rails.'],
  ['ember_ring','Ember Ring','Open rooftop terrace above a torchlit town.'],
].map(([id,name,description]) => [id,Object.freeze({id,name,description})])));
export function resolveArcadeMap(id:string|undefined, round=1) {
  if (id!==undefined&&Object.hasOwn(ARCADE_MAPS,id)) return id;
  return RINGS[(Math.max(1,Number.isFinite(round)?Math.floor(round):1)-1)%RINGS.length];
}

const saneSize = (v:number,fallback:number) => Number.isFinite(v)&&v>=360?Math.min(2560,Math.round(v)):fallback;
let cavernArt:HTMLImageElement|undefined;
function useCavernArt(stage:Stage,repaint:()=>void){
  if(typeof globalThis.Image!=='function')return;
  if(!cavernArt){
    cavernArt=new Image();
    cavernArt.src=new URL('./art/spring-cavern.png',import.meta.url).href;
  }
  const apply=()=>{
    if(!cavernArt?.naturalWidth)return;
    stage.cavern=cavernArt;repaint();
  };
  if(cavernArt.complete)apply();
  else cavernArt.addEventListener('load',apply,{once:true});
}
const dimensions=(w:number,h:number)=>[saneSize(w,1120),saneSize(h,640)];
export function createArcadeTerrain(mapId:string|undefined,w:number,h:number,round=1) {
  const [width,height]=dimensions(w,h), id=resolveArcadeMap(mapId,round), entry=ARCADE_MAPS[id];
  if(id==='high_bastion'){
    const bounds={minX:width*.033,minY:height*.205,maxX:width*.967,maxY:height*.938};
    const sx=width/1920,sy=height/1080;
    const box=(kind:string,x:number,y:number,w:number,h:number)=>({kind,x:x*sx,y:y*sy,width:w*sx,height:h*sy});
    const mirrored=(kind:string,x:number,y:number,w:number,h:number)=>[box(kind,x,y,w,h),box(kind,1920-x-w,y,w,h)];
    const solids=[
      ...mirrored('wall',765,300,45,169),...mirrored('wall',765,681,45,184),
      ...mirrored('wall',410,399,176,33),...mirrored('wall',410,777,176,33),
      ...mirrored('barricade',640,498,53,56),...mirrored('barricade',640,639,53,56),
    ];
    const zones=[
      {...box('hazard',947,343,26,128),damagePerSecond:28},
      {...box('hazard',947,678,26,112),damagePerSecond:28},
      {...box('rough',794,483,120,70),moveCost:1.18},
      {...box('rough',1006,620,120,70),moveCost:1.18},
    ];
    return {...entry,width,height,bounds,playBounds:{...bounds},solids,zones};
  }
  if (RINGS.includes(id)) {
    const bounds={minX:width*.031,minY:height*.192,maxX:width*.969,maxY:height*.937};
    return {...entry,width,height,bounds,playBounds:{...bounds},solids:[],zones:[]};
  }
  // The non-ring terrain IDs always select a generated battlefield, never Classic cosmetic-only mode.
  const source = createBattlefield(1,{terrain:id,mapSize:'medium'}) as unknown as Required<Pick<StageTerrain,'width'|'height'|'bounds'|'solids'|'zones'>>;
  const sx = width/source.width, sy=height/source.height;
  const bounds={minX:source.bounds.minX*sx,minY:source.bounds.minY*sy,maxX:source.bounds.maxX*sx,maxY:source.bounds.maxY*sy};
  const scale = <T extends StageBox>(box:T) => ({...box,x:box.x*sx,y:box.y*sy,width:box.width*sx,height:box.height*sy});
  return {...entry,width,height,bounds,playBounds:{...bounds},solids:source.solids.map(scale),zones:source.zones.map(scale)};
}

export function createArcadeStage(w:number,h:number,round=1,options:StageOptions|string|null={}):Stage{
  [w,h]=dimensions(w,h);
  const {mapId,terrain:createFrom,environment='clear'}=typeof options==='string'?{mapId:options}:(options??{});
  const terrain:StageTerrain=createFrom??createArcadeTerrain(mapId,w,h,round);
  const id=resolveArcadeMap(terrain.id??mapId,round);
  const staticCanvas=document.createElement('canvas');staticCanvas.width=w;staticCanvas.height=h;
  const obstacles=(terrain.solids??[]).slice().sort((a,b)=>a.y+a.height-b.y-b.height);
  const stage:Stage={image:staticCanvas,terrain,id,obstacles,environment};
  const repaint=()=>paintCompound(staticCanvas.getContext('2d')!,stage,w,h);
  repaint();
  if(id==='underpit')useCavernArt(stage,repaint);
  return stage;
}
export function drawArcadeStage(ctx:CanvasRenderingContext2D,stage:Stage,w:number,h:number,time:number,reduced?:boolean){
  ctx.drawImage(stage.image,0,0);
  if(!reduced){
    drawWeather(ctx,stage,w,h,time);
    animateCompound(ctx,stage,w,h,time);
  }
}
export function drawArcadeObstacle(ctx:CanvasRenderingContext2D,stage:Stage,rect:StageBox){
  paintCompoundObstacle(ctx,stage,rect);
}
function drawWeather(ctx:CanvasRenderingContext2D,stage:Stage,w:number,h:number,time:number) {
  const weather=stage.environment;
  if (weather==='rain'||weather==='sandstorm') {
    ctx.save();ctx.beginPath();
    const sand=weather==='sandstorm';
    for(let i=0;i<32;i++) {
      const x=(i*93.44+time*(sand?84:27))%w;
      const y=(i*77.63+time*(sand?21:151))%h;
      ctx.moveTo(x,y);ctx.lineTo(x+(sand?19:4),y+(sand?5:13));
    }
    ctx.strokeStyle=sand?'#f8c1763b':'#8ce3ff42';ctx.lineWidth=1.15;ctx.stroke();ctx.restore();
  } else if (weather==='fog') {
    ctx.save();ctx.fillStyle='#cdbfeb12';
    ctx.fillRect(0,Math.max(0,h*.19+Math.sin(time*.7)*11),w,h*.12);
    ctx.fillRect(0,h*.72-Math.sin(time*.5)*11,w,h*.1);ctx.restore();
  }
}

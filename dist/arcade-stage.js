import {paintCompound,paintCompoundObstacle,animateCompound} from './arcade-maps.js?v=4.0.0';
import { createBattlefield, MAP_SIZES } from './maps.js?v=1.4.0';

export const ARCADE_MAP_SIZES = MAP_SIZES;
const RINGS = ['underpit','foundry','ember_ring'];
export const ARCADE_MAPS = Object.freeze(Object.fromEntries([
  ['crossroads','Crossroads','Three approach lanes divided by physical cover and short center walls.'],
  ['zigzag','Zigzag','Staggered cover breaks up straight approaches.'],
  ['craterfield','Craterfield','Rough approaches and four dangerous vent beds.'],
  ['underpit','The Underpit','Open limestone pit beneath a barred keep gate.'],
  ['foundry','The Foundry','Open forge hall with timber beams and iron rails.'],
  ['ember_ring','Ember Ring','Open rooftop terrace above a torchlit town.'],
].map(([id,name,description]) => [id,Object.freeze({id,name,description})])));
export function resolveArcadeMap(id, round=1) {
  if (Object.hasOwn(ARCADE_MAPS,id)) return id;
  return RINGS[(Math.max(1,Number.isFinite(round)?Math.floor(round):1)-1)%RINGS.length];
}

const saneSize = (v,fallback) => Number.isFinite(v)&&v>=360?Math.min(2560,Math.round(v)):fallback;
let cavernArt;
function useCavernArt(stage,repaint){
  if(typeof globalThis.Image!=='function')return;
  if(!cavernArt){
    cavernArt=new Image();
    cavernArt.src=new URL('./art/spring-cavern.png',import.meta.url).href;
  }
  const apply=()=>{
    if(!cavernArt.naturalWidth)return;
    stage.cavern=cavernArt;repaint();
  };
  if(cavernArt.complete)apply();
  else cavernArt.addEventListener('load',apply,{once:true});
}
const dimensions=(w,h)=>[saneSize(w,1120),saneSize(h,640)];
export function createArcadeTerrain(mapId,w,h,round=1) {
  const [width,height]=dimensions(w,h), id=resolveArcadeMap(mapId,round), entry=ARCADE_MAPS[id];
  if (RINGS.includes(id)) {
    const bounds={minX:width*.031,minY:height*.192,maxX:width*.969,maxY:height*.937};
    return {...entry,width,height,bounds,playBounds:{...bounds},solids:[],zones:[]};
  }
  const source = createBattlefield(1,{terrain:id,mapSize:'medium'});
  const sx = width/source.width, sy=height/source.height;
  const bounds={minX:source.bounds.minX*sx,minY:source.bounds.minY*sy,maxX:source.bounds.maxX*sx,maxY:source.bounds.maxY*sy};
  const scale = box => ({...box,x:box.x*sx,y:box.y*sy,width:box.width*sx,height:box.height*sy});
  return {...entry,width,height,bounds,playBounds:{...bounds},solids:source.solids.map(scale),zones:source.zones.map(scale)};
}

export function createArcadeStage(w,h,round=1,options={}){
  [w,h]=dimensions(w,h);
  const {mapId,terrain:createFrom,environment='clear'}=typeof options==='string'?{mapId:options}:(options??{});
  const terrain=createFrom??createArcadeTerrain(mapId,w,h,round);
  const id=resolveArcadeMap(terrain.id??mapId,round);
  const staticCanvas=document.createElement('canvas');staticCanvas.width=w;staticCanvas.height=h;
  const obstacles=(terrain.solids??[]).slice().sort((a,b)=>a.y+a.height-b.y-b.height);
  const stage={image:staticCanvas,terrain,id,obstacles,environment};
  const repaint=()=>paintCompound(staticCanvas.getContext('2d'),stage,w,h);
  repaint();
  if(id==='underpit')useCavernArt(stage,repaint);
  return stage;
}
export function drawArcadeStage(ctx,stage,w,h,time,reduced){
  ctx.drawImage(stage.image,0,0);
  if(!reduced){
    drawWeather(ctx,stage,w,h,time);
    animateCompound(ctx,stage,w,h,time);
  }
}
export function drawArcadeObstacle(ctx,stage,rect){
  paintCompoundObstacle(ctx,stage,rect);
}
function drawWeather(ctx,stage,w,h,time) {
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

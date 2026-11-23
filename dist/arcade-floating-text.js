import {combatCallout} from './arcade-callouts.js?v=3.1.0';

const maxLabels=6;
const max=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const shorten=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const pop=(n)=>1-(1-n)**2;
const palette={ink:'#22160a',gold:'#ffdb72',bright:'#fff1aa',light:'#fff4cf'};
function sizeOf(cue,crowd){return cue.priority>=4?(crowd?17:21):(crowd?15:18);}
function candidateBox(cue,crowd){
 const size=sizeOf(cue,crowd);
 return {width:Math.min(213,Math.max(44,cue.label.length*size*.53,cue.style.length*size*.33)),
   height:cue.style?31:21};
}
function chooseOffset(x,y,w,h,spots){
 // Keep each label close to its actor while separating simultaneous texts.
 // A fixed initial adjustment avoids later jitter as another caption expires.
 const occupied=(dx,dy)=>spots.some(p=>Math.abs(p.x-(x+dx))<(p.width+w)*.47&&
   Math.abs(p.y+p.offsetY-(y+dy))<(p.height+h)*.51);
 for(const dy of [0,-19,-35,19,35]){
   if(!occupied(0,dy))return {x:0,y:dy};
 }
 return null;
}
function visibleAlpha(age,life){
 const tail=Math.min(.32,life*.45);
 return max((life-age)/tail,0,1);
}
function labelAt(f,e){
 if(f&&Number.isFinite(f.x)&&Number.isFinite(f.y)){
   return {x:f.x,y:f.y-finite(f.airHeight)-83};
 }
 if(Number.isFinite(e.x)&&Number.isFinite(e.y))return {x:e.x,y:e.y-75};
 return null;
}
/** Read-only combat event view. Call update with wall-clock seconds and draw
 * in the existing world transform after the fighters. No DOM or sim writes. */
export function createArcadeFloatingText(){
 let lastId=0,time=0;
 const active=[], seen=new Map(), cooldown=new Map(), promoted=new Set();
 return {
   reset(){lastId=time=0;active.length=0;seen.clear();cooldown.clear();promoted.clear();},
   update(dt,events=[],fighters=[],{focusId,crowd=fighters.length>6}={}){
     time+=max(finite(dt),0,.25);
     for(let i=active.length-1;i>=0;i--)if(time>=active[i].born+active[i].life)active.splice(i,1);
     if(!events.length||events.at(-1).id<=lastId)return active.length;
     for(const [key,end] of seen)if(time>=end)seen.delete(key);
     for(const [key,end] of cooldown)if(time>=end)cooldown.delete(key);
     const byId=new Map(fighters.map(f=>[f.id,f]));
     const candidates=[];
     for(const event of events){
       if(!Number.isSafeInteger(event.id)||event.id<=lastId)continue;
       lastId=event.id;
       const f=byId.get(event.fighterId);
       const focus=f?.control===true||f?.id===focusId&&focusId!=null;
       const at=labelAt(f,event),actor=event.fighterId;
       if(!at||typeof actor!=='string')continue;
       let cue=combatCallout(event,f,focus);
       if(f?.chessStyle==='pawn'&&f.chessPawn?.promoted&&!promoted.has(actor)&&['hit','launch'].includes(event.kind)){
         promoted.add(actor);
         cue={label:'PAWN PROMOTED',style:'QUEEN RANGE',priority:4,tone:'promotion',life:1.05,key:'promotion:'+actor};
       }
       if(!cue||crowd&&!focus&&cue.priority<4)continue;
       candidates.push({actor,cue,focus,at,event});
     }
     candidates.sort((a,b)=>b.cue.priority-a.cue.priority||Number(b.focus)-Number(a.focus)||b.event.id-a.event.id);
     const placed=new Set();
     for(const {actor,cue,focus,at} of candidates){
       if(placed.has(actor)||seen.has(cue.key))continue;
       const previous=active.findIndex(p=>p.actor===actor);
       if(previous>=0&&active[previous].priority>=cue.priority)continue;
       if((cooldown.get(actor)??0)>time&&cue.priority<3)continue;
       const full=active.length>=maxLabels;
       const weakest=full?active.reduce((i,p,j)=>p.priority<active[i].priority?j:i,0):-1;
       if(full&&previous<0&&active[weakest].priority>=cue.priority)continue;
       const remove=previous>=0?previous:weakest;
       const short={...cue,label:shorten(cue.label,36),style:shorten(cue.style,24)};
       const {width,height}=candidateBox(short,crowd);
       const offset=chooseOffset(at.x,at.y,width,height,active.filter((_,i)=>i!==remove));
       if(!offset)continue;
       if(remove>=0)active.splice(remove,1);
       active.push({...short,actor,...at,offsetY:offset.y,width,height,size:sizeOf(cue,crowd),
         focus,born:time,life:Math.max(.70,finite(cue.life,.75)+.16)});
       placed.add(actor);
       seen.set(cue.key,time+(cue.priority<=2?1.18:.91));
       if(cue.priority<3)cooldown.set(actor,time+(crowd?.52:.41));
     }
     return active.length;
   },
   draw(ctx,{reducedMotion=false}={}){
     if(!active.length)return;
     ctx.save();
     ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
     const inherited=finite(ctx.globalAlpha,1);
     for(const item of active){
       const age=Math.max(0,time-item.born);
       const rise=reducedMotion?0:26*pop(max(age/item.life,0,1));
       const y=item.y+item.offsetY-rise;
       ctx.globalAlpha=inherited*visibleAlpha(age,item.life);
       ctx.font='900 '+item.size+'px system-ui, sans-serif';
       ctx.lineWidth=4;ctx.strokeStyle=palette.ink;
       ctx.fillStyle=item.priority>=4?palette.bright:palette.gold;
       ctx.strokeText(item.label,item.x,y,item.width);
       ctx.fillText(item.label,item.x,y,item.width);
       if(item.style){
         ctx.font='800 '+Math.max(11,Math.round(item.size*.64))+'px system-ui, sans-serif';
         ctx.lineWidth=3;ctx.fillStyle=palette.light;
         ctx.strokeText(item.style,item.x,y+15,item.width);
         ctx.fillText(item.style,item.x,y+15,item.width);
       }
     }
     ctx.restore();
   },
 };
}

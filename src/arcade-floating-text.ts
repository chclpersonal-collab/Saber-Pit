import {combatCallout} from './arcade-callouts.js?v=3.1.0';
import {declutterArcadeCallouts,arcadeCalloutBudget,arcadeCalloutFamily,arcadeCalloutText} from './arcade-callout-declutter.js?v=5.1.0';

interface Cue{label:string;style:string;priority:number;tone:string;life:number;key:string}
interface Point{x:number;y:number}
interface CueActor extends Point{id:string;airHeight?:number;control?:boolean;chessStyle?:string;chessPawn?:{promoted?:boolean}}
interface CueEvent{id:number;fighterId?:string;kind:string;x?:number;y?:number}
interface Caption extends Cue,Point{actor:string;offsetY:number;width:number;height:number;size:number;focus:boolean;born:number;count?:number;duelSide?:number}
const maxLabels=6;
const max=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
const finite=(n:unknown,fallback=0)=>Number.isFinite(n)?n as number:fallback;
const shorten=(s:string,n:number)=>s.length>n?s.slice(0,n-1)+'…':s;
const pop=(n:number)=>1-(1-n)**2;
const palette={ink:'#22160a',gold:'#ffdb72',bright:'#fff1aa',light:'#fff4cf'};
function sizeOf(cue:Cue,crowd:boolean){return cue.priority>=4?(crowd?17:21):(crowd?15:18);}
function candidateBox(cue:Cue,crowd:boolean){
 const size=sizeOf(cue,crowd);
 return {width:Math.min(213,Math.max(44,cue.label.length*size*.53,cue.style.length*size*.33)),
   height:cue.style?31:21};
}
function chooseOffset(x:number,y:number,w:number,h:number,spots:readonly Caption[]){
 // Keep each label close to its actor while separating simultaneous texts.
 // A fixed initial adjustment avoids later jitter as another caption expires.
 const occupied=(dx:number,dy:number)=>spots.some(p=>Math.abs(p.x-(x+dx))<(p.width+w)*.47&&
   Math.abs(p.y+p.offsetY-(y+dy))<(p.height+h)*.51);
 for(const dy of [0,-19,-35,19,35]){
   if(!occupied(0,dy))return {x:0,y:dy};
 }
 return null;
}
function finitelyNear(a:CueActor,b:CueActor){
 return Math.abs(a.x-b.x)<170&&Math.abs(a.y-finite(a.airHeight)-b.y+finite(b.airHeight))<156;
}
const fadeTail=(life:number)=>Math.min(.32,life*.45);
function visibleAlpha(age:number,life:number){
 return max((life-age)/fadeTail(life),0,1);
}
function labelAt(f:CueActor|undefined,e:CueEvent){
 if(f&&Number.isFinite(f.x)&&Number.isFinite(f.y)){
   return {x:f.x,y:f.y-finite(f.airHeight)-83};
 }
 if(Number.isFinite(e.x)&&Number.isFinite(e.y))return {x:e.x as number,y:(e.y as number)-75};
 return null;
}
/** Read-only combat event view. Call update with wall-clock seconds and draw
 * in the existing world transform after the fighters. No DOM or sim writes. */
export function createArcadeFloatingText(){
 let lastId=0,time=0,roster=0;
 let duel:readonly CueActor[]=[];
 const critical=new Map<string,Caption>();
 const active:Caption[]=[], seen=new Map<string,number>(), cooldown=new Map<string,number>(), promoted=new Set<string>();
 return {
   reset(){lastId=time=roster=0;active.length=0;duel=[];critical.clear();seen.clear();cooldown.clear();promoted.clear();},
   update(dt:number,events:readonly CueEvent[]=[],fighters:readonly CueActor[]=[],{focusId,crowd=fighters.length>6}:{focusId?:string|null;crowd?:boolean}={}){
     time+=max(finite(dt),0,.25);roster=fighters.length;duel=roster===2?fighters:[];
     for(let i=active.length-1;i>=0;i--)if(time>=active[i].born+active[i].life)active.splice(i,1);
     for(const [key,item] of critical)if(time>=item.born+item.life)critical.delete(key);
     if(!events.length||events[events.length-1].id<=lastId)return active.length+critical.size;
     for(const [key,end] of seen)if(time>=end)seen.delete(key);
     for(const [key,end] of cooldown)if(time>=end)cooldown.delete(key);
     const byId=new Map(fighters.map(f=>[f.id,f]));
     const candidates=[];
     for(const event of events){
       if(!Number.isSafeInteger(event.id)||event.id<=lastId)continue;
       lastId=event.id;
       const f=byId.get(event.fighterId as string);
       const focus=f?.control===true||f?.id===focusId&&focusId!=null;
       const at=labelAt(f,event),actor=event.fighterId;
       if(!at||typeof actor!=='string')continue;
       let cue:Cue|null=combatCallout(event,f,focus);
       if(f?.chessStyle==='pawn'&&f.chessPawn?.promoted&&!promoted.has(actor)&&['hit','launch'].includes(event.kind)){
         promoted.add(actor);
         cue={label:'PAWN PROMOTED',style:'PAWN → QUEEN',priority:4,tone:'promotion',life:1.05,key:'promotion:'+actor};
       }
       if(!cue||crowd&&!focus&&cue.priority<4)continue;
       const family=arcadeCalloutFamily(cue.label);
       if(family==='KO'||family==='PARRY'){
         // Reserve one pool per critical family before the generic placement
         // limit. Focus stays anchored separately; a six-label window must
         // not truncate six KOs plus six parries to only their first family.
         const key=(focus?actor:crowd?'crowd':f?actor:'untracked')+':'+family;
         const previous=active.findIndex(p=>p.actor===actor&&p.priority<=cue.priority);
         if(previous>=0)active.splice(previous,1);
         const bucket=critical.get(key);
         // Keep an anchored burst while it is fully visible. A later event opens
         // a fresh window rather than inheriting the fading bucket's age/count.
         // An ordinary merge does not renew either the anchor or the lifetime.
         const prior=bucket&&time<bucket.born+bucket.life-fadeTail(bucket.life)?bucket:undefined;
         const count=(prior?.count??0)+1;
         const short={...cue,label:count>1?family:shorten(cue.label,36),style:count>1?'':shorten(cue.style,24)};
         const box=candidateBox(short,crowd);
         critical.set(key,{...short,x:prior?.x??at.x,y:prior?.y??at.y,...box,offsetY:0,actor,focus,count,size:sizeOf(cue,crowd),
           born:prior?.born??time,life:prior?.life??Math.max(.70,finite(cue.life,.75)+.16)});
         continue;
       }
       candidates.push({actor,cue,focus,at,event});
     }
     candidates.sort((a,b)=>b.cue.priority-a.cue.priority||Number(b.focus)-Number(a.focus)||b.event.id-a.event.id);
     const placed=new Set();
     for(const {actor,cue,focus,at} of candidates){
       if(placed.has(actor)||seen.has(cue.key)||critical.has(actor+':KO')||critical.has(actor+':PARRY'))continue;
       const previous=active.findIndex(p=>p.actor===actor);
       if(previous>=0&&active[previous].priority>=cue.priority)continue;
       if((cooldown.get(actor)??0)>time&&cue.priority<3)continue;
       const full=active.length>=maxLabels;
       const weakest=full?active.reduce((i,p,j)=>Number(p.focus)<Number(active[i].focus)||
         p.focus===active[i].focus&&p.priority<active[i].priority?j:i,0):-1;
       if(full&&previous<0&&(active[weakest].focus&&!focus||
         active[weakest].focus===focus&&active[weakest].priority>=cue.priority))continue;
       const remove=previous>=0?previous:weakest;
       const short={...cue,label:shorten(cue.label,36),style:shorten(cue.style,24)};
       const {width,height}=candidateBox(short,crowd);
       const offset=chooseOffset(at.x,at.y,width,height,active.filter((_,i)=>i!==remove));
       if(!offset)continue;
       if(remove>=0)active.splice(remove,1);
       // Keep ordinary two-line cues beside a tight duel instead of above
       // a face (the lower subtitle is otherwise within the head silhouette).
       const first=duel[0], second=duel[1];
       const inCloseDuel=first&&second&&finitelyNear(first,second);
       const left=first&&second&&(first.x<second.x||first.x===second.x&&first.id<second.id)?first:second;
       const duelSide=inCloseDuel&&short.style&&short.priority<4?(actor===left?.id?-1:1):undefined;
       active.push({...short,actor,...at,duelSide,offsetY:offset.y,width,height,size:sizeOf(cue,crowd),
         focus,born:time,life:Math.max(.70,finite(cue.life,.75)+.16)});
       placed.add(actor);
       seen.set(cue.key,time+(cue.priority<=2?1.18:.91));
       if(cue.priority<3)cooldown.set(actor,time+(crowd?.52:.41));
     }
     return active.length+critical.size;
   },
   draw(ctx:CanvasRenderingContext2D,{reducedMotion=false}={}){
     const pool=[...critical.values(),...active];
     if(!pool.length)return;
     ctx.save();
     ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
     const inherited=finite(ctx.globalAlpha,1);
     // Team fights: same-label callouts merge with a count, big fights keep a small label
     // budget, and the player's own label and KO and parry cues always stay readable.
     const kept=declutterArcadeCallouts(pool.map((item,i)=>({actor:String(i),label:item.label,x:item.x,y:item.y+item.offsetY,
       priority:item.priority,focus:item.focus,weight:item.count})),{budget:arcadeCalloutBudget(roster)});
     for(const shown of kept){
       const item=pool[+shown.actor];
       const label=arcadeCalloutText(shown),merged=shown.count>1;
       const age=Math.max(0,time-item.born);
       const rise=reducedMotion?0:26*pop(max(age/item.life,0,1));
       let x=shown.x,y=shown.y-rise;
       ctx.globalAlpha=inherited*visibleAlpha(age,item.life);
       ctx.font='900 '+item.size+'px system-ui, sans-serif';
       ctx.lineWidth=4;ctx.strokeStyle=palette.ink;
       ctx.fillStyle=item.priority>=4?palette.bright:palette.gold;
       const labelWidth=merged?Math.min(213,Math.max(item.width,label.length*item.size*.54)):item.width;
       if(item.duelSide&&!merged&&duel.length===2){
         const [a,b]=duel, half=(labelWidth+4)*.5;
         const left=Math.min(a.x,b.x)-38-half, right=Math.max(a.x,b.x)+38+half;
         const prefer=item.duelSide<0?left:right;
         const t=ctx.getTransform?.(), width=ctx.canvas?.width;
         if(t&&width&&t.a>0&&((prefer-half)*t.a+t.e<4||(prefer+half)*t.a+t.e>width-4)){
           // A tight camera near the edge can have neither side. Keep the
           // original horizontal anchor, but above both heads rather than on them.
           y=Math.min(y,Math.min(a.y-finite(a.airHeight),b.y-finite(b.airHeight))-125-(item.duelSide<0?32:0));
         }else x=prefer;
       }
       ctx.strokeText(label,x,y,labelWidth);
       ctx.fillText(label,x,y,labelWidth);
       if(item.style&&!merged){
         ctx.font='800 '+Math.max(11,Math.round(item.size*.64))+'px system-ui, sans-serif';
         ctx.lineWidth=3;ctx.fillStyle=palette.light;
         ctx.strokeText(item.style,x,y+15,item.width);
         ctx.fillText(item.style,x,y+15,item.width);
       }
     }
     ctx.restore();
   },
 };
}

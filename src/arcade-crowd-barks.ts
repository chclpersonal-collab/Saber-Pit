/** Crowd barks: one or two words of speech over a fighter's head, for about a second.
 *  Read-only view of `crowd_bark` events (v6 crowd AI). No names, no descriptors, nothing permanent.
 *  Call update with wall-clock seconds, then draw inside the world transform after the fighters. */
interface BarkActor{id:string;x:number;y:number;airHeight?:number;alive?:boolean;face?:number}
interface BarkEvent{id:number;kind:string;fighterId?:string;bark?:unknown}
interface Bubble{actor:string;text:string;born:number;life:number;side:number}
const MAX_BUBBLES=3;
const LIFE=1.15;
const TEXTS=new Set(['Run!','Mine!','Help!','Come on!','Too easy','Now!','Hold!']);
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const finite=(n:unknown,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;

export function createArcadeBarks(){
  let lastId=0,time=0;
  const active:Bubble[]=[];
  let actors=new Map<string,BarkActor>();
  return {
    reset(){lastId=0;time=0;active.length=0;actors=new Map();},
    update(dt:number,events:readonly BarkEvent[]=[],fighters:readonly BarkActor[]=[]){
      time+=clamp(finite(dt),0,.25);
      for(let i=active.length-1;i>=0;i--)if(time>=active[i].born+active[i].life)active.splice(i,1);
      actors=new Map(fighters.map(f=>[f.id,f]));
      for(const e of events){
        if(!Number.isSafeInteger(e.id)||e.id<=lastId)continue;
        lastId=e.id;
        if(e.kind!=='crowd_bark'||typeof e.fighterId!=='string'||typeof e.bark!=='string'||!TEXTS.has(e.bark))continue;
        const prior=active.findIndex(b=>b.actor===e.fighterId);
        if(prior>=0)active.splice(prior,1);
        if(active.length>=MAX_BUBBLES)active.shift();
        const f=actors.get(e.fighterId);
        active.push({actor:e.fighterId,text:e.bark,born:time,life:LIFE,side:Math.cos(finite(f?.face))<0?-1:1});
      }
      return active.length;
    },
    /** Bubbles that are still showing, for tests and screenshots. */
    get visible(){return active.map(b=>({actor:b.actor,text:b.text}));},
    draw(ctx:CanvasRenderingContext2D,{reducedMotion=false}={}){
      if(!active.length)return;
      ctx.save();
      const inherited=finite(ctx.globalAlpha,1);
      ctx.font='700 13px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
      for(const b of active){
        const f=actors.get(b.actor);
        if(!f||!Number.isFinite(f.x)||!Number.isFinite(f.y))continue;
        const age=time-b.born;
        const fadeIn=reducedMotion?1:clamp(age/.09,0,1), fadeOut=clamp((b.life-age)/.22,0,1);
        const pop=reducedMotion?1:.86+.14*fadeIn;
        const w=Math.max(30,ctx.measureText(b.text).width+14)*pop, h=19*pop;
        const x=f.x+b.side*16, y=f.y-finite(f.airHeight)-74-(reducedMotion?0:4*clamp(age/b.life,0,1));
        ctx.globalAlpha=inherited*fadeIn*fadeOut*.96;
        // Small rounded speech bubble with a tail toward the speaker's head.
        ctx.beginPath();
        const r=7,l=x-w/2,t=y-h/2;
        ctx.moveTo(l+r,t);ctx.lineTo(l+w-r,t);ctx.quadraticCurveTo(l+w,t,l+w,t+r);ctx.lineTo(l+w,t+h-r);ctx.quadraticCurveTo(l+w,t+h,l+w-r,t+h);
        ctx.lineTo(x-b.side*2+4,t+h);ctx.lineTo(x-b.side*12,t+h+7);ctx.lineTo(x-b.side*2-4,t+h);
        ctx.lineTo(l+r,t+h);ctx.quadraticCurveTo(l,t+h,l,t+h-r);ctx.lineTo(l,t+r);ctx.quadraticCurveTo(l,t,l+r,t);ctx.closePath();
        ctx.fillStyle='#fbf6ec';ctx.strokeStyle='#1d1814';ctx.lineWidth=1.6;
        ctx.fill();ctx.stroke();
        ctx.fillStyle='#1d1814';
        ctx.fillText(b.text,x,y+.5,w-6);
      }
      ctx.restore();
    },
  };
}

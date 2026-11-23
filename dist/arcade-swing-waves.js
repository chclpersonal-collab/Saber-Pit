/** Presentation only: ink ribbons collected from the real drawn blade, no hits or pose changes. */
const AGE=.085, LIMIT=24, SEGMENTS=6, SAMPLE_SPACING=1/90;
const solid=['#6ac7bf','#ed886b'], paper=['#e5fff2','#ffe0cb'];
const ids=new Set(['main','off','rear']);
const thrust=/thrust|lunge|needle|pierce|point|stab|skewer/i;
const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const mix=(a,b,t)=>a+(b-a)*t;
const at=(p,r)=>({x:mix(p.hx,p.tx,r),y:mix(p.hy,p.ty,r)});
const abs=Math.abs;
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const norm=Math.hypot;
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const segmentNear=(p,a,b,r)=>{
  const dx=b.x-a.x,dy=b.y-a.y, ll=dx*dx+dy*dy;
  const t=ll>0?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/ll,0,1):0;
  return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2<r*r;
};


export function createArcadeSwingWaves(){
  const actors=new Map();
  function reset(){ actors.clear(); }
  function sample(f,blade,time,{reducedMotion=false}={}){
    if(f?.id==null||!Number.isFinite(time))return;
    if(reducedMotion||f.alive===false||f.saberOff){actors.delete(f.id);return;}
    let actor=actors.get(f.id);
    if(!f.attack||['force','free_hand','clash','stagger','ko'].includes(f.action)||f.attackSpec?.forceAbility||f.attackSpec?.freeHand||!Number.isFinite(f.actionTime)||!Number.isFinite(f.attackSpec?.contact)){
      if(actor)for(const h of actor.emitters.values())h.prev=null;
      return;
    }
    const spec=f.attackSpec,t=f.actionTime;
    const kitKey=[blade?.phase??f.saberPhase,f.gear?.weapon,f.gear?.grip].join('/');
    const motionKey=[f.attackSerial,f.technique??f.attack].join('/');
    if(actor&&(actor.kitKey!==kitKey||time<actor.time||time-actor.time>AGE)){
      actors.delete(f.id);actor=null;
    }
    if(actor&&(actor.key!==motionKey||t+.01<actor.actionTime)){
      // Finish fading the ink already on screen, but never connect two attacks.
      for(const h of actor.emitters.values())h.prev=null;
      actor.key=motionKey;
    }
    if(!actor){
      if(actors.size>=LIMIT)return;
      actor={key:motionKey,kitKey,team:f.team===1?1:0,emitters:new Map()};actors.set(f.id,actor);
    }
    actor.time=time;actor.actionTime=t;
    const lead=spec.leadBlade??(f.staffLead==='rear'?'rear':'main');
    const staff=blade?.blades?.some(e=>e.id==='rear');
    const entries=blade?.blades??[{id:'main',hand:blade?.hand,tip:blade?.tip}];
    for(const [id,h] of actor.emitters){
      if(!entries.some(e=>e.id===id&&point(e.hand)&&point(e.tip)))actor.emitters.delete(id);
    }
    for(const e of entries.slice(0,2)){
      if(!ids.has(e.id)||!point(e.hand)||!point(e.tip))continue;
      const other=staff?e.id!==lead:e.id==='off';
      const beat=other&&Number.isFinite(spec.offhand?.contact)?spec.offhand.contact:spec.contact;
      let h=actor.emitters.get(e.id);
      if(!h){h={prev:null,pieces:[]};actor.emitters.set(e.id,h);}
      const prior=h.prev;
      if(prior&&time-prior.at<SAMPLE_SPACING)continue;
      const now={hx:e.hand.x,hy:e.hand.y,tx:e.tip.x,ty:e.tip.y,at:time,t};
      h.prev=now;
      const wind=Math.min(.07,Math.max(.025,beat*.29));
      if(!prior||time-prior.at>.067||t<beat-wind||t>beat+.112)continue;
      const dx=now.tx-now.hx,dy=now.ty-now.hy, len=norm(dx,dy);
      const ox=prior.tx-prior.hx,oy=prior.ty-prior.hy, oldLen=norm(ox,oy);
      const mx=now.tx-prior.tx,my=now.ty-prior.ty,d=norm(mx,my);
      if(len<20||oldLen<20||d<1.6||d>70||norm(now.hx-prior.hx,now.hy-prior.hy)>28||
          abs(len-oldLen)>18||(dx*ox+dy*oy)<len*oldLen*.40)continue;
      const speed=d/(time-prior.at);
      if(speed<90)continue;
      const carry=1-.78*clamp((t-beat-.045)/.067,0,1);
      const linear=(f.attackFamily==='thrust'||spec.motion?.path==='point'||thrust.test([f.technique,spec.path,spec.family,spec.id].join(' ')))&&
        abs(cross(dx/len,dy/len,mx/d,my/d))<.56;
      // No material behind the actor. Staff emits two independent outer edges.
      const inner=staff?.68:entries.length>1?.63:.51;
      h.pieces.push({prior,now,linear,inner,other,weight:carry*clamp((speed-65)/350,.24,1),
        body:point(blade?.body)?{x:blade.body.x,y:blade.body.y}:null});
      if(h.pieces.length>SEGMENTS)h.pieces.shift();
    }
  }
  function draw(ctx,time,{reducedMotion=false}={}){
    if(reducedMotion){reset();return;}
    if(!Number.isFinite(time)||actors.size===0)return;
    ctx.save();
    try{
      ctx.lineJoin='round';ctx.lineCap='round';
      for(const [id,actor] of actors){
        if(time-actor.time>AGE||time<actor.time){actors.delete(id);continue;}
        for(const {pieces} of actor.emitters.values())for(const p of pieces){
          const age=(time-p.now.at)/AGE;
          if(age<0||age>=1)continue;
          const alpha=(1-age)**1.5*p.weight*(p.other?.73:1);
          const a=at(p.prior,p.inner+.16*age), b=at(p.now,p.inner);
          const tail=at(p.prior,1), head=at(p.now,1);
          // A chord can cross the body even when both endpoints are outside.
          // Suppress that slice instead of drawing a false cut across a torso.
          if(p.body&&(segmentNear(p.body,tail,head,15)||
              !p.linear&&(segmentNear(p.body,a,tail,15)||segmentNear(p.body,b,head,15)||
                segmentNear(p.body,a,b,17))))continue;
          const mid={x:(head.x+tail.x)/2,y:(head.y+tail.y)/2};
          ctx.beginPath();
          if(p.linear){
            // Three points along the actual tip track with only a slim ink edge.
            const d=norm(head.x-tail.x,head.y-tail.y);
            if(d<1)continue;
            const nx=(head.y-tail.y)/d,ny=(tail.x-head.x)/d;
            ctx.moveTo(tail.x,tail.y);
            ctx.lineTo(mid.x+nx*2.5,mid.y+ny*2.5);
            ctx.lineTo(head.x,head.y);
            ctx.lineTo(mid.x-nx*2.5,mid.y-ny*2.5);
          }else{
            // Two real blade silhouettes; the outer bezier merely rounds the
            // between-frame corner, with no extension of blade reach.
            const handleMid=at({hx:(p.prior.hx+p.now.hx)/2,hy:(p.prior.hy+p.now.hy)/2,
              tx:mid.x,ty:mid.y},p.inner+.13);
            ctx.moveTo(a.x,a.y);ctx.lineTo(tail.x,tail.y);
            ctx.quadraticCurveTo(mid.x,mid.y,head.x,head.y);
            ctx.lineTo(b.x,b.y);ctx.quadraticCurveTo(handleMid.x,handleMid.y,a.x,a.y);
          }
          ctx.closePath();
          ctx.globalAlpha=.65*alpha;ctx.fillStyle=solid[actor.team];ctx.fill();
          // Ink only the outer edge. Outlining every sampled slice makes an
          // otherwise continuous blade arc read as separate mechanical plates.
          ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);
          ctx.globalAlpha=.55*alpha;ctx.strokeStyle='#211917';ctx.lineWidth=p.linear?2:3.1;ctx.stroke();
          ctx.globalAlpha=.98*alpha;ctx.strokeStyle=paper[actor.team];ctx.lineWidth=p.linear?1.1:1.65;ctx.stroke();
        }
      }
    }finally{ctx.restore();}
  }
  return {reset,sample,draw};
}

/** Display clock follows requestAnimationFrame; match logic uses a fixed 120 Hz clock. */
export const FRAME_STEP = 1/120;
const clamp=(v,hi)=>Math.max(0,Math.min(v,hi));
const airFields=new Set(['airborne','airTime','airHeight','airProgress']);
const roundFields=['x','y','vx','vy','airborne','airHeight','airTime','airProgress','groundDistance','groundSpeed','actionTime'];
const mix=(a,b,w)=>a+(b-a)*w;
const WALK_SOURCE=Symbol.for('saber-pit.render-footwork');
export function newDisplayClock(){return {last:null,elapsed:0,count:0,fps:0};}
export function resetDisplayClock(clock){Object.assign(clock,newDisplayClock());}
export function displayDelta(clock,now){
  const real=clock.last===null?0:Math.max(0,(now-clock.last)/1000);
  clock.last=now;
  if(real>0&&real<.30){clock.elapsed+=real;clock.count++;
    if(clock.elapsed>=.55){clock.fps=Math.round(clock.count/clock.elapsed);clock.elapsed=0;clock.count=0;}
  }else if(real>=.30){clock.elapsed=0;clock.count=0;}
  return clamp(real,.075);
}
const MAX_STEPS=10;
export function advanceSim(state,dt,{blocked=false,playing,step}){
  if(blocked){state.remainder=0;state.previous=null;return;}
  state.remainder=clamp(state.remainder+dt,FRAME_STEP*MAX_STEPS);
  let count=0;
  while(state.remainder+1e-10>=FRAME_STEP&&playing()&&count<MAX_STEPS){
    step();state.remainder=Math.max(0,state.remainder-FRAME_STEP);count++;
  }
}
export function fighterSamples(fighters){
  return new Map(fighters.map(f=>[f.id,Object.fromEntries([...roundFields,'face','airPhase','action','technique','attack','alive'].map(key=>[key,f[key]]))]));
}
export function displayFighters(fighters,previous,remainder){
  if(!previous)return fighters;
  const w=clamp(remainder/FRAME_STEP,1);
  return fighters.map(f=>{
    const p=previous.get(f.id);
    if(!p)return f;
    const view={...f}, same=p.action===f.action&&p.technique===f.technique&&p.attack===f.attack&&p.actionTime<=f.actionTime;
    for(const key of roundFields){if((key==='actionTime'?same:!airFields.has(key)||p.airPhase===f.airPhase)&&Number.isFinite(p[key])&&Number.isFinite(f[key]))view[key]=mix(p[key],f[key],w);}
    // Presentation-only: after wall/body clipping, requested velocity can
    // differ from where the fighter actually went. The stable actor key lets
    // a visual foot plant survive these disposable interpolated views.
    if([p.x,p.y,f.x,f.y].every(Number.isFinite)){
      const dx=f.x-p.x,dy=f.y-p.y;
      view[WALK_SOURCE]={actor:f,dx,dy,speed:Math.hypot(dx,dy)/FRAME_STEP};
    }
    if(same&&Number.isFinite(p.face)&&Number.isFinite(f.face)){const turn=f.face-p.face;view.face=p.face+Math.atan2(Math.sin(turn),Math.cos(turn))*w;}
    return view;
  });
}

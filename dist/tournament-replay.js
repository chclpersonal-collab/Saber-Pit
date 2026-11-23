import {createArcadeSwingWaves} from './arcade-swing-waves.js?v=3.2.0';
import {readArcadeReducedMotion} from './arcade-motion-preference.js?v=2.43.0';
import {createTournamentReplay,TOURNAMENT_REPLAY_RULESET} from './arcade-tournament-sim.js?v=3.0.0';
import {arcadeReplayRules,supportsArcadeReplay} from './arcade-replay-rules.js?v=3.0.0';
import {createArcadeStage,drawArcadeStage,drawArcadeObstacle} from './arcade-stage.js?v=4.0.0';
import {createArcadeFX} from './arcade-fx.js?v=4.0.0';
import {actionFrame,stepActionFrame} from './arcade-camera.js?v=2.16.0';
import {createArcadeFloatingText} from './arcade-floating-text.js?v=2.42.0';
import {createReplayStepper} from './replay-stepper.js?v=3.0.0';
import {fighterSamples,displayFighters} from './arcade-display.js?v=2.44.0';

/** Read-only playback. It cannot settle a bracket, add K/D, or modify a save. */
export async function startTournamentPlayback(canvas,replay,options={}){
  if(!supportsArcadeReplay(replay?.ruleset,2,TOURNAMENT_REPLAY_RULESET))throw new RangeError('Unsupported solo replay rules.');
  const rules=await arcadeReplayRules(({2:219,3:220,4:221,5:222,6:223,7:226,8:226})[replay.ruleset]);
  return startArcadeTournamentPlayback(canvas,createTournamentReplay(replay,replay.plans,rules.createArcade),replay.terrain,rules,{...options,drawOnTimeout:replay.ruleset>=8});
}
export function startArcadeTournamentPlayback(canvas,game,terrain,rules,{onFrame=()=>{},onEnd=()=>{},showMemberNames=false,drawOnTimeout=false,followAction=false,speed=1}={}){
  const {stepArcade,drawArcadeFighter,sampleArcadeFighter,arcadeBladeWorld}=rules;
  const {width:W,height:H}=game;
  const ctx=canvas.getContext('2d',{alpha:false});
  const stage=createArcadeStage(W,H,game.round,{mapId:terrain,terrain:game.terrain});
  const reduced=readArcadeReducedMotion(), fx=createArcadeFX({contactLabels:false});
  const captions=createArcadeFloatingText(), swingWaves=createArcadeSwingWaves();
  let raf=0,last=null,paused=false,stopped=false,lastSecond=null,finishAt=null,reported=false,time=0;
  const clock=createReplayStepper({speed,playing:()=>game.phase==='playing',
    step:tick=>stepArcade(game,tick),sample:()=>fighterSamples(game.fighters)});
  const resetWallClock=()=>{last=null;};
  document.addEventListener('visibilitychange',resetWallClock);
  const clean=()=>document.removeEventListener('visibilitychange',resetWallClock);
  let focus={x:W/2,y:H/2,zoom:1};
  function draw(dt){
    const box=canvas.getBoundingClientRect(),dpr=Math.min(1.65,devicePixelRatio||1);
    const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const scale=Math.min(w/W,h/H);
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#181613';ctx.fillRect(0,0,w,h);
    const fighters=displayFighters(game.fighters,clock.previous,clock.remainder);
    if(followAction&&!reduced){
      focus=stepActionFrame(focus,actionFrame({width:W,height:H,fighters}),W,H,dt);
      const zoom=scale*focus.zoom;
      ctx.setTransform(zoom,0,0,zoom,w*.5-focus.x*zoom,h*.5-focus.y*zoom);
    }else ctx.setTransform(scale,0,0,scale,(w-W*scale)*.5,(h-H*scale)*.5);
    drawArcadeStage(ctx,stage,W,H,time,reduced);fx.drawGround(ctx);
    const paint=[];
    for(const f of fighters){
      const pose=f.action==='ko'&&finishAt!==null?{...f,actionTime:f.actionTime+Math.min(.8,time-finishAt)}:f;
      const rig=sampleArcadeFighter(pose,time,{reducedMotion:reduced});
      if(!reduced&&pose.alive&&!pose.saberOff){
        const blade=arcadeBladeWorld(pose,rig);
        fx.sampleBlade(pose,blade);
        if(pose.peasantMotion===true)swingWaves.sample(pose,blade,time);
      }else if(!reduced&&pose.peasantMotion===true)swingWaves.sample(pose,null,time);
      paint.push({pose,rig,depth:pose.y});
    }
    for(const wall of stage.obstacles??[])paint.push({wall,depth:wall.y+wall.height});
    fx.drawBladeTrails(ctx);
    swingWaves.draw(ctx,time,{reducedMotion:reduced||fighters.length>12});
    for(const {pose,rig,wall} of paint.sort((a,b)=>a.depth-b.depth)){
      if(wall)drawArcadeObstacle(ctx,stage,wall);
      else drawArcadeFighter(ctx,pose,time,{rig,reducedMotion:reduced,outline:pose.alive});
    }
    fx.drawAir(ctx);
    captions.draw(ctx,{reducedMotion:reduced});
    if(showMemberNames){
      ctx.save();ctx.textAlign='center';ctx.textBaseline='bottom';
      ctx.font='600 14px system-ui,sans-serif';ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='#171513';
      for(const f of fighters){
        if(!f.alive||!f.displayName)continue;
        const y=f.y-f.airHeight-82;
        const name=f.displayName.split(/\s+/)[0];
        ctx.fillStyle=f.team===0?'#ffdb98':'#ffab91';
        ctx.strokeText(name,f.x,y,100);ctx.fillText(name,f.x,y,100);
      }
      ctx.restore();
    }
  }
  function frame(now){
    if(stopped||paused)return;
    const elapsed=last===null||document.hidden?0:Math.max(0,(now-last)/1000);last=now;
    const dt=Math.min(.1,elapsed); // Visual effects only, not the simulation clock.
    time+=dt;
    if(!document.hidden&&game.phase==='playing')clock.advance(elapsed);
    if(game.phase!=='playing'&&finishAt===null)finishAt=time;
    captions.update(dt,game.events,game.fighters);
    fx.observe(game.events);fx.update(dt,reduced);draw(dt);
    const second=Math.ceil(Math.max(0,game.limit-game.time));
    if(second!==lastSecond){lastSecond=second;onFrame(second,game);}
    if(finishAt!==null&&time-finishAt>.85){
      if(!reported){reported=true;clean();onEnd(drawOnTimeout&&game.endReason==='timeout'?null:game.phase==='won'?0:game.phase==='lost'?1:null);}
      return;
    }
    raf=requestAnimationFrame(frame);
  }
  function pause(){paused=true;cancelAnimationFrame(raf);}
  function resume(){if(stopped||!paused||reported)return;paused=false;last=null;raf=requestAnimationFrame(frame);}
  function destroy(){stopped=true;cancelAnimationFrame(raf);clean();captions.reset();}
  raf=requestAnimationFrame(frame);
  return {pause,resume,destroy,setSpeed:clock.setSpeed};
}

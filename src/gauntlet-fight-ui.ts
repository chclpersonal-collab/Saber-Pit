/** The Gauntlet's live fight: the person steers the Blue solo fighter against the Pink trio.
 *  Keyboard uses the Arena's own bindings; touch gets a stick and four buttons. Nothing here writes a save:
 *  the page commits the finished bout once, through its own lock. */
import {arenaInputFrame} from './arcade-ui-input.js';
import {createHeldArenaKeys,isEditableTarget,keyMapFrom,loadKeyBindings,normalizeKey} from './arcade-keys.js';
import {createArcadeTouchOwner} from './arcade-touch.js?v=2.14.0';
import type {HumanBout,HumanControls} from './gauntlet-play.js';

type Rules={stepArcade:(game:never,tick:number)=>unknown;[key:string]:unknown};
type Playback={pause():void;resume():void;destroy():void};
type StartPlayback=(canvas:HTMLCanvasElement,game:unknown,terrain:string|undefined,rules:unknown,options:{
  drawOnTimeout?:boolean;showMemberNames?:boolean;followAction?:boolean;markedId?:string;captions?:boolean;
  onFrame?:(left:number,game:unknown)=>void;onEnd?:(winner:0|1|null)=>void})=>Playback;
interface FightHooks {
  status(text:string):void;
  pips(blue:boolean[],pink:boolean[]):void;
  ended(winner:0|1|null):void;
}
const clock=(n:number)=>n>=60?Math.floor(n/60)+':'+String(n%60).padStart(2,'0'):'0:'+String(n).padStart(2,'0');

export function startGauntletFight(canvas:HTMLCanvasElement,pad:HTMLElement,bout:HumanBout,start:StartPlayback,rules:Rules,hooks:FightHooks){
  const keys=new Set<string>(), pulse=new Set<string>(), held=createHeldArenaKeys(keys), touch=new Set<string>();
  const map=keyMapFrom(loadKeyBindings()), stick=createArcadeTouchOwner();
  const thumb=pad.querySelector<HTMLElement>('.g-stick span'), stickBox=pad.querySelector<HTMLElement>('.g-stick');
  let stopped=false;
  const controls=():HumanControls=>{
    const s=stick.snapshot();
    const frame=arenaInputFrame({held:name=>keys.has(name)||touch.has(name),pulse,fromStick:{x:s.x,y:s.y},aim:null,touchWalk:false,technique:()=>''},undefined);
    pulse.clear();
    return frame;
  };
  const down=(event:KeyboardEvent)=>{
    if(stopped||event.repeat&&map[normalizeKey(event.key)]!==undefined){if(!stopped)event.preventDefault();return;}
    if(isEditableTarget(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
    const action=map[normalizeKey(event.key)];
    if(!action||action==='stats'||action==='technique')return;
    event.preventDefault();held.press(event,action);pulse.add(action);
  };
  const up=(event:KeyboardEvent)=>held.release(event);
  const blur=()=>{held.clear();touch.clear();stick.cancel();paintStick();};
  function paintStick(){const s=stick.snapshot();if(thumb)thumb.style.transform=`translate(${s.thumbX}px,${s.thumbY}px)`;}
  const stickDown=(e:PointerEvent)=>{
    const box=stickBox!.getBoundingClientRect();
    if(stick.begin(e.pointerId,box.left+box.width/2,box.top+box.height/2,box.width/2)){stickBox!.setPointerCapture(e.pointerId);stick.move(e.pointerId,e.clientX,e.clientY);paintStick();e.preventDefault();}
  };
  const stickMove=(e:PointerEvent)=>{if(stick.move(e.pointerId,e.clientX,e.clientY))paintStick();};
  const stickUp=(e:PointerEvent)=>{if(stick.end(e.pointerId))paintStick();};
  const buttons=[...pad.querySelectorAll<HTMLButtonElement>('[data-act]')];
  const press=(e:PointerEvent)=>{const b=e.currentTarget as HTMLButtonElement,a=b.dataset.act!;e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(a);pulse.add(a);b.dataset.held='true';};
  const release=(e:PointerEvent)=>{const b=e.currentTarget as HTMLButtonElement;touch.delete(b.dataset.act!);b.dataset.held='false';};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  stickBox?.addEventListener('pointerdown',stickDown);stickBox?.addEventListener('pointermove',stickMove);
  stickBox?.addEventListener('pointerup',stickUp);stickBox?.addEventListener('pointercancel',stickUp);
  for(const b of buttons){b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('contextmenu',e=>e.preventDefault());}
  const fighters=bout.game.fighters as unknown as {team:number;alive:boolean}[];
  const report=()=>hooks.pips(fighters.filter(f=>f.team===0).map(f=>f.alive),fighters.filter(f=>f.team===1).map(f=>f.alive));
  const playback=start(canvas,bout.game,bout.fixture.terrain,{...rules,stepArcade:()=>bout.step(controls())},{
    drawOnTimeout:true,showMemberNames:false,followAction:true,captions:false,
    markedId:(bout.game.fighters[0] as unknown as {id:string}).id,
    onFrame(left){if(!stopped){hooks.status(clock(left<=1e-6?0:Math.ceil(left)));report();}},
    onEnd(winner){if(!stopped){report();cleanup();hooks.ended(winner);}},
  });
  function cleanup(){
    if(stopped)return;stopped=true;
    window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);
    stickBox?.removeEventListener('pointerdown',stickDown);stickBox?.removeEventListener('pointermove',stickMove);
    stickBox?.removeEventListener('pointerup',stickUp);stickBox?.removeEventListener('pointercancel',stickUp);
    for(const b of buttons){b.removeEventListener('pointerdown',press);b.removeEventListener('pointerup',release);b.removeEventListener('pointercancel',release);b.dataset.held='false';}
    held.clear();touch.clear();stick.cancel();paintStick();
  }
  return {
    pause:()=>playback.pause(),resume:()=>playback.resume(),
    /** Stop without settling anything: the bout is simply dropped. */
    abandon(){cleanup();playback.destroy();},
    /** After the result: keep the last frame, release the controls. */
    destroy(){cleanup();playback.destroy();},
  };
}

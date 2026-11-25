import {createMoba,stepMoba,mobaUpgradeCost,MOBA_FORMS,MOBA_FORM_IDS,MOBA_WIDTH,MOBA_HEIGHT,MOBA_MATCH_LIMIT} from './arcade-moba.js';
import type {MobaInput,MobaLane,MobaForm,MobaHero,MobaState} from './arcade-moba.js';
import {frameMobaCamera,mobaCanvasAim,type MobaView} from './arcade-moba-camera.js';
import {mobaDeathSource,mobaObjectiveCue,mobaFirstTowerDirection} from './arcade-moba-guidance.js';
import {bellRallyCue} from './arcade-moba-rally.js';
import {paintMobaTerrain,paintMobaField} from './arcade-moba-field.js';

function byId<T extends HTMLElement=HTMLElement>(id:string):T{
  const node=document.getElementById(id);
  if(!node)throw new Error('Missing Three Fronts control: '+id);
  return node as T;
}
const canvas=byId<HTMLCanvasElement>('field'), context=canvas.getContext('2d',{alpha:false})!;
const nodes={brief:byId('brief'),finished:byId('finished'),clock:byId('clock'),wave:byId('wave'),
  map:byId<HTMLButtonElement>('map'),blue:byId('blueStatus'),red:byId('redStatus'),blueKills:byId('blueKills'),redKills:byId('redKills'),vitals:byId('vitals'),hp:byId('heroHP'),energy:byId('heroEnergy'),level:byId('heroLevel'),record:byId('heroRecord'),form:byId('heroForm'),pause:byId<HTMLButtonElement>('pause'),
  leave:byId<HTMLButtonElement>('leave'),upgrade:byId<HTMLButtonElement>('upgrade'),result:byId('result'),
  bellStatus:byId('bellStatus'),detail:byId('resultInfo'),announce:byId('announce')};
// Isolated additive panel: no layout/file dependency on the match HUD.
const mountText=(tag:'aside'|'p'|'strong'|'small',id:string,parent:HTMLElement)=>{
  const el=document.createElement(tag);el.id=id;parent.append(el);return el;
};
const field=canvas.parentElement!;
const tactical=mountText('p','tacticalHint',field);tactical.hidden=true;
const direction=mountText('p','firstTowerPing',field);direction.hidden=true;
direction.setAttribute('aria-hidden','true');
mountText('strong','firstTowerArrow',direction).textContent='↑';
mountText('small','firstTowerLabel',direction).textContent='Pink Tower';
const respawn=mountText('aside','respawnOverlay',field);respawn.hidden=true;
respawn.setAttribute('aria-label','Respawn');
mountText('strong','respawnTitle',respawn).textContent='Knocked Out';
const respawnSource=mountText('p','respawnSource',respawn);
const respawnClock=mountText('p','respawnClock',respawn);
const respawnPaused=mountText('small','respawnPaused',respawn);respawnPaused.textContent='Paused';
const width=MOBA_WIDTH,height=MOBA_HEIGHT;
canvas.width=width;canvas.height=height;
const backdrop=paintMobaTerrain();
const formInput=byId<HTMLSelectElement>('saberForm'),formHint=byId('formHint');
const bellRally=byId<HTMLInputElement>('bellRally');
for(const id of MOBA_FORM_IDS){
  const option=document.createElement('option'),form=MOBA_FORMS[id];
  option.value=id;option.textContent=form.name;
  formInput.append(option);
}
const selectedForm=():MobaForm=>MOBA_FORM_IDS.find(key=>key===formInput.value)??MOBA_FORM_IDS[0];
const renderFormHint=()=>{const form=MOBA_FORMS[selectedForm()];formHint.textContent=form.role+', '+form.hp+' HP';};
formInput.addEventListener('change',renderFormHint);
renderFormHint();
const active=new Set<string>(), pulses=new Set<string>(), touches=new Map<number,string>(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
const keys:Readonly<Record<string,string>>={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right',j:'attack',k:'lunge',' ':'guard',u:'upgrade'};
let follow=true, view:MobaView={x:0,y:0,zoom:1,width,height};
let viewport={width:canvas.clientWidth,height:canvas.clientHeight};
const measureViewport=()=>{viewport={width:canvas.clientWidth,height:canvas.clientHeight};};
if(typeof ResizeObserver!=='undefined')new ResizeObserver(measureViewport).observe(canvas);
else window.addEventListener('resize',measureViewport);
let lastBellNotice='';
let game:MobaState=createMoba(), playing=false, paused=false, aim:{x:number;y:number;fromTouch:boolean}|null=null,
    prior=0, lastUi=-1, upgrade=false,lastAnnounced=0, previousAlive=true, knockoutSource:string|null=null;
const changeBattleControls=(canAct:boolean)=>{for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-control]'))btn.disabled=!canAct;};
const stamp=(el:HTMLElement,value:string)=>{if(el.textContent!==value)el.textContent=value;};
function renderCameraControl(){
  stamp(nodes.map,follow?'Overview':'Follow');
  nodes.map.setAttribute('aria-label',follow?'Overview':'Follow');
}
const press=(id:string)=>active.has(id)||Array.from(touches.values()).includes(id);
const setScreen=(screen:'brief'|'field'|'finished')=>{
  playing=screen==='field'; nodes.brief.hidden=screen!=='brief';nodes.finished.hidden=screen!=='finished';
  nodes.pause.hidden=!playing;nodes.leave.hidden=!playing;nodes.upgrade.hidden=!playing;nodes.map.hidden=!playing;
  document.querySelector('.controls')?.setAttribute('aria-hidden',String(!playing));
  changeBattleControls(playing&&!paused&&game.player.alive);
  respawn.hidden=!playing||game.player.alive;tactical.hidden=!playing||!game.player.alive;
};
function clearControls(){
  active.clear();pulses.clear();touches.clear();upgrade=false;
  for(const btn of document.querySelectorAll<HTMLElement>('[data-control]'))delete btn.dataset.held;
}
function begin(lane:MobaLane){
  game=createMoba((Date.now()^performance.now()*1000)>>>0,lane,selectedForm(),{bellRally:bellRally.checked,smartAI:true}); lastBellNotice='';aim=null;paused=false;prior=0;lastUi=-1;lastAnnounced=0;previousAlive=true;knockoutSource=null;
  follow=true;clearControls();setScreen('field');measureViewport();renderCameraControl();stamp(nodes.pause,'Pause');stamp(nodes.announce,'Deployed to '+['North','Center','South'][lane]);
  canvas.focus({preventScroll:true});renderHud();
}
function leave(){
  clearControls();paused=false;aim=null;lastAnnounced=0;previousAlive=true;knockoutSource=null;lastBellNotice='';bellRally.checked=false;game=createMoba();setScreen('brief');stamp(nodes.announce,'');renderHud();
  document.querySelector<HTMLButtonElement>('[data-lane="1"]')?.focus({preventScroll:true});
}
function pause(value:boolean){
  if(!playing)return;
  paused=value;clearControls();changeBattleControls(playing&&!paused&&game.player.alive);prior=0;stamp(nodes.pause,paused?'Resume':'Pause');
  stamp(nodes.announce,paused?'Paused':'Resumed');
  renderHud();if(!paused)canvas.focus({preventScroll:true});
}
for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-lane]')){
  btn.addEventListener('click',()=>begin(Number(btn.dataset.lane) as MobaLane));
}
byId('restart').addEventListener('click',leave);
function toggleCamera(){follow=!follow;aim=null;renderCameraControl();canvas.focus({preventScroll:true});}
nodes.map.addEventListener('click',toggleCamera);
nodes.leave.addEventListener('click',leave);nodes.pause.addEventListener('click',()=>pause(!paused));
nodes.upgrade.addEventListener('click',()=>{if(playing&&!paused){upgrade=true;canvas.focus({preventScroll:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
window.addEventListener('blur',()=>clearControls());
window.addEventListener('keydown',event=>{
  if(!playing||event.target instanceof HTMLButtonElement||event.target instanceof HTMLAnchorElement)return;
  if(event.key.toLowerCase()==='escape'&&!event.repeat){event.preventDefault();pause(!paused);return;}
  if(event.key.toLowerCase()==='m'&&!event.repeat){event.preventDefault();toggleCamera();return;}
  const key=keys[event.key.toLowerCase()];
  if(!key||paused||!game.player.alive)return;
  event.preventDefault();if(key==='upgrade'){if(!event.repeat)upgrade=true;}else {active.add(key);if(key==='attack'||key==='lunge')pulses.add(key);}
});
window.addEventListener('keyup',event=>active.delete(keys[event.key.toLowerCase()]));
function aimAt(event:PointerEvent){
  const target=mobaCanvasAim(view,canvas.getBoundingClientRect(),{x:event.clientX,y:event.clientY});
  if(target)aim={...target,fromTouch:event.pointerType==='touch'};
}
canvas.addEventListener('pointermove',event=>{if(playing&&event.pointerType!=='touch')aimAt(event);});
canvas.addEventListener('pointerdown',event=>{if(playing&&!paused&&game.player.alive)aimAt(event);});
for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-control]')){
  const key=btn.dataset.control!;
  btn.addEventListener('pointerdown',event=>{
    if(!playing||paused||!game.player.alive)return;
    // A new D-pad move leaves the previous touch aim behind; a fresh board
    // tap still aims the next attack or guard, and mouse aiming stays live.
    if(aim?.fromTouch&&(key==='up'||key==='down'||key==='left'||key==='right'))aim=null;
    event.preventDefault();if(key==='attack'||key==='lunge')pulses.add(key);btn.setPointerCapture(event.pointerId);touches.set(event.pointerId,key);btn.dataset.held='true';
  });
  const release=(event:PointerEvent)=>{touches.delete(event.pointerId);delete btn.dataset.held;};
  for(const event of ['pointerup','pointercancel','lostpointercapture'] as const)btn.addEventListener(event,release);
  btn.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&playing&&!paused&&game.player.alive){event.preventDefault();active.add(key);if(key==='attack'||key==='lunge')pulses.add(key);}
  });
  btn.addEventListener('keyup',event=>{if(event.key==='Enter'||event.key===' ')active.delete(key);});
  btn.addEventListener('blur',()=>active.delete(key));
}
function renderHud(){
  const clock=Math.max(0,Math.ceil(MOBA_MATCH_LIMIT-game.time));
  stamp(nodes.clock,playing||!nodes.finished.hidden?Math.floor(clock/60)+':'+String(clock%60).padStart(2,'0'):'10:00');
  stamp(nodes.wave,!playing&&nodes.finished.hidden?'Ready':!game.wave?'Wave Inbound':'Wave '+game.wave+' · '+Math.max(0,Math.ceil(game.nextWaveAt-game.time))+'s');
  for(const [team,el,kos] of [[0,nodes.blue,nodes.blueKills],[1,nodes.red,nodes.redKills]] as const){
    const core=game.cores[team], towers=game.towers.filter(t=>t.team===team&&t.alive).length;
    const percent=Math.max(0,Math.min(100,Math.ceil(core.hp/core.maxHp*100)));
    el.setAttribute('data-towers',String(towers));
    el.setAttribute('data-core',core.shielded?'shield':String(percent));
    stamp(el,(core.shielded?'Shielded':percent+'% Core')+' · '+towers+'/3 Towers');
    // Opposing hero deaths count actual knockouts, including minion/tower kills.
    const total=game.heroes.reduce((n,h)=>n+(h.team!==team?h.deaths:0),0);
    stamp(kos,String(total));
    kos.setAttribute('aria-label',(team===0?'Blue':'Pink')+' knockouts: '+total);
  }
  const bell=playing?bellRallyCue(game.bellRally,game.tick):null;
  nodes.bellStatus.hidden=!bell;
  if(bell){stamp(nodes.bellStatus,bell.label);nodes.bellStatus.dataset.phase=bell.phase;nodes.bellStatus.dataset.team=bell.team===undefined?'':String(bell.team);}
  const p=game.player, down=playing&&!p.alive;
  respawn.hidden=!down;tactical.hidden=!playing||down;
  if(down){
    respawnSource.hidden=!knockoutSource;
    stamp(respawnSource,knockoutSource?'Knocked out by '+knockoutSource:'');
    stamp(respawnClock,'Respawn in '+Math.max(0,Math.ceil(p.respawnAt-game.time))+'s');
    respawnPaused.hidden=!paused;
  }
  if(!tactical.hidden){
    const cue=mobaObjectiveCue(game);
    tactical.setAttribute('data-warning',String(cue.warning));
    stamp(tactical,cue.label);
  }
  stamp(nodes.form,playing?(!p.alive?'Respawn '+Math.max(0,Math.ceil(p.respawnAt-game.time))+'s':MOBA_FORMS[p.form].name):'Ready');
  stamp(nodes.hp,playing?String(Math.ceil(p.hp)):'—');
  stamp(nodes.energy,playing?String(Math.floor(p.energy)):'—');
  stamp(nodes.level,playing?String(p.level):'—');
  stamp(nodes.record,playing?p.kills+'/'+p.deaths:'—');
  const cost=mobaUpgradeCost(p),canBuy=p.alive&&Math.hypot(p.x-game.cores[0].x,p.y-game.cores[0].y)<=123&&cost!==null&&p.credits>=cost;
  stamp(nodes.upgrade,cost===null?'Maxed':'Upgrade '+p.credits+'/'+cost);
  nodes.upgrade.disabled=!playing||paused||!canBuy;
  nodes.upgrade.title='Buy at your Core';
  // The terminal frame owns its live-region result; HUD updates only announce
  // in-match tower changes and this player's respawn.
  if(!playing||game.phase!=='playing'||!p.alive)return;
  const objective=game.events.findLast(e=>e.id>lastAnnounced&&(e.type==='tower'||e.type==='respawn'&&e.actorId===p.id));
  if(bell?.notice&&bell.notice!==lastBellNotice){
    lastBellNotice=bell.notice;stamp(nodes.announce,bell.notice);
  }
  else if(objective){
    lastAnnounced=objective.id;
    stamp(nodes.announce,objective.type==='tower'?(objective.team===0?'Pink tower down':'Blue tower down'):'Respawned');
  }
}
const moving=new Set<MobaHero>();
function paintFirstTowerPing(){
  const pos=playing&&follow?mobaFirstTowerDirection(game,view):null;
  direction.hidden=!pos;
  if(!pos)return;
  const fit=Math.min(viewport.width/view.width,viewport.height/view.height);
  if(fit<=0){direction.hidden=true;return;}
  const width=view.width*fit,height=view.height*fit;
  const insetX=(viewport.width-width)*.5,insetY=(viewport.height-height)*.5;
  const horizontal=Math.abs(pos.x-.5)/.42>=Math.abs(pos.y-.5)/.38-1e-6;
  const side=horizontal?(pos.x>.5?'right':'left'):(pos.y>.5?'bottom':'top');
  direction.setAttribute('data-edge',side);
  const x=side==='right'?width-3:side==='left'?3:Math.max(72,Math.min(width-72,pos.x*width));
  const y=side==='bottom'?height-5:side==='top'?52:Math.min(92,Math.max(53,height*.13));
  direction.style.left=insetX+x+'px';
  direction.style.top=insetY+y+'px';
  direction.style.setProperty('--edge-angle',pos.angle+'rad');
}
function frame(now:number){
  const dt=prior?Math.min(.075,Math.max(0,(now-prior)/1000)):0;prior=now;
  if(playing&&!paused&&!document.hidden){
    const input:MobaInput={moveX:Number(press('right'))-Number(press('left')),moveY:Number(press('down'))-Number(press('up')),
      attack:press('attack')||pulses.has('attack'),lunge:press('lunge')||pulses.has('lunge'),guard:press('guard'),useUpgrade:upgrade,...(aim?{aimX:aim.x,aimY:aim.y}:{})};
    if(dt>0){stepMoba(game,dt,input);upgrade=false;pulses.clear();}
    if(game.phase!=='playing'){
      setScreen('finished');clearControls();
      stamp(nodes.result,game.phase==='won'?'Victory':game.phase==='lost'?'Defeat':'Draw');
      nodes.detail.replaceChildren(...[game.endReason==='timeout'?'Time Out':null,'Lv '+game.player.level,game.player.kills+' KOs'].filter((x):x is string=>Boolean(x)).flatMap((text,i)=>{const chip=document.createElement('span');chip.className='v6-meta';chip.textContent=text;return i?[' ',chip]:[chip];}));
      stamp(nodes.announce,nodes.result.textContent??'Match over');
      byId('restart').focus({preventScroll:true});renderHud();
    }else if(previousAlive!==game.player.alive){
      previousAlive=game.player.alive;
      clearControls();changeBattleControls(previousAlive);
      if(!previousAlive){
        aim=null;
        knockoutSource=mobaDeathSource(game);
        stamp(nodes.announce,knockoutSource?'Knocked out by '+knockoutSource:'Knocked out');
      }
      renderHud();lastUi=now;
    }else if(now-lastUi>100){renderHud();lastUi=now;}
  }
  if(!document.hidden){
    moving.clear();
    if(!reduced.matches)for(const p of game.heroes)if(Math.hypot(p.vx,p.vy)>22)moving.add(p);
    view=frameMobaCamera(game.player,playing&&follow,viewport);
    if(canvas.width!==view.width)canvas.width=view.width;
    if(canvas.height!==view.height)canvas.height=view.height;
    paintFirstTowerPing();
    paintMobaField(context,backdrop,game,playing?game.player:undefined,moving,view,!reduced.matches);
  }
  requestAnimationFrame(frame);
}
setScreen('brief');renderHud();requestAnimationFrame(frame);

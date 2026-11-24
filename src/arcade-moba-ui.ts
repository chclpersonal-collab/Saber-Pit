import {createMoba,stepMoba,mobaUpgradeCost,MOBA_FORMS,MOBA_FORM_IDS,MOBA_WIDTH,MOBA_HEIGHT,MOBA_MATCH_LIMIT} from './arcade-moba.js';
import type {MobaInput,MobaLane,MobaForm,MobaHero,MobaState} from './arcade-moba.js';
import {paintMobaTerrain,paintMobaField} from './arcade-moba-field.js';

function byId<T extends HTMLElement=HTMLElement>(id:string):T{
  const node=document.getElementById(id);
  if(!node)throw new Error('Missing Three Fronts control: '+id);
  return node as T;
}
const canvas=byId<HTMLCanvasElement>('field'), context=canvas.getContext('2d',{alpha:false})!;
const nodes={brief:byId('brief'),finished:byId('finished'),clock:byId('clock'),wave:byId('wave'),
  map:byId<HTMLButtonElement>('map'),blue:byId('blueStatus'),red:byId('redStatus'),vitals:byId('vitals'),pause:byId<HTMLButtonElement>('pause'),
  leave:byId<HTMLButtonElement>('leave'),upgrade:byId<HTMLButtonElement>('upgrade'),result:byId('result'),
  detail:byId('resultInfo'),announce:byId('announce')};
const width=MOBA_WIDTH,height=MOBA_HEIGHT;
canvas.width=width;canvas.height=height;
const backdrop=paintMobaTerrain();
const formInput=byId<HTMLSelectElement>('saberForm'),formHint=byId('formHint');
for(const id of MOBA_FORM_IDS){
  const option=document.createElement('option'),form=MOBA_FORMS[id];
  option.value=id;option.textContent=form.name+' · '+form.role;
  formInput.append(option);
}
const selectedForm=():MobaForm=>MOBA_FORM_IDS.find(key=>key===formInput.value)??MOBA_FORM_IDS[0];
const renderFormHint=()=>{formHint.textContent=MOBA_FORMS[selectedForm()].description;};
formInput.addEventListener('change',renderFormHint);
renderFormHint();
const active=new Set<string>(), pulses=new Set<string>(), touches=new Map<number,string>(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
const keys:Readonly<Record<string,string>>={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right',j:'attack',k:'lunge',' ':'guard',u:'upgrade'};
const mobile=matchMedia('(max-width: 720px)');
let follow=true, view={x:0,y:0,zoom:1};
let game:MobaState=createMoba(), playing=false, paused=false, aim:{x:number;y:number}|null=null,
    prior=0, lastUi=-1, upgrade=false,lastAnnounced=0;
const stamp=(el:HTMLElement,value:string)=>{if(el.textContent!==value)el.textContent=value;};
const press=(id:string)=>active.has(id)||Array.from(touches.values()).includes(id);
const setScreen=(screen:'brief'|'field'|'finished')=>{
  playing=screen==='field'; nodes.brief.hidden=screen!=='brief';nodes.finished.hidden=screen!=='finished';
  nodes.pause.hidden=!playing;nodes.leave.hidden=!playing;nodes.upgrade.hidden=!playing;nodes.map.hidden=!playing;
  document.querySelector('.controls')?.setAttribute('aria-hidden',String(!playing));
  for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-control]'))btn.disabled=!playing;
};
function clearControls(){
  active.clear();pulses.clear();touches.clear();upgrade=false;
  for(const btn of document.querySelectorAll<HTMLElement>('[data-control]'))delete btn.dataset.held;
}
function begin(lane:MobaLane){
  game=createMoba((Date.now()^performance.now()*1000)>>>0,lane,selectedForm()); aim=null;paused=false;prior=0;lastUi=-1;lastAnnounced=0;
  follow=mobile.matches;clearControls();setScreen('field');stamp(nodes.pause,'Pause');stamp(nodes.announce,['North','Center','South'][lane]+' front deployed.');
  canvas.focus({preventScroll:true});renderHud();
}
function leave(){
  clearControls();paused=false;aim=null;game=createMoba();setScreen('brief');renderHud();
  document.querySelector<HTMLButtonElement>('[data-lane="1"]')?.focus();
}
function pause(value:boolean){
  if(!playing)return;
  paused=value;clearControls();prior=0;stamp(nodes.pause,paused?'Resume':'Pause');
  stamp(nodes.announce,paused?'Match paused.':'Match resumed.');
  if(!paused)canvas.focus({preventScroll:true});
}
for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-lane]')){
  btn.addEventListener('click',()=>begin(Number(btn.dataset.lane) as MobaLane));
}
byId('restart').addEventListener('click',leave);
nodes.map.addEventListener('click',()=>{follow=!follow;canvas.focus({preventScroll:true});});
nodes.leave.addEventListener('click',leave);nodes.pause.addEventListener('click',()=>pause(!paused));
nodes.upgrade.addEventListener('click',()=>{if(playing&&!paused){upgrade=true;canvas.focus({preventScroll:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
window.addEventListener('blur',()=>clearControls());
window.addEventListener('keydown',event=>{
  if(!playing||event.target instanceof HTMLButtonElement||event.target instanceof HTMLAnchorElement)return;
  if(event.key.toLowerCase()==='escape'&&!event.repeat){event.preventDefault();pause(!paused);return;}
  const key=keys[event.key.toLowerCase()];
  if(!key||paused)return;
  event.preventDefault();if(key==='upgrade'){if(!event.repeat)upgrade=true;}else {active.add(key);if(key==='attack'||key==='lunge')pulses.add(key);}
});
window.addEventListener('keyup',event=>active.delete(keys[event.key.toLowerCase()]));
function aimAt(event:PointerEvent){
  const rect=canvas.getBoundingClientRect(),fit=Math.min(rect.width/width,rect.height/height);
  if(fit<=0)return;
  const x=(event.clientX-rect.left-(rect.width-width*fit)/2)/fit,
    y=(event.clientY-rect.top-(rect.height-height*fit)/2)/fit;
  if(x>=0&&y>=0&&x<=width&&y<=height)aim={x:view.x+x/view.zoom,y:view.y+y/view.zoom};
}
canvas.addEventListener('pointermove',event=>{if(playing&&event.pointerType!=='touch')aimAt(event);});
canvas.addEventListener('pointerdown',event=>{if(playing&&!paused)aimAt(event);});
for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-control]')){
  const key=btn.dataset.control!;
  btn.addEventListener('pointerdown',event=>{
    if(!playing||paused)return;
    event.preventDefault();if(key==='attack'||key==='lunge')pulses.add(key);btn.setPointerCapture(event.pointerId);touches.set(event.pointerId,key);btn.dataset.held='true';
  });
  const release=(event:PointerEvent)=>{touches.delete(event.pointerId);delete btn.dataset.held;};
  for(const event of ['pointerup','pointercancel','lostpointercapture'] as const)btn.addEventListener(event,release);
  btn.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&playing&&!paused){event.preventDefault();active.add(key);if(key==='attack'||key==='lunge')pulses.add(key);}
  });
  btn.addEventListener('keyup',event=>{if(event.key==='Enter'||event.key===' ')active.delete(key);});
  btn.addEventListener('blur',()=>active.delete(key));
}
function renderHud(){
  const clock=Math.max(0,Math.ceil(MOBA_MATCH_LIMIT-game.time));
  stamp(nodes.clock,playing||!nodes.finished.hidden?Math.floor(clock/60)+':'+String(clock%60).padStart(2,'0'):'10:00');
  stamp(nodes.wave,!playing&&nodes.finished.hidden?'AWAITING DEPLOYMENT':!game.wave?'WAVE INBOUND':'WAVE '+game.wave+' · '+Math.max(0,Math.ceil(game.nextWaveAt-game.time))+'S');
  for(const [team,el] of [[0,nodes.blue],[1,nodes.red]] as const){
    const p=game.cores[team], towers=game.towers.filter(t=>t.team===team&&t.alive).length;
    stamp(el,(p.shielded?'Shielded':Math.ceil(p.hp/p.maxHp*100)+'% Core')+' · '+towers+' / 3 towers');
  }
  const p=game.player;
  const stats=playing?MOBA_FORMS[p.form].name+' · Lv '+p.level+' · '+Math.ceil(p.hp)+' HP · '+Math.floor(p.energy)+' stamina · '+p.kills+'/'+p.deaths+' K/D':'Ready to deploy';
  stamp(nodes.vitals,playing&&!p.alive?'Respawn in '+Math.max(0,Math.ceil(p.respawnAt-game.time))+'s · '+stats:stats);
  const cost=mobaUpgradeCost(p),canBuy=p.alive&&Math.hypot(p.x-game.cores[0].x,p.y-game.cores[0].y)<=123&&cost!==null&&p.credits>=cost;
  stamp(nodes.upgrade,cost===null?'Kit maxed':'Upgrade '+p.credits+'/'+cost);
  nodes.upgrade.disabled=!playing||paused||!canBuy;
  nodes.upgrade.title='Buy a kit upgrade at the allied Core';
  const objective=game.events.findLast(e=>e.id>lastAnnounced&&(e.type==='tower'||e.type==='core'||e.type==='respawn'&&e.actorId===p.id));
  if(objective){
    lastAnnounced=objective.id;
    stamp(nodes.announce,objective.type==='tower'?(objective.team===0?'Enemy tower destroyed.':'Allied tower lost.'):'Respawn complete.');
  }
}
const moving=new Set<MobaHero>();
function frame(now:number){
  const dt=prior?Math.min(.075,Math.max(0,(now-prior)/1000)):0;prior=now;
  if(playing&&!paused&&!document.hidden){
    const input:MobaInput={moveX:Number(press('right'))-Number(press('left')),moveY:Number(press('down'))-Number(press('up')),
      attack:press('attack')||pulses.has('attack'),lunge:press('lunge')||pulses.has('lunge'),guard:press('guard'),useUpgrade:upgrade,...(aim?{aimX:aim.x,aimY:aim.y}:{})};
    if(dt>0){stepMoba(game,dt,input);upgrade=false;pulses.clear();}
    if(game.phase!=='playing'){
      setScreen('finished');clearControls();
      stamp(nodes.result,game.phase==='won'?'Siege won':game.phase==='lost'?'Citadel lost':'Stalemate');
      stamp(nodes.detail,(game.endReason==='timeout'?'Time limit. ':'')+'You finished level '+game.player.level+' with '+game.player.kills+' knockouts.');
      stamp(nodes.announce,nodes.result.textContent??'Match complete.');
      byId('restart').focus({preventScroll:true});renderHud();
    }else if(now-lastUi>100){renderHud();lastUi=now;}
  }
  if(!document.hidden){
    moving.clear();
    if(!reduced.matches)for(const p of game.heroes)if(Math.hypot(p.vx,p.vy)>22)moving.add(p);
    const zoom=playing&&follow?2.1:1;
    view={zoom,x:Math.max(0,Math.min(width-width/zoom,game.player.x-width/(2*zoom))),
      y:Math.max(0,Math.min(height-height/zoom,game.player.y-height/(2*zoom)))};
    stamp(nodes.map,zoom>1?'Full map':'Follow');
    paintMobaField(context,backdrop,game,playing?game.player:undefined,moving,view,!reduced.matches);
  }
  requestAnimationFrame(frame);
}
setScreen('brief');renderHud();requestAnimationFrame(frame);

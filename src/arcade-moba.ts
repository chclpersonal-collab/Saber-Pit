/** Standalone, fixed-step, local Arena MOBA. No Arena career or tournament writes. */
export const MOBA_WIDTH=1280, MOBA_HEIGHT=720;
export const MOBA_LANES=[165,360,555] as const;
export const MOBA_WAVE_INTERVAL=12, MOBA_MATCH_LIMIT=600;
const DT=1/60, HERO_RADIUS=15;
export type MobaTeam=0|1;
export type MobaLane=0|1|2;
export type MobaPoint={x:number;y:number};
export type MobaInput={moveX?:number;moveY?:number;attack?:boolean;lunge?:boolean;guard?:boolean;aimX?:number;aimY?:number;useUpgrade?:boolean};
export type MobaUnit=MobaPoint&{id:string;team:MobaTeam;lane:MobaLane;hp:number;maxHp:number;alive:boolean;radius:number;kind:'hero'|'minion'|'tower'|'core'};
export type MobaHero=MobaUnit&{
  kind:'hero'; name:string;control:boolean;face:number;vx:number;vy:number;action:'idle'|'run'|'guard'|'slash'|'rush'|'ko';
  actionTime:number;energy:number;level:number;xp:number;credits:number;upgrade:number;kills:number;deaths:number;
  respawnAt:number; cooldown:number; lungeCooldown:number; spawnProtectUntil:number;upgradingUntil:number;
};
export type MobaMinion=MobaUnit&{kind:'minion';face:number;cooldown:number;ranged:boolean};
export type MobaStructure=MobaUnit&{kind:'tower'|'core';cooldown:number;shielded:boolean};
export type MobaEvent={id:number;time:number;type:'attack'|'lunge'|'hit'|'ko'|'respawn'|'wave'|'tower'|'core'|'level'|'upgrade';team:MobaTeam;actorId?:string;targetId?:string;x:number;y:number;value?:number};
export type MobaState={
  seed:number;tick:number;time:number;phase:'playing'|'won'|'lost'|'draw';winner:MobaTeam|null;endReason:'core'|'timeout'|null;
  heroes:MobaHero[]; minions:MobaMinion[]; towers:MobaStructure[]; cores:MobaStructure[];
  player:MobaHero;events:MobaEvent[];nextWaveAt:number;wave:number;remainder:number;eventId:number;
  pendingAttack:boolean;pendingLunge:boolean;pendingUpgrade:boolean;
};
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const gap=(a:MobaPoint,b:MobaPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const direction=(team:MobaTeam)=>team===0?1:-1;
const enemyTeam=(team:MobaTeam):MobaTeam=>team===0?1:0;
const homeX=(team:MobaTeam)=>team===0?72:1208;
const spawnX=(team:MobaTeam)=>team===0?115:1165;
const rotate=(xs:MobaHero[],i:number)=>xs.slice(i).concat(xs.slice(0,i));
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:0;
const positiveAngle=(r:number)=>Math.atan2(Math.sin(r),Math.cos(r));
const lanes=[0,1,2] as const;
const sides=[0,1] as const;
const heroNames=[['Wren','Mica','Arden','Rowan','Cinder'],['Sable','Flint','Ash','Vesper','Briar']];
function emit(s:MobaState,type:MobaEvent['type'],actor:MobaUnit,target?:MobaUnit,value?:number){
  const p=target??actor;
  s.events.push({id:++s.eventId,time:s.time,type,team:actor.team,actorId:actor.id,targetId:target?.id,x:p.x,y:p.y,value});
  if(s.events.length>96)s.events.shift();
}
function setAction(h:MobaHero,action:MobaHero['action']){
  if(h.action!==action){h.action=action;h.actionTime=0;}
}
function structure(team:MobaTeam,lane:MobaLane,kind:MobaStructure['kind']):MobaStructure {
  const core=kind==='core', maxHp=core?930:420;
  return {team,lane,kind,id:kind+'-'+team+(core?'':'-'+lane),
    x:core?homeX(team):team===0?365:915,y:core?MOBA_LANES[1]:MOBA_LANES[lane],
    hp:maxHp,maxHp,alive:true,radius:core?30:22,shielded:core,cooldown:0};
}
export function createMoba(seed=1,playerLane:MobaLane=1):MobaState {
  const lane=lanes.includes(playerLane)?playerLane:1;
  const towers=sides.flatMap(team=>lanes.map(l=>structure(team,l,'tower')));
  const cores=sides.map(team=>structure(team,1,'core'));
  const heroes=sides.flatMap(team=>[0,0,1,2,2].map((v,index):MobaHero=>{
    const l=v as MobaLane, mirrored=((seed>>>0)+(l*13+index*7))%17-8;
    return {id:'hero-'+team+'-'+index,kind:'hero',team,lane:l,control:false,name:heroNames[team][index],
      x:spawnX(team)+mirrored*direction(team),y:MOBA_LANES[l]+(index===1||index===4?22:-12),
      hp:150,maxHp:150,alive:true,radius:HERO_RADIUS,face:team===0?0:Math.PI,vx:0,vy:0,
      energy:100,action:'idle',actionTime:0,level:1,xp:0,credits:0,upgrade:0,kills:0,deaths:0,
      respawnAt:0,cooldown:0,lungeCooldown:0,spawnProtectUntil:0,upgradingUntil:0};
  }));
  const player=heroes.find(h=>h.team===0&&h.lane===lane)!;
  player.control=true;
  return {seed:seed>>>0,tick:0,time:0,phase:'playing',winner:null,endReason:null,heroes,minions:[],towers,cores,player,
    events:[],nextWaveAt:.5,wave:0,remainder:0,eventId:0,pendingAttack:false,pendingLunge:false,pendingUpgrade:false};
}
function wave(s:MobaState){
  ++s.wave;
  for(const team of sides)for(const lane of lanes)for(let i=0;i<4;i++){
    const ranged=i===3,maxHp=(ranged?34:52)+Math.min(28,Math.floor((s.wave-1)/3)*3);
    s.minions.push({id:'wave-'+s.wave+'-'+team+'-'+lane+'-'+i,kind:'minion',team,lane,
      x:spawnX(team)+direction(team)*(35-i*14),y:MOBA_LANES[lane]+[0,-13,13,0][i],
      hp:maxHp,maxHp,alive:true,radius:ranged?7:8,face:team===0?0:Math.PI,cooldown:i*.11,ranged});
  }
  s.nextWaveAt+=MOBA_WAVE_INTERVAL;
  emit(s,'wave',s.cores[0],undefined,s.wave);
}
function levelCheck(s:MobaState,h:MobaHero){
  while(h.level<8&&h.xp>=h.level*38){
    ++h.level;h.maxHp+=12;if(h.alive)h.hp=Math.min(h.maxHp,h.hp+12);
    emit(s,'level',h,undefined,h.level);
  }
}
function reward(s:MobaState,actor:MobaUnit,target:MobaUnit){
  const personal=actor.kind==='hero'?actor as MobaHero:null;
  for(const h of s.heroes){
    if(h.team!==actor.team||!h.alive||(h!==personal&&gap(h,target)>175))continue;
    h.xp+=target.kind==='hero'?42:target.kind==='tower'?38:h===personal?16:8;
    h.credits+=target.kind==='hero'?(h===personal?38:16):target.kind==='tower'?24:h===personal?10:4;
    levelCheck(s,h);
  }
  if(personal&&target.kind==='hero')personal.kills++;
}
function vulnerable(s:MobaState,t:MobaUnit){
  return t.alive&&!(t.kind==='core'&&(t as MobaStructure).shielded)&&
    !(t.kind==='hero'&&(t as MobaHero).spawnProtectUntil>s.time);
}
function damage(s:MobaState,actor:MobaUnit,target:MobaUnit,raw:number){
  if(!vulnerable(s,target)||!actor.alive||target.team===actor.team)return;
  const hero=target.kind==='hero'?target as MobaHero:null;
  const guarded=hero?.action==='guard'&&hero.energy>=5&&
    Math.abs(positiveAngle(Math.atan2(actor.y-target.y,actor.x-target.x)-hero.face))<1.16;
  if(guarded)hero.energy=Math.max(0,hero.energy-8);
  const amount=Math.min(target.hp,guarded?raw*.35:raw);
  target.hp=Math.max(0,target.hp-amount);
  // Keep a combat ribbon for meaningful hero actions and structure damage,
  // not dozens of simultaneous minion trades.
  if(actor.kind==='hero'||target.kind!=='minion')emit(s,'hit',actor,target,amount);
  if(target.hp>0)return;
  target.alive=false;
  reward(s,actor,target);
  if(hero){hero.deaths++;hero.respawnAt=s.time+Math.min(14,7+hero.level*.65);hero.vx=0;hero.vy=0;setAction(hero,'ko');emit(s,'ko',actor,target);}
  else if(target.kind==='tower'){
    s.cores[target.team].shielded=false;
    emit(s,'tower',actor,target);
  }
  else if(target.kind==='core'){
    emit(s,'core',actor,target);
    finish(s,actor.team,'core');
  }
}
function finish(s:MobaState,winner:MobaTeam|null,endReason:MobaState['endReason']){
  s.winner=winner;s.endReason=endReason;s.phase=winner===0?'won':winner===1?'lost':'draw';
}
function nearest<T extends MobaUnit>(origin:MobaPoint,pool:readonly T[],test:(a:T)=>boolean):T|undefined{
  let result:T|undefined, distance=Infinity;
  for(const a of pool)if(test(a)){
    const d=gap(origin,a);
    if(d<distance){distance=d;result=a;}
  }
  return result;
}
function move(h:MobaHero,dx:number,dy:number,speed:number,aim?:number){
  const length=Math.hypot(dx,dy), factor=length>1?1/length:1;
  h.vx=dx*factor*speed;h.vy=dy*factor*speed;
  h.x=clamp(h.x+h.vx*DT,34,MOBA_WIDTH-34);
  h.y=clamp(h.y+h.vy*DT,55,MOBA_HEIGHT-55);
  if(aim!==undefined)h.face=aim;
  else if(length>.06)h.face=Math.atan2(dy,dx);
  return length>.06;
}
function moveToward(h:MobaHero,p:MobaPoint,speed=126,aim?:number){
  const d=gap(h,p);
  return move(h,(p.x-h.x)/Math.max(1,d),(p.y-h.y)/Math.max(1,d),Math.min(speed,d/DT),aim);
}
function build(h:MobaHero,s:MobaState){
  const cost=mobaUpgradeCost(h);
  if(cost===null||h.credits<cost||gap(h,{x:homeX(h.team),y:360})>123||
     h.upgradingUntil>s.time)return;
  h.credits-=cost;h.upgrade++;h.upgradingUntil=s.time+.8;h.maxHp+=10;h.hp=Math.min(h.maxHp,h.hp+30);
  emit(s,'upgrade',h,undefined,h.upgrade);
}
export const mobaUpgradeCost=(h:Pick<MobaHero,'upgrade'>)=>h.upgrade>=3?null:35+h.upgrade*28;
function strike(s:MobaState,h:MobaHero,targets:readonly MobaUnit[],lunge:boolean,aimX?:number,aimY?:number){
  if(h.cooldown>0||h.energy<(lunge?26:8)||lunge&&h.lungeCooldown>0)return;
  const mobileAim=Number.isFinite(aimX)&&Number.isFinite(aimY);
  if(mobileAim)h.face=Math.atan2(aimY!-h.y,aimX!-h.x);
  const reach=lunge?105:52;
  const aim=mobileAim?{x:aimX!,y:aimY!}:{x:h.x+Math.cos(h.face)*reach,y:h.y+Math.sin(h.face)*reach};
  const candidate=nearest(aim,targets,e=>e.team!==h.team&&vulnerable(s,e)&&gap(h,e)<=reach+e.radius&&
    Math.abs(positiveAngle(Math.atan2(e.y-h.y,e.x-h.x)-h.face))<(lunge?.75:1.20));
  h.energy-=lunge?26:8;h.cooldown=lunge?.88:.58;
  h.action=lunge?'rush':'slash';h.actionTime=0;
  if(lunge){
    h.lungeCooldown=3.4;
    const distance=candidate?clamp(gap(h,candidate)-candidate.radius-15,0,57):47;
    h.x=clamp(h.x+Math.cos(h.face)*distance,34,MOBA_WIDTH-34);
    h.y=clamp(h.y+Math.sin(h.face)*distance,55,MOBA_HEIGHT-55);
  }
  emit(s,lunge?'lunge':'attack',h,candidate);
  if(candidate){
    const wavePressure=candidate.kind==='tower'||candidate.kind==='core';
    const screened=wavePressure&&s.minions.some(m=>m.alive&&m.team===h.team&&gap(m,candidate)<135);
    damage(s,h,candidate,((lunge?38:26)+(h.level-1)*3+h.upgrade*5)*(wavePressure?(screened?.93:.55):1));
  }
}
function regen(s:MobaState,h:MobaHero){
  h.energy=Math.min(100,h.energy+DT*(h.action==='guard'?-20:20));
  if(h.energy<=0){h.energy=0;setAction(h,'idle');}
  if(gap(h,{x:homeX(h.team),y:360})<=117)h.hp=Math.min(h.maxHp,h.hp+DT*35);
  if(h.action==='slash'&&h.actionTime>.25||h.action==='rush'&&h.actionTime>.35)setAction(h,'idle');
  h.cooldown=Math.max(0,h.cooldown-DT);h.lungeCooldown=Math.max(0,h.lungeCooldown-DT);
}
function heroStep(s:MobaState,h:MobaHero,units:readonly MobaUnit[],input:MobaInput){
  if(!h.alive){
    if(s.time+1e-9<h.respawnAt)return;
    h.alive=true;h.hp=h.maxHp;h.energy=100;h.x=spawnX(h.team);h.y=360;
    h.cooldown=0;h.lungeCooldown=0;h.spawnProtectUntil=s.time+1.25;setAction(h,'idle');emit(s,'respawn',h);
  }
  h.actionTime+=DT;
  if(h.control){
    const aim=Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)?Math.atan2(input.aimY!-h.y,input.aimX!-h.x):undefined;
    const guarding=input.guard&&h.energy>1;
    const moving=move(h,clamp(finite(input.moveX),-1,1),clamp(finite(input.moveY),-1,1),guarding?88:175,aim);
    if(guarding)setAction(h,'guard');
    else if(h.action!=='slash'&&h.action!=='rush')setAction(h,moving?'run':'idle');
    if(s.pendingUpgrade)build(h,s);
    if(!guarding&&(s.pendingLunge||s.pendingAttack))strike(s,h,units,s.pendingLunge,input.aimX,input.aimY);
    s.pendingAttack=false;s.pendingLunge=false;s.pendingUpgrade=false;
  }else{
    const faction=direction(h.team), foe=enemyTeam(h.team), laneY=MOBA_LANES[h.lane], fountain={x:homeX(h.team),y:360};
    const tower=s.towers.find(t=>t.team===foe&&t.lane===h.lane&&t.alive);
    const core=s.cores[foe];
    const exposure=tower&&!s.minions.some(m=>m.team===h.team&&m.alive&&gap(m,tower)<133);
    const retreat=h.hp<h.maxHp*.24||h.hp<h.maxHp*.64&&gap(h,fountain)<124;
    const desired={x:tower?.x??(core.shielded?640:core.x),y:tower?laneY:core.shielded?laneY:core.y};
    const follow=exposure?{x:desired.x-faction*161,y:laneY}:desired;
    const target=nearest(h,units,e=>e.team!==h.team&&vulnerable(s,e)&&
      (e.kind==='hero'||e.lane===h.lane||e.kind==='core')&&gap(h,e)<(e.kind==='hero'?112:83));
    let moving=false;
    if(retreat){moving=moveToward(h,fountain,151);build(h,s);}
    else if(target&&(!exposure||target.kind!=='tower')){
      const d=gap(h,target);
      moving=moveToward(h,d>target.radius+33?target:h,139,Math.atan2(target.y-h.y,target.x-h.x));
      const tryLunge=target.kind==='hero'&&d>70&&h.energy>65&&h.lungeCooldown<=0;
      if(d<=target.radius+(tryLunge?105:51))strike(s,h,units,tryLunge,target.x,target.y);
    }else{
      moving=moveToward(h,follow,132);
      if(tower&&gap(h,tower)<74&&!exposure)strike(s,h,units,false,tower.x,tower.y);
      else if(!core.shielded&&gap(h,core)<80)strike(s,h,units,false,core.x,core.y);
    }
    if(h.action!=='slash'&&h.action!=='rush')setAction(h,moving?'run':'idle');
  }
  regen(s,h);
}
function minionStep(s:MobaState,m:MobaMinion,units:readonly MobaUnit[]){
  if(!m.alive)return;
  m.cooldown=Math.max(0,m.cooldown-DT);
  const foe=enemyTeam(m.team), laneY=MOBA_LANES[m.lane], tower=s.towers.find(t=>t.team===foe&&t.lane===m.lane&&t.alive), core=s.cores[foe];
  const enemy=nearest(m,units,e=>e.team!==m.team&&vulnerable(s,e)&&(e.kind==='hero'?Math.abs(e.y-laneY)<100:e.kind==='core'||e.lane===m.lane)&&
    gap(m,e)<(m.ranged?107:72));
  const goal=enemy??tower??(core.shielded?{x:core.x,y:laneY}:core);
  const d=gap(m,goal);
  const reach=m.ranged?73:19;
  if(enemy&&d<reach+enemy.radius){
    if(m.cooldown<=0){damage(s,m,enemy,(m.ranged?10:8)+Math.min(5,s.wave/6));m.cooldown=m.ranged?1.07:.92;}
    return;
  }
  const dx=goal.x-m.x,dy=goal.y-m.y;
  if(d>.5){m.face=Math.atan2(dy,dx);m.x+=dx/d*Math.min(d,74*DT);m.y+=dy/d*Math.min(d,74*DT);}
}
function structureStep(s:MobaState,t:MobaStructure,units:readonly MobaUnit[]){
  if(!t.alive)return;
  t.cooldown=Math.max(0,t.cooldown-DT);
  if(t.cooldown>0)return;
  const query=(u:MobaUnit)=>u.team!==t.team&&vulnerable(s,u)&&gap(t,u)<(t.kind==='tower'?135:113);
  const target=nearest(t,units,e=>e.kind==='minion'&&query(e))??nearest(t,units,e=>e.kind==='hero'&&query(e));
  if(target){damage(s,t,target,t.kind==='tower'?23:18);t.cooldown=t.kind==='tower'?.84:1.1;}
}
function timeout(s:MobaState){
  const score=(team:MobaTeam)=>s.cores[team].hp+s.towers.filter(t=>t.team===team).reduce((acc,t)=>acc+t.hp*.5,0);
  const lead=score(0)-score(1);
  finish(s,Math.abs(lead)<.001?null:lead>0?0:1,'timeout');
}
function tick(s:MobaState,input:MobaInput){
  s.tick++;s.time=s.tick*DT;
  if(s.time+1e-8>=s.nextWaveAt)wave(s);
  const units=[...s.heroes,...s.minions,...s.towers,...s.cores];
  // Rotate first actor and alternate same-tick systems' leading team for deterministic ties.
  for(const h of rotate(s.heroes,s.tick%s.heroes.length)){heroStep(s,h,units,input);if(s.phase!=='playing')return;}
  for(const team of s.tick%2===0?sides:[1,0] as const){
    for(const defense of [...s.towers,s.cores[team]])if(defense.team===team){structureStep(s,defense,units);if(s.phase!=='playing')return;}
    for(const m of s.minions)if(m.team===team){minionStep(s,m,units);if(s.phase!=='playing')return;}
  }
  s.minions=s.minions.filter(m=>m.alive);
  if(s.time+1e-8>=MOBA_MATCH_LIMIT)timeout(s);
}
export function stepMoba(s:MobaState,dt:number,input:MobaInput={}){
  if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return s;
  if(s.player.alive){s.pendingAttack||=Boolean(input.attack);s.pendingLunge||=Boolean(input.lunge);s.pendingUpgrade||=Boolean(input.useUpgrade);}
  s.remainder+=Math.min(dt,.25);
  while(s.remainder+1e-9>=DT&&s.phase==='playing'){
    s.remainder-=DT;
    tick(s,input);
  }
  return s;
}

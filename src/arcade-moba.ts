import {MOBA_BATTLEFIELD,mobaClearPath,mobaWalk,mobaLaneWaypoint,mobaNavPoint} from './arcade-moba-map.js';
/** Standalone, fixed-step, local Arena MOBA. No Arena career or tournament writes. */
export const MOBA_WIDTH=MOBA_BATTLEFIELD.width, MOBA_HEIGHT=MOBA_BATTLEFIELD.height;
export const MOBA_LANES=[165,360,555] as const;
export const MOBA_WAVE_INTERVAL=12, MOBA_MATCH_LIMIT=600;
const DT=1/60, HERO_RADIUS=15;
export type MobaTeam=0|1;
export type MobaLane=0|1|2;
export type MobaPoint={x:number;y:number};
export const MOBA_FORMS={
  shii_cho:{name:'Shii-Cho',role:'Vanguard',description:'Wide slashes; balanced stamina and dash.',hp:150,speed:175,slash:26,arc:1.45,reach:55,guard:.37,lungeSpeed:475,lungeTime:.17,lungeCost:26,lungeDamage:36},
  makashi:{name:'Makashi',role:'Duelist',description:'Long, narrow strikes; less health.',hp:133,speed:181,slash:31,arc:.76,reach:67,guard:.42,lungeSpeed:510,lungeTime:.18,lungeCost:27,lungeDamage:39},
  soresu:{name:'Soresu',role:'Guardian',description:'Best armor and guard; short dash and lighter cuts.',hp:185,speed:155,slash:20,arc:1.19,reach:47,guard:.23,lungeSpeed:400,lungeTime:.14,lungeCost:30,lungeDamage:29},
  ataru:{name:'Ataru',role:'Mobile striker',description:'Fastest, longest dash; fragile and stamina-hungry.',hp:128,speed:199,slash:23,arc:1.10,reach:49,guard:.46,lungeSpeed:570,lungeTime:.20,lungeCost:32,lungeDamage:42},
  djem_so:{name:'Djem So',role:'Guardian',description:'Hardest close-range cuts and solid guard; slow feet.',hp:174,speed:151,slash:36,arc:1.06,reach:44,guard:.31,lungeSpeed:420,lungeTime:.16,lungeCost:32,lungeDamage:42},
  niman:{name:'Niman',role:'Vanguard',description:'Reliable reach and a cheaper dash; moderate damage.',hp:152,speed:171,slash:25,arc:1.23,reach:56,guard:.37,lungeSpeed:454,lungeTime:.17,lungeCost:21,lungeDamage:33},
  juyo:{name:'Juyo',role:'Mobile striker',description:'Quick, brutal dash; a weaker guard.',hp:140,speed:188,slash:30,arc:1.02,reach:50,guard:.55,lungeSpeed:550,lungeTime:.17,lungeCost:24,lungeDamage:44},
} as const;
export type MobaForm=keyof typeof MOBA_FORMS;
export const MOBA_FORM_IDS=Object.keys(MOBA_FORMS) as MobaForm[];

export type MobaInput={moveX?:number;moveY?:number;attack?:boolean;lunge?:boolean;guard?:boolean;aimX?:number;aimY?:number;useUpgrade?:boolean};
export type MobaUnit=MobaPoint&{id:string;team:MobaTeam;lane:MobaLane;hp:number;maxHp:number;alive:boolean;radius:number;kind:'hero'|'minion'|'tower'|'core'};
export type MobaHero=MobaUnit&{
  kind:'hero'; name:string;control:boolean;form:MobaForm;dashRemaining:number;face:number;vx:number;vy:number;action:'idle'|'run'|'guard'|'slash'|'rush'|'ko';
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
const homeX=(team:MobaTeam)=>MOBA_BATTLEFIELD.cores[team].x;
const spawnX=(team:MobaTeam)=>MOBA_BATTLEFIELD.spawns[team].x;
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
    ...(core?MOBA_BATTLEFIELD.cores[team]:MOBA_BATTLEFIELD.lanes[lane].towerNodes[team]),
    hp:maxHp,maxHp,alive:true,radius:core?30:22,shielded:core,cooldown:0};
}
export function createMoba(seed=1,playerLane:MobaLane=1,playerForm:MobaForm='shii_cho'):MobaState {
  const lane=lanes.includes(playerLane)?playerLane:1;
  const towers=sides.flatMap(team=>lanes.map(l=>structure(team,l,'tower')));
  const cores=sides.map(team=>structure(team,1,'core'));
  const heroes=sides.flatMap(team=>[0,0,1,2,2].map((v,index):MobaHero=>{
    const l=v as MobaLane, mirrored=((seed>>>0)+(l*13+index*7))%17-8;
    const form=MOBA_FORM_IDS[(index+Math.floor((seed>>>0)%7))%7], hp=MOBA_FORMS[form].hp;
    return {form,dashRemaining:0,id:'hero-'+team+'-'+index,kind:'hero',team,lane:l,control:false,name:heroNames[team][index],
      x:spawnX(team)+mirrored*direction(team),y:MOBA_LANES[l]+(index===1||index===4?22:-12),
      hp,maxHp:hp,alive:true,radius:HERO_RADIUS,face:team===0?0:Math.PI,vx:0,vy:0,
      energy:100,action:'idle',actionTime:0,level:1,xp:0,credits:0,upgrade:0,kills:0,deaths:0,
      respawnAt:0,cooldown:0,lungeCooldown:0,spawnProtectUntil:0,upgradingUntil:0};
  }));
  const player=heroes.find(h=>h.team===0&&h.lane===lane)!;
  player.control=true;
  if(MOBA_FORM_IDS.includes(playerForm)){player.form=playerForm;player.maxHp=MOBA_FORMS[playerForm].hp;player.hp=player.maxHp;}
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
  const amount=Math.min(target.hp,guarded?raw*MOBA_FORMS[hero.form].guard:raw);
  target.hp=Math.max(0,target.hp-amount);
  // Keep a combat ribbon for meaningful hero actions and structure damage,
  // not dozens of simultaneous minion trades.
  if(actor.kind==='hero'||target.kind!=='minion')emit(s,'hit',actor,target,amount);
  if(target.hp>0)return;
  target.alive=false;
  reward(s,actor,target);
  if(hero){hero.deaths++;hero.respawnAt=s.time+Math.min(14,7+hero.level*.65);hero.vx=0;hero.vy=0;hero.dashRemaining=0;setAction(hero,'ko');emit(s,'ko',actor,target);}
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
  const next=mobaWalk(h,dx*factor*speed*DT,dy*factor*speed*DT,h.radius);
  h.vx=(next.x-h.x)/DT;h.vy=(next.y-h.y)/DT;
  h.x=next.x;h.y=next.y;
  if(aim!==undefined)h.face=aim;
  else if(length>.06)h.face=Math.atan2(dy,dx);
  return length>.06;
}
function moveToward(h:MobaHero,p:MobaPoint,speed=126,aim?:number){
  const node=mobaNavPoint(h,p,h.radius), d=gap(h,node);
  return move(h,(node.x-h.x)/Math.max(1,d),(node.y-h.y)/Math.max(1,d),Math.min(speed,d/DT),aim);
}
function build(h:MobaHero,s:MobaState){
  const cost=mobaUpgradeCost(h);
  if(cost===null||h.credits<cost||gap(h,{x:homeX(h.team),y:360})>123||
     h.upgradingUntil>s.time)return;
  h.credits-=cost;h.upgrade++;h.upgradingUntil=s.time+.8;h.maxHp+=10;h.hp=Math.min(h.maxHp,h.hp+30);
  emit(s,'upgrade',h,undefined,h.upgrade);
}
export const mobaUpgradeCost=(h:Pick<MobaHero,'upgrade'>)=>h.upgrade>=3?null:35+h.upgrade*28;
function hitWithHero(s:MobaState,h:MobaHero,target:MobaUnit,base:number){
  const structure=target.kind==='tower'||target.kind==='core';
  const screened=structure&&s.minions.some(m=>m.alive&&m.team===h.team&&gap(m,target)<135);
  damage(s,h,target,(base+(h.level-1)*3+h.upgrade*5)*(structure?(screened?.93:.55):1));
}
function strike(s:MobaState,h:MobaHero,targets:readonly MobaUnit[],lunge:boolean,aimX?:number,aimY?:number){
  const form=MOBA_FORMS[h.form], cost=lunge?form.lungeCost:8;
  if(h.cooldown>0||h.energy<cost||lunge&&h.lungeCooldown>0)return;
  const hasAim=Number.isFinite(aimX)&&Number.isFinite(aimY);
  if(hasAim)h.face=Math.atan2(aimY!-h.y,aimX!-h.x);
  h.energy-=cost;h.cooldown=lunge?.88:.58;
  h.action=lunge?'rush':'slash';h.actionTime=0;
  if(lunge){
    h.lungeCooldown=3.4;h.dashRemaining=form.lungeTime;emit(s,'lunge',h);
    return;
  }
  const aim=hasAim?{x:aimX!,y:aimY!}:{x:h.x+Math.cos(h.face)*form.reach,y:h.y+Math.sin(h.face)*form.reach};
  const candidate=nearest(aim,targets,e=>e.team!==h.team&&vulnerable(s,e)&&mobaClearPath(h,e)&&gap(h,e)<=form.reach+e.radius&&
    Math.abs(positiveAngle(Math.atan2(e.y-h.y,e.x-h.x)-h.face))<form.arc);
  emit(s,'attack',h,candidate);
  if(candidate)hitWithHero(s,h,candidate,form.slash);
}
function dashStep(s:MobaState,h:MobaHero,targets:readonly MobaUnit[]){
  const form=MOBA_FORMS[h.form], distance=Math.min(DT,h.dashRemaining)*form.lungeSpeed;
  const dx=Math.cos(h.face),dy=Math.sin(h.face);
  let stop=distance, victim:MobaUnit|undefined;
  // The path and attack meet at the first opposing body, never a remotely
  // selected target; the entry distance accounts for both physical radii.
  for(const t of targets){
    if(!t.alive||t.team===h.team)continue;
    const x=t.x-h.x,y=t.y-h.y,along=x*dx+y*dy;
    const radius=h.radius+t.radius+3, side=x*dy-y*dx;
    if(along<0||Math.abs(side)>radius)continue;
    const entry=Math.max(0,along-Math.sqrt(radius*radius-side*side));
    if(entry>stop)continue;
    stop=entry;victim=t;
  }
  const x=clamp(h.x+dx*stop,34,MOBA_WIDTH-34), y=clamp(h.y+dy*stop,55,MOBA_HEIGHT-55);
  if(!mobaClearPath(h,{x,y},h.radius)){h.vx=0;h.vy=0;h.dashRemaining=0;return;}
  h.vx=(x-h.x)/DT;h.vy=(y-h.y)/DT;h.x=x;h.y=y;
  h.dashRemaining=Math.max(0,h.dashRemaining-DT);
  if(victim){hitWithHero(s,h,victim,form.lungeDamage);h.dashRemaining=0;}
  else if(Math.hypot(h.vx,h.vy)*DT<stop-.001)h.dashRemaining=0;
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
  if(h.dashRemaining>1e-6){
    dashStep(s,h,units);
    // A button held from the previous frame must not fire a second action.
    if(h.control){s.pendingAttack=false;s.pendingLunge=false;s.pendingUpgrade=false;}
    regen(s,h);return;
  }
  h.dashRemaining=0;
  const form=MOBA_FORMS[h.form];
  if(h.control){
    const aim=Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)?Math.atan2(input.aimY!-h.y,input.aimX!-h.x):undefined;
    const guarding=input.guard&&h.energy>1;
    const moving=move(h,clamp(finite(input.moveX),-1,1),clamp(finite(input.moveY),-1,1),guarding?form.speed*.5:form.speed,aim);
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
    const follow=exposure?{x:desired.x-faction*161,y:desired.y}:desired;
    const target=nearest(h,units,e=>e.team!==h.team&&vulnerable(s,e)&&
      (e.kind==='hero'||e.lane===h.lane||e.kind==='core')&&mobaClearPath(h,e)&&gap(h,e)<(e.kind==='hero'?112:83));
    let moving=false;
    if(retreat){moving=moveToward(h,fountain,151);build(h,s);}
    else if(target&&(!exposure||target.kind!=='tower')){
      const d=gap(h,target);
      moving=moveToward(h,d>target.radius+33?target:h,139,Math.atan2(target.y-h.y,target.x-h.x));
      const lungeReach=form.lungeSpeed*form.lungeTime+h.radius;
      const tryLunge=target.kind==='hero'&&d>form.reach+target.radius&&d<=lungeReach+target.radius&&h.energy>65&&h.lungeCooldown<=0;
      if(d<=target.radius+(tryLunge?lungeReach:form.reach))strike(s,h,units,tryLunge,target.x,target.y);
    }else{
      const waypoint=tower||core.shielded?mobaLaneWaypoint(h.lane,h.team,h,follow):follow;
      moving=moveToward(h,waypoint,132);
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
    gap(m,e)<(m.ranged?107:72)&&mobaClearPath(m,e));
  const desired=tower??(core.shielded?{x:core.x,y:laneY}:core);
  const goal=enemy??(tower||core.shielded?mobaLaneWaypoint(m.lane,m.team,m,desired):mobaNavPoint(m,desired,m.radius));
  const d=gap(m,goal);
  const reach=m.ranged?73:19;
  if(enemy&&d<reach+enemy.radius){
    if(m.cooldown<=0){damage(s,m,enemy,(m.ranged?10:8)+Math.min(5,s.wave/6));m.cooldown=m.ranged?1.07:.92;}
    return;
  }
  const dx=goal.x-m.x,dy=goal.y-m.y;
  if(d>.5){m.face=Math.atan2(dy,dx);const next=mobaWalk(m,dx/d*Math.min(d,74*DT),dy/d*Math.min(d,74*DT),m.radius);m.x=next.x;m.y=next.y;}
}
function structureStep(s:MobaState,t:MobaStructure,units:readonly MobaUnit[]){
  if(!t.alive)return;
  t.cooldown=Math.max(0,t.cooldown-DT);
  if(t.cooldown>0)return;
  const query=(u:MobaUnit)=>u.team!==t.team&&vulnerable(s,u)&&mobaClearPath(t,u)&&gap(t,u)<(t.kind==='tower'?135:113);
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

export type MobaPressure={structureId:string|null; structureKind:'tower'|'core'|null;
  underFire:boolean; waveAhead:boolean; waveBehind:boolean; enemyHeroNear:boolean};
export function mobaPressure(s:MobaState,h=s.player):MobaPressure {
  const empty={structureId:null,structureKind:null,underFire:false,waveAhead:false,waveBehind:false,enemyHeroNear:false};
  if(!h.alive||s.phase!=='playing')return empty;
  const inReach=(t:MobaStructure,u:MobaUnit)=>gap(t,u)<(t.kind==='tower'?135:113)&&mobaClearPath(t,u)&&vulnerable(s,u);
  const structure=nearest(h,[...s.towers,...s.cores],t=>t.alive&&t.team!==h.team&&inReach(t,h));
  const allied=s.minions.filter(m=>m.alive&&m.team===h.team&&Math.abs(m.y-h.y)<85);
  const face=direction(h.team), lead=allied.reduce((best,m)=>Math.max(best,(m.x-h.x)*face),-Infinity);
  return {structureId:structure?.id??null,structureKind:structure?.kind??null,
    underFire:Boolean(structure&&!s.minions.some(m=>m.alive&&m.team===h.team&&inReach(structure,m))),
    waveAhead:lead>=20,waveBehind:lead<20&&face*(h.x-640)>-295,
    enemyHeroNear:s.heroes.some(e=>e.team!==h.team&&e.alive&&gap(h,e)<115&&mobaClearPath(h,e))};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoba,stepMoba,mobaUpgradeCost,MOBA_LANES,MOBA_WIDTH,MOBA_WAVE_INTERVAL,MOBA_FORMS,MOBA_FORM_IDS} from '../dist/arcade-moba.js';

const tick=1/60;
test('three lanes host deterministic 5v5, synchronized waves and one local player',()=>{
  const a=createMoba(871,2), b=createMoba(871,2);
  assert.equal(a.player.lane,2);
  assert.deepEqual(a.heroes.filter(h=>h.control),[a.player]);
  assert.deepEqual(a.towers.map(t=>t.y),[...MOBA_LANES,...MOBA_LANES]);
  assert.equal(a.cores.every(c=>c.shielded),true);
  for(let i=0;i<120;i++)stepMoba(a,tick);
  for(let i=0;i<60;i++)stepMoba(b,tick*2);
  assert.deepEqual({...a,remainder:0},{...b,remainder:0});
  assert.equal(a.wave,1);
  assert.equal(a.nextWaveAt,.5+MOBA_WAVE_INTERVAL);
  for(const lane of [0,1,2])assert.equal(a.minions.filter(m=>m.lane===lane).length,8);
  assert.ok(a.heroes.find(h=>h.team===1)!.x<1120);
});

test('local input moves, aims, spends stamina and cannot damage the shielded core',()=>{
  const s=createMoba(17);
  const a=s.player, c=s.cores[1];
  const x=a.x;
  stepMoba(s,tick,{moveX:1,moveY:0});
  assert.ok(a.x>x);
  a.x=MOBA_WIDTH-128;a.y=c.y;
  stepMoba(s,tick/3,{attack:true,aimX:c.x,aimY:c.y});
  assert.equal(a.action,'run');
  stepMoba(s,tick,{aimX:c.x,aimY:c.y});
  assert.equal(a.action,'slash');
  assert.equal(c.hp,c.maxHp);
  assert.ok(a.energy<100);
  const t=s.towers.find(t=>t.team===1&&t.lane===a.lane)!;
  a.x=t.x-41;a.y=t.y;a.cooldown=0;t.hp=8;
  stepMoba(s,tick,{attack:true,aimX:t.x,aimY:t.y});
  assert.equal(t.alive,false);
  assert.equal(c.shielded,false);
  a.x=c.x-49;a.y=c.y;a.cooldown=0;c.hp=5;
  stepMoba(s,tick,{lunge:true,aimX:c.x,aimY:c.y});
  assert.equal(s.phase,'playing');
  while(s.phase==='playing'&&a.dashRemaining>1e-6)stepMoba(s,tick);
  assert.equal(s.phase,'won');
  assert.equal(s.winner,0);
  assert.equal(s.endReason,'core');
  assert.ok(a.lungeCooldown>0);
  const final=s.tick;
  stepMoba(s,.25,{moveX:1});
  assert.equal(s.tick,final);
});
test('towers punish an unsupported dive, the player respawns, and the shop is base-only',()=>{
  const s=createMoba(13,0);
  const a=s.player, enemyTower=s.towers[3];
  a.x=enemyTower.x-61;a.y=enemyTower.y;a.hp=10;a.credits=1000;
  assert.equal(mobaUpgradeCost(a),35);
  stepMoba(s,tick,{useUpgrade:true});
  assert.equal(a.upgrade,0);
  assert.equal(a.alive,false);
  assert.equal(a.deaths,1);
  assert.ok(a.respawnAt>s.time+7);
  while(!a.alive)stepMoba(s,tick);
  assert.equal(a.hp,a.maxHp);
  assert.ok(a.x<150);
  stepMoba(s,tick,{useUpgrade:true});
  assert.equal(a.upgrade,1);
  assert.equal(a.credits,965);
});
test('natural waves and lane AI eventually open a core and finish an actual seeded match',()=>{
  const s=createMoba(1);
  while(s.phase==='playing')stepMoba(s,1/30);
  assert.ok(s.time>30&&s.time<240);
  assert.equal(s.endReason,'core');
  assert.ok(s.towers.some(t=>!t.alive));
  assert.ok(s.heroes.some(h=>h.level>1));
  assert.ok(s.heroes.some(h=>h.deaths>1));
  assert.ok(s.events.some(e=>e.type==='core'));
  assert.ok(s.events.length<=96);
});

test('all seven forms are selectable and roles provide actual tradeoffs',()=>{
  assert.equal(new Set(MOBA_FORM_IDS.map(id=>MOBA_FORMS[id].role)).size,4);
  for(const form of MOBA_FORM_IDS)assert.equal(createMoba(17,1,form).player.form,form);
  const guardian=createMoba(17,1,'soresu'), mobile=createMoba(17,1,'ataru'), duelist=createMoba(17,1,'makashi');
  assert.ok(guardian.player.hp>duelist.player.hp&&duelist.player.hp>mobile.player.hp);
  const [startGuardian,startMobile]=[guardian.player.x,mobile.player.x];
  for(let i=0;i<30;i++){
    stepMoba(guardian,tick,{moveX:1});stepMoba(mobile,tick,{moveX:1});
  }
  assert.ok(mobile.player.x-startMobile>guardian.player.x-startGuardian+20);
  for(const g of [guardian,duelist]){
    const enemy=g.heroes[7], h=g.player;
    Object.assign(h,{x:500,y:360,face:0});
    Object.assign(enemy,{x:571,y:360});
    stepMoba(g,tick,{attack:true,aimX:571,aimY:360});
  }
  assert.equal(guardian.heroes[7].hp,guardian.heroes[7].maxHp);
  assert.ok(duelist.heroes[7].hp<duelist.heroes[7].maxHp);
});
test('lunge travels over ticks and the first opposing body shields targets further down the path',()=>{
  const s=createMoba(14,1,'ataru'), h=s.player,m=s.heroes[7], n=s.heroes[5];
  Object.assign(h,{x:480,y:360,face:0});Object.assign(m,{x:556,y:360});Object.assign(n,{x:585,y:360,lane:1});
  const hp=[m.hp,n.hp];
  stepMoba(s,tick,{lunge:true,aimX:n.x,aimY:n.y});
  assert.equal(h.x,480);
  assert.deepEqual([m.hp,n.hp],hp);
  assert.ok(h.dashRemaining>0);
  let frames=0;
  while(h.dashRemaining>1e-6&&frames<20){stepMoba(s,tick);frames++;}
  assert.ok(frames>1&&frames<20);
  const last=s.events.findLast(e=>e.actorId===h.id&&e.type==='hit');
  assert.equal(last?.targetId,m.id);
  assert.ok(m.hp<hp[0]);
  assert.equal(n.hp,hp[1]);
  assert.ok(h.x>480&&h.x<n.x-h.radius);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade} from '../dist/arcade-engine.js';
import {smartCommands,smartThreat,smartCanGuard,smartCanSlip} from '../dist/arcade-engine-smart.js';

// v6 bot reads: orbit follow-up blades and the bot's own disabled limbs.
const game=()=>createArcade({mode:'duel',seed:4,teamSizes:[1,1],startingRanks:['SSS+V','SSS+V'],form:'shii_cho',smartAI:true,regionalInjuries:true});
const blade=(contact,id)=>({contact,reach:112,arc:1.1,damage:6,knock:20,recoil:10,blade:id});

/** Pink (AI) defends against Blue, who is placed mid-swing by hand. */
function setup({orbit=true,triple=true,distance=70,actionTime=.36,landed=['primary']}={}){
  const s=game(), atk=s.fighters[0], def=s.fighters[1];
  atk.x=500;atk.y=320;atk.face=0;def.x=500+distance;def.y=320;def.face=Math.PI;
  atk.alive=def.alive=true;def.energy=atk.energy=100;def.guardLock=0;def.action='idle';def.actionDuration=0;def.actionTime=0;
  if(orbit)atk.gear={...atk.gear,weapon:'orbit'};
  atk.attack='slash';atk.action='attack';
  atk.attackSpec=orbit?{...blade(.30,'primary'),orbit:true,duration:.9,
    ...(triple?{offhand:blade(.40,'offhand'),orbitThird:blade(.51,'orbit_third')}:{})}:{...blade(.30,'primary'),duration:.6};
  atk.actionTime=actionTime;atk.actionDuration=.9;
  atk.contact=landed.includes('primary');atk.offhandContact=landed.includes('offhand');atk.orbitThirdContact=landed.includes('orbit_third');
  atk.attackSerial=7;
  return {s,atk,def};
}
const defends=(c)=>c.guard===true||c.dash===true;

test('orbit follow-up blades are still read after the first blade lands', () => {
  const {s,atk,def}=setup();
  const t=smartThreat(s,def,atk);
  assert.ok(t,'the offhand and third blades are still coming');
  assert.ok(Math.abs(t.until-.04)<1e-9,'next contact is the offhand blade');
  assert.ok(Math.abs(t.last-.15)<1e-9,'the guard plan covers the third blade too');
});

test('a raised guard is held through the third orbit blade, not dropped after the first', () => {
  let held=0;
  for(let serial=1;serial<=30;serial++){
    const {s,atk,def}=setup();atk.attackSerial=serial;
    const first=smartCommands(s,def,atk,{});
    if(first.guard!==true)continue;
    def.action='guard';
    atk.actionTime=.49;atk.offhandContact=true;
    assert.equal(smartCommands(s,def,atk,{strike:true}).guard,true,`serial ${serial}: guard dropped before the third blade`);
    held++;
  }
  assert.ok(held>=20,`expected most SSS+ V reads to parry, got ${held}/30`);
});

test('orbit reads use the lit blade, so a fighter beyond it is not baited into a guard', () => {
  const near=setup({triple:false,landed:[],actionTime:.28});
  assert.ok(smartThreat(near.s,near.def,near.atk),'inside the blade lane');
  const far=setup({triple:false,landed:[],actionTime:.28,distance:140});
  assert.equal(smartThreat(far.s,far.def,far.atk),null,'the lit segment ends well short of 140');
});

test('a bot never asks for a guard its sword arm cannot make, or a dash its legs cannot make', () => {
  for(const [limbs,canGuard,canSlip] of [[['rightArm'],false,true],[['leftLeg'],true,false],[['rightArm','rightLeg'],false,false]]){
    for(let serial=1;serial<=30;serial++){
      const {s,atk,def}=setup({orbit:false,landed:[],actionTime:.25});atk.attackSerial=serial;
      for(const l of limbs)def.injuries[l].front=80;
      assert.equal(smartCanGuard(def),canGuard);assert.equal(smartCanSlip(def),canSlip);
      const c=smartCommands(s,def,atk,{guard:true,dash:true});
      if(!canGuard)assert.notEqual(c.guard,true,`${limbs}: guard requested with a disabled sword arm`);
      if(!canSlip)assert.notEqual(c.dash,true,`${limbs}: dash requested with a disabled leg`);
      if(canGuard||canSlip)assert.ok(serial>0);
    }
  }
});

test('an injured bot still answers the swing with what it has left', () => {
  let armOut=0,legOut=0;
  for(let serial=1;serial<=30;serial++){
    const a=setup({orbit:false,landed:[],actionTime:.25});a.atk.attackSerial=serial;a.def.injuries.rightArm.front=80;
    if(smartCommands(a.s,a.def,a.atk,{}).dash===true)armOut++;
    const b=setup({orbit:false,landed:[],actionTime:.25});b.atk.attackSerial=serial;b.def.injuries.leftLeg.front=80;
    if(smartCommands(b.s,b.def,b.atk,{}).guard===true)legOut++;
  }
  assert.ok(armOut>=20,`arm out: slipped ${armOut}/30`);
  assert.ok(legOut>=20,`leg out: guarded ${legOut}/30`);
});

test('emitter fighters guard without hands, so a dead sword arm does not stop an orbit guard', () => {
  const {s,def}=setup();
  def.gear={...def.gear,weapon:'orbit'};def.injuries.rightArm.front=80;
  assert.equal(smartCanGuard(def),true);
  assert.ok(defends(smartCommands(s,def,s.fighters[0],{})));
});

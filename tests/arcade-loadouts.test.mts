import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORCE_FAMILIES, QUALITY_LEVELS } from '../dist/content.js';
import { ARCADE_ATTACKS } from '../dist/arcade-engine.js';
import {
  ARCADE_FORCE_FAMILIES, ARCADE_GEAR_QUALITIES, arcadeFighterGear, arcadeGearMove, normalizeArcadeGear,
} from '../dist/arcade-loadouts.js';

function gear({ saber = 'standard', dual = false, force = 'force_push', forceQuality = 'standard' } = {}) {
  return arcadeFighterGear(normalizeArcadeGear({
    startingSaberQuality: [saber], startingDualSabers: [dual],
    startingForceFamily: [force], startingForceQuality: [forceQuality],
  }), 0);
}

test('Classic option IDs round-trip through Arcade setup and invalid values fall back independently', () => {
  assert.deepEqual(ARCADE_GEAR_QUALITIES.map(x => x.id), QUALITY_LEVELS.map(x => x.id));
  assert.deepEqual(ARCADE_FORCE_FAMILIES.map(x => x.id), FORCE_FAMILIES.map(x => x.id));
  assert.deepEqual(normalizeArcadeGear(null), {
    startingSaberWeapon: ['single', 'single'], startingSaberGrip: ['forward', 'forward'], startingDualPhase: [false, false],
    startingSaberQuality: ['standard', 'standard'], startingDualSabers: [false, false],
    startingForceFamily: ['force_push', 'force_push'], startingForceQuality: ['standard', 'standard'],
  });

  const source = {
    startingSaberQuality: ['improved', 'worn', 'ignored'], startingDualSabers: [true, 'true'],
    startingForceFamily: ['force_pulse', 'constructor'], startingForceQuality: [NaN, 'improved'],
  };
  const copy = normalizeArcadeGear(source);
  assert.deepEqual(copy, {
    startingSaberWeapon: ['dual', 'single'], startingSaberGrip: ['forward', 'forward'], startingDualPhase: [false, false],
    startingSaberQuality: ['improved', 'worn'], startingDualSabers: [true, false],
    startingForceFamily: ['force_pulse', 'force_push'], startingForceQuality: ['standard', 'improved'],
  });
  source.startingSaberQuality[0] = 'worn';
  assert.equal(arcadeFighterGear(copy, 0).bladeCount, 2);
  assert.equal(arcadeFighterGear(copy, 0).saberQuality, 'improved');
  assert.equal(arcadeFighterGear(copy, 1).bladeCount, 1);
  assert.equal(arcadeFighterGear(copy, 1).forceQuality, 'improved');
});

test('old/default combat keeps original timings and stat values', () => {
  for (const [name, spec] of Object.entries(ARCADE_ATTACKS)) {
    const transformed = arcadeGearMove(gear(), name, spec);
    if (name === 'force') assert.deepEqual(transformed, { ...spec, forceAbility: 'force_push' });
    else assert.equal(transformed, spec);
  }
});

test('saber grades change damage and recovery without shortening the initial windup', () => {
  for (const name of ['slash', 'thrust', 'wide_cut', 'riposte']) {
    const base = ARCADE_ATTACKS[name];
    const worn = arcadeGearMove(gear({ saber: 'worn' }), name, base);
    const improved = arcadeGearMove(gear({ saber: 'improved' }), name, base);
    assert.ok(worn.damage < base.damage && base.damage < improved.damage);
    assert.ok(worn.duration > base.duration && base.duration > improved.duration);
    assert.equal(worn.contact, base.contact);
    assert.equal(improved.contact, base.contact);
  }
});

test('dual sabers trade energy and recovery for a later independent, shorter second hit', () => {
  for (const { id } of ARCADE_GEAR_QUALITIES) {
    for (const [name, base] of Object.entries(ARCADE_ATTACKS).filter(([name]) => name !== 'force')) {
      const single = arcadeGearMove(gear({ saber: id }), name, base);
      const dual = arcadeGearMove(gear({ saber: id, dual: true }), name, base);
      assert.ok(dual.cost > single.cost && dual.duration > single.duration, name);
      assert.ok(dual.contact < dual.offhand.contact && dual.offhand.contact < dual.duration, name);
      assert.ok(dual.offhand.reach < dual.reach && dual.offhand.arc < dual.arc, name);
      assert.ok(dual.offhand.damage > 0 && dual.damage < single.damage, name);
      assert.ok(dual.offhand.damage + dual.damage > single.damage, name);
      assert.equal(single.offhand, undefined);
    }
  }
});

test('every Force family has a distinct playstyle and grade changes actual cast economics', () => {
  const base = ARCADE_ATTACKS.force;
  const cast = (force, forceQuality) => arcadeGearMove(gear({ force, forceQuality }), 'force', base);
  const [push, burst, pulse] = ARCADE_FORCE_FAMILIES.map(({ id }) => cast(id));
  assert.deepEqual([push, burst, pulse].map(x => x.forceAbility), ['force_push', 'force_burst', 'force_pulse']);
  assert.ok(push.knock > burst.knock && burst.knock > pulse.knock);
  assert.ok(burst.damage > push.damage && push.damage > pulse.damage);
  assert.ok(pulse.reach > push.reach && push.reach > burst.reach);
  assert.ok(burst.cost > push.cost && push.cost > pulse.cost);
  assert.ok(burst.contact > push.contact && push.contact > pulse.contact);
  for (const { id } of ARCADE_FORCE_FAMILIES) {
    const worn = cast(id, 'worn'), improved = cast(id, 'improved');
    assert.ok(improved.damage > worn.damage && improved.reach > worn.reach);
    assert.ok(improved.cost < worn.cost && improved.duration < worn.duration);
    assert.equal(worn.contact, improved.contact);
  }
});

test('saber and Force gear do not cross-modify attacks', () => {
  const saberUpgrades = gear({ saber: 'improved', dual: true });
  const forceUpgrades = gear({ force: 'force_burst', forceQuality: 'improved' });
  assert.deepEqual(arcadeGearMove(saberUpgrades, 'force', ARCADE_ATTACKS.force),
    arcadeGearMove(gear(), 'force', ARCADE_ATTACKS.force));
  assert.equal(arcadeGearMove(forceUpgrades, 'slash', ARCADE_ATTACKS.slash), ARCADE_ATTACKS.slash);
});

test('all eight saber choices round-trip, including old dual saves, staff and three-blade Orbit', async () => {
  const { ARCADE_SABER_OPTIONS, arcadeSaberOption } = await import('../dist/arcade-loadouts.js');
  const { normalizeSetup, loadSetup, saveSetup } = await import('../dist/arcade-setup.js');
  const store = { getItem() { return this.raw; }, setItem(_key, value) { this.raw = value; } };
  for (const kit of ARCADE_SABER_OPTIONS) {
    const saved = normalizeSetup({ startingSaberWeapon: [kit.weapon, 'staff'], startingSaberGrip: [kit.grip, 'backhand'], startingDualSabers: [true, true], startingDualPhase: [true, 'true'] });
    assert.ok(saveSetup(saved, store));
    const settings = loadSetup(store);
    const gear = arcadeFighterGear(settings, 0), staff = arcadeFighterGear(settings, 1);
    assert.equal(arcadeSaberOption(gear).id, kit.id);
    assert.equal(gear.dualPhase, kit.weapon!=='orbit');
    assert.equal(staff.dualPhase, false);
    assert.equal(gear.bladeCount, kit.weapon==='orbit' ? 3 : ['dual','staff'].includes(kit.weapon) ? 2 : 1);
    assert.equal(arcadeSaberOption(staff).id, 'staff');
    assert.equal(staff.grip, 'forward');
    assert.equal(staff.dualSabers, false);
  }
  assert.equal(arcadeSaberOption(arcadeFighterGear(normalizeSetup({ startingDualSabers: [true] }), 0)).id, 'dual');
});

test('single-emitter variants differ in physical span, reach and commitment; untouched Force', async () => {
  const {sampleArcadeFighter,arcadeBladeWorld}=await import('../dist/arcade-fighters.js');
  const build=(weapon)=>arcadeFighterGear(normalizeArcadeGear({startingSaberWeapon:[weapon],startingSaberGrip:['backhand']}),0);
  const old=arcadeFighterGear({},0), short=build('shoto'), long=build('greatsaber');
  for(const g of [short,long]) assert.deepEqual([g.bladeCount,g.dualSabers,g.grip],[1,false,'forward']);
  const stab=ARCADE_ATTACKS.thrust;
  const s=arcadeGearMove(short,'thrust',stab),l=arcadeGearMove(long,'thrust',stab);
  for(const field of ['contact','duration','reach','cost','damage'])assert.ok(s[field]<stab[field]&&stab[field]<l[field],field);
  for(const g of [short,long]) assert.deepEqual(arcadeGearMove(g,'force',ARCADE_ATTACKS.force),arcadeGearMove(old,'force',ARCADE_ATTACKS.force));
  const lengths=[short,old,long].map(gear=>{
    const f={id:'solo',x:0,y:0,hp:100,alive:true,face:0,gear,action:'idle',form:'makashi'};
    const world=arcadeBladeWorld(f,sampleArcadeFighter(f,0));
    assert.equal(world.blades.length,1);
    return Math.hypot(world.tip.x-world.hand.x,world.tip.y-world.hand.y);
  });
  assert.ok(Math.abs(lengths[0]/lengths[1]-.77)<1e-6);
  assert.ok(Math.abs(lengths[2]/lengths[1]-1.27)<1e-6);
});

test('live strikes commit kit-specific authoritative reach, windup, and stamina', async () => {
  const {createArcade,stepArcade}=await import('../dist/arcade-engine.js');
  const commits=['shoto','single','greatsaber'].map(weapon=>{
    const game=createArcade({mode:'duel',seed:31,terrain:'underpit',teamForms:['shii_cho','shii_cho'],
      startingRanks:['F','F'],startingSaberWeapon:[weapon,'single']});
    const [p,opponent]=game.fighters;
    opponent.think=99;
    stepArcade(game,1/120,{strike:true,aimX:opponent.x,aimY:opponent.y});
    const event=game.events.find(e=>e.fighterId===p.id&&e.contact>0);
    assert.ok(event,weapon);
    assert.equal(event.contact,p.attackSpec.contact);
    return {spec:p.attackSpec,energy:p.energy};
  });
  for(const field of ['reach','contact','duration','cost']){
    const [a,b,c]=commits.map(p=>p.spec[field]);
    assert.ok(a<b&&b<c,field);
  }
  const [a,b,c]=commits.map(p=>p.energy);
  assert.ok(a>b&&b>c);
});

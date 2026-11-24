import test from 'node:test';
import assert from 'node:assert/strict';
import { FORCE_ABILITIES, forceAbilityById, forceRepertoire, selectForceAbility, forceAbilityWeapon } from '../dist/force-abilities.js';
import { WEAPONS } from '../dist/content.js';

test('rank unlocks expand the derived repertoire without changing saved equipment', () => {
  assert.deepEqual(forceRepertoire(0), ['force_push']);
  assert.equal(forceRepertoire(9).length, 5);
  const top = forceRepertoire({ career: { gradeIndex: 14 } });
  assert.equal(top.length, 8);
  assert.equal(new Set(top.map(id => FORCE_ABILITIES[id].mechanic)).size, 8);
  assert.equal(forceRepertoire({ career: { merit: 6000 } }).length, 8);
  assert.equal(forceAbilityById('unknown'), null);
  for (const a of Object.values(FORCE_ABILITIES)) {
    assert.ok(a.energyCost > 0 && a.energyCost <= 40);
    assert.ok(a.windup >= .3 && a.interval >= 3);
    assert.ok(a.barrierReduction < 1);
    assert.ok(a.counterplay.length > 30);
  }
});

test('ability choice responds to threats, formations, distance and guarded targets', () => {
  const choose = context => selectForceAbility({ rankIndex: 14, energy: 100, distance: 200, nearbyEnemies: 1, ...context });
  assert.equal(choose({ incomingAttack: true }).id, 'force_barrier');
  assert.equal(choose({ distance: 100, nearbyEnemies: 3 }).id, 'force_repulse');
  assert.equal(choose({ distance: 200, nearbyEnemies: 3 }).id, 'force_sweep');
  assert.equal(choose({ targetGuarding: true }).id, 'force_lightning');
  assert.equal(choose({ targetRecovering: true }).id, 'force_grip');
  assert.equal(choose({ distance: 50 }).id, 'force_push');
  assert.equal(choose({ energy: 5 }), null);
  assert.equal(choose({ distance: 800 }), null);
  assert.equal(choose({ rankIndex: 0, targetGuarding: true }).id, 'force_push');
});

test('legacy equipment and old pending Force stats remain identical', () => {
  for (const weapon of Object.values(WEAPONS)) {
    assert.equal(forceAbilityWeapon(weapon), weapon);
    const push = forceAbilityWeapon(weapon, 'force_push');
    for (const key of Object.keys(weapon)) assert.equal(push[key], weapon[key]);
    const pull = forceAbilityWeapon(weapon, 'force_pull');
    assert.equal(pull.id, weapon.id); assert.equal(pull.family, weapon.family);
    assert.equal(pull.quality, weapon.quality); assert.ok(pull.knockback < 0);
    const barrier = forceAbilityWeapon(weapon, 'force_barrier');
    assert.equal(barrier.damage, 0); assert.ok(barrier.barrierEnergy > 0);
    assert.ok(barrier.barrierTicks > 0 && barrier.barrierReduction < 1);
  }
});

test('enemy relic carriers attract affordable in-range control instead of repeated guard pressure', () => {
  const choose = context => selectForceAbility({ rankIndex:14,energy:100,distance:200,nearbyEnemies:1,targetGuarding:true,enemyCarrier:true,...context });
  assert.equal(choose({}).id, 'force_pull');
  assert.equal(choose({ targetRecovering:true }).id, 'force_grip');
  assert.equal(choose({ distance:60 }).id, 'force_pull');
  assert.equal(choose({ energy:24 }).id, 'force_pull');
  assert.equal(choose({ rankIndex:4 }).id, 'force_pull');
  assert.equal(choose({ rankIndex:0 }).id, 'force_push', 'rank must still limit control access');
  assert.equal(choose({ distance:400,energy:24 }).id, 'force_push', 'carrier priority cannot extend control range');
  assert.equal(choose({ energy:5 }), null, 'carrier priority cannot bypass costs');
  assert.equal(choose({ enemyCarrier:false }).id, 'force_lightning');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMS, FORCE_FAMILIES, FORCE_POWERS, SABERS, WEAPONS, KNIVES, startingLoadout } from '../dist/content.js';

test('nine selectable disciplines preserve seven primary forms and both variant pairs', () => {
  const forms = Object.values(FORMS);
  assert.equal(forms.length, 9);
  assert.deepEqual([...new Set(forms.map(f => f.primaryForm))], ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
  assert.deepEqual(forms.filter(f => f.primaryForm === 'V').map(f => f.id), ['shien', 'djem_so']);
  assert.deepEqual(forms.filter(f => f.primaryForm === 'VII').map(f => f.id), ['juyo', 'vaapad']);
  assert.equal(new Set(forms.map(f => f.technique.motion)).size, 9);
  assert.equal(new Set(forms.map(f => f.technique.name)).size, 9);
  for (const f of forms) {
    assert.equal(f.variantOf, ['V', 'VII'].includes(f.primaryForm) ? f.primaryForm : null);
    assert.ok(f.trait.length > 20);
    assert.ok(Object.isFrozen(f.technique));
  }
});

test('form combat parameters are finite, bounded and carry nonzero resource costs', () => {
  const bounds = {
    damageMultiplier: [.75, 1.25], attackIntervalMultiplier: [.8, 1.2],
    blockChance: [.15, .65], blockCost: [6, 15], counterMultiplier: [.9, 1.65],
    dashCost: [10, 25], dashCooldown: [2.5, 5.5], energyRegen: [8, 14],
    forceCostMultiplier: [.7, 1.25], reachBonus: [0, 6],
  };
  for (const f of Object.values(FORMS)) for (const [key, [min, max]] of Object.entries(bounds)) {
    assert.ok(Number.isFinite(f[key]) && f[key] >= min && f[key] <= max, `${f.id}.${key}`);
  }
});

test('form strengths carry distinct costs rather than a universal best option', () => {
  const { shii_cho: base, soresu, ataru, djem_so, niman, juyo, vaapad, makashi, shien } = FORMS;
  assert.ok(soresu.blockChance > base.blockChance && soresu.damageMultiplier < base.damageMultiplier && soresu.attackIntervalMultiplier > base.attackIntervalMultiplier);
  assert.ok(ataru.dashCost < base.dashCost && ataru.dashCooldown < base.dashCooldown && ataru.blockChance < base.blockChance);
  assert.ok(djem_so.damageMultiplier > base.damageMultiplier && djem_so.attackIntervalMultiplier > base.attackIntervalMultiplier);
  assert.ok(niman.forceCostMultiplier < base.forceCostMultiplier && niman.energyRegen > base.energyRegen && niman.damageMultiplier < base.damageMultiplier);
  assert.ok(juyo.attackIntervalMultiplier < base.attackIntervalMultiplier && juyo.blockChance < base.blockChance && juyo.energyRegen < base.energyRegen);
  assert.ok(vaapad.counterMultiplier > base.counterMultiplier && vaapad.blockCost > base.blockCost);
  assert.ok(makashi.reachBonus > base.reachBonus && makashi.forceCostMultiplier > base.forceCostMultiplier);
  assert.ok(shien.forceCostMultiplier < djem_so.forceCostMultiplier && shien.damageMultiplier < djem_so.damageMultiplier);
});

test('Force families have energy, readable windup and genuinely different roles', () => {
  assert.equal(FORCE_FAMILIES.length, 3);
  assert.equal(Object.keys(FORCE_POWERS).length, 9);
  for (const p of Object.values(FORCE_POWERS)) {
    assert.ok(p.energyCost > 0 && p.energyCost <= 35);
    assert.ok(p.windup >= .3 && p.windup < p.interval);
    assert.ok(p.stagger > 0 && p.stagger < 1);
    assert.ok(p.knockback > 0 && p.knockback <= 30);
    assert.ok(p.range > p.optimalRange);
    assert.equal(p.slot, 'ranged');
  }
  const { force_push: push, force_burst: burst, force_pulse: pulse } = FORCE_POWERS;
  assert.ok(push.knockback > burst.knockback && push.knockback > pulse.knockback);
  assert.ok(burst.damage > push.damage && burst.energyCost > push.energyCost && burst.range < push.range);
  assert.ok(pulse.range > push.range && pulse.damage < push.damage);
});

test('equipment quality improves consumed combat stats without altering the form catalog', () => {
  for (const { id } of FORCE_FAMILIES) {
    const chain = [FORCE_POWERS[`worn_${id}`], FORCE_POWERS[id], FORCE_POWERS[`improved_${id}`]];
    for (let i = 1; i < chain.length; i++) {
      assert.ok(chain[i].damage > chain[i - 1].damage);
      assert.ok(chain[i].interval < chain[i - 1].interval);
      assert.ok(chain[i].energyCost < chain[i - 1].energyCost);
      assert.ok(chain[i].accuracy > chain[i - 1].accuracy);
      assert.ok(chain[i].range > chain[i - 1].range);
    }
  }
  assert.ok(SABERS.worn_saber.damage < SABERS.saber.damage && SABERS.saber.damage < SABERS.improved_saber.damage);
  assert.ok(SABERS.worn_saber.interval > SABERS.saber.interval && SABERS.saber.interval > SABERS.improved_saber.interval);
  assert.ok(Object.values(SABERS).every(s => s.range === 44 && s.slot === 'melee'));
  assert.equal(WEAPONS, FORCE_POWERS);
  assert.equal(KNIVES, SABERS);
  assert.deepEqual(startingLoadout(), { weapon: 'force_push', meleeWeapon: 'saber' });
  assert.throws(() => { FORMS.shii_cho.blockChance = 1; }, TypeError);
});

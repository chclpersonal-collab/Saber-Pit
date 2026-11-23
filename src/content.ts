// @ts-nocheck
/** Saber forms, Force disciplines, independent equipment quality and mirrored maps. */
import { combatFormProfile } from './combat-forms.js?v=1.4.0';
export const CONTENT_VERSION = '4.0.0';
const WIDTH = 960, HEIGHT = 540;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rounded = value => Math.round(value * 1000) / 1000;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Lore traits summarize docs/saber-research.md. Numbers, move names and motions
// are original game abstractions, never authoritative film choreography.
const form = (id, name, primaryForm, variantOf, trait, motion, parameters) => ({
  id, name, primaryForm, variantOf, trait,
  moves: combatFormProfile(id).comboSteps,
  lore: { classification: 'game-adaptation', note: 'Form identities draw on canon and Legends; move names, trajectories and balance are original game adaptations.' },
  technique: { id: `${id}_technique`, name: {
    sweep: 'Opening sweep', thrust: 'Measured thrust', orbit: 'Shelter circle',
    leap: 'Vaulting cut', redirect: 'Returning guard', cleave: 'Driving counter',
    weave: 'Converging weave', flurry: 'Relentless flurry', riposte: 'Reversal spiral',
  }[motion], motion }, ...parameters,
});
export const FORMS = freeze(Object.fromEntries([
  form('shii_cho', 'Shii-Cho', 'I', null, 'Foundational bladework and broad control.', 'sweep',
    { damageMultiplier: 1, attackIntervalMultiplier: 1, blockChance: .32, blockCost: 9, counterMultiplier: 1.10, dashCost: 18, dashCooldown: 4.2, energyRegen: 11, forceCostMultiplier: 1, reachBonus: 3 }),
  form('makashi', 'Makashi', 'II', null, 'Precise, economical lightsaber dueling.', 'thrust',
    { damageMultiplier: 1.04, attackIntervalMultiplier: .92, blockChance: .40, blockCost: 8, counterMultiplier: 1.20, dashCost: 20, dashCooldown: 4.6, energyRegen: 10, forceCostMultiplier: 1.12, reachBonus: 6 }),
  form('soresu', 'Soresu', 'III', null, 'Patient defense with compact blade movements.', 'orbit',
    { damageMultiplier: .83, attackIntervalMultiplier: 1.12, blockChance: .60, blockCost: 6, counterMultiplier: .95, dashCost: 22, dashCooldown: 5, energyRegen: 12, forceCostMultiplier: 1.05, reachBonus: 0 }),
  form('ataru', 'Ataru', 'IV', null, 'Mobile offense associated with Force-assisted acrobatics.', 'leap',
    { damageMultiplier: .97, attackIntervalMultiplier: .84, blockChance: .26, blockCost: 11, counterMultiplier: 1.08, dashCost: 12, dashCooldown: 2.8, energyRegen: 9, forceCostMultiplier: 1.12, reachBonus: 1 }),
  form('shien', 'Shien', 'V', 'V', 'The ranged-defense emphasis of Form V.', 'redirect',
    { damageMultiplier: .94, attackIntervalMultiplier: 1.02, blockChance: .45, blockCost: 8, counterMultiplier: 1.25, dashCost: 19, dashCooldown: 4.2, energyRegen: 10, forceCostMultiplier: .88, reachBonus: 2 }),
  form('djem_so', 'Djem So', 'V', 'V', 'Form V emphasizes strong melee responses after defense.', 'cleave',
    { damageMultiplier: 1.20, attackIntervalMultiplier: 1.15, blockChance: .38, blockCost: 10, counterMultiplier: 1.45, dashCost: 24, dashCooldown: 5, energyRegen: 9, forceCostMultiplier: 1.12, reachBonus: 2 }),
  form('niman', 'Niman', 'VI', null, 'A blended discipline combining blade work and the Force.', 'weave',
    { damageMultiplier: .90, attackIntervalMultiplier: 1.04, blockChance: .35, blockCost: 8, counterMultiplier: 1.05, dashCost: 18, dashCooldown: 4, energyRegen: 14, forceCostMultiplier: .72, reachBonus: 0 }),
  form('juyo', 'Juyo', 'VII', 'VII', 'Aggressive offense demanding emotional discipline.', 'flurry',
    { damageMultiplier: 1.15, attackIntervalMultiplier: .82, blockChance: .20, blockCost: 12, counterMultiplier: 1.12, dashCost: 18, dashCooldown: 3.4, energyRegen: 8, forceCostMultiplier: 1.20, reachBonus: 0 }),
  form('vaapad', 'Vaapad', 'VII', 'VII', 'A Form VII variant associated with Mace Windu and controlled intensity.', 'riposte',
    { damageMultiplier: 1.06, attackIntervalMultiplier: .94, blockChance: .44, blockCost: 13, counterMultiplier: 1.60, dashCost: 22, dashCooldown: 4, energyRegen: 8, forceCostMultiplier: 1.12, reachBonus: 1 }),
].map(entry => [entry.id, entry])));

// Seconds, world-space pixels and energy points. Powers are gameplay adaptations.
// magazine/reload are inert compatibility metadata; the v4 engine spends energy.
export const FORCE_FAMILIES = freeze([
  { id: 'force_push', name: 'Force push', role: 'Displacement and control', color: '#99e6ff',
    damage: 13, interval: 3.1, accuracy: .82, range: 420, optimalRange: 240,
    magazine: 1, reload: 3.1, suppression: 16, movePenalty: .04,
    energyCost: 22, windup: .45, stagger: .32, knockback: 28 },
  { id: 'force_burst', name: 'Force burst', role: 'Close-range impact at high energy cost', color: '#e6b8ff',
    damage: 21, interval: 3.8, accuracy: .86, range: 270, optimalRange: 140,
    magazine: 1, reload: 3.8, suppression: 20, movePenalty: .10,
    energyCost: 30, windup: .60, stagger: .42, knockback: 16 },
  { id: 'force_pulse', name: 'Force pulse', role: 'Longer reach with modest impact', color: '#aaf2cb',
    damage: 11, interval: 2.8, accuracy: .88, range: 480, optimalRange: 320,
    magazine: 1, reload: 2.8, suppression: 10, movePenalty: .08,
    energyCost: 18, windup: .36, stagger: .16, knockback: 8 },
]);
export const WEAPON_FAMILIES = FORCE_FAMILIES;

export const QUALITY_LEVELS = freeze([
  { id: 'worn', label: 'Worn', quality: 0, damage: 0.86, interval: 1.10, accuracy: -0.06, range: 0.94, reload: 1.08 },
  { id: 'standard', label: '', quality: 1, damage: 1, interval: 1, accuracy: 0, range: 1, reload: 1 },
  { id: 'improved', label: 'Improved', quality: 2, damage: 1.14, interval: 0.93, accuracy: 0.05, range: 1.06, reload: 0.94 },
]);

function variantId(family, quality) {
  return quality === 1 ? family : `${QUALITY_LEVELS[quality].id}_${family}`;
}

export const FORCE_POWERS = freeze(Object.fromEntries(WEAPON_FAMILIES.flatMap(family =>
  QUALITY_LEVELS.map(q => {
    const id = variantId(family.id, q.quality);
    return [id, {
      ...family, id, family: family.id, name: `${q.label ? q.label + ' ' : ''}${family.name}`,
      quality: q.quality, tier: q.quality, slot: 'ranged',
      damage: rounded(family.damage * q.damage), interval: rounded(family.interval * q.interval),
      accuracy: rounded(clamp(family.accuracy + q.accuracy, 0.1, 0.95)),
      range: rounded(family.range * q.range), optimalRange: rounded(family.optimalRange * q.range),
      reload: rounded(family.reload * q.reload),
      suppression: rounded(family.suppression * q.damage),
      energyCost: rounded(family.energyCost * q.reload),
    }];
  })
)));

export const WEAPONS = FORCE_POWERS;
export const SABERS = freeze(Object.fromEntries(QUALITY_LEVELS.map(q => {
  const id = variantId('saber', q.quality);
  return [id, {
    id, family: 'saber', name: `${q.label ? q.label + ' ' : ''}lightsaber`,
    quality: q.quality, tier: q.quality, slot: 'melee',
    damage: rounded(19 * q.damage), interval: rounded(.85 * q.interval), range: 44,
  }];
})));

export const KNIVES = SABERS;
export function startingLoadout() { return { weapon: 'force_push', meleeWeapon: 'saber' }; }

function roll(rng) {
  const value = Number(typeof rng === 'function' ? rng() : Math.random());
  return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0;
}

function changeRecord(slot, from, to, catalog, kind) {
  const a = catalog[from], b = catalog[to];
  const delta = {
    damage: rounded(b.damage - a.damage), interval: rounded(b.interval - a.interval),
    range: rounded(b.range - a.range),
  };
  if ('accuracy' in a) delta.accuracy = rounded(b.accuracy - a.accuracy);
  if ('energyCost' in a) delta.energyCost = rounded(b.energyCost - a.energyCost);
  const meaning = kind === 'mixed' ? 'new role / tradeoffs' : kind === 'upgrade' ? 'better quality' : 'worse quality';
  return { slot, from, to, kind, changes: delta, label: `${a.name} → ${b.name} (${meaning})` };
}

/**
 * Returns a new loadout; never mutates the input or catalogs.
 * Within one family, quality changes improve or reduce damage, accuracy, speed and range.
 * A 35% ranged-family roll instead switches role at equal quality and is always called mixed.
 * At a quality boundary, the impossible direction produces no change rather than a forced reversal.
 */
export function evolveLoadout(loadout = startingLoadout(), { rng = Math.random, probability = 1 } = {}) {
  const weapon = Object.hasOwn(WEAPONS, loadout?.weapon) ? loadout.weapon : 'force_push';
  const meleeWeapon = Object.hasOwn(KNIVES, loadout?.meleeWeapon) ? loadout.meleeWeapon : 'saber';
  const out = { weapon, meleeWeapon, changes: [] };
  const probabilityNumber = Number(probability);
  const chance = Number.isFinite(probabilityNumber) ? clamp(probabilityNumber, 0, 1) : 0;
  for (const [key, slot, catalog] of [['weapon', 'ranged', WEAPONS], ['meleeWeapon', 'melee', KNIVES]]) {
    if (roll(rng) >= chance) continue;
    const from = out[key], current = catalog[from];
    let to = from, kind;
    if (slot === 'ranged' && roll(rng) < 0.35) {
      const alternatives = WEAPON_FAMILIES.filter(family => family.id !== current.family);
      const family = alternatives[Math.floor(roll(rng) * alternatives.length)];
      to = variantId(family.id, current.quality);
      kind = 'mixed';
    } else {
      const quality = current.quality + (roll(rng) < 0.5 ? -1 : 1);
      if (quality < 0 || quality >= QUALITY_LEVELS.length) continue;
      to = variantId(current.family, quality);
      kind = quality > current.quality ? 'upgrade' : 'downgrade';
    }
    out[key] = to;
    out.changes.push(changeRecord(slot, from, to, catalog, kind));
  }
  return out;
}

function coverMap({ id, name, description, lanes, banks, craters }) {
  const coverNodes = [0, 1].flatMap(team => banks.flatMap((row, bank) =>
    lanes.map((y, lane) => ({
      id: `${id}-${team}-${bank}-${lane}`, team, bank, lane,
      x: team === 0 ? row[lane] : WIDTH - row[lane], y,
    }))));
  const decorations = craters.flatMap(([x, y, radius]) => [
    { type: 'crater', x, y, radius }, { type: 'crater', x: WIDTH - x, y, radius },
  ]);
  return { id, name, description, width: WIDTH, height: HEIGHT, coverNodes, decorations,
    controlPoints: [{ id: 'center', name: 'Signal post', x: WIDTH / 2, y: HEIGHT / 2, radius: 108 }],
    cosmeticTerrainOnly: true };
}

export const MAPS = freeze([
  coverMap({
    id: 'crossroads', name: 'Crossroads', description: 'Even lanes and balanced approaches to the signal post.',
    lanes: [130, 200, 270, 340, 410],
    banks: [[175, 175, 175, 175, 175], [295, 295, 295, 295, 295], [430, 430, 430, 430, 430]],
    craters: [[350, 80, 20], [370, 310, 16], [285, 458, 12]],
  }),
  coverMap({
    id: 'zigzag', name: 'Zigzag', description: 'Staggered sandbags vary the distance between cover positions.',
    lanes: [120, 195, 270, 345, 420],
    banks: [[150, 170, 150, 170, 150], [280, 305, 280, 305, 280], [415, 438, 415, 438, 415]],
    craters: [[360, 65, 17], [225, 305, 14], [365, 465, 20]],
  }),
  coverMap({
    id: 'craterfield', name: 'Craterfield', description: 'Wider outer lanes and a recessed center approach.',
    lanes: [105, 185, 270, 355, 435],
    banks: [[165, 155, 145, 155, 165], [270, 290, 265, 290, 270], [410, 430, 420, 430, 410]],
    craters: [[330, 55, 24], [355, 230, 22], [225, 320, 17], [375, 485, 18]],
  }),
]);

function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/** Each call returns detached mutable terrain so battle damage never leaks into another match. */
export function getTerrain(id = 'crossroads') {
  const selected = MAPS.find(map => map.id === id) || MAPS[0];
  return { ...selected,
    coverNodes: selected.coverNodes.map(node => ({ ...node })),
    decorations: selected.decorations.map(decoration => ({ ...decoration })),
    controlPoints: selected.controlPoints.map(point => ({ ...point })),
  };
}

export function createTerrain(seed = 1, id = null) {
  return getTerrain(MAPS.some(map => map.id === id) ? id : MAPS[seedNumber(seed) % MAPS.length].id);
}


type Config=Partial<Record<'startingSaberWeapon'|'startingDualSabers'|'startingSaberGrip'|'startingDualPhase'|'startingSaberQuality'|'startingForceFamily'|'startingForceQuality',unknown>>;
type Kit={weapon?:string;grip?:string;forceFamily?:string;forceQuality?:string;saberQuality?:string;dualSabers?:boolean};
type Spec={duration:number;contact:number;damage:number;reach:number;arc:number;cost:number;knock:number;recoil:number;freeHand?:boolean};
/** Starting gear shared with Classic's setup vocabulary, tuned for Arcade timing. */
import { FORCE_FAMILIES, QUALITY_LEVELS } from './content.js?v=1.4.0';
import { DUAL_SABER_PROFILE } from './dual-sabers.js?v=1.4.0';

const qualityById = new Map<string,(typeof QUALITY_LEVELS)[number]>(QUALITY_LEVELS.map(grade => [grade.id, grade]));
export const ARCADE_GEAR_QUALITIES = Object.freeze(QUALITY_LEVELS.map(({ id, label }) =>
  Object.freeze({ id, label: label || 'Standard' })));

const forceDescriptions:Record<string,string> = {
  force_push: 'Knockback Cone',
  force_burst: 'Close Impact',
  force_pulse: 'Long Reach',
};
export const ARCADE_FORCE_FAMILIES = Object.freeze(FORCE_FAMILIES.map(({ id, name }) =>
  Object.freeze({ id, label: name, description: forceDescriptions[id] })));

const forceTuning = Object.freeze({
  force_push: Object.freeze({ damage: 1, reach: 1, arc: 1, cost: 1, windup: 1, recovery: 1, knock: 1, recoil: 1 }),
  force_burst: Object.freeze({ damage: 1.55, reach: .79, arc: 1.27, cost: 1.19, windup: 1.17, recovery: 1.15, knock: .56, recoil: 1.16 }),
  force_pulse: Object.freeze({ damage: .72, reach: 1.28, arc: .61, cost: .81, windup: .83, recovery: .84, knock: .29, recoil: .70 }),
});
const quality = (value:unknown) => qualityById.has(value as string) ? value as string : 'standard';
const forceFamily = (value:unknown) => typeof value === 'string' && Object.hasOwn(forceTuning, value) ? value as keyof typeof forceTuning : 'force_push';
const select = (values:unknown, team:number) => Array.isArray(values) ? values[team] : undefined;

export const ARCADE_SABER_OPTIONS = Object.freeze([
  Object.freeze({ id: 'single', weapon: 'single', grip: 'forward', label: 'Single' }),
  Object.freeze({ id: 'dual', weapon: 'dual', grip: 'forward', label: 'Dual' }),
  Object.freeze({ id: 'backhand', weapon: 'single', grip: 'backhand', label: 'Backhand' }),
  Object.freeze({ id: 'backhand-dual', weapon: 'dual', grip: 'backhand', label: 'Backhand Dual' }),
  Object.freeze({ id: 'staff', weapon: 'staff', grip: 'forward', label: 'Double-Blade' }),
  Object.freeze({ id: 'shoto', weapon: 'shoto', grip: 'forward', label: 'Shoto' }),
  Object.freeze({ id: 'orbit', weapon: 'orbit', grip: 'forward', label: 'Orbit', blades: 3 }),
  Object.freeze({ id: 'greatsaber', weapon: 'greatsaber', grip: 'forward', label: 'Greatsaber' }),
]);

export const ARCADE_SABER_VARIANTS=Object.freeze({
  shoto:Object.freeze({blade:.77,reach:.88,windup:.89,recovery:.89,cost:.87,damage:.94}),
  greatsaber:Object.freeze({blade:1.27,reach:1.13,windup:1.15,recovery:1.12,cost:1.15,damage:1.08}),
});
export const arcadeSaberVariant=(weapon?:string)=>Object.hasOwn(ARCADE_SABER_VARIANTS,weapon as string)?ARCADE_SABER_VARIANTS[weapon as keyof typeof ARCADE_SABER_VARIANTS]:null;

function saberKit(config:Config|undefined, team:number) {
  const value = select(config?.startingSaberWeapon, team);
  const legacyDual = select(config?.startingDualSabers, team) === true;
  const weapon = ['single', 'dual', 'staff', 'shoto', 'greatsaber', 'orbit'].includes(value) ? value : legacyDual ? 'dual' : 'single';
  const grip = (weapon === 'single' || weapon === 'dual') && select(config?.startingSaberGrip, team) === 'backhand' ? 'backhand' : 'forward';
  return { weapon, grip };
}

export function arcadeSaberOption(gear?:Kit) {
  return ARCADE_SABER_OPTIONS.find(o => o.weapon === gear?.weapon && o.grip === gear?.grip) ?? ARCADE_SABER_OPTIONS[0];
}

/** Normalize exactly two teams; old dual-saber checkboxes remain forward grip. */
export function normalizeArcadeGear(raw:Config = {}) {
  const teams = [0, 1];
  const kits = teams.map(team => saberKit(raw, team));
  return {
    startingSaberWeapon: kits.map(k => k.weapon),
    startingSaberGrip: kits.map(k => k.grip),
    startingDualPhase: teams.map(team => kits[team].weapon!=='orbit'&&select(raw?.startingDualPhase, team) === true),
    startingSaberQuality: teams.map(team => quality(select(raw?.startingSaberQuality, team))),
    startingDualSabers: kits.map(k => k.weapon === 'dual'),
    startingForceFamily: teams.map(team => forceFamily(select(raw?.startingForceFamily, team))),
    startingForceQuality: teams.map(team => quality(select(raw?.startingForceQuality, team))),
  };
}

/** All fighters on a side spawn with the side's gear, independent of career rank. */
export function arcadeFighterGear(config:Config, team:number) {
  const { weapon, grip } = saberKit(config, team);
  const dualSabers = weapon === 'dual';
  return Object.freeze({
    saberQuality: quality(select(config?.startingSaberQuality, team)),
    weapon, grip, dualSabers,
    dualPhase: weapon!=='orbit'&&select(config?.startingDualPhase, team) === true,
    bladeCount: weapon === 'orbit' ? 3 : weapon === 'dual' || weapon === 'staff' ? 2 : 1,
    forceFamily: forceFamily(select(config?.startingForceFamily, team)),
    forceQuality: quality(select(config?.startingForceQuality, team)),
  });
}

/**
 * Apply gear after form and career tuning, before spending energy. The engine
 * resolves each blade independently. Offhand contact is elapsed attack time
 * in seconds, not the delay from the first strike.
 */
export function arcadeGearMove<T extends Spec>(gear:Kit|undefined, moveName:string, move:T) {
  const recovery = move.duration - move.contact;
  if (moveName === 'force') {
    const id = forceFamily(gear?.forceFamily);
    const ability = forceTuning[id];
    const grade = qualityById.get(quality(gear?.forceQuality))!;
    const contact = move.contact * ability.windup;
    return {
      ...move,
      forceAbility: id,
      contact,
      duration: contact + recovery * ability.recovery * grade.interval,
      damage: move.damage * ability.damage * grade.damage,
      reach: move.reach * ability.reach * grade.range,
      arc: move.arc * ability.arc,
      cost: move.cost * ability.cost * grade.reload,
      knock: move.knock * ability.knock,
      recoil: move.recoil * ability.recoil,
    };
  }

  const grade = qualityById.get(quality(gear?.saberQuality))!;
  const variant=arcadeSaberVariant(gear?.weapon);
  if(variant&&!move.freeHand){
    const contact=move.contact*variant.windup;
    return {...move,contact,duration:contact+recovery*variant.recovery*grade.interval,
      reach:move.reach*variant.reach,cost:move.cost*variant.cost,damage:move.damage*variant.damage*grade.damage};
  }
  if (grade.id === 'standard' && gear?.dualSabers !== true) return move;
  const spec = { ...move, duration: move.contact + recovery * grade.interval, damage: move.damage * grade.damage };
  if (gear?.dualSabers !== true) return spec;

  const dual = DUAL_SABER_PROFILE;
  // Short, clearly separated contacts; too much recoil on the first blade
  // would push a legal close target beyond the follow-up before it can land.
  const contact = spec.contact + .10;
  return {
    ...spec,
    damage: spec.damage * dual.primaryDamageMultiplier,
    knock: spec.knock * .66,
    cost: spec.cost * dual.energyMultiplier,
    duration: Math.max(contact + .07, spec.contact + (spec.duration - spec.contact) * dual.recoveryMultiplier),
    offhand: {
      contact,
      damage: spec.damage * dual.offhandDamageMultiplier,
      reach: Math.max(0, spec.reach - dual.offhandReachPenalty),
      arc: spec.arc * .90,
      knock: spec.knock * .50,
      recoil: spec.recoil * .66,
    },
  };
}

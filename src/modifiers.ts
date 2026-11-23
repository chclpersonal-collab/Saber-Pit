/** Optional match rules apply equally to both squads and never alter careers. */
export const MODIFIERS = Object.freeze({
  standard: Object.freeze({
    id: 'standard', name: 'Standard', forceAttacks: true,
    description: 'Sabers, Force attacks, guard and dash are available to both sides.',
  }),
  saber_only: Object.freeze({
    id: 'saber_only', name: 'Saber only', forceAttacks: false,
    description: 'Both squads fight without Force attacks. Guard, counters and dash remain available.',
  }),
});

export function normalizeModifier(value: unknown = 'standard'): keyof typeof MODIFIERS {
  if (typeof value !== 'string' || !Object.hasOwn(MODIFIERS, value)) throw new RangeError('Unknown match modifier');
  return value as keyof typeof MODIFIERS;
}

export function getModifier(value: unknown = 'standard') { return MODIFIERS[normalizeModifier(value)]; }

export function permitsForceAttacks(config: {modifier?: unknown} = {}) {
  return getModifier(config.modifier ?? 'standard').forceAttacks;
}

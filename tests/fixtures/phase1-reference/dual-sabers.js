/** Jar'Kai is a two-blade weapon technique alongside any of the seven forms.
 * It adds independently resolved contacts, not a new form or free damage.
 * All values are gameplay adaptations; equipment quality is shared by both blades. */
export const SINGLE_SABER_PROFILE = Object.freeze({
  id: 'single', name: 'Single saber', bladeCount: 1,
  primaryDamageMultiplier: 1, offhandDamageMultiplier: 0, offhandDelayTicks: 0,
  energyMultiplier: 1, recoveryMultiplier: 1, guardBonus: 0,
  blockCostMultiplier: 1, offhandReachPenalty: 0,
});

export const DUAL_SABER_PROFILE = Object.freeze({
  id: 'jarkai', name: "Jar'Kai", bladeCount: 2,
  primaryDamageMultiplier: .82, offhandDamageMultiplier: .42, offhandDelayTicks: 7,
  energyMultiplier: 1.32, recoveryMultiplier: 1.12, guardBonus: .06,
  blockCostMultiplier: 1.08, offhandReachPenalty: 4,
});

/** Detached match configuration. Missing old configuration means one blade. */
export function normalizeDualSabers(value = [false, false]) {
  if (!Array.isArray(value) || value.length !== 2 || [0, 1].some(team => typeof value[team] !== 'boolean')) {
    throw new RangeError('Each team must select single or dual sabers');
  }
  return [...value];
}

/** Derive wielding from immutable match settings; no per-fighter save fields. */
export function usesDualSabers(config, fighterOrTeam) {
  const team = typeof fighterOrTeam === 'number' ? fighterOrTeam : fighterOrTeam?.team;
  return (team === 0 || team === 1) && config?.startingDualSabers?.[team] === true;
}

export function saberWieldProfile(config, fighterOrTeam) {
  return usesDualSabers(config, fighterOrTeam) ? DUAL_SABER_PROFILE : SINGLE_SABER_PROFILE;
}

// @ts-nocheck
/** Pure match configuration, presentation and settlement. No campaign mutation. */
export const MATCH_MODES = Object.freeze({
  control: Object.freeze({
    id: 'control', name: 'Control', objectiveEnabled: true,
    description: 'Reach 30 signal points or defeat the enemy squad.',
  }),
  elimination: Object.freeze({
    id: 'elimination', name: 'Elimination', objectiveEnabled: false,
    description: 'Defeat the enemy squad. The signal post is off.',
  }),
  relic: Object.freeze({
    id: 'relic', name: 'Relic', objectiveEnabled: true,
    description: 'Deliver the relic to your extraction zone three times or defeat the enemy squad.',
  }),
});
export const ROUND_DURATIONS = Object.freeze([45, 90, 150]);
export const DEFAULT_MATCH_RULES = Object.freeze({ matchMode: 'control', roundDuration: 90, targetScore: 30 });

/** Keep older campaigns on their original 90-second, 30-point control rules. */
export function normalizeMatchRules(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new RangeError('Invalid match rules');
  const matchMode = options.matchMode ?? DEFAULT_MATCH_RULES.matchMode;
  if (typeof matchMode !== 'string' || !Object.hasOwn(MATCH_MODES, matchMode)) throw new RangeError('Unknown match mode');
  const roundDuration = options.roundDuration ?? DEFAULT_MATCH_RULES.roundDuration;
  if (!ROUND_DURATIONS.includes(roundDuration)) throw new RangeError('Round duration must be 45, 90 or 150 seconds');
  const requiredTarget = matchMode === 'relic' ? 3 : DEFAULT_MATCH_RULES.targetScore;
  const targetScore = options.targetScore ?? requiredTarget;
  if (targetScore !== requiredTarget) throw new RangeError(matchMode === 'relic' ? 'Relic target must be 3 deliveries' : 'Signal target must be 30 points');
  return { matchMode, roundDuration, targetScore };
}

/** Shared copy keeps setup, the live objective HUD and round reports consistent. */
export function describeMatchRules(options = {}) {
  const rules = normalizeMatchRules(options), mode = MATCH_MODES[rules.matchMode];
  const relic = rules.matchMode === 'relic';
  const timeoutLabel = relic ? 'Deliveries, then survivors, then health' : mode.objectiveEnabled ? 'Signal points, then survivors, then health' : 'Survivors, then health';
  const victory = relic ? `Deliver the relic to your extraction zone ${rules.targetScore} times or defeat the enemy squad. Approach an uncontested relic to pick it up automatically. Carriers move 28% slower and cannot dash. Death drops the relic; each delivery resets it for 2 seconds.` : mode.objectiveEnabled
    ? `Reach ${rules.targetScore} signal points or defeat the enemy squad.`
    : 'Defeat the enemy squad. The signal post is off.';
  return {
    title: mode.name,
    summary: `${victory} At ${rules.roundDuration} seconds, ${timeoutLabel.toLowerCase()} decide the winner. Equal totals are a draw.`,
    objectiveLabel: relic ? `Relic · ${rules.targetScore} deliveries to win` : mode.objectiveEnabled ? `Signal · ${rules.targetScore} to win` : 'Elimination · Fighters left',
    timeoutLabel,
    objectiveEnabled: mode.objectiveEnabled,
    reportDescription: `${mode.name} · ${rules.roundDuration}s · ${mode.objectiveEnabled ? `${rules.targetScore} ${relic ? 'deliveries' : 'points'} to win · ` : ''}Tiebreak: ${timeoutLabel.toLowerCase()}`,
  };
}

const compare = values => values[0] === values[1] ? null : values[0] > values[1] ? 0 : 1;
const thousandths = value => Math.round(value * 1000);

/**
 * Return a detached settlement or null while the round is still playing.
 * The engine owns score, career awards and endless-round progression. Its fixed
 * clock is 60 Hz; a supplied tickRate is useful to other deterministic callers.
 * Elimination takes precedence over capture, including simultaneous mutual loss.
 * Timeout comparisons use integer thousandths, preserving legacy precision.
 */
export function resolveRoundOutcome(game, tickRate = 60) {
  if (!Number.isFinite(tickRate) || tickRate <= 0) throw new RangeError('Tick rate must be positive');
  const rules = normalizeMatchRules(game.config ?? { roundDuration: game.roundDuration });
  const sides = [0, 1].map(team => game.soldiers.filter(soldier => soldier.alive && soldier.team === team));
  const survivors = sides.map(side => side.length);
  const healthUnits = sides.map(side => thousandths(side.reduce((sum, soldier) => sum + soldier.hp, 0)));
  const objective = [...(game.objective?.points ?? [0, 0])];
  const objectiveEnabled = MATCH_MODES[rules.matchMode].objectiveEnabled;
  const eliminated = survivors.some(count => count === 0);
  const captured = objectiveEnabled && objective.some(points => points >= rules.targetScore - 1e-8);
  if (!eliminated && !captured && game.tick < rules.roundDuration * tickRate) return null;

  let winner, reason;
  if (eliminated) {
    winner = compare(survivors);
    reason = winner === null ? 'Mutual defeat' : 'Squad defeated';
  } else {
    // A signal lead is never a tiebreak in Elimination.
    winner = (objectiveEnabled ? compare(objective.map(thousandths)) : null)
      ?? compare(survivors) ?? compare(healthUnits);
    reason = rules.matchMode === 'relic' ? captured ? 'Relic deliveries secured' : 'Time limit: deliveries, survivors, then health' : captured ? 'Signal post secured' : objectiveEnabled
      ? 'Time limit: control, survivors, then health'
      : 'Time limit: survivors, then health';
  }
  return { winner, reason, survivors, health: healthUnits.map(value => value / 1000), objective };
}

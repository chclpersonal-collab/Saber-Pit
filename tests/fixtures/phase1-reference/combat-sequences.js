/** Context selects among authored, unlocked moves; it never changes their cost,
 * reach, contact rules or damage. The caller owns recent-move observations.
 */
import { FORMS } from './content.js';
import { getFormMoves } from './combat-forms.js';
import { trainedJumpSpec } from './airborne.js';

const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const nonnegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
const RIPOSTE = Object.freeze({ shii_cho: 1, makashi: 2, soresu: 2, ataru: 1, shien: 2, djem_so: 0, niman: 2, juyo: 1, vaapad: 2 });
const choicesIndex = (moves, id) => typeof id === 'string' ? moves.findIndex(move => move.id === id) : -1;
const GUARD_PRESSURE = Object.freeze({ shii_cho: 1, makashi: 1, soresu: 1, shien: 1, djem_so: 1, niman: 1, juyo: 1, vaapad: 1 });

/** comboIndex is the next linked phase after the last actual move. lastOutcome
 * is its outcome string; sameTarget relates that outcome to the current target.
 * Missing tactical observations retain the linked sequence. The caller still
 * owns whether an attack is legal or requested, including direct player input.
 */
export function chooseCombatSequence(context = {}) {
  const c = context && typeof context === 'object' ? context : {};
  const formId = typeof c.formId === 'string' && Object.hasOwn(FORMS, c.formId) ? c.formId : 'shii_cho';
  const moves = getFormMoves(formId), form = FORMS[formId];
  const trainedLength = Math.max(1, Math.min(moves.length, Math.floor(nonnegative(c.comboLength, 1))));
  // Repertoire breadth is independent of the number of linked beats trained.
  // Omission preserves legacy callers and saves with three-entry repertoires.
  const length = Math.max(1, Math.min(moves.length, Math.floor(nonnegative(c.repertoireLength, trainedLength))));
  const rawPhase = Math.floor(nonnegative(c.comboIndex)) % length;
  const active = c.comboActive !== false && c.sameTarget !== false;
  const phase = active ? rawPhase : 0;
  const observedPrevious = choicesIndex(moves, c.lastMoveId);
  const previous = observedPrevious >= 0 ? observedPrevious : active && c.comboActive === true ? (rawPhase + length - 1) % length : -1;
  const energy = nonnegative(c.energy, 100), reserve = nonnegative(c.energyReserve);
  const skill = Math.min(1, nonnegative(c.combatSkill));
  const choices = moves.slice(0, length).map((move, index) => ({ move, index }));
  const result = (index, reason) => ({ index, reason });
  if (length === 1) return result(0, 'Use the trained opening move');

  const commitment = move => {
    // An earned trained counter is a compact return, not a compulsory new leap.
    // Ordinary acrobatic commitments use the same trained arc as the simulator.
    const jump = c.counterReady === true && skill >= .28 ? null : trainedJumpSpec(move.jump, skill);
    return Math.ceil(Math.max((jump?.durationTicks ?? 0) * .9,
      (c.counterReady === true ? .16 : .30) * 60 * form.attackIntervalMultiplier * move.windupMultiplier *
      Math.max(.1, nonnegative(c.attackWindupMultiplier, 1))));
  };
  // Repeating the move just used cannot repeatedly harvest a situational
  // shortcut. The linked next phase remains a legal fallback, not an attack.
  const usable = index => Number.isInteger(index) && index >= 0 && index < length && index !== previous && moves[index].energyCost <= energy;
  const candidates = choices.filter(({ index }) => usable(index));
  // Acrobatics are a tactical punctuation, not every beat of an exchange. A
  // measured grounded return between flights keeps every original resource,
  // reach and contact requirement. Never invent a free attack or dodge window.
  const grounded = candidates.filter(({ move }) => !move.jump);
  const recentAerial = c.aerialRecoveryActive === true || (observedPrevious >= 0 && !!moves[observedPrevious].jump);
  if (grounded.length && recentAerial) {
    const nextGrounded = grounded.find(({ index }) => index >= phase) || grounded[0];
    return result(nextGrounded.index, 'Replant and change the blade line between aerial commitments');
  }

  const economical = [...candidates].sort((a, b) =>
    (a.move.energyCost * 2 + commitment(a.move) * .45) - (b.move.energyCost * 2 + commitment(b.move) * .45) || a.index - b.index)[0];
  const lowEnergy = energy < reserve + Math.max(...choices.map(({ move }) => move.energyCost));
  const pressured = nonnegative(c.threatCount) >= 2;
  if (economical && (lowEnergy || pressured)) return result(economical.index,
    pressured ? 'Use a compact response under overlapping pressure' : 'Use an economical recovery move');

  const riposte = RIPOSTE[formId];
  if (c.counterReady === true && usable(riposte)) return result(riposte, 'Link the earned parry into a form riposte');

  const connected = c.comboActive === true && c.sameTarget !== false && ['hit', 'blocked'].includes(c.lastOutcome);
  const finisher = trainedLength >= 3 ? choices.find(({ move }) => move.role === 'finisher')?.index ?? Math.min(2, length - 1) : -1;
  if (connected && usable(finisher)) {
    const window = Math.max(nonnegative(c.targetStaggerTicks), nonnegative(c.targetRecoveryTicks));
    if (window > commitment(moves[finisher]) + 2 || nonnegative(c.targetEnergy, 100) < 5) {
      return result(finisher, 'Finish a connected combination in a measured opening');
    }
  }

  if (nonnegative(c.nearbyEnemies) >= 2) {
    const clearing = [...candidates].filter(({ move }) => move.arc >= 1.7)
      .sort((a, b) => b.move.arc - a.move.arc || a.move.energyCost - b.move.energyCost || a.index - b.index)[0];
    if (clearing) return result(clearing.index, 'Use the form\'s broad clearing move');
  }
  const pressureMove = GUARD_PRESSURE[formId];
  if (c.targetGuarding === true && usable(pressureMove) && pressureMove >= phase) {
    return result(pressureMove, formId === 'djem_so' ? 'Apply the authored guard-breaking pressure' : 'Change the attack rhythm against guard');
  }
  if (c.sameTarget === false || c.comboActive === false) {
    if (Number.isFinite(c.attackSequence) && candidates.length) {
      const sequence = Math.floor(nonnegative(c.attackSequence));
      const compact = candidates.filter(({ move }) => !move.jump && move.role !== 'finisher');
      const aerial = candidates.filter(({ move }) => move.jump);
      // Rotate aerial families independently of grounded beats: indexing the
      // mixed pool by every third attack aliases into the same vault forever.
      if (aerial.length && sequence % 3 === 0) {
        return result(aerial[Math.floor(sequence / 3) % aerial.length].index, 'Change the aerial approach after re-establishing measure');
      }
      const openingPool = compact.length ? compact : candidates;
      return result(openingPool[sequence % openingPool.length].index, 'Establish measure from a fresh trained attack line');
    }
    const opening = observedPrevious === 0 ? candidates.find(({ move }) => !move.jump) || candidates[0] : null;
    return result(opening?.index ?? 0, 'Establish a new measured opening');
  }
  if (['miss', 'out-of-range', 'target-lost', 'interrupted'].includes(c.lastOutcome)) {
    const compact = candidates.filter(({ move }) => !move.jump);
    const pool = compact.length ? compact : candidates;
    const reset = Number.isFinite(c.attackSequence) && pool.length ? pool[Math.floor(nonnegative(c.attackSequence)) % pool.length]
      : observedPrevious === 0 ? pool[0] : null;
    return result(reset?.index ?? 0, 'Re-establish measure after broken contact');
  }
  const next = observedPrevious === phase ? candidates.find(({ index }) => index > phase) || candidates[0] : null;
  return result(next?.index ?? phase, 'Continue the linked form sequence');
}

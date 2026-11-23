// @ts-nocheck
/** Context selects among authored, unlocked moves; it never changes their cost,
 * reach, contact rules or damage. The caller owns recent-move observations.
 */
import { FORMS } from './content.js?v=1.4.0';
import { getFormMoves } from './combat-forms.js?v=1.4.0';
import { trainedJumpSpec } from './airborne.js?v=1.4.0';

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

// The functions above select authoritative moves. Everything below is a pure
// presentation projection: no timers, saves, RNG draws, hits or fighter writes.
const visualClamp = value => Math.max(0, Math.min(1, finite(value, 0)));

/** Build disjoint, shared visual beats from *real* attacks/contact records.
 * Calling once per rendered frame gives both actors the same pair/phase clock.
 * Resolved blocked contacts alone create a blade lock; no independent random
 * visual move selection can suggest a new hit or an unearned aerial dodge.
 * A fresh map is returned every time, so reset/load/rewind has no stale state.
 * `swings` is the renderer's Map of authoritative saber effects by soldier ID.
 */
export function sampleSharedCombatBeats({ fighters = [], swings = new Map(), tick = 0, reducedMotion = false } = {}) {
  const result = new Map();
  if (reducedMotion || !Number.isFinite(tick)) return result;
  const actors = fighters instanceof Map ? [...fighters.values()] : Array.isArray(fighters) ? fighters : [];
  const byId = new Map(actors.filter(f => f && f.id != null && f.alive !== false).map(f => [f.id, f]));
  const candidates = [];
  for (const actor of byId.values()) {
    const attack = actor.attack;
    if (attack?.kind === 'saber' && Number.isFinite(attack.startedTick) && Number.isFinite(attack.resolveTick)
      && tick >= attack.startedTick && tick <= attack.resolveTick + 1) {
      candidates.push({ actor, targetId: attack.target ?? attack.targetId, start: attack.startedTick,
        contact: attack.resolveTick, key: `${actor.id}:${attack.startedTick}`, resolved: false });
    }
    const swing = swings instanceof Map ? swings.get(actor.id) : null;
    if (swing && Number.isFinite(swing.tick) && tick >= swing.tick && tick - swing.tick < 22) {
      candidates.push({ actor, targetId: swing.targetId, start: swing.tick, contact: swing.tick,
        key: `${actor.id}:${swing.id ?? swing.tick}`, resolved: true, outcome: swing.outcome });
    }
  }
  // Most recent real contact wins overlapping exchanges. Stable IDs break ties;
  // each fighter belongs to at most one pair, even in a crowded squad fight.
  candidates.sort((a, b) => b.start - a.start || Number(b.resolved) - Number(a.resolved) || a.key.localeCompare(b.key));
  for (const event of candidates) {
    const a = event.actor, b = byId.get(event.targetId);
    if (!b || a.id === b.id || a.team === b.team || result.has(a.id) || result.has(b.id)) continue;
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite) || Math.hypot(a.x - b.x, a.y - b.y) > 120) continue;
    const pairId = [String(a.id), String(b.id)].sort().join('|');
    const age = Math.max(0, tick - event.contact);
    const progress = event.resolved ? visualClamp(age / 22) : visualClamp((tick - event.start) / Math.max(1, event.contact - event.start));
    const lock = event.resolved && event.outcome === 'blocked' && age < 8;
    const airborne = a.airborne && tick >= a.airborne.startTick && tick < a.airborne.endTick;
    const phase = lock ? 'blade-lock' : event.resolved ? 'break-away' : airborne ? 'acrobatic-exchange' : 'exchange';
    // One rise/fall envelope, never a repeated hopping sinusoid. Real flight
    // rotation and world height remain owned by airborne.js and the simulator.
    const weight = event.resolved ? lock ? Math.sin(Math.PI * visualClamp(age / 8))
      : Math.sin(Math.PI * (event.outcome === 'blocked' ? visualClamp((age - 8) / 14) : progress))
      : Math.sin(Math.PI * progress);
    const sign = (Math.floor(event.contact) + String(a.id).length) % 2 ? 1 : -1;
    const shared = { pairId, phase, progress, contactTick: event.contact, sourceId: a.id,
      contact: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, sparkWeight: lock ? weight : 0 };
    const make = (fighter, partner, attacker) => ({ ...shared, partnerId: partner.id,
      role: attacker ? 'initiator' : 'responder',
      // These are local joint accents, not movement/root transforms or reach.
      lean: lock ? (attacker ? 2.5 : -2.5) * weight : event.resolved ? -2 * weight : (attacker ? 1 : -2) * weight,
      crouch: (lock ? 2.5 : airborne && attacker ? 3 : 1.5) * weight,
      twist: sign * (attacker ? 1 : -1) * .32 * weight,
      bodyRoll: sign * (attacker ? 1 : -1) * .12 * weight,
      footwork: (lock ? 3 : event.resolved ? -2 : 2) * weight,
      // Acrobatics describe the actual trajectory, never request another jump.
      accent: airborne && attacker ? a.airborne.trajectory === 'side-vault' ? 'vault-return' : 'flip-return'
        : lock ? 'planted-push' : event.resolved ? 'replant' : attacker ? 'commit' : 'give-measure' });
    result.set(a.id, make(a, b, true)); result.set(b.id, make(b, a, false));
  }
  return result;
}

/** Add small synchronized torso/leg accents, retaining every authored blade
 * orientation, contact phase and extension. Never lengthen a weapon or move its
 * world root. Reduced motion is checked both here and by the pair sampler. */
export function applySharedCombatBeat(pose = {}, beat = null, reducedMotion = false) {
  if (!beat || reducedMotion) return { ...pose };
  const next = { ...pose, sharedBeat: beat.phase, sharedPairId: beat.pairId };
  for (const key of ['lean', 'crouch', 'twist', 'bodyRoll', 'footwork']) next[key] = finite(pose[key], 0) + finite(beat[key], 0);
  return next;
}

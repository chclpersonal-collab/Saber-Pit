// @ts-nocheck
/** Reproducible opponent variety, independent of the combat RNG and careers. */
import { FORMS } from './content.js?v=1.4.0';

const FORM_IDS = Object.freeze(Object.keys(FORMS));

function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 0x9e3779b9;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) || 0x9e3779b9;
}

/**
 * Every call returns a detached roster. A seeded shuffle determines the order;
 * advancing five places each round visits all nine forms at every slot because
 * five and nine are coprime. Counts differ by at most one, so a 15-fighter squad
 * always includes all seven primary forms and both V/VII variant pairs.
 *
 * A fixed form is an explicit scenario override. Neither this helper nor loading
 * a save changes an active round; the engine invokes it only at spawn boundaries.
 */
export function enemyFormsForRound(seed, round = 1, size = 5, fixedForm = null) {
  if (!Number.isSafeInteger(round) || round < 1) throw new RangeError('Opponent round must be a positive integer');
  if (!Number.isSafeInteger(size) || size < 1) throw new RangeError('Opponent roster size must be a positive integer');
  if (fixedForm !== null && fixedForm !== undefined) {
    if (typeof fixedForm !== 'string' || !Object.hasOwn(FORMS, fixedForm)) throw new RangeError('Unknown fixed opponent form');
    return Array(size).fill(fixedForm);
  }
  const order = [...FORM_IDS];
  let state = seedNumber(seed);
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const offset = (((round - 1) % order.length) * 5) % order.length;
  return Array.from({ length: size }, (_, lane) => order[(offset + lane) % order.length]);
}

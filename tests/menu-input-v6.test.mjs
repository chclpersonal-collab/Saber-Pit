import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerInput } from '../dist/input.js';
import { normalizePreferences, loadPreferences, savePreferences, DEFAULT_PREFERENCES, PREFERENCES_KEY } from '../dist/preferences.js';

const neutral = () => ({ moveX: 0, moveY: 0, guard: false, attack: false, force: false, dash: false, targetId: null });
function emit(target, type, data = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(data)) Object.defineProperty(event, key, { value, configurable: true });
  target.dispatchEvent(event); return event;
}
const key = (target, type, value, extras = {}) => emit(target, type, { key: value, repeat: false, ...extras });
function button(dataset) {
  const value = new EventTarget(), classes = new Set(); value.dataset = dataset;
  value.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) };
  const attributes = new Map(); value.setAttribute = (name, text) => attributes.set(name, text); value.getAttribute = name => attributes.get(name) ?? null;
  value.setPointerCapture = () => {}; return value;
}

test('v6 presentation preferences normalize to finite supported options', () => {
  for (const value of [null, undefined, [], 12, 'bad']) assert.deepEqual(normalizePreferences(value), DEFAULT_PREFERENCES);
  assert.deepEqual(normalizePreferences({ colors: '__proto__', motion: 'fast', effects: false, tacticalView: 1, sound: 'yes', speed: Infinity }), DEFAULT_PREFERENCES);
  const custom = { colors: 'contrast', motion: 'reduce', effects: 'minimal', tacticalView: true, sound: true, speed: 4 };
  assert.deepEqual(normalizePreferences(custom), custom); assert.notEqual(normalizePreferences(custom), custom);
  for (const speed of [1, 2, 4]) assert.equal(normalizePreferences({ speed }).speed, speed);
  for (const speed of [0, -1, 3, '2', NaN, Infinity]) assert.equal(normalizePreferences({ speed }).speed, 1);
});

test('v6 malformed and unavailable preference storage never breaks gameplay or writes campaign slots', () => {
  const values = new Map([['trenchline-campaign-v2', 'preserve']]);
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  assert.deepEqual(loadPreferences(storage), DEFAULT_PREFERENCES);
  for (const raw of ['{broken', 'null', '[]', '{"colors":"constructor","speed":"4"}']) { values.set(PREFERENCES_KEY, raw); assert.deepEqual(loadPreferences(storage), DEFAULT_PREFERENCES); }
  assert.equal(savePreferences({ speed: 2, colors: 'violet' }, storage), true); assert.equal(loadPreferences(storage).speed, 2);
  assert.equal(values.get('trenchline-campaign-v2'), 'preserve');
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  assert.deepEqual(loadPreferences(blocked), DEFAULT_PREFERENCES); assert.equal(savePreferences(DEFAULT_PREFERENCES, blocked), false);
});

test('v6 movement input normalizes diagonals and cancels opposing directions', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  key(target, 'keydown', 'w'); key(target, 'keydown', 'd');
  assert.ok(Math.abs(Math.hypot(input.snapshot().moveX, input.snapshot().moveY) - 1) < 1e-12);
  assert.ok(input.snapshot().moveX > 0 && input.snapshot().moveY < 0);
  key(target, 'keydown', 's'); key(target, 'keydown', 'a'); assert.equal(input.snapshot().moveX, 0); assert.equal(input.snapshot().moveY, 0);
  input.clear(); key(target, 'keydown', 'ArrowRight'); assert.equal(input.snapshot().moveX, 1);
  key(target, 'keyup', 'ArrowRight'); assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v6 action presses pulse once while guard stays held until release', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  const first = key(target, 'keydown', 'j'); assert.equal(first.defaultPrevented, true); assert.equal(input.snapshot().attack, true);
  input.consume(); key(target, 'keydown', 'j', { repeat: true }); assert.equal(input.snapshot().attack, false);
  key(target, 'keyup', 'j'); key(target, 'keydown', 'j'); assert.equal(input.snapshot().attack, true);
  key(target, 'keydown', 'k'); key(target, 'keydown', 'Shift'); key(target, 'keydown', ' ');
  assert.equal(input.snapshot().force, true); assert.equal(input.snapshot().dash, true); assert.equal(input.snapshot().guard, true);
  input.consume(); assert.equal(input.snapshot().guard, true); assert.equal(input.snapshot().force, false); assert.equal(input.snapshot().dash, false);
  key(target, 'keyup', ' '); assert.equal(input.snapshot().guard, false); input.dispose();
});

test('v6 inactive editable modified and native button inputs do not become game commands', () => {
  const target = new EventTarget(); let active = false;
  const input = createPlayerInput({ target, active: () => active }); key(target, 'keydown', 'w'); key(target, 'keydown', 'j'); assert.deepEqual(input.snapshot(), neutral());
  active = true;
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) key(target, 'keydown', 'w', { target: { tagName } });
  key(target, 'keydown', 'j', { target: { isContentEditable: true } });
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) key(target, 'keydown', 'w', { [modifier]: true });
  key(target, 'keydown', ' ', { target: { tagName: 'BUTTON', closest: () => ({}) } });
  assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v6 blur clear and dispose release movement targets guard and pending actions', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  key(target, 'keydown', 'w'); key(target, 'keydown', 'l'); input.pulse('force'); input.aim('red-0'); emit(target, 'blur');
  assert.deepEqual(input.snapshot(), neutral()); input.aim({ id: 'red-0' }); assert.equal(input.snapshot().targetId, null);
  input.pulse('unknown'); assert.deepEqual(input.snapshot(), neutral()); input.dispose(); key(target, 'keydown', 'w'); assert.deepEqual(input.snapshot(), neutral());
});

test('v6 touch pointer release cancel and capture loss clear held movement', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  const move = button({ moveX: '1', moveY: '0' }); input.bind(move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    emit(move, 'pointerdown', { pointerId: 7 }); assert.equal(input.snapshot().moveX, 1); assert.equal(move.classList.contains('is-held'), true);
    emit(move, type, { pointerId: 7 }); assert.equal(input.snapshot().moveX, 0); assert.equal(move.classList.contains('is-held'), false);
  }
  input.dispose();
});

test('v6 pointer action pulses and keyboard activation have matching one-action behavior', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  const attack = button({ playerAction: 'attack' }), guard = button({ playerAction: 'guard' }); input.bind(attack); input.bind(guard);
  emit(attack, 'pointerdown', { pointerId: 1 }); assert.equal(input.snapshot().attack, true); input.consume();
  emit(attack, 'click', { detail: 1 }); assert.equal(input.snapshot().attack, false, 'pointer click must not duplicate pointerdown');
  emit(attack, 'click', { detail: 0 }); assert.equal(input.snapshot().attack, true, 'native keyboard activation must work');
  emit(guard, 'pointerdown', { pointerId: 2 }); assert.equal(input.snapshot().guard, true); input.consume(); assert.equal(input.snapshot().guard, true);
  emit(guard, 'pointercancel', { pointerId: 2 }); assert.equal(input.snapshot().guard, false); input.clear(); assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v6 accessible guard activation toggles and blur resets its announced state', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true }), guard = button({ playerAction: 'guard' }); input.bind(guard);
  assert.equal(guard.getAttribute('aria-pressed'), 'false'); emit(guard, 'click', { detail: 0 });
  assert.equal(input.snapshot().guard, true); assert.equal(guard.getAttribute('aria-pressed'), 'true'); assert.equal(guard.classList.contains('is-held'), true);
  input.consume(); assert.equal(input.snapshot().guard, true); emit(guard, 'click', { detail: 0 }); assert.equal(input.snapshot().guard, false);
  emit(guard, 'click', { detail: 0 }); emit(target, 'blur'); assert.equal(input.snapshot().guard, false); assert.equal(guard.getAttribute('aria-pressed'), 'false'); assert.equal(guard.classList.contains('is-held'), false); input.dispose();
});

test('v6 accessible movement activation lasts exactly eight simulation consumes', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true }), move = button({ moveX: '0', moveY: '-1' }); input.bind(move);
  emit(move, 'click', { detail: 0 });
  for (let tick = 0; tick < 8; tick++) { assert.equal(input.snapshot().moveY, -1); assert.equal(input.snapshot().moveY, -1, 'observation must not consume a nudge'); input.consume(); }
  assert.equal(input.snapshot().moveY, 0);
  emit(move, 'click', { detail: 0 }); input.clear(); assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerInput } from '../dist/input.js';

function emit(target, type, data = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(data)) Object.defineProperty(event, key, { value, configurable: true });
  target.dispatchEvent(event); return event;
}
const key = (target, value, extras = {}) => emit(target, 'keydown', { key: value, repeat: false, ...extras });
const neutral = () => ({ moveX: 0, moveY: 0, guard: false, attack: false, force: false, dash: false, targetId: null });
function button(dataset) {
  const element = new EventTarget(), classes = new Set(), attributes = new Map();
  element.dataset = dataset; element.setPointerCapture = () => {};
  element.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value), toggle: (value, state) => state ? classes.add(value) : classes.delete(value) };
  element.getAttribute = name => attributes.get(name); element.setAttribute = (name, value) => attributes.set(name, value);
  return element;
}

test('v7 target cycle is scoped to active keyboard focus and fires once per Tab press', () => {
  const target = new EventTarget(); let active = true, focused = true, cycles = 0;
  const input = createPlayerInput({ target, active: () => active, keyboardActive: () => focused, onCycleTarget: () => cycles++ });
  assert.equal(key(target, 'Tab').defaultPrevented, true); assert.equal(cycles, 1);
  assert.equal(key(target, 'Tab', { repeat: true }).defaultPrevented, true); assert.equal(cycles, 1);
  key(target, 'Tab'); assert.equal(cycles, 2);
  focused = false; assert.equal(key(target, 'Tab').defaultPrevented, false); assert.equal(cycles, 2);
  focused = true; active = false; assert.equal(key(target, 'Tab').defaultPrevented, false); assert.equal(cycles, 2);
  assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v7 backward Tab, editable fields and browser shortcuts keep native behavior', () => {
  const target = new EventTarget(); let cycles = 0;
  const input = createPlayerInput({ target, active: () => true, onCycleTarget: () => cycles++ });
  for (const extras of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, ...['INPUT', 'TEXTAREA', 'SELECT'].map(tagName => ({ target: { tagName } })), { target: { isContentEditable: true } }]) assert.equal(key(target, 'Tab', extras).defaultPrevented, false);
  assert.equal(cycles, 0); assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v7 keyboard movement and attacks require keyboard focus while touch remains usable', () => {
  const target = new EventTarget(); let focused = false;
  const input = createPlayerInput({ target, active: () => true, keyboardActive: () => focused });
  for (const value of ['w', 'ArrowUp', 'j', 'k', 'l', 'Shift', ' ']) assert.equal(key(target, value).defaultPrevented, false);
  assert.deepEqual(input.snapshot(), neutral());
  const move = button({ moveX: '1', moveY: '0' }); input.bind(move);
  emit(move, 'pointerdown', { pointerId: 1 }); assert.equal(input.snapshot().moveX, 1);
  emit(move, 'pointercancel', { pointerId: 1 }); assert.equal(input.snapshot().moveX, 0);
  focused = true; key(target, 'w'); key(target, 'j'); assert.equal(input.snapshot().moveY, -1); assert.equal(input.snapshot().attack, true);
  input.clear(); focused = false; assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v7 cycle touch and assistive clicks have one action and no held command', () => {
  const target = new EventTarget(); let cycles = 0, active = true;
  const input = createPlayerInput({ target, active: () => active, keyboardActive: () => false, onCycleTarget: () => cycles++ });
  const cycle = button({ playerAction: 'cycle' }); input.bind(cycle); input.bind(cycle);
  emit(cycle, 'pointerdown', { pointerId: 1 }); assert.equal(cycles, 1); assert.deepEqual(input.snapshot(), neutral());
  emit(cycle, 'click', { detail: 1 }); assert.equal(cycles, 1);
  emit(cycle, 'pointerup', { pointerId: 1 }); assert.equal(cycle.classList.contains('is-held'), false);
  emit(cycle, 'click', { detail: 0 }); assert.equal(cycles, 2);
  active = false; emit(cycle, 'pointerdown', { pointerId: 2 }); emit(cycle, 'click', { detail: 0 }); assert.equal(cycles, 2);
  input.dispose();
});

test('v7 clear resets a target plus simultaneous keyboard, touch and assistive input', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  const move = button({ moveX: '1', moveY: '0' }), guard = button({ playerAction: 'guard' }); input.bind(move); input.bind(guard);
  emit(move, 'pointerdown', { pointerId: 4 }); emit(guard, 'click', { detail: 0 }); key(target, 'w'); key(target, 'k'); input.aim('red-2');
  input.clear(); assert.deepEqual(input.snapshot(), neutral()); assert.equal(guard.getAttribute('aria-pressed'), 'false'); assert.equal(move.classList.contains('is-held'), false);
  emit(move, 'pointerup', { pointerId: 4 }); assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

test('v7 disposal prevents stale touch controls from firing new actions', () => {
  const target = new EventTarget(); let cycles = 0;
  const input = createPlayerInput({ target, active: () => true, onCycleTarget: () => cycles++ });
  const cycle = button({ playerAction: 'cycle' }), strike = button({ playerAction: 'attack' }); input.bind(cycle); input.bind(strike);
  input.dispose();
  for (const element of [cycle, strike]) { emit(element, 'pointerdown', { pointerId: 4 }); emit(element, 'click', { detail: 0 }); }
  input.pulse('force'); key(target, 'Tab'); assert.equal(cycles, 0); assert.deepEqual(input.snapshot(), neutral());
});

test('v7 an input consumer without cycling leaves Tab alone', () => {
  const target = new EventTarget(), input = createPlayerInput({ target, active: () => true });
  assert.equal(key(target, 'Tab').defaultPrevented, false); assert.deepEqual(input.snapshot(), neutral()); input.dispose();
});

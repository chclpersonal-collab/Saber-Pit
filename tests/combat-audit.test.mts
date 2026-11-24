import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, command, setAutoCommand, setForm, resolveDamage, MAPS } from '../dist/sim.js';
import { FORMS, FORCE_POWERS } from '../dist/content.js';
import { assertHealthy, configure, finishChecked } from '../scripts/audit-saber.mjs';

test('all nine forms replay deterministically on every map with bounded Force and record state', () => {
  const forms = Object.keys(FORMS), powers = Object.keys(FORCE_POWERS);
  assert.equal(forms.length, 9);
  for (const map of MAPS) for (const [index, form] of forms.entries()) {
    function run() {
      const g = createGame(81, { terrain: map.id, autoCommand: true });
      configure(g, form, powers[index]);
      return finishChecked(g);
    }
    assert.deepEqual(run(), run(), `${map.id}/${form}`);
  }
});

test('invalid form changes preserve game state and valid selection consumes no RNG', () => {
  const g = createGame(91), before = structuredClone(g);
  for (const form of ['bad', '__proto__', null, {}, 0]) assert.equal(setForm(g, 0, form), false);
  for (const lane of [-1, 5, .5, null, '0', NaN]) assert.equal(setForm(g, lane, 'soresu'), false);
  for (const team of [-1, 2, .5, null, '0', NaN]) assert.equal(setForm(g, 0, 'soresu', team), false);
  assert.deepEqual(g, before);
  assert.equal(setForm(g, 0, 'soresu'), true); assert.equal(g.rngState, before.rngState);
  assert.equal(g.soldiers[0].form, 'soresu'); assert.deepEqual(g.careers, before.careers);
  assert.deepEqual(g.records, before.records); assert.deepEqual(g.loadouts, before.loadouts);
});

test('support spam and repeated manual/Auto changes keep resource state and event history bounded', () => {
  const g = createGame(92, { autoCommand: true });
  for (let frame = 0; frame < 5400 && g.status === 'playing'; frame++) {
    command(g, 'wave'); command(g, 'barrier');
    if (frame % 120 === 0) { command(g, 'advance'); setAutoCommand(g, true); }
    step(g, 1 / 60);
    if (frame % 30 === 0) assertHealthy(g);
  }
  assert.equal(g.status, 'ended'); assertHealthy(g);
  assert.ok(g.events.length <= 32);
  assert.equal(new Set(g.events.map(e => e.id)).size, g.events.length);
});

test('repeated stagger pressure always leaves an actionable recovery window', () => {
  const g = createGame(93), target = g.soldiers[5];
  let maximumStreak = 0, streak = 0, actionable = 0;
  for (let tick = 0; tick < 600; tick++) {
    g.tick = tick; g.time = tick / 60; g.timeLeft = 90 - g.time;
    resolveDamage(g, [{ source: 'blue-0', target: target.id, amount: 0, stagger: 999 }]);
    if (target.staggerUntil > tick) { streak++; maximumStreak = Math.max(maximumStreak, streak); }
    else { streak = 0; actionable++; }
  }
  assert.ok(maximumStreak <= 39, `continuous stagger lasted ${maximumStreak} ticks`);
  assert.ok(actionable >= 270, 'post-stagger immunity leaves substantial actionable time');
  assert.equal(target.hp, 120);
});

test('pressure pinning and exhausted Force energy recover after attacks cease', () => {
  const g = createGame(94); g._nextAiDecision = 1e9;
  for (const s of g.soldiers) { s.saberReadyTick = 1e9; s.forceReadyTick = 1e9; }
  const s = g.soldiers[0]; s.suppression = 100; s.energy = 0; s.hp = 75;
  step(g, 1 / 60); assert.equal(s.pinned, true);
  step(g, 8);
  assert.equal(s.pinned, false); assert.ok(s.suppression < 1); assert.ok(s.energy > 50);
  assert.equal(s.hp, 75, 'resource recovery does not restore lost health');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../dist/audio.js';

function harness() {
  let count = 0;
  const frequencies = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const context = {
    state: 'running', currentTime: 0, destination: {},
    createOscillator() { count++; return { frequency: { setValueAtTime(value) { frequencies.push(value); }, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} }; },
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; },
    close() { this.state = 'closed'; },
  };
  return { context, count: () => count, frequencies };
}
const state = () => ({ seed: 1, round: 1, time: 1, effects: [{ id: 1, type: 'saber' }] });

test('sound defaults off and leaves simulation data unchanged', async () => {
  const h = harness(); const audio = createAudio({ contextFactory: () => h.context });
  await audio.unlock(); const game = state(); const copy = structuredClone(game);
  audio.tick(game); assert.equal(h.count(), 0); assert.deepEqual(game, copy);
});
test('audio emits each event once, caps overlapping events, and resets on a new round', async () => {
  const h = harness(); const audio = createAudio({ contextFactory: () => h.context });
  await audio.unlock(); audio.setEnabled(true); const game = state();
  audio.tick(game); audio.tick(game); assert.equal(h.count(), 1);
  game.round++; audio.tick(game); assert.equal(h.count(), 2);
  for (let id = 2; id < 100; id++) { game.effects = [{ id, type: 'saber' }]; audio.tick(game); }
  assert.ok(h.count() <= 13); audio.dispose(); audio.tick(game); assert.equal(audio.enabled, false);
});
test('unavailable audio and denied context creation do not break gameplay', async () => {
  const audio = createAudio({ contextFactory() { throw Error('blocked'); } });
  assert.equal(await audio.unlock(), false); audio.setEnabled(true); audio.tick(state()); audio.dispose();
});

test('v5 misses and interrupted casts never play a confirmed contact tone', async () => {
  for (const outcome of ['miss', 'out-of-range', 'target-lost', 'interrupted']) {
    const h = harness(), audio = createAudio({ contextFactory: () => h.context });
    await audio.unlock(); audio.setEnabled(true);
    const game = { ...state(), effects: [{ id: 1, type: 'feedback', outcome, damage: 0 }, { id: 2, type: 'force', outcome }] };
    const before = structuredClone(game); audio.tick(game);
    assert.equal(h.count(), 0, `${outcome} cannot sound like contact`);
    assert.deepEqual(game, before);
    game.effects = [{ id: 3, type: 'saber', outcome }]; audio.tick(game);
    assert.deepEqual(h.frequencies, [330], 'a missed saber may still have a swing sound');
    audio.dispose();
  }
});

test('v5 confirmed hit, block and counter feedback have distinct contact tones emitted once', async () => {
  for (const [outcome, isCounter, frequency] of [['hit', false, 190], ['blocked', false, 880], ['hit', true, 520]]) {
    const h = harness(), audio = createAudio({ contextFactory: () => h.context });
    await audio.unlock(); audio.setEnabled(true);
    const game = { ...state(), effects: [{ id: 1, type: 'feedback', outcome, isCounter, damage: 4 }] }, before = structuredClone(game);
    audio.tick(game); audio.tick(game);
    assert.deepEqual(h.frequencies, [frequency]); assert.deepEqual(game, before); audio.dispose();
  }
});

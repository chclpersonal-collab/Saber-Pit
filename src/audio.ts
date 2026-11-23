// @ts-nocheck
/** Optional, synthesized effects. No assets, network, or simulation state writes. */
export function createAudio({ contextFactory } = {}) {
  let context = null;
  let enabled = false;
  let generation = '';
  let lastEffect = 0;
  let lastTime = -1;
  let disposed = false;
  const voices = new Set();
  const createContext = contextFactory || (() => {
    const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Constructor ? new Constructor() : null;
  });

  async function unlock() {
    if (disposed) return false;
    try {
      context ||= createContext();
      if (!context) return false;
      if (context.state === 'suspended') await context.resume();
      return context.state === 'running';
    } catch { return false; }
  }

  function silence() {
    for (const voice of voices) {
      try { voice.stop(); } catch { /* Already ended. */ }
      try { voice.disconnect(); } catch { /* Already disconnected. */ }
    }
    voices.clear();
  }

  function tone(frequency, duration, volume, type = 'triangle', endFrequency = frequency) {
    if (!enabled || !context || context.state !== 'running' || voices.size >= 12) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      voices.add(oscillator);
      oscillator.onended = () => {
        voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
    } catch { /* Audio is optional; gameplay must never fail on audio errors. */ }
  }

  function tick(game) {
    if (disposed || !game) return;
    const key = `${game.seed}:${game.round}`;
    if (key !== generation || game.time < lastTime) {
      generation = key;
      lastEffect = 0;
      silence();
    }
    lastTime = game.time;
    const effects = game.effects || [];
    let swings = 0;
    let force = false;
    let contact = null;
    for (const effect of effects) {
      if (!Number.isFinite(effect.id) || effect.id <= lastEffect) continue;
      lastEffect = Math.max(lastEffect, effect.id);
      if (effect.type === 'saber') swings += 1;
      if (effect.type === 'force' && ['hit', 'blocked'].includes(effect.outcome)) force = true;
      if (effect.type === 'feedback') {
        const resolved = effect.outcome === 'blocked' ? 'block' : effect.outcome === 'hit' ? effect.isCounter ? 'counter' : 'hit' : null;
        const priority = { hit: 1, block: 2, counter: 3 };
        if (resolved && (priority[resolved] > (priority[contact] || 0))) contact = resolved;
      }
    }
    if (swings) tone(330, 0.12, 0.013, 'triangle', 115);
    if (force) tone(110, 0.28, 0.025, 'sawtooth', 50);
    // A swing can miss. Contact sounds only follow a confirmed engine outcome.
    if (contact === 'hit') tone(190, 0.065, 0.017, 'triangle', 65);
    if (contact === 'block') tone(880, 0.09, 0.018, 'sine', 440);
    if (contact === 'counter') tone(520, 0.13, 0.020, 'triangle', 1040);
  }

  return {
    unlock,
    setEnabled(value) {
      enabled = !disposed && Boolean(value);
      if (!enabled) silence();
      return enabled;
    },
    get enabled() { return enabled; },
    tick,
    silence,
    dispose() {
      disposed = true;
      enabled = false;
      silence();
      try { context?.close(); } catch { /* Optional cleanup. */ }
      context = null;
    },
  };
}

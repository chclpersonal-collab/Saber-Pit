// @ts-nocheck
/** Presentation-only time budget. Never serialized or attached to the game.
 * Durations are seconds, not requestAnimationFrame calls or simulation ticks.
 * The authoritative step function remains untouched. */
export const HIT_STOP_SECONDS = Object.freeze({ hit: 4 / 60, blocked: 6 / 60 });
const seconds = value => Number.isFinite(value) && value > 0 ? value : 0;
const latestEffect = game => (game?.effects || []).reduce((id, effect) => Math.max(id, Number.isFinite(effect.id) ? effect.id : 0), 0);

export function createPresentationClock() {
  let remaining = 0, lastId = 0, source = null, round = null, lastTick = 0;
  return {
    get remaining() { return remaining; },
    get stopped() { return remaining > 1e-12; },
    /** Cancel a transient at pause, hidden, load, new game, or next round.
     * Prime retained feedback IDs so restored effects cannot replay a stop. */
    reset(game = null) {
      remaining = 0; source = game; round = game?.round ?? null;
      lastTick = game?.tick ?? 0; lastId = latestEffect(game);
    },
    /** Consume wall-clock time before each simulation slice. The caller may
     * render particles/glow for the full elapsed interval, but only the returned
     * seconds are eligible for simulation. Speed applies AFTER this call. */
    consume(elapsed) {
      const dt = seconds(elapsed), held = Math.min(dt, remaining);
      remaining = Math.max(0, remaining - held);
      if (remaining < 1e-12) remaining = 0;
      return Math.max(0, dt - held);
    },
    /** Observe after EVERY authoritative step, not just once per display frame.
     * Only resolved saber feedback creates a stop. The matching saber and block
     * effects are deliberately ignored, avoiding two stops for one contact.
     * Concurrent contacts overlap (maximum duration), rather than accumulating
     * a squad-sized freeze. No RNG calls and no writes to game/effect records. */
    observe(game) {
      if (source !== game || round !== game?.round || (game?.tick ?? 0) < lastTick) {
        this.reset(game); return 0;
      }
      lastTick = game?.tick ?? 0;
      let duration = 0;
      for (const effect of game?.effects || []) {
        if (!Number.isFinite(effect.id) || effect.id <= lastId) continue;
        if (effect.type === 'feedback' && effect.kind === 'saber') {
          duration = Math.max(duration, HIT_STOP_SECONDS[effect.outcome] || 0);
        }
      }
      lastId = Math.max(lastId, latestEffect(game));
      remaining = Math.max(remaining, duration);
      return duration;
    },
  };
}

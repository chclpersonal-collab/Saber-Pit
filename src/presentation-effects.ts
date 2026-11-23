// @ts-nocheck
/** Transient, renderer-owned ink. Never stored in a game, never consumes RNG.
 * Coordinates passed to sampleBlade and emitted effects use the caller's world
 * space. advance is real elapsed time, including during presentation hit-stop.
 * Reset on load/new round/reset/visibility/pause to prevent stale trail bridges. */
const finite = n => Number.isFinite(n) ? n : 0;
const clamp = n => Math.max(0, Math.min(1, n));
export const PRESENTATION_EFFECT_SECONDS = Object.freeze({ flash: 2.5 / 60, sparks: 10 / 60, shake: 10 / 60, trail: 6 / 60, force: .32 });
const point = p => ({ x: finite(p?.x), y: finite(p?.y) });
const identity = e => String(e.id ?? `${e.type}:${e.tick}:${e.soldierId}:${e.targetId}:${e.outcome}`);
const colorOf = e => e.team === 1 ? '#ffc3a4' : '#a0fff1';

export function createPresentationEffects() {
  let now = 0, reduced = false, stopped = false;
  const seen = new Set(), contacts = [], forces = [], trails = new Map();
  function reset(existing = []) {
    now = 0; contacts.length = 0; forces.length = 0; trails.clear(); seen.clear();
    for (const e of existing) seen.add(identity(e));
  }
  function advance(seconds, { reducedMotion = false, paused = false, visible = true } = {}) {
    reduced = !!reducedMotion; stopped = paused || !visible;
    if (stopped) { contacts.length = 0; forces.length = 0; trails.clear(); return; }
    now += Math.max(0, finite(seconds));
    if (reduced) { contacts.length = 0; trails.clear(); }
    for (let i = contacts.length - 1; i >= 0; i--) if (now - contacts[i].born >= PRESENTATION_EFFECT_SECONDS.sparks) contacts.splice(i, 1);
    for (let i = forces.length - 1; i >= 0; i--) if (now - forces[i].born >= PRESENTATION_EFFECT_SECONDS.force) forces.splice(i, 1);
    for (const [id, samples] of trails) {
      while (samples.length && now - samples[0].time > PRESENTATION_EFFECT_SECONDS.trail) samples.shift();
      if (!samples.length) trails.delete(id);
    }
  }
  function observe(effects = []) {
    for (const e of effects) {
      const id = identity(e); if (seen.has(id)) continue; seen.add(id);
      if (stopped) continue;
      if (e.type === 'saber' && ['hit', 'blocked'].includes(e.outcome) && !reduced) {
        // One authoritative saber event, not the duplicate block/impact event.
        const seed = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
        contacts.push({ born: now, x: finite(e.x2 ?? e.x), y: finite(e.y2 ?? e.y), color: colorOf(e), seed, count: 6 + seed % 5, clash: e.outcome === 'blocked' });
      }
      const family = e.abilityId || e.family || 'force_push';
      if (e.type === 'force' && family === 'force_push') forces.push({ born: now, from: point(e), to: point({ x: e.x2 ?? e.x, y: e.y2 ?? e.y }), color: colorOf(e) });
    }
    // Effects have monotonic per-game IDs; retaining recent IDs also bounds memory.
    if (seen.size > 4096) { const recent = [...seen].slice(-2048); seen.clear(); recent.forEach(id => seen.add(id)); }
  }
  function sampleBlade(id, hilt, tip, { active = false, color = '#a0fff1' } = {}) {
    if (reduced || stopped || !active) { trails.delete(id); return; }
    const samples = trails.get(id) || [];
    const last = samples.at(-1), a = point(hilt), b = point(tip);
    // A teleport, camera generation or interrupted sequence must not bridge.
    if (last && Math.hypot(a.x - last.hilt.x, a.y - last.hilt.y) > 100) samples.length = 0;
    if (!samples.length || now - samples.at(-1).time >= 1 / 60 - 1e-8) {
      samples.push({ time: now, hilt: a, tip: b, color });
      while (samples.length > 6) samples.shift();
    }
    trails.set(id, samples);
  }
  function shake() {
    if (reduced || stopped || !contacts.length) return { x: 0, y: 0 };
    const c = contacts.at(-1), t = (now - c.born) / PRESENTATION_EFFECT_SECONDS.shake;
    if (t >= 1) return { x: 0, y: 0 };
    const amplitude = (c.clash ? 3 : 2) * (1 - t) ** 2;
    return { x: Math.sin(t * 42 + c.seed) * amplitude, y: Math.cos(t * 37 + c.seed) * amplitude * .65 };
  }
  function draw(ctx) {
    if (stopped) return;
    ctx.save();
    try {
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      if (!reduced) {
        for (const samples of trails.values()) for (let i = 1; i < samples.length; i++) {
          const a = samples[i - 1], b = samples[i];
          ctx.globalAlpha = .25 * (1 - clamp((now - a.time) / PRESENTATION_EFFECT_SECONDS.trail));
          ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(a.hilt.x, a.hilt.y);
          ctx.lineTo(a.tip.x, a.tip.y); ctx.lineTo(b.tip.x, b.tip.y); ctx.lineTo(b.hilt.x, b.hilt.y); ctx.closePath(); ctx.fill();
        }
        for (const c of contacts) {
          const age = now - c.born, p = clamp(age / PRESENTATION_EFFECT_SECONDS.sparks);
          if (age < PRESENTATION_EFFECT_SECONDS.flash) {
            ctx.globalAlpha = 1 - age / PRESENTATION_EFFECT_SECONDS.flash; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(c.x, c.y, 4 + age * 150, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#fff6d9'; ctx.lineWidth = 1.6;
          for (let i = 0; i < c.count; i++) {
            const angle = i * Math.PI * 2 / c.count + c.seed * .17;
            const radius = 4 + p * (22 + (i % 3) * 5), tail = Math.max(1, radius - 5 - p * 3);
            ctx.beginPath(); ctx.moveTo(c.x + Math.cos(angle) * tail, c.y + Math.sin(angle) * tail);
            ctx.lineTo(c.x + Math.cos(angle) * radius, c.y + Math.sin(angle) * radius); ctx.stroke();
          }
        }
      }
      for (const f of forces) {
        const p = clamp((now - f.born) / PRESENTATION_EFFECT_SECONDS.force);
        // Reduced motion retains one quiet destination marker, no moving ring.
        const travel = reduced ? 1 : p, x = f.from.x + (f.to.x - f.from.x) * travel, y = f.from.y + (f.to.y - f.from.y) * travel;
        ctx.globalAlpha = reduced ? .3 : .65 * (1 - p); ctx.strokeStyle = f.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, reduced ? 16 : 8 + p * 28, 0, Math.PI * 2); ctx.stroke();
      }
    } finally { ctx.restore(); }
  }
  const inspect = () => ({ time: now, reduced, stopped, contacts: contacts.map(c => ({ ...c, age: now - c.born })), forces: forces.map(f => ({ ...f, age: now - f.born })), trails: [...trails].map(([id, samples]) => ({ id, samples: samples.map(s => ({ ...s, hilt: { ...s.hilt }, tip: { ...s.tip } })) })) });
  return { advance, observe, sampleBlade, shake, draw, reset, inspect };
}

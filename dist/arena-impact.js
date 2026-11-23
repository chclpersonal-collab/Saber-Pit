/** World-space impact accents, entirely separate from the combat simulation.
 * Observe the engine's ID-ordered effects after each step and advance on
 * presentation time so impact animation keeps moving during hit-stop.
 */
const TAU = Math.PI * 2;
const LIMIT = 32;
const COLOR = ['#83ffe7', '#ffa186'];
const SPECS = {
  hit: { duration: .23, reach: 29, trails: 6, priority: 1 },
  clash: { duration: .31, reach: 41, trails: 9, priority: 2 },
  counter: { duration: .37, reach: 50, trails: 8, priority: 2 },
  ko: { duration: .49, reach: 62, trails: 9, priority: 3 },
  force: { duration: .38, reach: 45, trails: 5, priority: 2 },
  barrier: { duration: .36, reach: 34, trails: 0, priority: 2 },
};

function classify(event) {
  if (event.type === 'death') return 'ko';
  if (event.type === 'saber') {
    if (event.outcome === 'blocked') return 'clash';
    if (event.outcome === 'hit' && event.damage > 0) return event.isCounter || event.counter ? 'counter' : 'hit';
  }
  if (event.type === 'force') {
    if (event.abilityId === 'force_barrier') return 'barrier';
    if (event.outcome === 'hit' || event.outcome === 'blocked' || (event.outcome == null && event.targetId != null)) return 'force';
  }
  return null;
}

function pathRing(ctx, x, y, radius, from = 0, to = TAU) {
  ctx.beginPath(); ctx.arc(x, y, radius, from, to); ctx.stroke();
}

function spokes(ctx, effect, spec, p, expansion) {
  const rays = spec.trails;
  if (!rays) return;
  const fan = effect.kind === 'hit' || effect.kind === 'counter' || effect.kind === 'force';
  ctx.lineWidth = effect.kind === 'ko' ? 2 : 1.35;
  ctx.beginPath();
  for (let i = 0; i < rays; i++) {
    const jitter = (((effect.id * 43 + i * 73) % 97) / 97 - .5) * .38;
    const fraction = i / Math.max(1, rays - 1);
    const angle = effect.heading + jitter + (fan ? (fraction - .5) * 2.2 : i * TAU / rays);
    const length = 9 + expansion * spec.reach * (.47 + ((i * 7 + effect.id) % 11) / 17);
    const tail = Math.max(4, length - 3 - (1 - p) * (effect.kind === 'ko' ? 15 : 10));
    const dx = Math.cos(angle), dy = Math.sin(angle) * (effect.kind === 'ko' ? .73 : 1);
    ctx.moveTo(effect.x + dx * tail, effect.y + dy * tail);
    ctx.lineTo(effect.x + dx * length, effect.y + dy * length);
  }
  ctx.stroke();
}

export function createArenaImpact() {
  // Fixed reusable slots; authoritative effects are emitted with monotonic ids.
  const slots = Array.from({ length: LIMIT }, () => ({ kind: null }));
  let now = 0, newest = 0, enabled = true, active = 0;
  function clear() {
    for (const slot of slots) slot.kind = null;
    active = 0;
  }
  function reset(existing = []) {
    now = 0; newest = 0; clear();
    for (const event of existing ?? []) if (Number.isSafeInteger(event?.id)) newest = Math.max(newest, event.id);
  }
  function advance(seconds, { reducedMotion = false, fullEffects = true, paused = false, visible = true } = {}) {
    enabled = !!fullEffects && !reducedMotion && !paused && visible;
    if (!enabled) { if (active) clear(); return; }
    now += Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    if (!active) return;
    for (const slot of slots) {
      if (slot.kind && now - slot.born >= SPECS[slot.kind].duration) { slot.kind = null; active--; }
    }
  }
  function observe(events = []) {
    for (const event of events ?? []) {
      if (!Number.isSafeInteger(event?.id) || event.id <= newest) continue;
      newest = event.id;
      if (!enabled || !Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
      const kind = classify(event);
      if (!kind) continue;
      let slot = null;
      for (const candidate of slots) {
        if (!candidate.kind) { slot = candidate; break; }
        if (SPECS[candidate.kind].priority > SPECS[kind].priority) continue;
        if (!slot || SPECS[candidate.kind].priority < SPECS[slot.kind].priority ||
            (SPECS[candidate.kind].priority === SPECS[slot.kind].priority && candidate.id < slot.id)) slot = candidate;
      }
      if (!slot) continue;
      if (!slot.kind) active++;
      const dx = Number.isFinite(event.x2) ? event.x2 - event.x : 0;
      const dy = Number.isFinite(event.y2) ? event.y2 - event.y : 0;
      slot.kind = kind; slot.born = now; slot.id = event.id; slot.team = event.team === 1 ? 1 : 0;
      // Start a clash between the fighters. The other marks stay on the event target.
      const weight = kind === 'clash' ? .74 : (kind === 'ko' || kind === 'barrier' ? 0 : 1);
      slot.x = event.x + dx * weight; slot.y = event.y + dy * weight - 4;
      slot.heading = dx || dy ? Math.atan2(dy, dx) : (event.id % 31) * TAU / 31;
    }
  }
  function draw(ctx, colors) {
    if (!enabled || !active) return;
    ctx.save();
    try {
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const e of slots) {
        if (!e.kind) continue;
        const { kind, x, y, heading } = e, spec = SPECS[kind];
        const p = Math.min(1, (now - e.born) / spec.duration);
        const fade = (1 - p) ** 1.55, expansion = 1 - (1 - p) ** 2.4;
        const team = (e.team ? colors?.enemy : colors?.player) || COLOR[e.team];
        const accent = kind === 'clash' ? '#b9dbff' : kind === 'counter' ? '#ffe094' : kind === 'barrier' ? '#caf1ff' : team;
        const radius = 7 + spec.reach * expansion;
        ctx.strokeStyle = accent; ctx.globalAlpha = fade * .59; ctx.lineWidth = kind === 'ko' ? 2.6 : 1.6;
        if (kind === 'clash' || kind === 'barrier' || kind === 'ko') {
          pathRing(ctx, x, y, radius);
          ctx.globalAlpha = fade * .31; ctx.lineWidth = 1;
          pathRing(ctx, x, y, radius * .7, heading + .28, heading + 1.86);
          pathRing(ctx, x, y, radius * .7, heading + Math.PI + .28, heading + Math.PI + 1.86);
        } else if (kind === 'force' || kind === 'counter') {
          pathRing(ctx, x, y, radius, heading - .9, heading + .9);
          ctx.globalAlpha = fade * .29; ctx.lineWidth = 1;
          pathRing(ctx, x, y, radius * .73, heading - 1.2, heading + 1.2);
        }
        ctx.globalAlpha = fade * .8; ctx.strokeStyle = accent;
        spokes(ctx, e, spec, p, expansion);
        if (kind === 'counter' && p < .7) {
          const d = 3 + expansion * 17;
          ctx.strokeStyle = '#fff4c9'; ctx.globalAlpha = fade * .78; ctx.lineWidth = 1.7;
          ctx.beginPath(); ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d);
          ctx.lineTo(x - d, y); ctx.closePath(); ctx.stroke();
        }
      }
    } finally { ctx.restore(); }
  }
  const inspect = () => ({ now, newest, enabled, active, kinds: slots.filter(s => s.kind).map(s => s.kind) });
  return { reset, advance, observe, draw, inspect };
}

type InputAction = 'attack'|'force'|'dash';
type InputOptions = {target?:Window;active?:()=>boolean;keyboardActive?:(event:KeyboardEvent)=>boolean;onCycleTarget?:(()=>void)|null};
type InputProgress = {ticks?: number;accepted?:Partial<Record<InputAction,boolean>>};
type InputPointer = {x:number;y:number;guard:boolean};
/** Ephemeral keyboard/touch input. Actions are consumed only after simulation.
 * Acknowledged consumers may keep one deliberate press for eight simulation
 * ticks while a move recovers; held keys never generate automatic combinations.
 */
export function createPlayerInput({ target = globalThis.window, active = () => false, keyboardActive = () => true, onCycleTarget = null }:InputOptions = {}) {
  const keys = new Set<string>(), pointers = new Map<number,InputPointer>();
  const pulses = { attack: false, force: false, dash: false };
  const pulseTicks = { attack: 0, force: 0, dash: 0 };
  const bufferTicks = 8;
  let targetId:string|null = null, latchedGuard = false, nudge = { x: 0, y: 0, ticks: 0 };
  const buttons = new Set<HTMLButtonElement>();
  const buttonListeners: [HTMLButtonElement,string,EventListener][] = [];
  function listen<K extends keyof HTMLElementEventMap>(button:HTMLButtonElement, type:K, handler:(event:HTMLElementEventMap[K])=>void) { button.addEventListener(type, handler); buttonListeners.push([button, type, handler as EventListener]); }
  let disposed = false;
  const movement: Record<string, readonly [number,number]|undefined> = { w:[0,-1], arrowup:[0,-1], s:[0,1], arrowdown:[0,1], a:[-1,0], arrowleft:[-1,0], d:[1,0], arrowright:[1,0] };
  const actions: Record<string,InputAction|undefined> = { j:'attack', k:'force', shift:'dash' };
  function queue(value: string|undefined) { if (Object.hasOwn(pulses, value as string)) { const action=value as InputAction; pulses[action] = true; pulseTicks[action] = bufferTicks; } }
  function editable(event:KeyboardEvent) { const element=event.target as HTMLElement|null; return /^(INPUT|SELECT|TEXTAREA)$/.test(element?.tagName || '') || element?.isContentEditable; }
  function keydown(event:KeyboardEvent) {
    if (disposed || !active() || !keyboardActive(event) || editable(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    // Only unmodified forward Tab is a game action. Shift+Tab remains an escape to page navigation.
    if (key === 'tab' && !event.shiftKey && typeof onCycleTarget === 'function') { if (!event.repeat) onCycleTarget(); event.preventDefault(); return; }
    if (!movement[key] && !actions[key] && ![' ', 'l'].includes(key)) return;
    if (key === ' ' && (event.target as Element|null)?.closest?.('button')) return;
    event.preventDefault();
    if (!event.repeat && actions[key]) queue(actions[key]);
    keys.add(key);
  }
  function keyup(event:KeyboardEvent) { keys.delete(event.key.toLowerCase()); }
  function clear() { keys.clear(); pointers.clear(); targetId = null; latchedGuard = false; nudge = { x: 0, y: 0, ticks: 0 }; for (const key of (Object.keys(pulses) as InputAction[])) { pulses[key] = false; pulseTicks[key] = 0; } for (const button of buttons) { button.classList.remove('is-held'); if (button.dataset.playerAction === 'guard') button.setAttribute('aria-pressed', 'false'); } }
  target.addEventListener('keydown', keydown);
  target.addEventListener('keyup', keyup);
  target.addEventListener('blur', clear);
  function bind(button:HTMLButtonElement) {
    if (disposed || buttons.has(button)) return;
    buttons.add(button);
    const action = button.dataset.playerAction;
    const dx = Number(button.dataset.moveX || 0), dy = Number(button.dataset.moveY || 0);
    if (action === 'guard') { button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', 'Guard: hold pointer or activate to toggle'); }
    if (dx || dy) button.setAttribute('aria-label', `${button.getAttribute('aria-label') || 'Move'}: hold pointer or activate to take a short step`);
    listen(button, 'pointerdown', event => {
      if (disposed || !active()) return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: dx, y: dy, guard: action === 'guard' });
      if (action === 'cycle') onCycleTarget?.();
      queue(action);
      button.classList.add('is-held'); if (action === 'guard') button.setAttribute('aria-pressed', 'true');
    });
    const release = (event:PointerEvent) => { pointers.delete(event.pointerId); button.classList.remove('is-held'); if (action === 'guard') button.setAttribute('aria-pressed', String(latchedGuard)); };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) listen(button, name, release);
    listen(button, 'click', event => {
      if (disposed || !active() || event.detail !== 0) return;
      if (action === 'cycle') onCycleTarget?.();
      if (Object.hasOwn(pulses, action as string)) queue(action);
      else if (action === 'guard') { latchedGuard = !latchedGuard; button.setAttribute('aria-pressed', String(latchedGuard)); button.classList.toggle('is-held', latchedGuard); }
      else if (dx || dy) nudge = { x: dx, y: dy, ticks: 8 };
    });
  }
  return {
    bind, clear,
    aim(id:unknown) { if (disposed) return; targetId = typeof id === 'string' ? id : null; },
    pulse(action:string) { if (!disposed && active()) queue(action); },
    // Legacy consume() clears immediately. For buffering, report actual elapsed
    // ticks and only actions the engine really accepted. A rejected cooldown,
    // exhausted cast or blocked strike is not an acknowledgement.
    consume(progress?:InputProgress|null) {
      const buffered = progress !== null && typeof progress === 'object';
      const elapsed = buffered && Number.isFinite(progress.ticks) ? Math.max(0, Math.floor(progress.ticks!)) : 1;
      for (const key of (Object.keys(pulses) as InputAction[])) {
        pulseTicks[key] = !buffered || progress.accepted?.[key] === true ? 0 : Math.max(0, pulseTicks[key] - elapsed);
        pulses[key] = pulseTicks[key] > 0;
      }
      nudge.ticks = Math.max(0, nudge.ticks - elapsed);
    },
    snapshot() {
      let moveX = nudge.ticks > 0 ? nudge.x : 0, moveY = nudge.ticks > 0 ? nudge.y : 0, guard = latchedGuard || keys.has(' ') || keys.has('l');
      for (const key of keys) { const vector=movement[key]; if (vector) { moveX += vector[0]; moveY += vector[1]; } }
      for (const p of pointers.values()) { moveX += p.x; moveY += p.y; guard ||= p.guard; }
      const length = Math.hypot(moveX, moveY); if (length > 1) { moveX /= length; moveY /= length; }
      return { moveX, moveY, guard, ...pulses, targetId };
    },
    dispose() { disposed = true; clear(); for (const [button, type, handler] of buttonListeners) button.removeEventListener(type, handler); buttonListeners.length = 0; buttons.clear(); target.removeEventListener('keydown', keydown); target.removeEventListener('keyup', keyup); target.removeEventListener('blur', clear); },
  };
}

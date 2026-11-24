# Clarissa recommendations: movement and animation

For: Clara (code), from a read of `main` at `e648697` (Saber Pit 4.1.1).
Scope: Arena saber movement, timing and animation flow. No game code is changed in this PR.

**Target feel:** Alan Becker lightsaber fights and Madness Combat (Peasant Warfare 2). A fighter attacks from whatever pose they are in (leaning, bent, mid-recovery, off a block, off a clash) without first returning to a standing stance. Fast, continuous, readable.

## Where 4.1.1 already is (keep, don't redo)

- `entryPose()` (`src/arcade-engine.ts` L289) starts every attack from the current rig pose plus blade momentum. Good.
- Motion modes are already folded into one `ArcadeMotionFlow` profile (`src/arcade-motion-flow.ts`, `ARENA_MOTION_FLOW`). Legacy flags only apply to old replays. Good.
- Confirmed hits already chain at `finalContact + 0.050s` (`+0.025s` for grade 14) via `contactChainOpen()` (commit a81c484). Good.
- Live ground entries (`liveGroundEntry`, L361) let a running or pivoting fighter swing without stopping. Good.

## What still feels stiff

Everything that is **not** a clean hit still uses the old percent-of-swing timing, so the most common close-range outcomes (blocked swing, whiff, blade clash) freeze the fighter for most of the swing:

| Situation | Where | Now |
|---|---|---|
| Follow-up after a blocked or missed swing | `chainWindow()` L312-317 | waits until 78% of swing (71% Juyo, **83% elite**) |
| Buffered combo slash, no hit | `actionStep` L2299 | 68% (form rules 82%, Juyo 72%) |
| Buffered heavy/technique, no hit | `actionStep` L2301 | 76% (form rules 85%) |
| Cancel (dash/combo) earliest point | `canCancel` L2285 | contact + 0.115s (form rules) |
| Blade clash | L2517-2520 | both fighters locked 0.42s, inputs dropped, elite AI +0.49s more |
| Elite AI between attacks | `eliteReady` L501-503 | extra 0.13-0.42s idle after every swing |
| Steering during a swing | movement block L2385-2420 | input ignored until contact + 0.06s |

Elite fighters are currently the *slowest* to flow, which is the opposite of the target.

---

## v4.2.0 (minor): "Live Blade"

New behaviour. Gate every item behind new `ArcadeMotionFlow` fields so old replays (no `motionFlow`) stay identical.

### ADD

**A1. Rebound chain off a block** (biggest win)
- Where: `chainWindow()` L312, `continuation()` L1195, `actionStep` attacking branch L2292-2302.
- Now: a guarded swing waits for 78%/83% of the swing.
- Proposed: when `f.releaseOutcome==='guarded'` (or `'parried'` if the fighter is not staggered), open the window at `finalContact + chain.guardedDelay`. New fields in `ARENA_MOTION_FLOW.chain`: `guardedDelay: 0.090`, `eliteGuardedDelay: 0.060`. Use `entryPose(s,f,'chain')` so the blade bounces off the block into the next cut.
- Why: blocked exchanges are what Alan Becker fights are made of. Right now every block is a pause.

**A2. Clash rebound**
- Where: clash setup L2512-2521; `actionStep` has no `clash` branch (requests are dropped, `f.buffer=null`).
- Proposed: add an `f.action==='clash'` branch in `actionStep` that stores `f.buffer` like stagger does, and lets a buffered strike, heavy, dash or guard fire once `actionTime >= actionDuration * 0.55`, using `entryPose(s,f,'clash')` with `poseEntryDuration = 0.09`. Keep `f.combo` instead of resetting it to 0, so a string can continue through a clash.
- Why: clashes should spring apart into the next exchange, not freeze both fighters.

**A3. Steer while swinging**
- Where: attacking movement block L2385-2420.
- Now: during wind-up only the fixed lunge along `f.face` applies; `attackDrive` carry decays over 0.13s; steering only after contact + 0.06s.
- Proposed: during wind-up add `moveX/moveY * def.speed * 0.22` for players and `0.15` for AI; stretch the `attackDrive` carry from `/.13` to `/.20`.
- Why: Madness-style fighters slide and step through their cuts instead of planting.

**A4. Wake-up cut from stagger** (optional, test it)
- Where: stagger buffer L2353-2354 (only stores, never fires early).
- Proposed: let a buffered strike fire at 85% of the stagger with `entryPose(s,f,'stagger')` and damage x0.8.
- Why: attacking out of a stumble is a signature Peasant Warfare beat. The damage cut keeps stagger worth landing.

### BUFF (faster flow)

| ID | Where | Now | Proposed | Why |
|---|---|---|---|---|
| B1 | `chainWindow()` L314, after a **miss** | .78 / Juyo .71 / elite .83 | .66 / .60 / .64 | whiffs still punishable, not frozen |
| B2 | combo follow-up L2299 | .68 / .82 / Juyo .72 | .58 / .70 / .62 | strings read as one motion |
| B3 | heavy/technique follow-up L2301 | .76 / .85 | .66 / .74 | same |
| B4 | `canCancel` L2285 | contact + .115 (form rules) / .065 | contact + .080 / .060 | dash out of a swing sooner |
| B5 | weapon recover blend L2589 | .185 | .140 | less "settling back to stance" |
| B6 | guard exit blend L2349 | .145 | .110 | attack straight out of guard |
| B7 | feint follow-up L2261 | 66% of feint | 55% | feint should snap into the real cut |

### NERF (keep the balance honest)

| ID | Where | Now | Proposed | Why |
|---|---|---|---|---|
| N1 | clash lock L2517 | .42s base | ~~.32s base~~ **dropped**: Clara tested .32, rank gap got worse (SSS+V vs F lands while F is still locked). 4.01.3 buffer fixed the dead input instead. | keep .42 until playtested |
| N2 | elite AI after clash L2520 | +.49s | +.30s | same |
| N3 | elite AI between attacks L502 | clamp .13-.42s | clamp .06-.24s | elites should flow fastest |
| N4 | linked cost after a miss, `attack()` L443 | +6.9% per chain depth | x1.15 extra when the previous release was a miss | faster whiff recovery must still cost stamina |

### REMOVE

- **R1.** The elite `.83` threshold in `chainWindow()` L314. Elites chaining latest fights the target feel; use the B1 value for everyone.
- **R2.** `f.combo=0` on clash (L2515), replaced by A2's combo carry.

---

## v4.2.1 (patch): tuning and safety

- **P1. Tunable numbers.** Put every new value (guardedDelay, missRatio, clashRebound, wind-up steer) in `ARENA_MOTION_FLOW` and clamp them in `normalizeArcadeMotionFlow()`, so they can be tuned in the Animation Lab without touching engine code.
- **P2. Replay parity.** Only `ARENA_MOTION_FLOW` turns these on. Old replays use legacy flags and must stay byte-identical: run `npm test` and `npm run verify:parity` and expect differences only in new Arena fights.
- **P3. Tests.** Extend `tests/arcade-chains.test.mts` and `tests/arcade-clashes.test.mts`: a guarded swing can chain at contact + .09; a buffered strike fires out of a clash at 55%; an old replay descriptor without `motionFlow` keeps the 78% window.
- **P4. Measure before and after.** Use `npm run audit:arcade-elite` and `npm run audit:saber` and log the median gap between one swing ending and the next starting. Goal: under 0.20s for close exchanges (elite under 0.15s).
- **P5. Rebuild.** `npm run check` before committing; `dist/` holds only static assets, the build output is generated.

## Suggested order

1. A1 + R1 (blocked swings flow) and test.
2. A2 + N2 + R2 (A2 shipped as 4.01.3, N1 dropped) (clash rebound).
3. B1-B7 timing pass.
4. A3 steering, then N3/N4 balance.
5. A4 only if playtests want it.

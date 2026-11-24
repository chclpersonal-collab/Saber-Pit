# Saber Pit v5.0 plan

Goal: a full major release. Combat that flows from any pose like Alan Becker
lightsaber fights and Madness Combat, a cleaner visual identity, and a new
MOBA mode. Built on main at 4.1.4 (`ced1ad6`).

Rules for every phase:

- Strict TypeScript only, no checked-in JS. `npm run typecheck:all`, `npm test`,
  `node build/scripts/check.mjs` and `npm run verify:parity` stay green.
- New behavior goes behind a flag in `ARENA_MOTION_FLOW` (or a new config
  field), so replays without it still match.
- Every phase lands on the `v5` branch with its own tests. Clara merges `v5`
  into `main` at the end. Nothing goes to `main` directly.

## Phase 1 · 5.0.0-alpha.1 · motion core

The "fight from any pose" part. Owner: Clara (engine), Clarissa reviews.

| Id | Change | Where |
| --- | --- | --- |
| M1 | Steering during wind-up: stick input adds `move * def.speed * .22` (AI `.15`) before contact, fading to 0 at contact. Facing stays locked so a late dodge still escapes. | attack block in `actionStep`, ~L2411 |
| M2 | Pose-to-pose entry: every attack, dash and guard starts from the fighter's current limb pose and blends in over 60-90 ms instead of snapping through neutral guard. | `entryPose`, `arcade-rig-swing.ts`, `arcade-rig-bind.ts` |
| M3 | One cancel tree: after contact + .065 any grounded attack can cancel into dash, guard, jump or the next chain cut. Replaces the separate canCancel / chainWindow / follow-up thresholds. | `chainWindow`, `canCancel` |
| M4 | Hit feel: hitstop 40-70 ms scaled by damage, directional knockback, short screen shake on heavy hits and clashes. Visual only for hitstop timing where replays need it. | `arena-impact.ts`, `arcade-camera.ts` |
| M5 | Remaining timing pass from `docs/clarissa-recommendations.md`: B1-B7 buffs, N2-N4 nerfs, A4 wake-up cut. Clash lock stays .42 (tested). | see that doc |

Done when: a scripted duel shows no frame where a fighter returns to neutral
guard between two actions that were input inside the buffer, and the elite
audit (`npm run audit:arcade-elite`) shows elites chaining at least as fast as
mid ranks.

## Phase 2 · 5.0.0-alpha.2 · visual pass

Owner: Clarissa builds, Clara reviews.

- One design token file (`dist/pit-v5.css`): palette, type scale, spacing,
  radii. Every screen moves to it; old v3/v4 sheets get retired.
- New HUD: slim health and stamina bars over each fighter, rank pip, clean
  team bars on top. No overlapping panels.
- Blade rendering: core plus glow layers with additive blend, swing trail
  ribbon that follows the real tip path, clash sparks and scorch marks.
- Bodies: soft ground shadows, squash on landing, follow-through on cloth and
  hair where the rig has it.
- Arenas: parallax back layer, cleaner obstacles, readable floor.
- Menus: one lobby layout for all modes, bigger touch targets.
- Budget: 60 fps at 1080p with 16 fighters on a mid laptop.

## Phase 3 · 5.0.0-beta · MOBA mode "Lanes"

Owner: Clarissa builds, Clara reviews. Self-contained new files so it doesn't
collide with phase 1.

- New objective rule `lanes` in a new `src/arcade-lanes.ts`, wired like
  `control` and `relic`.
- Map: wide world (about 3200 x 1800) with camera follow, three lanes, each
  team has two towers per lane and a core.
- Minion waves every 30 s per lane: three melee droids and one ranged. They walk
  the lane, fight minions first, then towers, then heroes.
- Towers: hit the nearest minion; switch to a hero who hits an allied hero in
  range. Heavy damage, slow fire, readable telegraph.
- Heroes: 3v3 default (up to 5v5). Respawn timer grows with level.
  Levels 1-10 from minion and hero kills; each level adds a little damage
  and health and unlocks rank cuts.
- Roles from saber forms:
  - Soresu: tank
  - Shii-Cho / Djem So: bruiser
  - Makashi: duelist
  - Ataru: roamer / assassin
  - Niman: Force caster
  - Juyo: carry

  Each hero's Force power works as its ultimate on a cooldown.
- AI: lane assignment, last-hit minions, retreat under 30% health, no tower
  dives unless the enemy hero is low.
- Win: destroy the enemy core. Time limit falls back to towers destroyed,
  then core health.
- Deterministic sim with replay parity and tests: wave timing, tower targeting,
  core win, respawn, AI lane hold.

## Phase 4 · 5.0.0 · release

- Balance audits across all modes, including a lanes audit script.
- Save migration v4 to v5 with a test, so careers carry over.
- Version 5.0.0 in `package.json` and every sync entry, changelog, credits.
- Browser test pass (`npm run test:browser`).
- Clara merges `v5` into `main`.

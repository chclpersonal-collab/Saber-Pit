# v5.0 audit: combat feel, mobile readability, save compatibility

Read-only audit of main at 4.1.4 (`ced1ad6`). No game code changed. Numbers
come from `npm run audit:arcade-elite` (84 seeded matches per row) on main.

## Combat feel

| Trial | p50 length | Went to time | Swings | Parries |
| --- | --- | --- | --- | --- |
| F duel | 13.5 s | 0% | 39 | 2 |
| Elite duel | 86.3 s | 40% | 157 | 40 |
| Elite squads | 90 s | 83% | 437 | 102 |
| Elite Control | 49.2 s | 36% | 103 | 17 |

- **C1 · Elites stall.** 40% of elite duels and 83% of elite squad fights hit
  the clock. Elites swing about 1.8 times a second between them; F-rank
  fighters swing about 2.9. Top ranks should be the fastest, most fluid
  fights, not the slowest.
  Likely causes, in order: the `eliteReady` idle after every swing
  (clamp .13-.42 s), the .49 s elite pause after a clash, and parries that
  reset the exchange without a follow-up. See N2/N3 and A2/B7 in
  `docs/clarissa-recommendations.md`.
- **C2 · Blue side wins 62% of elite duels** (n=84, about two standard
  deviations off 50%). Elite squads sit at 44%, so it may be noise, but
  worth one rerun with more seeds. If it holds, check `tick` order: fighters
  alternate order each tick, but spawn facing and the first AI think time
  (`.09+slot*.11`) are not mirrored.
- **C3 · Still open from the earlier pass:** steering during wind-up (A3,
  agreed on PR #1), the miss and combo windows (B1/B2), guard exit (B6).
  Block rebound and the clash buffer shipped in 4.01.2 and 4.01.3. Clash
  lock stays .42 s.
- **Target for v5:** elite duel p50 under 45 s with under 10% timeouts,
  elites swinging at least as often as F ranks.

## Mobile readability

Phone layout is `@media(max-width:740px)` in `dist/arcade.css`.

- **R1 · HUD text is 8-9 px on phones.** `.hud-label`, `.hud-mini b`,
  `.clock span`, `.injury-ribbon` (lines 174-176, 187-188). Unreadable on a
  360 px screen. Floor of 11 px; drop secondary labels instead of shrinking.
- **R2 · Stamina bar is 2 px tall on phones** (`progress.energy`, line 176).
  Stamina gates block rebound and chains, so it needs to read at a glance.
  At least 4 px, with a color change when low.
- **R3 · Small tap targets.** Top bar buttons are 36 px (line 172), the
  technique bar 36 px (line 129), lobby links 34 px (line 67). Action
  buttons are already 44 px, so match them.
- **R4 · Lanes on phones needs the camera.** `cameraView` is disabled when
  the rule isn't `elimination` or there are more than 6 fighters
  (`src/arcade.ts:244`). A 5v5 lanes map would show the whole world in a
  16:9 box about 200 px tall on a portrait phone. Lanes needs camera
  follow on, and probably a minimap.
- **R5 · Portrait arena is tiny.** The arena is locked to 16:9. On a portrait
  phone, offer a landscape hint or a taller crop.

## Save compatibility

- **S1 · A new mode value wipes Arena careers on 4.x browsers.**
  `readArcadeCareer` accepts only `duel/squad/watch/command`
  (`src/arcade-career.ts:17,29`) and returns `null` otherwise. If the lanes
  build saves the Arena career with a new mode, every 4.x browser on cloud
  sync reads "no save" and writes a fresh one over it. Keep lanes progress
  under its own key, or store it as an extra field inside the existing
  career without changing `mode`.
- **S2 · A new cloud section breaks sync for 4.x browsers.** Cloud `read()`
  throws if the server returns any section it doesn't know
  (`src/arcade-cloud-sync.ts:290`). Don't add a cloud section for lanes
  until 4.x clients are gone, or carry it inside an existing section.
- **S3 · Keep every save at `version: 1`.** Career, backup bundle, cloud
  sections and all backup configs check `version===1` exactly. A bump locks
  out older browsers. Add optional fields instead.
- **S4 · Stale module copies at release.** Seventeen modules are imported
  under two or three different `?v=` strings, for example `arcade-career`
  (2.18.5 and 4.01.1), `arcade-engine` (3.0.0 and 3.2.4), `cloud-sync-browser`
  (4.01.1, 4.01.3, 4.01.4). If v5 changes a module but one importer keeps an
  old `?v=`, browsers can mix a cached old copy with the new one, for example
  old career validation next to new lanes saves. At 5.0.0, set every `?v=` to
  5.0.0 in one pass and have `check.mjs` reject mismatches.
- **S5 · Downgrade path.** A v5 backup file with a new section can't be
  imported into 4.x (`inspectArcadeBackup` rejects unknown sections). That's
  fine, but v5 must keep importing every 4.x backup. Add a test with a
  4.1.4 backup fixture.

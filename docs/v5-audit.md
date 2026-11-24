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

## Bugs the player reported (Nov 24)

### B1 · Losing to F-rank opponents

Sim: a scripted player against an F-rank AI, the Arena's own options, F vs F
duel, 100 seeds each, on main (4.1.4) and on the v5 candidate (7da379c). The
numbers were the same on both.

| Player script | Win % | Player hits / swings | AI hits / swings |
| --- | --- | --- | --- |
| AI on both sides (baseline) | 55-59 | 10.7 / 20 | 11.0 / 20 |
| Walk in and swing | 48 | 5.5 / 13.4 | 9.8 / ~13 |
| Swing, guard 0.22 s after seeing a windup | 44 | 5.3 / 12.2 | 8.5 / ~12 |
| Do nothing | 0 (dead in 9.8 s) | 0 | 15.2 |

- The player already deals full damage and the AI only 0.72x
  (`arcade-engine.ts` damage scale). Damage isn't the problem.
- The player loses the exchanges. 49% of player swings are cut off by an AI
  hit before contact, against 20% of AI swings. AI-vs-AI is 32/33%, even.
- The AI lands 69% of its swings. A basic player lands 37%.
- Ruled out: a slower F-rank decision clock (x1.3, x1.6) and a 0.12-0.28 s
  delay before the AI may swing after the player steps into reach. Neither
  moved the numbers. The AI's edge is positioning and reads, not reaction
  time, so slowing its brain doesn't help.
- What does move it, F and E only, only against the human player, duel:

| F/E AI damage scale | Walk-and-swing win % | Swing-and-guard win % | Idle player survives |
| --- | --- | --- | --- |
| 0.72 (now) | 49 | 46 | 9.8 s |
| 0.60 | 51 | 62 | 14.7 s |
| 0.50 | 62 | 72 | 20.1 s |

**Proposed patch:** F = 0.55, E = 0.62, D and up unchanged, only when the
victim is the human player. A new `noviceScale` entry in
`ARENA_MOTION_FLOW` keeps old replays on 0.72. F should stay able to kill an
idle player, and it does (about 17 s).
Longer term, F-rank AI should whiff more: an F that hits 69% of swings reads
like a much higher rank.

### B2 · Force ability has no Mixed option

Team forms offer Mixed, but Force ability (`startingForceFamily`) offers only
Push, Burst and Pulse (`arcade.ts:989`). `normalizeArcadeGear` turns any other
value into Push (`arcade-loadouts.ts:26`), and each side carries exactly one
`forceFamily`.
**Fix:** add `mixed` to the option list. In squads, fighters rotate Push,
Burst, Pulse by slot. For the player, the Force button cycles Push → Pulse →
Burst, and `forceHint` shows the next one. Older builds read `mixed` as
Push, so saves stay safe.

### B3 · Auto battle only works for some setups

`autoDuelStart` is disabled unless the lobby is Elo-rated (`arcade.ts:1090`,
`arenaLobbyRating`). So Auto battle is off for:
- Control and Relic.
- Commander.
- Uneven teams.
- Teams over 15v15.
- Any setup with a saved Hero.
The Duel preset keeps the last saved Hero picks (only Master clears them,
`arcade.ts:1165`). So Duel can show "Unrated · Saved Hero selected" and grey
out Auto battle.
**Fix:**
- Allow Auto battle for every setup.
- Keep only Elo rated-only, and label the run "Auto battle · unrated".
- Have the Duel and Squad presets clear Hero picks the same way Master does.

## QoL gaps across options and menus

Checked every control on Arena, Classic, Tournament, Gauntlet, Idle RPG,
Style Lab and Backup.

| # | Where | Missing | Proposed fix |
| --- | --- | --- | --- |
| Q1 | Arena | No difficulty separate from rank | Easy / Normal / Hard sets the AI damage scale and whiff rate for the player's opponents, unrated on Easy |
| Q2 | Arena | Keys are fixed (`keyMap`, `arcade.ts:89`) | Rebind screen saved in localStorage, plus a key list in the pause menu |
| Q3 | Arena, Classic | Sound is only on or off | Master, effects and music volume sliders |
| Q4 | Arena | No team colour option (Classic has one) | Reuse Classic's Team colors, including a colour-blind pair |
| Q5 | Arena | HUD text 8-9 px, no size option | HUD scale 100/125/150% (see R1) |
| Q6 | Arena | No Restart or Rematch from pause or results | Restart same seed and Rematch new seed buttons |
| Q7 | Arena | Speed is locked while you play (`pace` disabled) | Allow 0.75x for practice, unrated |
| Q8 | Arena | Camera follow is off outside Elimination or above 6 fighters | Follow the player in every rule (see R4) |
| Q9 | Arena | Elo, Auto battle and Hero picks depend on hidden rules | Show why an option is off next to it, not only in the rating line |
| Q10 | Arena, Classic | No saved custom presets | "Save as preset" next to Duel/Squad/Showdown, 3 slots |
| Q11 | Arena | Force ability can't be Mixed | See B2 |
| Q12 | Arena (touch) | No haptics option | Vibrate on hit and parry, off by default |
| Q13 | Tournament, Gauntlet | No skip-to-result on a watched bout | Skip button that resolves the bout at once |
| Q14 | Idle RPG | Rewards and salvage are claimed one by one | Claim all |
| Q15 | Style Lab | No loop or slow-motion step | Loop toggle and 0.25x frame step |
| Q16 | Backup | No reminder or auto-backup | Weekly reminder, or auto-download after a promotion |
| Q17 | All pages | Settings live on each page separately | One shared settings panel for sound, motion, colours and HUD |

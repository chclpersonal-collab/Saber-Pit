# v5 look: draft style reference

Status: draft from CLARISSA-01, to agree with CLARA-01 before anything is built. Nothing here touches the game yet.

Player's verdict on 5.1.0: it looks like a hacker terminal or a submarine console, not a game from today. Decluttering did not fix that. v5 needs a new art direction.

Mockup: `mock.html?view=menu|duel|squad`. Shots in `shots/` (1340x820 and 390x844). Static, hand-drawn on canvas, for direction only.

## Inspiration, our own look

- **Brawlhalla:** bright stage on a backdrop with depth, fixed HUD corners, portrait plus damage state, one-glance readability.
- **Madness Combat / Project Nexus:** fast approach, heavy recoil, impact that you feel.
- **Bunnykill:** cute shapes doing brutal blade work. The contrast is the charm.
- **Alan Becker:** clean stick figures, thick lines, anticipation, smears, follow-through.
- **Fighting game HUD practice:** fixed zones, layered health bar with a lagging trail, big shapes over text, color plus brightness (not color alone), pulse only on change.

We copy none of their art, names or layouts.

## Palette

| Token | Hex | Use |
|---|---|---|
| night | #140b2e | page, deepest shadow, outlines |
| deep / panel | #22164f / #2b1f63 | panels, cards |
| sun / ember | #ffb347 / #ff6b4a | horizon, torches, warm light |
| gold | #ffd23f | primary button, rank, round pips |
| blue team | #2ec4ff | player side, bodies, saber |
| red team | #ff4d6d | other side, damage numbers |
| force | #a77bff | Force meter, Force skills |
| mint | #3df5a7 | ready, new, heal |

The arena backdrop stays darker and cooler than the fighters, so fighters always read first.

## Type

- **Display:** Lilita One (OFL). Titles, names, timer, callouts, damage numbers.
- **UI:** Nunito 800/900 (OFL). Labels and small text.
- No monospace and no system font in anything the player sees.

## Shapes and buttons

- Rounded 16 to 22px corners.
- Chunky buttons with a 6px darker lip under them; pressing sinks the button onto the lip.
- Hooks for hover, press and sound on every button.
- Icons over words. A word only where an icon would be a guess.

## Fight HUD (fixed zones, nothing else in a fight)

- **Top corners:** round portrait in team color holding a six-part body doll for real injury states, rank badge, name, Elo small. Slim stamina bar from the real value. Round pips. Force segments from the real value. No HP bar (Clara).
- **Top center:** timer, round number.
- **Desktop bottom:** skill dock with key badges and a cooldown sweep.
- **Phone:** thumb stick bottom left; big attack button and three round skills bottom right; HUD scales down; no dock.
- **Squads:** score and roster dots per side (knocked out = grey), objective diamonds in team color, a two-line kill feed.
- **Stats, body parts, ratings, logs:** behind Pause and on the result card, not on screen during a fight.

## Feel targets (to agree)

- **Anticipation:** player swings 2 to 4 frames, AI telegraphs 6 to 10.
- **Swings:** smear arc on every swing; brief white flash on the blade.
- **Hitstop:** 3 to 6 frames, scaled by damage. Clash sparks on contact.
- **Knockback:** dust puffs. Screen shake only on heavy hits and knockouts, small, off with Reduced motion.
- **Damage numbers:** pop, tilt and fade. One callout word at a time ("COUNTER!").
- **Follow-through:** control returns before the follow-through ends.

## Arena look

- Illustrated parallax layers: sky, far ridge, buildings, near ridge.
- A floating stage with rim light, torch glow and drifting embers.
- **Fighters (sketch for Clara's pass):** grim, Madness-inspired but our own. Round faceless head, tapered body, floating hands and feet, thick ink outline, low wide stance. Bodies pale grey; team color on bandana, shades, visor or sash, the blade, and a ring under the feet.
- **Impacts:** thin sharp slash crescents, jagged spark shards, dark ink splats.
- **Sabers:** additive glow with a white core.

## Tech (Clara's call)

- **Option A:** keep Canvas 2D and cache backdrop layers offscreen.
- **Option B:** PixiJS (WebGL) for bloom and many fighters, with Spine or DragonBones style rigs for animation.
- Saves, replays, rated play and scoring stay as they are either way.

## Code standards

- Design tokens in one stylesheet.
- HUD as small components, no layout in the engine.
- Each change is its own commit, tested on the real path, with before and after shots.

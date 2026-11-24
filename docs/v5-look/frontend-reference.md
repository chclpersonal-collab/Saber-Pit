# Saber Pit v5 front end: what today's top games do

Short reference for CLARISSA-01 and CLARA-01. Read before mocking or building any screen. Art direction is locked (ink cutout cast, bright arena, chunky UI, tokens in `dist/pit-v5-tokens.css`).

## Rules we take

1. **One tap to play.** Home has a big Play button that starts the last mode. Mode select is a short vertical list of big cards, never a horizontal scrolling tile strip (players rejected Battlefield 6's streaming-style tiles: awkward with a mouse, popular modes pushed off screen). No more than two levels to any match.
2. **Few words.** Icons and numbers over sentences. One line per card at most. Details in a tooltip or one tap away.
   No slogans or taglines on modes (the player rejected lines like "3 lanes. Towers. Push the core." as AI-sounding). A mode gets its name and, only if needed, a plain category tag the way real games label them: "1v1", "MOBA", "Bracket", "Solo", "Ranked", "Team · up to 15v15".
3. **Settings in tabs with presets.** Tabs: Gameplay, Controls, Video, Audio, Accessibility. Search box. A preset row on top. Advanced options folded. Every option saves on change.
4. **Accessibility is basic, not extra.** The four most complained about gaps: key remapping, text size, colorblind support, subtitles. Also separate volume for effects, voice and music, game speed, sensitivity, vibration toggle, screen shake and flash off, toggle instead of hold, no rapid tapping required, whole UI usable with the game's own input. Nothing essential shown by color alone.
5. **Results are fast and skippable.** One screen, the key stats, Elo change, Rematch as the main button. A hold-to-skip on any animation (Marvel Rivals had to add one after players hated flicking pages).
6. **Stats live where the player looks for them.** Detail one tap away, never on the fight HUD.
7. **No dark patterns.** No shop, no currency, no timers nagging the player. We have none and add none.

## Stats placement (the player is a stats nerd)

| Where | What |
|---|---|
| Player card (home, lobby) | rank badge, Elo, K/D, win rate |
| Fight HUD | nothing new. Names, injuries, stamina, Force, clock only |
| Hold Tab (desk) / scoreboard button (phone), mid-match | per fighter: K / D / A, damage, Elo |
| Results | one stat line: K/D, damage, accuracy, parries, Elo +/- with the bar moving, a best-stat badge |
| Stats page (one tap from player card or results) | Elo trend line, last 20 matches, per mode, per look, per Form, best and worst matchups |

Patterns behind this: Valorant puts its score and accolades on the post-match Performance tab beside Scoreboard and Timeline, with a curve showing where you stand. Brawl Stars puts takedowns, damage, healing and objective score on the end screen and in a Battle Log, split by round, with Play Again on the end screen. None of the sources fixes a place for K/D or Elo, so the table above is our call.

## Real data only

Every number on these screens must exist in the game: saves, Elo ratings, match records, injuries, Force. If a stat is not recorded yet (accuracy, damage per match), the build adds it to the match record first. No invented modes, currencies or ranks.

## Sources (read Nov 24 2026)

- Game Accessibility Guidelines, basic: https://gameaccessibilityguidelines.com/basic/
- PC Gamer on Battlefield 6's tile menus: https://www.pcgamer.com/games/fps/battlefield-6s-netflix-ui-has-already-been-rejected-and-redesigned-by-players-and-im-on-board
- PC Gamer on Marvel Rivals 3.5 end of match: https://www.pcgamer.com/games/third-person-shooter/marvel-rivals-3-5-sneaks-in-one-very-minor-change-to-appease-those-who-hate-the-new-end-of-match-overview-and-it-works
- PC Gamer on the Marvel Rivals hero gallery: https://www.pcgamer.com/games/fps/marvel-rivals-hero-gallery-ui-used-to-look-a-lot-cooler-but-also-a-lot-harder-to-use
- Family Gaming Database, Street Fighter 6: https://www.familygamingdatabase.com/accessibility/Street+Fighter+6
- ProSettings on Valorant's performance score: https://prosettings.net/blog/valorant-performance-score-accolades-and-new-stats-explained/
- Supercell, Brawl Stars release notes Nov 2026: https://supercell.com/en/games/brawlstars/blog/game-updates/release-notes-november-2026/

# Saber Pit v5.0 acceptance checklist

The player's rule: nothing is called v5 until it looks like a new game. Each line is "in game" only when it is on main and visible in play. Status: not started / in progress / built (branch) / in game.

Bar for every item: a player sees a different game in the first 10 seconds, checked side by side against v4.

| # | What the player asked for | Status | Notes |
|---|---|---|---|
| 1 | AAA visual design. Core: no more "verbose mess". Far fewer words, icons over labels, grouped settings with good defaults, advanced options tucked away, a clean HUD with only what matters in a fight. New art direction, menus, arena look, lighting and effects. Ultra minimal. | not started | Needs design doc with Clara |
| 2 | Movement with a new feel: momentum, dashes, fluid from any pose | not started | |
| 3 | Deeper mechanics, Brawlhalla-style picks: chase dodge, signature moves, saber throw | not started | Directional signatures first |
| 4 | Animations in the Madness Combat PW2 and Alan Becker style: wind-back, smear trails, hit freeze, knockback | built (branch) | Impact FX on clarissa-ai-fx, not wired |
| 5 | MOBA redesigned from scratch: 3 lanes, jungle, river, towers, inhibitors, core, minion waves, roles with distinct kits, gold and levels, last hits, objectives, minimap, clear win, lane-smart AI | not started | Design doc first, agree with Clara |
| 6 | Larger maps | not started | Clara's |
| 7 | More Force abilities, plus a Mixed Force option | not started | Mixed Force spec agreed with Clara |
| 8 | Mixed look and gender per team | not started | Clara's (Q18) |
| 9 | Smarter AI that reads the player; organized squad fights, no blob, gang cap, spacing, readable labels | in progress | Labels: branch clarissa-v5.1-labels. Squads: branch clarissa-v5.1-squads |
| 10 | Player no longer loses to F-rank | not started | Unranked novice setting planned |
| 11 | All 17 missing QoL options (Q1-Q17 in docs/v5-audit.md) | not started | |
| 12 | Bug fixes and patches (B1-B3 and anything found) | in progress | |

Side-by-side check against v4 before any v5 label: list what visibly changed. If it still reads as a reskin, it is not done.

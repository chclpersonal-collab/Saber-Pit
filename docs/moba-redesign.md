# Three Fronts redesign (MOBA from scratch)

Why: the shipped Three Fronts is three flat horizontal strips, forms standing in for roles, no jungle, no map read. The player called it terribly designed.

## Map
- Diagonal square map, bases in opposite corners. Top, mid and bottom lanes; the river cuts corner to corner.
- Jungle in the four quarters between lanes, with walls and paths, so there are places to hide and gank from.
- Per lane per side: outer tower, inner tower, inhibitor. Two core towers, then the core.
- Towers target minions first, and switch to a hero who hits an enemy hero under them. Clear range ring.
- Map is larger than the screen; the camera follows the player.

## Waves and economy
- Minion waves every 25 s: 3 melee, 2 ranged, plus a siege unit every third wave. A killed inhibitor spawns super minions on that lane.
- Gold only on the last hit. Shared XP in range. Levels 1 to 12; skills unlock at 1, 2, 3 and the ult at 6.
- Shop at base: 6 item slots, about 12 items in 3 paths (offense, defense, Force).

## Heroes: roles with real kits
- Five roles: Vanguard (tank), Duelist (fighter), Striker (assassin), Mystic (Force caster), Warden (support).
- Each hero: a passive, 3 skills and an ult. Saber forms flavour the kit, they don't stand in for it. Start with 2 heroes per role, 10 total.

## Objectives
- River beast: buffs the team that kills it. Ancient on a timer: pushing power.
- Two jungle camps per quarter, with a buff camp in each half.

## Readability and minimal UI
- HUD: health and Force bars, 4 skill icons with cooldown sweeps, gold, a minimap in one corner. Nothing else on screen in a fight.
- Ping wheel instead of text. Icons over words everywhere.

## AI that plays lanes
- Lane, farm with last hits, back off under enemy towers, recall when low, group for objectives, rotate when a lane is pushed.
- Roles act differently: Wardens stay near a carry, Strikers roam and gank.

## Win and match length
- Destroy the core. Target 12 to 18 minutes. Surrender vote after 10.

## Build order
1. Map, camera, minimap, towers and waves (playable skeleton).
2. Last hits, gold, XP, levels, shop.
3. Five roles, 10 heroes with kits.
4. Jungle, river beast, ancient.
5. Lane AI.
6. Minimal HUD and the side-by-side check against the current Three Fronts.

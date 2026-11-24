# 5.3.0 vs the approved mocks

Side by side of live 5.3.0 (2c0fe36) against the approved v5 mocks, desktop 1340x820 and phone 390x844.
`ink-scene-reference.js` is the mock's own scene code. It draws fighters with the game's `drawArcadeFighter`,
then the ink pass: paint the fighter with no blades to a scratch canvas, fill the silhouette `#100a1c`
(source-in), stamp it 16 times around radius `max(1.6, k*2.6)` under the fighter. Back hair (pony/braid) with
ribbon `#6ac7bf` Blue, `#ed886b` Pink. Sky, sun, ridges, temple, floating platform, torches, smear, spark and
speed lines are the scene painters in the same file.

## Renderer and art (Clara)
1. Fighters: no ink outline, about 40% of mock size on stage, no back hair or ribbon.
2. Arena: dungeon floor "The Underpit" seen from above. Mock is a side view: sunset sky, ridges, temples,
   torches, a floating purple platform with rim light and emblem.
3. Hit feedback: mock pops COUNTER! and -17 with a smear arc and sparks. Live shows style text (ROOK STYLE).
4. Results: mock has the winner's pose art on the platform under a sunburst. Live is a card over the dark arena.

## Front end (CLARISSA-01 can build on a branch off 2c0fe36)
5. Home: mock is a card grid (Arena big, Three Fronts, Tournament, Gauntlet, Heroes) plus a player card with
   rank, Elo, K/D, win %. Live keeps the text tab nav (Arena, Three Fronts, Tournaments, Style Lab, Idle RPG),
   the hero banner and the old arena preview canvas under it. Phone nav clips "Style".
6. Modes: mock is a list (Duel, Squads, Three Fronts, Gauntlet, Tournament with your Elo each), a big preview,
   chip rows (Rules, Map, Play as, Round), Play and Loadout, and a W-L, K/D line. Live is preset tiles plus a
   Customize dropdown of selects.
7. Loadout: mock is its own screen. Look cards with win %, tabs Look, Form, Saber, Force, chips with win %,
   Ready. Live puts it in the Customize Fighters tab.
8. Setup leftovers: Review save sync button, Continue run and Auto battle links at top right, the
   Auto battle, Form guide, Saves, Classic row, the summary line, the Watch a Hero helper line.
9. Fight controls: mock desktop has 5 icon keys. Live has 8 text keys. Mock phone has stick plus 4 buttons
   (Slash big, Force, Dash, Guard). Live has 9.
10. Fight HUD: mock shows rank badge on the portrait, Elo by the name, round pips. Live shows 1/1.
11. Pause: mock is one column, Resume, Settings, Controls, Restart round, Leave match (red), then a
   Round, K/D, Elo line. Live is a row of Resume, Keys, Settings, Setup plus Camera and Full screen.
12. Scoreboard: mock blurs the arena, rank badges per row, "B hold" hint. Live is close, has Details and Close.
13. Results: mock is VICTORY or DEFEAT, 4 stat tiles with BEST, one Elo bar with "55 to D", Continue and Stats,
   hold Space to skip. Live adds training points, promotions and 4 buttons.
14. Stats: mock is a full page. Header card (rank, Elo, K/D, win % with week change), Elo chart 10/30/100,
   last matches, by look. Live is a modal.
15. Settings: mock is a full page with Gameplay, Controls, Video, Audio, Access, a search box, Default,
   Comfort, Pro presets, Saved and Reset tab. Live is a modal with Controls, Audio, Access.

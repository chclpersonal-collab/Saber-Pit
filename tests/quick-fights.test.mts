import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_FIGHTS } from '../dist/quick-fights.js';
import { createGame, nextRound, step } from '../dist/sim.js';
import { fitBattleCamera, worldToCanvas } from '../dist/camera.js';

for (const [name, preset] of Object.entries(QUICK_FIGHTS)) test('valid quick fight: ' + name, () => {
  const { mode, friendly, enemy, rules, duration, map, weather, rank, forms, opponent, modifier, formation, priority } = preset;
  const game = createGame(120120, { mode, playerSlot:0, teamSizes:[friendly,enemy], matchMode:rules, roundDuration:duration,
    terrain:map, environment:weather, modifier, mapSize:'small', startingRanks:[rank,rank], forms:[forms],
    formations: [formation || 'line', formation || 'line'], targetPriorities:[priority || 'balanced', priority || 'balanced'],
    opponentForm:opponent==='mixed'?null:opponent });
  assert.equal(game.config.mode,mode);
  assert.equal(game.config.modifier,modifier);
  assert.equal(game.config.matchMode,rules);
  assert.equal(game.config.roundDuration,duration);
  assert.equal(game.terrain.id,map);
  assert.equal(game.soldiers.length,friendly+enemy);
  const [beforeX,beforeY]=[game.soldiers.at(-1).x,game.soldiers.at(-1).y];
  for (let i=0;i<120;i++) step(game,1/60);
  assert.ok(game.tick>=118);
  assert.notDeepEqual([game.soldiers.at(-1).x,game.soldiers.at(-1).y],[beforeX,beforeY]);
  for (let i=0;i<(duration+2)*60 && game.status!=='ended';i++) step(game,1/60);
  assert.equal(game.status,'ended');
  nextRound(game);
  assert.equal(game.status,'playing');
  assert.equal(game.round,2);
});
test('duel silhouette clears camera edges at boosted scale', () => {
  for (const [width,height] of [[320,200],[1348,670]]) {
    const args = { width,height,worldWidth:960,worldHeight:540 };
    const base=fitBattleCamera(args), zoom=fitBattleCamera({...args,fighterBoost:1.25});
    assert.equal(zoom.spriteScale,base.spriteScale*1.25);
    const {x,y}=worldToCanvas(zoom,40,-50);
    const margin=56*zoom.spriteScale;
    assert.ok(x-margin>=0 && y-Math.max(61,margin)>=0);
    assert.ok(worldToCanvas(zoom,920,490).x+margin<=width);
  }
});

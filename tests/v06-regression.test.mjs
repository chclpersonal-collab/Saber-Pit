import { authoritativeState } from './helpers/presentation-state.mjs';
import { stripPostV9 } from './helpers/schema-history.mjs';
import test from 'node:test';
import { V9_SOLDIER_DEFAULTS } from '../dist/migration.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as engine from '../dist/sim.js';
import { FORMS } from '../dist/content.js';
import { MAX_MERIT } from '../dist/progression.js';
import { saveCampaign, loadCampaign, SAVE_KEY } from '../dist/persistence.js';

const { createGame, step, nextRound, setForm } = engine;
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const fighter = (g, team, lane) => g.soldiers.find(s => s.team === team && s.lane === lane);
const counts = g => [0, 1].map(team => g.soldiers.filter(s => s.team === team).length);
const configurations = [[1, 1], [1, 15], [15, 1], [15, 15], [5, 5], [7, 11]];
function healthy(g) {
  assert.deepEqual(counts(g), g.config.teamSizes);
  assert.equal(new Set(g.soldiers.map(s => s.id)).size, g.soldiers.length);
  for (const s of g.soldiers) {
    for (const key of ['x', 'y', 'hp', 'energy', 'suppression', 'morale']) assert.ok(Number.isFinite(s[key]), `${s.id}.${key}`);
    assert.ok(s.x >= 0 && s.x <= g.terrain.width && s.y >= 0 && s.y <= g.terrain.height);
    assert.ok(s.hp >= 0 && s.hp <= s.maxHp && s.energy >= 0 && s.energy <= s.maxEnergy);
    assert.equal(s.alive, s.hp > 0); assert.ok(FORMS[s.form]);
  }
  for (const team of [0, 1]) for (const key of ['kills', 'deaths', 'assists', 'environmentDeaths']) {
    assert.equal(g.records.teams[team][key], g.records.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0));
    assert.equal(g.stats[key][team], g.soldiers.filter(s => s.team === team).reduce((sum, s) => sum + s[key], 0));
  }
  assert.equal(g.records.teams.reduce((n, t) => n + t.deaths, 0), g.records.teams.reduce((n, t) => n + t.kills + t.environmentDeaths, 0));
  assert.ok(g.events.length <= 32 && g.effects.length <= 160 && g.history.length <= 50);
}
function roundTrip(g) {
  const mem = storage(); const result = saveCampaign(g, mem);
  assert.equal(result.ok, true, result.error);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null); assert.deepEqual(authoritativeState(loaded.game), authoritativeState(g));
  assert.ok(mem.getItem(SAVE_KEY).length <= 500000);
  return loaded.game;
}

test('v6 all 225 team-size pairs generate complete and detached slot state', () => {
  for (let blue = 1; blue <= 15; blue++) for (let red = 1; red <= 15; red++) {
    const g = createGame(42, { teamSizes: [blue, red], mapSize: 'small', mode: 'spectate' });
    assert.deepEqual(counts(g), [blue, red]);
    assert.deepEqual(g.config.teamSizes, [blue, red]);
    assert.equal(g.records.soldiers.length, blue + red);
    for (const team of [0, 1]) {
      const size = g.config.teamSizes[team];
      for (const key of ['careers', 'veterans', 'forms']) assert.equal(g[key][team].length, size);
      assert.equal(g.loadouts[team].roster.length, size);
      for (let lane = 0; lane < size; lane++) {
        const s = fighter(g, team, lane); assert.ok(s);
        assert.equal(s.form, g.forms[team][lane]);
        for (let bank = 0; bank < 3; bank++) assert.ok(g.terrain.coverNodes.some(n => n.team === team && n.bank === bank && n.lane === lane));
      }
    }
    healthy(g);
  }
  const a = createGame(12, { teamSizes: [15, 15], mapSize: 'small' }), b = createGame(12, { teamSizes: [15, 15], mapSize: 'small' });
  a.careers[0][14].merit = 30; a.forms[0][14] = 'niman'; a.terrain.coverNodes[0].x = -100;
  assert.equal(b.careers[0][14].merit, 0); assert.equal(b.forms[0][14], 'shii_cho'); assert.ok(b.terrain.coverNodes[0].x >= 0);
});

test('v6 real board dimensions, maps and environments survive checkpoint round trips', () => {
  const sizes = { small: [960, 540], medium: [1280, 720], large: [1600, 900] };
  for (const [mapSize, dimensions] of Object.entries(sizes)) for (const terrain of ['crossroads', 'zigzag', 'craterfield']) for (const environment of ['clear', 'fog', 'rain', 'sandstorm']) {
    const g = createGame(731, { teamSizes: [15, 1], mapSize, terrain, environment, mode: 'spectate' });
    assert.deepEqual([g.terrain.width, g.terrain.height], dimensions);
    assert.equal(g.terrain.id, terrain); assert.equal(g.config.environment, environment);
    roundTrip(g); step(g, .5); healthy(g); roundTrip(g);
  }
});

for (const teamSizes of configurations) test(`v6 ${teamSizes.join('v')} campaigns settle, resume deterministically and preserve every slot`, () => {
  const g = createGame(731, { teamSizes, mapSize: 'small', terrain: 'crossroads', mode: 'spectate', autoCommand: true });
  for (let round = 0; round < 3; round++) {
    step(g, 1); const resumed = roundTrip(g);
    step(g, 90); step(resumed, 90); assert.deepEqual(resumed, g); healthy(g);
    assert.equal(g.status, 'ended'); assert.equal(g.roundReport.careers.length, teamSizes[0] + teamSizes[1]);
    assert.equal(new Set(g.roundReport.careers.map(r => r.soldierId)).size, teamSizes[0] + teamSizes[1]);
    roundTrip(g); const careers = structuredClone(g.careers), records = structuredClone(g.records);
    nextRound(g); assert.deepEqual(g.careers, careers); assert.deepEqual(g.records, records);
    assert.ok(g.soldiers.every(s => s.alive && s.hp === s.maxHp));
    assert.ok(g.mutations.length <= 2 * (teamSizes[0] + teamSizes[1])); roundTrip(g);
  }
});

test('v6 slot 15 form editing is valid and out-of-roster slots cannot mutate state', () => {
  const g = createGame(73, { teamSizes: [15, 1], mapSize: 'small' });
  assert.equal(setForm(g, 14, 'vaapad'), true); assert.equal(fighter(g, 0, 14).form, 'vaapad');
  const before = structuredClone(g);
  for (const lane of [-1, 15, 1.5, null, '14', NaN]) assert.equal(setForm(g, lane, 'niman', 0), false);
  assert.equal(setForm(g, 1, 'niman', 1), false); assert.deepEqual(g, before); roundTrip(g);
});

test('v6 default enemies use real mixed forms while fixed-form audit overrides remain fixed', () => {
  for (const teamSizes of [[1, 15], [15, 15]]) {
    const g = createGame(73, { teamSizes, mapSize: 'small' });
    assert.equal(new Set(g.forms[1]).size, Object.keys(FORMS).length);
    assert.deepEqual(g.forms[1], g.soldiers.filter(s => s.team === 1).map(s => s.form));
    assert.deepEqual(createGame(73, { teamSizes, mapSize: 'small' }).forms, g.forms);
  }
  const fixed = createGame(73, { enemyForm: 'soresu', teamSizes: [1, 15], mapSize: 'small', autoCommand: true });
  step(fixed, 90); nextRound(fixed); assert.ok(fixed.forms[1].every(id => id === 'soresu'));
  const one = createGame(73, { teamSizes: [1, 1], mapSize: 'small', autoCommand: true });
  const forms = new Set();
  for (let i = 0; i < 9; i++) { forms.add(one.forms[1][0]); step(one, 90); nextRound(one); }
  assert.equal(forms.size, 9);
});

test('v6 automatic enemy rotations agree after a resumed round boundary', () => {
  const g = createGame(94, { teamSizes: [5, 5], mapSize: 'medium', autoCommand: true, mode: 'spectate' });
  step(g, 3); const twin = roundTrip(g); step(g, 90); step(twin, 90); nextRound(g); nextRound(twin);
  assert.deepEqual(twin, g); assert.ok(new Set(g.forms[1]).size > 1);
});

test('v6 manual fighter waits without input, moves on input and clears held control', () => {
  const g = createGame(94, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'play', playerSlot: 0, enemyForm: 'shii_cho' });
  const s = fighter(g, 0, 0), position = [s.x, s.y];
  step(g, .25); assert.deepEqual([s.x, s.y], position); assert.equal(s.attack, null);
  assert.equal(engine.setControlledFighter(g, s.id), true);
  engine.setPlayerInput(g, { moveX: 1, moveY: 0 }); step(g, .25); assert.ok(s.x > position[0]);
  engine.clearPlayerInput(g); const stopped = [s.x, s.y]; step(g, .25); assert.deepEqual([s.x, s.y], stopped);
  roundTrip(g);
});

test('v6 fixed-tick manual input replays and save continuation are deterministic', () => {
  const opts = { teamSizes: [1, 1], mapSize: 'small', mode: 'play', playerSlot: 0 };
  const whole = createGame(17, opts), split = createGame(17, opts);
  for (let i = 0; i < 120; i++) {
    const input = { moveX: i < 60 ? 1 : 0, moveY: i < 30 ? 1 : 0, attack: i > 50, guard: i > 90 };
    engine.setPlayerInput(whole, input); engine.setPlayerInput(split, input);
    step(whole, 1 / 60); step(split, 1 / 120); step(split, 1 / 120);
  }
  assert.deepEqual(split, whole); engine.clearPlayerInput(whole); const resumed = roundTrip(whole);
  step(whole, 2); step(resumed, 2); assert.deepEqual(resumed, whole);
});

for (const name of ['active', 'ended']) test(`v6 authentic v0.5 ${name} save preserves all original battle state`, () => {
  const old = JSON.parse(fs.readFileSync(new URL(`./fixtures/v05-${name}-save.json`, import.meta.url), 'utf8'));
  const mem = storage(), encoded = JSON.stringify(old); mem.setItem(SAVE_KEY, encoded);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  const originalState = stripPostV9(authoritativeState(loaded.game)); delete originalState.mastery;
  originalState.soldiers.forEach(s => { delete s.formPractice; for (const key of Object.keys(V9_SOLDIER_DEFAULTS)) delete s[key]; });
  if (originalState.roundReport) { delete originalState.roundReport.mastery; delete originalState.roundReport.commendations; }
  for (const [key, value] of Object.entries(old.game)) assert.deepEqual(originalState[key], value, `legacy ${key} changed`);
  assert.deepEqual(loaded.game.config.teamSizes, [5, 5]); assert.equal(loaded.game.config.mapSize, 'legacy');
  const twin = loadCampaign(mem).game; step(loaded.game, 90); step(twin, 90); assert.deepEqual(loaded.game, twin);
  roundTrip(loaded.game);
});

test('v6 malformed size, geometry, roster and saved control reject without rewriting data', () => {
  const g = createGame(42, { teamSizes: [15, 1], mapSize: 'large', mode: 'play' });
  for (const mutate of [
    g => { g.config.teamSizes = [0, 1]; }, g => { g.config.teamSizes = [16, 1]; },
    g => { g.config.teamSizes = [15, 2]; }, g => { g.config.mapSize = 'constructor'; },
    g => { g.config.environment = '__proto__'; }, g => { g.soldiers[14].lane = 0; },
    g => { g.records.soldiers.pop(); }, g => { g.terrain.width++; },
    g => { g.forms[0].pop(); }, g => { g.soldiers[14].x = g.terrain.width + 1; },
    g => { g.control.soldierId = 'red-0'; }, g => { g.control.input.moveX = 2; },
    g => { g.control.input.targetId = 'blue-0'; }, g => { g.config.playerSlot = 14; },
  ]) {
    const mem = storage(); assert.equal(saveCampaign(g, mem).ok, true);
    const envelope = JSON.parse(mem.getItem(SAVE_KEY)); mutate(envelope.game);
    const encoded = JSON.stringify(envelope); mem.setItem(SAVE_KEY, encoded);
    assert.equal(loadCampaign(mem).game, null); assert.equal(mem.getItem(SAVE_KEY), encoded);
  }
});

test('v6 invalid new configuration values fail explicitly without creating broken campaigns', () => {
  for (const bad of [
    { teamSizes: [0, 1] }, { teamSizes: [1, 16] }, { teamSizes: [1.5, 2] }, { teamSizes: ['1', 2] }, { teamSizes: [1] },
    { teamSizes: [1, 1], mapSize: 'legacy' }, { mapSize: '__proto__' }, { environment: 'constructor' },
    { mode: 'unknown' }, { terrain: 'unknown' }, { playerSlot: 5 }, { opponentForm: 'unknown' },
    { opponentMode: 'unknown' }, { forms: [['niman'], ['soresu']] },
  ]) assert.throws(() => createGame(42, bad), RangeError, JSON.stringify(bad));
});

test('v6 checkpointing clears ephemeral held input without changing the live fighter or battlefield', () => {
  const g = createGame(18, { teamSizes: [1, 1], mapSize: 'small', mode: 'play' });
  engine.setPlayerInput(g, { moveX: 1, moveY: -1, attack: true, force: true, guard: true, dash: true, targetId: 'red-0' });
  const before = structuredClone(g), mem = storage(); assert.equal(saveCampaign(g, mem).ok, true); assert.deepEqual(g, before);
  const loaded = loadCampaign(mem); assert.equal(loaded.error, null);
  const expected = structuredClone(before); engine.clearPlayerInput(expected); assert.deepEqual(loaded.game, expected);
  assert.equal(loaded.game.control.soldierId, 'blue-0');
});

test('v6 switching controlled fighter or entering spectator clears all old control', () => {
  const g = createGame(18, { teamSizes: [15, 1], mapSize: 'small', mode: 'play' });
  engine.setPlayerInput(g, { moveX: 1, attack: true, guard: true });
  const before = structuredClone(g); assert.equal(engine.setControlledFighter(g, 'red-0'), false); assert.deepEqual(g, before);
  assert.equal(engine.setControlledFighter(g, 'blue-14'), true); assert.equal(g.config.playerSlot, 14); assert.equal(g.control.input.moveX, 0); assert.equal(g.control.input.attack, false);
  engine.setPlayerInput(g, { moveY: 1, force: true }); assert.equal(engine.setControlledFighter(g, null), true);
  assert.equal(g.config.mode, 'spectate'); assert.equal(g.control.soldierId, null); assert.equal(g.control.input.moveY, 0);
  assert.equal(engine.setPlayerInput(g, { moveX: 1 }), false); roundTrip(g);
});

test('v6 real manual combat spends resources, consumes pulses and never auto-guards without input', () => {
  const g = createGame(19, { teamSizes: [1, 1], mapSize: 'small', mode: 'play', enemyForm: 'shii_cho' });
  const a = fighter(g, 0, 0), b = fighter(g, 1, 0);
  Object.assign(a, { x: 465, y: 270, saberReadyTick: 0, forceReadyTick: 0 });
  Object.assign(b, { x: 500, y: 270, saberReadyTick: 1000, forceReadyTick: 1000 }); g._nextAiDecision = 1000;
  step(g, 1 / 60); assert.equal(a.attack, null); assert.equal(a.guard, false);
  const energy = a.energy; engine.setPlayerInput(g, { attack: true, targetId: b.id }); step(g, 1 / 60);
  assert.equal(a.attack?.kind, 'saber'); assert.ok(a.energy < energy); assert.equal(g.stats.saberSwings[0], 1);
  assert.equal(g.control.input.attack, false); engine.clearPlayerInput(g); step(g, 2);
  assert.equal(g.stats.saberSwings[0], 1, 'one pulse must not become repeated attacks');
});

test('v6 rain changes actual controlled movement rather than only the display', () => {
  const travel = environment => {
    const g = createGame(19, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'play', environment });
    const a = fighter(g, 0, 0), x = a.x; engine.setPlayerInput(g, { moveX: 1 }); step(g, .05); return a.x - x;
  };
  const clear = travel('clear'), rain = travel('rain'); assert.ok(clear > 0 && rain > 0); assert.ok(rain < clear);
});

test('v6 fog prevents a real ranged cast outside visibility without charging energy', () => {
  const scenario = environment => {
    const g = createGame(19, { teamSizes: [1, 1], mapSize: 'small', terrain: 'crossroads', mode: 'play', environment });
    const [a, b] = g.soldiers;
    Object.assign(a, { x: 300, y: 225, forceReadyTick: 0 });
    Object.assign(b, { x: 600, y: 225, saberReadyTick: 1000, forceReadyTick: 1000 });
    g._nextAiDecision = 1000; engine.setPlayerInput(g, { force: true, targetId: b.id }); step(g, 1 / 60); return g;
  };
  const clear = scenario('clear'), fog = scenario('fog');
  assert.equal(clear.soldiers[0].attack?.kind, 'force'); assert.ok(clear.soldiers[0].energy < 100);
  assert.equal(fog.soldiers[0].attack, null); assert.equal(fog.soldiers[0].energy, 100); assert.equal(fog.stats.forceCasts[0], 0);
});

test('v6 terrain hazard damage records a real environmental death and releases held controls', () => {
  const g = createGame(19, { teamSizes: [1, 1], mapSize: 'small', terrain: 'craterfield', mode: 'play' });
  const a = g.soldiers[0], zone = g.terrain.zones.find(zone => zone.kind === 'hazard'); assert.ok(zone);
  Object.assign(a, { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2, hp: .01 });
  engine.setPlayerInput(g, { moveX: 1, guard: true }); step(g, 1 / 60);
  assert.equal(a.alive, false); assert.equal(a.environmentDeaths, 1); assert.equal(g.records.teams[0].deaths, 1);
  assert.equal(g.records.teams[1].kills, 0); assert.equal(g.records.teams[1].assists, 0);
  assert.equal(g.control.input.moveX, 0); assert.equal(g.control.input.guard, false); healthy(g); roundTrip(g);
});

test('v6 all fifteen enemy casualties and capped-career health totals remain saveable', () => {
  const g = createGame(51, { teamSizes: [15, 15], mapSize: 'small', mode: 'spectate' });
  engine.resolveDamage(g, g.soldiers.filter(s => s.team === 1).map(s => ({ source: 'blue-0', target: s.id, amount: 9999, kind: 'saber' })));
  step(g, 1 / 60); assert.equal(g.status, 'ended'); assert.equal(g.records.teams[0].kills, 15); assert.equal(fighter(g, 0, 0).kills, 15);
  healthy(g); roundTrip(g);
  g.careers.flat().forEach(c => { c.merit = MAX_MERIT; }); nextRound(g); roundTrip(g);
  assert.ok(g.soldiers.every(s => s.career.grade === 'SSS+V'));
  engine.resolveDamage(g, g.soldiers.filter(s => s.team === 1).map(s => ({ source: 'blue-0', target: s.id, amount: 9999, kind: 'saber' })));
  step(g, 1 / 60); assert.ok(g.history.at(-1).health[0] > 792.005); healthy(g); roundTrip(g);
});

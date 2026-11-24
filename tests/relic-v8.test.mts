import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, resolveDamage, setPlayerInput, duelIntent, nextRound } from '../dist/sim.js';
import { normalizeMatchRules, describeMatchRules, resolveRoundOutcome } from '../dist/match-rules.js';
import { advanceRelic, carrierMoveMultiplier, relicAssignment, RELIC_CARRIER_SPEED } from '../dist/relic.js';

const game = (options = {}) => createGame(81, { matchMode: 'relic', teamSizes: [2, 2], mapSize: 'small', mode: 'spectate', ...options });
const place = (s, x, y) => Object.assign(s, { x, y, attack: null, pinned: false, rallying: false, staggerUntil: 0 });
function looseFixture(options) {
  const g = game(options);
  g.soldiers.forEach((s, i) => place(s, s.team ? 820 : 120, 100 + i * 55));
  return g;
}
function take(g, s) { place(s, g.objective.x, g.objective.y); advanceRelic(g); assert.equal(g.objective.carrierId, s.id); }

test('Relic rules use three deliveries without changing old defaults', () => {
  assert.deepEqual(normalizeMatchRules(), { matchMode: 'control', roundDuration: 90, targetScore: 30 });
  assert.equal(normalizeMatchRules({ matchMode: 'elimination' }).targetScore, 30);
  assert.equal(normalizeMatchRules({ matchMode: 'relic' }).targetScore, 3);
  assert.throws(() => normalizeMatchRules({ matchMode: 'relic', targetScore: 30 }));
  assert.match(describeMatchRules({ matchMode: 'relic' }).summary, /28% slower and cannot dash/);
  assert.equal(game().objective.radius, 22);
  assert.equal(game().objective.extractionZones[0].radius, 48);
});

test('opposing presence blocks pickup symmetrically; friendly distance and id break ties', () => {
  for (const reverse of [false, true]) {
    const g = looseFixture(), blue = g.soldiers[0], red = g.soldiers[2];
    place(blue, 470, 270); place(red, 490, 270);
    if (reverse) g.soldiers.reverse();
    assert.deepEqual(advanceRelic(g), []);
    assert.equal(g.objective.carrierId, null); assert.equal(g.objective.contested, true);
    place(red, 820, 100);
    const blueOther = g.soldiers.find(s => s.team === 0 && s.id !== blue.id);
    place(blueOther, 470, 270);
    const rng = g.rngState;
    assert.equal(advanceRelic(g)[0].type, 'relic-pickup');
    assert.equal(g.objective.carrierId, 'blue-0'); assert.equal(g.rngState, rng);
  }
});

test('carrier death drops at the final damage position with a half-second lock', () => {
  const g = looseFixture(), carrier = g.soldiers[0], friend = g.soldiers[1];
  take(g, carrier); place(carrier, 425, 270);
  resolveDamage(g, [{ target: carrier.id, amount: carrier.hp + 1 }]);
  assert.equal(g.objective.carrierId, null); assert.equal(g.objective.owner, null);
  assert.equal(g.objective.state, 'available'); assert.equal(g.objective.x, carrier.x);
  assert.equal(g.objective.unlockTick, 30);
  place(friend, carrier.x, carrier.y); g.tick = 29;
  advanceRelic(g); assert.equal(g.objective.carrierId, null);
  g.tick = 30; advanceRelic(g); assert.equal(g.objective.carrierId, friend.id);
  assert.equal(g.events.filter(e => e.type === 'relic-drop').length, 1);
});

test('only the carrier home scores; reset locks for two seconds and supports three deliveries', () => {
  const g = looseFixture(), carrier = g.soldiers[0];
  for (let delivery = 1; delivery <= 3; delivery++) {
    take(g, carrier);
    const enemyZone = g.objective.extractionZones[1]; place(carrier, enemyZone.x, enemyZone.y);
    advanceRelic(g); assert.equal(g.objective.points[0], delivery - 1);
    const zone = g.objective.extractionZones[0]; place(carrier, zone.x, zone.y);
    assert.equal(advanceRelic(g)[0].type, 'relic-delivery');
    assert.equal(g.objective.points[0], delivery); assert.equal(g.objective.state, 'resetting');
    assert.equal(g.objective.x, g.objective.home.x); assert.equal(g.objective.carrierId, null);
    const unlock = g.objective.unlockTick;
    g.tick = unlock - 1; place(carrier, g.objective.x, g.objective.y);
    advanceRelic(g); assert.equal(g.objective.state, 'resetting');
    g.tick = unlock; advanceRelic(g);
    assert.equal(g.objective.carrierId, carrier.id);
    // Prepare the next helper iteration without adding a fourth delivery.
    if (delivery < 3) Object.assign(g.objective, { carrierId: null, owner: null, state: 'available' });
  }
  assert.equal(resolveRoundOutcome(g).winner, 0);
  assert.equal(resolveRoundOutcome(g).reason, 'Relic deliveries secured');
});

test('Relic timeout compares deliveries, survivors, then health; elimination still wins first', () => {
  const g = game(); g.tick = g.roundDuration * 60;
  assert.equal(resolveRoundOutcome(g).winner, null);
  g.objective.points = [0, 1]; assert.equal(resolveRoundOutcome(g).winner, 1);
  g.objective.points = [1, 1]; g.soldiers[0].hp -= 1;
  assert.equal(resolveRoundOutcome(g).winner, 1);
  g.objective.points = [3, 0]; g.soldiers.filter(s => s.team === 0).forEach(s => { s.alive = false; });
  assert.equal(resolveRoundOutcome(g).winner, 1); assert.equal(resolveRoundOutcome(g).reason, 'Squad defeated');
});

test('player carrier moves at 72 percent speed and cannot spend energy on dash', () => {
  const g = looseFixture({ mode: 'play' }), carrier = g.soldiers[0]; take(g, carrier);
  assert.equal(carrierMoveMultiplier(g, carrier), RELIC_CARRIER_SPEED);
  assert.equal(carrierMoveMultiplier(g, g.soldiers[1]), 1);
  const x = carrier.x;
  setPlayerInput(g, { moveX: 1, dash: true }); step(g, 1 / 60);
  assert.ok(Math.abs(carrier.x - x - 86 * .72 / 60) < 1e-8);
  assert.equal(carrier.dashReadyTick, 0); assert.equal(carrier.energy, 100);
  assert.equal(carrier.objectiveSeconds, 1 / 60);
});

test('AI carrier heads home while allies escort and enemies intercept', () => {
  const g = looseFixture(), carrier = g.soldiers[0]; take(g, carrier);
  place(g.soldiers[2], 700, 270);
  assert.equal(relicAssignment(g, carrier).role, 'deliver');
  assert.equal(relicAssignment(g, g.soldiers[1]).role, 'escort');
  assert.equal(relicAssignment(g, g.soldiers[2]).role, 'intercept');
  assert.equal(duelIntent(g, carrier).reason, 'Carry relic to extraction');
  const x = carrier.x; step(g, 1 / 60);
  assert.ok(carrier.x < x); assert.equal(carrier.attack, null);
  assert.ok(carrier.destinationX < x);
});

test('fixed-step chunking is deterministic and next round resets objective progress', () => {
  const a = game(), b = game(); step(a, 2);
  for (let i = 0; i < 120; i++) step(b, 1 / 60);
  assert.deepEqual(a, b);
  a.status = 'ended'; a.objective.points = [3, 2]; nextRound(a);
  assert.deepEqual(a.objective.points, [0, 0]); assert.equal(a.objective.state, 'available');
  assert.equal(a.objective.carrierId, null); assert.equal(a.objective.unlockTick, 0);
});

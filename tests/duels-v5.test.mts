import { authoritativeState } from './helpers/presentation-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { auditDuels, duel, loadEngine, forceResolutionBucket } from '../scripts/audit-duels.mjs';
import { saveCampaign, loadCampaign } from '../dist/persistence.js';

const engine = await loadEngine(fileURLToPath(new URL('../dist/', import.meta.url)));

test('v5 audit compares semantic cast outcomes across old and new feedback formats', () => {
  assert.equal(forceResolutionBucket({ type: 'force' }), 'resolved');
  for (const outcome of ['hit', 'blocked', 'miss', 'out-of-range']) assert.equal(forceResolutionBucket({ type: 'force', outcome }), 'resolved');
  assert.equal(forceResolutionBucket({ type: 'force', outcome: 'target-lost' }), 'targetInvalidated');
  assert.equal(forceResolutionBucket({ type: 'force', outcome: 'interrupted' }), null);
  assert.equal(forceResolutionBucket({ type: 'feedback', outcome: 'interrupted' }), null);
});

test('v5 matchup protocol pairs both colors at identical seeds without duplicating mirror controls', () => {
  const report = auditDuels(engine, 1);
  assert.equal(report.overall.rounds, 51);
  assert.equal(report.defaultAutoControl.rounds, 3);
  for (const form of Object.keys(engine.content.FORMS)) for (const map of engine.MAPS) {
    const rows = report.rows.filter(r => r.candidate === form && r.terrain === map.id);
    assert.deepEqual(rows.map(r => r.candidateTeam), form === 'shii_cho' ? [0] : [0, 1]);
    assert.ok(rows.every(r => r.seed === 1 && r.forms[r.candidateTeam] === form && r.forms[1 - r.candidateTeam] === 'shii_cho'));
  }
});

test('v5 observed duels and Force outcome accounting are reproducible', () => {
  for (const candidate of ['makashi', 'soresu', 'niman']) for (const candidateTeam of [0, 1]) {
    const options = { seed: 41, terrain: 'zigzag', candidate, candidateTeam };
    assert.deepEqual(duel(engine, options), duel(engine, options));
  }
});

test('v5 tactical intent and readiness inspection do not mutate combat state or RNG', () => {
  const g = engine.createGame(91, { autoCommand: true, form: 'soresu', enemyForm: 'makashi' });
  engine.step(g, 3);
  const before = structuredClone(g);
  for (const soldier of g.soldiers.filter(s => s.alive)) {
    const intent = engine.duelIntent(g, soldier);
    assert.ok(['saber', 'force', 'guard', 'recover', 'wait'].includes(intent.action));
    assert.ok(['close', 'hold', 'evade'].includes(intent.move));
    assert.equal(typeof intent.reason, 'string'); assert.equal(typeof intent.dash, 'boolean');
  }
  for (const command of ['force', 'guard']) {
    const readiness = engine.commandReadiness(g, command);
    assert.equal(typeof readiness.ready, 'boolean'); assert.equal(typeof readiness.reason, 'string');
    assert.ok(Number.isInteger(readiness.eligible) && readiness.eligible >= 0 && readiness.eligible <= 5);
  }
  assert.deepEqual(g, before);
});

test('v5 tactical decisions and combat records resume exactly from a saved windup', () => {
  const g = engine.createGame(171, { autoCommand: true, form: 'niman', enemyForm: 'juyo' });
  for (let frame = 0; frame < 1200 && !g.soldiers.some(s => s.attack); frame++) engine.step(g, 1 / 60);
  assert.ok(g.soldiers.some(s => s.attack));
  let encoded;
  const storage = { getItem: () => encoded, setItem: (_, value) => { encoded = value; } };
  assert.equal(saveCampaign(g, storage).ok, true);
  const saved = loadCampaign(storage); assert.equal(saved.error, null); assert.deepEqual(authoritativeState(saved.game), authoritativeState(g));
  engine.step(g, 90); engine.step(saved.game, 90);
  assert.deepEqual(saved.game, g);
  assert.equal(g.status, 'ended');
  assert.equal(g.records.teams[0].kills + g.records.teams[1].kills + g.records.teams[0].environmentDeaths + g.records.teams[1].environmentDeaths, g.records.teams[0].deaths + g.records.teams[1].deaths);
});

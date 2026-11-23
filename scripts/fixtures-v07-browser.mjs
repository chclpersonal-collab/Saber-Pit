/** Regenerate genuine v0.7 browser-migration fixtures from the preserved source. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const source = path.resolve(process.argv[2] || '../baseline-v07/dist');
const out = path.resolve('docs/evidence/v0.8-browser/v07-fixtures');
const { createGame, step } = await import(pathToFileURL(path.join(source, 'sim.js')));
const { saveCampaign, SAVE_KEY } = await import(pathToFileURL(path.join(source, 'persistence.js')));
const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
const config = { teamSizes: [3, 3], mode: 'play', mapSize: 'medium', terrain: 'crossroads', matchMode: 'control', roundDuration: 45 };
const game = createGame(701, config);
fs.mkdirSync(out, { recursive: true });
for (const [state, seconds] of [['active', 1], ['ended', 45]]) {
  step(game, seconds); assert.equal(game.status, state === 'active' ? 'playing' : 'ended');
  assert.equal(saveCampaign(game, storage).ok, true);
  assert.equal(JSON.parse(data.get(SAVE_KEY)).rulesVersion, 7);
  fs.writeFileSync(path.join(out, `${state}.json`), data.get(SAVE_KEY));
}
const sourceHashes = Object.fromEntries(fs.readdirSync(source).filter(n => n.endsWith('.js')).sort().map(n => [n, createHash('sha256').update(fs.readFileSync(path.join(source, n))).digest('hex')]));
fs.writeFileSync(path.join(out, 'provenance.json'), JSON.stringify({ sourceRevision: '11876a8544cf296a998b2124d74dc300f1850b09', sourceHashes, seed: 701, config, procedure: 'Untouched v0.7 createGame, step by1s and45s, saveCampaign. No game-state mutation or stubs.', generatedAt: new Date().toISOString() }, null, 2) + '\n');
console.log(out);

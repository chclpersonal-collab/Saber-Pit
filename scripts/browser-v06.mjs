/** Real-browser acceptance suite. No live application state is modified by the tests.
 * Requires Playwright and an installed Chromium browser; no npm dependency is added.
 * Run: CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-v06.mjs
 * The actual dist files are fulfilled at an isolated http://trenchline.test origin.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.QA_OUTPUT ? path.resolve(process.env.QA_OUTPUT) : path.join(root, 'docs/evidence/v0.6-browser');
await fs.mkdir(output, { recursive: true });
const assets = new Map();
for (const name of await fs.readdir(path.join(root, 'dist'))) assets.set(name, await fs.readFile(path.join(root, 'dist', name)));
const sourceHashes = Object.fromEntries([...assets].map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')]));
const report = { generatedAt: new Date().toISOString(), status: 'running', sourceHashes, browser: null, tests: [], pageErrors: [], consoleErrors: [], execution: 'Real Chromium; isolated browser contexts; unmodified dist files served through Playwright route fulfillment; no deployment certification' };
const finish = async () => fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
let browser;
try {
  const { chromium } = require('playwright');
  const launch = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  else { try { await fs.access('/usr/bin/chromium'); launch.executablePath = '/usr/bin/chromium'; } catch {} }
  browser = await chromium.launch(launch); report.browser = await browser.version();
} catch (error) {
  report.status = 'blocked'; report.blocker = String(error.message).slice(0, 8000); await finish();
  console.error('Browser tests BLOCKED before execution:', error.message); process.exitCode = 2;
}
if (browser) {
  const mime = name => name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
  const snap = page => page.evaluate(() => window.__trenchline.snapshot());
  const emptyInput = { moveX: 0, moveY: 0, attack: false, force: false, guard: false, dash: false, targetId: null };
  async function open({ viewport = { width: 1440, height: 1000 }, touch = false, saved = null, legacy = null, preferences = null } = {}) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://trenchline.test') return route.abort();
      const name = decodeURIComponent(url.pathname.slice(1) || 'index.html');
      const bytes = assets.get(name);
      if (!bytes) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ status: 200, contentType: mime(name), body: bytes });
    });
    await context.addInitScript(({ saved, legacy, preferences }) => {
      if (saved) localStorage.setItem('trenchline-campaign-v2', saved);
      if (legacy) localStorage.setItem('trenchline-campaign-v1', legacy);
      if (preferences) localStorage.setItem(preferences.key, preferences.value);
    }, { saved, legacy, preferences });
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
    await page.clock.install({ time: new Date('2026-10-15T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-15T12:00:01Z'));
    await page.goto('http://trenchline.test/?seed=42');
    await page.waitForFunction(() => Boolean(window.__trenchline));
    return { page, context };
  }
  async function scenario(name, fn) {
    const started = Date.now(), beforePageErrors = report.pageErrors.length, beforeConsoleErrors = report.consoleErrors.length;
    let current;
    try {
      const setup = async opts => { current = await open(opts); return current.page; };
      await fn(setup);
      assert.equal(report.pageErrors.length, beforePageErrors, 'uncaught page error');
      assert.equal(report.consoleErrors.length, beforeConsoleErrors, 'browser console error');
      report.tests.push({ name, status: 'passed', durationMs: Date.now() - started }); console.log('PASS', name);
    } catch (error) {
      report.tests.push({ name, status: 'failed', error: String(error.stack || error), durationMs: Date.now() - started });
      console.error('FAIL', name, error.message);
      if (current) await current.page.screenshot({ path: path.join(output, name.replace(/[^a-z0-9]+/gi, '-') + '-failure.png'), fullPage: true }).catch(() => {});
    } finally { await current?.context.close(); await finish(); }
  }
  async function choose(page, { sizes = [5, 5], mode = 'spectate', mapSize = 'medium', terrain = 'crossroads', environment = 'clear' } = {}) {
    await page.locator('#setupTeam0').fill(String(sizes[0])); await page.locator('#setupTeam0').blur();
    await page.locator('#setupTeam1').fill(String(sizes[1])); await page.locator('#setupTeam1').blur();
    await page.locator(`#setupForm input[name="playMode"][value="${mode}"]`).check();
    await page.locator('#setupMapSize').selectOption(mapSize); await page.locator('#setupTerrain').selectOption(terrain); await page.locator('#setupEnvironment').selectOption(environment);
  }
  const start = async page => { await page.locator('#startBattleBtn').click(); assert.equal((await snap(page)).sessionStarted, true); };
  const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'horizontal document overflow');
  const screenshot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });

  await scenario('menu has no automatic simulation or hidden shortcut launch', async open => {
    const page = await open(); assert.equal(await page.locator('#startMenu').isVisible(), true); assert.equal(await page.locator('#battleSurface').isVisible(), false);
    const initial = await snap(page); assert.equal(initial.sessionStarted, false); assert.equal(initial.tick, 0); assert.equal(initial.soundEnabled, false);
    for (const key of ['p', 'r', 'a', 's', 'd', 'Space', 'Escape']) await page.keyboard.press(key);
    await page.clock.runFor(5000); const after = await snap(page);
    for (const key of ['tick', 'rngState', 'soldiers', 'records']) assert.deepEqual(after[key], initial[key], key);
    assert.equal(after.sessionStarted, false); assert.equal(await page.evaluate(() => localStorage.getItem('trenchline-campaign-v2')), null);
    await page.locator('#optionsBtn').click(); assert.equal(await page.locator('#optionsDialog').isVisible(), true);
    await page.keyboard.press('Escape'); await page.clock.runFor(1000); assert.equal((await snap(page)).tick, 0);
    await screenshot(page, 'menu-desktop');
  });

  await scenario('custom configuration and all fifteen friendly forms reach the engine', async open => {
    const page = await open(); await choose(page, { sizes: [15, 1], mapSize: 'large', terrain: 'craterfield', environment: 'rain' });
    await page.locator('.setup-forms summary').click(); assert.equal(await page.locator('[data-setup-slot]').count(), 15);
    await page.locator('[data-setup-slot="14"]').selectOption('vaapad'); await page.locator('#setupOpponentForm').selectOption('soresu');
    await start(page); const g = await snap(page); assert.deepEqual(g.config.teamSizes, [15, 1]);
    assert.equal(g.config.mapSize, 'large'); assert.equal(g.config.environment, 'rain'); assert.equal(g.terrainId, 'craterfield');
    assert.equal(g.soldiers.length, 16); assert.equal(g.forms[0][14], 'vaapad'); assert.deepEqual(g.forms[1], ['soresu']);
    await noOverflow(page); await screenshot(page, 'large-asymmetric');
  });

  await scenario('invalid team counts remain on setup without launching', async open => {
    const page = await open();
    for (const count of ['0', '16', '1.5', '']) {
      await page.locator('#setupTeam0').fill(count); await page.locator('#startBattleBtn').click();
      assert.equal((await snap(page)).sessionStarted, false, `invalid count ${count} launched`);
    }
    await page.locator('#setupTeam0').fill('1'); await start(page); assert.equal((await snap(page)).config.teamSizes[0], 1);
  });

  await scenario('spectator runs both teams and menu return freezes the campaign', async open => {
    const page = await open(); await choose(page, { sizes: [15, 15], mapSize: 'small' }); await start(page);
    const initial = await snap(page); assert.equal(initial.control.soldierId, null); assert.equal(new Set(initial.forms[1]).size, 9);
    await page.clock.runFor(2000); assert.ok((await snap(page)).tick > initial.tick);
    await page.locator('#mainMenuBtn').click(); const paused = await snap(page); await page.clock.runFor(3000);
    assert.deepEqual((await snap(page)).soldiers, paused.soldiers); assert.equal((await snap(page)).tick, paused.tick);
    await page.locator('#continueSessionBtn').click(); assert.equal(await page.locator('#battleSurface').isVisible(), true);
    await noOverflow(page); await screenshot(page, 'maximum-squads');
  });

  await scenario('manual movement clears on key release pause options and menu', async open => {
    const page = await open(); await choose(page, { sizes: [1, 1], mode: 'play', mapSize: 'small' }); await start(page);
    const initial = await snap(page), id = initial.control.soldierId;
    const actor = g => g.soldiers.find(s => s.id === id);
    await page.clock.runFor(200); assert.deepEqual([actor(await snap(page)).x, actor(await snap(page)).y], [actor(initial).x, actor(initial).y]);
    await page.locator('#battleCanvas').focus(); await page.keyboard.down('d'); await page.clock.runFor(250); await page.keyboard.up('d');
    const moved = await snap(page); assert.ok(actor(moved).x > actor(initial).x);
    await page.clock.runFor(200); assert.deepEqual([actor(await snap(page)).x, actor(await snap(page)).y], [actor(moved).x, actor(moved).y]);
    await page.keyboard.down('w'); await page.locator('#pauseBtn').click(); await page.keyboard.up('w');
    assert.deepEqual((await snap(page)).control.input, emptyInput);
    await page.locator('#battleOptionsBtn').click(); await page.locator('#closeOptionsBtn').click(); assert.equal((await snap(page)).paused, true);
    await page.locator('#mainMenuBtn').click(); assert.deepEqual((await snap(page)).control.input, emptyInput);
  });

  await scenario('options preferences persist without starting or overwriting a checkpoint', async open => {
    const fixture = await fs.readFile(path.join(root, 'tests/fixtures/v05-active-save.json'), 'utf8');
    const page = await open({ saved: fixture }); await page.locator('#optionsBtn').click();
    await page.locator('#optionMotion').selectOption('reduce'); await page.locator('#optionEffects').selectOption('minimal');
    await page.locator('#optionTactical').check(); await page.locator('#closeOptionsBtn').click(); await page.reload(); await page.waitForFunction(() => Boolean(window.__trenchline));
    assert.equal((await snap(page)).sessionStarted, false); assert.equal((await snap(page)).tick, 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('trenchline-campaign-v2')), fixture);
    await page.locator('#optionsBtn').click(); assert.equal(await page.locator('#optionMotion').inputValue(), 'reduce'); assert.equal(await page.locator('#optionEffects').inputValue(), 'minimal');
  });

  for (const version of ['04', '05']) for (const state of ['active', 'ended']) await scenario(`v${version} ${state} checkpoint resumes exact original battle fields`, async open => {
    const encoded = await fs.readFile(path.join(root, `tests/fixtures/v${version}-${state}-save.json`), 'utf8'), old = JSON.parse(encoded).game;
    const page = await open({ saved: encoded }); await page.locator('#continueSessionBtn').click(); const loaded = await snap(page);
    for (const key of ['tick', 'round', 'time', 'score', 'forms', 'careers', 'records', 'objective', 'stats', 'effects']) assert.deepEqual(loaded[key], old[key], key);
    for (let i = 0; i < old.soldiers.length; i++) for (const [key, value] of Object.entries(old.soldiers[i])) assert.deepEqual(loaded.soldiers[i][key], value, `soldier ${i}.${key}`);
    assert.equal(loaded.status, old.status); assert.equal(loaded.config.mapSize, 'legacy');
    if (state === 'active') assert.equal(loaded.paused, true); else assert.equal(await page.locator('#resultOverlay').isVisible(), true);
    await page.clock.runFor(1000); assert.equal((await snap(page)).tick, loaded.tick);
    assert.equal(await page.evaluate(() => localStorage.getItem('trenchline-campaign-v2')), encoded);
  });

  await scenario('maximum squad finishes and next round keeps all records and forms', async open => {
    const page = await open(); await choose(page, { sizes: [15, 15], mapSize: 'small' }); await start(page);
    await page.clock.runFor(92000); const ended = await snap(page); assert.equal(ended.status, 'ended'); assert.equal(await page.locator('#resultOverlay').isVisible(), true);
    assert.equal(ended.roundReport.careers.length, 30); assert.equal(await page.locator('#formChoices select').count(), 15);
    await page.locator('#nextRoundBtn').click(); const next = await snap(page);
    assert.equal(next.round, ended.round + 1); assert.equal(next.soldiers.length, 30); assert.deepEqual(next.records, ended.records);
    assert.ok(new Set(next.forms[1]).size > 1); await screenshot(page, 'maximum-squads-next-round');
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) await scenario(`responsive ${viewport.width}x${viewport.height} setup and controls`, async open => {
    const page = await open({ viewport, touch: true }); await noOverflow(page); await choose(page, { sizes: [15, 15], mode: 'play', mapSize: 'large' });
    await page.locator('.setup-forms summary').click(); await page.locator('[data-setup-slot="14"]').selectOption('niman'); await start(page); await noOverflow(page);
    await page.tap('[data-player-action="attack"]'); await page.clock.runFor(50);
    const box = await page.locator('[data-player-action="attack"]').boundingBox(); assert.ok(box && box.height >= 44);
    await screenshot(page, `touch-${viewport.width}x${viewport.height}`);
    await page.locator('#mainMenuBtn').click(); await noOverflow(page); assert.equal(await page.locator('#startBattleBtn').isVisible(), true);
  });

  await browser.close(); report.status = report.tests.every(t => t.status === 'passed') ? 'passed' : 'failed';
  report.passed = report.tests.filter(t => t.status === 'passed').length; report.failed = report.tests.filter(t => t.status === 'failed').length;
  await finish(); console.log(JSON.stringify({ status: report.status, passed: report.passed, failed: report.failed, output }, null, 2));
  if (report.failed) process.exitCode = 1;
}

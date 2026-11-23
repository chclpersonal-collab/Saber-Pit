/** Real-browser v0.9 acceptance checks. The live engine is never patched by tests.
 * Node 20+ and Playwright required. Optional: PLAYWRIGHT_PATH, CHROMIUM_PATH,
 * QA_SOURCE, QA_OUTPUT, QA_FILTER. Uses an isolated browser profile and origin,
 * preserves the browser security sandbox, and makes no external network requests.
 * This is desktop Chromium with mobile viewport/touch emulation, not a device lab.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.env.QA_SOURCE || path.join(root, 'dist'));
const output = path.resolve(process.env.QA_OUTPUT || path.join(root, 'docs/evidence/v0.9-browser'));
const filter = process.env.QA_FILTER ? new RegExp(process.env.QA_FILTER, 'i') : null;
await fs.mkdir(output, { recursive: true });
const assets = new Map();
for (const name of (await fs.readdir(source)).sort()) {
  if ((await fs.stat(path.join(source, name))).isFile()) assets.set(name, await fs.readFile(path.join(source, name)));
}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHashes = Object.fromEntries([...assets].map(([name, bytes]) => [name, hash(bytes)]));
const report = {
  generatedAt: new Date().toISOString(), status: 'running', source, sourceHashes,
  browser: null, browserMode: 'headless', tests: [], pageErrors: [], consoleErrors: [], screenshots: [],
  execution: 'Real Chrome/Chromium with security sandbox enabled, isolated contexts, captured unmodified dist assets, trusted Playwright keyboard and pointer input; controlled animation clock.',
  limitations: ['Mobile checks emulate viewport and touch in desktop Chromium.', 'Basic naming/focus/layout checks are not a complete WCAG or assistive-technology audit.', 'Clock-driven checks do not measure frame rate or browser rendering performance.'],
};
const finish = () => fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
const suite = [];
const test = (name, fn) => suite.push({ name, fn });
const snap = page => page.evaluate(() => window.__trenchline.snapshot());
const emptyInput = { moveX: 0, moveY: 0, attack: false, force: false, guard: false, dash: false, targetId: null };
const tick = (page, ms = 100) => page.clock.runFor(ms);
const actor = state => state.soldiers.find(s => s.id === state.control.soldierId);
const position = state => [actor(state).x, actor(state).y];
const screenshot = async (page, name) => {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage: true });
  report.screenshots.push(filename);
};
const noOverflow = async page => {
  const sizes = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(sizes.document <= sizes.viewport, `horizontal overflow ${JSON.stringify(sizes)}`);
};
async function namedControls(page) {
  const failures = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, input:not([type=hidden]), select, textarea')].filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
    return nodes.filter(n => {
      const labelled = (n.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join('');
      return !(n.getAttribute('aria-label') || labelled || [...(n.labels || [])].map(l => l.textContent).join('') || (n.tagName === 'BUTTON' ? n.textContent : '')).trim();
    }).map(n => ({ tag: n.tagName, id: n.id }));
  });
  assert.deepEqual(failures, [], 'visible controls need accessible names');
}
async function choose(page, { sizes = [1, 1], mode = 'play', mapSize = 'large', terrain = 'crossroads', environment = 'clear', matchMode = 'control', duration = 45, modifier = 'standard' } = {}) {
  await page.locator('#setupTeam0').fill(String(sizes[0])); await page.locator('#setupTeam0').blur();
  await page.locator('#setupTeam1').fill(String(sizes[1])); await page.locator('#setupTeam1').blur();
  await page.locator(`input[name=playMode][value=${mode}]`).check();
  for (const [id, value] of Object.entries({ setupMapSize: mapSize, setupTerrain: terrain, setupEnvironment: environment, setupMatchMode: matchMode, setupRoundDuration: String(duration), setupModifier: modifier })) await page.locator(`#${id}`).selectOption(value);
}
async function start(page, options = {}) {
  await choose(page, options); await page.locator('#startBattleBtn').click();
  assert.equal((await snap(page)).sessionStarted, true);
  await page.locator('#battleCanvas').focus(); await tick(page, 50);
}
async function neutral(page, label) { assert.deepEqual((await snap(page)).control.input, emptyInput, label); }
async function resume(page) {
  await page.locator('#resumeBtn').click(); await tick(page, 100);
  assert.equal((await snap(page)).paused, false);
}
async function holdKeys(page) {
  await page.locator('#battleCanvas').focus();
  for (const key of ['d', 'Space', 'j', 'k']) await page.keyboard.down(key);
  await tick(page, 50);
}
async function releaseKeys(page) { for (const key of ['d', 'Space', 'j', 'k']) await page.keyboard.up(key); }

test('menu stays idle and exposes named controls', async open => {
  const page = await open(); const before = await snap(page);
  assert.equal(before.sessionStarted, false);
  await namedControls(page); await noOverflow(page);
  for (const key of ['p', 'Escape', 'd', 'j', 'k', 'Space']) await page.keyboard.press(key);
  await tick(page, 2000);
  const after = await snap(page);
  for (const key of ['tick', 'rngState', 'soldiers']) assert.deepEqual(after[key], before[key]);
  await screenshot(page, 'menu-desktop');
});

test('all rank entries maps sizes and modes remain available in setup', async open => {
  const page = await open();
  const ranks = await page.locator('#setupStartingRank0 option').evaluateAll(nodes => nodes.map(n => [n.value,n.textContent]));
  assert.deepEqual(ranks.slice(-6),[['SSS+','SSS+ (entry)'],['SSS+I','SSS+ I'],['SSS+II','SSS+ II'],['SSS+III','SSS+ III'],['SSS+IV','SSS+ IV'],['SSS+V','SSS+ V']]);
  for (const [id,expected] of [['setupMapSize',['small','medium','large']],['setupTerrain',['crossroads','zigzag','craterfield']],['setupMatchMode',['control','elimination','relic']],['setupModifier',['standard','saber_only']]]) {
    const values=await page.locator(`#${id} option`).evaluateAll(nodes=>nodes.map(n=>n.value));for(const value of expected)assert.ok(values.includes(value),`${id}/${value}`);
  }
  await choose(page,{sizes:[15,1],mode:'spectate',matchMode:'relic',modifier:'saber_only'});
  await page.locator('#setupStartingOptions summary').click();
  await page.locator('#setupStartingRank0').selectOption('SSS+V');
  await page.locator('#setupStartingRank1').selectOption('SSS+');
  await screenshot(page,'setup-top-ranks');
  await page.locator('#startBattleBtn').click();const state=await snap(page);
  assert.deepEqual(state.config.teamSizes,[15,1]);assert.deepEqual(state.config.startingRanks,['SSS+V','SSS+']);
});

for(const touch of [false,true])test(`v09 Ataru actual airborne height and repertoire inspector ${touch?'mobile':'desktop'}`,async open=>{
  const page=await open(touch?{viewport:{width:390,height:844},touch:true}:{});
  await choose(page,{sizes:[1,1],mode:'play',mapSize:'large',modifier:'saber_only'});
  await page.locator("details:has(#setupAllForms) summary").click();
  await page.locator('#setupAllForms').selectOption('ataru');await page.locator('#applyAllFormsBtn').click();
  await page.locator('#setupStartingOptions summary').click();await page.locator('#setupStartingRank0').selectOption('SSS+V');
  await page.locator('#startBattleBtn').click();await page.locator('#battleCanvas').focus();
  await page.keyboard.down('d');await page.keyboard.press('Shift');await tick(page,250);await page.keyboard.up('d');
  const state=await snap(page),s=actor(state);assert.equal(s.form,'ataru');assert.ok(s.airborne&&s.airborneHeight>20,`height ${s.airborneHeight}`);
  await screenshot(page,`ataru-airborne-${touch?'mobile':'desktop'}`);
  await page.locator('#pauseBtn').click();await page.locator('#inspectTeam').selectOption('0');await page.locator('#nextFighterBtn').click();await noOverflow(page);
  assert.match(await page.locator('#unitRole').textContent(),/vaulting cut.*corkscrew return.*somersault descent/i);
  assert.match(await page.locator('#unitRole').textContent(),/Force repertoire: disabled/);
  await screenshot(page,`ataru-inspector-${touch?'mobile':'desktop'}`);
  return {actualHeight:s.airborneHeight,airborne:s.airborne,emulatedTouch:touch};
});

test('v09 natural elite combat visibly uses multiple Force abilities',async open=>{
  const page=await open();await choose(page,{sizes:[5,5],mode:'spectate',mapSize:'small',matchMode:'relic'});
  await page.locator('#setupStartingOptions summary').click();for(const side of [0,1])await page.locator(`#setupStartingRank${side}`).selectOption('SSS+V');
  await page.locator("details:has(#setupAllForms) summary").click();await page.locator('#setupAllForms').selectOption('niman');await page.locator('#applyAllFormsBtn').click();await page.locator('#setupOpponentForm').selectOption('niman');
  await page.locator('#startBattleBtn').click();const abilities=new Set();
  for(let i=0;i<160;i++){await tick(page,200);const state=await snap(page);for(const s of state.soldiers)if(s.attack?.abilityId)abilities.add(s.attack.abilityId);for(const e of state.effects)if(e.abilityId)abilities.add(e.abilityId);if(state.status==='ended')break;}
  assert.ok(abilities.size>=2,`natural abilities ${[...abilities]}`);
  await screenshot(page,'elite-force-variety');return {observedAbilities:[...abilities]};
});

test('settings and help dialogs exclude background controls and stay idle', async open => {
  const page = await open();
  for (const [button, dialog, close] of [['optionsBtn', 'optionsDialog', 'closeOptionsBtn'], ['controlsBtn', 'controlsDialog', 'closeControlsBtn']]) {
    await page.locator(`#${button}`).click(); await namedControls(page);
    assert.equal(await page.locator(`#${dialog}`).evaluate(n => n.matches(':modal')), true);
    for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 15; i++) {
      await page.keyboard.press(key);
      // Native modal dialogs may move focus to browser chrome. Chrome exposes
      // BODY in that case; an actual background form control is a failure.
      const focus = await page.locator(`#${dialog}`).evaluate(n => ({ allowed: n.contains(document.activeElement) || document.activeElement === document.body, tag: document.activeElement.tagName, id: document.activeElement.id }));
      assert.equal(focus.allowed, true, `background received focus: ${JSON.stringify(focus)}`);
    }
    await page.locator(`#${close}`).click(); assert.equal((await snap(page)).tick, 0);
  }
});

test('manual movement guard and release use real keyboard input', async open => {
  const page = await open(); await start(page); const before = await snap(page);
  await page.keyboard.down('d'); await tick(page, 180); await page.keyboard.up('d');
  const moved = await snap(page); assert.ok(position(moved)[0] > position(before)[0]);
  await tick(page, 100); assert.deepEqual(position(await snap(page)), position(moved));
  await page.keyboard.down('Space'); await tick(page, 80); assert.equal((await snap(page)).control.input.guard, true);
  await page.keyboard.up('Space'); await tick(page, 80); await neutral(page, 'key release');
  await page.locator('#detailsBtn').focus(); await page.keyboard.down('d'); await tick(page, 100); await page.keyboard.up('d');
  assert.deepEqual(position(await snap(page)), position(moved), 'off-canvas typing does not move fighter');
});

for (const transition of ['pause', 'settings', 'menu']) test(`held input clears across ${transition} and resume`, async open => {
  const page = await open(); await start(page); await holdKeys(page);
  if (transition === 'pause') await page.keyboard.press('p');
  if (transition === 'settings') await page.locator('#battleOptionsBtn').click();
  if (transition === 'menu') await page.locator('#mainMenuBtn').click();
  await neutral(page, 'transition cleared input'); const paused = await snap(page);
  await tick(page, 500); assert.equal((await snap(page)).tick, paused.tick);
  if (transition === 'settings') { await page.keyboard.press('Escape'); assert.equal((await snap(page)).paused, true); }
  if (transition === 'menu') await page.locator('#continueSessionBtn').click();
  await releaseKeys(page); await resume(page); await neutral(page, 'resume did not restore held input');
  const before = position(await snap(page)); await tick(page, 120); assert.deepEqual(position(await snap(page)), before);
});

test('repeated pause and resume retain a single simulation loop', async open => {
  const page = await open(); await start(page);
  const deltas = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.down('d'); await page.keyboard.press('p'); await page.keyboard.up('d');
    await neutral(page, `pause ${i}`); const paused = await snap(page); await tick(page, 200);
    assert.equal((await snap(page)).tick, paused.tick);
    await page.locator('#resumeBtn').click(); const before = await snap(page); await tick(page, 250);
    const delta = (await snap(page)).tick - before.tick; deltas.push(delta);
    assert.ok(delta >= 11 && delta <= 16, `resume ${i} advanced ${delta} ticks per 250ms`);
    await neutral(page, `resume ${i}`);
  }
  return { tickDeltasPer250ms: deltas };
});

test('pointer hold and keyboard Guard toggle clear on pause', async open => {
  const page = await open(); await start(page);
  const move = page.locator('[data-move-x="1"]'); await move.scrollIntoViewIfNeeded(); const box = await move.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await tick(page, 100);
  assert.ok((await snap(page)).control.input.moveX > 0);
  await page.keyboard.press('p'); await neutral(page, 'pointer cleared by pause'); await page.mouse.up(); await resume(page);
  const guard = page.locator('[data-player-action="guard"]'); await guard.focus(); await page.keyboard.press('Enter'); await tick(page, 80);
  assert.equal(await guard.getAttribute('aria-pressed'), 'true'); assert.equal((await snap(page)).control.input.guard, true);
  await page.keyboard.press('p'); await neutral(page, 'latched guard cleared'); assert.equal(await guard.getAttribute('aria-pressed'), 'false');
  await resume(page); await neutral(page, 'pointer and toggle stayed clear');
});

test('target cycling and reverse Tab preserve a keyboard exit', async open => {
  const page = await open(); await start(page, { sizes: [1, 5], mapSize: 'small' });
  for (let i = 0; i < 16 && await page.locator('#cycleTargetBtn').isDisabled(); i++) await tick(page, 200);
  assert.equal(await page.locator('#cycleTargetBtn').isEnabled(), true);
  await page.locator('#battleCanvas').focus(); await page.keyboard.press('Tab'); await tick(page, 50);
  const locked = await snap(page); assert.ok(locked.control.input.targetId);
  const enemy = locked.soldiers.find(s => s.id === locked.control.input.targetId); assert.ok(enemy.alive && enemy.team === 1);
  assert.equal(await page.locator('#battleCanvas').evaluate(n => n === document.activeElement), true);
  assert.match(await page.locator('#targetStatus').innerText(), /enemy|target/i);
  await page.keyboard.press('Shift+Tab'); assert.equal(await page.locator('#battleCanvas').evaluate(n => n === document.activeElement), false);
  await screenshot(page, 'target-feedback');
});

test('Relic HUD and paused inspection expose fighters without covering live Play', async open => {
  const page = await open(); await start(page, { mode: 'spectate', matchMode: 'relic', sizes: [5, 5], mapSize: 'medium' });
  await tick(page, 1200);
  assert.match(await page.locator('#objectiveStatus').innerText(), /relic/i);
  assert.ok((await page.locator('#objectiveDetail').innerText()).length > 20);
  await screenshot(page, 'desktop-relic-live');
  await page.locator('#pauseBtn').click(); await page.locator('#nextFighterBtn').click();
  assert.ok((await snap(page)).selectedUnitId);
  await page.locator('#inspectTeam').selectOption('1'); const enemy = await snap(page);
  assert.equal(enemy.soldiers.find(s => s.id === enemy.selectedUnitId).team, 1);
  await page.locator('#previousFighterBtn').click(); const previous = await snap(page);
  assert.equal(previous.soldiers.find(s => s.id === previous.selectedUnitId).team, 1);
  await page.locator('#inspectTeam').selectOption('0'); await page.locator('#takeControlBtn').click();
  await screenshot(page, 'desktop-relic-inspection'); await resume(page);
  assert.equal((await snap(page)).config.mode, 'play');
  assert.equal(await page.locator('#unitInspector').isVisible(), false);
});

test('active save reload resumes paused with exact battle state', async open => {
  const page = await open(); await start(page, { matchMode: 'relic', modifier: 'saber_only', sizes: [3, 3] }); await tick(page, 1500);
  await page.locator('#pauseBtn').click(); await page.locator('#detailsBtn').click(); await page.locator('#saveCampaignBtn').click();
  const saved = await page.evaluate(() => localStorage.getItem('trenchline-campaign-v2')); assert.ok(saved);
  const before = await snap(page); await page.reload(); await page.waitForFunction(() => !!window.__trenchline);
  await page.locator('#continueSessionBtn').click(); const loaded = await snap(page);
  for (const key of ['tick', 'rngState', 'config', 'soldiers', 'careers', 'records', 'mastery', 'objective', 'score']) assert.deepEqual(loaded[key], before[key], key);
  assert.equal(loaded.paused, true); await neutral(page, 'loaded input neutral'); await tick(page, 500); assert.equal((await snap(page)).tick, loaded.tick);
  assert.equal(await page.evaluate(() => localStorage.getItem('trenchline-campaign-v2')), saved);
  await resume(page); assert.ok((await snap(page)).tick > loaded.tick);
});

for (const version of ['04', '05', '06', '07', '08']) for (const state of ['active', 'ended']) test(`v${version} ${state} save opens without replacing stored data`, async open => {
  const fixture = version === '08' ? `docs/evidence/v0.9-v08-fixtures/${state}.json` : version === '07' ? `docs/evidence/v0.8-browser/v07-fixtures/${state}.json` : `tests/fixtures/v${version}-${state}-save.json`;
  const encoded = await fs.readFile(path.join(root, fixture), 'utf8');
  const old = JSON.parse(encoded).game; const page = await open({ saved: encoded });
  await page.locator('#continueSessionBtn').click(); const loaded = await snap(page);
  for (const key of ['tick', 'rngState', 'round', 'time', 'score', 'careers', 'records', 'objective', 'stats', 'effects', ...(['07','08'].includes(version) ? ['mastery'] : [])]) assert.deepEqual(loaded[key], old[key], key);
  assert.equal(loaded.config.modifier, version === '08' ? 'saber_only' : 'standard'); assert.equal(loaded.status, old.status);
  assert.equal(await page.evaluate(() => localStorage.getItem('trenchline-campaign-v2')), encoded);
  await tick(page, 500); assert.equal((await snap(page)).tick, loaded.tick);
  if (state === 'active') assert.equal(loaded.paused, true); else assert.equal(await page.locator('#resultOverlay').isVisible(), true);
});

for (const matchMode of ['control', 'elimination', 'relic']) test(`${matchMode} round settles and next round keeps progression`, async open => {
  const page = await open(); await start(page, { mode: 'spectate', sizes: [5, 5], mapSize: 'small', matchMode });
  await tick(page, 47000); const ended = await snap(page); assert.equal(ended.status, 'ended');
  assert.equal(await page.locator('#resultOverlay').isVisible(), true); await namedControls(page);
  assert.match(await page.locator('#resultRules').textContent(), new RegExp(matchMode, 'i'));
  await page.keyboard.press('Tab'); assert.equal(await page.locator('#resultOverlay').evaluate(n => n.contains(document.activeElement)), true);
  await screenshot(page, `result-${matchMode}`);
  await page.locator('#nextRoundBtn').click(); const next = await snap(page);
  assert.equal(next.round, ended.round + 1); assert.deepEqual(next.records, ended.records); assert.deepEqual(next.mastery, ended.mastery);
  assert.equal(next.config.matchMode, matchMode); assert.equal(next.status, 'playing'); await neutral(page, 'next-round input');
});

test('Saber only disables Force in UI and both teams have no Force attacks', async open => {
  const page = await open(); await start(page, { sizes: [5, 5], mapSize: 'small', modifier: 'saber_only' });
  assert.equal((await snap(page)).config.modifier, 'saber_only');
  assert.equal(await page.locator('[data-player-action="force"]').isDisabled(), true);
  await page.keyboard.press('k'); await tick(page, 1500);
  const state = await snap(page); assert.deepEqual(state.stats.shots, [0, 0]);
  assert.ok(state.soldiers.every(s => !s.attack || s.attack.kind !== 'force'));
  await screenshot(page, 'saber-only');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) test(`viewport geometry ${viewport.width}x${viewport.height}`, async open => {
  const page = await open({ viewport, touch: true });
  await choose(page, { sizes: [15, 15], mode: 'play', matchMode: 'relic', mapSize: 'small', modifier: 'saber_only' });
  await page.locator('#startBattleBtn').click(); await tick(page, 50);
  const measure = () => page.evaluate(() => {
    const selectors = { battlefield: '#battlefield', canvas: '#battleCanvas', directControls: '#directControls', direction: '.direction-pad', right: '[data-move-x="1"]', strike: '[data-player-action="attack"]', cycle: '#cycleTargetBtn' };
    return { scrollY, viewport: { width: innerWidth, height: innerHeight }, boxes: Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return [name, { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, visibleHeight: Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) }];
    })) };
  });
  const initial = await measure();
  await noOverflow(page);
  assert.ok(initial.boxes.battlefield.visibleHeight >= initial.boxes.battlefield.height - 1, 'entire battlefield visible after Start');
  for (const key of ['direction', 'strike', 'cycle']) assert.ok(initial.boxes[key].visibleHeight >= initial.boxes[key].height - 1, `${key} visible together with battlefield after Start`);
  await page.screenshot({ path: path.join(output, `viewport-${viewport.width}x${viewport.height}-initial.png`), fullPage: false });
  report.screenshots.push(`viewport-${viewport.width}x${viewport.height}-initial.png`);
  await page.locator('.direct-control-row').scrollIntoViewIfNeeded(); const controlsInView = await measure();
  await page.screenshot({ path: path.join(output, `viewport-${viewport.width}x${viewport.height}-controls.png`), fullPage: false });
  report.screenshots.push(`viewport-${viewport.width}x${viewport.height}-controls.png`);
  assert.equal(controlsInView.scrollY, initial.scrollY, 'controls require no extra scroll after Start');
  return { initial, controlsInView };
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) test(`mobile ${viewport.width}x${viewport.height} controls and result layout`, async open => {
  const page = await open({ viewport, touch: true }); await noOverflow(page); await namedControls(page);
  await screenshot(page, `mobile-menu-${viewport.width}x${viewport.height}`);
  await start(page, { sizes: [15, 15], mode: 'play', matchMode: 'relic', mapSize: 'small', modifier: 'saber_only' });
  await noOverflow(page); await namedControls(page);
  for (const selector of ['[data-player-action="attack"]', '[data-player-action="guard"]', '[data-move-x="1"]']) {
    const control = page.locator(selector); await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `${selector} touch target ${JSON.stringify(box)}`);
  }
  await page.tap('[data-player-action="attack"]'); await tick(page, 100);
  await page.locator('#battleCanvas').scrollIntoViewIfNeeded(); await screenshot(page, `mobile-${viewport.width}x${viewport.height}`);
  await page.locator('#pauseBtn').click(); await page.locator('#spectateBtn').click();
  if ((await snap(page)).paused) await resume(page);
  await tick(page, 47000); assert.equal((await snap(page)).status, 'ended'); await noOverflow(page);
  await screenshot(page, `mobile-result-${viewport.width}x${viewport.height}`);
});

test('reduced motion setting survives reload and does not start a battle', async open => {
  const page = await open(); await page.locator('#optionsBtn').click();
  await page.locator('#optionMotion').selectOption('reduce'); await page.locator('#optionEffects').selectOption('minimal');
  await page.locator('#closeOptionsBtn').click(); await page.reload(); await page.waitForFunction(() => !!window.__trenchline);
  assert.equal((await snap(page)).sessionStarted, false); await page.locator('#optionsBtn').click();
  assert.equal(await page.locator('#optionMotion').inputValue(), 'reduce'); assert.equal(await page.locator('#optionEffects').inputValue(), 'minimal');
});

const selected = suite.filter(t => !filter || filter.test(t.name));
report.tests = selected.map(t => ({ name: t.name, status: 'not_run' }));
let browser;
try {
  let playwright;
  if (process.env.PLAYWRIGHT_PATH) playwright = require(process.env.PLAYWRIGHT_PATH);
  else {
    try { playwright = require('playwright'); }
    catch { playwright = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright')); }
  }
  const launch = { headless: true, chromiumSandbox: true };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  else if (process.platform === 'win32') launch.channel = 'chrome';
  browser = await playwright.chromium.launch(launch); report.browser = await browser.version();
} catch (error) {
  report.status = 'blocked'; report.blocker = String(error.stack || error); await finish();
  console.error('Browser suite BLOCKED:', error.message); process.exitCode = 2;
}

if (browser) {
  const mime = name => name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
  async function open({ viewport = { width: 1440, height: 1000 }, touch = false, saved = null } = {}) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    await context.route('**/*', route => {
      const url = new URL(route.request().url()); if (url.origin !== 'http://saber-pit.test') return route.abort();
      const name = decodeURIComponent(url.pathname.slice(1) || 'index.html'), bytes = assets.get(name);
      return route.fulfill(bytes ? { status: 200, contentType: mime(name), body: bytes } : { status: 404, body: 'Not found' });
    });
    if (saved) await context.addInitScript(value => localStorage.setItem('trenchline-campaign-v2', value), saved);
    const page = await context.newPage(); page.setDefaultTimeout(6000);
    page.on('pageerror', e => report.pageErrors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
    await page.clock.install({ time: new Date('2026-10-15T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-15T12:00:01Z'));
    await page.goto('http://saber-pit.test/?seed=42'); await page.waitForFunction(() => !!window.__trenchline);
    return { page, context };
  }
  try {
    for (const [index, scenario] of selected.entries()) {
      let current; const started = Date.now(), pageErrorCount = report.pageErrors.length, consoleErrorCount = report.consoleErrors.length;
      try {
        const details = await scenario.fn(async opts => { current = await open(opts); return current.page; });
        assert.equal(report.pageErrors.length, pageErrorCount, 'uncaught browser error');
        assert.equal(report.consoleErrors.length, consoleErrorCount, 'browser console error');
        report.tests[index] = { name: scenario.name, status: 'passed', durationMs: Date.now() - started, ...(details ? { details } : {}) };
        console.log('PASS', scenario.name);
      } catch (error) {
        report.tests[index] = { name: scenario.name, status: 'failed', error: String(error.stack || error), durationMs: Date.now() - started };
        console.error('FAIL', scenario.name, error.message);
        if (current) await screenshot(current.page, `failure-${index + 1}`).catch(() => {});
      } finally { await current?.context.close(); await finish(); }
    }
  } finally { await browser.close(); }
  report.sourceChangedDuringRun = (await Promise.all([...assets.keys()].map(async name => hash(await fs.readFile(path.join(source, name))) !== sourceHashes[name]))).some(Boolean);
  report.passed = report.tests.filter(t => t.status === 'passed').length; report.failed = report.tests.filter(t => t.status === 'failed').length;
  report.status = report.failed || report.sourceChangedDuringRun ? 'failed' : 'passed';
  if (report.sourceChangedDuringRun) report.limitation = 'Source changed during the run; captured assets were tested, but rerun before release.';
  await finish(); console.log(JSON.stringify({ status: report.status, passed: report.passed, failed: report.failed, sourceChangedDuringRun: report.sourceChangedDuringRun, output }, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
}



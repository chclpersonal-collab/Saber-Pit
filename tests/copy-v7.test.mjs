import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_COPY, displayText } from '../dist/copy.js';
import { FORMS, MAPS } from '../dist/content.js';
import { createBattlefield } from '../dist/maps.js';
import { chooseAction } from '../dist/tactics.js';

const expectedForms = {
  shii_cho: ['Balanced damage, speed and defense.', 'Sweep'],
  makashi: ['Fast thrusts with extra reach.', 'Thrust'],
  soresu: ['Strong blocks, slower attacks.', 'Circle guard'],
  ataru: ['Fast attacks and cheaper dashes.', 'Jump cut'],
  shien: ['Good blocks and counters, with cheaper Force powers.', 'Deflect'],
  djem_so: ['Hard hits and strong counters, with slower attacks.', 'Heavy counter'],
  niman: ['Cheaper Force powers and faster energy recovery.', 'Weave'],
  juyo: ['Fast, heavy attacks with weak defense.', 'Flurry'],
  vaapad: ['Strong counters, but high block costs.', 'Riposte'],
};

test('every display mapping and longer combined string is replaced exactly', () => {
  assert.ok(Object.isFrozen(DISPLAY_COPY));
  for (const [source, expected] of Object.entries(DISPLAY_COPY)) {
    assert.equal(displayText(source), expected, source);
    assert.equal(displayText(`Before | ${source} | after`), `Before | ${expected} | after`, source);
  }
  assert.equal(displayText(Object.keys(DISPLAY_COPY).join(' | ')), Object.values(DISPLAY_COPY).join(' | '));
});

test('regexp punctuation near-misses never match or substitute undefined', () => {
  const punctuation = new Set('.*+?^${}()|[]\\');
  for (const source of Object.keys(DISPLAY_COPY)) {
    for (let i = 0; i < source.length; i++) {
      if (!punctuation.has(source[i])) continue;
      const nearMiss = source.slice(0, i) + '#' + source.slice(i + 1);
      const result = displayText(nearMiss);
      assert.equal(result, nearMiss, `${source} at ${i}`);
      assert.equal(result.includes('undefined'), false);
    }
  }
  for (const id of ['force_push', 'saber', 'signal', 'control', 'elimination', 'balanced', 'line', 'wedge', 'spread', 'constructor', '__proto__', 'blue-0']) {
    assert.equal(displayText(id), id);
  }
});

test('plain form copy leaves proper names, IDs, catalog data and numeric rules unchanged', () => {
  const before = JSON.stringify(FORMS);
  for (const form of Object.values(FORMS)) {
    assert.equal(displayText(form.trait), expectedForms[form.id][0]);
    assert.equal(displayText(form.technique.name), expectedForms[form.id][1]);
    assert.equal(displayText(form.name), form.name);
    assert.equal(displayText(form.id), form.id);
  }
  assert.equal(JSON.stringify(FORMS), before);
});

test('map descriptions are translated only for display, preserving canonical save geometry', () => {
  const legacy = MAPS[0], modern = createBattlefield(42, { mapSize: 'small', terrain: 'crossroads' });
  const before = JSON.stringify([legacy, modern]);
  assert.equal(legacy.description, 'Even lanes and balanced approaches to the signal post.');
  assert.equal(displayText(legacy.description), 'Even cover lanes around the signal post.');
  assert.equal(modern.description, 'Three open approaches cross a field of directional barricades and central walls.');
  assert.equal(displayText(modern.description), 'Three routes through barricades and center walls.');
  assert.equal(JSON.stringify([legacy, modern]), before);
});

test('stored tactics, events and equipment labels retain their source text', () => {
  const decision = chooseAction({ formId: 'soresu', energy: 100, distance: 44, guardOrdered: true });
  assert.equal(decision.reason, 'Honor guard order');
  assert.equal(displayText(decision.reason), 'Following guard order');
  assert.equal(decision.reason, 'Honor guard order');
  assert.equal(displayText('Blue doctrine: Guard'), 'Blue team style: Guard');
  assert.equal(displayText('Blue won: signal post secured'), 'Blue won: signal target reached');
  assert.equal(displayText('Blue 2: Force push → Force burst (new role / tradeoffs)'), 'Blue 2: Force push → Force burst (different power)');
  assert.equal(displayText('lightsaber → Improved lightsaber (better quality)'), 'lightsaber → Improved lightsaber (upgrade)');
});

test('display substitutions are literal, longest-first and leave unknown text alone', () => {
  assert.equal(displayText('Recover from stagger or pressure'), 'Recovering from stagger or pressure');
  assert.equal(displayText('Foundational bladework and broad controlX'), 'Foundational bladework and broad controlX');
  assert.equal(displayText('Move 12% faster; precision -4.5 points and incoming pressure +10%. Auto pushes more often.'), 'Move 12% faster. Accuracy drops 4.5 percentage points; incoming pressure rises 10%. Auto advances more often.');
  assert.equal(displayText('Force push'), 'Force push');
  assert.equal(displayText('Nothing to translate.'), 'Nothing to translate.');
  assert.equal(displayText(null), '');
  assert.equal(displayText(undefined), '');
});

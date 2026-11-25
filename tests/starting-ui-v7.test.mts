import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOLDIER_GRADES, gradeDisplayLabel } from '../dist/progression.js';

const html = readFileSync(new URL('../dist/classic.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('v7 starting rank and gear choices are collapsed and have separate controls for each team', () => {
  const details = html.match(/<details\b[^>]*id="setupStartingOptions"[^>]*>/)?.[0];
  assert.ok(details); assert.doesNotMatch(details, /\bopen(?:\s|=|>)/);
  for (const team of [0, 1]) for (const field of ['Rank', 'Saber', 'Force', 'ForceQuality']) {
    const id = `setupStarting${field}${team}`;
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} must be unique`);
    assert.match(html, new RegExp(`<label>[^<]+<select id="${id}"[^>]*aria-describedby=`));
  }
  assert.match(html, /Whole side; kills start at zero/);
});

test('v7 starting dropdown uses the complete ladder with the exact requested entry label', () => {
  const display = SOLDIER_GRADES.map(grade => gradeDisplayLabel(grade.label));
  assert.deepEqual(display, ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+ (entry)', 'SSS+ I', 'SSS+ II', 'SSS+ III', 'SSS+ IV', 'SSS+ V']);
  assert.match(app, /SOLDIER_GRADES\.map\(grade => \[grade\.label, gradeDisplayLabel\(grade\.label\)\]\)/);
  assert.equal(SOLDIER_GRADES[9].label, 'SSS+', 'existing saved rank ID is unchanged');
});

test('v7 new-game submission passes both teams starting values and keeps neutral gear defaults', () => {
  const start = app.slice(app.indexOf('function startNewCampaign('), app.indexOf('function updateDirectUI('));
  for (const field of ['startingRanks', 'startingSaberQuality', 'startingForceFamily', 'startingForceQuality']) assert.match(start, new RegExp(`\\b${field}: \\[`));
  for (const field of ['Rank', 'Saber', 'Force', 'ForceQuality']) for (const team of [0, 1]) assert.ok(start.includes(`$('setupStarting${field}${team}').value`));
  assert.match(start, /createGame\(nextSeed, options\)/);
  const initialization = app.slice(app.indexOf('function initializeStartingOptions('), app.indexOf('function setupForms('));
  assert.match(initialization, /setupStartingSaber\$\{team\}`\)\.value = 'standard'/);
  assert.match(initialization, /setupStartingForce\$\{team\}`\)\.value = 'force_push'/);
  assert.match(initialization, /setupStartingForceQuality\$\{team\}`\)\.value = 'standard'/);
  assert.doesNotMatch(initialization, /saveCampaign|setDoctrine|setPlayerInput|nextRound\(/);
});

test('v7 visible rank badges and reports use display labels without changing saved grade telemetry', () => {
  assert.ok(app.includes("$('unitGrade').textContent = gradeDisplayLabel(career.grade)"));
  assert.ok(app.includes("button.querySelector('.roster-grade').textContent = gradeDisplayLabel(career.grade)"));
  assert.ok(app.includes('const grade = gradeDisplayLabel(careerOf(soldier).grade), width'));
  assert.ok(app.includes('${gradeDisplayLabel(award.before.grade)} → ${gradeDisplayLabel(award.after.grade)}'));
  assert.ok(app.includes("$('unitInspector').dataset.grade = career.grade"));
  assert.ok(app.includes('const progress = progressionSummary(snapshot?.merit || 0)'));
  assert.ok(app.includes('modifiers: snapshot?.modifiers || progress.modifiers'));
  assert.doesNotMatch(app, /soldier\.career\s*=/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
test('Home keeps Play and Watch on the existing validatable setup form and Continue initially hidden',()=>{
  const html=read('index.html');
  const hub=html.match(/<section class="arena-launch home-hub"[\s\S]*?<\/section>/)?.[0]??'';
  assert.match(hub,/<h1 id="arenaLaunchTitle">Arena<\/h1>/);
  assert.match(hub,/<span class="v6-meta">1v1<\/span> <span class="v6-meta">Squads<\/span>/);
  assert.match(hub,/<button type="submit" form="lobby" data-launch="play">/);
  assert.match(hub,/<button type="submit" form="lobby" data-launch="watch">/);
  assert.match(hub,/<button type="button" id="homeContinue" class="hub-continue" hidden>/);
  assert.match(hub,/href="#entry">Setup/);assert.match(hub,/href="\.\/backup\.html">Saves/);
  assert.match(html,/<section id="entry"[^>]*tabindex="-1"/);
  assert.match(html,/id="rankDialog"/);assert.match(html,/href="\.\/moba\.html">MOBA/);
  assert.doesNotMatch(hub,/players online|status: online|season\s+\d|Customize match/i);
});
test('Home wiring uses the same current-save read guard and existing launch relay',()=>{
  const arcade=read('arcade.js'), relay=read('pit-v3-ui.js');
  assert.match(arcade,/homeContinue\?\.addEventListener\('click', \(\) => resumeRun\(\)\)/);
  assert.match(arcade,/homeContinue\.hidden = !savedCareer/);
  assert.match(arcade,/function resumeRun[\s\S]+?const raw = rawArenaSave\(\);[\s\S]+?if \(!savedCareer/);
  assert.match(relay,/event\.submitter\?\.dataset\.launch/);
});
test('Home CSS covers narrow and coarse desktop-width portrait and explicitly hides missing saves',()=>{
  const css=read('pit-v5-home.css');
  assert.match(css,/max-width:760px/);assert.match(css,/pointer:coarse.*orientation:portrait.*max-width:1180px/);
  assert.match(css,/hub-continue\[hidden\]\{display:none\}/);
  assert.match(css,/min-height:44px/);assert.match(css,/prefers-reduced-motion:reduce/);
});
test('Only v6 screens ship: old Classic and How to Play addresses land on the v6 home',()=>{
  for(const old of ['classic.html','guide.html'])assert.match(read(old),/^<!doctype html><meta charset="utf-8"><title>LOOMEN<\/title><meta http-equiv="refresh" content="0;url=\.\/index\.html">/);
  for(const page of ['index.html','gauntlet.html','tournament.html','moba.html','backup.html','idle-rpg.html','style-lab.html','credits.html'])
    assert.doesNotMatch(read(page),/href="\.?\/?(?:classic|guide|animation-lab)\.html|style\.css/,page);
  assert.doesNotMatch(readFileSync(new URL('../dist/arcade-v6-shell.js',import.meta.url),'utf8'),/classic\.html|guide\.html/);
});

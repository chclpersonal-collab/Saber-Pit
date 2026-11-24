import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSettingsSession} from '../dist/arcade-settings-session.js';
const file=(name:string)=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
test('Settings only owns a live round it pauses, and resumes at most once',()=>{
  const session=createSettingsSession(),a={},b={};
  assert.equal(session.begin(a,false),true);
  assert.equal(session.close(a,true,false),true);
  assert.equal(session.close(a,true,false),false);
  assert.equal(session.begin(a,true),false);
  assert.equal(session.close(a,true,false),false);
  assert.equal(session.begin(null,false),false);
  assert.equal(session.close(a,true,false),false);
  assert.equal(session.begin(a,false),true);
  assert.equal(session.close(b,true,false),false);
  assert.equal(session.begin(a,false),true);
  assert.equal(session.close(a,true,true),false);
  assert.equal(session.begin(a,false),true);session.background();
  assert.equal(session.close(a,true,false),false);
});
test('joined markup keeps 150%, camera and native settings, with no duplicate setup select',()=>{
  const html=file('index.html'), arcade=file('arcade.js'), setup=file('pit-v3-ui.js');
  for(const id of ['settingsOpen','pauseSettings','settingsDialog','cameraView','arenaHudText','sound','motion','touchLayout','touchSide','keysDialog'])
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))??[]).length,1,id);
  assert.match(html,/data-hud-text="150" aria-pressed="false">150%/);
  assert.match(html,/settingsDialog[\s\S]*data-touch-layout="stick"[\s\S]*data-touch-side="left"/);
  assert.doesNotMatch(html,/<summary>Readability<\/summary>/);
  assert.match(arcade,/simVisible = !paused && !settingsDialog\?\.open/);
  assert.match(arcade,/keysFromSettings = true;\s*keysPanel\.open\(\)/);
  assert.match(arcade,/if \(settingsDialog\.open\) \{\s*syncSettings\(\);\s*document\.getElementById\('settingsKeys'\)\?\.focus/);
  assert.match(setup,/firstInvalid[\s\S]+?details\.reverse\(\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(p:string)=>readFileSync(new URL('../dist/'+p,import.meta.url),'utf8');
test('fight skin is loaded last and keeps the controls available without duplicate handlers',()=>{
  const index=file('index.html'), css=file('pit-v5-fight.css'),script=file('arcade.js');
  assert.match(index,/<link rel="stylesheet" href=".\/pit-v5-fight.css\?v=[^"]+"><\/head>/);
  for(const id of ['cameraView','settingsOpen','pauseSettings','resultSettings','statsButton','gameFullscreen','techFold','chosenTechnique','useTechnique','quickTechnique','settingsDialog','statsPage'])
    assert.equal(index.match(new RegExp('id="'+id+'"','g'))?.length,1,id);
  assert.match(script,/pauseView\.append\(pauseCamera, \$\('gameFullscreen'\)\)/);
  assert.match(script,/\$\('chosenTechnique'\)\.addEventListener\('change',[\s\S]*?removeAttribute\('open'\)/);
  assert.match(index,/<button[^>]+id="quickTechnique"[^>]+data-action="technique"/);
  assert.match(css,/#quickTechnique\{grid-area:tech/);
  assert.match(css,/#cameraView\{display:none\}/);
  assert.match(css,/:not\(\[data-opened=hold\]\)/);
  assert.match(css,/--btn:clamp\(44px/);
});

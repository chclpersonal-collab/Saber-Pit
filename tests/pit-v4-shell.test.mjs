import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const read=file=>readFile(new URL('../dist/'+file,import.meta.url),'utf8');
test('play and watch launch shortcuts target the exact validated match form',async()=>{
 const html=await read('index.html');
 assert.match(html,/form="lobby" data-launch="play"/);
 assert.match(html,/form="lobby" data-launch="watch"/);
 assert.match(html,/id="lobby"/);
 assert.match(html,/nav class="pit-nav" aria-label="Game modes"/);
 assert.match(html,/VERSION 4\.00\.0/);
 const participation={value:'play'};
 let submit;
 const form={querySelector:()=>null,addEventListener:(name,fn,capture)=>{
   assert.equal(name,'submit');assert.equal(capture,true);submit=fn;
 }};
 runInNewContext(await read('pit-v3-ui.js'),{document:{getElementById:id=>id==='lobby'?form:participation}});
 const launch=mode=>submit({submitter:mode?{dataset:{launch:mode}}:null});
 launch('watch');assert.equal(participation.value,'watch');
 launch();assert.equal(participation.value,'watch');
 launch('play');assert.equal(participation.value,'play');
 participation.value='play-mixed';launch('play');assert.equal(participation.value,'play-mixed');
});

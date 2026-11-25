import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const read=(f)=>readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const startup=html.match(/<script>\s*\(\(\) => \{[\s\S]*?<\/script>/)?.[0]?.replace(/^<script>|<\/script>$/g,'');
function harness({ready=true,good=true,view='menu'}={}){
 assert.ok(startup,'Startup controller is in the Arena document');
 const result={gate:true,inert:true,boot:{hidden:false},retry:{hidden:true},status:{textContent:'Loading arena…'},frame:null,timeout:null};
 const body={dataset:{v6:'home',view},hasAttribute:()=>result.gate,removeAttribute:()=>{result.gate=false;}};
 const elements={loomenBoot:result.boot,loomenBootStatus:result.status,loomenBootRetry:result.retry,
  app:{removeAttribute:(name)=>{if(name==='inert')result.inert=false;}},v6Home:ready?{}:null};
 let settle,fail,loaded=Promise.resolve();
 const entry=new Promise((r,j)=>{settle=r;fail=j;});
 runInNewContext(startup.replace(/import\(['"][^'"]+['"]\)/,'loadEntry()'),{
  document:{body,getElementById:(id)=>elements[id]},loadEntry:()=>entry,
  requestAnimationFrame:(cb)=>{result.frame=cb;},setTimeout:(cb)=>{result.timeout=cb;return 1;},clearTimeout:()=>{}
 });
 result.complete=async()=>{good?settle():fail(Error('module load rejected'));await loaded;await loaded;};
 return result;
}
test('the first HTML frame is purple and the legacy Arena is hidden and inert, without JS',()=>{
 assert.match(html,/<body[^>]+data-loomen-boot[^>]*>[\s\S]*?<section id="loomenBoot"[\s\S]*?<main id="app" inert aria-hidden="true">/);
 assert.match(html,/<style>[\s\S]*?body\[data-loomen-boot\] #app[\s\S]*?visibility:hidden!important[\s\S]*?<\/style>[\s\S]*?<link rel="stylesheet"/);
 assert.match(html,/Enable JavaScript to open the arena/);
});
test('timeout does not reveal the legacy app and a successful v6 still replaces the loader',async()=>{
 const h=harness();
 h.timeout();
 assert.equal(h.retry.hidden,false);
 assert.equal(h.gate,true);
 assert.equal(h.inert,true);
 await h.complete();
 assert.equal(h.gate,true);
 h.frame();
 assert.equal(h.gate,false);
 assert.equal(h.boot.hidden,true);
 assert.equal(h.inert,false);
});
test('blocked boot and shell-not-mounted boot keep the older layout hidden and offer retry',async()=>{
 for(const options of [{good:false},{ready:false},{view:'game'}]){
  const h=harness(options);
  await h.complete();
  h.frame?.();
  assert.equal(h.gate,true);
  assert.equal(h.inert,true);
  assert.equal(h.retry.hidden,false);
  assert.match(h.status.textContent,/couldn’t finish loading/);
 }
});
test('game state discovery precedes engine initialization; compat-form setup binds once',()=>{
 const entry=read('arcade-sync-entry.js');
 assert.equal((entry.match(/import ['"].*pit-v3-ui/g)??[]).length,1);
 assert.ok(entry.indexOf('await syncBeforeGame()')<entry.indexOf("await import('./arcade.js"));
 assert.ok(entry.indexOf("await import('./arcade.js")<entry.indexOf("await import('./arcade-v6-shell.js"));
 assert.doesNotMatch(html,/<script[^>]*src="[^"]*pit-v3-ui/);
});

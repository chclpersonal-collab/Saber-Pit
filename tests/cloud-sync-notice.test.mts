import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {promptIfNeeded} from '../dist/cloud-sync-browser.js';

class Anchor{
 id='';href='./backup.html';title='';textContent='Saves';dataset:Record<string,string>={};style={cssText:''};
 onclick:((e:{preventDefault():void})=>void)|null=null;
 owner:{items:Anchor[]}|null=null;
 querySelector(){return null;}
 closest(){return this;}
 removeAttribute(k:string){if(k==='title')this.title='';}
 remove(){if(this.owner)this.owner.items=this.owner.items.filter(a=>a!==this);}
}
function fixture(hasHost:boolean){
 const body={items:[] as Anchor[],append(a:Anchor){a.owner=this;this.items.push(a);}};
 const host={items:[] as Anchor[],append(a:Anchor){a.owner=this;this.items.push(a);}};
 const saves=new Anchor();saves.title='Open Saves';let reloads=0;
 const dom={body,querySelector:()=>hasHost?host:null,
   getElementById:(id:string)=>[...body.items,...host.items].find(a=>a.id===id),
   querySelectorAll:(sel:string)=>sel.includes('cloud-original')?(saves.dataset.cloudOriginal===undefined?[]:[saves]):[saves,...body.items,...host.items].filter(a=>a.href==='./backup.html'),
   createElement:()=>new Anchor()};
 Object.defineProperty(globalThis,'document',{value:dom,configurable:true});
 Object.defineProperty(globalThis,'window',{value:{location:{href:'http://example.invalid/',reload:()=>reloads++}},configurable:true});
 return {body,host,saves,dom,reloads:()=>reloads};
}
const state={localDigest:null,cloudRevision:null,device:null,cloud:null} as const;

test('startup, offline/no signal, pending, fresh and conflict prompts remain safe and in the Arena setup host',()=>{
 const {body,host,saves,dom,reloads}=fixture(true);
 promptIfNeeded(undefined);assert.equal(host.items.length,0);
 promptIfNeeded({status:'error',error:'offline'});assert.equal(host.items.length,0);
 promptIfNeeded({status:'pending',...state});
 const notice=dom.getElementById('cloudSyncNotice')!;
 assert.equal(notice.textContent,'Save sync pending');assert.equal(notice.href,'./backup.html');
 assert.equal(host.items.length,1);assert.equal(body.items.length,0);assert.equal(notice.style.cssText,'');
 promptIfNeeded({status:'cloud-newer',canRefresh:true,...state});
 assert.equal(host.items.length,1);assert.equal(notice.textContent,'Reload to use newer save');
 let prevented=false;notice.onclick!({preventDefault:()=>{prevented=true;}});assert.ok(prevented);assert.equal(reloads(),1);
 promptIfNeeded({status:'conflict',...state});
 assert.equal(saves.textContent,'Saves');assert.equal(saves.title,'Open Saves');
 assert.equal(notice.onclick,null);assert.equal(notice.href,'./backup.html');assert.equal(notice.textContent,'Review save sync');
 promptIfNeeded({status:'current',...state});assert.equal(host.items.length,0);
 assert.equal(saves.textContent,'Saves');assert.equal(saves.title,'Open Saves');
});

test('non-Arena notice fallback remains actionable and never fixed; Arena mounts before setup presets only',()=>{
 const {body}=fixture(false);
 promptIfNeeded({status:'unlinked',...state});assert.equal(body.items[0].href,'./backup.html');
 assert.doesNotMatch(body.items[0].style.cssText,/position:fixed/);
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../dist/pit-v5-home.css',import.meta.url),'utf8');
 assert.match(html,/<form id="lobby"[\s\S]+data-cloud-notice-host role="status" aria-live="polite"[\s\S]+class="presets"/);
 assert.match(css,/body:not\(\[data-view=menu\]\) \.arena-sync-status\{display:none\}/);
});

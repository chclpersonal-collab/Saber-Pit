import test from 'node:test';
import assert from 'node:assert/strict';
import {activeArenaPreset,arenaSetupSummary,arenaSetupSummaryParts} from '../dist/arcade-setup-summary.js';
import {normalizeSetup,presets,saveSetup,loadSetup} from '../dist/arcade-setup.js';

test('summary reports fixed dimensions, applied per-side Force and distinct gender/appearance',()=>{
  const s=normalizeSetup({rule:'control',participation:'play',teamSizes:[1,3],mapId:'three_causeways',mapSize:'small',body:'woman',teamGenders:['female','mixed'],teamAppearances:['default','mixed'],forcePools:[['force_push'],['force_siphon','force_anchor']]});
  const summary=arenaSetupSummary(s);
  assert.deepEqual(arenaSetupSummaryParts(s).slice(1,5),['1v3','Control','Three Causeways','2400×1350']);
  assert.doesNotMatch(summary,/Small|Push/);
  assert.ok(arenaSetupSummaryParts(s).includes('Pink AI: Siphon, Anchor'));
  assert.deepEqual(arenaSetupSummaryParts(s).slice(-3),['Blue Female','Pink Mixed Look, Mixed Gender','Woman']);
  const saber=arenaSetupSummary(normalizeSetup({...s,saberOnly:true}));
  assert.match(saber,/Sabers Only/);assert.doesNotMatch(saber,/AI:|Siphon/);
  assert.ok(arenaSetupSummaryParts(normalizeSetup({startingForceFamily:['force_pulse','force_push']})).includes('Blue Pulse'));
});
test('each standard and Master preset is recognized after persistence, no false Hero Master preset',()=>{
  const values=new Map<string,string>();
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>void values.set(k,v)};
  for(const key of Object.keys(presets) as (keyof typeof presets)[]){
    assert.ok(saveSetup(normalizeSetup(presets[key]),storage));
    const loaded=loadSetup(storage);
    assert.deepEqual(Object.keys(presets).filter(k=>activeArenaPreset(loaded,k)),[key]);
    assert.equal(activeArenaPreset(loaded,'constructor'),false);
  }
  assert.equal(activeArenaPreset(normalizeSetup({...presets.master,heroPicks:[{id:'test-hero',slot:0}]}),'master'),false);
});

test('hidden validation reveals first invalid tab and nested disclosure without cancelling browser focus',async()=>{
  class NodeStub extends EventTarget{
    hidden=false;open=false;id='';parentElement:NodeStub|null=null;tabIndex=-1;role='';children:NodeStub[]=[];
    attributes=new Map<string,string>();
    contains(x:unknown):boolean{return x===this||this.children.some(item=>item.contains(x));}
    append(x:NodeStub){this.children.push(x);x.parentElement=this;}
    querySelector(){return tabs;}
    querySelectorAll(){return tabs.children;}
    getAttribute(k:string){return this.attributes.get(k)??null;}
    setAttribute(k:string,v:string){this.attributes.set(k,v);}
  }
  class DetailsStub extends NodeStub{}
  const form=new NodeStub(),outer=new DetailsStub(),tabs=new NodeStub();
  form.append(outer);outer.append(tabs);
  const docs:Record<string,NodeStub>={lobby:form};
  const fields=[0,1,2].map(i=>{
    const tab=new NodeStub(),panel=new NodeStub(),inner=new DetailsStub(),field=new NodeStub();
    tab.id='tab'+i;tab.setAttribute('aria-controls','panel'+i);tabs.append(tab);outer.append(panel);panel.append(inner);inner.append(field);
    docs['panel'+i]=panel;
    return {tab,panel,inner,field};
  });
  const values:Record<string,unknown>={document:{getElementById:(id:string)=>docs[id]??null},HTMLElement:NodeStub,HTMLDetailsElement:DetailsStub};
  const old=Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  for(const [k,v] of Object.entries(values))Object.defineProperty(globalThis,k,{value:v,configurable:true});
  try{
    await import('../dist/pit-v3-ui.js');
    assert.equal(fields[2].panel.hidden,true);
    const invalid=(target:NodeStub)=>{
      const event=new Event('invalid',{cancelable:true});Object.defineProperty(event,'target',{value:target});
      form.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
    };
    invalid(fields[2].field);invalid(fields[0].field);
    assert.equal(outer.open,true);assert.equal(fields[2].inner.open,true);assert.equal(fields[0].inner.open,false);assert.equal(fields[2].panel.hidden,false);
    await Promise.resolve();invalid(fields[0].field);
    assert.equal(fields[0].panel.hidden,false);assert.equal(fields[0].inner.open,true);
  }finally{for(const [k,p] of old)if(p)Object.defineProperty(globalThis,k,p);else Reflect.deleteProperty(globalThis,k);}
});

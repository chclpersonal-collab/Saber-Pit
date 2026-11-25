import test from 'node:test';
import assert from 'node:assert/strict';
import {engineForcePools,loadSetup,normalizeSetup,saveSetup} from '../dist/arcade-setup.js';
import {arenaLobbyRating} from '../dist/arcade-arena-rating-ui.js';
import {arenaNormalRanked} from '../dist/arcade-normal-elo.js';
import {readArcadeCareer,saveArcadeCareer} from '../dist/arcade-career.js';

function memoryStorage() {
  const values=new Map<string,string>();
  return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
}
test('per-side AI Force selections survive preferences and career save without expanding old saves',()=>{
  const store=memoryStorage();
  const setup=normalizeSetup({participation:'watch',teamSizes:[1,1],
    forcePools:[['force_anchor','unknown','force_push','force_anchor','force_pulse','force_burst'],['force_siphon']]});
  assert.deepEqual(setup.forcePools,[['force_anchor','force_push','force_pulse'],['force_siphon']]);
  assert.equal(saveSetup(setup,store),true);
  assert.deepEqual(engineForcePools(loadSetup(store)),setup.forcePools);
  assert.equal(saveArcadeCareer({mode:'watch',seed:17,round:3,setup},store),true);
  assert.deepEqual(engineForcePools(normalizeSetup(readArcadeCareer(store)?.setup)),setup.forcePools);
  assert.deepEqual(engineForcePools(normalizeSetup({startingForceFamily:['force_burst','force_pulse']})),[[],[]]);
});
test('only applied AI Force pools disable rating, and Saber only does not erase selections',()=>{
  const base=normalizeSetup({participation:'play',teamSizes:[1,1],forcePools:[['force_anchor'],[]]});
  assert.deepEqual(engineForcePools(base),[[],[]]);
  assert.equal(arenaLobbyRating('duel','elimination',[1,1],{},engineForcePools(base)).rated,true);
  const watch=normalizeSetup({...base,participation:'watch'});
  const options=engineForcePools(watch);
  assert.deepEqual(options,[['force_anchor'],[]]);
  assert.match(arenaLobbyRating('watch','elimination',[1,1],{},options).label,/Unrated.*Custom Force/);
  const fighters=[{id:'0-0',team:0},{id:'1-0',team:1}];
  assert.equal(arenaNormalRanked({mode:'watch',config:{rule:'elimination',teamSizes:[1,1],forcePools:options},fighters}),false);
  assert.deepEqual(engineForcePools(normalizeSetup({...watch,saberOnly:true})),[[],[]]);
  assert.deepEqual(normalizeSetup({...watch,saberOnly:true}).forcePools,watch.forcePools);
});

test('eight Force cards use ordered add/remove; fourth pick, clear at zero and no-Blue-AI are safe no-ops',async()=>{
  const {createArenaForcePicker,MIXED_FORCE_TRIO}=await import('../dist/arcade-force-picker.js');
  const {ARCADE_FORCE_POOL}=await import('../dist/arcade-force-pool.js');
  class Stub extends EventTarget{
    dataset:Record<string,string>={}; children:Stub[]=[]; textContent=''; attrs=new Map<string,string>(); disabled=false;
    append(...nodes:Stub[]){this.children.push(...nodes);}
    setAttribute(name:string,value:string){this.attrs.set(name,value);}
    click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  }
  const prior=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>new Stub()},configurable:true});
  try{
    const calls:string[][]=[];
    const ui=createArenaForcePicker('Blue',pool=>{calls.push([...pool]);ui.render(pool,false);});
    const [summary,note,grid,actions,status]=(ui.element as unknown as Stub).children;
    const [mixed,clear]=actions.children;
    assert.equal(grid.children.length,8);
    for(const [i,card] of grid.children.entries())assert.equal(card.children[0].children[0].textContent,ARCADE_FORCE_POOL[i].label);
    const [push,burst,pulse,pull]=grid.children;
    ui.render([],false);clear.click();assert.equal(calls.length,0);assert.match(note.textContent,/Primary Force/);
    pulse.click();push.click();burst.click();pull.click();
    assert.deepEqual(calls.at(-1),['force_pulse','force_push','force_burst']);
    assert.equal(calls.length,3);assert.match(status.textContent,/Three selected/);
    assert.equal(pull.attrs.get('aria-disabled'),'true');assert.equal(push.attrs.get('aria-pressed'),'true');
    assert.equal(pulse.children[0].children[1].textContent,'1');
    assert.match(note.textContent,/unrated/);
    push.click();assert.deepEqual(calls.at(-1),['force_pulse','force_burst']);
    pull.click();assert.deepEqual(calls.at(-1),['force_pulse','force_burst','force_pull']);
    mixed.click();assert.deepEqual(calls.at(-1),MIXED_FORCE_TRIO);assert.equal(calls.length,6);
    ui.render(MIXED_FORCE_TRIO,true);clear.click();pulse.click();assert.equal(calls.length,6);
    assert.match(note.textContent,/No Blue AI/);assert.equal(summary.children[1].textContent,'3 / 3');
    ui.render(MIXED_FORCE_TRIO,false);clear.click();assert.deepEqual(calls.at(-1),[]);
  }finally{if(prior)Object.defineProperty(globalThis,'document',prior);else Reflect.deleteProperty(globalThis,'document');}
});

test('changing Pink picks keeps Blue order through human-only preview, Sabers only and reload',async()=>{
  const {toggleArenaForceCard}=await import('../dist/arcade-force-picker.js');
  const storage=memoryStorage();
  const prior=normalizeSetup({participation:'watch',teamSizes:[1,1],forcePools:[['force_anchor','force_push'],['force_echo_step']]});
  const pink=toggleArenaForceCard(prior.forcePools[1],'force_siphon');
  const now=normalizeSetup({...prior,forcePools:prior.forcePools.map((pool,side)=>side===1?pink:pool)});
  assert.equal(saveSetup(now,storage),true);
  const reload=loadSetup(storage);
  assert.deepEqual(reload.forcePools,[['force_anchor','force_push'],['force_echo_step','force_siphon']]);
  const humanBlue=normalizeSetup({...reload,participation:'play'});
  assert.deepEqual(engineForcePools(humanBlue),[[],pink]);
  const disabled=normalizeSetup({...humanBlue,saberOnly:true});
  assert.deepEqual(engineForcePools(disabled),[[],[]]);
  assert.deepEqual(disabled.forcePools,reload.forcePools);
  assert.deepEqual(engineForcePools(normalizeSetup({...disabled,saberOnly:false,participation:'watch'})),reload.forcePools);
});

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
  assert.match(arenaLobbyRating('watch','elimination',[1,1],{},options).label,/Unrated.*AI Force/);
  const fighters=[{id:'0-0',team:0},{id:'1-0',team:1}];
  assert.equal(arenaNormalRanked({mode:'watch',config:{rule:'elimination',teamSizes:[1,1],forcePools:options},fighters}),false);
  assert.deepEqual(engineForcePools(normalizeSetup({...watch,saberOnly:true})),[[],[]]);
  assert.deepEqual(normalizeSetup({...watch,saberOnly:true}).forcePools,watch.forcePools);
});

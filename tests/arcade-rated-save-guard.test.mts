import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_CAREER_KEY, commitArenaRound, readArcadeCareer, saveArcadeCareer} from '../dist/arcade-career.js';
import {createArcade} from '../dist/arcade-engine.js';
import {settleArcadeCareer} from '../dist/arcade-career.js';

function memory(){
 const raw=new Map<string,string>(); let n=0;
 return {getItem:(key:string)=>raw.get(key)??null,setItem:(key:string,val:string)=>{n++;raw.set(key,val);},writes:()=>n};
}
const settledSave={mode:'duel',seed:17,round:9,arenaRatings:{'0-0':1080,'1-0':1012}};
test('unrated large, uneven and Command finishes cannot replace the existing rated continuation',()=>{
 const storage=memory();
 assert.equal(saveArcadeCareer(settledSave,storage),true);
 const original=storage.getItem(ARCADE_CAREER_KEY);
 for(const [mode,teamSizes] of [['watch',[16,16]],['watch',[2,1]],['command',[3,3]]] as const){
  const game=createArcade({mode,seed:3,teamSizes:[...teamSizes]});
  game.phase='draw';
  const settled=settleArcadeCareer(game)!;
  assert.equal(settled.rated,false);
  assert.equal(commitArenaRound({mode,seed:99,round:2,careers:settled.careers},game.config,settled.rated,storage),'session-only');
  assert.equal(storage.getItem(ARCADE_CAREER_KEY),original);
 }
 assert.equal(storage.writes(),1);
 assert.equal(readArcadeCareer(storage)?.round,9);
});
test('legacy Command career still persists without rated history; rated and explicit saves remain available',()=>{
 const storage=memory(), legacy={mode:'command',seed:7,round:4,careers:{'0-0':{merit:510}}};
 assert.equal(saveArcadeCareer({...legacy,round:3},storage),true);
 assert.equal(commitArenaRound(legacy,{rule:'elimination',teamSizes:[3,3]},false,storage),'saved');
 assert.equal(readArcadeCareer(storage)?.round,4);
 assert.equal(commitArenaRound(settledSave,{rule:'elimination',teamSizes:[1,1]},true,storage),'saved');
 assert.equal(commitArenaRound({...settledSave,round:10},{rule:'elimination',teamSizes:[1,1]},true,storage),'saved');
 assert.equal(readArcadeCareer(storage)?.round,10);
 assert.equal(saveArcadeCareer(legacy,storage),true);
 assert.equal(readArcadeCareer(storage)?.round,4);
});

test('a stale rated tab cannot overwrite a newer write or revive a removed save',()=>{
 const storage=memory(), ranked={rule:'elimination',teamSizes:[1,1]};
 assert.equal(saveArcadeCareer(settledSave,storage),true);
 const stale={bytes:storage.getItem(ARCADE_CAREER_KEY)};
 const newer={...settledSave,seed:41,round:10,arenaRatings:{'0-0':1120,'1-0':1020}};
 assert.equal(commitArenaRound(newer,ranked,true,storage,stale),'saved');
 const current={bytes:storage.getItem(ARCADE_CAREER_KEY)};
 assert.equal(commitArenaRound({...settledSave,round:2},ranked,true,storage,stale),'conflict');
 assert.equal(storage.getItem(ARCADE_CAREER_KEY),current.bytes);
 assert.equal(readArcadeCareer(storage)?.round,10);
 assert.equal(commitArenaRound({...newer,round:11},ranked,true,storage,current),'saved');
 const deleted=memory();
 assert.equal(commitArenaRound(newer,ranked,true,deleted,current),'conflict');
 assert.equal(deleted.writes(),0);
});

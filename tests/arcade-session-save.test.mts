import assert from 'node:assert/strict';
import test from 'node:test';
import {exportArcadeBackup} from '../dist/arcade-backup.js';
import {ARCADE_CAREER_KEY,readArcadeCareer,persistArenaRound,saveArcadeCareer,settleArcadeCareer} from '../dist/arcade-career.js';
import {createArcade,stepArcade} from '../dist/arcade-engine-api.js';
import {CLOUD_SAVE_COMMITTED} from '../dist/cloud-save-commit.js';

test('completed novice and custom Force runs cannot write or dirty the stored rated career',t=>{
  const data=new Map<string,string>();
  let writes=0, dirty=0;
  const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{writes++;data.set(k,v);}};
  const priorWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage,dispatchEvent:(event:Event)=>{if(event.type===CLOUD_SAVE_COMMITTED)dirty++;}}});
  t.after(()=>{if(priorWindow)Object.defineProperty(globalThis,'window',priorWindow);else Reflect.deleteProperty(globalThis,'window');});
  const saved={mode:'duel',seed:205,round:8,careers:{'0-0':{merit:500}},arenaRatings:{'0-0':159.5}};
  assert.ok(saveArcadeCareer(saved,storage));
  const before=storage.getItem(ARCADE_CAREER_KEY);
  const backup=exportArcadeBackup(storage,{sections:['arena']}).bundle.sections.arena;
  for(const mode of ['novice','force','standard']){
    const game=createArcade({mode:'duel',seed:34,limit:45,teamSizes:[1,1],startingRanks:['F','E'],
      ...(mode==='force'?{forcePools:[[],['force_push','force_anchor']]}:{})});
    if(mode==='novice')game.config.novicePractice=true;
    for(let i=0;i<6000&&game.phase==='playing';i++)stepArcade(game,1/120);
    const result=settleArcadeCareer(game,{});assert.ok(result);
    const next={mode:'duel',seed:game.rng,round:2,careers:result.careers,arenaRatings:result.arenaRatings};
    assert.equal(result.rated,mode==='standard');
    assert.equal(persistArenaRound(next,game.config,storage),mode==='standard');
    if(mode!=='standard'){
      assert.equal(storage.getItem(ARCADE_CAREER_KEY),before);
      assert.equal(readArcadeCareer(storage)?.arenaRatings['0-0'],159.5);
      assert.deepEqual(exportArcadeBackup(storage,{sections:['arena']}).bundle.sections.arena,backup);
      assert.deepEqual([writes,dirty],[1,1]);
    }else assert.deepEqual([writes,dirty],[2,2]);
  }
});

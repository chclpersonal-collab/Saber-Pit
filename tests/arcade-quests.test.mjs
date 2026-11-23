import test from 'node:test';
import assert from 'node:assert/strict';
import {BELL_QUEST,QUEST_STORAGE_KEY,loadQuests,saveQuests,deployQuest,retryQuest,claimQuest,questStatus,resolveQuest,recordQuestResult} from '../dist/arcade-quests.js';
import {resolveQuestEncounter} from '../dist/arcade-quest-encounter.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const hero={id:'arcade-1',name:'Chunori',body:'woman',gender:'female',form:'makashi'};
const equipped={...hero,gear:{weapon:'dual',grip:'backhand',dualPhase:true,forceFamily:'force_pulse'},
  profile:{bouts:7,lastDoctrine:'defensive',loadouts:{last:{move:'mk_stop_hit'}}}};
const fresh=(who=equipped,now=1000)=>{
  const disk=memory(),state=loadQuests(disk);return {disk,state,run:deployQuest(state,who.id,[who],now)};
};
test('a Saved Hero starts one fixed 10-second preparation and actual duel snapshot',()=>{
  const disk=memory(),state=loadQuests(disk);
  assert.equal(deployQuest(state,'bad',[hero],1000),null);
  assert.equal(questStatus(state,1000).phase,'idle');
  const run=deployQuest(state,equipped.id,[equipped],1000);
  assert.equal(BELL_QUEST.level,1);assert.equal(run.duelAt,11000);assert.equal(run.doneAt,run.duelAt+BELL_QUEST.duelMs);
  assert.equal(run.encounter.hero.weapon,'dual');assert.equal(run.encounter.hero.grip,'backhand');
  assert.equal(run.encounter.hero.preferredMove,'mk_stop_hit');assert.equal(run.encounter.hero.doctrine,'defensive');
  assert.deepEqual(run.hero,hero);assert.notEqual(state.run.hero,hero);
  assert.equal(questStatus(state,10999).phase,'preparing');
  assert.equal(questStatus(state,11000).phase,'fighting');
  assert.equal(questStatus(state,run.doneAt).phase,'finished');
  assert.equal(resolveQuest(state,run.doneAt-1),null);
  assert.equal(claimQuest(state,run.doneAt),null);
  assert.equal(deployQuest(state,hero.id,[hero],1001),null);
});
test('offline completion resolves actual battle; stale tabs and fabricated wins are rejected',()=>{
  const {disk,state,run}=fresh();
  assert.equal(saveQuests(state,disk),true);
  const resumed=loadQuests(disk),stale=loadQuests(disk);
  const expected=resolveQuestEncounter(run.encounter);
  assert.ok(expected);
  assert.equal(recordQuestResult(resumed,expected,run.duelAt),null);
  const fake={...expected,status:expected.status==='won'?'lost':'won',winnerIndex:expected.status==='won'?1:0};
  assert.equal(recordQuestResult(resumed,fake,run.doneAt),null);
  const finished=resolveQuest(resumed,run.doneAt);
  assert.equal(finished.result.status,expected.status);
  assert.deepEqual(finished.result.kills,expected.kills);
  assert.equal(saveQuests(resumed,disk),true);
  assert.equal(saveQuests(stale,disk),false);
  assert.deepEqual(loadQuests(disk).run,resumed.run);
  if(expected.status==='won'){
    assert.equal(questStatus(resumed,run.doneAt).phase,'ready');
    assert.ok(claimQuest(resumed,run.doneAt));
    assert.equal(claimQuest(resumed,run.doneAt+1),null);
    assert.equal(retryQuest(resumed,[hero],run.doneAt+1),null);
  }else{
    assert.equal(claimQuest(resumed,run.doneAt),null);
    assert.ok(retryQuest(resumed,[hero],run.doneAt+1));
    assert.equal(resumed.run.attempt,2);assert.notEqual(resumed.run.encounter.seed,run.encounter.seed);
    assert.equal(saveQuests(resumed,disk),true);
  }
});
test('legacy claimed seals and in-progress initial timing survive migration',()=>{
  const disk=memory(),legacy={id:BELL_QUEST.id,hero,startedAt:1000,doneAt:46000,claimedAt:null};
  disk.setItem(QUEST_STORAGE_KEY,JSON.stringify({version:1,run:legacy}));
  const migrated=loadQuests(disk);
  assert.equal(migrated.run.doneAt,46000);assert.deepEqual(migrated.run.hero,hero);
  assert.equal(migrated.run.encounter.hero.weapon,'single');
  assert.equal(questStatus(migrated,46000).phase,'finished');
  assert.ok(saveQuests(migrated,disk));
  disk.setItem(QUEST_STORAGE_KEY,JSON.stringify({version:1,run:{...legacy,claimedAt:50000}}));
  const seal=loadQuests(disk);
  assert.equal(questStatus(seal,100000).phase,'claimed');
  assert.equal(seal.run.encounter,null);assert.equal(seal.run.claimedAt,50000);
  assert.equal(deployQuest(seal,hero.id,[hero],100000),null);
});
test('malformed state and blocked storage fail safely',()=>{
  const {disk,state}=fresh();
  disk.setItem(QUEST_STORAGE_KEY,'<bad>');
  assert.equal(loadQuests(disk).run,null);
  state.run.doneAt=2000;
  assert.equal(saveQuests(state,disk),false);
  assert.equal(claimQuest(state,60000),null);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(loadQuests(blocked).run,null);
  assert.equal(saveQuests(loadQuests(null),blocked),false);
});

test('authentic live settlement can claim or retry at actual end before nominal cap',()=>{
  const win=fresh(hero,1001), loss=fresh({...hero,form:'shii_cho'},98317);
  for(const stage of [win,loss])assert.equal(saveQuests(stage.state,stage.disk),true);
  const a=resolveQuestEncounter(win.run.encounter), b=resolveQuestEncounter(loss.run.encounter);
  assert.equal(a.status,'won');assert.equal(b.status,'lost');
  for(const [entry,result] of [[win,a],[loss,b]]){
    const end=entry.run.duelAt+Math.ceil(result.elapsed*1000);
    assert.ok(end<entry.run.doneAt);
    assert.equal(recordQuestResult(entry.state,result,end-1),null);
    assert.ok(recordQuestResult(entry.state,result,end));
    assert.ok(saveQuests(entry.state,entry.disk));
    const stale=loadQuests(entry.disk);
    if(result.status==='won'){
      assert.ok(claimQuest(entry.state,end));
      assert.ok(saveQuests(entry.state,entry.disk));
      assert.equal(saveQuests(stale,entry.disk),false);
    }else{
      assert.ok(retryQuest(entry.state,[hero],end));
      assert.ok(saveQuests(entry.state,entry.disk));
      assert.equal(saveQuests(stale,entry.disk),false);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudSync} from '../dist/arcade-cloud-sync.js';
import * as backup from '../dist/arcade-backup.js';
import {loadQuests,deployQuest,saveQuests,saveIdleQuestCampaign,QUEST_STORAGE_KEY} from '../dist/arcade-quests.js';
import {emptyIdleCampaign,deployIdleCampaign,advanceIdleCampaign} from '../dist/arcade-idle-campaign.js';
const hero={id:'saved-1',name:'Hanei Ulgon',body:'femboy',gender:'male',form:'makashi',weapon:'single'};
const storage=()=>{const d=new Map();return {getItem:k=>d.get(k)??null,setItem:(k,v)=>d.set(k,v),removeItem:k=>d.delete(k)};};
const now=100_000;
test('old dispatch, campaign and portable backup coexist; stale campaign write loses',()=>{
 const disk=storage(),old=loadQuests(disk);
 assert.ok(deployQuest(old,hero.id,[hero],now));
 const empty=emptyIdleCampaign(),started=deployIdleCampaign(empty,hero.id,[hero],now);
 assert.equal(saveIdleQuestCampaign(started,empty,disk),true);
 assert.equal(saveQuests(old,disk),true);
 assert.equal(loadQuests(disk).campaign.revision,1);
 const current=loadQuests(disk).campaign,next=advanceIdleCampaign(current,now+500_000);
 assert.equal(saveIdleQuestCampaign(next,current,disk),true);
 assert.equal(saveIdleQuestCampaign(next,current,disk),false);
 const exported=backup.exportArcadeBackup(disk);
 assert.equal(exported.ok,true,exported.error);
 const inspection=backup.inspectArcadeBackup(exported.text),other=storage();
 assert.equal(backup.restoreArcadeBackup(inspection,other).ok,true);
 assert.deepEqual(loadQuests(other),loadQuests(disk));
 assert.equal(loadQuests(other).run.hero.name,hero.name);
 const broken=structuredClone(inspection.bundle);
 broken.sections.quest.campaign.run.waves[0].dueAt=-1;
 assert.equal(backup.inspectArcadeBackup(JSON.stringify(broken)).ok,false);
});
test('linked sync treats campaign-only saves as progress and pauses before sending a rollback',async()=>{
 const disk=storage(),empty=emptyIdleCampaign();
 assert.ok(saveIdleQuestCampaign(deployIdleCampaign(empty,hero.id,[hero],now),empty,disk));
 let remote=null,writes=0;
 const sync=createCloudSync({storage:disk,backup,preserve:async()=>true,transport:{
  async read(){return remote;},async write({bundle}){writes++;return remote={bundle,revision:String(writes)};},
 }});
 assert.equal((await sync.sync({action:'enable'})).status,'uploaded');
 disk.setItem(QUEST_STORAGE_KEY,JSON.stringify({version:2,run:null}));
 assert.equal((await sync.sync()).status,'reset');
 assert.equal(writes,1);
});

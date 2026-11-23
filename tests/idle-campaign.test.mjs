import test from 'node:test';
import assert from 'node:assert/strict';
import {BELL_WAVES,IDLE_PATROL_CAP,IDLE_PATROL_INTERVAL_MS,emptyIdleCampaign,normalizeIdleCampaign,
  idleCampaignStatus,deployIdleCampaign,advanceIdleCampaign,claimIdleCampaign,collectIdleCampaignPatrol,
  idleCampaignUpgradeCost,upgradeIdleCampaignHero,createIdleWaveReplay} from '../dist/arcade-idle-campaign.js';
import {stepQuestEncounter,questEncounterResult} from '../dist/arcade-quest-encounter.js';
const hero={id:'hero-test',name:'Test Saved',form:'makashi',elo:1650};
const origin=1000, late=origin+36e6;
const initial=emptyIdleCampaign();
const deployed=deployIdleCampaign(initial,hero.id,[hero],origin);
const completed=advanceIdleCampaign(deployed,late);

test('only supplied saved Heroes can deploy; timestamps gate the three waves',()=>{
  assert.equal(deployIdleCampaign(initial,'missing',[hero],origin),initial);
  assert.equal(deployIdleCampaign(deployed,hero.id,[hero],origin),deployed);
  assert.equal(idleCampaignStatus(deployed,origin).phase,'preparing');
  const first=deployed.run.waves[0];
  assert.equal(idleCampaignStatus(deployed,first.startedAt).phase,'fighting');
  assert.equal(advanceIdleCampaign(deployed,first.dueAt-1),deployed);
  const next=advanceIdleCampaign(deployed,first.dueAt);
  assert.equal(next.run.waves[0].result.status,'won');
  assert.equal(next.run.waves.length,2);
  assert.equal(next.run.waves[1].startedAt,first.dueAt+5000);
  assert.equal(completed.attempts,1);
  assert.deepEqual(completed.run.waves.map(w=>w.result.status),['won','won','lost']);
  assert.equal(completed.revision,2);
  assert.equal(advanceIdleCampaign(completed,late*10),completed);
  assert.equal(claimIdleCampaign(deployed,late),deployed);
  assert.equal(completed.wallet,0);
  assert.equal(BELL_WAVES.length,3);
});

test('offline and watched deterministic engine runs have the same final result',()=>{
  for(const w of completed.run.waves){
    const replay=createIdleWaveReplay(w.descriptor);
    while(replay.game.phase==='playing')stepQuestEncounter(replay.game,0.25);
    const result=questEncounterResult(replay.game);
    assert.deepEqual({...result,elapsed:Math.round(result.elapsed*1e6)/1e6},w.result);
  }
  const normalized=normalizeIdleCampaign(JSON.parse(JSON.stringify(completed)));
  assert.deepEqual(normalized,completed);
  const changed=structuredClone(completed);
  changed.run.waves[1].descriptor.seed^=1;
  assert.equal(normalizeIdleCampaign(changed),null);
  assert.ok(JSON.stringify(completed).length<15000);
});

test('supplies claim once, spend on selected Hero, and upgrade real replay gear',()=>{
  const claimed=claimIdleCampaign(completed,late);
  assert.equal(claimed.wallet,55);
  assert.equal(claimed.clears,0);
  assert.equal(claimIdleCampaign(claimed,late+10000),claimed);
  assert.equal(idleCampaignUpgradeCost(claimed,hero.id),20);
  const upgraded=upgradeIdleCampaignHero(claimed,hero.id,[hero],late);
  assert.equal(upgraded.wallet,35);
  assert.equal(upgradeIdleCampaignHero(upgraded,hero.id,[hero],late),upgraded);
  assert.equal(upgradeIdleCampaignHero(claimed,hero.id,[],late),claimed);
  const next=deployIdleCampaign(upgraded,hero.id,[hero],late+1);
  const game=createIdleWaveReplay(next.run.waves[0].descriptor).game;
  assert.equal(game.fighters[0].gear.saberQuality,'improved');
  assert.equal(game.fighters[0].gear.forceQuality,'standard');
  assert.equal(createIdleWaveReplay(completed.run.waves[0].descriptor).game.fighters[0].gear.saberQuality,'standard');
  assert.equal(normalizeIdleCampaign(next).revision,5);
});

test('passive patrol starts after a genuine wave win, capped, and collection is non-duplicative',()=>{
  const first=deployed.run.waves[0];
  const unlocked=advanceIdleCampaign(deployed,first.dueAt);
  assert.equal(idleCampaignStatus(unlocked,first.dueAt).patrolReward,0);
  const t=first.dueAt+IDLE_PATROL_INTERVAL_MS;
  assert.equal(idleCampaignStatus(unlocked,t).patrolReward,1);
  const one=collectIdleCampaignPatrol(unlocked,t);
  assert.equal(one.wallet,1);
  assert.equal(collectIdleCampaignPatrol(one,t),one);
  const rest=collectIdleCampaignPatrol(one,late);
  assert.equal(rest.wallet,IDLE_PATROL_CAP);
  assert.equal(idleCampaignStatus(rest,late).patrolCap,true);
  assert.equal(collectIdleCampaignPatrol(rest,late*10),rest);
  assert.deepEqual(normalizeIdleCampaign(rest),rest);
});

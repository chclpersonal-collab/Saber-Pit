import test from 'node:test';
import assert from 'node:assert/strict';
import * as duel from '../dist/arcade-tournament.js';
import * as squad from '../dist/squad-tournament.js';
import * as quest from '../dist/arcade-quests.js';
import {BACKUP_FORMAT,MAX_BACKUP_BYTES,exportArcadeBackup,inspectArcadeBackup,restoreArcadeBackup} from '../dist/arcade-backup.js';
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const win=()=>({winnerIndex:0,kills:[1,0],deaths:[0,1],time:10,reason:'elimination'});
function progress(disk){
  const a=duel.startTournament(duel.loadTournament(disk),{seed:48});
  const winner=duel.nextTournamentBout(a).fighterIds[0];
  duel.runTournamentStep(a,win);const hero=duel.saveTournamentHero(a,winner);
  duel.setTournamentHeroElo(a,winner,827,'D');duel.setTournamentHeroGender(a,winner,'nonbinary');duel.saveTournament(a,disk);
  const b=squad.startSquadTournament(squad.loadSquadTournament(disk),{seed:19});
  squad.runSquadStep(b,win);squad.saveSquadTournament(b,disk);
  const q=quest.loadQuests(disk);
  quest.deployQuest(q,hero.id,[hero],123456);quest.saveQuests(q,disk);
}
test('portable backup round-trip preserves Heroes, separate peaks, active brackets and quest',()=>{
  const original=store(), restored=store();progress(original);
  const blob=exportArcadeBackup(original,{now:new Date('2026-11-23T12:00:00Z')});
  assert.ok(blob.ok,blob.error);
  assert.equal(blob.bundle.format,BACKUP_FORMAT);
  const inspected=inspectArcadeBackup(blob.text);
  assert.ok(inspected.ok,inspected.error);
  assert.equal(inspected.summary.duel.heroes,1);
  assert.equal(inspected.summary.quest.attempts,1);
  assert.ok(inspected.summary.duel.peaks>0&&inspected.summary.squad.peaks>0);
  assert.ok(restoreArcadeBackup(inspected,restored).ok);
  assert.deepEqual(duel.loadTournament(restored),duel.loadTournament(original));
  assert.deepEqual(squad.loadSquadTournament(restored),squad.loadSquadTournament(original));
  assert.deepEqual(quest.loadQuests(restored),quest.loadQuests(original));
});
test('selection replaces included keys only, and rejects damaged or unsupported files',()=>{
  const source=store(), target=store();progress(source);
  target.setItem(duel.TOURNAMENT_KEY,'existing solo');
  target.setItem('unrelated:preferences','untouched');
  const inspected=inspectArcadeBackup(exportArcadeBackup(source).text);
  assert.ok(restoreArcadeBackup(inspected,target,{sections:['quest']}).ok);
  assert.equal(target.getItem(duel.TOURNAMENT_KEY),'existing solo');
  assert.equal(target.getItem(squad.SQUAD_TOURNAMENT_KEY),null);
  assert.equal(target.getItem('unrelated:preferences'),'untouched');
  assert.equal(inspectArcadeBackup('x'.repeat(MAX_BACKUP_BYTES+1)).ok,false);
  assert.equal(inspectArcadeBackup('{').ok,false);
  assert.equal(inspectArcadeBackup(JSON.stringify({...inspected.bundle,sections:{malicious:{}}})).ok,false);
  const broken=structuredClone(inspected.bundle);
  const first=Object.values(broken.sections.duel.records)[0];first.form='invalid';
  assert.equal(inspectArcadeBackup(JSON.stringify(broken)).ok,false);
  const partial=inspectArcadeBackup(exportArcadeBackup(source,{sections:['squad']}).text);
  assert.deepEqual(Object.keys(partial.summary),['squad']);
  assert.equal(restoreArcadeBackup(partial,target,{sections:['duel']}).ok,false);
});
test('failed multi-section write rolls back earlier changes and never touches unrelated saves',()=>{
  const source=store(), target=store();progress(source);
  const first=duel.TOURNAMENT_KEY, second=squad.SQUAD_TOURNAMENT_KEY;
  target.setItem(first,'before');target.setItem('other','never');
  const inspected=inspectArcadeBackup(exportArcadeBackup(source).text);
  const unstable={...target,setItem(key,value){if(key===second)throw Error('Quota');target.setItem(key,value);}};
  const result=restoreArcadeBackup(inspected,unstable);
  assert.equal(result.ok,false);assert.equal(result.rollback,true);
  assert.equal(target.getItem(first),'before');
  assert.equal(target.getItem(second),null);
  assert.equal(target.getItem(quest.QUEST_STORAGE_KEY),null);
  assert.equal(target.getItem('other'),'never');
});

test('a portable file preserves Arena Elo and progressed Gauntlet independently',async()=>{
  const {ARCADE_CAREER_KEY,saveArcadeCareer,readArcadeCareer}=await import('../dist/arcade-career.js');
  const {GAUNTLET_KEY,startGauntlet,nextGauntletBout,recordGauntletBout,saveGauntlet,loadGauntlet}=await import('../dist/gauntlet-tournament.js');
  const source=store(),target=store();
  const arena={mode:'watch',round:9,seed:148132,careers:{'0-0':{merit:401},'1-0':{merit:680}},
    arenaRatings:{'0-0':153.5,'1-0':144.5},setup:{teamSizes:[1,1],rule:'elimination'},
    records:{teams:[{kills:2},{kills:3}],soldiers:[{id:'0-0',kills:2},{id:'1-0',kills:3}]}};
  assert.ok(saveArcadeCareer(arena,source));
  let gauntlet=startGauntlet(undefined,{seed:777});
  const id=nextGauntletBout(gauntlet).id;
  gauntlet=recordGauntletBout(gauntlet,id,{winnerIndex:0,time:9,reason:'elimination'});
  assert.equal(gauntlet.active.bouts.length,1);
  assert.ok(saveGauntlet(gauntlet,source));
  const blob=exportArcadeBackup(source,{sections:['arena','gauntlet']});
  assert.ok(blob.ok,blob.error);
  const checked=inspectArcadeBackup(blob.text);
  assert.ok(checked.ok,checked.error);
  assert.deepEqual(checked.summary.arena,{label:'Arena run',round:9,fighters:2,ratedFighters:2});
  target.setItem(ARCADE_CAREER_KEY,'previous arena');
  assert.ok(restoreArcadeBackup(checked,target,{sections:['gauntlet']}).ok);
  assert.equal(target.getItem(ARCADE_CAREER_KEY),'previous arena');
  assert.deepEqual(loadGauntlet(target),loadGauntlet(source));
  assert.equal(loadGauntlet(target).active.lastFixture.id,id);
  assert.ok(restoreArcadeBackup(checked,target,{sections:['arena']}).ok);
  assert.deepEqual(readArcadeCareer(target),readArcadeCareer(source));
  assert.equal(readArcadeCareer(target).arenaRatings['0-0'],153.5);
  assert.deepEqual(readArcadeCareer(target).records,arena.records);
  assert.ok(target.getItem(GAUNTLET_KEY));
  const unsafe=structuredClone(checked.bundle);
  unsafe.sections.arena.arenaRatings['0-24']=300;
  assert.match(inspectArcadeBackup(JSON.stringify(unsafe)).error,/invalid Elo ratings/);
  delete unsafe.sections.arena.arenaRatings['0-24'];
  unsafe.sections.gauntlet.active.bouts[0].id='unrecognized match';
  assert.match(inspectArcadeBackup(JSON.stringify(unsafe)).error,/invalid progress/);
});

test('pre-Elo Arena files migrate without inventing ratings or overwriting other sections',async()=>{
 const {ARCADE_CAREER_KEY,readArcadeCareer}=await import('../dist/arcade-career.js');
 const target=store();
 target.setItem(quest.QUEST_STORAGE_KEY,'leave untouched');
 const file={format:BACKUP_FORMAT,version:1,sections:{arena:{version:1,mode:'duel',round:3,seed:5,careers:{'0-0':{merit:7}}}}};
 const inspected=inspectArcadeBackup(JSON.stringify(file));
 assert.ok(inspected.ok,inspected.error);
 assert.equal(inspected.summary.arena.ratedFighters,0);
 assert.ok(restoreArcadeBackup(inspected,target).ok);
 assert.equal(target.getItem(quest.QUEST_STORAGE_KEY),'leave untouched');
 assert.deepEqual(readArcadeCareer(target).arenaRatings,{});
 assert.equal(readArcadeCareer(target).round,3);
 assert.ok(target.getItem(ARCADE_CAREER_KEY));
});

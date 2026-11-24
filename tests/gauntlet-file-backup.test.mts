import test from 'node:test';
import assert from 'node:assert/strict';
import {exportArcadeBackup,inspectArcadeBackup,restoreArcadeBackup} from '../dist/arcade-backup.js';
import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,startGauntlet} from '../dist/gauntlet-tournament.js';
import {TOURNAMENT_KEY,loadTournament,saveTournament,startTournament} from '../dist/arcade-tournament.js';

function storage(){
  const map=new Map();
  return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
test('Gauntlet can move between devices via validated files without replacing other careers',()=>{
  const first=storage(), second=storage();
  const solo=startTournament(loadTournament(second),{seed:899});
  assert.equal(saveTournament(solo,second),true);
  const untouched=second.getItem(TOURNAMENT_KEY);
  const gauntlet=startGauntlet(loadGauntlet(first),{seed:342,limit:90});
  assert.equal(saveGauntlet(gauntlet,first),true);
  const file=exportArcadeBackup(first);
  assert.equal(file.ok,true);
  assert.deepEqual(Object.keys(file.bundle.sections),['gauntlet']);
  assert.equal(file.bundle.sections.gauntlet.season,1);
  const imported=inspectArcadeBackup(file.text);
  assert.equal(imported.summary.gauntlet.records,16);
  assert.equal(restoreArcadeBackup(imported,second).ok,true);
  assert.deepEqual(loadGauntlet(second),loadGauntlet(first));
  assert.equal(second.getItem(TOURNAMENT_KEY),untouched);
  assert.ok(second.getItem(GAUNTLET_KEY));
  const remote=exportArcadeBackup(second,{sections:['duel','squad','quest']});
  assert.deepEqual(Object.keys(remote.bundle.sections),['duel']);
  const modified=structuredClone(file.bundle);
  modified.sections.gauntlet.active.groups[0][0]='missing-fighter';
  assert.equal(inspectArcadeBackup(JSON.stringify(modified)).ok,false);
});

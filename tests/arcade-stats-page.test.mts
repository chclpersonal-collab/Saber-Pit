import test from 'node:test';
import assert from 'node:assert/strict';
import {readArcadeCareer} from '../dist/arcade-career.js';
import {statsView} from '../dist/arcade-stats-page.js';
const store=(data:unknown)=>({getItem:()=>JSON.stringify(data)});
test('stats page reads saved ranks and Arena Elo without inventing numbers',()=>{
  assert.equal(statsView(null),null);
  const save=readArcadeCareer(store({version:1,mode:'squad',round:14,seed:1,
    careers:{'0-0':{merit:900},'0-1':{merit:0},'1-0':{merit:40}},arenaRatings:{'0-0':168.5,'1-0':152}}));
  const view=statsView(save)!;
  assert.equal(view.round,14);assert.equal(view.mode,'Squad');
  assert.equal(view.you?.id,'0-0');assert.equal(view.you?.elo,168.5);assert.equal(view.you?.rated,true);
  assert.deepEqual(view.teams.map(t=>t.map(f=>f.id)),[['0-0','0-1'],['1-0']]);
  assert.equal(view.teams[0][1]!.rated,false,'a fighter with no rated round shows no Elo');
  assert.equal(view.ratedCount,2);assert.equal(view.best?.id,'0-0');
});
test('watch runs have no "you" on the stats page',()=>{
  const view=statsView(readArcadeCareer(store({version:1,mode:'watch',round:2,seed:1,careers:{'0-0':{merit:0}},arenaRatings:{}})))!;
  assert.equal(view.you,null);assert.equal(view.mode,'Showdown');assert.equal(view.best,null);
});

test('controlled slot follows the saved lineup; no training, Elo or Hero data is fabricated',()=>{
  const saved=readArcadeCareer(store({version:1,mode:'squad',round:7,seed:2,setup:{playerSlot:2},
    careers:{'0-0':{merit:0},'0-2':{merit:1e6}},arenaRatings:{'0-0':100,'1-0':172.5},
    heroLineup:{'0-2':{name:'PRIVATE HERO',adaptation:{secret:'PRIVATE ADAPT'}}}}));
  const view=statsView(saved)!;
  assert.equal(view.you?.id,'0-2');
  assert.equal(view.you?.elo,null);
  assert.equal(view.you?.rank,'SSS+ V');
  assert.equal(view.teams[1][0]?.elo,172.5);
  assert.equal(view.teams[1][0]?.rank,null);
  assert.equal(view.ratedCount,2,'recorded base Elo 100 is a real saved rating');
  assert.doesNotMatch(JSON.stringify(view),/PRIVATE|adaptation|heroLineup/);
  const command=readArcadeCareer(store({...saved,mode:'command'}));
  assert.equal(statsView(command)?.you,null);
});

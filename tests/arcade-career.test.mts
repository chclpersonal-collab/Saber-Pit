import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_CAREER_KEY, classicCareers, readArcadeCareer, saveArcadeCareer, settleArcadeCareer} from '../dist/arcade-career.js';
test('classic career import is read-only and keeps the exact ranks of matching positions',()=>{
 const classic={careers:[[{merit:5200},{merit:1150},{merit:800},{merit:35}],[{merit:0}]]};
 const importRanks=classicCareers(classic);
 assert.deepEqual(importRanks,{'0-0':{merit:5200},'0-1':{merit:1150},'0-2':{merit:800},'0-3':{merit:35},'1-0':{merit:0}});
 importRanks['0-0'].merit=0;assert.equal(classic.careers[0][0].merit,5200);
});
test('round settlement awards actual contribution once and continues original ladder',()=>{
 const game={phase:'playing',fighters:[{id:'0-0',team:0,hp:3,career:{merit:35},stats:{damage:100,kills:1}},{id:'1-0',team:1,hp:0,career:{merit:0},stats:{damage:100}}]};
 assert.equal(settleArcadeCareer(game),null);game.phase='won';
 const report=settleArcadeCareer(game);assert.equal(report.report[0].reward,54);
 assert.equal(report.careers['0-0'].merit,89);assert.equal(report.report[1].reward,14);
 assert.strictEqual(settleArcadeCareer(game),report);
});
test('Arcade saves use a separate key and can resume a career',()=>{
 const items=new Map([['trenchline-campaign-v2','original']]);const storage={getItem:key=>items.get(key),setItem:(key,value)=>items.set(key,value)};
 assert.ok(saveArcadeCareer({mode:'duel',round:2,seed:33,careers:{'0-0':{merit:5200},'other':{merit:999}}},storage));
 assert.equal(items.get('trenchline-campaign-v2'),'original');assert.ok(items.has(ARCADE_CAREER_KEY));
 assert.deepEqual(readArcadeCareer(storage).careers,{'0-0':{merit:5200}});
});


test('a saved career retains all twenty-four Arcade roster positions',()=>{
 const items=new Map();const storage={getItem:key=>items.get(key),setItem:(key,value)=>items.set(key,value)};
 assert.ok(saveArcadeCareer({mode:'watch',round:2,seed:33,careers:{'0-23':{merit:5200},'1-24':{merit:999}}},storage));
 assert.deepEqual(readArcadeCareer(storage).careers,{'0-23':{merit:5200}});
});

test('an in-progress run migrates its saved Hero rating once without removing its profile',()=>{
 const hero={id:'f-bell',name:'The Bell',gender:'female',elo:2051,eloFloorGrade:'A'};
 const snapshot={version:1,mode:'watch',round:2,seed:17,heroLineup:{'0-0':hero}};
 let json=JSON.stringify(snapshot);
 const storage={getItem:()=>json,setItem:(_,value)=>{json=value;}};
 const loaded=readArcadeCareer(storage);
 assert.deepEqual(loaded.heroLineup['0-0'],{...hero,elo:625.5});
 assert.equal(loaded.round,2);
 assert.ok(saveArcadeCareer(loaded,storage));
 assert.deepEqual(readArcadeCareer(storage),loaded);
});

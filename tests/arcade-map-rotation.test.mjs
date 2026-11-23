import test from 'node:test';
import assert from 'node:assert/strict';
import * as solo from '../dist/arcade-tournament.js';
import * as squad from '../dist/squad-tournament.js';
import {TOURNAMENT_ROTATION_MAPS,tournamentFixtureTerrain} from '../dist/arcade-map-rotation.js';
const kv=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const catalog=[
 {name:'solo',start:solo.startTournament,next:solo.nextTournamentBout,run:solo.runTournamentStep,load:solo.loadTournament,
  save:solo.saveTournament,replayKey:'fighters',ids:'fighterIds',storeKey:solo.TOURNAMENT_KEY},
 {name:'squad',start:squad.startSquadTournament,next:squad.nextSquadBout,run:squad.runSquadStep,load:squad.loadSquadTournament,
  save:squad.saveSquadTournament,replayKey:'teams',ids:'teamIds',storeKey:squad.SQUAD_TOURNAMENT_KEY},
];
const all=a=>[...(a.qualifiers??[]),...(a.opening??[]),...a.rounds.flat()];
const draw={winnerIndex:null,kills:[0,0],deaths:[0,0],time:45,reason:'timeout'};
for(const c of catalog)test(c.name+' map deck is neutral, varies within each seeded cycle, and is immutable across reruns and replay reload',()=>{
 const disk=kv(), opts={seed:718,terrain:'rotation',limit:45};
 let a=c.start(c.load(disk),opts);
 assert.equal(a.active.terrain,'rotation');
 const order=all(a.active).map(f=>tournamentFixtureTerrain(a.active,f));
 assert.equal(order.length,23);
 for(let i=0;i+4<=order.length;i+=4)assert.deepEqual(order.slice(i,i+4).sort(),[...TOURNAMENT_ROTATION_MAPS].sort());
 const b=c.start(c.load(kv()),opts);
 assert.deepEqual(order,all(b.active).map(f=>tournamentFixtureTerrain(b.active,{id:f.id,teamIds:['new','unknown']})));
 const first=c.next(a);
 c.run(a,()=>draw);
 const retry=c.next(a);
 assert.equal(retry.terrain,first.terrain);assert.notEqual(retry.seed,first.seed);
 assert.deepEqual(retry[c.ids],[...first[c.ids]].reverse());
 c.run(a,s=>({winnerIndex:0,kills:[1,0],deaths:[0,1],time:6,reason:'elimination',
  replay:{ruleset:1,seed:s.seed,terrain:s.terrain,limit:s.limit,round:s.round,grade:s.grade,
    plans:[{doctrine:'balanced'},{doctrine:'balanced'}],[c.replayKey]:s[c.replayKey]}}));
 assert.equal(a.active.lastReplay.terrain,first.terrain);
 c.save(a,disk);
 a=c.load(disk);
 assert.equal(a.active.terrain,'rotation');assert.equal(a.active.lastReplay.terrain,first.terrain);
 assert.deepEqual(all(a.active).map(f=>tournamentFixtureTerrain(a.active,f)),order);
 const modified=JSON.parse(disk.getItem(c.storeKey));
 modified.active.lastReplay.terrain=TOURNAMENT_ROTATION_MAPS.find(m=>m!==first.terrain);
 disk.setItem(c.storeKey,JSON.stringify(modified));
 assert.equal(c.load(disk).active.lastReplay,null);
 const fixed=c.start(c.load(kv()),{seed:101,terrain:'ember_ring'});
 assert.ok(all(fixed.active).every(f=>tournamentFixtureTerrain(fixed.active,f)==='ember_ring'));
 assert.equal(c.next(fixed).terrain,'ember_ring');
});

/** Compare shipped 4.0 JS and the TypeScript-generated release at the same ticks. */
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const original=new URL('../dist/',import.meta.url);
const generated=new URL('../build/dist/',import.meta.url);
const at=async(root,file)=>import(new URL(file,root));
const fresh=()=>{
 const map=new Map();
 return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
};
const fighters=[
 {id:'sample-1',name:'Test A',form:'ataru',chessStyle:'knight',body:'rabbit',elo:1640},
 {id:'sample-2',name:'Test B',form:'soresu',chessStyle:'queen',body:'woman',elo:1650}
];
const teams=['left','right'].map((id,i)=>({id,name:id,
 fighters:Array.from({length:5},(_,n)=>({...fighters[(n+i)%2],id:id+n}))
}));
const load=async root=>Object.fromEntries(await Promise.all([
 ['engine','arcade-engine.js'],['duel','arcade-tournament-sim.js'],['squad','squad-tournament-sim.js'],
 ['gauntlet','gauntlet-tournament.js'],['gauntletSim','gauntlet-sim.js'],['rules','arcade-replay-rules.js'],
 ['idle','arcade-idle-campaign.js'],['quest','arcade-quests.js'],['backup','arcade-backup.js'],
].map(async([k,v])=>[k,await at(root,v)])));
function settle(game,step){
 let i=0;
 for(;i<Math.ceil(game.limit*120)+4&&game.phase==='playing';i++)step(game,1/120);
 assert.notEqual(game.phase,'playing');
 return {ticks:i,time:game.time,phase:game.phase,endReason:game.endReason,stats:game.stats,rng:game.rng,
   fighters:game.fighters.map(f=>({id:f.id,x:f.x,y:f.y,alive:f.alive,moves:f.moves})),events:game.events};
}
const hero={id:'hero-test',name:'Test Saved',form:'makashi',elo:1650};
const epoch=1000,late=36_001_000;
async function snapshot(api){
 const {engine,duel,squad,gauntlet,gauntletSim,rules,idle,quest,backup}=api;
 const current=engine.createArcade({mode:'watch',seed:84,limit:45,terrain:'crossroads',teamSizes:[3,3],
   startingRanks:['SSS+V','SSS+V'],continuousCombat:true,activeFootwork:true,stanceFlow:true});
 const descriptor={seed:21,fighters,grade:'SSS+V',limit:45,terrain:'underpit'};
 const group={teams,seed:316954,round:1,limit:45,terrain:'underpit'};
 const historical=await rules.arcadeReplayRules(219);
 const standalone=fresh();
 const gState=gauntlet.startGauntlet(gauntlet.loadGauntlet(standalone),{seed:1492,limit:30});
 const fixture=gauntlet.nextGauntletBout(gState);
 assert.ok(gauntlet.saveGauntlet(gauntlet.recordGauntletBout(gState,fixture.id,gauntletSim.simulateGauntlet(fixture)),standalone));
 // Create, settle and claim both kinds of reward exactly once.
 let campaign=idle.deployIdleCampaign(idle.emptyIdleCampaign(),hero.id,[hero],epoch);
 assert.ok(quest.saveIdleQuestCampaign(campaign,undefined,standalone));
 const commit=fn=>{const next=fn(campaign,late);assert.ok(quest.saveIdleQuestCampaign(next,campaign,standalone));campaign=next;};
 commit(idle.advanceIdleCampaign);
 commit(idle.claimIdleCampaign);
 commit(idle.collectIdleCampaignPatrol);
 assert.strictEqual(idle.claimIdleCampaign(campaign,late+1),campaign);
 assert.strictEqual(idle.collectIdleCampaignPatrol(campaign,late+1),campaign);
 assert.equal(campaign.wallet,87);
 const packed=backup.exportArcadeBackup(standalone,{now:new Date(late)});
 assert.ok(packed.ok,packed.error);
 return {
  arena:settle(current,engine.stepArcade),
  duel:settle(duel.createTournamentReplay({...descriptor,ruleset:duel.TOURNAMENT_REPLAY_RULESET}),engine.stepArcade),
  squad:settle(squad.createSquadReplay({...group,ruleset:squad.SQUAD_REPLAY_RULESET}),engine.stepArcade),
  old:settle(duel.createTournamentReplay({...descriptor,ruleset:2},undefined,historical.createArcade),historical.stepArcade),
  gauntlet:gauntletSim.simulateGauntlet(fixture), backup:packed.text,
 };
}
const [before,after]=await Promise.all([load(original),load(generated)]);
const a=await snapshot(before), b=await snapshot(after);
for(const k of Object.keys(a)){assert.deepEqual(b[k],a[k],k+' differed from v4.0 JavaScript');console.log(k+' parity: OK');}
for(const [target,text] of [[before,b.backup],[after,a.backup]]){
 const inspected=target.backup.inspectArcadeBackup(text), storage=fresh();
 assert.ok(inspected.ok,inspected.error);
 assert.ok(target.backup.restoreArcadeBackup(inspected,storage).ok);
 assert.equal(target.quest.loadQuests(storage).campaign.wallet,87);
 assert.equal(target.gauntlet.loadGauntlet(storage).active.cursor,1);
}
console.log('cross-version backup restore: OK');
for(const dir of (await readdir(original,{withFileTypes:true})).filter(d=>d.isDirectory()&&d.name.startsWith('arcade-rules-'))){
 const baseDir=new URL(dir.name+'/',original), buildDir=new URL(dir.name+'/',generated);
 const fileNames=await readdir(baseDir);
 assert.deepEqual(await readdir(buildDir),fileNames);
 for(const name of fileNames){
   const digest=async loc=>createHash('sha256').update(await readFile(new URL(name,loc))).digest('hex');
   assert.equal(await digest(buildDir),await digest(baseDir),dir.name+'/'+name+' was modified');
 }
}
console.log('archived replay engines: byte-identical');

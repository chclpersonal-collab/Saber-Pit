/** Compare shipped 4.0 JS and the TypeScript-generated release at the same ticks. */
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const original=new URL('../baseline/dist/',import.meta.url);
const generated=new URL('../dist/',import.meta.url);
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

// Check crowded fights at the same ticks, rather than just comparing the
// winner. Separation is order-dependent: resolving one pair can create a
// new overlap with a fighter that has not yet been visited.
const crowdFlags=Object.fromEntries(
 'perfectParryStamina continuousCombat anticipatingCombat arenaCuts activeFootwork styleTravel repertoireSupport styleChoreo peasantMotion exchangeVariety fluidFootwork eloReads stanceFlow liveEntry impactPhysics recoveryFlow balancePass closeChoice guardCounterplay minorMoves forceVariants weaponFlow expandedCombat circuitCuts ratingSkill customHeroTactics advancedArena'
 .split(' ').map(key=>[key,true]));
const crowdScenes=[
 {label:'24v24 seed 9',seed:9,terrain:'crossroads'},
 {label:'24v24 seed 29',seed:29,terrain:'crossroads'},
 {label:'24v24 packed wall',seed:29,terrain:'open',packed:true}
];
const crowdSnapshot=(game)=>JSON.stringify({
 tick:game.tick,time:game.time,rng:game.rng,eventId:game.eventId,
 stats:game.stats,objective:game.objective,phase:game.phase,events:game.events,
 fighters:game.fighters
},(_key,value)=>value instanceof Set?{set:[...value]}:value instanceof Map?{map:[...value]}:value);
const checkpoints=new Set([0,1,2,3,6,12,24,48,120,240,360,600]);
for(const {label,seed,terrain,packed} of crowdScenes){
 const spawn=({engine})=>{
  const game=engine.createArcade({mode:'watch',teamSizes:[24,24],limit:90,terrain,seed,
   startingRanks:['SSS+V','SSS+V'],chessStyles:['mixed','mixed'],...crowdFlags});
  if(packed){
   for(let i=0;i<game.fighters.length;i++){
    const fighter=game.fighters[i];
    const slot=i%24,side=Math.floor(i/24);
    fighter.x=game.bounds.minX+30+(slot%8)*18+side*5;
    fighter.y=game.bounds.minY+28+Math.floor(slot/8)*17+side*3;
    fighter.face=side?Math.PI:0;
   }
   assert.ok(game.fighters.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)));
  }
  return game;
 };
 const old=spawn(before),next=spawn(after);
 for(let tick=0;tick<=600;tick++){
  if(checkpoints.has(tick)){
   const digest=game=>createHash('sha256').update(crowdSnapshot(game)).digest('hex');
   assert.equal(digest(next),digest(old),label+' differed at tick '+tick);
  }
  if(tick<600){before.engine.stepArcade(old,1/120);after.engine.stepArcade(next,1/120);}
 }
 console.log(label+' parity: OK');
}
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

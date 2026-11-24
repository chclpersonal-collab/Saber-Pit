import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {arenaNormalRanked} from '../dist/arcade-normal-elo.js';
import {combatCallout} from '../dist/arcade-callouts.js';

function run(profile:'repeat'|'held'|'attack',opponentReads:boolean,obscured=false){
  const terrain=obscured?{solids:[{kind:'wall',x:466,y:0,width:36,height:640}]}:undefined;
  const g=createArcade({mode:'duel',seed:63,teamSizes:[1,1],opponentReads,startingRanks:['A','A'],
    form:'soresu',teamForms:[['soresu'],['shii_cho']],impactPhysics:true,guardCounterplay:true,terrain});
  const [p,e]=g.fighters;
  Object.assign(p,{x:425,y:320,face:0});Object.assign(e,{x:527,y:320,face:Math.PI});
  let last=0,guardEntries=0,held=false,slashes=0;
  const observations:{time:number;count:number}[]=[], feints:number[]=[];
  for(let i=0;i<1050&&g.phase==='playing';i++){
    const cycle=i%120, dx=e.x-p.x,dy=e.y-p.y,dist=Math.max(1,Math.hypot(dx,dy));
    const guard=profile==='repeat'&&cycle>=28&&cycle<99||profile==='held'&&i>=28;
    const travel=i>24&&dist<80?-.6:dist>106?.66:0;
    stepArcade(g,1/120,{x:travel*dx/dist,y:travel*dy/dist,guard,aimX:e.x,aimY:e.y,strike:profile==='attack'&&cycle===30});
    if(p.action==='guard'&&!held&&p.parryTime>0)guardEntries++;
    held=p.action==='guard';
    for(const event of g.events)if(event.id>last){
      if(event.kind==='opponent_read')observations.push({time:event.time,count:Number((event as unknown as {observationCount:number}).observationCount)});
      if(event.fighterId===e.id&&event.kind==='feint')feints.push(event.time);
      if(event.fighterId===p.id&&event.duration&&event.technique?.startsWith('slash'))slashes++;
    }
    last=g.eventId;
  }
  return {g,guardEntries,observations,feints,slashes};
}
test('opt-in unrated player duel actually feints after repeated observed Guard, unlike the identical control',()=>{
  const a=run('repeat',true),b=run('repeat',false);
  assert.ok(a.guardEntries>=3&&b.guardEntries>=3);
  assert.equal(a.observations.length,1);
  assert.ok(a.observations[0].count>=3);
  assert.ok(a.feints.includes(a.observations[0].time),'only actual engine feints emit the cue');
  assert.ok(!b.feints.includes(a.observations[0].time));
  assert.equal(b.observations.length,0);
  assert.equal(arenaNormalRanked(a.g),false);
  assert.equal(arenaNormalRanked(b.g),true);
  assert.ok(combatCallout({id:1,kind:'opponent_read',fighterId:'1-0'})?.label);
});
test('a held Guard, committed attack spam, and repeated Guards through a wall are not evidence',()=>{
  const held=run('held',true), attack=run('attack',true), obscured=run('repeat',true,true);
  assert.equal(held.observations.length,0);
  assert.ok(attack.slashes>=3);assert.equal(attack.observations.length,0);
  assert.ok(obscured.guardEntries>=3);assert.equal(obscured.observations.length,0);
  assert.equal(createArcade({mode:'watch',teamSizes:[1,1],opponentReads:true}).config.opponentReads,undefined);
  assert.equal(createArcade({mode:'duel',teamSizes:[1,1],opponentReads:true,arenaRatingSkill:true}).config.opponentReads,undefined);
});

test('adaptive option is off by default and only eligible for regular human 1v1 Elimination',async()=>{
  const { normalizeSetup,canArenaAdaptiveSparring }=await import('../dist/arcade-setup.js');
  const { arenaLobbyRating }=await import('../dist/arcade-arena-rating-ui.js');
  const { commitArenaRound }=await import('../dist/arcade-career.js');
  const setup=normalizeSetup({participation:'play',rule:'elimination',teamSizes:[1,1]});
  assert.equal(setup.opponentReads,false);
  assert.equal(canArenaAdaptiveSparring(setup,{}),true);
  assert.equal(canArenaAdaptiveSparring({...setup,participation:'watch'},{}),false);
  assert.equal(canArenaAdaptiveSparring({...setup,teamSizes:[2,2]},{}),false);
  assert.equal(canArenaAdaptiveSparring({...setup,rule:'relic'},{}),false);
  assert.equal(arenaLobbyRating('duel','elimination',[1,1],{},undefined,false,false,true).rated,false);
  const inaccessible={getItem(){ throw new Error('should not read'); },setItem(){ throw new Error('should not write'); }};
  assert.equal(commitArenaRound({}, {opponentReads:true},false,inaccessible),'session-only');
});

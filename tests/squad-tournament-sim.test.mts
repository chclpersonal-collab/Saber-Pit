import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {createSquadReplay,playSquadBout,squadReplayWinner,SQUAD_SIM_TICK,SQUAD_REPLAY_RULESET} from '../dist/squad-tournament-sim.js';

const forms=['shii_cho','ataru','soresu','juyo','niman','makashi','djem_so'];
const fixture={seed:316954,round:1,limit:45,terrain:'underpit',teams:[0,1].map(i=>({
  id:'side-'+i,name:'Squad '+i,members:Array.from({length:5},(_,j)=>({
    id:'side-'+i+'-'+j,name:'Fighter '+i+j,form:forms[(i*5+j)%forms.length],body:j===1?'rabbit':'woman',
    gender:j===1?'nonbinary':'female',gear:j===3?{weapon:'dual',grip:'backhand',dualPhase:true}:undefined,
  })),
}))};
test('Squad replay uses ten independent SSS+V fighters without Hero save coupling',()=>{
  const game=createSquadReplay(fixture);
  assert.equal(game.mode,'watch'); assert.equal(game.config.rule,'elimination');assert.deepEqual(game.config.teamSizes,[5,5]);
  for(const fighter of game.fighters){
    const member=fixture.teams[fighter.team].members[fighter.slot];
    assert.equal(fighter.career.grade,'SSS+V');
    for(const key of ['form','body','gender'])assert.equal(fighter[key],member[key]);
    assert.equal(fighter.displayName,member.name);
    assert.equal(fighter.squadMemberId,member.id);assert.equal(fighter.heroId,undefined);
  }
  assert.equal(game.fighters[3].gear.weapon,'dual');
  assert.equal(game.fighters[3].gear.grip,'backhand');
  assert.equal(game.fighters[3].gear.dualPhase,true);
  assert.throws(()=>createSquadReplay({...fixture,teams:[fixture.teams[0]]}),TypeError);
});
test('a real 5v5 outcome, including K/D, is identical to fixed-tick serialized playback',()=>{
  const result=playSquadBout(fixture);
  assert.equal(result.replay.ruleset,SQUAD_REPLAY_RULESET);
  const game=createSquadReplay(JSON.parse(JSON.stringify(result.replay)));
  for(let t=0;t<=game.limit*120+3&&game.phase==='playing';t++)stepArcade(game,SQUAD_SIM_TICK);
  assert.equal(result.winnerIndex,squadReplayWinner(game));
  assert.equal(result.time,game.time);
  assert.equal(result.reason,game.endReason);
  assert.deepEqual(result.kills,game.stats.kills);
  assert.deepEqual(result.deaths,game.stats.deaths);
  assert.equal(result.members.flat().length,10);
  assert(result.time>0&&result.time<=game.limit+1e-8&&game.phase!=='playing');
});

test('a squad replay clock ignores which side the arcade engine judged ahead',()=>{
  assert.equal(squadReplayWinner({phase:'won',endReason:'timeout'}),null);
  assert.equal(squadReplayWinner({phase:'lost',endReason:'timeout'}),null);
  assert.equal(squadReplayWinner({phase:'lost',endReason:'elimination'}),1);
});

test('squad style assignments are fighter-ID stable on color swap, and rules 11 ignores all chess inputs',()=>{
  const live=createSquadReplay(fixture);
  const swapped=createSquadReplay({...fixture,teams:[...fixture.teams].reverse()});
  const byId=new Map(live.fighters.map(f=>[f.squadMemberId,f.chessStyle]));
  assert.equal(byId.size,10);
  for(const f of swapped.fighters){
    assert.equal(f.chessStyle,byId.get(f.squadMemberId));
    assert(['king','queen','rook','bishop','knight','pawn'].includes(f.chessStyle));
  }
  assert.equal(live.config.perfectParryStamina,undefined);
  const oldWithStyles={...fixture,ruleset:11,teams:fixture.teams.map(t=>({
    ...t,members:t.members.map(f=>({...f,chessStyle:'queen'})),
  }))};
  const legacy=createSquadReplay(oldWithStyles);
  assert(legacy.fighters.every(f=>!f.chessStyle));
});

test('rules 12 uses the exact saved style rather than deriving another style from the current ID',()=>{
  const archive={...fixture,ruleset:12,teams:fixture.teams.map(t=>({
    ...t,members:t.members.map((f,i)=>({...f,chessStyle:i%2?'bishop':'queen'})),
  }))};
  const game=createSquadReplay(archive);
  assert.deepEqual(game.fighters.map(f=>f.chessStyle),
    ['queen','bishop','queen','bishop','queen','queen','bishop','queen','bishop','queen']);
  assert.throws(()=>createSquadReplay({...fixture,ruleset:12}),TypeError);
});

test('earlier decisive play is confined to new ranked 5v5 and keeps archived or custom pacing',()=>{
  let liveConfig;
  const live=createSquadReplay(fixture,opts=>{liveConfig=opts;return createArcade(opts);});
  assert.equal(liveConfig.squadDecisive,true);
  assert(live.elitePacing.measuredUntil<.81);
  assert(live.elitePacing.fullAt<.91);
  const replay=playSquadBout(fixture).replay;
  const old=createSquadReplay({...replay,ruleset:29});
  assert.deepEqual(old.elitePacing,{active:true,stage:'measured',fullAt:.91,measuredUntil:.81});
  const duel=createArcade({mode:'watch',startingRanks:['SSS+V','SSS+V'],teamSizes:[1,1],squadDecisive:true});
  const arena=createArcade({mode:'watch',startingRanks:['SSS+V','SSS+V'],teamSizes:[5,5]});
  assert.deepEqual(duel.elitePacing,old.elitePacing);
  assert.deepEqual(arena.elitePacing,old.elitePacing);
});

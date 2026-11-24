import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BELL_GUARDIAN,createQuestEncounter,normalizeQuestEncounterDescriptor,questEncounterResult,
  QUEST_ENCOUNTER_LIMIT,resolveQuestEncounter,restoreQuestEncounter,stepQuestEncounter} from '../dist/arcade-quest-encounter.js';

const hero=(form='makashi',weapon='staff')=>({id:'hero-test',name:'Aurel of the Shore',form,grade:'F',body:'rabbit',gender:'female',
  gear:{weapon,grip:'backhand',dualPhase:true,forceFamily:'force_pulse'},elo:2590,doctrine:'aggressive',
  profile:{bouts:11,wins:7,lastDoctrine:'aggressive'}});
test('fixed guardian and preserved Saved Hero loadout are independent from lobby settings',()=>{
  const {game,descriptor}=createQuestEncounter(22,hero());
  assert.deepEqual(normalizeQuestEncounterDescriptor(descriptor),descriptor);
  assert.equal(game.mode,'watch');assert.equal(game.limit,QUEST_ENCOUNTER_LIMIT);
  assert.equal(game.config.rule,'elimination');
  const [p,g]=game.fighters;
  assert.equal(p.career.grade,'SSS+V');assert.equal(p.heroId,'hero-test');assert.equal(p.gear.weapon,'staff');
  assert.equal(p.body,'rabbit');assert.equal(p.gender,'female');assert.equal(p.heroAdaptation.bouts,11);
  assert.equal(g.career.grade,BELL_GUARDIAN.grade);assert.equal(g.displayName,BELL_GUARDIAN.name);assert.equal(g.heroId,undefined);
  assert.equal(restoreQuestEncounter({...descriptor,version:999}),null);
  assert.equal(restoreQuestEncounter({...descriptor,seed:2**40}),null);
  assert.equal(createQuestEncounter(1,{name:'Missing save ID'}),null);
});
test('120Hz headless resolution equals uneven real-time updates from the same serialized quest',()=>{
  const {game,descriptor}=createQuestEncounter(17,hero('djem_so','dual'));
  assert.equal(questEncounterResult(game),null);
  assert.equal(stepQuestEncounter(game,-1).time,0);
  const reload=restoreQuestEncounter(JSON.parse(JSON.stringify(descriptor)));
  for(let i=0;reload.game.phase==='playing'&&i<3500;i++)
    stepQuestEncounter(reload.game,[.004,.013,.021,.031,.012][i%5]);
  assert.deepEqual(questEncounterResult(reload.game),resolveQuestEncounter(descriptor));
  const final=questEncounterResult(reload.game);
  assert.equal(final.kills[0],final.deaths[1]);assert.equal(final.kills[1],final.deaths[0]);
  assert.ok(final.elapsed>0&&final.elapsed<=QUEST_ENCOUNTER_LIMIT+1e-7);
});
test('seeded duels naturally win, lose or reach a real draw without a fabricated KO',()=>{
  const outcome=new Map();
  for(const seed of [1,7,16]){
    const {descriptor}=createQuestEncounter(seed,hero('niman','single'));
    const r=resolveQuestEncounter(descriptor);outcome.set(r.status,r);
  }
  assert.equal(outcome.size,3);
  const draw=outcome.get('draw');
  assert.equal(draw.winnerIndex,null);assert.equal(draw.reason,'timeout');
  assert.deepEqual(draw.kills,[0,0]);assert.deepEqual(draw.deaths,[0,0]);
  assert.ok(Math.abs(draw.elapsed-QUEST_ENCOUNTER_LIMIT)<1e-7);
});
test('new quest uses two concrete saved chess styles while legacy quest playback stays neutral',()=>{
  const fresh=createQuestEncounter(17,hero());
  assert.equal(fresh.descriptor.version,19);
  assert.equal(fresh.game.config.impactPhysics,true);
  assert.equal(fresh.game.config.recoveryFlow,true);
  assert.equal(fresh.game.config.balancePass,true);
  assert.equal(fresh.game.config.closeChoice,true);
  assert.equal(fresh.game.config.guardCounterplay,true);
  assert.equal(restoreQuestEncounter({...fresh.descriptor,version:18}).game.config.guardCounterplay,undefined);
  assert.equal(restoreQuestEncounter({...fresh.descriptor,version:17}).game.config.closeChoice,undefined);
  assert.equal(restoreQuestEncounter({...fresh.descriptor,version:16}).game.config.balancePass,undefined);
  assert.equal(restoreQuestEncounter({...fresh.descriptor,version:15}).game.config.recoveryFlow,undefined);
  const previous=restoreQuestEncounter({...fresh.descriptor,version:14});
  assert.equal(previous.game.config.impactPhysics,undefined);
  assert.equal(previous.game.config.liveEntry,true);
  const recorded=fresh.descriptor.chessStyles;
  assert.equal(recorded.length,2);
  assert.ok(recorded.every(s=>['king','queen','rook','bishop','knight','pawn'].includes(s)));
  assert.deepEqual(restoreQuestEncounter(JSON.parse(JSON.stringify(fresh.descriptor))).game.fighters.map(f=>f.chessStyle),recorded);
  assert.equal(restoreQuestEncounter({...fresh.descriptor,chessStyles:['mixed',recorded[1]]}),null);
  const legacy=createQuestEncounter(17,hero(),{legacy:true});
  assert.equal(legacy.descriptor.version,1);
  assert.ok(legacy.game.fighters.every(f=>!f.chessStyle));
  assert.deepEqual(restoreQuestEncounter({...legacy.descriptor,chessStyles:recorded}).descriptor,legacy.descriptor);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {ARCADE_ARENA_CUTS} from '../dist/arcade-repertoire.js';
const dt=1/120, match={seed:117931,terrain:'underpit',teamSizes:[1,1]};
function attempt(move,arenaCuts,rank='SSS+V',form=move.form){
  const game=createArcade({...match,mode:'duel',teamForms:[form,'soresu'],startingRanks:[rank,'F'],arenaCuts});
  stepArcade(game,dt,{technique:move.id,aimX:800,aimY:320});
  const f=game.fighters[0];
  return {f,event:game.events.find(e=>e.fighterId===f.id&&e.technique===move.id&&e.contact>0)};
}
test('all fourteen actual cut specs require the opt-in, right form and attained rank',()=>{
  assert.equal(ARCADE_ARENA_CUTS.length,14);
  for(const move of ARCADE_ARENA_CUTS){
    assert.equal(attempt(move,false).event,undefined,move.id);
    assert.equal(attempt(move,true,'F').event,undefined,move.id);
    assert.equal(attempt(move,true,'SSS+V',move.form==='soresu'?'makashi':'soresu').event,undefined,move.id);
    const {f,event}=attempt(move,true);
    assert.equal(f.attack,move.id);assert.equal(f.action,move.mapAction);
    assert.ok(event.contact>0&&event.duration>event.contact,move.id);
    assert.equal(event.arenaCut,true);assert.equal(event.cutOpening,move.opening);
    assert.ok(event.attackFamily&&event.attackVariant,move.id);
    assert.equal(f.attackSpec.reach,move.reach);assert.equal(f.attackSpec.arc,move.arc);
  }
});
test('an ordinary manual Slash remains ordinary, and a timed recorded duel uses real named alternatives',()=>{
  const setup=arenaCuts=>createArcade({...match,mode:'watch',limit:45,teamForms:['shii_cho','ataru'],
    startingRanks:['SSS+V','SSS+V'],chessStyles:['king','bishop'],saberOnly:true,anticipatingCombat:true,continuousCombat:true,arenaCuts});
  const totals=[false,true].map(arenaCuts=>{
    const g=setup(arenaCuts),counts={};let last=0;
    while(g.phase==='playing'){
      stepArcade(g,.1);
      for(const e of g.events)if(e.id>last&&e.contact>0&&!e.offhand&&['slash','rush','sweep','uppercut'].includes(e.kind))
        counts[e.technique]=(counts[e.technique]??0)+1;
      last=g.eventId;
    }
    return {counts,total:Object.values(counts).reduce((a,b)=>a+b,0)};
  });
  const [a,b]=totals;
  assert.ok(b.counts.ac_sc_corner_cut>0||b.counts.ac_at_rebound_cut>0||b.counts.ac_at_corkscrew_entry>0);
  assert.ok((b.counts.slash??0)/b.total<(a.counts.slash??0)/a.total);
  const player=createArcade({...match,mode:'duel',teamForms:['shii_cho','ataru'],arenaCuts:true});
  stepArcade(player,dt,{strike:true});
  assert.equal(player.fighters[0].attack,'slash');
});

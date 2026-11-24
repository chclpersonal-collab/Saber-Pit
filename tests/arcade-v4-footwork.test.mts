import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {sampleArcadeFighter,sampleArcadeRenderRig,arcadeFeetWorld,arcadeBladeWorld} from '../dist/arcade-fighters.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function sampleFixture() {
  return createArcade({
    seed:1,mode:'watch',teamSizes:[3,3],startingRanks:['SSS+V','SSS+V'],
    teamForms:[['juyo','ataru','soresu'],['makashi','shii_cho','djem_so']],
    liveEntry:true,stanceFlow:true,peasantMotion:true,recoveryFlow:true,impactPhysics:true,
    fluidFootwork:true,weaponFlow:true,activeFootwork:true,anticipatingCombat:true,continuousCombat:true,
  });
}
test('v4 limits grounded render seams while preserving exact canonical staff/saber geometry',()=>{
  const game=sampleFixture(), previous=new Map();
  const steps=[];
  for(let i=0;i<120*8;i++){
    stepArcade(game,1/120);
    if(i%2)continue;
    for(const actor of game.fighters){
      if(!actor.alive)continue;
      const raw=sampleArcadeFighter(actor,game.time), rendered=sampleArcadeRenderRig(actor,raw,game.time);
      const rawBlades=arcadeBladeWorld(actor,raw), artBlades=arcadeBladeWorld(actor,rendered);
      // Existing authored visual handoffs may already differ between draws;
      // this final boot layer must not alter the actual engine rig it samples.
      assert.deepEqual(arcadeBladeWorld(actor,sampleArcadeFighter(actor,game.time)),rawBlades);
      assert.equal(artBlades.blades.length,rawBlades.blades.length);
      const feet=arcadeFeetWorld(actor,rendered), prior=previous.get(actor.id);
      if(raw.airPhase==='grounded'&&prior?.airPhase==='grounded')
        for(const boot of feet){const old=prior.feet.find(f=>f.side===boot.side);steps.push(distance(boot.foot,old.foot));}
      previous.set(actor.id,{feet,airPhase:raw.airPhase});
    }
  }
  const sharp=steps.filter(d=>d>8).length;
  assert.ok(steps.length>4000&&sharp/steps.length<.025,
    JSON.stringify({max:Math.max(...steps),sharp,samples:steps.length}));
  assert.ok(Math.max(...steps)<15);
});

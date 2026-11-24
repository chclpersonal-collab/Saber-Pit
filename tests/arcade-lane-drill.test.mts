import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
import {createArcadeTerrain} from '../dist/arcade-stage.js';
import {openAt} from '../dist/arcade-engine-geometry.js';
const common={mode:'watch',teamSizes:[16,16],width:1280,height:720,seed:19,impactPhysics:true};
test('16v16 drill placement is deterministic, actually separated and avoids authoritative terrain',()=>{
  for(const id of ['underpit','crossroads','high_bastion']){
    const options={...common,terrain:createArcadeTerrain(id,1280,720)};
    const base=createArcade(options),drill=createArcade({...options,laneDrill:true});
    assert.deepEqual(drill,createArcade({...options,laneDrill:true}));
    assert.equal(drill.config.laneDrill,true);
    assert.ok(drill.fighters.some((f,i)=>f.x!==base.fighters[i].x));
    assert.ok(drill.fighters.every(f=>openAt(drill,f.x,f.y,f.radius)));
    for(const f of drill.fighters)for(const other of drill.fighters)if(f!==other){
      assert.ok(Math.hypot(f.x-other.x,f.y-other.y)>=(f.team===other.team?37:205));
    }
  }
});
test('drill stays out of normal rated-size and manual matches through the same seeded input',()=>{
  for(const options of [{...common,teamSizes:[15,15],arenaRatingSkill:true},{...common,mode:'squad'},{...common,rule:'control'},{...common,startingForceFamily:['force_pulse','force_push']},{...common,startingRanks:['SSS+V','SSS+V']}]){
    const a=createArcade(options),b=createArcade({...options,laneDrill:true});
    for(let i=0;i<150;i++){stepArcade(a,1/120);stepArcade(b,1/120);}
    assert.deepEqual(a,b);
  }
});

test('spread toggle is default-off and narrow, and a settled drill never writes the canonical run',async()=>{
  const {normalizeSetup,canArenaLaneDrill}=await import('../dist/arcade-setup.js');
  const {commitArenaRound}=await import('../dist/arcade-career.js');
  const options={participation:'watch',teamSizes:[16,16],mapId:'underpit',startingRanks:['A','E']};
  assert.equal(normalizeSetup().laneDrill,false);
  assert.equal(canArenaLaneDrill(normalizeSetup(options),{}),true);
  assert.equal(canArenaLaneDrill(normalizeSetup({...options,teamSizes:[15,15]}),{}),false);
  assert.equal(canArenaLaneDrill(normalizeSetup({...options,participation:'play'}),{}),false);
  assert.equal(canArenaLaneDrill(normalizeSetup({...options,squadTactics:true}),{}),false);
  assert.equal(canArenaLaneDrill(normalizeSetup({...options,startingSaberWeapon:['greatsaber','single']}),{}),false);
  const drill=createArcade({...common,laneDrill:true});
  assert.equal(commitArenaRound({round:2},drill.config,false,{getItem:()=>null,setItem:()=>assert.fail()}),'session-only');
});

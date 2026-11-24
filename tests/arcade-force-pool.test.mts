import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_FORCE_POOL,chooseArcadeForcePool,normalizeArcadeForcePool} from '../dist/arcade-force-pool.js';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

const neutral={distance:100,energy:60,moving:false,guarded:false,targetEnergy:60,imminent:0,exposed:false,opponents:1,screened:false,warded:false,clearStep:true};
test('eight choices, normalized max three, and contextual selection never leaves the selected pool',()=>{
  assert.equal(ARCADE_FORCE_POOL.length,8);
  assert.deepEqual(normalizeArcadeForcePool(['unknown','force_anchor','force_anchor','force_pull','force_lattice','force_burst']),['force_anchor','force_pull','force_lattice']);
  const pick=(pool:Parameters<typeof chooseArcadeForcePool>[0],context={})=>chooseArcadeForcePool(pool,{...neutral,...context});
  assert.equal(pick(['force_burst','force_push','force_pulse'],{distance:85,opponents:2}),'force_burst');
  assert.equal(pick(['force_burst','force_push','force_pulse'],{distance:154}),'force_pulse');
  assert.equal(pick(['force_burst','force_push','force_pulse'],{distance:85,opponents:1}),'force_push');
  assert.equal(pick(['force_lattice','force_anchor'],{imminent:.52,moving:true}),'force_lattice');
  assert.equal(pick(['force_anchor','force_pull'],{moving:true}),'force_anchor');
  assert.equal(pick(['force_siphon','force_echo_step'],{guarded:true}),'force_echo_step');
  assert.equal(pick(['force_siphon','force_echo_step'],{guarded:true,clearStep:false}),undefined);
  assert.equal(pick(['force_pull','force_siphon'],{screened:true,exposed:true}),undefined);
  assert.equal(pick(['force_siphon'],{energy:2}),undefined);
});
test('empty and saber-only pools are baseline-identical for full seeded input traces',()=>{
  const context={mode:'watch',seed:192,teamSizes:[2,2],expandedCombat:true,startingForceFamily:['force_burst','force_pulse']};
  for(const saberOnly of [true,false]){
    const a=createArcade({...context,saberOnly});
    const b=createArcade({...context,saberOnly,forcePools:saberOnly?[['force_anchor'],['force_siphon']]:[[],['bogus']]});
    assert.equal(a.config.forcePools,undefined);assert.equal(b.config.forcePools,undefined);
    for(let i=0;i<550;i++){stepArcade(a,1/60);stepArcade(b,1/60);}
    assert.deepEqual(a,b);
  }
});
test('AI in seeded combat really releases multiple selected Force abilities, with no off-pool casts',()=>{
  const pools=[['force_pull','force_anchor','force_siphon'],['force_burst','force_pulse','force_push']];
  const s=createArcade({mode:'watch',seed:251,teamSizes:[2,2],forcePools:pools,expandedCombat:true,
    teamForms:[['ataru','niman'],['soresu','shii_cho']],startingRanks:['A','A'],limit:45});
  const casts=[new Set<string>(),new Set<string>()];
  const individual=new Map<string,Set<string>>();
  let last=0, utilityContacts=0;
  while(s.phase==='playing'){
    stepArcade(s,1/60);
    for(const e of s.events)if(e.id>last){
      if(e.kind==='force'&&e.duration)assert.ok(pools[e.team].includes(String(e.poolAbility)),String(e.technique));
      if(e.kind==='force_pool_release'){
        const move=String(e.poolAbility), fighter=String(e.fighterId);
        assert.ok(pools[e.team].includes(move));casts[e.team].add(move);
        const prior=individual.get(fighter)??new Set<string>();prior.add(move);individual.set(fighter,prior);
      }
      if(e.team===0&&(e.kind==='force_pull'&&e.forceAbility==='pull'||e.kind==='expanded_contact'&&['anchor','siphon'].includes(String(e.effect))))utilityContacts++;
    }
    last=s.eventId;
  }
  assert.ok(casts[0].size>=2,[...casts[0]].join(','));
  assert.ok(casts[1].size>=1,[...casts[1]].join(','));
  assert.ok([...individual.values()].some(pool=>pool.size>=2));
  assert.ok(utilityContacts>0);
});

test('each of all eight selectable abilities is released by real Arena AI',()=>{
  for(const {id} of ARCADE_FORCE_POOL){
    const s=createArcade({mode:'watch',seed:id==='force_echo_step'?3:1,teamSizes:[2,2],forcePools:[[id],[id]],expandedCombat:true,
      teamForms:[['ataru','niman'],['soresu','shii_cho']],startingRanks:['A','A'],limit:45});
    const released=()=>s.events.find(e=>e.kind==='force_pool_release'&&e.poolAbility===id);
    while(s.time<8&&s.phase==='playing'&&!released())stepArcade(s,1/60);
    assert.ok(released(),id);
  }
});

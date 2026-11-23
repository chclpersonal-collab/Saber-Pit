import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSetup,saveSetup,normalizeSetup,engineLineups,engineChessStyleOverrides,setupMode,setupPlayAs,playAsSetup,watchHeroSetup,lobbyHeroControl} from '../dist/arcade-setup.js';
test('setup clamps independent teams while keeping map and limit choices',()=>{
  const cfg=normalizeSetup({teamSizes:[-1,88],playerSlot:10,mapId:'craterfield',duration:150,rule:'relic',seed:''});
  assert.deepEqual(cfg.teamSizes,[1,24]);assert.equal(cfg.playerSlot,0);assert.equal(cfg.mapId,'craterfield');
  assert.equal(cfg.duration,150);assert.equal(cfg.rule,'relic');assert.equal(cfg.seed,null);assert.equal(setupMode(cfg),'squad');
});
test('player slot and team presets resolve without dropping per-fighter overrides',()=>{
  const cfg=normalizeSetup({teamSizes:[4,1],playerSlot:2,form:'soresu',groupForms:['makashi','juyo'],teamForms:[[null,'ataru']]});
  assert.deepEqual(engineLineups(cfg),[['makashi','ataru','soresu','makashi'],['juyo']]);
});
test('options survive reload and store no unrelated legacy data',()=>{
  const m=new Map();const store={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
  const cfg=normalizeSetup({rule:'control',mapId:'crossroads',teamSizes:[3,7],saberOnly:true});
  assert.equal(saveSetup(cfg,store),true);assert.deepEqual(loadSetup(store),cfg);
});

test('the master trial is one SSS+ V against fifteen F, and custom slots extend to 24',async()=>{
  const {presets}=await import('../dist/arcade-setup.js');
  const trial=normalizeSetup(presets.master);
  assert.equal(trial.participation,'watch');
  assert.deepEqual(trial.teamSizes,[1,15]);assert.deepEqual(trial.startingRanks,['SSS+V','F']);
  const large=normalizeSetup({teamSizes:[24,24],playerSlot:23,form:'ataru'});
  assert.equal(engineLineups(large)[0][23],'ataru');
});

test('the optional rabbit duelist persists without changing the human defaults',()=>{
  assert.equal(normalizeSetup().body,'femboy');
  assert.equal(normalizeSetup({body:'woman'}).body,'woman');
  assert.equal(normalizeSetup({body:'rabbit'}).body,'rabbit');
  assert.equal(normalizeSetup({body:'unrecognized'}).body,'femboy');
});

test('Fighter applies your Mixed or concrete form only to your slot; Watch and Command keep team presets',()=>{
  const raw={teamSizes:[3,2],playerSlot:1,form:'mixed',groupForms:['mixed','soresu'],
    teamForms:[[null,'ataru','makashi'],['mixed',null]]};
  const setup=normalizeSetup(raw);
  assert.equal(setup.form,'mixed');
  assert.deepEqual(engineLineups(setup),[['mixed','mixed','makashi'],['mixed','soresu']]);
  assert.deepEqual(engineLineups(normalizeSetup({...raw,form:'juyo'})),[['mixed','juyo','makashi'],['mixed','soresu']]);
  for(const participation of ['watch','command']){
    assert.deepEqual(engineLineups(normalizeSetup({...raw,form:'juyo',participation})),
      [['mixed','ataru','makashi'],['mixed','soresu']]);
  }
});

test('Play As exposes old Mixed setups and remembers the last fixed choice across Watch and reload',()=>{
  const fixed=normalizeSetup({participation:'play',form:'soresu'});
  const select=(value,prior)=>normalizeSetup({...prior,...playAsSetup(value,prior.fixedForm,prior)});
  const mixed=select('play-mixed',fixed);
  assert.equal(setupPlayAs(mixed),'play-mixed');
  assert.equal(mixed.participation,'play');
  assert.equal(mixed.fixedForm,'soresu');
  for(const mode of ['watch','command']){
    const observing=select(mode,mixed);
    assert.equal(setupPlayAs(observing),mode);
    assert.equal(observing.form,'mixed');
    assert.equal(select('play',observing).form,'soresu');
  }
  const data=new Map(),store={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)};
  assert(saveSetup(mixed,store));
  assert.equal(select('play',loadSetup(store)).form,'soresu');
  assert.equal(setupPlayAs(normalizeSetup({form:'mixed'})),'play-mixed');
});

test('Play As Mixed uses actual form rotation, and an assigned Hero keeps their own form',async()=>{
  const {createArcade}=await import('../dist/arcade-engine.js');
  const cfg=normalizeSetup({form:'mixed',teamSizes:[3,1],playerSlot:2});
  const game=(round,heroLineup)=>createArcade({...cfg,teamForms:engineLineups(cfg),mode:setupMode(cfg),round,heroLineup});
  const find=g=>g.fighters.find(a=>a.control);
  assert.notEqual(find(game(1)).form,find(game(2)).form);
  const hero={'0-2':{id:'saved-hero',name:'Saved Hero',form:'niman',body:'rabbit'}};
  for(const round of [1,2,3])assert.equal(find(game(round,hero)).form,'niman');
});

test('Watch a Hero prepares an AI-only elite challenge without editing the prior setup or roster',async()=>{
  const heroes=[{id:'test-one',name:'Test One'},{id:'test-two',name:'Test Two'}];
  const setup=normalizeSetup({participation:'play',form:'mixed',fixedForm:'soresu',mapId:'zigzag',duration:150,
    heroPicks:[{id:'test-two',slot:0},{id:'test-one',slot:1}]});
  const previous=structuredClone(setup);
  assert.equal(lobbyHeroControl(setup,0),'manual');
  assert.equal(lobbyHeroControl(setup,1),'ai');
  assert.equal(watchHeroSetup(setup,heroes,'missing'),null);
  assert.equal(watchHeroSetup(setup,[]),null);
  const next=watchHeroSetup(setup,heroes);
  assert.deepEqual(setup,previous);
  assert.equal(setupMode(next),'watch');
  assert.equal(lobbyHeroControl(next,0),'ai');
  assert.equal(lobbyHeroControl(next,1),null);
  assert.deepEqual(next.teamSizes,[1,3]);
  assert.deepEqual(next.startingRanks,['SSS+V','SSS+V']);
  assert.deepEqual([next.mapId,next.duration,next.form,next.fixedForm],['zigzag',150,'mixed','soresu']);
  assert.equal(next.heroPicks[0].id,'test-two');
  assert.equal(watchHeroSetup(setup,heroes,'test-one').heroPicks[0].id,'test-one');
  const {createArcade}=await import('../dist/arcade-engine.js');
  const game=createArcade({...next,mode:setupMode(next),teamForms:engineLineups(next),
    heroLineup:{'0-0':{...heroes[1],form:'niman'}}});
  assert.equal(game.fighters[0].heroId,'test-two');
  assert(game.fighters.every(f=>!f.control));
});

test('Arena Chess Style is per-side, always on and independent from forms and Heroes',async()=>{
  const {saveArcadeCareer,readArcadeCareer}=await import('../dist/arcade-career.js');
  const cfg=normalizeSetup({participation:'watch',teamSizes:[2,2],form:'juyo',
    groupForms:['soresu','ataru'],teamForms:[[null,'niman']],heroPicks:[{id:'saved-hero',slot:1}],
    chessStyles:['knight','mixed']});
  assert.deepEqual(normalizeSetup({}).chessStyles,['mixed','mixed']);
  assert.deepEqual(normalizeSetup({chessStyles:['unknown','queen','rook']}).chessStyles,['mixed','queen']);
  assert.deepEqual(cfg.chessStyles,['knight','mixed']);
  assert.deepEqual(engineLineups(cfg),[['soresu','niman'],['ataru','ataru']]);
  assert.deepEqual(watchHeroSetup(cfg,[{id:'saved-hero'}]).chessStyles,['knight','mixed']);
  const m=new Map(),store={setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)};
  assert(saveSetup(cfg,store));
  assert.deepEqual(loadSetup(store).chessStyles,cfg.chessStyles);
  assert(saveArcadeCareer({mode:'watch',round:4,seed:541,careers:{},setup:cfg},store));
  assert.deepEqual(normalizeSetup(readArcadeCareer(store).setup).chessStyles,cfg.chessStyles);
});

test('arena setup passes chess style to a saved Hero and gives Mixed side stable, varied styles',async()=>{
  const {createArcade}=await import('../dist/arcade-engine.js');
  const cfg=normalizeSetup({participation:'watch',teamSizes:[1,3],startingRanks:['SSS+V','F'],
    groupForms:['soresu','ataru'],chessStyles:['pawn','mixed']});
  const heroLineup={'0-0':{id:'saved-hero',name:'Saved Hero',form:'niman'}};
  const start=(setup,seed=714)=>createArcade({...setup,mode:setupMode(setup),teamForms:engineLineups(setup),seed,
    heroLineup,fighterChessStyles:engineChessStyleOverrides(setup,heroLineup)});
  const match=start(cfg),hero=match.fighters[0];
  assert.deepEqual([hero.heroId,hero.chessStyle,hero.form,hero.career.grade],['saved-hero','pawn','niman','SSS+V']);
  const enemies=match.fighters.filter(f=>f.team===1);
  assert.ok(enemies.every(f=>f.career.grade==='F'&&f.form==='ataru'&&f.chessStyle!=='mixed'));
  assert.equal(new Set(enemies.map(f=>f.chessStyle)).size,3);
  assert.deepEqual(start(normalizeSetup(JSON.parse(JSON.stringify(cfg)))).fighters.map(f=>f.chessStyle),
    match.fighters.map(f=>f.chessStyle));
  const {arcadeChessStyleForId}=await import('../dist/arcade-chess-styles.js');
  const migrated=normalizeSetup({...cfg,chessStyles:['none','none']});
  const expected=arcadeChessStyleForId('saved-hero');
  for(const seed of [711,712,713]){
    const match=start(migrated,seed);
    assert.ok(match.fighters.every(f=>f.chessStyle&&f.chessStyle!=='none'));
    assert.equal(match.fighters[0].chessStyle,expected);
  }
  const played=normalizeSetup({...migrated,participation:'play',heroPicks:[]});
  const fighter=start(played).fighters.find(f=>f.control);
  assert.ok(fighter?.chessStyle&&fighter.chessStyle!=='none');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaPatternRead,arenaReadSkill} from '../dist/arcade-elo-skill.js';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';

test('Arena rating 100 is neutral and higher rating improves actual repeated reads',()=>{
  const rookie=arenaReadSkill(100), peer=arenaReadSkill(1500), rated=arenaReadSkill(1600);
  assert.equal(rookie.decisionClock,1);
  assert.deepEqual(arenaReadSkill(NaN),rookie);
  assert.ok(rated.decisionClock<peer.decisionClock&&peer.decisionClock<rookie.decisionClock);
  const observed=['thrust','cut','cut','cut'].map(family=>({family}));
  assert.equal(arenaPatternRead(rookie,peer,'cut',observed),0);
  assert.equal(arenaPatternRead(rated,peer,'thrust',observed),0);
  assert.equal(arenaPatternRead(rated,peer,'cut',observed.slice(0,3)),0);
  assert.ok(arenaPatternRead(rated,peer,'cut',observed)>arenaPatternRead(peer,rated,'cut',observed));
});

test('Arena rating 100 has identical seeded timeline with option on/off',()=>{
  function run(arenaRatingSkill:boolean){
    const g=createArcade({arenaRatingSkill,mode:'watch',teamSizes:[1,1],seed:13,teamForms:['djem_so','makashi'],
      startingRanks:['SSS+V','SSS+V'],terrain:'underpit',limit:45,continuousCombat:true,fighterRatings:[[100],[100]]});
    for(let i=0;i<1800&&g.phase==='playing';i++)stepArcade(g,1/120);
    return {events:g.events,phase:g.phase,rng:g.rng,stats:g.stats,fighters:g.fighters.map(f=>[f.x,f.y,f.action,f.energy,f.injuries])};
  }
  assert.deepEqual(run(true),run(false));
});

test('only visible committed attacks enter a rated fighter history, once per serial',()=>{
  const setup=(screened:boolean)=>{
    const game=createArcade({mode:'duel',arenaRatingSkill:true,fighterRatings:[[1500],[1600]],teamSizes:[1,1],
      startingRanks:['SSS+V','SSS+V'],seed:72,terrain:'underpit'});
    const [player,rival]=game.fighters;
    Object.assign(player,{x:485,y:320,face:0});
    Object.assign(rival,{x:580,y:320,face:Math.PI,think:100,eliteReady:100});
    if(screened)game.terrain.solids.push({kind:'wall',x:530,y:275,width:12,height:90});
    stepArcade(game,1/120,{strike:true,aimX:rival.x,aimY:rival.y});
    for(let i=0;i<8;i++)stepArcade(game,1/120);
    return rival as typeof rival & {arenaPattern?:{patterns:{family:string}[]}};
  };
  assert.equal(setup(false).arenaPattern?.patterns.length,1);
  assert.equal(setup(true).arenaPattern,undefined);
});

test('fast rated reply actually commits an ordinary legal move into a real visible recovery',()=>{
  function response(rating:number,exposure:number){
    const g=createArcade({mode:'duel',arenaRatingSkill:true,fighterRatings:[[1500],[rating]],teamSizes:[1,1],
      startingRanks:['A','A'],teamForms:['makashi','makashi'],seed:5,terrain:'open'});
    g.terrain.solids.length=0;g.terrain.zones.length=0;
    const [target,rival]=g.fighters;
    Object.assign(target,{x:500,y:320,face:0,exposedUntil:exposure,exposedBy:'whiff'});
    Object.assign(rival,{x:570,y:320,face:Math.PI,think:100,eliteReady:100,energy:60});
    for(let i=0;i<5;i++)stepArcade(g,1/120);
    return {name:rival.technique,spec:rival.attackSpec,rank:rival.career.grade};
  }
  const base=response(1500,1),rated=response(1600,1);
  assert.equal(base.name,null);
  assert.equal(response(1600,.10).name,null);
  assert.equal(rated.rank,base.rank);
  assert.equal(rated.name,'mk_passing_needle');
  assert.ok(rated.spec!.contact>0&&rated.spec!.contact<1-.026);
});

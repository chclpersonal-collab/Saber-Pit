import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade} from '../dist/arcade-engine.js';
const dt=1/120;
const opts={mode:'duel',seed:8,terrain:'open',form:'shii_cho',teamForms:['shii_cho','shii_cho'],startingRanks:['F','F'],chessStyles:['rook','bishop']};
test('turning the new option off is still the exact old seeded trajectory',()=>{
 const a=createArcade(opts),b=createArcade({...opts,continuousCombat:false});
 for(let i=0;i<250;i++){
   const cmd={x:i<120?1:0,strike:i===60,guard:i>=145&&i<160};
   stepArcade(a,dt,cmd);stepArcade(b,dt,cmd);
 }
 assert.deepEqual(a,b);
});
test('a running attack and recovery retain grounded player motion without changing strike timing',()=>{
 const games=[false,true].map(continuousCombat=>createArcade({...opts,continuousCombat}));
 for(const g of games){
   const [f,op]=g.fighters; f.x=280;f.y=320;op.x=850;op.y=320;op.action='stagger';op.actionDuration=5;
   for(let i=0;i<20;i++)stepArcade(g,dt,{x:1,aimX:600,aimY:320});
   stepArcade(g,dt,{x:1,strike:true,aimX:600,aimY:320});
 }
 const [old,newer]=games.map(g=>g.fighters[0]);
 assert.ok(newer.groundSpeed>old.groundSpeed+40);
 for (const attr of ['duration','contact','arc','reach','cost','damage'])assert.equal(newer.attackSpec[attr],old.attackSpec[attr]);
 const until=newer.actionDuration-.04;
 while(newer.actionTime<until)for(const g of games)stepArcade(g,dt,{x:1,aimX:800,aimY:320});
 assert.ok(newer.groundSpeed>old.groundSpeed+30);
 assert.equal(newer.contact,true);
});
test('a moving Bishop cannot hit with a cardinal release',()=>{
 const g=createArcade({...opts,continuousCombat:true,chessStyles:['bishop','none']});
 const [a,b]=g.fighters;a.x=500;a.y=320;b.x=575;b.y=320;a.face=0;b.face=Math.PI;b.action='stagger';b.actionDuration=4;
 stepArcade(g,dt,{strike:true,x:1,aimX:b.x,aimY:b.y});
 a.actionTime=a.attackSpec.contact-dt*.3;stepArcade(g,dt,{aimX:b.x,aimY:b.y});
 assert.equal(a.stats.saberLanded,0);
});

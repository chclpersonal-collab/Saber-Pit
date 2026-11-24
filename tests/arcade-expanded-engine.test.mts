import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,ARCADE_EXPANDED_MOVES} from '../dist/arcade-engine.js';
import {activeClashEmitters} from '../dist/arcade-clashes.js';

const tick=1/120;
function fixture({weapon='staff',form='makashi',rank='SSS+V',expandedCombat=true,saberOnly=false,forceVariants=false,dx=61}={}){
 const s=createArcade({mode:'duel',form,expandedCombat,saberOnly,forceVariants,
   startingSaberWeapon:[weapon,'single'],startingRanks:[rank,rank],rule:'control'});
 const [p,e]=s.fighters;
 Object.assign(p,{x:460,y:300,face:0});
 Object.assign(e,{x:460+dx,y:300,face:Math.PI,think:100,action:'stagger',actionDuration:60});
 return {s,p,e};
}
const ticks=(s,n,input={})=>{for(let i=0;i<n;i++)stepArcade(s,tick,input);};
function cast(f,id,n=62){
 const {s,e}=f;ticks(s,1,{technique:id,aimX:e.x,aimY:e.y});
 if(n)ticks(s,n);
}
test('free hand physically hits at short range, never emits saber windows or saber credit',()=>{
 for(const weapon of ['single','staff']){
   const f=fixture({weapon,rank:'F'}),{s,p,e}=f;
   cast(f,'unarmed_palm',0);
   assert.equal(p.action,'free_hand');assert.equal(p.attackSpec.freeHand,true);
   for(let i=0;i<39;i++){assert.deepEqual(activeClashEmitters(p,s.time),[]);ticks(s,1);}
   const hit=s.events.find(x=>x.kind==='hit'&&x.targetId===e.id);
   assert.ok(hit?.freeHand);assert.equal(hit.blade,undefined);
   assert.ok(p.moves.unarmed_hits>0);assert.equal(p.stats.saberSwings,0);assert.equal(p.stats.saberHits,0);
 }
 for(const options of [{weapon:'dual'},{saberOnly:true},{expandedCombat:false}]){
   const f=fixture(options);cast(f,'unarmed_palm');assert.equal(f.p.moves.unarmed_palm,undefined);
 }
 const low=fixture({rank:'F'});cast(low,'unarmed_spin');assert.equal(low.p.moves.unarmed_spin,undefined);
 const distant=fixture({dx:110});cast(distant,'unarmed_palm');assert.equal(distant.p.moves.unarmed_hits,undefined);
});
test('Anchor, Veil, and Siphon apply real bounded target effects with no injury or saber credit',()=>{
 for(const [id,field] of [['force_anchor','forceAnchoredUntil'],['force_veil','forceVeiledUntil'],['force_siphon',null]]){
   const f=fixture({dx:92}),{s,p,e}=f;e.energy=45;p.energy=62;
   cast(f,id,0);
   const duration=p.attackSpec.contact;
   while(s.time<duration+.015)ticks(s,1);
   const contact=s.events.find(x=>x.kind==='expanded_contact');
   assert.equal(contact.targetId,e.id);assert.equal(p.stats.forceHits,1);assert.equal(p.stats.saberSwings,0);
   assert.equal(e.stats.damageTaken,0);
   if(field)assert.ok(e[field]>s.time&&e[field]-s.time<.79);
   else {assert.equal(e.energy,36);assert.equal(p.energy,54);}
 }
 const guarded=fixture({dx:92});const {s,p,e}=guarded;
 Object.assign(e,{action:'guard',actionDuration:0,guardHeld:true,guardBearing:Math.PI,guardUntil:3,decision:'guard'});
 cast(guarded,'force_anchor',50);
 assert.equal(e.forceAnchoredUntil,undefined);assert.equal(p.stats.forceHits,0);assert.ok(e.stats.blocks>0);
});
test('Echo Step travels honestly and respects walls; Lattice has one real charge',()=>{
 const open=fixture({dx:168});cast(open,'force_echo_step');
 assert.ok(open.p.x>490);assert.equal(open.p.invuln,0);assert.equal(open.p.stats.forceHits,0);
 const wall=fixture({dx:168});wall.s.terrain.solids.push({kind:'wall',x:487,y:270,width:29,height:90});
 cast(wall,'force_echo_step');assert.equal(wall.p.x,460);
 const ward=fixture({dx:55});cast(ward,'force_lattice',43);
 assert.equal(ward.p.wardCharges,1);assert.ok(ward.p.wardUntil>ward.s.time);
 const incoming=ARCADE_EXPANDED_MOVES.unarmed_palm;
 Object.assign(ward.e,{action:'free_hand',attack:incoming.id,attackSpec:{...incoming,lunge:0,freeHand:true,expanded:true},
  actionTime:incoming.contact-.001,actionDuration:incoming.duration,face:Math.PI,contact:false});
 ticks(ward.s,1);assert.equal(ward.p.wardCharges,0);assert.equal(ward.p.stats.damageTaken,0);
});

test('Arc Wave uses a radial lane with ordinary wall and ally screening',()=>{
 const s=createArcade({mode:'squad',form:'makashi',teamSizes:[2,3],expandedCombat:true,startingRanks:['SSS+V','SSS+V']});
 const [p,ally,front,rear,wallFoe]=s.fighters;
 for(const [f,x,y] of [[p,465,300],[ally,513,300],[front,555,300],[rear,390,300],[wallFoe,470,390]])
   Object.assign(f,{x,y,face:0,action:f===p?'idle':'stagger',actionDuration:f===p?0:60,think:100});
 s.terrain.solids.push({kind:'wall',x:431,y:337,width:89,height:21});
 ticks(s,1,{technique:'force_arc_wave',aimX:555,aimY:300});ticks(s,50);
 assert.ok(rear.stats.damageTaken>0&&rear.x<387);
 assert.equal(ally.stats.damageTaken,0);assert.equal(front.stats.damageTaken,0);assert.equal(wallFoe.stats.damageTaken,0);
 assert.equal(p.stats.forceHits,1);
});


test('new Arena Force powers honor rank, Saber-only, reach, and true contact',()=>{
 const close=fixture({forceVariants:true,dx:53});cast(close,'force_breakwater',35);
 assert.ok(close.p.moves.force_breakwater===1&&close.p.stats.forceHits===1&&close.e.x>513);
 const distant=fixture({forceVariants:true,dx:174});cast(distant,'force_tether',75);
 assert.ok(distant.e.forceAnchoredUntil>distant.s.time&&distant.p.stats.forceHits===1);
 const original=fixture({forceVariants:true,dx:174});cast(original,'force_anchor',75);
 assert.equal(original.e.forceAnchoredUntil,undefined);
 for(const opts of [{forceVariants:false},{forceVariants:true,saberOnly:true},{forceVariants:true,rank:'F'}]){
   const f=fixture(opts);cast(f,'force_breakwater',35);
   assert.equal(f.p.moves.force_breakwater,undefined);
 }
});

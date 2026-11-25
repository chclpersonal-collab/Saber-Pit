import test from 'node:test';
import assert from 'node:assert/strict';
import {createStyleLabRound,stepStyleLabRound,STYLE_LAB_BEARINGS} from '../dist/style-lab.js';
const play=(options)=>{
 const r=createStyleLabRound(options);
 for(let i=0;i<500&&r.phase!=='done';i++)stepStyleLabRound(r);
 assert.equal(r.phase,'done');
 return r;
};
const circle=(style,range=92,stance='facing')=>STYLE_LAB_BEARINGS.map((_,slot)=>play({style,range,stance,slot}).outcome.id);
test('Queen and King turn through eight real attacks, with distinct long and short ranges',()=>{
 const sample=createStyleLabRound({style:'queen',slot:2,range:114});
 const before=sample.fighter.face;
 stepStyleLabRound(sample,.15);
 assert.notEqual(sample.fighter.face,before);assert.equal(sample.fighter.stats.saberSwings,0);
 const dist=Math.abs(Math.atan2(Math.sin(sample.fighter.face-sample.bearing),Math.cos(sample.fighter.face-sample.bearing)));
 assert.ok(dist<Math.PI/3,'engine interpolates aim before commitment');
 assert.deepEqual(circle('queen',115),Array(8).fill('hit'));
 assert.deepEqual(circle('king',68),Array(8).fill('hit'));
 assert.deepEqual(circle('king',115),Array(8).fill('range'));
 const winner=play({style:'queen',range:115});
 assert.ok(winner.g.events.some(e=>e.kind==='hit'&&e.fighterId===winner.fighter.id));
 assert.equal(winner.fighter.stats.saberSwings,1);
 assert.ok(winner.knockbackDistance>=12,'Style Lab reports actual opponent travel');
 assert.ok(winner.timing.windupMs>0&&winner.timing.afterReleaseMs>0);
 assert.ok(winner.timing.stamina>0);
});
test('Rook and Bishop test distinct attack directions, and a Knight needs the real rival flank',()=>{
 assert.deepEqual(circle('rook'),['hit','lane','hit','lane','hit','lane','hit','lane']);
 assert.deepEqual(circle('bishop'),['lane','hit','lane','hit','lane','hit','lane','hit']);
 assert.deepEqual(circle('knight'),Array(8).fill('lane'));
 assert.deepEqual(circle('knight',92,'side'),Array(8).fill('hit'));
 assert.deepEqual(circle('pawn',70),Array(8).fill('hit'),'Pawn may turn to any bearing and attack straight forward');
});
test('all six styles can walk a diagonal; walking does not commit a strike',()=>{
 for(const style of ['queen','king','rook','bishop','knight','pawn']){
   const r=play({drill:'walk',style,slot:1});
   assert.equal(r.g.config.styleTravel,true);
   assert.match(r.outcome.label,/Moved Southeast/);
   assert.equal(r.fighter.stats.saberSwings,0);
 }
});

test('default King and Queen drill uses the actual released sweep art, with a wider Queen turn',async()=>{
 const {sampleArcadeFighter,sampleArcadeStyleSpin}=await import('../dist/arcade-fighters.js');
 const capture=style=>{
   const a=createStyleLabRound({style});
   assert.equal(a.move.id,'sc_open_cut');
   assert.equal(a.move.motion.path,'arc');
   while(!a.fighter.attackSpec||a.fighter.actionTime<a.fighter.attackSpec.contact+.09)stepStyleLabRound(a);
   const {fighter,g}=a;
   return sampleArcadeStyleSpin(fighter,sampleArcadeFighter(fighter,g.time)).styleSpin;
 };
 const tight=capture('king'),wide=capture('queen');
 assert.equal(tight.style,'king');assert.equal(wide.style,'queen');
 assert.ok(wide.cloth>tight.cloth);
});

test('fixed Open Cut comparison uses one weapon, range, bearing and move; all three contact',async()=>{
 const {STYLE_LAB_COMPARE}=await import('../dist/style-lab.js');
 assert.deepEqual(STYLE_LAB_COMPARE.map(c=>c.style),['king','queen','bishop']);
 const geometry=({style,...rest})=>rest;
 assert.deepEqual(STYLE_LAB_COMPARE.map(geometry),Array(3).fill(geometry(STYLE_LAB_COMPARE[0])));
 for(const c of STYLE_LAB_COMPARE){
   const r=createStyleLabRound(c);
   for(let n=0;n<500&&r.phase!=='recovering';n++)stepStyleLabRound(r);
   assert.equal(r.phase,'recovering');
   assert.equal(r.outcome.id,'hit');
   assert.ok(r.settleAt-r.elapsed>=.21,'the Lab continues animating after weapon contact');
   for(let n=0;n<100&&r.phase!=='done';n++)stepStyleLabRound(r);
   assert.equal(r.phase,'done');
 }
});

test('all new named moves can be selected and physically committed in live Style Lab',async()=>{
 const {ARCADE_EXCHANGE_CUT_ROWS}=await import('../dist/arcade-exchange-cuts.js');
 const {combatMoveLabel}=await import('../dist/arcade-callouts.js');
 for(const [form,moves] of Object.entries(ARCADE_EXCHANGE_CUT_ROWS)){
   for(const [id,name] of moves){
     const r=play({style:'queen',form,range:76,technique:id});
     assert.equal(r.move.id,id,name+' can be selected');
     assert.equal(combatMoveLabel(id),name);
     assert.ok(r.g.events.some(e=>e.fighterId===r.fighter.id&&e.technique===id&&e.contact>0),name+' commits a real attack');
   }
 }
});

test('fractional headings and non-standing entries use the real live-entry engine',()=>{
 for(const [entry,angle] of [['step',37.25],['turn',128.4],['guard',247.625]]){
   const r=play({style:'queen',form:'shii_cho',technique:'sc_open_cut',range:83,customDegrees:angle,entry});
   assert.ok(Math.abs(r.bearing-angle*Math.PI/180)<1e-10);
   assert.equal(r.customDegrees,angle);
   const started=r.g.events.find(e=>e.technique==='sc_open_cut'&&e.contact>0);
   assert.ok(started?.entryKind,entry+' should start with current guard or motion instead of an idle reset');
   assert.equal(r.outcome.id,'hit');
 }
});


test('quarter-speed observation keeps the same fixed-tick move, hit and timings',()=>{
 const options={style:'queen',form:'shii_cho',technique:'sc_open_cut',range:83,customDegrees:37.25,entry:'step'};
 const full=play(options),quarter=createStyleLabRound(options);
 for(let i=0;i<900&&quarter.phase!=='done';i++)stepStyleLabRound(quarter,1/480);
 assert.equal(quarter.phase,'done');
 assert.deepEqual(quarter.outcome,full.outcome);
 assert.deepEqual(quarter.timing,full.timing);
 assert.equal(quarter.knockbackDistance,full.knockbackDistance);
 assert.deepEqual(quarter.g.events,full.g.events);
});


test('Jump drill plays an actual traversal and settled landing for all seven saber forms',()=>{
 const kinds=new Set();
 for(const form of ['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo']){
   const r=play({drill:'jump',slot:0,form});
   assert.equal(r.outcome.id,'jump',form);
   assert.equal(r.fighter.airPhase,'grounded');
   assert.ok(r.jumpPeak>10&&r.fighter.x>r.g.width/2+30);
   assert.equal(r.fighter.stats.saberSwings,0);
   assert.equal(r.g.events.filter(e=>e.kind==='jump'&&e.fighterId===r.fighter.id).length,1);
   kinds.add(r.jumpKind);
 }
 assert.equal(kinds.size,7);
 const side=play({drill:'jump',slot:2,form:'ataru'});
 assert.equal(side.jumpKind,'crossflip');
 assert.ok(side.fighter.y>318+30);
});


test('held guard in the lab blocks front contact, while an away-facing guard still leaves a real opening',()=>{
 const options={style:'queen',form:'shii_cho',technique:'sc_open_cut',range:85,defense:'held'};
 const front=play(options);
 assert.equal(front.outcome.id,'guard');
 assert.ok(front.g.events.some(e=>e.kind==='block'&&e.fighterId===front.dummy.id));
 const rear=play({...options,stance:'away'});
 assert.equal(rear.outcome.id,'hit');
 assert.ok(rear.g.events.some(e=>e.kind==='hit'&&e.targetId===rear.dummy.id));
});


test('weapon comparison repeats an identical live strike with independently tuned kit stats',async()=>{
 const {styleLabWeaponCompare}=await import('../dist/style-lab.js');
 const cases=styleLabWeaponCompare({style:'queen',form:'shii_cho',technique:'sc_open_cut',range:83,slot:0});
 const rounds=cases.map(play);
 assert.deepEqual(rounds.map(r=>r.fighter.gear.weapon),['shoto','single','greatsaber']);
 assert.equal(new Set(rounds.map(r=>r.move.id)).size,1);
 assert.ok(rounds.every(r=>r.damage>0));
 for(const key of ['reach','windupMs','stamina']){
   const [a,b,c]=rounds.map(r=>r.timing[key]);
   assert.ok(a<b&&b<c,key);
 }
});

test('Force and free-hand drills show actual cast, effect, or defense; dual keeps hands occupied',async()=>{
 const {styleLabMoveList}=await import('../dist/style-lab.js');
 assert.equal(styleLabMoveList('shii_cho','backhand-dual','free_hand').length,0);
 assert.ok(styleLabMoveList('shii_cho','staff','free_hand').some(m=>m.id==='unarmed_palm'));
 assert.ok(styleLabMoveList('shii_cho','dual','force').some(m=>m.id==='force_tether'));
 const options={style:'queen',form:'shii_cho',range:70};
 const anchor=play({...options,technique:'force_anchor'});
 assert.equal(anchor.outcome.label,'Target Slowed');
 assert.equal(play({...options,technique:'force_anchor',defense:'held'}).outcome.id,'guard');
 assert.equal(play({...options,technique:'force_lattice'}).outcome.label,'Ward Up');
 const palm=play({...options,range:49,technique:'unarmed_palm'});
 assert.ok(palm.g.events.some(e=>e.technique==='unarmed_palm'&&e.kind==='free_hand'&&e.contact>0));
 assert.ok(palm.damage>0);
});

test('move family is visible alongside Move and weapon comparison only accepts saber drills',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {styleLabCanCompareWeapons}=await import('../dist/style-lab.js');
 const html=await readFile(new URL('../dist/style-lab.html',import.meta.url),'utf8');
 const core=html.match(/class="core-pickers">([\s\S]*?)<\/div>/)?.[1];
 assert.match(core,/id="labMoveFamily"[\s\S]+id="labMove"/);
 assert.match(html,/id="labCompareWeapons"[^>]*aria-describedby="labWeaponCompareHint"/);
 assert.match(html,/id="labWeaponCompareHint"[^>]*>Choose a saber attack/);
 assert.equal(styleLabCanCompareWeapons('saber'),true);
 for(const family of ['force','free_hand',undefined]) assert.equal(styleLabCanCompareWeapons(family),false);
});

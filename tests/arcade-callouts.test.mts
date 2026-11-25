import test from 'node:test';
import assert from 'node:assert/strict';
import {combatMoveLabel,combatCallout,createCombatCallouts,paintCombatCallout} from '../dist/arcade-callouts.js';
import {ARCADE_TECHNIQUES} from '../dist/arcade-repertoire.js';
const styleActor={id:'0-0',chessStyle:'rook',control:true};
const event=(id,kind,extra={})=>({id,kind,fighterId:'0-0',...extra});

test('authoritative named commitment shows no chess descriptor, not an offhand tick or result alias',()=>{
 const technique=Object.values(ARCADE_TECHNIQUES).find(m=>m.mapAction==='slash');
 const move=combatCallout(event(1,'slash',{technique:technique.id,contact:.22}),styleActor);
 assert.equal(move.label,(technique.label??technique.name).toUpperCase());
 assert.equal(move.style,'');
 assert.equal(combatCallout(event(2,'slash',{technique:technique.id,contact:0,offhand:true}),styleActor),null);
 assert.equal(combatCallout(event(3,'hit',{technique:technique.id,contact:.22}),styleActor),null);
 const cast=combatCallout(event(4,'expanded_release',{moveId:'force_arc_wave'}),styleActor);
 assert.equal(cast.label,'ARC WAVE');assert.equal(cast.style,'');
 assert.equal(combatCallout(event(5,'force',{technique:'force_arc_wave',contact:.22,expanded:true}),styleActor),null);
 assert.equal(combatCallout(event(6,'trakata_on',{interrupted:true}),styleActor),null);
});
test('a perfect parry and then KO can replace a move, but lower and equal labels cannot flicker',()=>{
 const c=createCombatCallouts(),actors=[styleActor];
 assert.equal(c.advance(.01,[event(1,'rush',{technique:'thrust',contact:.23})],actors).label,'LINEAR THRUST');
 const parry=c.advance(.13,[event(2,'parry',{perfect:true,staminaRestored:6})],actors);
 assert.equal(parry.label,'PERFECT PARRY +6 STA');
 assert.equal(c.advance(.11,[event(3,'slash',{technique:'slash',contact:.21})],actors),parry);
 assert.equal(c.advance(.05,[event(4,'parry')],actors),parry);
 const ko=c.advance(.01,[event(5,'ko',{region:'head'})],actors);
 assert.equal(ko.label,'KO · HEAD');
 for(let i=0;i<4;i++)c.advance(.25,[],actors);
 assert.equal(c.advance(0,[],actors),null);
 c.reset();
 assert.equal(c.advance(.01,[event(1,'parry')],actors).label,'PARRY');
});
test('crowds prioritize the actual player or watched Hero and suppress unrelated move spam',()=>{
 const c=createCombatCallouts(),actors=Array.from({length:12},(_,i)=>({id:'bot'+i,chessStyle:'bishop'}));
 const move=(id,i)=>event(id,'rush',{fighterId:'bot'+i,technique:'thrust',contact:.23});
 assert.equal(c.advance(.1,[move(1,5)],actors,{focusId:'bot6'}),null);
 const selected=c.advance(.10,[move(2,6)],actors,{focusId:'bot6'});
 assert.equal(selected.label,'LINEAR THRUST');
 assert.equal(selected.style,'');
 assert.equal(c.advance(.1,[event(3,'clash',{fighterId:'bot5'})],actors).label,'BLADE CLASH');
});
test('actual completed Pawn progression displays once and overlay clears without stacking',()=>{
 const c=createCombatCallouts(),pawn={id:'0-0',chessStyle:'pawn',chessPawn:{promoted:true}};
 const promotion=c.advance(.15,[event(1,'hit')],[pawn]);
 assert.equal(promotion.label,'PAWN PROMOTED');
 assert.equal(promotion.style,'PAWN → QUEEN');
 const element={textContent:'',dataset:{},hidden:true};
 paintCombatCallout(element,promotion);
 assert.deepEqual(element.dataset,{style:'PAWN → QUEEN',kind:'promotion'});
 assert.equal(element.hidden,false);
 paintCombatCallout(element,null);assert.equal(element.hidden,true);
 for(let i=0;i<4;i++)c.advance(.25,[],[pawn]);
 assert.equal(c.advance(.05,[event(2,'hit')],[pawn]),null);
});

test('real Arena state produces a named move without changing authoritative events',async()=>{
 const {createArcade,stepArcade}=await import('../dist/arcade-engine.js');
 const g=createArcade({form:'makashi',chessStyles:['rook','none']});
 const [p,e]=g.fighters;Object.assign(p,{x:420,y:305});Object.assign(e,{x:495,y:305,action:'stagger',actionDuration:9,think:20});
 stepArcade(g,1/120,{heavy:true,aimX:e.x,aimY:e.y});
 const original=structuredClone(g.events);
 const cue=createCombatCallouts().advance(1/120,g.events,g.fighters);
 assert.equal(cue.label,'LINEAR THRUST');assert.equal(cue.style,'');
 assert.deepEqual(g.events,original);
});

test('adaptive style switch shows no descriptor, and earlier attacks use their stamped Pawn promotion',()=>{
 const alreadySwitched={...styleActor,chessStyle:'knight'};
 assert.equal(combatCallout(event(1,'chess_style',{chessStyle:'bishop',previousChessStyle:'queen'}),alreadySwitched),null);
 assert.equal(combatCallout(event(4,'chess_style',{chessStyle:'pawn',chessPromoted:true}),alreadySwitched).label,'PAWN → QUEEN');
 const attack=combatCallout(event(2,'rush',{technique:'thrust',contact:.22,chessStyle:'rook'}),alreadySwitched);
 assert.equal(attack.style,'');
 const promotion=combatCallout(event(3,'rush',{technique:'thrust',contact:.22,chessStyle:'pawn',chessPromoted:true}),alreadySwitched);
 assert.equal(promotion.style,'PAWN → QUEEN');
});


test('unnamed slash stages have distinct canonical labels without promoting styled routine cuts',()=>{
  const stages=[
    ['slash','inside','Opening Cut'],['slash2','outside','Reverse Cut'],
    ['slash3','inside','Finishing Cut'],['slash4','outside','Fourth Cut'],
  ];
  for(const [i,[technique,attackVariant,label]] of stages.entries()){
    const base=event(1+i,'slash',{technique,attackVariant,contact:.22,combo:i+1});
    assert.equal(combatMoveLabel(technique),label);
    const styled=combatCallout(base,styleActor);
    assert.equal(styled.label,label.toUpperCase());
    assert.equal(styled.style,'');
    assert.equal(styled.priority,1);
  }
  const cal=createCombatCallouts();
  const best=Object.values(ARCADE_TECHNIQUES).find(m=>m.mapAction==='slash');
  assert.equal(cal.advance(.1,[event(1,'slash',{technique:'slash3',contact:.25,combo:3}),
    event(2,'slash',{technique:best.id,contact:.25})],[styleActor]).label,combatMoveLabel(best.id).toUpperCase());
});

test('directional qualifiers only reflect actual generic lanes and never rewrite an authored name',()=>{
  const best=Object.values(ARCADE_TECHNIQUES).find(m=>m.mapAction==='slash');
  assert.equal(combatMoveLabel('slash'), 'Opening Cut');
  assert.equal(combatMoveLabel('slash',{attackVariant:'outside'}), 'Outside Opening Cut');
  assert.equal(combatMoveLabel('thrust',{attackVariant:'center'}), 'Linear Thrust');
  assert.equal(combatMoveLabel('thrust',{attackVariant:'inside'}), 'Inside Linear Thrust');
  assert.equal(combatMoveLabel(best.id,{attackVariant:'outside'}),best.label??best.name);
  assert.equal(combatMoveLabel('force',{forceAbility:'force_burst'}),'Burst');
  assert.equal(combatMoveLabel('unknown_move'),null);
});

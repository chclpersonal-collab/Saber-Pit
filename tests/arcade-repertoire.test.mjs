import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_REPERTOIRE,ARCADE_TECHNIQUES,ARCADE_ARENA_CUTS,arcadeMovesFor,arcadeTacticsFor} from '../dist/arcade-repertoire.js';
import {sampleArcadeFighter as pose,arcadeBladeWorld} from '../dist/arcade-fighters.js';

const formIds=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const stable={x:520,y:350,face:0,airPhase:'grounded',airHeight:0};
function at(move,timing,opts={}){
  const f={...stable,...opts,form:move.form,technique:move.id,action:move.mapAction,actionTime:timing,actionDuration:move.duration,attackSpec:move};
  return {f,r:pose(f,10)};
}
test('seven forms gain a usable new move at every grade',()=>{
  assert.deepEqual(Object.keys(ARCADE_REPERTOIRE),formIds);
  assert.equal(Object.keys(ARCADE_TECHNIQUES).length,210);
  for(const form of formIds){
    const rookies=arcadeMovesFor(form,0), final=arcadeMovesFor(form,14);
    assert.deepEqual(rookies.map(m=>m.role),['light','heavy']);
    assert.equal(arcadeMovesFor(form,4).length,6);
    assert.equal(arcadeMovesFor(form,6).filter(m=>m.role==='counter').length,2);
    assert.equal(arcadeMovesFor(form,9).some(m=>m.role==='crowd'),false);
    assert.equal(final.length,16);
    for(let rank=1;rank<15;rank++)assert.equal(arcadeMovesFor(form,rank).length,rank+2);
    assert.deepEqual(final.filter(m=>m.mapAction==='force').map(m=>m.forceAbility),['push','pull','stasis','ward']);
    const crowd=final.find(m=>m.role==='crowd');
    assert.equal(crowd.minRank,10);
    assert.ok(crowd.cap>=2 && crowd.cap<=3);
    assert.ok(new Set(final.map(m=>m.contact)).size>=15);
    for(const m of final){
      assert.equal(m.form,form);assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.motion));
      assert.ok(m.contact>0 && m.contact<m.duration);
      assert.ok(m.air==null||form==='ataru');
      assert.ok(!m.launch||form==='djem_so');
      assert.ok(!m.deflect||form==='soresu');
    }
  }
  assert.deepEqual(arcadeMovesFor('not-a-form',999),[]);
});
test('all authored moves produce distinct finite body and blade poses without changing engine hit time',()=>{
  const serialized=[];
  for(const move of Object.values(ARCADE_TECHNIQUES).filter(m=>!m.tactical)){
    const points=[move.contact*.30,move.contact*.61,move.contact,(move.contact+move.duration)*.5].map(t=>{
      const {f,r}=at(move,t), blade=arcadeBladeWorld(f,r);
      assert.ok(Number.isFinite(blade.tip.x)&&Number.isFinite(blade.tip.y));
      assert.equal(f.attackSpec.contact,move.contact);
      const pack=q=>[q.x,q.y].map(v=>Math.round(v*10));
      return [r.lean,r.bend,...pack(r.hand),...pack(r.blade),r.torsoTurn,r.wide,...pack(r.backHand)];
    });
    serialized.push(JSON.stringify(points));
  }
  assert.equal(new Set(serialized).size,184);
});
test('Makashi’s feint extends, retracts and only then reaches its real contact; Soresu’s guard stays compact',()=>{
  const feint=ARCADE_TECHNIQUES.mk_false_opening;
  const show=at(feint,feint.contact*.22).r,chamber=at(feint,feint.contact*.55).r,actual=at(feint,feint.contact).r;
  assert.ok(show.hand.x>chamber.hand.x+9);
  assert.ok(actual.hand.x>show.hand.x+2);
  const point=at(ARCADE_TECHNIQUES.mk_measured_point,ARCADE_TECHNIQUES.mk_measured_point.contact).r;
  const screen=at(ARCADE_TECHNIQUES.sr_gate_close,ARCADE_TECHNIQUES.sr_gate_close.contact).r;
  assert.ok(point.hand.x>screen.hand.x+15);
});
test('Ataru vaults have distinct turns/tucks and only animate if the fighter is physically airborne',()=>{
  const variants=['at_front_vault','at_cross_vault','at_sky_split'].map(id=>ARCADE_TECHNIQUES[id]);
  const flight=variants.map(move=>at(move,move.contact,{airPhase:'airborne',airHeight:42,airProgress:.44}).r);
  assert.deepEqual(flight.map(r=>r.trick.kind),['vault-flip','cross-vault','high-vault']);
  assert.deepEqual(flight.map(r=>r.hop),[42,42,42]);
  assert.ok(flight[0].trick.angle>0 && flight[1].trick.angle<0);
  assert.ok(Math.abs(flight[0].trick.angle-flight[2].trick.angle)>.3);
  assert.deepEqual(variants.map(move=>at(move,move.contact).r.hop),[0,0,0]);
});
test('sidestep and backstep have visibly independent grounded footwork',()=>{
  const common={...stable,form:'makashi',action:'dash',actionTime:.11,actionDuration:.27};
  const side=pose({...common,technique:'sidestep'}),back=pose({...common,technique:'backstep'});
  assert.equal(side.action,'sidestep');
  assert.equal(back.action,'backstep');
  assert.ok(side.lean>back.lean+9);
  assert.ok(side.legs.at(-1).foot.y>back.legs.at(-1).foot.y+15);
  assert.equal(side.hop,0);assert.equal(back.hop,0);
});

test('injury animates a lowered guard without treating a conscious zero-HP fighter as KO',()=>{
  const f={...stable,form:'soresu',action:'guard',actionTime:.12,actionDuration:.25};
  const fresh=pose(f,0), hurt=pose({...f,alive:true,hp:0,injuryEffects:{moveSpeed:.72,guardEfficiency:.6}},0);
  assert.equal(hurt.action,'guard');
  assert.ok(hurt.hand.y>fresh.hand.y);
  assert.equal(pose({...f,alive:false,hp:20},0).action,'ko');
});


test('all seven forms add real tactical move families beside unchanged core grade unlocks',()=>{
  for(const form of formIds){
    assert.deepEqual(arcadeTacticsFor(form,4),[]);
    const final=arcadeTacticsFor(form,14);
    assert.deepEqual(final.map(m=>[m.minRank,m.tactical]),[[5,'slip_counter'],[9,'feint_redirect'],[13,'moving_guard']]);
    assert.ok(final[2].deflect);
    assert.equal(arcadeMovesFor(form,14,{tactical:true}).length,19);
    for(const m of final){
      assert.equal(ARCADE_TECHNIQUES[m.id],m);
      const {f,r}=at(m,m.contact*.50);
      assert.ok(Number.isFinite(arcadeBladeWorld(f,r).tip.x));
    }
  }
});

test('four additional saber cuts per form unlock cumulatively at D, SS, SSS+I and SSS+V without replacing the classic kit',()=>{
  for(const form of formIds){
    for(let r=0;r<15;r++){
      const basic=arcadeMovesFor(form,r), expanded=arcadeMovesFor(form,r,{rankCuts:true});
      assert(basic.every(move=>expanded.includes(move)));
      const trained=expanded.filter(m=>m.opening);
      assert.deepEqual(trained.map(m=>m.minRank),[2,7,10,14].filter(min=>min<=r));
      assert(trained.every(m=>m.mapAction!=='force'&&ARCADE_TECHNIQUES[m.id]===m));
      if(r===0)assert.equal(expanded.length,2);
      if(r===14){
        assert.deepEqual(trained.map(m=>m.opening),['inside','outside','wide','intercept']);
        assert(trained[0].motion.chamber<0&&trained[1].motion.chamber>0);
        assert(trained[2].arc>trained[3].arc&&trained[3].contact<trained[2].contact);
      }
    }
  }
});

test('Circuit adds two genuine form-specific saber commitments at C and SSS+ IV with opt-in only',()=>{
  for(const form of formIds){
    for(const rank of [0,2,3,12,13,14]){
      const ordinary=arcadeMovesFor(form,rank,{tactical:true,rankCuts:true});
      const added=arcadeMovesFor(form,rank,{tactical:true,rankCuts:true,circuitCuts:true});
      assert(ordinary.every(move=>!move.circuitCut&&added.includes(move)));
      assert.deepEqual(added.filter(m=>m.circuitCut).map(m=>m.minRank),[3,13].filter(r=>r<=rank));
    }
    const [early,late]=arcadeMovesFor(form,14,{circuitCuts:true}).filter(m=>m.circuitCut);
    assert.notEqual(early.opening,late.opening);
    assert.notDeepEqual([early.contact,early.arc,early.reach],[late.contact,late.arc,late.reach]);
    assert(early.motion.chamber*late.motion.chamber<0||form==='shii_cho'||form==='ataru');
    for(const move of [early,late]){
      const {f,r}=at(move,move.contact);
      const blade=arcadeBladeWorld(f,r);
      assert(Number.isFinite(blade.tip.x)&&Math.hypot(blade.tip.x-blade.hand.x,blade.tip.y-blade.hand.y)>10);
    }
  }
});

test('Arena adds one early and one advanced physical move per form without changing old opt-ins',()=>{
  assert.equal(ARCADE_ARENA_CUTS.length,14);
  assert.equal(new Set(ARCADE_ARENA_CUTS.map(m=>m.id)).size,14);
  for(const form of formIds){
    const short=arcadeMovesFor(form,2,{arenaCuts:true}).filter(m=>m.arenaCut);
    const full=arcadeMovesFor(form,14,{arenaCuts:true}).filter(m=>m.arenaCut);
    assert.equal(short.length,1);assert.equal(full.length,2);
    const [early,advanced]=full;
    assert.ok(early.minRank===1||early.minRank===2);
    assert.ok(advanced.minRank>=12);
    assert.deepEqual(arcadeMovesFor(form,early.minRank-1,{arenaCuts:true}).filter(m=>m.arenaCut),[]);
    assert.deepEqual(arcadeMovesFor(form,advanced.minRank-1,{arenaCuts:true}).filter(m=>m.arenaCut),[early]);
    assert.notEqual(early.motion.chamber,advanced.motion.chamber);
    for(const rank of [0,1,2,12,13,14])for(const tactical of [false,true])for(const rankCuts of [false,true])for(const circuitCuts of [false,true]){
      const options={tactical,rankCuts,circuitCuts};
      const old=arcadeMovesFor(form,rank,options);
      const fresh=arcadeMovesFor(form,rank,{...options,arenaCuts:true});
      assert(old.every(x=>!x.arenaCut&&fresh.includes(x)));
      assert.deepEqual(fresh.filter(x=>!x.arenaCut),old);
    }
    for(const move of full){
      assert.equal(ARCADE_TECHNIQUES[move.id],move);
      assert.ok(Object.isFrozen(move)&&Object.isFrozen(move.motion));
      assert.ok(move.contact<move.duration&&move.reach>55&&move.arc>0&&move.cost>0);
      const {f,r}=at(move,move.contact);
      const blade=arcadeBladeWorld(f,r);
      assert.ok(Number.isFinite(blade.tip.x));
      assert.ok(Math.hypot(blade.tip.x-blade.hand.x,blade.tip.y-blade.hand.y)>10);
    }
  }
  assert.equal(ARCADE_TECHNIQUES.ac_sr_hinge_screen.tactical,'moving_guard');
  assert.equal(ARCADE_TECHNIQUES.ac_sr_hinge_screen.deflect,true);
  assert.equal(ARCADE_TECHNIQUES.ac_at_corkscrew_entry.air,'crossVault');
  assert.equal(ARCADE_TECHNIQUES.ac_ds_breakwater.launch,true);
});

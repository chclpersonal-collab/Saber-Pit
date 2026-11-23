import test from 'node:test';
import assert from 'node:assert/strict';
import { createArcadeFX } from '../dist/arcade-fx.js';

const event = (id, kind, more) => ({ id, kind, x: 100, y: 200, face: -.9, team: 1, ...more });
const fighter = (form, time) => ({id:1,team:0,form,attack:'slash',technique:'slash',actionTime:time,attackSpec:{contact:.22}});
const blade = (tx, ty, hx=20, hy=70) => ({hand:{x:hx,y:hy},tip:{x:tx,y:ty}});
function recorder() {
  const calls = [], paints=[];
  let stack = 0, strokes = 0;
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (Object.hasOwn(target, prop)) return target[prop];
      return (...args) => {
        if (prop === 'save') stack++;
        if (prop === 'restore') assert(stack-- > 0);
        if (prop === 'stroke') {
          strokes++;
          paints.push([target.strokeStyle,target.globalAlpha,target.lineWidth]);
        }
        assert(args.every(a => typeof a === 'string' || Number.isFinite(a)), `Non-finite canvas angle/coordinate in ${prop}`);
        calls.push([prop, ...args]);
      };
    },
  });
  return { ctx, calls, paints, done: () => assert.equal(stack, 0), strokes: () => strokes };
}

test('windup stays clear and the near-contact trail connects real blade endpoints', () => {
  const fx = createArcadeFX();
  fx.observe([event(1,'sweep',{contact:.22})]);
  fx.update(.19);
  fx.sampleBlade(fighter('shii_cho',.11), blade(44,52));
  fx.update(.017);
  fx.sampleBlade(fighter('shii_cho',.12), blade(48,64));
  const clear = recorder(); fx.drawAir(clear.ctx); fx.drawBladeTrails(clear.ctx); clear.done();
  assert.equal(clear.strokes(),0);
  fx.sampleBlade(fighter('shii_cho',.188), blade(46,70));
  fx.update(.017);
  fx.sampleBlade(fighter('shii_cho',.209), blade(53,83));
  const trail = recorder(); fx.drawBladeTrails(trail.ctx); trail.done();
  assert(trail.calls.some(call=>call[0]==='lineTo'&&call[1]===46&&call[2]===70));
  assert(trail.calls.some(call=>call[0]==='lineTo'&&call[1]===53&&call[2]===83));
  assert.deepEqual(fx.shake(),{x:0,y:0});
});

test('form-specific trail weight keeps the same tip path', () => {
  const styles = ['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
  const signatures = styles.map(form=>{
    const fx=createArcadeFX();
    fx.sampleBlade(fighter(form,.188),blade(46,70));
    fx.update(.017); fx.sampleBlade(fighter(form,.209),blade(53,83));
    const trail=recorder(); fx.drawBladeTrails(trail.ctx); trail.done();
    assert(trail.calls.some(call=>call[0]==='lineTo'&&call[1]===53&&call[2]===83));
    return JSON.stringify(trail.calls);
  });
  assert.equal(new Set(signatures).size,styles.length);
});

test('real hit outcomes appear at impact: KO, parry, guard break and limited shake', () => {
  const fx = createArcadeFX();
  const batch = [event(1, 'block', {face:-1}), event(2, 'launch'), event(3, 'parry'), event(4, 'break'), event(5, 'ko')];
  fx.observe(batch); fx.observe(batch);
  const draw = recorder(); fx.drawAir(draw.ctx); draw.done();
  assert.deepEqual(draw.calls.filter(call => call[0] === 'fillText').map(call => call[1]), ['PARRY', 'BREAK', 'KO']);
  assert(draw.calls.some(call=>call[0]==='translate'&&call[1]===100&&call[2]===163));
  assert(draw.calls.some(call=>call[0]==='rotate'&&call[1]===-1));
  assert(Math.hypot(fx.shake().x, fx.shake().y) <= 9);
  fx.update(.33); fx.update(.33); fx.update(.1);
  const expired = recorder(); fx.drawAir(expired.ctx); expired.done(); assert.equal(expired.calls.length, 0);
});

test('reduced motion clears real trails, dust and shake, and keeps a static contact label', () => {
  const fx = createArcadeFX();
  fx.sampleBlade(fighter('soresu',.188),blade(46,70));
  fx.update(.017); fx.sampleBlade(fighter('soresu',.209),blade(53,83));
  fx.observe([event(1, 'dash'), event(2, 'ko', { groundY: 220, z: 6 })]);
  fx.update(.025, true);
  const draw = recorder(); fx.drawGround(draw.ctx);fx.drawBladeTrails(draw.ctx);
  assert.equal(draw.calls.length, 0);
  fx.drawAir(draw.ctx); draw.done();
  assert.deepEqual(draw.calls.filter(call => call[0] === 'fillText').map(call => call[1]), ['KO']);
  assert.deepEqual(fx.shake(), { x: 0, y: 0 });
  fx.reset(); const empty = recorder(); fx.drawAir(empty.ctx); assert.equal(empty.calls.length, 0);
});

test('flooding with dash dust cannot evict a knockout or invent an air trail', () => {
  const fx = createArcadeFX();
  fx.observe([event(1, 'ko'), ...Array.from({ length: 100 }, (_, i) => event(i + 2, 'dash'))]);
  const draw = recorder(); fx.drawAir(draw.ctx); draw.done();
  assert.equal(draw.calls.filter(call=>call[0]==='translate').length,2);
  assert(draw.calls.some(call => call[0] === 'fillText' && call[1] === 'KO'));
});

test('Niman Force is held through windup and does not pretend to land', () => {
  const fx = createArcadeFX();
  fx.observe([event(1, 'force', { form: 'niman', contact: .29 })]);
  fx.update(.26);
  const before = recorder(); fx.drawAir(before.ctx); before.done(); assert.equal(before.strokes(), 0);
  fx.update(.04);
  const cast = recorder(); fx.drawAir(cast.ctx); cast.done();
  assert.equal(cast.calls.filter(call => call[0] === 'ellipse').length, 3);
  assert.equal(fx.shake().x, 0, 'a cast alone is not contact');
  fx.observe([event(2, 'push', { form: 'niman' })]);
  const contact = recorder(); fx.drawAir(contact.ctx); contact.done();
  assert(contact.calls.filter(call => call[0] === 'ellipse').length > 3);
  assert(Math.hypot(fx.shake().x, fx.shake().y) > 0);
});

test('blade clash forks at the actual world steel contact and draws a quiet static reduced-motion mark',()=>{
  const fx=createArcadeFX(), contact=event(1,'clash',{x:222.5,y:139.75,z:23,groundY:202,face:1.02});
  fx.observe([contact]);fx.observe([contact]);
  fx.update(.027);
  const full=recorder();fx.drawAir(full.ctx);fx.drawGround(full.ctx);full.done();
  const anchors=full.calls.filter(c=>c[0]==='translate');
  assert.deepEqual(anchors,[['translate',222.5,139.75]]);
  assert(full.calls.some(c=>c[0]==='rotate'&&c[1]===1.02));
  assert.strictEqual(full.calls.filter(c=>c[0]==='fillText').length,0,'the overlay owns the clash callout');
  assert(full.strokes()>=4);
  fx.update(.021,true);
  const reduced=recorder();fx.drawAir(reduced.ctx);reduced.done();
  assert.deepEqual(reduced.calls.filter(c=>c[0]==='translate'),anchors);
  assert(reduced.strokes()>0&&reduced.strokes()<full.strokes());
  assert.deepEqual(fx.shake(),{x:0,y:0});
});

test('regional contacts and fatal resolution make compact distinct marks without combat labels or ground bursts',()=>{
  const fx=createArcadeFX();
  fx.observe([
    event(1,'hit',{targetId:'a',region:'leftArm',injuryOutcome:'injured',injuryTier:1,contactY:152}),
    event(2,'hit',{targetId:'b',region:'head',injuryOutcome:'fatal',contactY:121}),
    event(3,'ko',{targetId:'b',region:'head',injuryOutcome:'fatal',groundY:230}),
  ]);
  const ground=recorder();fx.drawGround(ground.ctx);ground.done();
  assert(!ground.calls.some(c=>c[0]==='translate'));
  const out=recorder();fx.drawAir(out.ctx);out.done();
  assert.deepEqual(out.calls.filter(c=>c[0]==='translate'),[['translate',100,152],['translate',100,121]]);
  assert.equal(out.calls.filter(c=>c[0]==='fillText').length,0);
  assert.equal(out.calls.filter(c=>c[0]==='closePath').length,1,'only the fatal mark contains a diamond outline');
});

test('blade ink accepts current fighters without global HP and rejects explicitly eliminated or old dead fighters',()=>{
  for(const [liveness,wants] of [[{alive:true,hp:0},true],[{alive:false,hp:20},false],[{hp:0},false],[{hp:20},true],[{},true]]){
    const fx=createArcadeFX();
    fx.sampleBlade({...fighter('soresu',.188),...liveness},blade(46,70));
    fx.update(.017);fx.sampleBlade({...fighter('soresu',.209),...liveness},blade(53,83));
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    assert.equal(out.strokes()>0,wants);
  }
});

test('independent rear, offhand and main trails never bridge across reordered world emitters',()=>{
  for(const [weapon,other] of [['staff','rear'],['dual','off']]){
    const fx=createArcadeFX(), f=t=>({...fighter('soresu',t),gear:{weapon,grip:'backhand'}});
    const main=n=>({id:'main',...blade(60+n,66+n,18+n,70)});
    const second=n=>({id:other,...blade(-38-n,84+n,14+n,72)});
    fx.sampleBlade(f(.198),{blades:[main(0),second(0)]});
    fx.update(.017);
    fx.sampleBlade(f(.219),{blades:[second(2),main(2)]});
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    const edges=[];
    for(let i=0;i<out.calls.length-2;i++) {
      const [a,b,c]=out.calls.slice(i,i+3);
      if(a[0]==='moveTo'&&b[0]==='bezierCurveTo'&&c[0]==='stroke')edges.push([a[1],b[5]]);
    }
    assert(edges.some(([a,b])=>a===60&&b===62));
    assert(edges.some(([a,b])=>a===-38&&b===-40));
    assert(edges.every(([a,b])=>Math.sign(a)===Math.sign(b)));
  }
});

test('offhand independently waits for its later contact and gear changes discard old trails',()=>{
  const fx=createArcadeFX();
  const f=(t,grip='forward')=>({...fighter('makashi',t),gear:{weapon:'dual',grip},attackSpec:{contact:.22,offhand:{contact:.31}},attackSerial:1});
  const world=n=>({blades:[{id:'main',...blade(55+n,80,14+n,75)},{id:'off',...blade(-35-n,88,12+n,74)}]});
  fx.sampleBlade(f(.18),world(0));fx.update(.017);
  fx.sampleBlade(f(.20),world(2));fx.update(.017);
  const before=recorder();fx.drawBladeTrails(before.ctx);before.done();
  assert(!before.calls.some(c=>c[0]==='bezierCurveTo'&&c[5]<0));
  fx.sampleBlade(f(.27),world(4));fx.update(.017);
  fx.sampleBlade(f(.30),world(6));fx.update(.017);
  const both=recorder();fx.drawBladeTrails(both.ctx);both.done();
  assert(both.calls.some(c=>c[0]==='bezierCurveTo'&&c[5]<0));
  fx.sampleBlade(f(.30,'backhand'),world(8));
  const reset=recorder();fx.drawBladeTrails(reset.ctx);reset.done();
  assert.equal(reset.strokes(),0);
});

test('phase transitions break trail history even when entered between attacks',()=>{
  const fx=createArcadeFX();
  const f=t=>({...fighter('makashi',t),saberPhase:'short',gear:{dualPhase:true}});
  fx.sampleBlade(f(.188),blade(46,70)); fx.update(.017);
  fx.sampleBlade(f(.209),blade(53,83)); fx.update(.017);
  const before=recorder();fx.drawBladeTrails(before.ctx);before.done();assert(before.strokes()>0);
  fx.sampleBlade({...f(.212),attack:null,saberPhase:'long'},blade(76,94));
  const after=recorder();fx.drawBladeTrails(after.ctx);after.done();assert.equal(after.strokes(),0);
});

test('authoritative ignition pulses trace each emitter and do not signal a hit or shake',()=>{
  const fx=createArcadeFX();
  fx.observe([event(1,'saber_phase',{fighterId:1,phase:'long',blades:[
    {id:'main',...blade(70,70,20,70)},{id:'rear',...blade(-30,96,20,96)},
  ]})]);
  fx.update(.045);
  const out=recorder();fx.drawAir(out.ctx);out.done();
  assert.deepEqual(out.calls.filter(c=>c[0]==='lineTo').map(c=>c[2]),[70,96]);
  assert(!out.calls.some(c=>c[0]==='fillText'));
  assert.deepEqual(fx.shake(),{x:0,y:0});
  fx.update(.032,true);
  const still=recorder();fx.drawAir(still.ctx);still.done();
  assert.deepEqual(still.calls.filter(c=>c[0]==='translate'),[['translate',20,70],['translate',20,96]]);
});


test('dual trails are outer curves without filled fans and skip unobserved turns or body crossings',()=>{
  const f=t=>({...fighter('juyo',t),gear:{weapon:'dual',grip:'backhand'}});
  const sample=(fx,a,b,body)=>{
    const world=main=>({body,blades:[{id:'main',...main},{id:'off',...blade(-55,90,-15,90)}]});
    fx.sampleBlade(f(.188),world(a));fx.update(.017);
    fx.sampleBlade(f(.209),world(b));
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();return out.calls;
  };
  const genuine=sample(createArcadeFX(),blade(40,70,0,70),blade(34.641,90,0,70),{x:0,y:30});
  const curve=genuine.find(c=>c[0]==='bezierCurveTo');
  assert(curve&&curve[2]>70&&curve[1]>=40,'positive sweep bends on the exterior, not down the chord');
  assert(!genuine.some(c=>c[0]==='fill'||c[0]==='lineTo'),'no filled fan or straight chord');
  const flip=sample(createArcadeFX(),blade(40,70,0,70),blade(-40,70,0,70),{x:0,y:70});
  assert(!flip.some(c=>c[0]==='bezierCurveTo'),'180-degree unobserved flip does not bridge');
  const body=sample(createArcadeFX(),blade(-13,10,0,50),blade(13,10,0,50),{x:0,y:0});
  assert(!body.some(c=>c[0]==='bezierCurveTo'),'rear crossing through the torso is hidden');
});

test('confirmed clash immediately removes multi-weapon ink over the held bind but retains the legacy single trail',()=>{
  const fx=createArcadeFX();
  const f=(id,t,weapon)=>({...fighter('soresu',t),id,gear:{weapon}});
  const world=n=>({blades:[{id:'main',...blade(55+n,80,14+n,75)},{id:'rear',...blade(-35-n,88,12+n,74)}]});
  fx.sampleBlade(f(1,.19,'staff'),world(0));fx.sampleBlade(f(2,.19,'single'),blade(43,70));
  fx.update(.017);
  fx.sampleBlade(f(1,.22,'staff'),world(3));fx.sampleBlade(f(2,.22,'single'),blade(49,75));
  const before=recorder();fx.drawBladeTrails(before.ctx);before.done();
  assert(before.calls.some(c=>c[0]==='bezierCurveTo'));
  fx.observe([event(1,'clash',{aId:1,bId:2})]);
  const after=recorder();fx.drawBladeTrails(after.ctx);after.done();
  assert(!after.calls.some(c=>c[0]==='bezierCurveTo'));
  assert(after.calls.some(c=>c[0]==='lineTo'));
});


test('bright release traces a genuine swing per emitter, but does not invent combat impact',()=>{
  for(const [weapon,grip,secondary] of [
    ['single','forward'],['single','backhand'],['dual','forward','off'],
    ['dual','backhand','off'],['staff','forward','rear'],
  ]){
    const fx=createArcadeFX();
    const sample=(t,n)=>{
      const main={id:'main',...blade(50+n,75,14,72)};
      const other={id:secondary,...blade(-48-n,78,-5,73)};
      fx.sampleBlade({...fighter('juyo',t),gear:{weapon,grip}},
        {blades:secondary?[main,other]:[main]});
    };
    sample(.172,0);fx.update(.017);sample(.186,3);
    const before=recorder();fx.drawBladeTrails(before.ctx);before.done();
    assert(before.strokes()>0);
    assert(!before.paints.some(([color])=>color==='#e8ddd0'));
    fx.update(.017);sample(.222,7);
    const release=recorder();fx.drawBladeTrails(release.ctx);release.done();
    assert.equal(release.paints.filter(([color])=>color==='#e8ddd0').length,secondary==='off'?2:1);
    const impact=recorder();fx.drawAir(impact.ctx);impact.done();
    assert.equal(impact.calls.length,0);
    assert.deepEqual(fx.shake(),{x:0,y:0});
    fx.update(.017,true);
    const still=recorder();fx.drawBladeTrails(still.ctx);still.done();assert.equal(still.strokes(),0);
  }
});

test('real regional contact draws a localized non-gory recoil accent, suppressed in reduced motion',()=>{
  const fx=createArcadeFX();
  fx.observe([event(1,'hit',{region:'torso',injuryTier:1,contactX:104,contactY:148})]);
  fx.update(.036);
  const full=recorder();fx.drawAir(full.ctx);full.done();
  assert.deepEqual(full.calls.filter(c=>c[0]==='translate'),[['translate',104,148]]);
  assert(full.strokes()>2);
  assert(full.calls.filter(c=>['lineTo','moveTo'].includes(c[0])).every(c=>Math.abs(c[1])<28&&Math.abs(c[2])<28));
  fx.update(.017,true);
  const reduced=recorder();fx.drawAir(reduced.ctx);reduced.done();
  assert.equal(reduced.strokes(),2);
  assert.deepEqual(fx.shake(),{x:0,y:0});
});

test('feint is an ink hook oriented toward the feigned line, without a hit, ground sparks or shake',()=>{
  const fx=createArcadeFX();
  fx.observe([event(1,'feint',{face:0,feintBearing:-1.22,fighterId:1})]);
  fx.update(.023);
  const air=recorder();fx.drawAir(air.ctx);air.done();
  assert.deepEqual(air.calls.filter(c=>c[0]==='rotate'),[['rotate',-1.22]]);
  assert(air.calls.some(c=>c[0]==='quadraticCurveTo'));
  assert(!air.calls.some(c=>c[0]==='fill'||c[0]==='fillText'));
  const floor=recorder();fx.drawGround(floor.ctx);floor.done();
  assert(!floor.calls.some(c=>c[0]==='translate'));
  assert.deepEqual(fx.shake(),{x:0,y:0});
});

test('reads distinguish lateral guard lanes and verified riposte uses the supplied contact point',()=>{
  const shapes=['left','center','right'].map(lane=>{
    const fx=createArcadeFX();
    fx.observe([event(1,'read',{guardLane:lane,contactX:113,contactY:120})]);
    fx.update(.033,true);
    const out=recorder();fx.drawAir(out.ctx);out.done();
    assert.deepEqual(out.calls.filter(c=>c[0]==='translate'),[['translate',113,120]]);
    assert(!out.calls.some(c=>c[0]==='fill'||c[0]==='ellipse'));
    assert.deepEqual(fx.shake(),{x:0,y:0});
    return JSON.stringify(out.calls.filter(c=>c[0]==='lineTo'));
  });
  assert.equal(new Set(shapes).size,3);
  const fx=createArcadeFX();
  fx.observe([event(1,'riposte',{contactX:127,contactY:125,region:'torso',injuryTier:2})]);
  fx.update(.03);
  const out=recorder();fx.drawAir(out.ctx);out.done();
  assert.deepEqual(out.calls.filter(c=>c[0]==='translate'),[['translate',127,125]]);
  assert.equal(out.calls.filter(c=>c[0]==='lineTo').length,2);
  assert(!out.calls.some(c=>c[0]==='fill'||c[0]==='fillText'));
  assert.deepEqual(fx.shake(),{x:0,y:0});
});

test('dash wake squashes behind its floor anchor instead of drawing a strike or raised ghost',()=>{
  const fx=createArcadeFX();
  fx.observe([event(1,'dash',{groundY:235,face:.73})]);fx.update(.047);
  const floor=recorder();fx.drawGround(floor.ctx);floor.done();
  assert.deepEqual(floor.calls.filter(c=>c[0]==='translate'),[['translate',100,237]]);
  assert.deepEqual(floor.calls.filter(c=>c[0]==='rotate'),[['rotate',.73]]);
  assert.equal(floor.calls.filter(c=>c[0]==='ellipse').length,2);
  assert(floor.calls.filter(c=>c[0]==='lineTo').every(c=>c[1]<0));
  const air=recorder();fx.drawAir(air.ctx);air.done();
  assert(!air.calls.some(c=>c[0]==='translate'||c[0]==='fill'));
  fx.update(.016,true);
  const quiet=recorder();fx.drawGround(quiet.ctx);quiet.done();assert.equal(quiet.calls.length,0);
});

test('real airborne release adds lift weight on the same blade path, not an extra impact',()=>{
  function record(airPhase,airHeight){
    const fx=createArcadeFX(), sample=(t,n)=>fx.sampleBlade(
      {...fighter('ataru',t),airPhase,airHeight},blade(55+n,68,20,70));
    sample(.194,0);fx.update(.017);sample(.22,5);
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    const air=recorder();fx.drawAir(air.ctx);air.done();
    assert.equal(air.calls.length,0);
    assert.deepEqual(fx.shake(),{x:0,y:0});
    return out;
  }
  const planted=record('grounded',0), takeoff=record('takeoff',12), airborne=record('airborne',22);
  assert.deepEqual(planted.calls,airborne.calls);
  assert.equal(takeoff.paints.find(c=>c[0]==='#e8ddd0')[2],planted.paints.find(c=>c[0]==='#e8ddd0')[2]);
  assert(airborne.paints.find(c=>c[0]==='#e8ddd0')[2]>planted.paints.find(c=>c[0]==='#e8ddd0')[2]);
});

test('only actual takeoff and touchdown make distinct stamped form footprints',()=>{
  const shapes=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'].map(form=>{
    const fx=createArcadeFX(), pose=(phase,pos={})=>({id:'a',alive:true,x:160,y:230,form,airPhase:phase,face:.2,...pos});
    fx.sampleBlade(pose('takeoff'),{});
    let out=recorder();fx.drawGround(out.ctx);out.done();assert.equal(out.calls.length,0);
    fx.update(.017);fx.sampleBlade(pose('airborne',{airHeight:4}),{});
    out=recorder();fx.drawGround(out.ctx);out.done();
    assert.deepEqual(out.calls.filter(c=>c[0]==='translate'),[['translate',160,232]]);
    fx.update(.045);fx.sampleBlade(pose('airborne',{x:185,y:240,airHeight:29}),{});
    const inAir=recorder();fx.drawGround(inAir.ctx);inAir.done();assert.equal(inAir.calls.filter(c=>c[0]==='translate').length,1);
    fx.update(.045);fx.sampleBlade(pose('landing',{x:202,y:240,vx:44,vy:18}),{});
    const landing=recorder();fx.drawGround(landing.ctx);landing.done();
    assert.deepEqual(landing.calls.filter(c=>c[0]==='translate'),[['translate',160,232],['translate',202,242]]);
    const air=recorder();fx.drawAir(air.ctx);air.done();assert.equal(air.calls.length,0);
    assert.deepEqual(fx.shake(),{x:0,y:0});
    fx.update(.033,true);const quiet=recorder();fx.drawGround(quiet.ctx);quiet.done();assert.equal(quiet.calls.length,0);
    return JSON.stringify(out.calls.filter(c=>c[0]==='lineTo'||c[0]==='quadraticCurveTo'));
  });
  assert.equal(new Set(shapes).size,7);
});

test('takeoff footprint burst has a fixed 8 mark cap during crowded matches',()=>{
  const fx=createArcadeFX();
  for(let i=0;i<28;i++)fx.sampleBlade({id:i,x:i+1,y:200,airPhase:'takeoff',alive:true},{});
  fx.update(.012);
  for(let i=0;i<28;i++)fx.sampleBlade({id:i,x:i+1,y:200,airPhase:'airborne',airHeight:3,alive:true},{});
  const out=recorder();fx.drawGround(out.ctx);out.done();
  assert.equal(out.calls.filter(c=>c[0]==='translate').length,8);
});

test('ink release offcut uses only the previous blade tip and stays noncontact',()=>{
  const fx=createArcadeFX();
  fx.sampleBlade(fighter('shii_cho',.194),blade(55,68,20,70));
  fx.update(.017);
  fx.sampleBlade(fighter('shii_cho',.22),blade(66,68,20,70));
  const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
  assert(out.calls.some(([op,x,y])=>op==='moveTo'&&Math.abs(x-46.6)<1e-6&&Math.abs(y-68.48)<1e-6));
  const air=recorder();fx.drawAir(air.ctx);air.done();
  assert.equal(air.calls.length,0);
  assert.deepEqual(fx.shake(),{x:0,y:0});
  fx.update(.017,true);
  const still=recorder();fx.drawBladeTrails(still.ctx);still.done();
  assert.equal(still.calls.length,0);
});

test('linked release adds warm ink weight without adding paint operations or invented impact',()=>{
  function draw(chainFrom,chainDepth){
    const fx=createArcadeFX();
    const f=t=>({...fighter('shii_cho',t),chainFrom,chainDepth});
    fx.sampleBlade(f(.172),blade(51,69));fx.update(.017);
    fx.sampleBlade(f(.198),blade(56,73));
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    const impact=recorder();fx.drawAir(impact.ctx);impact.done();
    assert.equal(impact.calls.length,0);assert.deepEqual(fx.shake(),{x:0,y:0});
    return out;
  }
  const isolated=draw(null,0),linked=draw('sweep',2);
  assert.deepEqual(isolated.calls,linked.calls);
  assert(isolated.paints.some(([color])=>color==='#d1ab78'));
  assert(linked.paints.some(([color])=>color==='#efca94'));
  assert(linked.paints[0][2]>isolated.paints[0][2]);
});

test('staff release accent follows the selected physical end; both visible paths remain separate',()=>{
  function draw(staffLead){
    const fx=createArcadeFX(), kit={weapon:'staff',grip:'forward'};
    const sample=(t,n)=>fx.sampleBlade({...fighter('shii_cho',t),gear:kit,staffLead},{
      blades:[{id:'main',...blade(55+n,70,16,70)},{id:'rear',...blade(-32-n,76,8,75)}],
    });
    sample(.192,0);fx.update(.017);sample(.220,6);
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    assert(out.calls.some(([op,x])=>op==='bezierCurveTo'&&x>0));
    assert(out.calls.some(([op,x])=>op==='bezierCurveTo'&&x<0));
    const air=recorder();fx.drawAir(air.ctx);air.done();assert.equal(air.calls.length,0);
    return out.paints.map(([color])=>color).filter(color=>['#e8ddd0','#d1ab78'].includes(color));
  }
  assert.deepEqual(draw('primary'),['#e8ddd0','#d1ab78']);
  assert.deepEqual(draw('rear'),['#d1ab78','#e8ddd0']);
});

test('weapon flow draws a tight speed ink from real early tip movement, never a hit',()=>{
  function draw(weaponFlow){
    const fx=createArcadeFX();
    fx.sampleBlade({...fighter('shii_cho',.144),weaponFlow},blade(51,67));
    fx.update(.016);
    fx.sampleBlade({...fighter('shii_cho',.159),weaponFlow},blade(65,70));
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    assert.deepEqual(fx.shake(),{x:0,y:0});
    const air=recorder();fx.drawAir(air.ctx);air.done();assert.equal(air.calls.length,0);
    fx.update(.016,true);
    const reduced=recorder();fx.drawBladeTrails(reduced.ctx);reduced.done();
    assert.equal(reduced.calls.length,0);
    return out;
  }
  assert.equal(draw(false).calls.length,0);
  const flow=draw(true);
  assert(flow.calls.some(([op,x,y])=>op==='lineTo'&&x===65&&y===70));
  assert(flow.paints.some(([color])=>color==='#efca94'));
});

test('fast staff follow-through keeps both real tip arcs with no cross-hilt chord',()=>{
  const fx=createArcadeFX();
  const f=t=>({...fighter('shii_cho',t),weaponFlow:true,gear:{weapon:'staff'},staffLead:'rear'});
  const at=(a,b)=>({blades:[{id:'main',...blade(a,70,17,70)},{id:'rear',...blade(b,72,9,72)}]});
  fx.sampleBlade(f(.23),at(51,-38));fx.update(.016);
  fx.sampleBlade(f(.348),at(60,-49));
  const draw=recorder();fx.drawBladeTrails(draw.ctx);draw.done();
  const sweeps=draw.calls.filter(call=>call[0]==='bezierCurveTo');
  assert(sweeps.some(call=>call[5]===60)&&sweeps.some(call=>call[5]===-49));
  assert(sweeps.every(([,x1,,x2,,x])=>Math.sign(x1)===Math.sign(x)&&Math.sign(x2)===Math.sign(x)));
});

test('verified Force releases have distinct localized glyphs without impact or shake',()=>{
  const fx=()=>createArcadeFX();
  const effects=['arcWave','anchor','veil','echoStep','lattice','siphon'];
  const shapes=new Set();
  for(const effect of effects){
    const scene=fx();
    scene.observe([event(1,'expanded_release',{effect})]);
    scene.update(.03,true);
    const out=recorder();scene.drawAir(out.ctx);out.done();
    assert(out.strokes()>0);
    shapes.add(JSON.stringify(out.calls));
    assert.deepEqual(scene.shake(),{x:0,y:0});
  }
  assert.equal(shapes.size,effects.length);
  const scene=fx();
  scene.observe([event(1,'expanded_release',{effect:'not-a-release'})]);
  const out=recorder();scene.drawAir(out.ctx);out.done();
  assert.equal(out.strokes(),0);
});

test('glancing contact gets a small directional scuff rather than the full strike flash',()=>{
  const render=(more,still=false)=>{
    const fx=createArcadeFX();
    fx.observe([event(1,'hit',{region:'torso',targetId:'victim',x:100,y:200,sx:100,sy:160,...more})]);
    fx.update(.034,still);const out=recorder();fx.drawAir(out.ctx);out.done();return out.calls;
  };
  const graze=render({pressureGraze:true}), ordinary=render({});
  assert.ok(graze.some(c=>c[0]==='quadraticCurveTo'));
  assert.ok(graze.some(c=>c[0]==='rotate'&&c[1]===Math.PI/2));
  assert.ok(!ordinary.some(c=>c[0]==='quadraticCurveTo'));
  assert.ok(render({injuryOutcome:'glance'},true).some(c=>c[0]==='quadraticCurveTo'));
  assert.ok(!render({pressureGraze:true,injuryTier:'critical'}).some(c=>c[0]==='quadraticCurveTo'));
});

test('overlapping clean hit wins over a graze in either order; distinct spots and beats stay visible',()=>{
  const render=({firstGraze,secondX=101,delay=.01}={})=>{
    const fx=createArcadeFX();
    const hit=(id,x,pressureGraze)=>event(id,'hit',{x,y:190,contactY:157,targetId:'victim',region:'torso',pressureGraze});
    fx.observe([hit(1,100,firstGraze)]);fx.update(delay);
    fx.observe([hit(2,secondX,!firstGraze)]);fx.update(.013);
    const out=recorder();fx.drawAir(out.ctx);out.done();
    return out.calls.filter(c=>c[0]==='translate').length;
  };
  assert.equal(render({firstGraze:true}),1);
  assert.equal(render({firstGraze:false}),1);
  assert.equal(render({firstGraze:true,secondX:130}),2);
  assert.equal(render({firstGraze:true,delay:.040}),2);
});

test('v4 release ink fades to zero without popping at the end of the wake',()=>{
  const fx=createArcadeFX();
  fx.sampleBlade(fighter('shii_cho',.185),blade(49,55));
  fx.update(.017);
  fx.sampleBlade(fighter('shii_cho',.201),blade(63,62));
  const alpha=()=>{
    const out=recorder();fx.drawBladeTrails(out.ctx);out.done();
    return Math.max(0,...out.paints.map(([,opacity])=>opacity));
  };
  const fresh=alpha();
  fx.update(.040);const mid=alpha();
  fx.update(.059);const tail=alpha();
  assert.ok(fresh>mid&&mid>tail&&tail>0);
  assert.ok(tail<fresh*.035);
  fx.update(.012);assert.equal(alpha(),0);
});

test('v4 clean-hit contact stays quieter than a finishing mark',()=>{
  const render=(injuryOutcome)=>{
    const fx=createArcadeFX();
    fx.observe([event(1,'hit',{targetId:'a',region:'torso',injuryOutcome,contactY:150})]);
    fx.update(.05); const out=recorder();fx.drawAir(out.ctx);out.done();
    return out.calls;
  };
  const clean=render('injury'), end=render('fatal');
  assert.deepEqual(clean.filter(c=>c[0]==='translate'),[['translate',100,150]]);
  assert.deepEqual(end.filter(c=>c[0]==='translate'),[['translate',100,150]]);
  assert.ok(end.filter(c=>c[0]==='lineTo').length>=clean.filter(c=>c[0]==='lineTo').length+4);
});

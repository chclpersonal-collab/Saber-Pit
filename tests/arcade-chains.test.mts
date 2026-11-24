import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,arcadeMovesFor} from '../dist/arcade-engine.js';
const dt=1/120;
const step=(s,n,input={})=>{for(let i=0;i<n;i++)stepArcade(s,dt,input);};
test('manual named attack can follow through to a legal repeat without spoofing the second contact',()=>{
  const s=createArcade({form:'makashi',teamForms:['makashi','makashi'],startingRanks:['SSS','SSS'],seed:17}), [p,e]=s.fighters;
  Object.assign(p,{x:480,y:300});Object.assign(e,{x:550,y:300,think:300,action:'stagger',actionDuration:30});
  const name=arcadeMovesFor(p.form,p.career.gradeIndex).find(x=>x.role==='light').id;
  step(s,1,{technique:name,aimX:e.x,aimY:e.y});
  assert.equal(p.chainDepth,1);
  step(s,18);step(s,1,{technique:name,aimX:e.x,aimY:e.y});
  for(let i=0;i<60&&p.chainDepth<2;i++)step(s,1);
  assert.equal(p.chainDepth,2);assert.equal(p.chainFrom,name);assert.equal(p.attack,name);
  assert.equal(p.contact,false);assert.ok(p.poseFrom?.hand&&p.poseFrom?.tip);
  assert.equal(p.poseFrom.kind,'chain');assert.ok(p.poseEntryDuration<p.attackSpec.contact);
  const before=p.stats.saberHits;
  step(s,Math.ceil(p.attackSpec.contact/dt)+1);
  assert.ok(p.stats.saberHits>=before);
  assert.ok(s.events.some(ev=>ev.chainDepth===2&&ev.chainFrom===name&&ev.technique===name));
});
test('equal elite bots perform both actual repeated and varied chains',()=>{
  const s=createArcade({mode:'watch',form:'juyo',teamForms:['juyo','juyo'],startingRanks:['SSS+V','SSS+V'],seed:5,limit:45});
  let id=0,repeats=0,variations=0;
  for(let i=0;i<2701&&s.phase==='playing';i++){
    stepArcade(s,1/60);
    for(const e of s.events)if(e.id>id){
      id=e.id;if(e.chainDepth>1&&e.contact>0){
        if(e.chainFrom===e.technique)repeats++;else variations++;
      }
    }
  }
  assert.ok(repeats>0);assert.ok(variations>0);assert.ok(s.time>=38.25);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeFloatingText} from '../dist/arcade-floating-text.js';
const f=(id,x=220,y=330)=>({id,x,y,airHeight:15,chessStyle:'rook'});
const event=(id,fighterId,kind,extra={})=>({id,fighterId,kind,x:880,y:620,...extra});
function canvas(){
 const fills=[],strokes=[];
 const ctx={globalAlpha:1,save(){},restore(){},strokeText(text,x,y,width){strokes.push({text,x,y,width});},
   fillText(text,x,y,width){fills.push({text,x,y,width,alpha:this.globalAlpha,color:this.fillStyle});}};
 return {ctx,fills,strokes};
}
test('move and chess subtitle emit at the performing fighter, then rise and fade',()=>{
 const fx=createArcadeFloatingText(),fighter=f('actor');
 const hit=event(1,'actor','rush',{technique:'thrust',contact:.19});
 const all=[hit],roster=[fighter],before=structuredClone([all,roster]);
 fx.update(0,all,roster);
 const a=canvas();fx.draw(a.ctx);
 assert.deepEqual(a.fills.map(t=>t.text),['LINEAR THRUST','ROOK STYLE']);
 assert.equal(a.fills[0].x,220);assert.equal(a.fills[0].y,330-15-83);assert.ok(a.fills[0].color.startsWith('#ff'));
 assert.equal(a.strokes.length,2);
 fx.update(.25,all,roster);fx.update(.25,all,roster);
 const b=canvas();fx.draw(b.ctx);assert.ok(b.fills[0].y<a.fills[0].y-10);assert.ok(b.fills[0].alpha<1);
 fx.update(.25,all,roster);const c=canvas();fx.draw(c.ctx);assert.deepEqual(c.fills,[]);
 assert.deepEqual([all,roster],before);
});
test('reduced motion stays at the original height and still disappears',()=>{
 const fx=createArcadeFloatingText(),actor=f('p'),parry=event(1,actor.id,'parry');
 fx.update(0,[parry],[actor]);const first=canvas();fx.draw(first.ctx,{reducedMotion:true});
 assert.equal(first.fills[0].text,'PARRY');
 for(let i=0;i<3;i++)fx.update(.25,[],[actor]);
 const tail=canvas();fx.draw(tail.ctx,{reducedMotion:true});
 assert.equal(tail.fills[0].y,first.fills[0].y);assert.ok(tail.fills[0].alpha<.8);
 fx.update(.25,[],[actor]);fx.draw(tail.ctx,{reducedMotion:true});assert.equal(tail.fills.length,1);
});
test('multiple markers stay bound and share space without stacking; focused actor wins small cues',()=>{
 const fx=createArcadeFloatingText(),actors=Array.from({length:10},(_,i)=>f('b'+i,205+i,330+i));
 const simultaneous=actors.map((actor,i)=>event(i+1,actor.id,'parry'));
 const n=fx.update(0,simultaneous,actors,{focusId:actors[0].id});
 assert.ok(n<=6&&n>=2);
 const a=canvas();fx.draw(a.ctx);
 const positions=a.fills.map(x=>x.y).sort((a,b)=>a-b);assert.ok(positions.every((p,i)=>!i||p-positions[i-1]>15));
 fx.reset();
 const move=(id,actor)=>event(id,actor.id,'rush',{technique:'thrust',contact:.19});
 fx.update(0,[move(1,actors[2])],actors,{focusId:actors[1].id});
 assert.equal(fx.update(.1,[move(2,actors[1])],actors,{focusId:actors[1].id}),1);
 const b=canvas();fx.draw(b.ctx);assert.equal(b.fills[0].x,actors[1].x);
 assert.equal(fx.update(.03,[event(3,actors[1].id,'parry')],actors,{focusId:actors[1].id}),1);
 const parry=canvas();fx.draw(parry.ctx);assert.deepEqual(parry.fills.map(p=>p.text),['PARRY']);
});

import test from 'node:test';
import assert from 'node:assert/strict';

/** Just enough DOM for the two-player touch pads: listeners, captures, dataset and a fixed 100px box. */
class Node0 {
  children: Node0[]=[];dataset: Record<string,string>={};style: Record<string,string>={};hidden=false;id='';className='';textContent='';type='';
  listeners=new Map<string,((e:unknown)=>void)[]>();captured=new Set<number>();released: number[]=[];
  append(...n: Node0[]){this.children.push(...n);}
  setAttribute(){}
  addEventListener(t: string,f: (e:unknown)=>void){this.listeners.set(t,[...(this.listeners.get(t)??[]),f]);}
  fire(t: string,e: Record<string,unknown>){for(const f of this.listeners.get(t)??[])f({preventDefault(){},...e});}
  setPointerCapture(id: number){this.captured.add(id);}
  releasePointerCapture(id: number){this.captured.delete(id);this.released.push(id);}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  querySelectorAll(){return [];}
  all(): Node0[]{return this.children.flatMap(c=>[c,...c.all()]);}
}

test('a controller taking over Pink drops only Pink’s touch; Blue keeps moving', async () => {
  const saved=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new Node0()}});
  try{
    const {mountVersusTouch}=await import('../dist/arcade-vs-touch.js');
    const host=new Node0(),vs=mountVersusTouch(host as unknown as HTMLElement);
    vs.sync([true,true],false);
    const [pad1,pad2]=vs.pads as unknown as Node0[];
    const stick=(p: Node0)=>p.all().find(n=>n.className==='vs-stick')!;
    const button=(p: Node0,a: string)=>p.all().find(n=>n.dataset.p===a)!;
    // Blue pushes right on the stick; Pink holds Guard and pushes left.
    stick(pad1!).fire('pointerdown',{pointerId:1,clientX:100,clientY:50});
    button(pad2!,'guard').fire('pointerdown',{pointerId:2});
    stick(pad2!).fire('pointerdown',{pointerId:3,clientX:0,clientY:50});
    assert.ok(vs.players[1].held.has('guard')&&vs.players[1].stick.x<0);
    // A controller plugs in for Pink: Pink's pad hides, Blue stays on touch.
    vs.sync([true,false],false);
    assert.equal(vs.shown(1),false);assert.equal(vs.shown(0),true);
    assert.equal(vs.players[1].held.size,0);assert.deepEqual(vs.players[1].stick,{x:0,y:0});
    assert.ok(button(pad2!,'guard').released.includes(2)&&stick(pad2!).released.includes(3),'Pink’s captures are let go');
    // Pink's fingers still moving on the hidden pad change nothing.
    stick(pad2!).fire('pointermove',{pointerId:3,clientX:0,clientY:0});
    assert.deepEqual(vs.players[1].stick,{x:0,y:0});
    // Blue never let go and still moves.
    assert.ok(vs.players[0].stick.x>0);
    stick(pad1!).fire('pointermove',{pointerId:1,clientX:50,clientY:100});
    assert.ok(vs.players[0].stick.y>0);
  }finally{if(saved)Object.defineProperty(globalThis,'document',saved);else delete (globalThis as {document?:unknown}).document;}
});

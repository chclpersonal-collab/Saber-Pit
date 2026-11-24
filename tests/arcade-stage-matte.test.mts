import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeStageMatteBands,paintArcadeStageMatte} from '../dist/arcade-stage-matte.js';
test('portrait backdrop paints margins only; exact 16:9 and stage overscan do no work',()=>{
 assert.equal(arcadeStageMatteBands(720,0,720),null);
 assert.equal(arcadeStageMatteBands(720,-4,840),null);
 assert.equal(arcadeStageMatteBands(720,NaN,0),null);
 assert.deepEqual(arcadeStageMatteBands(844,222,399),{top:222,bottom:621});
 const previous=globalThis.document;
 const calls:unknown[][]=[];
 let n=0;
 const c={getContext:()=>({createLinearGradient:()=>({addColorStop(){}}),fillRect(){}})};
 const ctx={drawImage(...args:unknown[]){calls.push(args);}} as unknown as CanvasRenderingContext2D;
 globalThis.document={createElement(){n++;return {...c};}} as unknown as Document;
 try{
   paintArcadeStageMatte(ctx,'ember_ring',1280,720,0,720);
   assert.equal(n,0);
   for(let i=0;i<120;i++)paintArcadeStageMatte(ctx,'ember_ring',390,844,222,399);
   assert.equal(n,2);
   assert.equal(calls.length,240);
   assert.deepEqual(calls[0].slice(1),[0,0,390,222]);
   assert.deepEqual(calls[1].slice(1),[0,621,390,223]);
   assert.equal(calls[0][0],calls[238][0]);
   assert.equal(calls[1][0],calls[239][0]);
 }finally{globalThis.document=previous;}
});

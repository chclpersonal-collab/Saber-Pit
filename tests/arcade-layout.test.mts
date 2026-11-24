import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdedFighters,sharesSilhouette} from '../dist/arcade-layout.js';
test('fighter outlines respond to visual overlap, including an airborne silhouette',()=>{
 const a={id:'a',x:100,y:100,hp:100},b={id:'b',x:112,y:162,hp:100},c={id:'c',x:205,y:171,hp:100};
 assert.deepEqual([...crowdedFighters([a,b,c])],['a','b']);
 assert.equal(sharesSilhouette(a,{...b,y:210}),false);
 assert.equal(sharesSilhouette(a,{...b,y:210,airHeight:51}),true);
 assert.equal(sharesSilhouette(a,{...b,hp:0}),false);
});

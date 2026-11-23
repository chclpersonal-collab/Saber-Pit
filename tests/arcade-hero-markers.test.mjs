import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeHeroMarkers} from '../dist/arcade-hero-markers.js';
const f=(id,extra={})=>({pose:{id,alive:true,...extra},anchor:{x:90,y:210}});
test('only live deployed heroes get a badge, with collision-free placement in small viewports',()=>{
 const markers=arcadeHeroMarkers([
   f('ordinary',{grade:'SSS+V',displayName:'Tseo'}), f('old',{heroId:'old',alive:false}),
   f('blue',{heroId:'one',team:0}), f('pink',{heroId:'two',team:1})
 ],{scale:2,scaleY:1.5,x:5,y:10},145,300,2);
 assert.deepEqual(markers.map(p=>p.id),['blue','pink']);
 assert(markers.every(p=>p.x>=24&&p.x<=121&&p.y>=66&&p.y<=288));
 assert(Math.abs(markers[0].x-markers[1].x)>=44||Math.abs(markers[0].y-markers[1].y)>=20);
});

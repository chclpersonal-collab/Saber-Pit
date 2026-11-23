import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_MOTION_KEY,readArcadeReducedMotion,saveArcadeReducedMotion} from '../dist/arcade-motion-preference.js';
test('Saber Pit uses full motion unless the player explicitly enables reduced motion',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  assert.equal(readArcadeReducedMotion(storage),false);
  assert.equal(saveArcadeReducedMotion(true,storage),true);
  assert.equal(data.get(ARCADE_MOTION_KEY),'reduced');
  assert.equal(readArcadeReducedMotion(storage),true);
  saveArcadeReducedMotion(false,storage);
  assert.equal(readArcadeReducedMotion(storage),false);
  data.set(ARCADE_MOTION_KEY,'corrupt');
  assert.equal(readArcadeReducedMotion(storage),false);
  const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readArcadeReducedMotion(blocked),false);
  assert.equal(saveArcadeReducedMotion(true,blocked),false);
});

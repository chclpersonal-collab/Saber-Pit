import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleArcadeFighter} from '../dist/arcade-fighters.js';

test('idle breathing and weight shift move the live upper body without sliding the planted feet',()=>{
  const fighter={id:'0-0', action:'idle', form:'makashi', face:0, liveEntry:true};
  const a=sampleArcadeFighter(fighter,0), b=sampleArcadeFighter(fighter,.66);
  assert.notDeepEqual(a.head,b.head);
  assert.notDeepEqual(a.hand,b.hand);
  assert.deepEqual(a.legs.map(leg=>leg.foot),b.legs.map(leg=>leg.foot));
  const reduced={reducedMotion:true};
  const c=sampleArcadeFighter(fighter,0,reduced),d=sampleArcadeFighter(fighter,.66,reduced);
  assert.deepEqual(c.head,d.head);
  assert.deepEqual(c.hand,d.hand);
});

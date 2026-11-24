import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARCADE_BODY_REGIONS} from '../dist/arcade-injuries.js';
import {ARCADE_BODY_STAMINA,arcadeBodyStaminaReward} from '../dist/arcade-stamina.js';

test('every injury region has a fixed stamina reward, symmetric across sides',()=>{
  assert.deepEqual(ARCADE_BODY_REGIONS.map(({id})=>arcadeBodyStaminaReward(id)),[6,4,3,3,5,5]);
  assert.equal(Object.isFrozen(ARCADE_BODY_STAMINA),true);
  for(const missing of [undefined,'toString','__proto__','unknown',{}])assert.equal(arcadeBodyStaminaReward(missing),0);
});

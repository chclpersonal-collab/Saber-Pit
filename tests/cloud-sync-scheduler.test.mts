import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudSyncScheduler} from '../dist/cloud-sync-scheduler.js';

test('save notifications are grouped, and a local save after snapshot starts another request',async()=>{
  let enabled=true,started=0;
  const queue=new Map(),pending=[];
  const observed=[];
  const runner=createCloudSyncScheduler({canSync:()=>enabled,sync:()=>new Promise(resolve=>{started++;pending.push(resolve);}),observe:r=>observed.push(r.status),
    schedule:fn=>{const id=Symbol();queue.set(id,fn);return id;},cancel:id=>queue.delete(id)});
  runner.trigger();runner.trigger();
  assert.equal(queue.size,1);
  runner.flush();
  assert.equal(queue.size,0);
  assert.equal(started,1);
  runner.trigger();runner.trigger();
  assert.equal(started,1);
  pending.shift()({status:'current'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(queue.size,1);
  runner.flush();
  assert.equal(started,2);
  enabled=false;
  pending.shift()({status:'disabled'});
  await new Promise(resolve=>setImmediate(resolve));
  runner.trigger();runner.flush();
  assert.equal(started,2);
  assert.deepEqual(observed,['current','disabled']);
});

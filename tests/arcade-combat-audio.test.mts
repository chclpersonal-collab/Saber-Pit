import test from 'node:test';
import assert from 'node:assert/strict';
import {combatCue,createArcadeCombatAudio,synthesizeCombatCue} from '../dist/arcade-combat-audio.js';

const event=(kind,id=1,more={})=>({id,kind,time:.5,x:64,...more});
test('arena sound distinguishes committed blade air, armour, parry, bind and a fall',()=>{
  assert.deepEqual(['slash','heavy','hit','block','parry','clash','ko','force','dash','read'].map(kind=>
    combatCue(event(kind,1,kind==='slash'||kind==='heavy'?{contact:.2,duration:kind==='slash'?.4:.65}:{}))),
    ['sweep','heavy','body','guard','parry','clash','down','force','move',null]);
  assert.equal(combatCue(event('slash',1,{contact:0,offhand:true})),'sweep');
  assert.equal(combatCue(event('stamina_hit')),null);
});
test('original Foley samples have distinct, bounded transient-and-tail waveforms',()=>{
  const sampleRate=24000;
  const samples=['sweep','heavy','body','parry','clash','down'].map(cue=>synthesizeCombatCue(cue,sampleRate));
  for(const data of samples){
    assert.equal(data[0],0);
    assert.ok(data.every(x=>Number.isFinite(x)&&Math.abs(x)<=1));
    assert.ok(data.some(x=>Math.abs(x)>.12));
    assert.ok(Math.abs(data.at(-1))<.003);
  }
  assert.notDeepEqual(samples[3].slice(30,600),samples[4].slice(30,600));
  assert.deepEqual(synthesizeCombatCue('body',sampleRate),samples[2]);
});
function rig(){
  const starts=[],stops=[],ramps=[],pans=[],buffers=[];
  const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(n){ramps.push(n);},setValueAtTime(n){this.value=n;}});
  const node=()=>({connect(n){return n;},disconnect(){}});
  const context={
    sampleRate:24000,state:'running',currentTime:0,destination:{},
    async resume(){},
    createGain(){return {...node(),gain:param()};},
    createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};},
    createStereoPanner(){const x={...node(),pan:param()};pans.push(x.pan);return x;},
    createBuffer(_channels,len){const b={len,copyToChannel(){}};buffers.push(b);return b;},
    createBufferSource(){return {...node(),buffer:null,playbackRate:param(),onended:null,start(at){starts.push({len:this.buffer.len,at});},stop(){stops.push(this);this.onended?.();}};},
  };
  return {context,starts,stops,ramps,pans,buffers};
}
const view={center:64,halfWidth:64};
test('real event batches prioritize impacts, cache PCM, spatialize, and respect mute',async()=>{
  const h=rig(), audio=createArcadeCombatAudio(()=>h.context);
  const events=[event('slash',1,{contact:.20,x:0}),event('hit',2),event('parry',3),event('ko',4,{x:128}),event('dash',5),event('dash',6)];
  const before=structuredClone(events);
  audio.playEvents(events,view);assert.equal(h.starts.length,0);
  assert.equal(await audio.setEnabled(true),true);
  audio.playEvents(events,view);
  assert.equal(h.starts.length,4);
  assert.equal(h.starts[0].at,.048,'fall follows the hit');
  assert.equal(h.starts[3].at,.20*.58-.045,'air swell anticipates contact');
  assert.equal(h.pans[0].value,.7);assert.equal(h.pans[3].value,-.7);
  assert.deepEqual(events,before);
  audio.stopEvents();assert.equal(h.stops.length,4);
  audio.playEvents(events,view);assert.equal(h.buffers.length,4,'reuses one sample per cue');
  assert.equal(await audio.setEnabled(false),false);
  assert.equal(h.ramps.at(-1),0);
  audio.playEvents(events,view);assert.equal(h.starts.length,8);
});
test('crowds cap overlapping voices and a knockout can cut through lower-priority sounds',async()=>{
  const h=rig(),audio=createArcadeCombatAudio(()=>h.context);
  await audio.setEnabled(true);
  for(let i=0;i<40;i++)audio.playEvents([event('slash',i,{contact:.2})],view);
  assert.equal(h.starts.length,10);
  audio.playEvents([event('ko',90)],view);
  assert.equal(h.starts.length,11);assert.equal(h.stops.length,1);
});
test('failed audio permission never leaks playback or interrupts the arena',async()=>{
  const audio=createArcadeCombatAudio(()=>{throw Error('unavailable');});
  assert.equal(await audio.setEnabled(true),false);
  assert.doesNotThrow(()=>audio.playEvents([event('ko')],view));
});

/** LOOMEN's original procedural combat Foley. Samples are cached per audio context; no media assets. */
const cueInfo = {
  sweep: {seconds:.23, priority:1, gain:.48}, heavy: {seconds:.32,priority:2,gain:.58},
  body: {seconds:.22,priority:4,gain:.79}, guard: {seconds:.24,priority:4,gain:.66},
  parry: {seconds:.32,priority:5,gain:.60}, clash: {seconds:.41,priority:5,gain:.69},
  break: {seconds:.35,priority:6,gain:.75}, down: {seconds:.51,priority:7,gain:.85},
  move: {seconds:.16,priority:0,gain:.39}, force: {seconds:.35,priority:3,gain:.54},
  ignite: {seconds:.25,priority:3,gain:.52},
} as const;
export type CombatCue = keyof typeof cueInfo;
export type CombatAudioEvent = {id:number;kind:string;x:number;time:number;contact?:number;duration?:number;offhand?:boolean;perfect?:boolean;damage?:number;region?:string;forceAbility?:string;weapon?:string;blade?:string};
export type CombatAudioView = {center:number;halfWidth:number};
const tau = Math.PI*2;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(x,b));

/** Contact events take precedence over motion and never infer a strike from a sprite pose. */
export function combatCue(event: CombatAudioEvent): CombatCue|null {
  switch(event.kind){
    case 'hit': case 'launch': case 'hazard': return 'body';
    case 'block': case 'force_ward': return 'guard';
    case 'parry': case 'rank_deflect': return 'parry';
    case 'clash': return 'clash';
    case 'break': return 'break';
    case 'ko': return 'down';
    case 'dash': case 'jump': return 'move';
    case 'saber_phase': case 'trakata_on': case 'trakata_off': return 'ignite';
    case 'force': return 'force';
    case 'free_hand': return 'move';
    default: return event.contact==null&&event.offhand!==true?null:(event.duration??0)>=.52?'heavy':'sweep';
  }
}

/** Noise envelopes supply air and cloth; damped modes give steel/energy its ringing tail.
 * The two-knock fall reads as body first, equipment second. There is no forever-running hum. */
export function synthesizeCombatCue(cue:CombatCue, rate:number):Float32Array<ArrayBuffer> {
  const samples=new Float32Array(Math.ceil(cueInfo[cue].seconds*rate));
  let entropy=0x21f0aaad, damp=0, air=0;
  const ring=(t:number,f:number,d:number)=>Math.sin(t*tau*f)*Math.exp(-t*d);
  for(let i=0;i<samples.length;i++){
    const t=i/rate, p=t/cueInfo[cue].seconds;
    entropy^=entropy<<13; entropy^=entropy>>>17; entropy^=entropy<<5;
    const noise=(entropy>>>0)/0x80000000-1;
    damp+=.14*(noise-damp);air+=.54*(noise-air);
    const hiss=air-damp, pulse=Math.exp(-t*51);
    const tap=(at:number,f:number,d:number)=>{
      const u=t-at;return u<0?0:ring(u,f,d)*Math.min(1,u*900);
    };
    let val=0;
    switch(cue){
      case 'sweep': case 'heavy': {
        const h=cue==='heavy';
        const arch=Math.sin(Math.PI*p)**(h?1.3:1.8);
        const pitch=h?210:345, slide=h?150:240;
        val=arch*(hiss*.8+damp*.28+Math.sin(tau*(pitch*t-.5*slide*t*p))*.10);
        break;
      }
      case 'body':
        val=.44*ring(t,71,20)+.13*ring(t,132,33)+pulse*(damp*.50+hiss*.18);
        break;
      case 'guard':
        val=.29*ring(t,157,25)+.11*ring(t,778,26)+.10*ring(t,1351,32)+pulse*hiss*.64;
        break;
      case 'parry':
        val=.18*ring(t,734,11)+.21*ring(t,1391,15)+.10*ring(t,2339,20)+pulse*hiss*.55;
        break;
      case 'clash':
        val=.19*ring(t,293,12)+.20*ring(t,944,8)+.12*ring(t,1651,15)+.07*ring(t,2791,22)+
          Math.exp(-t*18)*hiss*(.35+.29*Math.sin(tau*t*81)**2);
        break;
      case 'break':
        val=.41*ring(t,93,19)+.15*ring(t,977,17)+pulse*hiss*.65+.27*tap(.042,47,22);
        break;
      case 'down':
        val=.47*ring(t,55,15)+pulse*damp*.56+.20*tap(.101,112,27)+.13*tap(.128,488,28)+.11*tap(.137,1229,38);
        break;
      case 'move':
        val=Math.sin(Math.PI*p)**2*(damp*.44+hiss*.28);
        break;
      case 'force':
        val=Math.sin(Math.PI*p)**2*(damp*.56+.36*Math.sin(tau*(143*t+100*t*p)));
        break;
      case 'ignite':
        val=Math.sin(Math.PI*p)**1.3*(hiss*.34+.23*Math.sin(tau*(120*t+245*t*p)));
        break;
    }
    samples[i]=clamp(val*Math.min(1,t*800,(1-p)*19),-.94,.94);
  }
  return samples;
}

const MAX_VOICES=10, FRAME_BUDGET=4;
const factory=()=>{
  const web=globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext};
  const Audio=web.AudioContext??web.webkitAudioContext;
  return Audio?new Audio():null;
};
export function createArcadeCombatAudio(contextFactory:()=>AudioContext|null=factory){
  let audio:AudioContext|null=null, master:GainNode|null=null, speedMix:DynamicsCompressorNode|null=null;
  let enabled=false, token=0;
  const cache=new Map<CombatCue,AudioBuffer>();
  const voices=new Set<{source:AudioBufferSourceNode;priority:number}>();
  function volume(value:number){
    if(!audio||!master)return;
    const t=audio.currentTime;
    master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(value,t,.011);
  }
  async function setEnabled(next:boolean){
    const request=++token;
    enabled=false;volume(0);
    if(!next){stopEvents();return false;}
    try {
      audio??=contextFactory();
      if(!audio)return false;
      if(!master){
        master=audio.createGain();master.gain.value=0;
        speedMix=audio.createDynamicsCompressor();
        speedMix.threshold.value=-19;speedMix.knee.value=10;speedMix.ratio.value=5;speedMix.attack.value=.004;speedMix.release.value=.11;
        master.connect(speedMix).connect(audio.destination);
      }
      await audio.resume();
      if(token!==request)return enabled;
      enabled=audio.state==='running';volume(enabled?.63:0);
    }catch{if(token===request)enabled=false;}
    return enabled;
  }
  function play(cue:CombatCue,event:CombatAudioEvent,view:CombatAudioView){
    if(!audio||!master)return;
    const {gain,priority}=cueInfo[cue];
    if(voices.size>=MAX_VOICES){
      const oldest=[...voices].find(voice=>voice.priority<priority-1);
      if(!oldest)return;
      oldest.source.stop();voices.delete(oldest);
    }
    let buffer=cache.get(cue);
    if(!buffer){const pcm=synthesizeCombatCue(cue,audio.sampleRate);buffer=audio.createBuffer(1,pcm.length,audio.sampleRate);buffer.copyToChannel(pcm,0);cache.set(cue,buffer);}
    const source=audio.createBufferSource(), level=audio.createGain(), t=audio.currentTime;
    const pan=clamp((event.x-view.center)/Math.max(1,view.halfWidth),-1.8,1.8);
    const variant=((Math.imul(event.id,2654435761)>>>0)/4294967296-.5)*.18;
    const regionPitch=cue==='body'?(event.region==='head'?.12:event.region?.includes('leg')?-.11:0):0;
    const orbitPitch=event.weapon==='orbit'&&(cue==='sweep'||cue==='heavy')?
      (event.blade==='orbit_third'?.24:event.offhand?.16:.09):0;
    source.buffer=buffer;source.playbackRate.value=(1+variant+regionPitch+orbitPitch)*(event.perfect?1.12:1);
    const contactGain=cue==='body'&&event.damage!=null?clamp(.65+event.damage*.013,.66,1.17):1;
    const gainValue=gain*(event.offhand?.79:1)*contactGain*(1-Math.min(1.8,Math.abs(pan))*.27);
    level.gain.setValueAtTime(gainValue,t);source.connect(level);
    const stereo=typeof audio.createStereoPanner==='function'?audio.createStereoPanner():null;
    if(stereo){stereo.pan.value=clamp(pan*.7,-.88,.88);level.connect(stereo).connect(master);}
    else level.connect(master);
    const voice={source,priority};voices.add(voice);
    source.onended=()=>{voices.delete(voice);source.disconnect();level.disconnect();stereo?.disconnect();};
    const lead=cue==='sweep'||cue==='heavy'?clamp((event.contact??0)*.58-.045,0,.1):cue==='down'?.048:0;
    source.start(t+lead);
  }
  function playEvents(events:readonly CombatAudioEvent[],view:CombatAudioView){
    if(!enabled||audio?.state!=='running'||!events.length)return;
    const sorted=events.flatMap(event=>{const cue=combatCue(event);return cue?[{cue,event}]:[];})
      .sort((a,b)=>cueInfo[b.cue].priority-cueInfo[a.cue].priority||a.event.id-b.event.id);
    const sounds=new Set<string>();
    for(const {cue,event} of sorted){
      const key=(cue==='clash'||cue==='parry'?'blade':cue)+':'+Math.floor(event.time*60)+':'+Math.round(event.x/24);
      if(sounds.has(key))continue;
      try{play(cue,event,view);}catch{/* Audio must never interrupt simulation. */}
      sounds.add(key);if(sounds.size>=FRAME_BUDGET)break;
    }
  }
  function stopEvents(){
    for(const voice of voices){try{voice.source.stop();}catch{/* already stopped */}}
    voices.clear();
  }
  return {setEnabled,playEvents,stopEvents,get enabled(){return enabled;}};
}

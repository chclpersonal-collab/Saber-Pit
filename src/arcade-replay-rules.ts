// Tournament replay results depend on the exact 120-Hz combat and blade poses
// used to record them. Load recorded older rules only on demand.
import * as engine from './arcade-engine.js?v=5.1.0';
import * as art from './arcade-fighters.js?v=5.0.0';

import {drawArcadeFighter} from './arcade-painter.js?v=5.0.0';

// Archived runtimes intentionally remain immutable browser JS modules.
type PlaybackEngine=Pick<typeof engine,'createArcade'|'stepArcade'>;
type PlaybackRig=Pick<typeof art,'sampleArcadeFighter'|'arcadeBladeWorld'|'drawArcadeFighter'>;
const archive=<T>(path:string): Promise<T>=>import(path);
const recordings:Record<number,()=>Promise<[PlaybackEngine,PlaybackRig]>>={
  226:()=>Promise.all([archive<PlaybackEngine>('./arcade-rules-v226/arcade-engine.js'),archive<PlaybackRig>('./arcade-rules-v226/arcade-fighters.js')]),
  223:()=>Promise.all([archive<PlaybackEngine>('./arcade-rules-v223/arcade-engine.js?v=2.45.0'),archive<PlaybackRig>('./arcade-rules-v223/arcade-fighters.js?v=2.44.0')]),
  222:()=>Promise.all([archive<PlaybackEngine>('./arcade-rules-v222/arcade-engine.js?v=2.45.0'),archive<PlaybackRig>('./arcade-rules-v222/arcade-fighters.js?v=2.44.0')]),
  219:()=>Promise.all([archive<PlaybackEngine>('./arcade-rules-v219/arcade-engine.js?v=2.45.0'),archive<PlaybackRig>('./arcade-rules-v219/arcade-fighters.js?v=2.44.0')]),
  220:()=>Promise.all([archive<PlaybackEngine>('./arcade-rules-v220/arcade-engine.js?v=2.45.0'),archive<PlaybackRig>('./arcade-rules-v220/arcade-fighters.js?v=2.44.0')]),
  221:()=>Promise.all([archive<PlaybackEngine>('./arcade-rules-v221/arcade-engine.js?v=2.45.0'),archive<PlaybackRig>('./arcade-rules-v221/arcade-fighters.js?v=2.44.0')]),
};
export async function arcadeReplayRules(version=0){
  if(!version)return {...engine,...art,drawArcadeFighter};
  if(!Object.hasOwn(recordings,version))throw new RangeError('Unknown Arcade replay rules.');
  const [combat,geometry]=await recordings[version]();
  return {...combat,...geometry};
}

export const supportsArcadeReplay=(ruleset:number,min:number,max:number)=>Number.isInteger(ruleset)&&ruleset>=min&&ruleset<=max;

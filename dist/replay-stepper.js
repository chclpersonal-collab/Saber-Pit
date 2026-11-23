/** Presentation only: every pace feeds the exact same fixed simulation tick.
 * Long frames carry excess work forward instead of throwing away a fight tick. */
export const REPLAY_SPEEDS=Object.freeze([.25,.5,1,2,4,8]);
export const REPLAY_TICK=1/120;
const MAX_FRAME_STEPS=72;
export function normalizeReplaySpeed(value){return REPLAY_SPEEDS.includes(Number(value))?Number(value):1;}
export function createReplayStepper({speed=1,playing,step,sample=()=>null}){
 let pace=normalizeReplaySpeed(speed),remainder=0,previous=null;
 return {
  setSpeed(value){pace=normalizeReplaySpeed(value);return pace;},
  get speed(){return pace;},
  get remainder(){return remainder;},
  get previous(){return previous;},
  advance(seconds){
   remainder+=Number.isFinite(seconds)?Math.max(0,seconds)*pace:0;
   const count=Math.min(MAX_FRAME_STEPS,Math.floor((remainder+1e-9)/REPLAY_TICK));
   let advanced=0;
   for(;advanced<count&&playing();advanced++){
    if(advanced===count-1)previous=sample();
    step(REPLAY_TICK);
   }
   remainder=Math.max(0,remainder-advanced*REPLAY_TICK);
   if(!playing()){previous=null;remainder=0;}
   return advanced;
  },
 };
}

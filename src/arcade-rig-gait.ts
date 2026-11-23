/** Distance-driven limb cadence for the physical and paint rigs. */
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const val=(n?:number)=>Number.isFinite(n)?n!:0;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
const phase=(n:number)=>((n%1)+1)%1;
/* Far-to-near alternating gait. In the contact half, ankle travels backward at
   exactly -1px per 1px root travel, so the support foot holds in world space.
   In the swing half, it clears the ground and moves to the next heel strike. */
export function arcadeFoot(distance:number, offset=0, stride=58) {
  const p=phase(val(distance)/stride+offset);
  if(p<.5) {
    const q=p*2;
    return {reach:stride*(.25-p),lift:0,sole:mix(-.23,.31,smooth(q)),planted:true};
  }
  const q=(p-.5)*2;
  return {reach:mix(-stride*.25,stride*.25,smooth(q)),lift:Math.sin(Math.PI*q)**1.12*14,sole:mix(.31,-.23,smooth(q)),planted:false};
}
// One distance clock across both gaits, so accelerating from a walk can never
// re-start the step or teleport the feet. Stance length is > 50% in a walk
// (double support) and < 50% in a run (a brief suspension between contacts).
export const GAIT_STRIDE=106;
export function arcadeGait(distance:number,step=0,running=0) {
  const run=clamp(running), support=mix(.65,.438,run);
  const p=phase(val(distance)/GAIT_STRIDE+step*.5), heel=GAIT_STRIDE*support*.5;
  if(p<support) {
    const t=p/support;
    return {reach:heel-GAIT_STRIDE*p,lift:0,sole:-.25*(1-smooth(t/.24))+.34*smooth((t-.69)/.31),
      planted:true,phase:p};
  }
  const t=(p-support)/(1-support), ease=smooth(t);
  const lift=mix(10.2,19.4,run)*Math.sin(Math.PI*t)**1.6;
  return {reach:mix(-heel,heel,ease),lift,sole:mix(.34,-.25,ease),planted:false,phase:p};
}

const DISPLAY_STEP=64;
export function displayStep(distance:number,side:number,run:number){
  const support=mix(.66,.48,run), p=phase(distance/DISPLAY_STEP+side*.5);
  const reach=DISPLAY_STEP*support*.5;
  if(p<support)return {reach:reach-p*DISPLAY_STEP,swing:0,t:p/support,lift:0,planted:true};
  const t=(p-support)/(1-support);
  return {reach:mix(-reach,reach,smooth(t)),swing:t,t,
    lift:(13+4*run)*Math.sin(Math.PI*t)**1.25,planted:false};
}

/** v3 attack phrasing: a small continuity correction that crosses the real
 * release with a nonzero tangent. Anticipation and recovery do not alter
 * authored contact timing. Rigid shafts and tips are constructed by the rig. */
const keys=Object.freeze({
  cut:[.34,5,5,7,5], sweep:[.47,6,6,10,5.5],
  thrust:[.13,10,2,6,4], rise:[.39,4,10,8,6],
  screen:[.22,3,5,4,3.5], vault:[.36,6,8,8,5],
});
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const good=v=>Number.isFinite(v);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const pulse=(u,low,high)=>smooth((u-low)/(high-low));
const lobe=s=>s<=0||s>=1?0:Math.sin(Math.PI*s)**2;
/** Exact zero offset at release, continuous nonzero speed on either side.
 * The cubic is bounded at both edges and starts/ends at rest. */
export function peasantReleaseArc(dt,window){
  if(!good(dt)||!good(window)||window<=0||Math.abs(dt)>=window)return 0;
  const u=dt/window, a=Math.abs(u);
  return 6.75*u*(1-a)**2;
}
export function samplePeasantPhrase({family,time,duration,contact,offContact,kit='single',side=1,linked=false}={}){
  if(!Object.hasOwn(keys,family)||!good(time)||!good(duration)||!good(contact)||time<0||time>duration||
    contact<.055||duration-contact<.07)return null;
  const [yaw,reach,height,lean,twist]=keys[family];
  const s=side<0?-1:1;
  const k=kit==='staff'?.78:kit==='dual'?.86:1;
  const delayed=good(offContact)&&offContact>contact&&offContact<duration;
  const beat=(gate,hand,later=duration)=>{
    const half=Math.min(.135,gate*.39,(later-gate)*.51);
    const u=time-gate, a=peasantReleaseArc(u,half)*Math.min(1,half/.10);
    // Hip/shoulder starts before the wrist. The arm follows later and trails
    // for longer, fading fully before rest; neither switches at the hit frame.
    const draw=linked?.64:1;
    const shoulder=lobe(time/(gate*.86))*draw;
    const settle=lobe((u-half*.36)/Math.max(.025,later-gate-half*.36));
    return {yaw:a*yaw*hand*k,reach:a*reach*k,height:a*height*k*hand,
      lean:lean*(shoulder*-.41+settle*.42),twist:twist*.075*(shoulder*-hand+settle*hand),
      elbow:(shoulder*-.55+a*.57+settle*.68)*hand};
  };
  // One shaft needs the same motion for both tips. Do not perturb a delayed
  // physical release on the other end when the first one is still carrying.
  const first=beat(contact,s,kit==='staff'&&delayed?offContact:duration);
  const spare=kit==='dual'?beat(delayed?offContact:contact,-s):null;
  return {...first,
    offYaw:spare?.yaw??0,offReach:spare?.reach??0,offHeight:spare?.height??0,offElbow:spare?.elbow??0,
    coat:Math.abs(first.twist)*(1-pulse(time,duration*.80,duration))};
}
/** Blend starts with the captured outgoing velocity, while the initial
 * target blend is stationary. Both velocity and offsets vanish smoothly at
 * the other end. Extra drag gives the off hand a later-looking settle. */
export function peasantHandoff(elapsed,duration,secondary=false){
  if(!good(elapsed)||!good(duration)||duration<=0)return {feed:0,tangent:0};
  const t=clamp(elapsed/duration);
  const blend=secondary?t*t*(3-2*t)*(1-.25*(1-t)):smooth(t);
  return {feed:1-blend,tangent:duration*t*(1-t)**(secondary?2.30:2.65)};
}

/** Opt-in physical swing profiles layered over the committed saber form.
 * [azimuth, arm extension, arm height, facing shift, torso dip, torso twist].
 * Units: world-projected radians and rig pixels. Reach tuning is elsewhere. */
type PoseVector=[number,number,number,number,number,number];
interface SwingRow{load:PoseVector;touch:PoseVector;tail:PoseVector;late:number}
interface SwingOptions{elapsed?:number;duration?:number;contact?:number;offContact?:number;handedness?:number;kit?:string}
const rows:Readonly<Record<string,SwingRow>>=Object.freeze({
  king:{load:[-.52,-9,-2,-3,4,-.42],touch:[.020,-3.8,1,-.3,0,.12],tail:[.61,-8,4,3,3,.61],late:.29},
  queen:{load:[-1.00,2,-8,-5,0,-.70],touch:[.033,3.65,-1,.6,0,.14],tail:[1.36,12,5,8,-2,.83],late:.47},
  bishop:{load:[-.68,-3,-16,-3,-5,-.43],touch:[-.038,.4,-3.0,0,-.2,-.09],tail:[.93,4,15,4,5,.44],late:.30},
  rook:{load:[.17,-12,0,-2,1,-.08],touch:[.006,3.45,.4,.4,0,.02],tail:[-.14,10,2,7,0,.11],late:.24},
  knight:{load:[-.86,-5,-8,-4,5,-.57],touch:[.024,-1.3,2.6,.25,0,.11],tail:[-.51,8,1,5,-2,.53],late:.28},
  pawn:{load:[-.28,-9,4,-2,4,-.20],touch:[-.020,-2,1.4,0,0,.06],tail:[.35,-4,5,3,4,.29],late:.21},
});
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const bump=(t:number,a:number,b:number,c:number)=>ease((t-a)/(b-a))*(1-ease((t-b)/(c-b)));
const valid=(a:unknown):a is number=>Number.isFinite(a);
export function sampleChessSwing(style:string,{elapsed,duration,contact,offContact,handedness=1,kit='single'}:SwingOptions={}){
  if(!Object.hasOwn(rows,style)||!valid(elapsed)||!valid(duration)||!valid(contact)||
    duration<=0||contact<=0||contact>=duration||elapsed<=0||elapsed>=duration)return null;
  const r=rows[style], first=contact/duration, t=elapsed/duration;
  const hasOff=valid(offContact)&&offContact>contact&&offContact<duration;
  const off=hasOff?offContact/duration:first;
  const side=handedness<0?-1:1;
  const kitScale=kit==='staff'?.82:kit==='dual'?.88:1;
  const mix=(rr:SwingRow,load:number,touch:number,tail:number)=>rr.load.map((p,i)=>p*load+rr.touch[i]*touch+rr.tail[i]*tail);
  const mainLoad=bump(t,0,first*.59,first);
  // The distinctive elbow/line pose at real contact is small enough to keep
  // the same release gate reachable. Larger excursions have their own time.
  const mainTouch=bump(t,Math.max(first*.74,first-.13),first,Math.min(1,first+.14));
  // The common staff shaft cannot whip through its second real contact;
  // carry the larger follow-through after the slower end releases.
  const finishFrom=kit==='staff'?off:first;
  const mainTail=bump(t,finishFrom,finishFrom+(1-finishFrom)*r.late,1);
  const primary=mix(r,mainLoad,mainTouch,mainTail);
  const other=kit==='dual'?mix(r,bump(t,first*.23,off*.69,off),bump(t,off*.84,off,Math.min(1,off+.12)),
    bump(t,off,off+(1-off)*r.late,1)):null;
  return {style,yaw:primary[0]*side*kitScale,reach:primary[1]*kitScale,height:primary[2]*kitScale,
    lean:primary[3],bend:primary[4],twist:primary[5]*side,
    offYaw:other?-other[0]*side*.69:0,offReach:other?other[1]*.63:0,offHeight:other?other[2]*.74:0};
}

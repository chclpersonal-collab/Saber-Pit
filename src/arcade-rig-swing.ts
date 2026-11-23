/** Authored release/recovery curve primitives. */
type SwingFighter={combo?:number;technique?:string|null;attackFamily?:string;airStrike?:unknown};
type Authored={motion?:{path?:string};air?:string};
const TAU=Math.PI*2;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
// Chamber and extension accents measured relative to each real contact.
// Columns: pitch, wrist reach, wrist drop, lean, knee compression, turn,
// free-hand height, support width. Recoveries deliberately do not all end
// high or return through the same path.
export const ATTACK_BEATS={
 cut:{load:[-1.05,-10,-17,-6,2,-.27,6,3],out:[.64,8,12,8,3,.23,-8,5],bias:[-.35,-.15]},
 sweep:{load:[-.61,-16,13,-10,16,-.40,-4,12],out:[1.27,11,17,13,15,.51,-11,10],bias:[.48,.80]},
 thrust:{load:[-.09,-12,1,-7,4,-.09,5,-3],out:[.05,15,-4,12,2,.09,5,-1],bias:[-.28,-.28]},
 screen:{load:[-.52,-6,-12,-4,7,-.18,-7,3],out:[-.43,-10,-13,-9,9,-.19,-8,4],bias:[.36,-.14]},
 rise:{load:[1.03,-7,18,-4,15,.25,-9,8],out:[-1.05,8,-23,11,-5,-.42,7,4],bias:[-.20,.14]},
 vault:{load:[.72,-13,8,-6,9,.26,3,7],out:[-.92,11,-16,11,3,-.35,-4,6],bias:[-.15,-.10]},
 return:{load:[.91,3,9,5,9,.32,-4,4],out:[-.83,-11,-14,-6,6,-.31,7,6],bias:[.16,.31]},
 cast:{load:[-.34,-4,6,-2,3,-.19,-9,0],out:[.24,-5,-2,5,2,.15,2,4],bias:[-.13,-.14]},
};
export const visualFamily=(f:SwingFighter,action:string,authored?:Authored):keyof typeof ATTACK_BEATS=>{
  if(action==='force')return 'cast';
  if(f.combo===2||f.combo===4||/return|reversal/.test(f.technique??''))return 'return';
  if(Object.hasOwn(ATTACK_BEATS,f.attackFamily!))return f.attackFamily as keyof typeof ATTACK_BEATS;
  const path=authored?.motion?.path;
  if(path==='point'||path==='feint'||action==='rush')return 'thrust';
  if(path==='screen')return 'screen';
  if(action==='leap')return f.airStrike||authored?.air?'vault':'rise';
  if(action==='sweep'||path==='arc')return 'sweep';
  return 'cut';
};
export function contactEnvelope(t:number,beats:readonly number[],bias:number){
  let start=0, end=1;
  for(const beat of beats){if(t<=beat){end=beat;break;}start=beat;}
  if(end-start<.0001)return 0;
  return Math.sin(Math.PI*clamp((t-start)/(end-start)))**(1.55+bias);
}
export function staffSweep(keys:readonly (readonly [number,number])[],t:number){
  const slope=(i:number)=>i<0||i+1>=keys.length?0:(keys[i+1][1]-keys[i][1])/(keys[i+1][0]-keys[i][0]);
  const tangent=(i:number)=>{
    const a=slope(i-1), b=slope(i);
    return a*b>0?(2*a*b)/(a+b):0;
  };
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
  const [start,a]=keys[i], [end,b]=keys[i+1], d=end-start;
  const u=clamp((t-start)/d),u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a+(-2*u3+3*u2)*b+(u3-2*u2+u)*d*tangent(i)+(u3-u2)*d*tangent(i+1);
}


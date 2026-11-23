/** Pose-only accents for fictional Saber Pit emitters. The physical contact
 * keys remain exact and the staff shaft always has one shared rotation. */
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
interface FlowOptions{kit?:string;family?:string;t?:number;first?:number;second?:number;rear?:boolean;side?:number;reduced?:boolean}
interface Profile{chamber:readonly number[];follow:readonly number[];cover:readonly [number,number]}
const profile:Readonly<Record<string,Profile>>={
  single:{chamber:[-.29,-6,-4,-4,3,-.14],follow:[.43,7,7,7,2,.22],cover:[0,0]},
  reverse:{chamber:[.78,-11,7,-5,7,.23],follow:[-1.08,5,-8,9,4,-.38],cover:[0,0]},
  dual:{chamber:[-.45,-7,-6,-5,5,-.23],follow:[.70,4,7,7,3,.34],cover:[.92,1.01]},
  reverseDual:{chamber:[.77,-8,6,-5,5,.25],follow:[-.88,6,-8,8,4,-.39],cover:[-.94,-1.10]},
  staff:{chamber:[-.62,-8,-4,-7,6,-.32],follow:[.98,8,8,13,5,.48],cover:[0,0]},
};
const shape:Readonly<Record<string,readonly [number,number,number]>>={thrust:[.56,1.18,.95],cut:[1,.91,1.06],sweep:[1.20,1.15,1.19],screen:[.55,.71,1.05],
 rise:[.93,.94,1.05],vault:[1.10,.91,1.10],return:[1.14,1,1.11],cast:[0,0,0]};
const zero=Object.freeze({pitch:0,reach:0,height:0,lean:0,bend:0,twist:0,offPitch:0,offReach:0,offHeight:0});
const lobe=(t:number,start:number,end:number,power=2)=>{
  if(t<=start||t>=end||end<=start)return 0;
  return Math.sin(Math.PI*clamp((t-start)/(end-start)))**power;
};
export function sampleWeaponFlow({kit='single',family='cut',t=0,first=.44,second=0,rear=false,side=1,reduced=false}:FlowOptions={}){
  if(t<=0||t>=1||!Object.hasOwn(profile,kit)||family==='cast')return zero;
  first=Math.max(.15,Math.min(.89,first));
  const other=second>first+.015&&second<.98;
  const last=other?second:first;
  const data=profile[kit],[spin,stretch,body]=shape[family]??shape.cut;
  const lead=Math.sign(side)||1, direction=kit==='staff'&&rear?-lead:lead;
  const load=lobe(t,0,first,2.15);
  const out=lobe(t,last,1,1.85);
  // Both real ends remain under the original rig at exact contacts.
  // In between releases the trailing free arc is a short handoff, not
  // a second unrelated flourish that could obscure the next contact.
  const handoff=other?lobe(t,first,last,2.2)*Math.min(1,(last-first)*4):0;
  const tone=reduced?.52:1;
  const [a,b]=[data.chamber,data.follow];
  const blend=(i:number)=>(a[i]*load+b[i]*out)*tone;
  const switchSign=kit==='reverseDual'?-1:1;
  return {pitch:direction*spin*(blend(0)+handoff*.14),
    reach:stretch*(blend(1)-tone*handoff*2),
    height:body*(blend(2)+tone*handoff*(kit==='staff'?3:-4)),
    lean:body*(blend(3)+tone*handoff*3),bend:body*blend(4),twist:direction*body*blend(5),
    offPitch:other?(data.cover[0]*load-data.cover[1]*out+switchSign*handoff*.36)*tone*lead:0,
    offReach:other?(load*-6+out*4+handoff*6)*stretch*tone:0,
    offHeight:other?(load*(kit==='reverseDual'?8:-10)+out*(kit==='reverseDual'?-5:6))*body*tone:0};
}

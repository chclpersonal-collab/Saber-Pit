/** Form-specific pose curves sampled on the real, continuous flight clock. */
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=3.1.0';
type AirFighter={airHeight?:number;alive?:boolean;hp?:number;airTrick?:string;technique?:string|null;
 action?:string;airStrike?:unknown;jumpKind?:string};
const TAU=Math.PI*2;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
// Form-specific lower-body poses, in local rig units. Positive lead
// lifts/sends the leading boot; negative trail drags or extends the rear one.
// These tracks affect visual joints only, never air height or emitter motion.
const AIR_FORM={
 shii_cho:{name:'lateral-fan',lead:[16,9],trail:[-19,11],hip:5,knee:3,absorb:7,launch:3,flare:1},
 makashi:{name:'needle-line',lead:[26,4],trail:[-15,-9],hip:2,knee:-2,absorb:2,launch:5,flare:-1},
 soresu:{name:'sheltered-tuck',lead:[3,25],trail:[-2,28],hip:4,knee:8,absorb:10,launch:7,flare:1},
 ataru:{name:'vault-fold',lead:[16,12],trail:[-9,15],hip:3,knee:5,absorb:6,launch:6,flare:1},
 djem_so:{name:'hammer-step',lead:[7,22],trail:[-13,-11],hip:5,knee:11,absorb:13,launch:9,flare:-1},
 niman:{name:'balanced-float',lead:[6,-5],trail:[-11,-2],hip:3,knee:1,absorb:5,launch:4,flare:0},
 juyo:{name:'scissor-strike',lead:[29,9],trail:[-21,5],hip:6,knee:7,absorb:8,launch:3,flare:-1},
};
// Load, suspend and plant beats are keyed to the physical phase. No fixed
// clip time is used: the same animation advances with each form's own arc.
export const JUMP_STYLE={
 shii_cho:{load:[4,6,5],land:[6,4,6],turn:[-.23,.49],saber:[-.62,-.40],post:[.60,.44]},
 makashi:{load:[1,9,-1],land:[3,8,0],turn:[-.12,.25],saber:[-.24,.06],post:[.17,0]},
 soresu:{load:[11,-6,1],land:[12,-5,1],turn:[.11,-.17],saber:[-1.74,-1.86],post:[-.30,-.18]},
 ataru:{load:[8,7,2],land:[10,5,3],turn:[0,0],saber:[1.24,.50],post:[0,.24]},
 djem_so:{load:[14,-7,4],land:[17,7,7],turn:[.24,-.42],saber:[-2.56,-2.36],post:[-.16,.64]},
 niman:{load:[4,1,-2],land:[5,1,1],turn:[-.17,-.22],saber:[.82,1.10],post:[.26,.08]},
 juyo:{load:[5,12,2],land:[8,13,4],turn:[-.18,.64],saber:[2.35,1.93],post:[-.54,.51]},
};
export function aerialLowerBody(form:string,phase:string,p:number,reduced:boolean,roll:string|null){
 const a=AIR_FORM[form as keyof typeof AIR_FORM]??AIR_FORM.shii_cho, tone=reduced?.55:1;
 const easing=Math.sin(Math.PI*p)*tone;
 if(phase==='takeoff')return {name:a.name,hip:easing*a.launch*.65,knee:easing*a.launch,lead:[0,0],trail:[0,0],flight:0};
 if(phase==='landing')return {name:a.name,hip:easing*a.absorb*.7,knee:easing*a.absorb*.81,lead:[0,0],trail:[0,0],flight:0};
 if(phase!=='airborne')return null;
 const power=(form==='juyo'?1.45:form==='soresu'?.73:1);
 const apex=easing**power;
 const unlock=smooth((p-.53)/.46);
 const accent=Math.sin(p*TAU)*apex*a.flare;
 const lead=[(a.lead[0]+accent*8)*apex*(1-unlock*.30),a.lead[1]*apex+accent*3];
 const trail=[(a.trail[0]-accent*5)*apex,a.trail[1]*apex-accent*2];
 if(form==='ataru'&&roll){lead[0]*=.72;trail[0]*=.66;}
 return {name:a.name,hip:apex*a.hip,knee:apex*a.knee,lead,trail,flight:apex};
}
// Original Ataru aerial poses, sampled from the real world-height arc.
// Angle is unwrapped until landing so interpolation never reverses around π.
// A full turn and the unrotated stance have exactly the same landing geometry.
export function ataruAerialTrick(f:AirFighter,form:string,airPhase:string,progress:number,reducedMotion:boolean) {
  if(reducedMotion||form!=='ataru'||airPhase!=='airborne'||!(f.airHeight!>0)||(f.alive===false||(f.alive==null&&f.hp!<=0)))return {kind:null,angle:0,tuck:0};
  const isParry=f.airTrick==='parry_flip'||f.technique==='parry_flip';
  const air=ARCADE_TECHNIQUES[f.technique!]?.air??(f.technique==='vault'?'vault':null);
  const act=f.action==='jump'||f.airStrike;
  const cork=act&&f.jumpKind==='corkscrew', sideFlip=act&&f.jumpKind==='crossflip';
  if(!isParry&&!air&&!cork&&!sideFlip)return {kind:null,angle:0,tuck:0};
  const cross=air==='crossVault', high=air==='highVault';
  const a=sideFlip?.07:cork?.18:isParry?.06:cross?.086:high?.155:.105;
  const b=sideFlip?.84:cork?.94:isParry?.94:cross?.905:high?.92:.87;
  const time=clamp((progress-a)/(b-a));
  const turn=(sideFlip||isParry||cross?-1:1)*TAU*smooth(time);
  return {kind:sideFlip?'crossflip':cork?'corkscrew':isParry?'parry-flip':cross?'cross-vault':high?'high-vault':'vault-flip',
    angle: turn===0?0:turn,
    tuck:Math.sin(Math.PI*time)**(sideFlip?.68:high?.94:cross?1.30:1.12)};
}

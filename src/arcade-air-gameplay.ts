export type AirArc={peak:number;apex?:number;push:number;turn:number};
/** Real, bounded form-specific arcs and their optional single jump attack. */
const profile=(kind:string,takeoff:number,flight:number,landing:number,peak:number,drive:number,cost:number,apex:number,push:number,turn:number)=>Object.freeze({kind,takeoff,flight,landing,peak,drive,cost,apex,push,turn});
export const ARCADE_JUMPS=Object.freeze({
  shii_cho:profile('wheel',.145,.30,.13,32,238,15,.46,.34,.18),
  makashi:profile('line',.106,.25,.121,22,281,13,.40,.84,.016),
  soresu:profile('compact',.103,.225,.122,19,155,12,.53,.24,.025),
  ataru:profile('corkscrew',.145,.42,.155,49,278,19,.47,.52,.24),
  djem_so:profile('bound',.197,.29,.145,35,198,17,.56,.43,.06),
  niman:profile('drift',.128,.38,.13,39,211,16,.51,.31,.31),
  juyo:profile('pounce',.095,.285,.131,28,313,18,.43,.95,.12),
});
const ATARU_CROSS=profile('crossflip',.115,.39,.165,45,251,18,.54,.38,.37);
export function arcadeJumpProfile(form:string,bearing:number,face:number,traversing:boolean){
  const relative=Math.atan2(Math.sin(bearing-face),Math.cos(bearing-face));
  return form==='ataru'&&traversing&&Math.abs(Math.sin(relative))>=.66?ATARU_CROSS:ARCADE_JUMPS[form as keyof typeof ARCADE_JUMPS]??ARCADE_JUMPS.shii_cho;
}
export function arcadeJumpHeight(arc:AirArc,phase:number){
  const apex=arc.apex??.5;
  const p=phase<apex?.5*phase/apex:.5+.5*(phase-apex)/(1-apex);
  return 4*arc.peak*p*(1-p);
}
export function arcadeJumpMotion(arc:AirArc,phase:string,t:number,scale:number,bearing:number){
  let drive=0,curve=0;
  if(phase==='takeoff')drive=scale*(.11+arc.push*.32*t);
  else if(phase==='airborne'){
    drive=scale*(.55+.42*Math.sin(Math.PI*t)+arc.push*.12*(1-t));
    curve=arc.turn*Math.sin(Math.PI*t)*Math.sin(Math.PI*(t*.81+.08));
  }else if(phase==='landing')drive=scale*(.28+.09*arc.push)*(1-t);
  return {x:drive*Math.cos(bearing+curve),y:drive*Math.sin(bearing+curve)};
}
const cut=(id:string,label:string,action:string,duration:number,contact:number,reach:number,arc:number,damage:number,cost:number,knock:number,recoil:number)=>Object.freeze({id,label,action,duration,contact,reach,arc,damage,cost,lunge:0,knock,recoil,airStrike:true});
export const ARCADE_AIR_STRIKES=Object.freeze({
  shii_cho:cut('air_cut','Wheeling Cut','sweep',.49,.158,89,1.58,17,13,166,.21),
  makashi:cut('air_point','Passing Point','rush',.42,.124,104,.57,17,12,116,.18),
  soresu:cut('air_guard','Falling Cover','slash',.41,.101,73,1.06,11,9,95,.16),
  ataru:cut('air_scissor','Scissor Cut','slash',.52,.149,94,1.32,19,16,157,.23),
  djem_so:cut('air_drop','Dropping Edge','uppercut',.55,.171,84,1.03,22,17,197,.28),
  niman:cut('air_weave','Crosswind Cut','sweep',.47,.143,89,1.18,16,13,138,.21),
  juyo:cut('air_rake','Raking Lunge','rush',.43,.119,92,.98,19,15,151,.22),
});
export const ARCADE_AIR_ATTACKS=Object.freeze(Object.fromEntries(Object.values(ARCADE_AIR_STRIKES).map(m=>[m.id,m])));

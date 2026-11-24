/** One motion profile for Arena. Old replay descriptors keep their legacy flags. */
export interface ArcadeMotionFlow {
  plantFeet:boolean;
  styleTurns:boolean;
  stanceFollowThrough:boolean;
  impactRecovery:boolean;
  movingEntries:boolean;
  chain:Readonly<{standardDelay:number;eliteDelay:number;eliteGrade:number}>;
}
export type ArcadeMotionFlowInput=Partial<Omit<ArcadeMotionFlow,'chain'>>&{
  chain?:Partial<ArcadeMotionFlow['chain']>;
};
const chain=Object.freeze({standardDelay:.050,eliteDelay:.025,eliteGrade:14});
export const ARENA_MOTION_FLOW:Readonly<ArcadeMotionFlow>=Object.freeze({
  plantFeet:true,styleTurns:true,stanceFollowThrough:true,impactRecovery:true,movingEntries:true,chain,
});
export const PREVIEW_MOTION_FLOW:Readonly<ArcadeMotionFlow>=Object.freeze({
  plantFeet:true,styleTurns:true,stanceFollowThrough:false,impactRecovery:false,movingEntries:false,chain,
});
export function normalizeArcadeMotionFlow(input:ArcadeMotionFlowInput,impactPhysics:boolean):ArcadeMotionFlow{
  const validDelay=(value:number|undefined,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(.25,value)):fallback;
  const standardDelay=validDelay(input.chain?.standardDelay,chain.standardDelay);
  const eliteDelay=Math.min(standardDelay,validDelay(input.chain?.eliteDelay,chain.eliteDelay));
  const requestedGrade=input.chain?.eliteGrade;
  const eliteGrade=typeof requestedGrade==='number'&&Number.isInteger(requestedGrade)?Math.max(0,Math.min(14,requestedGrade)):chain.eliteGrade;
  return {
    plantFeet:input.plantFeet??true,styleTurns:input.styleTurns??true,
    stanceFollowThrough:input.stanceFollowThrough??true,impactRecovery:impactPhysics&&(input.impactRecovery??true),
    movingEntries:input.movingEntries??true,chain:{standardDelay,eliteDelay,eliteGrade},
  };
}
interface ChainActor {
  action:string;airPhase:string;actionTime:number;contact:boolean;offhandContact:boolean;
  motionLinkedHit?:boolean;airArc?:{kind?:string}|null;career:{gradeIndex:number};
}
interface ChainMove { contact:number;airStrike?:boolean;offhand?:{contact:number} }
/** A confirmed hit opts into one window, so legacy percent math can't race it. */
export function contactChainApplies(profile:ArcadeMotionFlow|undefined,fighter:ChainActor,move:ChainMove):profile is ArcadeMotionFlow {
  return Boolean(profile&&fighter.motionLinkedHit&&fighter.contact&&fighter.action!=='force'&&
     (fighter.airPhase!=='airborne'&&(!move.airStrike||fighter.airPhase==='grounded')||fighter.airArc?.kind));
}
export function contactChainOpen(profile:ArcadeMotionFlow|undefined,fighter:ChainActor,move:ChainMove):boolean {
  if(!contactChainApplies(profile,fighter,move)||(move.offhand&&!fighter.offhandContact))return false;
  const delay=fighter.career.gradeIndex>=profile.chain.eliteGrade?profile.chain.eliteDelay:profile.chain.standardDelay;
  const finalContact=Math.max(move.contact,move.offhand?.contact??move.contact);
  return fighter.actionTime+1e-9>=finalContact+delay;
}

/** Rank scaling and the elapsed-time pacing of elite exchanges. */
interface Ranked { career: { gradeIndex: number } }
interface PacingVictim { recentMistakes?: number[]; energy: number; control: boolean; exposedBy?: string | null }
interface PacingArena {
  time: number;
  limit: number;
  elitePacing?: { measuredUntil: number; fullAt: number; injuryCapUntil?: number } | null;
}
const clamp=(n: number,lo: number,hi: number)=>Math.max(lo,Math.min(hi,n));

export const ARCADE_RANK_COMBAT=Object.freeze(Array.from({length:15},(_,index)=>Object.freeze({
  index, reads:1+index, awareness:1+index*.21, initiative:index*.012,
  staminaRecovery:1+index*.046, holdEfficiency:1-index*.024,
  stability:index*.043, crowdCap:Math.min(8,1+Math.floor(index*.51)),
})));
export const countMove=(f: {moves: Record<string,number>},name: string)=>{f.moves[name]=(f.moves[name]??0)+1;};
export const rankGap=(a: Ranked,b: Ranked)=>a.career.gradeIndex-b.career.gradeIndex;
export const masteryRatio=(rank: number)=>clamp(rank/14,0,1);
export const rankStrikeScale=(source: Ranked,target: Ranked)=>{
  const gap=rankGap(source,target);
  if(gap===0)return 1;
  return gap>0?1+.055+4.145*masteryRatio(gap)**1.53:1-.975*masteryRatio(-gap)**.83;
};
/** v6: rank still matters, but a higher rank can't erase a fighter in two swings. Max x1.6 / x0.62 at a 14-grade gap. */
export const smartRankScale=(source: Ranked,target: Ranked)=>{
  const gap=rankGap(source,target);
  return gap===0?1:gap>0?1+.6*masteryRatio(gap)**1.25:1-.38*masteryRatio(-gap)**1.1;
};
export const elitePair=(a: Ranked,b: Ranked)=>a.career.gradeIndex>=12&&b.career.gradeIndex>=12&&Math.abs(a.career.gradeIndex-b.career.gradeIndex)<=2;
export function pacingLift(s: PacingArena) {
  if(!s.elitePacing)return 1;
  const u=clamp((s.time/s.limit-s.elitePacing.measuredUntil)/(s.elitePacing.fullAt-s.elitePacing.measuredUntil),0,1);
  return u*u*(3-2*u);
}
export function pacedDamage(s: PacingArena,victim: PacingVictim,damage: number,punish: boolean,blocked: boolean){
  if(!s.elitePacing)return damage;
  const lift=pacingLift(s);
  if(lift>=1){
    const opening=s.elitePacing.injuryCapUntil!=null&&s.time/s.limit>=.62&&!blocked;
    const late=clamp((s.time/s.limit-.62)/.17,0,1);
    return opening?Math.round(damage*(1+late*(punish?.42:victim.energy<=28?.19:0))):damage;
  }
  const recent=victim.recentMistakes?.filter(t=>t>s.time-7)??[];
  const wideOpen=punish&&recent.length>=5&&victim.energy<=8&&(victim.control||victim.exposedBy==='guard_break');
  const clockWeight=Math.min(.68,45/s.limit);
  const early=wideOpen?.87:blocked?.25*clockWeight:punish?.33*clockWeight:.20*clockWeight;
  const scaled=Math.max(1,Math.round(damage*(early+(1-early)*lift)));
  // Measured exchanges can still impair a region, but only a fully exposed
  // sequence or decisive late release risks an early knockout.
  const elapsedFraction=s.time/s.limit;
  const capUntil=s.elitePacing.injuryCapUntil??.85;
  return !wideOpen&&elapsedFraction<capUntil?Math.min(scaled,elapsedFraction<s.elitePacing.measuredUntil?4:6):scaled;
}

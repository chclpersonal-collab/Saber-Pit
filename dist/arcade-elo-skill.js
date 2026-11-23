/** Elo changes how an AI reads legal openings, not the fighter's physical build. */
const NEUTRAL=Object.freeze({level:0,readLead:0,readRecovery:0,decisionClock:1});
export const ELO_SKILL_BASE=1500;

export function arcadeEloSkill(elo,enabled=false){
  if(enabled!==true||!Number.isFinite(elo)||elo===ELO_SKILL_BASE)return NEUTRAL;
  // Smooth and bounded even for custom ratings far beyond the usual ladder.
  const level=Math.tanh((elo-ELO_SKILL_BASE)/260);
  return Object.freeze({level,readLead:.044*level,readRecovery:.072*level,decisionClock:1-.15*level});
}

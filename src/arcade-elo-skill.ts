/** Elo changes how an AI reads legal openings, not the fighter's physical build. */
export interface EloSkill {
  readonly level: number;
  readonly readLead: number;
  readonly readRecovery: number;
  readonly decisionClock: number;
}
const NEUTRAL=Object.freeze({level:0,readLead:0,readRecovery:0,decisionClock:1});
export const ELO_SKILL_BASE=1500;

export function arcadeEloSkill(elo: unknown,enabled=false): EloSkill {
  if(enabled!==true||typeof elo!=='number'||!Number.isFinite(elo)||elo===ELO_SKILL_BASE)return NEUTRAL;
  // Smooth and bounded even for custom ratings far beyond the usual ladder.
  const level=Math.tanh((elo-ELO_SKILL_BASE)/260);
  return Object.freeze({level,readLead:.044*level,readRecovery:.072*level,decisionClock:1-.15*level});
}

export interface ArenaReadSkill {
  readonly level:number;
  readonly rating:number;
  readonly decisionClock:number;
}
export const ARENA_SKILL_BASE=100;
export function arenaReadSkill(rating:unknown):ArenaReadSkill {
  const value=typeof rating==='number'&&Number.isFinite(rating)?Math.max(ARENA_SKILL_BASE,rating):ARENA_SKILL_BASE;
  const level=(value-ARENA_SKILL_BASE)/(value+950);
  return {rating:value,level,decisionClock:1-.34*level};
}
export interface ArenaPattern { readonly family:string }
export function arenaPatternRead(skill:ArenaReadSkill|undefined,rival:ArenaReadSkill|undefined,
  family:string|null|undefined,patterns:readonly ArenaPattern[]|undefined) {
  if(!skill?.level||!family||!patterns)return 0;
  const history=patterns.slice(-4), matches=history.filter(move=>move.family===family).length;
  if(matches<3)return 0;
  const edge=Math.tanh((skill.rating-(rival?.rating??ARENA_SKILL_BASE))/200);
  return Math.max(0,skill.level*(matches===3?.80:1.03)+edge*.32);
}

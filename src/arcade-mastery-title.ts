export type MasteryTitle = '' | 'GM' | 'HGM' | 'SGM' | 'AGM';
export interface MasteryRecord {
  wins?: number;
  draws?: number;
  losses?: number;
  elo?: number;
}
export interface MasteryHistory {
  records?: Readonly<Record<string, MasteryRecord | null | undefined>>;
  teams?: Readonly<Record<string, MasteryRecord | null | undefined>>;
  peaks?: Readonly<Record<string, {peakElo?: number} | null | undefined>>;
}
const outcomes=['wins','draws','losses'] as const;
/** Tournament mastery badges use earned ratings only, never a custom Hero Elo. */
export function masteryTitle(earnedElo: unknown,hasRatedBout=true): MasteryTitle {
  if(!hasRatedBout||typeof earnedElo!=='number'||!Number.isFinite(earnedElo)||earnedElo<1500)return '';
  return earnedElo>=1800?'AGM':earnedElo>=1700?'SGM':earnedElo>=1600?'HGM':'GM';
}
export function earnedMasteryTitle(state: MasteryHistory | null | undefined,id: string): MasteryTitle {
  const record=state?.records?.[id]??state?.teams?.[id];
  const peak=state?.peaks?.[id]?.peakElo;
  const fought=!!record&&outcomes.some(key=>record[key]!>0);
  const hasPeak=typeof peak==='number'&&Number.isFinite(peak);
  const elo=fought?record.elo:undefined;
  return masteryTitle(Math.max(hasPeak?peak:0,typeof elo==='number'&&Number.isFinite(elo)?elo:0),hasPeak||fought);
}

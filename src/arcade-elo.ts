const RANKS=['F','E','D','C','B','A','S','SS','SSS','SSS+','SSS+I','SSS+II','SSS+III','SSS+IV','SSS+V'] as const;
export type EloGrade = typeof RANKS[number];
export interface RatedEntry { rating?: unknown; grade?: unknown }
export interface EloPairUpdate { ratingA: number; ratingB: number; deltaA: number; deltaB: number }
export const ELO_FLOORS=Object.freeze(Object.fromEntries(RANKS.map((rank,i)=>[rank,100+i*100])) as Record<EloGrade, number>);
export const ELO_K=16;
export const ELO_SCALE=2;

// Translate the old 1,000 + 200 per rank scale into 100 + 100 per rank.
export function migrateLegacyElo(rating: number): number;
export function migrateLegacyElo<Rating>(rating: Rating): Rating | number;
export function migrateLegacyElo(rating: unknown): unknown {
  return typeof rating==='number'&&Number.isFinite(rating)?(rating-800)/2:rating;
}

export function eloFloor(grade: unknown): number {
  const key=typeof grade==='string'?grade.toUpperCase().replace(/\s+/g,'').replace(/\(ENTRY\)$/,''):'';
  return Object.hasOwn(ELO_FLOORS,key)?ELO_FLOORS[key as EloGrade]:ELO_FLOORS.F;
}

export function clampElo(rating: unknown,grade: unknown): number {
  const floor=eloFloor(grade);
  return typeof rating==='number'&&Number.isFinite(rating)?Math.max(floor,Math.round(rating*2)/2):floor;
}

/** A 100-point lead implies 2:1 odds, 200 points 4:1, etc. */
export function eloExpected(rating: unknown,opponentRating: unknown): number {
  const a=typeof rating==='number'&&Number.isFinite(rating)?rating:ELO_FLOORS.F;
  const b=typeof opponentRating==='number'&&Number.isFinite(opponentRating)?opponentRating:ELO_FLOORS.F;
  return 1/(1+2**((b-a)/100));
}

/** Round the paired transfer once, then independently protect both floors. */
export function updateEloPair(a: RatedEntry | null | undefined,b: RatedEntry | null | undefined,resultA: unknown): EloPairUpdate {
  if(resultA!==0&&resultA!==.5&&resultA!==1)throw new RangeError('Elo result must be 0, 0.5, or 1.');
  const beforeA=clampElo(a?.rating,a?.grade), beforeB=clampElo(b?.rating,b?.grade);
  const raw=ELO_K*(resultA-eloExpected(beforeA,beforeB));
  const transfer=(raw<0?-Math.round(-raw*2):Math.round(raw*2))/2;
  const ratingA=clampElo(beforeA+transfer,a?.grade), ratingB=clampElo(beforeB-transfer,b?.grade);
  return {ratingA,ratingB,deltaA:ratingA-beforeA,deltaB:ratingB-beforeB};
}

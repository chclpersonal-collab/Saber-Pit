/** Career outcome shares. Seed advancement after draws adds no extra result. */
export interface BoutCounts { wins?: unknown; draws?: unknown; losses?: unknown }
export interface BoutRates { lossPercent: number; winDrawPercent: number; total: number }
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function tournamentBoutRates({wins,draws,losses}: BoutCounts = {}): BoutRates | null {
  const lost=count(losses),total=count(wins)+count(draws)+lost;
  if(!total)return null;
  const tenths=Math.round(lost*1000/total);
  return {lossPercent:tenths/10,winDrawPercent:(1000-tenths)/10,total};
}

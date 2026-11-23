// The season index is the one-based fictional week in each career.
export const seasonWeek = (season: unknown): number | null =>
  typeof season === 'number' && Number.isSafeInteger(season) && season > 0 ? season : null;

// The season index is the one-based fictional week in each career.
// No timestamp, save migration, or effect on the match clock.
export const seasonWeek = season => Number.isSafeInteger(season) && season > 0 ? season : null;

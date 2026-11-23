// Missing versions in pre-3.02.3 saved replays always mean original rules.
export const GAUNTLET_SIM_VERSION=2;
export function gauntletReplayVersion(fixture){
  const version=fixture?.simulationVersion??1;
  return version===1||version===GAUNTLET_SIM_VERSION?version:null;
}

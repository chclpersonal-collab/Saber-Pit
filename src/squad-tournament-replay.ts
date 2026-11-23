import {arcadeReplayRules,supportsArcadeReplay} from './arcade-replay-rules.js?v=3.2.4';
import {createSquadReplay,SQUAD_REPLAY_RULESET} from './squad-tournament-sim.js?v=3.2.4';
import {startArcadeTournamentPlayback} from './tournament-replay.js?v=3.0.0';

/** Playback only: no standings, season, or save state is available here. */
export async function startSquadTournamentPlayback(canvas:HTMLCanvasElement,replay:Parameters<typeof createSquadReplay>[0],options:Parameters<typeof startArcadeTournamentPlayback>[4]={}){
  if(!supportsArcadeReplay(replay?.ruleset!,1,SQUAD_REPLAY_RULESET))throw new RangeError('This squad replay uses an older ruleset.');
  const rules=await arcadeReplayRules(({1:219,2:220,3:221,4:222,5:223,6:226,7:226} as Record<number,number>)[replay.ruleset!]);
  return startArcadeTournamentPlayback(canvas,createSquadReplay(replay,rules.createArcade),replay.terrain,rules,{...options,showMemberNames:true,drawOnTimeout:replay.ruleset!>=7});
}

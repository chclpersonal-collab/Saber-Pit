// Type-only contracts for structured-clone messages. Imports preserve the
// versioned runtime dependencies already used by the corresponding workers.
import type {playTournamentBout} from './arcade-tournament-sim.js?v=3.0.0';
import type {playSquadBout} from './squad-tournament-sim.js?v=3.2.4';
import type {simulateGauntlet} from './gauntlet-sim.js?v=3.2.3';

export type TournamentWorkerReply<Result> =
  | {result: Result; error?: never}
  | {error: string; result?: never};

interface BoutOptions {
  seed?: string | number;
  round?: number;
  ruleset?: number;
  limit?: number;
  terrain?: string;
}

interface BoutFighter {
  id?: string;
  name?: string;
  form?: string;
  body?: string;
  gender?: string;
  appearanceSeed?: number;
  grade?: string;
  elo?: number;
  combatElo?: number;
  chessStyle?: string;
  gear?: {weapon?: string; grip?: string; dualPhase?: boolean; forceFamily?: string};
  adaptation?: object | null;
}

type Pair<T> = readonly [T, T];
type Five<T> = readonly [T, T, T, T, T];

export type SoloWorkerRequest = BoutOptions & {
  grade?: string;
  plans?: Pair<{doctrine?: string; move?: string}>;
} & ({fighters: Pair<BoutFighter>} | {left: BoutFighter; right: BoutFighter});
export type SoloWorkerReply = TournamentWorkerReply<ReturnType<typeof playTournamentBout>>;
type SquadSide = Pick<BoutFighter, 'id' | 'name' | 'elo' | 'combatElo'> &
  ({fighters: Five<BoutFighter>} | {members: Five<BoutFighter>} | {roster: Five<BoutFighter>});
export type SquadWorkerRequest = BoutOptions & ({teams: Pair<SquadSide>} | {squads: Pair<SquadSide>});
export type SquadWorkerReply = TournamentWorkerReply<ReturnType<typeof playSquadBout>>;
type GauntletFighter = BoutFighter & {id: string; profile?: object | null};
export interface GauntletFixture extends Omit<BoutOptions, 'seed'> {
  id?: string;
  seed?: number;
  simulationVersion?: number;
  fighters: readonly [GauntletFighter, GauntletFighter, GauntletFighter, GauntletFighter];
}
export type GauntletWorkerRequest = {fixture: GauntletFixture};
export type GauntletWorkerReply = TournamentWorkerReply<ReturnType<typeof simulateGauntlet>>;

/** The worker side of a dedicated structured-clone message channel. */
export interface TournamentWorkerPort<Request, Reply> {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  addEventListener(type: 'message', listener: (event: MessageEvent<Request>) => void): void;
  postMessage(message: Reply): void;
}

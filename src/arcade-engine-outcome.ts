/** Authoritative end-of-round resolution. Tournament wrappers separately score a timeout draw. */
import {compareArcadeDanger} from './arcade-injuries.js?v=2.9.0';
import {objectiveOutcome} from './arcade-objectives.js';

type Injuries = Parameters<typeof compareArcadeDanger>[0];
type Winner = 0 | 1 | null;
type Rule = 'elimination' | 'control' | 'relic';
type Phase = 'playing' | 'won' | 'lost' | 'draw';
type RoundFighter = Parameters<typeof objectiveOutcome>[0]['fighters'][number] & { alive: boolean; injuries: Injuries };
interface RoundResult<F extends RoundFighter> {
  time: number;
  limit: number;
  width: number;
  height: number;
  fighters: F[];
  config: { rule: Rule };
  objective: ReturnType<typeof import('./arcade-objectives.js').createArcadeObjective>;
  phase: Phase;
  endReason?: Rule | 'timeout';
}
type RoundEmitter<F extends RoundFighter, S extends RoundResult<F>> = (s: S, kind: 'round', fighter: F, x: number, y: number, extra: { phase: Phase; reason: Rule | 'timeout' }) => void;

export function outcome<F extends RoundFighter, S extends RoundResult<F>>(s: S,objectiveWinner: Winner,emit: RoundEmitter<F,S>){
  const alive=[0,0];
  for(const f of s.fighters)if(f.alive)alive[f.team]++;
  const timeUp=s.time+1e-8>=s.limit;
  if(!alive[0]||!alive[1]||timeUp||objectiveWinner!==null){
    let comparative=0;
    if(alive[0]===alive[1]&&timeUp){
      const regional: [Injuries[], Injuries[]]=[[],[]];
      for(const f of s.fighters)if(f.alive)regional[f.team].push(f.injuries);
      // Compare the worst actual regional condition first, then remaining bodies.
      for(const side of regional)side.sort((a,b)=>compareArcadeDanger(b,a));
      for(let i=0;i<alive[0]&&!comparative;i++)comparative=compareArcadeDanger(regional[0][i],regional[1][i]);
    }
    const winner=!alive[0]&&!alive[1]?null:!alive[0]?1:!alive[1]?0:objectiveWinner??
      objectiveOutcome(s,{timedOut:true})??(alive[0]!==alive[1]?Number(alive[1]>alive[0]):comparative===0?null:Number(comparative>0));
    s.phase=winner===0?'won':winner===1?'lost':'draw';
    s.endReason=!alive[0]||!alive[1]?'elimination':objectiveWinner!==null?s.config.rule:'timeout';
    const lead=s.fighters.find(f=>f.alive&&f.team===(winner??0))??s.fighters[0];
    emit(s,'round',lead,s.width/2,s.height/2,{phase:s.phase,reason:s.endReason});
  }
}

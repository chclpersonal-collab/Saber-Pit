/** Read-only objective copy shared by the live view and focused UI checks. */
type ObjectiveSoldier = {id:string;lane:number;team:number;alive:boolean};
type ObjectiveState = {points?:readonly number[];carrierId?:string|null;state?:string;unlockTick?:number;targetScore?:number;contested?:boolean;home?:{x:number;y:number};x:number;y:number;owner?:number|null};
type ObjectiveGame = {objective?:ObjectiveState|null;config?:{matchMode?:string;mode?:string};status:string;winner?:number|null;round:number;tick?:number;soldiers:readonly ObjectiveSoldier[];control?:{soldierId?:string|null};events?:readonly {type:string;team?:number|null}[]};
export function objectiveFeedback(game:ObjectiveGame) {
  const objective = game.objective;
  const mode = game.config?.matchMode || 'control';
  const points = objective?.points || [0, 0];
  const score = `${Math.floor(points[0])} : ${Math.floor(points[1])}`;
  if (game.status === 'ended') return {
    status: game.winner === 0 ? 'Your team won the round' : game.winner === 1 ? 'Enemy team won the round' : 'Round drawn',
    detail: 'Round finished. Review the results or choose Next round to continue.',
    score, signature: `${game.round}:ended:${game.winner}:${score}`,
  };
  if (mode === 'elimination') return {
    status: 'Defeat the enemy team',
    detail: 'At the time limit: survivors, then remaining health. Equal totals draw.',
    signature: `${game.round}:elimination`,
  };
  if (mode === 'relic') {
    const carrier = game.soldiers.find(soldier => soldier.id === objective?.carrierId && soldier.alive);
    let status, detail;
    if (carrier) {
      const you = game.config?.mode === 'play' && game.control?.soldierId === carrier.id;
      status = you ? 'You have the relic. Return home.' : `${carrier.team === 0 ? 'Your' : 'Enemy'} fighter ${String(carrier.lane + 1).padStart(2, '0')} has the relic`;
      detail = `${carrier.team === 0 ? 'Deliver to your' : 'Intercept before the enemy reaches their'} home circle. Carriers move 28% slower and cannot dash.`;
    } else if (objective?.state === 'resetting') {
      const delivery = game.events?.findLast(event => event.type === 'relic-delivery');
      status = delivery ? `${delivery.team === 0 ? 'Your' : 'Enemy'} team delivered the relic` : 'Relic returns to center';
      detail = `Relic ready at center in ${Math.max(0, ((objective.unlockTick || 0) - (game.tick || 0)) / 60).toFixed(1)}s. First to ${objective.targetScore || 3} deliveries wins.`;
    } else if (objective?.contested) {
      status = 'Relic contested';
      detail = 'Clear nearby enemies to pick it up, then carry it to your home circle.';
    } else {
      const dropped = objective?.home && Math.hypot(objective.x - objective.home.x, objective.y - objective.home.y) > 1;
      status = dropped ? 'Relic dropped on the field' : 'Relic ready at center';
      detail = (objective?.unlockTick || 0) > (game.tick || 0)
        ? 'Pickup unlocks in a moment. Either team can recover it.'
        : 'Move onto the relic to pick it up automatically. Carry it to your home circle.';
    }
    return { status, detail, score, signature: `${game.round}:relic:${objective?.state}:${carrier?.id || ''}:${Boolean(objective?.contested)}:${score}` };
  }
  return {
    status: objective?.contested ? 'Signal contested' : objective?.owner === 0 ? 'Your team holds the signal' : objective?.owner === 1 ? 'Enemy team holds the signal' : 'Capture the center signal',
    detail: `Hold the post to earn points. First to ${objective?.targetScore || 30} points wins, or defeat the enemy team.`,
    score,
    signature: `${game.round}:control:${objective?.owner}:${Boolean(objective?.contested)}`,
  };
}

/** Cycle living fighters during a round; final-position review includes casualties. */
export function nextInspectionId(soldiers:readonly Pick<ObjectiveSoldier,'id'|'team'|'alive'>[], selectedId:string|null, direction = 1, team: string|number = 'all', includeDead = false) {
  const candidates = soldiers.filter(soldier => (includeDead || soldier.alive) && (team === 'all' || soldier.team === Number(team)));
  if (!candidates.length) return null;
  const current = candidates.findIndex(soldier => soldier.id === selectedId);
  const index = current < 0 ? (direction < 0 ? candidates.length - 1 : 0) : (current + direction + candidates.length) % candidates.length;
  return candidates[index].id;
}

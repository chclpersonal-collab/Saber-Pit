/** Presentation-only views. Never write interpolated values into simulation state. */
export interface RenderPoint { x: number; y: number; prevX?: number; prevY?: number }
interface SoldierPoint extends RenderPoint { id: string | number }
export interface ClassicRenderState<Soldier extends SoldierPoint,Objective extends RenderPoint,Effect> {
  alpha?: number; tick: number; soldiers: readonly Soldier[]; objective?: Objective | null;
  prevFrontLine?: number; frontLine: number; effects?: readonly Effect[];
}
const isFinite=(n:unknown):n is number=>Number.isFinite(n);
const clampAlpha = (alpha:unknown) => isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0;
export function renderPosition(entity:RenderPoint, alpha:unknown) {
  const a = clampAlpha(alpha);
  const prevX = isFinite(entity.prevX) ? entity.prevX : entity.x;
  const prevY = isFinite(entity.prevY) ? entity.prevY : entity.y;
  return { x: prevX + (entity.x - prevX) * a, y: prevY + (entity.y - prevY) * a };
}
export function createRenderFrame<S extends SoldierPoint,O extends RenderPoint,E>(game:ClassicRenderState<S,O,E>, { interpolate = true } = {}) {
  const alpha = interpolate ? clampAlpha(game.alpha) : 0;
  const soldiers = game.soldiers.map(soldier => ({ ...soldier,
    ...(interpolate ? renderPosition(soldier, alpha) : { x: soldier.x, y: soldier.y }) }));
  const fighters = new Map(soldiers.map(soldier => [soldier.id, soldier]));
  const objective = game.objective ? { ...game.objective,
    ...(interpolate ? renderPosition(game.objective, alpha) : {}) } : null;
  // Explicit phase-1 contract: poses use tick+alpha. Position interpolation
  // spans tick-1 -> tick, so authored poses lead positions by one fixed tick.
  const tick = game.tick + alpha;
  const frontLine = interpolate && isFinite(game.prevFrontLine)
    ? game.prevFrontLine + (game.frontLine - game.prevFrontLine) * alpha : game.frontLine;
  return { alpha, tick, time: tick / 60, soldiers, fighters, objective, frontLine,
    effects: game.effects || [] };
}

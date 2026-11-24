interface RenderCoordinates {
  prevX?: number;
  prevY?: number;
}
interface GameSnapshots {
  alpha?: number;
  prevFrontLine?: number;
  soldiers: Array<RenderCoordinates & object>;
  objective: RenderCoordinates & object;
}
/** Compare gameplay exactly while ignoring disposable render snapshots. */
export function authoritativeState<T extends GameSnapshots>(game: T): T {
  const copy = structuredClone(game);
  delete copy.alpha;
  delete copy.prevFrontLine;
  for (const entity of [...copy.soldiers, copy.objective]) {
    delete entity.prevX;
    delete entity.prevY;
  }
  return copy;
}

/** Compare gameplay exactly while ignoring disposable render snapshots. */
export function authoritativeState(game) {
  const copy = structuredClone(game);
  delete copy.alpha;
  delete copy.prevFrontLine;
  for (const entity of [...copy.soldiers, copy.objective]) {
    delete entity.prevX;
    delete entity.prevY;
  }
  return copy;
}

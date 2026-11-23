/** Test-only projection to the v9 field boundary. Deliberately names each
 * post-v9 additive field; all original fields remain subject to exact equality. */
export function stripPostV9(game) {
  delete game.commandState;
  delete game.battleLog;
  if (game.config) { delete game.config.startingDualSabers; delete game.config.deployments; }
  if (game.roundReport) delete game.roundReport.recap;
  return game;
}

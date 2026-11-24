/** Element contracts for the static pages distributed with this build. */
export interface StyleLabElements {
  'labStrike':HTMLButtonElement; 'labSpin':HTMLButtonElement; 'labWalk':HTMLButtonElement; 'labJump':HTMLButtonElement; 'labCompare':HTMLButtonElement; 'labCompareWeapons':HTMLButtonElement; 'labStop':HTMLButtonElement;
  'labCanvas':HTMLCanvasElement;
  'labResultPanel':HTMLDetailsElement;
  'labTravel':HTMLElement; 'labStatus':HTMLElement; 'labWeaponCompareHint':HTMLElement; 'labTiming':HTMLElement; 'labCompareHelp':HTMLElement; 'labHint':HTMLElement; 'labAngleHint':HTMLElement;
  'labResultSummary':HTMLElement;
  'labRange':HTMLInputElement; 'labAngle':HTMLInputElement;
  'labResults':HTMLOListElement;
  'labRangeValue':HTMLOutputElement;
  'labStyle':HTMLSelectElement; 'labDirections':HTMLSelectElement; 'labMoveFamily':HTMLSelectElement; 'labMove':HTMLSelectElement; 'labForm':HTMLSelectElement; 'labWeapon':HTMLSelectElement; 'labDefense':HTMLSelectElement;
  'labStance':HTMLSelectElement; 'labEntry':HTMLSelectElement; 'labPace':HTMLSelectElement;
}
export interface ArenaElements {
  'autoDuelStart':HTMLButtonElement; 'autoDuelSaved':HTMLButtonElement; 'stopAutoDuel':HTMLButtonElement; 'stopAutoDuelResult':HTMLButtonElement; 'autoDuelCountdown':HTMLElement;
  'cameraView':HTMLButtonElement; 'statsButton':HTMLButtonElement; 'sound':HTMLButtonElement; 'motion':HTMLButtonElement; 'pause':HTMLButtonElement; 'continueRun':HTMLButtonElement; 'setup-tab-match':HTMLButtonElement;
  'setup-tab-roster':HTMLButtonElement; 'setup-tab-rules':HTMLButtonElement; 'watchHero':HTMLButtonElement; 'resetSetup':HTMLButtonElement; 'startMatch':HTMLButtonElement; 'formsGuide':HTMLButtonElement; 'rankSetup':HTMLButtonElement;
  'resume':HTMLButtonElement; 'again':HTMLButtonElement; 'resultStats':HTMLButtonElement; 'heroWatchFocus':HTMLButtonElement; 'heroWatchStats':HTMLButtonElement; 'touchStick':HTMLButtonElement; 'walkTouch':HTMLButtonElement;
  'forceAction':HTMLButtonElement; 'feintAction':HTMLButtonElement; 'quickTechnique':HTMLButtonElement; 'phaseAction':HTMLButtonElement; 'touchLayout':HTMLButtonElement; 'touchSide':HTMLButtonElement; 'resetAim':HTMLButtonElement;
  'gameFullscreen':HTMLButtonElement; 'useTechnique':HTMLButtonElement; 'copySeed':HTMLButtonElement; 'useClassic':HTMLButtonElement; 'resumeCareer':HTMLButtonElement;
  'arena':HTMLCanvasElement;
  'chessStyleOptions':HTMLDetailsElement; 'teamOptions':HTMLDetailsElement; 'heroOptions':HTMLDetailsElement; 'roundOptions':HTMLDetailsElement;
  'guide':HTMLDialogElement; 'statsDialog':HTMLDialogElement; 'keysDialog':HTMLDialogElement; 'keysOpen':HTMLButtonElement; 'rankDialog':HTMLDialogElement;
  'app':HTMLElement; 'arenaLaunchTitle':HTMLElement; 'entry':HTMLElement; 'lobbyHeading':HTMLElement; 'setup-panel-match':HTMLElement; 'watchHeroHelp':HTMLElement; 'setup-panel-roster':HTMLElement;
  'kitHint0':HTMLElement; 'kitHint1':HTMLElement; 'fighterSettings':HTMLElement; 'lobbyFormsHeading':HTMLElement; 'yourFormRow':HTMLElement; 'styleLabel':HTMLElement; 'playerSlotLabel':HTMLElement;
  'formDetail':HTMLElement; 'airFormDetail':HTMLElement; 'teamFormRow':HTMLElement; 'blueDefaultLabel':HTMLElement; 'roster0':HTMLElement; 'roster1':HTMLElement; 'chessStyleHint0':HTMLElement;
  'chessStyleHint1':HTMLElement; 'teamControls':HTMLElement; 'rankFloorList':HTMLElement; 'heroEloHint0':HTMLElement; 'heroPosLabel0':HTMLElement; 'heroEloHint1':HTMLElement; 'heroPosLabel1':HTMLElement;
  'heroHelp':HTMLElement; 'heroEmpty':HTMLElement; 'setup-panel-rules':HTMLElement; 'arenaShell':HTMLElement; 'hud':HTMLElement; 'blueName':HTMLElement; 'blueRank':HTMLElement;
  'blueCount':HTMLElement; 'blueInjuries':HTMLElement; 'round':HTMLElement; 'clock':HTMLElement; 'redCount':HTMLElement; 'redRank':HTMLElement; 'rivalName':HTMLElement;
  'redInjuries':HTMLElement; 'mapCaption':HTMLElement; 'mapCaptionName':HTMLElement; 'mapCaptionDesc':HTMLElement; 'objectiveHUD':HTMLElement; 'objectiveBlue':HTMLElement; 'objectiveLabel':HTMLElement;
  'objectivePink':HTMLElement; 'pauseOverlay':HTMLElement; 'pauseTitle':HTMLElement; 'result':HTMLElement; 'resultRound':HTMLElement; 'resultTitle':HTMLElement; 'resultText':HTMLElement;
  'turningPoint':HTMLElement; 'rankResult':HTMLElement; 'floorUI':HTMLElement; 'profileText':HTMLElement; 'modeLabel':HTMLElement; 'commandBar':HTMLElement; 'heroWatch':HTMLElement;
  'heroWatchPlan':HTMLElement; 'heroWatchMove':HTMLElement; 'heroWatchTrakata':HTMLElement; 'actions':HTMLElement; 'signatureHint':HTMLElement; 'forceHint':HTMLElement; 'airControlHint':HTMLElement;
  'guardHint':HTMLElement; 'phaseLabel':HTMLElement; 'phaseHint':HTMLElement; 'mobileTools':HTMLElement; 'techniqueBar':HTMLElement; 'techniqueHelp':HTMLElement; 'help':HTMLElement;
  'helpText':HTMLElement; 'guideTitle':HTMLElement; 'guideForms':HTMLElement; 'statsRound':HTMLElement; 'statsTitle':HTMLElement; 'injuryHeading':HTMLElement; 'moveRank':HTMLElement;
  'fighterDamageDealt':HTMLElement; 'fighterDamageTaken':HTMLElement; 'injuryReference':HTMLElement; 'attackMoves':HTMLElement; 'defenseMoves':HTMLElement; 'reportSeed':HTMLElement; 'rankTitle':HTMLElement;
  'careerStatus':HTMLElement; 'announce':HTMLElement;
  'lobby':HTMLFormElement;
  'count0':HTMLInputElement; 'count1':HTMLInputElement; 'dualPhase0':HTMLInputElement; 'dualPhase1':HTMLInputElement; 'matchSeed':HTMLInputElement; 'saberOnly':HTMLInputElement;
  'recentEvents':HTMLOListElement;
  'arenaRatingStatus':HTMLParagraphElement; 'frameRate':HTMLOutputElement; 'setupStatus':HTMLOutputElement;
  'energy':HTMLProgressElement;
  'participation':HTMLSelectElement; 'rule':HTMLSelectElement; 'mapPick':HTMLSelectElement; 'mapSize':HTMLSelectElement; 'saberKit0':HTMLSelectElement; 'saberKit1':HTMLSelectElement; 'bodyStyle':HTMLSelectElement;
  'style':HTMLSelectElement; 'playerSlot':HTMLSelectElement; 'groupForms0':HTMLSelectElement; 'groupForms1':HTMLSelectElement; 'chessStyles0':HTMLSelectElement; 'chessStyles1':HTMLSelectElement; 'heroChoice0':HTMLSelectElement;
  'heroPos0':HTMLSelectElement; 'heroChoice1':HTMLSelectElement; 'heroPos1':HTMLSelectElement; 'duration':HTMLSelectElement; 'pace':HTMLSelectElement; 'weatherPick':HTMLSelectElement; 'heroWatchChoice':HTMLSelectElement;
  'chosenTechnique':HTMLSelectElement; 'moveFighter':HTMLSelectElement;
  'bodyRows':HTMLTableSectionElement; 'roundStats':HTMLTableSectionElement; 'fighterStats':HTMLTableSectionElement;
}

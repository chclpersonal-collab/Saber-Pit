import { arenaPalette, drawArenaStage, drawArenaCurrent } from './arena-stage.js?v=1.5.0';
import { createArenaImpact } from './arena-impact.js?v=1.5.0';
import { QUICK_FIGHTS } from './quick-fights.js?v=1.5.0';
import { createGame, step, resetRenderSnapshots, duelIntent, command, commandReadiness, nextRound, setAutoCommand, setDoctrine, setFormation, setTargetPriority, visibleEnemyTargets, setForm, setControlledFighter, setPlayerInput, clearPlayerInput, getEnvironment, DOCTRINES, WEAPONS, KNIVES, COVER_NODES } from './sim.js?v=1.4.0';
import { displayText, displayBattleText } from './copy.js?v=1.4.0';
import { SOLDIER_GRADES, gradeDisplayLabel, progressionSummary, combatSkillProfile } from './progression.js?v=1.4.0';
import { FORMS, MAPS, FORCE_FAMILIES, QUALITY_LEVELS } from './content.js?v=1.4.0';
import { MAP_SIZES } from './maps.js?v=1.4.0';
import { FORMATIONS, TARGET_PRIORITIES } from './formations.js?v=1.4.0';
import { MATCH_MODES, ROUND_DURATIONS, describeMatchRules } from './match-rules.js?v=1.4.0';
import { MODIFIERS, getModifier, permitsForceAttacks } from './modifiers.js?v=1.4.0';
import { objectiveFeedback, nextInspectionId } from './ui-state.js?v=1.4.0';
import { masterySummary } from './mastery.js?v=1.4.0';
import { ENVIRONMENTS } from './environment.js?v=1.4.0';
import { createPlayerInput } from './input.js?v=1.4.0';
import { COLOR_SCHEMES, loadPreferences, savePreferences } from './preferences.js?v=1.4.0';
import { createAudio } from './audio.js?v=1.4.0';
import { saveCampaign, loadCampaign, hasSavedCampaign } from './persistence.js?v=1.4.0';
import { combatFormProfile, moveSummary, selectFormMove } from './combat-forms.js?v=1.4.0';
import { sampleAirborne, airborneHeight } from './airborne.js?v=1.4.0';
import { forceRepertoire, forceAbilityById, forceAbilityWeapon } from './force-abilities.js?v=1.4.0';
import { usesDualSabers, saberWieldProfile } from './dual-sabers.js?v=1.4.0';
import { sampleCombatPose } from './choreography.js?v=1.4.0';
import { sampleFighterRig, drawFighterRig } from './pose-rig.js?v=1.5.0';
import { fitBattleCamera, worldToCanvas, canvasToWorld } from './camera.js?v=1.5.0';
import { lineOfSight } from './terrain.js?v=1.4.0';
import { squadIntent, commandIntent, setDeployment } from './sim.js?v=1.4.0';
import { DEPLOYMENTS, SQUAD_ORDERS } from './squad-commands.js?v=1.4.0';
import { buildBattleRecap } from './battle-recap.js?v=1.4.0';
import { createRenderFrame } from './render-interpolation.js?v=1.4.0';
import { createPresentationClock } from './presentation-clock.js?v=1.4.0';
import { createPresentationEffects } from './presentation-effects.js?v=1.4.0';
import { sampleSharedCombatBeats, applySharedCombatBeat } from './combat-sequences.js?v=1.4.0';

import type {ClassicGame, ClassicSoldier} from './sim.js';
import type {ClassicFormId} from './combat-forms.js';
import type {Point} from './terrain.js';

type ButtonId = 'mainMenuBtn' | 'battleOptionsBtn' | 'speedBtn' | 'pauseBtn' | 'resetBtn' | 'continueSessionBtn' | 'loadCheckpointBtn' | 'optionsBtn' | 'controlsBtn' | 'masterTrialBtn' | 'applyAllFormsBtn' | 'mixPlayerFormsBtn' | 'startBattleBtn' | 'closeOptionsBtn' | 'closeControlsBtn' | 'closeInspectorBtn' | 'takeControlBtn' | 'resumeBtn' | 'spectateBtn' | 'nextRoundBtn' | 'inspectResultBtn' | 'reviewResultBtn' | 'reviewNextBtn' | 'previousFighterBtn' | 'nextFighterBtn' | 'inspectCarrierBtn' | 'cycleTargetBtn' | 'advanceBtn' | 'holdBtn' | 'retreatBtn' | 'flankBtn' | 'regroupBtn' | 'grenadeBtn' | 'smokeBtn' | 'autoBtn' | 'intelBtn' | 'soundBtn' | 'detailsBtn' | 'saveCampaignBtn' | 'resumeCampaignBtn' | 'copySeedBtn' | 'exportBtn';
type SvgId = 'pauseIcon';
type FormId = 'setupForm';
type SelectId = 'setupMatchMode' | 'setupRoundDuration' | 'setupModifier' | 'setupTerrain' | 'setupMapSize' | 'setupEnvironment' | 'setupOpponentForm' | 'setupPlayerSlot' | 'setupSpeed' | 'setupDoctrine' | 'setupEnemyDoctrine' | 'setupAllForms' | 'optionColors' | 'optionMotion' | 'optionEffects' | 'nextEnemyDoctrine' | 'inspectTeam' | `nextDeployment${number}` | `nextFormation${number}` | `nextPriority${number}` | `setupDeployment${number}` | `setupFormation${number}` | `setupPriority${number}` | `setupStartingForce${number}` | `setupStartingForceQuality${number}` | `setupStartingRank${number}` | `setupStartingSaber${number}`;
type InputId = 'setupSeed' | 'optionTactical' | 'optionSound' | `setupStartingDualSabers${number}` | `setupTeam${number}`;
type DetailsId = 'setupStartingOptions' | 'mutationDetails';
type DialogId = 'optionsDialog' | 'controlsDialog';
type CanvasId = 'battleCanvas';
type OutputId = 'fightCallout' | 'debugState';
type ClassicElement<Id extends string> = Id extends SvgId ? SVGSVGElement :
  Id extends InputId ? HTMLInputElement :
  Id extends CanvasId ? HTMLCanvasElement :
  Id extends SelectId ? HTMLSelectElement :
  Id extends DialogId ? HTMLDialogElement :
  Id extends DetailsId ? HTMLDetailsElement :
  Id extends OutputId ? HTMLOutputElement :
  Id extends FormId ? HTMLFormElement :
  Id extends ButtonId ? HTMLButtonElement : HTMLElement;
const $ = <Id extends string>(id: Id): ClassicElement<Id> => document.getElementById(id) as unknown as ClassicElement<Id>;
const canvas = $('battleCanvas');
const ctx = canvas.getContext('2d', { alpha: false })!;
const world = { width: 960, height: 540 };
const params = new URLSearchParams(location.search);
// QA runs never read or overwrite the owner's persistent campaign.
const qaSession = params.get('qa') === '1';
const qaValues = new Map<string, string>();
const campaignStorage = qaSession ? { getItem: (key: string) => qaValues.get(key) ?? null, setItem: (key: string, value: string) => qaValues.set(key, String(value)), removeItem: (key: string) => qaValues.delete(key) } : undefined;
const qaStatus = qaSession ? document.createElement('output') : null;
let qaFrames = 0, qaLastError = '';
let qaFullMotion = false;
interface QaSample {
  round: number; tick: number; generation: string; appPhase: string;
}
interface VisualPuff extends Point {ttl: number; maxTtl: number; size: number; drift: number}
type Effect = ClassicGame['effects'][number];
type RenderSwing = Effect & {round: number; tick: number};
type CombatFeedback = Effect & {remaining: number};
const qaDisplayFrames: QaSample[] = [];
let qaFrameLog: HTMLPreElement | null = null, qaLogUpdated = 0, qaSampleGame: ClassicGame | null = null, qaEpoch = 0;
if (qaStatus) {
  qaStatus.id = 'qaStatus'; qaStatus.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#071521;color:#c9ffff;font:11px monospace;padding:5px;pointer-events:none';
  document.body.append(qaStatus);
  const details = document.createElement('details');
  details.id = 'qaDisplayTelemetry'; details.open = true;
  details.style.cssText = 'position:fixed;bottom:28px;left:0;z-index:99998;background:#071521;color:#c9ffff;font:10px monospace;max-width:480px';
  const summary = document.createElement('summary'); summary.textContent = 'QA display-frame samples (latest 300, not an FPS claim)';
  qaFrameLog = document.createElement('pre'); qaFrameLog.id = 'qaDisplayFrames';
  qaFrameLog.style.cssText = 'max-height:65px;overflow:auto;max-width:480px;margin:0;white-space:pre-wrap';
  details.append(summary, qaFrameLog); document.body.append(details);
  const motionLabel = document.createElement('label'), motionToggle = document.createElement('input');
  motionToggle.type = 'checkbox'; motionToggle.id = 'qaFullMotion';
  motionLabel.append(motionToggle, ' Full-motion QA preview (this tab only)'); details.prepend(motionLabel);
  motionToggle.addEventListener('change', () => { qaFullMotion = motionToggle.checked; resetPresentation(); draw(); });
  window.addEventListener('error', event => { qaLastError = event.message || 'Runtime error'; qaStatus.textContent = qaLastError; });
  window.addEventListener('unhandledrejection', event => { qaLastError = String(event.reason); qaStatus.textContent = qaLastError; });
}
const requestedSeed = Number(params.get('seed'));
let seed: ClassicGame['seed'] = params.has('seed') && Number.isFinite(requestedSeed) ? (requestedSeed >>> 0) || 1 : (Math.floor(Math.random() * 99998) + 1);
let game = createGame(seed, { mode: 'spectate' });
let appPhase: 'menu' | 'playing' | 'review' | 'paused' | 'results' = 'menu';
let sessionStarted = false;
let animationHandle = 0;
let preferences = loadPreferences();
let manualDeathHandled = false;
let soundRequest = 0;
let nextDoctrine = game.doctrines?.[0] || 'balanced';
let nextForms = [...game.forms[0]];
let nextEnemyDoctrine = game.doctrines?.[1] || 'balanced';
let nextFormations = [...(game.config?.formations || ['line', 'line'])];
let nextDeployments = [...(game.config?.deployments || ['standard', 'standard'])];
let nextTargetPriorities = [...(game.config?.targetPriorities || ['balanced', 'balanced'])];
let campaignSavingEnabled = false;
const audio = createAudio();
let selectedUnitId: string | null = null;
let currentOrderMarker: (Point & {label: string}) | null = null;
let tacticalView = preferences.tacticalView;
let smokeCooldownMax = 1;
let lastEventSignature = '';
let lastObjectiveSignature = '';
let lastTerrainSignature = '';
let visualGeneration = '';
let lastVisualEffect = 0;
let visualPuffs: VisualPuff[] = [];
let combatFeedback: CombatFeedback[] = [];
let feedbackGeneration = '';
let lastFeedbackEffect = 0;
let lastFeedbackTick = 0;
let renderFighters = new Map<string | number, ClassicSoldier>(), renderSwings = new Map<string, RenderSwing>(), renderBlocks = new Map<string, Effect & {tick: number}>();
let renderPoseGame: ClassicGame | null = null, lastPoseTick = 0;
type RenderFrame = ReturnType<typeof createRenderFrame<ClassicSoldier, ClassicGame["objective"], Effect>>;
let renderFrame: RenderFrame = null!, renderTick = 0;
const presentationClock = createPresentationClock();
const presentationEffects = createPresentationEffects();
const arenaImpact = createArenaImpact();
let lastCalloutId = 0, calloutUntil = 0;
let sharedBeats = new Map();
let presentationGame: ClassicGame | null = null, presentationRound: number | null = null;
function resetPresentation() {
  presentationClock.reset(game); presentationEffects.reset((game.effects || []) as Parameters<typeof presentationEffects.reset>[0]); arenaImpact.reset((game.effects || []) as Parameters<typeof arenaImpact.reset>[0]);
  lastCalloutId = (game.effects || []).reduce((max, event) => Math.max(max, event.id || 0), 0);
  calloutUntil = 0; $('fightCallout').hidden = true;
  sharedBeats.clear(); renderSwings.clear(); renderBlocks.clear();
  presentationGame = game; presentationRound = game.round;
}
const rankNames = ['Recruit', 'Veteran', 'Elite', 'Ace'];
let paused = true;
let speed: number = preferences.speed;
let lastTime = 0;
let lastUI = 0;
let resultShown = false;
let toastUntil = 0;
let mutationUntil = 0;
let cooldownMax = 1;
let view = { ...fitBattleCamera(), dpr: 1 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const colors = { ...COLOR_SCHEMES[preferences.colors] };
const input = createPlayerInput({
  active: () => appPhase === 'playing' && !paused && game.status === 'playing' && game.config?.mode === 'play' && !document.querySelector('dialog[open]'),
  keyboardActive: () => document.activeElement === canvas,
  onCycleTarget: cycleTarget,
});
function motionReduced() { return qaSession && qaFullMotion ? false : preferences.motion === 'reduce' || reducedMotion.matches; }
function clearInput() { input.clear(); clearPlayerInput(game); document.querySelectorAll('.is-held').forEach(button => button.classList.remove('is-held')); }
function ensureFrame() { if (!animationHandle && appPhase !== 'menu') animationHandle = requestAnimationFrame(frame); }
const commands = [...document.querySelectorAll<HTMLButtonElement>('[data-order]')];
const orderText = { flank: 'Finding a side approach', regroup: 'Regrouping at the team rally point', advance: 'Advancing toward the enemy', hold: 'Holding position', retreat: 'Moving back to cover' };
const orderShort = { flank: 'Team flanking', regroup: 'Team regrouping', advance: 'Team advancing →', hold: 'Holding position', retreat: '← Falling back' };

function buildPips() {
  for (const [team, name] of ['player', 'enemy'].entries()) {
    const container = $(name + 'Pips'); container.replaceChildren();
    for (const soldier of game.soldiers.filter(s => s.team === team)) {
      const pip = document.createElement('span'); pip.className = 'unit-pip'; container.append(pip);
    }
  }
}
function syncWorld() {
  world.width = game.terrain?.width || 960; world.height = game.terrain?.height || 540;
  if (terrain.width !== world.width || terrain.height !== world.height) { terrain.width = world.width; terrain.height = world.height; }
}

function announce(message: string) { $('announcer').textContent = message; }
function showToast(message: string) {
  $('orderToast').textContent = message;
  $('orderToast').classList.add('is-visible');
  toastUntil = performance.now() + 1500;
}
function issueOrder(order: string) {
  if (appPhase !== 'playing' || paused || game.status !== 'playing' || game.config?.mode === 'spectate') return;
  if (Object.hasOwn(SQUAD_ORDERS, order) && commandIntent(game, 0)!.eligible === 0) { showToast('No AI teammates available for movement orders.'); return; }
  const accepted = command(game, order);
  if (order === 'force') {
    if (accepted !== false) {
      cooldownMax = Math.max(1, game.forceCooldown);
      showToast('Team Force attack started');
    }
  } else if (order === 'guard') {
    if (accepted !== false) { smokeCooldownMax = Math.max(1, game.guardCooldown); showToast('Team guarding'); }
  } else {
    if (accepted !== false) { showToast(orderShort[order as keyof typeof orderShort]); announce(orderShort[order as keyof typeof orderShort]); }
  }
  if (accepted === false) showToast(displayText(commandReadiness(game, order).reason));
  updateUI();
}
function setPaused(next: boolean) {
  if (!sessionStarted || appPhase === 'menu' || game.status !== 'playing') return;
  if (!next && game.config?.mode === 'play' && !game.soldiers.some(s => s.id === game.control?.soldierId && s.alive)) { showToast('Choose a living teammate or watch instead.'); return; }
  paused = next; appPhase = next ? 'paused' : 'playing';
  resetRenderSnapshots(game);
  resetPresentation();
  if (!next && game.config?.mode === 'play') selectedUnitId = null;
  clearInput();
  if (paused) audio.silence(); else restoreAudioFromGesture();
  lastTime = 0;
  $('pausedOverlay').hidden = !paused;
  $('pauseBtn').setAttribute('aria-pressed', String(paused));
  $('pauseBtn').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  $('pauseBtn').title = paused ? 'Resume (P)' : 'Pause (P)';
  $('pauseLabel').textContent = paused ? 'Resume' : 'Pause';
  $('pauseIcon').innerHTML = paused ? '<path d="m6 3 11 7-11 7Z" fill="currentColor"/>' : '<path d="M6 4v12M14 4v12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
  announce(paused ? 'Paused.' : 'Playing.');
  updateUI(); ensureFrame();
}
function restart() { openMainMenu(); $('setupSeed').value = String(seed); $('setupForm').scrollIntoView({ block: 'start', behavior: 'instant' }); }

function beginNextRound() {
  if (game.status !== 'ended') return;
  setDoctrine(game, nextDoctrine);
  setDoctrine(game, nextEnemyDoctrine, 1);
  for (let team = 0; team < 2; team++) { setFormation(game, nextFormations[team], team); setDeployment(game, nextDeployments[team], team); setTargetPriority(game, nextTargetPriorities[team], team); }
  nextForms.forEach((form, lane) => setForm(game, lane, form));
  nextRound(game);
  clearInput(); manualDeathHandled = false; appPhase = 'playing';
  syncWorld(); buildPips(); resize();
  campaignSavingEnabled = true;
  checkpointCampaign();
  selectedUnitId = null;
  smokeCooldownMax = 1;
  lastEventSignature = '';
  drawTerrain();
  buildRoster();
  paused = false;
  resultShown = false;
  lastTime = 0;
  cooldownMax = 1;
  $('resultOverlay').hidden = true;
  $('roundReviewBar').hidden = true;
  $('pausedOverlay').hidden = true;
  setPaused(false);
  showMutations();
  announce(`Round ${game.round} started. ${DOCTRINES[game.doctrines[0]].name} team style. Ranks and stats kept. Forms and equipment updated.`);
  updateUI();
  ensureFrame(); canvas.focus({ preventScroll: true });
}

commands.forEach(button => button.addEventListener('click', () => issueOrder(button.dataset.order!)));
$('grenadeBtn').addEventListener('click', () => issueOrder('force'));
$('smokeBtn').addEventListener('click', () => issueOrder('guard'));
$('pauseBtn').addEventListener('click', () => setPaused(!paused));
$('resumeBtn').addEventListener('click', () => { setPaused(false); if (!paused) canvas.focus({ preventScroll: true }); });
$('resetBtn').addEventListener('click', restart);
$('nextRoundBtn').addEventListener('click', beginNextRound);
$('reviewNextBtn').addEventListener('click', beginNextRound);
$('inspectResultBtn').addEventListener('click', () => {
  $('resultOverlay').hidden = true; $('roundReviewBar').hidden = false; canvas.focus({ preventScroll: true });
  announce('Round over. Select a fighter to see their stats, or start the next round.');
});
$('reviewResultBtn').addEventListener('click', () => {
  selectUnit(null); $('roundReviewBar').hidden = true; $('resultOverlay').hidden = false; $('nextRoundBtn').focus();
});
$('speedBtn').addEventListener('click', () => {
  speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  preferences.speed = speed as typeof preferences.speed; savePreferences(preferences);
  $('speedBtn').textContent = speed + '×';
  $('speedBtn').setAttribute('aria-label', `Game speed: ${speed} times`);
  showToast(`Battle speed ${speed}×`);
  updateUI();
});
window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  const key = event.key.toLowerCase();
  if (appPhase === 'menu' || document.querySelector('dialog[open]')) return;
  if (!$('resultOverlay').hidden && key === 'tab') {
    const controls = [...$('resultOverlay').querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), summary, a[href]')].filter(control => control.getClientRects().length > 0);
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault(); controls[next]?.focus(); return;
  }
  if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  if (key === 'escape' && selectedUnitId && (paused || game.config?.mode !== 'play')) { event.preventDefault(); selectUnit(null); return; }
  if (key === 'escape' || key === 'p') { event.preventDefault(); setPaused(!paused); return; }
  if (key === 'r' && paused) { event.preventDefault(); restart(); return; }
  if (key === ' ' && target instanceof HTMLElement && target.closest('button')) return;
  if (game.status !== 'playing' || paused || game.config?.mode !== 'command') return;
  const order = { a: 'advance', s: 'hold', d: 'retreat', ' ': 'force', f: 'guard' }[key];
  if (order) { event.preventDefault(); issueOrder(order); }
});
document.addEventListener('visibilitychange', () => {
  clearInput(); resetRenderSnapshots(game);
  resetPresentation();
  if (document.hidden && appPhase === 'playing' && game.status === 'playing' && !paused) setPaused(true);
  lastTime = 0;
  if (!document.hidden && appPhase !== 'menu') ensureFrame();
});

function weaponSummary(team: number) {
  const squad = game.soldiers.filter(s => s.team === team);
  const styles = new Set(squad.map(s => s.form));
  return `${styles.size === 1 ? FORMS[squad[0].form].name : styles.size + ' forms'} · ${permitsForceAttacks(game.config) ? 'Sabers & Force' : 'Sabers only'}`;
}
function updateUI() {
  $('debugState').dataset.phase = appPhase;
  if (appPhase === 'menu') return;
  const teams = [0, 1].map(team => game.soldiers.filter(s => s.team === team));
  const living = teams.map(squad => squad.filter(s => s.alive).length);
  const ended = game.status === 'ended';
  $('playerCount').innerHTML = `${living[0]}<span>/${teams[0].length}</span>`;
  $('enemyCount').innerHTML = `${living[1]}<span>/${teams[1].length}</span>`;
  for (let t = 0; t < 2; t++) {
    const pips = $(t === 0 ? 'playerPips' : 'enemyPips').children;
    teams[t].forEach((soldier, index) => {
      if (!pips[index]) return;
      pips[index].classList.toggle('is-out', !soldier.alive);
      pips[index].classList.toggle('is-hurt', soldier.alive && soldier.hp < soldier.maxHp * .45);
    });
  }
  const remaining = Math.max(0, Math.ceil(game.timeLeft));
  $('timer').textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  $('roundLabel').textContent = 'ROUND ' + String(game.round).padStart(2, '0');
  $('matchScore').textContent = `${game.score[0]} — ${game.score[1]}`;
  $('playerLoadout').textContent = weaponSummary(0);
  $('enemyLoadout').textContent = weaponSummary(1);
  $('playerLoadout').title = weaponSummary(0);
  $('enemyLoadout').title = weaponSummary(1);
  $('seedLabel').textContent = 'SEED ' + String(seed).padStart(5, '0');
  $('fieldStatus').textContent = ended ? 'ROUND OVER' : paused ? 'PAUSED' : 'PLAYING';
  $('commandStatus').textContent = ended ? (game.winner === 0 ? 'Your team won' : game.winner === 1 ? 'Enemy team won' : 'Draw') : paused ? 'Battle paused' : (orderText[game.playerOrder] || 'Holding position');
  commands.forEach(button => {
    const active = button.dataset.order === game.playerOrder;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = ended || paused || game.config?.mode === 'spectate';
  });
  $('pauseBtn').disabled = ended;
  const cooldown = Math.max(0, game.forceCooldown || 0);
  const forceReady = commandReadiness(game, 'force');
  cooldownMax = Math.max(cooldownMax, cooldown);
  $('grenadeBtn').disabled = ended || paused || !forceReady.ready;
  $('grenadeHint').textContent = paused ? 'Resume to command' : forceReady.ready ? `${forceReady.eligible} ready to cast` : displayText(forceReady.reason);
  $('grenadeFill').style.transform = `scaleX(${cooldown > 0 ? Math.max(0, 1 - cooldown / cooldownMax) : 0})`;
  $('grenadeBtn').setAttribute('aria-label', `Team Force attack. ${$('grenadeHint').textContent}`);
  $('grenadeBtn').title = displayText(forceReady.reason);
  $('battleCanvas').setAttribute('aria-label', `Round ${game.round}. Your team: ${living[0]} of ${teams[0].length} alive. Enemy team: ${living[1]} of ${teams[1].length} alive. ${paused ? 'Paused.' : ended ? 'Round ended.' : orderText[game.playerOrder] + '.'}`);
  updateUpgradeUI();
  const debug = $('debugState');
  debug.dataset.doctrine = game.doctrines[0];
  debug.dataset.careerGrades = game.soldiers.filter(s => s.team === 0).map(s => careerOf(s).grade).join(',');
  Object.assign(debug.dataset, { tick: String(game.tick), time: game.time.toFixed(3), paused: String(paused), speed: String(speed), seed: String(seed), playerCount: String(living[0]), enemyCount: String(living[1]), round: String(game.round), status: game.status, winner: String(game.winner), forceCooldown: cooldown.toFixed(3), guardCooldown: String(game.guardCooldown || 0), autoCommand: String(Boolean(game.autoCommand)), selectedUnit: selectedUnitId || '', tacticalView: String(tacticalView), sound: String(audio.enabled), order: game.playerOrder });
  updateDirectUI();
  if (ended && !resultShown) showResult(living);
}
function showResult(living: readonly number[]) {
  const settledDuringPlay = appPhase === 'playing';
  appPhase = 'results'; paused = false; clearInput(); audio.silence();
  resultShown = true;
  nextForms = [...game.forms[0]];
  buildFormChoices();
  nextDoctrine = game.doctrines?.[0] || 'balanced';
  syncTacticalPlan();
  updateRoundBriefing();
  if (campaignSavingEnabled && settledDuringPlay) checkpointCampaign();
  selectedUnitId = null; updateInspector();
  $('roundReviewBar').hidden = true;
  $('pausedOverlay').hidden = true;
  $('mutationBanner').hidden = true;
  $('orderToast').classList.remove('is-visible');
  const win = game.winner === 0;
  const draw = game.winner === null;
  const title = draw ? 'Draw' : win ? 'Round won' : 'Round lost';
  $('resultTitle').textContent = title;
  const emblemPath = draw ? '<path d="M3 8h18M3 16h18m-4-4 4 4-4 4M7 4 3 8l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : win ? '<path d="m12 2 3 6.5 7 .9-5 5 1.3 7-6.3-3.5L5.7 21l1.3-6.6-5-5 7-.9Z" fill="currentColor"/>' : '<path d="M6 21V3m0 1h13l-3 5 3 5H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  $('resultEmblem').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${emblemPath}</svg>`;
  $('resultEmblem').style.background = win ? '#d4dec0' : draw ? '#dddabe' : '#ead2b8';
  $('resultEmblem').style.color = win ? '#3c6755' : '#826547';
  $('resultEyebrow').textContent = `ROUND ${String(game.round).padStart(2, '0')} OVER`;
  $('resultDescription').textContent = game.reason ? displayText(game.reason) + '.' : draw ? 'Neither team won.' : win ? 'Your team won this round.' : 'The enemy won this round.';
  const timeout = /time|limit/i.test(game.reason || '');
  $('resultRules').textContent = `${describeMatchRules(game.config).reportDescription} · ${getModifier(game.config.modifier).name}`;
  $('resultObjective').hidden = !describeMatchRules(game.config).objectiveEnabled;
  $('resultObjective').textContent = `${game.config.matchMode === 'relic' ? 'Deliveries' : 'Signal points'}: your team ${Math.floor(game.objective?.points[0] || 0)} · enemy ${Math.floor(game.objective?.points[1] || 0)}`;
  $('resultHealth').hidden = !timeout;
  if (timeout) {
    const health = [0, 1].map(team => game.soldiers.filter(s => s.team === team && s.alive).reduce((sum, s) => sum + s.hp, 0));
    const format = (value: number) => Number(value.toFixed(3)).toLocaleString();
    $('resultHealth').textContent = `Health left: you ${format(health[0])} · enemy ${format(health[1])}`;
  }
  $('resultPlayer').textContent = String(living[0]);
  $('resultEnemy').textContent = String(living[1]);
  $('resultOverlay').hidden = false;
  announce(`${title}. ${living[0]} of your fighters and ${living[1]} enemy fighters remain. Check the stats and choose your next-round settings.`);
  $('resultOverlay').querySelector<HTMLElement>('.result-card')!.scrollTop = 0;
  $('resultTitle').tabIndex = -1;
  $('resultTitle').focus({ preventScroll: true });
}

function careerOf(soldier: ClassicSoldier) {
  const snapshot = soldier.career;
  const progress = progressionSummary(snapshot?.merit || 0);
  // Old saves retain their exact combat snapshot. Only the displayed ladder is current.
  return { ...snapshot, ...progress, modifiers: snapshot?.modifiers || progress.modifiers };
}
function careerPowers(career: ReturnType<typeof careerOf>) {
  const modifiers = career.modifiers;
  const health = Number(((modifiers.healthMultiplier - 1) * 100).toFixed(1));
  const accuracy = Number((modifiers.accuracyBonus * 100).toFixed(1));
  const reload = Number(((1 - modifiers.reloadMultiplier) * 100).toFixed(1));
  return health || accuracy || reload ? `Training bonuses: +${health}% health · +${accuracy} accuracy points · ${reload}% shorter saber recovery` : 'Training bonuses: none yet. Earn training points to improve stats.';
}
function updateDoctrineChoices() {
  for (const button of $('doctrineChoices').children as HTMLCollectionOf<HTMLButtonElement>) {
    button.setAttribute('aria-pressed', String(button.dataset.doctrine === nextDoctrine));
  }
  $('doctrineHint').textContent = displayText(DOCTRINES[nextDoctrine].description);
}
function buildDoctrineChoices() {
  $('doctrineChoices').replaceChildren();
  for (const doctrine of Object.values(DOCTRINES)) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.doctrine = doctrine.id;
    button.textContent = doctrine.name;
    button.setAttribute('aria-describedby', 'doctrineHint');
    button.addEventListener('click', () => {
      nextDoctrine = doctrine.id;
      updateDoctrineChoices();
      announce(`${doctrine.name} selected for next round. ${displayText(doctrine.description)}`);
    });
    $('doctrineChoices').append(button);
  }
  updateDoctrineChoices();
}
function buildFormChoices() {
  $('formChoices').replaceChildren();
  for (let lane = 0; lane < game.forms[0].length; lane++) {
    const row = document.createElement('div'); row.className = 'form-choice';
    const label = document.createElement('label'); label.htmlFor = `form-slot-${lane}`;
    label.textContent = `Fighter ${String(lane + 1).padStart(2, '0')}`;
    const select = document.createElement('select'); select.id = label.htmlFor; select.dataset.lane = String(lane);
    const groups = new Map();
    for (const form of Object.values(FORMS)) {
      const groupKey = String(form.primaryForm);
      if (!groups.has(groupKey)) { const group = document.createElement('optgroup'); group.label = `Form ${groupKey}`; groups.set(groupKey, group); select.append(group); }
      const option = document.createElement('option'); option.value = form.id; option.textContent = form.name;
      groups.get(groupKey).append(option);
    }
    select.value = nextForms[lane];
    const describe = (form: (typeof FORMS)[ClassicFormId]) => {
      const practice = masterySummary(game.mastery?.[0]?.[lane], form.id);
      return `${displayText(form.trait)} Damage ×${form.damageMultiplier.toFixed(2)} · recovery ×${form.attackIntervalMultiplier.toFixed(2)} · Force cost ×${form.forceCostMultiplier.toFixed(2)}. Form stats: ${practice.rounds} rounds · ${practice.kills} kills · ${Math.round(practice.damage)} damage.`;
    };
    const trait = document.createElement('small'); trait.id = `form-trait-${lane}`; trait.textContent = describe(FORMS[select.value as ClassicFormId]);
    select.setAttribute('aria-describedby', trait.id);
    select.addEventListener('change', () => { nextForms[lane] = select.value as ClassicFormId; trait.textContent = describe(FORMS[select.value as ClassicFormId]); });
    row.append(label, select, trait); $('formChoices').append(row);
  }
}
function updateBattleRecap() {
  const recap = buildBattleRecap(game as ClassicGame & {roundReport: NonNullable<ClassicGame['roundReport']>}, { round: game.round, limit: 5 });
  const totals = recap.totals!;
  const pair = (values: unknown) => Array.isArray(values) ? values.join(' / ') : 'unavailable';
  const objectiveLabel = totals.mode === 'relic' ? 'Relic deliveries' : 'Signal points';
  const objective = totals.mode === 'control' && Array.isArray(totals.objective) ? totals.objective.map(Math.floor) : totals.objective;
  $('roundRecapTotals').textContent = `Your team / enemy: Kills ${pair(totals.kills)} · Casualties ${pair(totals.deaths)}${totals.mode === 'elimination' ? '' : ` · ${objectiveLabel} ${pair(objective)}`}`;
  $('roundRecap').replaceChildren();
  for (const event of recap.events) {
    const item = document.createElement('li');
    const seconds = Math.max(0, Math.floor(event.time));
    item.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · ${displayBattleText(event.text)}`;
    $('roundRecap').append(item);
  }
  const coverage = recap.coverage;
  const notes = [coverage.kind === 'unavailable' ? 'Round details unavailable.' : coverage.kind === 'summary-only' ? 'Saved summary only.' : 'Recorded events; not a full replay.'];
  if (!coverage.complete) notes.push('Earlier events unavailable.');
  if (coverage.truncated) notes.push('Older recorded events omitted.');
  if (coverage.selectionOmitted) notes.push(`${coverage.selectionOmitted} more recorded events not shown.`);
  if (!recap.events.length && coverage.kind === 'recorded') notes.push('No notable events recorded.');
  $('roundRecapCoverage').textContent = notes.join(' ');
}
function updateRoundBriefing() {
  updateBattleRecap();
  const awards = (game.roundReport?.careers || []).filter(award => award.team === 0);
  const promoted = awards.filter(award => award.promoted);
  const earned = awards.reduce((sum, award) => sum + award.earned, 0);
  $('resultCareer').textContent = `Your team earned ${earned} training points · ${promoted.length} ${promoted.length === 1 ? 'promotion' : 'promotions'}. Ranks carry over.`;
  $('resultPromotions').replaceChildren();
  for (const award of awards) {
    const item = document.createElement('li');
    item.classList.toggle('is-promoted', award.promoted);
    item.textContent = `Fighter ${String(award.lane + 1).padStart(2, '0')} · ${award.promoted ? `${gradeDisplayLabel(award.before.grade)} → ${gradeDisplayLabel(award.after.grade)}` : `Rank ${gradeDisplayLabel(award.after.grade)}`} · +${award.earned} training points`;
    $('resultPromotions').append(item);
  }
  if (!awards.length) {
    const item = document.createElement('li'); item.textContent = 'Select a fighter to see their stats.'; $('resultPromotions').append(item);
  }
  updateMasteryReport();
  updateDoctrineChoices();
}
function checkpointCampaign() {
  if (!sessionStarted || appPhase === 'menu') return false;
  const result = saveCampaign(game, campaignStorage);
  $('saveStatus').textContent = result.ok ? `Round ${game.round} saved on this device.` : `Could not save: ${result.error || 'device storage unavailable'}`;
  $('resumeCampaignBtn').disabled = !hasSavedCampaign(campaignStorage);
  return result.ok;
}
function resumeSavedCampaign() {
  const result = loadCampaign(campaignStorage);
  if (!result.game) { $('saveStatus').textContent = `Could not resume: ${result.error || 'no saved game'}`; $('menuSaveStatus').textContent = $('saveStatus').textContent; return; }
  // The detached save has passed persistence validation and migration.
  game = result.game as unknown as ClassicGame;
  resetPresentation();
  sessionStarted = true; appPhase = game.status === 'ended' ? 'results' : 'paused';
  $('startMenu').hidden = true; $('battleSurface').hidden = false; $('battleUtilities').hidden = false;
  clearInput(); manualDeathHandled = false; syncWorld(); buildPips(); resize();
  seed = game.seed;
  nextForms = [...game.forms[0]];
  nextDoctrine = game.doctrines[0];
  syncTacticalPlan();
  campaignSavingEnabled = true;
  selectedUnitId = null;
  paused = false; resultShown = false; lastTime = 0;
  lastEventSignature = ''; lastTerrainSignature = ''; visualPuffs = []; lastVisualEffect = 0;
  combatFeedback = []; feedbackGeneration = ''; lastFeedbackEffect = 0; lastFeedbackTick = 0;
  cooldownMax = Math.max(1, game.forceCooldown || 0);
  smokeCooldownMax = Math.max(1, game.guardCooldown || 0);
  mutationUntil = 0; toastUntil = 0;
  audio.silence();
  $('resultOverlay').hidden = true; $('roundReviewBar').hidden = true;
  $('mutationBanner').hidden = true; $('orderToast').classList.remove('is-visible');
  $('pausedOverlay').hidden = true;
  buildRoster(); drawTerrain();
  if (game.status === 'playing') setPaused(true);
  updateUI(); draw();
  $('saveStatus').textContent = `${result.notice ? result.notice + ' ' : ''}Resumed round ${game.round}${paused ? ' paused' : ' at the round results'}.`;
  if (result.migrated) showToast('Save updated. Ranks kept.');
  else if (result.upgraded) showToast('Save updated and loaded.');
  announce($('saveStatus').textContent); restoreAudioFromGesture(); ensureFrame();
}

buildDoctrineChoices();
$('saveCampaignBtn').addEventListener('click', () => { if (checkpointCampaign()) campaignSavingEnabled = true; });
$('resumeCampaignBtn').addEventListener('click', resumeSavedCampaign);
$('resumeCampaignBtn').disabled = !hasSavedCampaign(campaignStorage);
$('saveStatus').textContent = hasSavedCampaign(campaignStorage) ? 'A saved game is available.' : 'Save to continue later on this device.';
function showMutations() {
  const mutations = game.mutations || [];
  if (!mutations.length) return;
  const banner = $('mutationBanner');
  banner.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = `ROUND ${String(game.round).padStart(2, '0')} · EQUIPMENT CHANGES`;
  banner.append(heading);
  for (const mutation of mutations.slice(0, 3)) {
    const row = document.createElement('div');
    row.className = 'mutation-line' + (mutation.team === 1 ? ' enemy' : '');
    const label = document.createElement('b');
    label.textContent = mutation.team === 0 ? 'YOUR TEAM' : 'ENEMY';
    const value = document.createElement('span');
    const from = WEAPONS[mutation.from]?.name || mutation.from || '';
    const to = WEAPONS[mutation.to]?.name || mutation.to || '';
    value.textContent = displayBattleText(mutation.label || `${from} → ${to}`);
    row.append(label, value);
    banner.append(row);
  }
  if (mutations.length > 3) {
    const note = document.createElement('p'); note.className = 'mutation-overflow'; note.textContent = `${mutations.length - 3} more changes in Stats`; banner.append(note);
  }
  banner.hidden = false;
  mutationUntil = performance.now() + 4300;
}


// Secondary controls never introduce new simulation state of their own.
$('autoBtn').addEventListener('click', () => {
  if (appPhase !== 'playing' || game.status !== 'playing') return;
  if (game.config?.mode === 'spectate') return;
  setAutoCommand(game, !game.autoCommand);
  showToast(game.autoCommand ? 'AI team control on' : 'Manual team control on');
  updateUI();
});
$('intelBtn').addEventListener('click', () => {
  tacticalView = !tacticalView; preferences.tacticalView = tacticalView; savePreferences(preferences);
  $('intelBtn').setAttribute('aria-pressed', String(tacticalView));
  updateUI();
});
$('soundBtn').addEventListener('click', () => { void requestAudioEnabled(!preferences.sound); });
$('detailsBtn').addEventListener('click', () => {
  const open = $('detailsPanel').hidden;
  $('detailsPanel').hidden = !open;
  $('detailsBtn').setAttribute('aria-expanded', String(open));
  updateReport();
});
$('closeInspectorBtn').addEventListener('click', () => { selectUnit(null); canvas.focus({ preventScroll: true }); });
$('copySeedBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(String(seed)); showToast('Seed copied'); }
  catch { showToast(`Match seed: ${seed}`); }
});
$('exportBtn').addEventListener('click', () => {
  const snapshot = { format: 'trenchline-field-report-v4', exportedAt: new Date().toISOString(), ui: { paused, speed, selectedUnitId, tacticalView, nextDoctrine, nextForms }, game: structuredClone(game) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `saber-pit-${seed}-round-${game.round}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Save data exported');
});
window.addEventListener('pagehide', () => { clearInput(); resetRenderSnapshots(game); lastTime = 0; audio.silence(); });
window.addEventListener('blur', () => { clearInput(); if (appPhase === 'playing') setPaused(true); });
canvas.addEventListener('pointerdown', event => {
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
  const point = canvasToWorld(view, x, y);
  // Pick the visible anchor, but return the authoritative fighter for input.
  const nearest = game.soldiers.map(soldier => {
    const drawn = renderPoseGame === game ? renderFighters.get(soldier.id) || soldier : soldier;
    const tick = renderPoseGame === game ? renderTick : game.tick;
    return { soldier, distance: Math.hypot((drawn.x - point.x) * view.sx, (drawn.y - airborneHeight(drawn, tick) - point.y) * view.sy) };
  }).sort((a, b) => a.distance - b.distance)[0];
  if (appPhase === 'menu') return;
  canvas.focus({ preventScroll: true });
  const target = nearest && nearest.distance <= 28 ? nearest.soldier : null;
  if (game.config?.mode === 'play' && appPhase === 'playing') {
    if (target?.team === 1 && target.alive) {
      if (visibleEnemyTargets(game, game.control?.soldierId).some(enemy => enemy.id === target.id)) lockTarget(target);
      else showToast('Target is out of sight');
    }
    return;
  }
  selectUnit(target?.id || null);
});
canvas.addEventListener('blur', clearInput);
canvas.addEventListener('keydown', event => {
  if (game.config?.mode === 'play' && appPhase === 'playing') return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
  cycleInspection(direction);
});
function cycleInspection(direction: number) {
  selectUnit(nextInspectionId(game.soldiers, selectedUnitId, direction, $('inspectTeam').value, game.status === 'ended'));
}
function updateInspectionControls() {
  $('inspectionControls').hidden = game.config?.mode === 'play' && !paused && game.status === 'playing';
  const selected = game.soldiers.find(soldier => soldier.id === selectedUnitId);
  $('inspectionStatus').textContent = selected ? `${selected.team === 0 ? 'Your' : 'Enemy'} fighter ${String(selected.lane + 1).padStart(2, '0')} · ${soldierStatus(selected)}` : 'Select a fighter to inspect';
  const any = nextInspectionId(game.soldiers, null, 1, $('inspectTeam').value, game.status === 'ended');
  $('previousFighterBtn').disabled = $('nextFighterBtn').disabled = !any;
  $('inspectCarrierBtn').hidden = game.config?.matchMode !== 'relic';
  $('inspectCarrierBtn').disabled = !game.objective?.carrierId;
}
function selectUnit(id: string | null) {
  selectedUnitId = id;
  updateInspector();
  updateUI(); draw();
  if (id) {
    const soldier = game.soldiers.find(s => s.id === id);
    if (soldier) announce(`${soldier.team === 0 ? 'Your' : 'Enemy'} fighter ${(soldier.lane ?? 0) + 1}. Rank ${gradeDisplayLabel(careerOf(soldier).grade)}. ${Math.round(soldier.hp)} health. ${soldierStatus(soldier)}.`);
  }
}
function activeMove(soldier: ClassicSoldier) { return soldier.attack?.kind === 'saber' && soldier.attack.moveId ? selectFormMove(soldier.attack.form || soldier.form, soldier.attack.comboIndex || 0) : null; }
function forceRepertoireLabel(soldier: ClassicSoldier) { return forceRepertoire(soldier).map(id => id === 'force_push' ? WEAPONS[soldier.weapon]?.name || 'Force push' : forceAbilityById(id)?.name || id).join(', '); }
function soldierStatus(soldier: ClassicSoldier) {
  if (!soldier.alive) return 'Dead';
  if (soldier.airborne) return `Airborne · ${Math.round(airborneHeight(soldier, game.tick))} height`;
  if (soldier.landingRecoveryUntil > game.tick) return 'Landing recovery';
  if (game.config?.matchMode === 'relic' && game.objective?.carrierId === soldier.id) return 'Carrying relic';
  if (soldier.combatState === 'stagger') return 'Staggered';
  if (soldier.combatState === 'counter') return 'Counter window';
  if (soldier.attack?.kind === 'force') return soldier.attack.abilityId === 'force_push' ? WEAPONS[soldier.attack.weapon]?.name || 'Using Force' : forceAbilityById(soldier.attack.abilityId)?.name || 'Using Force';
  if (soldier.attack?.kind === 'saber') return activeMove(soldier)?.name || 'Saber windup';
  if (soldier.combatState === 'recover') return 'Recovering';
  if (soldier.guard && soldier.guardUntil > game.tick) return 'Guarding';
  if (soldier.guard) return 'Ready to block';
  if (soldier.forceRequestedUntil > game.tick) return 'Looking for a Force target';
  if (soldier.energy < 20) return 'Recovering energy';
  if (soldier.pinned) return 'Pinned';
  if (soldier.rallying) return 'Regrouping';
  if (soldier.melee) return 'Close combat';
  if (soldier.stance === 'duck') return 'Ducking';
  if (soldier.moving) return 'Moving';
  return soldier.cover ? 'In cover' : 'Exposed';
}
function updateInspector() {
  const soldier = game.soldiers.find(s => s.id === selectedUnitId);
  $('unitInspector').hidden = !soldier;
  $('takeControlBtn').hidden = !soldier || soldier.team !== 0 || !soldier.alive || !paused || game.status !== 'playing';
  $('battlefield').classList.toggle('inspection-active', Boolean(soldier));
  if (!soldier) return;
  $('unitName').textContent = `${soldier.team === 0 ? 'YOUR' : 'ENEMY'} FIGHTER ${String((soldier.lane ?? 0) + 1).padStart(2, '0')}`;
  $('unitRank').textContent = (rankNames[soldier.rank || 0] || 'Veteran').toUpperCase();
  const career = careerOf(soldier);
  $('unitGrade').textContent = gradeDisplayLabel(career.grade);
  $('unitMerit').textContent = career.nextGrade ? `${career.merit} training points · ${Math.max(0, career.nextThreshold - career.merit)} to ${gradeDisplayLabel(career.nextGrade)}` : `${career.merit} training points · Top rank`;
  $('unitPower').textContent = careerPowers(career) + (game.status === 'ended' ? ' Applied next round.' : '');
  $('unitHealth').textContent = `${Math.max(0, Math.round(soldier.hp))} / ${Math.round(soldier.maxHp)} HP`;
  $('unitState').textContent = soldierStatus(soldier);
  $('unitHealthBar').style.width = `${Math.max(0, 100 * soldier.hp / soldier.maxHp)}%`;
  const power = WEAPONS[soldier.weapon];
  const forceAllowed = permitsForceAttacks(game.config);
  const saber = KNIVES[soldier.meleeWeapon];
  const form = FORMS[soldier.form];
  const record = (game.records?.soldiers || []).find(record => record.team === soldier.team && record.lane === soldier.lane);
  $('unitWeapons').textContent = `${usesDualSabers(game.config, soldier) ? 'Jar’Kai dual sabers · ' : ''}${saber?.name || soldier.meleeWeapon} · ${power?.name || soldier.weapon}${forceAllowed ? '' : ' (Force off)'}`;
  $('unitForm').textContent = `Form ${form.primaryForm} · ${form.name} · ${displayText(form.trait)}`;
  const practice = masterySummary(game.mastery?.[soldier.team]?.[soldier.lane], soldier.form);
  $('unitMastery').textContent = `Stats with this form · ${practice.rounds} rounds with ${form.name} · ${practice.kills} kills · ${Math.round(practice.damage)} damage · ${practice.blocks} blocks · ${practice.objectiveSeconds.toFixed(1)}s on objectives`;
  $('unitCommendations').textContent = `Awards · Most damage: ${practice.commendations.mvp} · Most blocks: ${practice.commendations.defender} · Most objective time: ${practice.commendations.objective}. Awards don’t change stats.`;
  $('unitEnergy').textContent = `Energy ${Math.round(soldier.energy)} / ${soldier.maxEnergy} · ${soldier.guard ? soldier.guardUntil > game.tick ? 'Guarding' : 'Ready to block' : 'Not guarding'} · Saber ${Math.max(0, soldier.attackCooldown || 0).toFixed(1)}s · ${forceAllowed ? `Force ${Math.max(0, soldier.forceCooldown || 0).toFixed(1)}s` : 'Force off'}`;
  $('unitRecords').textContent = `All rounds: ${record?.kills || 0} kills · ${record?.deaths || 0} deaths · ${record?.assists || 0} assists (${record?.environmentDeaths || 0} hazard deaths). This round: ${soldier.kills || 0} kills · ${soldier.deaths || 0} deaths · ${soldier.assists || 0} assists.`;
  $('unitMood').textContent = `Morale ${Math.round(soldier.morale ?? 100)}% · Pressure ${Math.round(soldier.suppression || 0)}% · ${Math.floor(soldier.xp || 0)} combat XP`;
  $('unitRole').textContent = `Blade sequence (game adaptation; up to ${combatSkillProfile(soldier.career).comboLength} linked moves): ${moveSummary(soldier.form)}. Force repertoire: ${forceAllowed ? forceRepertoireLabel(soldier) : 'disabled by match rules'}.`;
  $('unitRole').title = `${combatFormProfile(soldier.form).identity}. ${form.lore.note}`;
  const target = game.soldiers.find(other => other.id === (soldier.attack?.target || soldier.target));
  const targetDistance = target ? Math.hypot(target.x - soldier.x, target.y - soldier.y) : Infinity;
  const reach = targetDistance <= saber.range + form.reachBonus ? 'in saber reach' : forceAllowed && targetDistance <= power.range ? 'in Force range' : 'out of range';
  $('unitIntent').textContent = `Action: ${displayText(soldier.tacticalReason || soldierStatus(soldier))}${target?.alive ? ` · ${target.team === 0 ? 'your' : 'enemy'} fighter ${target.lane + 1}, ${reach}` : ''}`;
  const outcome = soldier.lastOutcome;
  $('unitOutcome').textContent = outcome ? `Last action: ${outcomeText(outcome)}${outcome.kind ? ` · ${outcome.kind === 'force' ? 'Force' : 'saber'}` : ''}` : 'Last action: no attacks yet.';
  $('unitInspector').dataset.combatState = soldier.combatState;
  $('unitInspector').dataset.lastOutcome = outcome?.outcome || '';
  $('unitInspector').dataset.form = soldier.form;
  $('unitInspector').dataset.energy = String(soldier.energy);
  $('unitInspector').dataset.unitId = soldier.id;
  $('unitInspector').dataset.morale = String(soldier.morale ?? 100);
  $('unitInspector').dataset.suppression = String(soldier.suppression || 0);
  $('unitInspector').dataset.grade = career.grade;
  $('unitInspector').dataset.merit = String(career.merit);
  $('unitInspector').dataset.airborneHeight = String(airborneHeight(soldier, game.tick));
  $('unitInspector').dataset.move = soldier.attack?.move?.id || soldier.attack?.moveId || '';
  $('unitInspector').dataset.forceRepertoire = forceRepertoire(soldier).join(',');
}
const reportMetrics = [
  ['saberSwings', 'Saber swings'], ['saberHits', 'Saber hits'], ['damage', 'Damage dealt'],
  ['blocks', 'Blocks'], ['counters', 'Counter hits'], ['forceCasts', 'Force casts'],
  ['forceHits', 'Force hits'], ['kills', 'Round kills'], ['deaths', 'Round deaths'],
  ['assists', 'Round assists'], ['environmentDeaths', 'Round hazard deaths'], ['points', 'Signal points']
];
function buildReport() {
  for (const [key, label] of reportMetrics) {
    const card = document.createElement('div'); card.className = 'report-metric';
    const text = document.createElement('span'); text.textContent = label;
    const value = document.createElement('strong'); value.id = 'metric-' + key;
    card.append(text, value); $('reportGrid').append(card);
  }
  buildRoster();
}
function buildRoster() {
  $('mutationDetails').dataset.round = '';
  $('unitRoster').replaceChildren();
  for (const soldier of game.soldiers) {
    const button = document.createElement('button');
    button.dataset.unitId = soldier.id; button.className = soldier.team === 1 ? 'enemy' : '';
    const sigil = document.createElement('span'); sigil.className = 'roster-sigil'; sigil.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = String((soldier.lane ?? 0) + 1).padStart(2, '0');
    const grade = document.createElement('small'); grade.className = 'roster-grade'; grade.textContent = gradeDisplayLabel(careerOf(soldier).grade);
    const record = document.createElement('small'); record.className = 'roster-record'; record.textContent = '0 / 0 / 0';
    button.append(sigil, label, grade, record); button.addEventListener('click', () => selectUnit(soldier.id));
    $('unitRoster').append(button);
  }
}
function updateReport() {
  if ($('detailsPanel').hidden) return;
  const totals = game.records?.teams || [{ kills: 0, deaths: 0 }, { kills: 0, deaths: 0 }];
  $('campaignPlayerKills').textContent = String(totals[0].kills);
  $('campaignPlayerDeaths').textContent = String(totals[0].deaths);
  $('campaignEnemyKills').textContent = String(totals[1].kills);
  $('campaignEnemyDeaths').textContent = String(totals[1].deaths);
  $('campaignPlayerAssists').textContent = String(totals[0].assists || 0);
  $('campaignEnemyAssists').textContent = String(totals[1].assists || 0);
  $('campaignPlayerEnvironmentDeaths').textContent = String(totals[0].environmentDeaths || 0);
  $('campaignEnemyEnvironmentDeaths').textContent = String(totals[1].environmentDeaths || 0);
  for (const [key] of reportMetrics) {
    const values = key === 'points' ? (game.objective?.points || [0, 0]) : (game.stats?.[key] || [0, 0]);
    $('metric-' + key).innerHTML = `${Math.round(values[0])} <i>· ${Math.round(values[1])}</i>`;
  }
  $('tacticSummary').textContent = [0, 1].map(team => `${team === 0 ? 'Your team' : 'Enemy'}: ${DOCTRINES[game.doctrines[team]].name} · ${FORMATIONS[game.config?.formations?.[team] || 'line'].name} · ${priorityName(game.config?.targetPriorities?.[team] || 'balanced')}`).join(' / ');
  for (const button of $('unitRoster').children as HTMLCollectionOf<HTMLButtonElement>) {
    const soldier = game.soldiers.find(s => s.id === button.dataset.unitId);
    if (!soldier) continue;
    button.classList.toggle('is-dead', !soldier.alive);
    button.classList.toggle('is-selected', soldier.id === selectedUnitId);
    button.setAttribute('aria-pressed', String(soldier.id === selectedUnitId));
    const career = careerOf(soldier);
    button.querySelector('.roster-grade')!.textContent = gradeDisplayLabel(career.grade);
    const record = (game.records?.soldiers || []).find(record => record.team === soldier.team && record.lane === soldier.lane);
    button.querySelector('.roster-record')!.textContent = `${record?.kills || 0} / ${record?.deaths || 0} / ${record?.assists || 0}`;
    button.title = `${FORMS[soldier.form].name} · All rounds: ${record?.kills || 0} kills, ${record?.deaths || 0} deaths, ${record?.assists || 0} assists; ${record?.environmentDeaths || 0} hazard deaths`;
    button.setAttribute('aria-label', `${soldier.team === 0 ? 'Your' : 'Enemy'} fighter ${(soldier.lane ?? 0) + 1}, rank ${gradeDisplayLabel(career.grade)}, ${career.merit} training points, ${Math.round(soldier.hp)} health, ${soldierStatus(soldier)}. All rounds: ${record?.kills || 0} kills, ${record?.deaths || 0} deaths, ${record?.assists || 0} assists; ${record?.environmentDeaths || 0} hazard deaths.`);
  }
  const events = (game.events || []).slice(-7).reverse();
  const signature = `${game.round}:` + events.map(e => e.id).join(',');
  if (signature !== lastEventSignature) {
    lastEventSignature = signature;
    $('eventLog').replaceChildren();
    if (!events.length) {
      const item = document.createElement('li'); item.textContent = 'The teams are getting into position.'; $('eventLog').append(item);
    }
    for (const event of events) {
      const item = document.createElement('li'); if (event.team === 1) item.className = 'enemy-event';
      const time = document.createElement('time'); time.textContent = `${Math.floor(event.time)}s`;
      const text = document.createElement('span'); text.textContent = displayBattleText(event.text);
      item.append(time, text); $('eventLog').append(item);
    }
  }
  $('reportSeed').textContent = `SEED ${seed} · ROUND ${game.round}`;
  const mutations = game.mutations || [];
  $('mutationDetails').hidden = !mutations.length;
  if ($('mutationDetails').dataset.round !== String(game.round)) {
    $('mutationDetails').dataset.round = String(game.round);
    $('mutationCount').textContent = String(mutations.length);
    $('mutationList').replaceChildren();
    for (const mutation of mutations) {
      const item = document.createElement('li'); item.textContent = displayBattleText(mutation.label); $('mutationList').append(item);
    }
  }
}
function updateUpgradeUI() {
  $('doctrineLabel').textContent = DOCTRINES[game.doctrines[0]].name;
  const smoke = Math.max(0, game.guardCooldown || 0);
  const guardReady = commandReadiness(game, 'guard');
  smokeCooldownMax = Math.max(smokeCooldownMax, smoke);
  $('smokeBtn').disabled = paused || game.status !== 'playing' || !guardReady.ready;
  $('smokeHint').textContent = paused ? 'Resume to command' : guardReady.ready ? `${guardReady.eligible} ready to guard` : displayText(guardReady.reason);
  $('smokeFill').style.transform = `scaleX(${smoke > 0 ? Math.max(0, 1 - smoke / smokeCooldownMax) : 0})`;
  $('smokeBtn').setAttribute('aria-label', `Team guard. ${$('smokeHint').textContent}`);
  $('smokeBtn').title = displayText(guardReady.reason);
  $('autoBtn').disabled = game.status !== 'playing';
  $('autoBtn').setAttribute('aria-pressed', String(Boolean(game.autoCommand)));
  $('autoLabel').textContent = game.autoCommand ? 'Auto on' : 'Auto off';
  if (game.autoCommand && game.status === 'playing' && !paused) $('commandStatus').textContent = `Auto · ${game.playerTactic || game.playerOrder}`;
  const objective = game.objective;
  const rules = describeMatchRules(game.config);
  const captureEnabled = rules.objectiveEnabled && Boolean(objective);
  $('objectiveHud').hidden = false;
  $('objectiveHud').dataset.mode = game.config?.matchMode || 'control';
  $('objectiveRule').textContent = rules.objectiveLabel;
  $('objectiveHud').title = displayText(rules.summary);
  $('captureLeft').parentElement!.hidden = !captureEnabled || game.config?.matchMode === 'relic';
  if (captureEnabled) {
    $('objectiveScore').textContent = `${Math.floor(objective.points[0])} : ${Math.floor(objective.points[1])}`;
    $('objectiveHud').setAttribute('aria-label', `${game.config?.matchMode === 'relic' ? 'Relic deliveries' : 'Signal control'}: your team ${Math.floor(objective.points[0])}, enemy ${Math.floor(objective.points[1])}. Target ${objective.targetScore}.`);
    $('captureLeft').style.width = `${Math.max(0, objective.capture) / 2}%`;
    $('captureRight').style.width = `${Math.max(0, -objective.capture) / 2}%`;
  } else {
    const survivors = [0, 1].map(team => game.soldiers.filter(soldier => soldier.team === team && soldier.alive).length);
    $('objectiveScore').textContent = `${survivors[0]} : ${survivors[1]}`;
    $('objectiveHud').setAttribute('aria-label', `Elimination survivors: your team ${survivors[0]}, enemy ${survivors[1]}. Timeout: survivors, then health.`);
  }
  const feedback = objectiveFeedback(game);
  $('objectiveStatus').textContent = feedback.status;
  $('objectiveDetail').textContent = feedback.detail;
  $('ruleModifier').textContent = getModifier(game.config.modifier).name;
  $('ruleModifier').title = getModifier(game.config.modifier).description;
  if (lastObjectiveSignature && feedback.signature !== lastObjectiveSignature && game.config?.matchMode === 'relic' && appPhase === 'playing') {
    showToast(feedback.status);
  }
  lastObjectiveSignature = feedback.signature;
  $('metric-points').parentElement!.hidden = !rules.objectiveEnabled;
  $('metric-points').previousElementSibling!.textContent = game.config?.matchMode === 'relic' ? 'Relic deliveries' : 'Signal points';
  $('footerRules').textContent = `${rules.title}: ${game.config?.matchMode === 'relic' ? 'deliver 3 relics home or defeat the enemy.' : rules.objectiveEnabled ? 'reach 30 signal points or defeat the enemy.' : 'defeat the enemy. At time limit: survivors, then health.'}`;
  $('mapName').textContent = (game.terrain?.name || 'THE CROSSING').toUpperCase();
  updateInspector();
  updateInspectionControls();
  updateReport();
}

// Only a detached snapshot is exposed for accessibility/QA; the live engine stays private.
Object.defineProperty(window, '__trenchline', { value: Object.freeze({
  snapshot: () => ({ phase: appPhase, sessionStarted, config: structuredClone(game.config || null), control: structuredClone(game.control || null), world: { ...world }, rngState: game.rngState, environment: structuredClone(getEnvironment(game)), seed, tick: game.tick, paused, speed, round: game.round, time: game.time, timeLeft: game.timeLeft, status: game.status, winner: game.winner, score: [...game.score], playerOrder: game.playerOrder, forceCooldown: game.forceCooldown, guardCooldown: game.guardCooldown, autoCommand: Boolean(game.autoCommand), selectedUnitId, tacticalView, soundEnabled: audio.enabled, frontLine: game.frontLine, terrainId: game.terrain?.id, nextDoctrine, nextForms: [...nextForms], forms: structuredClone(game.forms), doctrines: [...game.doctrines], careers: structuredClone(game.careers), mastery: structuredClone(game.mastery), records: structuredClone(game.records), roundReport: structuredClone(game.roundReport || null), objective: structuredClone(game.objective || null), stats: structuredClone(game.stats || {}), events: structuredClone(game.events || []), effects: structuredClone(game.effects || []), mutations: structuredClone(game.mutations || []), soldiers: structuredClone(game.soldiers) })
}), writable: false, configurable: false });

// The terrain is drawn once and reused. All combat is native canvas geometry.
const terrain = document.createElement('canvas');
terrain.width = world.width;
terrain.height = world.height;
const ground = terrain.getContext('2d')!;
function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fill) { context.fillStyle = fill; context.fill(); }
  if (stroke) { context.strokeStyle = stroke; context.stroke(); }
}
function line(context: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number, color: string, width = 1) {
  context.beginPath(); context.moveTo(x, y); context.lineTo(x2, y2); context.strokeStyle = color; context.lineWidth = width; context.stroke();
}
function ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fillStyle = color; context.fill();
}
function terrainSignature() { return `${game.seed}:${game.round}:${game.terrain?.id}:${world.width}:${world.height}:${preferences.colors}`; }
function drawTerrain() {
  const palette = arenaPalette(game.terrain?.id);
  lastTerrainSignature = terrainSignature();
  const bounds = game.terrain?.bounds || { minX: 40, minY: 50, maxX: world.width - 40, maxY: world.height - 50 };
  drawArenaStage(ground, { width: world.width, height: world.height, mapId: game.terrain?.id, environment: game.terrain?.environment, bounds, colors });
  for (const zone of game.terrain?.zones || []) {
    const danger = zone.kind === 'hazard';
    ground.fillStyle = danger ? palette.hazardFill : palette.roughFill; ground.fillRect(zone.x, zone.y, zone.width, zone.height);
    ground.strokeStyle = danger ? palette.hazardStroke : palette.roughStroke; ground.lineWidth = danger ? 2 : 1;
    ground.setLineDash(danger ? [7, 4] : [3, 5]); ground.strokeRect(zone.x, zone.y, zone.width, zone.height); ground.setLineDash([]);
    ground.save(); ground.beginPath(); ground.rect(zone.x, zone.y, zone.width, zone.height); ground.clip();
    if (danger) {
      for (let x = zone.x - zone.height; x < zone.x + zone.width; x += 17) line(ground, x, zone.y + zone.height, x + zone.height, zone.y, palette.hazardHatch, 3);
    } else {
      for (let x = zone.x + 9; x < zone.x + zone.width; x += 19) for (let y = zone.y + 7; y < zone.y + zone.height; y += 17) ellipse(ground, x, y, 4, 2, palette.roughStroke);
    }
    ground.restore();
    ground.font = '700 10px ui-monospace, monospace'; ground.textAlign = 'center'; ground.fillStyle = palette.terrainLabel;
    ground.fillText(danger ? '⚠ HAZARD' : 'ROUGH', zone.x + zone.width / 2, zone.y + 15);
  }
  for (const decoration of game.terrain?.decorations || []) {
    if (decoration.type !== 'crater') continue;
    ellipse(ground, decoration.x, decoration.y, decoration.radius, decoration.radius * .6, '#05071166');
    ellipse(ground, decoration.x, decoration.y, decoration.radius * .7, decoration.radius * .35, '#03030b88');
  }
  for (const node of game.terrain?.coverNodes || COVER_NODES) {
    ground.strokeStyle = node.team === 0 ? '#326c5b2c' : '#a264452c'; ground.lineWidth = 1;
    ground.beginPath(); ground.arc(node.x, node.y, 10, 0, Math.PI * 2); ground.stroke();
  }
  for (const solid of game.terrain?.solids || []) {
    const wall = solid.kind === 'wall';
    roundRect(ground, solid.x + 4, solid.y + 5, solid.width, solid.height, 2, '#3947353d');
    roundRect(ground, solid.x, solid.y, solid.width, solid.height, 2, wall ? palette.wallFace : palette.barricadeFace, wall ? palette.wallEdge : palette.barricadeEdge);
    if (wall) {
      line(ground, solid.x + 2, solid.y + 2, solid.x + solid.width - 2, solid.y + 2, palette.wallCap, 2);
      for (let y = solid.y + 11; y < solid.y + solid.height; y += 12) line(ground, solid.x, y, solid.x + solid.width, y, palette.wallEdge, 1);
    } else {
      for (let y = solid.y + 2; y < solid.y + solid.height - 2; y += 9) roundRect(ground, solid.x + 1, y, Math.max(2, solid.width - 2), 7, 3, palette.wallCap, palette.barricadeEdge);
    }
  }
  // Camp flags locate the two spawn sides without inventing impassable trenches.
  for (const team of [0, 1]) {
    const x = team === 0 ? bounds.minX + 10 : bounds.maxX - 10;
    line(ground, x, world.height / 2 - 30, x, world.height / 2 + 20, '#5b684f', 3);
    ground.fillStyle = team === 0 ? colors.playerDark : colors.enemyDark;
    ground.fillRect(x, world.height / 2 - 29, team === 0 ? 23 : -23, 15);
  }
}

drawTerrain();
buildReport();

function resize() {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * dpr));
  canvas.height = Math.max(1, Math.round(bounds.height * dpr));
  view = { ...fitBattleCamera({ width: bounds.width, height: bounds.height, worldWidth: world.width, worldHeight: world.height, bounds: game.terrain?.bounds, fighterBoost: game.soldiers.length <= 2 ? 1.25 : game.soldiers.length <= 10 ? 1.12 : 1 }), dpr };
  if (appPhase !== 'menu') draw();
}
new ResizeObserver(resize).observe($('battlefield'));
window.addEventListener('resize', resize, { passive: true });

// Blade poses and traces read the actual form and simulation attack/effect state.
function drawSoldier(soldier: ClassicSoldier) {
  const spriteScale = view.spriteScale;
  const flight: Partial<ReturnType<typeof sampleAirborne>> & {height: number; airborne: boolean; rotation: number} = soldier.alive ? sampleAirborne(soldier, renderTick) : { height: 0, rotation: 0, airborne: false };
  if (flight.airborne) {
    ctx.save(); ctx.translate(soldier.x, soldier.y); ctx.scale(spriteScale / view.sx, spriteScale / view.sy);
    ellipse(ctx, 1, 9, 13 + flight.height * .04, 5 + flight.height * .015, '#21372745');
    if (tacticalView || soldier.id === selectedUnitId) line(ctx, 0, 0, 0, -flight.height * view.sy / spriteScale, '#f7edc95c', 1);
    ctx.restore();
  }
  ctx.save(); ctx.translate(soldier.x, soldier.y - flight.height);
  ctx.scale(spriteScale / view.sx, spriteScale / view.sy);
  const teamColor = soldier.team === 0 ? colors.player : colors.enemy;
  const blade = soldier.team === 0 ? colors.player : colors.enemy;
  const dark = soldier.team === 0 ? colors.playerDark : colors.enemyDark;
  const dir = soldier.facing || (soldier.team === 0 ? 1 : -1);
  if (tacticalView || soldier.id === selectedUnitId) {
    const grade = gradeDisplayLabel(careerOf(soldier).grade), width = Math.max(19, grade.length * 6 + 8);
    roundRect(ctx, -width / 2, -43, width, 13, 3, '#f7edc9');
    ctx.fillStyle = dark; ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(grade, 0, -33);
  }
  if (soldier.id === selectedUnitId || soldier.id === game.control?.soldierId) {
    ctx.beginPath(); ctx.ellipse(0, 4, 19, 14, 0, 0, Math.PI * 2); ctx.strokeStyle = '#fff2b2'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (!soldier.alive) {
    ctx.globalAlpha = .45; ellipse(ctx, 0, 4, 11, 4, '#293e3240'); ctx.rotate(-.55 * dir);
    ctx.lineCap = 'round'; ellipse(ctx, -10, 0, 5.8, 5.8, teamColor);
    line(ctx, -3, 1, 9, 4, teamColor, 4); line(ctx, 9, 4, 18, 8, teamColor, 4);
    line(ctx, 1, 2, 8, -4, teamColor, 4); ctx.restore(); return;
  }
  const moving = soldier.moving ?? soldier.state === 'moving';
  if (!flight.airborne) ellipse(ctx, 1, 9, 11, 5, '#2137273d');
  if (soldier.forceBarrierUntil! > game.tick || soldier.barrierUntil > game.tick) {
    ctx.beginPath(); ctx.ellipse(0, -2, 23, 29, 0, 0, Math.PI * 2); ctx.strokeStyle = '#acdcff'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (soldier.guard) {
    const braced = soldier.guardUntil > game.tick;
    ctx.strokeStyle = '#bdeaff'; ctx.lineWidth = braced ? 2.5 : 1.3;
    if (braced) { ctx.beginPath(); ctx.moveTo(-17, -8); ctx.lineTo(17, -8); ctx.lineTo(15, 10); ctx.lineTo(0, 22); ctx.lineTo(-15, 10); ctx.closePath(); ctx.stroke(); }
    else { line(ctx, -4, 17, 0, 21, '#bdeaff', 1.5); line(ctx, 0, 21, 4, 17, '#bdeaff', 1.5); }
  }
  if (soldier.combatState === 'recover') {
    ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 2, 18, 0, Math.PI * 2);
    ctx.strokeStyle = '#bcc6c7'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
  } else if (soldier.combatState === 'counter') {
    line(ctx, -6, 21, 0, 16, '#ffe393', 2); line(ctx, 0, 16, 6, 21, '#ffe393', 2);
    line(ctx, -6, 26, 0, 21, '#ffe393', 2); line(ctx, 0, 21, 6, 26, '#ffe393', 2);
  }
  const swing = renderSwings.get(soldier.id), block = renderBlocks.get(soldier.id);
  const motion = activeMove(soldier)?.motion || swing?.motion || FORMS[soldier.form].technique.motion;
  const aim = soldier.attack || swing;
  const aimAngle = aim ? Math.atan2((aim.aimY ?? aim.y2 ?? soldier.y) - soldier.y, Math.max(1, Math.abs((aim.aimX ?? aim.x2 ?? soldier.x + dir) - soldier.x))) : 0;
  const dual = usesDualSabers(game.config, soldier);
  const pose = applySharedCombatBeat(sampleCombatPose({ fighter: soldier, tick: renderTick, swing, block, motion, dual, reducedMotion: motionReduced(), aimAngle }), sharedBeats.get(soldier.id));
  ctx.save();
  // World altitude is applied above. Local rig owns torso, hands and depth.
  if (flight.airborne && !motionReduced()) ctx.rotate((flight.rotationAxis === 'yaw' ? flight.bank || 0 : (flight.visualRotation ?? flight.rotation)) * dir);
  const rig = sampleFighterRig({ fighter: soldier, tick: renderTick, pose, motion,
    move: activeMove(soldier), swing: swing as Parameters<typeof sampleFighterRig>[0] extends infer Options ? NonNullable<Options> extends {swing?: infer Swing} ? Swing : never : never, flight, dual, reducedMotion: motionReduced(), aimAngle, moving });
  const rotation = flight.airborne && !motionReduced() ? (flight.rotationAxis === 'yaw' ? flight.bank || 0 : (flight.visualRotation ?? flight.rotation)) * dir : 0;
  const bladeWorld = (p: Point) => ({ x: soldier.x + (p.x * Math.cos(rotation) - p.y * Math.sin(rotation)) * spriteScale / view.sx,
    y: soldier.y - flight.height + (p.x * Math.sin(rotation) + p.y * Math.cos(rotation)) * spriteScale / view.sy });
  for (const b of rig.blades) presentationEffects.sampleBlade(`${soldier.id}:${b.hand}`, bladeWorld(rig.projected[b.hilt]), bladeWorld(rig.projected[b.tip]), {
    active: !paused && preferences.effects !== 'minimal' && ['strike', 'follow-through'].includes(pose.phase), color: blade });
  const rigStyle = { teamColor, dark, blade, team: soldier.team, effects: preferences.effects, appearance: 'broadcast' };
  drawFighterRig(ctx, rig, rigStyle);
  ctx.restore();
  if (soldier.combatState === 'stagger') { line(ctx, -10, -21, -6, -25, '#ffe8a9', 2); line(ctx, 7, -25, 11, -21, '#ffe8a9', 2); }
  if (soldier.hp < soldier.maxHp) {
    roundRect(ctx, -11, -33, 22, 3, 1, '#060712dc'); roundRect(ctx, -11, -33, Math.max(0, 22 * soldier.hp / soldier.maxHp), 3, 1, '#f0e6bf');
  }
  if (soldier.energy < soldier.maxEnergy || tacticalView) {
    roundRect(ctx, -11, -29, 22, 2, 1, '#060712dc'); roundRect(ctx, -11, -29, 22 * Math.max(0, soldier.energy / soldier.maxEnergy), 2, 1, '#8ce4f3');
  }
  ctx.restore();
}

// Nine paths correspond to the nine authored techniques; telegraphs use the same geometry.
function traceTechnique(motion: string, phase: number, telegraph: boolean) {
  const reach = telegraph ? 38 : 27 + phase * 18;
  ctx.beginPath();
  if (motion === 'thrust') { ctx.moveTo(8, 0); ctx.lineTo(reach + 16, 0); ctx.moveTo(reach + 7, -5); ctx.lineTo(reach + 16, 0); ctx.lineTo(reach + 7, 5); }
  else if (motion === 'orbit') { ctx.arc(8, 0, 21, -.8, Math.PI * 2 - .8); ctx.moveTo(34, -6); ctx.lineTo(reach + 7, 0); ctx.lineTo(34, 6); }
  else if (motion === 'leap') { ctx.moveTo(0, 5); ctx.quadraticCurveTo(reach / 2, -48, reach + 8, 0); ctx.moveTo(reach + 20, 0); ctx.arc(reach + 8, 0, 12, 0, Math.PI * 1.7); }
  else if (motion === 'redirect') { ctx.arc(0, 0, reach, -1.25, 1.25); ctx.moveTo(reach - 8, -14); ctx.lineTo(reach + 5, 0); ctx.lineTo(reach - 8, 14); }
  else if (motion === 'cleave') { ctx.moveTo(12, -26); ctx.lineTo(reach, 0); ctx.lineTo(12, 26); }
  else if (motion === 'weave') { ctx.moveTo(8, -19); ctx.bezierCurveTo(reach + 24, -28, 5, 28, reach + 8, 15); }
  else if (motion === 'flurry') { for (let i = 0; i < 3; i++) { ctx.moveTo(10 + i * 7, -21 + i * 5); ctx.lineTo(31 + i * 7, 10 + i * 4); } }
  else if (motion === 'riposte') { ctx.arc(0, 0, reach, -1.6, .75); ctx.moveTo(-reach + 8, 0); ctx.arc(0, 0, reach - 8, Math.PI, Math.PI + 2.5); }
  else ctx.arc(0, 0, reach, -1.05, 1.05); // Shii-Cho's broad sweep.
  ctx.stroke();
}
function drawEffects() {
  if (game.status === 'ended') return;
  drawWindups();
  // These are immutable world-stamped events, not projectile entities.
  // Keep event XY fixed; visual lifetime and existing altitude samples are fractional.
  for (const effect of renderFrame.effects) {
    // Contact ink and Force-push rings use the independent presentation clock.
    if (effect.type === 'saber' || (effect.type === 'force' && (effect.abilityId || effect.family || 'force_push') === 'force_push')) continue;
    // Windups read live attacks, so interrupted attacks cannot leave stale warnings.
    if (['telegraph', 'feedback', 'block', 'counter', 'impact'].includes(effect.type)) continue;
    const life = Math.max(0, Math.min(1, (effect.ttl - renderFrame.alpha / 60) / (effect.maxTtl || 1)));
    const phase = motionReduced() ? .65 : 1 - life;
    const tone = effect.team === 0 ? '#a0fff1' : '#ffc3a4';
    ctx.save(); ctx.globalAlpha = Math.max(.2, life);
    const source = renderFighters.get(effect.soldierId!);
    const target = renderFighters.get(effect.targetId!);
    const sourceHeight = source ? airborneHeight(source, renderTick) : 0;
    const targetHeight = target ? airborneHeight(target, renderTick) : 0;
    ctx.translate(effect.x, effect.y - sourceHeight);
    const heading = Math.atan2((effect.y2 ?? effect.y) - effect.y, (effect.x2 ?? effect.x + 1) - effect.x);
    const contact = effect.outcome === 'hit' || effect.outcome === 'blocked';
    if ((effect.type === 'saber' || effect.type === 'force') && !contact) {
      // A missed or interrupted attack never paints a contact burst on its target.
      ctx.rotate(heading); ctx.strokeStyle = '#bcc6c7'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 0, 16 + phase * 7, -.6, .6); ctx.stroke();
    } else if (effect.type === 'saber') {
      ctx.rotate(heading);
      ctx.strokeStyle = tone; ctx.lineWidth = effect.offhand ? 1.8 : 2.4;
      traceTechnique(effect.motion!, phase, false);
      if (preferences.effects !== 'minimal' && phase < .55) {
        ctx.save(); ctx.rotate(-heading);
        const contactX = (effect.x2 ?? effect.x) - effect.x, contactY = (effect.y2 ?? effect.y) - effect.y + sourceHeight - targetHeight;
        const spark = effect.outcome === 'blocked' ? '#bdeaff' : '#fff0c2';
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; line(ctx, contactX + Math.cos(a) * 3, contactY + Math.sin(a) * 3, contactX + Math.cos(a) * (8 + phase * 9), contactY + Math.sin(a) * (8 + phase * 9), spark, 1.8); }
        ctx.restore();
      }
    } else if (effect.type === 'force') {
      const endX = (effect.x2 ?? effect.x) - effect.x, endY = (effect.y2 ?? effect.y) - effect.y + sourceHeight - targetHeight;
      ctx.strokeStyle = tone; ctx.lineWidth = 2;
      const family = effect.abilityId && effect.abilityId !== 'force_push' ? effect.abilityId : effect.family || 'force_push';
      if (/lightning/.test(family)) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let i = 1; i <= 9; i++) { const p = i / 9, jitter = i === 9 ? 0 : (i % 2 ? -1 : 1) * (7 + phase * 5); ctx.lineTo(endX * p + Math.sin(heading) * jitter, endY * p - Math.cos(heading) * jitter); }
        ctx.strokeStyle = '#d8c7ff'; ctx.lineWidth = 3; ctx.stroke();
      } else if (/throw/.test(family)) {
        const p = Math.sin(phase * Math.PI); ctx.save(); ctx.translate(endX * p, endY * p); ctx.rotate(phase * Math.PI * 6);
        line(ctx, -15, 0, 15, 0, tone, 4); line(ctx, -15, 0, 15, 0, '#fffde8', 1.5); ctx.restore();
      } else if (/barrier/.test(family)) {
        ctx.beginPath(); ctx.arc(0, 0, 22 + phase * 9, 0, Math.PI * 2); ctx.strokeStyle = '#acdcff'; ctx.stroke();
      } else if (/burst|repulse|sweep/.test(family)) {
        for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(endX, endY, 8 + phase * 35 + i * 9, 0, Math.PI * 2); ctx.stroke(); }
      } else if (/pulse/.test(family)) {
        const radius = 10 + phase * 28;
        ctx.beginPath(); ctx.arc(endX, endY, radius, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; line(ctx, endX + Math.cos(a) * radius, endY + Math.sin(a) * radius, endX + Math.cos(a) * (radius + 9), endY + Math.sin(a) * (radius + 9), tone, 2); }
      } else if (/pull/.test(family)) {
        const radius = 13 + (1 - phase) * 24; ctx.beginPath(); ctx.arc(endX, endY, radius, 0, Math.PI * 2); ctx.stroke();
        line(ctx, endX * (1 - phase), endY * (1 - phase), endX * Math.max(0, .7 - phase), endY * Math.max(0, .7 - phase), tone, 3);
      } else if (/bind|stun|grip/.test(family)) {
        for (let i = -1; i <= 1; i++) line(ctx, endX - 12, endY + i * 8 - 5, endX + 12, endY + i * 8 + 5, tone, 2);
        ctx.beginPath(); ctx.arc(endX, endY, 19 + phase * 5, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.translate(endX * phase, endY * phase); ctx.rotate(heading);
        ctx.beginPath(); ctx.arc(0, 0, 12 + phase * 24, -1.2, 1.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-8, 0, 8 + phase * 19, -1.2, 1.2); ctx.stroke();
      }
    } else if (effect.type === 'dash') {
      ctx.rotate(heading); for (let i = -1; i <= 1; i++) line(ctx, -25, i * 6, -7, i * 6, tone, 2);
    } else if (effect.type === 'stagger') {
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; line(ctx, Math.cos(a) * 5, Math.sin(a) * 5, Math.cos(a) * 13, Math.sin(a) * 13, '#fff0c2', 1.8); }
    } else if (effect.type === 'death') ellipse(ctx, 0, 4, 8 + phase * 10, 4 + phase * 3, '#e4d4a573');
    ctx.restore();
  }
  drawCombatFeedback();
}

function outcomeText(outcome: Pick<Effect, 'damage' | 'outcome' | 'isCounter'>) {
  const damage = Math.round((outcome.damage || 0) * 10) / 10;
  if (outcome.outcome === 'blocked') return `Blocked · ${damage} damage through guard`;
  if (outcome.outcome === 'hit') return `${outcome.isCounter ? 'Counter hit' : 'Hit'} · ${damage} damage`;
  return { miss: 'Missed', 'out-of-range': 'Out of range', 'target-lost': 'Target lost', interrupted: 'Interrupted' }[outcome.outcome!] || 'Attack in progress';
}
function feedbackStyle(outcome: CombatFeedback) {
  if (outcome.outcome === 'blocked') return { label: 'BLOCK', color: '#bdeaff', shape: 'shield' };
  if (outcome.outcome === 'hit' && outcome.isCounter) return { label: 'COUNTER', color: '#ffe393', shape: 'counter' };
  if (outcome.outcome === 'hit') return { label: 'HIT', color: '#fff0c2', shape: 'hit' };
  return { label: { 'out-of-range': 'RANGE', 'target-lost': 'LOST', interrupted: 'STOPPED' }[outcome.outcome as 'out-of-range' | 'target-lost' | 'interrupted'] || 'MISS', color: '#bcc6c7', shape: 'miss' };
}
function drawWindups() {
  for (const soldier of renderFrame.soldiers) {
    if (!soldier.alive || !soldier.attack) continue;
    const target = renderFighters.get(soldier.attack.target);
    if (!target?.alive) continue;
    const attack = soldier.attack;
    const progress = Math.max(0, Math.min(1, (renderTick - attack.startedTick) / Math.max(1, attack.resolveTick - attack.startedTick)));
    const aimX = attack.aimX ?? target.x, aimY = attack.aimY ?? target.y;
    const angle = Math.atan2((aimY - soldier.y) * view.sy, (aimX - soldier.x) * view.sx);
    const ability = forceAbilityById(attack.abilityId), move = activeMove(soldier);
    if (ability?.radius || move) {
      const reach = ability?.radius || KNIVES[soldier.meleeWeapon].range + FORMS[soldier.form].reachBonus + move!.reachBonus;
      const arc = ability ? (ability.cone || Math.PI * 2) : move!.arc;
      const heading = Math.atan2(aimY - soldier.y, aimX - soldier.x);
      ctx.save(); ctx.translate(soldier.x, soldier.y); ctx.rotate(heading); ctx.beginPath();
      if (arc < Math.PI * 2) ctx.moveTo(0, 0);
      ctx.arc(0, 0, reach, -arc / 2, arc / 2); ctx.closePath();
      ctx.fillStyle = '#ffe4a415'; ctx.strokeStyle = '#ffe4a466'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(soldier.x, soldier.y - airborneHeight(soldier, renderTick)); ctx.scale(1 / view.sx, 1 / view.sy);
    ctx.beginPath(); ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = '#3d423ac0'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = '#ffe4a4'; ctx.lineWidth = 2; ctx.stroke();
    ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(22, -5); ctx.lineTo(29, 0); ctx.lineTo(22, 5); ctx.stroke();
    if (attack.kind === 'force') {
      ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(36, -5); ctx.lineTo(42, 0); ctx.lineTo(36, 5); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
}
function updateCombatFeedback(dt: number) {
  const generation = `${game.seed}:${game.round}`;
  const latestId = (game.effects || []).reduce((maximum, effect) => Math.max(maximum, effect.id || 0), 0);
  if (generation !== feedbackGeneration || game.tick < lastFeedbackTick || (game.tick === 0 && latestId < lastFeedbackEffect)) {
    combatFeedback = []; lastFeedbackEffect = 0; feedbackGeneration = generation;
  }
  lastFeedbackTick = game.tick;
  if (!paused) {
    for (const item of combatFeedback) item.remaining -= dt;
    combatFeedback = combatFeedback.filter(item => item.remaining > 0);
  }
  for (const effect of game.effects || []) {
    if (effect.id <= lastFeedbackEffect) continue;
    lastFeedbackEffect = Math.max(lastFeedbackEffect, effect.id);
    if (effect.type !== 'feedback') continue;
    // One marker per duel participant, plus a hard global cap. Labels outlive fast ticks.
    combatFeedback = combatFeedback.filter(item => item.targetId !== effect.targetId || item.soldierId !== effect.soldierId);
    combatFeedback.push({ ...effect, remaining: 1.25 });
  }
  if (combatFeedback.length > 10) combatFeedback.splice(0, combatFeedback.length - 10);
}
function drawCombatFeedback() {
  const priority = (item: CombatFeedback) => Number(item.soldierId === game.control?.soldierId || item.targetId === game.control?.soldierId) * 2 + Number(item.soldierId === selectedUnitId || item.targetId === selectedUnitId);
  const ordered = [...combatFeedback].sort((a, b) => priority(b) - priority(a) || b.id - a.id);
  const labels: (Point & {width: number})[] = [];
  for (const item of ordered) {
    const style = feedbackStyle(item);
    const text = style.label + (item.damage! > 0 ? ` ${Number(item.damage!.toFixed(1))}` : '');
    const width = text.length * 6 + 12;
    const screen = worldToCanvas(view, item.x, item.y);
    const x = Math.max(width / 2 + 4, Math.min(view.width - width / 2 - 4, screen.x));
    const y = Math.max(12, screen.y - 39);
    const canLabel = labels.length < 3 && !labels.some(label => Math.abs(label.x - x) < (label.width + width) / 2 + 4 && Math.abs(label.y - y) < 19);
    ctx.save(); ctx.translate(item.x, item.y); ctx.scale(1 / view.sx, 1 / view.sy);
    ctx.globalAlpha = Math.min(1, item.remaining / .2); ctx.strokeStyle = style.color; ctx.lineWidth = 2;
    ctx.beginPath();
    if (style.shape === 'shield') { ctx.moveTo(-9, -9); ctx.lineTo(9, -9); ctx.lineTo(7, 3); ctx.lineTo(0, 10); ctx.lineTo(-7, 3); ctx.closePath(); }
    else if (style.shape === 'counter') { for (const offset of [-5, 3]) { ctx.moveTo(-8, offset - 4); ctx.lineTo(0, offset); ctx.lineTo(-8, offset + 4); ctx.moveTo(2, offset - 4); ctx.lineTo(10, offset); ctx.lineTo(2, offset + 4); } }
    else if (style.shape === 'hit') { for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; ctx.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5); ctx.lineTo(Math.cos(angle) * 12, Math.sin(angle) * 12); } }
    else { ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(-5, 5); ctx.lineTo(5, -5); }
    ctx.stroke();
    if (canLabel) {
      labels.push({ x, y, width });
      const labelX = x - screen.x, labelY = y - screen.y;
      roundRect(ctx, labelX - width / 2, labelY - 9, width, 18, 3, '#182f31f5');
      ctx.fillStyle = style.color; ctx.font = '700 10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(text, labelX, labelY + 3);
    }
    ctx.restore();
  }
}
function screenLabel(x: number, y: number, text: string, color = '#4c6149', size = 8) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / view.sx, 1 / view.sy);
  ctx.fillStyle = color; ctx.font = `700 ${size}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.fillText(text, 0, 0); ctx.restore();
}
function drawRelicMarker(objective: ClassicGame['objective']) {
  const carrier = renderFrame.soldiers.find(soldier => soldier.id === objective.carrierId && soldier.alive);
  const x = carrier?.x ?? objective.x, y = carrier?.y ?? objective.y;
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / view.sx, 1 / view.sy);
  const offset = carrier ? -38 : -4;
  ctx.globalAlpha = objective.state === 'resetting' ? .45 : 1;
  ctx.beginPath(); ctx.moveTo(0, offset - 10); ctx.lineTo(9, offset); ctx.lineTo(0, offset + 10); ctx.lineTo(-9, offset); ctx.closePath();
  ctx.fillStyle = '#ffe08a'; ctx.strokeStyle = '#26382d'; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
  if (carrier) {
    ctx.fillStyle = '#26382d'; ctx.fillRect(-25, offset - 25, 50, 13);
    ctx.fillStyle = '#fff0b5'; ctx.font = '700 8px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('RELIC', 0, offset - 15);
  }
  ctx.restore();
}
function drawRelicField(objective: ClassicGame['objective']) {
  for (const zone of objective.extractionZones || []) {
    ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fillStyle = zone.team === 0 ? '#66cdf522' : '#ff7a9822'; ctx.fill();
    ctx.strokeStyle = zone.team === 0 ? colors.player : colors.enemy; ctx.lineWidth = 2; ctx.stroke();
    const direction = zone.team === 0 ? -1 : 1;
    line(ctx, zone.x - direction * 10, zone.y, zone.x + direction * 10, zone.y, ctx.strokeStyle, 2);
    line(ctx, zone.x + direction * 10, zone.y, zone.x + direction * 3, zone.y - 7, ctx.strokeStyle, 2);
    line(ctx, zone.x + direction * 10, zone.y, zone.x + direction * 3, zone.y + 7, ctx.strokeStyle, 2);
    screenLabel(zone.x, zone.y + zone.radius + 14, zone.team === 0 ? 'YOUR HOME' : 'ENEMY HOME', '#e0dfee', view.width < 600 ? 7 : 8);
  }
  if (!objective.carrierId) {
    ctx.beginPath(); ctx.arc(objective.x, objective.y, objective.radius || 22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff0b548'; ctx.fill(); ctx.strokeStyle = '#eadd9b'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    drawRelicMarker(objective);
    screenLabel(objective.x, objective.y + 28, objective.state === 'resetting' ? 'RESETTING' : objective.contested ? 'CONTESTED' : 'RELIC', '#f8edcd', 8);
  } else if (game.config?.mode === 'play' && objective.carrierId === game.control?.soldierId) {
    const carrier = renderFrame.soldiers.find(soldier => soldier.id === objective.carrierId);
    const home = objective.extractionZones?.find(zone => zone.team === carrier?.team);
    if (carrier && home) { ctx.setLineDash([5, 7]); line(ctx, carrier.x, carrier.y, home.x, home.y, '#2a625b99', 2); ctx.setLineDash([]); }
  }
}
function drawTacticalField() {
  const front = Number.isFinite(renderFrame.frontLine) ? renderFrame.frontLine : world.width / 2;
  ctx.save();
  ctx.setLineDash([4, 9]); ctx.lineWidth = 1; ctx.strokeStyle = '#97acd42a';
  ctx.beginPath(); ctx.moveTo(front, 50); ctx.lineTo(front, world.height - 50); ctx.stroke();
  ctx.setLineDash([]);
  if (tacticalView) screenLabel(front, world.height - 32, 'FRONT', '#9baac4', 8);
  const objective = renderFrame.objective;
  if (objective && game.config?.matchMode === 'relic') drawRelicField(objective);
  if (objective && game.config?.matchMode === 'control') {
    const tone = objective.owner === 0 ? colors.player : objective.owner === 1 ? colors.enemy : '#b4addd';
    const r = objective.radius || 55;
    ctx.beginPath(); ctx.arc(objective.x, objective.y, r, 0, Math.PI * 2); ctx.fillStyle = tone + '12'; ctx.fill();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = tone + '67'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(objective.x, objective.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(objective.capture || 0) / 100);
    ctx.strokeStyle = objective.capture >= 0 ? colors.player : colors.enemy; ctx.lineWidth = 3; ctx.stroke();
    // The physical signal post and capture circle use the engine's exact position.
    ellipse(ctx, objective.x + 5, objective.y + 10, 15, 6, '#3e563539');
    line(ctx, objective.x, objective.y + 10, objective.x, objective.y - 35, '#63714f', 3);
    const flag = objective.owner === 0 ? colors.player : objective.owner === 1 ? colors.enemy : '#ece2b8';
    ctx.beginPath(); ctx.moveTo(objective.x + 1, objective.y - 35); ctx.lineTo(objective.x + 26, objective.y - 32); ctx.lineTo(objective.x + 22, objective.y - 17); ctx.lineTo(objective.x + 1, objective.y - 20); ctx.closePath(); ctx.fillStyle = flag; ctx.fill();
    line(ctx, objective.x + 1, objective.y - 35, objective.x + 26, objective.y - 32, '#f0e9ba75', 1);
    screenLabel(objective.x, objective.y + r + 15, objective.contested ? 'CONTESTED' : objective.owner === 0 ? 'YOUR SIGNAL' : objective.owner === 1 ? 'ENEMY SIGNAL' : 'CAPTURE SIGNAL', '#c5c7dd', view.width < 600 ? 6 : 7);
  }
  if (tacticalView) {
    for (const node of game.terrain?.coverNodes || COVER_NODES) {
      ctx.beginPath(); ctx.arc(node.x, node.y, 17, 0, Math.PI * 2); ctx.strokeStyle = node.team === 0 ? '#326c5b70' : '#a2644560'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  const selected = renderFrame.soldiers.find(s => s.id === selectedUnitId);
  for (const soldier of renderFrame.soldiers) {
    if (!soldier.alive || (!tacticalView && soldier !== selected)) continue;
    const target = renderFrame.soldiers.find(s => s.id === soldier.target);
    if (target?.alive) {
      ctx.setLineDash([3, 7]);
      line(ctx, soldier.x, soldier.y, target.x, target.y, soldier.team === 0 ? '#34725859' : '#a05e4049', soldier === selected ? 1.8 : .8);
      ctx.setLineDash([]);
    }
  }
  if (selected?.alive && tacticalView) {
    if (permitsForceAttacks(game.config)) {
      const range = WEAPONS[selected.weapon]?.range || 0;
      ctx.beginPath(); ctx.arc(selected.x, selected.y, range, 0, Math.PI * 2); ctx.setLineDash([5, 8]); ctx.strokeStyle = '#faf1bf65'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    }
    const saberReach = KNIVES[selected.meleeWeapon].range + FORMS[selected.form].reachBonus;
    ctx.beginPath(); ctx.arc(selected.x, selected.y, saberReach, 0, Math.PI * 2); ctx.strokeStyle = '#bdeaffad'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}
function updateVisualPuffs(dt: number) {
  if (motionReduced() || preferences.effects === 'minimal') { visualPuffs = []; return; }
  const generation = `${seed}:${game.round}:${game.time < .02}`;
  if (game.time < .02 || visualGeneration.split(':')[1] !== String(game.round)) { visualPuffs = []; lastVisualEffect = 0; }
  visualGeneration = generation;
  if (!paused) {
    for (const puff of visualPuffs) puff.ttl -= dt;
    visualPuffs = visualPuffs.filter(puff => puff.ttl > 0);
  }
  if (game.status !== 'playing') { visualPuffs = []; return; }
  for (const effect of game.effects || []) {
    if (effect.id <= lastVisualEffect) continue;
    lastVisualEffect = Math.max(lastVisualEffect, effect.id);
    if (effect.type === 'force' || effect.type === 'impact') {
      visualPuffs.push({ x: effect.x, y: effect.y, ttl: .5, maxTtl: .5, size: effect.type === 'force' ? 4 : 6, drift: effect.id % 2 ? 1 : -1 });
    }
  }
  if (visualPuffs.length > 50) visualPuffs.splice(0, visualPuffs.length - 50);
}
function drawVisualPuffs() {
  for (const puff of visualPuffs) {
    const life = 1 - puff.ttl / puff.maxTtl;
    ellipse(ctx, puff.x + life * 8 * puff.drift, puff.y - life * 6, puff.size + life * 5, puff.size * .7 + life * 3, `rgba(232,225,192,${(1 - life) * .28})`);
  }
}

function draw() {
  if (appPhase === 'menu' || !view.width || !view.height) return;
  if (presentationGame !== game || presentationRound !== game.round) resetPresentation();
  // Clear the padded area as well as the map, including after flight or resize.
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = arenaPalette(game.terrain?.id).outer; ctx.fillRect(0, 0, view.width, view.height);
  const shake = presentationEffects.shake();
  ctx.setTransform(view.dpr * view.sx, 0, 0, view.dpr * view.sy, view.dpr * (view.ox + shake.x), view.dpr * (view.oy + shake.y));
  if (lastTerrainSignature !== terrainSignature()) drawTerrain();
  // One immutable presentation view is shared by every moving anchor.
  renderFrame = createRenderFrame(game, { interpolate: !paused && game.status === 'playing' });
  renderFighters = renderFrame.fighters; renderTick = renderFrame.tick;
  if (renderPoseGame !== game || game.tick < lastPoseTick || [...renderSwings.values()].some(effect => effect.round !== game.round)) renderSwings.clear();
  renderPoseGame = game; lastPoseTick = game.tick; renderBlocks = new Map();
  for (const [id, effect] of renderSwings) if (game.tick - effect.tick > 36 || !renderFighters.has(id)) renderSwings.delete(id);
  for (const effect of game.effects || []) {
    if (effect.type === 'saber' && (!renderSwings.has(effect.soldierId!) || effect.id > renderSwings.get(effect.soldierId!)!.id)) renderSwings.set(effect.soldierId!, { ...effect, round: game.round } as RenderSwing);
    if (effect.type === 'block') renderBlocks.set(effect.soldierId!, { ...effect, tick: effect.tick ?? game.tick - Math.round(((effect.maxTtl || .3) - effect.ttl) * 60) });
  }
  sharedBeats = sampleSharedCombatBeats({ fighters: renderFrame.soldiers, swings: renderSwings, tick: renderTick, reducedMotion: motionReduced() });
  ctx.drawImage(terrain, 0, 0);
  drawArenaCurrent(ctx, { width: world.width, height: world.height, mapId: game.terrain?.id, bounds: game.terrain?.bounds,
    time: renderTick / 60, fullEffects: preferences.effects !== 'minimal', reducedMotion: motionReduced(), colors });
  drawEnvironment();
  drawTacticalField();
  drawOrderMarker();

  drawVisualPuffs();
  const soldiers = [...renderFrame.soldiers].sort((a, b) => Number(a.alive) - Number(b.alive) || a.y - b.y);
  for (const soldier of soldiers) drawSoldier(soldier);
  if (game.config?.matchMode === 'relic' && game.objective?.carrierId) drawRelicMarker(renderFrame.objective!);
  drawEffects();
  presentationEffects.draw(ctx);
  arenaImpact.draw(ctx, colors);
  drawTargetLock();
}
function fillSelect(id: SelectId, entries: Iterable<readonly string[]>) {
  const select = $(id); select.replaceChildren();
  for (const [value, label] of entries) { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); }
}
function priorityName(id: string, mode: string = game.config?.matchMode) {
  return id === 'objective' ? mode === 'elimination' ? 'Near center' : mode === 'relic' ? 'Near relic' : TARGET_PRIORITIES[id]?.name || 'Balanced' : TARGET_PRIORITIES[id]?.name || 'Balanced';
}
function updateMatchRulesHint() {
  const config = { matchMode: $('setupMatchMode').value, roundDuration: Number($('setupRoundDuration').value) };
  $('matchRulesHint').textContent = displayText(describeMatchRules(config).summary);
  const modifier = getModifier($('setupModifier').value);
  $('modifierHint').textContent = modifier.description;
  for (const team of [0, 1]) for (const id of [`setupStartingForce${team}`, `setupStartingForceQuality${team}`] as const) $(id).disabled = !modifier.forceAttacks;
  for (const team of [0, 1]) {
    for (const option of $(`setupPriority${team}`).options) option.textContent = priorityName(option.value, config.matchMode);
  }
  updateSetupTacticsHints();
}
function updateSetupTacticsHints() {
  for (const team of [0, 1]) {
    const doctrine = DOCTRINES[$(team ? 'setupEnemyDoctrine' : 'setupDoctrine').value as keyof typeof DOCTRINES];
    const formation = FORMATIONS[$(`setupFormation${team}`).value];
    const deployment = DEPLOYMENTS[$(`setupDeployment${team}`).value];
    $(`setupDeploymentHint${team}`).textContent = displayText(deployment?.description || '');
    const priority = TARGET_PRIORITIES[$(`setupPriority${team}`).value];
    const mode = $('setupMatchMode').value;
    const targeting = priority.id === 'objective' ? mode === 'elimination' ? 'Target enemies near the middle. The signal is off in Elimination.' : mode === 'relic' ? 'Favor enemies near the relic. AI teammates retrieve, escort and intercept carriers.' : priority.description : priority.description;
    $(team ? 'enemyTacticsHint' : 'friendlyTacticsHint').textContent = `${displayText(doctrine.description)} ${displayText(formation.description)} ${displayText(targeting)}`;
  }
}
function initializeTacticalOptions() {
  const doctrines = Object.values(DOCTRINES).map(item => [item.id, item.name]);
  const formations = Object.values(FORMATIONS).map(item => [item.id, item.name]);
  const deployments = Object.values(DEPLOYMENTS).map(item => [item.id, item.name]);
  const priorities = Object.values(TARGET_PRIORITIES).map(item => [item.id, item.name]);
  for (const id of ['setupDoctrine', 'setupEnemyDoctrine', 'nextEnemyDoctrine'] as const) fillSelect(id, doctrines);
  for (const team of [0, 1]) {
    for (const prefix of ['setup', 'next'] as const) {
      fillSelect(`${prefix}Deployment${team}`, deployments);
      fillSelect(`${prefix}Formation${team}`, formations); fillSelect(`${prefix}Priority${team}`, priorities);
    }
    for (const id of [`setupFormation${team}`, `setupPriority${team}`, team ? 'setupEnemyDoctrine' : 'setupDoctrine']) $(id).addEventListener('change', updateSetupTacticsHints);
    $(`setupDeployment${team}`).addEventListener('change', updateSetupTacticsHints);
    $(`nextDeployment${team}`).addEventListener('change', event => { nextDeployments[team] = (event.target as HTMLSelectElement).value; });
    $(`nextFormation${team}`).addEventListener('change', event => { nextFormations[team] = (event.target as HTMLSelectElement).value; });
    $(`nextPriority${team}`).addEventListener('change', event => { nextTargetPriorities[team] = (event.target as HTMLSelectElement).value; });
  }
  $('nextEnemyDoctrine').addEventListener('change', event => { nextEnemyDoctrine = (event.target as HTMLSelectElement).value as keyof typeof DOCTRINES; });
  syncTacticalPlan();
}
function syncTacticalPlan() {
  nextDeployments = [...(game.config?.deployments || ['standard', 'standard'])];
  nextEnemyDoctrine = game.doctrines[1];
  nextFormations = [...(game.config?.formations || ['line', 'line'])];
  nextTargetPriorities = [...(game.config?.targetPriorities || ['balanced', 'balanced'])];
  $('nextEnemyDoctrine').value = nextEnemyDoctrine;
  for (const team of [0, 1]) {
    $(`nextFormation${team}`).value = nextFormations[team];
    $(`nextDeployment${team}`).value = nextDeployments[team];
    $(`nextPriority${team}`).value = nextTargetPriorities[team];
    for (const option of $(`nextPriority${team}`).options) option.textContent = priorityName(option.value);
  }
}
function updateMasteryReport() {
  $('resultMastery').replaceChildren();
  const awards = game.roundReport?.mastery || [];
  for (const team of [0, 1]) {
    const rows = awards.filter(award => award.team === team);
    if (!rows.length) continue;
    const group = document.createElement('details'); group.open = team === 0;
    const summary = document.createElement('summary'); summary.textContent = `${team === 0 ? 'Your team' : 'Enemy team'} · ${rows.length} fighter records`;
    const list = document.createElement('ul');
    for (const award of rows) {
      const formId = game.soldiers.find(soldier => soldier.id === award.soldierId)?.form || game.forms[team][award.lane];
      const before = masterySummary(award.before, formId), after = masterySummary(award.after, formId);
      const item = document.createElement('li');
      const label = document.createElement('strong'); label.textContent = `Fighter ${String(award.lane + 1).padStart(2, '0')} · ${after.formName}`;
      const gain = document.createElement('span'); gain.textContent = `This round: ${after.kills - before.kills} kills · ${Math.round(after.damage - before.damage)} damage · ${after.blocks - before.blocks} blocks${game.config?.matchMode !== 'elimination' ? ` · ${(after.objectiveSeconds - before.objectiveSeconds).toFixed(1)}s on objectives` : ''}`;
      const total = document.createElement('small'); total.textContent = `Form total: ${after.rounds} rounds · ${after.kills} kills · ${Math.round(after.damage)} damage · ${after.blocks} blocks`;
      item.append(label, gain, total); list.append(item);
    }
    group.append(summary, list); $('resultMastery').append(group);
  }
  if (!awards.length) $('resultMastery').textContent = 'Form stats are recorded from v0.7 onward. Older rounds have no form stats.';
  $('resultCommendations').replaceChildren();
  for (const award of game.roundReport?.commendations || []) {
    const card = document.createElement('article');
    const heading = document.createElement('strong'); heading.textContent = displayText(award.label);
    const winners = document.createElement('span'); winners.textContent = award.soldierIds.map(id => {
      const soldier = game.soldiers.find(item => item.id === id);
      return soldier ? `${soldier.team === 0 ? 'Your' : 'Enemy'} fighter ${String(soldier.lane + 1).padStart(2, '0')}` : id;
    }).join(' · ') + (award.soldierIds.length > 1 ? ' · tied' : '');
    const description = document.createElement('small'); description.textContent = `${displayText(award.description)} ${Number(award.value.toFixed(1))}${award.id === 'objective' ? ' seconds' : award.id === 'defender' ? ' blocks' : ' damage'}. No stat bonus.`;
    card.append(heading, winners, description); $('resultCommendations').append(card);
  }
  if (!$('resultCommendations').children.length) $('resultCommendations').textContent = 'No awards this round.';
}
function lockedTarget() {
  if (game.config?.mode !== 'play') return null;
  const id = input.snapshot().targetId;
  return id ? visibleEnemyTargets(game, game.control?.soldierId).find(enemy => enemy.id === id) || null : null;
}
function lockTarget(target: ClassicSoldier) {
  input.aim(target.id);
  const message = `Target: enemy fighter ${String(target.lane + 1).padStart(2, '0')}`;
  showToast(message); announce(message); updateDirectUI(); draw();
}
function cycleTarget() {
  if (appPhase !== 'playing' || paused || game.status !== 'playing' || game.config?.mode !== 'play') return;
  const targets = visibleEnemyTargets(game, game.control?.soldierId);
  if (!targets.length) { input.aim(null); showToast('No enemies in sight'); announce('No enemies in sight.'); return; }
  const current = targets.findIndex(enemy => enemy.id === input.snapshot().targetId);
  lockTarget(targets[(current + 1) % targets.length]);
}
function drawTargetLock() {
  const target = renderFighters.get(lockedTarget()?.id!);
  if (!target?.alive) return;
  ctx.save(); ctx.translate(target.x, target.y - airborneHeight(target, renderTick)); ctx.scale(1 / view.sx, 1 / view.sy);
  ctx.beginPath(); ctx.arc(0, 2, 27, 0, Math.PI * 2);
  ctx.strokeStyle = '#1b2828ed'; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.stroke();
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 24, 2 + Math.sin(angle) * 24); ctx.lineTo(Math.cos(angle) * 33, 2 + Math.sin(angle) * 33); ctx.stroke();
  }
  const label = `LOCK ${String(target.lane + 1).padStart(2, '0')}`;
  roundRect(ctx, -30, -61, 60, 17, 4, '#1b2828f2');
  ctx.fillStyle = '#ffe08a'; ctx.font = '700 10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(label, 0, -49);
  ctx.restore();
}

function updateStartingHint(team: number) {
  const rank = SOLDIER_GRADES.find(grade => grade.label === $(`setupStartingRank${team}`).value) || SOLDIER_GRADES[0];
  const career = progressionSummary(rank.threshold);
  const force = FORCE_FAMILIES.find(item => item.id === $(`setupStartingForce${team}`).value);
  const modifiers = career.modifiers;
  const health = Number(((modifiers.healthMultiplier - 1) * 100).toFixed(1));
  const accuracy = Number((modifiers.accuracyBonus * 100).toFixed(1));
  const recovery = Number(((1 - modifiers.reloadMultiplier) * 100).toFixed(1));
  const bonuses = rank.index === 0 ? 'Base stats.' : `+${health}% health, +${accuracy} accuracy points, ${recovery}% shorter saber recovery.`;
  $(`startingHint${team}`).textContent = `${gradeDisplayLabel(rank.label)} starts at ${rank.threshold} training points. ${bonuses} ${displayText(force?.role || '')}`;
}
function initializeStartingOptions() {
  const ranks = SOLDIER_GRADES.map(grade => [grade.label, gradeDisplayLabel(grade.label)]);
  const qualities = QUALITY_LEVELS.map(quality => [quality.id, quality.label || 'Standard']);
  const powers = FORCE_FAMILIES.map(power => [power.id, power.name]);
  for (const team of [0, 1]) {
    fillSelect(`setupStartingRank${team}`, ranks);
    fillSelect(`setupStartingSaber${team}`, qualities); $(`setupStartingSaber${team}`).value = 'standard';
    fillSelect(`setupStartingForce${team}`, powers); $(`setupStartingForce${team}`).value = 'force_push';
    fillSelect(`setupStartingForceQuality${team}`, qualities); $(`setupStartingForceQuality${team}`).value = 'standard';
    for (const id of [`setupStartingRank${team}`, `setupStartingForce${team}`]) $(id).addEventListener('change', () => updateStartingHint(team));
    updateStartingHint(team);
  }
}

function setupForms() {
  const count = Number($('setupTeam0').value);
  if (!Number.isInteger(count) || count < 1 || count > 15) return;
  const previous = [...$('setupFormChoices').querySelectorAll('select')].map(select => select.value);
  const slot = $('setupPlayerSlot').value;
  fillSelect('setupPlayerSlot', Array.from({ length: count }, (_, i) => [String(i), `Fighter ${String(i + 1).padStart(2, '0')}`]));
  $('setupPlayerSlot').value = String(Math.min(Number(slot || 0), count - 1));
  $('setupFormChoices').replaceChildren();
  for (let i = 0; i < count; i++) {
    const label = document.createElement('label'); label.textContent = `Fighter ${String(i + 1).padStart(2, '0')}`;
    const select = document.createElement('select'); select.dataset.setupSlot = String(i); select.id = `setup-form-${i}`;
    for (const form of Object.values(FORMS)) { const option = document.createElement('option'); option.value = form.id; option.textContent = form.name; select.append(option); }
    select.value = previous[i] || 'shii_cho'; label.append(select); $('setupFormChoices').append(label);
  }
}
function applyMasterTrial() {
  if (appPhase !== 'menu') return;
  const values = {
    setupTeam0: '1', setupTeam1: '5', setupStartingRank0: 'SSS+V', setupStartingRank1: 'F',
    setupAllForms: 'makashi', setupOpponentForm: 'shii_cho', setupMatchMode: 'elimination',
    setupRoundDuration: '90', setupModifier: 'standard', setupMapSize: 'small', setupTerrain: 'crossroads',
    setupEnvironment: 'clear', setupSpeed: '1', setupDoctrine: 'balanced', setupEnemyDoctrine: 'balanced',
    setupDeployment0: 'standard', setupDeployment1: 'standard',
    setupFormation0: 'line', setupFormation1: 'line', setupPriority0: 'balanced', setupPriority1: 'balanced',
  };
  for (const [id, value] of Object.entries(values)) ($(id) as HTMLSelectElement | HTMLInputElement).value = value;
  for (const team of [0, 1]) {
    $(`setupStartingSaber${team}`).value = 'standard';
    $(`setupStartingForce${team}`).value = 'force_push';
    $(`setupStartingForceQuality${team}`).value = 'standard';
    $(`setupStartingDualSabers${team}`).checked = false;
    updateStartingHint(team);
  }
  $('setupForm').querySelectorAll<HTMLInputElement>('[name=playMode]').forEach(radio => { radio.checked = radio.value === 'spectate'; });
  setupForms();
  for (const select of $('setupFormChoices').querySelectorAll('select')) select.value = 'makashi';
  updateSetupMode(); updateMatchRulesHint();
  $('environmentHint').textContent = displayText(ENVIRONMENTS.clear.description);
  $('opponentHint').textContent = 'Every enemy uses Shii-Cho for the whole game.';
  $('setupPresetStatus').textContent = 'Master trial ready: 1 SSS+ V Makashi vs 5 F Shii-Cho. Equal standard gear, current seed. Edit any setting, then press Start.';
  announce('Master trial setup applied. Edit any setting, then press Start.');
}

function startQuickFight(id: string) {
  const fight = QUICK_FIGHTS[id as keyof typeof QUICK_FIGHTS] as (typeof QUICK_FIGHTS)[keyof typeof QUICK_FIGHTS] & {formation?: string; priority?: string};
  if (!fight || appPhase !== 'menu') return;
  const values = {
    setupTeam0: String(fight.friendly), setupTeam1: String(fight.enemy),
    setupMatchMode: fight.rules, setupRoundDuration: String(fight.duration), setupModifier: fight.modifier,
    setupTerrain: fight.map, setupMapSize: 'small', setupEnvironment: fight.weather,
    setupOpponentForm: fight.opponent, setupAllForms: fight.forms[0], setupSpeed: '1',
    setupDoctrine: 'balanced', setupEnemyDoctrine: 'balanced',
    setupDeployment0: 'standard', setupDeployment1: 'standard',
    setupFormation0: fight.formation ?? 'line', setupFormation1: fight.formation ?? 'line',
    setupPriority0: fight.priority ?? 'balanced', setupPriority1: fight.priority ?? 'balanced',
  };
  for (const [key, value] of Object.entries(values)) ($(key) as HTMLSelectElement | HTMLInputElement).value = value;
  $('setupForm').querySelectorAll<HTMLInputElement>('[name=playMode]').forEach(radio => { radio.checked = radio.value === fight.mode; });
  for (const team of [0, 1]) {
    $(`setupStartingRank${team}`).value = fight.rank;
    $(`setupStartingSaber${team}`).value = 'standard';
    $(`setupStartingForce${team}`).value = 'force_push';
    $(`setupStartingForceQuality${team}`).value = 'standard';
    $(`setupStartingDualSabers${team}`).checked = false;
    updateStartingHint(team);
  }
  setupForms(); $('setupPlayerSlot').value = '0';
  $('setupFormChoices').querySelectorAll('select').forEach((select, i) => { select.value = fight.forms[i]; });
  updateSetupMode(); updateMatchRulesHint();
  $('setupEnvironment').dispatchEvent(new Event('change'));
  $('setupOpponentForm').dispatchEvent(new Event('change'));
  $('setupForm').requestSubmit();
}
function updateSetupMode() {
  const mode = ($('setupForm').elements as HTMLFormControlsCollection & {playMode: RadioNodeList}).playMode.value;
  $('playerSlotField').hidden = mode !== 'play';
  $('startBattleBtn').firstChild!.textContent = mode === 'play' ? 'Start ' : 'Start ';
}
function refreshMenu() {
  const saved = hasSavedCampaign(campaignStorage);
  $('continueSessionBtn').disabled = !sessionStarted && !saved;
  $('continueSessionBtn').textContent = sessionStarted ? `Continue · round ${game.round}` : 'Continue';
  $('loadCheckpointBtn').disabled = !saved;
  $('loadCheckpointBtn').hidden = !sessionStarted;
  $('menuSaveStatus').textContent = sessionStarted ? `Game paused. ${saved ? 'A saved game is also available.' : 'Save from Stats to continue after closing this page.'}` : saved ? 'Your saved game will load paused.' : 'No saved game. Press Start to begin.';
}
function openMainMenu() {
  if (appPhase === 'menu') return;
  clearInput(); audio.silence(); paused = true; appPhase = 'menu'; lastTime = 0;
  if (animationHandle) cancelAnimationFrame(animationHandle); animationHandle = 0;
  $('battleSurface').hidden = true; $('battleUtilities').hidden = true; $('startMenu').hidden = false;
  refreshMenu(); $('debugState').dataset.phase = appPhase; $('menuHeading').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' });
}
function continueSession() {
  if (!sessionStarted) { resumeSavedCampaign(); return; }
  $('startMenu').hidden = true; $('battleSurface').hidden = false; $('battleUtilities').hidden = false;
  appPhase = game.status === 'ended' ? 'results' : 'paused'; resultShown = false; lastTime = 0;
  $('pauseReason').textContent = 'Select a fighter to see their stats.';
  if (game.status === 'playing') setPaused(true);
  resize(); updateUI(); restoreAudioFromGesture(); ensureFrame();
}
function startNewCampaign(event: SubmitEvent) {
  event.preventDefault();
  if (appPhase !== 'menu' || !$('setupForm').reportValidity()) return;
  const options = {
    teamSizes: [Number($('setupTeam0').value), Number($('setupTeam1').value)],
    mapSize: $('setupMapSize').value, terrain: $('setupTerrain').value, environment: $('setupEnvironment').value,
    mode: ($('setupForm').elements as HTMLFormControlsCollection & {playMode: RadioNodeList}).playMode.value, playerSlot: Number($('setupPlayerSlot').value),
    matchMode: $('setupMatchMode').value, roundDuration: Number($('setupRoundDuration').value), modifier: $('setupModifier').value,
    formations: [$('setupFormation0').value, $('setupFormation1').value],
    deployments: [$('setupDeployment0').value, $('setupDeployment1').value],
    targetPriorities: [$('setupPriority0').value, $('setupPriority1').value],
    startingRanks: [$('setupStartingRank0').value, $('setupStartingRank1').value],
    startingSaberQuality: [$('setupStartingSaber0').value, $('setupStartingSaber1').value],
    startingDualSabers: [$('setupStartingDualSabers0').checked, $('setupStartingDualSabers1').checked],
    startingForceFamily: [$('setupStartingForce0').value, $('setupStartingForce1').value],
    startingForceQuality: [$('setupStartingForceQuality0').value, $('setupStartingForceQuality1').value],
    doctrine: $('setupDoctrine').value, enemyDoctrine: $('setupEnemyDoctrine').value, opponentForm: $('setupOpponentForm').value === 'mixed' ? null : $('setupOpponentForm').value,
    forms: [[...$('setupFormChoices').querySelectorAll('select')].map(select => select.value)],
  };
  const nextSeed = Number($('setupSeed').value);
  if (!Number.isInteger(nextSeed) || nextSeed < 1 || nextSeed > 0xffffffff) { $('setupError').textContent = 'Choose a whole-number seed from 1 to 4294967295.'; return; }
  let next;
  try { next = createGame(nextSeed, options); } catch (error) { $('setupError').textContent = (error as Error).message; return; }
  clearInput(); game = next; seed = nextSeed; sessionStarted = true; appPhase = 'playing'; paused = false;
  campaignSavingEnabled = false; manualDeathHandled = false; resultShown = false; selectedUnitId = null;
  nextForms = [...game.forms[0]]; nextDoctrine = game.doctrines[0]; syncTacticalPlan();
  speed = Number($('setupSpeed').value); preferences.speed = speed as typeof preferences.speed; savePreferences(preferences);
  lastTime = 0; lastUI = 0; lastEventSignature = ''; lastObjectiveSignature = ''; lastTerrainSignature = ''; visualGeneration = ''; visualPuffs = [];
  combatFeedback = []; feedbackGeneration = ''; lastFeedbackEffect = 0; lastFeedbackTick = 0; lastVisualEffect = 0;
  cooldownMax = 1; smokeCooldownMax = 1; mutationUntil = 0; toastUntil = 0; audio.silence();
  $('startMenu').hidden = true; $('battleSurface').hidden = false; $('battleUtilities').hidden = false;
  for (const id of ['resultOverlay', 'roundReviewBar', 'pausedOverlay', 'mutationBanner']) $(id).hidden = true;
  $('orderToast').classList.remove('is-visible'); $('setupError').textContent = '';
  $('pauseReason').textContent = 'Select a fighter to see their stats.';
  $('saveStatus').textContent = 'New game started. Your old save is kept until you save or start the next round.';
  syncWorld(); buildPips(); buildRoster(); buildFormChoices(); drawTerrain(); resize(); setPaused(false); applyPresentation();

  announce(options.mode === 'play' ? `Battle started. You control fighter ${options.playerSlot + 1}.` : options.mode === 'command' ? 'Command mode. Give orders to your AI team.' : 'Watching. Both teams play automatically.');
  canvas.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); ensureFrame();
}
function updateTeamOrders() {
  const enabled = game.config?.mode === 'command' || game.config?.mode === 'play';
  $('battleSurface').classList.toggle('team-command-enabled', enabled);
  $('teamCommandRow').hidden = !enabled;
  $('teamOrderStatus').hidden = $('teamOrderHelp').hidden = !enabled;
  $('autoBtn').disabled = !enabled || paused || game.status !== 'playing';
  for (const id of ['grenadeBtn', 'smokeBtn'] as const) $(id).disabled ||= !enabled;
  const intent = enabled ? commandIntent(game, 0) : null;
  currentOrderMarker = intent && intent.eligible > 0 && game.status === 'playing' && Number.isFinite(intent.anchor?.x) && Number.isFinite(intent.anchor?.y)
    ? { x: intent.anchor!.x, y: intent.anchor!.y, label: intent.order === 'regroup' ? 'Regroup assembly' : `${intent.label} reference point` } : null;
  $('teamOrderStatus').textContent = intent ? `Your team · ${intent.auto ? 'Auto' : 'Your orders'} · ${intent.label} · ${intent.eligible === 0 ? 'No AI teammates available for movement orders.' : intent.reason}${paused ? ' · Paused' : ''}` : '';
  $('teamOrderHelp').textContent = game.config?.mode === 'play'
    ? 'Orders guide your AI teammates; you keep control of your fighter. Dashed markers show a reference point, or the assembly point for Regroup. Flank uses the public objective as its reference. Auto returns team decisions to AI.'
    : 'Choose an order for your AI team. Dashed markers show a reference point, or the assembly point for Regroup. Flank uses the public objective as its reference. Auto returns team decisions to AI.';
  for (const button of commands) {
    const active = enabled && intent?.order === button.dataset.order;
    button.title = SQUAD_ORDERS[button.dataset.order!]?.description || '';
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    button.disabled = !enabled || paused || game.status !== 'playing' || intent?.eligible === 0;
    const shortcut = button.querySelector('kbd'); if (shortcut) shortcut.hidden = game.config?.mode !== 'command';
  }
  for (const button of [$('grenadeBtn'), $('smokeBtn')]) {
    const shortcut = button.querySelector('kbd'); if (shortcut) shortcut.hidden = game.config?.mode !== 'command';
  }
}
function drawOrderMarker() {
  if (!currentOrderMarker || game.status !== 'playing') return;
  const { x, y, label } = currentOrderMarker;
  ctx.save(); ctx.strokeStyle = colors.player; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  screenLabel(x, y - 25, `TEAM ${String(label).toUpperCase()}`, '#244c40', 8);
}
function updateDirectUI() {
  updateTeamOrders();
  const manual = game.config?.mode === 'play';
  const inspected = game.soldiers.find(s => s.id === selectedUnitId && s.alive);
  const position = game.status === 'playing' && inspected ? squadIntent(game, inspected) : null;
  $('squadPosition').hidden = !position;
  $('squadPosition').textContent = position ? `Fighter ${inspected!.lane + 1} · ${position.role} · ${position.reason}` : '';
  $('battleSurface').classList.toggle('direct-play', manual && game.status === 'playing');
  const fighter = game.soldiers.find(s => s.id === game.control?.soldierId);
  $('directControls').hidden = !manual;
  $('spectateBtn').hidden = !paused || (!manual && game.autoCommand);
  $('spectateBtn').textContent = manual ? 'Watch instead' : 'Let both teams play';
  $('resumeBtn').disabled = manual && !fighter?.alive;
  $('controlledStatus').textContent = fighter ? `Fighter ${fighter.lane + 1} · ${FORMS[fighter.form].name}${usesDualSabers(game.config, fighter) ? ' · Jar’Kai' : ''} · ${Math.max(0, Math.ceil(fighter.hp))} HP · ${Math.floor(fighter.energy)} energy${fighter.alive ? '' : ' · Dead'}` : 'Pause and choose a living teammate';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-player-action], [data-move-x]')) button.disabled = !manual || paused || game.status !== 'playing' || !fighter?.alive;
  const forceButton = document.querySelector<HTMLButtonElement>('[data-player-action=force]')!;
  const dashButton = document.querySelector<HTMLButtonElement>('[data-player-action=dash]')!;
  forceButton.title = fighter ? `Force repertoire: ${forceRepertoireLabel(fighter)} · K` : 'Force · K';
  const forceAllowed = permitsForceAttacks(game.config);
  const carrying = game.config?.matchMode === 'relic' && game.objective?.carrierId === fighter?.id;
  forceButton.disabled ||= !forceAllowed;
  dashButton.disabled ||= carrying;
  if (fighter?.form === 'ataru' && !carrying) dashButton.setAttribute('aria-label', 'Acrobatic vault, Shift');
  else dashButton.setAttribute('aria-label', 'Dash, Shift');
  forceButton.querySelector('small')!.textContent = forceAllowed ? 'K' : 'Off';
  dashButton.querySelector('small')!.textContent = carrying ? 'Carrying' : 'Shift';
  dashButton.title = carrying ? 'Cannot dash while carrying the relic' : 'Dash · Shift';
  const target = lockedTarget();
  $('targetStatus').textContent = target ? `Locked · enemy fighter ${String(target.lane + 1).padStart(2, '0')} · ${Math.ceil(target.hp)} HP` : 'Auto aim · nearest enemy in sight';
  $('targetStatus').classList.toggle('is-locked', Boolean(target));
  const outcome = fighter?.lastOutcome;
  const statusText = outcome ? `Last action: ${outcomeText(outcome)} · ${outcome.kind === 'force' ? 'Force' : 'saber'}` : 'No attacks yet';
  if ($('combatStatus').textContent !== statusText) $('combatStatus').textContent = statusText;
  $('cycleTargetBtn').disabled ||= visibleEnemyTargets(game, game.control?.soldierId).length === 0;
  $('canvasHelp').textContent = manual ? 'Click to lock · Tab switches targets · Shift+Tab leaves map' : 'Select a fighter · arrows change selection';
  const environment = getEnvironment(game);
  $('environmentStatus').textContent = `${environment.name}${environment.phase === 'gust' ? ' · GUST' : environment.warning ? ' · Gust approaching' : ''} · Sight ${environment.sightRange}`;
  $('environmentStatus').title = displayText(environment.description);
  if (fighter) {
    const skill = combatSkillProfile(fighter.career);
    const nextMove = selectFormMove(fighter.form, fighter.comboUntil > game.tick ? (fighter.comboIndex || 0) % skill.comboLength : 0);
    document.querySelector<HTMLElement>('[data-player-action=attack]')!.title = fighter.attackCooldown > 0 ? `Saber ready in ${fighter.attackCooldown.toFixed(1)}s` : `${nextMove.name} · ${(nextMove.energyCost * skill.energyEfficiency * saberWieldProfile(game.config, fighter).energyMultiplier).toFixed(1)} energy`;
    forceButton.title = !forceAllowed ? 'Force attacks are off for both teams' : `${fighter.forceCooldown > 0 ? `Ready in ${fighter.forceCooldown.toFixed(1)}s. ` : ''}Repertoire: ${forceRepertoireLabel(fighter)}. Selects an available power for the target.`;
    if (fighter.form === 'ataru' && !carrying) dashButton.title = 'Acrobatic vault · Shift · energy cost and landing recovery';
    updateCombatReadiness(fighter, forceAllowed, carrying);
  }
  if (appPhase === 'playing') $('commandStatus').textContent = manual ? `Controlling fighter ${(fighter?.lane ?? 0) + 1} · AI teammates` : game.config?.mode === 'command' ? 'Commanding your team · AI fighters' : 'Watching · both teams play automatically';
  $('speedBtn').textContent = speed + '×'; $('speedBtn').setAttribute('aria-label', `Game speed: ${speed} times`);
}
function updateCombatReadiness(fighter: ClassicSoldier, forceAllowed: boolean, carrying: boolean) {
  const skill = combatSkillProfile(fighter.career), form = FORMS[fighter.form], wield = saberWieldProfile(game.config, fighter);
  const combo = fighter.comboUntil > game.tick ? (fighter.comboIndex || 0) % skill.comboLength : 0;
  const intent = duelIntent(game, fighter);
  const moveIndex = fighter.attack?.kind === 'saber' ? fighter.attack.comboIndex : intent.moveIndex;
  const moveKnown = Number.isInteger(moveIndex);
  const move = selectFormMove(fighter.form, moveKnown ? moveIndex! : combo);
  const target = game.soldiers.find(other => other.id === intent.targetId && other.alive);
  const ability = forceAbilityById(intent.abilityId), force = forceAbilityWeapon(WEAPONS[fighter.weapon], ability?.id);
  const distance = target ? Math.hypot(target.x - fighter.x, target.y - fighter.y) : Infinity;
  const saberCost = move.energyCost * skill.energyEfficiency * wield.energyMultiplier;
  document.querySelector<HTMLElement>('[data-player-action=attack]')!.title = moveKnown ? `${move.name} · ${saberCost.toFixed(1)} energy` : 'Next technique is selected after recovery';
  const forceCost = force.energyCost * form.forceCostMultiplier * skill.energyEfficiency;
  const blocked = (kind: string) => !!target && game.config.mapSize !== 'legacy' && !lineOfSight(game.terrain, fighter, target, kind);
  const readiness = (readyTick: number, cost: number, kind?: string, range?: number) => {
    if (paused) return 'Paused';
    if (!fighter.alive) return 'Defeated';
    if (fighter.staggerUntil > game.tick || fighter.landingRecoveryUntil > game.tick || fighter.pinned) return 'Recover';
    if (fighter.attack) return 'Committed';
    if (fighter.energy < cost) return 'Energy';
    if (readyTick > game.tick) return `${((readyTick - game.tick) / 60).toFixed(1)}s`;
    if (kind && !target) return 'No target';
    if (kind && blocked(kind)) return 'Blocked';
    if (kind && distance > range!) return 'Close in';
    return 'Ready';
  };
  const states = {
    attack: readiness(fighter.saberReadyTick, saberCost, 'saber', KNIVES[fighter.meleeWeapon].range + form.reachBonus + move.reachBonus),
    force: forceAllowed ? readiness(fighter.forceReadyTick, forceCost, 'force', force.range) : 'Off',
    guard: readiness(0, form.blockCost * skill.energyEfficiency * (skill.guardEnergyEfficiency ?? 1) * wield.blockCostMultiplier),
    dash: carrying ? 'Carrying' : readiness(fighter.dashReadyTick, form.dashCost),
  };
  const queued = input.snapshot();
  for (const [action, key] of [['attack', 'J'], ['force', 'K'], ['guard', 'Space'], ['dash', 'Shift']] as const) {
    const button = document.querySelector<HTMLButtonElement>(`[data-player-action=${action}]`)!;
    const pending = action !== 'guard' && queued[action] === true && !paused && fighter.alive;
    button.querySelector('small')!.textContent = `${key} · ${pending ? 'Queued · ' : ''}${states[action]}`;
    button.dataset.queued = String(pending);
    button.dataset.ready = String(states[action] === 'Ready');
  }
  const counter = fighter.counterUntil > game.tick;
  $('comboStatus').textContent = fighter.attack?.offhand ? 'Jar’Kai · offhand contact follows' :
    `${counter ? 'Counter opening · ' : ''}${moveKnown ? moveIndex! + 1 : combo + 1}/${skill.comboLength} · ${move.name}${wield.bladeCount === 2 ? ' · dual sabers' : ''}`;
  if (!moveKnown) $('comboStatus').textContent = 'Recovering · next technique not selected';
  $('comboStatus').classList.toggle('is-counter', counter && moveKnown);
  $('combatReadiness').textContent = `${ability?.name || force.name} · ${Math.ceil(forceCost)} energy${forceAllowed ? '' : ' · disabled'} · Strike ${Math.ceil(saberCost)} energy`;
  if (!moveKnown) $('combatReadiness').textContent = 'Technique and cost update after recovery';
}

function applyPresentation() {
  Object.assign(colors, COLOR_SCHEMES[preferences.colors]); tacticalView = preferences.tacticalView;
  document.documentElement.style.setProperty('--teal', colors.player); document.documentElement.style.setProperty('--coral', colors.enemy);
  document.documentElement.dataset.reducedMotion = String(motionReduced());
  $('intelBtn').setAttribute('aria-pressed', String(tacticalView));
  $('soundBtn').setAttribute('aria-pressed', String(audio.enabled)); $('soundLabel').textContent = audio.enabled ? 'Sound on' : 'Sound off';
  if (sessionStarted) { drawTerrain(); updateUI(); draw(); }
}
async function requestAudioEnabled(wanted: boolean) {
  const request = ++soundRequest;
  preferences.sound = Boolean(wanted); $('optionSound').checked = preferences.sound;
  if (!wanted) audio.setEnabled(false);
  const available = wanted ? await audio.unlock() : false;
  if (request !== soundRequest) return null;
  audio.setEnabled(Boolean(wanted && available)); preferences.sound = audio.enabled;
  savePreferences(preferences); $('optionSound').checked = audio.enabled;
  $('soundBtn').setAttribute('aria-pressed', String(audio.enabled)); $('soundLabel').textContent = audio.enabled ? 'Sound on' : 'Sound off';
  if (wanted && !available) { $('preferencesStatus').textContent = 'Sound is unavailable in this browser.'; if (appPhase !== 'menu') showToast('Sound is unavailable in this browser'); }
  return available;
}
function restoreAudioFromGesture() { if (preferences.sound) void requestAudioEnabled(true); }

function openOptions() {
  if (appPhase === 'playing') setPaused(true);
  clearInput();
  $('optionColors').value = preferences.colors; $('optionMotion').value = preferences.motion; $('optionEffects').value = preferences.effects;
  $('optionTactical').checked = preferences.tacticalView; $('optionSound').checked = preferences.sound;
  $('optionsDialog').showModal();
}
function initializeMenu() {
  fillSelect('setupTerrain', MAPS.map(map => [map.id, map.name]));
  fillSelect('setupMapSize', Object.values(MAP_SIZES).map(size => [size.id, `${size.name} · ${size.width} × ${size.height}`])); $('setupMapSize').value = 'medium';
  fillSelect('setupEnvironment', Object.values(ENVIRONMENTS).map(environment => [environment.id, environment.name]));
  initializeTacticalOptions();
  initializeStartingOptions();
  fillSelect('setupMatchMode', Object.values(MATCH_MODES).map(mode => [mode.id, mode.name]));
  fillSelect('setupModifier', Object.values(MODIFIERS).map(modifier => [modifier.id, modifier.name]));
  fillSelect('setupRoundDuration', ROUND_DURATIONS.map(seconds => [String(seconds), `${seconds} seconds`]));
  $('setupRoundDuration').value = '90';
  updateMatchRulesHint();
  for (const id of ['setupMatchMode', 'setupRoundDuration', 'setupModifier']) $(id).addEventListener('change', updateMatchRulesHint);
  const formOptions = Object.values(FORMS).map(form => [form.id, form.name]);
  fillSelect('setupOpponentForm', [['mixed', 'Mixed · changes each round'], ...formOptions]); fillSelect('setupAllForms', formOptions);
  fillSelect('optionColors', Object.entries(COLOR_SCHEMES).map(([id, scheme]) => [id, scheme.name]));
  $('setupSeed').value = String(seed); $('setupSpeed').value = String(preferences.speed); setupForms(); updateSetupMode();
  $('environmentHint').textContent = displayText(ENVIRONMENTS[$('setupEnvironment').value as keyof typeof ENVIRONMENTS].description);
  $('setupEnvironment').addEventListener('change', () => { $('environmentHint').textContent = displayText(ENVIRONMENTS[$('setupEnvironment').value as keyof typeof ENVIRONMENTS].description); });
  $('setupOpponentForm').addEventListener('change', () => { $('opponentHint').textContent = $('setupOpponentForm').value === 'mixed' ? 'Mixed forms change each round, using the game’s seed.' : 'Every enemy uses this form for the whole game.'; });
  $('setupTeam0').addEventListener('input', setupForms);
  $('setupForm').querySelectorAll<HTMLInputElement>('[name=playMode]').forEach(radio => radio.addEventListener('change', updateSetupMode));
  $('applyAllFormsBtn').addEventListener('click', () => { for (const select of $('setupFormChoices').querySelectorAll('select')) select.value = $('setupAllForms').value; });
  $('mixPlayerFormsBtn').addEventListener('click', () => { [...$('setupFormChoices').querySelectorAll('select')].forEach((select, i) => { select.value = formOptions[i % formOptions.length][0]; }); });
  $('setupForm').addEventListener('submit', startNewCampaign);
  $('masterTrialBtn').addEventListener('click', applyMasterTrial);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-quick-fight]')) button.addEventListener('click', () => startQuickFight(button.dataset.quickFight!));
  $('continueSessionBtn').addEventListener('click', continueSession); $('loadCheckpointBtn').addEventListener('click', resumeSavedCampaign);
  $('mainMenuBtn').addEventListener('click', openMainMenu); $('optionsBtn').addEventListener('click', openOptions); $('battleOptionsBtn').addEventListener('click', openOptions);
  $('controlsBtn').addEventListener('click', () => $('controlsDialog').showModal());
  for (const id of ['optionColors', 'optionMotion', 'optionEffects', 'optionTactical', 'optionSound']) $(id).addEventListener('change', async () => {
    preferences.colors = $('optionColors').value as typeof preferences.colors; preferences.motion = $('optionMotion').value as typeof preferences.motion; preferences.effects = $('optionEffects').value as typeof preferences.effects;
    preferences.tacticalView = $('optionTactical').checked;
    const wantsSound = $('optionSound').checked;
    const audioResult = id === 'optionSound' ? await requestAudioEnabled(wantsSound) : null;
    const saved = savePreferences(preferences);
    if (!(id === 'optionSound' && wantsSound && audioResult === false)) $('preferencesStatus').textContent = saved ? 'Settings saved.' : 'Settings apply for now. This browser can’t save them.';
    applyPresentation();
  });
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', clearInput);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-player-action], [data-move-x]')) input.bind(button);
  $('previousFighterBtn').addEventListener('click', () => cycleInspection(-1));
  $('nextFighterBtn').addEventListener('click', () => cycleInspection(1));
  $('inspectTeam').addEventListener('change', () => cycleInspection(1));
  $('inspectCarrierBtn').addEventListener('click', () => { if (game.objective?.carrierId) selectUnit(game.objective.carrierId); });
  $('takeControlBtn').addEventListener('click', () => {
    if (!paused || !setControlledFighter(game, selectedUnitId)) return;
    clearInput(); manualDeathHandled = false; $('pauseReason').textContent = 'Resume to play as this fighter.';
    updateUI(); draw(); announce('Fighter selected. Resume to play.');
  });
  $('spectateBtn').addEventListener('click', () => {
    if (!paused || !setControlledFighter(game, null)) return;
    clearInput(); manualDeathHandled = false; $('pauseReason').textContent = 'Watch mode selected. Resume to continue.'; updateUI(); draw();
  });
  reducedMotion.addEventListener('change', applyPresentation);
  applyPresentation(); refreshMenu();
}
function drawEnvironment() {
  const environment = getEnvironment(game);
  if (environment.id === 'clear') return;
  ctx.save();
  ctx.fillStyle = environment.id === 'rain' ? '#40687814' : environment.id === 'fog' ? '#edf2e427' : environment.phase === 'gust' ? '#d6b66c36' : '#d6b66c19';
  ctx.fillRect(0, 0, world.width, world.height);
  if (!motionReduced() && preferences.effects !== 'minimal' && environment.id === 'rain') {
    ctx.strokeStyle = '#d7e6dc42'; ctx.lineWidth = 1;
    for (let i = 0; i < 36; i++) { const x = (i * 157 + renderFrame.time * 40) % world.width, y = (i * 83 + renderFrame.time * 150) % world.height; line(ctx, x, y, x - 5, y + 12, '#d7e6dc42'); }
  }
  ctx.restore();
}

function recordDisplayFrame(now: number, rawElapsed: number, elapsed: number) {
  if (!qaStatus || !renderFrame) return;
  const previous = qaDisplayFrames.at(-1);
  if (qaSampleGame !== game || (previous && (previous.round !== game.round || previous.tick > game.tick))) {
    qaSampleGame = game; qaEpoch++; qaDisplayFrames.length = 0;
  }
  const current = game.soldiers.find(soldier => soldier.id === 'blue-0') || game.soldiers[0];
  const drawn = current && renderFighters.get(current.id);
  const sample = { now, rawElapsed, elapsed, tick: game.tick, alpha: renderFrame.alpha,
    hitStopSeconds: presentationClock.remaining, reducedMotion: motionReduced(), sharedBeats: [...sharedBeats.values()].map(b => ({ pair: b.pairId, phase: b.phase, accent: b.accent })),
    samplerTick: renderTick, id: current?.id || null,
    x: drawn?.x ?? null, y: drawn?.y ?? null,
    prevX: current?.prevX ?? null, prevY: current?.prevY ?? null,
    currentX: current?.x ?? null, currentY: current?.y ?? null,
    motionEligible: Boolean(current?.alive && !paused && game.status === 'playing' &&
      Math.hypot(current.x - current.prevX!, current.y - current.prevY!) > 1e-8),
    generation: `${seed}:${game.round}:${qaEpoch}`, round: game.round, appPhase, paused, visibility: document.visibilityState };
  qaDisplayFrames.push(sample);
  if (qaDisplayFrames.length > 300) qaDisplayFrames.shift();
  qaStatus.textContent = `QA frames ${++qaFrames} · tick ${game.tick} · alpha ${renderFrame.alpha.toFixed(4)} · sample ${renderTick.toFixed(4)} · ${sample.id} XY ${drawn?.x.toFixed(3)},${drawn?.y.toFixed(3)} · rAF delta ${(rawElapsed * 1000).toFixed(2)}ms · ${sample.visibility} · ${appPhase} · paused ${paused} · ${qaLastError || 'no error'}`;
  if (now - qaLogUpdated >= 250 || paused || rawElapsed === 0 || previous?.generation !== sample.generation || previous?.appPhase !== appPhase) {
    qaFrameLog!.textContent = JSON.stringify({ frames: qaDisplayFrames }); qaLogUpdated = now;
  }
}

function updateFightCallout(now: number) {
  const box = $('fightCallout');
  if (paused || game.status !== 'playing' || preferences.effects === 'minimal') { box.hidden = true; return; }
  let next = null, priority = 0;
  for (const event of game.effects || []) {
    if (event.id <= lastCalloutId) continue;
    lastCalloutId = Math.max(lastCalloutId, event.id);
    const candidate = event.type === 'death' ? 3 : event.type === 'counter' ? 2
      : event.type === 'saber' && event.outcome === 'blocked' ? 1 : 0;
    if (candidate && candidate >= priority) { next = event; priority = candidate; }
  }
  if (next && (box.hidden || now >= calloutUntil - 350 || priority === 3)) {
    const type = priority === 3 ? 'knockout' : priority === 2 ? 'counter' : 'clash';
    box.textContent = priority === 3 ? (next.team === 0 ? 'ALLY DOWN' : 'ENEMY DOWN') : type.toUpperCase();
    box.dataset.kind = type; box.hidden = false; calloutUntil = now + 1120;
  }
  if (now >= calloutUntil) box.hidden = true;
}

function frame(now: number) {
  animationHandle = 0;
  if (appPhase === 'menu' || document.hidden) { lastTime = 0; return; }
  const rawElapsed = lastTime ? (now - lastTime) / 1000 : 0;
  const elapsed = lastTime ? Math.min(.25, (now - lastTime) / 1000) : 0;
  lastTime = now;
  if (presentationGame !== game || presentationRound !== game.round) resetPresentation();
  presentationEffects.advance(rawElapsed, { reducedMotion: motionReduced() || preferences.effects === 'minimal', paused, visible: !document.hidden });
  arenaImpact.advance(rawElapsed, { reducedMotion: motionReduced(), fullEffects: preferences.effects !== 'minimal', paused, visible: !document.hidden });
  if (appPhase === 'playing' && !paused && game.status === 'playing' && elapsed > 0) {
    let remaining = elapsed;
    while (remaining > 1e-12 && game.status === 'playing') {
      remaining = presentationClock.consume(remaining);
      if (remaining <= 1e-12) break;
      const dt = Math.min(1 / 60, remaining * speed), before = game.tick;
      if (game.config?.mode === 'play') {
        const targetId = input.snapshot().targetId;
        if (targetId && !visibleEnemyTargets(game, game.control?.soldierId).some(enemy => enemy.id === targetId)) input.aim(null);
        setPlayerInput(game, input.snapshot());
      }
      const player = game.soldiers.find(s => s.id === game.control?.soldierId);
      const readiness = player ? [player.saberReadyTick, player.forceReadyTick, player.dashReadyTick] : [];
      step(game, dt);
      presentationClock.observe(game);
      presentationEffects.observe((game.effects || []) as Parameters<typeof presentationEffects.observe>[0]);
      arenaImpact.observe((game.effects || []) as Parameters<typeof arenaImpact.observe>[0]);
      if (game.tick > before) {
        input.consume({ ticks: game.tick - before, accepted: {
          attack: !!player && player.lastShotTick > before && player.saberReadyTick > readiness[0],
          force: !!player && player.lastShotTick > before && player.forceReadyTick > readiness[1],
          dash: !!player && player.dashReadyTick > readiness[2],
        } });
      }
      remaining -= dt / speed;
    }
    if (game.config?.mode === 'play' && game.status === 'playing' && !manualDeathHandled && !game.soldiers.some(s => s.id === game.control?.soldierId && s.alive)) {
      manualDeathHandled = true; setPaused(true);
      $('pauseReason').textContent = 'Your fighter died. Select a living teammate or watch the rest of the round.';
      announce($('pauseReason').textContent);
    }
  }
  updateVisualPuffs(elapsed * speed); updateCombatFeedback(elapsed); updateFightCallout(now); draw();
  recordDisplayFrame(now, rawElapsed, elapsed);
  if (appPhase === 'playing' && !paused) audio.tick(game);
  if (now - lastUI > 90 || game.status === 'ended') { updateUI(); lastUI = now; }
  if (toastUntil && now >= toastUntil) { $('orderToast').classList.remove('is-visible'); toastUntil = 0; }
  if (mutationUntil && now >= mutationUntil) { $('mutationBanner').hidden = true; mutationUntil = 0; }
  if (appPhase === 'playing') ensureFrame();
}
initializeMenu();
syncWorld(); buildPips(); resize(); updateUI();


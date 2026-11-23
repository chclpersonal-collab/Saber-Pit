/** Authored game choreography. Labels and balance values are game adaptations,
 * not claims that these exact combinations occur in canon or Legends. */
const freeze = <T,>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
// Paths are authored presentation cues, not new collision volumes or bonus hits.
const PATHS = {
  left_sweep: { plane: 'horizontal', direction: 1, chamber: -2.5, finish: 1.2, lean: 4, crouch: 1, depth: -3, footwork: 3, roll: -.08, twist: -.6, handHeight: 0, stance: 'wide' },
  right_sweep: { plane: 'horizontal', direction: -1, chamber: 2.4, finish: -1.3, lean: 2, crouch: 2, depth: 3, footwork: -3, roll: .08, twist: .6, handHeight: 2, stance: 'wide' },
  rising_diagonal: { plane: 'diagonal', direction: -1, chamber: 1.8, finish: -1.6, lean: 4, crouch: 4, depth: 2, footwork: 2, roll: -.12, twist: .4, handHeight: 4, stance: 'low' },
  falling_diagonal: { plane: 'diagonal', direction: 1, chamber: -2, finish: 1.4, lean: 5, crouch: 2, depth: -2, footwork: -2, roll: .13, twist: -.45, handHeight: -5, stance: 'high' },
  overhead: { plane: 'vertical', direction: 1, chamber: -1.8, finish: 1.8, lean: 5, crouch: 3, depth: 0, footwork: 1, roll: .16, twist: .1, handHeight: -7, stance: 'high' },
  low_return: { plane: 'diagonal', direction: -1, chamber: 2.7, finish: -.7, lean: 2, crouch: 5, depth: 3, footwork: -2, roll: -.1, twist: .5, handHeight: 6, stance: 'low' },
  direct_point: { plane: 'thrust', direction: 1, chamber: -.35, finish: .15, lean: 6, crouch: 1, depth: 0, footwork: 4, roll: .06, twist: -.2, handHeight: 0, stance: 'narrow' },
  outside_point: { plane: 'thrust', direction: -1, chamber: .85, finish: -.5, lean: 3, crouch: 2, depth: 4, footwork: -3, roll: -.07, twist: .6, handHeight: 3, stance: 'narrow' },
  inside_point: { plane: 'thrust', direction: 1, chamber: -1.1, finish: .7, lean: 4, crouch: 1, depth: -4, footwork: 3, roll: .07, twist: -.6, handHeight: -3, stance: 'narrow' },
  circular_return: { plane: 'horizontal', direction: -1, chamber: 3.5, finish: -2.4, lean: 2, crouch: 2, depth: 4, footwork: -4, roll: -.15, twist: .8, handHeight: 1, stance: 'pivot' },
  spiral_cut: { plane: 'diagonal', direction: 1, chamber: -3.6, finish: 2.5, lean: 3, crouch: 3, depth: -4, footwork: 4, roll: .18, twist: -.8, handHeight: -3, stance: 'pivot' },
  retreating_cut: { plane: 'diagonal', direction: -1, chamber: 1.4, finish: -1.1, lean: -3, crouch: 2, depth: 2, footwork: -4, roll: -.14, twist: .35, handHeight: 1, stance: 'retreat' },
};
const ORIGINAL_PATHS = {
  opening_sweep: 'left_sweep', crossing_cut: 'falling_diagonal', clearing_circle: 'circular_return',
  measured_thrust: 'direct_point', disengaging_point: 'outside_point', duelists_riposte: 'inside_point',
  shelter_circle: 'circular_return', close_return: 'low_return', patient_riposte: 'direct_point',
  vaulting_cut: 'rising_diagonal', corkscrew_return: 'spiral_cut', somersault_descent: 'overhead',
  returning_guard: 'inside_point', deflection_sweep: 'left_sweep', returning_edge: 'rising_diagonal',
  driving_counter: 'falling_diagonal', guard_breaker: 'right_sweep', descending_finish: 'overhead',
  converging_weave: 'outside_point', balanced_cross: 'left_sweep', opening_point: 'direct_point',
  relentless_flurry: 'left_sweep', broken_rhythm: 'low_return', fierce_finish: 'overhead',
  reversal_spiral: 'spiral_cut', returning_flurry: 'right_sweep', controlled_reversal: 'inside_point',
} as const;
type MovePath = keyof typeof PATHS;
const animation = (path: MovePath) => ({ path, ...PATHS[path] });
import type { JumpSpec } from './airborne.js';
interface MoveOptions {
  path?: MovePath; role?: string; damageMultiplier?: number; windupMultiplier?: number; recoveryMultiplier?: number;
  reachBonus?: number; energyCost?: number; arc?: number; staggerMultiplier?: number; pressure?: number;
  jump?: JumpSpec & {style: string; lateral: number; apex: number};
}
export type FormMotion = 'sweep' | 'thrust' | 'orbit' | 'leap' | 'redirect' | 'cleave' | 'weave' | 'flurry' | 'riposte';
const move = (id: string, name: string, motion: FormMotion, options: MoveOptions = {}) => ({ id, name, motion, damageMultiplier: 1, windupMultiplier: 1, recoveryMultiplier: 1, reachBonus: 0, energyCost: 8, arc: 1.2, staggerMultiplier: 1, pressure: 10, jump: null, ...options, animation: animation(options.path || ORIGINAL_PATHS[id as keyof typeof ORIGINAL_PATHS] || 'left_sweep') });
const jump = (durationTicks: number, height: number, distance: number, rotations = 1, recoveryTicks = 10, style = 'vault', lateral = 0, apex = .5) => ({ durationTicks, height, distance, rotations, recoveryTicks, style, lateral, apex, trajectory: style === 'side-aerial' ? 'side-vault' : style === 'low-bound' ? 'low-vault' : style === 'somersault' ? 'somersault' : 'somersault', lateralDistance: lateral, travelScale: style === 'side-aerial' ? .7 : 1, rotationAxis: style === 'corkscrew' ? 'yaw' : style === 'side-aerial' ? 'roll' : 'pitch', rollAxis: style === 'corkscrew' ? 'twist' : style === 'side-aerial' ? 'cartwheel' : 'somersault' });
export const FORM_MOVESETS = freeze({
  shii_cho: { id: 'shii_cho', identity: 'Broad control, simple linked cuts', comboSteps: [
    move('opening_sweep', 'Opening sweep', 'sweep', { arc: 2.1, reachBonus: 3 }),
    move('crossing_cut', 'Crossing cut', 'cleave', { damageMultiplier: 1.08, windupMultiplier: 1.1, pressure: 13 }),
    move('clearing_circle', 'Clearing circle', 'orbit', { arc: 2.7, energyCost: 10, recoveryMultiplier: 1.12, reachBonus: 5 }),
    move('low_clearing_return', 'Low clearing return', 'redirect', { path: 'low_return', energyCost: 7, damageMultiplier: .94, arc: 1.8 }),
    move('reverse_horizon', 'Reverse horizon', 'sweep', { path: 'right_sweep', energyCost: 9, arc: 2.3, recoveryMultiplier: 1.05 }),
    move('centerline_drop', 'Centerline drop', 'cleave', { path: 'overhead', energyCost: 10, damageMultiplier: 1.1, windupMultiplier: 1.15 })] },
  makashi: { id: 'makashi', identity: 'Economical point work and measured ripostes', comboSteps: [
    move('measured_thrust', 'Measured thrust', 'thrust', { reachBonus: 8, arc: .4, energyCost: 6 }),
    move('disengaging_point', 'Disengaging point', 'weave', { damageMultiplier: .85, windupMultiplier: .76, recoveryMultiplier: .82, energyCost: 6 }),
    move('duelists_riposte', "Duelist's riposte", 'riposte', { damageMultiplier: 1.2, reachBonus: 5, arc: .7, energyCost: 9, recoveryMultiplier: 1.12 }),
    move('rising_disengage', 'Rising disengage', 'weave', { path: 'rising_diagonal', energyCost: 6, damageMultiplier: .9, windupMultiplier: .85, arc: .8 }),
    move('retreating_point_cut', 'Retreating point cut', 'riposte', { path: 'retreating_cut', energyCost: 7, reachBonus: 3, recoveryMultiplier: .85 }),
    move('high_line_feint', 'High-line feint', 'redirect', { path: 'falling_diagonal', energyCost: 8, reachBonus: 4, damageMultiplier: 1.04, arc: .7 })] },
  soresu: { id: 'soresu', identity: 'Compact defense with patient return cuts', comboSteps: [
    move('shelter_circle', 'Shelter circle', 'orbit', { energyCost: 6, damageMultiplier: .9, arc: 1.4 }),
    move('close_return', 'Close return', 'redirect', { windupMultiplier: .8, reachBonus: -3, energyCost: 6, recoveryMultiplier: .9 }),
    move('patient_riposte', 'Patient riposte', 'thrust', { damageMultiplier: 1.14, arc: .6, energyCost: 8, windupMultiplier: 1.1 }),
    move('outside_guard_return', 'Outside guard return', 'redirect', { path: 'outside_point', energyCost: 6, damageMultiplier: .92, recoveryMultiplier: .85 }),
    move('high_shelter_cut', 'High shelter cut', 'cleave', { path: 'falling_diagonal', energyCost: 8, damageMultiplier: 1.02, windupMultiplier: 1.05 }),
    move('retreating_guard_cut', 'Retreating guard cut', 'riposte', { path: 'retreating_cut', energyCost: 7, damageMultiplier: .96, recoveryMultiplier: .9 })] },
  ataru: { id: 'ataru', identity: 'Force-assisted vaults, somersaults and rapid landings', dashJump: jump(42, 76, 110, 2, 12), comboSteps: [
    move('vaulting_cut', 'Vaulting cut', 'leap', { energyCost: 11, windupMultiplier: 1.75, recoveryMultiplier: 1.1, jump: jump(30, 44, 14, 1, 9), reachBonus: 5 }),
    move('corkscrew_return', 'Corkscrew return', 'riposte', { energyCost: 12, windupMultiplier: 1.95, recoveryMultiplier: 1.16, jump: jump(34, 57, 18, 1.5, 10, 'corkscrew', 10, .45), damageMultiplier: 1.08, arc: 2.4 }),
    move('somersault_descent', 'Somersault descent', 'cleave', { energyCost: 15, windupMultiplier: 2.3, recoveryMultiplier: 1.28, jump: jump(39, 70, 22, 2, 13, 'somersault', 0, .55), damageMultiplier: 1.24, pressure: 14 }),
    move('left_aerial_cut', 'Left aerial cut', 'sweep', { path: 'left_sweep', energyCost: 12, windupMultiplier: 1.85, recoveryMultiplier: 1.15, jump: jump(32, 46, 16, .75, 10, 'side-aerial', -16, .42), arc: 1.9 }),
    move('right_aerial_return', 'Right aerial return', 'redirect', { path: 'right_sweep', energyCost: 12, windupMultiplier: 1.9, recoveryMultiplier: 1.12, jump: jump(33, 50, 17, .75, 10, 'side-aerial', 16, .58), damageMultiplier: 1.04 }),
    move('skimming_lunge', 'Skimming lunge', 'thrust', { path: 'direct_point', energyCost: 10, windupMultiplier: 1.5, recoveryMultiplier: 1.05, jump: jump(26, 27, 21, 0, 8, 'low-bound', -7, .4), reachBonus: 6, arc: .6 }),
    move('grounded_low_return', 'Grounded low return', 'weave', { path: 'low_return', energyCost: 8, windupMultiplier: .9, recoveryMultiplier: .9, damageMultiplier: .94 }),
    move('retreating_snap_cut', 'Retreating snap cut', 'riposte', { path: 'retreating_cut', energyCost: 9, windupMultiplier: .95, recoveryMultiplier: .95, damageMultiplier: 1.02 })] },
  shien: { id: 'shien', identity: 'Redirecting guard and returning pressure', comboSteps: [
    move('returning_guard', 'Returning guard', 'redirect', { energyCost: 7, arc: 1.8 }),
    move('deflection_sweep', 'Deflection sweep', 'sweep', { arc: 2.2, reachBonus: 4, pressure: 13 }),
    move('returning_edge', 'Returning edge', 'riposte', { damageMultiplier: 1.16, energyCost: 10, recoveryMultiplier: 1.1 }),
    move('reverse_deflection', 'Reverse deflection', 'sweep', { path: 'right_sweep', energyCost: 8, arc: 2, damageMultiplier: .96 }),
    move('low_line_redirection', 'Low-line redirection', 'weave', { path: 'low_return', energyCost: 7, windupMultiplier: .9, recoveryMultiplier: .9 }),
    move('high_returning_cut', 'High returning cut', 'cleave', { path: 'falling_diagonal', energyCost: 10, damageMultiplier: 1.12, pressure: 13 })] },
  djem_so: { id: 'djem_so', identity: 'Heavy pressure and decisive counterattacks', comboSteps: [
    move('driving_counter', 'Driving counter', 'cleave', { damageMultiplier: 1.12, energyCost: 10, windupMultiplier: 1.1, pressure: 14 }),
    move('guard_breaker', 'Guard breaker', 'sweep', { damageMultiplier: 1.04, energyCost: 12, recoveryMultiplier: 1.18, staggerMultiplier: 1.3, pressure: 18 }),
    move('descending_finish', 'Descending finish', 'cleave', { damageMultiplier: 1.3, energyCost: 14, windupMultiplier: 1.3, recoveryMultiplier: 1.3, pressure: 16 }),
    move('rising_pressure', 'Rising pressure', 'riposte', { path: 'rising_diagonal', energyCost: 11, damageMultiplier: 1.1, pressure: 15, windupMultiplier: 1.1 }),
    move('cross_body_drive', 'Cross-body drive', 'sweep', { path: 'left_sweep', energyCost: 12, damageMultiplier: 1.12, recoveryMultiplier: 1.15, pressure: 16 }),
    move('braced_point', 'Braced point', 'thrust', { path: 'direct_point', energyCost: 10, damageMultiplier: 1.06, arc: .6, reachBonus: 4, windupMultiplier: 1.1 })] },
  niman: { id: 'niman', identity: 'Balanced sequences linked to Force opportunities', comboSteps: [
    move('converging_weave', 'Converging weave', 'weave', { energyCost: 6, recoveryMultiplier: .9 }),
    move('balanced_cross', 'Balanced cross', 'sweep', { arc: 1.8, energyCost: 7, damageMultiplier: .95 }),
    move('opening_point', 'Opening point', 'thrust', { reachBonus: 6, energyCost: 8, recoveryMultiplier: .8, pressure: 13 }),
    move('rising_balance', 'Rising balance', 'redirect', { path: 'rising_diagonal', energyCost: 7, damageMultiplier: .96, recoveryMultiplier: .9 }),
    move('reverse_link', 'Reverse link', 'sweep', { path: 'right_sweep', energyCost: 8, arc: 1.8, pressure: 11 }),
    move('spiraling_transition', 'Spiraling transition', 'orbit', { path: 'spiral_cut', energyCost: 9, damageMultiplier: 1.04, recoveryMultiplier: 1.05, arc: 2 })] },
  juyo: { id: 'juyo', identity: 'Relentless changing angles with expensive finishers', comboSteps: [
    move('relentless_flurry', 'Relentless flurry', 'flurry', { energyCost: 10, windupMultiplier: .8, pressure: 13 }),
    move('broken_rhythm', 'Broken rhythm', 'weave', { energyCost: 11, windupMultiplier: .7, damageMultiplier: .94, recoveryMultiplier: .9 }),
    move('fierce_finish', 'Fierce finish', 'cleave', { energyCost: 15, damageMultiplier: 1.27, recoveryMultiplier: 1.3, pressure: 18 }),
    move('reverse_rhythm', 'Reverse rhythm', 'flurry', { path: 'right_sweep', energyCost: 11, damageMultiplier: .98, windupMultiplier: .78, pressure: 14 }),
    move('rising_rupture', 'Rising rupture', 'riposte', { path: 'rising_diagonal', energyCost: 12, damageMultiplier: 1.12, pressure: 15 }),
    move('spiraling_press', 'Spiraling press', 'orbit', { path: 'spiral_cut', energyCost: 14, damageMultiplier: 1.18, recoveryMultiplier: 1.2, arc: 2.1, pressure: 17 })] },
  vaapad: { id: 'vaapad', identity: 'Controlled intensity and reversal sequences', comboSteps: [
    move('reversal_spiral', 'Reversal spiral', 'riposte', { energyCost: 10, arc: 2 }),
    move('returning_flurry', 'Returning flurry', 'flurry', { energyCost: 12, windupMultiplier: .8, damageMultiplier: 1.08, pressure: 14 }),
    move('controlled_reversal', 'Controlled reversal', 'redirect', { energyCost: 14, damageMultiplier: 1.22, recoveryMultiplier: 1.2, staggerMultiplier: 1.2 }),
    move('low_reversal', 'Low reversal', 'weave', { path: 'low_return', energyCost: 10, windupMultiplier: .85, damageMultiplier: .98 }),
    move('falling_reversal', 'Falling reversal', 'cleave', { path: 'falling_diagonal', energyCost: 13, damageMultiplier: 1.16, pressure: 15, recoveryMultiplier: 1.12 }),
    move('receding_spiral', 'Receding spiral', 'riposte', { path: 'circular_return', energyCost: 12, arc: 2.2, damageMultiplier: 1.08, recoveryMultiplier: 1.1 })] },
});
export type ClassicFormId = keyof typeof FORM_MOVESETS;
export type FormMove = ReturnType<typeof move>;
export interface CombatFormProfile {id: string; identity: string; comboSteps: FormMove[]; dashJump?: ReturnType<typeof jump>}
type FormSubject = string | {id?: string} | null | undefined;
export function combatFormProfile(form: FormSubject): CombatFormProfile { return FORM_MOVESETS[(typeof form === 'string' ? form : form?.id) as ClassicFormId] || FORM_MOVESETS.shii_cho; }
export function getFormMoves(form: FormSubject) { return combatFormProfile(form).comboSteps; }
export function selectFormMove(form: FormSubject, comboIndex = 0) { const moves = getFormMoves(form); const index = Number.isFinite(comboIndex) ? Math.max(0, Math.floor(comboIndex)) : 0; return moves[index % moves.length]; }
export function moveSummary(form: FormSubject) { return getFormMoves(form).map(move => move.name).join(' → '); }

// Resolve recorded IDs directly so renderers never reinterpret a saved move as a new one.
export function formMoveById(form: FormSubject, id: string) { return getFormMoves(form).find(move => move.id === id) || null; }

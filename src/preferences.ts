import type {StorageReader, StorageWriter} from './arcade-save-types.js';
/** Presentation preferences are independent of campaign state and deterministic RNG. */
export const PREFERENCES_KEY = 'trenchline-preferences-v1';
export const COLOR_SCHEMES = Object.freeze({
  classic: { name: 'Teal / coral', player: '#65c6b0', enemy: '#f18361', playerDark: '#235c51', enemyDark: '#794831' },
  contrast: { name: 'Blue / gold', player: '#69b9ff', enemy: '#ffc857', playerDark: '#244e78', enemyDark: '#795b20' },
  violet: { name: 'Violet / mint', player: '#c39bff', enemy: '#76e0b5', playerDark: '#5f397e', enemyDark: '#275b46' },
});
export type ColorScheme = keyof typeof COLOR_SCHEMES;
export interface PresentationPreferences { colors: ColorScheme; motion: 'system' | 'reduce'; effects: 'full' | 'minimal'; tacticalView: boolean; sound: boolean; speed: 1 | 2 | 4 }
export const DEFAULT_PREFERENCES: Readonly<PresentationPreferences> = Object.freeze({ colors: 'classic', motion: 'system', effects: 'full', tacticalView: false, sound: false, speed: 1 });
export function normalizePreferences(value: unknown): PresentationPreferences {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<PresentationPreferences> : {};
  return {
    colors: Object.hasOwn(COLOR_SCHEMES, v.colors!) ? v.colors! : 'classic',
    motion: ['system', 'reduce'].includes(v.motion!) ? v.motion! : 'system',
    effects: ['full', 'minimal'].includes(v.effects!) ? v.effects! : 'full',
    tacticalView: v.tacticalView === true, sound: v.sound === true,
    speed: [1, 2, 4].includes(v.speed!) ? v.speed! : 1,
  };
}
export function loadPreferences(storage?: StorageReader | null) {
  try { return normalizePreferences(JSON.parse((storage ?? globalThis.localStorage).getItem(PREFERENCES_KEY)!)); }
  catch { return { ...DEFAULT_PREFERENCES }; }
}
export function savePreferences(value: unknown, storage?: StorageWriter | null) {
  try { (storage ?? globalThis.localStorage).setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(value))); return true; }
  catch { return false; }
}

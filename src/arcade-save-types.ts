/** Wire-format and adapter contracts shared by the save, backup and quest modules. */
export interface StorageReader { getItem(key: string): string | null | undefined }
export interface StorageWriter extends StorageReader { setItem(key: string, value: string): void }
export interface SaveStorage extends StorageWriter { removeItem(key: string): void }

export type SaberForm = 'shii_cho' | 'makashi' | 'soresu' | 'ataru' | 'djem_so' | 'niman' | 'juyo';
export type FighterBody = 'woman' | 'femboy' | 'rabbit';
export type FighterGender = 'female' | 'male' | 'nonbinary';
export type SaberWeapon = 'single' | 'dual' | 'staff';
export type SaberGrip = 'forward' | 'backhand';
export type Doctrine = 'balanced' | 'aggressive' | 'defensive';
export type QuestOutcome = 'won' | 'lost' | 'draw';

export interface HeroGear {
  weapon?: SaberWeapon;
  grip?: SaberGrip;
  dualPhase?: boolean;
  forceFamily?: string;
}
export interface HeroAdaptation {
  bouts?: number;
  wins?: number;
  lastDoctrine?: Doctrine;
  observed?: Readonly<Record<string, number>>;
  variants?: Readonly<Partial<Record<Doctrine, {bouts: number; wins: number; score: number}>>>;
  loadouts?: {last?: {move?: string}};
}
/** Minimal accepted snapshot of a Hero from the Saved Heroes roster. */
export interface SavedHeroInput extends HeroGear {
  id: string;
  name: string;
  form?: SaberForm | null;
  body?: FighterBody | null;
  gender?: FighterGender | null;
  gear?: HeroGear;
  adaptation?: HeroAdaptation | null;
  profile?: HeroAdaptation | null;
  doctrine?: Doctrine;
  preferredMove?: string;
  sourceKind?: string;
  appearanceSeed?: number;
  elo?: number;
  eloFloorGrade?: string;
}
export interface BattleHero extends SavedHeroInput {
  form: SaberForm;
  body: FighterBody;
  gender: FighterGender;
  grade: 'SSS+V';
  appearanceSeed: number;
  weapon: SaberWeapon;
  grip: SaberGrip;
  dualPhase: boolean;
  forceFamily: string;
  doctrine: Doctrine;
  elo: number;
  eloFloorGrade: string;
  adaptation: HeroAdaptation | null;
}
export interface QuestResult {
  status: QuestOutcome;
  winnerIndex: 0 | 1 | null;
  reason: string;
  elapsed: number;
  kills: [number, number];
  deaths: [number, number];
}
export interface QuestResultInput {
  status?: QuestOutcome;
  winnerIndex?: 0 | 1 | null;
  reason?: string;
  elapsed?: number;
  kills?: number[];
  deaths?: number[];
}

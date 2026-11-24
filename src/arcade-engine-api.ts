/**
 * Typed contract for the current Arena core and its display consumers.
 * The core's still-migrating orchestrator owns all runtime normalization.
 * One boundary adapter prevents its incomplete inference from leaking
 * empty array types or unchecked values through every consumer.
 */
import {createArcade as create,stepArcade as step} from './arcade-engine.js?v=5.0.0';
import type {ArcadePoint,ArcadeBounds,ArcadeCover} from './arcade-engine-geometry.js';
import type {ArcadeInput,ArcadeOrder} from './arcade-engine-step.js';
import type {ArcadeRecord,ArcadeRoundStats,ArcadeTeamStats} from './arcade-engine-stats.js';
import type {ArcadeAirState} from './arcade-engine-air.js';
import type {SaberForm,FighterBody,FighterGender} from './arcade-save-types.js';
import type {arcadeFighterGear} from './arcade-loadouts.js';
import type {arcadeInjuryEffects,createArcadeInjuries} from './arcade-injuries.js';
import type {createArcadeObjective} from './arcade-objectives.js';
import type {progressionSummary} from './progression.js';

import type {ArcadeOptions,ArcadeConfig} from './arcade-engine-config.js?v=5.0.0';
export type {ArcadeInput,ArcadeOptions};
export {ARCADE_ATTACKS,ARCADE_AIR_STRIKES,ARCADE_TRAKATA_ID,ARCADE_FORMS,ARCADE_FORM_IDS,ARCADE_STAT_KEYS,arcadeMovesFor} from './arcade-engine.js?v=5.0.0';
export type ArcadeMode='duel'|'squad'|'watch'|'command';
export type ArcadeRule='elimination'|'control'|'relic';
export type ArcadePhase='playing'|'won'|'lost'|'draw';
export type ArcadeTeam=0|1;
export interface ArcadeAttackSpec {
  reach:number;arc:number;contact:number;duration:number;cost:number;
  damage:number;lunge:number;knock:number;recoil:number;
  expanded?:boolean;staff?:boolean;airStrike?:boolean;offhand?:ArcadeAttackSpec;
}
export interface ArcadeFighter extends ArcadePoint, ArcadeAirState {
  id:string;team:ArcadeTeam;slot:number;control:boolean;form:SaberForm;body:FighterBody;gender:FighterGender;
  appearanceSeed:number;
  alive:boolean;
  action:string;actionTime:number;actionDuration:number;attack:string|null;attackSpec:ArcadeAttackSpec|null;technique:string|null;
  vx:number;vy:number;kx:number;ky:number;radius:number;groundDistance:number;groundSpeed:number;
  energy:number;contact:boolean;offhandContact:boolean;parryTime:number;saberOff?:boolean;saberPhase:'short'|'long';
  gear:ReturnType<typeof arcadeFighterGear>;career:ReturnType<typeof progressionSummary>;moves:Record<string,number>;
  injuries:ReturnType<typeof createArcadeInjuries>;injuryEffects:ReturnType<typeof arcadeInjuryEffects>;stats:ArcadeRoundStats;
  fatalRegion?:string;fatalDirection?:'front'|'rear';
  circuitCuts:boolean;expandedCombat:boolean;
  heroId?:string;displayName?:string;heroElo?:number;heroEloFloorGrade?:string;heroPlan?:string;
  chessStyle?:'pawn'|'bishop'|'rook'|'knight'|'queen'|'king'|'none';chessPawn?:{promoted:boolean;streak:number};
  combatHabit?:'opening_reader'|'lane_builder'|'tempo_keeper';heroDoctrine?:string;
  bladeTurn?:number;spawn:ArcadePoint;
}
export interface ArcadeEvent extends ArcadePoint {
  id:number;kind:string;fighterId:string;team:ArcadeTeam;time:number;face:number;form:SaberForm;technique:string|null;
  targetId?:string;attackerId?:string;entryKind?:string;
  damage?:number;contact?:number;duration?:number;staminaGain?:number;
  region?:string;direction?:'front'|'rear';fatal?:boolean;perfect?:boolean;punish?:boolean;offhand?:boolean;
  punishReason?:string; route?:string; plan?:string; interrupted?:boolean;
  airStrike?:string; forceAbility?:string; attackVariant?:string;
  moveId?:string;effect?:string;jumpKind?:string;phase?:ArcadePhase;reason?:string;
}
export interface ArcadeGame {
  mode:ArcadeMode;width:number;height:number;round:number;time:number;tick:number;eventId:number;rng:number;limit:number;
  phase:ArcadePhase;endReason?:ArcadeRule|'timeout';order:ArcadeOrder;
  config:ArcadeConfig;fighters:ArcadeFighter[];events:ArcadeEvent[];stats:ArcadeTeamStats;
  bounds:ArcadeBounds;terrain:{id:string;bounds:ArcadeBounds;solids:(ArcadeCover&{kind:string})[];zones:(ArcadeCover&{kind:string})[]};
  objective:ReturnType<typeof createArcadeObjective>;
  records:{teams:[ArcadeRecord,ArcadeRecord];soldiers:(ArcadeRecord&{id:string;team:ArcadeTeam;slot:number;lane:number})[]};
}
interface ArcadeEngine {
  create(options?:ArcadeOptions):ArcadeGame;
  step<G extends ArcadeGame>(game:G,dt:number,input?:ArcadeInput):G;
}
const adapter={create,step} as unknown as ArcadeEngine;
export const createArcade=adapter.create;
export const stepArcade=adapter.step;

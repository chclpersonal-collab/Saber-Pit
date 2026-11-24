import type {ArcadeGame,ArcadeFighter,ArcadeEvent,ArcadeInput,ArcadeAttackSpec} from './arcade-engine-api.js?v=5.0.0';
import type {arcadeFootworkPlan} from './arcade-rank-footwork.js';
import type {progressionSummary,combatSkillProfile} from './progression.js';
import type {normalizeHeroTactics} from './arcade-hero-tactics.js';
import type {normalizeHeroLineup} from './arcade-heroes.js';
import type {environmentAt} from './environment.js';
import type {arcadeChessPawnStrike} from './arcade-chess-styles.js';
import type {arcadeBladeWorld,arcadeFeetWorld} from './arcade-fighters.js?v=5.0.0';
import type {arcadeEloSkill,ArenaReadSkill} from './arcade-elo-skill.js';
import type {ARCADE_TECHNIQUES} from './arcade-repertoire.js';
import type {ARCADE_RANK_COMBAT} from './arcade-engine-rank.js';
import type {ArcadeArchetype} from './arcade-engine-profile.js';
import type {ArcadeCover} from './arcade-engine-geometry.js';

export interface Point {x:number;y:number}
export type Cover=ArcadeCover&{kind:string;moveCost?:number};
type Doctrine='balanced'|'aggressive'|'defensive';
type Blade='primary'|'offhand'|'rear';
export interface BladeSegment { hand:Point;tip:Point }
interface Pose extends BladeSegment {
 kind:string;origin:Point;facing:number;offhand?: BladeSegment | null;freeHand?:Point;
 stride?:{kind:string;speed?:number;[field:string]:string|number|undefined};
 legs?:ReturnType<typeof arcadeFeetWorld>;
 body:{lean:number;bend:number;wide:number;torsoTurn:number;roll?:number;airPhase?:string;airProgress?:number;attackFamily?:string|null;rhythm?:number};
 momentum?:{main:(Point&{angle:number})|null;offhand:(Point&{angle:number})|null};
}
export type Technique=(typeof ARCADE_TECHNIQUES)[string];
export interface BladeCast {
 contact:number;reach:number;arc:number;damage:number;knock:number;recoil:number;
 blade?:Blade;backLane?:boolean;isOffhand?:boolean;bladeTurn?:number;bladePointX?:number;bladePointY?:number;unavailable?:boolean;
}
export interface SimMove extends Omit<ArcadeAttackSpec,'offhand'>, BladeCast {
 offhand?:BladeCast;
 id?:string;leadBlade?:'main'|'rear';mapAction?:string;effect?:string;forceAbility?:string;freeHand?:boolean;deflect?:boolean;launch?:boolean;air?:string;tactical?:string;rankSweep?:boolean;
 cap?:number;path?:string;lane?:string;chessStyle?:string;chessPromoted?:boolean;
}
type NumericOption='advancedReadyAt'|'aiJumpNextAt'|'attackSerial'|'baitBearing'|'baitUntil'|'balanceReadyAt'|'chainCarryUntil'|'chainDepth'|'chainRepeat'|'chessPawnRetreat'|'chessReviewAt'|'chessSwitchedAt'|'clashX'|'clashY'|'closeActionAt'|'composureAt'|'echoStepBearing'|'echoStepUntil'|'eliteRankEdge'|'eliteReady'|'engageAt'|'expandedReadyAt'|'exposedUntil'|'feintBearing'|'feintReadyAt'|'feintSerial'|'footworkReadyAt'|'forceAnchoredUntil'|'forcePoolReadyAt'|'forceVeiledUntil'|'groundBearing'|'groundPace'|'guardPressSerial'|'guardUntil'|'hazardDamage'|'heroExitReadyAt'|'jumpBearing'|'jumpDrive'|'jumpReadyAt'|'landedAt'|'lastEliteTouchAt'|'lastEliteTouchFrom'|'lastFeintSeen'|'lastForceAt'|'lastParryAt'|'matchGoalRating'|'matchGoalSampleAt'|'matchGoalSince'|'parryCounterUntil'|'perfectParryReadyAt'|'poseEntryDuration'|'poseEntryOffset'|'pressureRecoverAt'|'rankDeflectAt'|'rankReadCount'|'reactedTo'|'repertoireReadyAt'|'riposteSerial'|'saberPhaseChangedAt'|'saberPhaseReadyAt'|'staffCommitments'|'staminaHitSerial'|'stasisUntil'|'stepBearing'|'stepUntil'|'trakataIgnitedAt'|'trakataReadyAt'|'wardCharges'|'wardUntil';
type BooleanOption='aiAirEntryUsed'|'aiVaultUsed'|'airStrikeSpent'|'awarenessFacing'|'clashOffhand'|'continuousCombat'|'crossfire'|'eliteEngaged'|'guardDirected'|'impactPhysics'|'liveEntry'|'loadoutChosen'|'localRead'|'peasantMotion'|'recoveryFlow'|'staffLanded'|'stanceFlow'|'styleChoreo'|'styleTravel';
type StringOption='aiJumpPurpose'|'airStrike'|'attackFamily'|'attackVariant'|'chainFrom'|'chessBaseStyle'|'clashBlade'|'clashRole'|'counterTarget'|'exposedBy'|'falseLineTarget'|'feintFollowup'|'lastEliteTouchBy'|'lastFeintFoe'|'lastReadSerial'|'readFeint'|'riposteTarget'|'staffLead'|'tournamentMove'|'heroEloFloorGrade';
type AttackChoice={id:string;family:string};
export interface SimFighter extends Omit<ArcadeFighter,'attackSpec'|'chessStyle'|'chessPawn'|'airRequest'|'heroEloFloorGrade'|'heroPlan'|'spawn'|'injuries'>,
 Partial<Record<NumericOption,number>>, Partial<Record<BooleanOption,boolean>>, Partial<Record<StringOption,string|null>> {
 motionLinkedHit?:boolean;
 motionLinkedBlock?:boolean;
 motionAirCarry?:boolean;
 attackSpec:SimMove|null;
 archetype:ArcadeArchetype;formRules:boolean;
 career:ReturnType<typeof progressionSummary>;skill:ReturnType<typeof combatSkillProfile>;rankCombat:(typeof ARCADE_RANK_COMBAT)[number];
 gear:ArcadeFighter['gear'];weaponFlow:boolean;
 guardBearing:number|null;guardHeld:boolean;guardLane:'left'|'right'|'center';guardLock:number;
 guardRead?:'ready'|'held'|null;parryTime:number;invuln:number;
 think:number;decision:'guard'|null;buffer:{type:string;until:number;clashStrike?:true}|null;
 combo:number;counterUntil:number;counterMove:boolean;targetId:string|null;targetUntil:number;
 contributors:{id:string;time:number;damage:number}[];
 rankDominance:number;feintRedirect?:number|null;spawn?:Point;
 injuries:Parameters<typeof import('./arcade-injuries.js').arcadeInjuryEffects>[0];
 rankFootwork?:ReturnType<typeof arcadeFootworkPlan>|null;
 advancedTravel?:{id:string;until:number}|null;
 advancedTravelStart?:(Point&{id:string})|null;
 airRequest?:{until:number;aim:number}|null;
 attackChoices?:AttackChoice[];attackDrive?:Point;
 chessStyle?:string;chessPawn?:ReturnType<typeof arcadeChessPawnStrike>;chessPawnPending?:number|null;
 clashFrom?:(BladeSegment&{offhand:boolean;bladeId:Blade})|null;
 closeAlternate?:{id:string;at:number}|null;
 eloSkill?:ReturnType<typeof arcadeEloSkill>;
 arenaReadSkill?:ArenaReadSkill;
 arenaPattern?:{rival:string;serial:number;time:number;patterns:{family:string}[]};
 guardLaneChange?:{target:string;readAt:number;until:number;bearing:number};
 heldGuardOpening?:{target:string;guardStart:number;at:number;serial:number;count:number}|null;
 heroAdaptation?:ReturnType<typeof normalizeHeroTactics>;
 heroPlan?:Doctrine;heroDoctrine?:Doctrine;
 heroExit?:(Point&{until:number;angle:number})|null;
 impactReaction?:{at:number;bearing:number;strength:number;kind:string};
 impactRecovery?:{at:number;impactAt:number;duration:number;kind:string;bearing:number;strength:number;target:string;serial:number|undefined;last?:AttackChoice;followup?:string};
 landingDrive?:Point;
 lastGuardParry?:{by:string;at:number;family?:string;deflect:boolean};
 lastOpponentMove?:string;
 lastRatedRead?:{time:number;remaining:number;family:string;choice:string};
 liveAim?:{serial:number;base:number;target:number;until:number};
 masterRoute?:{tx:number;ty:number;until:number;points:Point[];blocked?:boolean};
 matchGoal?:'win'|'draw';
 nextExchange?:{target:string;serial:number|undefined;expires:number;heavy:boolean}|null;
 orderAnchor?:Point;
 poseFrom?:Pose|null;
 rearHit?:{id:string;readyAt:number;expires:number};
 recentMistakes?:number[];
 releaseOutcome?:'pending'|'guarded'|'landed'|'miss'|'parried'|null;
 route?:(Point&{until:number})|null;
 staffTouched?:Set<string>|null;
 trakataAim?:number|null;
}
export interface SimGame extends Omit<ArcadeGame,'fighters'|'terrain'|'events'> {
 fighters:SimFighter[];
 events:(ArcadeEvent&{weapon?:string;grip?:string;saberPhase?:string;chessStyle?:string;chessPromoted?:boolean})[];
 terrain:{id:string;bounds:ArcadeGame['bounds'];solids:Cover[];zones:Cover[]};
 formRules:boolean;heroLineup:ReturnType<typeof normalizeHeroLineup>;
 playerForm:ArcadeFighter['form'];playerBody:ArcadeFighter['body'];playerArchetype:ArcadeArchetype;
 pressure:number;weather:ReturnType<typeof environmentAt>|null;weatherSeed:number;eliteCrossfire?:boolean;
 elitePacing?:{active:boolean;stage:string;fullAt:number;measuredUntil:number;injuryCapUntil?:number}|null;
 liveByTeam?:[number,number];edges:Partial<ArcadeInput>;
}
export interface SimCommand extends Omit<ArcadeInput,'strike'|'heavy'|'guard'|'dash'|'feint'|'force'> {
 strike?:boolean|'';heavy?:boolean|'';guard?:boolean|'';dash?:boolean|'';feint?:boolean|'';force?:boolean|'';
 aim?:number;guardAim?:number|null;rollFace?:number;
 trakata?:boolean|'';pressureRecover?:boolean;
 evasion?:string|null;activeJump?:{bearing:number;purpose:string;aim?:number}|null;airEntry?:boolean;
 advanced?:{move:string;trigger:string}|null;chain?:string|null;
 expandedMove?:string|null;expandedAim?:number;
 rankFootwork?:{id:string;side:number;face:number}|null;
}
export interface LocalPressure {
 threats:{o:SimFighter;d:number;angle:number;time:number}[];
 imminent:LocalPressure['threats'];closest:number;
}

/** Baseline archetypes, form-specific move tables, and the vertical contact envelope. */
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=3.1.0';

type FormStats={speed:number;pressure:number;wind:number;orbit:number;guardAI:number;parry:number;arc:number;reach:number;tempo:number;guardCost:number;comboCap:number};
export type ArcadeForm=keyof typeof ARCADE_FORMS;
export type ArcadeArchetype=keyof typeof archetypes;
interface CutTarget { airHeight?: number }
interface CutActor extends CutTarget { action: string; technique?: string | null; attack?: string | null }
interface ContactHeightSpec { effect?: string; freeHand?: boolean; blade?: string; airStrike?: boolean; launch?: boolean; backLane?: boolean }

export const archetypes = {
  vanguard:{speed:192, heavy:'sweep', pressure:102, wind:.10},
  duelist:{speed:225, heavy:'rush', pressure:79, wind:.07},
  warden:{speed:175, heavy:'uppercut', pressure:86, wind:.14},
};
const fitted = <T extends FormStats>(name: string, description: string, heavy: string, stats: T) => Object.freeze({name,label:name,description,heavy,...stats});
export const ARCADE_FORMS = Object.freeze({
  shii_cho:fitted('Shii-Cho','Wide cuts catch multiple enemies; broad, steady and good for crowds.', 'wide_cut', {speed:189,pressure:105,wind:.104,orbit:.42,guardAI:.44,parry:.155,arc:1.33,reach:1,tempo:1.04,guardCost:1,comboCap:3}),
  makashi:fitted('Makashi','A narrow lunge for precise duels, quick footwork and measured distance.', 'thrust', {speed:224,pressure:115,wind:.077,orbit:.72,guardAI:.48,parry:.14,arc:.61,reach:1.14,tempo:.92,guardCost:1.04,comboCap:3}),
  soresu:fitted('Soresu','Compact cuts, efficient guard, and a wide window to deflect incoming blades.', 'deflect', {speed:177,pressure:72,wind:.091,orbit:.60,guardAI:.78,parry:.236,arc:.90,reach:.87,tempo:1.08,guardCost:.60,comboCap:2}),
  ataru:fitted('Ataru','An acrobatic vault and quick sidesteps close gaps; defense is less efficient.', 'vault', {speed:238,pressure:112,wind:.055,orbit:1.18,guardAI:.23,parry:.112,arc:.97,reach:.98,tempo:.88,guardCost:1.28,comboCap:3}),
  djem_so:fitted('Djem So','Heavy countercuts deal more damage after a successful block or parry.', 'riposte', {speed:174,pressure:84,wind:.114,orbit:.32,guardAI:.70,parry:.172,arc:1.05,reach:.98,tempo:1.13,guardCost:.81,comboCap:3}),
  niman:fitted('Niman','Steady saber work and a short cone-shaped Force push that creates space.', 'force', {speed:197,pressure:126,wind:.11,orbit:.56,guardAI:.50,parry:.16,arc:1,reach:1,tempo:1,guardCost:.92,comboCap:3}),
  juyo:fitted('Juyo','Relentless four-hit sequences and fast pressure, at the cost of a weaker guard.', 'frenzy', {speed:216,pressure:89,wind:.049,orbit:.35,guardAI:.23,parry:.098,arc:1.12,reach:1.02,tempo:.81,guardCost:1.37,comboCap:4}),
});
export const ARCADE_FORM_IDS = Object.freeze(Object.keys(ARCADE_FORMS));
export const legacyForm = {vanguard:'shii_cho',duelist:'makashi',warden:'djem_so'};
export const profile = (f: {formRules: boolean; form: ArcadeForm; archetype: ArcadeArchetype}): {speed:number;pressure:number;wind:number;heavy:string}&Partial<FormStats> => f.formRules ? ARCADE_FORMS[f.form] : archetypes[f.archetype];
export const ARCADE_ATTACKS = Object.freeze({
  slash:Object.freeze({duration:.285,contact:.108,reach:88,arc:1.12,damage:16,cost:7,lunge:300,knock:120,recoil:.18}),
  slash2:Object.freeze({duration:.265,contact:.100,reach:92,arc:1.40,damage:18,cost:8,lunge:320,knock:148,recoil:.19}),
  slash3:Object.freeze({duration:.365,contact:.145,reach:107,arc:1.22,damage:23,cost:11,lunge:391,knock:221,recoil:.27}),
  rush:Object.freeze({duration:.435,contact:.223,reach:88,arc:.69,damage:31,cost:25,lunge:790,knock:310,recoil:.33}),
  sweep:Object.freeze({duration:.545,contact:.293,reach:126,arc:2.12,damage:28,cost:24,lunge:294,knock:257,recoil:.35}),
  slash4:Object.freeze({duration:.405,contact:.134,reach:104,arc:1.20,damage:26,cost:13,lunge:410,knock:225,recoil:.27}),
  thrust:Object.freeze({duration:.41,contact:.187,reach:143,arc:.40,damage:31,cost:22,lunge:565,knock:182,recoil:.28}),
  wide_cut:Object.freeze({duration:.57,contact:.303,reach:123,arc:2.46,damage:28,cost:24,lunge:280,knock:249,recoil:.31}),
  deflect:Object.freeze({duration:.37,contact:.248,reach:79,arc:.87,damage:19,cost:13,lunge:164,knock:149,recoil:.19}),
  vault:Object.freeze({duration:.50,contact:.247,reach:107,arc:1.29,damage:27,cost:24,lunge:633,knock:267,recoil:.29}),
  riposte:Object.freeze({duration:.53,contact:.274,reach:106,arc:1.29,damage:29,cost:24,lunge:381,knock:288,recoil:.29}),
  force:Object.freeze({duration:.59,contact:.279,reach:173,arc:.83,damage:13,cost:31,lunge:0,knock:700,recoil:.36}),
  frenzy:Object.freeze({duration:.42,contact:.194,reach:116,arc:1.54,damage:29,cost:25,lunge:532,knock:236,recoil:.28}),
  uppercut:Object.freeze({duration:.435,contact:.213,reach:85,arc:1.04,damage:26,cost:23,lunge:480,knock:238,recoil:.55}),
});
// Arcade timings keep a recognisable windup, release and return even at elite
// grades. The lunge component is a planted step, not persistent locomotion.
export const styleTimings=Object.freeze({
  slash:[.57,.218,152],slash2:[.60,.245,146],slash3:[.71,.282,173],slash4:[.69,.267,171],
  thrust:[.69,.284,223],wide_cut:[.92,.405,118],deflect:[.72,.315,82],
  vault:[.92,.428,290],riposte:[.88,.363,154],force:[.84,.379,0],frenzy:[.71,.302,188],
});
export const quickCounter=[.70,.270,171];
export const art = (name: string) => name.startsWith('slash')?'slash':(({thrust:'rush',vault:'rush',riposte:'uppercut',deflect:'slash',frenzy:'sweep',wide_cut:'sweep'} as Record<string,string>)[name]??name);
// Gameplay depth envelope, not screen-space sprite overlap. Only a real
// difference in physical height can clear a low blade; Force and rising
// strikes still reach a visible flip when their horizontal line is valid.
export function arcadeContactHeight(attacker: CutActor,target: CutTarget,spec: ContactHeightSpec={}){
  const difference=(target.airHeight??0)-(attacker.airHeight??0);
  if(attacker.action==='force')return Math.abs(difference)<=(spec.effect==='arcWave'?23:88);
  if(spec.freeHand)return Math.abs(difference)<=23;
  const blade=spec.blade;
  const travel=attacker.action;
  const airMove=spec.airStrike||(attacker.technique!=null&&ARCADE_TECHNIQUES[attacker.technique]?.air)||attacker.attack==='vault';
  const raised=travel==='uppercut'||spec.launch===true;
  const low=travel==='sweep'&&!raised;
  const above=raised?71:airMove?62:low?31:travel==='rush'?46:49;
  const below=airMove?72:low?51:58;
  return difference<=((spec.backLane??blade==='rear')?above-3:above)&&difference>=-below;
}

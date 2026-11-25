type Id=string|number;
type LabelOptions={airStrike?:string;forceAbility?:string;attackVariant?:string};
type Cue={label:string;style:string;tone:string;life:number;key:string;priority:number};
type CalloutEvent=LabelOptions & {kind:string;id:number;fighterId?:Id;region?:string;perfect?:boolean;staminaRestored?:number;
 punish?:boolean;interrupted?:boolean;moveId?:string;footwork?:string;phase?:string;jumpKind?:string;technique?:string|null;
 contact?:number;offhand?:boolean;expanded?:boolean;chessStyle?:string;chessPromoted?:boolean};
type Fighter={id:Id;chessStyle?:string;chessPawn?:{promoted?:boolean};control?:boolean};
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=3.1.0';
import {arcadeExpandedMoveById} from './arcade-expanded-combat.js?v=3.1.0';
import {ARCADE_AIR_STRIKES} from './arcade-air-gameplay.js?v=2.25.3';
import {ARCADE_CHESS_STYLES} from './arcade-chess-styles.js?v=2.44.0';
import {ARCADE_RANK_FOOTWORK} from './arcade-rank-footwork.js?v=2.27.0';
import {ARCADE_BODY_REGIONS} from './arcade-injuries.js?v=2.9.0';

const attacks={slash:'Opening Cut',slash2:'Reverse Cut',slash3:'Finishing Cut',slash4:'Fourth Cut',
 rush:'Rush Cut',sweep:'Sweep',uppercut:'Rising Cut',thrust:'Linear Thrust',wide_cut:'Wide Sweep',
 deflect:'Guard Riposte',vault:'Acrobatic Vault',riposte:'Power Counter',force:'Force Cast',frenzy:'Ferocity Chain',offhand:'Offhand Cut',guard_break:'Guard Break'};
const powers={force_push:'Push',force_pull:'Pull',force_burst:'Burst',force_pulse:'Pulse',
 force_stasis:'Anchor',force_ward:'Lattice',push:'Push',pull:'Pull',stasis:'Anchor',ward:'Lattice'};
const jumpNames={wheel:'Wheel Jump',line:'Line Jump',compact:'Compact Jump',corkscrew:'Corkscrew',
 crossflip:'Crossflip',bound:'Bound',drift:'Drift Jump',pounce:'Pounce'};
const actions=new Set(['slash','rush','sweep','uppercut','force','free_hand']);
const regions=Object.fromEntries(ARCADE_BODY_REGIONS.map(row=>[row.id,row.label]));
const footwork=Object.fromEntries(ARCADE_RANK_FOOTWORK.map(row=>[row.id,row.label]));
const aerial=Object.fromEntries(Object.values(ARCADE_AIR_STRIKES).map(row=>[row.id,row.label]));
const get=<T>(catalog:Readonly<Record<string,T>>,id:unknown):T|undefined=>typeof id==='string'&&Object.hasOwn(catalog,id)?catalog[id]:undefined;
const upper=(label:string|undefined|null)=>label?.toUpperCase();
const ordinaryLane={slash:'inside',slash2:'outside',slash3:'inside',slash4:'outside'};
export function combatMoveLabel(id:string|null|undefined,{airStrike,forceAbility,attackVariant}:LabelOptions={}){
 const move=get(ARCADE_TECHNIQUES,id),extended=arcadeExpandedMoveById(id!,{forceVariants:true});
 const exact=get(aerial,airStrike)??get(aerial,id)??move?.label??move?.name??extended?.label??
   get(powers,forceAbility)??get(powers,id);
 if(exact)return exact;
 const base=get(attacks,id);
 if(!base)return null;
 // Normal combo stages already describe their authored direction. A tag only
 // qualifies an unnamed move when the engine really chose a different lane.
 if((attackVariant==='inside'||attackVariant==='outside')&&attackVariant!==get(ordinaryLane,id))
   return (attackVariant==='inside'?'Inside ':'Outside ')+base;
 return base;
}
/** Only the Pawn promotion earns a subline; other chess styles stay off the fight screen. */
function styleFor(event:CalloutEvent,f?:Fighter|null){
 const recorded=Object.hasOwn(event,'chessStyle')&&typeof event.chessStyle==='string';
 const style=ARCADE_CHESS_STYLES[recorded?event.chessStyle!:(f?.chessStyle??"")];
 const promoted=recorded?event.chessPromoted===true:f?.chessPawn?.promoted===true;
 return style?.id==='pawn'&&promoted?'PAWN → QUEEN':'';
}
export function combatCallout(event:CalloutEvent,f?:Fighter|null,focus=false):Cue|null{
 const kind=event.kind;
 const cue=(label:string|undefined|null,priority:number,tone=kind,style='',life?:number):Cue=>({label:upper(label)!,priority,tone,style,
   life:life??(priority>=5?.90:priority>=3?.70:.55),key:kind+':'+label+':'+(event.fighterId??'')});
 if(kind==='chess_style'){
   const style=styleFor(event,null);
   return style?cue(style,3,'style'):null;
 }
 if(kind==='ko')return cue(regions[event.region!]?'KO · '+regions[event.region!]:'Knockout',5);
 if(kind==='stamina_hit')return null; // the same blade already has an impact cue
 if(kind==='parry'){
   const amount=event.perfect&&event.staminaRestored!>0?Math.round(event.staminaRestored!*10)/10:0;
   return cue(event.perfect?'Perfect Parry'+(amount?' +'+amount+' STA':''):'Parry',4);
 }
 if(kind==='clash')return cue('Blade Clash',4);
 if(kind==='break')return cue('Guard Break',4);
 if(event.punish&&['hit','launch'].includes(kind))return cue('Punish',3,'punish');
 if(kind==='riposte')return cue('Riposte',3);
 if(kind==='rank_deflect')return cue('Deflect',3);
 if(kind==='read')return cue('Blade Read',3);
 if(kind==='trakata_on'&&!event.interrupted)return cue('Tràkata',3);
 if(kind==='ally_blocked')return focus?cue('Ally in the Way',3):null;
 if(kind==='launch')return cue('Launched',3);
 if(kind==='expanded_release'){
   const move=arcadeExpandedMoveById(event.moveId!,{forceVariants:true});
   return move?cue(combatMoveLabel(event.moveId),2,'move'):null;
 }
 if(kind==='rank_footwork'&&footwork[event.footwork!])return cue(footwork[event.footwork!],2,'move');
 if(kind==='saber_phase'&&['long','short'].includes(event.phase!))
   return cue(event.phase==='long'?'Long Blade':'Short Blade',2,'move');
 if(kind==='jump'&&event.jumpKind)return cue(get(jumpNames,event.jumpKind)??'Jump',1,'move');
 if(kind==='dash'){
   const movement={sidestep:'Sidestep',backstep:'Backstep',vault_step:'Vault Step'};
   return cue(get(movement,event.technique)??'Dash',1,'move');
 }
 if(kind==='opponent_read')return cue('Guard Read',3,'move','FEINT');
 if(kind==='feint')return cue('Feint',1,'move');
 if(kind==='block')return focus?cue('Block',2):null;
 // Positive engine contact identifies a committed windup; offhand release
 // aliases and hit/round/plan events cannot masquerade as commitments.
 if(actions.has(kind)&&event.contact!>0&&!event.offhand&&!event.expanded){
   const move=get(ARCADE_TECHNIQUES,event.technique);
   const label=combatMoveLabel(event.technique,event);
   if(!label)return null;
   const style=kind==='force'?'':styleFor(event,f);
   const meaningful=Boolean(move||get(aerial,event.airStrike)||get(aerial,event.technique)||get(powers,event.forceAbility)||get(powers,event.technique));
   return cue(label,meaningful?2:1,'move',style);
 }
 return null;
}
/** A single overlay: retain important results through an attack flood, and
 * rate-limit lower-priority action chatter rather than queue stale captions. */
export function createCombatCallouts(){
 let last=0,until=0,shownAt=0,time=0;
 let current:Cue|null=null;
 const recent=new Map<string,number>(), promoted=new Set<Id>();
 return {
   reset(){last=time=until=shownAt=0;current=null;recent.clear();promoted.clear();},
   advance(dt:number,events:readonly CalloutEvent[],fighters:readonly Fighter[],{focusId,crowd=fighters.length>6}:{focusId?:Id;crowd?:boolean}={}){
     time+=Number.isFinite(dt)?Math.max(0,Math.min(dt,.25)):0;
     if(current&&time>=until)current=null;
     if(!events.length||events.at(-1)!.id<=last)return current;
     const lookup=new Map(fighters.map(f=>[f.id,f]));
     const options:{cue:Cue;focus:boolean}[]=[];
     for(const e of events){
       if(!Number.isFinite(e.id)||e.id<=last)continue;
       last=e.id;
       const f=lookup.get(e.fighterId!),focus=f?.control===true||e.fighterId===focusId;
       const cue=combatCallout(e,f,focus);
       if(cue&&(!crowd||cue.priority>=4||focus))options.push({cue,focus});
       if(f?.chessStyle==='pawn'&&f.chessPawn?.promoted&&!promoted.has(f.id)&&['hit','launch'].includes(e.kind)){
         promoted.add(f.id);
         if(!crowd||focus)options.push({cue:{label:'PAWN PROMOTED',style:'PAWN → QUEEN',priority:4,tone:'promotion',
          life:.88,key:'promotion:'+f.id},focus});
       }
     }
     for(const [key,end] of recent)if(time>=end)recent.delete(key);
     options.sort((a,b)=>b.cue.priority-a.cue.priority||Number(b.focus)-Number(a.focus));
     const candidate=options.find(({cue})=>!recent.has(cue.key)&&(!current||
       cue.priority>current.priority&&time-shownAt>=.10||cue.priority===5&&current.priority<5))?.cue;
     if(candidate){
       current=candidate;shownAt=time;until=time+candidate.life;
       recent.set(candidate.key,time+(candidate.priority<=2?1.25:1.00));
     }
     return current;
   },
 };
}
export function paintCombatCallout(element:HTMLElement,cue:Cue|null){
 if(!cue){if(!element.hidden)element.hidden=true;return;}
 if(element.textContent!==cue.label||element.dataset.style!==cue.style||element.dataset.kind!==cue.tone){
   element.textContent=cue.label;element.dataset.style=cue.style;element.dataset.kind=cue.tone;
 }
 if(element.hidden)element.hidden=false;
}

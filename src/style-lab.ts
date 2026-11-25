import type {StyleLabElements} from './game-dom.js';
import type {SaberForm} from './arcade-save-types.js';
import type {ArcadeEvent,ArcadeFighter,ArcadeOptions} from './arcade-engine-api.js?v=5.0.0';
type LabStyle = 'king'|'queen'|'rook'|'bishop'|'knight'|'pawn';
type LabDrill = 'strike'|'walk'|'jump';
type Move = {id:string;name:string;reach:number;arc:number;mapAction?:string;kind?:string};
type LabOptions = {style?:string;form?:string;technique?:string;weapon?:string;drill?:string;slot?:number;customDegrees?:number|null;entry?:string;range?:number;stance?:string;defense?:string;fromBearing?:number|null};
type Timing = {reach:number;windupMs:number;afterReleaseMs:number;stamina:number};
type LabResult = {id:string;label:string};
type ReleaseWindow = {lane:boolean;angle:boolean;distance:number;reach:number};
type LabState = {phase:'jumping'|'walking'|'turning'|'striking'|'recovering'|'done';
 elapsed:number;remainder:number;committed:boolean;lastId:number;outcome:LabResult|null;window:ReleaseWindow|null;settleAt:number|null;
 previous?:ReturnType<typeof fighterSamples>;jumpKind?:string;jumpPeak?:number;jumpLabel?:string;
 timing?:Timing;title?:string;startedFrom?:string|null;damage?:number;knockbackDistance?:number;hitOrigin?:{x:number;y:number;measureAt:number}
};
type LabRound = ReturnType<typeof createStyleLabRound>;
type CompareOptions = LabOptions & {slot:number;style:LabStyle;weapon:string};
type ComparisonPane = {round:LabRound;fx:ReturnType<typeof createArcadeFX>;waves:ReturnType<typeof createArcadeSwingWaves>;stage:ReturnType<typeof createArcadeStage>};
import {arcadeExpandedMovesFor} from './arcade-expanded-combat.js?v=3.1.0';
import {ARCADE_SABER_OPTIONS} from './arcade-loadouts.js?v=3.1.0';
import {fighterSamples,displayFighters} from './arcade-display.js?v=2.44.0';
import {createArcadeSwingWaves} from './arcade-swing-waves.js?v=3.2.0';
import {ARCADE_MOTION_KEY,readArcadeReducedMotion} from './arcade-motion-preference.js?v=2.43.0';
import {createArcade,stepArcade,ARCADE_FORMS,arcadeMovesFor} from './arcade-engine-api.js?v=5.0.0';
import {ARCADE_CHESS_STYLES,arcadeChessAllowsLane,arcadeChessMove,normalizeArcadeChessStyle} from './arcade-chess-styles.js?v=2.44.0';
import {createArcadeStage,drawArcadeStage} from './arcade-stage.js?v=4.0.0';
import {drawArcadeFighter} from './arcade-painter.js?v=5.0.0';
import {sampleArcadeFighter,arcadeBladeWorld} from './arcade-fighters.js?v=5.0.0';
import {createArcadeFX} from './arcade-fx.js?v=4.0.0';
import {combatCallout} from './arcade-callouts.js?v=3.1.0';

const W=960,H=540, CX=480,CY=318,TICK=1/120, STEP_DT=1/240, TURN_TIME=.48, SETTLE_TIME=.22;
const styles:readonly LabStyle[]=['king','queen','rook','bishop','knight','pawn'];
const labels=['East','Southeast','South','Southwest','West','Northwest','North','Northeast'];
export const STYLE_LAB_BEARINGS=Object.freeze(labels.map((label,i)=>Object.freeze({label,angle:i*Math.PI/4})));
const clamp=(n:number,l:number,h:number)=>Math.max(l,Math.min(h,n));
const wrap=(n:number)=>((n%8)+8)%8;
const delta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const normalizedDegrees=(n:number)=>{const x=n%360;return x<0?x+360:x||0;};
const entryNames:Record<string,string|undefined>={advance:'on the advance',retreat:'on the retreat',lateral:'out of a side step',guard:'out of guard',pivot:'during a pivot'};
const bearingName=(r:Pick<LabRound,'customDegrees'|'slot'>)=>r.customDegrees===null?STYLE_LAB_BEARINGS[r.slot].label:((Math.round(r.customDegrees*1000)/1000)%360)+'°';
const travelNotes={
 king:['Tight Pivot','Free Travel'],queen:['Wide Turn','Free Travel'],rook:['Free Travel','Straight'],
 bishop:['Free Travel','Diagonal'],knight:['Free Travel','Flank'],pawn:['Free Travel','Short Forward'],
};
const styleHints:Record<string,string>={king:'Short reach, broad cut',queen:'Turn to face any bearing',rook:'Longest reach on straight lanes',bishop:'Reach across diagonal lanes',knight:'Full reach from a flank',pawn:'Short forward strike'};
/** Facts in a row: separate v6-meta spans instead of a "·" chain. */
function meta(el:HTMLElement,...parts:readonly(string|number|false|null|undefined)[]){
 el.replaceChildren(...parts.filter(p=>p!==false&&p!==null&&p!==undefined&&p!=='').flatMap((p,i)=>{const s=document.createElement('span');s.className='v6-meta';s.textContent=String(p);return i?[' ',s]:[s];}));
}
const startingRange={king:68,queen:108,rook:100,bishop:92,knight:80,pawn:65};
const formOf=(id:unknown):SaberForm=>Object.hasOwn(ARCADE_FORMS,id as PropertyKey)?id as SaberForm:'shii_cho';
const selectedMoves=(form:SaberForm):Move[]=>arcadeMovesFor(form,14,{tactical:true,rankCuts:true,circuitCuts:true,arenaCuts:true,exchangeVariety:true,minorMoves:true}).filter((m:Move)=>m.mapAction!=='force');
const selectedStyle=(id:unknown):LabStyle=>styles.includes(normalizeArcadeChessStyle(id) as LabStyle)?id as LabStyle:'queen';
export function styleLabMoveList(form:unknown,kit='single',family='saber'):Move[]{
 if(family==='saber')return selectedMoves(formOf(form));
 const weapon=ARCADE_SABER_OPTIONS.find(o=>o.id===kit)?.weapon;
 return arcadeExpandedMovesFor(14,{weapon,forceVariants:true}).filter(m=>m.kind===family);
}
const moveOf=(form:SaberForm,id?:string,kit?:string)=>['saber','force','free_hand'].flatMap(family=>styleLabMoveList(form,kit,family)).find(m=>m.id===id)??selectedMoves(form)[0];
const guardFace=(bearing:number,stance:string)=>bearing+(stance==='side'?Math.PI/2:stance==='away'?0:Math.PI);

export function createStyleLabRound(input:LabOptions={}){
 const style=selectedStyle(input.style),form=formOf(input.form),move=moveOf(form,input.technique,input.weapon);
 const drill=['walk','jump'].includes(input.drill!)?input.drill!:'strike';
 const slot=wrap(Number.isInteger(input.slot)?input.slot!:0);
 const customDegrees=Number.isFinite(input.customDegrees)?normalizedDegrees(input.customDegrees!):null;
 const bearing=customDegrees===null?STYLE_LAB_BEARINGS[slot].angle:customDegrees*Math.PI/180;
 const entry=['step','turn','guard'].includes(input.entry!)?input.entry!:'set';
 const range=clamp(Number(input.range)||92,42,156);
 const kit=ARCADE_SABER_OPTIONS.find(o=>o.id===input.weapon)??ARCADE_SABER_OPTIONS[0],weapon=kit.weapon;
 const stance=['side','away'].includes(input.stance!)?input.stance!:'facing';
 const held=input.defense==='held'&&drill==='strike';
 const spin=Number.isFinite(input.fromBearing)?input.fromBearing!:bearing-Math.PI/3;
 const scenario:ArcadeOptions={mode:'duel',rule:'control',terrain:'underpit',form,width:W,height:H,seed:351,
   teamSizes:[1,1],teamForms:[[form],['soresu']],startingRanks:['SSS+V','SSS+V'],chessStyles:[style,'none'],
   startingSaberWeapon:[weapon,'single'],startingSaberGrip:[kit.grip,'forward'],weaponFlow:true,arenaCuts:true,circuitCuts:true,styleTravel:true,styleChoreo:true,peasantMotion:true,exchangeVariety:true,stanceFlow:true,liveEntry:true,impactPhysics:true,recoveryFlow:true,balancePass:true,closeChoice:true,guardCounterplay:true,minorMoves:true,saberOnly:!move.kind,expandedCombat:Boolean(move.kind),forceVariants:Boolean(move.kind)};
 const g=createArcade(scenario);
 const [fighter,dummy]=g.fighters;
 Object.assign(fighter,{x:CX,y:CY,face:drill==='strike'?spin:0});
 Object.assign(dummy,{x:drill==='jump'?142:drill==='walk'?CX+210:CX+Math.cos(bearing)*range,y:drill==='jump'?444:drill==='walk'?CY+80:CY+Math.sin(bearing)*range,face:guardFace(bearing,stance),
   think:99,action:held?'guard':'stagger',actionDuration:40,displayName:'Target',
   ...(held?{actionTime:.2,parryTime:0,guardBearing:guardFace(bearing,stance),guardDirected:true,guardLane:'center'}:{})});
 const state:LabState={phase:drill==='jump'?'jumping':drill==='walk'?'walking':'turning',elapsed:0,remainder:0,committed:false,lastId:0,outcome:null,window:null,settleAt:null};
 return Object.assign({style,form,slot,bearing,customDegrees,entry,range,stance,weapon,move,g,fighter,dummy,drill},state);
}
function inspectRelease(r:LabRound):ReleaseWindow|null{
 const {fighter:f,dummy:t}=r,spec=f.attackSpec;
 if(!spec)return null;
 const dx=t.x-f.x,dy=t.y-f.y,bearing=Math.atan2(dy,dx),distance=Math.hypot(dx,dy);
 const lane=spec.expanded||arcadeChessAllowsLane(r.style,{bearing,face:f.face,targetFace:t.face,distance,promoted:f.chessPawn?.promoted===true,styleTravel:true});
 return {lane:lane as boolean,angle:Math.abs(delta(bearing,f.face))<=spec.arc,distance,reach:spec.reach+t.radius};
}
function classify(r:LabRound){
 if(r.outcome)return;
 const w=r.window;
 if(!w){r.outcome={id:'miss',label:'No Contact'};return;}
 if(!w.lane||!w.angle)r.outcome={id:'lane',label:'Off Lane'};
 else if(w.distance>w.reach)r.outcome={id:'range',label:'Out of Reach'};
 else r.outcome={id:'miss',label:'No Contact'};
}
export function stepStyleLabRound(r:LabRound,dt=TICK){
 if(r.phase==='done'||!Number.isFinite(dt)||dt<=0)return r;
 r.remainder+=clamp(dt,0,.20);
 while(r.remainder+1e-9>=TICK&&(r.phase as LabState['phase'])!=='done'){
   r.remainder=Math.max(0,r.remainder-TICK);r.elapsed+=TICK;
   const {g,fighter:f,dummy:d}=r;
   r.previous=fighterSamples(g.fighters);
   if(r.drill==='jump'){
     const launching=!r.committed&&r.elapsed>=.24;
     if(launching)r.committed=true;
     stepArcade(g,TICK,{jump:launching,x:launching?Math.cos(r.bearing):0,y:launching?Math.sin(r.bearing):0,
       aimX:CX+220,aimY:CY});
     if(launching){
       const cue=g.events.findLast((e:ArcadeEvent)=>e.kind==='jump'&&e.fighterId===f.id);
       if(cue){r.jumpKind=cue.jumpKind;r.jumpLabel=combatCallout(cue as Parameters<typeof combatCallout>[0],f)?.label??'Jump';}
     }
     r.jumpPeak=Math.max(r.jumpPeak??0,f.airHeight);
     if(r.jumpKind&&f.airPhase==='grounded')r.settleAt??=r.elapsed+.18;
     if(r.settleAt!==null&&r.elapsed>=r.settleAt||r.elapsed>=2.4){
       const travel=Math.round(Math.hypot(f.x-CX,f.y-CY));
       r.outcome=r.jumpKind?{id:'jump',label:r.jumpLabel+' · '+Math.round(r.jumpPeak)+' px high · '+travel+' px traveled'}:
         {id:'miss',label:'No Jump'};
       r.phase='done';
     }
     continue;
   }
   if(r.drill==='walk'){
     stepArcade(g,TICK,{x:Math.cos(r.bearing),y:Math.sin(r.bearing),aimX:CX+200,aimY:CY});
     if(r.elapsed>=.56){
       const dx=f.x-CX,dy=f.y-CY,travel=Math.hypot(dx,dy);
       const actual=travel<6?null:wrap(Math.round(Math.atan2(dy,dx)/(Math.PI/4)));
       r.outcome={id:actual===null?'lane':'walk',label:actual===null?'No Step':
         'Moved '+(r.customDegrees===null?STYLE_LAB_BEARINGS[actual].label:bearingName(r))+' '+Math.round(travel)+' px'};
       r.phase='done';
     }
     continue;
   }
   let command:{aimX:number;aimY:number;x?:number;y?:number;guard?:boolean;technique?:string}={aimX:d.x,aimY:d.y};
   if(!r.committed&&r.elapsed>=TURN_TIME-.14&&r.entry!=='set'){
     const side=r.bearing+Math.PI/2, moving=r.entry==='step'||r.entry==='turn';
     const strength=r.entry==='turn'?.84:.50;
     if(moving)Object.assign(command,{x:Math.cos(side)*strength,y:Math.sin(side)*strength});
     if(r.entry==='turn'&&r.elapsed<TURN_TIME){
       command.aimX=f.x+Math.cos(r.bearing-.63)*92;
       command.aimY=f.y+Math.sin(r.bearing-.63)*92;
     }
     if(r.entry==='guard'&&r.elapsed<TURN_TIME)command.guard=true;
   }
   if(!r.committed&&r.elapsed>=TURN_TIME){
     r.committed=true;r.phase='striking';command={...command,technique:r.move.id};
   }
   if(!r.window&&f.attackSpec?.contact!>0&&f.actionTime+TICK>=f.attackSpec!.contact)r.window=inspectRelease(r);
   stepArcade(g,TICK,command);
   // Dummy teaches geometry only; it never deals damage or changes facing
   // patterns after the chosen setup. The attack and all results are engine-led.
   for(const e of g.events){
     if(e.id<=r.lastId)continue;
     r.lastId=e.id;
     if(e.fighterId===f.id&&e.contact!>0&&!e.offhand){
       r.title=combatCallout(e as Parameters<typeof combatCallout>[0],f)?.label??r.move.name.toUpperCase();
       r.startedFrom=entryNames[e.entryKind!]??null;
       const spec=f.attackSpec;
       if(spec&&[spec.contact,spec.duration,spec.cost].every(Number.isFinite))r.timing={
         reach:Math.round(spec.reach),windupMs:Math.round(spec.contact*1000), afterReleaseMs:Math.round(Math.max(0,spec.duration-spec.contact)*1000),
         stamina:Math.round(spec.cost*10)/10,
       };
     }
     if(e.fighterId===f.id&&e.targetId===d.id&&['hit','launch','ko'].includes(e.kind)){
       r.outcome={id:'hit',label:'Hit'};
       r.damage=Math.round((r.damage??0)+(Number.isFinite(e.damage)?e.damage!:0));
       // Measure motion of the rival's body, not the swing trail or screen shake.
       r.hitOrigin??={x:d.x,y:d.y,measureAt:r.elapsed+.18};
     }
     if(e.fighterId===f.id&&e.kind==='expanded_contact'){
       const verb: string|undefined=({anchor:'Target Slowed',veil:'Target Veiled',siphon:'Siphon Hit',echoStep:'Echo Step'} as Record<string,string|undefined>)[e.effect!];
       if(verb)r.outcome={id:'effect',label:verb};
     }
     if(e.fighterId===f.id&&e.kind==='force_ward'&&!e.targetId)r.outcome={id:'effect',label:'Ward Up'};
     if(e.fighterId===d.id&&e.targetId===f.id&&['parry','block'].includes(e.kind))r.outcome={id:'guard',label:'Blocked'};
   }
   if(r.hitOrigin&&r.elapsed+1e-9>=r.hitOrigin.measureAt&&r.knockbackDistance===undefined)
     r.knockbackDistance=Math.round(Math.hypot(d.x-r.hitOrigin.x,d.y-r.hitOrigin.y));
   if(r.committed&&r.settleAt===null&&(!f.attack&&r.elapsed>TURN_TIME+.11||r.elapsed>2.6)){
     classify(r);r.phase='recovering';r.settleAt=r.elapsed+SETTLE_TIME;
   }
   if(r.settleAt!==null&&r.elapsed>=r.settleAt)r.phase='done';
 }
 return r;
}

export const STYLE_LAB_COMPARE=Object.freeze((['king','queen','bishop'] as const).map(style=>Object.freeze({
  style,form:'shii_cho',technique:'sc_open_cut',slot:1,range:88,weapon:'single',stance:'facing',
  fromBearing:Math.PI/4-Math.PI/3,
})));
export const styleLabCanCompareWeapons=(family:string)=>family==='saber';
export function styleLabWeaponCompare(options:LabOptions={}){
 const form=formOf(options.form);
 const technique=styleLabMoveList(form).some(m=>m.id===options.technique)?options.technique:selectedMoves(form)[0].id;
 return ['shoto','single','greatsaber'].map(weapon=>({...options,weapon,form,technique,drill:'strike'}));
}
const kitLabel=(id:string)=>ARCADE_SABER_OPTIONS.find(o=>o.id===id)?.label??id;
function wire(){
 const $=<K extends keyof StyleLabElements>(id:K)=>document.getElementById(id) as StyleLabElements[K],canvas=$('labCanvas'),ctx=canvas.getContext('2d')!;
 let reduced=readArcadeReducedMotion();
 window.addEventListener('storage',event=>{if(event.key===ARCADE_MOTION_KEY||event.key===null)reduced=readArcadeReducedMotion();});
 const formSet=$('labForm'),moveSet=$('labMove'),styleSet=$('labStyle'),rangeSet=$('labRange');
 const stanceSet=$('labStance'),weaponSet=$('labWeapon'),status=$('labStatus'),angleSet=$('labAngle'),entrySet=$('labEntry');
 const buttons=$('labDirections'),cards=$('labResults'),fx=createArcadeFX(),swingWaves=createArcadeSwingWaves();
 const weaponCompare=$('labCompareWeapons'),weaponCompareHint=$('labWeaponCompareHint');
 const timing=$('labTiming'),family=$('labMoveFamily'),pace=$('labPace'),defense=$('labDefense'),loop=$('labLoop'),pauseButton=$('labPause'),stepButton=$('labStep');
 function showTiming(data?:Timing|null){
   timing.hidden=!data;if(!data)return;
   meta(timing,data.windupMs+' ms Windup',data.afterReleaseMs+' ms Recovery',data.stamina+' STA',data.reach+' px Reach');
 }
 let slot=0,round:LabRound,stage:ReturnType<typeof createArcadeStage>,isRunning=false,queue:number[]=[],auto:'full'|'compare'|null=null,priorAngle:number|null=null,lastFrame=0,hold=0,drill:LabDrill='strike',comparison:ComparisonPane[]=[],comparisonNotes:(LabResult|null)[]=[],compareType:'style'|'weapons'='style',compareOptions:readonly CompareOptions[]=STYLE_LAB_COMPARE,originalSlot=0,cellNotes=new Map<number,LabResult>(),paused=false,steps=0;
 const opt=(name:string,value:string)=>new Option(name,value);
 weaponSet.replaceChildren(...ARCADE_SABER_OPTIONS.map(o=>opt(o.label,o.id)));weaponSet.value='single';
 styleSet.replaceChildren(...styles.map(id=>opt(ARCADE_CHESS_STYLES[id].label,id)));styleSet.value='queen';
 formSet.replaceChildren(...Object.entries(ARCADE_FORMS as Record<string,{name:string}>).map(([id,s])=>opt(s.name,id)));formSet.value='shii_cho';
 function moveList(){
   const chosen=moveSet.value;
   const freeAvailable=styleLabMoveList(formSet.value,weaponSet.value,'free_hand').length>0;
   family.querySelector<HTMLOptionElement>('option[value=free_hand]')!.disabled=!freeAvailable;
   if(!freeAvailable&&family.value==='free_hand')family.value='saber';
   moveSet.replaceChildren(...styleLabMoveList(formSet.value,weaponSet.value,family.value).map(m=>opt(m.name,m.id)));
   if([...moveSet.options].some(o=>o.value===chosen))moveSet.value=chosen;
   refreshWeaponCompare(!isRunning);
   $('labStrike').textContent=family.value==='force'?'Cast':'Strike';
   $('labSpin').title='All 8 bearings';
 }
 function options(){return {form:formSet.value,style:styleSet.value,slot,technique:moveSet.value,
   range:Number(rangeSet.value),weapon:weaponSet.value,stance:stanceSet.value,defense:defense.value,fromBearing:priorAngle,drill,
   customDegrees:auto==='full'||angleSet.value===''?null:angleSet.valueAsNumber,entry:auto==='full'?'set':entrySet.value};}
 buttons.replaceChildren(...STYLE_LAB_BEARINGS.map(({label},i)=>opt(label,String(i))));
 function directions(){buttons.value=String(slot);buttons.disabled=isRunning;}
 buttons.addEventListener('change',()=>{if(!isRunning){comparison=[];comparisonNotes=[];cellNotes.clear();results();slot=wrap(Number(buttons.value));angleSet.value='';prepare(false);}});
 function detail(){
   const style=auto==='compare'&&round?round.style:styleSet.value as LabStyle;
   $('labHint').textContent=styleHints[style]??'';
   meta($('labTravel'),...travelNotes[style]);
   $('labRangeValue').textContent=rangeSet.value+' px';
 }
 function results(){
   const rows=auto==='compare'||comparisonNotes.length?compareOptions.map((choice,i)=>({
      label:compareType==='weapons'?kitLabel(choice.weapon):ARCADE_CHESS_STYLES[choice.style].label,note:comparisonNotes[i]
   })):STYLE_LAB_BEARINGS.map(({label},i)=>({label,note:cellNotes.get(i)}));
   cards.replaceChildren(...rows.map(({label,note})=>{
     const li=document.createElement('li');
     const name=document.createElement('span');name.textContent=label;
     const value=document.createElement('strong');value.textContent=note?.label??'—';
     if(note)li.dataset.result=note.id;
     li.append(name,value);return li;
   }));
 }
 function announce(text:string){if(status.textContent!==text)status.textContent=text;}
 function prepare(go:boolean){
   const previous=round?.fighter?.face;
   if(go&&auto==='full'&&priorAngle===null&&Number.isFinite(previous))priorAngle=previous!;
   round=createStyleLabRound({...options(),drill:go?drill:'strike'});
   stage=createArcadeStage(round.g.width,round.g.height,1,{mapId:'underpit',terrain:round.g.terrain});
   fx.reset();swingWaves.reset();hold=0;isRunning=go;showTiming(null);
   announce(go?auto==='compare'?'Comparing '+ARCADE_CHESS_STYLES[round.style].label:(drill==='jump'?'Jumping ':drill==='walk'?'Walking ':'Turning ')+bearingName(round):'Ready');
   directions();detail();
 }
 function refreshWeaponCompare(on:boolean){
   const available=styleLabCanCompareWeapons(family.value);
   weaponCompare.disabled=!on||!available;
   weaponCompareHint.hidden=true;
 }
 function enabled(on:boolean){
   for(const el of [styleSet,formSet,moveSet,rangeSet,stanceSet,weaponSet,family,defense,angleSet,entrySet,$('labStrike'),$('labSpin'),$('labWalk'),$('labJump'),$('labCompare')])el.disabled=!on;
   refreshWeaponCompare(on);
   $('labStop').disabled=on;
   if(on)paused=false;
   pauseButton.disabled=on;pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));
   stepButton.disabled=on||!paused;
   directions();
 }
 function start(all:boolean,type:LabDrill='strike'){
   if(isRunning)return;
   drill=type;comparison=[];comparisonNotes=[];cellNotes.clear();results();$('labResultSummary').textContent='Results';
   if(all){auto='full';queue=Array.from({length:8},(_,i)=>wrap(slot+i));priorAngle=STYLE_LAB_BEARINGS[slot].angle-Math.PI/4;}
   else {auto=null;queue=[slot];priorAngle=null;}
   slot=queue.shift()!;prepare(true);enabled(false);
 }
 function startCompare(type:'style'|'weapons'='style'){
   if(isRunning||type==='weapons'&&!styleLabCanCompareWeapons(family.value))return;
   compareType=type;compareOptions=type==='weapons'?styleLabWeaponCompare({...options(),style:styleSet.value as LabStyle}) as CompareOptions[]:STYLE_LAB_COMPARE;
   drill='strike';auto='compare';originalSlot=slot;slot=compareOptions[0].slot;hold=0;showTiming(null);
   comparison=compareOptions.map(options=>{
     const r=createStyleLabRound(options);
     return {round:r,fx:createArcadeFX(),waves:createArcadeSwingWaves(),stage:createArcadeStage(W,H,1,{mapId:'underpit',terrain:r.g.terrain})};
   });
   comparisonNotes=[];cellNotes.clear();results();
   $('labResultSummary').textContent='Comparison';
   if(type==='weapons')meta($('labTravel'),'Same Move','3 Sabers');else meta($('labTravel'),'Same Open Cut','3 Styles');
   announce(type==='weapons'?'Comparing sabers':'Comparing styles');
   $('labResultPanel').open=true;isRunning=true;enabled(false);
 }
 function stop(){
   if(auto==='compare'){slot=originalSlot;comparison=[];comparisonNotes=[];results();}
   isRunning=false;auto=null;queue=[];hold=0;enabled(true);announce('Stopped');
 }
 function paintedRound(r:LabRound){
   const previous=r.phase==='done'?null:r.previous;
   return {fighters:displayFighters(r.g.fighters,previous??null,r.remainder),time:previous?Math.max(0,r.g.time-TICK+Math.min(TICK,r.remainder)):r.g.time};
 }
 function paintFighters(fighters:ArcadeFighter[],time:number,waves:ReturnType<typeof createArcadeSwingWaves>){
   const poses=fighters.slice().sort((a,b)=>a.y-b.y).map(actor=>({actor,rig:sampleArcadeFighter(actor,time,{reducedMotion:reduced})}));
   if(!reduced)for(const {actor,rig} of poses)waves.sample(actor,arcadeBladeWorld(actor,rig) as Parameters<typeof waves.sample>[1],time);
   waves.draw(ctx,time,{reducedMotion:reduced});
   for(const {actor,rig} of poses)drawArcadeFighter(ctx,actor,time,{rig,reducedMotion:reduced,outline:true});
 }
 function paintComparison(w:number,h:number){
   const gutter=Math.max(1,w*.004),pane=(w-gutter*2)/3;
   for(const [i,{round:r,fx:localFX,waves:localWaves,stage:localStage}] of comparison.entries()){
     const start=i*(pane+gutter),scale=Math.min(pane/256,h/220);
     ctx.save();ctx.beginPath();ctx.rect(start,0,pane,h);ctx.clip();
     ctx.setTransform(scale,0,0,scale,start+pane*.5-(CX+25)*scale,h*.61-(CY-8)*scale);
     drawArcadeStage(ctx,localStage,W,H,r.g.time,reduced);localFX.drawGround(ctx);
     const paint=paintedRound(r);paintFighters(paint.fighters,paint.time,localWaves);
     localFX.drawAir(ctx);
     ctx.setTransform(1,0,0,1,0,0);
     const size=Math.max(11,Math.round(Math.min(w*.038,h*.19)*.64));
     ctx.font='800 '+size+'px system-ui';ctx.textAlign='center';ctx.lineWidth=4;
     ctx.strokeStyle='#21150b';ctx.fillStyle='#ffe1a3';
     const label=(compareType==='weapons'?kitLabel(r.weapon):ARCADE_CHESS_STYLES[r.style].label).toUpperCase();
     ctx.strokeText(label,start+pane*.5,size+7,pane-8);ctx.fillText(label,start+pane*.5,size+7,pane-8);
     if(r.phase==='done'){
       ctx.font='750 '+Math.max(10,size*.73)+'px system-ui';ctx.fillStyle=r.outcome!.id==='hit'?'#d2edb5':'#ffe2a1';
       ctx.strokeText(r.outcome!.label,start+pane*.5,h-10,pane-7);
       ctx.fillText(r.outcome!.label,start+pane*.5,h-10,pane-7);
     }
     ctx.restore();
   }
 }
 function draw(_dt:number){
   const box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
   const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   const scale=Math.min(w/W,h/H);
   ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#1b1814';ctx.fillRect(0,0,w,h);
   if(comparison.length){paintComparison(w,h);return;}
   ctx.setTransform(scale,0,0,scale,(w-W*scale)/2,(h-H*scale)/2);
   drawArcadeStage(ctx,stage,W,H,round.g.time,reduced);
   const {fighter:f,dummy:d}=round;
   ctx.save();ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.strokeStyle='#fada834d';
   if(round.drill!=='jump'){ctx.beginPath();ctx.moveTo(f.x,f.y-2);
   ctx.lineTo(round.drill==='walk'?CX+Math.cos(round.bearing)*100:d.x,round.drill==='walk'?CY+Math.sin(round.bearing)*100:d.y-2);
   ctx.stroke();}ctx.setLineDash([]);
   if(round.drill==='strike'){
     const spec=f.attackSpec??(round.move.kind?round.move:arcadeChessMove(round.style,round.move));
     ctx.strokeStyle=round.style==='queen'?'#efcc7947':round.style==='king'?'#efcc795f':'#e5bd7026';
     ctx.beginPath();ctx.arc(f.x,f.y,spec.reach, f.face-spec.arc, f.face+spec.arc);ctx.stroke();
   }
   ctx.fillStyle='#edcd81';ctx.font='800 16px system-ui';ctx.textAlign='center';
      if(round.drill==='strike')ctx.fillText(bearingName(round).toUpperCase(),d.x,d.y+36);
   ctx.restore();
   fx.drawGround(ctx);
   const paint=paintedRound(round);paintFighters(round.drill==='jump'?paint.fighters.filter(f=>f.id===round.fighter.id):paint.fighters,paint.time,swingWaves);
   fx.drawAir(ctx);
   if(round.title&&round.phase==='striking'){
     ctx.font='800 18px system-ui';ctx.textAlign='center';ctx.strokeStyle='#22170c';ctx.lineWidth=4;ctx.fillStyle='#ffe59b';
     ctx.strokeText(round.title,f.x,f.y-92,225);ctx.fillText(round.title,f.x,f.y-92,225);
   }
 }
 function frame(now:number){
   let dt=lastFrame?Math.max(0,Math.min(.05,(now-lastFrame)/1000)):0;lastFrame=now;
   const selected=Number(pace.value);
   if(paused&&isRunning){
     if(!steps){draw(0);requestAnimationFrame(frame);return;}
     steps--;dt=STEP_DT;
   }
   const motionDt=paused?STEP_DT:dt*([.25,.5].includes(selected)?selected:1);
   if(isRunning&&auto==='compare'){
     for(const [i,pane] of comparison.entries()){
       if(pane.round.phase==='done')continue;
       stepStyleLabRound(pane.round,motionDt);
       pane.fx.observe(pane.round.g.events);pane.fx.update(motionDt,reduced);
       if((pane.round.phase as LabState['phase'])==='done'){
         const r=pane.round, t=r.timing;
         comparisonNotes[i]=compareType==='weapons'&&t?{...r.outcome!,label:r.outcome!.label+', '+t.reach+' px, '+t.windupMs+' ms, '+t.stamina+' STA'}:r.outcome;
         results();
       }
     }
     if(comparison.every(pane=>pane.round.phase==='done')){
       isRunning=false;auto=null;slot=originalSlot;enabled(true);
       announce('Comparison done');
     }
   }else if(isRunning){
     if(round.phase!=='done'){
       stepStyleLabRound(round,motionDt);fx.observe(round.g.events);
       if(round.phase==='striking'&&round.title)announce((auto==='compare'?ARCADE_CHESS_STYLES[round.style].label+' ':'')+round.title+', '+bearingName(round));
       if((round.phase as LabState['phase'])==='done'){
         showTiming(auto?null:round.timing);
         if(round.drill==='strike'&&round.customDegrees===null){cellNotes.set(slot,round.outcome!);results();}
         const shown=round.damage!>0?', '+round.damage+' DMG':'';
         announce((auto==='compare'?ARCADE_CHESS_STYLES[round.style].label:bearingName(round))+': '+round.outcome!.label+shown);
       }
     }else if((hold+=dt)>.30){
       priorAngle=round.fighter.face;
       if(queue.length){slot=queue.shift()!;prepare(true);}
       else if(loop.checked){
         if(auto==='full'){queue=Array.from({length:7},(_,i)=>wrap(slot+2+i));slot=wrap(slot+1);cellNotes.clear();results();}
         prepare(true);
       }
       else {
         isRunning=false;
         if(auto==='full'){
           const hits=[...cellNotes.values()].filter(note=>note.id==='hit'||note.id==='effect').length;
           announce('Full Circle: '+hits+'/8 hits');
         }
         auto=null;enabled(true);
       }
     }
   }
   fx.update(motionDt,reduced);draw(motionDt);requestAnimationFrame(frame);
 }
 $('labStrike').addEventListener('click',()=>start(false));$('labSpin').addEventListener('click',()=>start(true));$('labStop').addEventListener('click',stop);$('labCompare').addEventListener('click',()=>startCompare());$('labCompareWeapons').addEventListener('click',()=>startCompare('weapons'));$('labWalk').addEventListener('click',()=>start(false,'walk'));$('labJump').addEventListener('click',()=>start(false,'jump'));
 function togglePause(){if(!isRunning)return;paused=!paused;steps=0;enabled(false);announce(paused?'Paused':'Resumed');}
 function step(){if(isRunning&&paused)steps++;}
 pauseButton.addEventListener('click',togglePause);stepButton.addEventListener('click',step);
 for(const el of [styleSet,formSet,moveSet,rangeSet,stanceSet,weaponSet,family,defense,angleSet,entrySet])el.addEventListener(el===rangeSet?'input':'change',()=>{
    if(isRunning)return;
    if(el===formSet||el===weaponSet||el===family)moveList();
    comparison=[];comparisonNotes=[];cellNotes.clear();results();prepare(false);
 });
 window.addEventListener('keydown',e=>{
   if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
   if(e.target instanceof HTMLElement&&(e.target.isContentEditable||e.target.closest('button,select,input,textarea,a,[role="button"]')))return;
   if(e.code==='Space'){e.preventDefault();start(false);}
   if(e.code==='Enter'){e.preventDefault();start(true);}
   if(e.code==='Escape'&&isRunning)stop();
   if(e.code==='KeyP'&&isRunning){e.preventDefault();if(!e.repeat)togglePause();}
   if(e.code==='Period'&&isRunning&&paused){e.preventDefault();if(!e.repeat)step();}
   if(!isRunning&&['ArrowLeft','ArrowRight'].includes(e.code)){
      e.preventDefault();comparison=[];slot=wrap(slot+(e.code==='ArrowLeft'?-1:1));angleSet.value='';prepare(false);
   }
 });
 rangeSet.value=String(startingRange.queen);moveList();results();prepare(false);enabled(true);requestAnimationFrame(frame);
}
if(typeof document!=='undefined'&&document.getElementById('labCanvas'))wire();

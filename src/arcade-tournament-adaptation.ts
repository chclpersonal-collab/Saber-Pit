import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=2.42.0';

type Gear={weapon?:string;grip?:string;dualPhase?:boolean};
type Kit=keyof typeof KITS;
type Metrics=Partial<Record<'damage'|'saberLanded'|'saberSwings'|'forceCasts'|'blocks'|'whiffs',number>>;
type Actor=Gear&{form?:string;id?:string;gear?:Gear;grade?:string;rank?:string;move?:string|null;reason?:string;adaptation?:object|null;profile?:object|null};
type Skill={bouts:number;score:number};
type Ledger=Record<string,Skill>;
type Profile={loadouts?:unknown;bouts?:unknown;observed?:Record<string,unknown>};
type Loadout={form:string;kit:Kit;dualPhase:boolean;move?:string|null;reason?:string};
type RawLedger={bouts?:unknown;last?:Loadout;forms?:Ledger;kits?:Ledger;contexts?:Ledger;moves?:Record<string,number>;landed?:Record<string,number>};
type Technique={form:string;minRank:number;mapAction:string;role:string;tactical?:string};
const techniques=ARCADE_TECHNIQUES as Record<string,Technique>;
const FORMS=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const KITS={single:['single','forward'],reverse:['single','backhand'],dual:['dual','forward'],reverseDual:['dual','backhand'],staff:['staff','forward']};
const GRADES=['F','E','D','C','B','A','S','SS','SSS','SSS+','SSS+I','SSS+II','SSS+III','SSS+IV','SSS+V'];
const types=['pressure','guard','mobile','even'];
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const finite=(v:unknown,d=0)=>typeof v==='number'&&Number.isFinite(v)?v:d;
const tally=(v:unknown)=>Math.floor(clamp(finite(v),0,100000));
const coreMoves=new Set(['slash','slash2','slash3','slash4','rush','sweep','uppercut','thrust','wide_cut','deflect','riposte','vault','frenzy','force','air_cut','air_point','air_guard','air_scissor','air_drop','air_weave','air_rake']);
const validMove=(k:string)=>coreMoves.has(k)||Object.hasOwn(ARCADE_TECHNIQUES,k);
export function validTournamentMove(move:unknown,form:unknown,grade:unknown){
  if(typeof move!=='string'||!Object.hasOwn(ARCADE_TECHNIQUES,move))return null;
  const m=techniques[move], level=GRADES.indexOf(String(grade).replace(/\s+/g,''));
  return m.form===form&&m.minRank<=Math.max(0,level)&&m.mapAction!=='force'?move:null;
}
const unit=(x:unknown)=>clamp(finite(x),0,1);
const gearId=(g?:Gear|null):Kit=>g?.weapon==='staff'?'staff':g?.weapon==='dual'?g.grip==='backhand'?'reverseDual':'dual':g?.grip==='backhand'?'reverse':'single';
function parse(value?:Actor|null){
  const gear=value?.gear??value;
  return {form:FORMS.includes(value?.form!)?value!.form!:'shii_cho',kit:gearId(gear),dualPhase:gear?.dualPhase===true};
}
function normalizedLast(raw?:Loadout|null){
  if(!FORMS.includes(raw?.form!)||!Object.hasOwn(KITS,raw?.kit!))return null;
  return {form:raw!.form,kit:raw!.kit,dualPhase:raw!.dualPhase===true,move:validTournamentMove(raw!.move,raw!.form,'SSS+V'),reason:
    ['starter','matchup','results','practice'].includes(raw!.reason!)?raw!.reason:'results'};
}
function remembered(raw?:Partial<Skill>|null){
  const n=tally(raw?.bouts);
  return {bouts:n,score:clamp(finite(raw?.score),-n,n)};
}
function ledger(input:Ledger|undefined,keys:string[]):Ledger{
  return Object.fromEntries(keys.flatMap(k=>{const item=remembered(input?.[k]);return item.bouts?[[k,item]]:[];}));
}
export function sanitizeTournamentLoadout(value:unknown){
  const v=value as RawLedger|null|undefined;
  const bout=tally(v?.bouts);
  if(!bout)return null;
  const actual=normalizedLast(v?.last);
  if(!actual)return null;
  const moves=Object.entries(v?.moves??{}).filter(([k,count])=>validMove(k)&&tally(count)>0)
    .map(([k,n]):[string,number]=>[k,tally(n)]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,12);
  const schemas=Object.keys(KITS).flatMap(k=>types.map(t=>k+':'+t));
  return {bouts:bout,last:actual,forms:ledger(v?.forms,FORMS),kits:ledger(v?.kits,Object.keys(KITS)),
    contexts:ledger(v?.contexts,schemas),moves:Object.fromEntries(moves),
    landed:Object.fromEntries(moves.flatMap(([k,n])=>tally(v?.landed?.[k])?[[k,Math.min(n,tally(v?.landed?.[k]))]]:[]))};
}
const profile=(r?:Actor|null)=>(r?.adaptation??r?.profile??{}) as Profile;
const estimate=(row:Profile,k:string,initial:number)=>{const w=tally(row?.bouts)/(tally(row?.bouts)+3);return initial*(1-w)+unit(row?.observed?.[k])*w;};
function matchup(opponent:Actor|undefined|null,observed?:Metrics|null){
  const f=opponent?.form, o=profile(opponent);
  const landmarks:Record<string,number[]>={soresu:[.27,.76,.23],djem_so:[.49,.62,.32],makashi:[.47,.39,.21],
    shii_cho:[.53,.37,.32],ataru:[.69,.20,.59],niman:[.46,.34,.35],juyo:[.82,.22,.35]};
  const [p,g,w]=landmarks[f!]??[.48,.40,.32];
  const pressure=estimate(o,'pressure',p),guard=estimate(o,'guardRate',g),whiff=estimate(o,'whiffRate',w);
  if(observed){
    const casts=finite(observed.saberSwings)+finite(observed.forceCasts);
    if(finite(observed.blocks)>Math.max(2,casts*.49))return 'guard';
    if(casts>13&&finite(observed.saberLanded)/casts>.55)return 'pressure';
    if(casts>7&&finite(observed.whiffs)/casts>.49)return 'mobile';
  }
  if(guard>.52)return 'guard';
  if(pressure>.61)return 'pressure';
  if(whiff>.44)return 'mobile';
  return 'even';
}
function random(seed:number|string,identity:string,k:string){
  let n=2166136261;
  for(const c of seed+'|'+identity+'|'+k)n=Math.imul(n^c.codePointAt(0)!,16777619);
  return (n>>>0)/4294967296;
}
const score=(row?:Skill)=>row?row.score/(row.bouts+2)||0:0;
const biases={
  pressure:{forms:{soresu:.30,djem_so:.23,makashi:.13,juyo:-.17},kits:{staff:.29,dual:.15,single:-.05}},
  guard:{forms:{niman:.25,makashi:.24,juyo:.21,soresu:-.09},kits:{reverseDual:.23,dual:.17,reverse:.12,staff:-.04}},
  mobile:{forms:{makashi:.30,ataru:.25,shii_cho:.08,djem_so:-.17},kits:{single:.23,reverse:.12,staff:-.11}},
  even:{forms:{},kits:{}},
};
function actual(selected:Loadout,reason:string){const [weapon,grip]=KITS[selected.kit];return {form:selected.form,weapon,grip,dualPhase:selected.dualPhase,move:selected.move??null,reason};}
export function selectTournamentLoadout(fighter:Actor|undefined|null,opponent:Actor|undefined|null,seed:number|string=1){
  const starting=parse(fighter), p=sanitizeTournamentLoadout(profile(fighter).loadouts);
  if(!p)return actual(starting,'starter');
  const type=matchup(opponent), context=biases[type];
  const previous=p.last;
  const pick=<K extends string>(values:K[],items:Ledger,kind:Record<string,number>,last:K)=>{
    const trials=items[last]?.bouts??0;
    let top=last, topScore=-Infinity;
    for(const item of values){
      const row=items[item], explored=row?.bouts??0;
      const performance=score(row)*.86;
      const caution=item===last?.095:0;
      const trial=.115*Math.sqrt(Math.log(p.bouts+2)/(explored+1));
      const personal=kind===context.kits?score(p.contexts[item+':'+type])*.36:0;
      const confidence=type==='even'?.47:1;
      const collapse=trials>0&&item===last&&performance<-.16?-.09:0;
      const rating=performance+personal+caution+trial+collapse+(kind[item]??0)*confidence+(random(seed,fighter?.id??'',item)-.5)*.058;
      if(rating>topScore){top=item;topScore=rating;}
    }
    return top;
  };
  const form=starting.form, kit=pick(Object.keys(KITS) as Kit[],p.kits,context.kits,previous.kit);
  const grade=fighter?.grade??fighter?.rank??'A';
  const counters:Record<string,Record<string,number>>={pressure:{counter:.24,light:.07},guard:{heavy:.18,light:.07},mobile:{light:.22,counter:.15},even:{}};
  const observedMoves=Object.keys(p.moves).filter(k=>validTournamentMove(k,form,grade)&&p.landed[k]>0);
  const candidates=observedMoves.length?observedMoves:Object.keys(ARCADE_TECHNIQUES).filter(k=>validTournamentMove(k,form,grade));
  const usefulness=(k:string)=>{
    const n=p.moves[k]??0, h=p.landed[k]??0, m=techniques[k];
    return ((h+1)/(n+4))*.54+(counters[type][m.role]??0)+
      (type==='guard'&&m.tactical==='feint_redirect'?.18:0)+.032*Math.log(n+1)+
      (random(seed,fighter?.id??'',k)-.5)*.045;
  };
  const move=candidates.sort((a,b)=>usefulness(b)-usefulness(a))[0]??null;
  const changed=kit!==previous.kit||move!==previous.move;
  const evidence=p.kits[kit]?.bouts||(move&&p.moves[move]);
  return actual({form,kit,dualPhase:starting.dualPhase,move},changed?(type!=='even'?'matchup':evidence?'results':'practice'):'results');
}
export function learnTournamentLoadout(old:Profile|undefined|null,applied:Actor|undefined|null,own:Metrics|undefined|null,foe:Metrics|undefined|null,result:number,opponent:Actor|undefined|null,moves:Record<string,number>={},landed:Record<string,number>={}){
  const prior=sanitizeTournamentLoadout(old?.loadouts)??{bouts:0,last:null,forms:{},kits:{},contexts:{},moves:{},landed:{}};
  const entered=parse(applied), type=matchup(opponent,foe);
  const pressure=finite(own?.damage)-finite(foe?.damage);
  const skill=clamp(pressure/Math.max(100,finite(own?.damage)+finite(foe?.damage)),-1,1);
  const accuracy=clamp(finite(own?.saberLanded)/Math.max(1,finite(own?.saberSwings)),0,1);
  const reward=clamp((result===1?.68:result===0?-.68:0)+skill*.24+(accuracy-.5)*.16,-1,1);
  const next=(table:Ledger,key:string)=>{
    const before=remembered(table[key]);
    return {...table,[key]:{bouts:before.bouts+1,score:before.score+reward}};
  };
  const learned={...prior.moves};
  for(const [key,value] of Object.entries(moves))if(validMove(key))learned[key]=(learned[key]??0)+tally(value);
  const hits={...prior.landed};
  for(const [key,value] of Object.entries(landed))if(validMove(key))hits[key]=(hits[key]??0)+tally(value);
  return sanitizeTournamentLoadout({bouts:prior.bouts+1,last:{...entered,move:applied?.move,reason:applied?.reason},forms:next(prior.forms,entered.form),
    kits:next(prior.kits,entered.kit),contexts:next(prior.contexts,entered.kit+':'+type),moves:learned,landed:hits});
}

import type {Doctrine, SaberForm} from './arcade-save-types.js';
type LooseRecord = Record<string, unknown>;
type HeroPickInput = {id?:unknown;slot?:unknown};
export type HeroPick = {id:string;slot:number};
const doctrines:readonly Doctrine[]=['balanced','aggressive','defensive'];
import {ARCADE_TECHNIQUES} from './arcade-repertoire.js?v=2.42.0';
import {fighterDisplayName} from './arcade-fighter-names.js?v=2.18.2';
import {fighterGender,appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';
import {clampElo} from './arcade-elo.js?v=2.18.5';
const slots=/^[01]-(?:[0-9]|1[0-9]|2[0-3])$/;
const safeId=/^[a-zA-Z0-9_-]{1,80}$/;
const forms:readonly SaberForm[]=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const ranks=['F','E','D','C','B','A','S','SS','SSS','SSS+','SSS+I','SSS+II','SSS+III','SSS+IV','SSS+V'];
const select=<T>(v:unknown, opts:readonly T[], fallback:T):T=>opts.includes(v as T)?v as T:fallback;

export function normalizeHeroPick(org:HeroPickInput|null|undefined,count:number){
  const raw=org?.id;
  const id=typeof raw==='string'&&safeId.test(raw)?raw:'';
  const pos=Number(org?.slot);
  const slot=Number.isInteger(pos)?Math.max(0,Math.min(count-1,pos)):0;
  return {id,slot};
}

export function normalizeBattleHero(input:unknown){
  const h=input as LooseRecord|null|undefined;
  if(!h||typeof h.id!=='string'||!safeId.test(h.id)||typeof h.name!=='string')return null;
  const name=h.name.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,50);
  if(!name)return null;
  const rawFloor=typeof h.eloFloorGrade==='string'?h.eloFloorGrade.toUpperCase().replace(/\s+/g,'').replace('(ENTRY)',''):'';
  const eloFloorGrade=select(rawFloor,ranks,'SSS+V');
  const adaptation=(h.adaptation??h.heroAdaptation??h.profile) as (LooseRecord & {observed?:LooseRecord;variants?:Record<string,LooseRecord|undefined>})|null|undefined;
  const cleanAdaptation=adaptation&&typeof adaptation==='object'?{
    bouts:Math.max(0,Math.min(100000,Math.trunc(Number(adaptation.bouts)||0))),
    wins:Math.max(0,Math.min(100000,Math.trunc(Number(adaptation.wins)||0))),
    lastDoctrine:select(adaptation.lastDoctrine,doctrines,'balanced'),
    observed:Object.fromEntries(['accuracy','pressure','guardRate','forceRate','whiffRate','counterRate'].map(k=>[k,Math.max(0,Math.min(1,Number(adaptation.observed?.[k])||0))])),
    variants:Object.fromEntries(['balanced','aggressive','defensive'].map(k=>{
      const row=adaptation.variants?.[k];return [k,{bouts:Math.max(0,Math.min(100000,Math.trunc(Number(row?.bouts)||0))),
        wins:Math.max(0,Math.min(100000,Math.trunc(Number(row?.wins)||0))),score:Math.max(-100000,Math.min(100000,Number(row?.score)||0))}];
    }))
  }:null;
  const weapon=select(h.weapon,['single','dual','staff'],'single');
  const body=select(h.body,['rabbit','woman','femboy'],'femboy');
  const form=select(h.form,forms,'makashi'), move=Object.hasOwn(ARCADE_TECHNIQUES,h.preferredMove as PropertyKey)?ARCADE_TECHNIQUES[h.preferredMove as string]:null;
  const preferred=move?.form===form&&move.mapAction!=='force'?{preferredMove:move.id}:{};
  const squad=h.sourceKind==='squad'&&/^q[0-9a-z]+-t[0-9a-z]+-f[1-5]$/.test(h.id);
  const appearanceSeed=squad&&Number.isSafeInteger(h.appearanceSeed)&&(h.appearanceSeed as number)>=0&&(h.appearanceSeed as number)<=0xffffffff?
    h.appearanceSeed as number:appearanceSeedFor(h.id);
  return {id:h.id,name:fighterDisplayName(h.id,name),form,body,gender:fighterGender(h.gender,body,h.id),appearanceSeed,
    ...(squad?{sourceKind:'squad'}:{}),
    ...preferred,grade:'SSS+V',elo:clampElo(h.elo,eloFloorGrade),eloFloorGrade,adaptation:cleanAdaptation,doctrine:select(h.doctrine,doctrines,'balanced'),
    weapon,grip:weapon==='staff'?'forward':select(h.grip,['forward','backhand'],'forward'),
    dualPhase:h.dualPhase===true,forceFamily:select(h.forceFamily,['force_push','force_burst','force_pulse'],'force_push')};
}

export type ArcadeBattleHero = NonNullable<ReturnType<typeof normalizeBattleHero>>;
export type ArcadeHeroLineup = Record<string,ArcadeBattleHero|undefined>;
export function normalizeHeroLineup(lineup:unknown):ArcadeHeroLineup{
  const seen=new Set<string>(), out:ArcadeHeroLineup={};
  if(!lineup||typeof lineup!=='object')return out;
  for(const [slot,raw] of Object.entries(lineup)){
    if(!slots.test(slot))continue;
    const p=normalizeBattleHero(raw);
    if(!p||seen.has(p.id))continue;
    seen.add(p.id);out[slot]=p;
  }
  return out;
}

export function battleHeroLineup<T extends {id:string;name:unknown;gender?:unknown}>(picks:readonly HeroPick[],records:readonly T[],getLoadout:(record:T)=>({gender?:unknown}&object)|null|undefined){
  const source=new Map(records.map(h=>[h.id,h]));
  const flat:Record<string,LooseRecord>={};
  for(const [team,pick] of picks.entries()){
    const record=source.get(pick?.id);
    if(!record)continue;
    const value=getLoadout(record);
    if(value)flat[team+'-'+pick.slot]={...value,id:record.id,name:record.name,gender:record.gender??value.gender};
  }
  return normalizeHeroLineup(flat);
}

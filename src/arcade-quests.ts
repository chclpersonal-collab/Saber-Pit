/** The quest save is separate from the arena, both tournaments and Heroes. */
import {createQuestEncounter,normalizeQuestEncounterDescriptor,resolveQuestEncounter,QUEST_ENCOUNTER_LIMIT} from './arcade-quest-encounter.js?v=3.0.0';

import {normalizeIdleCampaign} from './arcade-idle-campaign.js?v=3.3.0';

import type {IdleCampaign} from './arcade-idle-campaign.js';
import type {BattleHero, FighterBody, FighterGender, QuestResult, SavedHeroInput, SaberForm, StorageReader, StorageWriter} from './arcade-save-types.js';

export interface QuestHero {
  id: string;
  name: string;
  form: SaberForm | null;
  body: FighterBody | null;
  gender: FighterGender | null;
}
export interface QuestEncounterDescriptor {
  version: number;
  seed: number;
  hero: BattleHero;
  chessStyles?: readonly string[];
}
export interface QuestRun {
  id: 'bell-beneath';
  hero: QuestHero;
  encounter: QuestEncounterDescriptor | null;
  attempt: number;
  startedAt: number;
  duelAt: number;
  doneAt: number;
  result: QuestResult | null;
  claimedAt: number | null;
  legacyClaim?: true;
}
export interface QuestSave {
  version: 2;
  run: QuestRun | null;
  campaign?: IdleCampaign;
}
export type QuestPhase = 'idle' | 'preparing' | 'fighting' | 'finished' | 'ready' | 'lost' | 'draw' | 'claimed';
export interface QuestStatus { phase: QuestPhase; remainingMs: number; run: QuestRun | null }
interface QuestSaveInput { version?: number; run?: unknown; campaign?: unknown }
type LegacyRun = Pick<QuestRun,'id'|'hero'|'startedAt'|'doneAt'|'claimedAt'>;

export const QUEST_STORAGE_KEY='saber-pit:quests:1';
const PREPARE_MS=10_000, LEGACY_DURATION=45_000, VERSION=2;
const LEGACY_PREPARE=Math.max(0,LEGACY_DURATION-QUEST_ENCOUNTER_LIMIT*1000);
export const BELL_QUEST=Object.freeze({id:'bell-beneath',name:'The Bell Beneath',level:1,
  preparationMs:PREPARE_MS,duelMs:QUEST_ENCOUNTER_LIMIT*1000,durationMs:PREPARE_MS+QUEST_ENCOUNTER_LIMIT*1000});
const empty=(): QuestSave=>({version:VERSION,run:null});
const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const bodies=['woman','femboy','rabbit'], genders=['female','male','nonbinary'];
const ts=(value: unknown): value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
function snapshot(hero: SavedHeroInput | null | undefined): QuestHero | null {
  if(typeof hero?.id!=='string'||!/^[\w-]{1,80}$/.test(hero.id)||typeof hero.name!=='string')return null;
  const name=hero.name.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,80);
  if(!name)return null;
  return {id:hero.id,name,form:forms.includes(hero.form as string)?hero.form!:null,
    body:bodies.includes(hero.body as string)?hero.body!:null,gender:genders.includes(hero.gender as string)?hero.gender!:null};
}
function encounterSeed(hero: Pick<QuestHero,'id'>,startedAt: number,attempt: number): number {
  let n=2166136261;
  for(const c of BELL_QUEST.id+':'+hero.id+':'+startedAt+':'+attempt)n=Math.imul(n^c.codePointAt(0)!,16777619);
  return n>>>0||1;
}
function buildRun(source: SavedHeroInput | null | undefined,startedAt: number,attempt: number,legacy=false): QuestRun | null {
  const hero=snapshot(source);
  if(!hero||!ts(startedAt)||!ts(startedAt+BELL_QUEST.durationMs))return null;
  const seed=encounterSeed(hero,startedAt,attempt);
  const p=source!.adaptation??source!.profile;
  const created=createQuestEncounter(seed,{...source,...hero,adaptation:p,doctrine:source!.doctrine??p?.lastDoctrine,
    preferredMove:source!.preferredMove??p?.loadouts?.last?.move},{legacy});
  const encounter=normalizeQuestEncounterDescriptor(created?.descriptor) as QuestEncounterDescriptor | null;
  if(!encounter)return null;
  const duelAt=startedAt+(legacy?LEGACY_PREPARE:PREPARE_MS),doneAt=duelAt+BELL_QUEST.duelMs;
  return {id:BELL_QUEST.id,hero,encounter,attempt,startedAt,duelAt,doneAt,result:null,claimedAt:null};
}
function canonicalResult(value: unknown): QuestResult | null {
  const raw=value as QuestResult | null | undefined;
  if(!['won','lost','draw'].includes(raw?.status as string)||!Number.isFinite(raw!.elapsed)||raw!.elapsed<=0||raw!.elapsed>QUEST_ENCOUNTER_LIMIT+.025)return null;
  const pair=(value: unknown): [number,number] | null=>Array.isArray(value)&&value.length===2&&value.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1)?[...value] as [number,number]:null;
  const kills=pair(raw!.kills),deaths=pair(raw!.deaths);
  if(!kills||!deaths||kills[0]>deaths[1]||kills[1]>deaths[0])return null;
  const winnerIndex=raw!.status==='won'?0:raw!.status==='lost'?1:null;
  const reason=typeof raw!.reason==='string'?raw!.reason.slice(0,32):'';
  if(!reason||raw!.winnerIndex!==undefined&&raw!.winnerIndex!==winnerIndex)return null;
  return {status:raw!.status,winnerIndex,reason,elapsed:Math.round(raw!.elapsed*1e6)/1e6,kills,deaths};
}
const same=(a: unknown,b: unknown)=>JSON.stringify(a)===JSON.stringify(b);
function checkedRun(value: unknown): QuestRun | null {
  const run=value as QuestRun | null | undefined;
  if(run?.id!==BELL_QUEST.id||!ts(run.startedAt)||!ts(run.duelAt)||!ts(run.doneAt)||run.duelAt<run.startedAt||
    !Number.isSafeInteger(run.attempt)||run.attempt<1||(run.claimedAt!==null&&!ts(run.claimedAt)))return null;
  const hero=snapshot(run.hero);
  if(!hero)return null;
  if(run.legacyClaim===true&&run.claimedAt!==null&&run.claimedAt>=run.doneAt&&run.encounter===null){
    return {id:run.id,hero,encounter:null,attempt:1,startedAt:run.startedAt,duelAt:run.duelAt,doneAt:run.doneAt,result:null,
      claimedAt:run.claimedAt,legacyClaim:true};
  }
  const encounter=normalizeQuestEncounterDescriptor(run.encounter) as QuestEncounterDescriptor | null;
  if(!encounter||encounter.hero?.id!==hero.id||encounter.seed!==encounterSeed(hero,run.startedAt,run.attempt)||
    run.doneAt-run.duelAt!==BELL_QUEST.duelMs||![LEGACY_PREPARE,PREPARE_MS].includes(run.duelAt-run.startedAt))return null;
  const result=run.result===null?null:canonicalResult(run.result);
  if(run.result!==null&&!result||run.claimedAt!==null&&
    (result?.status!=='won'||run.claimedAt<run.duelAt+Math.ceil(result.elapsed*1000)))return null;
  return {id:run.id,hero,encounter,attempt:run.attempt,startedAt:run.startedAt,duelAt:run.duelAt,doneAt:run.doneAt,result,
    claimedAt:run.claimedAt};
}
function migrateV1(value: unknown): QuestRun | null {
  const run=value as LegacyRun | null;
  if(run===null)return null;
  const hero=snapshot(run?.hero);
  if(!hero||run!.id!==BELL_QUEST.id||!ts(run!.startedAt)||!ts(run!.doneAt)||run!.doneAt-run!.startedAt!==LEGACY_DURATION||
    (run!.claimedAt!==null&&(!ts(run!.claimedAt)||run!.claimedAt<run!.doneAt)))return null;
  if(run!.claimedAt!==null)return {id:run!.id,hero,encounter:null,attempt:1,startedAt:run!.startedAt,duelAt:run!.startedAt,
    doneAt:run!.doneAt,result:null,claimedAt:run!.claimedAt,legacyClaim:true};
  // v1 retained only identity. Resume this same hero and old timer origin;
  // missing equipment gets deterministic defaults, not today's mutable Hero card.
  return buildRun(hero,run!.startedAt,1,true);
}
function storageFor<T extends StorageReader>(storage?: T | null): T | Storage | null {
  if(storage!==undefined)return storage;
  try{return globalThis.localStorage;}catch{return null;}
}
export function loadQuests(storage?: StorageReader | null): QuestSave {
  try{
    const data=storageFor(storage)?.getItem(QUEST_STORAGE_KEY);
    if(typeof data!=='string'||data.length>36_000)return empty();
    const decoded=JSON.parse(data) as QuestSaveInput | null;
    if(decoded?.version===1)return {version:VERSION,run:migrateV1(decoded.run)};
    if(decoded?.version!==VERSION)return empty();
    const campaign=decoded.campaign===undefined?null:normalizeIdleCampaign(decoded.campaign);
    return {version:VERSION,run:checkedRun(decoded.run),...(campaign?.revision!>0?{campaign:campaign!}:{})};
  }catch{return empty();}
}
export function saveQuests(state: QuestSave,storage?: StorageWriter | null): boolean {
  try{
    const target=storageFor(storage);
    if(!target||state?.version!==VERSION)return false;
    const run=checkedRun(state.run);
    if(state.run!==null&&!run)return false;
    const current=loadQuests(target),committed=current.run;
    if(committed){
      if(!run||committed.claimedAt!==null)return false;
      if(committed.attempt===run.attempt){
        if(run.startedAt!==committed.startedAt||!same(run.hero,committed.hero)||!same(run.encounter,committed.encounter)||
          run.duelAt!==committed.duelAt||run.doneAt!==committed.doneAt||
          committed.result&&!same(run.result,committed.result))return false;
      }else if(run.attempt!==committed.attempt+1||run.startedAt<committed.duelAt+Math.ceil((committed.result?.elapsed??Infinity)*1000)||
          !['lost','draw'].includes(committed.result?.status as string))return false;
    }
    target.setItem(QUEST_STORAGE_KEY,JSON.stringify({version:VERSION,run,...(current.campaign?{campaign:current.campaign}:{})}));
    return true;
  }catch{return false;}
}
// Compare against the last observed campaign, but always preserve the latest
// legacy expedition. A stale tab cannot replay a claim or overwrite a newer run.
export function saveIdleQuestCampaign(nextCampaign: unknown,priorCampaign?: unknown,storage?: StorageWriter | null): boolean {
  try{
    const target=storageFor(storage);
    if(!target)return false;
    const current=loadQuests(target);
    const previous=priorCampaign==null?null:normalizeIdleCampaign(priorCampaign);
    const next=normalizeIdleCampaign(nextCampaign);
    const revision=current.campaign?.revision??0;
    if(priorCampaign!=null&&!previous||!next||next.revision!==revision+1||
      !same(current.campaign??null,previous?.revision!>0?previous:null))return false;
    const raw=JSON.stringify({...current,campaign:next});
    if(new TextEncoder().encode(raw).length>36_000)return false;
    target.setItem(QUEST_STORAGE_KEY,raw);
    return true;
  }catch{return false;}
}
export function questStatus(state: QuestSave | null | undefined,now=Date.now()): QuestStatus {
  const run=checkedRun(state?.run);
  if(!run)return {phase:'idle',remainingMs:0,run:null};
  if(run.claimedAt!==null)return {phase:'claimed',remainingMs:0,run};
  if(run.result)return {phase:run.result.status==='won'?'ready':run.result.status,remainingMs:0,run};
  const clock=Math.max(ts(now)?now:run.startedAt,run.startedAt);
  return clock<run.duelAt?{phase:'preparing',remainingMs:run.duelAt-clock,run}:
    clock<run.doneAt?{phase:'fighting',remainingMs:run.doneAt-clock,run}:{phase:'finished',remainingMs:0,run};
}
export function deployQuest(state: QuestSave,heroId: string,savedHeroes: readonly SavedHeroInput[],now=Date.now()): QuestRun | null {
  if(state?.version!==VERSION||state.run!==null||!Array.isArray(savedHeroes)||!ts(now))return null;
  const run=buildRun(savedHeroes.find(item=>item?.id===heroId),now,1);
  if(!run)return null;
  state.run=run;return checkedRun(run);
}
export function retryQuest(state: QuestSave,savedHeroes: readonly SavedHeroInput[],now=Date.now(),heroId=state?.run?.hero?.id): QuestRun | null {
  if(state?.version!==VERSION||!ts(now)||!['lost','draw'].includes(questStatus(state,now).phase)||!Array.isArray(savedHeroes))return null;
  const previous=state.run!;
  if(now<previous.duelAt+Math.ceil(previous.result!.elapsed*1000))return null;
  const run=buildRun(savedHeroes.find(h=>h?.id===heroId),now,previous.attempt+1);
  if(!run)return null;
  state.run=run;return checkedRun(run);
}
export function resolveQuest(state: QuestSave,now=Date.now()): QuestRun | null {
  if(state?.version!==VERSION||!ts(now)||questStatus(state,now).phase!=='finished')return null;
  const result=canonicalResult(resolveQuestEncounter(state.run!.encounter));
  if(!result)return null;
  state.run={...state.run!,result};return checkedRun(state.run);
}
export function recordQuestResult(state: QuestSave,liveResult: unknown,now=Date.now()): QuestRun | null {
  const phase=questStatus(state,now).phase;
  if(state?.version!==VERSION||!ts(now)||!['fighting','finished'].includes(phase))return null;
  const live=canonicalResult(liveResult);
  if(!live||now<state.run!.duelAt+Math.ceil(live.elapsed*1000))return null;
  const real=canonicalResult(resolveQuestEncounter(state.run!.encounter));
  if(!real||!same(real,live))return null;
  state.run={...state.run!,result:real};return checkedRun(state.run);
}
export function claimQuest(state: QuestSave,now=Date.now()): QuestRun | null {
  if(state?.version!==VERSION||!ts(now)||questStatus(state,now).phase!=='ready')return null;
  if(now<state.run!.duelAt+Math.ceil(state.run!.result!.elapsed*1000))return null;
  state.run={...state.run!,claimedAt:now};
  return checkedRun(state.run);
}

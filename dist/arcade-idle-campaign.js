/** Deterministic, timestamped first-quest expedition; separate from legacy runs. */
import {createArcade} from './arcade-engine.js?v=3.0.0';
import {normalizeBattleHero} from './arcade-heroes.js?v=2.42.0';
import {arcadeChessStyleForId} from './arcade-chess-styles.js?v=2.44.0';
import {appearanceSeedFor} from './arcade-fighter-profiles.js?v=2.18.3';
import {QUEST_ENCOUNTER_LIMIT,stepQuestEncounter,questEncounterResult} from './arcade-quest-encounter.js?v=3.0.0';

export const BELL_WAVES=Object.freeze([
  {id:'gate',name:'The Flooded Gate',enemy:'The Gatewarden',grade:'SSS+I',form:'shii_cho',weapon:'single',reward:20,dialogue:'The bell sounded before you touched the door.'},
  {id:'choir',name:'The Empty Choir',enemy:'The Last Chorister',grade:'SSS+II',form:'niman',weapon:'dual',reward:35,dialogue:'Keep your voice down. It answers in voices it remembers.'},
  {id:'bell',name:'The Hollow Bell',enemy:'Veyr of the Hollow Bell',grade:'SSS+III',form:'djem_so',weapon:'staff',reward:65,dialogue:'I kept it quiet this long. Show me you can do the same.'},
].map(Object.freeze));
const PREP_MS=5000, WAVE_MS=QUEST_ENCOUNTER_LIMIT*1000;
export const IDLE_PATROL_INTERVAL_MS=15*60*1000;
export const IDLE_PATROL_CAP=32; // 8 h, one supply per fully elapsed interval
const MAX=9999999, MAX_HEROES=60, MAX_UPGRADE=2;
const ts=t=>Number.isSafeInteger(t)&&t>=0&&t<=Number.MAX_SAFE_INTEGER-4*WAVE_MS;
const int=(n,max=MAX)=>Number.isInteger(n)&&n>=0&&n<=max;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const clock=t=>ts(t)?t:null;
const empty=()=>({version:1,revision:0,wallet:0,upgrades:{},clears:0,attempts:0,run:null});
export const emptyIdleCampaign=empty;
const heroSnapshot=h=>normalizeBattleHero(h?{...h,weapon:h.weapon??h.gear?.weapon,grip:h.grip??h.gear?.grip,
  dualPhase:h.dualPhase??h.gear?.dualPhase,forceFamily:h.forceFamily??h.gear?.forceFamily,
  doctrine:h.doctrine??(h.adaptation??h.profile)?.lastDoctrine,preferredMove:h.preferredMove??(h.adaptation??h.profile)?.loadouts?.last?.move}:h);
const seedOf=(hero,start,attempt,wave)=>appearanceSeedFor('idle-bell:1:'+hero.id+':'+start+':'+attempt+':'+wave);
const descriptorFor=(hero,start,attempt,wave,upgrade)=>({version:1,hero,wave,upgrade,seed:seedOf(hero,start,attempt,wave)});
function checkedDescriptor(d){
  if(d?.version!==1||!int(d.wave,BELL_WAVES.length-1)||!int(d.upgrade,MAX_UPGRADE)||!int(d.seed,0xffffffff))return null;
  const hero=heroSnapshot(d.hero);
  return hero?{version:1,hero,wave:d.wave,upgrade:d.upgrade,seed:d.seed}:null;
}

export function createIdleWaveReplay(raw){
  const d=checkedDescriptor(raw);if(!d)return null;
  const {hero,wave,seed,upgrade}=d, enemy=BELL_WAVES[wave];
  const game=createArcade({mode:'watch',seed,width:1120,height:640,terrain:'underpit',limit:45,rule:'elimination',
    teamSizes:[1,1],chessStyles:[arcadeChessStyleForId(hero.id),arcadeChessStyleForId(enemy.id)],
    continuousCombat:true,anticipatingCombat:true,arenaCuts:true,activeFootwork:true,styleTravel:true,
    repertoireSupport:true,styleChoreo:true,peasantMotion:true,exchangeVariety:true,fluidFootwork:true,eloReads:true,
    stanceFlow:true,liveEntry:true,impactPhysics:true,recoveryFlow:true,balancePass:true,closeChoice:true,
    guardCounterplay:true,ratingSkill:true,teamForms:[[hero.form],[enemy.form]],startingRanks:['SSS+V',enemy.grade],
    heroLineup:{'0-0':hero},startingSaberWeapon:[hero.weapon,enemy.weapon],
    doctrines:[hero.doctrine,'defensive']});
  // Apply only to this campaign fighter after the Hero loadout has been built.
  const [player,guardian]=game.fighters;
  player.displayName=hero.name;
  if(upgrade>=1)player.gear=Object.freeze({...player.gear,saberQuality:'improved',...(upgrade>=2?{forceQuality:'improved'}:{})});
  Object.assign(guardian,{displayName:enemy.enemy,body:'femboy',gender:'nonbinary',appearanceSeed:appearanceSeedFor(enemy.id)});
  game.limit=game.config.limit=QUEST_ENCOUNTER_LIMIT;
  game.elitePacing={active:true,stage:'measured',measuredUntil:.16,fullAt:.43};
  game.questCarry=0;
  return {descriptor:d,game};
}
function outcome(r){
  if(!['won','draw','lost'].includes(r?.status)||!Number.isFinite(r.elapsed)||r.elapsed<=0||r.elapsed>QUEST_ENCOUNTER_LIMIT+.025||
    !['timeout','elimination'].includes(r.reason))return null;
  const winnerIndex=r.status==='won'?0:r.status==='lost'?1:null;
  if(r.winnerIndex!==winnerIndex||(r.reason==='timeout'&&winnerIndex!==null))return null;
  const kills=r.kills,deaths=r.deaths;
  if(![kills,deaths].every(x=>Array.isArray(x)&&x.length===2&&x.every(n=>int(n,1)))||
    kills[0]>deaths[1]||kills[1]>deaths[0]||
    (winnerIndex!==null&&(deaths[1-winnerIndex]!==1||deaths[winnerIndex]!==0))||
    (r.reason==='elimination'&&winnerIndex===null&&deaths.some(n=>n!==1)))return null;
  return {status:r.status,winnerIndex,reason:r.reason,elapsed:Math.round(r.elapsed*1e6)/1e6,kills:[...kills],deaths:[...deaths]};
}
function simulate(descriptor){
  const replay=createIdleWaveReplay(descriptor);if(!replay)return null;
  stepQuestEncounter(replay.game,QUEST_ENCOUNTER_LIMIT+.02);
  return outcome(questEncounterResult(replay.game));
}
function waveAt(run,index,startedAt){
  return {descriptor:descriptorFor(run.hero,run.startedAt,run.attempt,index,run.upgrade),startedAt,dueAt:startedAt+WAVE_MS,result:null};
}
const terminal=run=>!!run?.waves.at(-1)?.result;
const cleared=run=>terminal(run)&&run.waves.length===BELL_WAVES.length&&run.waves.every(w=>w.result?.status==='won');
const rewards=run=>run?.waves.reduce((sum,w,i)=>sum+(w.result?.status==='won'?BELL_WAVES[i].reward:0),0)??0;
function patrol(run,now){
  const first=run?.waves?.[0];
  if(first?.result?.status!=='won'||!ts(now)||now<first.dueAt)return {reward:0,next:null,capped:false};
  const elapsed=now-first.dueAt, earned=Math.min(IDLE_PATROL_CAP,Math.floor(elapsed/IDLE_PATROL_INTERVAL_MS));
  return {reward:Math.max(0,earned-run.patrolCollected),next:earned===IDLE_PATROL_CAP?null:IDLE_PATROL_INTERVAL_MS-elapsed%IDLE_PATROL_INTERVAL_MS,
    capped:earned===IDLE_PATROL_CAP};
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function normalizeIdleCampaign(raw){
  if(raw?.version!==1||!int(raw.revision)||!int(raw.wallet)||!int(raw.attempts)||!int(raw.clears,raw.attempts)||
    !raw.upgrades||Array.isArray(raw.upgrades)||typeof raw.upgrades!=='object')return null;
  const pairs=Object.entries(raw.upgrades);
  if(pairs.length>MAX_HEROES||pairs.some(([key,value])=>!id(key)||!int(value,MAX_UPGRADE)||value===0))return null;
  const output={version:1,revision:raw.revision,wallet:raw.wallet,upgrades:Object.fromEntries(pairs),clears:raw.clears,attempts:raw.attempts,run:null};
  if(raw.run===null)return raw.attempts===0&&raw.revision===0&&!raw.wallet&&!pairs.length?output:null;
  const r=raw.run, hero=heroSnapshot(r?.hero);
  if(raw.revision<raw.attempts||!hero||!ts(r.startedAt)||!int(r.upgrade,MAX_UPGRADE)||r.attempt!==raw.attempts||r.attempt===0||
    r.id!==('bell-'+r.attempt+'-'+r.startedAt)||!Array.isArray(r.waves)||r.waves.length<1||r.waves.length>3||
    (r.claimedAt!==null&&!ts(r.claimedAt))||!int(r.patrolCollected,IDLE_PATROL_CAP)||
    (r.patrolCollected>0&&r.waves[0]?.result?.status!=='won'))return null;
  const run={id:r.id,hero,attempt:r.attempt,upgrade:r.upgrade,startedAt:r.startedAt,waves:[],claimedAt:r.claimedAt,patrolCollected:r.patrolCollected};
  for(let i=0;i<r.waves.length;i++){
    const w=r.waves[i], prev=run.waves.at(-1), startedAt=prev?(prev.dueAt+PREP_MS):(r.startedAt+PREP_MS);
    if(prev&&prev.result?.status!=='won')return null;
    const expected=waveAt(run,i,startedAt);
    if(w?.startedAt!==expected.startedAt||w.dueAt!==expected.dueAt||!same(checkedDescriptor(w.descriptor),expected.descriptor))return null;
    const result=w.result===null?null:outcome(w.result);
    if(w.result!==null&&!result)return null;
    run.waves.push({...expected,result});
  }
  if(terminal(run)&&run.waves.length<3&&run.waves.at(-1).result.status==='won')return null;
  if(run.claimedAt!==null&&(!terminal(run)||run.claimedAt<run.waves.at(-1).dueAt))return null;
  return {...output,run};
}
export function idleCampaignStatus(campaign,now=Date.now()){
  const run=campaign?.run??null;
  if(!run)return {phase:'idle',run:null,wave:null,index:0,remainingMs:0,reward:0,cleared:false,patrolReward:0,patrolNextMs:null,patrolCap:false};
  const index=run.waves.length-1,wave=run.waves[index], n=clock(now)??run.startedAt;
  const p=patrol(run,n);
  const phase=run.claimedAt!==null?'claimed':terminal(run)?'ready':n<wave.startedAt?'preparing':'fighting';
  return {phase,run,wave,index,remainingMs:phase==='preparing'?wave.startedAt-n:phase==='fighting'?Math.max(0,wave.dueAt-n):0,
    reward:rewards(run),cleared:cleared(run),patrolReward:p.reward,patrolNextMs:p.next,patrolCap:p.capped};
}
export function deployIdleCampaign(campaign,heroId,savedHeroes,now=Date.now()){
  const c=campaign??empty();
  if(c.revision>=MAX||!['idle','claimed'].includes(idleCampaignStatus(c,now).phase)||!ts(now)||c.attempts>=MAX||!Array.isArray(savedHeroes))return c;
  const hero=heroSnapshot(savedHeroes.find(h=>h?.id===heroId));
  if(!hero)return c;
  if(c.run&&now<c.run.claimedAt)return c;
  const attempt=c.attempts+1,run={id:'bell-'+attempt+'-'+now,hero,attempt,upgrade:Object.hasOwn(c.upgrades,hero.id)?c.upgrades[hero.id]:0,
    startedAt:now,waves:[],claimedAt:null,patrolCollected:0};
  run.waves.push(waveAt(run,0,now+PREP_MS));
  return {...c,revision:c.revision+1,attempts:attempt,run};
}
export function advanceIdleCampaign(campaign,now=Date.now()){
  const c=campaign??empty(), old=c.run;
  if(c.revision>=MAX||!old||old.claimedAt!==null||terminal(old)||!ts(now)||now<old.waves.at(-1).dueAt)return c;
  const run={...old,waves:[...old.waves]};
  // Closed-tab catch-up is capped at one deployed expedition (at most 3 calculations).
  for(let n=0;n<BELL_WAVES.length;n++){
    const wave=run.waves.at(-1);
    if(now<wave.dueAt||wave.result)break;
    const result=simulate(wave.descriptor);if(!result)break;
    run.waves[run.waves.length-1]={...wave,result};
    if(result.status!=='won'||run.waves.length===BELL_WAVES.length)break;
    run.waves.push(waveAt(run,run.waves.length,wave.dueAt+PREP_MS));
  }
  return run.waves.at(-1)===old.waves.at(-1)?c:{...c,revision:c.revision+1,run};
}
export function claimIdleCampaign(campaign,now=Date.now()){
  const c=campaign??empty();
  if(c.revision>=MAX||idleCampaignStatus(c,now).phase!=='ready'||!ts(now)||now<c.run.waves.at(-1).dueAt)return c;
  return {...c,revision:c.revision+1,wallet:Math.min(MAX,c.wallet+rewards(c.run)),clears:Math.min(MAX,c.clears+Number(cleared(c.run))),run:{...c.run,claimedAt:now}};
}
export function collectIdleCampaignPatrol(campaign,now=Date.now()){
  const c=campaign??empty(), reward=patrol(c.run,now).reward;
  if(!reward||c.revision>=MAX)return c;
  return {...c,revision:c.revision+1,wallet:Math.min(MAX,c.wallet+reward),
    run:{...c.run,patrolCollected:c.run.patrolCollected+reward}};
}
export function idleCampaignUpgradeCost(campaign,heroId){
  if(!id(heroId))return null;
  const table=campaign?.upgrades??{};
  const level=Object.hasOwn(table,heroId)?table[heroId]:0;
  return [20,65][level]??null;
}
export function upgradeIdleCampaignHero(campaign,heroId,savedHeroes,now=Date.now()){
  const c=campaign??empty(), cost=idleCampaignUpgradeCost(c,heroId);
  if(c.revision>=MAX||cost===null||c.wallet<cost||!ts(now)||!Array.isArray(savedHeroes)||!heroSnapshot(savedHeroes.find(h=>h?.id===heroId))||
    (!Object.hasOwn(c.upgrades,heroId)&&Object.keys(c.upgrades).length>=MAX_HEROES))return c;
  const prior=Object.hasOwn(c.upgrades,heroId)?c.upgrades[heroId]:0;
  return {...c,revision:c.revision+1,wallet:c.wallet-cost,upgrades:{...c.upgrades,[heroId]:prior+1}};
}

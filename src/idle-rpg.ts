import type {IdleCampaign, IdleExpedition, IdleStatus} from './arcade-idle-campaign.js';
import type {QuestPhase, QuestRun, QuestSave} from './arcade-quests.js';
import type {FighterBody, QuestResult, SavedHeroInput} from './arcade-save-types.js';
type RpgHero = SavedHeroInput & {body?: FighterBody};
type ReplayCreated = ReturnType<typeof createIdleWaveReplay> | ReturnType<typeof restoreQuestEncounter>;
interface PlaybackOptions { created: ReplayCreated; name: string; enemy: string; key: string; result: QuestResult | null; index?: number | null; legacy?: boolean }
interface PlaybackScene { key: string; legacy: boolean; result: QuestResult | null; index: number | null; ended: boolean }
import {QUEST_STORAGE_KEY,loadQuests,saveQuests,questStatus,resolveQuest,claimQuest,recordQuestResult,saveIdleQuestCampaign} from './arcade-quests.js?v=4.01.1';
import * as campaign from './arcade-idle-campaign.js?v=4.0.0';
import {TOURNAMENT_KEY,loadTournament,tournamentHeroes} from './arcade-tournament.js?v=4.01.1';
import * as rigArt from './arcade-fighters.js?v=5.0.0';
import {drawArcadeFighter,drawArcadeFighterPreview} from './arcade-painter.js?v=5.0.0';
import {ARCADE_FORMS} from './arcade-engine.js?v=5.1.0';
import {BELL_GUARDIAN,restoreQuestEncounter,stepQuestEncounter,questEncounterResult} from './arcade-quest-encounter.js?v=3.0.0';
import {startArcadeTournamentPlayback} from './tournament-replay.js?v=4.0.0';

const {BELL_WAVES,idleCampaignStatus,deployIdleCampaign,advanceIdleCampaign,claimIdleCampaign,
  upgradeIdleCampaignHero,idleCampaignUpgradeCost,createIdleWaveReplay,collectIdleCampaignPatrol}=campaign;
const art={...rigArt,drawArcadeFighter,drawArcadeFighterPreview};
// The public roster filters malformed/null rows before returning the Saved Heroes.
const savedHeroes=() => tournamentHeroes(loadTournament(undefined)) as unknown as RpgHero[];
const $=<T extends HTMLElement=HTMLElement>(id: string)=>document.getElementById(id) as T;
const portrait=$<HTMLCanvasElement>('questPortrait'),ctx=portrait.getContext?.('2d');
const picker=$<HTMLSelectElement>('questPicker'), arena=$<HTMLCanvasElement>('questArena'), pace=$<HTMLSelectElement>('questReplaySpeed'), stage=$('questFightPanel');
const pretty=(n?: number | null)=>Number(n??0).toLocaleString();
const seconds=(ms: number)=>Math.max(0,Math.ceil(ms/1000))+'s';
const kitLabel={single:'Single saber',dual:'Dual sabers',staff:'Double-bladed saber'};
let state=loadQuests(),heroes: RpgHero[]=[],paintedKey='',routeKey='',journalKey='',failedRev: number | null=null,failedLegacy='';
let playback: ReturnType<typeof startArcadeTournamentPlayback> | null=null,scene: PlaybackScene | null=null,watchRunId='',hiddenPlaybackKey='';
const put=(id: string,text: string)=>{const e=$(id);if(e.textContent!==text)e.textContent=text;};
const hide=(id: string,value: boolean)=>{const e=$(id);if(e.hidden!==value)e.hidden=value;};
const notice=(text='')=>{put('questNotice',text);hide('questNotice',!text);};
const node=<K extends keyof HTMLElementTagNameMap>(tag: K,text?: string | number,style?: string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text as string;if(style)n.className=style;return n;};
const outcome=(result: {status?: string} | null | undefined)=>result?.status==='won'?'Victory':result?.status==='lost'?'Defeat':'Draw';
const legacyKey=(run: QuestRun | null | undefined)=>run?.encounter?run.startedAt+':'+run.attempt+':'+run.encounter.seed:'';
const keyFor=(run: IdleExpedition,index: number)=>run.id+':'+index;
function refreshHeroes(){
  const selected=picker.value;
  heroes=savedHeroes();
  picker.replaceChildren(...heroes.map(h=>new Option(h.name,h.id)));
  const id=heroes.some(h=>h.id===selected)?selected:state.campaign?.run?.hero?.id;
  if(heroes.some(h=>h.id===id))picker.value=id!;
}
function paint(hero: RpgHero | null | undefined){
  hide('questHeroProfile',!hero);if(!hero)return;
  const {name}=hero,form=ARCADE_FORMS[hero.form!]?.name,gear=hero.gear??hero;
  const key=JSON.stringify([hero.id,name,form,hero.body,hero.gender,gear.weapon,gear.grip]);
  if(paintedKey===key)return;
  paintedKey=key;put('questHeroName',name);
  put('questHeroForm',[form,kitLabel[gear.weapon!],gear.grip==='backhand'?'Reverse grip':null].filter(Boolean).join(' · ')||'Saved Hero');
  if(ctx){ctx.clearRect(0,0,136,136);art.drawArcadeFighterPreview(ctx,{...hero,appearanceSeed:(hero.appearanceSeed??hero.id) as number},{framing:'portrait',reducedMotion:true});}
}
function moveFocusToStage(){
  $('questFightTitle').focus({preventScroll:true});$('questFightTitle').scrollIntoView({block:'start'});
}
function clearPlayback(){
  playback?.destroy();playback=null;scene=null;
  arena.hidden=true;hide('questFightMatchup',true);hide('questFightClock',true);hide('questReplayPace',true);hide('questHideFight',true);
  stage.dataset.scene='scout';
}
function showPlayback({created,name,enemy,key,result,index=null,legacy=false}: PlaybackOptions,focus=false){
  if(!created){notice('This saved fight cannot be replayed.');return;}
  clearPlayback();
  const nowScene: PlaybackScene={key,legacy,result,index,ended:false};
  scene=nowScene;
  const matchup=name+' vs '+enemy;
  arena.hidden=false;arena.setAttribute('aria-label',matchup);
  put('questFightMatchup',matchup);put('questFightClock',created.game.limit+'s');
  hide('questFightMatchup',false);hide('questFightClock',false);hide('questHideFight',false);
  hide('questReplayPace',!result);pace.value='1';pace.disabled=!result;
  try{
    playback=startArcadeTournamentPlayback(arena,created.game,'underpit',{...art,stepArcade:stepQuestEncounter},{
      followAction:true,showMemberNames:true,
      onFrame:(remaining?: number)=>{if(scene===nowScene)put('questFightClock',Math.max(0,Math.ceil(remaining!))+'s');},
      onEnd:()=>{
        if(scene!==nowScene)return;
        const end=questEncounterResult(created.game);
        nowScene.ended=true;
        put('questFightClock',outcome(end));pace.disabled=true;
        if(legacy&&!result&&legacyKey(state.run)===key)persistLegacy(c=>legacyKey(c.run)===key&&recordQuestResult(c,end));
        view();
      },
    });
  }catch(error){clearPlayback();console.error('Idle RPG playback failed',error);notice('Could not open the battle view. Your saved run is unchanged.');}
  if(focus)moveFocusToStage();
  view();
}
function showWave(run: IdleExpedition | null,index: number,focus=false){
  const wave=run?.waves[index],def=BELL_WAVES[index];
  if(!wave||!def)return;
  showPlayback({created:createIdleWaveReplay(wave.descriptor),name:run.hero.name,enemy:def.enemy,
    key:keyFor(run,index),result:wave.result,index},focus);
}
function showLegacy(){
  const {run}=questStatus(state);
  if(!run?.encounter)return;
  watchRunId='';
  showPlayback({created:restoreQuestEncounter(run.encounter),name:run.hero.name,enemy:BELL_GUARDIAN.name,
    key:legacyKey(run),result:run.result,legacy:true},true);
}
function showRoute(status: IdleStatus){
  const {run,index,phase}=status;
  const key=[run?.id,index,phase==='idle'?'idle':phase==='ready'||phase==='claimed'?'end':'run',...BELL_WAVES.map((_,i)=>run?.waves[i]?.result?.status??'')].join(':');
  if(routeKey===key)return;routeKey=key;
  put('rpgRouteCount',`${run?.waves.filter(w=>w.result?.status==='won').length??0} / ${BELL_WAVES.length} CLEARED`);
  $('rpgRouteNodes').replaceChildren(...BELL_WAVES.map((def,i)=>{
    const wave=run?.waves[i], result=wave?.result;
    const st=result?.status==='won'?'clear':result?'stopped':i===index?'current':'locked';
    const li=node('li');li.dataset.state=st;
    if(st==='current')li.setAttribute('aria-current','step');
    const icon=node('span',st==='clear'?'✓':i+1,'rpg-route-icon');icon.setAttribute('aria-hidden','true');
    const text=node('small',st==='clear'?'Cleared':st==='stopped'?outcome(result):st==='current'?(phase==='idle'?'Start here':'Current wave'):'Locked');
    li.append(icon,node('strong',def.name),text);
    if(result){
      const watch=node('button','Replay');watch.type='button';watch.setAttribute('aria-label','Replay '+def.name);
      watch.addEventListener('click',()=>{watchRunId='';showWave(run,i,true);});li.append(watch);
    }
    return li;
  }));
}
function showJournal(status: IdleStatus){
  const {run}=status,key=[run?.id,...(run?.waves??[]).map(w=>w.result?.status??'incoming')].join(':');
  if(key===journalKey)return;journalKey=key;
  const line=(speaker: string,text: string)=>{const li=node('li');li.append(node('strong',speaker),node('p',text));return li;};
  $('questDialogue').replaceChildren(line('Gate notice','Find the bell clapper before the next shift.'),...(run?.waves??[]).map((wave,i)=>{
    const def=BELL_WAVES[i];
    return line(def.enemy,def.dialogue+(wave.result?' '+outcome(wave.result)+'.':''));
  }));
}
function showLegacyStatus(now: number){
  const {phase,run,remainingMs}=questStatus(state,now);
  hide('rpgLegacy',!run);if(!run)return;
  hide('rpgLegacySeal',phase!=='claimed');
  put('rpgLegacyStatus',({preparing:'Entering the Underpit · '+seconds(remainingMs),fighting:'Duel underway · '+seconds(remainingMs),
    finished:'Resolving the original duel…',ready:'Victory. Bellkeeper’s Seal is ready to claim.',lost:'Original duel ended in defeat.',
    draw:'Original duel ended in a draw.',claimed:'Bellkeeper’s Seal secured.'} as Partial<Record<QuestPhase,string>>)[phase]??'');
  hide('rpgLegacyWatch',!run.encounter||phase==='preparing');hide('rpgLegacyClaim',phase!=='ready');
}
function view(now=Date.now()){
  const c=state.campaign, status=idleCampaignStatus(c,now), {phase,run,wave,index,remainingMs,reward,cleared}=status;
  const canDeploy=phase==='idle'||phase==='claimed', timed=phase==='preparing'||phase==='fighting';
  const selected=heroes.find(h=>h.id===picker.value),hero=canDeploy?selected:run?.hero;
  const def=BELL_WAVES[index], activeKey=run?keyFor(run,index):'';
  paint(hero);hide('questDispatch',!canDeploy||!heroes.length);hide('questEmpty',!canDeploy||Boolean(heroes.length));
  put('questDeploy',phase==='claimed'?'Deploy again':'Deploy Hero');
  $<HTMLButtonElement>('questDeploy').disabled=canDeploy&&Number(status.patrolReward??0)>0;
  put('rpgHeroCount',canDeploy?heroes.length+' READY':'DEPLOYED');
  put('rpgStageState',scene?.legacy?'Original duel':scene?.result?'Replay':phase==='idle'?'Ready':phase==='preparing'?'Approaching':
    phase==='fighting'?(scene?.ended?'Awaiting wave report':remainingMs?'In battle':'Resolving'):cleared?'Cleared':outcome(wave?.result));
  stage.dataset.phase=phase;
  stage.dataset.scene=scene?(scene.ended?'result':'fight'):'scout';
  put('questFightTitle',scene?.legacy?'Original Bell Beneath duel':'The Bell Beneath');
  put('rpgLocation',scene?.legacy?'THE UNDERPIT':`THE UNDERPIT · WAVE ${(scene?.index??index)+1} / ${BELL_WAVES.length}`);
  put('rpgSceneCaption',def.name);
  hide('rpgSceneCaption',Boolean(scene));
  hide('questProgress',!timed);
  $<HTMLProgressElement>('questBar').max=phase==='preparing'?Math.max(1,(wave!.startedAt-(index?run!.waves[index-1].dueAt:run!.startedAt))/1000):wave?(wave.dueAt-wave.startedAt)/1000:1;
  $<HTMLProgressElement>('questBar').value=timed?Math.max(0,$<HTMLProgressElement>('questBar').max-remainingMs/1000):0;
  put('questTime',remainingMs?seconds(remainingMs)+' left':'Resolving…');
  hide('questWatch',!wave||phase==='preparing'||(!scene?.legacy&&scene?.key===activeKey));
  put('questWatch',wave?.result?'Replay last wave':'Watch current wave');
  hide('questResolve',!timed||failedRev!==(c?.revision??0));
  put('questStatus',canDeploy&&heroes.length?(Number(status.patrolReward??0)>0?'Collect your patrol salvage before sending another expedition.':'Runs progress while you’re away.'):timed?`${run!.hero.name} · ${def.name}`:'');
  const balance=c?.wallet??0, available=Math.max(0,Number(status.patrolReward??0));
  put('rpgLootStatus',pretty(balance)+' SALVAGE');
  put('rpgLootName',phase==='ready'?pretty(reward)+' salvage ready':'Expedition salvage');
  put('rpgLootDetail',phase==='ready'?(cleared?'All three waves cleared.':reward?'Salvage from cleared waves.':'No loot earned this expedition.'):'Earn salvage by clearing waves. Spend it on your Hero.');
  hide('questClaim',phase!=='ready');put('questClaim',reward?'Claim '+pretty(reward)+' salvage':'Continue');
  hide('questResult',phase!=='claimed');put('rpgRewardDetail',reward?pretty(reward)+' salvage added to your wallet.':'Expedition closed. You can deploy again.');
  const cost=selected?idleCampaignUpgradeCost(c,selected.id):null;
  const level=selected&&c?.upgrades&&Object.hasOwn(c.upgrades,selected.id)?c.upgrades[selected.id]:0;
  hide('rpgUpgrade',!canDeploy||!selected);
  put('rpgUpgradeDetail',level>=2?'Expedition kit fully upgraded.':level===1?'Improved saber equipped.':'Standard expedition kit.');
  put('rpgUpgradeBuy',cost===null?'Max upgrades':(level===0?'Upgrade saber':'Upgrade Force')+' · '+cost);
  $<HTMLButtonElement>('rpgUpgradeBuy').disabled=cost===null||balance<cost;
  const showPatrol=Boolean(available>0||status.patrolNextMs!>0);
  hide('rpgPatrol',!showPatrol);$<HTMLButtonElement>('rpgPatrolCollect').disabled=!available;
  put('rpgPatrolDetail',available?pretty(available)+' patrol salvage ready':'Next patrol salvage in '+seconds(status.patrolNextMs??0));
  showRoute(status);showJournal(status);showLegacyStatus(now);
}
function persistCampaign(action: (prior?: IdleCampaign) => IdleCampaign | undefined,{quiet=false}={}){
  const latest=loadQuests(), prior=latest.campaign;
  const next=action(prior);
  if(next!==prior&&saveIdleQuestCampaign(next,prior)){
    state=loadQuests(); failedRev=null;notice();view();return true;
  }
  state=loadQuests();
  if(!quiet)notice(next===prior?'That action isn’t available right now.':'Could not save this action. The latest save is shown.');
  return false;
}
function persistLegacy(action: (state: QuestSave) => unknown){
  const next=loadQuests();
  if(action(next)&&saveQuests(next)){state=loadQuests();return true;}
  state=loadQuests();return false;
}
function tick(){
  const now=Date.now(), status=idleCampaignStatus(state.campaign,now);
  if(status.phase==='fighting'&&status.remainingMs===0&&failedRev!==(state.campaign?.revision??0)){
    const expected=status.run!.id;
    if(!persistCampaign(c=>c?.run?.id===expected?advanceIdleCampaign(c,now):c,{quiet:true}))failedRev=state.campaign?.revision??0;
  }
  const legacy=questStatus(state,now), lk=legacyKey(legacy.run);
  if(legacy.phase==='finished'&&lk&&lk!==failedLegacy){
    if(!persistLegacy(c=>legacyKey(c.run)===lk&&resolveQuest(c,now)))failedLegacy=lk;
  }
  const current=idleCampaignStatus(state.campaign,now);
  if(scene&&!scene.legacy&&(!current.run||!scene.key.startsWith(current.run.id+':')))clearPlayback();
  if(current.phase==='fighting'&&current.run?.id===watchRunId&&!document.hidden){
    const key=keyFor(current.run!,current.index);
    if(key!==scene?.key&&key!==hiddenPlaybackKey)showWave(current.run,current.index);
  }
  view(now);
}
$('questDispatch').addEventListener('submit',event=>{
  event.preventDefault();
  if(Number(idleCampaignStatus(loadQuests().campaign).patrolReward??0)>0){view();$('rpgPatrolCollect').focus();return;}
  if(persistCampaign(c=>deployIdleCampaign(c,picker.value,savedHeroes()))){
    clearPlayback();watchRunId=state.campaign!.run!.id;hiddenPlaybackKey='';
    tick();moveFocusToStage();
  }
});
$('questClaim').addEventListener('click',()=>{if(persistCampaign(c=>claimIdleCampaign(c)))tick();});
$('rpgUpgradeBuy').addEventListener('click',()=>{if(persistCampaign(c=>upgradeIdleCampaignHero(c,picker.value,savedHeroes())))tick();});
$('rpgPatrolCollect').addEventListener('click',()=>{if(persistCampaign(c=>collectIdleCampaignPatrol(c)))tick();});
$('questWatch').addEventListener('click',()=>{const s=idleCampaignStatus(state.campaign);showWave(s.run,s.index,true);});
$('questHideFight').addEventListener('click',()=>{
  hiddenPlaybackKey=scene?.key??'';const wasLegacy=scene?.legacy;
  clearPlayback();view();(wasLegacy?$('rpgLegacyWatch'):$('questWatch')).focus();
});
$('questResolve').addEventListener('click',()=>{failedRev=null;tick();});
$('rpgLegacyWatch').addEventListener('click',showLegacy);
$('rpgLegacyClaim').addEventListener('click',()=>{if(!persistLegacy(c=>claimQuest(c)))notice('Could not claim the original reward.');view();});
pace.addEventListener('change',()=>playback?.setSpeed(pace.value as unknown as number));
picker.addEventListener('change',()=>view());
window.addEventListener('storage',({key})=>{
  if(key!==null&&key!==QUEST_STORAGE_KEY&&key!==TOURNAMENT_KEY)return;
  state=loadQuests();refreshHeroes();tick();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){state=loadQuests();refreshHeroes();tick();}});
window.addEventListener('pagehide',()=>clearPlayback());
window.addEventListener('pageshow',event=>{if(event.persisted){state=loadQuests();refreshHeroes();tick();}});
refreshHeroes();tick();setInterval(tick,250);

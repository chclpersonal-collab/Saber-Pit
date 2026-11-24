import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTournament,saveTournament,squadTournamentHeroId,squadTournamentHeroEligible,saveSquadTournamentHero,
  tournamentHeroes,resetTournament,setTournamentHeroGender,setTournamentHeroElo,removeTournamentHero} from '../dist/arcade-tournament.js';
import {resetSquadTournament,startSquadTournament,nextSquadBout,runSquadStep} from '../dist/squad-tournament.js';
import {exportArcadeBackup,inspectArcadeBackup} from '../dist/arcade-backup.js';
const disk=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const setup=()=>{
 const squad=startSquadTournament(resetSquadTournament(),{seed:780});
 const first=nextSquadBout(squad),team=squad.teams[first.teamIds[0]],member=team.fighters[2];
 return {squad,team,member,solo:loadTournament(disk())};
};
const play=s=>runSquadStep(s,()=>({winnerIndex:0,time:11,kills:[5,2],deaths:[2,5],reason:'elimination'}));
test('played 5v5 members enter shared Heroes by canonical ID with their own kit, not fabricated team ratings',()=>{
 const {squad,team,member,solo}=setup();
 assert.equal(squadTournamentHeroId(team.id,member.id),member.id);
 assert.equal(squadTournamentHeroId(team.id,'f-solo-duelist'),null);
 assert.equal(squadTournamentHeroId(team.id,team.id+'-f8'),null);
 assert.equal(squadTournamentHeroEligible(squad,team.id,member.id),false);
 assert.equal(saveSquadTournamentHero(solo,squad,team.id,member.id),null);
 play(squad);
 assert.equal(squadTournamentHeroEligible(squad,team.id,member.id),true);
 const other=Object.values(squad.teams).find(t=>t.id!==team.id);
 assert.equal(squadTournamentHeroEligible(squad,other.id,member.id),false);
 team.elo=1823;team.kills=90;team.titles=2;
 const snapshot=structuredClone(squad), original=structuredClone(solo);
 const hero=saveSquadTournamentHero(solo,squad,team.id,member.id);
 assert.deepEqual(squad,snapshot);assert.deepEqual(solo.records,original.records);assert.deepEqual(solo.peaks,original.peaks);
 assert.deepEqual(solo.history,original.history);assert.equal(hero.sourceKind,'squad');assert.equal(hero.sourceTeamId,team.id);
 assert.equal(hero.sourceId,member.id);assert.equal(hero.id,member.id);assert.equal(hero.savedSeason,squad.season);
 for(const k of ['name','gear','form','gender','body','chessStyle','appearanceSeed'])assert.deepEqual(hero[k],member[k],k);
 assert.deepEqual([hero.elo,hero.eloFloorGrade,hero.eloCustomized],[1500,'SSS+V',false]);
 assert.deepEqual([hero.wins,hero.draws,hero.losses,hero.kills,hero.deaths,hero.titles,hero.profile.bouts],[0,0,0,0,0,0,0]);
});
test('a completed draw qualifies; duplicate names do not collide, and Hero updates survive storage backup and reset',()=>{
 const {squad,team,member,solo}=setup();
 runSquadStep(squad,()=>({winnerIndex:null,time:75,reason:'timeout'}));
 assert.equal(squadTournamentHeroEligible(squad,team.id,member.id),true);
 const partner=team.fighters[(team.fighters.indexOf(member)+1)%5];
 partner.name=member.name;
 const a=saveSquadTournamentHero(solo,squad,team.id,member.id),b=saveSquadTournamentHero(solo,squad,team.id,partner.id);
 assert.notEqual(a.id,b.id);
 assert.equal(setTournamentHeroElo(solo,a.id,1651.5,'SSS+IV').elo,1651.5);
 assert.equal(setTournamentHeroGender(solo,a.id,'nonbinary').gender,'nonbinary');
 const update=saveSquadTournamentHero(solo,squad,team.id,member.id);
 assert.deepEqual([update.elo,update.eloFloorGrade,update.eloCustomized,update.gender],[1651.5,'SSS+IV',true,'nonbinary']);
 const storage=disk();
 assert.equal(saveTournament(solo,storage),true);
 const loaded=loadTournament(storage);
 assert.deepEqual(tournamentHeroes(loaded),tournamentHeroes(solo));
 const backup=exportArcadeBackup(storage);
 assert.equal(backup.ok,true);
 const checked=inspectArcadeBackup(backup.text);
 assert.equal(checked.ok,true);
 assert.equal(checked.bundle.sections.duel.heroes[a.id].sourceKind,'squad');
 resetTournament(loaded);
 assert.equal(removeTournamentHero(loaded,a.id),true);
 assert.deepEqual(tournamentHeroes(loaded).map(a=>a.id),[b.id]);
 assert.ok(squad.teams[team.id].fighters.some(f=>f.id===a.id));
});

test('same fighter appearance, gear and chess style reach Arena and Idle RPG; solo seeds are unchanged',async()=>{
 const {squad,team,member,solo}=setup();play(squad);
 const selected=saveSquadTournamentHero(solo,squad,team.id,member.id);
 const {tournamentHeroLoadout}=await import('../dist/arcade-tournament-sim.js');
 const {battleHeroLineup,normalizeBattleHero}=await import('../dist/arcade-heroes.js');
 const {normalizeSetup,engineChessStyleOverrides}=await import('../dist/arcade-setup.js');
 const {appearanceSeedFor}=await import('../dist/arcade-fighter-profiles.js');
 const {createQuestEncounter}=await import('../dist/arcade-quest-encounter.js');
 const {createArcade}=await import('../dist/arcade-engine.js');
 const config=normalizeSetup({teamSizes:[1,1],participation:'watch',heroPicks:[{id:selected.id,slot:0}]});
 const lineup=battleHeroLineup(config.heroPicks,tournamentHeroes(solo),tournamentHeroLoadout);
 const arena=createArcade({...config,mode:'watch',heroLineup:lineup,fighterChessStyles:engineChessStyleOverrides(config,lineup)});
 const quest=createQuestEncounter(42,selected);
 for(const g of [arena,quest.game]){
   const f=g.fighters[0];
   assert.equal(f.appearanceSeed,member.appearanceSeed);
   assert.equal(f.chessStyle,member.chessStyle);
   assert.equal(f.form,member.form);assert.equal(f.gender,member.gender);
   assert.equal(f.gear.weapon,member.gear.weapon);assert.equal(f.gear.grip,member.gear.grip);
 }
 const old={...selected,id:'f-solo-example',sourceKind:null};
 assert.equal(tournamentHeroLoadout(old).appearanceSeed,appearanceSeedFor(old.id));
 assert.equal(normalizeBattleHero(old).appearanceSeed,appearanceSeedFor(old.id));
});

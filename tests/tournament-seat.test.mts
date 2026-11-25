import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// The seat reads and writes the page's own storage, so the tests give it one they can break on purpose.
const data=new Map<string,string>();
let refuse: (key: string,value: string)=>boolean=()=>false;
let writes: string[]=[];
(globalThis as {localStorage?: unknown}).localStorage={
  getItem:(k: string)=>data.get(k)??null,
  setItem:(k: string,v: string)=>{if(refuse(k,v))throw new Error('QuotaExceededError');writes.push(k);data.set(k,String(v));},
  removeItem:(k: string)=>{data.delete(k);},
};
const T=await import('../dist/arcade-tournament.js');
const S=await import('../dist/squad-tournament.js');
const {playTournamentBout}=await import('../dist/arcade-tournament-sim.js');
const {playSquadBout}=await import('../dist/squad-tournament-sim.js');
const {arenaSeatKind}=await import('../dist/arena-seat.js');
const {openTournamentSeat}=await import('../dist/tournament-seat.js');
const {TOURNAMENT_HUMAN_KEYS,tournamentHumanReplay,tournamentHumanGame,startTournamentHumanBout,commitTournamentHumanBout}=await import('../dist/tournament-play.js');
const engine=await import('../dist/arcade-engine.js');

type Format='solo'|'squad';
type Seat={game: {phase: string;time: number;endReason?: string;fighters: {alive: boolean}[]};step(i: unknown): void;leave(): void;finish(): Promise<{saved: boolean;text: string;next: boolean;title: string}>};
const F={
  solo:{key:T.TOURNAMENT_KEY,load:()=>T.loadTournament(),save:(s: unknown)=>T.saveTournament(s),next:(s: unknown)=>T.nextTournamentBout(s),
    draw:(s: unknown)=>T.startTournament(s,{seed:41,limit:45}),redraw:(s: unknown)=>T.startTournament(T.resetTournament(s),{seed:99,limit:45}),sim:(s: unknown)=>T.runTournamentStep(s,playTournamentBout)},
  squad:{key:S.SQUAD_TOURNAMENT_KEY,load:()=>S.loadSquadTournament(),save:(s: unknown)=>S.saveSquadTournament(s),next:(s: unknown)=>S.nextSquadBout(s),
    draw:(s: unknown)=>S.startSquadTournament(s,{seed:43,limit:45}),redraw:(s: unknown)=>S.startSquadTournament(S.resetSquadTournament(s),{seed:99,limit:45}),sim:(s: unknown)=>S.runSquadStep(s,playSquadBout)},
};
function fresh(format: Format){
  data.clear();refuse=()=>false;writes=[];
  const f=F[format], state=f.load();f.draw(state);assert.equal(f.save(state),true);
}
/** A small seeded "player": moves, swings and guards in bursts so the log has many control changes. */
function player(seed: number){
  let s=seed>>>0, hold=0, c={};
  const r=()=>((s=Math.imul(s^s>>>15,2246822507)+0x9e3779b9>>>0)/4294967296);
  return ()=>{
    if(hold--<=0){hold=Math.floor(r()*40);c={x:r()*2-1,y:r()*2-1,strike:r()<.35,guard:r()<.25,dash:r()<.08,heavy:r()<.06,...(r()<.5?{aimX:r()*1200,aimY:r()*700}:{})};}
    return c;
  };
}
function fightOut(format: Format,controls=player(7)){
  const opened=openTournamentSeat(format);
  assert.equal(opened.ok,true);
  const seat=(opened as {seat: Seat}).seat;
  while(seat.game.phase==='playing')seat.step(controls());
  return seat;
}
const attempts=(format: Format,state: {active: {qualifiers: {attempts: unknown[]}[];opening: {attempts: unknown[]}[];rounds: {attempts: unknown[]}[][]}})=>
  [...state.active.qualifiers,...state.active.opening,...state.active.rounds.flat()].reduce((n,b)=>n+b.attempts.length,0);

test('the seat links name the two tournament seats',()=>{
  assert.equal(arenaSeatKind('?seat=tournament'),'tournament');
  assert.equal(arenaSeatKind('?seat=squads'),'squads');
  assert.equal(arenaSeatKind('?seat=gauntlet'),'gauntlet');
  assert.equal(arenaSeatKind('?seat=rival'),null);
});

test('simulated tournament bouts are unchanged by the human-play split',()=>{
  const store=()=>({raw:null as string|null,getItem(){return this.raw;},setItem(_k: string,v: string){this.raw=v;}});
  const solo=T.loadTournament(store());T.startTournament(solo,{seed:77,limit:45});
  const h=createHash('sha256');
  for(let i=0;i<3;i++)T.runTournamentStep(solo,(f: unknown)=>{const out=playTournamentBout(f);h.update(JSON.stringify(out));return out;});
  assert.equal(h.digest('hex'),'a7acaee5192c4770ca7aa81b078d0f5147d41157b4049553b2e35296a614cf81');
  const squad=S.loadSquadTournament(store());S.startSquadTournament(squad,{seed:88,limit:45});
  const g=createHash('sha256');
  for(let i=0;i<2;i++)S.runSquadStep(squad,(f: unknown)=>{const out=playSquadBout(f);g.update(JSON.stringify(out));return out;});
  assert.equal(g.digest('hex'),'7652f47f5d1f1abd4943cacb8d3bc66be75e3807dff189dd3d2fb10d929d216f');
});

for(const format of ['solo','squad'] as const){
  test(`${format}: a fought bout is recorded once like a simulated one, and Watch replays that fight`,async()=>{
    fresh(format);
    const before=F[format].load(), fixture=F[format].next(before);
    const seat=fightOut(format);
    const game=seat.game;
    const [end,again]=await Promise.all([seat.finish(),seat.finish()]);
    assert.equal(end,again,'finish settles once');
    assert.equal(end.saved,true,end.text);
    assert.equal(end.next,false,'the result screen leads back to the bracket');
    assert.equal(writes.filter(k=>k===F[format].key).length,2,'the draw and this one bout');
    const state=F[format].load();
    assert.equal(attempts(format,state),attempts(format,before)+1);
    assert.notDeepEqual(F[format].next(state)?.id+'/'+F[format].next(state)?.attempt,fixture.id+'/'+fixture.attempt);
    assert.equal(state.active.lastReplay.seed,fixture.seed);
    // The same result a simulated bout would have produced from this game goes through the same bracket step.
    const fought=tournamentHumanReplay(data.get(TOURNAMENT_HUMAN_KEYS[format]),state);
    assert.equal(fought.kind,'replay');
    const {game:replay,step}=tournamentHumanGame(format,state.active.lastReplay,(fought as {log: unknown}).log,engine);
    while(replay.phase==='playing')step(replay);
    assert.equal(replay.time,game.time);assert.equal(replay.endReason,game.endReason);
    assert.deepEqual(replay.fighters.map((f: {alive: boolean})=>f.alive),game.fighters.map((f: {alive: boolean})=>f.alive));
    if(game.endReason==='timeout')assert.equal(game.phase,'draw','a clock-out shows as the draw the bracket records');
    // A later simulated bout replays as simulated.
    const next=F[format].load();F[format].sim(next);assert.equal(F[format].save(next),true);
    assert.equal(tournamentHumanReplay(data.get(TOURNAMENT_HUMAN_KEYS[format]),F[format].load()).kind,'none');
  });

  test(`${format}: leaving early writes nothing`,async()=>{
    fresh(format);
    const saved=data.get(F[format].key);
    const opened=openTournamentSeat(format);assert.equal(opened.ok,true);
    const seat=(opened as {seat: Seat}).seat;
    for(let i=0;i<240;i++)seat.step({x:1,strike:true});
    seat.leave();
    seat.step({x:1});
    const end=await seat.finish();
    assert.equal(end.saved,false);
    assert.equal(data.get(F[format].key),saved);
    assert.equal(data.has(TOURNAMENT_HUMAN_KEYS[format]),false);
  });

  test(`${format}: a bout settled in another tab while this one fights is not written`,async()=>{
    fresh(format);
    const seat=fightOut(format,()=>({}));
    const other=F[format].load();F[format].sim(other);assert.equal(F[format].save(other),true);
    const saved=data.get(F[format].key);
    const end=await seat.finish();
    assert.equal(end.saved,false);
    assert.match(end.text,/another tab/);
    assert.equal(data.get(F[format].key),saved);
  });

  test(`${format}: the commit only writes the exact fixture and attempt it was fought for`,()=>{
    fresh(format);
    const state=F[format].load(), bout=startTournamentHumanBout(format,state)!;
    while(!bout.over)bout.step({});
    assert.deepEqual(commitTournamentHumanBout(F[format].load(),{...bout,over:false}),{ok:false,reason:'unfinished'});
    const moved=F[format].load();F[format].sim(moved);
    assert.deepEqual(commitTournamentHumanBout(moved,bout),{ok:false,reason:'stale'},'the bracket has moved on');
    const redrawn=F[format].load();F[format].redraw(redrawn);
    assert.deepEqual(commitTournamentHumanBout(redrawn,bout),{ok:false,reason:'stale'},'a reset and a new draw');
    const ok=commitTournamentHumanBout(F[format].load(),bout);
    assert.equal(ok.ok,true);
    assert.deepEqual(commitTournamentHumanBout((ok as {state: unknown}).state,bout),{ok:false,reason:'stale'},'never twice');
  });
}

test('if storage refuses the full log, the bout still counts and its replay is unavailable',async()=>{
  fresh('solo');
  const seat=fightOut('solo');
  refuse=(k,v)=>k===TOURNAMENT_HUMAN_KEYS.solo&&v.includes('"runs"');
  const end=await seat.finish();
  assert.equal(end.saved,true);
  assert.deepEqual(tournamentHumanReplay(data.get(TOURNAMENT_HUMAN_KEYS.solo),T.loadTournament()),{kind:'unavailable'});
});

test('if the save fails, nothing is written and the earlier fight record is put back',async()=>{
  fresh('squad');
  data.set(TOURNAMENT_HUMAN_KEYS.squad,'{"earlier":true}');
  const saved=data.get(S.SQUAD_TOURNAMENT_KEY);
  const seat=fightOut('squad',()=>({}));
  refuse=k=>k===S.SQUAD_TOURNAMENT_KEY;
  const end=await seat.finish();
  assert.equal(end.saved,false);
  assert.equal(data.get(S.SQUAD_TOURNAMENT_KEY),saved);
  assert.equal(data.get(TOURNAMENT_HUMAN_KEYS.squad),'{"earlier":true}');
});

test('a seat link with nothing to fight returns its reason instead of opening',()=>{
  data.clear();refuse=()=>false;
  for(const format of ['solo','squad'] as const){
    const opened=openTournamentSeat(format);
    assert.equal(opened.ok,false);
    assert.match((opened as {text: string}).text,/draw a bracket/);
  }
});

/** Player's own Arena record: kills, deaths, wins, losses. Kept in its own key so the
 *  Arena career save, its schema and its backups stay exactly as they are. Counts start at 0. */
export const ARENA_RECORD_KEY='loomen-arena-record-v1';
export type ArenaRecord={v:1;rounds:number;wins:number;losses:number;draws:number;kills:number;deaths:number};
export const emptyArenaRecord=():ArenaRecord=>({v:1,rounds:0,wins:0,losses:0,draws:0,kills:0,deaths:0});
const whole=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?Math.floor(n):0;

export function parseArenaRecord(raw:string|null):ArenaRecord {
  if(!raw)return emptyArenaRecord();
  try{
    const o=JSON.parse(raw) as Partial<ArenaRecord>|null;
    if(!o||typeof o!=='object'||o.v!==1)return emptyArenaRecord();
    return {v:1,rounds:whole(o.rounds),wins:whole(o.wins),losses:whole(o.losses),draws:whole(o.draws),kills:whole(o.kills),deaths:whole(o.deaths)};
  }catch{return emptyArenaRecord();}
}
/** Pure: add one finished round. phase is from the player's side. */
export function addArenaRound(rec:ArenaRecord,line:{kills?:unknown;deaths?:unknown},phase:string):ArenaRecord {
  return {...rec,rounds:rec.rounds+1,wins:rec.wins+(phase==='won'?1:0),losses:rec.losses+(phase==='lost'?1:0),draws:rec.draws+(phase==='draw'?1:0),
    kills:rec.kills+whole(line.kills),deaths:rec.deaths+whole(line.deaths)};
}
export type ArenaRecordView={kd:string;win:string;wl:string};
export function arenaRecordView(rec:ArenaRecord):ArenaRecordView {
  if(!rec.rounds)return {kd:'—',win:'—',wl:''};
  const kd=rec.deaths?rec.kills/rec.deaths:rec.kills,decided=rec.wins+rec.losses;
  return {kd:kd.toFixed(2),win:decided?Math.round(rec.wins/decided*100)+'%':'—',wl:`${rec.wins}W · ${rec.losses}L`};
}
export function readArenaRecord(storage:Pick<Storage,'getItem'>|null=globalThis.localStorage??null):ArenaRecord {
  try{return parseArenaRecord(storage?.getItem(ARENA_RECORD_KEY)??null);}catch{return emptyArenaRecord();}
}
export function recordArenaRound(line:{kills?:unknown;deaths?:unknown},phase:string,storage:Pick<Storage,'getItem'|'setItem'>|null=globalThis.localStorage??null){
  try{if(storage)storage.setItem(ARENA_RECORD_KEY,JSON.stringify(addArenaRound(readArenaRecord(storage),line,phase)));}catch{/* Record is a convenience; never block a round. */}
}

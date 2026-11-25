/** A seat in the v6 match screen that another page owns: the Gauntlet or the Tournament hands the person a live bout,
 *  the match screen runs it with its full HUD and controls, and the owning page's rules settle the result.
 *  The match screen never writes Arena careers, ratings or records for a seated bout. */
export type ArenaSeatKind='gauntlet'|'tournament'|'squads';
export interface ArenaSeatEnd {title: string; text: string; saved: boolean; next: boolean}
export interface ArenaSeat {
  kind: ArenaSeatKind;
  /** Shown as the match name, e.g. "Gauntlet". */
  label: string;
  /** Match-screen controls to use: squad for a team bout. */
  mode: 'duel' | 'squad';
  /** Page to go back to. */
  back: string;
  mapId: string;
  teamSizes: [number, number];
  game: unknown;
  /** Advance one 1/120 s tick with the person's controls. */
  step(input: Record<string, unknown>): void;
  /** Settle the finished bout. Safe to call more than once: it writes at most once. */
  finish(): Promise<ArenaSeatEnd>;
  /** Leave before the end: nothing is written. */
  leave(): void;
}
const KINDS: readonly ArenaSeatKind[]=['gauntlet','tournament','squads'];
export function arenaSeatKind(search=globalThis.location?.search??''): ArenaSeatKind | null{
  const kind=new URLSearchParams(search).get('seat') as ArenaSeatKind;
  return KINDS.includes(kind)?kind:null;
}
export type ArenaSeatOpen={ok:true;seat:ArenaSeat}|{ok:false;text:string;back:string;
  /** Nothing went wrong: there is simply no bout yet, so the player goes straight back to draw one. */
  redirect?:true};
export async function openArenaSeat(kind: ArenaSeatKind): Promise<ArenaSeatOpen>{
  if(kind==='gauntlet')return (await import('./gauntlet-seat.js?v=6.0.3-seat')).openGauntletSeat();
  if(kind==='tournament'||kind==='squads')return (await import('./tournament-seat.js?v=6.0.3-seat')).openTournamentSeat(kind==='squads'?'squad':'solo');
  return {ok:false,text:'Seat not available',back:'./index.html'};
}

/** The saved text under a key, or undefined when this browser blocks storage. */
export const readSeatSave=(key: string)=>{try{return globalThis.localStorage.getItem(key);}catch{return undefined;}};
/** How a seat writes its finished bout. commit() settles it on a fresh copy of the save; log and marker are the fight record. */
export interface SeatSettlement<S> {
  key: string; known: string | null; logKey: string;
  commit(): {ok: true; state: S} | {ok: false};
  log(state: S): unknown; marker(state: S): unknown;
  save(state: S): boolean;
  savedText(state: S): string;
}
/** Write a finished seated bout once, under the page's own lock, only if the save is still what the seat opened with.
 *  The fight record goes down first, so a settled human bout is never replayed as an AI fight: the full log, or if storage
 *  refuses it, a small marker that says its replay is unavailable. If the save then fails, the earlier record is put back. */
export async function settleSeat<S>(o: SeatSettlement<S>): Promise<{saved: boolean; text: string}>{
  const task=()=>{
    if(readSeatSave(o.key)!==o.known)return 'Not saved: changed in another tab';
    const result=o.commit();
    if(!result.ok)return 'Not saved: bout already settled';
    const store=globalThis.localStorage, before=readSeatSave(o.logKey);
    const put=(value: unknown)=>{try{store.setItem(o.logKey,JSON.stringify(value));return true;}catch{return false;}};
    if(!put(o.log(result.state))&&!put(o.marker(result.state)))return 'Not saved: storage full';
    if(!o.save(result.state)){
      try{if(before==null)store.removeItem(o.logKey);else store.setItem(o.logKey,before);}catch{/* the record names a bout the save never reached, so it can never match */}
      return 'Not saved: last save kept';
    }
    return {saved:true,text:o.savedText(result.state)};
  };
  const locks=globalThis.navigator?.locks, busy='Not saved: busy in another tab';
  const outcome=typeof locks?.request!=='function'?task():
    await Promise.resolve(locks.request('saber-pit:progress:'+o.key,{ifAvailable:true},lock=>lock?task():busy)).catch(()=>busy);
  return typeof outcome==='string'?{saved:false,text:outcome}:outcome;
}

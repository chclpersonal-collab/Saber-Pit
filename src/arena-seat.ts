/** A seat in the v6 match screen that another page owns: the Gauntlet (and later the Tournament) hands the
 *  person a live bout, the match screen runs it with its full HUD and controls, and the owning page's rules
 *  settle the result. The match screen never writes Arena careers, ratings or records for a seated bout. */
export type ArenaSeatKind='gauntlet';
export interface ArenaSeatEnd {title: string; text: string; saved: boolean; next: boolean}
export interface ArenaSeat {
  kind: ArenaSeatKind;
  /** Shown as the match name, e.g. "Gauntlet". */
  label: string;
  /** Match-screen controls to use: squad for 1 vs 3. */
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
export function arenaSeatKind(search=globalThis.location?.search??''): ArenaSeatKind | null{
  return new URLSearchParams(search).get('seat')==='gauntlet'?'gauntlet':null;
}
export type ArenaSeatOpen={ok:true;seat:ArenaSeat}|{ok:false;text:string;back:string};
export async function openArenaSeat(kind: ArenaSeatKind): Promise<ArenaSeatOpen>{
  if(kind==='gauntlet')return (await import('./gauntlet-seat.js')).openGauntletSeat();
  return {ok:false,text:'That seat is not available.',back:'./index.html'};
}

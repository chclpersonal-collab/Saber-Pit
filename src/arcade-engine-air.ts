import {arcadeJumpHeight} from './arcade-air-gameplay.js?v=2.25.3';
import type {AirArc} from './arcade-air-gameplay.js?v=2.25.3';

export type AirTrick = 'parry_flip';
interface ArcDurations { takeoff: number; flight: number; landing: number; peak: number }
export type ArcadeAirArc = (ArcDurations & {kind?: never}) | (ArcDurations & AirArc & {kind: string});
export interface ArcadeAirState {
  face: number;
  airFacing?: number | null;
  airArc: ArcadeAirArc | null;
  jumpKind?: string | null;
  airTrick?: AirTrick | null;
  airRequest?: object | null;
  airTime: number;
  airDuration: number;
  airborne: number;
  airPhase: 'grounded' | 'takeoff' | 'airborne' | 'landing';
  airProgress: number;
  airHeight: number;
}

export const vaultArc={takeoff:.145,flight:.495,landing:.185,peak:53};
export const aerialArcs={vault:vaultArc,crossVault:{takeoff:.115,flight:.493,landing:.18,peak:45},highVault:{takeoff:.17,flight:.532,landing:.13,peak:66}};
export const evadeArc={takeoff:.075,flight:.215,landing:.115,peak:25};
export const launchArc={takeoff:0,flight:.39,landing:.14,peak:37};
export function startAir(f: ArcadeAirState,arc: ArcadeAirArc,trick: AirTrick | null=null) {
  if(!arc.kind)f.jumpKind=null;
  f.airFacing=f.face;f.airTrick=trick;f.airArc=arc;f.airTime=0;f.airDuration=arc.takeoff+arc.flight+arc.landing;
  updateAir(f,0);
}
export function updateAir(f: ArcadeAirState,dt: number) {
  const arc=f.airArc;
  if(!arc)return;
  f.airTime=Math.min(f.airDuration,f.airTime+dt);
  const t=f.airTime;
  f.airborne=Math.max(0,f.airDuration-t);
  if(t<arc.takeoff){
    f.airPhase='takeoff';f.airProgress=t/arc.takeoff;f.airHeight=0;
  }else if(t<arc.takeoff+arc.flight){
    const u=(t-arc.takeoff)/arc.flight;f.airPhase='airborne';f.airProgress=u;f.airHeight=arc.kind?arcadeJumpHeight(arc,u):4*arc.peak*u*(1-u);
  }else if(t<f.airDuration){
    f.airPhase='landing';f.airProgress=(t-arc.takeoff-arc.flight)/arc.landing;f.airHeight=0;
  }else{
    f.airArc=null;f.airFacing=null;f.airTrick=null;f.jumpKind=null;f.airRequest=null;f.airPhase='grounded';f.airProgress=0;f.airHeight=0;
  }
}

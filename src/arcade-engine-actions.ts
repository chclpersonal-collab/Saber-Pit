/** Timer, carry and stamina primitives shared by movement and attack transitions. */
interface ActionCarry { kind: string }
export interface ArcadeActionState {
  action: string;
  actionTime: number;
  actionDuration: number;
  poseFrom?: ActionCarry | null;
  poseEntryDuration?: number;
  poseEntryOffset?: number;
  rankFootwork?: object | null;
  energy: number;
}

export const neutralAction=(action: string)=>action==='idle'||action==='walk'||action==='run';
export function setAction(f: ArcadeActionState,action: string,duration=0){
  if(f.action!==action || duration){
    const elapsed=f.actionTime+(f.poseEntryOffset??0);
    const carry=!duration&&neutralAction(f.action)&&neutralAction(action)&&
      (f.poseFrom?.kind==='dash_recover'||f.poseFrom?.kind==='force_recover'||f.poseFrom?.kind==='weapon_recover'||f.poseFrom?.kind==='guard_recover')&&elapsed<(f.poseEntryDuration??NaN);
    if(f.rankFootwork)f.rankFootwork=null;
    f.action=action; f.actionTime=0; f.actionDuration=duration;
    if(carry)f.poseEntryOffset=elapsed;
    else {f.poseFrom=null;f.poseEntryDuration=0;f.poseEntryOffset=0;}
  }
}

export function spend(f: Pick<ArcadeActionState,'energy'>,n: number){
  if(f.energy+1e-7<n)return false;
  f.energy=Math.max(0,f.energy-n);return true;
}

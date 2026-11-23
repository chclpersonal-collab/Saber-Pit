/** Input edge capture and substep clock, separate from authoritative tick logic. */
export type ArcadeOrder='push'|'hold'|'regroup'|'flank';
const isOrder=(value: ArcadeInput['order']): value is ArcadeOrder =>
  value==='push'||value==='hold'||value==='regroup'||value==='flank';
const edgeFlags=['strike','heavy','dash','force','phase','feint','jump'] as const;
type EdgeFlag=typeof edgeFlags[number];
export interface ArcadeInput extends Partial<Record<EdgeFlag,boolean>> {
  x?: number; y?: number; aimX?: number; aimY?: number;
  technique?: string | null; guard?: boolean; walk?: boolean;
  order?: ArcadeOrder | 'advance' | 'retreat';
}
interface ArcadeRunningState {
  phase: string;
  mode: string;
  order: ArcadeOrder;
  edges: Partial<Record<EdgeFlag,boolean>> & { technique?: string | null };
  fighters: {team: 0 | 1; x: number; y: number; orderAnchor?: {x: number;y: number}}[];
}

/** Mutates and returns state. dt in seconds; attack/dash inputs are rising-edge actions; guard is held. */
export function stepGame<S extends ArcadeRunningState>(s: S,dt: number,input: ArcadeInput,tick: (s: S,dt: number,controls: ArcadeInput)=>void){
  if(!s||s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return s;
  const command=input.order==='advance'?'push':input.order==='retreat'?'regroup':input.order;
  if(s.mode==='command'&&isOrder(command)&&command!==s.order){
    s.order=command;
    for(const f of s.fighters)if(f.team===0)f.orderAnchor={x:f.x,y:f.y};
  }
  const edge: ArcadeInput={};
  if(typeof input.technique==='string'&&input.technique!==s.edges.technique)edge.technique=input.technique;
  s.edges.technique=input.technique??null;
  for(const name of edgeFlags){
    edge[name]=Boolean(input[name]&&!s.edges[name]);
    s.edges[name]=Boolean(input[name]);
  }
  const count=Math.ceil(Math.min(dt,.12)*120), step=Math.min(dt,.12)/count;
  for(let index=0;index<count&&s.phase==='playing';index++){
    const controls={x:input.x,y:input.y,aimX:input.aimX,aimY:input.aimY,guard:input.guard,walk:input.walk,...(index===0?edge:{})};
    tick(s,step,controls);
  }
  return s;
}

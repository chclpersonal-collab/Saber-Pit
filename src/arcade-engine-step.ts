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
  /** Local versus: the second player's controls for Pink's own fighter. */
  p2?: ArcadeInput;
}
interface ArcadeRunningState {
  phase: string;
  mode: string;
  order: ArcadeOrder;
  edges: Partial<Record<EdgeFlag,boolean>> & { technique?: string | null };
  edgesP2?: Partial<Record<EdgeFlag,boolean>> & { technique?: string | null };
  fighters: {team: 0 | 1; x: number; y: number; orderAnchor?: {x: number;y: number}}[];
}

const held=(input: ArcadeInput): ArcadeInput=>({x:input.x,y:input.y,aimX:input.aimX,aimY:input.aimY,guard:input.guard,walk:input.walk});
/** Rising edges for one set of controls; each local player keeps their own memory of what was already held. */
function edgesOf(input: ArcadeInput,memory: ArcadeRunningState['edges']): ArcadeInput{
  const edge: ArcadeInput={};
  if(typeof input.technique==='string'&&input.technique!==memory.technique)edge.technique=input.technique;
  memory.technique=input.technique??null;
  for(const name of edgeFlags){
    edge[name]=Boolean(input[name]&&!memory[name]);
    memory[name]=Boolean(input[name]);
  }
  return edge;
}

/** Mutates and returns state. dt in seconds; attack/dash inputs are rising-edge actions; guard is held. */
export function stepGame<S extends ArcadeRunningState>(s: S,dt: number,input: ArcadeInput,tick: (s: S,dt: number,controls: ArcadeInput)=>void){
  if(!s||s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return s;
  const command=input.order==='advance'?'push':input.order==='retreat'?'regroup':input.order;
  if(s.mode==='command'&&isOrder(command)&&command!==s.order){
    s.order=command;
    for(const f of s.fighters)if(f.team===0)f.orderAnchor={x:f.x,y:f.y};
  }
  const edge=edgesOf(input,s.edges);
  const second=input.p2?edgesOf(input.p2,s.edgesP2??={}):null;
  const count=Math.ceil(Math.min(dt,.12)*120), step=Math.min(dt,.12)/count;
  for(let index=0;index<count&&s.phase==='playing';index++){
    const controls: ArcadeInput={...held(input),...(index===0?edge:{})};
    if(input.p2)controls.p2={...held(input.p2),...(index===0?second:{})};
    tick(s,step,controls);
  }
  return s;
}

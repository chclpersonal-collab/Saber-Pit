/** LOOMEN v6 controller support. Standard-mapping gamepads (Xbox, PlayStation, Switch Pro and most others).
 *  Read once a frame; nothing is saved. The engine turns held buttons into one press each, like the keyboard. */
export type PadAction='strike'|'heavy'|'guard'|'dash'|'jump'|'feint'|'force'|'technique'|'phase'|'walk'|'up'|'down'|'left'|'right';
type PadButton=PadAction|'stats'|'pause';
/** Button index (W3C standard mapping) to Arena action. */
export const PAD_BUTTONS: Readonly<Record<number,PadButton>>=Object.freeze({
  0:'strike',1:'dash',2:'heavy',3:'jump',4:'feint',5:'force',6:'guard',7:'technique',
  8:'stats',9:'pause',10:'walk',11:'phase',12:'up',13:'down',14:'left',15:'right',
});
/** What each control does, for the Controls help. */
export const PAD_LAYOUT: readonly (readonly [string,string])[]=[
  ['Left Stick / D-Pad','Move'],['Right Stick','Aim'],['A / Cross','Slash'],['X / Square','Signature'],
  ['B / Circle','Dash'],['Y / Triangle','Jump'],['LT / L2 (Hold)','Guard'],['RT / R2','Technique'],
  ['LB / L1','Feint'],['RB / R1','Force'],['L3','Walk'],['R3','Extend Blade'],['View / Share (Hold)','Scoreboard'],['Menu / Options','Pause'],
];
export interface PadLike {
  index:number;connected:boolean;mapping?:string;
  buttons:readonly {pressed:boolean;value:number}[];axes:readonly number[];
}
export interface PadState {
  index:number;held:ReadonlySet<PadAction>;stick:{x:number;y:number};look:{x:number;y:number}|null;
  stats:boolean;pausePressed:boolean;
}
const TRIGGER=.35;
/** Radial dead zone, rescaled so the stick still reaches full speed. */
export function deadZone(x:number,y:number,zone=.22){
  const m=Math.hypot(x,y);
  if(!Number.isFinite(m)||m<zone)return {x:0,y:0};
  const k=Math.min(1,(m-zone)/(1-zone))/m;
  return {x:x*k,y:y*k};
}
export function readPad(pad:PadLike,wasPausing=false):PadState {
  const held=new Set<PadAction>();let stats=false,pausing=false;
  pad.buttons.forEach((b,i)=>{
    const action=PAD_BUTTONS[i];
    if(!action||!(b?.pressed||(b?.value??0)>TRIGGER))return;
    if(action==='stats')stats=true;else if(action==='pause')pausing=true;else held.add(action);
  });
  const stick=deadZone(pad.axes[0]??0,pad.axes[1]??0);
  const r=deadZone(pad.axes[2]??0,pad.axes[3]??0,.35);
  return {index:pad.index,held,stick,look:r.x||r.y?r:null,stats,pausePressed:pausing&&!wasPausing};
}
/** One reader per page. Remembers the Menu button so holding it toggles pause once. */
export function createPadReader(source:()=>readonly (PadLike|null)[]=()=>globalThis.navigator?.getGamepads?.()??[]){
  const pausing=new Map<number,boolean>();
  return {
    read():PadState[] {
      let pads:readonly (PadLike|null)[]=[];
      try{pads=source()??[];}catch{pads=[];}
      const out:PadState[]=[];
      for(const p of pads){
        if(!p?.connected)continue;
        out.push(readPad(p,pausing.get(p.index)??false));
        pausing.set(p.index,Boolean(p.buttons[9]?.pressed||(p.buttons[9]?.value??0)>TRIGGER));
      }
      return out.sort((a,b)=>a.index-b.index);
    },
  };
}
/** Who drives what. Alone: every pad plays for you. Local versus: two pads split, one pad goes to player two. */
export function assignPads(pads:readonly PadState[],versus:boolean):{p1:PadState[];p2:PadState[]} {
  if(!versus)return {p1:[...pads],p2:[]};
  if(pads.length>=2)return {p1:[pads[0]!],p2:[pads[1]!]};
  return {p1:[],p2:[...pads]};
}
/** Local versus seats, latched for the round. A pad keeps its seat while it is unplugged, so a dropped controller
 *  never hands its fighter to the other player; the seat stays empty until that pad comes back, or a spare pad claims it with a press. */
export function createPadSeats(){
  let seats:[number|null,number|null]|null=null;
  const busy=(p:PadState)=>p.held.size>0||Boolean(p.stick.x||p.stick.y);
  return {
    reset(){seats=null;},
    assign(pads:readonly PadState[],versus:boolean):{p1:PadState[];p2:PadState[]} {
      if(!versus){seats=null;return assignPads(pads,false);}
      if(!seats){
        if(!pads.length)return {p1:[],p2:[]};
        seats=pads.length>=2?[pads[0]!.index,pads[1]!.index]:[null,pads[0]!.index];
      }else{
        const live=new Set(pads.map(p=>p.index));
        for(const p of pads){
          if(seats.includes(p.index)||!busy(p))continue;
          const free=seats.findIndex(i=>i==null||!live.has(i));
          if(free>=0)seats[free]=p.index;
        }
      }
      const [a,b]=seats;
      return {p1:pads.filter(p=>p.index===a),p2:pads.filter(p=>p.index===b)};
    },
  };
}
/** Jump, Feint and Phase act once per press, like their keys: this turns each pad's held buttons into fresh presses. */
export function createPadPresses(){
  const was=new Map<number,ReadonlySet<PadAction>>();
  return {
    pressed(pads:readonly PadState[]):Set<PadAction> {
      const out=new Set<PadAction>();
      for(const p of pads){const before=was.get(p.index);for(const a of p.held)if(!before?.has(a))out.add(a);was.set(p.index,p.held);}
      return out;
    },
  };
}
export const padHeld=(pads:readonly PadState[],name:string)=>pads.some(p=>p.held.has(name as PadAction));
export function padStick(pads:readonly PadState[]){
  for(const p of pads)if(p.stick.x||p.stick.y)return p.stick;
  return null;
}
export function padAim(pads:readonly PadState[],from:{x:number;y:number}|null|undefined,reach=150){
  if(!from)return null;
  for(const p of pads)if(p.look)return {x:from.x+p.look.x*reach,y:from.y+p.look.y*reach};
  return null;
}

/** Second keyboard player in local versus: arrows plus the keys around them. Player one's own bindings always win. */
export const P2_KEYS: Readonly<Record<string,PadAction>>=Object.freeze({
  arrowup:'up',arrowdown:'down',arrowleft:'left',arrowright:'right',
  '.':'strike','/':'heavy',',':'guard',';':'dash','l':'jump','m':'feint','n':'force',"'":'technique',
});

/** Held-through guard. After Resume, whatever a pad was already holding stays neutral until it lets go:
 *  a button until it is released, a stick until it returns to centre. A fresh press or push then works at once. */
export function createPadLatch(){
  const latched=new Map<number,{held:Set<PadAction>;stick:boolean;look:boolean}>();
  return {
    /** Latch everything currently held on every pad. */
    hold(pads:readonly PadState[]){
      latched.clear();
      for(const p of pads)latched.set(p.index,{held:new Set(p.held),stick:Boolean(p.stick.x||p.stick.y),look:Boolean(p.look)});
    },
    /** Called once a frame with the raw read: anything released or recentred is free again. */
    update(pads:readonly PadState[]){
      const live=new Map(pads.map(p=>[p.index,p]));
      for(const [index,l] of latched){
        const p=live.get(index);
        if(!p){latched.delete(index);continue;}
        for(const a of l.held)if(!p.held.has(a))l.held.delete(a);
        if(!(p.stick.x||p.stick.y))l.stick=false;
        if(!p.look)l.look=false;
        if(!l.held.size&&!l.stick&&!l.look)latched.delete(index);
      }
    },
    /** The pads as the fighters should see them. */
    filter(pads:readonly PadState[]):PadState[] {
      return pads.map(p=>{
        const l=latched.get(p.index);
        if(!l)return p;
        return {...p,held:new Set([...p.held].filter(a=>!l.held.has(a))),stick:l.stick?{x:0,y:0}:p.stick,look:l.look?null:p.look};
      });
    },
    get active(){return latched.size>0;},
  };
}

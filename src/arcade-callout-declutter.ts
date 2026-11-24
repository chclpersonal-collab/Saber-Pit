/**
 * Presentation-only clean-up for combat callouts in big team fights. It reads
 * candidate labels and returns the ones worth drawing: the same label close
 * together merges into one with a count, overlapping boxes keep the higher
 * priority, and the total stays under a crowd budget. No sim reads or writes.
 */

export interface ArcadeCalloutCandidate {
  actor:string;label:string;x:number;y:number;priority:number;focus?:boolean;
}
export interface ArcadeCalloutShown extends ArcadeCalloutCandidate {
  /** How many same-label callouts this one stands for. */
  count:number;
  actors:readonly string[];
}
export interface ArcadeCalloutOptions {
  /** Same label within this many pixels merges into one. */
  mergeRadius?:number;
  /** Box size used to test overlap between different labels. */
  boxWidth?:number;boxHeight?:number;
  /** Most labels on screen at once. */
  budget?:number;
}

const order=(a:ArcadeCalloutCandidate,b:ArcadeCalloutCandidate)=>
  b.priority-a.priority||Number(Boolean(b.focus))-Number(Boolean(a.focus))||(a.actor<b.actor?-1:a.actor>b.actor?1:0);

/** Crowd budget: 6 labels for small fights, falling to 3 once there are 16 or more fighters. */
export function arcadeCalloutBudget(fighters:number):number{
  return fighters>=16?3:fighters>=8?4:6;
}

export function declutterArcadeCallouts(candidates:readonly ArcadeCalloutCandidate[],options:ArcadeCalloutOptions={}):ArcadeCalloutShown[]{
  const mergeRadius=options.mergeRadius??90, w=options.boxWidth??96, h=options.boxHeight??26, budget=Math.max(1,options.budget??6);
  const sorted=candidates.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.label).slice().sort(order);
  const groups:{lead:ArcadeCalloutCandidate;members:ArcadeCalloutCandidate[]}[]=[];
  for(const c of sorted){
    const g=groups.find(g=>g.lead.label===c.label&&Math.hypot(g.lead.x-c.x,g.lead.y-c.y)<=mergeRadius);
    if(g)g.members.push(c);else groups.push({lead:c,members:[c]});
  }
  const shown:ArcadeCalloutShown[]=[];
  for(const g of groups){
    if(shown.length>=budget)break;
    const x=g.members.reduce((t,m)=>t+m.x,0)/g.members.length, y=Math.min(...g.members.map(m=>m.y));
    // A focus label (the player's own fighter) always keeps its spot.
    const clash=shown.some(s=>Math.abs(s.x-x)<w&&Math.abs(s.y-y)<h);
    if(clash&&!g.lead.focus)continue;
    shown.push(Object.freeze({...g.lead,x:Math.round(x),y:Math.round(y),count:g.members.length,actors:Object.freeze(g.members.map(m=>m.actor))}));
  }
  return shown;
}

/** Text to draw, e.g. "BLADE CLASH ×3". */
export function arcadeCalloutText(c:Pick<ArcadeCalloutShown,'label'|'count'>):string{
  return c.count>1?`${c.label} ×${c.count}`:c.label;
}

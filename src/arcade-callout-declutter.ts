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

/** Cue family: "KO · TORSO" and "KO · HEAD" are both KO, "PERFECT PARRY" is PARRY. */
export function arcadeCalloutFamily(label:string):string{
  const head=label.split(' · ')[0].trim().toUpperCase();
  if(head.startsWith('KO')||head==='KNOCKOUT')return 'KO';
  if(head.includes('PARRY'))return 'PARRY';
  return head;
}

type Group={lead:ArcadeCalloutCandidate;members:ArcadeCalloutCandidate[];focus:boolean};
const KEY_FAMILIES=['KO','PARRY'];
const familyRank=(f:string)=>{const i=KEY_FAMILIES.indexOf(f);return i<0?KEY_FAMILIES.length:i;};

function shownFrom(g:Group,label=g.lead.label):ArcadeCalloutShown{
  const x=g.members.reduce((t,m)=>t+m.x,0)/g.members.length, y=Math.min(...g.members.map(m=>m.y));
  return Object.freeze({...g.lead,label,focus:g.focus,x:Math.round(x),y:Math.round(y),count:g.members.length,actors:Object.freeze(g.members.map(m=>m.actor))});
}

/**
 * Focus labels (the player's own fighter) are never merged into another
 * fighter's label and never dropped by the budget or by overlap. When more
 * groups want the screen than the budget allows, the rest fold into one
 * label per cue family ("KO ×4", "PARRY ×2"), KO and parry first, so a burst
 * of knockouts or parries still reads instead of vanishing. KO and parry
 * are never dropped: on overlap they move up a line, and over budget their
 * family lines are kept even when the player's own labels fill the budget.
 */
export function declutterArcadeCallouts(candidates:readonly ArcadeCalloutCandidate[],options:ArcadeCalloutOptions={}):ArcadeCalloutShown[]{
  const mergeRadius=options.mergeRadius??90, w=options.boxWidth??96, h=options.boxHeight??26, budget=Math.max(1,options.budget??6);
  const overlaps=(a:ArcadeCalloutShown,b:ArcadeCalloutShown)=>Math.abs(a.x-b.x)<w&&Math.abs(a.y-b.y)<h;
  const nudged=(next:ArcadeCalloutShown,taken:readonly ArcadeCalloutShown[])=>{
    for(let step=0;step<4&&taken.some(s=>overlaps(s,next));step++)next=Object.freeze({...next,y:next.y-h});
    return next;
  };
  const sorted=candidates.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.label).slice().sort(order);
  const focusGroups:Group[]=[], groups:Group[]=[];
  for(const c of sorted){
    if(c.focus){
      const g=focusGroups.find(g=>g.lead.label===c.label&&Math.hypot(g.lead.x-c.x,g.lead.y-c.y)<=mergeRadius);
      if(g)g.members.push(c);else focusGroups.push({lead:c,members:[c],focus:true});
      continue;
    }
    const g=groups.find(g=>g.lead.label===c.label&&Math.hypot(g.lead.x-c.x,g.lead.y-c.y)<=mergeRadius);
    if(g)g.members.push(c);else groups.push({lead:c,members:[c],focus:false});
  }
  const shown:ArcadeCalloutShown[]=focusGroups.map(g=>shownFrom(g));
  const room=Math.max(0,budget-shown.length);
  if(groups.length<=room){
    for(const g of groups){
      let next=shownFrom(g);
      const key=familyRank(arcadeCalloutFamily(g.lead.label))<KEY_FAMILIES.length;
      // Plain cues give way on overlap; a KO or parry is nudged up instead of dropped.
      if(!key&&shown.some(s=>overlaps(s,next)))continue;
      next=nudged(next,shown);
      shown.push(next);
    }
    return shown;
  }
  // Over budget: one label per family, KO and parry first, then by priority and size.
  const families=new Map<string,Group>();
  for(const g of groups){
    const fam=arcadeCalloutFamily(g.lead.label);
    const f=families.get(fam);
    if(f)f.members.push(...g.members);else families.set(fam,{lead:g.lead,members:[...g.members],focus:false});
  }
  const ranked=[...families.entries()].sort(([a,ga],[b,gb])=>familyRank(a)-familyRank(b)||gb.lead.priority-ga.lead.priority||
    gb.members.length-ga.members.length||(a<b?-1:a>b?1:0));
  // KO and parry always get their line, even when focus labels fill the budget;
  // other families share whatever room is left.
  const keys=ranked.filter(([fam])=>familyRank(fam)<KEY_FAMILIES.length);
  const rest=ranked.filter(([fam])=>familyRank(fam)>=KEY_FAMILIES.length).slice(0,Math.max(0,room-keys.length));
  const picked=keys.length||rest.length?[...keys,...rest]:ranked.slice(0,1);
  for(const [fam,g] of picked){
    // Sit on the lead's spot, nudged up past any label already there instead of dropping.
    let next=shownFrom({...g,members:g.members},g.members.length>1?fam:g.lead.label);
    next=nudged(Object.freeze({...next,x:Math.round(g.lead.x),y:Math.round(g.lead.y)}),shown);
    shown.push(next);
  }
  return shown;
}

/** Text to draw, e.g. "BLADE CLASH ×3". */
export function arcadeCalloutText(c:Pick<ArcadeCalloutShown,'label'|'count'>):string{
  return c.count>1?`${c.label} ×${c.count}`:c.label;
}

import {ARCADE_FORCE_POOL,normalizeArcadeForcePool,type ArcadeForcePoolId} from './arcade-force-pool.js';

const LIMIT=3;
export const MIXED_FORCE_TRIO=['force_push','force_anchor','force_siphon'] as const;
export function toggleArenaForceCard(pool:unknown,id:ArcadeForcePoolId){
  const current=normalizeArcadeForcePool(pool);
  if(current.includes(id))return current.filter(key=>key!==id);
  return current.length<LIMIT?normalizeArcadeForcePool([...current,id]):current;
}

export function createArenaForcePicker(side:string,onSelect:(pool:ArcadeForcePoolId[])=>void){
  const make=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string)=>{
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(className)node.className=className;
    return node;
  };
  const element=make('details',undefined,'force-pool');
  element.dataset.forceSetting='';
  const summary=make('summary'), count=make('span',undefined,'force-card-count');
  summary.append(make('span','AI Force loadout'),count);
  const notes=make('p',undefined,'force-card-note'), grid=make('div',undefined,'force-card-grid');
  grid.setAttribute('role','group');grid.setAttribute('aria-label',side+' AI Force powers');
  const actions=make('div',undefined,'force-card-actions');
  const mixed=make('button','Mixed trio'),clear=make('button','Clear');
  mixed.type=clear.type='button';
  actions.append(mixed,clear);
  const status=make('span',undefined,'sr');status.setAttribute('role','status');
  let pool:ArcadeForcePoolId[]=[],inactive=false;
  const cards=ARCADE_FORCE_POOL.map(power=>{
    const button=make('button',undefined,'force-card');
    button.type='button';
    const order=make('b',undefined,'force-card-order'), spokenOrder=make('span',undefined,'sr');
    const label=make('strong',power.label), stat=make('small',power.cost+' stamina · '+power.cooldown.toFixed(1)+' s cooldown');
    const effect=make('span',power.description),range=make('small',power.range===0?(power.id==='force_lattice'?'Self':'Movement'):power.range+' px range');
    const heading=make('span',undefined,'force-card-heading');
    order.setAttribute('aria-hidden','true');heading.append(label,order);
    button.append(heading,stat,range,effect,spokenOrder);
    button.addEventListener('click',()=>{
      if(inactive)return;
      if(pool.length===LIMIT&&!pool.includes(power.id)){
        status.textContent='Three selected. Remove a power before adding another.';return;
      }
      apply(toggleArenaForceCard(pool,power.id));
    });
    grid.append(button);
    return {power,button,order,spokenOrder};
  });
  function apply(next:ArcadeForcePoolId[]){
    onSelect(next);
    const ordered=next.map(id=>ARCADE_FORCE_POOL.find(power=>power.id===id)?.label).join(', ');
    status.textContent=next.length?next.length+' of 3 selected: '+ordered+'.':'Cleared. Uses Primary Force.';
  }
  mixed.addEventListener('click',()=>{if(!inactive)apply([...MIXED_FORCE_TRIO]);});
  clear.addEventListener('click',()=>{if(!inactive&&pool.length)apply([]);});
  element.append(summary,notes,grid,actions,status);
  function render(value:unknown,disabled:boolean){
    pool=normalizeArcadeForcePool(value);inactive=disabled;
    count.textContent=pool.length+' / 3';
    notes.textContent=inactive?'No Blue AI in this match. Selections are kept.':pool.length?
      'Custom AI Force makes this match unrated. It won’t replace your saved run.':
      'Choose up to three AI powers. Empty uses Primary Force.';
    mixed.disabled=inactive;clear.disabled=inactive;clear.setAttribute('aria-disabled',String(pool.length===0));
    for(const {power,button,order,spokenOrder} of cards){
      const pos=pool.indexOf(power.id);
      order.textContent=pos===-1?'':String(pos+1);
      spokenOrder.textContent=pos===-1?'':'Selection '+(pos+1)+' of '+pool.length;
      button.setAttribute('aria-pressed',String(pos!==-1));
      button.setAttribute('aria-disabled',String(inactive||(pool.length===LIMIT&&pos===-1)));
      button.disabled=inactive;
    }
  }
  return {element,render};
}

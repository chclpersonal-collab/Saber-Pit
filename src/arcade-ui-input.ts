import type {ArenaElements} from './game-dom.js';

type DynamicSelect = `slotForm${number}-${number}`;
type ArenaId = keyof ArenaElements | DynamicSelect;
type ArenaNode<I extends ArenaId> = I extends keyof ArenaElements ? ArenaElements[I] : HTMLSelectElement;
/** Static DOM IDs are installed by the Arena page before it loads its entry. */
export function arenaNode<I extends ArenaId>(id:I):ArenaNode<I> {
  return document.getElementById(id) as ArenaNode<I>;
}
export interface ArenaTouchPreferences {layout:'arrows'|'stick';side:'left'|'right'}
export const touchPrefsKey='saber-pit-touch-v1';
export function readTouchPrefs():ArenaTouchPreferences{
  try{
    const p:unknown=JSON.parse(localStorage.getItem(touchPrefsKey) as string);
    const value=p as Partial<ArenaTouchPreferences>|null|undefined;
    return {layout:value?.layout==='arrows'?'arrows':'stick',side:value?.side==='left'?'left':'right'};
  }catch{return {layout:'stick',side:'right'};}
}

interface Point { x:number; y:number }
interface InputFrame {
  held(name:string):boolean;
  pulse:ReadonlySet<string>;
  fromStick:Point;
  aim:Point|null;
  touchWalk:boolean;
  technique():string;
}
export function arenaInputFrame<Order>({held,pulse,fromStick,aim,touchWalk,technique}:InputFrame,order:Order){
  const read=(name:string)=>held(name)||pulse.has(name);
  const dx=Number(held('right'))-Number(held('left')),dy=Number(held('down'))-Number(held('up'));
  return {phase:pulse.has('phase'),feint:pulse.has('feint'),jump:pulse.has('jump'),x:dx||dy?dx:fromStick.x,y:dx||dy?dy:fromStick.y,
    walk:held('walk')||touchWalk,technique:read('technique')?technique():null,force:read('force'),order,
    strike:read('strike'),heavy:read('heavy'),dash:read('dash'),guard:read('guard'),aimX:aim?.x,aimY:aim?.y};
}

import type {SaveStorage, StorageReader} from './arcade-save-types.js?v=6.0.2';

/** Keyboard bindings for the Arena. Stored on this device only, never in a save or a backup. */
export const KEY_BINDINGS_KEY='saber-pit-keys-v1';
export const KEY_ACTIONS=[
  ['up','Move Up'],['down','Move Down'],['left','Move Left'],['right','Move Right'],
  ['strike','Slash'],['heavy','Signature'],['guard','Guard'],['dash','Dash'],['jump','Jump'],
  ['feint','Feint'],['force','Force'],['technique','Technique'],['phase','Extend Blade'],['walk','Walk'],
  ['stats','Scoreboard (Hold)'],
] as const;
export type KeyAction = typeof KEY_ACTIONS[number][0];
export type KeyBindings = Record<KeyAction,string>;

export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindings>=Object.freeze({
  up:'w',down:'s',left:'a',right:'d',strike:'j',heavy:'k',guard:' ',dash:'shift',jump:'q',
  feint:'x',force:'f',technique:'r',phase:'v',walk:'c',stats:'b',
});
/**
 * Actions added after players could save keys. If a saved binding already uses the new
 * action's default, the player's binding wins and the new action takes the first free key.
 */
const ADDED_ACTIONS: ReadonlySet<KeyAction>=new Set<KeyAction>(['stats']);
const SPARE_KEYS=[...'nmghtyuioezl','abcdefghijklmnopqrstuvwxyz','0123456789'];
/** Arrows always move, unless the player gives that arrow to another action. */
const ARROWS: Readonly<Record<string,KeyAction>>={arrowup:'up',arrowdown:'down',arrowleft:'left',arrowright:'right'};
/** Pause and menu keys stay fixed so nobody can lock themselves out. */
export const RESERVED_KEYS: ReadonlySet<string>=new Set(['escape','p','tab','enter','meta','alt','control','contextmenu','os','process','compose']);
const ACTION_IDS=new Set<string>(KEY_ACTIONS.map(([id])=>id));
const local=(): Storage | null=>{try{return globalThis.localStorage??null;}catch{return null;}};

/** Normalise a KeyboardEvent.key the way the Arena reads it. */
export function normalizeKey(key: string): string {return key.toLowerCase();}
export function canBind(key: string): boolean {
  const k=normalizeKey(key);
  return k.length>0&&k.length<=32&&k!=='dead'&&k!=='unidentified'&&!Object.hasOwn(Object.prototype,k)&&!RESERVED_KEYS.has(k)&&!/^f\d{1,2}$/.test(k)&&!k.startsWith('audio')&&!k.startsWith('media');
}
export function keyLabel(key: string): string {
  const k=normalizeKey(key);
  const names: Record<string,string>={' ':'Space',shift:'Shift',arrowup:'↑',arrowdown:'↓',arrowleft:'←',arrowright:'→',backspace:'Backspace',capslock:'Caps'};
  return names[k]??(k.length<=1?k.toUpperCase():k[0]!.toUpperCase()+k.slice(1));
}

/** Read saved bindings; anything missing, unknown, reserved or duplicated falls back to the default. */
export function loadKeyBindings(storage: StorageReader | null=local()): KeyBindings {
  const out: KeyBindings={...DEFAULT_KEY_BINDINGS};
  let saved: unknown=null;
  try{saved=storage?JSON.parse(storage.getItem(KEY_BINDINGS_KEY)??'null'):null;}catch{saved=null;}
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return out;
  const used=new Set<string>();
  for(const [action,key] of Object.entries(saved as Record<string,unknown>)){
    if(!ACTION_IDS.has(action)||typeof key!=='string'||!canBind(key))continue;
    const k=normalizeKey(key);
    if(used.has(k))return {...DEFAULT_KEY_BINDINGS};
    used.add(k);out[action as KeyAction]=k;
  }
  for(const action of ADDED_ACTIONS){
    if(Object.hasOwn(saved,action)&&out[action]!==DEFAULT_KEY_BINDINGS[action])continue;
    const others=(Object.keys(out) as KeyAction[]).filter(id=>id!==action).map(id=>out[id]);
    if(!others.includes(out[action]))continue;
    const spare=SPARE_KEYS.find(k=>!others.includes(k)&&canBind(k));
    if(spare)out[action]=spare;
  }
  return Object.values(out).length===new Set(Object.values(out)).size?out:{...DEFAULT_KEY_BINDINGS};
}
export function saveKeyBindings(bindings: KeyBindings,storage: SaveStorage | null=local()): boolean {
  try{
    if(!storage)return false;
    const changed=Object.fromEntries(KEY_ACTIONS.map(([id])=>id).filter(id=>bindings[id]!==DEFAULT_KEY_BINDINGS[id]).map(id=>[id,bindings[id]]));
    if(Object.keys(changed).length)storage.setItem(KEY_BINDINGS_KEY,JSON.stringify(changed));else storage.removeItem(KEY_BINDINGS_KEY);
    return true;
  }catch{return false;}
}
/** Give `key` to `action`. If another action had it, the two swap, so every action keeps a key. */
export function rebindKey(bindings: KeyBindings,action: KeyAction,key: string): KeyBindings | null {
  if(!canBind(key))return null;
  const k=normalizeKey(key), next: KeyBindings={...bindings};
  const holder=(Object.keys(next) as KeyAction[]).find(id=>next[id]===k&&id!==action);
  if(holder)next[holder]=bindings[action];
  next[action]=k;
  return next;
}
/** Key to action, as the Arena's input reads it. With default bindings this equals the original fixed map. */
export function keyMapFrom(bindings: KeyBindings): Record<string,KeyAction> {
  const map: Record<string,KeyAction>={};
  const taken=new Set(Object.values(bindings));
  for(const [arrow,action] of Object.entries(ARROWS))if(!taken.has(arrow))map[arrow]=action;
  for(const [action,key] of Object.entries(bindings) as [KeyAction,string][])map[key]=action;
  return map;
}
/** True for targets where typing must never trigger a game key. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el=target as HTMLElement | null;
  if(!el||typeof el.tagName!=='string')return false;
  return ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.isContentEditable===true||Boolean(el.closest?.('input,textarea,select'));
}

/** Match key-up by physical code whenever available. Distinct aliases can be held together. */
export function createHeldArenaKeys(keys: Set<string>){
  const held=new Map<string,string>();
  const source=(event: Pick<KeyboardEvent,'code'|'key'>)=>event.code||normalizeKey(event.key);
  return {
    press(event: Pick<KeyboardEvent,'code'|'key'>,action:string){
      held.set(source(event),action);keys.add(action);
    },
    release(event: Pick<KeyboardEvent,'code'|'key'>){
      const id=source(event),action=held.get(id);
      if(action===undefined)return;
      held.delete(id);if(![...held.values()].includes(action))keys.delete(action);
    },
    clear(){held.clear();keys.clear();},
  };
}

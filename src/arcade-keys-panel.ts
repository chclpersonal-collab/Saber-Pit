import {KEY_ACTIONS,DEFAULT_KEY_BINDINGS,canBind,keyLabel,keyMapFrom,loadKeyBindings,rebindKey,saveKeyBindings} from './arcade-keys.js';
import type {KeyAction,KeyBindings} from './arcade-keys.js';

/**
 * The Keys dialog: one row per action, press a row then press a key. Escape cancels a capture.
 * While it is open the Arena ignores every key, so nothing fires behind it.
 */
export function mountKeysPanel(onChange: (map: Record<string,KeyAction>, bindings: KeyBindings) => void){
  const dialog=document.getElementById('keysDialog') as HTMLDialogElement | null;
  const keyList=document.getElementById('keysList'), status=document.getElementById('keysStatus');
  const resetButton=document.getElementById('keysReset') as HTMLButtonElement | null;
  if(!dialog||!keyList||!status||!resetButton)return {open(){},bindings:()=>loadKeyBindings()};
  const list:HTMLElement=keyList, reset:HTMLButtonElement=resetButton;
  let bindings=loadKeyBindings(), capturing: KeyAction | null=null;
  const say=(text: string)=>{status.textContent=text;};
  function render(){
    list.replaceChildren(...KEY_ACTIONS.map(([id,label])=>{
      const row=document.createElement('li'), name=document.createElement('span'), button=document.createElement('button');
      name.textContent=label;name.id='keyName-'+id;
      button.type='button';button.dataset.bind=id;
      button.setAttribute('aria-describedby','keyName-'+id);
      const waiting=capturing===id;
      button.textContent=waiting?'Press a Key':keyLabel(bindings[id]);
      button.setAttribute('aria-label',label+': '+(waiting?'Press a Key':keyLabel(bindings[id])));
      if(bindings[id]!==DEFAULT_KEY_BINDINGS[id])row.dataset.changed='true';
      if(waiting)button.dataset.waiting='true';
      row.append(name,button);return row;
    }));
    reset.disabled=KEY_ACTIONS.every(([id])=>bindings[id]===DEFAULT_KEY_BINDINGS[id]);
  }
  function apply(next: KeyBindings,message: string){
    bindings=next;const saved=saveKeyBindings(bindings);render();onChange(keyMapFrom(bindings),bindings);say(saved?message:message+', this tab only');
  }
  function focusRow(id: KeyAction){list.querySelector<HTMLButtonElement>(`[data-bind="${id}"]`)?.focus();}
  list.addEventListener('click',e=>{
    const id=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-bind]')?.dataset.bind as KeyAction | undefined;
    if(!id)return;
    capturing=capturing===id?null:id;render();focusRow(id);
    if(capturing)say('Press a key: '+KEY_ACTIONS.find(([a])=>a===id)![1]);
  });
  // Capture phase on the dialog: the key never reaches anything else while choosing.
  dialog.addEventListener('keydown',e=>{
    if(!capturing)return;
    const id=capturing;
    if(e.key==='Tab'){capturing=null;render();focusRow(id);say('Kept '+keyLabel(bindings[id]));return;}
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    e.preventDefault();e.stopPropagation();
    if(e.key==='Escape'){capturing=null;render();focusRow(id);say('Kept '+keyLabel(bindings[id]));return;}
    if(e.repeat)return;
    if(!canBind(e.key)){say(keyLabel(e.key)+' reserved, pick another');return;}
    const next=rebindKey(bindings,id,e.key)!;
    const swapped=(Object.keys(next) as KeyAction[]).find(a=>a!==id&&next[a]!==bindings[a]);
    capturing=null;
    apply(next,KEY_ACTIONS.find(([a])=>a===id)![1]+': '+keyLabel(next[id])+(swapped?', '+KEY_ACTIONS.find(([a])=>a===swapped)![1]+': '+keyLabel(next[swapped]):''));
    focusRow(id);
  },true);
  // Escape while choosing cancels the choice, not the dialog.
  dialog.addEventListener('cancel',e=>{if(capturing)e.preventDefault();});
  dialog.addEventListener('close',()=>{capturing=null;say('');});
  reset.addEventListener('click',()=>{capturing=null;apply({...DEFAULT_KEY_BINDINGS},'Default keys restored');focusRow('strike');});
  render();
  return {open(){capturing=null;render();say('');dialog.showModal();focusRow('strike');},bindings:()=>bindings};
}

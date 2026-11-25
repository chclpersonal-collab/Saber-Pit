/** LOOMEN v6 chrome for the pages outside the Arena (Tournament, Gauntlet, Saves, Idle RPG, Style Lab, Three Fronts).
 *  Adds the same bottom nav as Home and opens a section named in the address. Look and links only:
 *  nothing here reads or writes a save, and every page keeps its own scripts. Authored by CLARISSA-01. */
const ICON={
  home:'<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3Z"/>',
  stats:'<path d="M4 20V10h3v10Zm6.5 0V4h3v16ZM17 20v-7h3v7ZM2 21h20v1.5H2Z"/>',
  heroes:'<circle cx="12" cy="7.5" r="4.5"/><path d="M3 21c0-5 4-8 9-8s9 3 9 8Z"/>',
  saves:'<path d="M4 3h16v18H4Zm4 4v10h8V7Z"/>',
  settings:'<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 4.6-.1-2.4 2-1.6-2-3.4-2.4.9a8 8 0 0 0-2-1.2L15.5 3h-4l-.4 2.5a8 8 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a8 8 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a8 8 0 0 0 2 1.2l.4 2.5h4l.4-2.5a8 8 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6Z"/>'} as const;
type Key=keyof typeof ICON;
const ITEMS:[Key,string,string][]=[['home','Home','./index.html'],['stats','Stats','./index.html#stats'],
  ['heroes','Heroes','./tournament.html#heroesPanel'],['saves','Saves','./backup.html'],['settings','Settings','./index.html#settings']];

export function currentNavKey(path:string,hash:string):Key|null{
  const page=path.split('/').pop()||'index.html';
  if(page==='backup.html')return 'saves';
  if(page==='tournament.html'&&hash==='#heroesPanel')return 'heroes';
  return null;
}
function mountNav(){
  if(document.querySelector('.v6p-nav'))return;
  const nav=document.createElement('nav');nav.className='v6p-nav';nav.setAttribute('aria-label','Menu');
  const current=currentNavKey(location.pathname,location.hash);
  for(const [key,label,href] of ITEMS){
    const a=document.createElement('a');a.href=href;
    if(key===current)a.setAttribute('aria-current','page');
    a.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICON[key]}</svg>`;
    const span=document.createElement('span');span.textContent=label;a.append(span);nav.append(a);
  }
  document.body.append(nav);
}
function openNamedSection(){
  const id=decodeURIComponent(location.hash.slice(1));
  if(!id)return;
  const target=document.getElementById(id);
  if(target instanceof HTMLDetailsElement)target.open=true;
  target?.scrollIntoView({block:'start'});
}
if(typeof document!=='undefined'){
  mountNav();openNamedSection();
  addEventListener('hashchange',()=>{openNamedSection();
    for(const a of document.querySelectorAll('.v6p-nav a'))a.toggleAttribute('aria-current',false);
    const key=currentNavKey(location.pathname,location.hash);
    if(key)document.querySelector(`.v6p-nav a[href$="${ITEMS.find(i=>i[0]===key)![2].replace('./','')}"]`)?.setAttribute('aria-current','page');});
}

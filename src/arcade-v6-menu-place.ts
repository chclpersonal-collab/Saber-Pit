/** ⋯ menus and (i) notes open inside the screen: placed against the viewport, never cut by the card around them,
 *  and flipped above their button when there is no room below. Closing hands them back to the stylesheet. */
const MENU=':scope>:is(.v5-more-menu,.v6p-more-menu,.v6-info-pop)';
const EDGE=8, GAP=6;
const open=new Set<HTMLDetailsElement>();

export function placeMenu(d:HTMLDetailsElement){
  const m=d.querySelector<HTMLElement>(MENU),s=d.querySelector<HTMLElement>(':scope>summary');
  if(!m||!s)return;
  const vw=document.documentElement.clientWidth,vh=innerHeight;
  Object.assign(m.style,{position:'fixed',left:'0px',top:'0px',right:'auto',bottom:'auto',maxWidth:`${vw-2*EDGE}px`,maxHeight:'',overflowY:''});
  // A transformed ancestor moves the fixed origin; measure where (0,0) landed and work from there.
  const origin=m.getBoundingClientRect(),sr=s.getBoundingClientRect();
  const w=m.offsetWidth,h=m.offsetHeight;
  const want=m.classList.contains('v6-info-pop')?sr.left-10:sr.right-w;
  const left=Math.max(EDGE,Math.min(want,vw-EDGE-w));
  // The fixed bottom nav counts as the bottom of the screen, so a menu never opens under it.
  const nav=d.closest('dialog')?null:document.querySelector<HTMLElement>('.v6p-nav'),nr=nav?.getBoundingClientRect();
  const floor=nr&&nr.height&&nr.top<vh?Math.min(vh,nr.top):vh;
  const below=floor-EDGE-sr.bottom-GAP,above=sr.top-GAP-EDGE;
  let x=left,y:number;
  if(h<=below||h<=above){y=h<=below?sr.bottom+GAP:sr.top-GAP-h;}
  else{
    // Short landscape screens: neither side has room, so the menu opens beside its button at full height.
    const tall=floor-2*EDGE;
    if(h>tall)Object.assign(m.style,{maxHeight:`${Math.max(0,tall)}px`,overflowY:'auto'});
    const fit=Math.min(h,tall),side=sr.left-GAP-w>=EDGE?sr.left-GAP-w:sr.right+GAP;
    x=Math.max(EDGE,Math.min(side,vw-EDGE-w));
    y=Math.max(EDGE,Math.min(sr.top+sr.height/2-fit/2,floor-EDGE-fit));
  }
  Object.assign(m.style,{left:`${x-origin.left}px`,top:`${y-origin.top}px`});
}
function release(d:HTMLDetailsElement){
  const m=d.querySelector<HTMLElement>(MENU);
  if(m)for(const k of ['position','left','top','right','bottom','maxWidth','maxHeight','overflowY'] as const)m.style[k]='';
}
const replace=()=>{for(const d of open)d.isConnected&&d.open?placeMenu(d):open.delete(d);};
if(typeof document!=='undefined'){
  document.addEventListener('toggle',e=>{
    const d=e.target;
    if(!(d instanceof HTMLDetailsElement)||!d.querySelector(MENU))return;
    if(d.open){open.add(d);placeMenu(d);}else{open.delete(d);release(d);}
  },true);
  addEventListener('scroll',e=>{const t=e.target;if(t instanceof Element&&t.closest(':is(.v5-more-menu,.v6p-more-menu,.v6-info-pop)'))return;replace();},{capture:true,passive:true});
  addEventListener('resize',replace);
  // Escape closes the newest open menu first (before any dialog it sits in) and hands focus back to its button.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const d=[...open].reverse().find(x=>x.isConnected&&x.open);if(!d)return;
    e.preventDefault();e.stopPropagation();d.open=false;d.querySelector<HTMLElement>(':scope>summary')?.focus();
  },true);
}

/** LOOMEN v6 two players on one phone: a compact stick-and-buttons pad for each player.
 *  Portrait: Player 1 at the bottom, Player 2 at the top turned to face them across the table.
 *  Landscape: Player 1 holds the left end, Player 2 the right end. Nothing is saved. */
export interface VsTouchPlayer {held:Set<string>;pulse:Set<string>;stick:{x:number;y:number}}
const BUTTONS: readonly (readonly [string,string])[]=[['guard','Guard'],['dash','Dash'],['jump','Jump'],['technique','Tech'],['heavy','Heavy'],['strike','Slash']];
const PULSED=new Set(['strike','heavy','dash','guard','technique','jump']);

/** Drag from the stick's centre to a move vector: full speed at `radius`, nothing inside a small dead zone. */
export function stickVector(dx:number,dy:number,radius:number,dead=.14){
  const m=Math.hypot(dx,dy);
  if(!Number.isFinite(m)||radius<=0||m/radius<dead)return {x:0,y:0};
  const k=Math.min(1,m/radius)/m;
  return {x:dx*k,y:dy*k};
}

export function mountVersusTouch(host:HTMLElement){
  const players:[VsTouchPlayer,VsTouchPlayer]=[0,1].map(()=>({held:new Set<string>(),pulse:new Set<string>(),stick:{x:0,y:0}})) as [VsTouchPlayer,VsTouchPlayer];
  const pads=players.map((player,i)=>{
    const pad=document.createElement('div');
    pad.className='vs-pad';pad.id='vsPad'+(i+1);pad.dataset.player=String(i+1);
    pad.setAttribute('role','group');pad.setAttribute('aria-label','Player '+(i+1)+' controls');
    const stick=document.createElement('div'),knob=document.createElement('span');
    stick.className='vs-stick';knob.className='vs-knob';stick.append(knob);stick.setAttribute('aria-hidden','true');
    let owner:number|null=null;
    const move=(e:PointerEvent)=>{
      const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,radius=r.width*.38;
      // Screen direction is arena direction, so Player 2's turned pad needs no flip.
      player.stick=stickVector(e.clientX-cx,e.clientY-cy,radius);
      const k=Math.min(1,Math.hypot(e.clientX-cx,e.clientY-cy)/radius)||0,a=Math.atan2(e.clientY-cy,e.clientX-cx);
      knob.style.translate=k?`${Math.cos(a)*k*radius}px ${Math.sin(a)*k*radius}px`:'';
      // Undo the pad's own turn for the knob drawing.
      if(pad.dataset.turned==='true')knob.style.translate=k?`${-Math.cos(a)*k*radius}px ${-Math.sin(a)*k*radius}px`:'';
    };
    const release=(e:PointerEvent)=>{if(e.pointerId!==owner)return;owner=null;player.stick={x:0,y:0};knob.style.translate='';};
    stick.addEventListener('pointerdown',e=>{e.preventDefault();owner=e.pointerId;try{stick.setPointerCapture(e.pointerId);}catch{}move(e);});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===owner)move(e);});
    for(const t of ['pointerup','pointercancel','lostpointercapture'] as const)stick.addEventListener(t,release);
    const grid=document.createElement('div');grid.className='vs-buttons';
    grid.append(...BUTTONS.map(([action,label])=>{
      const b=document.createElement('button');b.type='button';b.dataset.p=action;b.textContent=label;
      b.setAttribute('aria-label','Player '+(i+1)+' '+label);
      const down=new Set<number>();
      const off=(e:PointerEvent)=>{if(!down.delete(e.pointerId))return;if(!down.size){player.held.delete(action);b.dataset.held='false';}};
      b.addEventListener('pointerdown',e=>{e.preventDefault();down.add(e.pointerId);try{b.setPointerCapture(e.pointerId);}catch{}
        player.held.add(action);if(PULSED.has(action))player.pulse.add(action);b.dataset.held='true';});
      for(const t of ['pointerup','pointercancel','lostpointercapture'] as const)b.addEventListener(t,off);
      b.addEventListener('contextmenu',e=>e.preventDefault());
      return b;
    }));
    pad.append(stick,grid);host.append(pad);
    return pad;
  });
  function clear(){
    for(const p of players){p.held.clear();p.pulse.clear();p.stick={x:0,y:0};}
    for(const k of host.querySelectorAll<HTMLElement>('.vs-knob'))k.style.translate='';
    for(const b of host.querySelectorAll<HTMLElement>('.vs-pad button'))b.dataset.held='false';
  }
  return {
    players,pads,clear,
    /** Show or hide each pad; portrait turns Player 2 to face across the table. */
    sync(show:readonly [boolean,boolean],portrait:boolean){
      pads.forEach((pad,i)=>{pad.hidden=!show[i];pad.dataset.turned=String(i===1&&portrait);});
      if(!show[0]&&!show[1])clear();
    },
  };
}

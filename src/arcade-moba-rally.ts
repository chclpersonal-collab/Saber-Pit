/** Opt-in, fixed-tick center objective. No account, save or other mode state. */
export const BELL_RALLY_RULES=Object.freeze({
  firstTick:2190,windowTicks:660,periodTicks:4320,holdTicks:180,radius:52,
  reinforceFraction:.35,reinforceCap:22,
});
type Team=0|1;
export type BellRally={nextTick:number;untilTick:number;holder:Team|null;heldTicks:number;contested:boolean;
  reward:Team|null;winner:Team|null;phase:'waiting'|'open'|'claimed';wins:[number,number]};
export const createBellRally=():BellRally=>({nextTick:BELL_RALLY_RULES.firstTick,untilTick:0,holder:null,heldTicks:0,contested:false,
  reward:null,winner:null,phase:'waiting',wins:[0,0]});
export function stepBellRally(rally:BellRally,tick:number,presence:readonly[boolean,boolean]){
  const rules=BELL_RALLY_RULES;
  if(rally.phase!=='open'){
    if(tick<rally.nextTick)return;
    rally.phase='open';rally.untilTick=tick+rules.windowTicks;rally.nextTick=tick+rules.periodTicks;
    rally.holder=null;rally.heldTicks=0;rally.winner=null;
  }
  if(tick>=rally.untilTick){
    rally.phase='waiting';rally.holder=null;rally.heldTicks=0;rally.contested=false;return;
  }
  // Contested ground and leaving the circle both break uninterrupted control.
  rally.contested=presence[0]&&presence[1];
  const team=presence[0]===presence[1]?null:presence[0]?0:1;
  if(team===null){rally.holder=null;rally.heldTicks=0;return;}
  if(rally.holder!==team){rally.holder=team;rally.heldTicks=0;}
  if(++rally.heldTicks>=rules.holdTicks){
    rally.phase='claimed';rally.reward=team;rally.winner=team;rally.wins[team]++;
  }
}
export function consumeBellRally(rally?:BellRally){
  const team=rally?.reward??null;
  if(rally)rally.reward=null;
  return team;
}
export function bellRallyBonus(maxHp:number){
  return Math.min(BELL_RALLY_RULES.reinforceCap,Math.round(maxHp*BELL_RALLY_RULES.reinforceFraction));
}

/** Presentation derives labels directly from the same fixed-tick state. */
export function bellRallyCue(rally:BellRally|undefined,tick:number){
  if(!rally)return null;
  if(rally.reward!==null){
    const team=rally.reward===0?'Blue':'Pink';
    return {phase:'claimed',team:rally.reward,label:team+' won the Bell',notice:team+' won the Bell Rally'};
  }
  if(rally.phase==='open'){
    const remain=Math.max(0,Math.ceil((rally.untilTick-tick)/60));
    const label=rally.contested?'Bell contested':rally.holder!==null?
      'Bell hold '+Math.min(3,Math.floor(rally.heldTicks/60))+'/3s':'Hold the Bell ring';
    return {phase:'open',label:label+' · '+remain+'s',notice:'Bell Rally open: hold center 3s'};
  }
  if(tick>=rally.nextTick-330&&tick<rally.nextTick){
    return {phase:'soon',label:'Bell opens in '+Math.ceil((rally.nextTick-tick)/60)+'s',notice:'Bell Rally opens soon'};
  }
  return null;
}

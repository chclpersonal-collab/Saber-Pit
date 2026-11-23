import {ARCADE_EXPANDED_MOVES} from './arcade-expanded-combat.js?v=2.32.0';
/** Watch-only presentation: decisions and event counts come from the sim. */
const routes={parry:'Parry reply',whiff:'Changed attack line',travel:'Footwork follow-up'};
const plans={balanced:'Balanced',aggressive:'Aggressive',defensive:'Defensive'};
export function heroWatchFrame(fighters,id){
  const hero=fighters.find(f=>f.alive&&f.id===id&&f.heroId&&!f.control);
  if(!hero)return [];
  const distance=f=>Math.hypot(hero.x-f.x,hero.y-f.y);
  const enemies=fighters.filter(f=>f.alive&&f.team!==hero.team).sort((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id));
  const local=enemies.filter(f=>distance(f)<=330).slice(0,2);
  if(!local.length&&enemies.length)local.push(enemies[0]);
  return local.length?[hero,...local]:[];
}
export function captureHeroWatch(events,fighters,previous={}){
  const out={...previous};
  for(const e of events){
    const target=fighters.find(f=>f.id===e.targetId), actor=fighters.find(f=>f.id===e.fighterId);
    const subject=e.kind==='ko'&&target?.heroId?target:actor;
    if(!subject?.heroId||subject.control)continue;
    const record=out[subject.id]??{relights:0,last:'',time:0};
    let last=null,relights=record.relights;
    if(e.kind==='hero_plan'&&plans[e.plan])last='Switched to '+plans[e.plan].toLowerCase();
    else if(e.kind==='advanced_route'&&Object.hasOwn(routes,e.route))last=routes[e.route];
    else if(e.kind==='expanded_release'&&Object.hasOwn(ARCADE_EXPANDED_MOVES,e.moveId))last=ARCADE_EXPANDED_MOVES[e.moveId].label;
    else if(e.kind==='hero_reposition')last='Moved out of a crossfire';
    else if(e.kind==='trakata_off')last='Doused the blade for Tràkata';
    else if(e.kind==='trakata_on'){
      last=e.interrupted?'Tràkata interrupted':'Relit the blade for Tràkata';
      if(!e.interrupted)relights++;
    }else if(e.kind==='ko'&&target===subject)last='Knocked out';
    else if(e.kind==='ko'&&actor===subject)last='Scored a knockout';
    if(last)out[subject.id]={last,relights,time:e.time};
    if(e.kind==='ko'&&target===subject&&actor?.heroId&&!actor.control&&actor!==target){
      out[actor.id]={last:'Scored a knockout',relights:out[actor.id]?.relights??0,time:e.time};
    }
  }
  return out;
}

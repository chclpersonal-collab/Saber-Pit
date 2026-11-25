import {mobaPressure,type MobaState} from './arcade-moba.js';
const laneNames=['North','Center','South'] as const;
export function mobaDeathSource(game:MobaState):string|null{
  const ko=game.events.findLast(e=>e.type==='ko'&&e.targetId===game.player.id);
  if(!ko?.actorId)return null;
  const hero=game.heroes.find(x=>x.id===ko.actorId);
  if(hero)return hero.name;
  const tower=game.towers.find(x=>x.id===ko.actorId);
  if(tower)return laneNames[tower.lane]+' tower';
  if(game.cores.some(x=>x.id===ko.actorId))return 'Pink Core';
  if(/^wave-\d+-[01]-[012]-[0123]$/.test(ko.actorId))return 'Pink minion';
  return null;
}
export function mobaObjectiveCue(game:MobaState):{label:string;warning:boolean}{
  const p=game.player, core=game.cores[1], lane=laneNames[p.lane];
  const safe=(label:string)=>({label,warning:false}), pressure=mobaPressure(game);
  if(pressure.underFire)return {label:`${pressure.structureKind==='core'?'Core':'Tower'} fire: fall back to wave`,warning:true};
  if(pressure.waveBehind)return {label:'Wave behind: regroup',warning:true};
  if(!core.shielded)return safe('Pink Core exposed: push in');
  const tower=game.towers.find(t=>t.team===1&&t.lane===p.lane&&t.alive);
  if(!tower)return safe('Rotate to a Pink tower');
  if(game.wave===0)return safe('Wait for your first wave');
  const behindWave=game.minions.some(m=>m.team===0&&m.lane===p.lane&&m.alive&&m.x>=p.x-38&&m.x<=p.x+265);
  if(behindWave)return safe(game.wave===1?'Follow your first '+lane.toLowerCase()+' wave':'Push with the '+lane.toLowerCase()+' wave');
  if(p.x<tower.x-125||p.x>tower.x+100)return safe('Regroup with your next '+lane.toLowerCase()+' wave');
  return safe(lane+' tower: let minions tank');
}

export function mobaFirstTowerDirection(game:MobaState,view:{x:number;y:number;width:number;height:number;zoom:number}){
  if(game.time>20||game.phase!=='playing'||!game.player.alive||!game.cores[1].shielded)return null;
  const target=game.towers.find(t=>t.team===1&&t.lane===game.player.lane&&t.alive);
  if(!target)return null;
  const dx=(target.x-view.x)*view.zoom/view.width-.5,dy=(target.y-view.y)*view.zoom/view.height-.5;
  if(Math.abs(dx)<=.46&&Math.abs(dy)<=.44)return null;
  const scale=Math.min(.42/Math.abs(dx),.38/Math.abs(dy));
  return {x:.5+dx*scale,y:.5+dy*scale,angle:Math.atan2(dy*view.height,dx*view.width)+Math.PI/2};
}

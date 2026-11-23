// @ts-nocheck
/** Arcade round objectives. Positions are in arena world units, timers in the
 * deterministic simulation clock. The caller owns movement/combat and rounds. */
export const ARCADE_OBJECTIVE_RULES=Object.freeze(['elimination','control','relic']);
export const ARCADE_SIGNAL_TARGET=30;
export const ARCADE_RELIC_TARGET=3;
export const ARCADE_RELIC_CARRIER_SCALE=.72;
export const ARCADE_RELIC_RESET_TIME=2;
export const ARCADE_RELIC_DROP_TIME=.5;

const EPS=1e-8;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(x,fallback)=>Number.isFinite(x)?x:fallback;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=f=>f?.alive??(Number.isFinite(f?.hp)&&f.hp>0);
const grounded=f=>f.airPhase?f.airPhase!=='airborne':!(f.airborne>0);
const stable=f=>alive(f)&&grounded(f)&&f.action!=='stagger'&&f.action!=='ko';
const ready=f=>stable(f)&&!f.attack&&!['dash','rush','sweep','slash','uppercut','force'].includes(f.action);
const byDist=p=>(a,b)=>dist(a,p)-dist(b,p)||(String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
const usableTeam=team=>team===0||team===1;

function bounded(point,bounds={}) {
  bounds??={};
  return {
    x:clamp(point.x,finite(bounds.minX,-Infinity),finite(bounds.maxX,Infinity)),
    y:clamp(point.y,finite(bounds.minY,-Infinity),finite(bounds.maxY,Infinity)),
  };
}
export function createArcadeObjective(rule='elimination',width=1120,height=640,bounds={}) {
  const name=ARCADE_OBJECTIVE_RULES.includes(rule)?rule:'elimination';
  width=Math.max(1,finite(width,1120));height=Math.max(1,finite(height,640));
  const center={...bounded({x:width*.5,y:height*.5},bounds),radius:clamp(Math.min(width,height)*.139,52,92)};
  return {
    rule:name,score:[0,0],target:name==='relic'?ARCADE_RELIC_TARGET:name==='control'?ARCADE_SIGNAL_TARGET:0,
    center,owner:null,contested:false,presence:[0,0],capture:0,
    relic:name==='relic'?{
      x:center.x,y:center.y,radius:clamp(Math.min(width,height)*.065,29,44),
      carrierId:null,carrierTeam:null,state:'available',resetAt:0,unlockAt:0,
      homes:[0,1].map(team=>({...bounded({x:width*(team===0?.18:.82),y:center.y},bounds),
        radius:clamp(Math.min(width,height)*.088,38,64)}))
    }:null,
  };
}

export const isArcadeCarrier=(s,f)=>Boolean(f&&alive(f)&&s?.objective?.rule==='relic'&&
  s.objective.relic.state==='carried'&&s.objective.relic.carrierId===f.id);
export const carrierSpeedScale=(s,f)=>isArcadeCarrier(s,f)?ARCADE_RELIC_CARRIER_SCALE:1;
function detachRelic(o,position,time,delivered=false) {
  Object.assign(o.relic,{x:position.x,y:position.y,carrierId:null,carrierTeam:null,
    state:delivered?'resetting':'available',resetAt:delivered?time+ARCADE_RELIC_RESET_TIME:0,
    unlockAt:time+(delivered?ARCADE_RELIC_RESET_TIME:ARCADE_RELIC_DROP_TIME)});
  o.owner=null;o.contested=false;o.presence=[0,0];
}
function nearby(s,position,radius,available) {
  const people=s.fighters.filter(f=>usableTeam(f.team)&&available(f)&&dist(f,position)<=radius+EPS);
  return {people,counts:[people.filter(f=>f.team===0).length,people.filter(f=>f.team===1).length]};
}
function updatePresence(o,counts) {
  o.presence=counts;o.contested=counts[0]>0&&counts[1]>0;
}
function stepControl(s,o,dt) {
  updatePresence(o,nearby(s,o.center,o.center.radius,stable).counts);
  if(o.contested)return;
  const [first,second]=o.presence, direction=Math.sign(first-second);
  if(!direction) {
    if(o.owner===null)o.capture-=Math.sign(o.capture)*Math.min(Math.abs(o.capture),5*dt);
    return;
  }
  const team=direction===1?0:1, rate=Math.min(3,Math.abs(first-second))*15;
  const alreadyHeld=o.owner===team;
  // Credit only the part of this substep after capture, so rounding or update
  // cadence cannot give the claimant a full extra second at the threshold.
  const toCapture=Math.max(0,(100-direction*o.capture)/rate);
  o.capture=clamp(o.capture+direction*rate*dt,-100,100);
  if(toCapture<=dt+EPS){o.capture=direction*100;o.owner=team;}
  const held=alreadyHeld?dt:o.owner===team?Math.max(0,dt-toCapture):0;
  o.score[team]=Math.min(o.target,o.score[team]+held);
}
function stepRelic(s,o,time) {
  const r=o.relic;
  if(r.state==='carried'){
    const carrier=s.fighters.find(f=>f.id===r.carrierId);
    if(!alive(carrier)){
      detachRelic(o,bounded(carrier??r,s.bounds),time);
      return;
    }
    r.x=carrier.x;r.y=carrier.y;r.carrierTeam=carrier.team;o.owner=carrier.team;
    updatePresence(o,nearby(s,r,r.radius,stable).counts);
    if(ready(carrier)&&dist(carrier,r.homes[carrier.team])<=r.homes[carrier.team].radius+EPS) {
      o.score[carrier.team]=Math.min(o.target,o.score[carrier.team]+1);
      detachRelic(o,o.center,time,true);
    }
    return;
  }
  if(r.state==='resetting'){
    if(time+EPS<r.resetAt)return;
    r.state='available';r.resetAt=0;
  }
  const {people,counts}=nearby(s,r,r.radius,f=>alive(f)&&grounded(f));
  updatePresence(o,counts);
  if(time+EPS<r.unlockAt||o.contested)return;
  const carrier=people.filter(ready).sort(byDist(r))[0];
  if(carrier){
    Object.assign(r,{x:carrier.x,y:carrier.y,carrierId:carrier.id,carrierTeam:carrier.team,
      state:'carried',resetAt:0,unlockAt:0});
    o.owner=carrier.team;
  }
}

/** Returns 0, 1 or null. Run after combat/deaths; callers retain precedence for
 * squad elimination (including mutual loss) over objective wins. */
export function advanceArcadeObjective(s,dt) {
  const o=s?.objective;
  if(!o||o.rule==='elimination'||!Number.isFinite(dt)||dt<=0)return null;
  if(o.rule==='control')stepControl(s,o,dt);
  else if(o.rule==='relic')stepRelic(s,o,finite(s.time,0));
  return objectiveOutcome(s);
}
export function objectiveOutcome(s,{timedOut=false}={}) {
  const o=s?.objective;
  if(!o||o.rule==='elimination')return null;
  if(!timedOut&&!o.score.some(points=>points>=o.target-EPS))return null;
  const [left,right]=o.score.map(points=>Math.round(points*1000));
  return left===right?null:left>right?0:1;
}

/** Mode-aware public destinations. Local combat/guard/dodge logic stays with AI. */
export function arcadeObjectiveMove(s,f) {
  const o=s?.objective;
  if(!o||o.rule==='elimination'||!alive(f)||!usableTeam(f.team))return null;
  const move=(p,role)=>({...bounded(p,s.bounds),role});
  const team=f.team, slot=Number.isInteger(f.slot)?f.slot:0, sign=team===0?1:-1;
  if(o.rule==='control'){
    const landing=slot===0?0:((slot%2===1?-1:1)*Math.ceil(slot/2)*23);
    return move({x:o.center.x-sign*o.center.radius*.22,y:o.center.y+landing},'hold');
  }
  const r=o.relic;
  const carrier=r.state==='carried'?s.fighters.find(other=>other.id===r.carrierId&&alive(other)):null;
  if(carrier?.id===f.id)return move(r.homes[team],'escape');
  if(carrier&&carrier.team!==team){
    const home=r.homes[carrier.team], len=Math.max(1,dist(home,carrier));
    return move({x:carrier.x+(home.x-carrier.x)/len*49,y:carrier.y+(home.y-carrier.y)/len*49},'intercept');
  }
  if(carrier){
    const wing=slot===0?-1:slot%2===1?1:-1;
    return move({x:carrier.x+sign*54,y:carrier.y+wing*42},'escort');
  }
  const first=s.fighters.filter(other=>other.team===team&&stable(other)).sort(byDist(r))[0];
  if(first?.id===f.id)return move(r,'retrieve');
  const wing=slot%2===1?1:-1;
  return move({x:r.x-sign*61,y:r.y+wing*(45+Math.floor(slot/2)*14)},'screen');
}

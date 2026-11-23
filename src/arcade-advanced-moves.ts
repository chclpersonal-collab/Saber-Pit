// @ts-nocheck
/** Opt-in saber follow-ups. Choose existing physical specs; never change
 * release time, hit geometry, rank, damage, or Force. */
export const ADVANCED_FOLLOWUP_RANKS=Object.freeze({parry:5,whiff:7,travel:10});
const number=(n,d)=>Number.isFinite(n)?n:d;
const family=move=>move.air?'aerial':move.motion?.path??'diagonal';
const chamber=move=>Math.sign(number(move.motion?.chamber,0));
function fitting(move,c){
  const rank=number(c.rank,-1),distance=number(c.distance,Infinity),line=number(c.line,Infinity);
  return Boolean(move&&move.mapAction!=='force'&&!move.forceAbility)&&number(move.minRank,0)<=rank&&
    distance>=0&&distance<=number(move.reach,0)+8&&Math.abs(line)<=number(move.arc,0)&&number(c.energy,0)>=number(move.cost,Infinity);
}
export function advancedAttackScore(move,c){
  if(!c?.advancedArena||!fitting(move,c))return 0;
  const rank=c.rank,wind=number(c.wind,0),side=number(c.side,0),motion=family(move);
  if(rank>=2&&c.guarded&&Math.abs(side)>.18){
    const flank=move.opening==='inside'?-1:move.opening==='outside'?1:0;
    if(flank)return flank===Math.sign(side)?1.10:-1.30;
  }
  if(rank>=5&&wind>.12&&move.deflect&&move.contact<=wind+.04&&motion==='screen')return 1.85;
  if(rank>=10&&c.crowd>=2&&move.cap>=2&&motion==='arc')return 1.7;
  return 0;
}
/** Trigger comes from an engine consequence. This does not grant an
 * automatic cancel or a free strike. */
export function chooseAdvancedFollowup(moves,c){
  const trigger=c?.trigger,gate=ADVANCED_FOLLOWUP_RANKS[trigger];
  if(!c?.advancedArena||!Number.isFinite(gate)||number(c.rank,-1)<gate)return null;
  const previous=c.previous??moves.find(m=>m.id===c.previousId);
  if(trigger==='whiff'&&!previous)return null;
  const aimSide=Math.sign(number(c.side,0));
  let pick=null,best=-Infinity;
  for(const move of moves){
    if(move.id===c.previousId||move.id===previous?.id||!fitting(move,c)||move.air)continue;
    const path=family(move),quick=Math.max(0,.31-move.contact),reserve=(c.energy-move.cost)*.009;
    let score=reserve;
    if(trigger==='parry'){
      if(move.role!=='counter'&&move.opening!=='intercept')continue;
      if(move.contact>Math.min(.32,number(c.window,.32)))continue;
      score+=quick*15+(move.opening==='intercept'&&c.rank>=14?1.3:0);
    }else if(trigger==='whiff'){
      const otherLane=chamber(move)*chamber(previous)<0,changePath=path!==family(previous);
      if((move.role!=='light'&&move.role!=='counter')||(!otherLane&&!changePath)||move.contact>.30)continue;
      if(!(move.reach>=previous.reach||c.distance<=move.reach-9))continue;
      score+=quick*12+Number(otherLane)*1.15+Number(changePath)*1.4;
    }else{
      if(!['light','heavy','crowd'].includes(move.role)||c.distance<38||move.contact>.43)continue;
      if(move.role==='crowd'&&number(c.crowd,0)<2)continue;
      score+=Math.min(1.8,move.lunge*.007)+Number(chamber(move)===aimSide)*.75;
      if(path==='point'&&Math.abs(c.line)<.28)score+=1.5;
      if(move.cap>=2&&c.crowd>=2&&path==='arc')score+=2.15;
    }
    score+=advancedAttackScore(move,c);
    if(score>best){pick=move.id;best=score;}
  }
  return pick;
}

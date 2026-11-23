// @ts-nocheck
/** Tactical objective only; never resolves a fixture or authorizes an input.
 * injuryEdge: -1 injured much worse to +1 opponent much worse.
 * pressure: 0..1 immediate danger to self; opening: true or 0..1 credible opening.
 */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=(n,otherwise=0)=>Number.isFinite(n)?n:otherwise;
const care=Object.freeze({shii_cho:0,makashi:.035,soresu:.075,ataru:-.025,djem_so:-.035,niman:.028,juyo:-.062});
export function chooseArenaMatchGoal(c={}){
  const limit=finite(c.limit),time=finite(c.time);
  if(limit<=0||time<0)return 'win';
  const progress=clamp(time/limit,0,1);
  const hold=c.currentGoal==='draw';
  const own=finite(c.selfAlive,1),foe=finite(c.enemyAlive,1);
  const injury=clamp(finite(c.injuryEdge),-1,1);
  const pressure=clamp(finite(c.pressure),0,1);
  const opening=c.opening===true?1:clamp(finite(c.opening),0,1);
  if(progress<.32||own<=0||foe<=0||opening>=.72)return 'win';
  // A convincing health/number edge with safe space means press for the
  // elimination. The clock offers no lead protection in this ruleset.
  if((own>foe||injury>.49)&&pressure<=.48)return 'win';
  const numbers=clamp((foe-own)/Math.max(own,foe),-1,1);
  // Saturate rating: matchup expectations may nudge an already risky choice,
  // but never substitute for the actual fight.
  const rating=clamp((finite(c.opponentElo,1500)-finite(c.elo,1500))/450,-1,1);
  const late=clamp((progress-.32)/.68,0,1);
  const risk=(-injury*.39)+(pressure*.30)+(numbers*.38)+(rating*.085)+(late*.22)-(opening*.28)
    +(Object.hasOwn(care,c.form)?care[c.form]:0);
  if(pressure<.22&&injury>=-.12&&numbers<=0&&risk<.31)return 'win';
  // Avoid oscillating over one frame or one missed swing.
  return risk>=(hold?.37:.46)?'draw':'win';
}

/** Authoring classification and contextual choice among already legal saber moves. */
export function arcadeAttackPresentation(id,move,action){
  const path=move?.motion?.path;
  const family=action==='force' || move?.forceAbility?'cast':
    move?.air||path==='aerial'||id==='vault'?'vault':
    action==='uppercut'||id==='riposte'?'rise':
    path==='screen'||id==='deflect'?'screen':
    path==='point'||path==='feint'||action==='rush'?'thrust':
    path==='arc'||action==='sweep'?'sweep':'cut';
  const chamber=Number.isFinite(move?.motion?.chamber)?move.motion.chamber:
    id==='slash2'||id==='slash4'?1:id==='slash'||id==='slash3'?-1:0;
  return {family,variant:chamber<-.35?'inside':chamber>.35?'outside':'center'};
}
function formAffinity(form,family,c){
  const {distance,side,guarded,wind,open,crowd}=c;
  if(form==='shii_cho')return family==='sweep'?(crowd>=2?4.2:Math.abs(side)>.46?2.4:guarded?1.3:.3):family==='cut'&&distance<78?2.0:0;
  if(form==='makashi')return family==='thrust'?(distance>87?3.4:guarded?1.4:.8):family==='cut'&&distance<82?2.3:0;
  if(form==='soresu')return family==='screen'?(wind?3.7:distance<73?1.65:-.1):family==='cut'&&open?2.2:family==='sweep'&&guarded?-1:0;
  if(form==='ataru')return family==='vault'?(distance>112&&!wind?3.7:distance<78?-3:.55):family==='cut'&&distance<87?2.1:0;
  if(form==='djem_so')return family==='rise'?(open||c.counter?3.7:distance<94?.8:-1.7):family==='cut'&&guarded?1.1:0;
  if(form==='niman')return family==='cast'&&distance>115?2.3:family==='sweep'&&Math.abs(side)>.4?1.6:family==='cut'&&distance<105?1.6:0;
  if(form==='juyo')return family==='cut'?(c.chain||open?2.9:1.2):family==='sweep'&&(guarded||crowd>=2)?2.2:0;
  return 0;
}
export function chooseFormCommit(pool,c){
  let best=null,value=-Infinity;
  for(const option of pool){
    const m=option.move;
    const {family,variant}=arcadeAttackPresentation(option.id,m,option.action);
    const margin=m.reach+(m.air?64:16)-c.distance;
    if(margin< -26||c.line>m.arc+.29||m.cost>c.energy+.5)continue;
    if(m.air&&c.wind&&m.contact>c.wind+.11)continue;
    const last=c.history?.at(-1);
    const recent=c.history?.slice(-4)??[];
    const same=recent.filter(h=>h.family===family).length;
    let run=0;
    for(let i=recent.length-1;i>=0&&recent[i].family===family;i--)run++;
    const keepRead=m.deflect&&c.wind||family==='rise'&&c.counter;
    const stale=run>=2&&!keepRead?(run===2?1.1:2.9):0;
    // Recent rhythm only, never the round's lifetime histogram. A sound
    // gesture may repeat when the opponent stays in the same opening.
    const spacing=margin<0?margin*.24:Math.min(29,margin)*.065;
    const timing=c.open?Math.max(0,.36-m.contact)*8:c.wind&&m.deflect?2.2:0;
    const lane=c.guarded?
      (variant==='inside'&&c.side<-.12||variant==='outside'&&c.side>.12?1.45:0)
      +(m.tactical==='feint_redirect'?2.5:0):0;
    const intent=option.intentMatch?2.9:0.15;
    const cost=c.energy<38?m.cost*.054:0;
    const score=intent+spacing+timing+lane+formAffinity(c.form,family,c)-
      Number(last?.id===option.id)*(c.chain&&c.open?.95:3.7)-Number(last?.family===family)*1.42-same*.36-stale-cost;
    if(score>value){value=score;best=option.id;}
  }
  return best;
}

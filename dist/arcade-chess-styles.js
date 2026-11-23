/** Optional chess-inspired saber geometry layered over the current form.
 * Angles are world radians. The base attack timing/animation is untouched. */
const entry=(id,label,hint,reach=1,arc=1,width=0)=>Object.freeze({id,label,hint,description:hint,reach,arc,width});
export const ARCADE_CHESS_STYLES=Object.freeze(Object.fromEntries([
  entry('none','Classic','Original form, reach and saber angles.'),
  entry('mixed','Mixed','Assign each fighter a chess style when the match starts.'),
  entry('king','King','Close-range coverage with a tight pivot on broad cuts.',.84,1.21),
  entry('queen','Queen','Turns and sweeps wide at midrange. Straight and diagonal specialists can reach farther.',1.075,1.035),
  entry('rook','Rook','Longest reach along straight arena lanes. Reposition to line up the target.',1.19,1.01,.61),
  entry('bishop','Bishop','Diagonal arena lanes. Reach across the corner rather than straight ahead.',1.15,1.04,.64),
  entry('knight','Knight','Full reach from a flank; only a close check reaches a facing opponent.',1.07,1.04,.52),
  entry('pawn','Pawn','A short attack straight ahead. Land three consecutive swings without retreat to promote.',.88,.92,.365),
].map(s=>[s.id,s])));
const mixed=Object.freeze(['king','queen','rook','bishop','knight','pawn']);
// A recruit/Hero's identity keeps its chess style across seats, seeds, and modes.
export function arcadeChessStyleForId(id){
 if(typeof id!=='string'||!id.trim())return 'pawn';
 let hash=2166136261;
 for(const char of id.trim())hash=Math.imul(hash^char.codePointAt(0),16777619);
 return mixed[(hash>>>0)%mixed.length];
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const Q=Math.PI/2;
const valid=Number.isFinite;
export function normalizeArcadeChessStyle(v){
 return typeof v==='string'&&Object.hasOwn(ARCADE_CHESS_STYLES,v)?v:'none';
}
export function arcadeChessStyleFor(value,slot=0,seed=0){
 const style=normalizeArcadeChessStyle(value);
 if(style!=='mixed')return style;
 const phase=(Math.trunc(Number(seed)||0)>>>0)%mixed.length;
 const i=Math.max(0,Math.trunc(Number(slot)||0));
 return mixed[(i+phase)%mixed.length];
}
const effective=(value,promoted=false)=>normalizeArcadeChessStyle(value)==='pawn'&&promoted?'queen':normalizeArcadeChessStyle(value);
export function arcadeChessMove(style,move,{promoted=false}={}){
 const id=effective(style,promoted);
 if(!move||id==='none'||id==='mixed'||move.freeHand||move.expanded||move.forceAbility)return move;
 const p=ARCADE_CHESS_STYLES[id];
 const tune=spec=>({...spec,reach:spec.reach*p.reach,arc:clamp(spec.arc*p.arc+(id==='king'?.09:0),.14,Math.PI)});
 return {...tune(move),
   ...(move.offhand?{offhand:tune(move.offhand)}:{})};
}
function centers(id,{bearing,face,targetFace,backLane=false,styleTravel=false}={}){
 if(!valid(bearing))return [];
 if(id==='rook')return [0,Q,2*Q,3*Q];
 if(id==='bishop')return [0,Q,2*Q,3*Q].map(a=>a+Q/2);
 if(id==='knight')return valid(targetFace)?[targetFace+Q,targetFace-Q,targetFace]:[];
 if(id==='pawn'){
   if(!valid(face))return [];
   if(styleTravel)return [face+(backLane?Math.PI:0)];
   const forward=Math.round((face+(backLane?Math.PI:0))/Q)*Q;
   return [forward-Q/2,forward+Q/2];
 }
 return [];
}
export function arcadeChessAllowsLane(style,context={}){
 const id=effective(style,context.promoted),{bearing,targetFace,distance}=context;
 if(!['rook','bishop','knight','pawn'].includes(id))return true;
 if(!valid(bearing))return false;
 if(id==='knight'){
   if(!valid(targetFace))return true;
   // A target facing you still has an honest short check window; no free
   // flank when it is tracking you, and no change to actual guard resolution.
   const front=Math.abs(angle(bearing+Math.PI,targetFace));
   if(front<.67)return valid(distance)&&distance<=52;
 }
 return centers(id,context).some(lane=>Math.abs(angle(bearing,lane))<=ARCADE_CHESS_STYLES[id].width);
}
export function arcadeChessDesiredBearing(style,context={}){
 const id=effective(style,context.promoted),{bearing}=context;
 if(arcadeChessAllowsLane(style,context)||!valid(bearing))return bearing;
 const options=centers(id,context);
 const center=options.reduce((best,next)=>Math.abs(angle(bearing,next))<Math.abs(angle(bearing,best))?next:best,options[0]);
 return valid(center)?bearing+angle(center,bearing):bearing;
}
/** One result per completed swing. Passing a repeated serial (dual/staff)
 * cannot add a streak step. Once promoted it stays until the next round. */
export function arcadeChessPawnStrike(state,{landed,retreated=false,serial}={}){
 const prior={streak:Math.trunc(clamp(Number(state?.streak)||0,0,3)),promoted:state?.promoted===true,lastSerial:state?.lastSerial??null};
 if(prior.promoted)return {...prior,streak:3};
 if(retreated)return {streak:0,promoted:false,lastSerial:serial??prior.lastSerial};
 if(typeof landed!=='boolean'||serial===undefined||serial===null||serial===prior.lastSerial)return prior;
 const streak=landed?prior.streak+1:0;
 return {streak,promoted:streak===3,lastSerial:serial};
}

/** Re-assess geometry between exchanges. Absolute arena lanes and the
 * defender's actual facing matter; this neither edits a swing nor rolls RNG. */
export function chooseArcadeChessStyle({
 baseStyle,currentStyle,distance,bearing,face=bearing,targetFace,threat=0,guarded=false,imminent=false,
 crowd=0,committed=false,sinceSwitch=Infinity,pawnStreak=0,chessPromoted=false,styleTravel=false
}={}){
 const concrete=x=>mixed.includes(x)?x:null;
 const base=concrete(baseStyle)??'king',current=concrete(currentStyle)??base;
 if(committed||sinceSwitch<1.70||!valid(distance)||!valid(bearing)||distance<0)return current;
 const d=distance,pressure=clamp(threat===true?1:Number(threat)||0,0,1);
 const profile=(peak,span)=>Math.max(0,1-Math.abs(d-peak)/span);
 const near=d<71, flank=valid(targetFace)&&Math.abs(Math.abs(angle(bearing+Math.PI,targetFace))-Q)<.53;
 const ctx={bearing,face,targetFace,distance:d,styleTravel};
 const cardinal=arcadeChessAllowsLane('rook',ctx),diagonal=arcadeChessAllowsLane('bishop',ctx);
 const pawnLane=arcadeChessAllowsLane('pawn',ctx);
 const score={
   king:2.45*profile(53,56)+pressure*(near?1.10:.20)+(imminent&&near?.47:0)+Math.min(2,crowd)*.14,
   queen:2.08*profile(124,81)+(d>102&&!cardinal&&!diagonal?.45:0)+Math.min(2,crowd)*.11,
   rook:2.05*profile(125,69)+(cardinal?1.02:-.82)-(near?.36:0),
   bishop:1.98*profile(92,67)+(diagonal?1.10:-.78),
   knight:1.71*profile(86,63)+(flank?1.37:near?.30:-.74)+(guarded&&flank?.49:0),
   pawn:chessPromoted?1.94*profile(115,78)+.27:
     2.23*profile(59,53)+(pawnLane?.88:-.91)+Math.min(2,Math.max(0,Number(pawnStreak)||0))*.22-pressure*.18,
 };
 for(const id of mixed)score[id]+=(id===base?.18:0)+(id===current?.34:0);
 let next=current;
 for(const id of mixed)if(score[id]>score[next]+1e-9)next=id;
 return score[next]-score[current]>=.26?next:current;
}

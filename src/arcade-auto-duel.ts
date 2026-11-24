/** A visible-time countdown; a ticket can dispatch only one next round. */
export const AUTO_DUEL_BREAK_SECONDS=3;
export function createAutoDuel(){
  let active=false, remaining:number|null=null;
  return {
    get active(){return active;},
    get seconds(){return remaining===null?null:Math.ceil(remaining);},
    start(){active=true;remaining=null;},
    stop(){active=false;remaining=null;},
    clearRound(){remaining=null;},
    completeRound(saved:boolean){
      if(!saved){active=false;remaining=null;}
      else if(active&&remaining===null)remaining=AUTO_DUEL_BREAK_SECONDS;
    },
    advance(dt:number,visible:boolean){
      if(!active||remaining===null||!visible||!Number.isFinite(dt)||dt<=0)return false;
      remaining-=dt;
      if(remaining>1e-9)return false;
      remaining=null;
      return true;
    },
  };
}

/** The Tournament's seat in the v6 match screen: the person is Blue in the bracket's next bout, the Blue fighter of a 1v1
 *  or the first fighter of the Blue squad in a 5v5. Same fixture, rules and clock as a simulated bout. The bout is written
 *  once, under the Tournament's lock, and only if the save still expects this exact fixture. Leaving early writes nothing. */
import {TOURNAMENT_KEY,loadTournament,saveTournament} from './arcade-tournament.js?v=6.0.2';
import {SQUAD_TOURNAMENT_KEY,loadSquadTournament,saveSquadTournament} from './squad-tournament.js?v=6.0.2';
import {TOURNAMENT_HUMAN_KEYS,startTournamentHumanBout,commitTournamentHumanBout,tournamentRematch,type TournamentFormat} from './tournament-play.js?v=6.0.3-seat';
import type {HumanControls} from './gauntlet-play.js?v=6.0.3-seat';
import {readSeatSave as read,settleSeat,type ArenaSeat,type ArenaSeatEnd,type ArenaSeatOpen} from './arena-seat.js?v=6.0.3-seat';

type State=Parameters<typeof commitTournamentHumanBout>[0];
const SAVES={
  solo:{key:TOURNAMENT_KEY,load:loadTournament,save:saveTournament,back:'./tournament.html',size:1},
  squad:{key:SQUAD_TOURNAMENT_KEY,load:loadSquadTournament,save:saveSquadTournament,back:'./tournament.html#squads',size:5},
} as const;
export function openTournamentSeat(format: TournamentFormat): ArenaSeatOpen{
  const {key,back,size}=SAVES[format], load=SAVES[format].load as ()=>State, save=SAVES[format].save as (state: State)=>boolean;
  const known=read(key);
  if(known===undefined)return {ok:false,text:'Saving blocked in this browser',back};
  const bout=startTournamentHumanBout(format,load());
  if(!bout)return {ok:false,text:'No bout ready: draw a bracket',back,redirect:true};
  let ending: Promise<ArenaSeatEnd> | null=null, left=false;
  const seat: ArenaSeat={
    kind:format==='squad'?'squads':'tournament',label:'Tournament',mode:format==='squad'?'squad':'duel',back,
    mapId:bout.fixture.terrain??'underpit',teamSizes:[size,size],game:bout.game,
    step(input){if(!left)bout.step(input as HumanControls);},
    finish(){
      return ending??=(async()=>{
        const winner=bout.result().winnerIndex;
        const title=winner===0?'Blue wins':winner===1?'Pink wins':'Draw';
        // The bracket page shows the advanced draw, so the result screen only leads back there.
        if(left)return {title,text:'Bout left, not saved',saved:false,next:false};
        const end=await settleSeat({key,known,logKey:TOURNAMENT_HUMAN_KEYS[format],
          commit:()=>commitTournamentHumanBout(load(),bout),
          log:()=>bout.log(),marker:()=>bout.marker(),save,savedText:state=>tournamentRematch(state,bout)?'Draw: rematch queued':'Bout saved'});
        return {title,...end,next:false};
      })();
    },
    leave(){if(!bout.over)left=true;},
  };
  return {ok:true,seat};
}

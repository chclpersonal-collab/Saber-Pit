/** The Gauntlet's seat in the v6 match screen: the person is the Blue solo fighter against the Pink trio.
 *  Same fixture, rules and clock as a simulated bout. The bout is written once, under the Gauntlet's lock,
 *  and only if the save still expects this exact fixture. Leaving early writes nothing. */
import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,nextGauntletBout} from './gauntlet-tournament.js?v=6.0.3-seat';
import {GAUNTLET_HUMAN_KEY,startHumanBout,commitHumanBout,humanMarker,type HumanControls} from './gauntlet-play.js?v=6.0.3-seat';
import {readSeatSave as read,settleSeat,type ArenaSeat,type ArenaSeatEnd,type ArenaSeatOpen} from './arena-seat.js?v=6.0.3-seat';

const BACK='./gauntlet.html';
export function openGauntletSeat(): ArenaSeatOpen{
  const known=read(GAUNTLET_KEY);
  if(known===undefined)return {ok:false,text:'Saving blocked in this browser',back:BACK};
  const state=loadGauntlet();
  const bout=startHumanBout(state);
  if(!bout||!nextGauntletBout(state))return {ok:false,text:'No bout ready: draw a bracket',back:BACK,redirect:true};
  let ending: Promise<ArenaSeatEnd> | null=null, left=false;
  const game=bout.game as unknown as {terrain?: {id?: string}};
  const seat: ArenaSeat={
    kind:'gauntlet',label:'Gauntlet',mode:'squad',back:BACK,
    mapId:bout.fixture.terrain??game.terrain?.id??'underpit',teamSizes:[1,3],game:bout.game,
    step(input){if(!left)bout.step(input as HumanControls);},
    finish(){
      return ending??=(async()=>{
        const winner=bout.result().winnerIndex;
        const title=winner===0?'Blue wins':winner===1?'Pink wins':'Draw';
        const done=(text: string,saved=false): ArenaSeatEnd=>{
          const next=nextGauntletBout(loadGauntlet());
          return {title,text,saved,next:Boolean(next)};
        };
        if(left)return done('Bout left, not saved');
        const end=await settleSeat({key:GAUNTLET_KEY,known,logKey:GAUNTLET_HUMAN_KEY,
          commit:()=>commitHumanBout(loadGauntlet(),bout),
          log:state=>bout.log(state.active!.cursor),
          marker:state=>humanMarker(bout.season,bout.fixture.id,state.active!.cursor),
          save:saveGauntlet,savedText:state=>'Bout '+state.active!.cursor+' saved'});
        return done(end.text,end.saved);
      })();
    },
    leave(){if(!bout.over)left=true;},
  };
  return {ok:true,seat};
}

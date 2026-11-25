/** The Gauntlet's seat in the v6 match screen: the person is the Blue solo fighter against the Pink trio.
 *  Same fixture, rules and clock as a simulated bout. The bout is written once, under the Gauntlet's lock,
 *  and only if the save still expects this exact fixture. Leaving early writes nothing. */
import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,nextGauntletBout} from './gauntlet-tournament.js?v=4.01.1';
import {GAUNTLET_HUMAN_KEY,startHumanBout,commitHumanBout,type HumanControls} from './gauntlet-play.js';
import type {ArenaSeat,ArenaSeatEnd,ArenaSeatOpen} from './arena-seat.js';

const BACK='./gauntlet.html';
const read=(key: string)=>{try{return globalThis.localStorage.getItem(key);}catch{return undefined;}};
function locked<T>(task: () => T, otherwise: T): Promise<T>{
  const locks=globalThis.navigator?.locks;
  if(typeof locks?.request!=='function')return Promise.resolve(task());
  return Promise.resolve(locks.request('saber-pit:progress:'+GAUNTLET_KEY,{ifAvailable:true},lock=>lock?task():otherwise)).catch(()=>otherwise);
}
export function openGauntletSeat(): ArenaSeatOpen{
  const known=read(GAUNTLET_KEY);
  if(known===undefined)return {ok:false,text:'This browser is blocking saved data, so a Gauntlet bout cannot be saved.',back:BACK};
  const state=loadGauntlet();
  const bout=startHumanBout(state);
  if(!bout||!nextGauntletBout(state))return {ok:false,text:'No Gauntlet bout is waiting. Draw a bracket first.',back:BACK};
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
        if(left)return done('Bout left. Nothing was saved.');
        const outcome=await locked(()=>{
          if(read(GAUNTLET_KEY)!==known)return 'changed';
          const result=commitHumanBout(loadGauntlet(),bout);
          if(!result.ok)return 'settled';
          if(!saveGauntlet(result.state))return 'unsaved';
          try{globalThis.localStorage.setItem(GAUNTLET_HUMAN_KEY,JSON.stringify(bout.log(result.state.active!.cursor)));}catch{/* Watch last bout then shows the simulated view. */}
          return 'saved:'+result.state.active!.cursor;
        },'busy');
        if(outcome.startsWith('saved:'))return done('Bout '+outcome.slice(6)+' saved to the Gauntlet.',true);
        return done(outcome==='changed'?'Not saved. The Gauntlet changed in another tab.':
          outcome==='settled'?'Not saved. This bout was already settled.':
          outcome==='busy'?'Not saved. The Gauntlet is busy in another tab.':'Not saved. The last verified save was kept.');
      })();
    },
    leave(){if(!bout.over)left=true;},
  };
  return {ok:true,seat};
}

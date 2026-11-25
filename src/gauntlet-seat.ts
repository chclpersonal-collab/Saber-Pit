/** The Gauntlet's seat in the v6 match screen: the person is the Blue solo fighter against the Pink trio.
 *  Same fixture, rules and clock as a simulated bout. The bout is written once, under the Gauntlet's lock,
 *  and only if the save still expects this exact fixture. Leaving early writes nothing. */
import {GAUNTLET_KEY,loadGauntlet,saveGauntlet,nextGauntletBout} from './gauntlet-tournament.js?v=6.0.2-rc2';
import {GAUNTLET_HUMAN_KEY,startHumanBout,commitHumanBout,humanMarker,type HumanControls} from './gauntlet-play.js?v=6.0.2-rc2';
import type {ArenaSeat,ArenaSeatEnd,ArenaSeatOpen} from './arena-seat.js?v=6.0.2-rc2';

const BACK='./gauntlet.html';
const read=(key: string)=>{try{return globalThis.localStorage.getItem(key);}catch{return undefined;}};
function locked<T>(task: () => T, otherwise: T): Promise<T>{
  const locks=globalThis.navigator?.locks;
  if(typeof locks?.request!=='function')return Promise.resolve(task());
  return Promise.resolve(locks.request('saber-pit:progress:'+GAUNTLET_KEY,{ifAvailable:true},lock=>lock?task():otherwise)).catch(()=>otherwise);
}
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
        const outcome=await locked(()=>{
          if(read(GAUNTLET_KEY)!==known)return 'changed';
          const result=commitHumanBout(loadGauntlet(),bout);
          if(!result.ok)return 'settled';
          // The fight record goes down first, so a settled human bout is never replayed as an AI fight:
          // the full log, or if storage refuses it, a small marker that says its replay is unavailable.
          const cursor=result.state.active!.cursor, store=globalThis.localStorage, before=read(GAUNTLET_HUMAN_KEY);
          const put=(value: unknown)=>{try{store.setItem(GAUNTLET_HUMAN_KEY,JSON.stringify(value));return true;}catch{return false;}};
          if(!put(bout.log(cursor))&&!put(humanMarker(bout.season,bout.fixture.id,cursor)))return 'full';
          if(!saveGauntlet(result.state)){
            try{if(before==null)store.removeItem(GAUNTLET_HUMAN_KEY);else store.setItem(GAUNTLET_HUMAN_KEY,before);}catch{/* the record names a bout the save never reached, so it can never match */}
            return 'unsaved';
          }
          return 'saved:'+cursor;
        },'busy');
        if(outcome.startsWith('saved:'))return done('Bout '+outcome.slice(6)+' saved',true);
        return done(outcome==='changed'?'Not saved: changed in another tab':
          outcome==='settled'?'Not saved: bout already settled':
          outcome==='busy'?'Not saved: busy in another tab':
          outcome==='full'?'Not saved: storage full':'Not saved: last save kept');
      })();
    },
    leave(){if(!bout.over)left=true;},
  };
  return {ok:true,seat};
}

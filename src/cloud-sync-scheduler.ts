import type {SyncResult} from './arcade-cloud-sync.js?v=6.0.2';
type SchedulerOptions={
  canSync:()=>boolean;
  sync:()=>Promise<SyncResult>;
  observe:(result:SyncResult)=>void;
  schedule:(task:()=>void,delay:number)=>unknown;
  cancel:(handle:unknown)=>void;
};
/** Coalesce same-tab commits; if one arrives during a request, run once again. */
export function createCloudSyncScheduler({canSync,sync,observe,schedule,cancel}:SchedulerOptions) {
  let busy=false,queued=false,handle:unknown=null,delay=0;
  const trigger=(wait=140)=>{
    if(!canSync())return;
    if(busy){queued=true;return;}
    if(handle!==null){if(delay<=wait)return;cancel(handle);}
    delay=wait;
    handle=schedule(()=>{handle=null;void run();},wait);
  };
  async function run(){
    if(busy){queued=true;return;}
    if(!canSync())return;
    busy=true;
    try{
      const result=await sync();
      observe(result);
      if(result.status==='busy'){queued=true;}
    }catch{
      // Device storage remains authoritative whenever the network isn't usable.
    }finally{
      busy=false;
      if(queued){queued=false;trigger(300);}
    }
  }
  const flush=()=>{
    if(handle!==null){cancel(handle);handle=null;}
    if(canSync())void run();
  };
  return {trigger,flush};
}

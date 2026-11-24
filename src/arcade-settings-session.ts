/** Resume only an unchanged playing round paused by this Settings visit. */
export function createSettingsSession<Round extends object>(){
  let owned:Round|null=null;
  return {
    begin(active:Round|null,paused:boolean){
      owned=active&&!paused?active:null;
      return owned!==null;
    },
    background(){owned=null;},
    close(active:Round|null,paused:boolean,hidden:boolean){
      const resume=owned!==null&&owned===active&&paused&&!hidden;
      owned=null;return resume;
    },
  };
}
